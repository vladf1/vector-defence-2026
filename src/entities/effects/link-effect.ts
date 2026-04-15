import type { Point } from "../../types";
import { hexWithAlpha } from "../../utils";
import type { MonsterBase } from "../monsters/monster-base";
import type { Tower } from "../towers/tower-base";

export class LinkEffect {
  from?: Point;
  fromTower?: Tower;
  target: MonsterBase;
  color: string;
  alpha: number;
  fadeBy: number;
  removed = false;

  constructor(target: MonsterBase, color: string, fadeBy: number, from?: Point, fromTower?: Tower) {
    this.target = target;
    this.color = color;
    this.fadeBy = fadeBy;
    this.from = from;
    this.fromTower = fromTower;
    this.alpha = color === "#d8ff4f" ? 0.8 : 0.7;
  }

  update(multiplier: number): void {
    if (this.target.removed || (this.fromTower && this.fromTower.removed)) {
      this.alpha = 0;
    } else {
      this.alpha -= this.fadeBy * multiplier;
    }
    if (this.alpha <= 0) {
      this.removed = true;
    }
  }

  draw(context: CanvasRenderingContext2D): void {
    const fromX = this.fromTower ? this.fromTower.x : this.from?.x;
    const fromY = this.fromTower ? this.fromTower.y : this.from?.y;
    if (fromX === undefined || fromY === undefined) {
      return;
    }
    context.save();
    context.strokeStyle = hexWithAlpha(this.color, this.alpha);
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(fromX, fromY);
    context.lineTo(this.target.x, this.target.y);
    context.stroke();
    context.restore();
  }
}
