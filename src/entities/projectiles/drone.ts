import type { UpdateContext, UpdateResult } from "../../game-engine/update-context";
import { AudioCue, type Point } from "../../types";
import { calculateDistance, clamp, isOutsideBounds, randomRange, turnAngleTowards, withinDistance } from "../../utils";
import { DRONE_ACCENT_COLORS } from "../drone-visuals";
import type { Monster } from "../monsters/monster";
import { DRONE_PROJECTILE_SPEED_PER_SECOND, DroneProjectile } from "./drone-projectile";

const DRONE_SPEED_BASE = 158.6;
const DRONE_SPEED_PER_LEVEL = 10.4;
const DRONE_LOITER_RADIUS = 25;
const DRONE_LOITER_SPEED_PER_SECOND = 1.65;
const DRONE_ARRIVE_DISTANCE = 6;
const DRONE_TARGET_STANDOFF_MIN = 34;
const DRONE_TARGET_ORBIT_RADIUS_MAX = 42;
const DRONE_TARGET_ORBIT_SPEED_MIN = 0.95;
const DRONE_TARGET_ORBIT_SPEED_MAX = 1.45;
const DRONE_TARGET_ORBIT_PHASE_JITTER = 0.7;
const DRONE_SEPARATION_DISTANCE = 24;
const DRONE_SEPARATION_SPEED_PER_SECOND = 96;
const DRONE_EXIT_SPEED_PER_SECOND = 330;
const DRONE_EXIT_MARGIN = 42;
const DRONE_TARGET_DISTANCE_WEIGHT = 1;
const DRONE_TARGET_ASSIGNED_PENALTY = 90;
const DRONE_TARGET_PROGRESS_BONUS = 70;
const DRONE_TARGET_STICKINESS_BONUS = 42;
const DRONE_RETARGET_INTERVAL_SECONDS = 0.55;
const DRONE_RETARGET_JITTER_SECONDS = 0.18;
const DRONE_PROPELLERS = [
  { x: -6.9, y: -6.9 },
  { x: 6.9, y: -6.9 },
  { x: -6.9, y: 6.9 },
  { x: 6.9, y: 6.9 },
] as const;

let nextDroneId = 1;

interface DroneTargetOrbit {
  angle: number;
  angularSpeedPerSecond: number;
  radius: number;
}

export class Drone {
  readonly id = nextDroneId;
  x: number;
  y: number;
  angle = -Math.PI / 2;
  removed = false;
  private readonly home: Point;
  private readonly level: number;
  private readonly lifetimeSeconds: number;
  private readonly movementSpeedPerSecond: number;
  private readonly visualScale: number;
  private readonly propellerRadius: number;
  private readonly motorAccentRadius: number;
  private readonly fireIntervalSeconds: number;
  private readonly attackRange: number;
  private readonly accentColor: string;
  private ageSeconds = 0;
  private fireCooldownSeconds = 0.18;
  private retargetCooldownSeconds = 0;
  private target?: Monster;
  private targetOrbit = createTargetOrbit(undefined, undefined);
  private exiting = false;
  private exitVelocityXPerSecond = 0;
  private exitVelocityYPerSecond = 0;

  constructor(home: Point, level: number) {
    nextDroneId += 1;
    this.home = { ...home };
    this.level = level;
    this.lifetimeSeconds = 20 + (level * 5);
    this.movementSpeedPerSecond = DRONE_SPEED_BASE + (level * DRONE_SPEED_PER_LEVEL);
    this.visualScale = 0.752 + (level * 0.025);
    this.propellerRadius = 2.85 + (level * 0.18);
    this.motorAccentRadius = 1.2 + (level * 0.1);
    this.fireIntervalSeconds = clamp(0.58 - (level * 0.035), 0.35, 0.58);
    this.attackRange = 44 + (level * 4);
    this.accentColor = DRONE_ACCENT_COLORS[Math.min(level, DRONE_ACCENT_COLORS.length - 1)];
    this.x = home.x;
    this.y = home.y;
  }

  update(context: UpdateContext, result: UpdateResult): void {
    this.ageSeconds += context.deltaSeconds;
    if (this.exiting) {
      this.updateExit(context);
      return;
    }

    if (this.ageSeconds >= this.lifetimeSeconds) {
      this.startExit(context);
      this.updateExit(context);
      return;
    }

    this.fireCooldownSeconds = Math.max(0, this.fireCooldownSeconds - context.deltaSeconds);
    this.retargetCooldownSeconds = Math.max(0, this.retargetCooldownSeconds - context.deltaSeconds);
    this.updateTarget(context);

    if (this.target) {
      this.advanceTargetOrbit(context.deltaSeconds);
      this.moveTowardPosition(
        this.target.x + (Math.cos(this.targetOrbit.angle) * this.targetOrbit.radius),
        this.target.y + (Math.sin(this.targetOrbit.angle) * this.targetOrbit.radius),
        context.deltaSeconds,
      );
    } else {
      const loiterAngle = this.ageSeconds * DRONE_LOITER_SPEED_PER_SECOND;
      this.moveTowardPosition(
        this.home.x + (Math.cos(loiterAngle) * DRONE_LOITER_RADIUS),
        this.home.y + (Math.sin(loiterAngle) * DRONE_LOITER_RADIUS),
        context.deltaSeconds,
      );
    }
    if (this.target) {
      this.enforceTargetStandOff(this.target);
    }
    const separated = this.applyDroneSeparation(context);
    if (separated && this.target) {
      this.enforceTargetStandOff(this.target);
    }
    this.tryFire(result);
  }

  draw(context: CanvasRenderingContext2D): void {
    const propellerAlpha = 0.22 + (0.18 * Math.sin(this.ageSeconds * 52));
    const propellerFillStyle = `rgba(239, 255, 247, ${propellerAlpha})`;

    context.save();
    context.translate(this.x, this.y);
    context.rotate(this.angle);
    context.scale(this.visualScale, this.visualScale);
    context.globalCompositeOperation = "lighter";

    context.strokeStyle = "rgba(224, 255, 246, 0.92)";
    context.lineWidth = 1.05 + (this.level * 0.035);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(-6.9, -6.9);
    context.lineTo(6.9, 6.9);
    context.moveTo(6.9, -6.9);
    context.lineTo(-6.9, 6.9);
    context.stroke();

    for (const propeller of DRONE_PROPELLERS) {
      context.fillStyle = propellerFillStyle;
      context.beginPath();
      context.arc(propeller.x, propeller.y, this.propellerRadius, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = this.accentColor;
      context.beginPath();
      context.arc(propeller.x, propeller.y, this.motorAccentRadius, 0, Math.PI * 2);
      context.fill();
    }

    context.fillStyle = "#06100f";
    context.strokeStyle = "#effff7";
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(-3.9, -3.9, 7.8, 7.8, 1.5);
    context.fill();
    context.stroke();

    context.fillStyle = this.accentColor;
    context.fillRect(-1.8, -0.9, 3.6 + (this.level * 0.16), 1.8);

    if (this.level >= 3) {
      context.strokeStyle = this.accentColor;
      context.lineWidth = 0.75;
      context.beginPath();
      context.moveTo(-2.8, -5.2);
      context.lineTo(2.8, -5.2);
      context.moveTo(-2.8, 5.2);
      context.lineTo(2.8, 5.2);
      context.stroke();
    }

    context.restore();
  }

  isTracking(monster: Monster): boolean {
    return this.target === monster && this.isActiveTarget(monster);
  }

  private updateTarget(context: UpdateContext): void {
    if (this.target && this.isActiveTarget(this.target) && this.retargetCooldownSeconds > 0) {
      return;
    }

    const nextTarget = this.getTrackedTarget(context);
    if (nextTarget !== this.target) {
      this.targetOrbit = createTargetOrbit(this, nextTarget);
    }
    this.target = nextTarget;
    this.retargetCooldownSeconds = getRetargetCooldownSeconds();
  }

  private getTrackedTarget(context: UpdateContext): Monster | undefined {
    let bestTarget: Monster | undefined;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const monster of context.activeMonsters) {
      if (!this.isActiveTarget(monster)) {
        continue;
      }

      const score = this.scoreTarget(monster, context);
      if (score < bestScore) {
        bestScore = score;
        bestTarget = monster;
      }
    }
    return bestTarget;
  }

  private isActiveTarget(monster: Monster): boolean {
    return !monster.removed && monster.hitPoints > 0;
  }

  private scoreTarget(monster: Monster, context: UpdateContext): number {
    const dx = monster.x - this.x;
    const dy = monster.y - this.y;
    const distanceScore = Math.hypot(dx, dy) * DRONE_TARGET_DISTANCE_WEIGHT;
    const assignedDronePenalty = this.countOtherDronesTracking(monster, context) * DRONE_TARGET_ASSIGNED_PENALTY;
    const progressBonus = monster.getPathProgress() * DRONE_TARGET_PROGRESS_BONUS;
    const stickinessBonus = monster === this.target ? DRONE_TARGET_STICKINESS_BONUS : 0;

    return distanceScore + assignedDronePenalty - progressBonus - stickinessBonus;
  }

  private countOtherDronesTracking(monster: Monster, context: UpdateContext): number {
    let count = 0;
    for (const drone of context.activeDrones) {
      if (drone !== this && !drone.removed && drone.isTracking(monster)) {
        count += 1;
      }
    }
    return count;
  }

  private moveTowardPosition(destinationX: number, destinationY: number, deltaSeconds: number): void {
    const dx = destinationX - this.x;
    const dy = destinationY - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= DRONE_ARRIVE_DISTANCE) {
      return;
    }

    const targetAngle = Math.atan2(dy, dx);
    this.angle = turnAngleTowards(this.angle, targetAngle, 10 * deltaSeconds);
    const travel = Math.min(distance - DRONE_ARRIVE_DISTANCE, this.movementSpeedPerSecond * deltaSeconds);
    this.x += Math.cos(targetAngle) * travel;
    this.y += Math.sin(targetAngle) * travel;
  }

  private enforceTargetStandOff(target: Monster): void {
    const dx = this.x - target.x;
    const dy = this.y - target.y;
    const distance = Math.hypot(dx, dy);
    if (distance >= DRONE_TARGET_STANDOFF_MIN) {
      return;
    }

    const angle = distance > 0.001 ? Math.atan2(dy, dx) : this.targetOrbit.angle;
    this.x = target.x + (Math.cos(angle) * DRONE_TARGET_STANDOFF_MIN);
    this.y = target.y + (Math.sin(angle) * DRONE_TARGET_STANDOFF_MIN);
  }

  private advanceTargetOrbit(deltaSeconds: number): void {
    this.targetOrbit.angle += this.targetOrbit.angularSpeedPerSecond * deltaSeconds;
  }

  private applyDroneSeparation(context: UpdateContext): boolean {
    let pushX = 0;
    let pushY = 0;

    for (const drone of context.activeDrones) {
      if (drone === this || drone.removed) {
        continue;
      }

      if (!withinDistance(this, drone, DRONE_SEPARATION_DISTANCE)) {
        continue;
      }

      let dx = this.x - drone.x;
      let dy = this.y - drone.y;
      let distance = calculateDistance(this, drone);
      if (distance < 0.001) {
        const angle = (this.id * 2.399963) % (Math.PI * 2);
        dx = Math.cos(angle);
        dy = Math.sin(angle);
        distance = 1;
      }

      const overlapRatio = (DRONE_SEPARATION_DISTANCE - distance) / DRONE_SEPARATION_DISTANCE;
      pushX += (dx / distance) * overlapRatio;
      pushY += (dy / distance) * overlapRatio;
    }

    const pushDistance = Math.hypot(pushX, pushY);
    if (pushDistance <= 0) {
      return false;
    }

    const maxStep = DRONE_SEPARATION_SPEED_PER_SECOND * context.deltaSeconds;
    const step = Math.min(maxStep, pushDistance * DRONE_SEPARATION_DISTANCE * 0.45);
    this.x += (pushX / pushDistance) * step;
    this.y += (pushY / pushDistance) * step;
    return true;
  }

  private startExit(context: UpdateContext): void {
    this.exiting = true;
    this.target = undefined;
    const fieldCenterX = context.fieldWidth / 2;
    const fieldCenterY = context.fieldHeight / 2;
    const awayFromCenter = Math.atan2(this.y - fieldCenterY, this.x - fieldCenterX);
    const exitAngle = awayFromCenter + randomRange(-0.35, 0.35);
    this.angle = exitAngle;
    this.exitVelocityXPerSecond = Math.cos(exitAngle) * DRONE_EXIT_SPEED_PER_SECOND;
    this.exitVelocityYPerSecond = Math.sin(exitAngle) * DRONE_EXIT_SPEED_PER_SECOND;
  }

  private updateExit(context: UpdateContext): void {
    this.x += this.exitVelocityXPerSecond * context.deltaSeconds;
    this.y += this.exitVelocityYPerSecond * context.deltaSeconds;
    if (isOutsideBounds(this, context.fieldWidth, context.fieldHeight, DRONE_EXIT_MARGIN)) {
      this.removed = true;
    }
  }

  private tryFire(result: UpdateResult): void {
    if (!this.target || this.fireCooldownSeconds > 0) {
      return;
    }

    if (!withinDistance(this, this.target, this.attackRange)) {
      return;
    }

    this.fireCooldownSeconds = this.fireIntervalSeconds;
    result.addProjectile(new DroneProjectile(this, this.calculateIntercept(this.target), this.level));
    result.playSound(AudioCue.GunFire, this.x, 0.14 + (this.level * 0.018));
  }

  private calculateIntercept(target: Monster): Point {
    const relativeTargetX = target.x - this.x;
    const relativeTargetY = target.y - this.y;
    const projectileSpeedSquared = DRONE_PROJECTILE_SPEED_PER_SECOND * DRONE_PROJECTILE_SPEED_PER_SECOND;
    const targetSpeedSquared = (target.velocityXPerSecond * target.velocityXPerSecond) + (target.velocityYPerSecond * target.velocityYPerSecond);
    const a = projectileSpeedSquared - targetSpeedSquared;
    const b = (relativeTargetX * target.velocityXPerSecond) + (relativeTargetY * target.velocityYPerSecond);
    const c = (relativeTargetX * relativeTargetX) + (relativeTargetY * relativeTargetY);
    const discriminant = (b * b) + (a * c);
    let timeSeconds = 0;
    if (discriminant >= 0 && a !== 0) {
      timeSeconds = (b + Math.sqrt(discriminant)) / a;
      if (timeSeconds < 0) {
        timeSeconds = 0;
      }
    }
    return {
      x: target.x + (target.velocityXPerSecond * timeSeconds),
      y: target.y + (target.velocityYPerSecond * timeSeconds),
    };
  }

}

function createTargetOrbit(source: Point | undefined, target: Point | undefined): DroneTargetOrbit {
  const fallbackAngle = randomRange(0, Math.PI * 2);
  const approachAngle = source && target ? Math.atan2(source.y - target.y, source.x - target.x) : fallbackAngle;
  const direction = randomRange(0, 1) < 0.5 ? -1 : 1;
  return {
    angle: approachAngle + randomRange(-DRONE_TARGET_ORBIT_PHASE_JITTER, DRONE_TARGET_ORBIT_PHASE_JITTER),
    angularSpeedPerSecond: randomRange(DRONE_TARGET_ORBIT_SPEED_MIN, DRONE_TARGET_ORBIT_SPEED_MAX) * direction,
    radius: randomRange(DRONE_TARGET_STANDOFF_MIN, DRONE_TARGET_ORBIT_RADIUS_MAX),
  };
}

function getRetargetCooldownSeconds(): number {
  return DRONE_RETARGET_INTERVAL_SECONDS + randomRange(-DRONE_RETARGET_JITTER_SECONDS, DRONE_RETARGET_JITTER_SECONDS);
}
