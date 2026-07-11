import levelsJson from "../game-levels.json";
import { createCampaignLevels } from "./campaign";
import { GameMode, type GameMode as GameModeValue, type GameProfile } from "./game-profile";
import type { GameAudio } from "./game-audio";
import { createEscapeBurstParticles } from "./game-engine/combat-effects";
import { ActiveCircleSweepCollisionIndex } from "./game-engine/collision-detection";
import { createMonster, createSplitterChildren } from "./game-engine/monster-factory";
import { UpdateResult, type UpdateContext } from "./game-engine/update-context";
import { GameRenderer, type FieldBounds } from "./game-renderer";
import { MAX_LINKS, MAX_PARTICLES } from "./constants";
import type { Monster } from "./entities/monsters/monster";
import type { Drone } from "./entities/projectiles/drone";
import { SplitterMonster } from "./entities/monsters/splitter-monster";
import { LaserTower } from "./entities/towers/laser-tower";
import { getTowerClass } from "./entities/towers/tower-registry";
import { Tower } from "./entities/towers/tower";
import { LevelRuntime } from "./level-runtime";
import { canPlaceTower, findTowerAtPoint } from "./placement-rules";
import {
  clamp,
  formatMoney,
  randomRange,
} from "./utils";
import {
  GameState,
  AudioCue,
  TowerKind,
  MonsterKind,
  type AudioCue as AudioCueValue,
  type LevelJsonPoint,
  type LevelData,
  type LevelJsonData,
  type Point,
  type WaveData,
} from "./types";

type BattleState = typeof GameState.Playing | typeof GameState.Paused;

const HIGHEST_UNLOCKED_LEVEL_STORAGE_KEY = "vector-defence-2026:highest-unlocked-level:v1";
const CAMPAIGN_CLEARED_STORAGE_KEY = "vector-defence-2026:campaign-cleared:v1";
const LEVEL_STARS_STORAGE_KEY_PREFIX = "vector-defence-2026:level-stars:v1:";

export function isBattleState(state: GameState): state is BattleState {
  return state === GameState.Playing || state === GameState.Paused;
}

export function isModalState(state: GameState): boolean {
  return state === GameState.Menu || state === GameState.Won || state === GameState.Lost || state === GameState.CampaignWon;
}

export interface GameFrameTimings {
  updateMs: number;
  drawMs: number;
}

const BREACH_DEFEAT_DELAY_SECONDS = 1;
const MONSTER_COLLISION_CELL_SIZE = 64;

export function createLevels(gameMode: GameModeValue): LevelData[] {
  return createCampaignLevels(normalizeLevels(levelsJson as LevelJsonData[], gameMode), gameMode === GameMode.Mobile);
}

function normalizeLevels(data: LevelJsonData[], gameMode: GameModeValue): LevelData[] {
  return data.map((level) => {
    const overrides = gameMode === GameMode.Mobile ? level.mobile : undefined;
    const normalized = {
      ...level,
      ...overrides,
    };
    delete normalized.mobile;

    return {
      ...normalized,
      points: normalized.points.map(normalizeLevelPoint),
      monsterSequence: normalized.monsterSequence.filter(
        (value): value is MonsterKind => Object.values(MonsterKind).includes(value as MonsterKind),
      ),
      availableTowers: normalizeAvailableTowers(normalized.name, normalized.availableTowers),
    };
  });
}

function normalizeAvailableTowers(levelName: string, values: string[]): TowerKind[] {
  if (!Array.isArray(values)) {
    throw new Error(`Level "${levelName}" must define availableTowers.`);
  }

  const towerKinds = Object.values(TowerKind);
  const availableTowers: TowerKind[] = [];
  for (const value of values) {
    if (!towerKinds.includes(value as TowerKind)) {
      throw new Error(`Level "${levelName}" has invalid tower "${value}" in availableTowers.`);
    }
    const kind = value as TowerKind;
    if (!availableTowers.includes(kind)) {
      availableTowers.push(kind);
    }
  }

  if (availableTowers.length === 0) {
    throw new Error(`Level "${levelName}" must have at least one available tower.`);
  }
  return availableTowers;
}

function normalizeLevelPoint(point: LevelJsonPoint): Point {
  const [x, y] = point;
  return { x, y };
}

function refreshDroneAssignments(drones: readonly Drone[], assignments: Map<Monster, number>): void {
  assignments.clear();
  for (const drone of drones) {
    const target = drone.getAssignedTarget();
    if (!target) {
      continue;
    }
    assignments.set(target, (assignments.get(target) ?? 0) + 1);
  }
}

export class Game {
  levels: LevelData[];
  renderer: GameRenderer;
  audio: GameAudio;
  currentLevelIndex = -1;
  highestUnlockedLevelIndex = 0;
  levelStars: number[] = [];
  lastAwardedStars = 0;
  debugAllLevelsUnlocked = false;
  campaignCleared = false;
  menuReturnState?: BattleState;
  state: GameState = GameState.Menu;
  runtime = new LevelRuntime();
  statusText = "Select a map";
  bannerText = "Awaiting orders";
  bannerTimer = 0;
  hudDirty = true;
  modalDirty = true;
  private breachResolutionDelaySeconds = 0;
  private readonly activeMonsters: Monster[] = [];
  private readonly monsterCollisionIndex = new ActiveCircleSweepCollisionIndex<Monster>(MONSTER_COLLISION_CELL_SIZE);
  private readonly droneAssignments = new Map<Monster, number>();
  private readonly updateResult = new UpdateResult();
  private readonly updateContext: UpdateContext;
  readonly profile: GameProfile;

  constructor(
    levelList: LevelData[],
    backgroundCanvas: HTMLCanvasElement,
    backgroundCtx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    audio: GameAudio,
    profile: GameProfile,
  ) {
    this.levels = levelList;
    this.audio = audio;
    this.profile = profile;
    this.updateContext = {
      deltaSeconds: 0,
      fieldWidth: profile.fieldWidth,
      fieldHeight: profile.fieldHeight,
      activeMonsters: this.activeMonsters,
      monsterCollisionIndex: this.monsterCollisionIndex,
      activeDrones: this.runtime.drones,
      droneAssignments: this.droneAssignments,
    };
    this.renderer = new GameRenderer(backgroundCanvas, backgroundCtx, canvas, ctx, this);
    this.loadCampaignProgress();
    this.loadLevelStars();
  }

  get activeWave(): WaveData | undefined {
    return this.runtime.activeWave;
  }

  get waveTotal(): number {
    return this.runtime.waveTotal;
  }

  get currentLevel(): LevelData | undefined {
    return this.runtime.level;
  }

  get campaignLevelCount(): number {
    return this.levels.length;
  }

  private applyUpdateResult(result: UpdateResult): void {
    for (const particle of result.particles) {
      if (this.runtime.particles.length < MAX_PARTICLES) {
        this.runtime.particles.push(particle);
      }
    }
    for (const link of result.links) {
      if (this.runtime.links.length < MAX_LINKS) {
        this.runtime.links.push(link);
      }
    }
    this.runtime.projectiles.push(...result.projectiles);
    this.runtime.missiles.push(...result.missiles);
    this.runtime.drones.push(...result.drones);
    for (const sound of result.sounds) {
      this.playSound(sound.cue, sound.panX, sound.intensity);
    }
    result.clear();
  }

  private applyMonsterLifecycleResults(result: UpdateResult): void {
    for (const monster of result.killedMonsters) {
      this.onMonsterKilled(monster, result);
      if (monster instanceof SplitterMonster) {
        this.spawnSplitters(monster);
      }
    }

    for (const monster of result.escapedMonsters) {
      if (this.state !== GameState.Playing || (this.runtime.escapesLeft === 0 && this.breachResolutionDelaySeconds === 0)) {
        break;
      }
      this.onMonsterEscaped(monster, result);
    }
  }

  private refreshActiveMonsters(): void {
    this.activeMonsters.length = 0;
    for (const monster of this.runtime.monsters) {
      if (!monster.removed && monster.hitPoints > 0) {
        this.activeMonsters.push(monster);
      }
    }
  }

  playSound(cue: AudioCueValue, panX?: number, intensity?: number): void {
    this.audio.play(cue, { panX, intensity });
  }

  requestHudSync(): void {
    this.hudDirty = true;
  }

  requestModalSync(): void {
    this.modalDirty = true;
  }

  canPerformBattleAction(): boolean {
    return this.state === GameState.Playing;
  }

  needsAnimationFrame(): boolean {
    return this.state === GameState.Playing || this.breachResolutionDelaySeconds > 0;
  }

  setBanner(text: string, duration = 1.6): void {
    this.bannerText = text;
    this.bannerTimer = duration;
    this.requestHudSync();
  }

  setState(next: GameState): void {
    this.state = next;
    if (next === GameState.Playing) {
      this.statusText = "Playing";
    } else if (next === GameState.Paused) {
      this.statusText = "Paused";
    } else if (next === GameState.Won) {
      this.statusText = "Level secured";
    } else if (next === GameState.CampaignWon) {
      this.statusText = "Campaign complete";
    } else if (next === GameState.Lost) {
      this.statusText = "Base overrun";
    } else {
      this.statusText = "Select a map";
    }
    this.requestHudSync();
  }

  startLevel(level: LevelData): void {
    this.currentLevelIndex = this.levels.findIndex((candidate) => candidate.id === level.id || candidate === level);
    this.lastAwardedStars = 0;
    this.runtime = new LevelRuntime(level, this.profile.roadTurnRadius, this.profile.routeCurveSampleStep);
    this.breachResolutionDelaySeconds = 0;
    this.menuReturnState = undefined;
    this.setBanner(`Level ${level.levelNumber ?? "?"}: ${level.name}`, 2.4);
    this.setState(GameState.Playing);
    this.playSound(AudioCue.LevelStart);
    this.renderBackgroundLayer();
    this.requestModalSync();
    this.requestHudSync();
  }

  startLevelByIndex(index: number): void {
    const level = this.levels[index];
    if (!level) {
      return;
    }
    if (!this.debugAllLevelsUnlocked && !this.campaignCleared && index > this.highestUnlockedLevelIndex) {
      this.playSound(AudioCue.InvalidAction);
      return;
    }
    this.startLevel(level);
  }

  unlockAllLevelsForDebug(): void {
    this.debugAllLevelsUnlocked = true;
    this.setBanner("All levels unlocked", 1.8);
    this.requestModalSync();
    this.requestHudSync();
  }

  restart(): void {
    if (this.currentLevel) {
      this.startLevel(this.currentLevel);
    } else {
      this.requestModalSync();
    }
  }

  restartCampaign(): void {
    this.lastAwardedStars = 0;
    this.startLevelByIndex(0);
  }

  startNextLevel(): void {
    if (this.currentLevelIndex < 0) {
      this.startLevelByIndex(0);
      return;
    }
    const nextIndex = Math.min(this.currentLevelIndex + 1, this.campaignLevelCount - 1);
    this.startLevelByIndex(nextIndex);
  }

  openMenu(): void {
    this.menuReturnState = isBattleState(this.state) ? this.state : undefined;
    this.playSound(AudioCue.MenuOpen);
    this.setState(GameState.Menu);
    this.requestModalSync();
  }

  resumeBattle(): void {
    if (!this.currentLevel || !this.menuReturnState) {
      return;
    }
    this.setState(this.menuReturnState);
    this.menuReturnState = undefined;
    this.playSound(AudioCue.Resume);
    this.requestModalSync();
  }

  togglePause(): void {
    if (this.state === GameState.Playing) {
      this.clearTowerPlacement();
      this.setState(GameState.Paused);
      this.playSound(AudioCue.Pause);
    } else if (this.state === GameState.Paused) {
      this.setState(GameState.Playing);
      this.playSound(AudioCue.Resume);
    }
    this.requestModalSync();
  }

  spawnMonster(): void {
    const { level, routePath } = this.runtime;
    if (!level || !routePath) {
      return;
    }

    const sequence = this.activeWave?.monsterSequence ?? level.monsterSequence;
    const code = sequence[this.runtime.spawnIndex] ?? MonsterKind.PackMan;
    this.runtime.spawnIndex = (this.runtime.spawnIndex + 1) % sequence.length;
    this.runtime.spawnedMonsters += 1;
    this.runtime.waveSpawnedMonsters += 1;
    this.runtime.monsters.push(createMonster(this, code, routePath.entries));
  }

  onMonsterKilled(monster: Monster, result: UpdateResult): void {
    this.runtime.money += monster.bounty;
    monster.addDeathEffect(result);
    this.requestHudSync();
  }

  spawnSplitters(monster: Monster): void {
    if (!this.currentLevel) {
      return;
    }

    for (const child of createSplitterChildren(this, monster)) {
      this.runtime.monsters.push(child);
    }
    this.playSound(AudioCue.SplitterBurst, monster.x);
  }

  onMonsterEscaped(monster: Monster, result: UpdateResult): void {
    for (const particle of createEscapeBurstParticles(monster.x, monster.y)) {
      result.addParticle(particle);
    }
    result.playSound(AudioCue.EscapeBurst, monster.x);
    const escapesLeftBefore = this.runtime.escapesLeft;
    this.runtime.escapesLeft = Math.max(0, this.runtime.escapesLeft - 1);
    if (this.runtime.escapesLeft !== escapesLeftBefore) {
      this.renderBackgroundLayer();
    }
    if (escapesLeftBefore > 0 && this.runtime.escapesLeft === 0) {
      this.breachResolutionDelaySeconds = BREACH_DEFEAT_DELAY_SECONDS;
      this.setBanner("Base breached", BREACH_DEFEAT_DELAY_SECONDS);
    }
    this.requestHudSync();
  }

  loseLevel(): void {
    if (!this.currentLevel) {
      return;
    }

    this.breachResolutionDelaySeconds = 0;
    this.runtime.monsters.forEach((item) => {
      item.removed = true;
    });
    this.setState(GameState.Lost);
    this.menuReturnState = undefined;
    this.setBanner("Defeat", 5);
    this.playSound(AudioCue.LevelLoss);
    this.requestModalSync();
    this.requestHudSync();
  }

  setPointer(point?: Point): void {
    this.runtime.pointer = point;
  }

  private clearTowerPlacement(): void {
    if (!this.runtime.placingTower) {
      return;
    }

    this.runtime.placingTower = undefined;
    this.requestHudSync();
  }

  cancelTowerPlacement(): void {
    if (!this.canPerformBattleAction()) {
      return;
    }

    this.clearTowerPlacement();
  }

  skipBuildBreak(): void {
    if (this.state !== GameState.Playing) {
      return;
    }
    if (!this.activeWave || this.runtime.spawnDelay <= 0) {
      return;
    }
    this.runtime.spawnDelay = 0;
    this.bannerTimer = 0;
    this.playSound(AudioCue.WaveStart);
    this.requestHudSync();
  }

  startTowerPlacement(kind: TowerKind): void {
    if (!this.currentLevel || !this.canPerformBattleAction()) {
      return;
    }
    if (!this.isTowerAvailable(kind)) {
      this.playSound(AudioCue.InvalidAction);
      return;
    }

    this.runtime.selectedTower = undefined;
    this.runtime.placingTower = kind;
    this.requestHudSync();
  }

  toggleTowerPlacement(kind: TowerKind): void {
    if (!this.currentLevel || !this.canPerformBattleAction()) {
      return;
    }
    if (!this.isTowerAvailable(kind)) {
      this.playSound(AudioCue.InvalidAction);
      return;
    }

    const isCanceling = this.runtime.placingTower === kind;
    this.runtime.selectedTower = undefined;
    this.runtime.placingTower = isCanceling ? undefined : kind;
    this.requestHudSync();
  }

  handleBoardClick(point: Point): void {
    if (isModalState(this.state)) {
      return;
    }

    if (!this.canPerformBattleAction()) {
      return;
    }

    if (this.renderer.isPointInUpgradeButton(point)) {
      if (this.canUpgradeSelectedTower()) {
        this.upgradeSelectedTower();
      } else {
        this.playSound(AudioCue.InvalidAction);
      }
      return;
    }

    if (this.renderer.isPointInLaserLockButton(point)) {
      this.toggleSelectedLaserLock();
      return;
    }

    if (this.runtime.placingTower) {
      if (findTowerAtPoint(
        point,
        this.runtime.towers,
        this.profile.towerRadius,
        this.profile.towerSelectionPadding,
      )) {
        this.runtime.placingTower = undefined;
        this.selectTowerAt(point);
        return;
      }

      this.placeTower(this.runtime.placingTower, point);
      return;
    }

    this.selectTowerAt(point);
  }

  canPlaceTower(point: Point): boolean {
    return this.canPlaceTowerInBounds(point, this.renderer.getVisibleFieldBounds());
  }

  canPlaceTowerInBounds(point: Point, fieldBounds: FieldBounds): boolean {
    return canPlaceTower(
      point,
      this.runtime.routePath,
      this.runtime.towers,
      { ...this.profile.placement, ...fieldBounds },
    );
  }

  placeTower(kind: TowerKind, point: Point): void {
    if (!this.canPerformBattleAction()) {
      return;
    }
    if (!this.isTowerAvailable(kind)) {
      this.playSound(AudioCue.InvalidAction, point.x);
      return;
    }

    const tower = this.createTower(kind, point);
    if (this.runtime.money < tower.cost || !this.canPlaceTower(point)) {
      this.playSound(AudioCue.InvalidAction, point.x);
      return;
    }
    this.runtime.money -= tower.cost;
    this.runtime.towers.push(tower);
    this.runtime.selectedTower = tower;
    this.runtime.placingTower = undefined;
    this.playSound(AudioCue.TowerPlace, point.x);
    this.requestHudSync();
  }

  createTower(kind: TowerKind, point: Point): Tower {
    const TowerClass = getTowerClass(kind);
    const tower = new TowerClass(point.x, point.y);
    tower.range = Math.round(tower.range * this.profile.towerRangeScale);
    return tower;
  }

  selectTowerAt(point: Point): void {
    if (!this.canPerformBattleAction()) {
      return;
    }

    const selectedTower = findTowerAtPoint(
      point,
      this.runtime.towers,
      this.profile.towerRadius,
      this.profile.towerSelectionPadding,
    );

    if (selectedTower && selectedTower === this.runtime.selectedTower) {
      this.runtime.selectedTower = undefined;
      this.requestHudSync();
      return;
    }

    this.runtime.selectedTower = selectedTower;
    if (selectedTower) {
      this.playSound(AudioCue.TowerSelect, selectedTower.x);
    }
    this.requestHudSync();
  }

  sellSelectedTower(): void {
    if (!this.canPerformBattleAction()) {
      return;
    }

    const { selectedTower } = this.runtime;
    if (!selectedTower) {
      return;
    }
    this.runtime.money += selectedTower.resaleValue;
    this.playSound(AudioCue.TowerSell, selectedTower.x);
    selectedTower.removed = true;
    const selectedTowerIndex = this.runtime.towers.indexOf(selectedTower);
    if (selectedTowerIndex !== -1) {
      this.runtime.towers.splice(selectedTowerIndex, 1);
    }
    this.runtime.selectedTower = undefined;
    this.requestHudSync();
  }

  upgradeSelectedTower(): void {
    if (!this.canPerformBattleAction()) {
      return;
    }

    const { selectedTower } = this.runtime;
    if (!this.canUpgradeSelectedTower()) {
      return;
    }
    if (!selectedTower) {
      return;
    }
    this.runtime.money -= selectedTower.upgradeCost;
    selectedTower.upgrade();
    this.playSound(AudioCue.TowerUpgrade, selectedTower.x);
    this.requestHudSync();
  }

  canUpgradeSelectedTower(): boolean {
    const { selectedTower } = this.runtime;
    return selectedTower !== undefined
      && selectedTower.canUpgrade()
      && this.runtime.money >= selectedTower.upgradeCost
      && this.canPerformBattleAction();
  }

  canAffordTower(kind: TowerKind): boolean {
    return this.runtime.money >= getTowerClass(kind).baseCost;
  }

  isTowerAvailable(kind: TowerKind): boolean {
    return this.currentLevel?.availableTowers.includes(kind) ?? false;
  }

  toggleSelectedLaserLock(): void {
    const { selectedTower } = this.runtime;
    if (!this.canPerformBattleAction()) {
      return;
    }

    if (!(selectedTower instanceof LaserTower)) {
      this.playSound(AudioCue.InvalidAction);
      return;
    }

    selectedTower.toggleDirectionLock();
    this.playSound(selectedTower.directionLocked ? AudioCue.LaserLockOn : AudioCue.LaserLockOff, selectedTower.x);
    this.requestHudSync();
  }

  completeCurrentWave(): void {
    const wave = this.activeWave;
    if (!wave) {
      return;
    }

    this.runtime.money += wave.reward;
    this.runtime.currentWaveIndex += 1;
    this.runtime.waveSpawnedMonsters = 0;
    this.runtime.spawnIndex = 0;
    this.runtime.spawnCooldown = 0.2;
    this.requestHudSync();

    const nextWave = this.activeWave;
    if (nextWave) {
      this.runtime.spawnDelay = nextWave.buildTime;
      this.setBanner(`Wave ${this.runtime.currentWaveIndex} cleared · +${formatMoney(wave.reward)}`, 2.3);
    } else {
      this.runtime.spawnDelay = 0;
      this.setBanner(`Final wave cleared · +${formatMoney(wave.reward)}`, 2.6);
    }
    this.playSound(AudioCue.WaveClear);
  }

  finishLevel(): void {
    if (!this.currentLevel) {
      return;
    }

    const finalCampaignLevelIndex = this.campaignLevelCount - 1;
    const isFinalCampaignLevel = this.currentLevelIndex >= finalCampaignLevelIndex;
    this.lastAwardedStars = this.calculateLevelStars();
    this.recordLevelStars(this.lastAwardedStars);
    this.menuReturnState = undefined;

    if (isFinalCampaignLevel) {
      this.campaignCleared = true;
      this.highestUnlockedLevelIndex = finalCampaignLevelIndex;
      this.setState(GameState.CampaignWon);
      this.playSound(AudioCue.CampaignComplete);
    } else {
      this.highestUnlockedLevelIndex = Math.max(this.highestUnlockedLevelIndex, this.currentLevelIndex + 1);
      this.setState(GameState.Won);
      this.playSound(AudioCue.LevelWin);
    }
    this.saveCampaignProgress();
    this.requestModalSync();
  }

  private loadCampaignProgress(): void {
    const savedLevelIndex = window.localStorage.getItem(HIGHEST_UNLOCKED_LEVEL_STORAGE_KEY);
    const campaignCleared = window.localStorage.getItem(CAMPAIGN_CLEARED_STORAGE_KEY) === "true";
    if (savedLevelIndex === null && !campaignCleared) {
      return;
    }

    const highestUnlockedLevelIndex = Number(savedLevelIndex ?? 0);
    if (!Number.isInteger(highestUnlockedLevelIndex)) {
      return;
    }

    const finalCampaignLevelIndex = Math.max(this.campaignLevelCount - 1, 0);
    this.campaignCleared = campaignCleared;
    this.highestUnlockedLevelIndex = campaignCleared
      ? finalCampaignLevelIndex
      : clamp(highestUnlockedLevelIndex, 0, finalCampaignLevelIndex);
  }

  private loadLevelStars(): void {
    this.levelStars = this.levels.map((_, index) => {
      const savedStars = Number(window.localStorage.getItem(`${LEVEL_STARS_STORAGE_KEY_PREFIX}${index}`) ?? 0);
      return Number.isInteger(savedStars) ? clamp(savedStars, 0, 3) : 0;
    });
  }

  private saveCampaignProgress(): void {
    if (this.debugAllLevelsUnlocked) {
      return;
    }

    window.localStorage.setItem(HIGHEST_UNLOCKED_LEVEL_STORAGE_KEY, String(this.highestUnlockedLevelIndex));
    if (this.campaignCleared) {
      window.localStorage.setItem(CAMPAIGN_CLEARED_STORAGE_KEY, "true");
    } else {
      window.localStorage.removeItem(CAMPAIGN_CLEARED_STORAGE_KEY);
    }
  }

  private calculateLevelStars(): number {
    if (!this.currentLevel) {
      return 0;
    }

    if (this.runtime.escapesLeft >= this.currentLevel.allowEscape) {
      return 3;
    }

    return this.runtime.escapesLeft >= Math.ceil(this.currentLevel.allowEscape / 2) ? 2 : 1;
  }

  private recordLevelStars(stars: number): void {
    if (this.currentLevelIndex < 0) {
      return;
    }

    const bestStars = Math.max(this.levelStars[this.currentLevelIndex] ?? 0, stars);
    this.levelStars[this.currentLevelIndex] = bestStars;
    if (!this.debugAllLevelsUnlocked) {
      window.localStorage.setItem(`${LEVEL_STARS_STORAGE_KEY_PREFIX}${this.currentLevelIndex}`, String(bestStars));
    }
  }

  resize(): void {
    this.renderer.resize();
  }

  renderBackgroundLayer(): void {
    this.renderer.renderBackgroundLayer();
  }

  update(deltaSeconds: number): GameFrameTimings {
    const updateStart = performance.now();
    const previousPreWaveSecond = this.state === GameState.Playing && this.activeWave && this.runtime.spawnDelay > 0
      ? Math.ceil(this.runtime.spawnDelay)
      : -1;

    if (this.bannerTimer > 0) {
      const previousBannerActive = this.bannerTimer > 0;
      this.bannerTimer = Math.max(0, this.bannerTimer - deltaSeconds);
      if (previousBannerActive && this.bannerTimer === 0) {
        this.requestHudSync();
      }
    }

    // Reaching zero escapes commits the defeat. This delay is presentation-only,
    // so it intentionally continues while paused or while the campaign map is open.
    if (this.breachResolutionDelaySeconds > 0) {
      this.breachResolutionDelaySeconds = Math.max(0, this.breachResolutionDelaySeconds - deltaSeconds);
      if (this.breachResolutionDelaySeconds === 0) {
        this.loseLevel();
      }
    }

    if (this.state === GameState.Playing) {
      const wave = this.activeWave;
      if (wave && this.runtime.spawnDelay > 0) {
        this.runtime.spawnDelay = Math.max(0, this.runtime.spawnDelay - deltaSeconds);
        if (this.runtime.spawnDelay === 0) {
          this.playSound(AudioCue.WaveStart);
        }
        const nextPreWaveSecond = this.activeWave && this.runtime.spawnDelay > 0 ? Math.ceil(this.runtime.spawnDelay) : -1;
        if (previousPreWaveSecond !== nextPreWaveSecond) {
          this.requestHudSync();
        }
      } else if (wave && this.runtime.waveSpawnedMonsters < wave.count) {
        this.runtime.spawnCooldown -= deltaSeconds;
        if (this.runtime.spawnCooldown <= 0) {
          this.spawnMonster();
          this.runtime.spawnCooldown = randomRange(wave.spawnIntervalMin, wave.spawnIntervalMax);
          this.requestHudSync();
        }
      }

      const { updateContext, updateResult } = this;
      updateResult.clear();
      updateContext.deltaSeconds = deltaSeconds;
      updateContext.activeDrones = this.runtime.drones;
      this.refreshActiveMonsters();

      for (const monster of this.runtime.monsters) {
        monster.update(updateContext, updateResult);
      }
      this.applyMonsterLifecycleResults(updateResult);

      this.refreshActiveMonsters();
      this.monsterCollisionIndex.rebuild(this.activeMonsters);

      for (const projectile of this.runtime.projectiles) {
        projectile.update(updateContext, updateResult);
      }

      for (const missile of this.runtime.missiles) {
        missile.update(updateContext, updateResult);
      }

      refreshDroneAssignments(this.runtime.drones, this.droneAssignments);

      for (const drone of this.runtime.drones) {
        drone.update(updateContext, updateResult);
      }

      for (const particle of this.runtime.particles) {
        particle.update(updateContext);
      }

      for (const link of this.runtime.links) {
        link.update(updateContext);
      }

      for (const tower of this.runtime.towers) {
        tower.update(updateContext, updateResult);
      }

      this.applyUpdateResult(updateResult);
      this.runtime.compactRemoved();

      if (wave && this.runtime.waveSpawnedMonsters >= wave.count && this.runtime.monsters.length === 0) {
        this.completeCurrentWave();
      }

      if (!this.activeWave && this.currentLevel && this.runtime.spawnedMonsters >= this.currentLevel.monsterCount && this.runtime.monsters.length === 0) {
        this.runtime.winDelay += deltaSeconds;
        if (this.runtime.winDelay >= 0.6 && this.state === GameState.Playing) {
          this.finishLevel();
        }
      } else {
        this.runtime.winDelay = 0;
      }
    }

    const updateEnd = performance.now();
    const drawStart = performance.now();
    this.draw();
    return {
      updateMs: updateEnd - updateStart,
      drawMs: performance.now() - drawStart,
    };
  }

  draw(): void {
    this.renderer.draw();
  }
}
