import type { Point } from "../../types";
import { Monster } from "./monster";

const COLOR = "#9fb6ff";
const SPEED = 0.75;
const HIT_POINTS = 420;
const BOUNTY = 55;
const RADIUS = 10.5;

export class TankMonster extends Monster {
  constructor(path: Point[]) {
    super(path, COLOR, SPEED, HIT_POINTS, BOUNTY, RADIUS);
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.angle);
    context.fillRect(-this.radius, -this.radius * 0.72, this.radius * 2.1, this.radius * 1.44);
    context.strokeRect(-this.radius, -this.radius * 0.72, this.radius * 2.1, this.radius * 1.44);
    const turretCenterX = this.radius * 0.08;
    const turretRadius = this.radius * 0.42;
    context.beginPath();
    context.arc(turretCenterX, 0, turretRadius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(turretCenterX + (turretRadius * 0.92), 0);
    context.lineTo(this.radius * 1.52, 0);
    context.stroke();
  }
}
