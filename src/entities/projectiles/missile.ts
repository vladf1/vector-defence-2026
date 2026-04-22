import { FIELD_HEIGHT, FIELD_WIDTH } from "../../constants";
import type { Game } from "../../game-engine";
import type { Point } from "../../types";
import { angleBetween, calculateDistance, randomRange, withinDistance } from "../../utils";
import { Particle } from "../effects/particle";
import type { Monster } from "../monsters/monster";

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

  constructor(source: Point, trackedMonster: Monster, damage: number, effectRadius: number, speedPerSecond: number) {
    this.x = source.x;
    this.y = source.y;
    this.trackedMonster = trackedMonster;
    this.damage = damage;
    this.effectRadius = effectRadius;
    this.speedPerSecond = speedPerSecond;
    this.angle = angleBetween(source, { x: trackedMonster.x, y: trackedMonster.y });
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
      game.addParticle(new Particle(trailX, trailY, 1, "#7e858c", 1));
    }

    if (this.x < -20 || this.y < -20 || this.x > FIELD_WIDTH + 20 || this.y > FIELD_HEIGHT + 20) {
      this.removed = true;
      return;
    }

    for (const monster of game.runtime.getActiveMonsters()) {
      const hitDistance = monster.radius + 6;
      if (withinDistance(this.x, this.y, monster.x, monster.y, hitDistance)) {
        this.removed = true;
        game.createExplosion(this.x, this.y, 20, 3, "#ffd34e", 2);
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
