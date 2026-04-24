import { FIELD_HEIGHT, FIELD_WIDTH } from "../../constants";
import { hexWithAlpha, randomRange } from "../../utils";
import { Particle } from "./particle";

type Vertex = {
  x: number;
  y: number;
};

export class GlassShardParticle extends Particle {
  alpha = 1;
  alphaFadePerSecond: number;
  rotation: number;
  angularVelocityPerSecond: number;
  vertices: Vertex[];

  constructor(
    x: number,
    y: number,
    color: string,
    vertices: Vertex[],
    rotation: number,
    speedPerSecond: number,
  ) {
    super(x, y, 1, color, 0, { speedPerSecond, offset: 0 });
    const centroid = getCentroid(vertices);
    const travelAngle = Math.atan2(centroid.y, centroid.x) + randomRange(-0.22, 0.22);
    this.velocityXPerSecond = Math.cos(travelAngle) * speedPerSecond;
    this.velocityYPerSecond = Math.sin(travelAngle) * speedPerSecond;
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
      this.x > FIELD_WIDTH + 28 ||
      this.y > FIELD_HEIGHT + 28
    ) {
      this.removed = true;
    }
  }

  draw(context: CanvasRenderingContext2D): void {
    context.save();
    context.translate(this.x, this.y);
    context.rotate(this.rotation);
    context.fillStyle = hexWithAlpha(this.color, this.alpha);
    context.strokeStyle = hexWithAlpha("#ffffff", Math.min(1, this.alpha + 0.1));
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(this.vertices[0].x, this.vertices[0].y);
    for (let index = 1; index < this.vertices.length; index += 1) {
      context.lineTo(this.vertices[index].x, this.vertices[index].y);
    }
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
  }
}

function getCentroid(vertices: Vertex[]): Vertex {
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
