import { LaserTower } from "./entities/towers/laser-tower";
import { getTowerClass } from "./entities/towers/tower-registry";
import type { Game } from "./game-engine";

const ROAD_COLOR = "rgba(8, 40, 36, 0.96)";
const ROAD_BORDER_COLOR = "rgb(18, 61, 54)";
const ROAD_BORDER_WIDTH = 1.5;
const EXIT_MARKER_RADIUS = 18;
const UPGRADE_BUTTON_WIDTH = 32;
const UPGRADE_BUTTON_HEIGHT = 26;
const COMPACT_UPGRADE_BUTTON_WIDTH = 84;
const COMPACT_UPGRADE_BUTTON_HEIGHT = 54;
const COMPACT_GROUPED_ACTION_BUTTON_WIDTH = 54;
const TOWER_ACTION_BUTTON_GAP = 6;
const UPGRADE_BUTTON_EDGE_GUTTER = 42;
const COMPACT_UPGRADE_BUTTON_EDGE_GUTTER = 58;
const UPGRADE_BUTTON_BELOW_OFFSET = 22;
const UPGRADE_BUTTON_ABOVE_OFFSET = 22;
const UPGRADE_BUTTON_ABOVE_THRESHOLD = 56;
const COMPACT_CANVAS_WIDTH_THRESHOLD = 520;
const GRID_FADE_EDGE_ALPHA = 0.035;
const GRID_FADE_CENTER_ALPHA = 0.07;
const GRID_FADE_CENTER_START = 0.18;
const GRID_FADE_CENTER_END = 0.82;

export interface CanvasButtonRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FieldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface CenteredFieldViewport {
  width: number;
  height: number;
  fieldOffsetX: number;
  fieldOffsetY: number;
}

export function getCenteredFieldViewport(
  cssWidth: number,
  cssHeight: number,
  fieldWidth: number,
  fieldHeight: number,
): CenteredFieldViewport {
  if (cssWidth <= 0 || cssHeight <= 0) {
    return { width: fieldWidth, height: fieldHeight, fieldOffsetX: 0, fieldOffsetY: 0 };
  }

  const visibleAspect = cssWidth / cssHeight;
  const fieldAspect = fieldWidth / fieldHeight;
  if (visibleAspect > fieldAspect) {
    const width = fieldHeight * visibleAspect;
    return {
      width,
      height: fieldHeight,
      fieldOffsetX: (width - fieldWidth) / 2,
      fieldOffsetY: 0,
    };
  }

  const height = fieldWidth / visibleAspect;
  return {
    width: fieldWidth,
    height,
    fieldOffsetX: 0,
    fieldOffsetY: (height - fieldHeight) / 2,
  };
}

export class GameRenderer {
  backgroundCanvas: HTMLCanvasElement;
  backgroundCtx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  currentDpr = window.devicePixelRatio || 1;
  isCompactLayout = false;
  private viewportWidth = 0;
  private viewportHeight = 0;
  private fieldOffsetX = 0;
  private fieldOffsetY = 0;

  constructor(
    backgroundCanvas: HTMLCanvasElement,
    backgroundCtx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    private readonly game: Game,
  ) {
    this.backgroundCanvas = backgroundCanvas;
    this.backgroundCtx = backgroundCtx;
    this.canvas = canvas;
    this.ctx = ctx;
  }

  private get fieldWidth(): number {
    return this.game.profile.fieldWidth;
  }

  private get fieldHeight(): number {
    return this.game.profile.fieldHeight;
  }

  resize(): void {
    this.currentDpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const viewport = getCenteredFieldViewport(rect.width, rect.height, this.fieldWidth, this.fieldHeight);
    this.viewportWidth = viewport.width;
    this.viewportHeight = viewport.height;
    this.fieldOffsetX = viewport.fieldOffsetX;
    this.fieldOffsetY = this.getCenteredLevelOffsetY(viewport.height, viewport.fieldOffsetY);
    this.isCompactLayout = rect.width <= COMPACT_CANVAS_WIDTH_THRESHOLD;
    this.backgroundCanvas.width = Math.round(this.viewportWidth * this.currentDpr);
    this.backgroundCanvas.height = Math.round(this.viewportHeight * this.currentDpr);
    this.backgroundCtx.setTransform(this.currentDpr, 0, 0, this.currentDpr, 0, 0);
    this.canvas.width = Math.round(this.viewportWidth * this.currentDpr);
    this.canvas.height = Math.round(this.viewportHeight * this.currentDpr);
    this.ctx.setTransform(this.currentDpr, 0, 0, this.currentDpr, 0, 0);
    this.renderBackgroundLayer();
  }

  renderBackgroundLayer(): void {
    this.fieldOffsetY = this.getCenteredLevelOffsetY(this.viewportHeight, this.fieldOffsetY);
    this.backgroundCtx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);
    this.drawCanvasBackdrop(this.backgroundCtx);
    this.backgroundCtx.save();
    this.backgroundCtx.translate(this.fieldOffsetX, this.fieldOffsetY);
    this.drawBackground(this.backgroundCtx);
    this.backgroundCtx.restore();
  }

  draw(): void {
    const runtime = this.game.runtime;

    this.fieldOffsetY = this.getCenteredLevelOffsetY(this.viewportHeight, this.fieldOffsetY);
    this.ctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);
    this.ctx.save();
    this.ctx.translate(this.fieldOffsetX, this.fieldOffsetY);
    this.drawEscapeAllowance(this.ctx);

    for (const link of runtime.links) {
      link.draw(this.ctx);
    }

    for (const projectile of runtime.projectiles) {
      projectile.draw(this.ctx);
    }

    for (const missile of runtime.missiles) {
      missile.draw(this.ctx);
    }

    for (const monster of runtime.getActiveMonsters()) {
      monster.draw(this.ctx);
    }

    for (const tower of runtime.towers) {
      tower.draw(this.ctx, tower === runtime.selectedTower);
    }

    for (const particle of runtime.particles) {
      particle.draw(this.ctx);
    }

    this.drawPreview(this.ctx);
    this.drawUpgradeButton(this.ctx);
    this.drawLaserLockButton(this.ctx);
    this.ctx.restore();
  }

  getUpgradeButtonRect(): CanvasButtonRect | undefined {
    if (!this.game.profile.ui.drawCanvasTowerActions) {
      return undefined;
    }

    return this.getSelectedTowerActionButtonRect(0);
  }

  getLaserLockButtonRect(): CanvasButtonRect | undefined {
    if (!this.game.profile.ui.drawCanvasTowerActions) {
      return undefined;
    }

    const selectedTower = this.game.runtime.selectedTower;
    if (!(selectedTower instanceof LaserTower)) {
      return undefined;
    }

    return this.getSelectedTowerActionButtonRect(1);
  }

  private getSelectedTowerActionButtonRect(index: number): CanvasButtonRect | undefined {
    const selectedTower = this.game.runtime.selectedTower;
    if (!selectedTower) {
      return undefined;
    }

    const actionCount = selectedTower instanceof LaserTower ? 2 : 1;
    if (index >= actionCount) {
      return undefined;
    }

    const width = this.getUpgradeButtonWidth(actionCount);
    const height = this.getUpgradeButtonHeight();
    const groupWidth = (width * actionCount) + (TOWER_ACTION_BUTTON_GAP * (actionCount - 1));
    const edgeGutter = this.isCompactLayout ? COMPACT_UPGRADE_BUTTON_EDGE_GUTTER : UPGRADE_BUTTON_EDGE_GUTTER;
    const centerX = Math.min(
      Math.max(selectedTower.x, edgeGutter),
      this.fieldWidth - edgeGutter,
    );
    const placeAbove = selectedTower.y > this.fieldHeight - UPGRADE_BUTTON_ABOVE_THRESHOLD - (height - UPGRADE_BUTTON_HEIGHT);
    const top = placeAbove
      ? selectedTower.y - UPGRADE_BUTTON_ABOVE_OFFSET - height
      : selectedTower.y + UPGRADE_BUTTON_BELOW_OFFSET;

    return {
      x: centerX - (groupWidth / 2) + (index * (width + TOWER_ACTION_BUTTON_GAP)),
      y: top,
      width,
      height,
    };
  }

  isPointInUpgradeButton(point: { x: number; y: number }): boolean {
    const rect = this.getUpgradeButtonRect();
    return rect !== undefined
      && point.x >= rect.x
      && point.x <= rect.x + rect.width
      && point.y >= rect.y
      && point.y <= rect.y + rect.height;
  }

  isPointInLaserLockButton(point: { x: number; y: number }): boolean {
    const rect = this.getLaserLockButtonRect();
    return rect !== undefined
      && point.x >= rect.x
      && point.x <= rect.x + rect.width
      && point.y >= rect.y
      && point.y <= rect.y + rect.height;
  }

  private drawBackground(context: CanvasRenderingContext2D): void {
    const fieldGradient = context.createLinearGradient(0, 0, 0, this.fieldHeight);
    fieldGradient.addColorStop(0, "#010302");
    fieldGradient.addColorStop(0.5, "#050d0a");
    fieldGradient.addColorStop(1, "#010302");
    context.fillStyle = fieldGradient;
    context.fillRect(0, 0, this.fieldWidth, this.fieldHeight);

    context.save();
    const gridGradient = context.createLinearGradient(0, 0, 0, this.fieldHeight);
    gridGradient.addColorStop(0, `rgba(255, 255, 255, ${GRID_FADE_EDGE_ALPHA})`);
    gridGradient.addColorStop(GRID_FADE_CENTER_START, `rgba(255, 255, 255, ${GRID_FADE_CENTER_ALPHA})`);
    gridGradient.addColorStop(GRID_FADE_CENTER_END, `rgba(255, 255, 255, ${GRID_FADE_CENTER_ALPHA})`);
    gridGradient.addColorStop(1, `rgba(255, 255, 255, ${GRID_FADE_EDGE_ALPHA})`);
    context.strokeStyle = gridGradient;
    for (let x = 0; x <= this.fieldWidth; x += 35) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, this.fieldHeight);
      context.stroke();
    }
    for (let y = 0; y <= this.fieldHeight; y += 35) {
      const alpha = this.getGridFadeAlpha(y, this.fieldHeight);
      context.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(this.fieldWidth, y);
      context.stroke();
    }
    context.restore();

    if (!this.game.currentLevel) {
      return;
    }

    const routePath = this.game.runtime.routePath;
    if (!routePath) {
      return;
    }

    const last = this.game.currentLevel.points[this.game.currentLevel.points.length - 1];
    context.save();
    context.lineJoin = "round";
    context.lineCap = "round";

    context.strokeStyle = ROAD_BORDER_COLOR;
    context.lineWidth = this.game.profile.roadWidth + (ROAD_BORDER_WIDTH * 2);
    this.traceRoutePath(context);
    context.stroke();

    context.fillStyle = ROAD_BORDER_COLOR;
    context.beginPath();
    context.arc(last.x, last.y, EXIT_MARKER_RADIUS + ROAD_BORDER_WIDTH, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = ROAD_COLOR;
    context.lineWidth = this.game.profile.roadWidth;
    this.traceRoutePath(context);
    context.stroke();

    context.fillStyle = ROAD_COLOR;
    context.beginPath();
    context.arc(last.x, last.y, EXIT_MARKER_RADIUS, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  private traceRoutePath(context: CanvasRenderingContext2D): void {
    const routePath = this.game.runtime.routePath;
    if (!routePath) {
      return;
    }

    context.beginPath();
    context.moveTo(routePath.start.x, routePath.start.y);
    for (const command of routePath.commands) {
      if (command.kind === "line") {
        context.lineTo(command.point.x, command.point.y);
      } else {
        context.quadraticCurveTo(command.control.x, command.control.y, command.point.x, command.point.y);
      }
    }
  }

  private drawCanvasBackdrop(context: CanvasRenderingContext2D): void {
    const fieldGradient = context.createLinearGradient(0, 0, 0, this.viewportHeight);
    fieldGradient.addColorStop(0, "#010302");
    fieldGradient.addColorStop(0.5, "#050d0a");
    fieldGradient.addColorStop(1, "#010302");
    context.fillStyle = fieldGradient;
    context.fillRect(0, 0, this.viewportWidth, this.viewportHeight);

    context.save();
    const gridGradient = context.createLinearGradient(0, 0, 0, this.viewportHeight);
    gridGradient.addColorStop(0, `rgba(255, 255, 255, ${GRID_FADE_EDGE_ALPHA})`);
    gridGradient.addColorStop(GRID_FADE_CENTER_START, "rgba(255, 255, 255, 0.055)");
    gridGradient.addColorStop(GRID_FADE_CENTER_END, "rgba(255, 255, 255, 0.055)");
    gridGradient.addColorStop(1, `rgba(255, 255, 255, ${GRID_FADE_EDGE_ALPHA})`);
    context.strokeStyle = gridGradient;
    for (let x = 0; x <= this.viewportWidth; x += 35) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, this.viewportHeight);
      context.stroke();
    }
    for (let y = 0; y <= this.viewportHeight; y += 35) {
      const alpha = this.getGridFadeAlpha(y, this.viewportHeight, 0.055);
      context.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(this.viewportWidth, y);
      context.stroke();
    }
    context.restore();
  }

  private getGridFadeAlpha(y: number, height: number, centerAlpha = GRID_FADE_CENTER_ALPHA): number {
    const distanceFromCenter = Math.abs((y / height) - 0.5) * 2;
    const fadeProgress = Math.max(0, 1 - Math.max(0, distanceFromCenter - (GRID_FADE_CENTER_END - GRID_FADE_CENTER_START)) / (1 - (GRID_FADE_CENTER_END - GRID_FADE_CENTER_START)));
    return GRID_FADE_EDGE_ALPHA + ((centerAlpha - GRID_FADE_EDGE_ALPHA) * fadeProgress);
  }

  toFieldPoint(point: { x: number; y: number }): { x: number; y: number } {
    return {
      x: point.x - this.fieldOffsetX,
      y: point.y - this.fieldOffsetY,
    };
  }

  getVisibleFieldBounds(): FieldBounds {
    return {
      minX: -this.fieldOffsetX,
      minY: -this.fieldOffsetY,
      maxX: this.viewportWidth - this.fieldOffsetX,
      maxY: this.viewportHeight - this.fieldOffsetY,
    };
  }

  private getCenteredLevelOffsetY(viewportHeight: number, fallbackOffsetY: number): number {
    const level = this.game.currentLevel;
    if (!level || level.points.length === 0 || viewportHeight <= this.fieldHeight) {
      return fallbackOffsetY;
    }

    const halfRoadWidth = this.game.profile.roadWidth / 2;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const point of level.points) {
      minY = Math.min(minY, point.y - halfRoadWidth);
      maxY = Math.max(maxY, point.y + halfRoadWidth);
    }

    const levelCenterY = (minY + maxY) / 2;
    const centeredOffsetY = (viewportHeight / 2) - levelCenterY;
    return Math.max(0, Math.min(viewportHeight - this.fieldHeight, centeredOffsetY));
  }

  private drawEscapeAllowance(context: CanvasRenderingContext2D): void {
    const level = this.game.currentLevel;
    if (!level) {
      return;
    }

    const last = level.points[level.points.length - 1];
    const allowance = Math.max(0, this.game.runtime.escapesLeft);

    context.save();
    context.fillStyle = "rgba(238, 255, 248, 0.86)";
    context.font = "700 19px Inter, system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(allowance), last.x, last.y + 1);
    context.restore();
  }

  private getUpgradeButtonWidth(actionCount = 1): number {
    if (!this.isCompactLayout) {
      return UPGRADE_BUTTON_WIDTH;
    }

    return actionCount > 1 ? COMPACT_GROUPED_ACTION_BUTTON_WIDTH : COMPACT_UPGRADE_BUTTON_WIDTH;
  }

  private getUpgradeButtonHeight(): number {
    return this.isCompactLayout ? COMPACT_UPGRADE_BUTTON_HEIGHT : UPGRADE_BUTTON_HEIGHT;
  }

  private drawUpgradeButton(context: CanvasRenderingContext2D): void {
    const rect = this.getUpgradeButtonRect();
    if (!this.game.profile.ui.drawCanvasTowerActions || !rect) {
      return;
    }

    const disabled = !this.game.canUpgradeSelectedTower();
    const hovered = this.game.runtime.pointer ? this.isPointInUpgradeButton(this.game.runtime.pointer) : false;

    context.save();
    context.globalAlpha = disabled ? 0.4 : 1;
    context.fillStyle = hovered && !disabled ? "rgba(33, 57, 50, 0.52)" : "rgba(18, 35, 30, 0.82)";
    context.strokeStyle = hovered && !disabled ? "rgba(255, 255, 255, 0.34)" : "rgba(255, 255, 255, 0.2)";
    context.lineWidth = 1;
    context.shadowColor = disabled ? "transparent" : "rgba(0, 0, 0, 0.22)";
    context.shadowBlur = hovered && !disabled ? 9 : 6;
    context.beginPath();
    context.roundRect(rect.x, rect.y, rect.width, rect.height, 7);
    context.fill();
    context.stroke();
    context.shadowBlur = 0;
    context.fillStyle = "#effff7";
    this.drawUpgradeArrow(context, rect.x + (rect.width / 2), rect.y + (rect.height / 2), this.isCompactLayout ? 1.45 : 1);
    context.restore();
  }

  private drawLaserLockButton(context: CanvasRenderingContext2D): void {
    const rect = this.getLaserLockButtonRect();
    const selectedTower = this.game.runtime.selectedTower;
    if (!this.game.profile.ui.drawCanvasTowerActions || !rect || !(selectedTower instanceof LaserTower)) {
      return;
    }

    const disabled = !this.game.canPerformBattleAction();
    const hovered = this.game.runtime.pointer ? this.isPointInLaserLockButton(this.game.runtime.pointer) : false;

    context.save();
    context.globalAlpha = disabled ? 0.4 : 1;
    context.fillStyle = hovered && !disabled ? "rgba(33, 57, 50, 0.52)" : "rgba(18, 35, 30, 0.82)";
    context.strokeStyle = hovered && !disabled ? "rgba(255, 255, 255, 0.34)" : "rgba(255, 255, 255, 0.2)";
    context.lineWidth = 1;
    context.shadowColor = disabled ? "transparent" : "rgba(0, 0, 0, 0.22)";
    context.shadowBlur = hovered && !disabled ? 9 : 6;
    context.beginPath();
    context.roundRect(rect.x, rect.y, rect.width, rect.height, 7);
    context.fill();
    context.stroke();
    context.shadowBlur = 0;
    context.fillStyle = "#effff7";
    context.font = `${this.isCompactLayout ? 22 : 15}px "Apple Color Emoji", "Segoe UI Emoji", system-ui, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    const icon = selectedTower.directionLocked ? "🔓" : "🔒";
    const yOffset = selectedTower.directionLocked ? -1 : 0;
    context.fillText(icon, rect.x + (rect.width / 2), rect.y + (rect.height / 2) + yOffset);
    context.restore();
  }

  private drawUpgradeArrow(context: CanvasRenderingContext2D, centerX: number, centerY: number, scale = 1): void {
    const halfWidth = 7 * scale;
    const halfHeight = 6 * scale;
    context.beginPath();
    context.moveTo(centerX, centerY - halfHeight);
    context.lineTo(centerX + halfWidth, centerY + halfHeight);
    context.lineTo(centerX - halfWidth, centerY + halfHeight);
    context.closePath();
    context.fill();
  }

  private drawPreview(context: CanvasRenderingContext2D): void {
    const runtime = this.game.runtime;
    if (!runtime.pointer || !runtime.placingTower) {
      return;
    }

    const towerClass = getTowerClass(runtime.placingTower);
    const bounds = this.getVisibleFieldBounds();
    const valid = this.game.canPlaceTowerInBounds(runtime.pointer, bounds) && runtime.money >= towerClass.baseCost;
    context.save();
    context.strokeStyle = valid ? "rgba(255, 255, 255, 0.35)" : "rgba(255, 120, 120, 0.45)";
    context.setLineDash([6, 6]);
    context.beginPath();
    context.moveTo(runtime.pointer.x, bounds.minY);
    context.lineTo(runtime.pointer.x, bounds.maxY);
    context.moveTo(bounds.minX, runtime.pointer.y);
    context.lineTo(bounds.maxX, runtime.pointer.y);
    context.stroke();
    context.setLineDash([]);
    context.strokeStyle = valid ? "rgba(92, 255, 158, 0.3)" : "rgba(255, 120, 120, 0.32)";
    context.fillStyle = valid ? "rgba(92, 255, 158, 0.08)" : "rgba(255, 120, 120, 0.08)";
    context.beginPath();
    context.arc(runtime.pointer.x, runtime.pointer.y, towerClass.baseRange * this.game.profile.towerRangeScale, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.beginPath();
    context.arc(runtime.pointer.x, runtime.pointer.y, this.game.profile.towerRadius, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }
}
