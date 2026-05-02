import { GlassShardParticle } from "../effects/glass-shard-particle";
import type { PathEntry } from "../../route-path";
import { AudioCue } from "../../types";
import { hexWithAlpha, randomRange } from "../../utils";
import {
  buildShards,
  createBurstParticle,
  createSimpleExplosionParticles,
} from "./death-effect-helpers";
import { Monster, type MonsterDeathEffect } from "./monster";

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

  constructor(path: PathEntry[]) {
    super(path, COLOR, SPEED_PER_SECOND, HIT_POINTS, BOUNTY, RADIUS);
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
    const halfHeight = this.radius * 0.8;

    context.beginPath();
    const shellOutline = this.createShellOutline();
    context.moveTo(shellOutline[0].x, shellOutline[0].y);
    for (let index = 1; index < shellOutline.length; index += 1) {
      context.lineTo(shellOutline[index].x, shellOutline[index].y);
    }
    context.closePath();
    context.fill();
    context.stroke();

    context.save();
    context.strokeStyle = hexWithAlpha(ARMOR_GLOW_COLOR, glow);
    context.lineWidth = 1.2;
    context.beginPath();
    const coreOutline = this.createCoreOutline();
    context.moveTo(coreOutline[0].x, coreOutline[0].y);
    for (let index = 1; index < coreOutline.length; index += 1) {
      context.lineTo(coreOutline[index].x, coreOutline[index].y);
    }
    context.closePath();
    context.stroke();

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
    const particles: MonsterDeathEffect["particles"] = buildShards(
      this.createShellOutline(),
      shellPivot,
      Math.round(randomRange(6, 10)),
    ).map(
      (shardVertices) =>
        new GlassShardParticle(
          this.x,
          this.y,
          ARMOR_GLOW_COLOR,
          shardVertices,
          this.angle,
          randomRange(120, 205),
        ),
    );

    const corePivot = {
      x: randomRange(-this.radius * 0.08, this.radius * 0.08),
      y: randomRange(-this.radius * 0.08, this.radius * 0.08),
    };
    for (const shardVertices of buildShards(
      this.createCoreOutline(),
      corePivot,
      4,
    )) {
      particles.push(
        new GlassShardParticle(
          this.x,
          this.y,
          this.color,
          shardVertices,
          this.angle,
          randomRange(105, 175),
        ),
      );
    }

    for (let index = 0; index < 10; index += 1) {
      particles.push(
        createBurstParticle(
          this.x,
          this.y,
          index % 2 === 0 ? ARMOR_GLOW_COLOR : "#9bf4ff",
          randomRange(1.1, 2.1),
          randomRange(2.7, 4),
          (Math.PI * 2 * index) / 10 + randomRange(-0.08, 0.08),
          randomRange(110, 185),
        ),
      );
    }
    particles.push(
      ...createSimpleExplosionParticles(
        this.x,
        this.y,
        5,
        randomRange(1.2, 2.2),
        "#ffffff",
        randomRange(3.2, 4.4),
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
}
