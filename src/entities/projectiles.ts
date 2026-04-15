import { FIELD_HEIGHT, FIELD_WIDTH } from "../constants";
import type { Point } from "../types";
import { angleBetween, distanceSquaredXY, distanceXY, randomRange } from "../utils";
import { Particle } from "./effects";
import type { Monster } from "./monsters";
import type { GameAccess } from "./types";

export class Projectile {
  x: number;
  y: number;
  dx: number;
  dy: number;
  damage: number;
  radius: number;
  removed = false;

  constructor(source: Point, target: Point, damage: number, size: number) {
    const angle = angleBetween(source, target);
    this.x = source.x;
    this.y = source.y;
    this.dx = Math.cos(angle) * 7;
    this.dy = Math.sin(angle) * 7;
    this.damage = damage;
    this.radius = size / 2;
  }

  update(game: GameAccess, multiplier: number): void {
    this.x += this.dx * multiplier;
    this.y += this.dy * multiplier;
    if (this.x < -20 || this.y < -20 || this.x > FIELD_WIDTH + 20 || this.y > FIELD_HEIGHT + 20) {
      this.removed = true;
      return;
    }

    for (const monster of game.monsters) {
      if (monster.removed) {
        continue;
      }
      const hitDistance = monster.radius + this.radius;
      if (distanceSquaredXY(this.x, this.y, monster.x, monster.y) <= hitDistance * hitDistance) {
        monster.takeDamage(this.damage);
        this.removed = true;
        return;
      }
    }
  }

  draw(context: CanvasRenderingContext2D): void {
    context.fillStyle = "#9fffe4";
    context.beginPath();
    context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    context.fill();
  }
}

export class Missile {
  x: number;
  y: number;
  angle: number;
  speed: number;
  damage: number;
  effectRadius: number;
  trackedMonster?: Monster;
  removed = false;
  trailTimer = 0;

  constructor(source: Point, trackedMonster: Monster, damage: number, effectRadius: number, speed: number) {
    this.x = source.x;
    this.y = source.y;
    this.trackedMonster = trackedMonster;
    this.damage = damage;
    this.effectRadius = effectRadius;
    this.speed = speed;
    this.angle = angleBetween(source, { x: trackedMonster.x, y: trackedMonster.y });
  }

  update(game: GameAccess, multiplier: number, dt: number): void {
    this.speed += 0.05 * multiplier;
    if (this.trackedMonster && this.trackedMonster.removed) {
      this.trackedMonster = undefined;
    }
    if (this.trackedMonster) {
      this.angle = angleBetween({ x: this.x, y: this.y }, { x: this.trackedMonster.x, y: this.trackedMonster.y });
    }

    this.x += Math.cos(this.angle) * this.speed * multiplier;
    this.y += Math.sin(this.angle) * this.speed * multiplier;

    this.trailTimer += dt;
    if (this.trailTimer >= 0.02) {
      this.trailTimer = 0;
      const trailX = this.x + randomRange(-3, 3) - (Math.cos(this.angle) * 9);
      const trailY = this.y + randomRange(-3, 3) - (Math.sin(this.angle) * 9);
      game.addParticle(new Particle(trailX, trailY, 1, "#7e858c", 1 / 60));
    }

    if (this.x < -20 || this.y < -20 || this.x > FIELD_WIDTH + 20 || this.y > FIELD_HEIGHT + 20) {
      this.removed = true;
      return;
    }

    for (const monster of game.monsters) {
      if (monster.removed) {
        continue;
      }
      const hitDistance = monster.radius + 6;
      if (distanceSquaredXY(this.x, this.y, monster.x, monster.y) <= hitDistance * hitDistance) {
        this.removed = true;
        game.createExplosion(this.x, this.y, 20, 3, "#ffd34e", 1 / 30);
        for (const nearby of game.monsters) {
          if (nearby.removed) {
            continue;
          }
          const dist = distanceXY(this.x, this.y, nearby.x, nearby.y);
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
    context.strokeStyle = "#ffe77c";
    context.lineWidth = 3;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(-6, 0);
    context.lineTo(6, 0);
    context.stroke();
    context.restore();
  }
}
