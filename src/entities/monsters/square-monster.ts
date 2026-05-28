import type { UpdateContext, UpdateResult } from "../../game-engine/update-context";
import type { PathEntry } from "../../route-path";
import { AudioCue } from "../../types";
import { easeInOutSine, randomRange } from "../../utils";
import { createPolygonShardParticles } from "./death-effect-helpers";
import { Monster } from "./monster";
import { createPolygonShardSplitterConfig, PolygonShardSplitter } from "./polygon-shard-splitter";

const COLOR = "#ff6f62";
const SPEED_PER_SECOND = 68;
const HIT_POINTS = 165;
const BOUNTY = 3;
const RADIUS = 6.5;
const SIZE_PULSE_DURATION_SECONDS = 1.25;
const SIZE_PULSE_MIN_SCALE = 0.95;
const SIZE_PULSE_MAX_SCALE = 1.1;
const SHARD_SPLITTER = new PolygonShardSplitter(createPolygonShardSplitterConfig({
  minShardCount: 5,
  maxShardCount: 11,
}));

export class SquareMonster extends Monster {
  private sizePulseElapsedSeconds = randomRange(0, SIZE_PULSE_DURATION_SECONDS);

  constructor(path: PathEntry[], speedScale: number) {
    super(path, COLOR, SPEED_PER_SECOND * speedScale, HIT_POINTS, BOUNTY, RADIUS);
  }

  protected override updateSpecial(context: UpdateContext): void {
    this.rotation += 4.2 * context.deltaSeconds;
    this.sizePulseElapsedSeconds = (this.sizePulseElapsedSeconds + context.deltaSeconds) % SIZE_PULSE_DURATION_SECONDS;
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    const visualRadius = this.getVisualRadius();
    context.rotate(this.rotation);
    context.fillRect(
      -visualRadius,
      -visualRadius,
      visualRadius * 2,
      visualRadius * 2,
    );
    context.strokeRect(
      -visualRadius,
      -visualRadius,
      visualRadius * 2,
      visualRadius * 2,
    );
  }

  override addDeathEffect(result: UpdateResult): void {
    const visualRadius = this.getVisualRadius();
    const pivot = {
      x: randomRange(-visualRadius * 0.24, visualRadius * 0.24),
      y: randomRange(-visualRadius * 0.24, visualRadius * 0.24),
    };
    createPolygonShardParticles(
      result,
      this.x,
      this.y,
      this.color,
      this.createOutline(visualRadius),
      pivot,
      this.rotation,
      128,
      233,
      1.2,
      SHARD_SPLITTER,
    );
    result.playSound(AudioCue.MonsterShatter, this.x);
  }

  private getVisualRadius(): number {
    const progress = this.sizePulseElapsedSeconds / SIZE_PULSE_DURATION_SECONDS;
    const mirroredProgress = progress <= 0.5 ? progress * 2 : (1 - progress) * 2;
    const easedProgress = easeInOutSine(mirroredProgress);
    const scale = SIZE_PULSE_MIN_SCALE + ((SIZE_PULSE_MAX_SCALE - SIZE_PULSE_MIN_SCALE) * easedProgress);
    return this.radius * scale;
  }

  private createOutline(visualRadius: number) {
    return [
      { x: -visualRadius, y: -visualRadius },
      { x: visualRadius, y: -visualRadius },
      { x: visualRadius, y: visualRadius },
      { x: -visualRadius, y: visualRadius },
    ];
  }
}
