import type { UpdateResult } from "../../game-engine/update-context";
import type { PathEntry } from "../../route-path";
import { AudioCue } from "../../types";
import { drawPath, randomRange } from "../../utils";
import { createPolygonShardParticles } from "./death-effect-helpers";
import { Monster } from "./monster";
import { createPolygonShardSplitterConfig } from "./polygon-shard-splitter";

const COLOR = "#ffba4f";
const SPEED_PER_SECOND = 95;
const HIT_POINTS = 110;
const BOUNTY = 3;
const RADIUS = 7;
const OUTLINE_RADIUS = 6;
const OUTLINE = [
  { x: OUTLINE_RADIUS, y: 0 },
  { x: -OUTLINE_RADIUS, y: -OUTLINE_RADIUS },
  { x: -OUTLINE_RADIUS, y: OUTLINE_RADIUS },
];
const SHARD_SPLITTER_CONFIG = createPolygonShardSplitterConfig({
  minShardCount: 5,
  maxShardCount: 11,
});

export class TriangleMonster extends Monster {
  constructor(path: PathEntry[], speedScale: number) {
    super(path, COLOR, SPEED_PER_SECOND * speedScale, HIT_POINTS, BOUNTY, RADIUS);
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.angle);
    drawPath(context, OUTLINE, true);
  }

  override addDeathEffect(result: UpdateResult): void {
    const pivot = {
      x: randomRange(-OUTLINE_RADIUS * 0.1, OUTLINE_RADIUS * 0.14),
      y: randomRange(-OUTLINE_RADIUS * 0.12, OUTLINE_RADIUS * 0.12),
    };
    for (const particle of createPolygonShardParticles(
      this.x,
      this.y,
      this.color,
      OUTLINE,
      pivot,
      this.angle,
      115,
      195,
      1.4,
      SHARD_SPLITTER_CONFIG,
    )) {
      result.addParticle(particle);
    }
    result.playSound(AudioCue.MonsterShatter, this.x);
  }

}
