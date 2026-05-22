import type { UpdateResult } from "../../game-engine/update-context";
import type { PathEntry } from "../../route-path";
import { AudioCue } from "../../types";
import { drawPath, randomRange } from "../../utils";
import { createPolygonShardParticles } from "./death-effect-helpers";
import { Monster } from "./monster";
import { createPolygonShardSplitterConfig, PolygonShardSplitter } from "./polygon-shard-splitter";

const COLOR = "#91ff63";
const SPEED_PER_SECOND = 132;
const HIT_POINTS = 83;
const BOUNTY = 2;
const RADIUS = 5.5;
const OUTLINE = [
  { x: RADIUS * 1.7, y: 0 },
  { x: -RADIUS * 0.1, y: -RADIUS * 0.82 },
  { x: -RADIUS * 1.35, y: 0 },
  { x: -RADIUS * 0.1, y: RADIUS * 0.82 },
];
const SHARD_SPLITTER = new PolygonShardSplitter(createPolygonShardSplitterConfig({
  minShardCount: 5,
  maxShardCount: 11,
}));

export class RunnerMonster extends Monster {
  constructor(path: PathEntry[], speedScale: number) {
    super(path, COLOR, SPEED_PER_SECOND * speedScale, HIT_POINTS, BOUNTY, RADIUS);
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.angle);
    drawPath(context, OUTLINE, true);
    context.beginPath();
    context.moveTo(-this.radius * 0.95, 0);
    context.lineTo(-this.radius * 1.5, -this.radius * 0.55);
    context.moveTo(-this.radius * 0.95, 0);
    context.lineTo(-this.radius * 1.5, this.radius * 0.55);
    context.stroke();
  }

  override addDeathEffect(result: UpdateResult): void {
    const pivot = {
      x: randomRange(-this.radius * 0.35, this.radius * 0.3),
      y: randomRange(-this.radius * 0.16, this.radius * 0.16),
    };
    createPolygonShardParticles(
      result,
      this.x,
      this.y,
      this.color,
      OUTLINE,
      pivot,
      this.angle,
      155,
      255,
      0,
      SHARD_SPLITTER,
    );
    result.playSound(AudioCue.MonsterPop, this.x, 0.85);
  }

}
