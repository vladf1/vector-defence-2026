import { hexWithAlpha } from "../../utils";
import { Particle } from "./particle";

export class HitRingEffect extends Particle {
  private ageSeconds = 0;

  constructor(x: number, y: number, private readonly ringColor: string, private readonly maxRadius: number) {
    super(x, y, 0, ringColor, 1, { speedPerSecond: 0, offset: 0, angle: 0 });
    this.alpha = 0.85;
  }

  override update(deltaSeconds: number): void {
    this.ageSeconds += deltaSeconds;
    this.alpha = Math.max(0, this.alpha - (5.2 * deltaSeconds));
    if (this.alpha <= 0) {
      this.removed = true;
    }
  }

  override draw(context: CanvasRenderingContext2D): void {
    const progress = Math.min(1, this.ageSeconds * 5.2);
    const radius = 2 + (this.maxRadius * progress);
    context.save();
    context.strokeStyle = hexWithAlpha(this.ringColor, this.alpha);
    context.lineWidth = 1.2 * (1 - (progress * 0.55));
    context.beginPath();
    context.arc(this.x, this.y, radius, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }
}
