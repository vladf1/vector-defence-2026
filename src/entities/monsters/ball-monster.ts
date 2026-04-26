import type { Point } from "../../types";
import { Monster } from "./monster";

const COLOR = "#5df2ef";
const SPEED_PER_SECOND = 81;
const HIT_POINTS = 220;
const BOUNTY = 20;
const RADIUS = 7.5;
const MOUTH_ANGLE = Math.PI * 0.18;

export class BallMonster extends Monster {
  constructor(path: Point[]) {
    super(path, COLOR, SPEED_PER_SECOND, HIT_POINTS, BOUNTY, RADIUS);
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.angle);
    context.beginPath();
    context.moveTo(0, 0);
    context.arc(0, 0, this.radius, MOUTH_ANGLE, (Math.PI * 2) - MOUTH_ANGLE);
    context.closePath();
    context.fill();
    context.stroke();

    context.beginPath();
    context.arc(this.radius * 0.12, -this.radius * 0.5, this.radius * 0.16, 0, Math.PI * 2);
    context.fill();
  }
}
