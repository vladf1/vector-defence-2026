import { FIELD_HEIGHT, FIELD_WIDTH } from "../../constants";
import { createHitImpactEffect } from "../../game-engine/combat-effects";
import type { Game } from "../../game-engine";
import { AudioCue } from "../../types";
import type { Point } from "../../types";
import { angleBetween, withinDistance } from "../../utils";

export class Projectile {
  x: number;
  y: number;
  velocityXPerSecond: number;
  velocityYPerSecond: number;
  damage: number;
  radius: number;
  removed = false;

  constructor(source: Point, target: Point, damage: number, size: number) {
    const angle = angleBetween(source, target);
    this.x = source.x;
    this.y = source.y;
    this.velocityXPerSecond = Math.cos(angle) * 420;
    this.velocityYPerSecond = Math.sin(angle) * 420;
    this.damage = damage;
    this.radius = size / 2;
  }

  update(game: Game, deltaSeconds: number): void {
    this.x += this.velocityXPerSecond * deltaSeconds;
    this.y += this.velocityYPerSecond * deltaSeconds;
    if (this.x < -20 || this.y < -20 || this.x > FIELD_WIDTH + 20 || this.y > FIELD_HEIGHT + 20) {
      this.removed = true;
      return;
    }

    for (const monster of game.runtime.getActiveMonsters()) {
      const hitDistance = monster.radius + this.radius;
      if (withinDistance(this.x, this.y, monster.x, monster.y, hitDistance)) {
        monster.takeDamage(this.damage);
        createHitImpactEffect(game, this.x, this.y, "#9fffe4", Math.atan2(this.velocityYPerSecond, this.velocityXPerSecond));
        game.playSound(AudioCue.ProjectileImpact, this.x);
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
