import { TOWER_RADIUS, TOWER_UPGRADE_RING_GROWTH, TOWER_UPGRADE_RING_OFFSET } from "../../constants";
import type { Game } from "../../game-engine";
import { AudioCue, TowerKind } from "../../types";
import { angleBetween, randomRange, turnAngleTowards } from "../../utils";
import { Projectile } from "../projectiles/projectile";
import { Tower } from "./tower";

export class GunTower extends Tower {
  static readonly kind = TowerKind.Gun;
  static readonly label = "Gun";
  static readonly summary = "Fast, cheap, accurate lead shots.";
  static readonly baseCost = 20;
  static readonly baseRange = 60;
  static readonly shortcuts = ["1", "g"] as const;

  angle = randomRange(-Math.PI, Math.PI);
  turnSpeedPerSecond = 9.6;
  muzzleFlashSeconds = 0;

  constructor(x: number, y: number) {
    super(x, y);
  }

  protected onUpdate(game: Game, deltaSeconds: number): void {
    this.muzzleFlashSeconds = Math.max(0, this.muzzleFlashSeconds - deltaSeconds);
    const tracked = this.getTrackedMonster(game);
    if (!tracked) {
      return;
    }

    const source = {
      x: this.x + (Math.cos(this.angle) * 16),
      y: this.y + (Math.sin(this.angle) * 16),
    };
    const target = this.calculateIntercept(tracked, 420, source);
    const targetAngle = angleBetween({ x: this.x, y: this.y }, target);
    this.angle = turnAngleTowards(this.angle, targetAngle, this.turnSpeedPerSecond * deltaSeconds);

    const alignedToTarget = this.isAimedAtTarget(this.angle, targetAngle);
    if (alignedToTarget && this.ready()) {
      const actualSource = {
        x: this.x + (Math.cos(this.angle) * 16),
        y: this.y + (Math.sin(this.angle) * 16),
      };
      game.runtime.projectiles.push(new Projectile(actualSource, target, 10 + this.level, 3 + (this.level / 2)));
      this.muzzleFlashSeconds = 0.055;
      game.playSound(AudioCue.GunFire, actualSource.x, 0.92 + (this.level * 0.08));
      this.resetCooldown(0.2);
    }
  }

  draw(context: CanvasRenderingContext2D, active: boolean): void {
    context.save();
    context.translate(this.x, this.y);
    context.strokeStyle = "#ffffff";
    context.fillStyle = "#050908";
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
    if (this.level > 0) {
      context.fillStyle = "#ffe27a";
      const pipCount = Math.min(6, this.level);
      for (let i = 0; i < pipCount; i += 1) {
        const pipSpacing = 0.28;
        const pipSpread = pipSpacing * (pipCount - 1);
        const pipAngle = pipCount === 1
          ? Math.PI
          : Math.PI - (pipSpread / 2) + ((pipSpread * i) / (pipCount - 1));
        const pipRadius = 7.6 + (this.level * 0.24);
        context.beginPath();
        context.arc(Math.cos(pipAngle) * pipRadius, Math.sin(pipAngle) * pipRadius, 1, 0, Math.PI * 2);
        context.fill();
      }

      context.strokeStyle = "#9dffd7";
      context.lineWidth = 1.2;
      context.lineCap = "round";
      const powerbankStartX = -4 + (this.level * 0.22);
      const powerbankEndX = 4.6 + (this.level * 1.05);
      context.beginPath();
      context.moveTo(powerbankStartX, -4.25 - (this.level * 0.2));
      context.lineTo(powerbankEndX, -3.65 - (this.level * 0.13));
      context.moveTo(powerbankStartX, 4.25 + (this.level * 0.2));
      context.lineTo(powerbankEndX, 3.65 + (this.level * 0.13));
      context.stroke();
    }

    context.strokeStyle = "#ffffff";
    context.lineWidth = 2 + (this.level / 2);
    context.lineCap = "butt";
    const barrelBackX = -(this.level * 0.55);
    const barrelFrontX = 16 + (this.level * 0.9);
    context.beginPath();
    context.moveTo(barrelBackX, 0);
    context.lineTo(barrelFrontX, 0);
    context.stroke();

    if (this.muzzleFlashSeconds > 0) {
      const flashAlpha = this.muzzleFlashSeconds / 0.055;
      context.save();
      context.globalCompositeOperation = "lighter";
      context.fillStyle = `rgba(255, 239, 156, ${0.78 * flashAlpha})`;
      context.shadowColor = "#ffe27a";
      context.shadowBlur = 8;
      context.beginPath();
      context.moveTo(barrelFrontX, 0);
      context.lineTo(22 + (this.level * 1.2), -3.4);
      context.lineTo(25 + (this.level * 1.35), 0);
      context.lineTo(22 + (this.level * 1.2), 3.4);
      context.closePath();
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
