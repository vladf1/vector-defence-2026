import type { PathEntry } from "../../route-path";
import { angleBetween, hexWithAlpha, normalizeAngle, randomRange } from "../../utils";

const DAMAGE_FLASH_BASE_ALPHA = 0.32;
const DAMAGE_FLASH_EXTRA_ALPHA = 0.42;
const DAMAGE_FLASH_BLUR = 10;
const DAMAGE_FLASH_COLOR = "#fff2a8";

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
  path: PathEntry[];
  distanceAlongPath = 0;
  targetIndex = 1;
  rotation = randomRange(0, Math.PI * 2);
  angle = 0;
  damageFlash = 0;
  removed = false;

  constructor(path: PathEntry[], color: string, speedPerSecond: number, hitPoints: number, bounty: number, radius: number) {
    super();
    const start = path[0] ?? { x: 0, y: 0 };
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
    this.angle = angleBetween(start, path[1] ?? start);
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
    this.drawDamageGlow(context, damageMix);
    this.drawCoreBody(context, damageMix);
    context.restore();

    this.drawHealthBar(context);
  }

  protected updateSpecial(_deltaSeconds: number): void {
  }

  protected abstract drawBody(context: CanvasRenderingContext2D): void;

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
    this.distanceAlongPath += this.speedPerSecond * deltaSeconds;
    const pathLength = getPathLength(this.path);
    if (this.distanceAlongPath >= pathLength) {
      const end = this.path[this.path.length - 1] ?? { x: this.x, y: this.y };
      this.x = end.x;
      this.y = end.y;
      this.targetIndex = Math.max(0, this.path.length - 1);
      this.angle = this.getAngleAtDistance(pathLength);
      this.velocityXPerSecond = Math.cos(this.angle) * this.speedPerSecond;
      this.velocityYPerSecond = Math.sin(this.angle) * this.speedPerSecond;
      this.removed = true;
      this.dispatchEvent(new Event("escaped"));
      return;
    }

    this.updatePositionAtDistance(this.distanceAlongPath);
    this.velocityXPerSecond = Math.cos(this.angle) * this.speedPerSecond;
    this.velocityYPerSecond = Math.sin(this.angle) * this.speedPerSecond;
  }

  private updatePositionAtDistance(distance: number): void {
    while (this.targetIndex < this.path.length - 1 && this.path[this.targetIndex].totalDistance < distance) {
      this.targetIndex += 1;
    }

    const end = this.path[this.targetIndex] ?? this.path[this.path.length - 1];
    const startIndex = Math.max(0, this.targetIndex - 1);
    const start = this.path[startIndex] ?? end;
    const startDistance = start.totalDistance;
    const endDistance = end.totalDistance;
    const span = endDistance - startDistance;
    const ratio = span > 0 ? (distance - startDistance) / span : 1;

    this.x = start.x + ((end.x - start.x) * ratio);
    this.y = start.y + ((end.y - start.y) * ratio);
    this.angle = this.getAngleAtDistance(distance);
  }

  private getAngleAtDistance(distance: number): number {
    const nextAngle = getSegmentAngle(this.path, this.targetIndex);
    const previousAngle = getSegmentAngle(this.path, Math.max(1, this.targetIndex - 1));
    const startDistance = this.path[Math.max(0, this.targetIndex - 1)]?.totalDistance ?? 0;
    const endDistance = this.path[this.targetIndex]?.totalDistance ?? startDistance;
    const span = endDistance - startDistance;
    const ratio = span > 0 ? (distance - startDistance) / span : 1;
    return normalizeAngle(previousAngle + (normalizeAngle(nextAngle - previousAngle) * ratio));
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

function getPathLength(path: readonly PathEntry[]): number {
  return path[path.length - 1]?.totalDistance ?? 0;
}

function getSegmentAngle(path: readonly PathEntry[], targetIndex: number): number {
  const end = path[Math.min(Math.max(1, targetIndex), path.length - 1)];
  const start = path[Math.max(0, Math.min(targetIndex - 1, path.length - 2))];
  if (!start || !end || end.totalDistance === start.totalDistance) {
    return 0;
  }
  return angleBetween(start, end);
}
