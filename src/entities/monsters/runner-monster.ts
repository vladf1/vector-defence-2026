import type { Particle } from "../effects/particle";
import type { PathEntry } from "../../route-path";
import { AudioCue } from "../../types";
import { drawPath, randomRange } from "../../utils";
import { createPolygonShardParticles } from "./death-effect-helpers";
import { Monster, type MonsterDeathEffect } from "./monster";
import { createPolygonShardSplitterConfig } from "./polygon-shard-splitter";

const COLOR = "#91ff63";
const SPEED_PER_SECOND = 132;
const HIT_POINTS = 83;
const BOUNTY = 2;
const RADIUS = 5.5;

export class RunnerMonster extends Monster {
  constructor(path: PathEntry[], speedScale: number) {
    super(path, COLOR, SPEED_PER_SECOND * speedScale, HIT_POINTS, BOUNTY, RADIUS);
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.angle);
    const outline = this.createOutline();
    drawPath(context, outline, true);
    context.beginPath();
    context.moveTo(-this.radius * 0.95, 0);
    context.lineTo(-this.radius * 1.5, -this.radius * 0.55);
    context.moveTo(-this.radius * 0.95, 0);
    context.lineTo(-this.radius * 1.5, this.radius * 0.55);
    context.stroke();
  }

  override createDeathEffect(): MonsterDeathEffect {
    const pivot = {
      x: randomRange(-this.radius * 0.35, this.radius * 0.3),
      y: randomRange(-this.radius * 0.16, this.radius * 0.16),
    };
    const particles: Particle[] = createPolygonShardParticles(
      this.x,
      this.y,
      this.color,
      this.createOutline(),
      pivot,
      this.angle,
      155,
      255,
      0,
      createPolygonShardSplitterConfig({
        minShardCount: 5,
        maxShardCount: 11,
      }),
    );

    return {
      sound: { cue: AudioCue.MonsterPop, intensity: 0.85 },
      particles,
    };
  }

  private createOutline() {
    return [
      { x: this.radius * 1.7, y: 0 },
      { x: -this.radius * 0.1, y: -this.radius * 0.82 },
      { x: -this.radius * 1.35, y: 0 },
      { x: -this.radius * 0.1, y: this.radius * 0.82 },
    ];
  }
}
