import { MAX_TOWER_LEVEL, TOWER_SPECS, UPGRADE_COST } from "../../constants";
import { TowerKind } from "../../types";
import type { Point } from "../../types";
import type { Monster } from "../monsters/monster";
import type { GameAccess } from "../game-access";

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

  update(game: GameAccess, deltaSeconds: number): void {
    this.cooldownMs = Math.max(0, this.cooldownMs - (deltaSeconds * 1000));
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

  protected getClosestMonster(game: GameAccess): Monster | undefined {
    let closest: Monster | undefined;
    let smallestDistanceSquared = Number.POSITIVE_INFINITY;
    const range = this.range;
    const rangeSquared = range * range;
    const towerX = this.x;
    const towerY = this.y;

    for (const monster of game.monsters) {
      if (monster.removed) {
        continue;
      }

      const dx = monster.x - towerX;
      if (Math.abs(dx) > range) {
        continue;
      }

      const dy = monster.y - towerY;
      if (Math.abs(dy) > range) {
        continue;
      }

      const distanceSquared = (dx * dx) + (dy * dy);
      if (distanceSquared > rangeSquared) {
        continue;
      }

      if (distanceSquared < smallestDistanceSquared) {
        smallestDistanceSquared = distanceSquared;
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
