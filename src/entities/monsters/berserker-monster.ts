import { GlassShardParticle } from "../effects/glass-shard-particle";
import type { Particle } from "../effects/particle";
import type { PathEntry } from "../../route-path";
import { AudioCue } from "../../types";
import { drawPath, randomRange } from "../../utils";
import { buildShards, createBurstParticle } from "./death-effect-helpers";
import { Monster, type MonsterDeathEffect } from "./monster";

const BASE_COLOR = "#ff7a4f";
const ENRAGED_COLOR = "#ff5a36";
const FRENZIED_COLOR = "#ff3158";
const BASE_SPEED_PER_SECOND = 62;
const ENRAGED_SPEED_PER_SECOND = 100;
const FRENZIED_SPEED_PER_SECOND = 138;
const HIT_POINTS = 286;
const BOUNTY = 4;
const RADIUS = 8;

export class BerserkerMonster extends Monster {
  private rageStage = 0;

  constructor(path: PathEntry[], private readonly speedScale: number) {
    super(path, BASE_COLOR, BASE_SPEED_PER_SECOND * speedScale, HIT_POINTS, BOUNTY, RADIUS);
  }

  protected updateSpecial(deltaSeconds: number): void {
    const nextStage = this.hitPoints <= this.maxHitPoints * 0.2
      ? 2
      : (this.hitPoints <= this.maxHitPoints * 0.5 ? 1 : 0);

    if (nextStage !== this.rageStage) {
      this.rageStage = nextStage;
      const burstFloor = this.getStageSpeedPerSecond() * (0.72 + (this.rageStage * 0.08));
      this.speedPerSecond = Math.max(this.speedPerSecond, burstFloor);
    }

    this.maxSpeedPerSecond = this.getStageSpeedPerSecond();
    this.color = this.getStageColor();

    if (this.speedPerSecond < this.maxSpeedPerSecond) {
      this.speedPerSecond = Math.min(
        this.maxSpeedPerSecond,
        this.speedPerSecond + ((50.4 + (this.rageStage * 43.2)) * this.speedScale * deltaSeconds),
      );
    } else if (this.speedPerSecond > this.maxSpeedPerSecond) {
      this.speedPerSecond = this.maxSpeedPerSecond;
    }

    this.velocityXPerSecond = Math.cos(this.angle) * this.speedPerSecond;
    this.velocityYPerSecond = Math.sin(this.angle) * this.speedPerSecond;
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.angle);
    const outline = this.createOutline();
    drawPath(context, outline, true);

    context.beginPath();
    context.moveTo(-this.radius * 0.3, -this.radius * 0.16);
    context.lineTo(this.radius * 0.68, -this.radius * 0.44);
    context.moveTo(-this.radius * 0.3, this.radius * 0.16);
    context.lineTo(this.radius * 0.68, this.radius * 0.44);
    context.stroke();

    if (this.rageStage > 0) {
      context.beginPath();
      context.moveTo(-this.radius * 0.92, -this.radius * 0.78);
      context.lineTo(-this.radius * 0.5, -this.radius * 0.18);
      context.lineTo(-this.radius * 1.02, 0);
      context.lineTo(-this.radius * 0.5, this.radius * 0.18);
      context.lineTo(-this.radius * 0.92, this.radius * 0.78);
      context.stroke();
    }
  }

  override createDeathEffect(): MonsterDeathEffect {
    const pivot = {
      x: randomRange(-this.radius * 0.15, this.radius * 0.22),
      y: randomRange(-this.radius * 0.15, this.radius * 0.15),
    };
    const particles: Particle[] = buildShards(
      this.createOutline(),
      pivot,
      Math.round(randomRange(6, 10)),
    ).map(
      (shardVertices) =>
        new GlassShardParticle(
          this.x,
          this.y,
          this.color,
          shardVertices,
          pivot,
          this.angle,
          randomRange(140, 230),
          0,
        ),
    );

    for (let index = 0; index < 8; index += 1) {
      particles.push(
        createBurstParticle(
          this.x,
          this.y,
          index % 3 === 0 ? "#ffd1a3" : this.color,
          randomRange(1.2, 2.6),
          randomRange(2.6, 3.7),
          this.angle + randomRange(-0.55, 0.55),
          randomRange(145, 260),
        ),
      );
    }

    for (let index = 0; index < 5; index += 1) {
      particles.push(
        createBurstParticle(
          this.x,
          this.y,
          "#ffffff",
          randomRange(0.8, 1.6),
          randomRange(3.6, 5),
          this.angle + randomRange(-0.18, 0.18),
          randomRange(190, 295),
        ),
      );
    }

    return {
      sound: { cue: AudioCue.MonsterHeavyDeath, intensity: 1.05 },
      particles,
    };
  }

  private getStageColor(): string {
    if (this.rageStage === 2) {
      return FRENZIED_COLOR;
    }
    if (this.rageStage === 1) {
      return ENRAGED_COLOR;
    }
    return BASE_COLOR;
  }

  private getStageSpeedPerSecond(): number {
    if (this.rageStage === 2) {
      return FRENZIED_SPEED_PER_SECOND * this.speedScale;
    }
    if (this.rageStage === 1) {
      return ENRAGED_SPEED_PER_SECOND * this.speedScale;
    }
    return BASE_SPEED_PER_SECOND * this.speedScale;
  }

  private createOutline() {
    return [
      { x: this.radius * 1.55, y: 0 },
      { x: this.radius * 0.4, y: -this.radius * 0.8 },
      { x: -this.radius * 0.1, y: -this.radius * 1.08 },
      { x: -this.radius * 1.28, y: -this.radius * 0.44 },
      { x: -this.radius * 0.72, y: 0 },
      { x: -this.radius * 1.28, y: this.radius * 0.44 },
      { x: -this.radius * 0.1, y: this.radius * 1.08 },
      { x: this.radius * 0.4, y: this.radius * 0.8 },
    ];
  }
}
