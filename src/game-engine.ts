import levelsJson from "../game-levels.json";
import { createCampaignLevels } from "./campaign";
import { createMonster, createSplitterChildren } from "./game-engine/monster-factory";
import { GameRenderer } from "./game-renderer";
import { MAX_LINKS, MAX_PARTICLES } from "./constants";
import { LinkEffect } from "./entities/effects/link-effect";
import { Particle } from "./entities/effects/particle";
import type { Monster } from "./entities/monsters/monster";
import { SplitterMonster } from "./entities/monsters/splitter-monster";
import { TankMonster } from "./entities/monsters/tank-monster";
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
  TowerKind,
  MonsterKind,
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

const baseRoutes = normalizeLevels(levelsJson as LevelJsonData[]);
export const levels = createCampaignLevels(baseRoutes);

export class Game {
  levels: LevelData[];
  renderer: GameRenderer;
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

  constructor(levelList: LevelData[], canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    this.levels = levelList;
    this.renderer = new GameRenderer(canvas, ctx, this);
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
    this.rebuildBackgroundCache();
    this.requestModalSync();
    this.requestHudSync();
  }

  startLevelByIndex(index: number): void {
    const level = this.levels[index];
    if (!level) {
      return;
    }
    if (!this.campaignCleared && index > this.highestUnlockedLevelIndex) {
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
    const nextIndex = Math.min(this.currentLevelIndex + 1, this.levels.length - 1);
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
    const { level } = this.runtime;
    if (!level) {
      return;
    }

    const sequence = this.activeWave?.monsterSequence ?? level.monsterSequence;
    const code = sequence[this.runtime.spawnIndex] ?? MonsterKind.Ball;
    this.runtime.spawnIndex = (this.runtime.spawnIndex + 1) % sequence.length;
    this.runtime.spawnedMonsters += 1;
    this.runtime.waveSpawnedMonsters += 1;
    this.runtime.monsters.push(createMonster(this, code, level.points));
  }

  onMonsterKilled(monster: Monster): void {
    this.runtime.money += monster.bounty;
    if (monster instanceof TankMonster) {
      this.createTankExplosion(monster.x, monster.y, monster.color);
    } else if (monster instanceof SplitterMonster) {
      this.createExplosion(monster.x, monster.y, 34, randomRange(1.2, 3.3), monster.color, 2);
    } else {
      this.createExplosion(monster.x, monster.y, 30, randomRange(1.5, 4), monster.color, 2.5);
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
    this.setBanner("Splitter burst", 1.2);
  }

  onMonsterEscaped(monster: Monster): void {
    this.createEscapeBurst(monster.x, monster.y);
    this.runtime.escapesLeft = Math.max(0, this.runtime.escapesLeft - 1);
    if (this.runtime.escapesLeft === 0) {
      this.runtime.monsters.forEach((item) => {
        item.removed = true;
      });
      this.setState(GameState.Lost);
      this.menuReturnState = undefined;
      this.setBanner("Defeat", 5);
      this.requestModalSync();
    }
    this.requestHudSync();
  }

  createExplosion(x: number, y: number, count: number, size: number, color: string, alphaFadePerSecond: number): void {
    const particleCount = Math.min(count, Math.max(0, MAX_PARTICLES - this.runtime.particles.length));
    for (let index = 0; index < particleCount; index += 1) {
      this.addParticle(new Particle(x, y, size, color, alphaFadePerSecond));
    }
  }

  createTankExplosion(x: number, y: number, color: string): void {
    this.createExplosion(x, y, 32, randomRange(3, 6), "#fff1a6", 2.142857);
    this.createExplosion(x, y, 34, randomRange(2.5, 5), color, 2.5);
    this.createExplosion(x, y, 26, randomRange(2, 4.5), "#7e858c", 1.666667);

    const debrisCount = Math.min(22, Math.max(0, MAX_PARTICLES - this.runtime.particles.length));
    for (let index = 0; index < debrisCount; index += 1) {
      const debrisColor = index % 3 === 0 ? "#ffffff" : (index % 2 === 0 ? "#b0bdc8" : "#5b6470");
      this.addParticle(new Particle(
        x,
        y,
        randomRange(2.5, 5.5),
        debrisColor,
        1.428571,
        randomRange(300, 600),
        randomRange(2, 10),
      ));
    }
  }

  createEscapeBurst(x: number, y: number): void {
    const particleCount = Math.min(90, Math.max(0, MAX_PARTICLES - this.runtime.particles.length));
    for (let index = 0; index < particleCount; index += 1) {
      const color = `#${Math.floor(randomRange(0x555555, 0xffffff)).toString(16).padStart(6, "0")}`;
      this.addParticle(new Particle(x, y, randomRange(1, 4), color, 1.5));
    }
  }

  canPlaceTower(point: Point): boolean {
    return canPlaceTower(point, this.currentLevel?.points, this.runtime.towers);
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
    selectedTower.removed = true;
    this.runtime.towers = this.runtime.towers.filter((tower) => tower !== selectedTower);
    this.runtime.selectedTower = undefined;
    this.requestHudSync();
  }

  upgradeSelectedTower(): void {
    const { selectedTower } = this.runtime;
    if (!selectedTower || !selectedTower.canUpgrade() || this.runtime.money < selectedTower.upgradeCost) {
      return;
    }
    this.runtime.money -= selectedTower.upgradeCost;
    selectedTower.upgrade();
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
  }

  finishLevel(): void {
    if (!this.currentLevel) {
      return;
    }

    const isFinalLevel = this.currentLevelIndex >= this.levels.length - 1;
    this.menuReturnState = undefined;

    if (isFinalLevel) {
      this.campaignCleared = true;
      this.highestUnlockedLevelIndex = this.levels.length - 1;
      this.setState(GameState.CampaignWon);
      this.setBanner("Campaign Complete", 5.5);
    } else {
      this.highestUnlockedLevelIndex = Math.max(this.highestUnlockedLevelIndex, this.currentLevelIndex + 1);
      this.setState(GameState.Won);
      this.setBanner("Level Clear", 5);
    }
    this.requestModalSync();
  }

  resize(): void {
    this.renderer.resize();
  }

  rebuildBackgroundCache(): void {
    this.renderer.rebuildBackgroundCache();
  }

  update(deltaSeconds: number): void {
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
      this.draw();
      return;
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

    this.draw();
  }

  draw(): void {
    this.renderer.draw();
  }
}
