import { CircleShardParticle } from "../effects/circle-shard-particle";
import type { Particle } from "../effects/particle";
import type { PathEntry } from "../../route-path";
import { AudioCue, type Point } from "../../types";
import { randomRange } from "../../utils";
import {
  createSimpleExplosionParticles,
  pointOnRadius,
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

  createOutline(arcVertexCount: number): Point[] {
    const bodySweepAngle = (Math.PI * 2) - (MOUTH_ANGLE * 2);
    const vertexCount = Math.max(2, Math.floor(arcVertexCount));
    const outline = [{ x: 0, y: 0 }];

    for (let index = 0; index < vertexCount; index += 1) {
      const ratio = vertexCount === 1 ? 0 : index / (vertexCount - 1);
      const angle = MOUTH_ANGLE + (bodySweepAngle * ratio);
      outline.push(pointOnRadius(angle, this.radius));
    }

    return outline;
  }

  override createDeathEffect(): MonsterDeathEffect {
    const particles: Particle[] = [];
    for (const arc of this.sampleBodyArcs(Math.round(randomRange(6, 9)))) {
      const innerStartAngle =
        arc.startAngle + arc.sweepAngle * randomRange(0.08, 0.2);
      const innerEndAngle =
        arc.startAngle +
        arc.sweepAngle -
        arc.sweepAngle * randomRange(0.08, 0.2);
      const innerPeakAngle =
        arc.startAngle + arc.sweepAngle * randomRange(0.36, 0.64);
      particles.push(
        new CircleShardParticle(
          this.x,
          this.y,
          this.radius * randomRange(0.96, 1.04),
          this.color,
          arc.startAngle + this.angle,
          arc.sweepAngle,
          pointOnRadius(innerStartAngle + this.angle, this.radius * randomRange(0.08, 0.24)),
          pointOnRadius(innerPeakAngle + this.angle, this.radius * randomRange(0.02, 0.16)),
          pointOnRadius(innerEndAngle + this.angle, this.radius * randomRange(0.08, 0.24)),
          0,
          randomRange(125, 205),
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

  private sampleBodyArcs(arcCount: number) {
    const bodySweepAngle = (Math.PI * 2) - (MOUTH_ANGLE * 2);
    const weights = Array.from({ length: arcCount }, () =>
      randomRange(0.72, 1.28),
    );
    const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
    const arcs = [];
    let startAngle = MOUTH_ANGLE;
    for (const weight of weights) {
      const sweepAngle = (weight / weightTotal) * bodySweepAngle;
      arcs.push({ startAngle, sweepAngle });
      startAngle += sweepAngle;
    }
    return arcs;
  }
}
