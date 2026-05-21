import { hexWithAlpha, randomRange } from "../../utils";
import { Particle } from "./particle";

const MISSILE_EXPLOSION_SCALE_BASE = 0.8;
const MISSILE_EXPLOSION_SCALE_PER_LEVEL = 0.06;

function getMissileExplosionScale(level: number): number {
  return MISSILE_EXPLOSION_SCALE_BASE + (MISSILE_EXPLOSION_SCALE_PER_LEVEL * level);
}

export class SmokeParticle extends Particle {
  private readonly maxSize: number;
  private readonly growthPerSecond: number;

  constructor(x: number, y: number, blastAngle: number, level: number) {
    const scale = getMissileExplosionScale(level);
    const angle = blastAngle + Math.PI + randomRange(-1.1, 1.1);
    const size = randomRange(3.2, 6.8) * scale;
    super(x, y, size, "#7d7b72", randomRange(0.7, 1.15), {
      speedPerSecond: randomRange(22, 78) * scale,
      offset: randomRange(1, 7) * scale,
      angle,
    });
    this.alpha = randomRange(0.32, 0.58);
    this.maxSize = size + (randomRange(4, 8) * scale);
    this.growthPerSecond = 12 * scale;
  }

  override update(deltaSeconds: number, fieldWidth: number, fieldHeight: number): void {
    super.update(deltaSeconds, fieldWidth, fieldHeight);
    this.size = Math.min(this.maxSize, this.size + (this.growthPerSecond * deltaSeconds));
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

  constructor(x: number, y: number, blastAngle: number, level: number) {
    const scale = getMissileExplosionScale(level);
    const angle = blastAngle + Math.PI + randomRange(-1.8, 1.8);
    super(x, y, randomRange(2.1, 3.6) * scale, randomRange(0, 1) > 0.45 ? "#ff8f45" : "#fff0a8", randomRange(3.5, 5.4), {
      speedPerSecond: randomRange(175, 385) * scale,
      offset: randomRange(2, 6) * scale,
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
