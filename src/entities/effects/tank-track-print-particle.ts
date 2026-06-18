import type { UpdateContext } from "../../game-engine/update-context";
import { hexWithAlpha } from "../../utils";
import { Particle } from "./particle";

const PRINT_COLOR = "#86ad99";
const PRINT_ALPHA = 0.46;
const PRINT_FADE_PER_SECOND = 0.234;

export class TankTrackPrintParticle extends Particle {
  override drawsUnderEntities = true;
  private readonly angle: number;
  private readonly length: number;
  private readonly width: number;

  constructor(x: number, y: number, angle: number, length: number, width: number) {
    super(x, y, 1, PRINT_COLOR, PRINT_FADE_PER_SECOND, {
      speedPerSecond: 0,
      offset: 0,
      angle: 0,
    });
    this.alpha = PRINT_ALPHA;
    this.angle = angle;
    this.length = length;
    this.width = width;
  }

  override update(context: UpdateContext): void {
    this.alpha -= this.alphaFadePerSecond * context.deltaSeconds;
    if (this.alpha <= 0) {
      this.removed = true;
    }
  }

  override draw(context: CanvasRenderingContext2D): void {
    context.save();
    context.translate(this.x, this.y);
    context.rotate(this.angle);
    context.fillStyle = hexWithAlpha(this.color, this.alpha);
    context.fillRect(-this.length / 2, -this.width / 2, this.length, this.width);
    context.restore();
  }
}
