import { GlassShardParticle } from "../effects/glass-shard-particle";
import type { Particle } from "../effects/particle";
import type { PathEntry } from "../../route-path";
import { AudioCue, type Point } from "../../types";
import { drawPath, randomRange } from "../../utils";
import { createSimpleExplosionParticles } from "./death-effect-helpers";
import { Monster, type MonsterDeathEffect } from "./monster";

const COLOR = "#ffba4f";
const SPEED_PER_SECOND = 95;
const HIT_POINTS = 110;
const BOUNTY = 3;
const RADIUS = 7;
const OUTLINE_RADIUS = 6;

export class TriangleMonster extends Monster {
  constructor(path: PathEntry[], speedScale: number) {
    super(path, COLOR, SPEED_PER_SECOND * speedScale, HIT_POINTS, BOUNTY, RADIUS);
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.angle);
    const outline = this.createOutline();
    drawPath(context, outline, true);
  }

  override createDeathEffect(): MonsterDeathEffect {
    const pivot = {
      x: randomRange(-OUTLINE_RADIUS * 0.1, OUTLINE_RADIUS * 0.14),
      y: randomRange(-OUTLINE_RADIUS * 0.12, OUTLINE_RADIUS * 0.12),
    };
    const particles: Particle[] = this.createCrackShards(pivot).map(
      (shardVertices) =>
        new GlassShardParticle(
          this.x,
          this.y,
          this.color,
          shardVertices,
          pivot,
          this.angle,
          randomRange(115, 195),
          1.4,
        ),
    );
    particles.push(
      ...createSimpleExplosionParticles(
        this.x,
        this.y,
        4,
        randomRange(1.1, 2),
        "#fff0c8",
        randomRange(3.1, 4.2),
      ),
    );

    return {
      sound: { cue: AudioCue.MonsterShatter },
      particles,
    };
  }

  private createOutline() {
    return [
      { x: OUTLINE_RADIUS, y: 0 },
      { x: -OUTLINE_RADIUS, y: -OUTLINE_RADIUS },
      { x: -OUTLINE_RADIUS, y: OUTLINE_RADIUS },
    ];
  }

  private createCrackShards(pivot: Point): Point[][] {
    const radius = OUTLINE_RADIUS;
    const tip = { x: radius, y: 0 };
    const upperLeft = { x: -radius, y: -radius };
    const lowerLeft = { x: -radius, y: radius };
    const upperSideBreak = this.jitterAlongEdge(upperLeft, tip, 0.48);
    const lowerSideBreak = this.jitterAlongEdge(tip, lowerLeft, 0.5);
    const leftSideBreak = this.jitterAlongEdge(lowerLeft, upperLeft, 0.5);

    return [
      [upperLeft, upperSideBreak, pivot],
      [upperSideBreak, tip, pivot],
      [tip, lowerSideBreak, pivot],
      [lowerSideBreak, lowerLeft, pivot],
      [lowerLeft, leftSideBreak, pivot],
      [leftSideBreak, upperLeft, pivot],
    ];
  }

  private jitterAlongEdge(start: Point, end: Point, ratio: number): Point {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    const edgeRatio = ratio + randomRange(-0.11, 0.11);
    const normalOffset = randomRange(-0.28, 0.28);
    const normalX = length === 0 ? 0 : (-dy / length) * normalOffset;
    const normalY = length === 0 ? 0 : (dx / length) * normalOffset;
    return {
      x: start.x + (dx * edgeRatio) + normalX,
      y: start.y + (dy * edgeRatio) + normalY,
    };
  }
}
