import levelsJson from "../game-levels.json";
import { createGameLevels, createRandomChallengeLevel, getCampaignLevelCount } from "./campaign";
import type { GameAudio } from "./game-audio";
import { createEscapeBurstEffect } from "./game-engine/combat-effects";
import { createMonsterDeathEffect } from "./game-engine/monster-death-effects";
import { createMonster, createSplitterChildren } from "./game-engine/monster-factory";
import { GameRenderer } from "./game-renderer";
import { MAX_LINKS, MAX_PARTICLES } from "./constants";
import { LinkEffect } from "./entities/effects/link-effect";
import { Particle } from "./entities/effects/particle";
import type { Monster } from "./entities/monsters/monster";
import { getTowerClass } from "./entities/towers/tower-registry";
import { Tower } from "./entities/towers/tower";
import { LevelRuntime } from "./level-runtime";
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

const baseRoutes = normalizeLevels(levelsJson as LevelJsonData[]);

export function createLevels(): LevelData[] {
  return createGameLevels(baseRoutes);
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

  constructor(
    levelList: LevelData[],
    backgroundCanvas: HTMLCanvasElement,
    backgroundCtx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    audio: GameAudio,
  ) {
    this.levels = levelList;
    this.audio = audio;
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
    return getCampaignLevelCount(this.levels);
  }

  addParticle(particle: Particle): void {
    if (this.runtime.particles.length < MAX_PARTICLES) {
      this.runtime.particles.push(particle);
    }
  }

  addLink(link: LinkEffect): void {
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
    this.runtime = new LevelRuntime(level);
    this.menuReturnState = undefined;
    this.setBanner(`Level ${level.levelNumber ?? "?"}: ${level.name}`, 2.4);
    this.setState(GameState.Playing);
    this.playSound(AudioCue.LevelStart);
    this.renderBackgroundLayer();
    this.requestModalSync();
    this.requestHudSync();
  }

  startLevelByIndex(index: number): void {
    let level = this.levels[index];
    if (!level) {
      return;
    }
    if (level.isChallenge) {
      level = createRandomChallengeLevel(this.campaignLevelCount);
      this.levels[index] = level;
    } else if (!this.campaignCleared && index > this.highestUnlockedLevelIndex) {
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
    this.setState(GameState.Menu);
    this.requestModalSync();
  }

  resumeBattle(): void {
    if (!this.currentLevel || !this.menuReturnState) {
      return;
    }
    this.setState(this.menuReturnState);
    this.menuReturnState = undefined;
    this.requestModalSync();
  }

  togglePause(): void {
    if (this.state === GameState.Playing) {
      this.setState(GameState.Paused);
    } else if (this.state === GameState.Paused) {
      this.setState(GameState.Playing);
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
    createMonsterDeathEffect(this, monster);
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
    this.setBanner("Splitter burst", 1.2);
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

  cancelTowerPlacement(): void {
    if (!this.runtime.placingTower) {
      return;
    }

    this.runtime.placingTower = undefined;
    this.requestHudSync();
  }

  startTowerPlacement(kind: TowerKind): void {
    if (!this.currentLevel || isModalState(this.state)) {
      return;
    }

    this.runtime.selectedTower = undefined;
    this.runtime.placingTower = kind;
    this.requestHudSync();
  }

  toggleTowerPlacement(kind: TowerKind): void {
    if (!this.currentLevel || isModalState(this.state)) {
      return;
    }

    this.runtime.selectedTower = undefined;
    this.runtime.placingTower = this.runtime.placingTower === kind ? undefined : kind;
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

    if (this.renderer.isPointInUpgradeButton(point)) {
      if (this.canUpgradeSelectedTower()) {
        this.upgradeSelectedTower();
      }
      return;
    }

    if (this.runtime.placingTower) {
      this.placeTower(this.runtime.placingTower, point);
      return;
    }

    this.selectTowerAt(point);
  }

  canPlaceTower(point: Point): boolean {
    return canPlaceTower(point, this.runtime.routePath, this.runtime.towers);
  }

  placeTower(kind: TowerKind, point: Point): void {
    const tower = this.createTower(kind, point);
    if (this.runtime.money < tower.cost || !this.canPlaceTower(point)) {
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
    return new TowerClass(point.x, point.y);
  }

  selectTowerAt(point: Point): void {
    this.runtime.selectedTower = findTowerAtPoint(point, this.runtime.towers);
    this.requestHudSync();
  }

  sellSelectedTower(): void {
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
      && !isModalState(this.state);
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

    const isChallenge = this.currentLevel.isChallenge === true;
    const finalCampaignLevelIndex = this.campaignLevelCount - 1;
    const isFinalCampaignLevel = !isChallenge && this.currentLevelIndex >= finalCampaignLevelIndex;
    this.menuReturnState = undefined;

    if (isFinalCampaignLevel) {
      this.campaignCleared = true;
      this.highestUnlockedLevelIndex = finalCampaignLevelIndex;
      this.setState(GameState.CampaignWon);
      this.setBanner("Campaign Complete", 5.5);
      this.playSound(AudioCue.LevelWin, undefined, 1.25);
    } else {
      if (!isChallenge) {
        this.highestUnlockedLevelIndex = Math.max(this.highestUnlockedLevelIndex, this.currentLevelIndex + 1);
      }
      this.setState(GameState.Won);
      this.setBanner(isChallenge ? "Challenge Clear" : "Level Clear", 5);
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

  update(deltaSeconds: number, collectTimings = false): GameFrameTimings | undefined {
    const updateStart = collectTimings ? performance.now() : 0;
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

    if (this.state !== GameState.Playing) {
      const updateEnd = collectTimings ? performance.now() : 0;
      const drawMs = this.drawForTiming(collectTimings);
      return collectTimings
        ? {
            updateMs: updateEnd - updateStart,
            drawMs,
          }
        : undefined;
    }

    const wave = this.activeWave;
    if (wave && this.runtime.spawnDelay > 0) {
      this.runtime.spawnDelay = Math.max(0, this.runtime.spawnDelay - deltaSeconds);
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

    const updateEnd = collectTimings ? performance.now() : 0;
    const drawMs = this.drawForTiming(collectTimings);
    return collectTimings
      ? {
          updateMs: updateEnd - updateStart,
          drawMs,
        }
      : undefined;
  }

  draw(): void {
    this.renderer.draw();
  }

  private drawForTiming(collectTimings: boolean): number {
    if (!collectTimings) {
      this.draw();
      return 0;
    }

    const drawStart = performance.now();
    this.draw();
    return performance.now() - drawStart;
  }
}
