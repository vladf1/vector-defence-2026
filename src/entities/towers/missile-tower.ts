import { TowerKind } from "../../types";
import { angleBetween, turnAngleTowards } from "../../utils";
import { Missile } from "../projectiles/missile";
import type { GameAccess } from "../game-access";
import { Tower } from "./tower";

export class MissileTower extends Tower {
  angle = Math.PI / 4;
  rotationSpeed = 0.5;
  missileDamage = 50;
  turnSpeed = 0.06;

  constructor(x: number, y: number) {
    super(TowerKind.Missile, x, y);
    this.applyLevelStats();
  }

  protected onUpdate(game: GameAccess, multiplier: number): void {
    const tracked = this.getClosestMonster(game);
    if (tracked) {
      const targetAngle = angleBetween({ x: this.x, y: this.y }, { x: tracked.x, y: tracked.y });
      this.angle = turnAngleTowards(this.angle, targetAngle, this.turnSpeed * multiplier);
    } else {
      this.angle += this.rotationSpeed * multiplier * 0.025;
    }
    if (tracked && this.ready()) {
      const damageRadius = 60 + (5 * this.level);
      const missileSpeed = 1.8 + (this.level / 2);
      const source = {
        x: this.x + (Math.cos(this.angle) * 14),
        y: this.y + (Math.sin(this.angle) * 14),
      };
      game.missiles.push(new Missile(source, tracked, this.missileDamage, damageRadius, missileSpeed));
      this.resetCooldown(1000 * (2 - (0.2 * this.level)));
    }
  }

  protected onUpgrade(): void {
    this.applyLevelStats();
  }

  private applyLevelStats(): void {
    this.rotationSpeed = 0.5 + (this.level / 3);
    this.missileDamage = 50 + (4 * this.level);
  }

  draw(context: CanvasRenderingContext2D, active: boolean): void {
    context.save();
    context.translate(this.x, this.y);
    context.fillStyle = "#08100d";
    context.strokeStyle = "#d7e2ea";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(0, 0, 14, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    context.save();
    context.rotate(this.angle);
    context.fillStyle = "#202b35";
    context.strokeStyle = "#ffffff";
    context.fillRect(-9.5, -4.5, 9, 9);
    context.strokeRect(-9.5, -4.5, 9, 9);
    context.fillStyle = this.ready() ? "#ffe27a" : "#78838b";
    context.fillRect(-7.5, -8, 11, 3.5);
    context.strokeRect(-7.5, -8, 11, 3.5);
    context.fillRect(-7.5, 4.5, 11, 3.5);
    context.strokeRect(-7.5, 4.5, 11, 3.5);
    context.beginPath();
    context.moveTo(3.5, -8);
    context.lineTo(8, -6.25);
    context.lineTo(3.5, -4.5);
    context.closePath();
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(3.5, 4.5);
    context.lineTo(8, 6.25);
    context.lineTo(3.5, 8);
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();

    if (active) {
      this.drawSelection(context);
    }
    context.restore();
  }
}
