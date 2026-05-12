import type { Particle } from "../effects/particle";
import type { PathEntry } from "../../route-path";
import { AudioCue, type Point } from "../../types";
import { randomRange } from "../../utils";
import {
  createPolygonShardParticles,
  pointOnRadius,
} from "./death-effect-helpers";
import { Monster, type MonsterDeathEffect } from "./monster";
import { createPolygonShardSplitterConfig } from "./polygon-shard-splitter";

const COLOR = "#5df2ef";
const SPEED_PER_SECOND = 81;
const HIT_POINTS = 220;
const BOUNTY = 2;
const RADIUS = 7.5;
const MOUTH_ANGLE = Math.PI * 0.18;

export class PackManMonster extends Monster {
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
    const pivot = {
      x: randomRange(-this.radius * 0.12, this.radius * 0.12),
      y: randomRange(-this.radius * 0.12, this.radius * 0.12),
    };
    const particles: Particle[] = createPolygonShardParticles(
      this.x,
      this.y,
      this.color,
      this.createOutline(18),
      pivot,
      this.angle,
      125,
      205,
      0,
      createPolygonShardSplitterConfig({
        minShardCount: 5,
        maxShardCount: 11,
        preferredMaxShardVertices: 14,
        maxShardVertices: 26,
      }),
    );

    return {
      sound: { cue: AudioCue.MonsterShatter },
      particles,
    };
  }
}
