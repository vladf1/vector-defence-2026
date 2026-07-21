import type { UpdateContext } from "../../game-engine/update-context";
import { CalibratedExponentialDecay, hexWithAlpha, isOutsideBounds, randomRange } from "../../utils";
import { Particle } from "../effects/particle";

const PRINT_COLOR = "#86ad99";
const PRINT_ALPHA = 0.46;
const PRINT_FADE_PER_SECOND = 0.234;
const TURRET_FILL = "#050908";
const TURRET_RADIUS_SCALE = 0.48;
const BARREL_END_SCALE = 1.7;
const DRIFT_VELOCITY_DECAY = new CalibratedExponentialDecay(0.34, 60);

export class TankTrackPrintParticle extends Particle {
  override drawsUnderEntities = true;
  private readonly angle: number;
  private readonly length: number;
  private readonly width: number;

  constructor(x: number, y: number, angle: number, length: number, width: number) {
    super(x, y, 1, PRINT_COLOR, PRINT_FADE_PER_SECOND, {
      speedPerSecond: 0,
      offset: 0,
      angle: 0,
    });
    this.alpha = PRINT_ALPHA;
    this.angle = angle;
    this.length = length;
    this.width = width;
  }

  override update(context: UpdateContext): void {
    this.alpha -= this.alphaFadePerSecond * context.deltaSeconds;
    if (this.alpha <= 0) {
      this.removed = true;
    }
  }

  override draw(context: CanvasRenderingContext2D): void {
    context.save();
    context.translate(this.x, this.y);
    context.rotate(this.angle);
    context.fillStyle = hexWithAlpha(this.color, this.alpha);
    context.fillRect(-this.length / 2, -this.width / 2, this.length, this.width);
    context.restore();
  }
}

export class TankTurretParticle extends Particle {
  alpha = 1;
  alphaFadePerSecond: number;
  radius: number;
  rotation: number;
  barrelRotation: number;
  angularVelocityPerSecond: number;

  constructor(
    x: number,
    y: number,
    radius: number,
    color: string,
    rotation: number,
    barrelRotation: number,
  ) {
    super(x, y, radius * 2, color, 0, { speedPerSecond: 0, offset: 0 });
    const travelAngle = randomRange(-Math.PI, Math.PI);
    const speedPerSecond = randomRange(115, 185);
    this.velocityXPerSecond = Math.cos(travelAngle) * speedPerSecond;
    this.velocityYPerSecond = Math.sin(travelAngle) * speedPerSecond;
    this.radius = radius;
    this.rotation = rotation;
    this.barrelRotation = barrelRotation;
    this.angularVelocityPerSecond = randomRange(-12.5, 12.5);
    this.alphaFadePerSecond = randomRange(0.45, 0.78);
  }

  override update(context: UpdateContext): void {
    DRIFT_VELOCITY_DECAY.apply(this, context.deltaSeconds);
    this.rotation += this.angularVelocityPerSecond * context.deltaSeconds;
    this.alpha = Math.max(0, this.alpha - (this.alphaFadePerSecond * context.deltaSeconds));
    if (this.alpha <= 0 || isOutsideBounds(this, context.fieldWidth, context.fieldHeight, 34)) {
      this.removed = true;
    }
  }

  override draw(context: CanvasRenderingContext2D): void {
    context.save();
    context.translate(this.x, this.y);
    context.rotate(this.rotation);
    context.fillStyle = hexWithAlpha(TURRET_FILL, this.alpha);
    context.strokeStyle = hexWithAlpha(this.color, Math.min(1, this.alpha + 0.08));
    context.lineWidth = 1.5;
    drawTankTurret(
      context,
      this.radius,
      TURRET_RADIUS_SCALE,
      BARREL_END_SCALE,
      this.barrelRotation,
    );
    context.restore();
  }
}

export function getTankTurretCenterOffsetX(tankRadius: number): number {
  return tankRadius * 0.08;
}

export function drawTankTurret(
  context: CanvasRenderingContext2D,
  tankRadius: number,
  turretRadiusScale: number,
  barrelEndScale: number,
  barrelRotation: number,
): void {
  const turretRadius = tankRadius * turretRadiusScale;
  const barrelEndX = (tankRadius * barrelEndScale) - getTankTurretCenterOffsetX(tankRadius);
  context.beginPath();
  context.arc(0, 0, turretRadius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.save();
  context.rotate(barrelRotation);
  context.beginPath();
  context.moveTo(turretRadius * 0.92, 0);
  context.lineTo(barrelEndX, 0);
  context.stroke();
  context.restore();
}
