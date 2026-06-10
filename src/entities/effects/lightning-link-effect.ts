import type { UpdateContext } from "../../game-engine/update-context";
import { hexWithAlpha } from "../../utils";
import type { Monster } from "../monsters/monster";

interface LightningSource {
  x: number;
  y: number;
  level?: number;
  removed?: boolean;
}

const SEGMENT_LENGTH = 9;

export class LightningLinkEffect {
  source: LightningSource;
  target: Monster;
  color: string;
  alpha = 0.92;
  ageSeconds = 0;
  removed = false;

  constructor(source: LightningSource, target: Monster, color: string) {
    this.source = source;
    this.target = target;
    this.color = color;
  }

  update(context: UpdateContext): void {
    if (this.target.removed || this.source.removed) {
      this.alpha = 0;
    } else {
      this.ageSeconds += context.deltaSeconds;
      this.alpha -= 3.8 * context.deltaSeconds;
    }

    if (this.alpha <= 0) {
      this.removed = true;
    }
  }

  draw(context: CanvasRenderingContext2D): void {
    const sourceLevel = this.source.level ?? 0;
    const points = this.createBoltPoints();

    context.save();
    context.globalCompositeOperation = "lighter";
    context.lineCap = "round";
    context.lineJoin = "round";

    context.strokeStyle = hexWithAlpha(this.color, this.alpha * 0.42);
    context.lineWidth = 5 + (sourceLevel * 0.32);
    this.strokeBolt(context, points);

    context.strokeStyle = hexWithAlpha("#ffffff", this.alpha * 0.9);
    context.lineWidth = 1.15 + (sourceLevel * 0.08);
    this.strokeBolt(context, points);

    context.strokeStyle = hexWithAlpha(this.color, this.alpha * 0.72);
    context.lineWidth = 1;
    this.drawStaticArcs(context, this.target.x, this.target.y, sourceLevel);
    context.restore();
  }

  private createBoltPoints(): { x: number; y: number }[] {
    const fromX = this.source.x;
    const fromY = this.source.y;
    const toX = this.target.x;
    const toY = this.target.y;
    const deltaX = toX - fromX;
    const deltaY = toY - fromY;
    const distance = Math.hypot(deltaX, deltaY);
    const segmentCount = Math.max(2, Math.ceil(distance / SEGMENT_LENGTH));
    const normalX = distance > 0 ? -deltaY / distance : 0;
    const normalY = distance > 0 ? deltaX / distance : 0;
    const points = [{ x: fromX, y: fromY }];

    for (let index = 1; index < segmentCount; index += 1) {
      const t = index / segmentCount;
      const envelope = Math.sin(Math.PI * t);
      const jitter = Math.sin((this.ageSeconds * 55) + (index * 4.31)) * 5.6 * envelope;
      points.push({
        x: fromX + (deltaX * t) + (normalX * jitter),
        y: fromY + (deltaY * t) + (normalY * jitter),
      });
    }

    points.push({ x: toX, y: toY });
    return points;
  }

  private strokeBolt(context: CanvasRenderingContext2D, points: { x: number; y: number }[]): void {
    const start = points[0];
    if (!start) {
      return;
    }

    context.beginPath();
    context.moveTo(start.x, start.y);
    for (let index = 1; index < points.length; index += 1) {
      context.lineTo(points[index].x, points[index].y);
    }
    context.stroke();
  }

  private drawStaticArcs(context: CanvasRenderingContext2D, x: number, y: number, sourceLevel: number): void {
    const arcCount = Math.min(5, 3 + sourceLevel);
    const radius = this.target.radius + 4 + (sourceLevel * 0.32);
    const spin = this.ageSeconds * 18;

    context.beginPath();
    for (let index = 0; index < arcCount; index += 1) {
      const angle = spin + ((Math.PI * 2 * index) / arcCount);
      context.moveTo(
        x + (Math.cos(angle) * (radius - 3)),
        y + (Math.sin(angle) * (radius - 3)),
      );
      context.lineTo(
        x + (Math.cos(angle + 0.22) * (radius + 2.2)),
        y + (Math.sin(angle + 0.22) * (radius + 2.2)),
      );
    }
    context.stroke();
  }
}
