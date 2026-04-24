import { FIELD_HEIGHT, FIELD_WIDTH } from "../../constants";
import { hexWithAlpha, randomRange } from "../../utils";

interface ParticleOptions {
  speedPerSecond?: number;
  offset?: number;
  angle?: number;
}

export class Particle {
  x: number;
  y: number;
  velocityXPerSecond: number;
  velocityYPerSecond: number;
  size: number;
  color: string;
  alpha = 1;
  alphaFadePerSecond: number;
  removed = false;

  constructor(
    x: number,
    y: number,
    size: number,
    color: string,
    alphaFadePerSecond: number,
    options: ParticleOptions = {},
  ) {
    const speedPerSecond = options.speedPerSecond ?? randomRange(120, 420);
    const offset = options.offset ?? randomRange(4, 6);
    const angle = options.angle ?? randomRange(-Math.PI, Math.PI);
    this.velocityXPerSecond = Math.cos(angle) * speedPerSecond;
    this.velocityYPerSecond = Math.sin(angle) * speedPerSecond;
    this.x = x + (Math.cos(angle) * offset);
    this.y = y + (Math.sin(angle) * offset);
    this.size = size;
    this.color = color;
    this.alphaFadePerSecond = alphaFadePerSecond;
  }

  update(deltaSeconds: number): void {
    const slowDownFactor = 1 - (2.4 * deltaSeconds);
    this.velocityXPerSecond *= slowDownFactor;
    this.velocityYPerSecond *= slowDownFactor;
    this.x += this.velocityXPerSecond * deltaSeconds;
    this.y += this.velocityYPerSecond * deltaSeconds;
    this.alpha -= this.alphaFadePerSecond * deltaSeconds;
    if (this.alpha <= 0 || this.x < -20 || this.y < -20 || this.x > FIELD_WIDTH + 20 || this.y > FIELD_HEIGHT + 20) {
      this.removed = true;
    }
  }

  draw(context: CanvasRenderingContext2D): void {
    context.fillStyle = hexWithAlpha(this.color, this.alpha);
    context.fillRect(this.x - (this.size / 2), this.y - (this.size / 2), this.size, this.size);
  }
}
