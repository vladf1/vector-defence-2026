import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  Vector3,
  WebGLRenderer,
} from "three";
import { FIELD_HEIGHT, FIELD_WIDTH, TOWER_RADIUS } from "./constants";
import { CircleShardParticle } from "./entities/effects/circle-shard-particle";
import { GlassShardParticle } from "./entities/effects/glass-shard-particle";
import { LinkEffect } from "./entities/effects/link-effect";
import { Particle } from "./entities/effects/particle";
import { TankTurretParticle } from "./entities/effects/tank-turret-particle";
import { Missile } from "./entities/projectiles/missile";
import { Projectile } from "./entities/projectiles/projectile";
import { BallMonster } from "./entities/monsters/ball-monster";
import { BerserkerMonster } from "./entities/monsters/berserker-monster";
import { BulwarkMonster } from "./entities/monsters/bulwark-monster";
import { Monster } from "./entities/monsters/monster";
import { RunnerMonster } from "./entities/monsters/runner-monster";
import { SplitterMonster } from "./entities/monsters/splitter-monster";
import { SquareMonster } from "./entities/monsters/square-monster";
import { TankMonster } from "./entities/monsters/tank-monster";
import { TriangleMonster } from "./entities/monsters/triangle-monster";
import { GunTower } from "./entities/towers/gun-tower";
import { LaserTower } from "./entities/towers/laser-tower";
import { MissileTower } from "./entities/towers/missile-tower";
import { SlowTower } from "./entities/towers/slow-tower";
import { getTowerClass } from "./entities/towers/tower-registry";
import { Tower } from "./entities/towers/tower";
import type { Game } from "./game-engine";
import type { Point } from "./types";

const BOARD_CENTER_X = FIELD_WIDTH / 2;
const BOARD_CENTER_Z = FIELD_HEIGHT / 2;
const UP = new Vector3(0, 1, 0);
const FLOOR_Y = 0;
const VIEW_HEIGHT = FIELD_HEIGHT * 1.08;
const CAMERA_ASPECT = FIELD_WIDTH / FIELD_HEIGHT;
const ROAD_WIDTH = 26;
const ROAD_GLOW_WIDTH = 6;
const BACKDROP_WIDTH = FIELD_WIDTH * 1.5;
const BACKDROP_DEPTH = FIELD_HEIGHT * 1.75;
const ROAD_TEXTURE_SCALE = 2;
const ROAD_LAYER_Y = FLOOR_Y + 0.28;
const RANGE_DISC_Y = FLOOR_Y + 1.65;
const RANGE_RING_Y = FLOOR_Y + 1.8;
const PREVIEW_GUIDE_Y = FLOOR_Y + 1.95;
const MIN_VIEW_ZOOM = 0.65;
const MAX_VIEW_ZOOM = 3.2;

function quantizeAlpha(alpha: number): number {
  return Math.max(0, Math.min(1, Math.round(alpha * 16) / 16));
}

export class GameRenderer {
  canvas: HTMLCanvasElement;
  currentDpr = window.devicePixelRatio || 1;

  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly worldRoot = new Group();
  private readonly camera = new OrthographicCamera(
    -(VIEW_HEIGHT * CAMERA_ASPECT) / 2,
    (VIEW_HEIGHT * CAMERA_ASPECT) / 2,
    VIEW_HEIGHT / 2,
    -VIEW_HEIGHT / 2,
    1,
    1600,
  );
  private readonly boardRoot = new Group();
  private readonly dynamicRoot = new Group();
  private readonly materialCache = new Map<string, MeshStandardMaterial>();
  private readonly basicMaterialCache = new Map<string, MeshBasicMaterial>();
  private readonly boxGeometry = new BoxGeometry(1, 1, 1);
  private readonly cylinderGeometry = new CylinderGeometry(1, 1, 1, 24);
  private readonly hexCylinderGeometry = new CylinderGeometry(1, 1, 1, 6);
  private readonly sphereGeometry = new SphereGeometry(1, 18, 12);
  private readonly coneGeometry = new ConeGeometry(1, 1, 20);
  private readonly runnerGeometry = new ConeGeometry(1, 1, 4);
  private readonly shardGeometry = new IcosahedronGeometry(1, 0);
  private readonly planeGeometry = new PlaneGeometry(1, 1);
  private readonly ringGeometry = new RingGeometry(0.98, 1, 96);
  private readonly discGeometry = new CircleGeometry(1, 96);
  private readonly boardPlaneGeometry = new PlaneGeometry(FIELD_WIDTH, FIELD_HEIGHT);
  private readonly cylinderQuaternion = new Quaternion();
  private viewZoom = 1;
  private viewRotation = 0;
  private viewPanX = 0;
  private viewPanZ = 0;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly game: Game,
  ) {
    this.canvas = canvas;
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x050806, 1);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.camera.position.set(0, 760, 0);
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(0, 0, 0);

    this.worldRoot.add(this.boardRoot);
    this.worldRoot.add(this.dynamicRoot);
    this.scene.add(this.worldRoot);
    this.scene.add(new AmbientLight(0x9ec8ff, 0.42));
    this.scene.add(new HemisphereLight(0xa5ffdd, 0x11170f, 0.72));
    const keyLight = new DirectionalLight(0xffffff, 1.9);
    keyLight.position.set(-220, 420, 260);
    this.scene.add(keyLight);
    const rimLight = new DirectionalLight(0x68f7ff, 1.0);
    rimLight.position.set(360, 280, -300);
    this.scene.add(rimLight);
    this.applyViewTransform();
  }

  resize(): void {
    this.currentDpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(this.currentDpr);
    this.renderer.setSize(FIELD_WIDTH, FIELD_HEIGHT, false);
    this.rebuildBackgroundCache();
  }

  rebuildBackgroundCache(): void {
    this.boardRoot.clear();
    this.drawBoard();
  }

  draw(): void {
    const runtime = this.game.runtime;
    this.dynamicRoot.clear();

    for (const link of runtime.links) {
      this.drawLink(link);
    }

    for (const projectile of runtime.projectiles) {
      this.drawProjectile(projectile);
    }

    for (const missile of runtime.missiles) {
      this.drawMissile(missile);
    }

    for (const monster of runtime.getActiveMonsters()) {
      this.drawMonster(monster);
    }

    for (const tower of runtime.towers) {
      this.drawTower(tower, tower === runtime.selectedTower);
    }

    for (const particle of runtime.particles) {
      this.drawParticle(particle);
    }

    this.drawPreview();
    this.renderer.render(this.scene, this.camera);
  }

  screenToBoardPoint(canvasPoint: Point): Point {
    const world = this.canvasToWorldPoint(canvasPoint);
    const scaledX = (world.x - this.viewPanX) / this.viewZoom;
    const scaledZ = (world.z - this.viewPanZ) / this.viewZoom;
    const cos = Math.cos(this.viewRotation);
    const sin = Math.sin(this.viewRotation);
    return {
      x: (scaledX * cos) - (scaledZ * sin) + BOARD_CENTER_X,
      y: (scaledX * sin) + (scaledZ * cos) + BOARD_CENTER_Z,
    };
  }

  boardToCanvasPoint(point: Point): Point {
    const world = this.boardToWorldPoint(point);
    return {
      x: ((world.x / (VIEW_HEIGHT * CAMERA_ASPECT)) + 0.5) * FIELD_WIDTH,
      y: ((world.z / VIEW_HEIGHT) + 0.5) * FIELD_HEIGHT,
    };
  }

  panView(deltaCanvasX: number, deltaCanvasY: number): void {
    this.viewPanX += (deltaCanvasX / FIELD_WIDTH) * VIEW_HEIGHT * CAMERA_ASPECT;
    this.viewPanZ += (deltaCanvasY / FIELD_HEIGHT) * VIEW_HEIGHT;
    this.applyViewTransform();
  }

  zoomViewAt(canvasPoint: Point, deltaY: number): void {
    const localPoint = this.screenToBoardPoint(canvasPoint);
    const targetWorld = this.canvasToWorldPoint(canvasPoint);
    const factor = Math.exp(-deltaY * 0.0012);
    this.viewZoom = Math.max(MIN_VIEW_ZOOM, Math.min(MAX_VIEW_ZOOM, this.viewZoom * factor));
    this.setPanToKeepBoardPointAtWorld(localPoint, targetWorld);
    this.applyViewTransform();
  }

  rotateViewAt(canvasPoint: Point, deltaRadians: number): void {
    const localPoint = this.screenToBoardPoint(canvasPoint);
    const targetWorld = this.canvasToWorldPoint(canvasPoint);
    this.viewRotation += deltaRadians;
    this.setPanToKeepBoardPointAtWorld(localPoint, targetWorld);
    this.applyViewTransform();
  }

  resetView(): void {
    this.viewZoom = 1;
    this.viewRotation = 0;
    this.viewPanX = 0;
    this.viewPanZ = 0;
    this.applyViewTransform();
  }

  private drawBoard(): void {
    const floor = new Mesh(
      new PlaneGeometry(BACKDROP_WIDTH, BACKDROP_DEPTH),
      this.basicMaterial("#06110d", 1, DoubleSide),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = FLOOR_Y - 0.04;
    this.boardRoot.add(floor);

    this.addBoardTextureLayer(this.createGridTexture(), FLOOR_Y + 0.02);

    if (!this.game.currentLevel) {
      return;
    }

    const points = this.game.currentLevel.points;
    this.addBoardTextureLayer(this.createRoadTexture(points), ROAD_LAYER_Y);
  }

  private addBoardTextureLayer(texture: Texture, worldY: number): void {
    const layer = new Mesh(
      this.boardPlaneGeometry,
      new MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: DoubleSide,
        depthWrite: false,
      }),
    );
    layer.rotation.x = -Math.PI / 2;
    layer.position.y = worldY;
    this.boardRoot.add(layer);
  }

  private applyViewTransform(): void {
    this.worldRoot.position.set(this.viewPanX, 0, this.viewPanZ);
    this.worldRoot.rotation.y = this.viewRotation;
    this.worldRoot.scale.setScalar(this.viewZoom);
  }

  private canvasToWorldPoint(canvasPoint: Point): { x: number; z: number } {
    return {
      x: ((canvasPoint.x / FIELD_WIDTH) - 0.5) * VIEW_HEIGHT * CAMERA_ASPECT,
      z: ((canvasPoint.y / FIELD_HEIGHT) - 0.5) * VIEW_HEIGHT,
    };
  }

  private boardToWorldPoint(point: Point): { x: number; z: number } {
    const localX = point.x - BOARD_CENTER_X;
    const localZ = point.y - BOARD_CENTER_Z;
    const cos = Math.cos(this.viewRotation);
    const sin = Math.sin(this.viewRotation);
    return {
      x: this.viewPanX + (this.viewZoom * ((localX * cos) + (localZ * sin))),
      z: this.viewPanZ + (this.viewZoom * ((-localX * sin) + (localZ * cos))),
    };
  }

  private setPanToKeepBoardPointAtWorld(point: Point, world: { x: number; z: number }): void {
    const localX = point.x - BOARD_CENTER_X;
    const localZ = point.y - BOARD_CENTER_Z;
    const cos = Math.cos(this.viewRotation);
    const sin = Math.sin(this.viewRotation);
    this.viewPanX = world.x - (this.viewZoom * ((localX * cos) + (localZ * sin)));
    this.viewPanZ = world.z - (this.viewZoom * ((-localX * sin) + (localZ * cos)));
  }

  private drawTower(tower: Tower, active: boolean): void {
    const group = new Group();
    group.position.set(this.toWorldX(tower.x), FLOOR_Y, this.toWorldZ(tower.y));
    this.dynamicRoot.add(group);

    if (active) {
      this.addRangeDisc(tower.x, tower.y, tower.range, "#5cff9e", 0.075);
      this.addRangeRing(tower.x, tower.y, tower.range, "#5cff9e", 0.38);
    }

    if (tower instanceof GunTower) {
      this.drawGunTower(group, tower);
    } else if (tower instanceof LaserTower) {
      this.drawLaserTower(group, tower);
    } else if (tower instanceof MissileTower) {
      this.drawMissileTower(group, tower);
    } else if (tower instanceof SlowTower) {
      this.drawSlowTower(group, tower);
    }
  }

  private drawGunTower(group: Group, tower: GunTower): void {
    this.addCylinder(group, 0, 4, 0, TOWER_RADIUS + 2, 8, "#0a0f0d", "#ffffff", 0.15);
    this.addSphere(group, 0, 10, 0, 6.5, "#f2f8ff", "#ffffff", 0.18);
    const barrel = this.addCylinder(group, 9, 11, 0, 1.55 + (tower.level * 0.12), 18, "#ffffff", "#ffffff", 0.35);
    barrel.rotation.z = Math.PI / 2;
    this.addSphere(group, 18, 11, 0, 2.4, "#9fffe4", "#9fffe4", 0.6);
    group.rotation.y = -tower.angle;
  }

  private drawLaserTower(group: Group, tower: LaserTower): void {
    this.addCylinder(group, 0, 4, 0, 13, 8, "#07100d", "#ffffff", 0.14);
    const head = this.addCone(group, 0, 12, 0, 8, 13, "#5bf4ff", "#5bf4ff", 0.42);
    head.rotation.z = -Math.PI / 2;
    group.rotation.y = -tower.angle;

    if (tower.beamAlpha > 0) {
      this.addLine(this.dynamicRoot, tower.x + (Math.cos(tower.angle) * 9), tower.y + (Math.sin(tower.angle) * 9), tower.beamTarget.x, tower.beamTarget.y, 1.4 + (tower.level * 0.18), "#6eff98", 0.8 * tower.beamAlpha, FLOOR_Y + 13);
      this.addLine(this.dynamicRoot, tower.x, tower.y, tower.beamTarget.x, tower.beamTarget.y, 4.5, "#5bf4ff", 0.14 * tower.beamAlpha, FLOOR_Y + 12);
    }
  }

  private drawMissileTower(group: Group, tower: MissileTower): void {
    this.addCylinder(group, 0, 4.5, 0, 14, 9, "#09120f", "#d7e2ea", 0.1);
    const body = this.addBox(group, -2, 12, 0, 16, 9, 13, "#202b35", "#ffffff", 0.12);
    body.rotation.y = 0;
    const ready = tower.cooldownSeconds <= 0;
    for (const offset of [-5.2, 5.2]) {
      this.addBox(group, 6, 15, offset, 16, 3.2, 3.2, ready ? "#ffe27a" : "#78838b", "#ffe27a", ready ? 0.3 : 0.05);
    }
    group.rotation.y = -tower.angle;
  }

  private drawSlowTower(group: Group, tower: SlowTower): void {
    this.addCylinder(group, 0, 3.8, 0, TOWER_RADIUS + 2, 7.6, "#0a0f0d", "#fff5a5", 0.12);
    const pulse = 0.72 + (Math.sin(tower.pulse) * 0.18);
    this.addSphere(group, 0, 11, 0, 7.5 * pulse, "#ffdc5c", "#ffdc5c", 0.45);
    this.addRangeRing(tower.x, tower.y, 16 + (Math.sin(tower.pulse) * 3), "#ffdc5c", 0.22);
  }

  private drawMonster(monster: Monster): void {
    const group = new Group();
    group.position.set(this.toWorldX(monster.x), FLOOR_Y, this.toWorldZ(monster.y));
    group.rotation.y = -monster.angle;
    this.dynamicRoot.add(group);

    const color = monster.damageFlash > 0 ? "#9950ff" : monster.color;
    const emissiveIntensity = monster.damageFlash > 0 ? 0.55 : 0.18;

    if (monster instanceof BallMonster) {
      this.addSphere(group, 0, monster.radius, 0, monster.radius, color, color, emissiveIntensity);
    } else if (monster instanceof SquareMonster) {
      const body = this.addBox(group, 0, monster.radius, 0, monster.radius * 2, monster.radius * 1.9, monster.radius * 2, color, color, emissiveIntensity);
      body.rotation.y = -monster.rotation;
    } else if (monster instanceof TriangleMonster) {
      const body = this.addCone(group, 2, monster.radius, 0, monster.radius, monster.radius * 2.5, color, color, emissiveIntensity);
      body.rotation.z = -Math.PI / 2;
    } else if (monster instanceof TankMonster) {
      this.addBox(group, 0, monster.radius * 0.76, 0, monster.radius * 2.25, monster.radius * 1.3, monster.radius * 1.45, color, color, emissiveIntensity);
      this.addCylinder(group, monster.radius * 0.1, monster.radius * 1.55, 0, monster.radius * 0.42, monster.radius * 0.45, color, color, 0.16);
      const barrel = this.addCylinder(group, monster.radius * 0.95, monster.radius * 1.55, 0, 0.9, monster.radius * 1.4, color, color, 0.12);
      barrel.rotation.z = Math.PI / 2;
    } else if (monster instanceof RunnerMonster) {
      const body = this.addCone(group, monster.radius * 0.28, monster.radius, 0, monster.radius * 0.95, monster.radius * 3.1, color, color, emissiveIntensity);
      body.rotation.z = -Math.PI / 2;
    } else if (monster instanceof SplitterMonster) {
      const body = this.addMesh(group, this.shardGeometry, 0, monster.radius, 0, monster.radius * 1.18, monster.radius * 1.18, monster.radius * 1.18, color, color, emissiveIntensity);
      body.rotation.y = -monster.rotation;
    } else if (monster instanceof BulwarkMonster) {
      this.addCylinder(group, 0, monster.radius, 0, monster.radius * 1.25, monster.radius * 1.8, color, "#dff7ff", 0.32, 6);
      this.addRangeRing(monster.x, monster.y, monster.radius * 1.65, "#dff7ff", 0.25, FLOOR_Y + 2.2);
    } else if (monster instanceof BerserkerMonster) {
      const body = this.addMesh(group, this.runnerGeometry, monster.radius * 0.2, monster.radius, 0, monster.radius * 1.15, monster.radius * 2.75, monster.radius * 1.15, color, color, emissiveIntensity);
      body.rotation.z = -Math.PI / 2;
    } else {
      this.addSphere(group, 0, monster.radius, 0, monster.radius, color, color, emissiveIntensity);
    }

    this.drawHealthBar(monster);
  }

  private drawHealthBar(monster: Monster): void {
    const barWidth = Math.max(18, monster.radius * 2.3);
    const fillWidth = barWidth * (monster.hitPoints / monster.maxHitPoints);
    const z = this.toWorldZ(monster.y - monster.radius - 8);
    const y = FLOOR_Y + 2.4;
    const back = new Mesh(this.planeGeometry, this.basicMaterial("#040706", 0.82, DoubleSide));
    back.position.set(this.toWorldX(monster.x), y, z);
    back.rotation.x = -Math.PI / 2;
    back.scale.set(barWidth, 3.2, 1);
    this.dynamicRoot.add(back);
    const fill = new Mesh(this.planeGeometry, this.basicMaterial("#4cff90", 0.95, DoubleSide));
    fill.position.set(this.toWorldX(monster.x - ((barWidth - fillWidth) / 2)), y + 0.05, z + 0.05);
    fill.rotation.x = -Math.PI / 2;
    fill.scale.set(fillWidth, 2.1, 1);
    this.dynamicRoot.add(fill);
  }

  private drawProjectile(projectile: Projectile): void {
    this.addSphere(this.dynamicRoot, this.toWorldX(projectile.x), FLOOR_Y + 8, this.toWorldZ(projectile.y), Math.max(2.2, projectile.radius * 1.15), "#9fffe4", "#9fffe4", 0.85);
  }

  private drawMissile(missile: Missile): void {
    const group = new Group();
    group.position.set(this.toWorldX(missile.x), FLOOR_Y + 8, this.toWorldZ(missile.y));
    group.rotation.y = -missile.angle;
    this.dynamicRoot.add(group);
    const body = this.addCylinder(group, 0, 0, 0, 2.1, 14, "#ffe77c", "#ffe77c", 0.5);
    body.rotation.z = Math.PI / 2;
    this.addCone(group, 8, 0, 0, 2.4, 5, "#fff5b2", "#fff5b2", 0.45).rotation.z = -Math.PI / 2;
    this.addSphere(group, -7, 0, 0, 2.6, "#ff7b45", "#ff7b45", 0.72);
  }

  private drawParticle(particle: Particle): void {
    const alpha = quantizeAlpha(particle.alpha);
    if (particle instanceof TankTurretParticle) {
      this.drawTankTurretParticle(particle, alpha);
      return;
    }

    const visualSize = this.getParticleVisualSize(particle);
    const mesh = new Mesh(this.shardGeometry, this.material(particle.color, alpha, particle.color, 0.28));
    mesh.position.set(this.toWorldX(particle.x), FLOOR_Y + 2 + (alpha * 4), this.toWorldZ(particle.y));
    mesh.scale.setScalar(visualSize);
    mesh.rotation.set(particle.x * 0.03, particle.y * 0.03, (particle.x + particle.y) * 0.02);
    this.dynamicRoot.add(mesh);
  }

  private drawTankTurretParticle(particle: TankTurretParticle, alpha: number): void {
    const group = new Group();
    group.position.set(this.toWorldX(particle.x), FLOOR_Y + 5 + (alpha * 8), this.toWorldZ(particle.y));
    group.rotation.y = -particle.rotation;
    this.dynamicRoot.add(group);

    const turretRadius = particle.radius * 0.48;
    const material = this.material("#dfe6f3", alpha, "#ffffff", 0.35);
    const accentMaterial = this.material(particle.color, alpha * 0.82, particle.color, 0.24);
    const shadow = new Mesh(this.cylinderGeometry, accentMaterial);
    shadow.position.set(0, -0.6, 0);
    shadow.scale.set(particle.radius * 0.64, 0.8, particle.radius * 0.42);
    group.add(shadow);

    const turret = new Mesh(this.cylinderGeometry, material);
    turret.position.set(particle.radius * 0.08, 0, 0);
    turret.scale.set(turretRadius, 2.2, turretRadius);
    group.add(turret);

    const barrel = new Mesh(this.cylinderGeometry, material);
    barrel.position.set(particle.radius * 1.02, 0, 0);
    barrel.scale.set(Math.max(0.72, particle.radius * 0.09), particle.radius * 0.95, Math.max(0.72, particle.radius * 0.09));
    barrel.rotation.z = Math.PI / 2;
    group.add(barrel);
  }

  private getParticleVisualSize(particle: Particle): number {
    if (particle instanceof CircleShardParticle) {
      return Math.max(1.1, particle.radius * 0.28);
    }

    if (particle instanceof TankTurretParticle) {
      return Math.max(1.4, particle.radius * 0.34);
    }

    if (particle instanceof GlassShardParticle) {
      let farthestVertex = 0;
      for (const vertex of particle.vertices) {
        farthestVertex = Math.max(farthestVertex, Math.hypot(vertex.x, vertex.y));
      }
      return Math.max(0.9, farthestVertex * 0.32);
    }

    return Math.max(0.75, particle.size * 0.52);
  }

  private drawLink(link: LinkEffect): void {
    const fromX = link.fromTower ? link.fromTower.x : link.from?.x;
    const fromY = link.fromTower ? link.fromTower.y : link.from?.y;
    if (fromX === undefined || fromY === undefined) {
      return;
    }

    this.addLine(this.dynamicRoot, fromX, fromY, link.target.x, link.target.y, 0.9, link.color, link.alpha, FLOOR_Y + 14);
  }

  private drawPreview(): void {
    const runtime = this.game.runtime;
    if (!runtime.pointer || !runtime.placingTower) {
      return;
    }

    const towerClass = getTowerClass(runtime.placingTower);
    const valid = this.game.canPlaceTower(runtime.pointer) && runtime.money >= towerClass.baseCost;
    const color = valid ? "#5cff9e" : "#ff7878";
    this.addRangeDisc(runtime.pointer.x, runtime.pointer.y, towerClass.baseRange, color, 0.075);
    this.addRangeRing(runtime.pointer.x, runtime.pointer.y, towerClass.baseRange, color, 0.42);
    this.addRangeRing(runtime.pointer.x, runtime.pointer.y, TOWER_RADIUS, color, 0.6);
    this.addDashedPreviewLine(runtime.pointer.x, 0, runtime.pointer.x, FIELD_HEIGHT, color);
    this.addDashedPreviewLine(0, runtime.pointer.y, FIELD_WIDTH, runtime.pointer.y, color);
  }

  private addDashedPreviewLine(x1: number, y1: number, x2: number, y2: number, color: string): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    const step = 18;
    const segmentLength = 8;
    for (let distance = 0; distance < length; distance += step) {
      const startRatio = distance / length;
      const endRatio = Math.min(1, (distance + segmentLength) / length);
      this.addLine(
        this.dynamicRoot,
        x1 + (dx * startRatio),
        y1 + (dy * startRatio),
        x1 + (dx * endRatio),
        y1 + (dy * endRatio),
        0.52,
        color,
        0.45,
        PREVIEW_GUIDE_Y,
      );
    }
  }

  private addRangeDisc(x: number, y: number, radius: number, color: string, opacity: number): void {
    const mesh = new Mesh(this.discGeometry, this.basicMaterial(color, opacity, DoubleSide));
    mesh.position.set(this.toWorldX(x), RANGE_DISC_Y, this.toWorldZ(y));
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(radius, radius, 1);
    this.dynamicRoot.add(mesh);
  }

  private addRangeRing(x: number, y: number, radius: number, color: string, opacity: number, worldY = RANGE_RING_Y): void {
    const mesh = new Mesh(this.ringGeometry, this.basicMaterial(color, opacity, DoubleSide));
    mesh.position.set(this.toWorldX(x), worldY, this.toWorldZ(y));
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(radius, radius, 1);
    this.dynamicRoot.add(mesh);
  }

  private createRoadTexture(points: Point[]): CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = FIELD_WIDTH * ROAD_TEXTURE_SCALE;
    canvas.height = FIELD_HEIGHT * ROAD_TEXTURE_SCALE;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Road texture canvas unavailable.");
    }

    context.scale(ROAD_TEXTURE_SCALE, ROAD_TEXTURE_SCALE);
    context.lineJoin = "round";
    context.lineCap = "round";

    this.strokeRoadPath(context, points, ROAD_WIDTH + 9, "rgb(3, 13, 12)");
    this.strokeRoadPath(context, points, ROAD_WIDTH + 3, "rgb(8, 40, 36)");
    this.strokeRoadPath(context, points, ROAD_GLOW_WIDTH, "rgba(93, 240, 194, 0.26)");

    const start = points[0];
    const finish = points[points.length - 1];
    context.fillStyle = "rgba(93, 240, 194, 0.17)";
    context.beginPath();
    context.arc(start.x, start.y, 17, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(finish.x, finish.y, 22, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "rgba(93, 240, 194, 0.28)";
    context.beginPath();
    context.arc(finish.x, finish.y, 10, 0, Math.PI * 2);
    context.fill();

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  private createGridTexture(): CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = FIELD_WIDTH * ROAD_TEXTURE_SCALE;
    canvas.height = FIELD_HEIGHT * ROAD_TEXTURE_SCALE;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Grid texture canvas unavailable.");
    }

    context.scale(ROAD_TEXTURE_SCALE, ROAD_TEXTURE_SCALE);
    context.strokeStyle = "rgba(255, 255, 255, 0.055)";
    context.lineWidth = 0.9;
    for (let x = 0; x <= FIELD_WIDTH; x += 35) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, FIELD_HEIGHT);
      context.stroke();
    }
    for (let y = 0; y <= FIELD_HEIGHT; y += 35) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(FIELD_WIDTH, y);
      context.stroke();
    }

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  private strokeRoadPath(context: CanvasRenderingContext2D, points: Point[], width: number, color: string): void {
    const first = points[0];
    context.strokeStyle = color;
    context.lineWidth = width;
    context.beginPath();
    context.moveTo(first.x, first.y);
    for (let index = 1; index < points.length; index += 1) {
      const point = points[index];
      context.lineTo(point.x, point.y);
    }
    context.stroke();
  }

  private addLine(root: Group, x1: number, y1: number, x2: number, y2: number, radius: number, color: string, opacity: number, worldY: number): void {
    const start = new Vector3(this.toWorldX(x1), worldY, this.toWorldZ(y1));
    const end = new Vector3(this.toWorldX(x2), worldY, this.toWorldZ(y2));
    const direction = end.clone().sub(start);
    const length = direction.length();
    if (length <= 0) {
      return;
    }

    const mesh = new Mesh(this.cylinderGeometry, this.material(color, opacity, color, opacity * 0.45));
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.scale.set(radius, length, radius);
    this.cylinderQuaternion.setFromUnitVectors(UP, direction.normalize());
    mesh.quaternion.copy(this.cylinderQuaternion);
    root.add(mesh);
  }

  private addCylinder(root: Group, x: number, y: number, z: number, radius: number, height: number, color: string, emissive = color, emissiveIntensity = 0.1, radialSegments?: number): Mesh {
    const geometry = radialSegments === 6 ? this.hexCylinderGeometry : this.cylinderGeometry;
    const mesh = this.addMesh(root, geometry, x, y, z, radius, height, radius, color, emissive, emissiveIntensity);
    return mesh;
  }

  private addSphere(root: Group, x: number, y: number, z: number, radius: number, color: string, emissive = color, emissiveIntensity = 0.1): Mesh {
    return this.addMesh(root, this.sphereGeometry, x, y, z, radius, radius, radius, color, emissive, emissiveIntensity);
  }

  private addCone(root: Group, x: number, y: number, z: number, radius: number, height: number, color: string, emissive = color, emissiveIntensity = 0.1): Mesh {
    return this.addMesh(root, this.coneGeometry, x, y, z, radius, height, radius, color, emissive, emissiveIntensity);
  }

  private addBox(root: Group, x: number, y: number, z: number, width: number, height: number, depth: number, color: string, emissive = color, emissiveIntensity = 0.1): Mesh {
    return this.addMesh(root, this.boxGeometry, x, y, z, width, height, depth, color, emissive, emissiveIntensity);
  }

  private addMesh(root: Group, geometry: BufferGeometry, x: number, y: number, z: number, scaleX: number, scaleY: number, scaleZ: number, color: string, emissive = color, emissiveIntensity = 0.1): Mesh {
    const mesh = new Mesh(geometry, this.material(color, 1, emissive, emissiveIntensity));
    mesh.position.set(x, y, z);
    mesh.scale.set(scaleX, scaleY, scaleZ);
    root.add(mesh);
    return mesh;
  }

  private material(color: string, opacity = 1, emissive = "#000000", emissiveIntensity = 0): MeshStandardMaterial {
    const alpha = quantizeAlpha(opacity);
    const key = `${color}|${alpha}|${emissive}|${Math.round(emissiveIntensity * 100)}`;
    const cached = this.materialCache.get(key);
    if (cached) {
      return cached;
    }

    const material = new MeshStandardMaterial({
      color: new Color(color),
      emissive: new Color(emissive),
      emissiveIntensity,
      metalness: 0.18,
      roughness: 0.46,
      transparent: alpha < 1,
      opacity: alpha,
    });
    this.materialCache.set(key, material);
    return material;
  }

  private basicMaterial(color: string, opacity = 1, side = DoubleSide): MeshBasicMaterial {
    const alpha = quantizeAlpha(opacity);
    const key = `${color}|${alpha}|${side}`;
    const cached = this.basicMaterialCache.get(key);
    if (cached) {
      return cached;
    }

    const material = new MeshBasicMaterial({
      color: new Color(color),
      transparent: alpha < 1,
      opacity: alpha,
      side,
      depthWrite: alpha >= 1,
    });
    this.basicMaterialCache.set(key, material);
    return material;
  }

  private toWorldX(x: number): number {
    return x - BOARD_CENTER_X;
  }

  private toWorldZ(y: number): number {
    return y - BOARD_CENTER_Z;
  }
}
