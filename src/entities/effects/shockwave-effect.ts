import type { UpdateContext } from "../../game-engine/update-context";
import { hexWithAlpha } from "../../utils";
import { Particle } from "./particle";

export class ShockwaveEffect extends Particle {
  private ageSeconds = 0;

  constructor(x: number, y: number, private readonly scale: number) {
    super(x, y, 0, "#fff0a8", 1, { speedPerSecond: 0, offset: 0, angle: 0 });
    this.alpha = 1;
  }

  override update(context: UpdateContext): void {
    this.ageSeconds += context.deltaSeconds;
    this.alpha = Math.max(0, 1 - (this.ageSeconds * 4.15));
    if (this.alpha <= 0) {
      this.removed = true;
    }
  }

  override draw(context: CanvasRenderingContext2D): void {
    const progress = Math.min(1, this.ageSeconds * 4.15);
    const coreAlpha = Math.max(0, 1 - (progress * 4.5));
    const shockRadius = (5.75 + (progress * 37)) * this.scale;

    context.save();
    context.globalCompositeOperation = "lighter";
    if (coreAlpha > 0) {
      const coreRadius = 13 * this.scale;
      const coreGradient = context.createRadialGradient(this.x, this.y, 0, this.x, this.y, coreRadius);
      coreGradient.addColorStop(0, hexWithAlpha("#ffffff", coreAlpha));
      coreGradient.addColorStop(0.38, hexWithAlpha("#fff0a8", coreAlpha * 0.9));
      coreGradient.addColorStop(1, hexWithAlpha("#ff7a3d", 0));
      context.fillStyle = coreGradient;
      context.beginPath();
      context.arc(this.x, this.y, coreRadius, 0, Math.PI * 2);
      context.fill();
    }

    context.strokeStyle = hexWithAlpha("#f99a5f", this.alpha * 0.84);
    context.lineWidth = 3.05 * this.scale * (1 - (progress * 0.42));
    context.beginPath();
    context.arc(this.x, this.y, shockRadius, 0, Math.PI * 2);
    context.stroke();

    context.strokeStyle = hexWithAlpha("#fff2bf", this.alpha * 0.5);
    context.lineWidth = 1.18 * this.scale;
    context.beginPath();
    context.arc(this.x, this.y, shockRadius * 0.56, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }
}
