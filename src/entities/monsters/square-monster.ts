import type { Particle } from "../effects/particle";
import type { PathEntry } from "../../route-path";
import { AudioCue } from "../../types";
import { randomRange } from "../../utils";
import { createPolygonShardParticles } from "./death-effect-helpers";
import { Monster, type MonsterDeathEffect } from "./monster";
import { createPolygonShardSplitterConfig } from "./polygon-shard-splitter";

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
    const particles: Particle[] = createPolygonShardParticles(
      this.x,
      this.y,
      this.color,
      this.createOutline(),
      pivot,
      this.rotation,
      128,
      233,
      1.2,
      createPolygonShardSplitterConfig({
        minShardCount: 5,
        maxShardCount: 11,
      }),
    );
    return {
      sound: { cue: AudioCue.MonsterShatter },
      particles,
    };
  }

  private createOutline() {
    return [
      { x: -this.radius, y: -this.radius },
      { x: this.radius, y: -this.radius },
      { x: this.radius, y: this.radius },
      { x: -this.radius, y: this.radius },
    ];
  }
}
