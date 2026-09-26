import {
  BufferAttribute,
  BufferGeometry,
  Euler,
  ExtrudeGeometry,
  Matrix4,
  Quaternion,
  Shape,
  Vector2,
  Vector3,
} from "three/webgpu";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Point } from "../types";

/**
 * Every neon part geometry carries exactly `position`, `normal`, and `glow`, non-indexed,
 * so all parts render through one identical shader program.
 */
export function solid(geometry: BufferGeometry, glow: number, matrix: Matrix4 | null): BufferGeometry {
  const prepared = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  for (const name of Object.keys(prepared.attributes)) {
    if (name !== "position" && name !== "normal") {
      prepared.deleteAttribute(name);
    }
  }
  if (!prepared.getAttribute("normal")) {
    prepared.computeVertexNormals();
  }
  if (matrix) {
    prepared.applyMatrix4(matrix);
  }
  const vertexCount = prepared.getAttribute("position").count;
  prepared.setAttribute("glow", new BufferAttribute(new Float32Array(vertexCount).fill(glow), 1));
  geometry.dispose();
  return prepared;
}

export function merge(parts: readonly BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries([...parts], false);
  if (!merged) {
    throw new Error("Unable to merge model parts.");
  }
  for (const part of parts) {
    part.dispose();
  }
  merged.computeBoundingSphere();
  return merged;
}

const tempPosition = new Vector3();
const tempQuaternion = new Quaternion();
const tempScale = new Vector3();
const tempEuler = new Euler();

export function place(
  x: number,
  y: number,
  z: number,
  rotationX: number,
  rotationY: number,
  rotationZ: number,
  scaleX: number,
  scaleY: number,
  scaleZ: number,
): Matrix4 {
  tempEuler.set(rotationX, rotationY, rotationZ, "XYZ");
  tempQuaternion.setFromEuler(tempEuler);
  return new Matrix4().compose(tempPosition.set(x, y, z), tempQuaternion, tempScale.set(scaleX, scaleY, scaleZ));
}

export function translate(x: number, y: number, z: number): Matrix4 {
  return new Matrix4().makeTranslation(x, y, z);
}

/**
 * Extrudes a 2D field-space outline (x forward, y toward screen-bottom) upward along +Y,
 * so the footprint matches the 2D silhouette when seen from above.
 */
export function extrudeOutline(outline: readonly Point[], height: number, bevel: number): BufferGeometry {
  const shape = new Shape(outline.map((point) => new Vector2(point.x, -point.y)));
  const geometry = new ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 4,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bevel, 0);
  return geometry;
}

export function scaleOutline(outline: readonly Point[], scale: number): Point[] {
  return outline.map((point) => ({ x: point.x * scale, y: point.y * scale }));
}

/**
 * Thin glowing bars along each outline edge at a fixed height: the 3D stand-in for
 * the 2D stroke outline.
 */
export function outlineTrim(outline: readonly Point[], y: number, thickness: number, height: number): BufferGeometry[] {
  const bars: BufferGeometry[] = [];
  for (let index = 0; index < outline.length; index += 1) {
    const start = outline[index];
    const end = outline[(index + 1) % outline.length];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length < 0.01) {
      continue;
    }
    bars.push(bar(start.x + (dx / 2), y, start.y + (dy / 2), Math.atan2(dy, dx), length + thickness, height, thickness));
  }
  return bars;
}

/** Axis-aligned box geometry turned by a 2D field angle and centered at a field point. */
export function bar(
  centerX: number,
  y: number,
  centerZ: number,
  fieldAngle: number,
  length: number,
  height: number,
  width: number,
): BufferGeometry {
  const geometry = new BoxGeometryLike(length, height, width);
  geometry.applyMatrix4(place(centerX, y, centerZ, 0, -fieldAngle, 0, 1, 1, 1));
  return geometry;
}

/**
 * Tiny box builder (non-indexed, flat normals) that avoids BoxGeometry's uv/group data.
 */
class BoxGeometryLike extends BufferGeometry {
  constructor(width: number, height: number, depth: number) {
    super();
    const hx = width / 2;
    const hy = height / 2;
    const hz = depth / 2;
    const faces: Array<[number[], number[]]> = [
      [[1, 0, 0], [hx, -hy, -hz, hx, hy, -hz, hx, hy, hz, hx, -hy, hz]],
      [[-1, 0, 0], [-hx, -hy, hz, -hx, hy, hz, -hx, hy, -hz, -hx, -hy, -hz]],
      [[0, 1, 0], [-hx, hy, -hz, -hx, hy, hz, hx, hy, hz, hx, hy, -hz]],
      [[0, -1, 0], [-hx, -hy, hz, -hx, -hy, -hz, hx, -hy, -hz, hx, -hy, hz]],
      [[0, 0, 1], [hx, -hy, hz, hx, hy, hz, -hx, hy, hz, -hx, -hy, hz]],
      [[0, 0, -1], [-hx, -hy, -hz, -hx, hy, -hz, hx, hy, -hz, hx, -hy, -hz]],
    ];
    const positions: number[] = [];
    const normals: number[] = [];
    for (const [normal, corners] of faces) {
      for (const cornerIndex of [0, 1, 2, 0, 2, 3]) {
        positions.push(corners[cornerIndex * 3], corners[(cornerIndex * 3) + 1], corners[(cornerIndex * 3) + 2]);
        normals.push(normal[0], normal[1], normal[2]);
      }
    }
    this.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    this.setAttribute("normal", new BufferAttribute(new Float32Array(normals), 3));
  }
}

export function box(width: number, height: number, depth: number): BufferGeometry {
  return new BoxGeometryLike(width, height, depth);
}

/**
 * Faceted solid from triangles given as vertex triplets; normals are per-face so
 * low-poly shapes read crisply under the key light.
 */
export function facetedSolid(triangles: readonly (readonly [Vector3, Vector3, Vector3])[]): BufferGeometry {
  const positions = new Float32Array(triangles.length * 9);
  const normals = new Float32Array(triangles.length * 9);
  const edgeA = new Vector3();
  const edgeB = new Vector3();
  const normal = new Vector3();
  triangles.forEach(([a, b, c], index) => {
    edgeA.subVectors(b, a);
    edgeB.subVectors(c, a);
    normal.crossVectors(edgeA, edgeB).normalize();
    const offset = index * 9;
    positions.set([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z], offset);
    normals.set([normal.x, normal.y, normal.z, normal.x, normal.y, normal.z, normal.x, normal.y, normal.z], offset);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new BufferAttribute(normals, 3));
  return geometry;
}

/**
 * Closed bipyramid over a field-space outline: apexes above and below the outline's
 * origin. Triangles are wound outward regardless of the outline's orientation.
 */
export function bipyramid(outline: readonly Point[], topApex: Vector3, bottomApex: Vector3): BufferGeometry {
  const ring = outline.map((point) => new Vector3(point.x, 0, point.y));
  const triangles: Array<[Vector3, Vector3, Vector3]> = [];
  const center = new Vector3();
  for (const vertex of ring) {
    center.add(vertex);
  }
  center.divideScalar(ring.length);
  const probe = new Vector3();
  const faceNormal = new Vector3();
  const edgeA = new Vector3();
  const edgeB = new Vector3();
  const pushOutward = (a: Vector3, b: Vector3, c: Vector3): void => {
    edgeA.subVectors(b, a);
    edgeB.subVectors(c, a);
    faceNormal.crossVectors(edgeA, edgeB);
    probe.copy(a).add(b).add(c).divideScalar(3).sub(center);
    triangles.push(faceNormal.dot(probe) >= 0 ? [a, b, c] : [a, c, b]);
  };
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    pushOutward(current, next, topApex);
    pushOutward(next, current, bottomApex);
  }
  return facetedSolid(triangles);
}
