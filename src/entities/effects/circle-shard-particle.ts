import { FIELD_HEIGHT, FIELD_WIDTH } from "../../constants";
import type { Point } from "../../types";
import { hexWithAlpha, randomRange } from "../../utils";
import { Particle } from "./particle";

export class CircleShardParticle extends Particle {
  alpha = 1;
  alphaFadePerSecond: number;
  radius: number;
  startAngle: number;
  sweepAngle: number;
  innerStart: Point;
  innerPeak: Point;
  innerEnd: Point;
  rotation = 0;
  angularVelocityPerSecond: number;

  constructor(
    x: number,
    y: number,
    radius: number,
    color: string,
    startAngle: number,
    sweepAngle: number,
    innerStart: Point,
    innerPeak: Point,
    innerEnd: Point,
    speedPerSecond: number,
  ) {
    super(x, y, radius * 2, color, 0, speedPerSecond, 0);
    const travelAngle = startAngle + (sweepAngle / 2) + randomRange(-0.12, 0.12);
    this.velocityXPerSecond = Math.cos(travelAngle) * speedPerSecond;
    this.velocityYPerSecond = Math.sin(travelAngle) * speedPerSecond;
    this.radius = radius;
    this.startAngle = startAngle;
    this.sweepAngle = sweepAngle;
    this.innerStart = innerStart;
    this.innerPeak = innerPeak;
    this.innerEnd = innerEnd;
    this.rotation = randomRange(-0.22, 0.22);
    this.angularVelocityPerSecond = randomRange(-5.2, 5.2);
    this.alphaFadePerSecond = randomRange(0.95, 1.9);
  }

  update(deltaSeconds: number): void {
    const driftSlowdownFactor = 1 - (0.52 * deltaSeconds);
    this.velocityXPerSecond *= driftSlowdownFactor;
    this.velocityYPerSecond *= driftSlowdownFactor;
    this.x += this.velocityXPerSecond * deltaSeconds;
    this.y += this.velocityYPerSecond * deltaSeconds;
    this.rotation += this.angularVelocityPerSecond * deltaSeconds;
    this.alpha = Math.max(0, this.alpha - (this.alphaFadePerSecond * deltaSeconds));
    if (
      this.alpha <= 0 ||
      this.x < -24 ||
      this.y < -24 ||
      this.x > FIELD_WIDTH + 24 ||
      this.y > FIELD_HEIGHT + 24
    ) {
      this.removed = true;
    }
  }

  draw(context: CanvasRenderingContext2D): void {
    const outerStart = pointOnCircle(this.startAngle, this.radius);
    const outerEnd = pointOnCircle(this.startAngle + this.sweepAngle, this.radius);

    context.save();
    context.translate(this.x, this.y);
    context.rotate(this.rotation);
    context.fillStyle = hexWithAlpha(this.color, this.alpha);
    context.strokeStyle = hexWithAlpha("#ffffff", Math.min(1, this.alpha + 0.08));
    context.lineWidth = 1.1;
    context.beginPath();
    context.moveTo(this.innerStart.x, this.innerStart.y);
    context.lineTo(outerStart.x, outerStart.y);
    context.arc(0, 0, this.radius, this.startAngle, this.startAngle + this.sweepAngle);
    context.lineTo(this.innerEnd.x, this.innerEnd.y);
    context.quadraticCurveTo(this.innerPeak.x, this.innerPeak.y, this.innerStart.x, this.innerStart.y);
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
  }
}

function pointOnCircle(angle: number, radius: number): Point {
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}
