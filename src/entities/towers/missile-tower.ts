import { AudioCue } from "../../audio-manifest";
import { TOWER_RADIUS } from "../../constants";
import type { UpdateContext, UpdateResult } from "../../game-engine/update-context";
import { TowerKind } from "../../types";
import { angleBetween, clamp, easeOutCubic, randomRange, turnAngleTowards } from "../../utils";
import { Missile } from "../projectiles/missile";
import {
  createMissileVisual,
  drawMissileBody,
  getMissileRearX,
  getMissileScale,
} from "../projectiles/missile-visuals";
import { Tower } from "./tower";

const MISSILE_FIRING_ANGLE_TOLERANCE = Math.PI / 12;
const MISSILE_RACK_CENTER_X = 0;
const LOADING_PORT_X = -9.5;
const MISSILE_CLIP_FRONT_X = LOADING_PORT_X + 24;
const RELOAD_START_OFFSET_X = -22;
const LAUNCHER_BASE_HALF_HEIGHT = 3;
const LAUNCHER_FRONT_INSET = 0.8;
const MISSILE_POWERBANK_COLORS = [
  "#9dffd7",
  "#d8ff4f",
  "#ff9d5c",
  "#ff6d8c",
  "#b58cff",
  "#78a7ff",
  "#f6f0ff",
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

  constructor(x: number, y: number) {
    super(x, y);
  }

  protected updateTower(context: UpdateContext, result: UpdateResult): void {
    const tracked = this.findTrackedMonsterInContext(context);
    let alignedToTarget = false;

    if (tracked) {
      const targetAngle = angleBetween(this, tracked);
      this.angle = turnAngleTowards(this.angle, targetAngle, this.turnSpeedPerSecond * context.deltaSeconds);
      alignedToTarget = this.isAimedAtTarget(this.angle, targetAngle, MISSILE_FIRING_ANGLE_TOLERANCE);
    }

    if (tracked && alignedToTarget && this.ready()) {
      const cos = Math.cos(this.angle);
      const sin = Math.sin(this.angle);
      const source = {
        x: this.x + (cos * MISSILE_RACK_CENTER_X),
        y: this.y + (sin * MISSILE_RACK_CENTER_X),
      };
      this.resetCooldown(this.getCooldownDurationSeconds());
      result.addMissile(new Missile(source, tracked, this.level, createMissileVisual(this.level), this.angle));
      result.playSound(AudioCue.MissileLaunch, source.x, 1 + (this.level * 0.09));
    }
  }

  draw(context: CanvasRenderingContext2D, active: boolean): void {
    context.save();
    context.translate(this.x, this.y);
    this.drawBase(context, "#08100d", "#d7e2ea", `rgba(255, 226, 122, ${0.22 + (this.level * 0.02)})`);

    context.save();
    context.rotate(this.angle);
    const loadingPortX = this.getLoadingPortX();
    this.drawLauncher(context, loadingPortX);
    this.drawLoadedMissile(context, loadingPortX);
    this.drawLoadingPort(context, loadingPortX);
    context.restore();

    if (active) {
      this.drawSelection(context);
    }
    context.restore();
  }

  private getCooldownDurationSeconds(): number {
    return 2 - (0.2 * this.level);
  }

  private drawLauncher(context: CanvasRenderingContext2D, loadingPortX: number): void {
    const launcherHalfHeight = this.getLauncherHalfHeight();
    const launcherFrontX = Math.sqrt(
      (TOWER_RADIUS * TOWER_RADIUS) - (launcherHalfHeight * launcherHalfHeight),
    ) - LAUNCHER_FRONT_INSET;
    context.fillStyle = "#142320";
    context.beginPath();
    context.moveTo(loadingPortX, -launcherHalfHeight);
    context.lineTo(launcherFrontX, -launcherHalfHeight);
    context.lineTo(launcherFrontX, launcherHalfHeight);
    context.lineTo(loadingPortX, launcherHalfHeight);
    context.closePath();
    context.fill();

    context.strokeStyle = "rgba(215, 226, 234, 0.62)";
    context.lineWidth = 0.8;
    context.beginPath();
    context.moveTo(-7.3, -launcherHalfHeight);
    context.lineTo(launcherFrontX, -launcherHalfHeight);
    context.moveTo(-7.3, launcherHalfHeight);
    context.lineTo(launcherFrontX, launcherHalfHeight);
    context.stroke();

    if (this.level > 0) {
      const powerbankX = -6.9;
      const powerbankLength = 6.22 + ((this.level - 1) * 1.14);
      const powerbankHeight = 1.5 + (this.level * 0.06);
      const powerbankGap = 1.1;
      const powerbankColor = MISSILE_POWERBANK_COLORS[
        Math.min(this.level, MISSILE_POWERBANK_COLORS.length - 1)
      ];

      context.fillStyle = powerbankColor;
      context.fillRect(
        powerbankX,
        -launcherHalfHeight - powerbankGap - powerbankHeight,
        powerbankLength,
        powerbankHeight,
      );
      context.fillRect(
        powerbankX,
        launcherHalfHeight + powerbankGap,
        powerbankLength,
        powerbankHeight,
      );
    }
  }

  private drawLoadedMissile(context: CanvasRenderingContext2D, loadingPortX: number): void {
    const launcherHalfHeight = this.getLauncherHalfHeight();
    const reloadProgress = this.ready()
      ? 1
      : 1 - clamp(this.cooldownSeconds / this.getCooldownDurationSeconds(), 0, 1);
    const easedReloadProgress = easeOutCubic(reloadProgress);
    const missileOffsetX = RELOAD_START_OFFSET_X * (1 - easedReloadProgress);

    context.save();
    context.beginPath();
    context.rect(
      loadingPortX,
      -launcherHalfHeight,
      MISSILE_CLIP_FRONT_X - loadingPortX,
      launcherHalfHeight * 2,
    );
    context.clip();
    context.translate(MISSILE_RACK_CENTER_X + missileOffsetX, 0);
    const missileScale = getMissileScale(this.level);
    context.scale(missileScale, missileScale);
    drawMissileBody(context, createMissileVisual(this.level));
    context.restore();
  }

  private drawLoadingPort(context: CanvasRenderingContext2D, loadingPortX: number): void {
    const gateFrontX = loadingPortX + 1.45;
    const gateBackX = loadingPortX - 1.55;
    const gateHalfHeight = this.getLauncherHalfHeight() + 0.55;
    const gateColor = MISSILE_POWERBANK_COLORS[
      Math.min(this.level, MISSILE_POWERBANK_COLORS.length - 1)
    ];

    context.fillStyle = "#263b37";
    context.strokeStyle = "#8ca29d";
    context.lineWidth = 0.85;
    context.beginPath();
    context.rect(
      gateBackX,
      -gateHalfHeight,
      gateFrontX - gateBackX,
      gateHalfHeight * 2,
    );
    context.fill();
    context.stroke();

    context.fillStyle = "#07110f";
    context.fillRect(gateBackX + 0.65, -1.85, 1.7, 3.7);

    context.strokeStyle = gateColor;
    context.lineWidth = 0.75;
    context.beginPath();
    context.moveTo(gateFrontX, -2.65);
    context.lineTo(gateFrontX, 2.65);
    context.stroke();
  }

  private getLauncherHalfHeight(): number {
    return LAUNCHER_BASE_HALF_HEIGHT + (0.12 * this.level);
  }

  private getLoadingPortX(): number {
    return LOADING_PORT_X + getMissileRearX(this.level) - getMissileRearX(0);
  }
}
