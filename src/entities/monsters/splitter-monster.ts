import type { Point } from "../../types";
import { Monster } from "./monster";

const COLOR = "#ff8bd5";
const SPEED_PER_SECOND = 73;
const HIT_POINTS = 253;
const BOUNTY = 28;
const RADIUS = 8.5;

export class SplitterMonster extends Monster {
  constructor(path: Point[]) {
    super(path, COLOR, SPEED_PER_SECOND, HIT_POINTS, BOUNTY, RADIUS);
  }

  protected updateSpecial(deltaSeconds: number): void {
    this.rotation += 2.7 * deltaSeconds;
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.rotation);
    context.beginPath();
    for (let index = 0; index < 6; index += 1) {
      const angle = (Math.PI / 3) * index;
      const radius = index % 2 === 0 ? this.radius * 1.15 : this.radius * 0.72;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.closePath();
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(-this.radius * 0.55, -this.radius * 0.15);
    context.lineTo(0, this.radius * 0.2);
    context.lineTo(this.radius * 0.58, -this.radius * 0.18);
    context.stroke();
  }
}
