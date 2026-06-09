import type { UpdateContext, UpdateResult } from "../../game-engine/update-context";
import type { PathEntry } from "../../route-path";
import { AudioCue, type Point } from "../../types";
import { drawPath, easeInOutSine, hexWithAlpha, randomRange } from "../../utils";
import { createPolygonShardParticles } from "./death-effect-helpers";
import { Monster } from "./monster";
import { createPolygonShardSplitterConfig, PolygonShardSplitter } from "./polygon-shard-splitter";

const COLOR = "#91ff63";
const SPEED_PER_SECOND = 132;
const HIT_POINTS = 100;
const BOUNTY = 2;
const RADIUS = 5.5;
const TRAIL_TICK_SPACING = RADIUS * 0.72;
const TRAIL_TICK_LENGTH = RADIUS * 0.74;
const TRAIL_TICK_STEP = RADIUS * 0.42;
const TRAIL_TICK_COUNT = 2;
const TRAIL_CRAWL_DISTANCE_SCALE = 0.82;
const DASH_PULSE_INTERVAL_MIN_SECONDS = 1.5;
const DASH_PULSE_INTERVAL_MAX_SECONDS = 5;
const DASH_PULSE_DURATION_SECONDS = 1;
const DASH_SPEED_MULTIPLIER = 1.15;
const DASH_PULSE_FRONT_STRETCH = RADIUS * 1.15;
const DASH_PULSE_TAIL_TUCK = RADIUS * 0.72;
const OUTLINE = [
  { x: RADIUS * 1.8, y: 0 },
  { x: RADIUS * 0.28, y: -RADIUS * 0.86 },
  { x: -RADIUS * 1.35, y: -RADIUS * 0.58 },
  { x: -RADIUS * 0.92, y: 0 },
  { x: -RADIUS * 1.35, y: RADIUS * 0.58 },
  { x: RADIUS * 0.28, y: RADIUS * 0.86 },
];
const SHARD_SPLITTER = new PolygonShardSplitter(createPolygonShardSplitterConfig({
  minShardCount: 3,
  maxShardCount: 6,
}));

export class RunnerMonster extends Monster {
  private readonly baseSpeedPerSecond: number;
  private dashPulseElapsedSeconds = 0;
  private dashSpeedActive = false;
  private secondsUntilDashPulse = randomRange(DASH_PULSE_INTERVAL_MIN_SECONDS, DASH_PULSE_INTERVAL_MAX_SECONDS);

  constructor(path: PathEntry[], speedScale: number) {
    const baseSpeedPerSecond = SPEED_PER_SECOND * speedScale;
    super(path, COLOR, baseSpeedPerSecond, HIT_POINTS, BOUNTY, RADIUS);
    this.baseSpeedPerSecond = baseSpeedPerSecond;
  }

  protected override updateSpecial(context: UpdateContext): void {
    if (this.dashPulseElapsedSeconds > 0) {
      this.advanceDashPulse(context.deltaSeconds);
      return;
    }

    this.secondsUntilDashPulse -= context.deltaSeconds;
    if (this.secondsUntilDashPulse <= 0) {
      this.advanceDashPulse(context.deltaSeconds);
    }
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    const dashPulse = this.getDashPulse();
    context.rotate(this.angle);
    drawRunnerSpeedTrail(context, this.color, this.distanceAlongPath, dashPulse);
    drawPath(context, createRunnerOutline(dashPulse), true);
  }

  override addDeathEffect(result: UpdateResult): void {
    const pivot = {
      x: randomRange(-this.radius * 0.35, this.radius * 0.3),
      y: randomRange(-this.radius * 0.16, this.radius * 0.16),
    };
    createPolygonShardParticles(
      result,
      this.x,
      this.y,
      this.color,
      createRunnerOutline(this.getDashPulse()),
      pivot,
      this.angle,
      155,
      255,
      0,
      SHARD_SPLITTER,
    );
    result.playSound(AudioCue.MonsterPop, this.x, 0.85);
  }

  private advanceDashPulse(deltaSeconds: number): void {
    if (this.dashPulseElapsedSeconds === 0) {
      this.startDashSpeedBoost();
    }

    this.dashPulseElapsedSeconds += deltaSeconds;
    const progress = Math.min(1, this.dashPulseElapsedSeconds / DASH_PULSE_DURATION_SECONDS);

    if (progress === 1) {
      this.dashPulseElapsedSeconds = 0;
      this.stopDashSpeedBoost();
      this.secondsUntilDashPulse = randomRange(DASH_PULSE_INTERVAL_MIN_SECONDS, DASH_PULSE_INTERVAL_MAX_SECONDS);
    }
  }

  private getDashPulse(): number {
    if (this.dashPulseElapsedSeconds <= 0) {
      return 0;
    }

    const progress = Math.min(1, this.dashPulseElapsedSeconds / DASH_PULSE_DURATION_SECONDS);
    const mirroredProgress = progress <= 0.5 ? progress * 2 : (1 - progress) * 2;
    return easeInOutSine(mirroredProgress);
  }

  private startDashSpeedBoost(): void {
    if (this.dashSpeedActive) {
      return;
    }

    this.dashSpeedActive = true;
    this.maxSpeedPerSecond = this.baseSpeedPerSecond * DASH_SPEED_MULTIPLIER;
    this.speedPerSecond *= DASH_SPEED_MULTIPLIER;
    this.velocityXPerSecond = Math.cos(this.angle) * this.speedPerSecond;
    this.velocityYPerSecond = Math.sin(this.angle) * this.speedPerSecond;
  }

  private stopDashSpeedBoost(): void {
    if (!this.dashSpeedActive) {
      return;
    }

    this.dashSpeedActive = false;
    this.maxSpeedPerSecond = this.baseSpeedPerSecond;
    this.speedPerSecond = Math.min(this.baseSpeedPerSecond, this.speedPerSecond / DASH_SPEED_MULTIPLIER);
    this.velocityXPerSecond = Math.cos(this.angle) * this.speedPerSecond;
    this.velocityYPerSecond = Math.sin(this.angle) * this.speedPerSecond;
  }
}

function drawRunnerSpeedTrail(
  context: CanvasRenderingContext2D,
  color: string,
  distanceAlongPath: number,
  dashPulse: number,
): void {
  const offset = (distanceAlongPath * TRAIL_CRAWL_DISTANCE_SCALE) % TRAIL_TICK_SPACING;
  const tickCount = TRAIL_TICK_COUNT + (dashPulse > 0 ? 1 : 0);
  context.save();
  context.lineCap = "round";
  context.lineWidth = 1.1 + (dashPulse * 1.1);

  for (let index = 0; index < tickCount; index += 1) {
    const tickX = -RADIUS * 1.25 - offset - (index * TRAIL_TICK_SPACING);
    const tickAlpha = (0.44 + (dashPulse * 0.58)) - (index * 0.12);
    context.strokeStyle = hexWithAlpha(color, tickAlpha);
    const tickLength = TRAIL_TICK_LENGTH * (1 + (dashPulse * 1.45));

    context.beginPath();
    context.moveTo(tickX - tickLength, -TRAIL_TICK_STEP);
    context.lineTo(tickX, -TRAIL_TICK_STEP);
    context.moveTo(tickX - tickLength, TRAIL_TICK_STEP);
    context.lineTo(tickX, TRAIL_TICK_STEP);
    context.stroke();
  }

  context.restore();
}

function createRunnerOutline(dashPulse: number): Point[] {
  return [
    { x: OUTLINE[0].x + (DASH_PULSE_FRONT_STRETCH * dashPulse), y: OUTLINE[0].y },
    { x: OUTLINE[1].x, y: OUTLINE[1].y },
    { x: OUTLINE[2].x + (DASH_PULSE_TAIL_TUCK * dashPulse), y: OUTLINE[2].y * (1 - (dashPulse * 0.28)) },
    { x: OUTLINE[3].x + (DASH_PULSE_TAIL_TUCK * dashPulse), y: OUTLINE[3].y },
    { x: OUTLINE[4].x + (DASH_PULSE_TAIL_TUCK * dashPulse), y: OUTLINE[4].y * (1 - (dashPulse * 0.28)) },
    { x: OUTLINE[5].x, y: OUTLINE[5].y },
  ];
}
