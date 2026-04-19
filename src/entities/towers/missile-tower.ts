import { TowerKind } from "../../types";
import { angleBetween, turnAngleTowards } from "../../utils";
import { Missile } from "../projectiles/missile";
import type { GameAccess } from "../game-access";
import { Tower } from "./tower";

export class MissileTower extends Tower {
  static readonly kind = TowerKind.Missile;
  static readonly label = "Missile";
  static readonly summary = "Slow launcher with splash damage.";
  static readonly baseCost = 50;
  static readonly baseRange = 150;
  static readonly shortcuts = ["3", "m"] as const;

  angle = Math.PI / 4;
  missileDamage = 50;
  turnSpeedPerSecond = 3.6;

  constructor(x: number, y: number) {
    super(x, y);
    this.applyLevelStats();
  }

  protected onUpdate(game: GameAccess, deltaSeconds: number): void {
    const tracked = this.getTrackedMonster(game);
    let alignedToTarget = false;

    if (tracked) {
      const targetAngle = angleBetween({ x: this.x, y: this.y }, { x: tracked.x, y: tracked.y });
      this.angle = turnAngleTowards(this.angle, targetAngle, this.turnSpeedPerSecond * deltaSeconds);
      alignedToTarget = this.isAimedAtTarget(this.angle, targetAngle);
    }

    if (tracked && alignedToTarget && this.ready()) {
      const damageRadius = 60 + (5 * this.level);
      const missileSpeedPerSecond = 108 + (30 * this.level);
      const source = {
        x: this.x + (Math.cos(this.angle) * 14),
        y: this.y + (Math.sin(this.angle) * 14),
      };
      game.missiles.push(new Missile(source, tracked, this.missileDamage, damageRadius, missileSpeedPerSecond));
      this.resetCooldown(2 - (0.2 * this.level));
    }
  }

  protected onUpgrade(): void {
    this.applyLevelStats();
  }

  private applyLevelStats(): void {
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
