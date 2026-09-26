import type { FieldBounds, Point } from "../types";
import {
  mat4Identity,
  mat4Invert,
  mat4LookAtWorld,
  mat4Multiply,
  mat4Perspective,
  transformPointProjective,
  vec3,
  type Vec3,
} from "./math";

export interface CameraRigOptions {
  fieldWidth: number;
  fieldHeight: number;
  verticalFovDegrees: number;
  /** Tilt from straight down, toward the bottom of the field. */
  pitchRadians: number;
  /** Fraction of the view kept clear around the field. */
  margin: number;
}

const NEAR = 60;
const FAR = 4000;
const FIT_ITERATIONS = 24;
const SHAKE_DECAY_PER_SECOND = 1.9;
const MAX_SHAKE_OFFSET = 9;
const SHAKE_FREQUENCY = 31;
// Screen-up is world -Z (field y grows down the screen).
const CAMERA_UP = vec3(0, 0, -1);

/** A perspective camera as plain matrices (column-major, WebGPU clip depth 0..1). */
export class CameraState {
  readonly position = vec3(0, 0, 0);
  readonly world = mat4Identity();
  readonly view = mat4Identity();
  readonly projection = mat4Identity();
  readonly viewProjection = mat4Identity();
  readonly inverseViewProjection = mat4Identity();
  /** Normalized world-space forward vector. */
  readonly forward = vec3(0, -1, 0);

  setPerspective(verticalFovRadians: number, aspect: number): void {
    mat4Perspective(this.projection, verticalFovRadians, aspect, NEAR, FAR);
  }

  lookAt(eyeX: number, eyeY: number, eyeZ: number, target: Vec3): void {
    this.position.x = eyeX;
    this.position.y = eyeY;
    this.position.z = eyeZ;
    mat4LookAtWorld(this.world, this.position, target, CAMERA_UP);
    this.update();
  }

  /** Keeps the orientation of `source` from another position. */
  copyOrientation(source: CameraState, eyeX: number, eyeY: number, eyeZ: number): void {
    this.world.set(source.world);
    this.position.x = eyeX;
    this.position.y = eyeY;
    this.position.z = eyeZ;
    this.world[12] = eyeX;
    this.world[13] = eyeY;
    this.world[14] = eyeZ;
    this.update();
  }

  private update(): void {
    mat4Invert(this.view, this.world);
    mat4Multiply(this.viewProjection, this.projection, this.view);
    mat4Invert(this.inverseViewProjection, this.viewProjection);
    this.forward.x = -this.world[8];
    this.forward.y = -this.world[9];
    this.forward.z = -this.world[10];
  }
}

const BOARD_FOV_DEGREES = 24;
const BOARD_PITCH_RADIANS = 0.25;
const BOARD_MARGIN = 0.006;

/** The board's camera framing; also used by headless checks for real visible bounds. */
export function createBoardCameraRig(fieldWidth: number, fieldHeight: number): CameraRig {
  return new CameraRig({
    fieldWidth,
    fieldHeight,
    verticalFovDegrees: BOARD_FOV_DEGREES,
    pitchRadians: BOARD_PITCH_RADIANS,
    margin: BOARD_MARGIN,
  });
}

/**
 * Owns the logical camera used for picking and projection, plus a render camera that
 * adds screen shake. Field (x, y) maps to world (x, 0, y); screen-up is world -Z.
 */
export class CameraRig {
  readonly logicalCamera = new CameraState();
  readonly renderCamera = new CameraState();
  private readonly verticalFov: number;
  private readonly target = vec3(0, 0, 0);
  private readonly offsetDirection: Vec3;
  private aspect = 1;
  private distance = 1000;
  private trauma = 0;
  private shakeTime = 0;
  private viewportWidth = 1;
  private viewportHeight = 1;
  private readonly visibleBounds: FieldBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  private readonly scratch = vec3(0, 0, 0);
  private inspection: { x: number; y: number; visibleHeight: number } | null = null;

  constructor(private readonly options: CameraRigOptions) {
    this.verticalFov = (options.verticalFovDegrees * Math.PI) / 180;
    this.offsetDirection = vec3(0, Math.cos(options.pitchRadians), Math.sin(options.pitchRadians));
    this.visibleBounds.maxX = options.fieldWidth;
    this.visibleBounds.maxY = options.fieldHeight;
  }

  get fieldBounds(): FieldBounds {
    return this.visibleBounds;
  }

  resize(width: number, height: number): void {
    this.viewportWidth = Math.max(1, width);
    this.viewportHeight = Math.max(1, height);
    this.aspect = this.viewportWidth / this.viewportHeight;
    this.logicalCamera.setPerspective(this.verticalFov, this.aspect);
    this.renderCamera.setPerspective(this.verticalFov, this.aspect);
    this.fitField();
    this.updateVisibleBounds();
    this.syncRenderCamera(0, 0);
  }

  /**
   * Dev/render-script aid: frames the render camera tightly over a field point at the
   * same pitch. Picking keeps using the logical camera. Pass null to restore.
   */
  inspect(view: { x: number; y: number; visibleHeight: number } | null): void {
    this.inspection = view;
    this.syncRenderCamera(0, 0);
  }

  /** Adds screen-shake trauma in 0..1; shake strength follows trauma squared. */
  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(deltaSeconds: number): void {
    if (this.trauma <= 0) {
      return;
    }

    this.shakeTime += deltaSeconds;
    this.trauma = Math.max(0, this.trauma - (SHAKE_DECAY_PER_SECOND * deltaSeconds));
    const strength = this.trauma * this.trauma * MAX_SHAKE_OFFSET;
    const t = this.shakeTime * SHAKE_FREQUENCY;
    const offsetX = (Math.sin(t * 1.13) + (Math.sin(t * 2.71) * 0.5)) * strength * 0.66;
    const offsetZ = (Math.cos(t * 0.97) + (Math.sin(t * 3.17) * 0.5)) * strength * 0.66;
    this.syncRenderCamera(offsetX, offsetZ);
  }

  /** Ray-casts a client-space point onto the ground plane. */
  clientToField(clientX: number, clientY: number, rect: DOMRect): Point | null {
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const ndcX = (((clientX - rect.left) / rect.width) * 2) - 1;
    const ndcY = 1 - (((clientY - rect.top) / rect.height) * 2);
    return this.ndcToGround(ndcX, ndcY);
  }

  /** Projects a world point into CSS pixels relative to the canvas. */
  projectToViewport(x: number, y: number, z: number, out: Point): Point {
    const projected = transformPointProjective(this.logicalCamera.viewProjection, x, y, z, this.scratch);
    out.x = (projected.x + 1) * 0.5 * this.viewportWidth;
    out.y = (1 - projected.y) * 0.5 * this.viewportHeight;
    return out;
  }

  private ndcToGround(ndcX: number, ndcY: number): Point | null {
    const camera = this.logicalCamera;
    const origin = camera.position;
    const point = transformPointProjective(camera.inverseViewProjection, ndcX, ndcY, 0.5, this.scratch);
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    const dz = point.z - origin.z;
    const length = Math.hypot(dx, dy, dz) || 1;
    const directionY = dy / length;
    if (directionY >= -1e-6) {
      return null;
    }
    const distance = -origin.y / directionY;
    return {
      x: origin.x + ((dx / length) * distance),
      y: origin.z + ((dz / length) * distance),
    };
  }

  private placeCamera(): void {
    const { target, offsetDirection, distance } = this;
    this.logicalCamera.lookAt(
      target.x + (offsetDirection.x * distance),
      target.y + (offsetDirection.y * distance),
      target.z + (offsetDirection.z * distance),
      target,
    );
  }

  /**
   * Finds the camera distance and look-at target that frame the whole field with the
   * requested margin, re-centering the (trapezoidal) projection vertically.
   */
  private fitField(): void {
    const { fieldWidth, fieldHeight, margin } = this.options;
    const limit = 1 - margin;
    this.target.x = fieldWidth / 2;
    this.target.y = 0;
    this.target.z = fieldHeight / 2;
    const halfFov = this.verticalFov / 2;
    this.distance = (Math.max(fieldHeight, fieldWidth / this.aspect) / 2) / Math.tan(halfFov);

    const corners = [
      [0, 0],
      [fieldWidth, 0],
      [0, fieldHeight],
      [fieldWidth, fieldHeight],
    ] as const;
    for (let iteration = 0; iteration < FIT_ITERATIONS; iteration += 1) {
      this.placeCamera();
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const [x, z] of corners) {
        const projected = transformPointProjective(this.logicalCamera.viewProjection, x, 0, z, this.scratch);
        minX = Math.min(minX, projected.x);
        maxX = Math.max(maxX, projected.x);
        minY = Math.min(minY, projected.y);
        maxY = Math.max(maxY, projected.y);
      }
      const extent = Math.max((maxX - minX) / 2, (maxY - minY) / 2);
      const centerY = (maxY + minY) / 2;
      // Screen-up is -Z; shift the target so the projected field sits centered.
      const worldPerNdc = Math.tan(halfFov) * this.distance;
      this.target.z -= centerY * worldPerNdc * 0.9;
      this.distance *= 1 + ((extent / limit) - 1) * 0.9;
    }
    this.placeCamera();
  }

  private updateVisibleBounds(): void {
    const topLeft = this.ndcToGround(-1, 1);
    const topRight = this.ndcToGround(1, 1);
    const bottomLeft = this.ndcToGround(-1, -1);
    const bottomRight = this.ndcToGround(1, -1);
    if (!topLeft || !topRight || !bottomLeft || !bottomRight) {
      return;
    }
    // Largest axis-aligned rectangle inside the visible trapezoid.
    this.visibleBounds.minX = Math.max(topLeft.x, bottomLeft.x);
    this.visibleBounds.maxX = Math.min(topRight.x, bottomRight.x);
    this.visibleBounds.minY = Math.max(topLeft.y, topRight.y);
    this.visibleBounds.maxY = Math.min(bottomLeft.y, bottomRight.y);
  }

  private syncRenderCamera(offsetX: number, offsetZ: number): void {
    const render = this.renderCamera;
    const inspection = this.inspection;
    if (inspection) {
      const distance = (inspection.visibleHeight / 2) / Math.tan(this.verticalFov / 2);
      const target = vec3(inspection.x, 0, inspection.y);
      render.lookAt(
        target.x + (this.offsetDirection.x * distance) + offsetX,
        target.y + (this.offsetDirection.y * distance),
        target.z + (this.offsetDirection.z * distance) + offsetZ,
        vec3(target.x + offsetX, 0, target.z + offsetZ),
      );
    } else {
      const logical = this.logicalCamera.position;
      render.copyOrientation(this.logicalCamera, logical.x + offsetX, logical.y, logical.z + offsetZ);
    }
  }
}

