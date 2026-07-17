import type { UpdateContext } from "../../game-engine/update-context";
import { CalibratedExponentialDecay, hexWithAlpha, isOutsideBounds, randomRange } from "../../utils";
import { drawTankTurret } from "../monsters/tank-turret-rendering";
import { Particle } from "./particle";

const TURRET_FILL = "#050908";
const TURRET_RADIUS_SCALE = 0.48;
const BARREL_END_SCALE = 1.7;
const DRIFT_VELOCITY_DECAY = new CalibratedExponentialDecay(0.34, 60);

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

  update(context: UpdateContext): void {
    DRIFT_VELOCITY_DECAY.apply(this, context.deltaSeconds);
    this.rotation += this.angularVelocityPerSecond * context.deltaSeconds;
    this.alpha = Math.max(0, this.alpha - (this.alphaFadePerSecond * context.deltaSeconds));
    if (this.alpha <= 0 || isOutsideBounds(this, context.fieldWidth, context.fieldHeight, 34)) {
      this.removed = true;
    }
  }

  draw(context: CanvasRenderingContext2D): void {
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
