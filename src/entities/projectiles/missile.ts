import { createMissileExplosionEffect } from "../../game-engine/combat-effects";
import type { Game } from "../../game-engine";
import { AudioCue } from "../../types";
import type { Point } from "../../types";
import { angleBetween, calculateDistance, randomRange, withinDistance } from "../../utils";
import { Particle } from "../effects/particle";
import type { Monster } from "../monsters/monster";

const MISSILE_TAIL_X = -7;
const MISSILE_NOSE_X = 9;
const MISSILE_HALF_LENGTH = (MISSILE_NOSE_X - MISSILE_TAIL_X) / 2;
const MISSILE_EXHAUST_SMOKE_PUFFS = [
  { x: -8.8, y: -0.18, radius: 2.2, alpha: 0.25 },
  { x: -11.4, y: 0.22, radius: 3.1, alpha: 0.28 },
  { x: -14.6, y: -0.35, radius: 4, alpha: 0.24 },
  { x: -18.4, y: 0.18, radius: 4.8, alpha: 0.18 },
  { x: -22.5, y: -0.08, radius: 5.7, alpha: 0.12 },
];

export class Missile {
  x: number;
  y: number;
  angle: number;
  speedPerSecond: number;
  damage: number;
  effectRadius: number;
  trackedMonster?: Monster;
  removed = false;
  trailTimer = 0;

  constructor(source: Point, trackedMonster: Monster, damage: number, effectRadius: number, speedPerSecond: number, initialAngle?: number) {
    this.x = source.x;
    this.y = source.y;
    this.trackedMonster = trackedMonster;
    this.damage = damage;
    this.effectRadius = effectRadius;
    this.speedPerSecond = speedPerSecond;
    this.angle = initialAngle ?? angleBetween(source, { x: trackedMonster.x, y: trackedMonster.y });
  }

  update(game: Game, deltaSeconds: number): void {
    this.speedPerSecond += 180 * deltaSeconds;
    if (this.trackedMonster && this.trackedMonster.removed) {
      this.trackedMonster = undefined;
    }
    if (this.trackedMonster) {
      this.angle = angleBetween({ x: this.x, y: this.y }, { x: this.trackedMonster.x, y: this.trackedMonster.y });
    }

    this.x += Math.cos(this.angle) * this.speedPerSecond * deltaSeconds;
    this.y += Math.sin(this.angle) * this.speedPerSecond * deltaSeconds;

    this.trailTimer += deltaSeconds;
    if (this.trailTimer >= 0.02) {
      this.trailTimer = 0;
      const trailX = this.x + randomRange(-3, 3) - (Math.cos(this.angle) * 9);
      const trailY = this.y + randomRange(-3, 3) - (Math.sin(this.angle) * 9);
      const exhaustAngle = this.angle + Math.PI + randomRange(-0.35, 0.35);
      game.addParticle(new Particle(trailX, trailY, randomRange(0.6, 1.2), "#fff0a8", 5.5, {
        speedPerSecond: randomRange(36, 82),
        offset: 0,
        angle: exhaustAngle,
      }));
      game.addParticle(new Particle(trailX, trailY, randomRange(0.8, 1.5), "#ff8f45", 3.8, {
        speedPerSecond: randomRange(28, 68),
        offset: 1,
        angle: exhaustAngle,
      }));
      game.addParticle(new Particle(trailX, trailY, 1, "#7e858c", 1.4, {
        speedPerSecond: randomRange(22, 50),
        offset: 2,
        angle: exhaustAngle,
      }));
    }

    if (this.x < -20 || this.y < -20 || this.x > game.profile.fieldWidth + 20 || this.y > game.profile.fieldHeight + 20) {
      this.removed = true;
      return;
    }

    for (const monster of game.runtime.getActiveMonsters()) {
      const hitDistance = monster.radius + MISSILE_HALF_LENGTH;
      if (withinDistance(this.x, this.y, monster.x, monster.y, hitDistance)) {
        this.removed = true;
        createMissileExplosionEffect(game, this.x, this.y, this.angle);
        game.playSound(AudioCue.MissileExplosion, this.x, 1.1);
        for (const nearby of game.runtime.getActiveMonsters()) {
          const dist = calculateDistance(this.x, this.y, nearby.x, nearby.y);
          if (dist <= this.effectRadius) {
            const ratio = (this.effectRadius - dist) / this.effectRadius;
            nearby.takeDamage(this.damage * ratio);
          }
        }
        return;
      }
    }
  }

  draw(context: CanvasRenderingContext2D): void {
    context.save();
    context.translate(this.x, this.y);
    context.rotate(this.angle);

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
