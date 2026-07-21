import { AudioCue } from "../../audio-manifest";
import type { UpdateContext, UpdateResult } from "../../game-engine/update-context";
import type { PathEntry } from "../../route-path";
import type { Point } from "../../types";
import { easeInOutCubic, randomRange } from "../../utils";
import { createPolygonShardParticles, rotatePoint } from "./death-effect-helpers";
import { Monster } from "./monster";
import { createPolygonShardSplitterConfig, PolygonShardSplitter } from "./polygon-shard-splitter";
import { drawTankTurret, getTankTurretCenterOffsetX, TankTrackPrintParticle, TankTurretParticle } from "./tank-effects";

const COLOR = "#9fb6ff";
const SPEED_PER_SECOND = 41;
const HIT_POINTS = 554;
const BOUNTY = 6;
const RADIUS = 10.5;
const HULL_RECT = {
  x: -RADIUS,
  y: -RADIUS * 0.72,
  width: RADIUS * 2.1,
  height: RADIUS * 1.44,
};
const HULL_OUTLINE = [
  { x: HULL_RECT.x, y: HULL_RECT.y },
  { x: HULL_RECT.x + HULL_RECT.width, y: HULL_RECT.y },
  { x: HULL_RECT.x + HULL_RECT.width, y: HULL_RECT.y + HULL_RECT.height },
  { x: HULL_RECT.x, y: HULL_RECT.y + HULL_RECT.height },
];
const SHARD_SPLITTER = new PolygonShardSplitter(createPolygonShardSplitterConfig({
  minShardCount: 6,
  maxShardCount: 13,
}));
const TURRET_SPIN_INTERVAL_MIN_SECONDS = 3;
const TURRET_SPIN_INTERVAL_MAX_SECONDS = 10;
const TURRET_SPIN_DURATION_SECONDS = 2.2;
const FULL_ROTATION = Math.PI * 2;
const TRACK_PRINT_INTERVAL = RADIUS * 0.44;
const TRACK_PRINT_SIDE_OFFSET = RADIUS * 0.62;
const TRACK_PRINT_LENGTH = RADIUS * 0.24;
const TRACK_PRINT_WIDTH = RADIUS * 0.14;

export class TankMonster extends Monster {
  private turretRotation = 0;
  private turretSpinElapsedSeconds = 0;
  private turretSpinDirection = 1;
  private secondsUntilTurretSpin = randomRange(TURRET_SPIN_INTERVAL_MIN_SECONDS, TURRET_SPIN_INTERVAL_MAX_SECONDS);
  private lastLeftTrackPrint?: Point;
  private lastRightTrackPrint?: Point;

  constructor(path: PathEntry[], speedScale: number) {
    super(path, COLOR, SPEED_PER_SECOND * speedScale, HIT_POINTS, BOUNTY, RADIUS);
  }

  override update(context: UpdateContext, result: UpdateResult): void {
    super.update(context, result);
    if (!this.removed) {
      this.addTrackPrints(result);
    }
  }

  protected override updateSpecial(context: UpdateContext): void {
    if (this.turretSpinElapsedSeconds > 0) {
      this.advanceTurretSpin(context.deltaSeconds);
      return;
    }

    this.secondsUntilTurretSpin -= context.deltaSeconds;
    if (this.secondsUntilTurretSpin <= 0) {
      this.turretSpinDirection = randomRange(0, 1) < 0.5 ? -1 : 1;
      this.advanceTurretSpin(context.deltaSeconds);
    }
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.angle);
    context.fillRect(HULL_RECT.x, HULL_RECT.y, HULL_RECT.width, HULL_RECT.height);
    context.strokeRect(HULL_RECT.x, HULL_RECT.y, HULL_RECT.width, HULL_RECT.height);
    context.translate(getTankTurretCenterOffsetX(this.radius), 0);
    drawTankTurret(context, this.radius, 0.42, 1.52, this.turretRotation);
  }

  override addDeathEffect(result: UpdateResult): void {
    const hullPivot = {
      x: randomRange(-this.radius * 0.15, this.radius * 0.35),
      y: randomRange(-this.radius * 0.22, this.radius * 0.22),
    };
    const turretCenterOffset = rotatePoint(
      { x: getTankTurretCenterOffsetX(this.radius), y: 0 },
      this.angle,
    );
    createPolygonShardParticles(
      result,
      this.x,
      this.y,
      this.color,
      HULL_OUTLINE,
      hullPivot,
      this.angle,
      125,
      220,
      0,
      SHARD_SPLITTER,
    );
    result.addParticle(new TankTurretParticle(
      this.x + turretCenterOffset.x,
      this.y + turretCenterOffset.y,
      this.radius,
      this.color,
      this.angle,
      this.turretRotation,
    ));
    result.playSound(AudioCue.MonsterHeavyDeath, this.x, 1.25);
  }

  private advanceTurretSpin(deltaSeconds: number): void {
    this.turretSpinElapsedSeconds += deltaSeconds;
    const progress = Math.min(1, this.turretSpinElapsedSeconds / TURRET_SPIN_DURATION_SECONDS);
    this.turretRotation = this.turretSpinDirection * FULL_ROTATION * easeInOutCubic(progress);

    if (progress === 1) {
      this.turretRotation = 0;
      this.turretSpinElapsedSeconds = 0;
      this.secondsUntilTurretSpin = randomRange(TURRET_SPIN_INTERVAL_MIN_SECONDS, TURRET_SPIN_INTERVAL_MAX_SECONDS);
    }
  }

  private addTrackPrints(result: UpdateResult): void {
    const forwardX = this.velocityXPerSecond / this.speedPerSecond;
    const forwardY = this.velocityYPerSecond / this.speedPerSecond;
    const sideX = -forwardY;
    const sideY = forwardX;
    const baseX = this.x;
    const baseY = this.y;
    const leftTrackPrint = { x: baseX - (sideX * TRACK_PRINT_SIDE_OFFSET), y: baseY - (sideY * TRACK_PRINT_SIDE_OFFSET) };
    const rightTrackPrint = { x: baseX + (sideX * TRACK_PRINT_SIDE_OFFSET), y: baseY + (sideY * TRACK_PRINT_SIDE_OFFSET) };

    this.lastLeftTrackPrint = this.addTrackPrintIfReady(result, leftTrackPrint, this.lastLeftTrackPrint);
    this.lastRightTrackPrint = this.addTrackPrintIfReady(result, rightTrackPrint, this.lastRightTrackPrint);
  }

  private addTrackPrintIfReady(result: UpdateResult, point: Point, lastPoint?: Point): Point {
    if (!lastPoint || Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) >= TRACK_PRINT_INTERVAL) {
      this.addTrackPrint(result, point.x, point.y);
      return point;
    }
    return lastPoint;
  }

  private addTrackPrint(result: UpdateResult, x: number, y: number): void {
    result.addParticle(new TankTrackPrintParticle(x, y, this.angle, TRACK_PRINT_LENGTH, TRACK_PRINT_WIDTH));
  }
}
