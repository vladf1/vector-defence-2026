import { TOWER_RADIUS } from "../../constants";
import type { UpdateContext, UpdateResult } from "../../game-engine/update-context";
import { AudioCue, TowerKind } from "../../types";
import { DRONE_ACCENT_COLORS } from "../drone-visuals";
import { Drone } from "../projectiles/drone";
import { Tower } from "./tower";

const DRONE_COOLDOWN_SECONDS = 30;
const DOCKED_DRONE_PROPELLERS = [
  { x: -6.9, y: -6.9 },
  { x: 6.9, y: -6.9 },
  { x: -6.9, y: 6.9 },
  { x: 6.9, y: 6.9 },
] as const;

export class DroneTower extends Tower {
  static readonly kind = TowerKind.Drone;
  static readonly label = "Drone";
  static readonly summary = "Launches one autonomous hunter drone on a long cooldown.";
  static readonly baseCost = 5;
  static readonly baseRange = 115;
  static readonly shortcuts = ["5", "d"] as const;

  constructor(x: number, y: number) {
    super(x, y);
  }

  protected updateTower(context: UpdateContext, result: UpdateResult): void {
    if (!this.ready()) {
      return;
    }

    const target = this.findClosestMonsterInContext(context);
    if (!target) {
      return;
    }

    result.addDrone(new Drone({ x: this.x, y: this.y }, this.level));
    this.resetCooldown(DRONE_COOLDOWN_SECONDS);
    result.playSound(AudioCue.GunFire, this.x, 0.22 + (this.level * 0.025));
  }

  draw(context: CanvasRenderingContext2D, active: boolean): void {
    const accent = this.getAccentColor();
    const ready = this.ready();
    const cooldownProgress = 1 - Math.min(1, this.cooldownSeconds / DRONE_COOLDOWN_SECONDS);

    context.save();
    context.translate(this.x, this.y);
    this.drawBase(context, "#06100f", "#effff7", `rgba(157, 255, 215, ${0.22 + (this.level * 0.02)})`);

    if (!ready) {
      context.strokeStyle = accent;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(0, 0, TOWER_RADIUS - 2.2, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * cooldownProgress));
      context.stroke();
    }

    this.drawDockedDrone(context, accent, ready);

    if (active) {
      this.drawSelection(context);
    }
    context.restore();
  }

  private drawDockedDrone(context: CanvasRenderingContext2D, accent: string, ready: boolean): void {
    const scale = 0.7 + (this.level * 0.028);
    const propellerRadius = 2.85 + (this.level * 0.15);
    const motorRadius = 1.15 + (this.level * 0.09);
    const propellerAlpha = ready ? 0.28 : 0.16;

    context.save();
    context.scale(scale, scale);
    context.strokeStyle = ready ? "#effff7" : "rgba(239, 255, 247, 0.58)";
    context.lineWidth = 1.18;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(-6.9, -6.9);
    context.lineTo(6.9, 6.9);
    context.moveTo(6.9, -6.9);
    context.lineTo(-6.9, 6.9);
    context.stroke();

    for (const propeller of DOCKED_DRONE_PROPELLERS) {
      context.fillStyle = `rgba(239, 255, 247, ${propellerAlpha})`;
      context.beginPath();
      context.arc(propeller.x, propeller.y, propellerRadius, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = ready ? accent : "rgba(136, 153, 148, 0.8)";
      context.beginPath();
      context.arc(propeller.x, propeller.y, motorRadius, 0, Math.PI * 2);
      context.fill();
    }

    context.fillStyle = "#06100f";
    context.strokeStyle = "#effff7";
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(-3.9, -3.9, 7.8, 7.8, 1.5);
    context.fill();
    context.stroke();

    context.fillStyle = ready ? accent : "rgba(160, 177, 172, 0.78)";
    context.fillRect(-1.8, -0.9, 3.6 + (this.level * 0.16), 1.8);

    if (this.level >= 3) {
      context.strokeStyle = ready ? accent : "rgba(160, 177, 172, 0.78)";
      context.lineWidth = 0.75;
      context.beginPath();
      context.moveTo(-2.8, -5.2);
      context.lineTo(2.8, -5.2);
      context.moveTo(-2.8, 5.2);
      context.lineTo(2.8, 5.2);
      context.stroke();
    }
    context.restore();
  }

  private getAccentColor(): string {
    return DRONE_ACCENT_COLORS[Math.min(this.level, DRONE_ACCENT_COLORS.length - 1)];
  }
}
