import type { Point } from "../../types";
import { angleBetween, calculateDistance, randomRange } from "../../utils";

export abstract class Monster extends EventTarget {
  x: number;
  y: number;
  dx = 0;
  dy = 0;
  speed: number;
  maxSpeed: number;
  hitPoints: number;
  maxHitPoints: number;
  bounty: number;
  radius: number;
  color: string;
  path: Point[];
  targetIndex = 1;
  rotation = randomRange(0, Math.PI * 2);
  angle = 0;
  damageFlash = 0;
  removed = false;

  constructor(path: Point[], color: string, speed: number, hitPoints: number, bounty: number, radius: number) {
    super();
    const start = path[0];
    this.x = start.x;
    this.y = start.y;
    this.maxSpeed = speed;
    this.speed = speed;
    this.hitPoints = hitPoints;
    this.maxHitPoints = hitPoints;
    this.bounty = bounty;
    this.radius = radius;
    this.color = color;
    this.path = path;
    const initialTarget = path[1] ?? path[0];
    this.angle = angleBetween(start, initialTarget);
    this.dx = Math.cos(this.angle) * this.speed;
    this.dy = Math.sin(this.angle) * this.speed;
  }

  takeDamage(amount: number): void {
    this.hitPoints = Math.max(0, this.hitPoints - amount);
    this.damageFlash = 1;
  }

  slowDown(factor: number): void {
    this.speed = Math.min(this.speed, this.maxSpeed * factor);
  }

  update(deltaSeconds: number): void {
    if (this.removed) {
      return;
    }

    if (this.hitPoints <= 0) {
      this.removed = true;
      this.dispatchEvent(new Event("killed"));
      return;
    }

    if (this.speed < this.maxSpeed) {
      this.speed = Math.min(this.maxSpeed, this.speed + (36 * deltaSeconds));
    }

    this.moveAlongPath(deltaSeconds);
    this.updateSpecial(deltaSeconds);
    this.damageFlash = Math.max(0, this.damageFlash - (1.8 * deltaSeconds));
  }

  draw(context: CanvasRenderingContext2D): void {
    const damageMix = this.damageFlash;
    context.save();
    context.translate(this.x, this.y);
    context.strokeStyle = this.color;
    context.fillStyle = damageMix > 0 ? `rgba(153, 79, 255, ${0.25 + (damageMix * 0.55)})` : "#050908";
    context.lineWidth = 1.5;
    this.drawBody(context);
    context.restore();

    this.drawHealthBar(context);
  }

  protected updateSpecial(_deltaSeconds: number): void {
  }

  protected abstract drawBody(context: CanvasRenderingContext2D): void;

  private moveAlongPath(deltaSeconds: number): void {
    let remainingStep = this.speed * deltaSeconds;
    while (remainingStep > 0 && !this.removed) {
      const destination = this.path[this.targetIndex];
      if (!destination) {
        this.removed = true;
        this.dispatchEvent(new Event("escaped"));
        return;
      }

      const toTarget = calculateDistance(this.x, this.y, destination.x, destination.y);
      if (toTarget <= remainingStep) {
        this.x = destination.x;
        this.y = destination.y;
        this.targetIndex += 1;
        const nextDestination = this.path[this.targetIndex];
        if (!nextDestination) {
          this.removed = true;
          this.dispatchEvent(new Event("escaped"));
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
  }

  private drawHealthBar(context: CanvasRenderingContext2D): void {
    const barWidth = Math.max(16, this.radius * 2);
    const fillWidth = barWidth * (this.hitPoints / this.maxHitPoints);
    context.fillStyle = "rgba(5, 10, 8, 0.85)";
    context.fillRect(this.x - (barWidth / 2), this.y - this.radius - 7, barWidth, 3);
    context.fillStyle = "#4cff90";
    context.fillRect(this.x - (barWidth / 2), this.y - this.radius - 7, fillWidth, 3);
  }
}
