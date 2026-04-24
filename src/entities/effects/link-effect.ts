import { hexWithAlpha } from "../../utils";
import type { Monster } from "../monsters/monster";

interface LinkSource {
  x: number;
  y: number;
  level?: number;
  removed?: boolean;
}

export class LinkEffect {
  source: LinkSource;
  target: Monster;
  color: string;
  alpha: number;
  alphaFadePerSecond: number;
  removed = false;

  constructor(target: Monster, color: string, alphaFadePerSecond: number, source: LinkSource) {
    this.target = target;
    this.color = color;
    this.alphaFadePerSecond = alphaFadePerSecond;
    this.source = source;
    this.alpha = color === "#d8ff4f" ? 0.8 : 0.7;
  }

  update(deltaSeconds: number): void {
    if (this.target.removed || this.source.removed) {
      this.alpha = 0;
    } else {
      this.alpha -= this.alphaFadePerSecond * deltaSeconds;
    }
    if (this.alpha <= 0) {
      this.removed = true;
    }
  }

  draw(context: CanvasRenderingContext2D): void {
    const fromX = this.source.x;
    const fromY = this.source.y;
    const toX = this.target.x;
    const toY = this.target.y;
    const sourceLevel = this.source.level ?? 0;
    const impactRadius = this.target.radius + 1.5 + ((1 - this.alpha) * 3);

    context.save();
    context.strokeStyle = hexWithAlpha(this.color, this.alpha * 0.5);
    context.lineWidth = 3 + (sourceLevel * 0.18);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(fromX, fromY);
    context.lineTo(toX, toY);
    context.stroke();

    context.strokeStyle = hexWithAlpha("#f4ff9a", this.alpha * 0.7);
    context.lineWidth = 1.1 + (sourceLevel * 0.12);
    context.setLineDash([5, 5]);
    context.beginPath();
    context.moveTo(fromX, fromY);
    context.lineTo(toX, toY);
    context.stroke();

    context.setLineDash([]);
    context.strokeStyle = hexWithAlpha(this.color, this.alpha * 0.32);
    context.lineWidth = 0.9;
    context.beginPath();
    context.arc(toX, toY, impactRadius, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }
}
