import "./style.css";
import levelsJson from "../Levels.json";
import {
  TowerKind,
  type GameState,
  type HudSnapshot,
  type LevelData,
  type LevelJsonData,
  type MonsterCode,
  type MonsterPreset,
  type Point,
  type TowerSpec,
} from "./types";

const FIELD_WIDTH = 700;
const FIELD_HEIGHT = 450;
const TOWER_RADIUS = 10;
const MAX_TOWER_LEVEL = 6;
const STARTING_MONEY = 260;
const UPGRADE_COST = 50;
const MIN_DISTANCE_TO_ROAD = 20;
const MIN_DISTANCE_TO_OTHER_TOWERS = 32;
const PRE_WAVE_DELAY = 5;
const MAX_PARTICLES = 320;
const MAX_LINKS = 120;

const TOWER_KINDS = [TowerKind.Gun, TowerKind.Laser, TowerKind.Missile, TowerKind.Slow] as const;

const TOWER_SPECS: Record<TowerKind, TowerSpec> = {
  [TowerKind.Gun]: { label: "Gun", cost: 20, range: 60, summary: "Fast, cheap, accurate lead shots." },
  [TowerKind.Laser]: { label: "Laser", cost: 30, range: 100, summary: "Piercing beam that melts lines of enemies." },
  [TowerKind.Missile]: { label: "Missile", cost: 50, range: 150, summary: "Slow launcher with splash damage." },
  [TowerKind.Slow]: { label: "Slow", cost: 30, range: 70, summary: "Freezes clusters so the rest can clean up." },
};

const TOWER_SHORTCUTS: Record<TowerKind, string[]> = {
  [TowerKind.Gun]: ["1", "g"],
  [TowerKind.Laser]: ["2", "l"],
  [TowerKind.Missile]: ["3", "m"],
  [TowerKind.Slow]: ["4", "s"],
};

const MONSTER_PRESETS: Record<MonsterCode, MonsterPreset> = {
  ball: { color: "#5df2ef", speed: 1.5, hp: 200, bounty: 20, radius: 7.5 },
  square: { color: "#ff6f62", speed: 1.25, hp: 150, bounty: 25, radius: 6.5 },
  triangle: { color: "#ffba4f", speed: 1.75, hp: 100, bounty: 30, radius: 7 },
  tank: { color: "#9fb6ff", speed: 0.75, hp: 420, bounty: 55, radius: 10.5 },
};

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing app root.");
}

root.innerHTML = `
  <div class="shell">
    <header class="topbar">
      <div class="title-block">
        <h1>Vector Defence</h1>
        <p>Pick a tower, place it off the path, and hold the line.</p>
      </div>
      <div class="actions">
        <button class="chrome-button" id="pause-button">Pause</button>
        <button class="chrome-button" id="level-button">Levels</button>
        <button class="chrome-button" id="restart-button">Restart</button>
      </div>
    </header>

    <section class="hud">
      <div class="stat-card">
        <span>Level</span>
        <strong id="level-name">Choose a level</strong>
      </div>
      <div class="stat-card">
        <span>Money</span>
        <strong id="money-value">$0</strong>
      </div>
      <div class="stat-card">
        <span>Escapes Left</span>
        <strong id="escapes-value">0</strong>
      </div>
      <div class="stat-card">
        <span>Wave</span>
        <strong id="wave-value">Idle</strong>
      </div>
    </section>

    <section class="board-card">
      <div class="board-frame">
        <canvas id="game" width="${FIELD_WIDTH}" height="${FIELD_HEIGHT}"></canvas>
        <div class="banner"><div class="banner-chip" id="banner">Awaiting orders</div></div>
        <div class="modal" id="modal"></div>
      </div>
    </section>

    <section class="controls-grid">
      <div class="control-card">
        <div class="tower-strip" id="tower-strip"></div>
      </div>
      <div class="control-card selection-card">
        <div class="selection-copy">
          <strong id="selection-title">No tower selected</strong>
          <span id="selection-body">Choose a build from the toolbar, then click the field to place it.</span>
        </div>
        <div class="selection-actions">
          <button class="action-button" id="upgrade-button">Upgrade</button>
          <button class="action-button sell" id="sell-button">Sell</button>
          <button class="action-button" id="cancel-button">Cancel Build</button>
        </div>
      </div>
    </section>

    <p class="footnote">Tip: press <strong>1-4</strong> or <strong>G/L/M/S</strong> for towers, <strong>U</strong> to upgrade, <strong>Esc</strong> to cancel build mode, and <strong>Space</strong> to pause or resume.</p>
  </div>
`;

function must<T>(value: T | null, message: string): T {
  if (value === null) {
    throw new Error(message);
  }
  return value;
}

const canvas = must(document.querySelector<HTMLCanvasElement>("#game"), "Missing canvas.");
const modal = must(document.querySelector<HTMLDivElement>("#modal"), "Missing modal.");
const towerStrip = must(document.querySelector<HTMLDivElement>("#tower-strip"), "Missing tower strip.");
const banner = must(document.querySelector<HTMLDivElement>("#banner"), "Missing banner.");
const levelNameValue = must(document.querySelector<HTMLElement>("#level-name"), "Missing level name.");
const moneyValue = must(document.querySelector<HTMLElement>("#money-value"), "Missing money value.");
const escapesValue = must(document.querySelector<HTMLElement>("#escapes-value"), "Missing escapes value.");
const waveValue = must(document.querySelector<HTMLElement>("#wave-value"), "Missing wave value.");
const selectionTitle = must(document.querySelector<HTMLElement>("#selection-title"), "Missing selection title.");
const selectionBody = must(document.querySelector<HTMLElement>("#selection-body"), "Missing selection body.");
const pauseButton = must(document.querySelector<HTMLButtonElement>("#pause-button"), "Missing pause button.");
const levelButton = must(document.querySelector<HTMLButtonElement>("#level-button"), "Missing level button.");
const restartButton = must(document.querySelector<HTMLButtonElement>("#restart-button"), "Missing restart button.");
const upgradeButton = must(document.querySelector<HTMLButtonElement>("#upgrade-button"), "Missing upgrade button.");
const sellButton = must(document.querySelector<HTMLButtonElement>("#sell-button"), "Missing sell button.");
const cancelButton = must(document.querySelector<HTMLButtonElement>("#cancel-button"), "Missing cancel button.");

const ctx = must(canvas.getContext("2d"), "Canvas 2D context unavailable.");

function isMonsterCode(value: string): value is MonsterCode {
  return value === "ball" || value === "square" || value === "triangle" || value === "tank";
}

function normalizeLevels(data: LevelJsonData[]): LevelData[] {
  return data.map((level) => ({
    ...level,
    monsterSequence: level.monsterSequence.filter(isMonsterCode),
  }));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function distanceSquaredXY(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return (dx * dx) + (dy * dy);
}

function distanceXY(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(distanceSquaredXY(x1, y1, x2, y2));
}

function angleBetween(source: Point, target: Point): number {
  return Math.atan2(target.y - source.y, target.x - source.x);
}

function pointToSegmentDistanceSquaredXY(pointX: number, pointY: number, startX: number, startY: number, endX: number, endY: number): number {
  const px = endX - startX;
  const py = endY - startY;
  const denom = (px * px) + (py * py);
  if (denom === 0) {
    return distanceSquaredXY(pointX, pointY, startX, startY);
  }
  let t = (((pointX - startX) * px) + ((pointY - startY) * py)) / denom;
  t = clamp(t, 0, 1);
  const x = startX + (t * px);
  const y = startY + (t * py);
  return ((pointX - x) ** 2) + ((pointY - y) ** 2);
}

function randomRange(min: number, max: number): number {
  return min + (Math.random() * (max - min));
}

function hexWithAlpha(hex: string, alpha: number): string {
  const value = clamp(Math.round(alpha * 255), 0, 255).toString(16).padStart(2, "0");
  return `${hex}${value}`;
}

function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function compactInPlace<T extends { removed: boolean }>(items: T[]): void {
  let writeIndex = 0;
  for (let readIndex = 0; readIndex < items.length; readIndex += 1) {
    const item = items[readIndex];
    if (!item.removed) {
      items[writeIndex] = item;
      writeIndex += 1;
    }
  }
  items.length = writeIndex;
}

class Particle {
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
  color: string;
  alpha = 1;
  burnRate: number;
  removed = false;

  constructor(x: number, y: number, size: number, color: string, burnRate: number, speed = randomRange(2, 7), offset = randomRange(4, 6)) {
    const angle = randomRange(-Math.PI, Math.PI);
    this.dx = Math.cos(angle) * speed;
    this.dy = Math.sin(angle) * speed;
    this.x = x + (Math.cos(angle) * offset);
    this.y = y + (Math.sin(angle) * offset);
    this.size = size;
    this.color = color;
    this.burnRate = burnRate;
  }

  update(multiplier: number): void {
    const slowDownFactor = 1 - (0.04 * multiplier);
    this.dx *= slowDownFactor;
    this.dy *= slowDownFactor;
    this.x += this.dx * multiplier;
    this.y += this.dy * multiplier;
    this.alpha -= this.burnRate * multiplier;
    if (this.alpha <= 0 || this.x < -20 || this.y < -20 || this.x > FIELD_WIDTH + 20 || this.y > FIELD_HEIGHT + 20) {
      this.removed = true;
    }
  }

  draw(context: CanvasRenderingContext2D): void {
    context.fillStyle = hexWithAlpha(this.color, this.alpha);
    context.fillRect(this.x - (this.size / 2), this.y - (this.size / 2), this.size, this.size);
  }
}

class LinkEffect {
  from?: Point;
  fromTower?: Tower;
  target: Monster;
  color: string;
  alpha: number;
  fadeBy: number;
  removed = false;

  constructor(target: Monster, color: string, fadeBy: number, from?: Point, fromTower?: Tower) {
    this.target = target;
    this.color = color;
    this.fadeBy = fadeBy;
    this.from = from;
    this.fromTower = fromTower;
    this.alpha = color === "#d8ff4f" ? 0.8 : 0.7;
  }

  update(multiplier: number): void {
    if (this.target.removed || (this.fromTower && this.fromTower.removed)) {
      this.alpha = 0;
    } else {
      this.alpha -= this.fadeBy * multiplier;
    }
    if (this.alpha <= 0) {
      this.removed = true;
    }
  }

  draw(context: CanvasRenderingContext2D): void {
    const from = this.fromTower ? { x: this.fromTower.x, y: this.fromTower.y } : this.from;
    if (!from) {
      return;
    }
    context.save();
    context.strokeStyle = hexWithAlpha(this.color, this.alpha);
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(this.target.x, this.target.y);
    context.stroke();
    context.restore();
  }
}

class Monster {
  kind: MonsterCode;
  x: number;
  y: number;
  dx = 0;
  dy = 0;
  speed: number;
  maxSpeed: number;
  hp: number;
  maxHp: number;
  bounty: number;
  radius: number;
  color: string;
  path: Point[];
  targetIndex = 1;
  rotation = randomRange(0, Math.PI * 2);
  angle = 0;
  damageFlash = 0;
  removed = false;

  constructor(kind: MonsterCode, level: LevelData) {
    const preset = MONSTER_PRESETS[kind];
    const start = level.points[0];
    this.kind = kind;
    this.x = start.x;
    this.y = start.y;
    this.maxSpeed = preset.speed;
    this.speed = preset.speed;
    this.hp = preset.hp;
    this.maxHp = preset.hp;
    this.bounty = preset.bounty;
    this.radius = preset.radius;
    this.color = preset.color;
    this.path = level.points;
    const initialTarget = level.points[1] ?? level.points[0];
    this.angle = angleBetween(start, initialTarget);
    this.dx = Math.cos(this.angle) * this.speed;
    this.dy = Math.sin(this.angle) * this.speed;
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
    this.damageFlash = 1;
  }

  slowDown(factor: number): void {
    this.speed = Math.min(this.speed, this.maxSpeed * factor);
  }

  update(game: Game, multiplier: number): void {
    if (this.hp <= 0) {
      this.removed = true;
      game.onMonsterKilled(this);
      return;
    }

    if (this.speed < this.maxSpeed) {
      this.speed = Math.min(this.maxSpeed, this.speed + (0.01 * multiplier));
    }

    let remainingStep = this.speed * multiplier;
    while (remainingStep > 0 && !this.removed) {
      const destination = this.path[this.targetIndex];
      if (!destination) {
        this.removed = true;
        game.onMonsterEscaped(this);
        return;
      }

      const toTarget = distanceXY(this.x, this.y, destination.x, destination.y);
      if (toTarget <= remainingStep) {
        this.x = destination.x;
        this.y = destination.y;
        this.targetIndex += 1;
        const nextDestination = this.path[this.targetIndex];
        if (!nextDestination) {
          this.removed = true;
          game.onMonsterEscaped(this);
          return;
        }
        this.angle = angleBetween({ x: this.x, y: this.y }, nextDestination);
        this.dx = Math.cos(this.angle) * this.speed;
        this.dy = Math.sin(this.angle) * this.speed;
        remainingStep -= toTarget;
      } else {
        this.angle = angleBetween({ x: this.x, y: this.y }, destination);
        this.dx = Math.cos(this.angle) * this.speed;
        this.dy = Math.sin(this.angle) * this.speed;
        this.x += this.dx * (remainingStep / this.speed);
        this.y += this.dy * (remainingStep / this.speed);
        remainingStep = 0;
      }
    }

    if (this.kind === "square") {
      this.rotation += 0.07 * multiplier;
    }
    this.damageFlash = Math.max(0, this.damageFlash - (0.03 * multiplier));
  }

  draw(context: CanvasRenderingContext2D): void {
    const damageMix = this.damageFlash;
    context.save();
    context.translate(this.x, this.y);
    context.strokeStyle = this.color;
    context.fillStyle = damageMix > 0 ? `rgba(153, 79, 255, ${0.25 + (damageMix * 0.55)})` : "#050908";
    context.lineWidth = 1.5;

    if (this.kind === "ball") {
      context.beginPath();
      context.arc(0, 0, this.radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    } else if (this.kind === "square") {
      context.rotate(this.rotation);
      context.fillRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
      context.strokeRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
    } else if (this.kind === "triangle") {
      context.rotate(this.angle);
      context.beginPath();
      context.moveTo(6, 0);
      context.lineTo(-6, -6);
      context.lineTo(-6, 6);
      context.closePath();
      context.fill();
      context.stroke();
    } else {
      context.rotate(this.angle);
      context.fillRect(-this.radius, -this.radius * 0.72, this.radius * 2.1, this.radius * 1.44);
      context.strokeRect(-this.radius, -this.radius * 0.72, this.radius * 2.1, this.radius * 1.44);
      context.beginPath();
      context.arc(this.radius * 0.1, 0, this.radius * 0.48, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.beginPath();
      context.moveTo(this.radius * 0.3, 0);
      context.lineTo(this.radius * 1.35, 0);
      context.stroke();
    }
    context.restore();

    const barWidth = Math.max(16, this.radius * 2);
    const fillWidth = barWidth * (this.hp / this.maxHp);
    context.fillStyle = "rgba(5, 10, 8, 0.85)";
    context.fillRect(this.x - (barWidth / 2), this.y - this.radius - 7, barWidth, 3);
    context.fillStyle = "#4cff90";
    context.fillRect(this.x - (barWidth / 2), this.y - this.radius - 7, fillWidth, 3);
  }
}

class Projectile {
  x: number;
  y: number;
  dx: number;
  dy: number;
  damage: number;
  radius: number;
  removed = false;

  constructor(source: Point, target: Point, damage: number, size: number) {
    const angle = angleBetween(source, target);
    this.x = source.x;
    this.y = source.y;
    this.dx = Math.cos(angle) * 7;
    this.dy = Math.sin(angle) * 7;
    this.damage = damage;
    this.radius = size / 2;
  }

  update(game: Game, multiplier: number): void {
    this.x += this.dx * multiplier;
    this.y += this.dy * multiplier;
    if (this.x < -20 || this.y < -20 || this.x > FIELD_WIDTH + 20 || this.y > FIELD_HEIGHT + 20) {
      this.removed = true;
      return;
    }

    for (const monster of game.monsters) {
      if (monster.removed) {
        continue;
      }
      const hitDistance = monster.radius + this.radius;
      if (distanceSquaredXY(this.x, this.y, monster.x, monster.y) <= hitDistance * hitDistance) {
        monster.takeDamage(this.damage);
        this.removed = true;
        return;
      }
    }
  }

  draw(context: CanvasRenderingContext2D): void {
    context.fillStyle = "#9fffe4";
    context.beginPath();
    context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    context.fill();
  }
}

class Missile {
  x: number;
  y: number;
  angle: number;
  speed: number;
  damage: number;
  effectRadius: number;
  trackedMonster?: Monster;
  removed = false;
  trailTimer = 0;

  constructor(source: Point, trackedMonster: Monster, damage: number, effectRadius: number, speed: number) {
    this.x = source.x;
    this.y = source.y;
    this.trackedMonster = trackedMonster;
    this.damage = damage;
    this.effectRadius = effectRadius;
    this.speed = speed;
    this.angle = angleBetween(source, { x: trackedMonster.x, y: trackedMonster.y });
  }

  update(game: Game, multiplier: number, dt: number): void {
    this.speed += 0.05 * multiplier;
    if (this.trackedMonster && this.trackedMonster.removed) {
      this.trackedMonster = undefined;
    }
    if (this.trackedMonster) {
      this.angle = angleBetween({ x: this.x, y: this.y }, { x: this.trackedMonster.x, y: this.trackedMonster.y });
    }

    this.x += Math.cos(this.angle) * this.speed * multiplier;
    this.y += Math.sin(this.angle) * this.speed * multiplier;

    this.trailTimer += dt;
    if (this.trailTimer >= 0.02) {
      this.trailTimer = 0;
      const trailX = this.x + randomRange(-3, 3) - (Math.cos(this.angle) * 9);
      const trailY = this.y + randomRange(-3, 3) - (Math.sin(this.angle) * 9);
      game.addParticle(new Particle(trailX, trailY, 1, "#7e858c", 1 / 60));
    }

    if (this.x < -20 || this.y < -20 || this.x > FIELD_WIDTH + 20 || this.y > FIELD_HEIGHT + 20) {
      this.removed = true;
      return;
    }

    for (const monster of game.monsters) {
      if (monster.removed) {
        continue;
      }
      const hitDistance = monster.radius + 6;
      if (distanceSquaredXY(this.x, this.y, monster.x, monster.y) <= hitDistance * hitDistance) {
        this.removed = true;
        game.createExplosion(this.x, this.y, 20, 3, "#ffd34e", 1 / 30);
        for (const nearby of game.monsters) {
          if (nearby.removed) {
            continue;
          }
          const dist = distanceXY(this.x, this.y, nearby.x, nearby.y);
          if (dist <= this.effectRadius) {
            const ratio = (this.effectRadius - dist) / this.effectRadius;
            nearby.takeDamage(this.damage * ratio);
          }
        }
        return;
      }
    }
  }

  draw(context: CanvasRenderingContext2D): void {
    context.save();
    context.translate(this.x, this.y);
    context.rotate(this.angle);
    context.strokeStyle = "#ffe77c";
    context.lineWidth = 3;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(-6, 0);
    context.lineTo(6, 0);
    context.stroke();
    context.restore();
  }
}

abstract class Tower {
  kind: TowerKind;
  x: number;
  y: number;
  range: number;
  cost: number;
  level = 0;
  cooldownMs = 0;
  removed = false;

  constructor(kind: TowerKind, x: number, y: number) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.range = TOWER_SPECS[kind].range;
    this.cost = TOWER_SPECS[kind].cost;
  }

  get upgradeCost(): number {
    return UPGRADE_COST;
  }

  get resaleValue(): number {
    return Math.round(this.cost * 0.75);
  }

  canUpgrade(): boolean {
    return this.level < MAX_TOWER_LEVEL;
  }

  update(game: Game, dt: number, multiplier: number): void {
    this.cooldownMs = Math.max(0, this.cooldownMs - (dt * 1000));
    this.onUpdate(game, multiplier);
  }

  upgrade(): void {
    if (!this.canUpgrade()) {
      return;
    }
    this.level += 1;
    this.cost += UPGRADE_COST;
    this.range += this.level * 4;
    this.onUpgrade();
  }

  protected getClosestMonster(game: Game): Monster | undefined {
    let closest: Monster | undefined;
    let smallestDistance = Number.POSITIVE_INFINITY;
    for (const monster of game.monsters) {
      if (monster.removed) {
        continue;
      }
      const distSq = distanceSquaredXY(this.x, this.y, monster.x, monster.y);
      if (distSq > this.range * this.range) {
        continue;
      }
      if (distSq < smallestDistance) {
        smallestDistance = distSq;
        closest = monster;
      }
    }
    return closest;
  }

  protected calculateIntercept(monster: Monster, projectileSpeed: number, from: Point): Point {
    const target = { x: monster.x - from.x, y: monster.y - from.y };
    const a = (projectileSpeed * projectileSpeed) - ((monster.dx * monster.dx) + (monster.dy * monster.dy));
    const b = (target.x * monster.dx) + (target.y * monster.dy);
    const c = (target.x * target.x) + (target.y * target.y);
    const d = (b * b) + (a * c);
    let t = 0;
    if (d >= 0 && a !== 0) {
      t = (b + Math.sqrt(d)) / a;
      if (t < 0) {
        t = 0;
      }
    }
    return {
      x: monster.x + (monster.dx * t),
      y: monster.y + (monster.dy * t),
    };
  }

  protected resetCooldown(milliseconds: number): void {
    this.cooldownMs = milliseconds;
  }

  protected ready(): boolean {
    return this.cooldownMs <= 0;
  }

  protected abstract onUpdate(game: Game, multiplier: number): void;
  protected abstract onUpgrade(): void;
  abstract draw(context: CanvasRenderingContext2D, active: boolean): void;
}

class GunTower extends Tower {
  angle = randomRange(-Math.PI, Math.PI);

  constructor(x: number, y: number) {
    super(TowerKind.Gun, x, y);
  }

  protected onUpdate(game: Game): void {
    const tracked = this.getClosestMonster(game);
    if (!tracked) {
      return;
    }

    const source = {
      x: this.x + (Math.cos(this.angle) * 16),
      y: this.y + (Math.sin(this.angle) * 16),
    };
    const target = this.calculateIntercept(tracked, 7, source);
    this.angle = angleBetween({ x: this.x, y: this.y }, target);

    if (this.ready()) {
      const actualSource = {
        x: this.x + (Math.cos(this.angle) * 16),
        y: this.y + (Math.sin(this.angle) * 16),
      };
      game.projectiles.push(new Projectile(actualSource, target, 10 + this.level, 3 + (this.level / 2)));
      this.resetCooldown(200);
    }
  }

  protected onUpgrade(): void {
  }

  draw(context: CanvasRenderingContext2D, active: boolean): void {
    context.save();
    context.translate(this.x, this.y);
    context.strokeStyle = "#ffffff";
    context.fillStyle = "#050908";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(0, 0, TOWER_RADIUS, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    context.strokeStyle = "#ffffff";
    context.lineWidth = 2 + (this.level / 2);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(Math.cos(this.angle) * 16, Math.sin(this.angle) * 16);
    context.stroke();
    if (active) {
      drawTowerSelection(context, this.range);
    }
    context.restore();
  }
}

class LaserTower extends Tower {
  angle = randomRange(-Math.PI, Math.PI);
  beamAlpha = 0;
  beamTarget = { x: 0, y: 0 };
  damagePerHit = 1;

  constructor(x: number, y: number) {
    super(TowerKind.Laser, x, y);
  }

  protected onUpdate(game: Game, multiplier: number): void {
    this.beamAlpha = Math.max(0, this.beamAlpha - (0.015 * multiplier));
    const tracked = this.getClosestMonster(game);
    if (!tracked) {
      return;
    }

    const target = { x: tracked.x, y: tracked.y };
    this.angle = angleBetween({ x: this.x, y: this.y }, target);
    this.beamTarget = {
      x: this.x + (Math.cos(this.angle) * 1000),
      y: this.y + (Math.sin(this.angle) * 1000),
    };

    if (this.ready()) {
      this.beamAlpha = 1;
      this.resetCooldown(1500);
    }

    if (this.beamAlpha <= 0) {
      return;
    }

    const source = {
      x: this.x + (Math.cos(this.angle) * 9),
      y: this.y + (Math.sin(this.angle) * 9),
    };

    for (const monster of game.monsters) {
      if (monster.removed) {
        continue;
      }
      const distSq = pointToSegmentDistanceSquaredXY(monster.x, monster.y, source.x, source.y, this.beamTarget.x, this.beamTarget.y);
      if (distSq <= monster.radius * monster.radius) {
        monster.takeDamage(this.damagePerHit * multiplier * this.beamAlpha);
      }
    }
  }

  protected onUpgrade(): void {
    this.damagePerHit = 1 + (this.level / 4);
  }

  draw(context: CanvasRenderingContext2D, active: boolean): void {
    context.save();
    context.translate(this.x, this.y);
    context.fillStyle = "#050908";
    context.strokeStyle = "#ffffff";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(0, 0, 12.5, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    context.rotate(this.angle);
    context.fillStyle = "#5bf4ff";
    context.beginPath();
    context.moveTo(-10, 5);
    context.lineTo(-2, 4);
    context.lineTo(10, 0);
    context.lineTo(-2, -4);
    context.lineTo(-10, -5);
    context.closePath();
    context.fill();
    context.stroke();
    if (active) {
      drawTowerSelection(context, this.range);
    }
    context.restore();

    if (this.beamAlpha > 0) {
      context.save();
      context.strokeStyle = `rgba(110, 255, 152, ${0.85 * this.beamAlpha})`;
      context.lineWidth = 1.5 + (this.level / 3);
      context.beginPath();
      context.moveTo(this.x + (Math.cos(this.angle) * 9), this.y + (Math.sin(this.angle) * 9));
      context.lineTo(this.beamTarget.x, this.beamTarget.y);
      context.stroke();
      context.restore();
    }
  }
}

class MissileTower extends Tower {
  angle = Math.PI / 4;
  rotationSpeed = 0.5;
  missileDamage = 50;

  constructor(x: number, y: number) {
    super(TowerKind.Missile, x, y);
    this.applyLevelStats();
  }

  protected onUpdate(game: Game, multiplier: number): void {
    this.angle += this.rotationSpeed * multiplier * 0.06;
    const tracked = this.getClosestMonster(game);
    if (tracked && this.ready()) {
      const damageRadius = 60 + (5 * this.level);
      const missileSpeed = 1.8 + (this.level / 2);
      game.missiles.push(new Missile({ x: this.x, y: this.y }, tracked, this.missileDamage, damageRadius, missileSpeed));
      this.resetCooldown(1000 * (2 - (0.2 * this.level)));
    }
  }

  protected onUpgrade(): void {
    this.applyLevelStats();
  }

  private applyLevelStats(): void {
    this.rotationSpeed = 0.5 + (this.level / 3);
    this.missileDamage = 50 + (4 * this.level);
  }

  draw(context: CanvasRenderingContext2D, active: boolean): void {
    context.save();
    context.translate(this.x, this.y);
    context.rotate(this.angle);
    context.fillStyle = "#050908";
    context.strokeStyle = "#ffffff";
    context.lineWidth = 1.5;
    context.fillRect(-TOWER_RADIUS, -TOWER_RADIUS, TOWER_RADIUS * 2, TOWER_RADIUS * 2);
    context.strokeRect(-TOWER_RADIUS, -TOWER_RADIUS, TOWER_RADIUS * 2, TOWER_RADIUS * 2);
    context.strokeStyle = "#ffd95b";
    context.beginPath();
    context.moveTo(-8, 0);
    context.lineTo(8, 0);
    context.stroke();
    if (active) {
      drawTowerSelection(context, this.range);
    }
    context.restore();
  }
}

class SlowTower extends Tower {
  pulse = 0;

  constructor(x: number, y: number) {
    super(TowerKind.Slow, x, y);
  }

  protected onUpdate(game: Game, multiplier: number): void {
    this.pulse += 0.08 * multiplier;
    if (!this.ready()) {
      return;
    }

    let affected = 0;
    const maxTargets = this.level + 2;
    for (const monster of game.monsters) {
      if (monster.removed) {
        continue;
      }
      if (distanceSquaredXY(this.x, this.y, monster.x, monster.y) > this.range * this.range) {
        continue;
      }
      monster.slowDown(0.5);
      game.addLink(new LinkEffect(monster, "#d8ff4f", 1 / 60, { x: this.x, y: this.y }));
      affected += 1;
      if (affected === maxTargets) {
        break;
      }
    }

    if (affected === 0) {
      return;
    }

    this.resetCooldown(1000);
  }

  protected onUpgrade(): void {
  }

  draw(context: CanvasRenderingContext2D, active: boolean): void {
    context.save();
    context.translate(this.x, this.y);
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, TOWER_RADIUS);
    gradient.addColorStop(0, "#050908");
    gradient.addColorStop(1, `rgba(255, 220, 92, ${0.6 + (Math.sin(this.pulse) * 0.2)})`);
    context.fillStyle = gradient;
    context.strokeStyle = "#ffffff";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(0, 0, TOWER_RADIUS, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    if (active) {
      drawTowerSelection(context, this.range);
    }
    context.restore();
  }
}

function drawTowerSelection(context: CanvasRenderingContext2D, range: number): void {
  context.save();
  context.strokeStyle = "rgba(92, 255, 158, 0.25)";
  context.fillStyle = "rgba(92, 255, 158, 0.05)";
  context.beginPath();
  context.arc(0, 0, range, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

function createTower(kind: TowerKind, x: number, y: number): Tower {
  switch (kind) {
    case TowerKind.Gun:
      return new GunTower(x, y);
    case TowerKind.Laser:
      return new LaserTower(x, y);
    case TowerKind.Missile:
      return new MissileTower(x, y);
    default:
      return new SlowTower(x, y);
  }
}

class Game {
  levels: LevelData[];
  currentLevel?: LevelData;
  state: GameState = "menu";
  money = STARTING_MONEY;
  escapesLeft = 0;
  spawnDelay = 0;
  spawnCooldown = 0;
  spawnIndex = 0;
  spawnedMonsters = 0;
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
  currentDpr = window.devicePixelRatio || 1;
  winDelay = 0;
  hudDirty = true;
  lastHudSnapshot?: HudSnapshot;
  backgroundCanvas = document.createElement("canvas");
  backgroundCtx = must(this.backgroundCanvas.getContext("2d"), "Background canvas unavailable.");

  constructor(levels: LevelData[]) {
    this.levels = levels;
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

  setBanner(text: string, duration = 1.6): void {
    this.bannerText = text;
    this.bannerTimer = duration;
    this.requestHudSync();
  }

  setState(next: GameState): void {
    this.state = next;
    if (next === "playing") {
      this.statusText = "Playing";
    } else if (next === "paused") {
      this.statusText = "Paused";
    } else if (next === "won") {
      this.statusText = "Level secured";
    } else if (next === "lost") {
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
    this.money = STARTING_MONEY;
    this.escapesLeft = level.allowEscape;
    this.spawnDelay = PRE_WAVE_DELAY;
    this.spawnCooldown = 0.2;
    this.spawnIndex = 0;
    this.spawnedMonsters = 0;
    this.resetField();
    this.setBanner(level.name, 2.1);
    this.setState("playing");
    this.rebuildBackgroundCache();
    renderModal();
  }

  restart(): void {
    if (this.currentLevel) {
      this.startLevel(this.currentLevel);
    } else {
      renderModal();
    }
  }

  togglePause(): void {
    if (this.state === "playing") {
      this.setState("paused");
    } else if (this.state === "paused") {
      this.setState("playing");
    }
    renderModal();
  }

  spawnMonster(): void {
    if (!this.currentLevel) {
      return;
    }
    const code = this.currentLevel.monsterSequence[this.spawnIndex] ?? "ball";
    this.spawnIndex = (this.spawnIndex + 1) % this.currentLevel.monsterSequence.length;
    this.spawnedMonsters += 1;
    this.monsters.push(new Monster(code, this.currentLevel));
  }

  onMonsterKilled(monster: Monster): void {
    this.money += monster.bounty;
    this.createExplosion(monster.x, monster.y, 30, randomRange(1.5, 4), monster.color, 1 / 24);
    this.requestHudSync();
  }

  onMonsterEscaped(monster: Monster): void {
    this.createEscapeBurst(monster.x, monster.y);
    this.escapesLeft -= 1;
    if (this.escapesLeft < 0) {
      this.escapesLeft = 0;
      this.monsters.forEach((item) => {
        item.removed = true;
      });
      this.setState("lost");
      this.setBanner("Defeat", 5);
      renderModal();
    }
    this.requestHudSync();
  }

  createExplosion(x: number, y: number, count: number, size: number, color: string, burnRate: number): void {
    const particleCount = Math.min(count, Math.max(0, MAX_PARTICLES - this.particles.length));
    for (let index = 0; index < particleCount; index += 1) {
      this.addParticle(new Particle(x, y, size, color, burnRate));
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
      if (distanceSquaredXY(point.x, point.y, tower.x, tower.y) <= MIN_DISTANCE_TO_OTHER_TOWERS ** 2) {
        return false;
      }
    }

    for (let index = 0; index < this.currentLevel.points.length - 1; index += 1) {
      const start = this.currentLevel.points[index];
      const end = this.currentLevel.points[index + 1];
      if (pointToSegmentDistanceSquaredXY(point.x, point.y, start.x, start.y, end.x, end.y) <= MIN_DISTANCE_TO_ROAD ** 2) {
        return false;
      }
    }

    return true;
  }

  placeTower(kind: TowerKind, point: Point): void {
    const tower = createTower(kind, point.x, point.y);
    if (this.money < tower.cost || !this.canPlaceTower(point)) {
      return;
    }
    this.money -= tower.cost;
    this.towers.push(tower);
    this.selectedTower = tower;
    this.placingTower = undefined;
    this.requestHudSync();
  }

  selectTowerAt(point: Point): void {
    let hit: Tower | undefined;
    for (let index = this.towers.length - 1; index >= 0; index -= 1) {
      const tower = this.towers[index];
      if (distanceSquaredXY(point.x, point.y, tower.x, tower.y) <= (TOWER_RADIUS + 6) ** 2) {
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

  chooseRandomLevel(): void {
    if (this.levels.length === 0) {
      return;
    }
    const pool = this.currentLevel ? this.levels.filter((level) => level.name !== this.currentLevel?.name) : this.levels;
    const source = pool.length === 0 ? this.levels : pool;
    const next = source[Math.floor(Math.random() * source.length)];
    this.startLevel(next);
  }

  resize(): void {
    this.currentDpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(FIELD_WIDTH * this.currentDpr);
    canvas.height = Math.round(FIELD_HEIGHT * this.currentDpr);
    ctx.setTransform(this.currentDpr, 0, 0, this.currentDpr, 0, 0);
    this.rebuildBackgroundCache();
  }

  rebuildBackgroundCache(): void {
    this.backgroundCanvas.width = Math.round(FIELD_WIDTH * this.currentDpr);
    this.backgroundCanvas.height = Math.round(FIELD_HEIGHT * this.currentDpr);
    this.backgroundCtx.setTransform(this.currentDpr, 0, 0, this.currentDpr, 0, 0);
    this.drawBackground(this.backgroundCtx);
  }

  update(dt: number): void {
    const multiplier = dt * 60;
    const previousBannerActive = this.bannerTimer > 0;
    const previousPreWaveSecond = this.state === "playing" && this.spawnDelay > 0 && this.spawnedMonsters === 0
      ? Math.ceil(this.spawnDelay)
      : -1;
    if (this.bannerTimer > 0) {
      this.bannerTimer = Math.max(0, this.bannerTimer - dt);
      if (previousBannerActive && this.bannerTimer === 0) {
        this.requestHudSync();
      }
    }

    if (this.state !== "playing") {
      if (this.hudDirty) {
        syncHud();
      }
      this.draw();
      return;
    }

    if (this.spawnDelay > 0) {
      this.spawnDelay = Math.max(0, this.spawnDelay - dt);
      const nextPreWaveSecond = this.spawnDelay > 0 && this.spawnedMonsters === 0 ? Math.ceil(this.spawnDelay) : -1;
      if (previousPreWaveSecond !== nextPreWaveSecond) {
        this.requestHudSync();
      }
    } else if (this.currentLevel && this.spawnedMonsters < this.currentLevel.monsterCount) {
      this.spawnCooldown -= dt;
      if (this.spawnCooldown <= 0) {
        this.spawnMonster();
        this.spawnCooldown = randomRange(0.5, 1.25);
        this.requestHudSync();
      }
    }

    for (const monster of this.monsters) {
      monster.update(this, multiplier);
    }

    for (const projectile of this.projectiles) {
      projectile.update(this, multiplier);
    }

    for (const missile of this.missiles) {
      missile.update(this, multiplier, dt);
    }

    for (const particle of this.particles) {
      particle.update(multiplier);
    }

    for (const link of this.links) {
      link.update(multiplier);
    }

    for (const tower of this.towers) {
      tower.update(this, dt, multiplier);
    }

    compactInPlace(this.monsters);
    compactInPlace(this.projectiles);
    compactInPlace(this.missiles);
    compactInPlace(this.particles);
    compactInPlace(this.links);

    if (this.currentLevel && this.spawnedMonsters >= this.currentLevel.monsterCount && this.monsters.length === 0) {
      this.winDelay += dt;
      if (this.winDelay >= 0.6 && this.state === "playing") {
        this.setState("won");
        this.setBanner("Level Clear", 5);
        renderModal();
      }
    } else {
      this.winDelay = 0;
    }

    if (this.hudDirty) {
      syncHud();
    }
    this.draw();
  }

  drawBackground(context: CanvasRenderingContext2D): void {
    const fieldGradient = context.createLinearGradient(0, 0, 0, FIELD_HEIGHT);
    fieldGradient.addColorStop(0, "#050b08");
    fieldGradient.addColorStop(1, "#0c1c17");
    context.fillStyle = fieldGradient;
    context.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

    context.save();
    context.strokeStyle = "rgba(255, 255, 255, 0.04)";
    for (let x = 0; x <= FIELD_WIDTH; x += 35) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, FIELD_HEIGHT);
      context.stroke();
    }
    for (let y = 0; y <= FIELD_HEIGHT; y += 35) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(FIELD_WIDTH, y);
      context.stroke();
    }
    context.restore();

    if (this.currentLevel) {
      const first = this.currentLevel.points[0];
      const last = this.currentLevel.points[this.currentLevel.points.length - 1];
      context.save();
      context.lineJoin = "round";
      context.lineCap = "round";
      context.strokeStyle = "rgba(8, 40, 36, 0.96)";
      context.lineWidth = 24;
      context.beginPath();
      context.moveTo(first.x, first.y);
      for (let index = 1; index < this.currentLevel.points.length; index += 1) {
        const point = this.currentLevel.points[index];
        context.lineTo(point.x, point.y);
      }
      context.stroke();
      context.strokeStyle = "rgba(109, 240, 194, 0.18)";
      context.lineWidth = 6;
      context.stroke();
      context.fillStyle = "rgba(109, 240, 194, 0.14)";
      context.beginPath();
      context.arc(last.x, last.y, 18, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  drawPreview(context: CanvasRenderingContext2D): void {
    if (!this.pointer || !this.placingTower) {
      return;
    }
    const spec = TOWER_SPECS[this.placingTower];
    const valid = this.canPlaceTower(this.pointer) && this.money >= spec.cost;
    context.save();
    context.strokeStyle = valid ? "rgba(255, 255, 255, 0.35)" : "rgba(255, 120, 120, 0.45)";
    context.setLineDash([6, 6]);
    context.beginPath();
    context.moveTo(this.pointer.x, 0);
    context.lineTo(this.pointer.x, FIELD_HEIGHT);
    context.moveTo(0, this.pointer.y);
    context.lineTo(FIELD_WIDTH, this.pointer.y);
    context.stroke();
    context.setLineDash([]);
    context.strokeStyle = valid ? "rgba(92, 255, 158, 0.3)" : "rgba(255, 120, 120, 0.32)";
    context.fillStyle = valid ? "rgba(92, 255, 158, 0.08)" : "rgba(255, 120, 120, 0.08)";
    context.beginPath();
    context.arc(this.pointer.x, this.pointer.y, spec.range, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.beginPath();
    context.arc(this.pointer.x, this.pointer.y, TOWER_RADIUS, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  draw(): void {
    ctx.clearRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
    ctx.drawImage(this.backgroundCanvas, 0, 0, FIELD_WIDTH, FIELD_HEIGHT);

    for (const link of this.links) {
      link.draw(ctx);
    }

    for (const projectile of this.projectiles) {
      projectile.draw(ctx);
    }

    for (const missile of this.missiles) {
      missile.draw(ctx);
    }

    for (const monster of this.monsters) {
      monster.draw(ctx);
    }

    for (const tower of this.towers) {
      tower.draw(ctx, tower === this.selectedTower);
    }

    for (const particle of this.particles) {
      particle.draw(ctx);
    }

    this.drawPreview(ctx);
  }
}

const levels = normalizeLevels(levelsJson as LevelJsonData[]);

const game = new Game(levels);
game.resize();

if (import.meta.env.DEV) {
  Object.assign(window, {
    __vectorDefence: game,
  });
}

const towerButtons = new Map<TowerKind, HTMLButtonElement>();

function toggleTowerPlacement(kind: TowerKind): void {
  if (game.state === "menu" || game.state === "won" || game.state === "lost") {
    return;
  }
  game.placingTower = game.placingTower === kind ? undefined : kind;
  game.selectedTower = undefined;
  syncHud();
}

function setupTowerButtons(): void {
  towerStrip.innerHTML = "";
  TOWER_KINDS.forEach((kind) => {
    const spec = TOWER_SPECS[kind];
    const shortcuts = TOWER_SHORTCUTS[kind].map((shortcut) => shortcut.toUpperCase()).join("/");
    const button = document.createElement("button");
    button.className = "tower-button";
    button.innerHTML = `<strong>${spec.label} <span class="shortcut-chip">${shortcuts}</span></strong><span>${formatMoney(spec.cost)} · ${spec.summary}</span>`;
    button.title = `${spec.label} tower (${shortcuts})`;
    button.addEventListener("click", () => {
      toggleTowerPlacement(kind);
    });
    towerButtons.set(kind, button);
    towerStrip.append(button);
  });
}

function syncHud(): void {
  const selected = game.selectedTower;
  const wave = game.currentLevel
    ? (game.state === "playing" && game.spawnDelay > 0 && game.spawnedMonsters === 0
        ? `Starts in ${Math.ceil(game.spawnDelay)}s`
        : `${Math.min(game.spawnedMonsters, game.currentLevel.monsterCount)} / ${game.currentLevel.monsterCount}`)
    : "Idle";
  const bannerText = game.state === "playing" && game.spawnDelay > 0 && game.spawnedMonsters === 0
    ? `Wave starts in ${Math.ceil(game.spawnDelay)}`
    : (game.bannerTimer > 0 ? game.bannerText : (game.state === "menu" ? "Awaiting orders" : game.statusText));

  let selectionTitleText: string;
  let selectionBodyText: string;
  if (selected) {
    selectionTitleText = `${TOWER_SPECS[selected.kind].label} Tower · Lv ${selected.level + 1}`;
    selectionBodyText = `Range ${Math.round(selected.range)} · Upgrade ${formatMoney(selected.upgradeCost)} · Sell ${formatMoney(selected.resaleValue)}`;
  } else if (game.placingTower) {
    const spec = TOWER_SPECS[game.placingTower];
    selectionTitleText = `Placing ${spec.label}`;
    selectionBodyText = `${spec.summary} Cost ${formatMoney(spec.cost)}. Click the field to place it.`;
  } else {
    selectionTitleText = "No tower selected";
    selectionBodyText = "Choose a build from the toolbar, then click the field to place it.";
  }

  const snapshot: HudSnapshot = {
    levelName: game.currentLevel?.name ?? "Choose a level",
    money: formatMoney(game.money),
    escapes: String(Math.max(0, game.escapesLeft)),
    wave,
    banner: bannerText,
    pauseLabel: game.state === "paused" ? "Resume" : "Pause",
    pauseDisabled: !(game.state === "playing" || game.state === "paused"),
    selectionTitle: selectionTitleText,
    selectionBody: selectionBodyText,
    upgradeDisabled: !selected || !selected.canUpgrade() || game.money < selected.upgradeCost || game.state === "menu",
    sellDisabled: !selected || game.state === "menu",
    cancelDisabled: !game.placingTower,
    selectedTowerKind: selected?.kind,
    selectedTowerLevel: selected?.level,
    placingTower: game.placingTower,
    towerButtonsDisabled: game.state === "menu" || game.state === "won" || game.state === "lost",
  };

  const previous = game.lastHudSnapshot;
  if (!previous || previous.levelName !== snapshot.levelName) {
    levelNameValue.textContent = snapshot.levelName;
  }
  if (!previous || previous.money !== snapshot.money) {
    moneyValue.textContent = snapshot.money;
  }
  if (!previous || previous.escapes !== snapshot.escapes) {
    escapesValue.textContent = snapshot.escapes;
  }
  if (!previous || previous.wave !== snapshot.wave) {
    waveValue.textContent = snapshot.wave;
  }
  if (!previous || previous.banner !== snapshot.banner) {
    banner.textContent = snapshot.banner;
  }
  if (!previous || previous.pauseLabel !== snapshot.pauseLabel) {
    pauseButton.textContent = snapshot.pauseLabel;
  }
  if (!previous || previous.pauseDisabled !== snapshot.pauseDisabled) {
    pauseButton.disabled = snapshot.pauseDisabled;
  }
  if (!previous || previous.selectionTitle !== snapshot.selectionTitle) {
    selectionTitle.textContent = snapshot.selectionTitle;
  }
  if (!previous || previous.selectionBody !== snapshot.selectionBody) {
    selectionBody.textContent = snapshot.selectionBody;
  }
  if (!previous || previous.upgradeDisabled !== snapshot.upgradeDisabled) {
    upgradeButton.disabled = snapshot.upgradeDisabled;
  }
  if (!previous || previous.sellDisabled !== snapshot.sellDisabled) {
    sellButton.disabled = snapshot.sellDisabled;
  }
  if (!previous || previous.cancelDisabled !== snapshot.cancelDisabled) {
    cancelButton.disabled = snapshot.cancelDisabled;
  }

  for (const [kind, button] of towerButtons.entries()) {
    const isActive = snapshot.placingTower === kind;
    if (!previous || previous.placingTower !== snapshot.placingTower) {
      button.className = `tower-button${isActive ? " active" : ""}`;
    }
    if (!previous || previous.towerButtonsDisabled !== snapshot.towerButtonsDisabled) {
      button.disabled = snapshot.towerButtonsDisabled;
    }
  }

  game.lastHudSnapshot = snapshot;
  game.hudDirty = false;
}

function modalLevelCards(): string {
  return levels
    .map((level, index) => {
      return `
        <button class="level-card" data-level-index="${index}">
          <strong>${level.name}</strong>
          <span>${level.monsterCount} enemies · ${level.allowEscape} leaks allowed</span>
        </button>
      `;
    })
    .join("");
}

function renderModal(): void {
  if (game.state === "menu") {
    modal.classList.remove("hidden");
    modal.innerHTML = `
      <div class="modal-panel">
        <h2>Choose Your Route</h2>
        <p>The levels come straight from the old Silverlight XML. Start anywhere and the game will keep rolling from there.</p>
        <div class="level-grid">${modalLevelCards()}</div>
      </div>
    `;
  } else if (game.state === "won") {
    modal.classList.remove("hidden");
    modal.innerHTML = `
      <div class="modal-panel">
        <h2>Level Clear</h2>
        <p>${game.currentLevel?.name ?? "This route"} is secure. Keep your momentum or jump to another map.</p>
        <div class="selection-actions">
          <button class="modal-button" data-action="next">Random Next Level</button>
          <button class="modal-button" data-action="replay">Replay This Level</button>
          <button class="modal-button" data-action="levels">Choose Level</button>
        </div>
      </div>
    `;
  } else if (game.state === "lost") {
    modal.classList.remove("hidden");
    modal.innerHTML = `
      <div class="modal-panel">
        <h2>Defeat</h2>
        <p>The path broke through. Try another setup, or switch to a different route.</p>
        <div class="selection-actions">
          <button class="modal-button" data-action="replay">Try Again</button>
          <button class="modal-button" data-action="levels">Choose Level</button>
        </div>
      </div>
    `;
  } else {
    modal.classList.add("hidden");
    modal.innerHTML = "";
  }

  modal.querySelectorAll<HTMLElement>("[data-level-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const levelIndex = Number(button.dataset.levelIndex);
      const level = levels[levelIndex];
      if (level) {
        game.startLevel(level);
      }
    });
  });

  modal.querySelectorAll<HTMLElement>("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "next") {
        game.chooseRandomLevel();
      } else if (action === "replay") {
        game.restart();
      } else if (action === "levels") {
        game.setState("menu");
        renderModal();
        syncHud();
      }
    });
  });
}

function pointerFromEvent(event: MouseEvent): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * FIELD_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * FIELD_HEIGHT,
  };
}

canvas.addEventListener("mousemove", (event) => {
  game.pointer = pointerFromEvent(event);
});

canvas.addEventListener("mouseleave", () => {
  game.pointer = undefined;
});

canvas.addEventListener("mousedown", (event) => {
  if (!game.currentLevel || game.state === "won" || game.state === "lost" || game.state === "menu") {
    return;
  }

  const point = pointerFromEvent(event);
  if (game.placingTower) {
    game.placeTower(game.placingTower, point);
  } else {
    game.selectTowerAt(point);
  }
});

pauseButton.addEventListener("click", () => {
  game.togglePause();
  syncHud();
});

levelButton.addEventListener("click", () => {
  game.setState("menu");
  renderModal();
  syncHud();
});

restartButton.addEventListener("click", () => {
  game.restart();
});

upgradeButton.addEventListener("click", () => {
  game.upgradeSelectedTower();
});

sellButton.addEventListener("click", () => {
  game.sellSelectedTower();
});

cancelButton.addEventListener("click", () => {
  game.placingTower = undefined;
  syncHud();
});

window.addEventListener("keydown", (event) => {
  if (event.repeat) {
    return;
  }

  const shortcutTower = (Object.entries(TOWER_SHORTCUTS) as [TowerKind, string[]][])
    .find(([, shortcuts]) => shortcuts.includes(event.key.toLowerCase()))?.[0];

  if (shortcutTower) {
    event.preventDefault();
    toggleTowerPlacement(shortcutTower);
    return;
  }

  if (event.key.toLowerCase() === "u") {
    event.preventDefault();
    game.upgradeSelectedTower();
    return;
  }

  if (event.key === "Escape") {
    game.placingTower = undefined;
    syncHud();
  }
  if (event.key === " ") {
    event.preventDefault();
    game.togglePause();
    syncHud();
  }
});

window.addEventListener("resize", () => {
  game.resize();
  game.draw();
});

setupTowerButtons();
renderModal();
syncHud();

let lastFrame = performance.now();

function frame(now: number): void {
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  game.update(dt);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
