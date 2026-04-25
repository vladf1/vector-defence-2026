import { hexWithAlpha, randomRange } from "../../utils";
import { Particle } from "./particle";

export class MissileShockwaveEffect extends Particle {
  private ageSeconds = 0;

  constructor(x: number, y: number) {
    super(x, y, 0, "#fff0a8", 1, { speedPerSecond: 0, offset: 0, angle: 0 });
    this.alpha = 1;
  }

  override update(deltaSeconds: number): void {
    this.ageSeconds += deltaSeconds;
    this.alpha = Math.max(0, 1 - (this.ageSeconds * 4.8));
    if (this.alpha <= 0) {
      this.removed = true;
    }
  }

  override draw(context: CanvasRenderingContext2D): void {
    const progress = Math.min(1, this.ageSeconds * 4.8);
    const coreAlpha = Math.max(0, 1 - (progress * 4.7));
    const shockRadius = 5.5 + (progress * 34);

    context.save();
    context.globalCompositeOperation = "lighter";
    if (coreAlpha > 0) {
      const coreGradient = context.createRadialGradient(this.x, this.y, 0, this.x, this.y, 13);
      coreGradient.addColorStop(0, hexWithAlpha("#ffffff", coreAlpha));
      coreGradient.addColorStop(0.38, hexWithAlpha("#fff0a8", coreAlpha * 0.9));
      coreGradient.addColorStop(1, hexWithAlpha("#ff7a3d", 0));
      context.fillStyle = coreGradient;
      context.beginPath();
      context.arc(this.x, this.y, 13, 0, Math.PI * 2);
      context.fill();
    }

    context.strokeStyle = hexWithAlpha("#ffb45f", this.alpha * 0.84);
    context.lineWidth = 2.85 * (1 - (progress * 0.44));
    context.beginPath();
    context.arc(this.x, this.y, shockRadius, 0, Math.PI * 2);
    context.stroke();

    context.strokeStyle = hexWithAlpha("#fff2a8", this.alpha * 0.51);
    context.lineWidth = 1.1;
    context.beginPath();
    context.arc(this.x, this.y, shockRadius * 0.56, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }
}

export class SmokeParticle extends Particle {
  private readonly maxSize: number;

  constructor(x: number, y: number, blastAngle: number) {
    const angle = blastAngle + Math.PI + randomRange(-1.1, 1.1);
    const size = randomRange(3.2, 6.8);
    super(x, y, size, "#7d7b72", randomRange(0.7, 1.15), {
      speedPerSecond: randomRange(22, 78),
      offset: randomRange(1, 7),
      angle,
    });
    this.alpha = randomRange(0.32, 0.58);
    this.maxSize = size + randomRange(4, 8);
  }

  override update(deltaSeconds: number): void {
    super.update(deltaSeconds);
    this.size = Math.min(this.maxSize, this.size + (12 * deltaSeconds));
  }

  override draw(context: CanvasRenderingContext2D): void {
    const gradient = context.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
    gradient.addColorStop(0, hexWithAlpha(this.color, this.alpha * 0.5));
    gradient.addColorStop(1, hexWithAlpha(this.color, 0));
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    context.fill();
  }
}

export class EmberStreakParticle extends Particle {
  private readonly angle: number;

  constructor(x: number, y: number, blastAngle: number) {
    const angle = blastAngle + Math.PI + randomRange(-1.8, 1.8);
    super(x, y, randomRange(2.1, 3.6), randomRange(0, 1) > 0.45 ? "#ff8f45" : "#fff0a8", randomRange(3.5, 5.4), {
      speedPerSecond: randomRange(175, 385),
      offset: randomRange(2, 6),
      angle,
    });
    this.angle = angle;
  }

  override draw(context: CanvasRenderingContext2D): void {
    const tailLength = 4.5 + (this.size * 2.35);
    context.save();
    context.globalCompositeOperation = "lighter";
    context.strokeStyle = hexWithAlpha(this.color, this.alpha);
    context.lineWidth = this.size * 0.72;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(this.x, this.y);
    context.lineTo(this.x - (Math.cos(this.angle) * tailLength), this.y - (Math.sin(this.angle) * tailLength));
    context.stroke();
    context.restore();
  }
}
