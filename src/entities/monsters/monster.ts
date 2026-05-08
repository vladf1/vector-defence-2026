import type { Particle } from "../effects/particle";
import { getPathHeadingAngle, type PathEntry } from "../../route-path";
import type { AudioCue as AudioCueValue } from "../../types";
import { angleBetween, randomRange } from "../../utils";

const MONSTER_STROKE_WIDTH = 1.5;
const HIT_SHAKE_DURATION_SECONDS = 0.16;
const HIT_SHAKE_DISTANCE = 2.4;
const HIT_SHAKE_HORIZONTAL_FREQUENCY_PER_SECOND = 92;
const HIT_SHAKE_VERTICAL_FREQUENCY_PER_SECOND = 117;
const HIT_SHAKE_VERTICAL_PHASE_SCALE = 0.7;
const HIT_SHAKE_VERTICAL_DISTANCE_SCALE = 0.65;

export interface MonsterDeathSound {
  cue: AudioCueValue;
  intensity?: number;
}

export interface MonsterDeathEffect {
  sound: MonsterDeathSound;
  particles: Particle[];
}

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
  removed = false;
  private slowRecoverySpeedPerSecond = 0;
  private hitShakeSeconds = 0;
  private hitShakePhase = 0;

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
  }

  shakeFromHit(): void {
    this.hitShakeSeconds = HIT_SHAKE_DURATION_SECONDS;
    this.hitShakePhase = randomRange(0, Math.PI * 2);
  }

  slowDown(factor: number, recoverySpeedPerSecond: number): void {
    const slowedSpeedPerSecond = this.maxSpeedPerSecond * factor;
    if (slowedSpeedPerSecond < this.speedPerSecond) {
      this.speedPerSecond = slowedSpeedPerSecond;
      this.slowRecoverySpeedPerSecond = recoverySpeedPerSecond;
    }
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
      this.speedPerSecond = Math.min(this.maxSpeedPerSecond, this.speedPerSecond + (this.slowRecoverySpeedPerSecond * deltaSeconds));
    }

    this.moveAlongPath(deltaSeconds);
    this.updateSpecial(deltaSeconds);
    this.hitShakeSeconds = Math.max(0, this.hitShakeSeconds - deltaSeconds);
  }

  draw(context: CanvasRenderingContext2D): void {
    const shakeOffset = this.getHitShakeOffset();
    context.save();
    context.translate(this.x + shakeOffset.x, this.y + shakeOffset.y);
    this.drawCoreBody(context);
    context.restore();

    this.drawHealthBar(context, shakeOffset.x, shakeOffset.y);
  }

  protected updateSpecial(_deltaSeconds: number): void {
  }

  protected abstract drawBody(context: CanvasRenderingContext2D): void;

  abstract createDeathEffect(): MonsterDeathEffect;

  private drawCoreBody(context: CanvasRenderingContext2D): void {
    context.save();
    context.strokeStyle = this.color;
    context.fillStyle = "#050908";
    context.lineWidth = MONSTER_STROKE_WIDTH;
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
      this.angle = getPathHeadingAngle(this.path, pathLength, this.targetIndex);
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
    this.angle = getPathHeadingAngle(this.path, distance, this.targetIndex);
  }

  private getHitShakeOffset(): { x: number; y: number } {
    if (this.hitShakeSeconds <= 0) {
      return { x: 0, y: 0 };
    }

    const elapsedSeconds = HIT_SHAKE_DURATION_SECONDS - this.hitShakeSeconds;
    const fade = this.hitShakeSeconds / HIT_SHAKE_DURATION_SECONDS;
    const distance = HIT_SHAKE_DISTANCE * fade;
    return {
      x: Math.sin(this.hitShakePhase + (elapsedSeconds * HIT_SHAKE_HORIZONTAL_FREQUENCY_PER_SECOND)) * distance,
      y: Math.cos((this.hitShakePhase * HIT_SHAKE_VERTICAL_PHASE_SCALE) + (elapsedSeconds * HIT_SHAKE_VERTICAL_FREQUENCY_PER_SECOND)) * distance * HIT_SHAKE_VERTICAL_DISTANCE_SCALE,
    };
  }

  private drawHealthBar(context: CanvasRenderingContext2D, offsetX: number, offsetY: number): void {
    const barWidth = Math.max(16, this.radius * 2);
    const healthRatio = this.hitPoints / this.maxHitPoints;
    const fillWidth = barWidth * healthRatio;
    const x = this.x + offsetX;
    const y = this.y + offsetY;
    context.fillStyle = "rgba(5, 10, 8, 0.85)";
    context.fillRect(x - (barWidth / 2), y - this.radius - 7, barWidth, 3);
    context.fillStyle = this.getHealthBarColor(healthRatio);
    context.fillRect(x - (barWidth / 2), y - this.radius - 7, fillWidth, 3);
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
