import { GlassShardParticle } from "../effects/glass-shard-particle";
import type { Particle } from "../effects/particle";
import type { PathEntry } from "../../route-path";
import { AudioCue } from "../../types";
import { drawPath, randomRange } from "../../utils";
import { buildShards, createSimpleExplosionParticles, randomPointInsideTriangle } from "./death-effect-helpers";
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
    const outline = this.createOutline();
    const pivot = randomPointInsideTriangle(outline[0], outline[1], outline[2]);
    const particles: Particle[] = buildShards(
      outline,
      pivot,
      Math.round(randomRange(4, 8)),
    ).map(
      (shardVertices) =>
        new GlassShardParticle(
          this.x,
          this.y,
          this.color,
          shardVertices,
          this.angle,
          randomRange(145, 245),
        ),
    );
    particles.push(
      ...createSimpleExplosionParticles(
        this.x,
        this.y,
        5,
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
}
