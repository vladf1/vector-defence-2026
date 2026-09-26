import { Group, type BufferGeometry } from "three/webgpu";
import { InstancedBatch } from "./instanced-batch";
import type { MaterialSet } from "./materials";
import {
  createBerserkerBody,
  createBerserkerSpikes,
  createBulwarkCore,
  createBulwarkShell,
  createDroneBody,
  createDronePad,
  createFlatQuad,
  createGunBarrel,
  createGunHead,
  createGunMuzzle,
  createLaserCradle,
  createLaserCrystal,
  createLevelPip,
  createMissile,
  createMissileLauncher,
  createOrbNode,
  createPackManJaw,
  createPortal,
  createRail,
  createRangeQuad,
  createRibbonQuad,
  createRunnerBody,
  createShard,
  createSlowCore,
  createSpawnGate,
  createSplitterBody,
  createSquareBody,
  createTankHull,
  createTankTurret,
  createTeslaCoil,
  createTowerBase,
  createTriangleBody,
} from "./models";
import { SpriteBatch } from "./sprite-batch";

export interface BatchCapacities {
  glowSprites: number;
  smokeSprites: number;
  ribbons: number;
}

const ENTITY_CAPACITY = 256;
const PIP_CAPACITY = 1024;
const SHARD_CAPACITY = 1536;
const DECAL_CAPACITY = 3072;
// Blob shadows fall away from the key light (see the renderer's sun placement): per unit height.
const SHADOW_OFFSET_X = 0.39;
const SHADOW_OFFSET_Z = 0.52;
const BLOB_SHADOW_Y = 0.6;
const SHADOW_HEIGHT_SPREAD = 70;
const OPAQUE_RENDER_ORDER = 0;
const DECAL_RENDER_ORDER = 1;
const HEALTH_BAR_RENDER_ORDER = 20;

/**
 * Every drawable in the 3D board. Neon batches all share one material, so this list is
 * a draw-call budget rather than a shader budget.
 */
export class RenderBatches {
  readonly group = new Group();
  readonly towerBase: InstancedBatch;
  readonly pip: InstancedBatch;
  readonly gunHead: InstancedBatch;
  readonly gunBarrel: InstancedBatch;
  readonly gunMuzzle: InstancedBatch;
  readonly rail: InstancedBatch;
  readonly laserCrystal: InstancedBatch;
  readonly laserCradle: InstancedBatch;
  readonly missileLauncher: InstancedBatch;
  readonly missile: InstancedBatch;
  readonly slowCore: InstancedBatch;
  readonly orbNode: InstancedBatch;
  readonly dronePad: InstancedBatch;
  readonly teslaCoil: InstancedBatch;
  readonly droneBody: InstancedBatch;
  readonly packmanJaw: InstancedBatch;
  readonly squareBody: InstancedBatch;
  readonly triangleBody: InstancedBatch;
  readonly tankHull: InstancedBatch;
  readonly tankTurret: InstancedBatch;
  readonly runnerBody: InstancedBatch;
  readonly splitterBody: InstancedBatch;
  readonly berserkerBody: InstancedBatch;
  readonly berserkerSpikes: InstancedBatch;
  readonly bulwarkShell: InstancedBatch;
  readonly bulwarkCore: InstancedBatch;
  readonly shard: InstancedBatch;
  readonly portal: InstancedBatch;
  readonly spawnGate: InstancedBatch;
  readonly ribbon: InstancedBatch;
  readonly decal: InstancedBatch;
  readonly healthBar: InstancedBatch;
  readonly range: InstancedBatch;
  readonly groundGlow: InstancedBatch;
  readonly glow: SpriteBatch;
  readonly smoke: SpriteBatch;
  private readonly instanced: InstancedBatch[] = [];
  private readonly sprites: SpriteBatch[] = [];

  constructor(materials: MaterialSet, roadWidth: number, capacities: BatchCapacities) {
    const neon = (name: string, geometry: BufferGeometry, capacity: number): InstancedBatch => this.addInstanced(
      new InstancedBatch(name, geometry, materials.neon, capacity, {
        renderOrder: OPAQUE_RENDER_ORDER
      }),
    );

    this.towerBase = neon("tower-base", createTowerBase(), ENTITY_CAPACITY);
    this.pip = neon("level-pip", createLevelPip(), PIP_CAPACITY);
    this.gunHead = neon("gun-head", createGunHead(), ENTITY_CAPACITY);
    this.gunBarrel = neon("gun-barrel", createGunBarrel(), ENTITY_CAPACITY);
    this.gunMuzzle = neon("gun-muzzle", createGunMuzzle(), ENTITY_CAPACITY);
    this.rail = neon("rail", createRail(), ENTITY_CAPACITY);
    this.laserCrystal = neon("laser-crystal", createLaserCrystal(), ENTITY_CAPACITY);
    this.laserCradle = neon("laser-cradle", createLaserCradle(), ENTITY_CAPACITY);
    this.missileLauncher = neon("missile-launcher", createMissileLauncher(), ENTITY_CAPACITY);
    this.missile = neon("missile", createMissile(), ENTITY_CAPACITY);
    this.slowCore = neon("slow-core", createSlowCore(), ENTITY_CAPACITY);
    this.orbNode = neon("orb-node", createOrbNode(), ENTITY_CAPACITY);
    this.dronePad = neon("drone-pad", createDronePad(), ENTITY_CAPACITY);
    this.teslaCoil = neon("tesla-coil", createTeslaCoil(), ENTITY_CAPACITY);
    this.droneBody = neon("drone-body", createDroneBody(), ENTITY_CAPACITY);
    this.packmanJaw = neon("packman-jaw", createPackManJaw(), ENTITY_CAPACITY);
    this.squareBody = neon("square-body", createSquareBody(), ENTITY_CAPACITY);
    this.triangleBody = neon("triangle-body", createTriangleBody(), ENTITY_CAPACITY);
    this.tankHull = neon("tank-hull", createTankHull(), ENTITY_CAPACITY);
    this.tankTurret = neon("tank-turret", createTankTurret(), ENTITY_CAPACITY);
    this.runnerBody = neon("runner-body", createRunnerBody(), ENTITY_CAPACITY);
    this.splitterBody = neon("splitter-body", createSplitterBody(), ENTITY_CAPACITY);
    this.berserkerBody = neon("berserker-body", createBerserkerBody(), ENTITY_CAPACITY);
    this.berserkerSpikes = neon("berserker-spikes", createBerserkerSpikes(), ENTITY_CAPACITY);
    this.bulwarkShell = neon("bulwark-shell", createBulwarkShell(), ENTITY_CAPACITY);
    this.bulwarkCore = neon("bulwark-core", createBulwarkCore(), ENTITY_CAPACITY);
    this.shard = neon("shard", createShard(), SHARD_CAPACITY);
    this.portal = neon("portal", createPortal(), ENTITY_CAPACITY);
    this.spawnGate = neon("spawn-gate", createSpawnGate(roadWidth), ENTITY_CAPACITY);

    this.decal = this.addInstanced(new InstancedBatch("decal", createFlatQuad(), materials.decal, DECAL_CAPACITY, {
      renderOrder: DECAL_RENDER_ORDER
    }));
    this.range = this.addInstanced(new InstancedBatch("range", createRangeQuad(), materials.range, 4, {
      renderOrder: DECAL_RENDER_ORDER
    }));
    this.groundGlow = this.addInstanced(new InstancedBatch("ground-glow", createRangeQuad(), materials.groundGlow, ENTITY_CAPACITY, {
      renderOrder: DECAL_RENDER_ORDER
    }));
    this.ribbon = this.addInstanced(new InstancedBatch("ribbon", createRibbonQuad(), materials.ribbon, capacities.ribbons, {
      renderOrder: OPAQUE_RENDER_ORDER
    }));
    this.healthBar = this.addInstanced(new InstancedBatch("health-bar", createFlatQuad(), materials.healthBar, ENTITY_CAPACITY * 2, {
      renderOrder: HEALTH_BAR_RENDER_ORDER
    }));
    this.smoke = this.addSprite(new SpriteBatch("smoke", capacities.smokeSprites, materials.createSmokeSprite));
    this.glow = this.addSprite(new SpriteBatch("glow", capacities.glowSprites, materials.createGlowSprite));
  }

  begin(): void {
    for (const batch of this.instanced) {
      batch.begin();
    }
    for (const batch of this.sprites) {
      batch.begin();
    }
  }

  finish(): void {
    for (const batch of this.instanced) {
      batch.finish();
    }
    for (const batch of this.sprites) {
      batch.finish();
    }
  }

  prepareForCompile(): void {
    for (const batch of this.instanced) {
      batch.prepareForCompile();
    }
    for (const batch of this.sprites) {
      batch.prepareForCompile();
    }
  }

  /**
   * Soft blob shadow for an object `height` above the ground: offset along the key light,
   * wider and fainter the higher it flies. Replaces shadow maps, which cost a depth pass
   * every frame and several slow-compiling shader variants at startup.
   */
  pushBlobShadow(x: number, z: number, height: number, radiusX: number, radiusZ: number, yaw: number, strength: number): void {
    const spread = 1 + (Math.max(0, height) / SHADOW_HEIGHT_SPREAD);
    const slot = this.decal.pushYaw(
      x + (height * SHADOW_OFFSET_X),
      BLOB_SHADOW_Y,
      z + (height * SHADOW_OFFSET_Z),
      yaw,
      radiusX * 2 * spread,
      1,
      radiusZ * 2 * spread,
      0,
      0,
      0,
    );
    this.decal.setExtra(slot, 0, strength / spread);
    this.decal.setExtra(slot, 2, 1);
  }

  /** Flat glow on the ground: `shape` 0 is a soft disc, 1 a ring. */
  pushGroundGlow(x: number, y: number, z: number, radius: number, shape: number, red: number, green: number, blue: number, alpha: number): void {
    const slot = this.groundGlow.pushYaw(x, y, z, 0, radius, 1, radius, red, green, blue);
    this.groundGlow.setExtra(slot, 0, alpha);
    this.groundGlow.setExtra(slot, 1, shape);
  }

  get drawnInstances(): number {
    let total = 0;
    for (const batch of this.instanced) {
      total += batch.size;
    }
    for (const batch of this.sprites) {
      total += batch.size;
    }
    return total;
  }

  dispose(): void {
    for (const batch of this.instanced) {
      batch.dispose();
    }
    for (const batch of this.sprites) {
      batch.sprite.material.dispose();
    }
  }

  private addInstanced(batch: InstancedBatch): InstancedBatch {
    this.instanced.push(batch);
    this.group.add(batch.mesh);
    return batch;
  }

  private addSprite(batch: SpriteBatch): SpriteBatch {
    this.sprites.push(batch);
    this.group.add(batch.sprite);
    return batch;
  }
}
