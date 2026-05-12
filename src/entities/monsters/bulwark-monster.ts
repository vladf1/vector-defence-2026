import { GlassShardParticle } from "../effects/glass-shard-particle";
import type { Particle } from "../effects/particle";
import type { PathEntry } from "../../route-path";
import { AudioCue } from "../../types";
import { drawPath, hexWithAlpha, randomRange } from "../../utils";
import { createPolygonShardParticles } from "./death-effect-helpers";
import { Monster, type MonsterDeathEffect } from "./monster";
import { createPolygonShardSplitterConfig } from "./polygon-shard-splitter";

const COLOR = "#78d7ff";
const ARMOR_GLOW_COLOR = "#dff7ff";
const SPEED_PER_SECOND = 49;
const HIT_POINTS = 341;
const BOUNTY = 4;
const RADIUS = 9.5;
const ARMOR_PER_HIT = 3.5;
const MIN_CHIP_DAMAGE = 0.4;

export class BulwarkMonster extends Monster {
  private shieldPulse = 0;

  constructor(path: PathEntry[], speedScale: number) {
    super(path, COLOR, SPEED_PER_SECOND * speedScale, HIT_POINTS, BOUNTY, RADIUS);
  }

  override takeDamage(amount: number): void {
    if (amount <= 0) {
      return;
    }

    const mitigated = Math.max(MIN_CHIP_DAMAGE, amount - ARMOR_PER_HIT);
    super.takeDamage(mitigated);
  }

  protected updateSpecial(deltaSeconds: number): void {
    this.shieldPulse += 2.8 * deltaSeconds;
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.angle);

    const glow = 0.3 + (Math.sin(this.shieldPulse) * 0.12);

    const shellOutline = this.createShellOutline();
    drawPath(context, shellOutline, true);

    context.save();
    context.strokeStyle = hexWithAlpha(ARMOR_GLOW_COLOR, glow);
    context.lineWidth = 1.2;
    const coreOutline = this.createCoreOutline();
    drawPath(context, coreOutline, false);

    context.beginPath();
    context.moveTo(-this.radius * 0.22, -this.radius * 0.82);
    context.lineTo(this.radius * 0.48, -this.radius * 0.22);
    context.moveTo(-this.radius * 0.22, this.radius * 0.82);
    context.lineTo(this.radius * 0.48, this.radius * 0.22);
    context.stroke();
    context.restore();

    context.beginPath();
    context.moveTo(this.radius * 1.08, 0);
    context.lineTo(this.radius * 0.76, -this.radius * 0.28);
    context.lineTo(this.radius * 0.16, -this.radius * 0.28);
    context.lineTo(this.radius * 0.16, this.radius * 0.28);
    context.lineTo(this.radius * 0.76, this.radius * 0.28);
    context.closePath();
    context.stroke();

    context.beginPath();
    context.moveTo(-this.radius * 0.68, -this.radius * 0.52);
    context.lineTo(-this.radius * 0.98, -this.radius * 0.2);
    context.lineTo(-this.radius * 0.98, this.radius * 0.2);
    context.lineTo(-this.radius * 0.68, this.radius * 0.52);
    context.stroke();
  }

  override createDeathEffect(): MonsterDeathEffect {
    const shellPivot = {
      x: randomRange(-this.radius * 0.18, this.radius * 0.18),
      y: randomRange(-this.radius * 0.18, this.radius * 0.18),
    };
    const particles: Particle[] = createPolygonShardParticles(
      this.x,
      this.y,
      ARMOR_GLOW_COLOR,
      this.createShellOutline(),
      shellPivot,
      this.angle,
      120,
      205,
      0,
      createPolygonShardSplitterConfig({
        minShardCount: 5,
        maxShardCount: 11,
      }),
    );
    particles.push(
      new GlassShardParticle(
        this.x,
        this.y,
        this.color,
        this.createFrontPlateOutline(),
        { x: 0, y: 0 },
        this.angle,
        randomRange(105, 175),
        0,
      ),
    );

    return {
      sound: { cue: AudioCue.MonsterHeavyDeath, intensity: 1.05 },
      particles,
    };
  }

  private createShellOutline() {
    const halfHeight = this.radius * 0.8;
    return [
      { x: this.radius * 1.35, y: 0 },
      { x: this.radius * 0.82, y: -halfHeight },
      { x: -this.radius * 0.2, y: -this.radius * 0.98 },
      { x: -this.radius * 1.08, y: -halfHeight },
      { x: -this.radius * 1.32, y: 0 },
      { x: -this.radius * 1.08, y: halfHeight },
      { x: -this.radius * 0.2, y: this.radius * 0.98 },
      { x: this.radius * 0.82, y: halfHeight },
    ];
  }

  private createCoreOutline() {
    return [
      { x: this.radius * 0.98, y: 0 },
      { x: this.radius * 0.42, y: -this.radius * 0.46 },
      { x: -this.radius * 0.3, y: -this.radius * 0.46 },
      { x: -this.radius * 0.72, y: 0 },
      { x: -this.radius * 0.3, y: this.radius * 0.46 },
      { x: this.radius * 0.42, y: this.radius * 0.46 },
    ];
  }

  private createFrontPlateOutline() {
    return [
      { x: this.radius * 1.08, y: 0 },
      { x: this.radius * 0.76, y: -this.radius * 0.28 },
      { x: this.radius * 0.16, y: -this.radius * 0.28 },
      { x: this.radius * 0.16, y: this.radius * 0.28 },
      { x: this.radius * 0.76, y: this.radius * 0.28 },
    ];
  }
}
