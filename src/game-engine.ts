import levelsJson from "../game-levels.json";
import { createCampaignLevels } from "./campaign";
import { GameRenderer } from "./game-renderer";
import {
  MAX_LINKS,
  MAX_PARTICLES,
  STARTING_MONEY,
} from "./constants";
import { LinkEffect } from "./entities/effects/link-effect";
import { Particle } from "./entities/effects/particle";
import { BallMonster } from "./entities/monsters/ball-monster";
import { BerserkerMonster } from "./entities/monsters/berserker-monster";
import { BulwarkMonster } from "./entities/monsters/bulwark-monster";
import type { Monster } from "./entities/monsters/monster";
import { RunnerMonster } from "./entities/monsters/runner-monster";
import { SplitterMonster } from "./entities/monsters/splitter-monster";
import { SquareMonster } from "./entities/monsters/square-monster";
import { TankMonster } from "./entities/monsters/tank-monster";
import { TriangleMonster } from "./entities/monsters/triangle-monster";
import { Missile } from "./entities/projectiles/missile";
import { Projectile } from "./entities/projectiles/projectile";
import { getTowerClass } from "./entities/towers/tower-registry";
import { Tower } from "./entities/towers/tower";
import { canPlaceTower, findTowerAtPoint } from "./placement-rules";
import {
  calculateDistance,
  compactInPlace,
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
  currentLevel?: LevelData;
  currentLevelIndex = -1;
  highestUnlockedLevelIndex = 0;
  campaignCleared = false;
  menuReturnState?: BattleState;
  state: GameState = GameState.Menu;
  money = STARTING_MONEY;
  escapesLeft = 0;
  spawnDelay = 0;
  spawnCooldown = 0;
  spawnIndex = 0;
  spawnedMonsters = 0;
  currentWaveIndex = 0;
  waveSpawnedMonsters = 0;
  towers: Tower[] = [];
  monsters: Monster[] = [];
  readonly activeMonsters: Iterable<Monster> = {
    [Symbol.iterator]: (): Iterator<Monster> => {
      const monsters = this.monsters;
      let index = 0;

      return {
        next(): IteratorResult<Monster> {
          while (index < monsters.length) {
            const monster = monsters[index];
            index += 1;

            if (!monster.removed) {
              return {
                value: monster,
                done: false,
              };
            }
          }

          return {
            value: undefined,
            done: true,
          };
        },
      };
    },
  };
  projectiles: Projectile[] = [];
  missiles: Missile[] = [];
  particles: Particle[] = [];
  links: LinkEffect[] = [];
  selectedTower?: Tower;
  placingTower?: TowerKind;
  pointer?: Point;
  statusText = "Select a map";
  bannerText = "Awaiting orders";
  bannerTimer = 0;
  winDelay = 0;
  hudDirty = true;
  modalDirty = true;

  constructor(levelList: LevelData[], canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    this.levels = levelList;
    this.renderer = new GameRenderer(canvas, ctx, this);
  }

  get activeWave(): WaveData | undefined {
    return this.currentLevel?.waves?.[this.currentWaveIndex];
  }

  get waveTotal(): number {
    return this.currentLevel?.waves?.length ?? 1;
  }

  addParticle(particle: Particle): void {
    if (this.particles.length < MAX_PARTICLES) {
      this.particles.push(particle);
    }
  }

  addLink(link: LinkEffect): void {
    if (this.links.length < MAX_LINKS) {
      this.links.push(link);
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

  resetField(): void {
    this.towers = [];
    this.monsters = [];
    this.projectiles = [];
    this.missiles = [];
    this.particles = [];
    this.links = [];
    this.selectedTower = undefined;
    this.placingTower = undefined;
    this.winDelay = 0;
    this.requestHudSync();
  }

  startLevel(level: LevelData): void {
    this.currentLevel = level;
    this.currentLevelIndex = this.levels.findIndex((candidate) => candidate.id === level.id || candidate === level);
    this.money = level.startingMoney ?? STARTING_MONEY;
    this.escapesLeft = level.allowEscape;
    this.spawnDelay = level.waves?.[0]?.buildTime ?? 8;
    this.spawnCooldown = 0.2;
    this.spawnIndex = 0;
    this.spawnedMonsters = 0;
    this.currentWaveIndex = 0;
    this.waveSpawnedMonsters = 0;
    this.menuReturnState = undefined;
    this.resetField();
    this.setBanner(`Level ${level.levelNumber ?? "?"}: ${level.name}`, 2.4);
    this.setState(GameState.Playing);
    this.rebuildBackgroundCache();
    this.requestModalSync();
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
    if (!this.currentLevel) {
      return;
    }

    const sequence = this.activeWave?.monsterSequence ?? this.currentLevel.monsterSequence;
    const code = sequence[this.spawnIndex] ?? MonsterKind.Ball;
    this.spawnIndex = (this.spawnIndex + 1) % sequence.length;
    this.spawnedMonsters += 1;
    this.waveSpawnedMonsters += 1;
    this.monsters.push(this.createMonster(code, this.currentLevel.points));
  }

  onMonsterKilled(monster: Monster): void {
    this.money += monster.bounty;
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

    const childCount = 2;
    const splitAngle = monster.angle;
    const forwardX = Math.cos(splitAngle);
    const forwardY = Math.sin(splitAngle);
    const segmentStart = monster.path[Math.max(0, monster.targetIndex - 1)] ?? { x: monster.x, y: monster.y };
    const segmentEnd = monster.path[monster.targetIndex] ?? { x: monster.x, y: monster.y };
    const distanceFromSegmentStart = calculateDistance(segmentStart.x, segmentStart.y, monster.x, monster.y);
    const distanceToNextWaypoint = calculateDistance(monster.x, monster.y, segmentEnd.x, segmentEnd.y);
    const maxOffsetDistance = Math.min(12, distanceFromSegmentStart, distanceToNextWaypoint);
    const minSpeedMultiplier = 0.89;
    const maxSpeedMultiplier = 0.97;

    for (let index = 0; index < childCount; index += 1) {
      const forwardOffset = randomRange(-maxOffsetDistance, maxOffsetDistance);
      const spawnPoint = {
        x: monster.x + (forwardX * forwardOffset),
        y: monster.y + (forwardY * forwardOffset),
      };
      const childPath = [spawnPoint, ...monster.path.slice(monster.targetIndex)];
      const child = this.createMonster(MonsterKind.Runner, childPath);
      const speedMultiplier = randomRange(minSpeedMultiplier, maxSpeedMultiplier);
      child.angle = splitAngle + randomRange(-0.12, 0.12);
      child.maxSpeedPerSecond *= speedMultiplier;
      child.speedPerSecond = child.maxSpeedPerSecond;
      child.velocityXPerSecond = Math.cos(child.angle) * child.speedPerSecond;
      child.velocityYPerSecond = Math.sin(child.angle) * child.speedPerSecond;
      child.hitPoints = Math.round(child.maxHitPoints * 0.72);
      child.maxHitPoints = child.hitPoints;
      child.bounty = Math.max(8, Math.round(child.bounty * 0.55));
      child.radius *= 0.86;
      this.monsters.push(child);
    }
    this.setBanner("Splitter burst", 1.2);
  }

  createMonster(kind: MonsterKind, path: Point[]): Monster {
    let monster: Monster;
    if (kind === MonsterKind.Ball) {
      monster = new BallMonster(path);
    } else if (kind === MonsterKind.Berserker) {
      monster = new BerserkerMonster(path);
    } else if (kind === MonsterKind.Bulwark) {
      monster = new BulwarkMonster(path);
    } else if (kind === MonsterKind.Square) {
      monster = new SquareMonster(path);
    } else if (kind === MonsterKind.Triangle) {
      monster = new TriangleMonster(path);
    } else if (kind === MonsterKind.Tank) {
      monster = new TankMonster(path);
    } else if (kind === MonsterKind.Splitter) {
      monster = new SplitterMonster(path);
    } else {
      monster = new RunnerMonster(path);
    }

    const levelHitPointMultiplier = this.getLevelHitPointMultiplier();
    monster.hitPoints *= levelHitPointMultiplier;
    monster.maxHitPoints *= levelHitPointMultiplier;

    monster.addEventListener("killed", () => {
      this.onMonsterKilled(monster);
    });
    if (monster instanceof SplitterMonster) {
      monster.addEventListener("killed", () => {
        this.spawnSplitters(monster);
      });
    }
    monster.addEventListener("escaped", () => {
      this.onMonsterEscaped(monster);
    });
    return monster;
  }

  private getLevelHitPointMultiplier(): number {
    const levelOffset = Math.max(0, this.currentLevelIndex);
    const bonusPerLevel = 0.05;
    return 1 + (levelOffset * bonusPerLevel);
  }

  onMonsterEscaped(monster: Monster): void {
    this.createEscapeBurst(monster.x, monster.y);
    this.escapesLeft = Math.max(0, this.escapesLeft - 1);
    if (this.escapesLeft === 0) {
      this.monsters.forEach((item) => {
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
    const particleCount = Math.min(count, Math.max(0, MAX_PARTICLES - this.particles.length));
    for (let index = 0; index < particleCount; index += 1) {
      this.addParticle(new Particle(x, y, size, color, alphaFadePerSecond));
    }
  }

  createTankExplosion(x: number, y: number, color: string): void {
    this.createExplosion(x, y, 32, randomRange(3, 6), "#fff1a6", 2.142857);
    this.createExplosion(x, y, 34, randomRange(2.5, 5), color, 2.5);
    this.createExplosion(x, y, 26, randomRange(2, 4.5), "#7e858c", 1.666667);

    const debrisCount = Math.min(22, Math.max(0, MAX_PARTICLES - this.particles.length));
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
    const particleCount = Math.min(90, Math.max(0, MAX_PARTICLES - this.particles.length));
    for (let index = 0; index < particleCount; index += 1) {
      const color = `#${Math.floor(randomRange(0x555555, 0xffffff)).toString(16).padStart(6, "0")}`;
      this.addParticle(new Particle(x, y, randomRange(1, 4), color, 1.5));
    }
  }

  canPlaceTower(point: Point): boolean {
    return canPlaceTower(point, this.currentLevel?.points, this.towers);
  }

  placeTower(kind: TowerKind, point: Point): void {
    const tower = this.createTower(kind, point);
    if (this.money < tower.cost || !this.canPlaceTower(point)) {
      return;
    }
    this.money -= tower.cost;
    this.towers.push(tower);
    this.selectedTower = tower;
    this.placingTower = undefined;
    this.requestHudSync();
  }

  createTower(kind: TowerKind, point: Point): Tower {
    const TowerClass = getTowerClass(kind);
    return new TowerClass(point.x, point.y);
  }

  selectTowerAt(point: Point): void {
    this.selectedTower = findTowerAtPoint(point, this.towers);
    this.requestHudSync();
  }

  sellSelectedTower(): void {
    if (!this.selectedTower) {
      return;
    }
    this.money += this.selectedTower.resaleValue;
    this.selectedTower.removed = true;
    this.towers = this.towers.filter((tower) => tower !== this.selectedTower);
    this.selectedTower = undefined;
    this.requestHudSync();
  }

  upgradeSelectedTower(): void {
    if (!this.selectedTower || !this.selectedTower.canUpgrade() || this.money < this.selectedTower.upgradeCost) {
      return;
    }
    this.money -= this.selectedTower.upgradeCost;
    this.selectedTower.upgrade();
    this.requestHudSync();
  }

  completeCurrentWave(): void {
    const wave = this.activeWave;
    if (!wave) {
      return;
    }

    this.money += wave.reward;
    this.currentWaveIndex += 1;
    this.waveSpawnedMonsters = 0;
    this.spawnIndex = 0;
    this.spawnCooldown = 0.2;
    this.requestHudSync();

    const nextWave = this.activeWave;
    if (nextWave) {
      this.spawnDelay = nextWave.buildTime;
      this.setBanner(`Wave ${this.currentWaveIndex} cleared · +${formatMoney(wave.reward)}`, 2.3);
    } else {
      this.spawnDelay = 0;
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
    const previousPreWaveSecond = this.state === GameState.Playing && this.activeWave && this.spawnDelay > 0
      ? Math.ceil(this.spawnDelay)
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
    if (wave && this.spawnDelay > 0) {
      this.spawnDelay = Math.max(0, this.spawnDelay - deltaSeconds);
      const nextPreWaveSecond = this.activeWave && this.spawnDelay > 0 ? Math.ceil(this.spawnDelay) : -1;
      if (previousPreWaveSecond !== nextPreWaveSecond) {
        this.requestHudSync();
      }
    } else if (wave && this.waveSpawnedMonsters < wave.count) {
      this.spawnCooldown -= deltaSeconds;
      if (this.spawnCooldown <= 0) {
        this.spawnMonster();
        this.spawnCooldown = randomRange(wave.spawnIntervalMin, wave.spawnIntervalMax);
        this.requestHudSync();
      }
    }

    for (const monster of this.monsters) {
      monster.update(deltaSeconds);
    }

    for (const projectile of this.projectiles) {
      projectile.update(this, deltaSeconds);
    }

    for (const missile of this.missiles) {
      missile.update(this, deltaSeconds);
    }

    for (const particle of this.particles) {
      particle.update(deltaSeconds);
    }

    for (const link of this.links) {
      link.update(deltaSeconds);
    }

    for (const tower of this.towers) {
      tower.update(this, deltaSeconds);
    }

    compactInPlace(this.monsters);
    compactInPlace(this.projectiles);
    compactInPlace(this.missiles);
    compactInPlace(this.particles);
    compactInPlace(this.links);

    if (wave && this.waveSpawnedMonsters >= wave.count && this.monsters.length === 0) {
      this.completeCurrentWave();
    }

    if (!this.activeWave && this.currentLevel && this.spawnedMonsters >= this.currentLevel.monsterCount && this.monsters.length === 0) {
      this.winDelay += deltaSeconds;
      if (this.winDelay >= 0.6 && this.state === GameState.Playing) {
        this.finishLevel();
      }
    } else {
      this.winDelay = 0;
    }

    this.draw();
  }

  draw(): void {
    this.renderer.draw();
  }
}
