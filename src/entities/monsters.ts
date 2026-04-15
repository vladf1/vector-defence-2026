import { MONSTER_PRESETS } from "../constants";
import type { LevelData, MonsterCode, Point } from "../types";
import { angleBetween, distanceXY, randomRange } from "../utils";
import type { GameAccess } from "./types";

export class Monster {
  kind: MonsterCode;
  x: number;
  y: number;
  dx = 0;
  dy = 0;
  speed: number;
  maxSpeed: number;
  hp: number;
  maxHp: number;
  bounty: number;
  radius: number;
  color: string;
  path: Point[];
  targetIndex = 1;
  rotation = randomRange(0, Math.PI * 2);
  angle = 0;
  damageFlash = 0;
  removed = false;

  constructor(kind: MonsterCode, level: LevelData) {
    const preset = MONSTER_PRESETS[kind];
    const start = level.points[0];
    this.kind = kind;
    this.x = start.x;
    this.y = start.y;
    this.maxSpeed = preset.speed;
    this.speed = preset.speed;
    this.hp = preset.hp;
    this.maxHp = preset.hp;
    this.bounty = preset.bounty;
    this.radius = preset.radius;
    this.color = preset.color;
    this.path = level.points;
    const initialTarget = level.points[1] ?? level.points[0];
    this.angle = angleBetween(start, initialTarget);
    this.dx = Math.cos(this.angle) * this.speed;
    this.dy = Math.sin(this.angle) * this.speed;
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
    this.damageFlash = 1;
  }

  slowDown(factor: number): void {
    this.speed = Math.min(this.speed, this.maxSpeed * factor);
  }

  update(game: GameAccess, multiplier: number): void {
    if (this.hp <= 0) {
      this.removed = true;
      game.onMonsterKilled(this);
      return;
    }

    if (this.speed < this.maxSpeed) {
      this.speed = Math.min(this.maxSpeed, this.speed + (0.01 * multiplier));
    }

    let remainingStep = this.speed * multiplier;
    while (remainingStep > 0 && !this.removed) {
      const destination = this.path[this.targetIndex];
      if (!destination) {
        this.removed = true;
        game.onMonsterEscaped(this);
        return;
      }

      const toTarget = distanceXY(this.x, this.y, destination.x, destination.y);
      if (toTarget <= remainingStep) {
        this.x = destination.x;
        this.y = destination.y;
        this.targetIndex += 1;
        const nextDestination = this.path[this.targetIndex];
        if (!nextDestination) {
          this.removed = true;
          game.onMonsterEscaped(this);
          return;
        }
        this.angle = angleBetween({ x: this.x, y: this.y }, nextDestination);
        this.dx = Math.cos(this.angle) * this.speed;
        this.dy = Math.sin(this.angle) * this.speed;
        remainingStep -= toTarget;
      } else {
        this.angle = angleBetween({ x: this.x, y: this.y }, destination);
        this.dx = Math.cos(this.angle) * this.speed;
        this.dy = Math.sin(this.angle) * this.speed;
        this.x += this.dx * (remainingStep / this.speed);
        this.y += this.dy * (remainingStep / this.speed);
        remainingStep = 0;
      }
    }

    if (this.kind === "square") {
      this.rotation += 0.07 * multiplier;
    }
    this.damageFlash = Math.max(0, this.damageFlash - (0.03 * multiplier));
  }

  draw(context: CanvasRenderingContext2D): void {
    const damageMix = this.damageFlash;
    context.save();
    context.translate(this.x, this.y);
    context.strokeStyle = this.color;
    context.fillStyle = damageMix > 0 ? `rgba(153, 79, 255, ${0.25 + (damageMix * 0.55)})` : "#050908";
    context.lineWidth = 1.5;

    if (this.kind === "ball") {
      context.beginPath();
      context.arc(0, 0, this.radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    } else if (this.kind === "square") {
      context.rotate(this.rotation);
      context.fillRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
      context.strokeRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
    } else if (this.kind === "triangle") {
      context.rotate(this.angle);
      context.beginPath();
      context.moveTo(6, 0);
      context.lineTo(-6, -6);
      context.lineTo(-6, 6);
      context.closePath();
      context.fill();
      context.stroke();
    } else if (this.kind === "runner") {
      context.rotate(this.angle);
      context.beginPath();
      context.moveTo(this.radius * 1.7, 0);
      context.lineTo(-this.radius * 0.1, -this.radius * 0.82);
      context.lineTo(-this.radius * 1.35, 0);
      context.lineTo(-this.radius * 0.1, this.radius * 0.82);
      context.closePath();
      context.fill();
      context.stroke();
      context.beginPath();
      context.moveTo(-this.radius * 0.95, 0);
      context.lineTo(-this.radius * 1.5, -this.radius * 0.55);
      context.moveTo(-this.radius * 0.95, 0);
      context.lineTo(-this.radius * 1.5, this.radius * 0.55);
      context.stroke();
    } else {
      context.rotate(this.angle);
      context.fillRect(-this.radius, -this.radius * 0.72, this.radius * 2.1, this.radius * 1.44);
      context.strokeRect(-this.radius, -this.radius * 0.72, this.radius * 2.1, this.radius * 1.44);
      const turretCenterX = this.radius * 0.08;
      const turretRadius = this.radius * 0.42;
      context.beginPath();
      context.arc(turretCenterX, 0, turretRadius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.beginPath();
      context.moveTo(turretCenterX + (turretRadius * 0.92), 0);
      context.lineTo(this.radius * 1.52, 0);
      context.stroke();
    }
    context.restore();

    const barWidth = Math.max(16, this.radius * 2);
    const fillWidth = barWidth * (this.hp / this.maxHp);
    context.fillStyle = "rgba(5, 10, 8, 0.85)";
    context.fillRect(this.x - (barWidth / 2), this.y - this.radius - 7, barWidth, 3);
    context.fillStyle = "#4cff90";
    context.fillRect(this.x - (barWidth / 2), this.y - this.radius - 7, fillWidth, 3);
  }
}
