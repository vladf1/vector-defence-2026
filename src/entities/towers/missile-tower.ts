import type { Game } from "../../game-engine";
import { TowerKind } from "../../types";
import { angleBetween, turnAngleTowards } from "../../utils";
import { Missile } from "../projectiles/missile";
import { Tower } from "./tower";

export class MissileTower extends Tower {
  static readonly kind = TowerKind.Missile;
  static readonly label = "Missile";
  static readonly summary = "Slow launcher with splash damage.";
  static readonly baseCost = 50;
  static readonly baseRange = 150;
  static readonly shortcuts = ["3", "r"] as const;

  angle = Math.PI / 4;
  missileDamage = 50;
  turnSpeedPerSecond = 3.6;
  muzzleFlashSeconds = 0;

  constructor(x: number, y: number) {
    super(x, y);
    this.applyLevelStats();
  }

  protected onUpdate(game: Game, deltaSeconds: number): void {
    this.muzzleFlashSeconds = Math.max(0, this.muzzleFlashSeconds - deltaSeconds);
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
      game.runtime.missiles.push(new Missile(source, tracked, this.missileDamage, damageRadius, missileSpeedPerSecond));
      this.muzzleFlashSeconds = 0.12;
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

    if (this.level > 0) {
      context.strokeStyle = `rgba(255, 226, 122, ${0.22 + (this.level * 0.02)})`;
      context.lineWidth = 0.9 + (this.level * 0.08);
      context.beginPath();
      context.arc(0, 0, 14.8 + (this.level * 0.22), 0, Math.PI * 2);
      context.stroke();
    }

    context.save();
    context.rotate(this.angle);
    context.fillStyle = "#202b35";
    context.strokeStyle = "#ffffff";
    context.fillRect(-10.5 - (this.level * 0.25), -4.5, 10 + (this.level * 0.45), 9);
    context.strokeRect(-10.5 - (this.level * 0.25), -4.5, 10 + (this.level * 0.45), 9);
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

    if (this.level > 0) {
      context.fillStyle = "#ffe27a";
      const pipCount = Math.min(6, this.level);
      for (let i = 0; i < pipCount; i += 1) {
        context.beginPath();
        context.arc(-7.5 + (i * 3), 9.2, 1, 0, Math.PI * 2);
        context.fill();
      }

      context.fillStyle = this.ready() ? "#ff9d5c" : "#78838b";
      context.fillRect(-6.5, -2, 9 + (this.level * 0.45), 4);
      context.strokeRect(-6.5, -2, 9 + (this.level * 0.45), 4);
      context.beginPath();
      context.moveTo(2.5 + (this.level * 0.45), -2);
      context.lineTo(7 + (this.level * 0.45), 0);
      context.lineTo(2.5 + (this.level * 0.45), 2);
      context.closePath();
      context.fill();
      context.stroke();
    }

    if (this.muzzleFlashSeconds > 0) {
      const flashAlpha = this.muzzleFlashSeconds / 0.12;
      context.save();
      context.globalCompositeOperation = "lighter";
      context.fillStyle = `rgba(255, 164, 82, ${0.62 * flashAlpha})`;
      context.shadowColor = "#ff9d5c";
      context.shadowBlur = 10;
      context.beginPath();
      context.arc(10 + (this.level * 0.45), 0, 3.5 + (4 * flashAlpha), 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    context.restore();

    if (active) {
      this.drawSelection(context);
    }
    context.restore();
  }
}
