import type { UpdateContext, UpdateResult } from "../../game-engine/update-context";
import type { PathEntry } from "../../route-path";
import { AudioCue } from "../../types";
import { drawPath, randomRange } from "../../utils";
import { createPolygonShardParticles } from "./death-effect-helpers";
import { Monster } from "./monster";
import { createPolygonShardSplitterConfig, PolygonShardSplitter } from "./polygon-shard-splitter";

const COLOR = "#ff8bd5";
const SPEED_PER_SECOND = 73;
const HIT_POINTS = 304;
const BOUNTY = 3;
const RADIUS = 8.5;
const OUTLINE = Array.from({ length: 6 }, (_, index) => {
  const angle = (Math.PI / 3) * index;
  const radius = index % 2 === 0 ? RADIUS * 1.15 : RADIUS * 0.72;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
});
const SHARD_SPLITTER = new PolygonShardSplitter(createPolygonShardSplitterConfig({
  minShardCount: 5,
  maxShardCount: 11,
}));

export class SplitterMonster extends Monster {
  constructor(path: PathEntry[], speedScale: number) {
    super(path, COLOR, SPEED_PER_SECOND * speedScale, HIT_POINTS, BOUNTY, RADIUS);
  }

  protected override updateSpecial(context: UpdateContext): void {
    this.rotation += 2.7 * context.deltaSeconds;
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.rotation);
    drawPath(context, OUTLINE, true);
    context.beginPath();
    context.moveTo(-this.radius * 0.55, -this.radius * 0.15);
    context.lineTo(0, this.radius * 0.2);
    context.lineTo(this.radius * 0.58, -this.radius * 0.18);
    context.stroke();
  }

  override addDeathEffect(result: UpdateResult): void {
    const pivot = {
      x: randomRange(-this.radius * 0.14, this.radius * 0.14),
      y: randomRange(-this.radius * 0.14, this.radius * 0.14),
    };
    createPolygonShardParticles(
      result,
      this.x,
      this.y,
      this.color,
      OUTLINE,
      pivot,
      this.rotation,
      110,
      185,
      0,
      SHARD_SPLITTER,
    );
    result.playSound(AudioCue.MonsterPop, this.x, 1.1);
  }

}
