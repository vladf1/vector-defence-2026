import { GlassShardParticle } from "../effects/glass-shard-particle";
import type { UpdateContext, UpdateResult } from "../../game-engine/update-context";
import type { PathEntry } from "../../route-path";
import { AudioCue } from "../../types";
import { drawPath, hexWithAlpha, randomRange } from "../../utils";
import { createPolygonShardParticles } from "./death-effect-helpers";
import { Monster } from "./monster";
import { createPolygonShardSplitterConfig, PolygonShardSplitter } from "./polygon-shard-splitter";

const COLOR = "#78d7ff";
const ARMOR_GLOW_COLOR = "#dff7ff";
const SPEED_PER_SECOND = 49;
const HIT_POINTS = 409;
const BOUNTY = 4;
const RADIUS = 9.5;
const ARMOR_PER_HIT = 3.5;
const MIN_CHIP_DAMAGE = 0.4;
const SHELL_HALF_HEIGHT = RADIUS * 0.8;
const SHELL_OUTLINE = [
  { x: RADIUS * 1.35, y: 0 },
  { x: RADIUS * 0.82, y: -SHELL_HALF_HEIGHT },
  { x: -RADIUS * 0.2, y: -RADIUS * 0.98 },
  { x: -RADIUS * 1.08, y: -SHELL_HALF_HEIGHT },
  { x: -RADIUS * 1.32, y: 0 },
  { x: -RADIUS * 1.08, y: SHELL_HALF_HEIGHT },
  { x: -RADIUS * 0.2, y: RADIUS * 0.98 },
  { x: RADIUS * 0.82, y: SHELL_HALF_HEIGHT },
];
const CORE_OUTLINE = [
  { x: RADIUS * 0.98, y: 0 },
  { x: RADIUS * 0.42, y: -RADIUS * 0.46 },
  { x: -RADIUS * 0.3, y: -RADIUS * 0.46 },
  { x: -RADIUS * 0.72, y: 0 },
  { x: -RADIUS * 0.3, y: RADIUS * 0.46 },
  { x: RADIUS * 0.42, y: RADIUS * 0.46 },
];
const FRONT_PLATE_OUTLINE = [
  { x: RADIUS * 1.08, y: 0 },
  { x: RADIUS * 0.76, y: -RADIUS * 0.28 },
  { x: RADIUS * 0.16, y: -RADIUS * 0.28 },
  { x: RADIUS * 0.16, y: RADIUS * 0.28 },
  { x: RADIUS * 0.76, y: RADIUS * 0.28 },
];
const SHARD_SPLITTER = new PolygonShardSplitter(createPolygonShardSplitterConfig({
  minShardCount: 5,
  maxShardCount: 11,
}));

export class BulwarkMonster extends Monster {
  private shieldPulse = 0;

  constructor(path: PathEntry[], speedScale: number) {
    super(path, COLOR, SPEED_PER_SECOND * speedScale, HIT_POINTS, BOUNTY, RADIUS);
  }

  // Flat armor applies once per discrete impact. Continuous effects use
  // Monster.takeContinuousDamage() so their result cannot depend on tick rate.
  override takeDamage(amount: number): void {
    if (amount <= 0) {
      return;
    }

    const mitigated = Math.max(MIN_CHIP_DAMAGE, amount - ARMOR_PER_HIT);
    super.takeDamage(mitigated);
  }

  protected override updateSpecial(context: UpdateContext): void {
    this.shieldPulse += 2.8 * context.deltaSeconds;
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.angle);

    const glow = 0.3 + (Math.sin(this.shieldPulse) * 0.12);

    drawPath(context, SHELL_OUTLINE, true);

    context.save();
    context.strokeStyle = hexWithAlpha(ARMOR_GLOW_COLOR, glow);
    context.lineWidth = 1.2;
    drawPath(context, CORE_OUTLINE, false);

    context.beginPath();
    context.moveTo(-this.radius * 0.22, -this.radius * 0.82);
    context.lineTo(this.radius * 0.48, -this.radius * 0.22);
    context.moveTo(-this.radius * 0.22, this.radius * 0.82);
    context.lineTo(this.radius * 0.48, this.radius * 0.22);
    context.stroke();
    context.restore();

    context.beginPath();
    context.moveTo(this.radius * 1.08, 0);
    context.lineTo(this.radius * 0.76, -this.radius * 0.28);
    context.lineTo(this.radius * 0.16, -this.radius * 0.28);
    context.lineTo(this.radius * 0.16, this.radius * 0.28);
    context.lineTo(this.radius * 0.76, this.radius * 0.28);
    context.closePath();
    context.stroke();

    context.beginPath();
    context.moveTo(-this.radius * 0.68, -this.radius * 0.52);
    context.lineTo(-this.radius * 0.98, -this.radius * 0.2);
    context.lineTo(-this.radius * 0.98, this.radius * 0.2);
    context.lineTo(-this.radius * 0.68, this.radius * 0.52);
    context.stroke();
  }

  override addDeathEffect(result: UpdateResult): void {
    const shellPivot = {
      x: randomRange(-this.radius * 0.18, this.radius * 0.18),
      y: randomRange(-this.radius * 0.18, this.radius * 0.18),
    };
    createPolygonShardParticles(
      result,
      this.x,
      this.y,
      this.color,
      SHELL_OUTLINE,
      shellPivot,
      this.angle,
      120,
      205,
      0,
      SHARD_SPLITTER,
    );
    result.addParticle(new GlassShardParticle(
      this.x,
      this.y,
      this.color,
      FRONT_PLATE_OUTLINE,
      { x: 0, y: 0 },
      this.angle,
      randomRange(105, 175),
      0,
    ));
    result.playSound(AudioCue.MonsterHeavyDeath, this.x, 1.05);
  }

}
