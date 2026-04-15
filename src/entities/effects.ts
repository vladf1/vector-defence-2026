import { FIELD_HEIGHT, FIELD_WIDTH } from "../constants";
import type { Point } from "../types";
import { hexWithAlpha, randomRange } from "../utils";
import type { Monster } from "./monsters";
import type { Tower } from "./towers/tower-base";

export class Particle {
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
  color: string;
  alpha = 1;
  burnRate: number;
  removed = false;

  constructor(x: number, y: number, size: number, color: string, burnRate: number, speed = randomRange(2, 7), offset = randomRange(4, 6)) {
    const angle = randomRange(-Math.PI, Math.PI);
    this.dx = Math.cos(angle) * speed;
    this.dy = Math.sin(angle) * speed;
    this.x = x + (Math.cos(angle) * offset);
    this.y = y + (Math.sin(angle) * offset);
    this.size = size;
    this.color = color;
    this.burnRate = burnRate;
  }

  update(multiplier: number): void {
    const slowDownFactor = 1 - (0.04 * multiplier);
    this.dx *= slowDownFactor;
    this.dy *= slowDownFactor;
    this.x += this.dx * multiplier;
    this.y += this.dy * multiplier;
    this.alpha -= this.burnRate * multiplier;
    if (this.alpha <= 0 || this.x < -20 || this.y < -20 || this.x > FIELD_WIDTH + 20 || this.y > FIELD_HEIGHT + 20) {
      this.removed = true;
    }
  }

  draw(context: CanvasRenderingContext2D): void {
    context.fillStyle = hexWithAlpha(this.color, this.alpha);
    context.fillRect(this.x - (this.size / 2), this.y - (this.size / 2), this.size, this.size);
  }
}

export class LinkEffect {
  from?: Point;
  fromTower?: Tower;
  target: Monster;
  color: string;
  alpha: number;
  fadeBy: number;
  removed = false;

  constructor(target: Monster, color: string, fadeBy: number, from?: Point, fromTower?: Tower) {
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
