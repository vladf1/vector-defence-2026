import type { UpdateResult } from "../../game-engine/update-context";
import type { PathEntry } from "../../route-path";
import { AudioCue } from "../../types";
import { drawPath, hexWithAlpha, randomRange } from "../../utils";
import { createPolygonShardParticles } from "./death-effect-helpers";
import { Monster } from "./monster";
import { createPolygonShardSplitterConfig, PolygonShardSplitter } from "./polygon-shard-splitter";

const COLOR = "#91ff63";
const SPEED_PER_SECOND = 132;
const HIT_POINTS = 83;
const BOUNTY = 2;
const RADIUS = 5.5;
const TRAIL_TICK_SPACING = RADIUS * 0.72;
const TRAIL_TICK_LENGTH = RADIUS * 0.74;
const TRAIL_TICK_STEP = RADIUS * 0.42;
const TRAIL_TICK_COUNT = 2;
const TRAIL_CRAWL_DISTANCE_SCALE = 0.82;
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
    drawRunnerSpeedTrail(context, this.color, this.distanceAlongPath);
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

function drawRunnerSpeedTrail(context: CanvasRenderingContext2D, color: string, distanceAlongPath: number): void {
  const offset = (distanceAlongPath * TRAIL_CRAWL_DISTANCE_SCALE) % TRAIL_TICK_SPACING;
  context.save();
  context.lineCap = "round";
  context.lineWidth = 1.1;

  for (let index = 0; index < TRAIL_TICK_COUNT; index += 1) {
    const tickX = -RADIUS * 1.25 - offset - (index * TRAIL_TICK_SPACING);
    const tickAlpha = 0.44 - (index * 0.16);
    context.strokeStyle = hexWithAlpha(color, tickAlpha);

    context.beginPath();
    context.moveTo(tickX - TRAIL_TICK_LENGTH, -TRAIL_TICK_STEP);
    context.lineTo(tickX, -TRAIL_TICK_STEP);
    context.moveTo(tickX - (TRAIL_TICK_LENGTH * 0.72), TRAIL_TICK_STEP);
    context.lineTo(tickX + (TRAIL_TICK_LENGTH * 0.28), TRAIL_TICK_STEP);
    context.stroke();
  }

  context.restore();
}
