import { FIELD_HEIGHT, FIELD_WIDTH } from "../../constants";
import { hexWithAlpha, randomRange } from "../../utils";

export class Particle {
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
  color: string;
  alpha = 1;
  burnRate: number;
  removed = false;

  constructor(x: number, y: number, size: number, color: string, burnRate: number, speed = randomRange(120, 420), offset = randomRange(4, 6)) {
    const angle = randomRange(-Math.PI, Math.PI);
    this.dx = Math.cos(angle) * speed;
    this.dy = Math.sin(angle) * speed;
    this.x = x + (Math.cos(angle) * offset);
    this.y = y + (Math.sin(angle) * offset);
    this.size = size;
    this.color = color;
    this.burnRate = burnRate;
  }

  update(deltaSeconds: number): void {
    const slowDownFactor = 1 - (2.4 * deltaSeconds);
    this.dx *= slowDownFactor;
    this.dy *= slowDownFactor;
    this.x += this.dx * deltaSeconds;
    this.y += this.dy * deltaSeconds;
    this.alpha -= this.burnRate * deltaSeconds;
    if (this.alpha <= 0 || this.x < -20 || this.y < -20 || this.x > FIELD_WIDTH + 20 || this.y > FIELD_HEIGHT + 20) {
      this.removed = true;
    }
  }

  draw(context: CanvasRenderingContext2D): void {
    context.fillStyle = hexWithAlpha(this.color, this.alpha);
    context.fillRect(this.x - (this.size / 2), this.y - (this.size / 2), this.size, this.size);
  }
}
