import { FIELD_HEIGHT, FIELD_WIDTH } from "../../constants";
import type { Point } from "../../types";
import { angleBetween, withinDistance } from "../../utils";
import type { GameAccess } from "../game-access";

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
      if (withinDistance(this.x, this.y, monster.x, monster.y, hitDistance)) {
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
