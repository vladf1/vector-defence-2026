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
  draw(
    context: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    level: number,
    artScale: number,
  ): void;
}

const PREVIEW_CELL_SIZE = 112;
const PREVIEW_ART_SCALE = 2.5;
const PREVIEW_ART_SCALE_PER_PIXEL = PREVIEW_ART_SCALE / PREVIEW_CELL_SIZE;

const tableTarget = queryRequiredElement<HTMLTableElement>("#tower-testing", "Tower testing table is missing.");
const previewDialogTarget = queryRequiredElement<HTMLDialogElement>("#tower-preview-dialog", "Tower zoom dialog is missing.");
const previewCanvasTarget = queryRequiredElement<HTMLCanvasElement>("#tower-preview-canvas", "Tower zoom canvas is missing.");
const previewLabelTarget = queryRequiredElement<HTMLElement>("#tower-preview-label", "Tower zoom label is missing.");
const previewCloseTarget = queryRequiredElement<HTMLButtonElement>("#tower-preview-close", "Tower zoom close button is missing.");

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
let zoomedPreview: { row: RenderRow; level: number } | undefined;

drawPreviewTable(tableTarget);
previewCloseTarget.addEventListener("click", () => previewDialogTarget.close());
previewDialogTarget.addEventListener("click", (event) => {
  if (event.target === previewDialogTarget) {
    previewDialogTarget.close();
  }
});
previewDialogTarget.addEventListener("close", () => {
  zoomedPreview = undefined;
});
window.addEventListener("resize", () => {
  if (previewDialogTarget.open && zoomedPreview) {
    drawZoomedPreview(zoomedPreview.row, zoomedPreview.level);
  }
});

function queryRequiredElement<T extends Element>(selector: string, errorMessage: string): T {
  const target = document.querySelector<T>(selector);
  if (!target) {
    throw new Error(errorMessage);
  }
  return target;
}

function createTowerRow(label: string, createTower: () => Tower): RenderRow {
  return {
    label,
    draw(drawContext, centerX, centerY, level, artScale) {
      const tower = createTower();
      for (let upgrade = 0; upgrade < level; upgrade += 1) {
        tower.upgrade();
      }
      drawContext.save();
      drawContext.translate(centerX, centerY);
      drawContext.scale(artScale, artScale);
      tower.draw(drawContext, false);
      drawContext.restore();
    },
  };
}

function drawPreviewTable(table: HTMLTableElement): void {
  table.replaceChildren();
  const header = table.createTHead();
  const headerRow = header.insertRow();
  const rowHeading = document.createElement("th");
  rowHeading.scope = "col";
  rowHeading.textContent = "Render";
  headerRow.append(rowHeading);
  for (let level = 0; level <= MAX_TOWER_LEVEL; level += 1) {
    const levelHeading = document.createElement("th");
    levelHeading.scope = "col";
    levelHeading.textContent = `Level ${level + 1}`;
    headerRow.append(levelHeading);
  }

  const body = table.createTBody();
  for (const row of renderRows) {
    const tableRow = body.insertRow();
    const rowLabel = document.createElement("th");
    rowLabel.scope = "row";
    rowLabel.textContent = row.label;
    tableRow.append(rowLabel);
    for (let level = 0; level <= MAX_TOWER_LEVEL; level += 1) {
      const cell = tableRow.insertCell();
      cell.append(createPreviewButton(row, level));
    }
  }
}

function createPreviewButton(row: RenderRow, level: number): HTMLButtonElement {
  const previewButton = document.createElement("button");
  previewButton.type = "button";
  previewButton.className = "preview-button";
  previewButton.setAttribute("aria-label", `Zoom ${row.label}, level ${level + 1}`);
  previewButton.append(createPreviewCanvas(row, level));
  previewButton.addEventListener("click", () => openZoomedPreview(row, level));
  return previewButton;
}

function createPreviewCanvas(row: RenderRow, level: number): HTMLCanvasElement {
  const previewCanvas = document.createElement("canvas");
  previewCanvas.setAttribute("aria-hidden", "true");
  const backingScale = Math.min(window.devicePixelRatio || 1, 2);
  previewCanvas.width = Math.round(PREVIEW_CELL_SIZE * backingScale);
  previewCanvas.height = Math.round(PREVIEW_CELL_SIZE * backingScale);
  const previewContext = previewCanvas.getContext("2d");
  if (!previewContext) {
    throw new Error(`Could not initialize the ${row.label} level ${level + 1} preview.`);
  }
  previewContext.scale(backingScale, backingScale);
  previewContext.fillStyle = "#020807";
  previewContext.fillRect(0, 0, PREVIEW_CELL_SIZE, PREVIEW_CELL_SIZE);
  row.draw(
    previewContext,
    PREVIEW_CELL_SIZE / 2,
    PREVIEW_CELL_SIZE / 2,
    level,
    PREVIEW_ART_SCALE,
  );
  return previewCanvas;
}

function openZoomedPreview(row: RenderRow, level: number): void {
  zoomedPreview = { row, level };
  previewLabelTarget.textContent = `${row.label} · Level ${level + 1}`;
  previewCanvasTarget.setAttribute("aria-label", `${row.label}, level ${level + 1}`);
  previewDialogTarget.showModal();
  drawZoomedPreview(row, level);
}

function drawZoomedPreview(row: RenderRow, level: number): void {
  const zoomSize = Math.min(previewDialogTarget.clientWidth, previewDialogTarget.clientHeight);
  const backingScale = Math.min(window.devicePixelRatio || 1, 2);
  previewCanvasTarget.width = Math.round(zoomSize * backingScale);
  previewCanvasTarget.height = Math.round(zoomSize * backingScale);
  const zoomContext = previewCanvasTarget.getContext("2d");
  if (!zoomContext) {
    throw new Error("Could not initialize the tower zoom preview.");
  }
  zoomContext.scale(backingScale, backingScale);
  zoomContext.fillStyle = "#020807";
  zoomContext.fillRect(0, 0, zoomSize, zoomSize);
  row.draw(
    zoomContext,
    zoomSize / 2,
    zoomSize / 2,
    level,
    zoomSize * PREVIEW_ART_SCALE_PER_PIXEL,
  );
}

function drawProjectileSample(
  drawContext: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  level: number,
  artScale: number,
): void {
  const projectile = new GunProjectile(
    { x: 0, y: 0 },
    { x: 36, y: -36 * Math.tan(Math.PI / 8) },
    level,
  );
  drawScaled(drawContext, centerX, centerY, artScale, () => projectile.draw(drawContext));
}

function drawDroneProjectileSample(
  drawContext: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  level: number,
  artScale: number,
): void {
  const projectile = new DroneProjectile(
    { x: 0, y: 0 },
    { x: 36, y: -36 * Math.tan(Math.PI / 8) },
    level,
  );
  drawScaled(drawContext, centerX, centerY, artScale, () => projectile.draw(drawContext));
}

function drawMissileSample(
  drawContext: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  level: number,
  artScale: number,
): void {
  const target = createPreviewTarget(120, 0);
  const missile = new Missile(
    { x: 0, y: 0 },
    target,
    level,
    createMissileVisual(level),
    -Math.PI / 8,
  );
  drawScaled(drawContext, centerX, centerY, artScale, () => missile.draw(drawContext));
}

function drawMissileExplosionSample(
  drawContext: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  level: number,
  artScale: number,
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
  drawContext.scale(artScale, artScale);
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
  artScale: number,
  draw: () => void,
): void {
  drawContext.save();
  drawContext.translate(centerX, centerY);
  drawContext.scale(artScale, artScale);
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
