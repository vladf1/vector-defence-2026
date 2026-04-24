import { hexWithAlpha } from "../../utils";
import type { Monster } from "../monsters/monster";

const SLOW_ARC_COLOR = "#8ff7ff";
const SLOW_ARC_COUNT = 3;

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
  ageSeconds = 0;
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
      this.ageSeconds += deltaSeconds;
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
    this.drawSlowArcs(context, toX, toY);
    context.restore();
  }

  private drawSlowArcs(context: CanvasRenderingContext2D, x: number, y: number): void {
    const pulse = Math.sin(this.ageSeconds * 18) * 0.9;
    const radius = this.target.radius + 3.4 + pulse + ((1 - this.alpha) * 1.8);
    const rotation = this.ageSeconds * 5.8;
    const arcLength = Math.PI * 0.36;

    context.save();
    context.globalCompositeOperation = "lighter";
    context.strokeStyle = hexWithAlpha(SLOW_ARC_COLOR, this.alpha * 0.72);
    context.lineWidth = 1.15;
    context.lineCap = "round";
    context.shadowColor = SLOW_ARC_COLOR;
    context.shadowBlur = 5;

    for (let index = 0; index < SLOW_ARC_COUNT; index += 1) {
      const startAngle = rotation + ((Math.PI * 2 * index) / SLOW_ARC_COUNT);
      context.beginPath();
      context.arc(x, y, radius, startAngle, startAngle + arcLength);
      context.stroke();
    }
    context.restore();
  }
}
