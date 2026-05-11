import { GlassShardParticle } from "../effects/glass-shard-particle";
import type { Particle } from "../effects/particle";
import type { PathEntry } from "../../route-path";
import { AudioCue, type Point } from "../../types";
import { randomRange } from "../../utils";
import { createSimpleExplosionParticles } from "./death-effect-helpers";
import { Monster, type MonsterDeathEffect } from "./monster";

const COLOR = "#ff6f62";
const SPEED_PER_SECOND = 68;
const HIT_POINTS = 165;
const BOUNTY = 3;
const RADIUS = 6.5;

export class SquareMonster extends Monster {
  constructor(path: PathEntry[], speedScale: number) {
    super(path, COLOR, SPEED_PER_SECOND * speedScale, HIT_POINTS, BOUNTY, RADIUS);
  }

  protected updateSpecial(deltaSeconds: number): void {
    this.rotation += 4.2 * deltaSeconds;
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.rotation);
    context.fillRect(
      -this.radius,
      -this.radius,
      this.radius * 2,
      this.radius * 2,
    );
    context.strokeRect(
      -this.radius,
      -this.radius,
      this.radius * 2,
      this.radius * 2,
    );
  }

  override createDeathEffect(): MonsterDeathEffect {
    const pivot = {
      x: randomRange(-this.radius * 0.24, this.radius * 0.24),
      y: randomRange(-this.radius * 0.24, this.radius * 0.24),
    };
    const particles: Particle[] = this.createBreakupShards().map(
      (shardVertices) =>
        new GlassShardParticle(
          this.x,
          this.y,
          this.color,
          shardVertices,
          pivot,
          this.rotation,
          randomRange(128, 233),
          1.2,
        ),
    );
    particles.push(
      ...createSimpleExplosionParticles(
        this.x,
        this.y,
        4,
        randomRange(0.9, 1.7),
        "#ffffff",
        randomRange(3, 4.4),
      ),
    );

    return {
      sound: { cue: AudioCue.MonsterShatter },
      particles,
    };
  }

  private createBreakupShards(): Point[][] {
    const radius = this.radius;
    const top = {
      x: randomRange(-radius * 0.3, radius * 0.28),
      y: -radius,
    };
    const right = {
      x: radius,
      y: randomRange(-radius * 0.28, radius * 0.32),
    };
    const bottom = {
      x: randomRange(-radius * 0.28, radius * 0.3),
      y: radius,
    };
    const left = {
      x: -radius,
      y: randomRange(-radius * 0.32, radius * 0.28),
    };
    const coreTop = {
      x: randomRange(-radius * 0.12, radius * 0.16),
      y: randomRange(-radius * 0.42, -radius * 0.2),
    };
    const coreRight = {
      x: randomRange(radius * 0.18, radius * 0.42),
      y: randomRange(-radius * 0.12, radius * 0.16),
    };
    const coreBottom = {
      x: randomRange(-radius * 0.16, radius * 0.12),
      y: randomRange(radius * 0.2, radius * 0.42),
    };
    const coreLeft = {
      x: randomRange(-radius * 0.42, -radius * 0.18),
      y: randomRange(-radius * 0.16, radius * 0.12),
    };

    return [
      [{ x: -radius, y: -radius }, top, coreTop, coreLeft, left],
      [top, { x: radius, y: -radius }, right, coreRight, coreTop],
      [coreRight, right, { x: radius, y: radius }, bottom, coreBottom],
      [left, coreLeft, coreBottom, bottom, { x: -radius, y: radius }],
      [coreTop, coreRight, coreBottom, coreLeft],
    ];
  }
}
