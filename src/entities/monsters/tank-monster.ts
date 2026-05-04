import { GlassShardParticle } from "../effects/glass-shard-particle";
import { TankTurretParticle } from "../effects/tank-turret-particle";
import type { PathEntry } from "../../route-path";
import { AudioCue } from "../../types";
import { randomRange } from "../../utils";
import {
  buildShards,
  createSimpleExplosionParticles,
  rotatePoint,
} from "./death-effect-helpers";
import { Monster, type MonsterDeathEffect } from "./monster";

const COLOR = "#9fb6ff";
const SPEED_PER_SECOND = 41;
const HIT_POINTS = 462;
const BOUNTY = 6;
const RADIUS = 10.5;

export class TankMonster extends Monster {
  constructor(path: PathEntry[], speedScale: number) {
    super(path, COLOR, SPEED_PER_SECOND * speedScale, HIT_POINTS, BOUNTY, RADIUS);
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.angle);
    const hull = this.createHullRect();
    context.fillRect(hull.x, hull.y, hull.width, hull.height);
    context.strokeRect(hull.x, hull.y, hull.width, hull.height);
    const turretCenterX = this.radius * 0.08;
    const turretRadius = this.radius * 0.42;
    context.beginPath();
    context.arc(turretCenterX, 0, turretRadius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(turretCenterX + turretRadius * 0.92, 0);
    context.lineTo(this.radius * 1.52, 0);
    context.stroke();
  }

  override createDeathEffect(): MonsterDeathEffect {
    const hullPivot = {
      x: randomRange(-this.radius * 0.15, this.radius * 0.35),
      y: randomRange(-this.radius * 0.22, this.radius * 0.22),
    };
    const turretCenterOffset = rotatePoint(
      { x: this.radius * 0.38, y: 0 },
      this.angle,
    );
    const particles: MonsterDeathEffect["particles"] = [
      new TankTurretParticle(
        this.x + turretCenterOffset.x,
        this.y + turretCenterOffset.y,
        this.radius,
        this.color,
        this.angle,
      ),
      ...buildShards(
        this.createHullOutline(),
        hullPivot,
        Math.round(randomRange(7, 12)),
      ).map(
        (shardVertices) =>
          new GlassShardParticle(
            this.x,
            this.y,
            this.color,
            shardVertices,
            this.angle,
            randomRange(125, 220),
          ),
      ),
      ...createSimpleExplosionParticles(
        this.x,
        this.y,
        12,
        randomRange(2.6, 4.8),
        "#fff1a6",
        randomRange(1.8, 2.5),
      ),
      ...createSimpleExplosionParticles(
        this.x,
        this.y,
        8,
        randomRange(1.5, 2.8),
        "#dfe6f3",
        randomRange(2.6, 3.8),
      ),
    ];

    return {
      sound: { cue: AudioCue.MonsterHeavyDeath, intensity: 1.25 },
      particles,
    };
  }

  private createHullRect() {
    return {
      x: -this.radius,
      y: -this.radius * 0.72,
      width: this.radius * 2.1,
      height: this.radius * 1.44,
    };
  }

  private createHullOutline() {
    const hull = this.createHullRect();
    return [
      { x: hull.x, y: hull.y },
      { x: hull.x + hull.width, y: hull.y },
      { x: hull.x + hull.width, y: hull.y + hull.height },
      { x: hull.x, y: hull.y + hull.height },
    ];
  }
}
