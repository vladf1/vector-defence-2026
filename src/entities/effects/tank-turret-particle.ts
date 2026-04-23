import { FIELD_HEIGHT, FIELD_WIDTH } from "../../constants";
import { hexWithAlpha, randomRange } from "../../utils";
import { Particle } from "./particle";

export class TankTurretParticle extends Particle {
  alpha = 1;
  alphaFadePerSecond: number;
  radius: number;
  rotation: number;
  angularVelocityPerSecond: number;

  constructor(
    x: number,
    y: number,
    radius: number,
    color: string,
    rotation: number,
  ) {
    super(x, y, radius * 2, color, 0, 0, 0);
    const travelAngle = randomRange(-Math.PI, Math.PI);
    const speedPerSecond = randomRange(115, 185);
    this.velocityXPerSecond = Math.cos(travelAngle) * speedPerSecond;
    this.velocityYPerSecond = Math.sin(travelAngle) * speedPerSecond;
    this.radius = radius;
    this.rotation = rotation;
    this.angularVelocityPerSecond = randomRange(-12.5, 12.5);
    this.alphaFadePerSecond = randomRange(0.45, 0.78);
  }

  update(deltaSeconds: number): void {
    const driftSlowdownFactor = 1 - (0.34 * deltaSeconds);
    this.velocityXPerSecond *= driftSlowdownFactor;
    this.velocityYPerSecond *= driftSlowdownFactor;
    this.x += this.velocityXPerSecond * deltaSeconds;
    this.y += this.velocityYPerSecond * deltaSeconds;
    this.rotation += this.angularVelocityPerSecond * deltaSeconds;
    this.alpha = Math.max(0, this.alpha - (this.alphaFadePerSecond * deltaSeconds));
    if (
      this.alpha <= 0 ||
      this.x < -34 ||
      this.y < -34 ||
      this.x > FIELD_WIDTH + 34 ||
      this.y > FIELD_HEIGHT + 34
    ) {
      this.removed = true;
    }
  }

  draw(context: CanvasRenderingContext2D): void {
    const turretRadius = this.radius * 0.48;
    const turretCenterX = this.radius * 0.08;
    context.save();
    context.translate(this.x, this.y);
    context.rotate(this.rotation);
    context.fillStyle = hexWithAlpha("#dfe6f3", Math.min(1, this.alpha * 0.92));
    context.strokeStyle = hexWithAlpha("#ffffff", Math.min(1, this.alpha + 0.08));
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(turretCenterX, 0, turretRadius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(turretCenterX + (turretRadius * 0.92), 0);
    context.lineTo(this.radius * 1.7, 0);
    context.stroke();
    context.restore();
  }
}
