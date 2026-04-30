import { TOWER_RADIUS, TOWER_UPGRADE_RING_GROWTH, TOWER_UPGRADE_RING_OFFSET } from "../../constants";
import type { Game } from "../../game-engine";
import { AudioCue, TowerKind } from "../../types";
import { angleBetween, randomRange, turnAngleTowards } from "../../utils";
import { Missile } from "../projectiles/missile";
import { Tower } from "./tower";

export class MissileTower extends Tower {
  static readonly kind = TowerKind.Missile;
  static readonly label = "Missile";
  static readonly summary = "Slow launcher with splash damage.";
  static readonly baseCost = 50;
  static readonly baseRange = 150;
  static readonly shortcuts = ["3", "r"] as const;

  angle = randomRange(-Math.PI, Math.PI);
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
      game.playSound(AudioCue.MissileLaunch, source.x, 1 + (this.level * 0.09));
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
    context.arc(0, 0, TOWER_RADIUS, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    if (this.level > 0) {
      context.strokeStyle = `rgba(255, 226, 122, ${0.22 + (this.level * 0.02)})`;
      context.lineWidth = 0.9 + (this.level * 0.08);
      context.beginPath();
      context.arc(0, 0, TOWER_RADIUS + TOWER_UPGRADE_RING_OFFSET + (this.level * TOWER_UPGRADE_RING_GROWTH), 0, Math.PI * 2);
      context.stroke();
    }

    context.save();
    context.rotate(this.angle);
    const upgradePipCount = Math.max(0, this.level - 2);

    const rocketYs = [
      [0],
      [-3.1, 3.1],
      [-4.5, 0, 4.5],
    ][Math.min(2, this.level)];

    for (const [index, rocketY] of rocketYs.entries()) {
      const accentRocket = index === 1 && rocketYs.length === 3;
      const extendedRocket = rocketYs.length === 1 || accentRocket;
      const shortenedSideRocket = rocketYs.length === 3 && !accentRocket;
      const rocketLengthBonus = extendedRocket ? 3.2 : shortenedSideRocket ? -1.7 : 0;
      const rocketBodyFrontX = 3.4 + rocketLengthBonus;
      const rocketNoseTipX = 8.9 + rocketLengthBonus;
      const rocketColor = this.ready() ? accentRocket ? "#ff9d5c" : "#ffe27a" : "#78838b";
      const noseColor = this.ready() ? accentRocket ? "#ffe27a" : "#fff1ac" : "#a1abb2";
      const rocketOffsetX = 1.8;
      context.fillStyle = rocketColor;
      context.strokeStyle = "#06100f";
      context.lineWidth = 0.8;
      context.beginPath();
      context.rect(-7.8 + rocketOffsetX, rocketY - 1.65, 11.2 + rocketLengthBonus, 3.3);
      context.fill();
      context.stroke();

      context.fillStyle = noseColor;
      context.beginPath();
      context.moveTo(rocketBodyFrontX + rocketOffsetX, rocketY - 1.9);
      context.lineTo(rocketNoseTipX + rocketOffsetX, rocketY);
      context.lineTo(rocketBodyFrontX + rocketOffsetX, rocketY + 1.9);
      context.closePath();
      context.fill();
      context.stroke();

      context.fillStyle = "#ff9d5c";
      context.beginPath();
      context.moveTo(-7.8 + rocketOffsetX, rocketY - 1.65);
      context.lineTo(-9.8 + rocketOffsetX, rocketY - 2.45);
      context.lineTo(-9.2 + rocketOffsetX, rocketY - 0.6);
      context.lineTo(-7.8 + rocketOffsetX, rocketY);
      context.closePath();
      context.fill();
      context.beginPath();
      context.moveTo(-7.8 + rocketOffsetX, rocketY + 1.65);
      context.lineTo(-9.8 + rocketOffsetX, rocketY + 2.45);
      context.lineTo(-9.2 + rocketOffsetX, rocketY + 0.6);
      context.lineTo(-7.8 + rocketOffsetX, rocketY);
      context.closePath();
      context.fill();

      context.fillStyle = "#ffe27a";
      context.beginPath();
      context.arc(-9.4 + rocketOffsetX, rocketY, 0.85, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }

    if (upgradePipCount > 0) {
      const pipPositions = [
        [{ x: -1.6, y: 8.2 }],
        [{ x: -1.6, y: 8.2 }, { x: 1.6, y: 8.2 }],
        [{ x: -1.6, y: 8.2 }, { x: 1.6, y: 8.2 }, { x: 0, y: -8.2 }],
        [{ x: -1.6, y: 8.2 }, { x: 1.6, y: 8.2 }, { x: -1.6, y: -8.2 }, { x: 1.6, y: -8.2 }],
      ][upgradePipCount - 1];
      context.fillStyle = "#ffe27a";
      for (const pip of pipPositions) {
        context.beginPath();
        context.arc(pip.x, pip.y, 1.25, 0, Math.PI * 2);
        context.fill();
      }
    }

    if (this.muzzleFlashSeconds > 0) {
      const flashAlpha = this.muzzleFlashSeconds / 0.12;
      context.save();
      context.globalCompositeOperation = "lighter";
      context.fillStyle = `rgba(255, 164, 82, ${0.62 * flashAlpha})`;
      context.shadowColor = "#ff9d5c";
      context.shadowBlur = 10;
      context.beginPath();
      context.arc(11.8, 0, 3.5 + (4 * flashAlpha), 0, Math.PI * 2);
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
