import { createHitImpactParticles } from "../../game-engine/combat-effects";
import type { UpdateContext, UpdateResult } from "../../game-engine/update-context";
import { AudioCue } from "../../types";
import type { Point } from "../../types";
import { angleBetween, isOutsideBounds, withinDistance } from "../../utils";

export abstract class Projectile {
  x: number;
  y: number;
  velocityXPerSecond: number;
  velocityYPerSecond: number;
  damage: number;
  radius: number;
  angle: number;
  removed = false;

  protected constructor(
    source: Point,
    target: Point,
    speedPerSecond: number,
    damage: number,
    radius: number,
    private readonly impactColor: string,
    private readonly impactSoundIntensity?: number,
  ) {
    this.angle = angleBetween(source, target);
    this.x = source.x;
    this.y = source.y;
    this.velocityXPerSecond = Math.cos(this.angle) * speedPerSecond;
    this.velocityYPerSecond = Math.sin(this.angle) * speedPerSecond;
    this.damage = damage;
    this.radius = radius;
  }

  update(context: UpdateContext, result: UpdateResult): void {
    this.x += this.velocityXPerSecond * context.deltaSeconds;
    this.y += this.velocityYPerSecond * context.deltaSeconds;
    if (isOutsideBounds(this, context.fieldWidth, context.fieldHeight, 20)) {
      this.removed = true;
      return;
    }

    for (const monster of context.activeMonsters) {
      const hitDistance = monster.radius + this.radius;
      if (withinDistance(this, monster, hitDistance)) {
        monster.takeDamage(this.damage);
        this.removed = true;
        for (const particle of createHitImpactParticles(this.x, this.y, this.impactColor, this.angle)) {
          result.addParticle(particle);
        }
        result.playSound(AudioCue.ProjectileImpact, this.x, this.impactSoundIntensity);
        return;
      }
    }
  }

  protected drawDart(
    context: CanvasRenderingContext2D,
    length: number,
    halfWidth: number,
    fillStyle: string,
    drawHighlight: boolean,
  ): void {
    const tailX = -(length * 0.55);
    const noseX = length * 0.55;

    context.save();
    context.translate(this.x, this.y);
    context.rotate(this.angle);
    context.globalCompositeOperation = "lighter";

    context.fillStyle = fillStyle;
    context.beginPath();
    context.moveTo(noseX, 0);
    context.lineTo(noseX - (length * 0.28), -halfWidth);
    context.lineTo(tailX, -halfWidth);
    context.lineTo(tailX, halfWidth);
    context.lineTo(noseX - (length * 0.28), halfWidth);
    context.closePath();
    context.fill();

    if (drawHighlight) {
      context.fillStyle = "#effff7";
      context.fillRect(tailX + 0.8, -0.36, length * 0.42, 0.72);
    }
    context.restore();
  }

  abstract draw(context: CanvasRenderingContext2D): void;
}
