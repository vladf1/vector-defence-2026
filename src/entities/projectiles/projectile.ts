import { createHitImpactParticles } from "../../game-engine/combat-effects";
import type { Game } from "../../game-engine";
import { AudioCue } from "../../types";
import type { Point } from "../../types";
import { angleBetween, isOutsideBounds, withinDistance } from "../../utils";

const PROJECTILE_DAMAGE_BASE = 10;
const PROJECTILE_SIZE_BASE = 3;
const PROJECTILE_SIZE_PER_LEVEL = 0.5;
const PROJECTILE_SPEED_PER_SECOND = 420;

export class Projectile {
  x: number;
  y: number;
  velocityXPerSecond: number;
  velocityYPerSecond: number;
  damage: number;
  radius: number;
  removed = false;

  constructor(source: Point, target: Point, level: number) {
    const angle = angleBetween(source, target);
    this.x = source.x;
    this.y = source.y;
    this.velocityXPerSecond = Math.cos(angle) * PROJECTILE_SPEED_PER_SECOND;
    this.velocityYPerSecond = Math.sin(angle) * PROJECTILE_SPEED_PER_SECOND;
    this.damage = PROJECTILE_DAMAGE_BASE + level;
    this.radius = (PROJECTILE_SIZE_BASE + (level * PROJECTILE_SIZE_PER_LEVEL)) / 2;
  }

  update(game: Game, deltaSeconds: number): void {
    this.x += this.velocityXPerSecond * deltaSeconds;
    this.y += this.velocityYPerSecond * deltaSeconds;
    if (isOutsideBounds(this, game.profile.fieldWidth, game.profile.fieldHeight, 20)) {
      this.removed = true;
      return;
    }

    for (const monster of game.runtime.getActiveMonsters()) {
      const hitDistance = monster.radius + this.radius;
      if (withinDistance(this.x, this.y, monster.x, monster.y, hitDistance)) {
        monster.takeDamage(this.damage);
        game.addParticles(createHitImpactParticles(this.x, this.y, "#9fffe4", Math.atan2(this.velocityYPerSecond, this.velocityXPerSecond)));
        game.playSound(AudioCue.ProjectileImpact, this.x);
        this.removed = true;
        return;
      }
    }
  }

  draw(context: CanvasRenderingContext2D): void {
    const angle = Math.atan2(this.velocityYPerSecond, this.velocityXPerSecond);
    const visualLevel = (this.radius - (PROJECTILE_SIZE_BASE / 2)) / (PROJECTILE_SIZE_PER_LEVEL / 2);
    const length = (9.8 + (visualLevel * 1.45)) * 0.6;
    const halfWidth = (1.8 + (visualLevel * 0.22)) * 0.66;
    const tailX = -(length * 0.55);
    const noseX = length * 0.55;

    context.save();
    context.translate(this.x, this.y);
    context.rotate(angle);
    context.globalCompositeOperation = "lighter";

    context.fillStyle = "#d9fff3";
    context.beginPath();
    context.moveTo(noseX, 0);
    context.lineTo(noseX - (length * 0.28), -halfWidth);
    context.lineTo(tailX, -halfWidth);
    context.lineTo(tailX, halfWidth);
    context.lineTo(noseX - (length * 0.28), halfWidth);
    context.closePath();
    context.fill();
    context.restore();
  }

}
