import levelsJson from "../Levels.json";
import { createCampaignLevels } from "./campaign";
import { GameRenderer } from "./game-renderer";
import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  MAX_LINKS,
  MAX_PARTICLES,
  MIN_DISTANCE_TO_OTHER_TOWERS,
  MIN_DISTANCE_TO_ROAD,
  STARTING_MONEY,
  TOWER_RADIUS,
} from "./constants";
import { LinkEffect } from "./entities/effects/link-effect";
import { Particle } from "./entities/effects/particle";
import { BallMonster } from "./entities/monsters/ball-monster";
import { BerserkerMonster } from "./entities/monsters/berserker-monster";
import type { Monster } from "./entities/monsters/monster";
import { RunnerMonster } from "./entities/monsters/runner-monster";
import { SplitterMonster } from "./entities/monsters/splitter-monster";
import { SquareMonster } from "./entities/monsters/square-monster";
import { TankMonster } from "./entities/monsters/tank-monster";
import { TriangleMonster } from "./entities/monsters/triangle-monster";
import { Missile } from "./entities/projectiles/missile";
import { Projectile } from "./entities/projectiles/projectile";
import { GunTower } from "./entities/towers/gun-tower";
import { LaserTower } from "./entities/towers/laser-tower";
import { MissileTower } from "./entities/towers/missile-tower";
import { SlowTower } from "./entities/towers/slow-tower";
import { Tower } from "./entities/towers/tower";
import {
  calculateDistance,
  compactInPlace,
  formatMoney,
  normalizeLevels,
  calculateDistanceToSegment,
  randomRange,
  withinDistance,
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

export const TOWER_KINDS = [TowerKind.Gun, TowerKind.Laser, TowerKind.Missile, TowerKind.Slow] as const;

export const TOWER_SHORTCUTS: Record<TowerKind, string[]> = {
  [TowerKind.Gun]: ["1", "g"],
  [TowerKind.Laser]: ["2", "l"],
  [TowerKind.Missile]: ["3", "m"],
  [TowerKind.Slow]: ["4", "s"],
};

type BattleState = typeof GameState.Playing | typeof GameState.Paused;

export function isBattleState(state: GameState): state is BattleState {
  return state === GameState.Playing || state === GameState.Paused;
}

export function isModalState(state: GameState): boolean {
  return state === GameState.Menu || state === GameState.Won || state === GameState.Lost || state === GameState.CampaignWon;
}

export function findTowerShortcut(key: string): TowerKind | undefined {
  return (Object.entries(TOWER_SHORTCUTS) as [TowerKind, string[]][])
    .find(([, shortcuts]) => shortcuts.includes(key.toLowerCase()))?.[0];
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

  get activeMonsters(): Iterable<Monster> {
    return this.monsters.filter((monster) => !monster.removed);
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
      this.createExplosion(monster.x, monster.y, 34, randomRange(1.2, 3.3), monster.color, 1 / 30);
    } else {
      this.createExplosion(monster.x, monster.y, 30, randomRange(1.5, 4), monster.color, 1 / 24);
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
      child.maxSpeed *= speedMultiplier;
      child.speed = child.maxSpeed;
      child.dx = Math.cos(child.angle) * child.speed;
      child.dy = Math.sin(child.angle) * child.speed;
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

  createExplosion(x: number, y: number, count: number, size: number, color: string, burnRate: number): void {
    const particleCount = Math.min(count, Math.max(0, MAX_PARTICLES - this.particles.length));
    for (let index = 0; index < particleCount; index += 1) {
      this.addParticle(new Particle(x, y, size, color, burnRate));
    }
  }

  createTankExplosion(x: number, y: number, color: string): void {
    this.createExplosion(x, y, 32, randomRange(3, 6), "#fff1a6", 1 / 28);
    this.createExplosion(x, y, 34, randomRange(2.5, 5), color, 1 / 24);
    this.createExplosion(x, y, 26, randomRange(2, 4.5), "#7e858c", 1 / 36);

    const debrisCount = Math.min(22, Math.max(0, MAX_PARTICLES - this.particles.length));
    for (let index = 0; index < debrisCount; index += 1) {
      const debrisColor = index % 3 === 0 ? "#ffffff" : (index % 2 === 0 ? "#b0bdc8" : "#5b6470");
      this.addParticle(new Particle(
        x,
        y,
        randomRange(2.5, 5.5),
        debrisColor,
        1 / 42,
        randomRange(5, 10),
        randomRange(2, 10),
      ));
    }
  }

  createEscapeBurst(x: number, y: number): void {
    const particleCount = Math.min(90, Math.max(0, MAX_PARTICLES - this.particles.length));
    for (let index = 0; index < particleCount; index += 1) {
      const color = `#${Math.floor(randomRange(0x555555, 0xffffff)).toString(16).padStart(6, "0")}`;
      this.addParticle(new Particle(x, y, randomRange(1, 4), color, 1 / 40));
    }
  }

  canPlaceTower(point: Point): boolean {
    if (!this.currentLevel) {
      return false;
    }

    const outsideBounds =
      point.x < TOWER_RADIUS ||
      point.y < TOWER_RADIUS ||
      point.x > FIELD_WIDTH - TOWER_RADIUS ||
      point.y > FIELD_HEIGHT - TOWER_RADIUS;

    if (outsideBounds) {
      return false;
    }

    for (const tower of this.towers) {
      if (withinDistance(point.x, point.y, tower.x, tower.y, MIN_DISTANCE_TO_OTHER_TOWERS)) {
        return false;
      }
    }

    for (let index = 0; index < this.currentLevel.points.length - 1; index += 1) {
      const start = this.currentLevel.points[index];
      const end = this.currentLevel.points[index + 1];
      if (calculateDistanceToSegment(point.x, point.y, start.x, start.y, end.x, end.y) <= MIN_DISTANCE_TO_ROAD) {
        return false;
      }
    }

    return true;
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
    if (kind === TowerKind.Gun) {
      return new GunTower(point.x, point.y);
    }
    if (kind === TowerKind.Laser) {
      return new LaserTower(point.x, point.y);
    }
    if (kind === TowerKind.Missile) {
      return new MissileTower(point.x, point.y);
    }
    return new SlowTower(point.x, point.y);
  }

  selectTowerAt(point: Point): void {
    let hit: Tower | undefined;
    for (let index = this.towers.length - 1; index >= 0; index -= 1) {
      const tower = this.towers[index];
      if (withinDistance(point.x, point.y, tower.x, tower.y, TOWER_RADIUS + 6)) {
        hit = tower;
        break;
      }
    }
    this.selectedTower = hit;
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
    const multiplier = deltaSeconds * 60;
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
      monster.update(multiplier);
    }

    for (const projectile of this.projectiles) {
      projectile.update(this, multiplier);
    }

    for (const missile of this.missiles) {
      missile.update(this, multiplier, deltaSeconds);
    }

    for (const particle of this.particles) {
      particle.update(multiplier);
    }

    for (const link of this.links) {
      link.update(multiplier);
    }

    for (const tower of this.towers) {
      tower.update(this, deltaSeconds, multiplier);
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
