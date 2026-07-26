import { AudioCue } from "../../audio-manifest";
import { MAX_TOWER_LEVEL } from "../../constants";
import type { UpdateContext, UpdateResult } from "../../game-engine/update-context";
import { TowerKind, type Point } from "../../types";
import { angleBetween, randomRange, turnAngleTowards } from "../../utils";
import { GUN_PROJECTILE_SPEED_PER_SECOND, GunProjectile } from "../projectiles/gun-projectile";
import { Tower } from "./tower";

const MUZZLE_FLASH_DURATION_SECONDS = 0.055;
const BARREL_FRONT_X_BASE = 16;
const BARREL_FRONT_X_PER_LEVEL = 0.9;
const PROJECTILE_SOURCE_OFFSET = BARREL_FRONT_X_BASE;
const POWERBANK_END_X_BASE = 3.9;
const POWERBANK_END_X_PER_LEVEL = 0.605;

export class GunTower extends Tower {
  static readonly kind = TowerKind.Gun;
  static readonly label = "Gun";
  static readonly summary = "Fast, cheap, accurate lead shots.";
  static readonly baseCost = 2;
  static readonly baseRange = 60;
  static readonly shortcuts = ["1", "g"] as const;

  angle = randomRange(-Math.PI, Math.PI);
  turnSpeedPerSecond = 9.6;
  muzzleFlashSeconds = 0;

  protected updateTower(context: UpdateContext, result: UpdateResult): void {
    this.muzzleFlashSeconds = Math.max(0, this.muzzleFlashSeconds - context.deltaSeconds);
    const tracked = this.findTrackedMonsterInContext(context);
    if (!tracked) {
      return;
    }

    const source = this.getProjectileSource();
    const target = this.calculateIntercept(tracked, GUN_PROJECTILE_SPEED_PER_SECOND, source);
    const targetAngle = angleBetween(this, target);
    this.angle = turnAngleTowards(this.angle, targetAngle, this.turnSpeedPerSecond * context.deltaSeconds);

    const alignedToTarget = this.isAimedAtTarget(this.angle, targetAngle);
    if (alignedToTarget && this.ready()) {
      const actualSource = this.getProjectileSource();
      this.muzzleFlashSeconds = MUZZLE_FLASH_DURATION_SECONDS;
      this.resetCooldown(0.2);
      result.addProjectile(new GunProjectile(actualSource, target, this.level));
      result.playSound(AudioCue.GunFire, actualSource.x, 0.92 + (this.level * 0.08));
    }
  }

  draw(context: CanvasRenderingContext2D, active: boolean): void {
    context.save();
    context.translate(this.x, this.y);
    this.drawBase(context, "#050908", "#ffffff", `rgba(255, 226, 122, ${0.22 + (this.level * 0.02)})`);

    context.save();
    context.rotate(this.angle);
    const barrelRearExtension = this.level > 0
      ? 0.65 * ((MAX_TOWER_LEVEL - this.level) / (MAX_TOWER_LEVEL - 1))
      : 0;
    const barrelBackX = -(this.level * 0.55) - barrelRearExtension;
    const barrelFrontX = BARREL_FRONT_X_BASE + (this.level * BARREL_FRONT_X_PER_LEVEL);
    if (this.level > 0) {
      context.fillStyle = "#ffe27a";
      const pipCount = Math.min(6, this.level);
      const pipSpacing = 0.28;
      const pipSpread = pipSpacing * (pipCount - 1);
      const pipRadius = 7.6 + (this.level * 0.24);
      context.beginPath();
      for (let i = 0; i < pipCount; i += 1) {
        const pipAngle = pipCount === 1
          ? Math.PI
          : Math.PI - (pipSpread / 2) + ((pipSpread * i) / (pipCount - 1));
        const pipX = Math.cos(pipAngle) * pipRadius;
        const pipY = Math.sin(pipAngle) * pipRadius;
        context.moveTo(pipX + 1, pipY);
        context.arc(pipX, pipY, 1, 0, Math.PI * 2);
      }
      context.fill();

      context.strokeStyle = "#9dffd7";
      context.lineWidth = 1.05 + (this.level * 0.1);
      context.lineCap = "butt";
      const powerbankEndX = POWERBANK_END_X_BASE + (this.level * POWERBANK_END_X_PER_LEVEL);
      const powerbankY = 3.1 + (this.level * 0.3);
      context.beginPath();
      context.moveTo(barrelBackX, -powerbankY);
      context.lineTo(powerbankEndX, -powerbankY);
      context.moveTo(barrelBackX, powerbankY);
      context.lineTo(powerbankEndX, powerbankY);
      context.stroke();
    }

    context.strokeStyle = "#ffffff";
    context.lineWidth = 2 + (this.level / 2);
    context.lineCap = "butt";
    context.beginPath();
    context.moveTo(barrelBackX, 0);
    context.lineTo(barrelFrontX, 0);
    context.stroke();

    if (this.muzzleFlashSeconds > 0) {
      const flashAlpha = this.muzzleFlashSeconds / MUZZLE_FLASH_DURATION_SECONDS;
      context.save();
      context.globalCompositeOperation = "lighter";

      context.globalAlpha = 0.16 * flashAlpha;
      context.fillStyle = "#ff9d5c";
      this.traceMuzzleFlash(context, barrelFrontX, 12 + (this.level * 0.55), 5.6);
      context.fill();

      context.globalAlpha = 0.56 * flashAlpha;
      context.fillStyle = "#ffe27a";
      this.traceMuzzleFlash(context, barrelFrontX, 9 + (this.level * 0.45), 3.4);
      context.fill();

      context.globalAlpha = 0.88 * flashAlpha;
      context.fillStyle = "#fff7d1";
      this.traceMuzzleFlash(context, barrelFrontX, 6.2 + (this.level * 0.28), 1.35);
      context.fill();
      context.restore();
    }
    context.restore();

    if (active) {
      this.drawSelection(context);
    }
    context.restore();
  }

  private getProjectileSource(): Point {
    return {
      x: this.x + (Math.cos(this.angle) * PROJECTILE_SOURCE_OFFSET),
      y: this.y + (Math.sin(this.angle) * PROJECTILE_SOURCE_OFFSET),
    };
  }

  private traceMuzzleFlash(
    context: CanvasRenderingContext2D,
    barrelFrontX: number,
    length: number,
    halfHeight: number,
  ): void {
    context.beginPath();
    context.moveTo(barrelFrontX, 0);
    context.lineTo(barrelFrontX + (length * 0.65), -halfHeight);
    context.lineTo(barrelFrontX + length, 0);
    context.lineTo(barrelFrontX + (length * 0.65), halfHeight);
    context.closePath();
  }
}
