import { MAX_TOWER_LEVEL, UPGRADE_COST } from "../../constants";
import type { Point } from "../../types";
import type { TowerKind } from "../../types";
import { normalizeAngle } from "../../utils";
import type { Monster } from "../monsters/monster";
import type { GameAccess } from "../game-access";

const DEFAULT_FIRING_ANGLE_TOLERANCE = 0.08;

export interface TowerClass<T extends Tower = Tower> {
  new (x: number, y: number): T;
  readonly kind: TowerKind;
  readonly label: string;
  readonly summary: string;
  readonly baseCost: number;
  readonly baseRange: number;
  readonly shortcuts: readonly string[];
}

export abstract class Tower {
  kind: TowerKind;
  x: number;
  y: number;
  range: number;
  cost: number;
  currentTarget?: Monster;
  level = 0;
  cooldownSeconds = 0;
  removed = false;

  constructor(x: number, y: number) {
    const towerClass = this.constructor as TowerClass;
    this.kind = towerClass.kind;
    this.x = x;
    this.y = y;
    this.range = towerClass.baseRange;
    this.cost = towerClass.baseCost;
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

  update(game: GameAccess, deltaSeconds: number): void {
    this.cooldownSeconds = Math.max(0, this.cooldownSeconds - deltaSeconds);
    this.onUpdate(game, deltaSeconds);
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

  protected getTrackedMonster(game: GameAccess): Monster | undefined {
    if (this.currentTarget && this.canTrack(this.currentTarget)) {
      return this.currentTarget;
    }

    this.currentTarget = this.getClosestMonster(game);
    return this.currentTarget;
  }

  protected getClosestMonster(game: GameAccess): Monster | undefined {
    let closest: Monster | undefined;
    let smallestDistanceSquared = Number.POSITIVE_INFINITY;

    for (const monster of game.monsters) {
      const distanceSquared = this.getDistanceSquaredInRange(monster);
      if (distanceSquared === null) {
        continue;
      }

      if (distanceSquared < smallestDistanceSquared) {
        smallestDistanceSquared = distanceSquared;
        closest = monster;
      }
    }
    return closest;
  }

  protected canTrack(monster: Monster): boolean {
    return this.getDistanceSquaredInRange(monster) !== null;
  }

  private getDistanceSquaredInRange(monster: Monster): number | null {
    if (monster.removed) {
      return null;
    }

    const dx = monster.x - this.x;
    if (Math.abs(dx) > this.range) {
      return null;
    }

    const dy = monster.y - this.y;
    if (Math.abs(dy) > this.range) {
      return null;
    }

    const distanceSquared = (dx * dx) + (dy * dy);
    if (distanceSquared > this.range * this.range) {
      return null;
    }

    return distanceSquared;
  }

  protected calculateIntercept(monster: Monster, projectileSpeedPerSecond: number, from: Point): Point {
    const target = { x: monster.x - from.x, y: monster.y - from.y };
    const a = (projectileSpeedPerSecond * projectileSpeedPerSecond) - ((monster.velocityXPerSecond * monster.velocityXPerSecond) + (monster.velocityYPerSecond * monster.velocityYPerSecond));
    const b = (target.x * monster.velocityXPerSecond) + (target.y * monster.velocityYPerSecond);
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
      x: monster.x + (monster.velocityXPerSecond * t),
      y: monster.y + (monster.velocityYPerSecond * t),
    };
  }

  protected resetCooldown(seconds: number): void {
    this.cooldownSeconds = seconds;
  }

  protected ready(): boolean {
    return this.cooldownSeconds <= 0;
  }

  protected isAimedAtTarget(currentAngle: number, targetAngle: number, tolerance = DEFAULT_FIRING_ANGLE_TOLERANCE): boolean {
    return Math.abs(normalizeAngle(targetAngle - currentAngle)) <= tolerance;
  }

  protected drawSelection(context: CanvasRenderingContext2D): void {
    context.save();
    context.strokeStyle = "rgba(92, 255, 158, 0.25)";
    context.fillStyle = "rgba(92, 255, 158, 0.05)";
    context.beginPath();
    context.arc(0, 0, this.range, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();
  }

  protected abstract onUpdate(game: GameAccess, deltaSeconds: number): void;
  protected abstract onUpgrade(): void;
  abstract draw(context: CanvasRenderingContext2D, active: boolean): void;
}
