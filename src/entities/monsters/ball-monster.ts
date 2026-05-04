import { CircleShardParticle } from "../effects/circle-shard-particle";
import { GlassShardParticle } from "../effects/glass-shard-particle";
import type { PathEntry } from "../../route-path";
import { AudioCue } from "../../types";
import { randomRange } from "../../utils";
import {
  createCoreShardVertices,
  createSimpleExplosionParticles,
  pointOnRadius,
  sampleCircleArcs,
} from "./death-effect-helpers";
import { Monster, type MonsterDeathEffect } from "./monster";

const COLOR = "#5df2ef";
const SPEED_PER_SECOND = 81;
const HIT_POINTS = 220;
const BOUNTY = 2;
const RADIUS = 7.5;
const MOUTH_ANGLE = Math.PI * 0.18;

export class BallMonster extends Monster {
  constructor(path: PathEntry[], speedScale: number) {
    super(path, COLOR, SPEED_PER_SECOND * speedScale, HIT_POINTS, BOUNTY, RADIUS);
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.angle);
    context.beginPath();
    context.moveTo(0, 0);
    context.arc(0, 0, this.radius, MOUTH_ANGLE, (Math.PI * 2) - MOUTH_ANGLE);
    context.closePath();
    context.fill();
    context.stroke();

    context.beginPath();
    context.arc(this.radius * 0.12, -this.radius * 0.5, this.radius * 0.16, 0, Math.PI * 2);
    context.fill();
  }

  override createDeathEffect(): MonsterDeathEffect {
    const particles: MonsterDeathEffect["particles"] = [];
    for (const arc of sampleCircleArcs(Math.round(randomRange(4, 9)))) {
      const sweepShare = arc.sweepAngle / (Math.PI * 2);
      const innerStartAngle =
        arc.startAngle + arc.sweepAngle * randomRange(0.12, 0.32);
      const innerEndAngle =
        arc.startAngle +
        arc.sweepAngle -
        arc.sweepAngle * randomRange(0.12, 0.32);
      const innerPeakAngle =
        arc.startAngle + arc.sweepAngle * randomRange(0.32, 0.68);
      particles.push(
        new CircleShardParticle(
          this.x,
          this.y,
          this.radius * randomRange(0.95, 1.1),
          this.color,
          arc.startAngle,
          arc.sweepAngle,
          pointOnRadius(innerStartAngle, this.radius * randomRange(0.18, 0.52)),
          pointOnRadius(innerPeakAngle, this.radius * randomRange(0.05, 0.36)),
          pointOnRadius(innerEndAngle, this.radius * randomRange(0.18, 0.52)),
          randomRange(135, 215) + sweepShare * 28,
        ),
      );
    }

    for (let index = 0; index < Math.round(randomRange(2, 4)); index += 1) {
      const coreCenter = pointOnRadius(
        randomRange(-Math.PI, Math.PI),
        this.radius * randomRange(0.05, 0.28),
      );
      particles.push(
        new GlassShardParticle(
          this.x,
          this.y,
          this.color,
          createCoreShardVertices(
            coreCenter,
            this.radius * randomRange(0.16, 0.34),
          ),
          randomRange(-Math.PI, Math.PI),
          randomRange(95, 170),
        ),
      );
    }

    particles.push(
      ...createSimpleExplosionParticles(
        this.x,
        this.y,
        6,
        randomRange(1.5, 2.8),
        this.color,
        randomRange(2.4, 3.6),
      ),
      ...createSimpleExplosionParticles(
        this.x,
        this.y,
        4,
        randomRange(1, 1.8),
        "#dcfffe",
        randomRange(3, 4.2),
      ),
    );

    return {
      sound: { cue: AudioCue.MonsterShatter },
      particles,
    };
  }
}
