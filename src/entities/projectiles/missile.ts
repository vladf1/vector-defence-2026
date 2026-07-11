import { createMissileExplosionParticles } from "../../game-engine/combat-effects";
import { findEarliestActiveCircleSweepCollision } from "../../game-engine/collision-detection";
import type { UpdateContext, UpdateResult } from "../../game-engine/update-context";
import { AudioCue } from "../../types";
import type { Point } from "../../types";
import { angleBetween, calculateDistance, clamp, isOutsideBounds, randomRange, turnAngleTowards } from "../../utils";
import { Particle } from "../effects/particle";
import type { Monster } from "../monsters/monster";

const MISSILE_TAIL_X = -7;
const MISSILE_NOSE_X = 9;
const MISSILE_HALF_LENGTH = (MISSILE_NOSE_X - MISSILE_TAIL_X) / 2;
const MISSILE_DAMAGE_BASE = 50;
const MISSILE_DAMAGE_PER_LEVEL = 4;
const MISSILE_EFFECT_RADIUS_BASE = 60;
const MISSILE_EFFECT_RADIUS_PER_LEVEL = 5;
const MISSILE_SPEED_BASE_PER_SECOND = 108;
const MISSILE_SPEED_PER_LEVEL_PER_SECOND = 30;
const MISSILE_HIT_SHAKE_MIN_DURATION_SECONDS = 0.08;
const MISSILE_HIT_SHAKE_DURATION_RANGE_SECONDS = 0.035;
const MISSILE_HIT_SHAKE_MIN_DISTANCE = 0.45;
const MISSILE_HIT_SHAKE_DISTANCE_RANGE = 0.8;
const MISSILE_TURN_SPEED_PER_SECOND = 7.2;
const MISSILE_EXHAUST_SMOKE_PUFFS = [
  { x: -8.8, y: -0.18, radius: 2.2, alpha: 0.25 },
  { x: -11.4, y: 0.22, radius: 3.1, alpha: 0.28 },
  { x: -14.6, y: -0.35, radius: 4, alpha: 0.24 },
  { x: -18.4, y: 0.18, radius: 4.8, alpha: 0.18 },
  { x: -22.5, y: -0.08, radius: 5.7, alpha: 0.12 },
];

function getShakeStrengthFromSplashRatio(ratio: number): number {
  return clamp(ratio, 0.15, 1);
}

export class Missile {
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  radius: number;
  angle: number;
  speedPerSecond: number;
  damage: number;
  effectRadius: number;
  scale: number;
  level: number;
  trackedMonster?: Monster;
  removed = false;
  trailTimer = 0;

  constructor(source: Point, trackedMonster: Monster, level: number, initialAngle?: number) {
    this.x = source.x;
    this.y = source.y;
    this.previousX = source.x;
    this.previousY = source.y;
    this.trackedMonster = trackedMonster;
    this.level = level;
    this.damage = MISSILE_DAMAGE_BASE + (MISSILE_DAMAGE_PER_LEVEL * level);
    this.effectRadius = MISSILE_EFFECT_RADIUS_BASE + (MISSILE_EFFECT_RADIUS_PER_LEVEL * level);
    this.speedPerSecond = MISSILE_SPEED_BASE_PER_SECOND + (MISSILE_SPEED_PER_LEVEL_PER_SECOND * level);
    this.scale = 1 + (0.05 * level);
    this.radius = MISSILE_HALF_LENGTH * this.scale;
    this.angle = initialAngle ?? angleBetween(source, trackedMonster);
  }

  update(context: UpdateContext, result: UpdateResult): void {
    this.speedPerSecond += 180 * context.deltaSeconds;
    if (this.trackedMonster && this.trackedMonster.removed) {
      this.trackedMonster = undefined;
    }
    if (this.trackedMonster) {
      const targetAngle = angleBetween(this, this.trackedMonster);
      this.angle = turnAngleTowards(this.angle, targetAngle, MISSILE_TURN_SPEED_PER_SECOND * context.deltaSeconds);
    }

    this.previousX = this.x;
    this.previousY = this.y;
    this.x += Math.cos(this.angle) * this.speedPerSecond * context.deltaSeconds;
    this.y += Math.sin(this.angle) * this.speedPerSecond * context.deltaSeconds;

    const collision = findEarliestActiveCircleSweepCollision(this, context.activeMonsters);
    if (collision) {
      this.x = collision.x;
      this.y = collision.y;
      this.explode(context, result);
      return;
    }

    this.addTrail(context.deltaSeconds, result);
    if (isOutsideBounds(this, context.fieldWidth, context.fieldHeight, 20)) {
      this.removed = true;
    }
  }

  private addTrail(deltaSeconds: number, result: UpdateResult): void {
    this.trailTimer += deltaSeconds;
    if (this.trailTimer < 0.02) {
      return;
    }

    this.trailTimer = 0;
    const trailX = this.x + randomRange(-3, 3) - (Math.cos(this.angle) * 9);
    const trailY = this.y + randomRange(-3, 3) - (Math.sin(this.angle) * 9);
    const exhaustAngle = this.angle + Math.PI + randomRange(-0.35, 0.35);
    result.addParticle(new Particle(trailX, trailY, randomRange(0.6, 1.2), "#fff0a8", 5.5, {
      speedPerSecond: randomRange(36, 82),
      offset: 0,
      angle: exhaustAngle,
    }));
    result.addParticle(new Particle(trailX, trailY, randomRange(0.8, 1.5), "#ff8f45", 3.8, {
      speedPerSecond: randomRange(28, 68),
      offset: 1,
      angle: exhaustAngle,
    }));
    result.addParticle(new Particle(trailX, trailY, 1, "#7e858c", 1.4, {
      speedPerSecond: randomRange(22, 50),
      offset: 2,
      angle: exhaustAngle,
    }));
  }

  private explode(context: UpdateContext, result: UpdateResult): void {
    this.removed = true;
    for (const particle of createMissileExplosionParticles(this.x, this.y, this.angle, this.level)) {
      result.addParticle(particle);
    }
    for (const nearby of context.activeMonsters) {
      if (nearby.removed || nearby.hitPoints <= 0) {
        continue;
      }

      const distance = calculateDistance(this, nearby);
      if (distance > this.effectRadius) {
        continue;
      }

      const ratio = (this.effectRadius - distance) / this.effectRadius;
      const shakeStrength = getShakeStrengthFromSplashRatio(ratio);
      nearby.shake(
        MISSILE_HIT_SHAKE_MIN_DURATION_SECONDS + (MISSILE_HIT_SHAKE_DURATION_RANGE_SECONDS * shakeStrength),
        MISSILE_HIT_SHAKE_MIN_DISTANCE + (MISSILE_HIT_SHAKE_DISTANCE_RANGE * shakeStrength),
      );
      nearby.takeDamage(this.damage * ratio);
    }
    result.playSound(AudioCue.MissileExplosion, this.x, 1.1);
  }

  draw(context: CanvasRenderingContext2D): void {
    context.save();
    context.translate(this.x, this.y);
    context.rotate(this.angle);
    context.scale(this.scale, this.scale);

    for (const puff of MISSILE_EXHAUST_SMOKE_PUFFS) {
      const smoke = context.createRadialGradient(puff.x, puff.y, 0, puff.x, puff.y, puff.radius);
      smoke.addColorStop(0, `rgba(126, 133, 140, ${puff.alpha})`);
      smoke.addColorStop(1, "rgba(126, 133, 140, 0)");
      context.fillStyle = smoke;
      context.beginPath();
      context.arc(puff.x, puff.y, puff.radius, 0, Math.PI * 2);
      context.fill();
    }

    context.save();
    context.globalCompositeOperation = "lighter";
    const flameGlow = context.createRadialGradient(-7.4, 0, 0, -7.4, 0, 8.2);
    flameGlow.addColorStop(0, "rgba(255, 240, 168, 0.5)");
    flameGlow.addColorStop(0.32, "rgba(255, 143, 69, 0.38)");
    flameGlow.addColorStop(1, "rgba(255, 143, 69, 0)");
    context.fillStyle = flameGlow;
    context.beginPath();
    context.ellipse(-10.8, 0, 6.9, 1.7, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();

    context.fillStyle = "#ffe77c";
    context.beginPath();
    context.moveTo(MISSILE_TAIL_X, -1.45);
    context.lineTo(3.8, -1.45);
    context.lineTo(MISSILE_NOSE_X, 0);
    context.lineTo(3.8, 1.45);
    context.lineTo(MISSILE_TAIL_X, 1.45);
    context.closePath();
    context.fill();
    context.restore();
  }
}
