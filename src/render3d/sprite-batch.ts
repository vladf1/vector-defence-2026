import {
  DynamicDrawUsage,
  InstancedBufferAttribute,
  Sprite,
  type SpriteNodeMaterial,
} from "three/webgpu";

export interface SpriteBatchAttributes {
  /** x, y, z, rotation (radians, screen space). */
  readonly transform: InstancedBufferAttribute;
  /** width, height, shape selector, spare. */
  readonly shape: InstancedBufferAttribute;
  /** Linear RGB plus alpha. */
  readonly color: InstancedBufferAttribute;
}

// Sprites switch render-object cache keys between one and many instances, so a
// batch always draws at least two (padding with an invisible instance) to stay on one pipeline.
const MIN_DRAWN_SPRITES = 2;

function createDynamicAttribute(capacity: number): InstancedBufferAttribute {
  const attribute = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
  attribute.setUsage(DynamicDrawUsage);
  return attribute;
}

/** Camera-facing quads drawn as one instanced sprite draw call. */
export class SpriteBatch {
  readonly sprite: Sprite;
  readonly capacity: number;
  private readonly attributes: SpriteBatchAttributes;
  private readonly transforms: Float32Array;
  private readonly shapes: Float32Array;
  private readonly colors: Float32Array;
  private count = 0;

  constructor(name: string, capacity: number, createMaterial: (attributes: SpriteBatchAttributes) => SpriteNodeMaterial) {
    this.capacity = capacity;
    this.attributes = {
      transform: createDynamicAttribute(capacity),
      shape: createDynamicAttribute(capacity),
      color: createDynamicAttribute(capacity),
    };
    this.transforms = this.attributes.transform.array as Float32Array;
    this.shapes = this.attributes.shape.array as Float32Array;
    this.colors = this.attributes.color.array as Float32Array;
    this.sprite = new Sprite(createMaterial(this.attributes));
    this.sprite.name = name;
    this.sprite.frustumCulled = false;
    this.sprite.count = MIN_DRAWN_SPRITES;
    this.sprite.visible = false;
  }

  get size(): number {
    return this.count;
  }

  begin(): void {
    this.count = 0;
  }

  push(
    x: number,
    y: number,
    z: number,
    rotation: number,
    width: number,
    height: number,
    shape: number,
    red: number,
    green: number,
    blue: number,
    alpha: number,
  ): void {
    const index = this.count;
    if (index >= this.capacity) {
      return;
    }

    const o = index * 4;
    const t = this.transforms;
    t[o] = x;
    t[o + 1] = y;
    t[o + 2] = z;
    t[o + 3] = rotation;
    const s = this.shapes;
    s[o] = width;
    s[o + 1] = height;
    s[o + 2] = shape;
    s[o + 3] = 0;
    const c = this.colors;
    c[o] = red;
    c[o + 1] = green;
    c[o + 2] = blue;
    c[o + 3] = alpha;
    this.count = index + 1;
  }

  finish(): void {
    const drawn = this.count;
    this.sprite.visible = drawn > 0;
    if (drawn === 0) {
      return;
    }

    while (this.count < MIN_DRAWN_SPRITES) {
      this.push(0, -1000, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    }
    this.sprite.count = this.count;
    for (const attribute of [this.attributes.transform, this.attributes.shape, this.attributes.color]) {
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(0, this.count * 4);
      attribute.needsUpdate = true;
    }
    this.count = drawn;
  }

  prepareForCompile(): void {
    this.begin();
    this.push(0, -1000, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    this.finish();
  }
}
