import { MonsterKind, type Point } from "../../types";
import { MonsterBase } from "./monster-base";

const COLOR = "#ffba4f";
const SPEED = 1.75;
const HIT_POINTS = 100;
const BOUNTY = 30;
const RADIUS = 7;

export class TriangleMonster extends MonsterBase {
  readonly kind = MonsterKind.Triangle;

  constructor(path: Point[]) {
    super(path, COLOR, SPEED, HIT_POINTS, BOUNTY, RADIUS);
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.angle);
    context.beginPath();
    context.moveTo(6, 0);
    context.lineTo(-6, -6);
    context.lineTo(-6, 6);
    context.closePath();
    context.fill();
    context.stroke();
  }
}
