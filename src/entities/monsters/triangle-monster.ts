import type { Particle } from "../effects/particle";
import type { PathEntry } from "../../route-path";
import { AudioCue } from "../../types";
import { drawPath, randomRange } from "../../utils";
import { createPolygonShardParticles, createSimpleExplosionParticles } from "./death-effect-helpers";
import { Monster, type MonsterDeathEffect } from "./monster";
import { createPolygonShardSplitterConfig } from "./polygon-shard-splitter";

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
    const particles: Particle[] = createPolygonShardParticles(
      this.x,
      this.y,
      this.color,
      this.createOutline(),
      pivot,
      this.angle,
      115,
      195,
      1.4,
      createPolygonShardSplitterConfig({
        minShardCount: 4,
        maxShardCount: 9,
      }),
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
}
