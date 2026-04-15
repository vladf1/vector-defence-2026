import { MonsterKind, type Point } from "../../types";
import { MonsterBase } from "./monster-base";

const COLOR = "#91ff63";
const SPEED = 2.45;
const HIT_POINTS = 75;
const BOUNTY = 18;
const RADIUS = 5.5;

export class RunnerMonster extends MonsterBase {
  readonly kind = MonsterKind.Runner;

  constructor(path: Point[]) {
    super(path, COLOR, SPEED, HIT_POINTS, BOUNTY, RADIUS);
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
