import { EFFECT_FIELD_HEIGHT, EFFECT_FIELD_WIDTH } from "../../constants";
import type { Point } from "../../types";
import { drawPath, hexWithAlpha, randomRange } from "../../utils";
import { Particle } from "./particle";

const SHARD_FILL_COLOR = "#050908";
const SHARD_STROKE_WIDTH = 0.75;

export class GlassShardParticle extends Particle {
  alpha = 1;
  alphaFadePerSecond: number;
  rotation: number;
  angularVelocityPerSecond: number;
  vertices: Point[];

  constructor(
    x: number,
    y: number,
    color: string,
    vertices: Point[],
    origin: Point,
    rotation: number,
    speedPerSecond: number,
    initialSeparation: number,
  ) {
    super(x, y, 1, color, 0, { speedPerSecond, offset: 0 });
    const centroid = getCentroid(vertices);
    const travelAngle =
      Math.atan2(centroid.y - origin.y, centroid.x - origin.x) +
      rotation +
      randomRange(-0.22, 0.22);
    this.velocityXPerSecond = Math.cos(travelAngle) * speedPerSecond;
    this.velocityYPerSecond = Math.sin(travelAngle) * speedPerSecond;
    this.x += Math.cos(travelAngle) * initialSeparation;
    this.y += Math.sin(travelAngle) * initialSeparation;
    this.vertices = vertices;
    this.rotation = rotation;
    this.angularVelocityPerSecond = randomRange(-5.5, 5.5);
    this.alphaFadePerSecond = randomRange(1.2, 2.7);
  }

  update(deltaSeconds: number): void {
    const driftSlowdownFactor = 1 - (0.42 * deltaSeconds);
    this.velocityXPerSecond *= driftSlowdownFactor;
    this.velocityYPerSecond *= driftSlowdownFactor;
    this.x += this.velocityXPerSecond * deltaSeconds;
    this.y += this.velocityYPerSecond * deltaSeconds;
    this.rotation += this.angularVelocityPerSecond * deltaSeconds;
    this.alpha = Math.max(0, this.alpha - (this.alphaFadePerSecond * deltaSeconds));
    if (
      this.alpha <= 0 ||
      this.x < -28 ||
      this.y < -28 ||
      this.x > EFFECT_FIELD_WIDTH + 28 ||
      this.y > EFFECT_FIELD_HEIGHT + 28
    ) {
      this.removed = true;
    }
  }

  draw(context: CanvasRenderingContext2D): void {
    context.save();
    context.translate(this.x, this.y);
    context.rotate(this.rotation);
    context.fillStyle = hexWithAlpha(SHARD_FILL_COLOR, this.alpha);
    context.strokeStyle = hexWithAlpha(this.color, Math.min(1, this.alpha + 0.1));
    context.lineWidth = SHARD_STROKE_WIDTH;
    drawPath(context, this.vertices, true);
    context.restore();
  }
}

function getCentroid(vertices: Point[]): Point {
  let sumX = 0;
  let sumY = 0;
  for (const vertex of vertices) {
    sumX += vertex.x;
    sumY += vertex.y;
  }
  return {
    x: sumX / vertices.length,
    y: sumY / vertices.length,
  };
}
