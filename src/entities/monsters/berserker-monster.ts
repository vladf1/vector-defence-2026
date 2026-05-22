import type { UpdateContext, UpdateResult } from "../../game-engine/update-context";
import type { PathEntry } from "../../route-path";
import { AudioCue } from "../../types";
import { drawPath, randomRange } from "../../utils";
import { createPolygonShardParticles } from "./death-effect-helpers";
import { Monster } from "./monster";
import { createPolygonShardSplitterConfig } from "./polygon-shard-splitter";

const BASE_COLOR = "#ff7a4f";
const ENRAGED_COLOR = "#ff5a36";
const FRENZIED_COLOR = "#ff3158";
const BASE_SPEED_PER_SECOND = 62;
const ENRAGED_SPEED_PER_SECOND = 100;
const FRENZIED_SPEED_PER_SECOND = 138;
const HIT_POINTS = 286;
const BOUNTY = 4;
const RADIUS = 8;
const OUTLINE = [
  { x: RADIUS * 1.55, y: 0 },
  { x: RADIUS * 0.4, y: -RADIUS * 0.8 },
  { x: -RADIUS * 0.1, y: -RADIUS * 1.08 },
  { x: -RADIUS * 1.28, y: -RADIUS * 0.44 },
  { x: -RADIUS * 0.72, y: 0 },
  { x: -RADIUS * 1.28, y: RADIUS * 0.44 },
  { x: -RADIUS * 0.1, y: RADIUS * 1.08 },
  { x: RADIUS * 0.4, y: RADIUS * 0.8 },
];
const SHARD_SPLITTER_CONFIG = createPolygonShardSplitterConfig({
  minShardCount: 5,
  maxShardCount: 11,
});

export class BerserkerMonster extends Monster {
  private rageStage = 0;

  constructor(path: PathEntry[], private readonly speedScale: number) {
    super(path, BASE_COLOR, BASE_SPEED_PER_SECOND * speedScale, HIT_POINTS, BOUNTY, RADIUS);
  }

  protected override updateSpecial(context: UpdateContext): void {
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
        this.speedPerSecond + ((50.4 + (this.rageStage * 43.2)) * this.speedScale * context.deltaSeconds),
      );
    } else if (this.speedPerSecond > this.maxSpeedPerSecond) {
      this.speedPerSecond = this.maxSpeedPerSecond;
    }

    this.velocityXPerSecond = Math.cos(this.angle) * this.speedPerSecond;
    this.velocityYPerSecond = Math.sin(this.angle) * this.speedPerSecond;
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.angle);
    drawPath(context, OUTLINE, true);

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

  override addDeathEffect(result: UpdateResult): void {
    const pivot = {
      x: randomRange(-this.radius * 0.15, this.radius * 0.22),
      y: randomRange(-this.radius * 0.15, this.radius * 0.15),
    };
    for (const particle of createPolygonShardParticles(
      this.x,
      this.y,
      this.color,
      OUTLINE,
      pivot,
      this.angle,
      140,
      230,
      0,
      SHARD_SPLITTER_CONFIG,
    )) {
      result.addParticle(particle);
    }
    result.playSound(AudioCue.MonsterHeavyDeath, this.x, 1.05);
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

}
