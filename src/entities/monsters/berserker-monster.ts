import { AudioCue } from "../../audio-manifest";
import type { UpdateContext, UpdateResult } from "../../game-engine/update-context";
import type { PathEntry } from "../../route-path";
import type { Point } from "../../types";
import { drawPath, hexWithAlpha, randomRange } from "../../utils";
import { createPolygonShardParticles } from "./death-effect-helpers";
import { Monster } from "./monster";
import { createPolygonShardSplitterConfig, PolygonShardSplitter } from "./polygon-shard-splitter";

const BASE_COLOR = "#ff7a4f";
const ENRAGED_COLOR = "#ff5a36";
const FRENZIED_COLOR = "#ff3158";
const BASE_SPEED_PER_SECOND = 62;
const ENRAGED_SPEED_PER_SECOND = 100;
const FRENZIED_SPEED_PER_SECOND = 138;
const HIT_POINTS = 343;
const BOUNTY = 4;
const RADIUS = 8;
const RAGE_ANIMATION_DURATION_SECONDS = 1.05;
const BODY_SURGE_MIN_SCALE = 0.015;
const BODY_SURGE_MAX_SCALE = 0.085;
const EMBER_STREAK_COUNT = 3;
const EMBER_STREAK_LENGTH = RADIUS * 1.6;
const EMBER_STREAK_SPACING = RADIUS * 0.38;
const EMBER_STREAK_START_X = -RADIUS * 1.05;
const EMBER_STREAK_COLOR = "#ffba4f";
const EMBER_WIGGLE_SPEED = 9.5;
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
const SHARD_SPLITTER = new PolygonShardSplitter(createPolygonShardSplitterConfig({
  minShardCount: 5,
  maxShardCount: 11,
}));

export class BerserkerMonster extends Monster {
  private rageStage = 0;
  private rageAnimationElapsedSeconds = randomRange(0, RAGE_ANIMATION_DURATION_SECONDS);
  private readonly emberPhaseOffset = randomRange(0, Math.PI * 2);
  private readonly emberTempoScale = randomRange(0.82, 1.22);
  private readonly emberStreaks = Array.from({ length: EMBER_STREAK_COUNT }, () => ({
    phaseOffset: randomRange(0, Math.PI * 2),
    lengthScale: randomRange(0.98, 1.28),
    yOffset: randomRange(-RADIUS * 0.14, RADIUS * 0.14),
    wiggleScale: randomRange(0.68, 1.36),
  }));

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

    this.rageAnimationElapsedSeconds += context.deltaSeconds;
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
    const motion = this.getRageMotion();
    context.rotate(this.angle);
    context.scale(motion.scaleX, motion.scaleY);
    this.drawEmberStreaks(context, motion);
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
    const motion = this.getRageMotion();
    createPolygonShardParticles(
      result,
      this.x,
      this.y,
      this.color,
      this.createAnimatedOutline(motion),
      transformPoint(pivot, motion),
      this.angle,
      140,
      230,
      0,
      SHARD_SPLITTER,
    );
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

  private getRageMotion(): RageMotion {
    const stageIntensity = this.rageStage === 2 ? 1 : (this.rageStage === 1 ? 0.68 : 0.36);
    const cycle = this.rageAnimationElapsedSeconds / RAGE_ANIMATION_DURATION_SECONDS;
    const surge = (1 - Math.cos(cycle * Math.PI * 2)) / 2;
    const scaleAmount = BODY_SURGE_MIN_SCALE + ((BODY_SURGE_MAX_SCALE - BODY_SURGE_MIN_SCALE) * stageIntensity);

    return {
      scaleX: 1 + (surge * scaleAmount),
      scaleY: 1 - (surge * scaleAmount * 0.45),
      emberAlpha: 0.24 + (stageIntensity * 0.42),
    };
  }

  private drawEmberStreaks(context: CanvasRenderingContext2D, motion: RageMotion): void {
    if (motion.emberAlpha <= 0) {
      return;
    }

    context.save();
    context.lineCap = "round";
    context.lineWidth = 1.2;

    for (let index = 0; index < EMBER_STREAK_COUNT; index += 1) {
      const emberStreak = this.emberStreaks[index];
      const offsetY = (index - 1) * EMBER_STREAK_SPACING + emberStreak.yOffset;
      const phase = this.emberPhaseOffset + emberStreak.phaseOffset + (this.rageAnimationElapsedSeconds * EMBER_WIGGLE_SPEED * this.emberTempoScale);
      const emberShift = Math.sin(phase) * this.radius * 0.22 * emberStreak.wiggleScale;
      const emberLength = EMBER_STREAK_LENGTH * emberStreak.lengthScale;
      const emberEndY = offsetY + (Math.sin(phase * 1.3 + emberStreak.phaseOffset) * this.radius * 0.16 * emberStreak.wiggleScale);
      const alpha = motion.emberAlpha * (1 - (index * 0.18));
      context.strokeStyle = hexWithAlpha(EMBER_STREAK_COLOR, alpha);

      context.beginPath();
      context.moveTo(EMBER_STREAK_START_X - emberShift, offsetY);
      context.lineTo(EMBER_STREAK_START_X - emberLength - emberShift, emberEndY);
      context.stroke();
    }

    context.restore();
  }

  private createAnimatedOutline(motion: RageMotion): Point[] {
    return OUTLINE.map((point) => transformPoint(point, motion));
  }

}

interface RageMotion {
  scaleX: number;
  scaleY: number;
  emberAlpha: number;
}

function transformPoint(point: Point, motion: RageMotion): Point {
  return {
    x: point.x * motion.scaleX,
    y: point.y * motion.scaleY,
  };
}
