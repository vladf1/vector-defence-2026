import type { UpdateContext, UpdateResult } from "../../game-engine/update-context";
import { AudioCue, TowerKind } from "../../types";
import { angleBetween, randomRange, turnAngleTowards } from "../../utils";
import { Missile } from "../projectiles/missile";
import { Tower } from "./tower";

const MISSILE_FIRING_ANGLE_TOLERANCE = Math.PI / 12;

export class MissileTower extends Tower {
  static readonly kind = TowerKind.Missile;
  static readonly label = "Missile";
  static readonly summary = "Slow launcher with splash damage.";
  static readonly baseCost = 5;
  static readonly baseRange = 150;
  static readonly shortcuts = ["3", "r"] as const;

  angle = randomRange(-Math.PI, Math.PI);
  turnSpeedPerSecond = 3.6;
  muzzleFlashSeconds = 0;

  constructor(x: number, y: number) {
    super(x, y);
  }

  protected updateTower(context: UpdateContext, result: UpdateResult): void {
    this.muzzleFlashSeconds = Math.max(0, this.muzzleFlashSeconds - context.deltaSeconds);
    const tracked = this.findTrackedMonsterInContext(context);
    let alignedToTarget = false;

    if (tracked) {
      const targetAngle = angleBetween(this, tracked);
      this.angle = turnAngleTowards(this.angle, targetAngle, this.turnSpeedPerSecond * context.deltaSeconds);
      alignedToTarget = this.isAimedAtTarget(this.angle, targetAngle, MISSILE_FIRING_ANGLE_TOLERANCE);
    }

    if (tracked && alignedToTarget && this.ready()) {
      const source = {
        x: this.x + (Math.cos(this.angle) * 14),
        y: this.y + (Math.sin(this.angle) * 14),
      };
      this.muzzleFlashSeconds = 0.12;
      this.resetCooldown(2 - (0.2 * this.level));
      result.addMissile(new Missile(source, tracked, this.level, this.angle));
      result.playSound(AudioCue.MissileLaunch, source.x, 1 + (this.level * 0.09));
    }
  }

  draw(context: CanvasRenderingContext2D, active: boolean): void {
    context.save();
    context.translate(this.x, this.y);
    this.drawBase(context, "#08100d", "#d7e2ea", `rgba(255, 226, 122, ${0.22 + (this.level * 0.02)})`);

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
      const enlargedRocket = rocketYs.length < 3 || accentRocket;
      const rocketScale = enlargedRocket ? 1.15 : 1;
      const rocketOffsetX = 1.8;
      const baseTailX = -7.8;
      const baseBodyFrontX = 3.4 + rocketLengthBonus;
      const baseNoseTipX = 8.9 + rocketLengthBonus;
      const rocketCenterX = (baseTailX + baseNoseTipX) / 2;
      const scaleRocketX = (x: number) => rocketOffsetX + rocketCenterX + ((x - rocketCenterX) * rocketScale);
      const rocketBodyFrontX = scaleRocketX(baseBodyFrontX);
      const rocketNoseTipX = scaleRocketX(baseNoseTipX);
      const rocketColor = this.ready() ? accentRocket ? "#ff9d5c" : "#ffe27a" : "#78838b";
      const noseColor = this.ready() ? accentRocket ? "#ffe27a" : "#fff1ac" : "#a1abb2";
      const rocketTailX = scaleRocketX(baseTailX);
      const bodyHalfHeight = 1.65 * rocketScale;
      const noseHalfHeight = 1.9 * rocketScale;
      context.fillStyle = rocketColor;
      context.strokeStyle = "#06100f";
      context.lineWidth = 0.8;
      context.beginPath();
      context.moveTo(rocketTailX, rocketY - bodyHalfHeight);
      context.lineTo(rocketBodyFrontX, rocketY - bodyHalfHeight);
      context.lineTo(rocketNoseTipX, rocketY);
      context.lineTo(rocketBodyFrontX, rocketY + bodyHalfHeight);
      context.lineTo(rocketTailX, rocketY + bodyHalfHeight);
      context.closePath();
      context.fill();
      context.stroke();

      context.fillStyle = noseColor;
      context.beginPath();
      context.moveTo(rocketBodyFrontX, rocketY - noseHalfHeight);
      context.lineTo(rocketNoseTipX, rocketY);
      context.lineTo(rocketBodyFrontX, rocketY + noseHalfHeight);
      context.closePath();
      context.fill();

      context.fillStyle = "#ff9d5c";
      context.fillRect(rocketTailX - (1.8 * rocketScale), rocketY - (0.85 * rocketScale), 1.8 * rocketScale, 1.7 * rocketScale);
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
      context.beginPath();
      for (const pip of pipPositions) {
        context.moveTo(pip.x + 1.25, pip.y);
        context.arc(pip.x, pip.y, 1.25, 0, Math.PI * 2);
      }
      context.fill();
    }

    if (this.muzzleFlashSeconds > 0) {
      const flashAlpha = this.muzzleFlashSeconds / 0.12;
      context.save();
      context.globalCompositeOperation = "lighter";

      context.globalAlpha = 0.16 * flashAlpha;
      context.fillStyle = "#ff7b42";
      context.beginPath();
      context.arc(11.8, 0, 6.5 + (3.5 * flashAlpha), 0, Math.PI * 2);
      context.fill();

      context.globalAlpha = 0.4 * flashAlpha;
      context.fillStyle = "#ff9d5c";
      context.beginPath();
      context.arc(11.8, 0, 4.5 + (2.5 * flashAlpha), 0, Math.PI * 2);
      context.fill();

      context.globalAlpha = 0.78 * flashAlpha;
      context.fillStyle = "#ffe27a";
      context.beginPath();
      context.arc(11.8, 0, 2.4 + (1.6 * flashAlpha), 0, Math.PI * 2);
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
