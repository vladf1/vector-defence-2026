import { FIELD_HEIGHT, FIELD_WIDTH, MAX_TOWER_LEVEL } from "./constants";
import { LinearActiveCircleSweepCollisionIndex } from "./game-engine/collision-detection";
import { UpdateResult } from "./game-engine/update-context";
import { DroneProjectile } from "./entities/projectiles/drone-projectile";
import { GunProjectile } from "./entities/projectiles/gun-projectile";
import { Missile } from "./entities/projectiles/missile";
import { createMissileVisual } from "./entities/projectiles/missile-visuals";
import { SquareMonster } from "./entities/monsters/square-monster";
import { DroneTower } from "./entities/towers/drone-tower";
import { GunTower } from "./entities/towers/gun-tower";
import { LaserTower } from "./entities/towers/laser-tower";
import { LightningTower } from "./entities/towers/lightning-tower";
import { MissileTower } from "./entities/towers/missile-tower";
import { SlowTower } from "./entities/towers/slow-tower";
import type { Tower } from "./entities/towers/tower";

interface RenderRow {
  label: string;
  draw(context: CanvasRenderingContext2D, centerX: number, centerY: number, level: number): void;
}

const CELL_SIZE = 150;
const ROW_HEADER_WIDTH = 190;
const TOP_HEADER_HEIGHT = 100;
const GAME_ART_SCALE = 3.35;
const GRID_SIZE = 40;

const canvasTarget = document.querySelector<HTMLCanvasElement>("#tower-testing");
if (!canvasTarget) {
  throw new Error("Tower testing canvas is missing.");
}
const contextTarget = canvasTarget.getContext("2d");
if (!contextTarget) {
  throw new Error("Tower testing canvas could not be initialized.");
}
const canvas = canvasTarget;
const context = contextTarget;

const towerRows: RenderRow[] = [
  createTowerRow("Gun", () => {
    const tower = new GunTower(0, 0);
    tower.angle = -Math.PI / 4;
    tower.muzzleFlashSeconds = 0.04;
    return tower;
  }),
  createTowerRow("Laser", () => {
    const tower = new LaserTower(0, 0);
    tower.angle = -Math.PI / 4;
    tower.beamAlpha = 0.72;
    tower.beamTarget = { x: 34, y: -34 };
    return tower;
  }),
  createTowerRow("Missile", () => {
    const tower = new MissileTower(0, 0);
    tower.angle = -Math.PI / 4;
    return tower;
  }),
  createTowerRow("Slow", () => {
    const tower = new SlowTower(0, 0);
    tower.pulse = Math.PI / 2;
    return tower;
  }),
  createTowerRow("Drone", () => {
    return new DroneTower(0, 0);
  }),
  createTowerRow("Lightning", () => new LightningTower(0, 0)),
];

const projectileRows: RenderRow[] = [
  { label: "Projectile", draw: drawProjectileSample },
  { label: "Drone Projectile", draw: drawDroneProjectileSample },
  { label: "Missile", draw: drawMissileSample },
  { label: "Missile Explosion", draw: drawMissileExplosionSample },
];
const renderRows = [...towerRows, ...projectileRows];
const logicalWidth = ROW_HEADER_WIDTH + ((MAX_TOWER_LEVEL + 1) * CELL_SIZE) + 30;
const logicalHeight = TOP_HEADER_HEIGHT + (renderRows.length * CELL_SIZE) + 24;
const backingScale = Math.min(window.devicePixelRatio || 1, 2);

canvas.width = Math.round(logicalWidth * backingScale);
canvas.height = Math.round(logicalHeight * backingScale);
context.scale(backingScale, backingScale);
context.fillStyle = "#020807";
context.fillRect(0, 0, logicalWidth, logicalHeight);
drawGrid();
drawLabels();

for (const [rowIndex, row] of renderRows.entries()) {
  for (let level = 0; level <= MAX_TOWER_LEVEL; level += 1) {
    const centerX = ROW_HEADER_WIDTH + (level * CELL_SIZE) + (CELL_SIZE / 2);
    const centerY = TOP_HEADER_HEIGHT + (rowIndex * CELL_SIZE) + (CELL_SIZE / 2);
    row.draw(context, centerX, centerY, level);
  }
}

const windowWithTowerRender = window as Window & { __towerRenderDataUrl?: string };
windowWithTowerRender.__towerRenderDataUrl = canvas.toDataURL("image/png");

function createTowerRow(label: string, createTower: () => Tower): RenderRow {
  return {
    label,
    draw(drawContext, centerX, centerY, level) {
      const tower = createTower();
      for (let upgrade = 0; upgrade < level; upgrade += 1) {
        tower.upgrade();
      }
      drawContext.save();
      drawContext.translate(centerX, centerY);
      drawContext.scale(GAME_ART_SCALE, GAME_ART_SCALE);
      tower.draw(drawContext, false);
      drawContext.restore();
    },
  };
}

function drawGrid(): void {
  context.save();
  context.strokeStyle = "rgba(255, 255, 255, 0.055)";
  context.lineWidth = 1;
  for (let x = 0; x <= logicalWidth; x += GRID_SIZE) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, logicalHeight);
    context.stroke();
  }
  for (let y = 0; y <= logicalHeight; y += GRID_SIZE) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(logicalWidth, y);
    context.stroke();
  }
  context.strokeStyle = "rgba(255, 255, 255, 0.08)";
  for (let level = 0; level <= MAX_TOWER_LEVEL + 1; level += 1) {
    const x = ROW_HEADER_WIDTH + (level * CELL_SIZE);
    context.beginPath();
    context.moveTo(x, TOP_HEADER_HEIGHT);
    context.lineTo(x, logicalHeight);
    context.stroke();
  }
  context.restore();
}

function drawLabels(): void {
  context.save();
  context.fillStyle = "rgba(239, 255, 247, 0.9)";
  context.font = "900 18px Avenir Next, Arial Black, Trebuchet MS, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (let level = 0; level <= MAX_TOWER_LEVEL; level += 1) {
    context.fillText(
      String(level + 1),
      ROW_HEADER_WIDTH + (level * CELL_SIZE) + (CELL_SIZE / 2),
      58,
    );
  }
  context.textAlign = "right";
  context.font = "900 17px Avenir Next, Arial Black, Trebuchet MS, system-ui, sans-serif";
  for (const [rowIndex, row] of renderRows.entries()) {
    context.fillText(
      row.label,
      ROW_HEADER_WIDTH - 16,
      TOP_HEADER_HEIGHT + (rowIndex * CELL_SIZE) + (CELL_SIZE / 2),
    );
  }
  context.restore();
}

function drawProjectileSample(
  drawContext: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  level: number,
): void {
  const projectile = new GunProjectile(
    { x: 0, y: 0 },
    { x: 36, y: -36 * Math.tan(Math.PI / 8) },
    level,
  );
  drawScaled(drawContext, centerX, centerY, () => projectile.draw(drawContext));
}

function drawDroneProjectileSample(
  drawContext: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  level: number,
): void {
  const projectile = new DroneProjectile(
    { x: 0, y: 0 },
    { x: 36, y: -36 * Math.tan(Math.PI / 8) },
    level,
  );
  drawScaled(drawContext, centerX, centerY, () => projectile.draw(drawContext));
}

function drawMissileSample(
  drawContext: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  level: number,
): void {
  const target = createPreviewTarget(120, 0);
  const missile = new Missile(
    { x: 0, y: 0 },
    target,
    level,
    createMissileVisual(level),
    -Math.PI / 8,
  );
  drawScaled(drawContext, centerX, centerY, () => missile.draw(drawContext));
}

function drawMissileExplosionSample(
  drawContext: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  level: number,
): void {
  const explosionX = 100;
  const explosionY = 100;
  const target = createPreviewTarget(explosionX, explosionY);
  const missile = new Missile(
    { x: explosionX, y: explosionY },
    target,
    level,
    createMissileVisual(level),
    0,
  );
  missile.speedPerSecond = 0;
  const updateResult = new UpdateResult();
  missile.update({
    deltaSeconds: 0,
    fieldWidth: FIELD_WIDTH,
    fieldHeight: FIELD_HEIGHT,
    activeMonsters: [target],
    monsterCollisionIndex: new LinearActiveCircleSweepCollisionIndex([target]),
    activeDrones: [],
    droneAssignments: new Map(),
  }, updateResult);
  for (const particle of updateResult.particles) {
    particle.update({
      deltaSeconds: 0.075,
      fieldWidth: FIELD_WIDTH,
      fieldHeight: FIELD_HEIGHT,
      activeMonsters: [],
      monsterCollisionIndex: new LinearActiveCircleSweepCollisionIndex([]),
      activeDrones: [],
      droneAssignments: new Map(),
    });
  }

  drawContext.save();
  drawContext.translate(centerX, centerY);
  drawContext.scale(GAME_ART_SCALE, GAME_ART_SCALE);
  drawContext.translate(-explosionX, -explosionY);
  for (const particle of updateResult.particles) {
    particle.draw(drawContext);
  }
  drawContext.restore();
}

function drawScaled(
  drawContext: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  draw: () => void,
): void {
  drawContext.save();
  drawContext.translate(centerX, centerY);
  drawContext.scale(GAME_ART_SCALE, GAME_ART_SCALE);
  draw();
  drawContext.restore();
}

function createPreviewTarget(x: number, y: number): SquareMonster {
  const target = new SquareMonster([
    { x, y, totalDistance: 0 },
    { x: x + 1, y, totalDistance: 1 },
  ], 1);
  target.x = x;
  target.y = y;
  target.previousX = x;
  target.previousY = y;
  return target;
}
