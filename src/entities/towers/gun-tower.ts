import { TOWER_RADIUS } from "../../constants";
import type { Game } from "../../game-engine";
import { TowerKind } from "../../types";
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

  constructor(x: number, y: number) {
    super(x, y);
  }

  protected onUpdate(game: Game, deltaSeconds: number): void {
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
      this.resetCooldown(0.2);
    }
  }

  protected onUpgrade(): void {
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

    context.strokeStyle = "#ffffff";
    context.lineWidth = 2 + (this.level / 2);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(Math.cos(this.angle) * 16, Math.sin(this.angle) * 16);
    context.stroke();
    if (active) {
      this.drawSelection(context);
    }
    context.restore();
  }
}
