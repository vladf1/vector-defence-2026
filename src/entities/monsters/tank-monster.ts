import { TankTurretParticle } from "../effects/tank-turret-particle";
import type { Particle } from "../effects/particle";
import type { PathEntry } from "../../route-path";
import { AudioCue } from "../../types";
import { randomRange } from "../../utils";
import { createPolygonShardParticles, rotatePoint } from "./death-effect-helpers";
import { Monster, type MonsterDeathEffect } from "./monster";
import { createPolygonShardSplitterConfig } from "./polygon-shard-splitter";
import { drawTankTurret } from "./tank-turret-rendering";

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
    drawTankTurret(context, this.radius, 0.42, 1.52);
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
    const particles: Particle[] = [
      new TankTurretParticle(
        this.x + turretCenterOffset.x,
        this.y + turretCenterOffset.y,
        this.radius,
        this.color,
        this.angle,
      ),
      ...createPolygonShardParticles(
        this.x,
        this.y,
        this.color,
        this.createHullOutline(),
        hullPivot,
        this.angle,
        125,
        220,
        0,
        createPolygonShardSplitterConfig({
          minShardCount: 6,
          maxShardCount: 13,
        }),
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
