import type { Point } from "../../types";
import { MonsterBase } from "./monster-base";

const COLOR = "#ff6f62";
const SPEED = 1.25;
const HIT_POINTS = 150;
const BOUNTY = 25;
const RADIUS = 6.5;

export class SquareMonster extends MonsterBase {
  constructor(path: Point[]) {
    super(path, COLOR, SPEED, HIT_POINTS, BOUNTY, RADIUS);
  }

  protected updateSpecial(multiplier: number): void {
    this.rotation += 0.07 * multiplier;
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.rotation);
    context.fillRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
    context.strokeRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
  }
}
