import { FIELD_HEIGHT, FIELD_WIDTH } from "../../constants";
import type { Point } from "../../types";
import { angleBetween, withinDistance } from "../../utils";
import type { Monster } from "../monsters/monster";

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

  update(activeMonsters: Iterable<Monster>, deltaSeconds: number): void {
    this.x += this.velocityXPerSecond * deltaSeconds;
    this.y += this.velocityYPerSecond * deltaSeconds;
    if (this.x < -20 || this.y < -20 || this.x > FIELD_WIDTH + 20 || this.y > FIELD_HEIGHT + 20) {
      this.removed = true;
      return;
    }

    for (const monster of activeMonsters) {
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
