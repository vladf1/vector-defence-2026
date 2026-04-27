import type { PathEntry } from "../../route-path";
import { Monster } from "./monster";

const COLOR = "#91ff63";
const SPEED_PER_SECOND = 132;
const HIT_POINTS = 83;
const BOUNTY = 18;
const RADIUS = 5.5;

export class RunnerMonster extends Monster {
  constructor(path: PathEntry[]) {
    super(path, COLOR, SPEED_PER_SECOND, HIT_POINTS, BOUNTY, RADIUS);
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.angle);
    context.beginPath();
    context.moveTo(this.radius * 1.7, 0);
    context.lineTo(-this.radius * 0.1, -this.radius * 0.82);
    context.lineTo(-this.radius * 1.35, 0);
    context.lineTo(-this.radius * 0.1, this.radius * 0.82);
    context.closePath();
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(-this.radius * 0.95, 0);
    context.lineTo(-this.radius * 1.5, -this.radius * 0.55);
    context.moveTo(-this.radius * 0.95, 0);
    context.lineTo(-this.radius * 1.5, this.radius * 0.55);
    context.stroke();
  }
}
