import type { UpdateContext } from "../../game-engine/update-context";
import type { Point } from "../../types";
import { drawPath, hexWithAlpha, isOutsideBounds, randomRange } from "../../utils";
import { Particle } from "./particle";

const FRAGMENT_FILL = "#050908";
const SPRITE_DPR = 4;
const SPRITES_PER_BUCKET = 120;
const LARGE_BUCKET_SIZE = 28;
const SMALL_BUCKET_SIZE = 18;
const LARGE_LENGTH_MIN = 5.5;
const LARGE_LENGTH_MAX = 13;
const LARGE_WIDTH_MIN = 2.4;
const LARGE_WIDTH_MAX = 5.2;
const SMALL_LENGTH_MIN = 2.8;
const SMALL_LENGTH_MAX = 6.8;
const SMALL_WIDTH_MIN = 1.1;
const SMALL_WIDTH_MAX = 2.6;
const LARGE_LENGTH_THRESHOLD = 7;
const ESCAPE_FRAGMENT_COLORS = ["#b0ffe1", "#6df0c2", "#ffe36f", "#f4fff8", "#7fd7ff"];

type FragmentSpriteBucket = "large" | "small";

interface FragmentSprite {
  readonly image: ImageBitmap;
  readonly logicalSize: number;
}

const spriteCache: Record<FragmentSpriteBucket, FragmentSprite[]> = {
  large: [],
  small: [],
};

export class BitmapEscapeFragmentParticle extends Particle {
  alpha = 1;
  alphaFadePerSecond: number;
  angularVelocityPerSecond: number;
  rotation: number;
  private readonly sprite: FragmentSprite;

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
    const bucket = length >= LARGE_LENGTH_THRESHOLD ? "large" : "small";
    this.sprite = pickSprite(bucket);
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
    const { image, logicalSize } = this.sprite;
    const rotationCos = Math.cos(this.rotation);
    const rotationSin = Math.sin(this.rotation);
    context.setTransform(rotationCos, rotationSin, -rotationSin, rotationCos, this.x, this.y);
    context.globalAlpha = this.alpha;
    context.drawImage(image, -logicalSize / 2, -logicalSize / 2, logicalSize, logicalSize);
  }
}

export async function prewarmBitmapEscapeFragmentSprites(): Promise<void> {
  await getSprites("large");
  await getSprites("small");
}

function pickSprite(bucket: FragmentSpriteBucket): FragmentSprite {
  const sprites = spriteCache[bucket];
  if (sprites.length === 0) {
    throw new Error("Bitmap escape fragment sprites must be prewarmed before use.");
  }
  return sprites[Math.floor(randomRange(0, sprites.length))] ?? sprites[0];
}

async function getSprites(bucket: FragmentSpriteBucket): Promise<FragmentSprite[]> {
  const sprites = spriteCache[bucket];
  if (sprites.length > 0) {
    return sprites;
  }

  const logicalSize = bucket === "large" ? LARGE_BUCKET_SIZE : SMALL_BUCKET_SIZE;
  for (let index = 0; index < SPRITES_PER_BUCKET; index += 1) {
    sprites.push(await createFragmentSprite(bucket, logicalSize));
  }
  return sprites;
}

async function createFragmentSprite(bucket: FragmentSpriteBucket, logicalSize: number): Promise<FragmentSprite> {
  const canvas = new OffscreenCanvas(logicalSize * SPRITE_DPR, logicalSize * SPRITE_DPR);

  const canvasContext = canvas.getContext("2d");
  if (!canvasContext) {
    throw new Error("Bitmap escape fragment sprite canvas could not be initialized.");
  }
  const context = canvasContext as unknown as CanvasRenderingContext2D;

  const length = bucket === "large"
    ? randomRange(LARGE_LENGTH_MIN, LARGE_LENGTH_MAX)
    : randomRange(SMALL_LENGTH_MIN, SMALL_LENGTH_MAX);
  const width = bucket === "large"
    ? randomRange(LARGE_WIDTH_MIN, LARGE_WIDTH_MAX)
    : randomRange(SMALL_WIDTH_MIN, SMALL_WIDTH_MAX);
  const vertices = createFragmentVertices(length, width);
  const color = ESCAPE_FRAGMENT_COLORS[Math.floor(randomRange(0, ESCAPE_FRAGMENT_COLORS.length))] ?? "#b0ffe1";

  context.scale(SPRITE_DPR, SPRITE_DPR);
  context.translate(logicalSize / 2, logicalSize / 2);
  context.rotate(randomRange(-Math.PI, Math.PI));
  context.fillStyle = hexWithAlpha(FRAGMENT_FILL, 0.92);
  context.strokeStyle = hexWithAlpha(color, 1);
  context.lineWidth = 1.35;
  drawPath(context, vertices, true);

  context.globalCompositeOperation = "lighter";
  context.strokeStyle = hexWithAlpha(color, 0.42);
  context.lineWidth = 0.8;
  context.beginPath();
  context.moveTo(vertices[0].x * 0.68, vertices[0].y * 0.44);
  context.lineTo(vertices[Math.floor(vertices.length / 2)].x * 0.68, 0);
  context.stroke();
  const image = await createImageBitmap(canvas);

  return {
    image,
    logicalSize,
  };
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
