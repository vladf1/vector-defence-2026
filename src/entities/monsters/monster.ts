import type { Point } from "../../types";
import { angleBetween, calculateDistance, hexWithAlpha, randomRange } from "../../utils";

const DAMAGE_FLASH_BASE_ALPHA = 0.32;
const DAMAGE_FLASH_EXTRA_ALPHA = 0.42;
const DAMAGE_FLASH_BLUR = 10;
const DAMAGE_FLASH_COLOR = "#fff2a8";
const MOTION_TRAIL_LENGTH = 2.2;

export abstract class Monster extends EventTarget {
  x: number;
  y: number;
  velocityXPerSecond = 0;
  velocityYPerSecond = 0;
  speedPerSecond: number;
  maxSpeedPerSecond: number;
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

  constructor(path: Point[], color: string, speedPerSecond: number, hitPoints: number, bounty: number, radius: number) {
    super();
    const start = path[0];
    this.x = start.x;
    this.y = start.y;
    this.maxSpeedPerSecond = speedPerSecond;
    this.speedPerSecond = speedPerSecond;
    this.hitPoints = hitPoints;
    this.maxHitPoints = hitPoints;
    this.bounty = bounty;
    this.radius = radius;
    this.color = color;
    this.path = path;
    const initialTarget = path[1] ?? path[0];
    this.angle = angleBetween(start, initialTarget);
    this.velocityXPerSecond = Math.cos(this.angle) * this.speedPerSecond;
    this.velocityYPerSecond = Math.sin(this.angle) * this.speedPerSecond;
  }

  takeDamage(amount: number): void {
    this.hitPoints = Math.max(0, this.hitPoints - amount);
    this.damageFlash = 1;
  }

  slowDown(factor: number): void {
    this.speedPerSecond = Math.min(this.speedPerSecond, this.maxSpeedPerSecond * factor);
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

    if (this.speedPerSecond < this.maxSpeedPerSecond) {
      this.speedPerSecond = Math.min(this.maxSpeedPerSecond, this.speedPerSecond + (36 * deltaSeconds));
    }

    this.moveAlongPath(deltaSeconds);
    this.updateSpecial(deltaSeconds);
    this.damageFlash = Math.max(0, this.damageFlash - (1.8 * deltaSeconds));
  }

  draw(context: CanvasRenderingContext2D): void {
    const damageMix = this.damageFlash;
    context.save();
    context.translate(this.x, this.y);
    this.drawMotionTrail(context, damageMix);
    this.drawDamageGlow(context, damageMix);
    this.drawCoreBody(context, damageMix);
    context.restore();

    this.drawHealthBar(context);
  }

  protected updateSpecial(_deltaSeconds: number): void {
  }

  protected abstract drawBody(context: CanvasRenderingContext2D): void;

  private drawMotionTrail(context: CanvasRenderingContext2D, damageMix: number): void {
    const speedRatio = Math.min(1.35, this.speedPerSecond / Math.max(1, this.maxSpeedPerSecond));
    const trailLength = this.radius * MOTION_TRAIL_LENGTH * speedRatio;
    const trailAlpha = 0.12 + (damageMix * 0.1);
    const gradient = context.createLinearGradient(
      -Math.cos(this.angle) * trailLength,
      -Math.sin(this.angle) * trailLength,
      0,
      0,
    );
    gradient.addColorStop(0, hexWithAlpha(this.color, 0));
    gradient.addColorStop(1, hexWithAlpha(this.color, trailAlpha));

    context.save();
    context.globalCompositeOperation = "lighter";
    context.strokeStyle = gradient;
    context.lineWidth = Math.max(5, this.radius * 1.15);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(-Math.cos(this.angle) * trailLength, -Math.sin(this.angle) * trailLength);
    context.lineTo(0, 0);
    context.stroke();
    context.restore();
  }

  private drawDamageGlow(context: CanvasRenderingContext2D, damageMix: number): void {
    if (damageMix <= 0) {
      return;
    }

    context.save();
    context.globalCompositeOperation = "lighter";
    context.shadowColor = DAMAGE_FLASH_COLOR;
    context.shadowBlur = DAMAGE_FLASH_BLUR + (damageMix * 10);
    context.strokeStyle = hexWithAlpha(DAMAGE_FLASH_COLOR, DAMAGE_FLASH_BASE_ALPHA + (damageMix * DAMAGE_FLASH_EXTRA_ALPHA));
    context.fillStyle = hexWithAlpha(this.color, 0.12);
    context.lineWidth = 3.2 + (damageMix * 1.2);
    this.drawBody(context);
    context.restore();
  }

  private drawCoreBody(context: CanvasRenderingContext2D, damageMix: number): void {
    context.save();
    context.strokeStyle = damageMix > 0 ? hexWithAlpha(DAMAGE_FLASH_COLOR, 0.5 + (damageMix * 0.5)) : this.color;
    context.fillStyle = "#050908";
    context.lineWidth = 1.5 + (damageMix * 0.9);
    this.drawBody(context);
    context.restore();
  }

  private moveAlongPath(deltaSeconds: number): void {
    let remainingStep = this.speedPerSecond * deltaSeconds;
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
        this.velocityXPerSecond = Math.cos(this.angle) * this.speedPerSecond;
        this.velocityYPerSecond = Math.sin(this.angle) * this.speedPerSecond;
        remainingStep -= toTarget;
      } else {
        this.angle = angleBetween({ x: this.x, y: this.y }, destination);
        this.velocityXPerSecond = Math.cos(this.angle) * this.speedPerSecond;
        this.velocityYPerSecond = Math.sin(this.angle) * this.speedPerSecond;
        this.x += this.velocityXPerSecond * (remainingStep / this.speedPerSecond);
        this.y += this.velocityYPerSecond * (remainingStep / this.speedPerSecond);
        remainingStep = 0;
      }
    }
  }

  private drawHealthBar(context: CanvasRenderingContext2D): void {
    const barWidth = Math.max(16, this.radius * 2);
    const healthRatio = this.hitPoints / this.maxHitPoints;
    const fillWidth = barWidth * healthRatio;
    context.fillStyle = "rgba(5, 10, 8, 0.85)";
    context.fillRect(this.x - (barWidth / 2), this.y - this.radius - 7, barWidth, 3);
    context.fillStyle = this.getHealthBarColor(healthRatio);
    context.fillRect(this.x - (barWidth / 2), this.y - this.radius - 7, fillWidth, 3);
  }

  private getHealthBarColor(healthRatio: number): string {
    if (healthRatio > 0.5) {
      const danger = (1 - healthRatio) * 2;
      return `rgb(${Math.round(76 + (179 * danger))}, 255, ${Math.round(144 * (1 - danger))})`;
    }

    const danger = 1 - (healthRatio * 2);
    return `rgb(255, ${Math.round(227 * (1 - danger))}, 79)`;
  }
}
