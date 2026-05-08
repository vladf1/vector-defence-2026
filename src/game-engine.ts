import levelsJson from "../game-levels.json";
import { createCampaignLevels } from "./campaign";
import { GameMode, type GameMode as GameModeValue, type GameProfile } from "./game-profile";
import type { GameAudio } from "./game-audio";
import { createEscapeBurstEffect } from "./game-engine/combat-effects";
import { createMonster, createSplitterChildren } from "./game-engine/monster-factory";
import { GameRenderer } from "./game-renderer";
import { MAX_LINKS, MAX_PARTICLES } from "./constants";
import { Particle } from "./entities/effects/particle";
import type { Monster } from "./entities/monsters/monster";
import { LaserTower } from "./entities/towers/laser-tower";
import { getTowerClass } from "./entities/towers/tower-registry";
import { Tower } from "./entities/towers/tower";
import { LevelRuntime, type RuntimeLinkEffect } from "./level-runtime";
import { canPlaceTower, findTowerAtPoint } from "./placement-rules";
import {
  formatMoney,
  normalizeLevels,
  randomRange,
} from "./utils";
import {
  GameState,
  AudioCue,
  TowerKind,
  MonsterKind,
  type AudioCue as AudioCueValue,
  type LevelData,
  type LevelJsonData,
  type Point,
  type WaveData,
} from "./types";

type BattleState = typeof GameState.Playing | typeof GameState.Paused;

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

export const TEMPORARILY_UNLOCK_ALL_LEVELS = true;

export function createLevels(gameMode: GameModeValue): LevelData[] {
  return createCampaignLevels(normalizeLevels(levelsJson as LevelJsonData[], gameMode), gameMode === GameMode.Mobile);
}

export class Game {
  levels: LevelData[];
  renderer: GameRenderer;
  audio: GameAudio;
  currentLevelIndex = -1;
  highestUnlockedLevelIndex = 0;
  campaignCleared = false;
  menuReturnState?: BattleState;
  state: GameState = GameState.Menu;
  runtime = new LevelRuntime();
  statusText = "Select a map";
  bannerText = "Awaiting orders";
  bannerTimer = 0;
  hudDirty = true;
  modalDirty = true;
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
    this.renderer = new GameRenderer(backgroundCanvas, backgroundCtx, canvas, ctx, this);
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

  addParticle(particle: Particle): void {
    if (this.runtime.particles.length < MAX_PARTICLES) {
      this.runtime.particles.push(particle);
    }
  }

  addLink(link: RuntimeLinkEffect): void {
    if (this.runtime.links.length < MAX_LINKS) {
      this.runtime.links.push(link);
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
    this.runtime = new LevelRuntime(level, this.profile.roadTurnRadius, this.profile.routeCurveSampleStep);
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
    if (!TEMPORARILY_UNLOCK_ALL_LEVELS && !this.campaignCleared && index > this.highestUnlockedLevelIndex) {
      this.playSound(AudioCue.InvalidAction);
      return;
    }
    this.startLevel(level);
  }

  restart(): void {
    if (this.currentLevel) {
      this.startLevel(this.currentLevel);
    } else {
      this.requestModalSync();
    }
  }

  restartCampaign(): void {
    this.highestUnlockedLevelIndex = 0;
    this.campaignCleared = false;
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
    const code = sequence[this.runtime.spawnIndex] ?? MonsterKind.Ball;
    this.runtime.spawnIndex = (this.runtime.spawnIndex + 1) % sequence.length;
    this.runtime.spawnedMonsters += 1;
    this.runtime.waveSpawnedMonsters += 1;
    this.runtime.monsters.push(createMonster(this, code, routePath.entries));
  }

  onMonsterKilled(monster: Monster): void {
    this.runtime.money += monster.bounty;
    const effect = monster.createDeathEffect();
    this.playSound(effect.sound.cue, monster.x, effect.sound.intensity);
    for (const particle of effect.particles) {
      this.addParticle(particle);
    }
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

  onMonsterEscaped(monster: Monster): void {
    this.playSound(AudioCue.EscapeBurst, monster.x);
    createEscapeBurstEffect(this, monster.x, monster.y);
    this.runtime.escapesLeft = Math.max(0, this.runtime.escapesLeft - 1);
    if (this.runtime.escapesLeft === 0) {
      this.runtime.monsters.forEach((item) => {
        item.removed = true;
      });
      this.setState(GameState.Lost);
      this.menuReturnState = undefined;
      this.setBanner("Defeat", 5);
      this.playSound(AudioCue.LevelLoss);
      this.requestModalSync();
    }
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

    this.runtime.selectedTower = undefined;
    this.runtime.placingTower = kind;
    this.requestHudSync();
  }

  toggleTowerPlacement(kind: TowerKind): void {
    if (!this.currentLevel || !this.canPerformBattleAction()) {
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

    if (this.renderer.isPointInPauseButton(point)) {
      this.togglePause();
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
    return canPlaceTower(
      point,
      this.runtime.routePath,
      this.runtime.towers,
      { ...this.profile.placement, ...this.renderer.getVisibleFieldBounds() },
    );
  }

  placeTower(kind: TowerKind, point: Point): void {
    if (!this.canPerformBattleAction()) {
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

    this.runtime.selectedTower = findTowerAtPoint(
      point,
      this.runtime.towers,
      this.profile.towerRadius,
      this.profile.towerSelectionPadding,
    );
    if (this.runtime.selectedTower) {
      this.playSound(AudioCue.TowerSelect, this.runtime.selectedTower.x);
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
    this.runtime.towers = this.runtime.towers.filter((tower) => tower !== selectedTower);
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
    this.menuReturnState = undefined;

    if (isFinalCampaignLevel) {
      this.campaignCleared = true;
      this.highestUnlockedLevelIndex = finalCampaignLevelIndex;
      this.setState(GameState.CampaignWon);
      this.setBanner("Campaign Complete", 5.5);
      this.playSound(AudioCue.CampaignComplete);
    } else {
      this.highestUnlockedLevelIndex = Math.max(this.highestUnlockedLevelIndex, this.currentLevelIndex + 1);
      this.setState(GameState.Won);
      this.setBanner("Level Clear", 5);
      this.playSound(AudioCue.LevelWin);
    }
    this.requestModalSync();
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

      for (const monster of this.runtime.monsters) {
        monster.update(deltaSeconds);
      }

      for (const projectile of this.runtime.projectiles) {
        projectile.update(this, deltaSeconds);
      }

      for (const missile of this.runtime.missiles) {
        missile.update(this, deltaSeconds);
      }

      for (const particle of this.runtime.particles) {
        particle.update(deltaSeconds);
      }

      for (const link of this.runtime.links) {
        link.update(deltaSeconds);
      }

      for (const tower of this.runtime.towers) {
        tower.update(this, deltaSeconds);
      }

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
