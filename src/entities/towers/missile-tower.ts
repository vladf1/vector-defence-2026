import { AudioCue } from "../../audio-manifest";
import type { UpdateContext, UpdateResult } from "../../game-engine/update-context";
import { TowerKind } from "../../types";
import { angleBetween, clamp, randomRange, turnAngleTowards } from "../../utils";
import { Missile } from "../projectiles/missile";
import { createMissileVisual, drawMissileBody, getMissileScale } from "../projectiles/missile-visuals";
import { Tower } from "./tower";

const MISSILE_FIRING_ANGLE_TOLERANCE = Math.PI / 12;
const MISSILE_RACK_CENTER_X = 0;
const EMPTY_LAUNCHER_CENTER_X = -1;
const MISSILE_RACK_Y_OFFSETS = [
  [0],
  [-3.1, 3.1],
  [-4.5, 0, 4.5],
] as const;

export class MissileTower extends Tower {
  static readonly kind = TowerKind.Missile;
  static readonly label = "Missile";
  static readonly summary = "Slow launcher with splash damage.";
  static readonly baseCost = 5;
  static readonly baseRange = 150;
  static readonly shortcuts = ["3", "r"] as const;

  angle = randomRange(-Math.PI, Math.PI);
  turnSpeedPerSecond = 3.6;
  emptyMissileIndex?: number;
  private lastReloadedMissileIndex?: number;

  constructor(x: number, y: number) {
    super(x, y);
  }

  protected updateTower(context: UpdateContext, result: UpdateResult): void {
    if (this.ready() && this.emptyMissileIndex !== undefined) {
      this.lastReloadedMissileIndex = this.emptyMissileIndex;
      this.emptyMissileIndex = undefined;
    }

    const tracked = this.findTrackedMonsterInContext(context);
    let alignedToTarget = false;

    if (tracked) {
      const targetAngle = angleBetween(this, tracked);
      this.angle = turnAngleTowards(this.angle, targetAngle, this.turnSpeedPerSecond * context.deltaSeconds);
      alignedToTarget = this.isAimedAtTarget(this.angle, targetAngle, MISSILE_FIRING_ANGLE_TOLERANCE);
    }

    if (tracked && alignedToTarget && this.ready()) {
      const missileYs = this.getMissileRackYOffsets();
      const missileIndex = this.chooseMissileIndex(missileYs.length);
      const missileVisual = createMissileVisual(missileYs.length, missileIndex, this.level);
      const missileY = missileYs[missileIndex];
      const cos = Math.cos(this.angle);
      const sin = Math.sin(this.angle);
      const source = {
        x: this.x + (cos * MISSILE_RACK_CENTER_X) - (sin * missileY),
        y: this.y + (sin * MISSILE_RACK_CENTER_X) + (cos * missileY),
      };
      this.emptyMissileIndex = missileIndex;
      this.resetCooldown(this.getCooldownDurationSeconds());
      result.addMissile(new Missile(source, tracked, this.level, missileVisual, this.angle));
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
    const missileScale = getMissileScale(this.level);
    const missileYs = this.getMissileRackYOffsets();
    if (this.emptyMissileIndex !== undefined) {
      this.drawEmptyLauncherSlot(context, missileYs[this.emptyMissileIndex]);
    }

    for (const [index, missileY] of missileYs.entries()) {
      if (index === this.emptyMissileIndex) {
        continue;
      }
      context.save();
      context.translate(MISSILE_RACK_CENTER_X, missileY);
      context.scale(missileScale, missileScale);
      drawMissileBody(context, createMissileVisual(missileYs.length, index, this.level));
      context.restore();
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

    context.restore();

    if (active) {
      this.drawSelection(context);
    }
    context.restore();
  }

  private getMissileRackYOffsets(): readonly number[] {
    return MISSILE_RACK_Y_OFFSETS[Math.min(2, this.level)];
  }

  private chooseMissileIndex(missileCount: number): number {
    if (missileCount !== 2) {
      return Math.floor(missileCount / 2);
    }
    if (this.lastReloadedMissileIndex !== undefined) {
      return 1 - this.lastReloadedMissileIndex;
    }
    return Math.floor(randomRange(0, missileCount));
  }

  private getCooldownDurationSeconds(): number {
    return 2 - (0.2 * this.level);
  }

  private drawEmptyLauncherSlot(context: CanvasRenderingContext2D, missileY: number): void {
    const halfHeight = 2.5;
    context.save();
    context.translate(EMPTY_LAUNCHER_CENTER_X, missileY);
    context.fillStyle = "#142320";
    context.strokeStyle = "#4c6560";
    context.lineWidth = 0.9;
    context.beginPath();
    context.moveTo(-9, -halfHeight);
    context.lineTo(4.8, -halfHeight);
    context.lineTo(8.2, -halfHeight + 1.6);
    context.lineTo(8.2, halfHeight - 1.6);
    context.lineTo(4.8, halfHeight);
    context.lineTo(-9, halfHeight);
    context.closePath();
    context.fill();
    context.stroke();

    context.strokeStyle = "rgba(215, 226, 234, 0.62)";
    context.lineWidth = 0.8;
    context.beginPath();
    context.moveTo(-7.5, -halfHeight);
    context.lineTo(-7.5, halfHeight);
    context.moveTo(4.5, -halfHeight);
    context.lineTo(7.6, -halfHeight + 1.8);
    context.moveTo(4.5, halfHeight);
    context.lineTo(7.6, halfHeight - 1.8);
    context.stroke();

    context.strokeStyle = "rgba(255, 226, 122, 0.44)";
    context.lineWidth = 0.75;
    context.beginPath();
    context.moveTo(-7.2, 0);
    context.lineTo(6.8, 0);
    context.stroke();

    context.fillStyle = "#263b37";
    context.strokeStyle = "#8ca29d";
    context.lineWidth = 0.8;
    context.beginPath();
    context.arc(-7.4, 0, 2.25, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    context.fillStyle = "#ffe27a";
    context.beginPath();
    context.arc(-7.4, 0, 0.8, 0, Math.PI * 2);
    context.fill();

    const reloadProgress = 1 - clamp(this.cooldownSeconds / this.getCooldownDurationSeconds(), 0, 1);
    const loaderX = -6.3 + (reloadProgress * 10.8);
    context.fillStyle = "rgba(255, 226, 122, 0.82)";
    context.beginPath();
    context.arc(loaderX, 0, 1.1, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}
