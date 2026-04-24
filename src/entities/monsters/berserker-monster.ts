import type { Point } from "../../types";
import { Monster } from "./monster";

const BASE_COLOR = "#ff7a4f";
const ENRAGED_COLOR = "#ff5a36";
const FRENZIED_COLOR = "#ff3158";
const BASE_SPEED_PER_SECOND = 62;
const ENRAGED_SPEED_PER_SECOND = 100;
const FRENZIED_SPEED_PER_SECOND = 138;
const HIT_POINTS = 286;
const BOUNTY = 38;
const RADIUS = 8;

export class BerserkerMonster extends Monster {
  private rageStage = 0;

  constructor(path: Point[]) {
    super(path, BASE_COLOR, BASE_SPEED_PER_SECOND, HIT_POINTS, BOUNTY, RADIUS);
  }

  protected updateSpecial(deltaSeconds: number): void {
    const nextStage = this.hitPoints <= this.maxHitPoints * 0.2
      ? 2
      : (this.hitPoints <= this.maxHitPoints * 0.5 ? 1 : 0);

    if (nextStage !== this.rageStage) {
      this.rageStage = nextStage;
      const burstFloor = this.getStageSpeedPerSecond() * (0.72 + (this.rageStage * 0.08));
      this.speedPerSecond = Math.max(this.speedPerSecond, burstFloor);
    }

    this.maxSpeedPerSecond = this.getStageSpeedPerSecond();
    this.color = this.getStageColor();

    if (this.speedPerSecond < this.maxSpeedPerSecond) {
      this.speedPerSecond = Math.min(this.maxSpeedPerSecond, this.speedPerSecond + ((50.4 + (this.rageStage * 43.2)) * deltaSeconds));
    } else if (this.speedPerSecond > this.maxSpeedPerSecond) {
      this.speedPerSecond = this.maxSpeedPerSecond;
    }

    this.velocityXPerSecond = Math.cos(this.angle) * this.speedPerSecond;
    this.velocityYPerSecond = Math.sin(this.angle) * this.speedPerSecond;
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.angle);
    context.beginPath();
    context.moveTo(this.radius * 1.55, 0);
    context.lineTo(this.radius * 0.4, -this.radius * 0.8);
    context.lineTo(-this.radius * 0.1, -this.radius * 1.08);
    context.lineTo(-this.radius * 1.28, -this.radius * 0.44);
    context.lineTo(-this.radius * 0.72, 0);
    context.lineTo(-this.radius * 1.28, this.radius * 0.44);
    context.lineTo(-this.radius * 0.1, this.radius * 1.08);
    context.lineTo(this.radius * 0.4, this.radius * 0.8);
    context.closePath();
    context.fill();
    context.stroke();

    context.beginPath();
    context.moveTo(-this.radius * 0.3, -this.radius * 0.16);
    context.lineTo(this.radius * 0.68, -this.radius * 0.44);
    context.moveTo(-this.radius * 0.3, this.radius * 0.16);
    context.lineTo(this.radius * 0.68, this.radius * 0.44);
    context.stroke();

    if (this.rageStage > 0) {
      context.beginPath();
      context.moveTo(-this.radius * 0.92, -this.radius * 0.78);
      context.lineTo(-this.radius * 0.5, -this.radius * 0.18);
      context.lineTo(-this.radius * 1.02, 0);
      context.lineTo(-this.radius * 0.5, this.radius * 0.18);
      context.lineTo(-this.radius * 0.92, this.radius * 0.78);
      context.stroke();
    }
  }

  private getStageColor(): string {
    if (this.rageStage === 2) {
      return FRENZIED_COLOR;
    }
    if (this.rageStage === 1) {
      return ENRAGED_COLOR;
    }
    return BASE_COLOR;
  }

  private getStageSpeedPerSecond(): number {
    if (this.rageStage === 2) {
      return FRENZIED_SPEED_PER_SECOND;
    }
    if (this.rageStage === 1) {
      return ENRAGED_SPEED_PER_SECOND;
    }
    return BASE_SPEED_PER_SECOND;
  }
}
