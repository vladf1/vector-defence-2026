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
  { x: RADIUS * 1.8, y: 0 },
  { x: RADIUS * 0.28, y: -RADIUS * 0.86 },
  { x: -RADIUS * 1.35, y: -RADIUS * 0.58 },
  { x: -RADIUS * 0.92, y: 0 },
  { x: -RADIUS * 1.35, y: RADIUS * 0.58 },
  { x: RADIUS * 0.28, y: RADIUS * 0.86 },
];
const SHARD_SPLITTER = new PolygonShardSplitter(createPolygonShardSplitterConfig({
  minShardCount: 3,
  maxShardCount: 6,
}));

export class RunnerMonster extends Monster {
  constructor(path: PathEntry[], speedScale: number) {
    super(path, COLOR, SPEED_PER_SECOND * speedScale, HIT_POINTS, BOUNTY, RADIUS);
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.angle);
    drawPath(context, OUTLINE, true);
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
