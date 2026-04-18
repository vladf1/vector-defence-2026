import type { Point } from "../../types";
import { hexWithAlpha } from "../../utils";
import { Monster } from "./monster";

const COLOR = "#78d7ff";
const ARMOR_GLOW_COLOR = "#dff7ff";
const SPEED_PER_SECOND = 54;
const HIT_POINTS = 310;
const BOUNTY = 42;
const RADIUS = 9.5;
const ARMOR_PER_HIT = 3.5;
const MIN_CHIP_DAMAGE = 0.4;

export class BulwarkMonster extends Monster {
  private shieldPulse = 0;

  constructor(path: Point[]) {
    super(path, COLOR, SPEED_PER_SECOND, HIT_POINTS, BOUNTY, RADIUS);
  }

  override takeDamage(amount: number): void {
    if (amount <= 0) {
      return;
    }

    const mitigated = Math.max(MIN_CHIP_DAMAGE, amount - ARMOR_PER_HIT);
    super.takeDamage(mitigated);
  }

  protected updateSpecial(deltaSeconds: number): void {
    this.shieldPulse += 2.8 * deltaSeconds;
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.angle);

    const glow = 0.3 + (Math.sin(this.shieldPulse) * 0.12) + (this.damageFlash * 0.25);
    const halfHeight = this.radius * 0.8;

    context.beginPath();
    context.moveTo(this.radius * 1.35, 0);
    context.lineTo(this.radius * 0.82, -halfHeight);
    context.lineTo(-this.radius * 0.2, -this.radius * 0.98);
    context.lineTo(-this.radius * 1.08, -halfHeight);
    context.lineTo(-this.radius * 1.32, 0);
    context.lineTo(-this.radius * 1.08, halfHeight);
    context.lineTo(-this.radius * 0.2, this.radius * 0.98);
    context.lineTo(this.radius * 0.82, halfHeight);
    context.closePath();
    context.fill();
    context.stroke();

    context.save();
    context.strokeStyle = hexWithAlpha(ARMOR_GLOW_COLOR, glow);
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(this.radius * 0.98, 0);
    context.lineTo(this.radius * 0.42, -this.radius * 0.46);
    context.lineTo(-this.radius * 0.3, -this.radius * 0.46);
    context.lineTo(-this.radius * 0.72, 0);
    context.lineTo(-this.radius * 0.3, this.radius * 0.46);
    context.lineTo(this.radius * 0.42, this.radius * 0.46);
    context.closePath();
    context.stroke();

    context.beginPath();
    context.moveTo(-this.radius * 0.22, -this.radius * 0.82);
    context.lineTo(this.radius * 0.48, -this.radius * 0.22);
    context.moveTo(-this.radius * 0.22, this.radius * 0.82);
    context.lineTo(this.radius * 0.48, this.radius * 0.22);
    context.stroke();
    context.restore();

    context.beginPath();
    context.moveTo(this.radius * 1.08, 0);
    context.lineTo(this.radius * 0.76, -this.radius * 0.28);
    context.lineTo(this.radius * 0.16, -this.radius * 0.28);
    context.lineTo(this.radius * 0.16, this.radius * 0.28);
    context.lineTo(this.radius * 0.76, this.radius * 0.28);
    context.closePath();
    context.stroke();

    context.beginPath();
    context.moveTo(-this.radius * 0.68, -this.radius * 0.52);
    context.lineTo(-this.radius * 0.98, -this.radius * 0.2);
    context.lineTo(-this.radius * 0.98, this.radius * 0.2);
    context.lineTo(-this.radius * 0.68, this.radius * 0.52);
    context.stroke();
  }
}
