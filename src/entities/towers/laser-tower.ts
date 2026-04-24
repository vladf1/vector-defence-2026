import type { Game } from "../../game-engine";
import { TowerKind } from "../../types";
import { angleBetween, calculateDistanceToSegment, randomRange, turnAngleTowards } from "../../utils";
import { Tower } from "./tower";

const LASER_COLORS = [
  { body: "#5bf4ff", accent: "#9dffd7", ring: "110, 255, 152", beam: "110, 255, 152" },
  { body: "#6dff9c", accent: "#d8ff4f", ring: "216, 255, 79", beam: "185, 255, 105" },
  { body: "#ffe36f", accent: "#ff9d5c", ring: "255, 227, 111", beam: "255, 227, 111" },
  { body: "#ff8edb", accent: "#b58cff", ring: "255, 142, 219", beam: "255, 142, 219" },
] as const;

export class LaserTower extends Tower {
  static readonly kind = TowerKind.Laser;
  static readonly label = "Laser";
  static readonly summary = "Piercing beam that melts lines of enemies.";
  static readonly baseCost = 30;
  static readonly baseRange = 100;
  static readonly shortcuts = ["2", "z"] as const;

  angle = randomRange(-Math.PI, Math.PI);
  beamAlpha = 0;
  beamTarget = { x: 0, y: 0 };
  damagePerSecond = 60;
  turnSpeedPerSecond = 4.8;

  constructor(x: number, y: number) {
    super(x, y);
  }

  protected onUpdate(game: Game, deltaSeconds: number): void {
    this.beamAlpha = Math.max(0, this.beamAlpha - (0.9 * deltaSeconds));
    const tracked = this.getTrackedMonster(game);
    if (!tracked) {
      return;
    }

    const target = { x: tracked.x, y: tracked.y };
    const targetAngle = angleBetween({ x: this.x, y: this.y }, target);
    this.angle = turnAngleTowards(this.angle, targetAngle, this.turnSpeedPerSecond * deltaSeconds);
    this.beamTarget = {
      x: this.x + (Math.cos(this.angle) * 1000),
      y: this.y + (Math.sin(this.angle) * 1000),
    };

    const alignedToTarget = this.isAimedAtTarget(this.angle, targetAngle);
    if (alignedToTarget && this.ready()) {
      this.beamAlpha = 1;
      this.resetCooldown(1.5);
    }

    if (this.beamAlpha <= 0) {
      return;
    }

    const source = {
      x: this.x + (Math.cos(this.angle) * 9),
      y: this.y + (Math.sin(this.angle) * 9),
    };

    for (const monster of game.runtime.getActiveMonsters()) {
      const distanceToBeam = calculateDistanceToSegment(monster.x, monster.y, source.x, source.y, this.beamTarget.x, this.beamTarget.y);
      if (distanceToBeam <= monster.radius) {
        monster.takeDamage(this.damagePerSecond * deltaSeconds * this.beamAlpha);
      }
    }
  }

  protected onUpgrade(): void {
    this.damagePerSecond = 60 + (15 * this.level);
  }

  private getLaserColors(): typeof LASER_COLORS[number] {
    return LASER_COLORS[Math.min(this.level, LASER_COLORS.length - 1)];
  }

  draw(context: CanvasRenderingContext2D, active: boolean): void {
    const colors = this.getLaserColors();

    context.save();
    context.translate(this.x, this.y);
    context.fillStyle = "#050908";
    context.strokeStyle = "#ffffff";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(0, 0, 12.5, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    if (this.level > 0) {
      context.strokeStyle = `rgba(${colors.ring}, ${0.22 + (this.level * 0.02)})`;
      context.lineWidth = 0.9 + (this.level * 0.08);
      context.beginPath();
      context.arc(0, 0, 13.2 + (this.level * 0.25), 0, Math.PI * 2);
      context.stroke();
    }

    context.rotate(this.angle);
    context.fillStyle = colors.body;
    context.beginPath();
    context.moveTo(-10 - (this.level * 0.35), 5 + (this.level * 0.18));
    context.lineTo(-2, 4);
    context.lineTo(10 + (this.level * 0.75), 0);
    context.lineTo(-2, -4);
    context.lineTo(-10 - (this.level * 0.35), -5 - (this.level * 0.18));
    context.closePath();
    context.fill();
    context.stroke();

    if (this.level > 0) {
      context.fillStyle = colors.accent;
      context.fillRect(-7, -7 - (this.level * 0.15), 8 + this.level, 1.8);
      context.fillRect(-7, 5.2 + (this.level * 0.15), 8 + this.level, 1.8);
    }

    if (active) {
      this.drawSelection(context);
    }
    context.restore();

    if (this.beamAlpha > 0) {
      const sourceX = this.x + (Math.cos(this.angle) * 9);
      const sourceY = this.y + (Math.sin(this.angle) * 9);
      context.save();
      context.globalCompositeOperation = "lighter";
      context.shadowColor = `rgba(${colors.beam}, ${0.7 * this.beamAlpha})`;
      context.shadowBlur = 14 + (this.level * 2);
      context.strokeStyle = `rgba(${colors.beam}, ${0.2 * this.beamAlpha})`;
      context.lineWidth = 7 + (this.level * 0.55);
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(sourceX, sourceY);
      context.lineTo(this.beamTarget.x, this.beamTarget.y);
      context.stroke();
      context.strokeStyle = `rgba(${colors.beam}, ${0.85 * this.beamAlpha})`;
      context.lineWidth = 1.5 + (this.level / 3);
      context.beginPath();
      context.moveTo(sourceX, sourceY);
      context.lineTo(this.beamTarget.x, this.beamTarget.y);
      context.stroke();
      context.fillStyle = `rgba(${colors.beam}, ${0.35 * this.beamAlpha})`;
      context.beginPath();
      context.arc(sourceX, sourceY, 4 + (this.level * 0.35), 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }
}
