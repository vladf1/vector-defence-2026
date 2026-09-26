import {
  DynamicDrawUsage,
  InstancedBufferGeometry,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  Mesh,
  type BufferGeometry,
  type Material,
} from "three/webgpu";

/**
 * Per-instance layout shared by every batch: a column-major transform (16 floats), a
 * linear RGB tint (3), padding (1), and four material-specific extras (4).
 */
export const INSTANCE_STRIDE = 24;
const TINT_OFFSET = 16;
const EXTRA_OFFSET = 20;

export interface BatchOptions {
  renderOrder: number;
}

/**
 * A fixed-capacity instanced draw refilled every frame, written straight into one
 * interleaved typed array so steady-state drawing allocates nothing.
 *
 * Batches are plain meshes over an InstancedBufferGeometry rather than InstancedMesh:
 * three.js keys InstancedMesh shader builds by object, so each would rebuild the same
 * shader. With instance data as ordinary named geometry attributes (applied by the
 * material), every batch sharing a material shares one shader build per render pass.
 */
export class InstancedBatch {
  readonly mesh: Mesh;
  readonly capacity: number;
  private readonly geometry: InstancedBufferGeometry;
  private readonly buffer: InstancedInterleavedBuffer;
  private readonly data: Float32Array;
  private count = 0;

  constructor(name: string, source: BufferGeometry, material: Material, capacity: number, options: BatchOptions) {
    this.capacity = capacity;
    this.data = new Float32Array(capacity * INSTANCE_STRIDE);
    this.buffer = new InstancedInterleavedBuffer(this.data, INSTANCE_STRIDE, 1);
    this.buffer.setUsage(DynamicDrawUsage);

    const geometry = new InstancedBufferGeometry();
    geometry.index = source.index;
    for (const [attributeName, attribute] of Object.entries(source.attributes)) {
      geometry.setAttribute(attributeName, attribute);
    }
    for (let column = 0; column < 4; column += 1) {
      geometry.setAttribute(`instanceMatrix${column}`, new InterleavedBufferAttribute(this.buffer, 4, column * 4));
    }
    geometry.setAttribute("instanceTint", new InterleavedBufferAttribute(this.buffer, 3, TINT_OFFSET));
    geometry.setAttribute("instanceExtra", new InterleavedBufferAttribute(this.buffer, 4, EXTRA_OFFSET));
    geometry.instanceCount = 0;
    this.geometry = geometry;

    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    mesh.frustumCulled = false;
    mesh.renderOrder = options.renderOrder;
    mesh.visible = false;
    this.mesh = mesh;
  }

  get size(): number {
    return this.count;
  }

  begin(): void {
    this.count = 0;
  }

  /** Translation, rotation about world up (+Y), and axis scale. */
  pushYaw(
    x: number,
    y: number,
    z: number,
    yaw: number,
    scaleX: number,
    scaleY: number,
    scaleZ: number,
    red: number,
    green: number,
    blue: number,
  ): number {
    const index = this.count;
    if (index >= this.capacity) {
      return -1;
    }

    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const m = this.data;
    const o = index * INSTANCE_STRIDE;
    m[o] = cos * scaleX;
    m[o + 1] = 0;
    m[o + 2] = -sin * scaleX;
    m[o + 3] = 0;
    m[o + 4] = 0;
    m[o + 5] = scaleY;
    m[o + 6] = 0;
    m[o + 7] = 0;
    m[o + 8] = sin * scaleZ;
    m[o + 9] = 0;
    m[o + 10] = cos * scaleZ;
    m[o + 11] = 0;
    m[o + 12] = x;
    m[o + 13] = y;
    m[o + 14] = z;
    m[o + 15] = 1;
    this.finishInstance(o, red, green, blue);
    this.count = index + 1;
    return index;
  }

  /** Translation, unit-quaternion rotation, and axis scale. */
  pushQuaternion(
    x: number,
    y: number,
    z: number,
    qx: number,
    qy: number,
    qz: number,
    qw: number,
    scaleX: number,
    scaleY: number,
    scaleZ: number,
    red: number,
    green: number,
    blue: number,
  ): number {
    const index = this.count;
    if (index >= this.capacity) {
      return -1;
    }

    const x2 = qx + qx;
    const y2 = qy + qy;
    const z2 = qz + qz;
    const xx = qx * x2;
    const xy = qx * y2;
    const xz = qx * z2;
    const yy = qy * y2;
    const yz = qy * z2;
    const zz = qz * z2;
    const wx = qw * x2;
    const wy = qw * y2;
    const wz = qw * z2;
    const m = this.data;
    const o = index * INSTANCE_STRIDE;
    m[o] = (1 - (yy + zz)) * scaleX;
    m[o + 1] = (xy + wz) * scaleX;
    m[o + 2] = (xz - wy) * scaleX;
    m[o + 3] = 0;
    m[o + 4] = (xy - wz) * scaleY;
    m[o + 5] = (1 - (xx + zz)) * scaleY;
    m[o + 6] = (yz + wx) * scaleY;
    m[o + 7] = 0;
    m[o + 8] = (xz + wy) * scaleZ;
    m[o + 9] = (yz - wx) * scaleZ;
    m[o + 10] = (1 - (xx + yy)) * scaleZ;
    m[o + 11] = 0;
    m[o + 12] = x;
    m[o + 13] = y;
    m[o + 14] = z;
    m[o + 15] = 1;
    this.finishInstance(o, red, green, blue);
    this.count = index + 1;
    return index;
  }

  /**
   * Arbitrary orthogonal basis: columns are the world-space images of the local X, Y,
   * and Z axes (lengths are the axis scales).
   */
  pushBasis(
    x: number,
    y: number,
    z: number,
    axisXx: number,
    axisXy: number,
    axisXz: number,
    axisYx: number,
    axisYy: number,
    axisYz: number,
    axisZx: number,
    axisZy: number,
    axisZz: number,
    red: number,
    green: number,
    blue: number,
  ): number {
    const index = this.count;
    if (index >= this.capacity) {
      return -1;
    }

    const m = this.data;
    const o = index * INSTANCE_STRIDE;
    m[o] = axisXx;
    m[o + 1] = axisXy;
    m[o + 2] = axisXz;
    m[o + 3] = 0;
    m[o + 4] = axisYx;
    m[o + 5] = axisYy;
    m[o + 6] = axisYz;
    m[o + 7] = 0;
    m[o + 8] = axisZx;
    m[o + 9] = axisZy;
    m[o + 10] = axisZz;
    m[o + 11] = 0;
    m[o + 12] = x;
    m[o + 13] = y;
    m[o + 14] = z;
    m[o + 15] = 1;
    this.finishInstance(o, red, green, blue);
    this.count = index + 1;
    return index;
  }

  setExtra(index: number, component: number, value: number): void {
    if (index >= 0) {
      this.data[(index * INSTANCE_STRIDE) + EXTRA_OFFSET + component] = value;
    }
  }

  finish(): void {
    const { mesh, count } = this;
    this.geometry.instanceCount = count;
    mesh.visible = count > 0;
    if (count === 0) {
      return;
    }

    this.buffer.clearUpdateRanges();
    this.buffer.addUpdateRange(0, count * INSTANCE_STRIDE);
    this.buffer.needsUpdate = true;
  }

  /** Makes the batch drawable with one degenerate instance so its pipeline can be precompiled. */
  prepareForCompile(): void {
    this.begin();
    this.pushYaw(0, -1000, 0, 0, 0, 0, 0, 0, 0, 0);
    this.finish();
  }

  dispose(): void {
    this.geometry.dispose();
  }

  private finishInstance(offset: number, red: number, green: number, blue: number): void {
    const m = this.data;
    m[offset + TINT_OFFSET] = red;
    m[offset + TINT_OFFSET + 1] = green;
    m[offset + TINT_OFFSET + 2] = blue;
    m[offset + TINT_OFFSET + 3] = 0;
    m[offset + EXTRA_OFFSET] = 0;
    m[offset + EXTRA_OFFSET + 1] = 0;
    m[offset + EXTRA_OFFSET + 2] = 0;
    m[offset + EXTRA_OFFSET + 3] = 0;
  }
}
