import type { Point } from "../../types";
import { DRONE_ACCENT_COLORS } from "../drone-visuals";
import { Projectile } from "./projectile";

export const DRONE_PROJECTILE_SPEED_PER_SECOND = 560;
const DRONE_PROJECTILE_DAMAGE_BASE = 4.752;
const DRONE_PROJECTILE_DAMAGE_PER_LEVEL = 1.056;
const DRONE_PROJECTILE_RADIUS_BASE = 1.25;
const DRONE_PROJECTILE_RADIUS_PER_LEVEL = 0.04;
export class DroneProjectile extends Projectile {
  private readonly accentColor: string;
  private readonly visualLength: number;
  private readonly visualHalfWidth: number;

  constructor(source: Point, target: Point, level: number) {
    const accentColor = DRONE_ACCENT_COLORS[Math.min(level, DRONE_ACCENT_COLORS.length - 1)];
    const radius = DRONE_PROJECTILE_RADIUS_BASE + (level * DRONE_PROJECTILE_RADIUS_PER_LEVEL);
    super(
      source,
      target,
      DRONE_PROJECTILE_SPEED_PER_SECOND,
      DRONE_PROJECTILE_DAMAGE_BASE + (level * DRONE_PROJECTILE_DAMAGE_PER_LEVEL),
      radius,
      accentColor,
      0.08,
    );
    this.accentColor = accentColor;
    this.visualLength = 4.6 + (radius * 0.8);
    this.visualHalfWidth = 0.85 + (radius * 0.14);
  }

  draw(context: CanvasRenderingContext2D): void {
    this.drawDart(context, this.visualLength, this.visualHalfWidth, this.accentColor, true);
  }
}
