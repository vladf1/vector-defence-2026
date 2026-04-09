import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  MAX_LINKS,
  MAX_PARTICLES,
  MAX_TOWER_LEVEL,
  MONSTER_PRESETS,
  TOWER_RADIUS,
  TOWER_SPECS,
  UPGRADE_COST,
} from "./constants";
import {
  angleBetween,
  distanceSquaredXY,
  distanceXY,
  hexWithAlpha,
  pointToSegmentDistanceSquaredXY,
  randomRange,
} from "./utils";
import { TowerKind } from "./types";
import type { LevelData, MonsterCode, Point } from "./types";

export interface GameAccess {
  monsters: Monster[];
  projectiles: Projectile[];
  missiles: Missile[];
  particles: Particle[];
  links: LinkEffect[];
  onMonsterKilled(monster: Monster): void;
  onMonsterEscaped(monster: Monster): void;
  createExplosion(x: number, y: number, count: number, size: number, color: string, burnRate: number): void;
  addParticle(particle: Particle): void;
  addLink(link: LinkEffect): void;
}

export class Particle {
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

export class LinkEffect {
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
    const fromX = this.fromTower ? this.fromTower.x : this.from?.x;
    const fromY = this.fromTower ? this.fromTower.y : this.from?.y;
    if (fromX === undefined || fromY === undefined) {
      return;
    }
    context.save();
    context.strokeStyle = hexWithAlpha(this.color, this.alpha);
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(fromX, fromY);
    context.lineTo(this.target.x, this.target.y);
    context.stroke();
    context.restore();
  }
}

export class Monster {
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

  update(game: GameAccess, multiplier: number): void {
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

export class Projectile {
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

  update(game: GameAccess, multiplier: number): void {
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

export class Missile {
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

  update(game: GameAccess, multiplier: number, dt: number): void {
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

export abstract class Tower {
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

  update(game: GameAccess, dt: number, multiplier: number): void {
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

  protected getClosestMonster(game: GameAccess): Monster | undefined {
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

  protected abstract onUpdate(game: GameAccess, multiplier: number): void;
  protected abstract onUpgrade(): void;
  abstract draw(context: CanvasRenderingContext2D, active: boolean): void;
}

export class GunTower extends Tower {
  angle = randomRange(-Math.PI, Math.PI);

  constructor(x: number, y: number) {
    super(TowerKind.Gun, x, y);
  }

  protected onUpdate(game: GameAccess): void {
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

export class LaserTower extends Tower {
  angle = randomRange(-Math.PI, Math.PI);
  beamAlpha = 0;
  beamTarget = { x: 0, y: 0 };
  damagePerHit = 1;

  constructor(x: number, y: number) {
    super(TowerKind.Laser, x, y);
  }

  protected onUpdate(game: GameAccess, multiplier: number): void {
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

export class MissileTower extends Tower {
  angle = Math.PI / 4;
  rotationSpeed = 0.5;
  missileDamage = 50;

  constructor(x: number, y: number) {
    super(TowerKind.Missile, x, y);
    this.applyLevelStats();
  }

  protected onUpdate(game: GameAccess, multiplier: number): void {
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

export class SlowTower extends Tower {
  pulse = 0;

  constructor(x: number, y: number) {
    super(TowerKind.Slow, x, y);
  }

  protected onUpdate(game: GameAccess, multiplier: number): void {
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

export function drawTowerSelection(context: CanvasRenderingContext2D, range: number): void {
  context.save();
  context.strokeStyle = "rgba(92, 255, 158, 0.25)";
  context.fillStyle = "rgba(92, 255, 158, 0.05)";
  context.beginPath();
  context.arc(0, 0, range, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

export function createTower(kind: TowerKind, x: number, y: number): Tower {
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
