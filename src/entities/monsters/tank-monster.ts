import { TankTurretParticle } from "../effects/tank-turret-particle";
import type { UpdateContext, UpdateResult } from "../../game-engine/update-context";
import type { PathEntry } from "../../route-path";
import { AudioCue } from "../../types";
import { easeInOutCubic, hexWithAlpha, randomRange } from "../../utils";
import { createPolygonShardParticles, rotatePoint } from "./death-effect-helpers";
import { Monster } from "./monster";
import { createPolygonShardSplitterConfig, PolygonShardSplitter } from "./polygon-shard-splitter";
import { drawTankTurret, getTankTurretCenterOffsetX } from "./tank-turret-rendering";

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
const TREAD_MARK_SPACING = RADIUS * 0.26;
const TREAD_MARK_LENGTH = RADIUS * 0.22;
const TREAD_MARK_OUTER_INSET = RADIUS * 0.14;
const TREAD_TRAVEL_INSET = RADIUS * 0.08;
const TREAD_TRACK_LEFT = HULL_RECT.x + TREAD_TRAVEL_INSET;
const TREAD_TRACK_WIDTH = HULL_RECT.width - (TREAD_TRAVEL_INSET * 2);
const TREAD_MARK_COLOR = "#d8e2ff";
const TREAD_CRAWL_DISTANCE_SCALE = 0.28;
const TREAD_MARK_COUNT = Math.ceil(TREAD_TRACK_WIDTH / TREAD_MARK_SPACING);
const TREAD_MARK_STEP = TREAD_TRACK_WIDTH / TREAD_MARK_COUNT;

export class TankMonster extends Monster {
  private turretRotation = 0;
  private turretSpinElapsedSeconds = 0;
  private turretSpinDirection = 1;
  private secondsUntilTurretSpin = randomRange(TURRET_SPIN_INTERVAL_MIN_SECONDS, TURRET_SPIN_INTERVAL_MAX_SECONDS);

  constructor(path: PathEntry[], speedScale: number) {
    super(path, COLOR, SPEED_PER_SECOND * speedScale, HIT_POINTS, BOUNTY, RADIUS);
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
    drawTankTreads(context, this.distanceAlongPath);
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
}

function drawTankTreads(context: CanvasRenderingContext2D, distanceAlongPath: number): void {
  context.save();
  context.strokeStyle = hexWithAlpha(TREAD_MARK_COLOR, 0.68);
  context.lineWidth = 1;
  context.lineCap = "round";

  drawTankTreadTrack(context, -1, -distanceAlongPath);
  drawTankTreadTrack(context, 1, distanceAlongPath);

  context.restore();
}

function drawTankTreadTrack(context: CanvasRenderingContext2D, direction: -1 | 1, distanceAlongPath: number): void {
  const rawOffset = distanceAlongPath * TREAD_CRAWL_DISTANCE_SCALE;
  const offset = ((rawOffset % TREAD_MARK_STEP) + TREAD_MARK_STEP) % TREAD_MARK_STEP;
  const outerY = direction < 0
    ? HULL_RECT.y + TREAD_MARK_OUTER_INSET
    : HULL_RECT.y + HULL_RECT.height - TREAD_MARK_OUTER_INSET;
  const innerY = outerY - (direction * TREAD_MARK_LENGTH);

  for (let index = 0; index < TREAD_MARK_COUNT; index += 1) {
    const markX = TREAD_TRACK_LEFT + (((index * TREAD_MARK_STEP) + offset) % TREAD_TRACK_WIDTH);
    context.beginPath();
    context.moveTo(markX, outerY);
    context.lineTo(markX, innerY);
    context.stroke();
  }
}
