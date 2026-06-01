import type { UpdateContext } from "../../game-engine/update-context";
import type { Point } from "../../types";
import { drawPath, hexWithAlpha, isOutsideBounds, randomRange } from "../../utils";
import { Particle } from "./particle";

const FRAGMENT_FILL = "#050908";

export class EscapeFragmentParticle extends Particle {
  alpha = 1;
  alphaFadePerSecond: number;
  angularVelocityPerSecond: number;
  rotation: number;
  vertices: Point[];

  constructor(
    x: number,
    y: number,
    color: string,
    angle: number,
    speedPerSecond: number,
    length: number,
    width: number,
    initialSeparation: number,
  ) {
    super(x, y, Math.max(length, width), color, 0, {
      speedPerSecond,
      offset: initialSeparation,
      angle,
    });
    this.rotation = angle + randomRange(-0.6, 0.6);
    this.angularVelocityPerSecond = randomRange(-13.5, 13.5);
    this.alphaFadePerSecond = randomRange(0.95, 1.55);
    this.vertices = createFragmentVertices(length, width);
  }

  override update(context: UpdateContext): void {
    const driftSlowdownFactor = 1 - (0.58 * context.deltaSeconds);
    this.velocityXPerSecond *= driftSlowdownFactor;
    this.velocityYPerSecond *= driftSlowdownFactor;
    this.x += this.velocityXPerSecond * context.deltaSeconds;
    this.y += this.velocityYPerSecond * context.deltaSeconds;
    this.rotation += this.angularVelocityPerSecond * context.deltaSeconds;
    this.alpha = Math.max(0, this.alpha - (this.alphaFadePerSecond * context.deltaSeconds));
    if (this.alpha <= 0 || isOutsideBounds(this, context.fieldWidth, context.fieldHeight, 34)) {
      this.removed = true;
    }
  }

  override draw(context: CanvasRenderingContext2D): void {
    context.save();
    context.translate(this.x, this.y);
    context.rotate(this.rotation);
    context.fillStyle = hexWithAlpha(FRAGMENT_FILL, this.alpha * 0.92);
    context.strokeStyle = hexWithAlpha(this.color, Math.min(1, this.alpha + 0.08));
    context.lineWidth = 1.35;
    drawPath(context, this.vertices, true);

    context.globalCompositeOperation = "lighter";
    context.strokeStyle = hexWithAlpha(this.color, this.alpha * 0.42);
    context.lineWidth = 0.8;
    context.beginPath();
    context.moveTo(this.vertices[0].x * 0.68, this.vertices[0].y * 0.44);
    context.lineTo(this.vertices[Math.floor(this.vertices.length / 2)].x * 0.68, 0);
    context.stroke();
    context.restore();
  }
}

function createFragmentVertices(length: number, width: number): Point[] {
  const pointCount = 4 + Math.floor(randomRange(0, 4));
  const vertices: Point[] = [];
  const angleOffset = randomRange(-0.26, 0.26);

  for (let index = 0; index < pointCount; index += 1) {
    const angle = angleOffset + ((Math.PI * 2 * index) / pointCount) + randomRange(-0.2, 0.2);
    const lengthRadius = (length / 2) * (Math.cos(angle) > 0 ? randomRange(0.72, 1.22) : randomRange(0.44, 0.95));
    const widthRadius = (width / 2) * randomRange(0.58, 1.28);
    vertices.push({
      x: (Math.cos(angle) * lengthRadius) + randomRange(length * -0.08, length * 0.08),
      y: (Math.sin(angle) * widthRadius) + randomRange(width * -0.18, width * 0.18),
    });
  }

  return vertices;
}
