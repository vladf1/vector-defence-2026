import type { Particle } from "../effects/particle";
import type { PathEntry } from "../../route-path";
import { AudioCue } from "../../types";
import { randomRange } from "../../utils";
import { createBurstParticle, createPolygonShardParticles } from "./death-effect-helpers";
import { Monster, type MonsterDeathEffect } from "./monster";
import { createPolygonShardSplitterConfig } from "./polygon-shard-splitter";

const COLOR = "#ff8bd5";
const SPEED_PER_SECOND = 73;
const HIT_POINTS = 253;
const BOUNTY = 3;
const RADIUS = 8.5;

export class SplitterMonster extends Monster {
  constructor(path: PathEntry[], speedScale: number) {
    super(path, COLOR, SPEED_PER_SECOND * speedScale, HIT_POINTS, BOUNTY, RADIUS);
  }

  protected updateSpecial(deltaSeconds: number): void {
    this.rotation += 2.7 * deltaSeconds;
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.rotation);
    context.beginPath();
    const outline = this.createOutline();
    for (let index = 0; index < outline.length; index += 1) {
      const { x, y } = outline[index];
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.closePath();
    context.fill();
    context.stroke();
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
      this.createOutline(),
      pivot,
      this.rotation,
      110,
      185,
      0,
      createPolygonShardSplitterConfig({
        minShardCount: 4,
        maxShardCount: 9,
      }),
    );

    for (let index = 0; index < 7; index += 1) {
      particles.push(
        createBurstParticle(
          this.x,
          this.y,
          index % 2 === 0 ? "#ffd9f2" : "#ffffff",
          randomRange(0.9, 1.9),
          randomRange(3, 4.1),
          randomRange(-Math.PI, Math.PI),
          randomRange(95, 175),
        ),
      );
    }

    return {
      sound: { cue: AudioCue.MonsterPop, intensity: 1.1 },
      particles,
    };
  }

  private createOutline() {
    return Array.from({ length: 6 }, (_, index) => {
      const angle = (Math.PI / 3) * index;
      const radius = index % 2 === 0 ? this.radius * 1.15 : this.radius * 0.72;
      return {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      };
    });
  }
}
