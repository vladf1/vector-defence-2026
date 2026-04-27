import { createBannerText } from "./banner-text";
import { FIELD_HEIGHT, FIELD_WIDTH, ROAD_WIDTH, TOWER_RADIUS } from "./constants";
import { getTowerClass } from "./entities/towers/tower-registry";
import { GameState } from "./types";
import type { Game } from "./game-engine";

const ROAD_COLOR = "rgba(8, 40, 36, 0.96)";
const BANNER_FONT_SIZE = 9;
const BANNER_HEIGHT = 24;
const BANNER_PADDING_X = 8;
const BANNER_RADIUS = 8;
const BANNER_TOP = 10;
const BANNER_LETTER_SPACING = 1.5;
const UPGRADE_BUTTON_WIDTH = 32;
const UPGRADE_BUTTON_HEIGHT = 26;
const COMPACT_UPGRADE_BUTTON_WIDTH = 84;
const COMPACT_UPGRADE_BUTTON_HEIGHT = 54;
const UPGRADE_BUTTON_EDGE_GUTTER = 42;
const COMPACT_UPGRADE_BUTTON_EDGE_GUTTER = 58;
const UPGRADE_BUTTON_BELOW_OFFSET = 22;
const UPGRADE_BUTTON_ABOVE_OFFSET = 22;
const UPGRADE_BUTTON_ABOVE_THRESHOLD = 56;
const PAUSE_BUTTON_WIDTH = 34;
const PAUSE_BUTTON_HEIGHT = 24;
const COMPACT_PAUSE_BUTTON_WIDTH = 64;
const COMPACT_PAUSE_BUTTON_HEIGHT = 42;
const PAUSE_BUTTON_TOP = 10;
const PAUSE_BUTTON_RIGHT = 10;
const COMPACT_CANVAS_WIDTH_THRESHOLD = 520;

export interface CanvasButtonRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class GameRenderer {
  backgroundCanvas: HTMLCanvasElement;
  backgroundCtx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  currentDpr = window.devicePixelRatio || 1;
  isCompactLayout = false;

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

  resize(): void {
    this.currentDpr = window.devicePixelRatio || 1;
    this.isCompactLayout = this.canvas.getBoundingClientRect().width <= COMPACT_CANVAS_WIDTH_THRESHOLD;
    this.backgroundCanvas.width = Math.round(FIELD_WIDTH * this.currentDpr);
    this.backgroundCanvas.height = Math.round(FIELD_HEIGHT * this.currentDpr);
    this.backgroundCtx.setTransform(this.currentDpr, 0, 0, this.currentDpr, 0, 0);
    this.canvas.width = Math.round(FIELD_WIDTH * this.currentDpr);
    this.canvas.height = Math.round(FIELD_HEIGHT * this.currentDpr);
    this.ctx.setTransform(this.currentDpr, 0, 0, this.currentDpr, 0, 0);
    this.renderBackgroundLayer();
  }

  renderBackgroundLayer(): void {
    this.backgroundCtx.clearRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
    this.drawBackground(this.backgroundCtx);
  }

  draw(): void {
    const runtime = this.game.runtime;

    this.ctx.clearRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
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
    this.drawPauseButton(this.ctx);
    this.drawBanner(this.ctx);
  }

  getPauseButtonRect(): CanvasButtonRect | undefined {
    if (!this.canTogglePause()) {
      return undefined;
    }

    const width = this.getPauseButtonWidth();
    const height = this.getPauseButtonHeight();
    return {
      x: FIELD_WIDTH - PAUSE_BUTTON_RIGHT - width,
      y: PAUSE_BUTTON_TOP,
      width,
      height,
    };
  }

  isPointInPauseButton(point: { x: number; y: number }): boolean {
    const rect = this.getPauseButtonRect();
    return rect !== undefined
      && point.x >= rect.x
      && point.x <= rect.x + rect.width
      && point.y >= rect.y
      && point.y <= rect.y + rect.height;
  }

  getUpgradeButtonRect(): CanvasButtonRect | undefined {
    const selectedTower = this.game.runtime.selectedTower;
    if (!selectedTower) {
      return undefined;
    }

    const width = this.getUpgradeButtonWidth();
    const height = this.getUpgradeButtonHeight();
    const edgeGutter = this.isCompactLayout ? COMPACT_UPGRADE_BUTTON_EDGE_GUTTER : UPGRADE_BUTTON_EDGE_GUTTER;
    const centerX = Math.min(
      Math.max(selectedTower.x, edgeGutter),
      FIELD_WIDTH - edgeGutter,
    );
    const placeAbove = selectedTower.y > FIELD_HEIGHT - UPGRADE_BUTTON_ABOVE_THRESHOLD - (height - UPGRADE_BUTTON_HEIGHT);
    const top = placeAbove
      ? selectedTower.y - UPGRADE_BUTTON_ABOVE_OFFSET - height
      : selectedTower.y + UPGRADE_BUTTON_BELOW_OFFSET;

    return {
      x: centerX - (width / 2),
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

  private drawBackground(context: CanvasRenderingContext2D): void {
    const fieldGradient = context.createLinearGradient(0, 0, 0, FIELD_HEIGHT);
    fieldGradient.addColorStop(0, "#010302");
    fieldGradient.addColorStop(1, "#050d0a");
    context.fillStyle = fieldGradient;
    context.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

    context.save();
    context.strokeStyle = "rgba(255, 255, 255, 0.04)";
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
    context.strokeStyle = ROAD_COLOR;
    context.lineWidth = ROAD_WIDTH;
    context.beginPath();
    context.moveTo(routePath.start.x, routePath.start.y);
    for (const command of routePath.commands) {
      if (command.kind === "line") {
        context.lineTo(command.point.x, command.point.y);
      } else {
        context.quadraticCurveTo(command.control.x, command.control.y, command.point.x, command.point.y);
      }
    }
    context.stroke();
    context.fillStyle = ROAD_COLOR;
    context.beginPath();
    context.arc(last.x, last.y, 18, 0, Math.PI * 2);
    context.fill();
    context.restore();
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

  private drawBanner(context: CanvasRenderingContext2D): void {
    const text = createBannerText(this.game).toUpperCase();
    if (!text) {
      return;
    }

    context.save();
    context.font = `${BANNER_FONT_SIZE}px "Avenir Next", "Segoe UI", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    const textWidth = this.measureSpacedText(context, text, BANNER_LETTER_SPACING);
    const width = Math.ceil(textWidth) + (BANNER_PADDING_X * 2);
    const left = (FIELD_WIDTH - width) / 2;
    context.fillStyle = "rgba(8, 16, 13, 0.86)";
    context.strokeStyle = "rgba(255, 255, 255, 0.16)";
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(left, BANNER_TOP, width, BANNER_HEIGHT, BANNER_RADIUS);
    context.fill();
    context.stroke();
    context.fillStyle = "rgba(176, 255, 225, 0.96)";
    this.fillSpacedText(context, text, FIELD_WIDTH / 2, BANNER_TOP + (BANNER_HEIGHT / 2) + 1, BANNER_LETTER_SPACING);
    context.restore();
  }

  private getPauseButtonWidth(): number {
    return this.isCompactLayout ? COMPACT_PAUSE_BUTTON_WIDTH : PAUSE_BUTTON_WIDTH;
  }

  private getPauseButtonHeight(): number {
    return this.isCompactLayout ? COMPACT_PAUSE_BUTTON_HEIGHT : PAUSE_BUTTON_HEIGHT;
  }

  private getUpgradeButtonWidth(): number {
    return this.isCompactLayout ? COMPACT_UPGRADE_BUTTON_WIDTH : UPGRADE_BUTTON_WIDTH;
  }

  private getUpgradeButtonHeight(): number {
    return this.isCompactLayout ? COMPACT_UPGRADE_BUTTON_HEIGHT : UPGRADE_BUTTON_HEIGHT;
  }

  private drawPauseButton(context: CanvasRenderingContext2D): void {
    const rect = this.getPauseButtonRect();
    if (!rect) {
      return;
    }

    const hovered = this.game.runtime.pointer ? this.isPointInPauseButton(this.game.runtime.pointer) : false;
    context.save();
    context.fillStyle = hovered ? "rgba(33, 57, 50, 0.52)" : "rgba(8, 16, 13, 0.86)";
    context.strokeStyle = hovered ? "rgba(255, 255, 255, 0.34)" : "rgba(255, 255, 255, 0.16)";
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(rect.x, rect.y, rect.width, rect.height, 8);
    context.fill();
    context.stroke();
    context.fillStyle = "rgba(176, 255, 225, 0.96)";
    const iconScale = this.isCompactLayout ? 1.45 : 1;
    if (this.game.state === GameState.Paused) {
      this.drawPlayIcon(context, rect.x + (rect.width / 2), rect.y + (rect.height / 2), iconScale);
    } else {
      this.drawPauseIcon(context, rect.x + (rect.width / 2), rect.y + (rect.height / 2), iconScale);
    }
    context.restore();
  }

  private drawPlayIcon(context: CanvasRenderingContext2D, centerX: number, centerY: number, scale = 1): void {
    const halfHeight = 6 * scale;
    context.beginPath();
    context.moveTo(centerX - (4 * scale), centerY - halfHeight);
    context.lineTo(centerX - (4 * scale), centerY + halfHeight);
    context.lineTo(centerX + (7 * scale), centerY);
    context.closePath();
    context.fill();
  }

  private drawPauseIcon(context: CanvasRenderingContext2D, centerX: number, centerY: number, scale = 1): void {
    const barWidth = 3 * scale;
    const barHeight = 13 * scale;
    const gap = 2.5 * scale;
    const top = centerY - (barHeight / 2);
    context.fillRect(centerX - gap - barWidth, top, barWidth, barHeight);
    context.fillRect(centerX + gap, top, barWidth, barHeight);
  }

  private canTogglePause(): boolean {
    return this.game.state === GameState.Playing || this.game.state === GameState.Paused;
  }

  private measureSpacedText(context: CanvasRenderingContext2D, text: string, letterSpacing: number): number {
    return context.measureText(text).width + (Math.max(0, text.length - 1) * letterSpacing);
  }

  private fillSpacedText(
    context: CanvasRenderingContext2D,
    text: string,
    centerX: number,
    centerY: number,
    letterSpacing: number,
  ): void {
    let x = centerX - (this.measureSpacedText(context, text, letterSpacing) / 2);

    context.textAlign = "left";
    for (const character of text) {
      context.fillText(character, x, centerY);
      x += context.measureText(character).width + letterSpacing;
    }
  }

  private drawUpgradeButton(context: CanvasRenderingContext2D): void {
    const rect = this.getUpgradeButtonRect();
    if (!rect) {
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
    const valid = this.game.canPlaceTower(runtime.pointer) && runtime.money >= towerClass.baseCost;
    context.save();
    context.strokeStyle = valid ? "rgba(255, 255, 255, 0.35)" : "rgba(255, 120, 120, 0.45)";
    context.setLineDash([6, 6]);
    context.beginPath();
    context.moveTo(runtime.pointer.x, 0);
    context.lineTo(runtime.pointer.x, FIELD_HEIGHT);
    context.moveTo(0, runtime.pointer.y);
    context.lineTo(FIELD_WIDTH, runtime.pointer.y);
    context.stroke();
    context.setLineDash([]);
    context.strokeStyle = valid ? "rgba(92, 255, 158, 0.3)" : "rgba(255, 120, 120, 0.32)";
    context.fillStyle = valid ? "rgba(92, 255, 158, 0.08)" : "rgba(255, 120, 120, 0.08)";
    context.beginPath();
    context.arc(runtime.pointer.x, runtime.pointer.y, towerClass.baseRange, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.beginPath();
    context.arc(runtime.pointer.x, runtime.pointer.y, TOWER_RADIUS, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }
}
