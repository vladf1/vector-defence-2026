import { PerspectiveCamera, Vector3 } from "three/webgpu";
import type { FieldBounds, Point } from "../types";

export interface CameraRigOptions {
  fieldWidth: number;
  fieldHeight: number;
  verticalFovDegrees: number;
  /** Tilt from straight down, toward the bottom of the field. */
  pitchRadians: number;
  /** Fraction of the view kept clear around the field. */
  margin: number;
}

const FIT_ITERATIONS = 24;
const SHAKE_DECAY_PER_SECOND = 1.9;
const MAX_SHAKE_OFFSET = 9;
const SHAKE_FREQUENCY = 31;

/**
 * Owns the logical camera used for picking and projection, plus a render camera that
 * adds screen shake. Field (x, y) maps to world (x, 0, y); screen-up is world -Z.
 */
export class CameraRig {
  readonly logicalCamera: PerspectiveCamera;
  readonly renderCamera: PerspectiveCamera;
  private readonly target = new Vector3();
  private readonly offsetDirection = new Vector3();
  private distance = 1000;
  private trauma = 0;
  private shakeTime = 0;
  private viewportWidth = 1;
  private viewportHeight = 1;
  private readonly visibleBounds: FieldBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  private readonly scratch = new Vector3();
  private readonly rayOrigin = new Vector3();
  private readonly rayDirection = new Vector3();
  private inspection: { x: number; y: number; visibleHeight: number } | null = null;

  constructor(private readonly options: CameraRigOptions) {
    this.logicalCamera = new PerspectiveCamera(options.verticalFovDegrees, 1, 60, 4000);
    this.logicalCamera.up.set(0, 0, -1);
    this.renderCamera = this.logicalCamera.clone();
    this.offsetDirection.set(0, Math.cos(options.pitchRadians), Math.sin(options.pitchRadians));
    this.visibleBounds.maxX = options.fieldWidth;
    this.visibleBounds.maxY = options.fieldHeight;
  }

  get fieldBounds(): FieldBounds {
    return this.visibleBounds;
  }

  resize(width: number, height: number): void {
    this.viewportWidth = Math.max(1, width);
    this.viewportHeight = Math.max(1, height);
    const camera = this.logicalCamera;
    camera.aspect = this.viewportWidth / this.viewportHeight;
    camera.updateProjectionMatrix();
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
    this.scratch.set(x, y, z).project(this.logicalCamera);
    out.x = (this.scratch.x + 1) * 0.5 * this.viewportWidth;
    out.y = (1 - this.scratch.y) * 0.5 * this.viewportHeight;
    return out;
  }

  private ndcToGround(ndcX: number, ndcY: number): Point | null {
    const camera = this.logicalCamera;
    this.rayOrigin.copy(camera.position);
    this.rayDirection.set(ndcX, ndcY, 0.5).unproject(camera).sub(this.rayOrigin).normalize();
    if (this.rayDirection.y >= -1e-6) {
      return null;
    }
    const distance = -this.rayOrigin.y / this.rayDirection.y;
    return {
      x: this.rayOrigin.x + (this.rayDirection.x * distance),
      y: this.rayOrigin.z + (this.rayDirection.z * distance),
    };
  }

  private placeCamera(): void {
    const camera = this.logicalCamera;
    camera.position.copy(this.target).addScaledVector(this.offsetDirection, this.distance);
    camera.lookAt(this.target);
    camera.updateMatrixWorld(true);
  }

  /**
   * Finds the camera distance and look-at target that frame the whole field with the
   * requested margin, re-centering the (trapezoidal) projection vertically.
   */
  private fitField(): void {
    const { fieldWidth, fieldHeight, margin } = this.options;
    const limit = 1 - margin;
    this.target.set(fieldWidth / 2, 0, fieldHeight / 2);
    const halfFov = (this.logicalCamera.fov * Math.PI) / 360;
    this.distance = (Math.max(fieldHeight, fieldWidth / this.logicalCamera.aspect) / 2) / Math.tan(halfFov);

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
        this.scratch.set(x, 0, z).project(this.logicalCamera);
        minX = Math.min(minX, this.scratch.x);
        maxX = Math.max(maxX, this.scratch.x);
        minY = Math.min(minY, this.scratch.y);
        maxY = Math.max(maxY, this.scratch.y);
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
    render.fov = this.logicalCamera.fov;
    render.aspect = this.logicalCamera.aspect;
    render.near = this.logicalCamera.near;
    render.far = this.logicalCamera.far;
    const inspection = this.inspection;
    if (inspection) {
      const distance = (inspection.visibleHeight / 2) / Math.tan((render.fov * Math.PI) / 360);
      render.position.set(inspection.x, 0, inspection.y).addScaledVector(this.offsetDirection, distance);
      render.lookAt(inspection.x, 0, inspection.y);
    } else {
      render.position.copy(this.logicalCamera.position);
      render.quaternion.copy(this.logicalCamera.quaternion);
    }
    render.position.x += offsetX;
    render.position.z += offsetZ;
    render.updateProjectionMatrix();
    render.updateMatrixWorld(true);
  }
}
