import { drawPath, hexWithAlpha } from "../../utils";
import { EscapeFragmentParticle } from "./escape-fragment-particle";

const FRAGMENT_FILL = "#050908";

export class FastEscapeFragmentParticle extends EscapeFragmentParticle {
  override draw(context: CanvasRenderingContext2D): void {
    const rotationCos = Math.cos(this.rotation);
    const rotationSin = Math.sin(this.rotation);
    context.setTransform(rotationCos, rotationSin, -rotationSin, rotationCos, this.x, this.y);
    context.fillStyle = hexWithAlpha(FRAGMENT_FILL, this.alpha * 0.92);
    context.strokeStyle = hexWithAlpha(this.color, Math.min(1, this.alpha + 0.08));
    context.lineWidth = 1.35;
    drawPath(context, this.vertices, true);

    context.globalCompositeOperation = "lighter";
    context.strokeStyle = hexWithAlpha(this.color, this.alpha * 0.42);
    context.lineWidth = 0.8;
    context.beginPath();
    context.moveTo(this.vertices[0].x * 0.68, this.vertices[0].y * 0.44);
    context.lineTo(this.vertices[Math.floor(this.vertices.length / 2)].x * 0.68, 0);
    context.stroke();
    context.globalCompositeOperation = "source-over";
  }
}
