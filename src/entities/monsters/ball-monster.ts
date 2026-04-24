import type { Point } from "../../types";
import { Monster } from "./monster";

const COLOR = "#5df2ef";
const SPEED_PER_SECOND = 81;
const HIT_POINTS = 220;
const BOUNTY = 20;
const RADIUS = 7.5;

export class BallMonster extends Monster {
  constructor(path: Point[]) {
    super(path, COLOR, SPEED_PER_SECOND, HIT_POINTS, BOUNTY, RADIUS);
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.beginPath();
    context.arc(0, 0, this.radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
}
