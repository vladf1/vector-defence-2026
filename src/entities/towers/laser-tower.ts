import { TowerKind } from "../../types";
import { angleBetween, pointToSegmentDistanceSquaredXY, randomRange, turnAngleTowards } from "../../utils";
import type { GameAccess } from "../game-access";
import { Tower } from "./tower-base";

export class LaserTower extends Tower {
  angle = randomRange(-Math.PI, Math.PI);
  beamAlpha = 0;
  beamTarget = { x: 0, y: 0 };
  damagePerHit = 1;
  turnSpeed = 0.08;

  constructor(x: number, y: number) {
    super(TowerKind.Laser, x, y);
  }

  protected onUpdate(game: GameAccess, multiplier: number): void {
    this.beamAlpha = Math.max(0, this.beamAlpha - (0.015 * multiplier));
    const tracked = this.getClosestMonster(game);
    if (!tracked) {
      return;
    }

    const target = { x: tracked.x, y: tracked.y };
    const targetAngle = angleBetween({ x: this.x, y: this.y }, target);
    this.angle = turnAngleTowards(this.angle, targetAngle, this.turnSpeed * multiplier);
    this.beamTarget = {
      x: this.x + (Math.cos(this.angle) * 1000),
      y: this.y + (Math.sin(this.angle) * 1000),
    };

    if (this.ready()) {
      this.beamAlpha = 1;
      this.resetCooldown(1500);
    }

    if (this.beamAlpha <= 0) {
      return;
    }

    const source = {
      x: this.x + (Math.cos(this.angle) * 9),
      y: this.y + (Math.sin(this.angle) * 9),
    };

    for (const monster of game.activeMonsters) {
      const distSq = pointToSegmentDistanceSquaredXY(monster.x, monster.y, source.x, source.y, this.beamTarget.x, this.beamTarget.y);
      if (distSq <= monster.radius * monster.radius) {
        monster.takeDamage(this.damagePerHit * multiplier * this.beamAlpha);
      }
    }
  }

  protected onUpgrade(): void {
    this.damagePerHit = 1 + (this.level / 4);
  }

  draw(context: CanvasRenderingContext2D, active: boolean): void {
    context.save();
    context.translate(this.x, this.y);
    context.fillStyle = "#050908";
    context.strokeStyle = "#ffffff";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(0, 0, 12.5, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    context.rotate(this.angle);
    context.fillStyle = "#5bf4ff";
    context.beginPath();
    context.moveTo(-10, 5);
    context.lineTo(-2, 4);
    context.lineTo(10, 0);
    context.lineTo(-2, -4);
    context.lineTo(-10, -5);
    context.closePath();
    context.fill();
    context.stroke();
    if (active) {
      this.drawSelection(context);
    }
    context.restore();

    if (this.beamAlpha > 0) {
      context.save();
      context.strokeStyle = `rgba(110, 255, 152, ${0.85 * this.beamAlpha})`;
      context.lineWidth = 1.5 + (this.level / 3);
      context.beginPath();
      context.moveTo(this.x + (Math.cos(this.angle) * 9), this.y + (Math.sin(this.angle) * 9));
      context.lineTo(this.beamTarget.x, this.beamTarget.y);
      context.stroke();
      context.restore();
    }
  }
}
