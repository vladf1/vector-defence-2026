import { GlassShardParticle } from "../effects/glass-shard-particle";
import type { PathEntry } from "../../route-path";
import { AudioCue } from "../../types";
import { randomRange } from "../../utils";
import {
  buildShards,
  createSimpleExplosionParticles,
  randomPointInsideTriangle,
} from "./death-effect-helpers";
import { Monster, type MonsterDeathEffect } from "./monster";

const COLOR = "#ffba4f";
const SPEED_PER_SECOND = 95;
const HIT_POINTS = 110;
const BOUNTY = 3;
const RADIUS = 7;
const OUTLINE_RADIUS = 6;

export class TriangleMonster extends Monster {
  constructor(path: PathEntry[]) {
    super(path, COLOR, SPEED_PER_SECOND, HIT_POINTS, BOUNTY, RADIUS);
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.angle);
    context.beginPath();
    const outline = this.createOutline();
    context.moveTo(outline[0].x, outline[0].y);
    context.lineTo(outline[1].x, outline[1].y);
    context.lineTo(outline[2].x, outline[2].y);
    context.closePath();
    context.fill();
    context.stroke();
  }

  override createDeathEffect(): MonsterDeathEffect {
    const outline = this.createOutline();
    const pivot = randomPointInsideTriangle(outline[0], outline[1], outline[2]);
    const particles: MonsterDeathEffect["particles"] = buildShards(
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
