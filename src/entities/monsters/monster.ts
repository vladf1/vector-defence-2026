import type { UpdateContext, UpdateResult } from "../../game-engine/update-context";
import { getPathHeadingAngle, type PathEntry } from "../../route-path";
import { angleBetween, clamp, randomRange } from "../../utils";

const MONSTER_STROKE_WIDTH = 1.5;
const HIT_SHAKE_DURATION_SECONDS = 0.16;
const HIT_SHAKE_DISTANCE = 2;
const HIT_SHAKE_HORIZONTAL_FREQUENCY_PER_SECOND = 92;
const HIT_SHAKE_VERTICAL_FREQUENCY_PER_SECOND = 117;
const HIT_SHAKE_VERTICAL_PHASE_SCALE = 0.7;

export abstract class Monster {
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
  readonly path: PathEntry[];
  private readonly pathLength: number;
  distanceAlongPath = 0;
  targetIndex = 1;
  rotation = randomRange(0, Math.PI * 2);
  angle = 0;
  removed = false;
  private slowRecoverySpeedPerSecond = 0;
  private hitShakeSeconds = 0;
  private hitShakeDurationSeconds = HIT_SHAKE_DURATION_SECONDS;
  private hitShakeDistance = HIT_SHAKE_DISTANCE;
  private hitShakePhase = 0;
  private hitShakeOffsetX = 0;
  private hitShakeOffsetY = 0;

  constructor(path: PathEntry[], color: string, speedPerSecond: number, hitPoints: number, bounty: number, radius: number) {
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
    this.pathLength = getPathLength(path);
    this.angle = angleBetween(start, path[1] ?? start);
    this.velocityXPerSecond = Math.cos(this.angle) * this.speedPerSecond;
    this.velocityYPerSecond = Math.sin(this.angle) * this.speedPerSecond;
  }

  takeDamage(amount: number): void {
    this.hitPoints = Math.max(0, this.hitPoints - amount);
  }

  shakeFromHit(): void {
    this.shake(HIT_SHAKE_DURATION_SECONDS, HIT_SHAKE_DISTANCE);
  }

  getPathProgress(): number {
    if (this.pathLength <= 0) {
      return 0;
    }
    return clamp(this.distanceAlongPath / this.pathLength, 0, 1);
  }

  shake(durationSeconds: number, distance: number): void {
    this.clearHitShakeOffset();
    this.hitShakeDurationSeconds = Math.max(0.001, durationSeconds);
    this.hitShakeSeconds = this.hitShakeDurationSeconds;
    this.hitShakeDistance = Math.max(0, distance);
    this.hitShakePhase = randomRange(0, Math.PI * 2);
    this.applyHitShakeOffset();
  }

  slowDown(factor: number, recoverySpeedPerSecond: number): void {
    const slowedSpeedPerSecond = this.maxSpeedPerSecond * factor;
    if (slowedSpeedPerSecond < this.speedPerSecond) {
      this.speedPerSecond = slowedSpeedPerSecond;
      this.slowRecoverySpeedPerSecond = recoverySpeedPerSecond;
    }
  }

  update(context: UpdateContext, result: UpdateResult): void {
    if (this.removed) {
      return;
    }

    if (this.hitPoints <= 0) {
      this.removed = true;
      result.addKilledMonster(this);
      return;
    }

    this.clearHitShakeOffset();

    if (this.speedPerSecond < this.maxSpeedPerSecond) {
      this.speedPerSecond = Math.min(this.maxSpeedPerSecond, this.speedPerSecond + (this.slowRecoverySpeedPerSecond * context.deltaSeconds));
    }

    this.moveAlongPath(context.deltaSeconds, result);
    if (this.removed) {
      return;
    }

    this.updateSpecial(context);
    this.hitShakeSeconds = Math.max(0, this.hitShakeSeconds - context.deltaSeconds);
    this.applyHitShakeOffset();
  }

  draw(context: CanvasRenderingContext2D): void {
    context.save();
    context.translate(this.x, this.y);
    this.drawCoreBody(context);
    context.restore();

    this.drawHealthBar(context);
  }

  protected updateSpecial(_context: UpdateContext): void {
  }

  protected abstract drawBody(context: CanvasRenderingContext2D): void;

  abstract addDeathEffect(result: UpdateResult): void;

  private drawCoreBody(context: CanvasRenderingContext2D): void {
    context.save();
    context.strokeStyle = this.color;
    context.fillStyle = "#050908";
    context.lineWidth = MONSTER_STROKE_WIDTH;
    this.drawBody(context);
    context.restore();
  }

  private moveAlongPath(deltaSeconds: number, result: UpdateResult): void {
    this.distanceAlongPath += this.speedPerSecond * deltaSeconds;
    if (this.distanceAlongPath >= this.pathLength) {
      const end = this.path[this.path.length - 1] ?? { x: this.x, y: this.y };
      this.x = end.x;
      this.y = end.y;
      this.targetIndex = Math.max(0, this.path.length - 1);
      this.angle = getPathHeadingAngle(this.path, this.pathLength, this.targetIndex);
      this.velocityXPerSecond = Math.cos(this.angle) * this.speedPerSecond;
      this.velocityYPerSecond = Math.sin(this.angle) * this.speedPerSecond;
      this.removed = true;
      result.addEscapedMonster(this);
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
    this.angle = getPathHeadingAngle(this.path, distance, this.targetIndex);
  }

  private getHitShakeOffset(): { x: number; y: number } {
    if (this.hitShakeSeconds <= 0) {
      return { x: 0, y: 0 };
    }

    const elapsedSeconds = this.hitShakeDurationSeconds - this.hitShakeSeconds;
    const fade = this.hitShakeSeconds / this.hitShakeDurationSeconds;
    const distance = this.hitShakeDistance * fade;
    return {
      x: Math.sin(this.hitShakePhase + (elapsedSeconds * HIT_SHAKE_HORIZONTAL_FREQUENCY_PER_SECOND)) * distance,
      y: Math.cos((this.hitShakePhase * HIT_SHAKE_VERTICAL_PHASE_SCALE) + (elapsedSeconds * HIT_SHAKE_VERTICAL_FREQUENCY_PER_SECOND)) * distance,
    };
  }

  private applyHitShakeOffset(): void {
    const offset = this.getHitShakeOffset();
    this.x += offset.x;
    this.y += offset.y;
    this.hitShakeOffsetX = offset.x;
    this.hitShakeOffsetY = offset.y;
  }

  private clearHitShakeOffset(): void {
    this.x -= this.hitShakeOffsetX;
    this.y -= this.hitShakeOffsetY;
    this.hitShakeOffsetX = 0;
    this.hitShakeOffsetY = 0;
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
