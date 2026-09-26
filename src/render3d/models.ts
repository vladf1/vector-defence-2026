import {
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  OctahedronGeometry,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
} from "three/webgpu";
import type { Point } from "../types";
import {
  bar,
  bipyramid,
  box,
  extrudeOutline,
  merge,
  outlineTrim,
  place,
  scaleOutline,
  solid,
  translate,
} from "./geometry-kit";

/*
 * Procedural low-poly models. Monster models are built at unit radius and scaled per
 * instance by the monster's gameplay radius; tower models use field units (tower radius 12).
 * Local +X is "forward" (2D angle 0) and +Z maps to field +Y.
 */

const HALF_TURN = Math.PI;
const QUARTER_TURN = Math.PI / 2;

function glowTrim(outline: readonly Point[], y: number, thickness: number, height: number, glow: number): BufferGeometry[] {
  return outlineTrim(outline, y, thickness, height).map((geometry) => solid(geometry, glow, null));
}

function cylinderAlongX(radius: number, length: number, segments: number, glow: number, startX: number, y: number): BufferGeometry {
  return solid(
    new CylinderGeometry(radius, radius, length, segments),
    glow,
    place(startX + (length / 2), y, 0, 0, 0, -QUARTER_TURN, 1, 1, 1),
  );
}

// ---------------------------------------------------------------- monsters

export function createPackManJaw(): BufferGeometry {
  // The z <= 0 hemisphere (field "up" side) with its cut face capped; the second jaw is
  // this mesh flipped about X, which hides its eye underneath like the 2D single eye.
  return merge([
    solid(new SphereGeometry(1, 22, 14, HALF_TURN, HALF_TURN), 0, null),
    solid(new CircleGeometry(1, 22), 0.32, null),
    solid(new SphereGeometry(0.17, 10, 8), 1, translate(0.18, 0.8, -0.44)),
  ]);
}

export function createSquareBody(): BufferGeometry {
  const parts = [solid(box(2, 2, 2), 0, null)];
  const edge = 2.12;
  const thickness = 0.16;
  for (const a of [-1, 1]) {
    for (const b of [-1, 1]) {
      parts.push(solid(box(edge, thickness, thickness), 1, translate(0, a, b)));
      parts.push(solid(box(thickness, edge, thickness), 1, translate(a, 0, b)));
      parts.push(solid(box(thickness, thickness, edge), 1, translate(a, b, 0)));
    }
  }
  return merge(parts);
}

const TRIANGLE_OUTLINE: Point[] = [{ x: 1, y: 0 }, { x: -1, y: -1 }, { x: -1, y: 1 }];

export function createTriangleBody(): BufferGeometry {
  return merge([
    solid(bipyramid(TRIANGLE_OUTLINE, new Vector3(-0.3, 0.62, 0), new Vector3(-0.3, -0.34, 0)), 0, null),
    ...glowTrim(TRIANGLE_OUTLINE, 0, 0.11, 0.11, 1),
    solid(new SphereGeometry(0.13, 8, 6), 1, translate(0.25, 0.28, 0)),
  ]);
}

const TANK_HULL_TOP = 0.82;

export function createTankHull(): BufferGeometry {
  const hullOutline: Point[] = [
    { x: -1, y: -0.72 },
    { x: 1.1, y: -0.72 },
    { x: 1.1, y: 0.72 },
    { x: -1, y: 0.72 },
  ];
  const parts = [
    solid(box(2.1, 0.5, 1.44), 0, translate(0.05, 0.57, 0)),
    solid(box(1.7, 0.1, 1.1), 0.08, translate(0, TANK_HULL_TOP - 0.02, 0)),
    ...glowTrim(hullOutline, TANK_HULL_TOP - 0.03, 0.07, 0.07, 1),
  ];
  for (const side of [-1, 1]) {
    parts.push(solid(box(2.26, 0.5, 0.34), 0.04, translate(0.05, 0.26, side * 0.86)));
    parts.push(solid(box(2.2, 0.06, 0.06), 1, translate(0.05, 0.53, side * 1.03)));
    for (let tread = 0; tread < 7; tread += 1) {
      parts.push(solid(box(0.1, 0.52, 0.36), 0.12, translate(-0.95 + (tread * 0.33), 0.26, side * 0.86)));
    }
  }
  return merge(parts);
}

/** Turret mesh with its origin at the turret pivot; also used by the flying-turret debris. */
export function createTankTurret(): BufferGeometry {
  return merge([
    solid(new CylinderGeometry(0.44, 0.5, 0.34, 16), 0, translate(0, 0.17, 0)),
    solid(new TorusGeometry(0.46, 0.035, 4, 24), 1, place(0, 0.33, 0, QUARTER_TURN, 0, 0, 1, 1, 1)),
    cylinderAlongX(0.085, 1.2, 8, 0, 0.4, 0.2),
    cylinderAlongX(0.12, 0.16, 8, 1, 1.5, 0.2),
  ]);
}

const RUNNER_OUTLINE: Point[] = [
  { x: 1.8, y: 0 },
  { x: 0.28, y: -0.86 },
  { x: -1.35, y: -0.58 },
  { x: -0.92, y: 0 },
  { x: -1.35, y: 0.58 },
  { x: 0.28, y: 0.86 },
];

export function createRunnerBody(): BufferGeometry {
  return merge([
    solid(extrudeOutline(RUNNER_OUTLINE, 0.32, 0.1), 0, null),
    ...glowTrim(scaleOutline(RUNNER_OUTLINE, 1.05), 0.26, 0.09, 0.09, 1),
    solid(new SphereGeometry(1, 10, 8), 1, place(0.35, 0.5, 0, 0, 0, 0, 0.55, 0.2, 0.28)),
  ]);
}

const SPLITTER_OUTLINE: Point[] = Array.from({ length: 6 }, (_, index) => {
  const angle = (Math.PI / 3) * index;
  const radius = index % 2 === 0 ? 1.15 : 0.72;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
});

export function createSplitterBody(): BufferGeometry {
  return merge([
    solid(bipyramid(SPLITTER_OUTLINE, new Vector3(0, 0.66, 0), new Vector3(0, -0.42, 0)), 0, null),
    ...glowTrim(SPLITTER_OUTLINE, 0, 0.1, 0.1, 1),
    solid(bar(-0.28, 0.42, 0.02, Math.atan2(0.35, 0.55), 0.68, 0.07, 0.08), 1, null),
    solid(bar(0.29, 0.42, 0.01, Math.atan2(-0.38, 0.58), 0.7, 0.07, 0.08), 1, null),
  ]);
}

const BERSERKER_OUTLINE: Point[] = [
  { x: 1.55, y: 0 },
  { x: 0.4, y: -0.8 },
  { x: -0.1, y: -1.08 },
  { x: -1.28, y: -0.44 },
  { x: -0.72, y: 0 },
  { x: -1.28, y: 0.44 },
  { x: -0.1, y: 1.08 },
  { x: 0.4, y: 0.8 },
];

export function createBerserkerBody(): BufferGeometry {
  const parts = [
    solid(extrudeOutline(BERSERKER_OUTLINE, 0.42, 0.12), 0, null),
    ...glowTrim(scaleOutline(BERSERKER_OUTLINE, 1.08), 0.33, 0.09, 0.09, 1),
  ];
  for (const side of [-1, 1]) {
    parts.push(solid(new ConeGeometry(0.16, 0.9, 6), 0.25, place(0.75, 0.55, side * 0.72, 0, side * 0.5, -QUARTER_TURN, 1, 1, 1)));
    parts.push(solid(box(0.28, 0.08, 0.1), 1, place(0.98, 0.67, side * 0.2, 0, side * -0.45, 0, 1, 1, 1)));
  }
  return merge(parts);
}

export function createBerserkerSpikes(): BufferGeometry {
  return merge([-0.42, 0, 0.42].map((z) =>
    solid(new ConeGeometry(0.13, 0.62, 5), 1, place(-0.6, 0.72, z, 0, 0, 0.9, 1, 1, 1)),
  ));
}

const BULWARK_SHELL_OUTLINE: Point[] = [
  { x: 1.35, y: 0 },
  { x: 0.82, y: -0.8 },
  { x: -0.2, y: -0.98 },
  { x: -1.08, y: -0.8 },
  { x: -1.32, y: 0 },
  { x: -1.08, y: 0.8 },
  { x: -0.2, y: 0.98 },
  { x: 0.82, y: 0.8 },
];

const BULWARK_CORE_OUTLINE: Point[] = [
  { x: 0.98, y: 0 },
  { x: 0.42, y: -0.46 },
  { x: -0.3, y: -0.46 },
  { x: -0.72, y: 0 },
  { x: -0.3, y: 0.46 },
  { x: 0.42, y: 0.46 },
];

const BULWARK_FRONT_PLATE_OUTLINE: Point[] = [
  { x: 1.08, y: 0 },
  { x: 0.76, y: -0.28 },
  { x: 0.16, y: -0.28 },
  { x: 0.16, y: 0.28 },
  { x: 0.76, y: 0.28 },
];

const BULWARK_UPPER_TIER_Y = 0.62;

export function createBulwarkShell(): BufferGeometry {
  const upperTier = extrudeOutline(scaleOutline(BULWARK_SHELL_OUTLINE, 0.8), 0.16, 0.06);
  upperTier.translate(0, BULWARK_UPPER_TIER_Y - 0.02, 0);
  const frontPlate = extrudeOutline(BULWARK_FRONT_PLATE_OUTLINE, 0.08, 0.03);
  frontPlate.translate(0, BULWARK_UPPER_TIER_Y + 0.2, 0);
  return merge([
    solid(extrudeOutline(BULWARK_SHELL_OUTLINE, 0.34, 0.14), 0, null),
    solid(upperTier, 0, null),
    solid(frontPlate, 0.5, null),
    ...glowTrim(scaleOutline(BULWARK_SHELL_OUTLINE, 1.09), 0.3, 0.07, 0.1, 0.9),
  ]);
}

/** Pulsing armor core and the glowing armor seams, tinted separately from the shell. */
export function createBulwarkCore(): BufferGeometry {
  const core = extrudeOutline(BULWARK_CORE_OUTLINE, 0.05, 0.02);
  core.translate(0, BULWARK_UPPER_TIER_Y + 0.2, 0);
  return merge([
    solid(core, 1, null),
    solid(bar(0.13, BULWARK_UPPER_TIER_Y + 0.22, -0.52, Math.atan2(0.6, 0.7), 0.9, 0.05, 0.06), 1, null),
    solid(bar(0.13, BULWARK_UPPER_TIER_Y + 0.22, 0.52, Math.atan2(-0.6, 0.7), 0.9, 0.05, 0.06), 1, null),
  ]);
}

/** Irregular crystalline chunk used for every death shard. */
export function createShard(): BufferGeometry {
  const geometry = new OctahedronGeometry(1, 0);
  const position = geometry.getAttribute("position");
  const jitter = [0.82, 1.18, 0.9, 1.05, 0.7, 1.12];
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const axis = Math.abs(x) > 0.5 ? (x > 0 ? 0 : 1) : Math.abs(y) > 0.5 ? (y > 0 ? 2 : 3) : (z > 0 ? 4 : 5);
    const scale = jitter[axis];
    position.setXYZ(index, x * scale * 1.1, y * scale * 0.55, z * scale);
  }
  geometry.computeVertexNormals();
  const faceted = solid(geometry, 0.3, null);
  const glow = faceted.getAttribute("glow");
  for (let index = 0; index < glow.count; index += 1) {
    glow.setX(index, Math.floor(index / 3) % 2 === 0 ? 0.55 : 0.12);
  }
  faceted.computeVertexNormals();
  return faceted;
}

// ---------------------------------------------------------------- towers

export const TOWER_BASE_TOP = 5;

export function createTowerBase(): BufferGeometry {
  return merge([
    solid(new CylinderGeometry(11.2, 12.6, 4.2, 28), 0, translate(0, 2.1, 0)),
    solid(new CylinderGeometry(10.2, 11.2, 0.8, 28), 0, translate(0, 4.6, 0)),
    solid(new TorusGeometry(11.3, 0.42, 6, 40), 1, place(0, 4.25, 0, QUARTER_TURN, 0, 0, 1, 1, 1)),
    solid(new TorusGeometry(12.55, 0.3, 4, 40), 0.55, place(0, 0.5, 0, QUARTER_TURN, 0, 0, 1, 1, 1)),
  ]);
}

export function createLevelPip(): BufferGeometry {
  return solid(box(1.6, 1.1, 1.3), 1, null);
}

export function createGunHead(): BufferGeometry {
  return merge([
    solid(new CylinderGeometry(6.1, 7, 4.2, 6), 0, place(0, TOWER_BASE_TOP + 2.1, 0, 0, HALF_TURN / 6, 0, 1, 1, 1)),
    solid(new TorusGeometry(6.35, 0.32, 4, 6), 1, place(0, TOWER_BASE_TOP + 3.3, 0, QUARTER_TURN, 0, HALF_TURN / 6, 1, 1, 1)),
    solid(box(3.2, 2.6, 5.4), 0.05, translate(-5.2, TOWER_BASE_TOP + 2.7, 0)),
    solid(box(0.5, 0.5, 4.2), 1, translate(-6.9, TOWER_BASE_TOP + 3.2, 0)),
  ]);
}

export const GUN_BARREL_Y = TOWER_BASE_TOP + 3.1;

/** Unit-length barrel along +X; instances scale X by length and Y/Z by radius. */
export function createGunBarrel(): BufferGeometry {
  return merge([
    cylinderAlongX(1, 1, 10, 0, 0, 0),
    solid(box(1, 0.35, 0.3), 1, translate(0.5, 1.02, 0)),
  ]);
}

export function createGunMuzzle(): BufferGeometry {
  return cylinderAlongX(1.35, 1.8, 10, 1, -0.9, 0);
}

/** Unit-length glowing rail along +X. */
export function createRail(): BufferGeometry {
  return solid(box(1, 0.7, 0.7), 1, translate(0.5, 0, 0));
}

export const LASER_CRYSTAL_Y = TOWER_BASE_TOP + 4.4;

/** Unit diamond; instances scale it to each level's crystal length and girth. */
export function createLaserCrystal(): BufferGeometry {
  return solid(new OctahedronGeometry(1, 0), 0.62, null);
}

export function createLaserCradle(): BufferGeometry {
  const parts = [
    solid(new CylinderGeometry(3.4, 4, 2.2, 16), 0, translate(0, TOWER_BASE_TOP + 1.1, 0)),
  ];
  for (const side of [-1, 1]) {
    parts.push(solid(box(7, 3.4, 1.3), 0, translate(-1, TOWER_BASE_TOP + 3.2, side * 4.4)));
    parts.push(solid(box(6.4, 0.4, 0.4), 1, translate(-1, TOWER_BASE_TOP + 5, side * 4.4)));
  }
  return merge(parts);
}

export const MISSILE_RACK_Y = TOWER_BASE_TOP + 2.6;

export function createMissileLauncher(): BufferGeometry {
  const parts = [
    solid(box(19, 1.4, 9.4), 0, translate(0.5, TOWER_BASE_TOP + 0.9, 0)),
    solid(box(2.6, 4.4, 9.4), 0.04, translate(-10.3, TOWER_BASE_TOP + 2.4, 0)),
    solid(box(0.4, 3.6, 7.4), 1, translate(-8.9, TOWER_BASE_TOP + 2.6, 0)),
  ];
  for (const side of [-1, 1]) {
    parts.push(solid(box(19, 3.4, 1.2), 0, translate(0.5, TOWER_BASE_TOP + 2.8, side * 4.1)));
    parts.push(solid(box(18, 0.36, 0.5), 1, translate(0.8, TOWER_BASE_TOP + 4.6, side * 4.1)));
  }
  return merge(parts);
}

/** Missile centered near its midpoint, nose along +X. */
export function createMissile(): BufferGeometry {
  const parts = [
    cylinderAlongX(1.65, 13.4, 10, 0.1, -7.4, 0),
    solid(new ConeGeometry(1.9, 5.2, 10), 1, place(8.6, 0, 0, 0, 0, -QUARTER_TURN, 1, 1, 1)),
    cylinderAlongX(1.35, 2.2, 10, 0.55, -9.6, 0),
  ];
  for (let fin = 0; fin < 4; fin += 1) {
    const angle = (fin * QUARTER_TURN) + (QUARTER_TURN / 2);
    parts.push(solid(box(3.2, 0.3, 2.6), 0, place(-6.4, Math.sin(angle) * 1.9, Math.cos(angle) * 1.9, angle, 0, 0, 1, 1, 1)));
  }
  return merge(parts);
}

export const SLOW_CORE_Y = TOWER_BASE_TOP + 7;

export function createSlowCore(): BufferGeometry {
  return merge([
    solid(new CylinderGeometry(1.6, 3, 6, 12), 0, translate(0, TOWER_BASE_TOP + 3 - SLOW_CORE_Y, 0)),
    solid(new SphereGeometry(4, 20, 14), 1, null),
    solid(new TorusGeometry(6.2, 0.45, 6, 36), 0.75, place(0, 0, 0, QUARTER_TURN + 0.5, 0, 0, 1, 1, 1)),
    solid(new TorusGeometry(5.4, 0.3, 6, 36), 0.55, place(0, 0, 0, QUARTER_TURN - 0.7, 0, 0.4, 1, 1, 1)),
  ]);
}

export function createOrbNode(): BufferGeometry {
  return solid(new SphereGeometry(1, 10, 8), 1, null);
}

export const DRONE_PAD_TOP = TOWER_BASE_TOP + 1.5;

export function createDronePad(): BufferGeometry {
  return merge([
    solid(new CylinderGeometry(9.4, 10.2, 1.5, 6), 0, place(0, TOWER_BASE_TOP + 0.75, 0, 0, HALF_TURN / 6, 0, 1, 1, 1)),
    solid(new TorusGeometry(8.4, 0.36, 4, 6), 1, place(0, DRONE_PAD_TOP, 0, QUARTER_TURN, 0, HALF_TURN / 6, 1, 1, 1)),
    solid(box(0.7, 0.2, 7), 0.8, translate(-2.6, DRONE_PAD_TOP, 0)),
    solid(box(0.7, 0.2, 7), 0.8, translate(2.6, DRONE_PAD_TOP, 0)),
    solid(box(5.2, 0.2, 0.7), 0.8, translate(0, DRONE_PAD_TOP, 0)),
  ]);
}

export const TESLA_TOP_Y = TOWER_BASE_TOP + 17.5;

export function createTeslaCoil(): BufferGeometry {
  return merge([
    solid(new CylinderGeometry(1.5, 2.6, 15, 12), 0, translate(0, TOWER_BASE_TOP + 7.5, 0)),
    solid(new TorusGeometry(4.6, 0.55, 6, 24), 1, place(0, TOWER_BASE_TOP + 3.5, 0, QUARTER_TURN, 0, 0, 1, 1, 1)),
    solid(new TorusGeometry(3.9, 0.5, 6, 24), 1, place(0, TOWER_BASE_TOP + 7.3, 0, QUARTER_TURN, 0, 0, 1, 1, 1)),
    solid(new TorusGeometry(3.2, 0.45, 6, 24), 1, place(0, TOWER_BASE_TOP + 11, 0, QUARTER_TURN, 0, 0, 1, 1, 1)),
    solid(new SphereGeometry(3.3, 16, 12), 1, translate(0, TESLA_TOP_Y, 0)),
  ]);
}

// ---------------------------------------------------------------- flyers & board

export function createDroneBody(): BufferGeometry {
  const parts = [
    solid(box(7.8, 2.2, 7.8), 0, null),
    solid(box(3.8, 0.5, 1.8), 1, translate(0, 1.2, 0)),
    solid(bar(0, 0, 0, Math.PI / 4, 19.5, 1, 1.2), 0, null),
    solid(bar(0, 0, 0, -Math.PI / 4, 19.5, 1, 1.2), 0, null),
  ];
  for (const x of [-6.9, 6.9]) {
    for (const z of [-6.9, 6.9]) {
      parts.push(solid(new CylinderGeometry(1.5, 1.5, 1.8, 10), 0.8, translate(x, 0.2, z)));
    }
  }
  return merge(parts);
}

export function createPortal(): BufferGeometry {
  const parts = [
    solid(new CylinderGeometry(0.96, 1, 0.035, 40), 0.05, translate(0, 0.02, 0)),
    solid(new TorusGeometry(1, 0.06, 6, 48), 1, place(0, 0.05, 0, QUARTER_TURN, 0, 0, 1, 1, 1)),
    solid(new TorusGeometry(0.7, 0.028, 4, 40), 0.8, place(0, 0.05, 0, QUARTER_TURN, 0, 0, 1, 1, 1)),
  ];
  for (let pylon = 0; pylon < 6; pylon += 1) {
    const angle = (pylon / 6) * Math.PI * 2;
    parts.push(solid(box(0.09, 0.24, 0.16), 0.5, place(Math.cos(angle) * 1.1, 0.12, Math.sin(angle) * 1.1, 0, -angle, 0, 1, 1, 1)));
  }
  return merge(parts);
}

export function createSpawnGate(roadWidth: number): BufferGeometry {
  const halfSpan = (roadWidth / 2) + 3.2;
  return merge([
    solid(box(2.6, 15, 2.6), 0.05, translate(0, 7.5, -halfSpan)),
    solid(box(2.6, 15, 2.6), 0.05, translate(0, 7.5, halfSpan)),
    solid(box(2.4, 1.8, (halfSpan * 2) + 2.6), 0.1, translate(0, 15.6, 0)),
    solid(box(0.6, 0.6, halfSpan * 2), 1, translate(0, 14.4, 0)),
    solid(box(0.6, 14, 0.6), 1, translate(0, 7, -halfSpan + 1.4)),
    solid(box(0.6, 14, 0.6), 1, translate(0, 7, halfSpan - 1.4)),
  ]);
}

// ---------------------------------------------------------------- effect geometry

/** Flat unit quad on the ground plane (XZ), centered. */
export function createFlatQuad(): BufferGeometry {
  const geometry = new PlaneGeometry(1, 1);
  geometry.rotateX(-QUARTER_TURN);
  return geometry;
}

/** Flat unit ribbon spanning x = 0..1 with uv.y across its width. */
export function createRibbonQuad(): BufferGeometry {
  const geometry = new PlaneGeometry(1, 1);
  geometry.rotateX(-QUARTER_TURN);
  geometry.translate(0.5, 0, 0);
  return geometry;
}

/** Flat disc quad of radius 1 whose uv spans the full square (shader draws the circle). */
export function createRangeQuad(): BufferGeometry {
  const geometry = new PlaneGeometry(2, 2);
  geometry.rotateX(-QUARTER_TURN);
  return geometry;
}
