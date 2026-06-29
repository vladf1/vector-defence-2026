import { createHitImpactParticles } from "../../game-engine/combat-effects";
import type { UpdateContext, UpdateResult } from "../../game-engine/update-context";
import { AudioCue } from "../../types";
import type { Point } from "../../types";
import { angleBetween, isOutsideBounds, withinDistance } from "../../utils";

const PROJECTILE_DAMAGE_BASE = 10;
const PROJECTILE_SIZE_BASE = 3;
const PROJECTILE_SIZE_PER_LEVEL = 0.5;
const PROJECTILE_SPEED_PER_SECOND = 420;
export const DRONE_PROJECTILE_SPEED_PER_SECOND = 560;
const DRONE_PROJECTILE_DAMAGE_BASE = 4.32;
const DRONE_PROJECTILE_DAMAGE_PER_LEVEL = 0.96;
const DRONE_PROJECTILE_RADIUS_BASE = 1.25;
const DRONE_PROJECTILE_RADIUS_PER_LEVEL = 0.04;

export const ProjectileKind = {
  Gun: "gun",
  Drone: "drone",
} as const;

export type ProjectileKind = typeof ProjectileKind[keyof typeof ProjectileKind];

export class Projectile {
  x: number;
  y: number;
  velocityXPerSecond: number;
  velocityYPerSecond: number;
  damage: number;
  radius: number;
  angle: number;
  kind: ProjectileKind;
  impactColor: string;
  removed = false;

  constructor(source: Point, target: Point, level: number, kind: ProjectileKind) {
    this.angle = angleBetween(source, target);
    this.x = source.x;
    this.y = source.y;
    this.kind = kind;
    this.impactColor = getProjectileColor(kind, level);
    const speedPerSecond = getProjectileSpeedPerSecond(kind);
    this.velocityXPerSecond = Math.cos(this.angle) * speedPerSecond;
    this.velocityYPerSecond = Math.sin(this.angle) * speedPerSecond;
    this.damage = getProjectileDamage(kind, level);
    this.radius = getProjectileRadius(kind, level);
  }

  update(context: UpdateContext, result: UpdateResult): void {
    this.x += this.velocityXPerSecond * context.deltaSeconds;
    this.y += this.velocityYPerSecond * context.deltaSeconds;
    if (isOutsideBounds(this, context.fieldWidth, context.fieldHeight, 20)) {
      this.removed = true;
      return;
    }

    for (const monster of context.activeMonsters) {
      const hitDistance = monster.radius + this.radius;
      if (withinDistance(this, monster, hitDistance)) {
        monster.takeDamage(this.damage);
        this.removed = true;
        for (const particle of createHitImpactParticles(this.x, this.y, this.impactColor, this.angle)) {
          result.addParticle(particle);
        }
        result.playSound(AudioCue.ProjectileImpact, this.x, this.kind === ProjectileKind.Drone ? 0.08 : undefined);
        return;
      }
    }
  }

  draw(context: CanvasRenderingContext2D): void {
    const visualLevel = this.getVisualLevel();
    const length = this.kind === ProjectileKind.Drone
      ? 4.6 + (this.radius * 0.8)
      : (9.8 + (visualLevel * 1.45)) * 0.6;
    const halfWidth = this.kind === ProjectileKind.Drone
      ? 0.85 + (this.radius * 0.14)
      : (1.8 + (visualLevel * 0.22)) * 0.66;
    const tailX = -(length * 0.55);
    const noseX = length * 0.55;

    context.save();
    context.translate(this.x, this.y);
    context.rotate(this.angle);
    context.globalCompositeOperation = "lighter";

    context.fillStyle = this.kind === ProjectileKind.Drone ? this.impactColor : "#d9fff3";
    context.beginPath();
    context.moveTo(noseX, 0);
    context.lineTo(noseX - (length * 0.28), -halfWidth);
    context.lineTo(tailX, -halfWidth);
    context.lineTo(tailX, halfWidth);
    context.lineTo(noseX - (length * 0.28), halfWidth);
    context.closePath();
    context.fill();

    if (this.kind === ProjectileKind.Drone) {
      context.fillStyle = "#effff7";
      context.fillRect(tailX + 0.8, -0.36, length * 0.42, 0.72);
    }
    context.restore();
  }

  private getVisualLevel(): number {
    if (this.kind === ProjectileKind.Drone) {
      return this.levelFromDroneRadius();
    }

    return (this.radius - (PROJECTILE_SIZE_BASE / 2)) / (PROJECTILE_SIZE_PER_LEVEL / 2);
  }

  private levelFromDroneRadius(): number {
    return (this.radius - DRONE_PROJECTILE_RADIUS_BASE) / DRONE_PROJECTILE_RADIUS_PER_LEVEL;
  }
}

function getProjectileSpeedPerSecond(kind: ProjectileKind): number {
  return kind === ProjectileKind.Drone ? DRONE_PROJECTILE_SPEED_PER_SECOND : PROJECTILE_SPEED_PER_SECOND;
}

function getProjectileDamage(kind: ProjectileKind, level: number): number {
  return kind === ProjectileKind.Drone
    ? DRONE_PROJECTILE_DAMAGE_BASE + (level * DRONE_PROJECTILE_DAMAGE_PER_LEVEL)
    : PROJECTILE_DAMAGE_BASE + level;
}

function getProjectileRadius(kind: ProjectileKind, level: number): number {
  return kind === ProjectileKind.Drone
    ? DRONE_PROJECTILE_RADIUS_BASE + (level * DRONE_PROJECTILE_RADIUS_PER_LEVEL)
    : (PROJECTILE_SIZE_BASE + (level * PROJECTILE_SIZE_PER_LEVEL)) / 2;
}

function getProjectileColor(kind: ProjectileKind, level: number): string {
  if (kind !== ProjectileKind.Drone) {
    return "#9fffe4";
  }

  const colors = ["#9dffd7", "#d8ff4f", "#ffe27a", "#ffad4f", "#ff8edb", "#b58cff", "#7fd7ff"] as const;
  return colors[Math.min(level, colors.length - 1)];
}
