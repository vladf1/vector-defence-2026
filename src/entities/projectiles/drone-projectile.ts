import type { Point } from "../../types";
import { Projectile } from "./projectile";

export const DRONE_PROJECTILE_SPEED_PER_SECOND = 560;
const DRONE_PROJECTILE_DAMAGE_BASE = 4.752;
const DRONE_PROJECTILE_DAMAGE_PER_LEVEL = 1.056;
const DRONE_PROJECTILE_RADIUS_BASE = 1.25;
const DRONE_PROJECTILE_RADIUS_PER_LEVEL = 0.04;
const DRONE_PROJECTILE_COLORS = ["#9dffd7", "#d8ff4f", "#ffe27a", "#ffad4f", "#ff8edb", "#b58cff", "#7fd7ff"] as const;

export class DroneProjectile extends Projectile {
  private readonly accentColor: string;

  constructor(source: Point, target: Point, level: number) {
    const accentColor = DRONE_PROJECTILE_COLORS[Math.min(level, DRONE_PROJECTILE_COLORS.length - 1)];
    super(
      source,
      target,
      DRONE_PROJECTILE_SPEED_PER_SECOND,
      DRONE_PROJECTILE_DAMAGE_BASE + (level * DRONE_PROJECTILE_DAMAGE_PER_LEVEL),
      DRONE_PROJECTILE_RADIUS_BASE + (level * DRONE_PROJECTILE_RADIUS_PER_LEVEL),
      accentColor,
      0.08,
    );
    this.accentColor = accentColor;
  }

  draw(context: CanvasRenderingContext2D): void {
    const length = 4.6 + (this.radius * 0.8);
    const halfWidth = 0.85 + (this.radius * 0.14);
    this.drawDart(context, length, halfWidth, this.accentColor, true);
  }
}
