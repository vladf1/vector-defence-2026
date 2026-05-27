import type { UpdateContext, UpdateResult } from "../../game-engine/update-context";
import type { PathEntry } from "../../route-path";
import { AudioCue, type Point } from "../../types";
import { easeInOutSine, randomRange } from "../../utils";
import {
  createPolygonShardParticles,
  pointOnRadius,
} from "./death-effect-helpers";
import { Monster } from "./monster";
import { createPolygonShardSplitterConfig, PolygonShardSplitter } from "./polygon-shard-splitter";

const COLOR = "#5df2ef";
const SPEED_PER_SECOND = 81;
const HIT_POINTS = 220;
const BOUNTY = 2;
const RADIUS = 7.5;
const PACKMAN_MOUTH_OPEN_ANGLE = Math.PI * 0.18;
const PACKMAN_MOUTH_CLOSED_ANGLE = Math.PI * 0.035;
const MOUTH_ANIMATION_INTERVAL_MIN_SECONDS = 2;
const MOUTH_ANIMATION_INTERVAL_MAX_SECONDS = 5;
const PACKMAN_MOUTH_ANIMATION_DURATION_SECONDS = 0.5;
const SHARD_SPLITTER = new PolygonShardSplitter(createPolygonShardSplitterConfig({
  minShardCount: 5,
  maxShardCount: 11,
  preferredMaxShardVertices: 14,
  maxShardVertices: 26,
}));

export class PackManMonster extends Monster {
  private mouthAngle = PACKMAN_MOUTH_OPEN_ANGLE;
  private mouthAnimationElapsedSeconds = 0;
  private secondsUntilMouthAnimation = randomRange(
    MOUTH_ANIMATION_INTERVAL_MIN_SECONDS,
    MOUTH_ANIMATION_INTERVAL_MAX_SECONDS,
  );

  constructor(path: PathEntry[], speedScale: number) {
    super(path, COLOR, SPEED_PER_SECOND * speedScale, HIT_POINTS, BOUNTY, RADIUS);
  }

  protected override updateSpecial(context: UpdateContext): void {
    if (this.mouthAnimationElapsedSeconds > 0) {
      this.advanceMouthAnimation(context.deltaSeconds);
      return;
    }

    this.secondsUntilMouthAnimation -= context.deltaSeconds;
    if (this.secondsUntilMouthAnimation <= 0) {
      this.advanceMouthAnimation(context.deltaSeconds);
    }
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.angle);
    drawPackManBody(context, this.radius, this.mouthAngle);
  }

  createOutline(arcVertexCount: number): Point[] {
    return createPackManOutline(this.radius, this.mouthAngle, arcVertexCount);
  }

  override addDeathEffect(result: UpdateResult): void {
    const pivot = {
      x: randomRange(-this.radius * 0.12, this.radius * 0.12),
      y: randomRange(-this.radius * 0.12, this.radius * 0.12),
    };
    createPolygonShardParticles(
      result,
      this.x,
      this.y,
      this.color,
      this.createOutline(18),
      pivot,
      this.angle,
      125,
      205,
      0,
      SHARD_SPLITTER,
    );
    result.playSound(AudioCue.MonsterShatter, this.x);
  }

  private advanceMouthAnimation(deltaSeconds: number): void {
    this.mouthAnimationElapsedSeconds += deltaSeconds;
    const progress = Math.min(1, this.mouthAnimationElapsedSeconds / PACKMAN_MOUTH_ANIMATION_DURATION_SECONDS);
    this.mouthAngle = getPackManMouthAngle(progress);

    if (progress === 1) {
      this.mouthAngle = PACKMAN_MOUTH_OPEN_ANGLE;
      this.mouthAnimationElapsedSeconds = 0;
      this.secondsUntilMouthAnimation = randomRange(
        MOUTH_ANIMATION_INTERVAL_MIN_SECONDS,
        MOUTH_ANIMATION_INTERVAL_MAX_SECONDS,
      );
    }
  }
}

function getPackManMouthAngle(animationProgress: number): number {
  const clampedProgress = Math.max(0, Math.min(1, animationProgress));
  const mirroredProgress = clampedProgress <= 0.5
    ? clampedProgress * 2
    : (1 - clampedProgress) * 2;
  const closeThenOpen = easeInOutSine(mirroredProgress);
  return PACKMAN_MOUTH_OPEN_ANGLE - ((PACKMAN_MOUTH_OPEN_ANGLE - PACKMAN_MOUTH_CLOSED_ANGLE) * closeThenOpen);
}

function drawPackManBody(
  context: CanvasRenderingContext2D,
  radius: number,
  mouthAngle: number,
): void {
  const mouthTopX = Math.cos(mouthAngle) * radius;
  const mouthTopY = Math.sin(mouthAngle) * radius;

  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(mouthTopX, mouthTopY);
  context.arc(0, 0, radius, mouthAngle, (Math.PI * 2) - mouthAngle);
  context.closePath();
  context.fill();

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(0, 0);
  context.lineTo(mouthTopX, mouthTopY);
  context.arc(0, 0, radius, mouthAngle, (Math.PI * 2) - mouthAngle);
  context.lineTo(0, 0);
  context.stroke();
  context.restore();

  context.beginPath();
  context.arc(radius * 0.12, -radius * 0.5, radius * 0.16, 0, Math.PI * 2);
  context.fill();
}

function createPackManOutline(
  radius: number,
  mouthAngle: number,
  arcVertexCount: number,
): Point[] {
  const bodySweepAngle = (Math.PI * 2) - (mouthAngle * 2);
  const vertexCount = Math.max(2, Math.floor(arcVertexCount));
  const outline = [{ x: 0, y: 0 }];

  for (let index = 0; index < vertexCount; index += 1) {
    const ratio = vertexCount === 1 ? 0 : index / (vertexCount - 1);
    const angle = mouthAngle + (bodySweepAngle * ratio);
    outline.push(pointOnRadius(angle, radius));
  }

  return outline;
}
