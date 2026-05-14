import type { Particle } from "../effects/particle";
import type { PathEntry } from "../../route-path";
import { AudioCue } from "../../types";
import { drawPath, randomRange } from "../../utils";
import { createPolygonShardParticles } from "./death-effect-helpers";
import { Monster, type MonsterDeathEffect } from "./monster";
import { createPolygonShardSplitterConfig } from "./polygon-shard-splitter";

const COLOR = "#ff8bd5";
const SPEED_PER_SECOND = 73;
const HIT_POINTS = 253;
const BOUNTY = 3;
const RADIUS = 8.5;
const OUTLINE = Array.from({ length: 6 }, (_, index) => {
  const angle = (Math.PI / 3) * index;
  const radius = index % 2 === 0 ? RADIUS * 1.15 : RADIUS * 0.72;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
});

export class SplitterMonster extends Monster {
  constructor(path: PathEntry[], speedScale: number) {
    super(path, COLOR, SPEED_PER_SECOND * speedScale, HIT_POINTS, BOUNTY, RADIUS);
  }

  protected updateSpecial(deltaSeconds: number): void {
    this.rotation += 2.7 * deltaSeconds;
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.rotation);
    drawPath(context, OUTLINE, true);
    context.beginPath();
    context.moveTo(-this.radius * 0.55, -this.radius * 0.15);
    context.lineTo(0, this.radius * 0.2);
    context.lineTo(this.radius * 0.58, -this.radius * 0.18);
    context.stroke();
  }

  override createDeathEffect(): MonsterDeathEffect {
    const pivot = {
      x: randomRange(-this.radius * 0.14, this.radius * 0.14),
      y: randomRange(-this.radius * 0.14, this.radius * 0.14),
    };
    const particles: Particle[] = createPolygonShardParticles(
      this.x,
      this.y,
      this.color,
      OUTLINE,
      pivot,
      this.rotation,
      110,
      185,
      0,
      createPolygonShardSplitterConfig({
        minShardCount: 5,
        maxShardCount: 11,
      }),
    );

    return {
      sound: { cue: AudioCue.MonsterPop, intensity: 1.1 },
      particles,
    };
  }

}
