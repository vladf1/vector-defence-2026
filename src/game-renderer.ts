import { FIELD_HEIGHT, FIELD_WIDTH, TOWER_RADIUS, TOWER_SPECS } from "./constants";
import type { Game } from "./game-engine";

export class GameRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  backgroundCanvas = document.createElement("canvas");
  backgroundCtx: CanvasRenderingContext2D;
  currentDpr = window.devicePixelRatio || 1;

  constructor(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    private readonly game: Game,
  ) {
    const backgroundCtx = this.backgroundCanvas.getContext("2d");
    if (!backgroundCtx) {
      throw new Error("Background canvas unavailable.");
    }

    this.canvas = canvas;
    this.ctx = ctx;
    this.backgroundCtx = backgroundCtx;
  }

  resize(): void {
    this.currentDpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(FIELD_WIDTH * this.currentDpr);
    this.canvas.height = Math.round(FIELD_HEIGHT * this.currentDpr);
    this.ctx.setTransform(this.currentDpr, 0, 0, this.currentDpr, 0, 0);
    this.rebuildBackgroundCache();
  }

  rebuildBackgroundCache(): void {
    this.backgroundCanvas.width = Math.round(FIELD_WIDTH * this.currentDpr);
    this.backgroundCanvas.height = Math.round(FIELD_HEIGHT * this.currentDpr);
    this.backgroundCtx.setTransform(this.currentDpr, 0, 0, this.currentDpr, 0, 0);
    this.drawBackground(this.backgroundCtx);
  }

  draw(): void {
    this.ctx.drawImage(this.backgroundCanvas, 0, 0, FIELD_WIDTH, FIELD_HEIGHT);

    for (const link of this.game.links) {
      link.draw(this.ctx);
    }

    for (const projectile of this.game.projectiles) {
      projectile.draw(this.ctx);
    }

    for (const missile of this.game.missiles) {
      missile.draw(this.ctx);
    }

    for (const monster of this.game.monsters) {
      if (monster.removed) {
        continue;
      }
      monster.draw(this.ctx);
    }

    for (const tower of this.game.towers) {
      tower.draw(this.ctx, tower === this.game.selectedTower);
    }

    for (const particle of this.game.particles) {
      particle.draw(this.ctx);
    }

    this.drawPreview(this.ctx);
  }

  private drawBackground(context: CanvasRenderingContext2D): void {
    const fieldGradient = context.createLinearGradient(0, 0, 0, FIELD_HEIGHT);
    fieldGradient.addColorStop(0, "#050b08");
    fieldGradient.addColorStop(1, "#0c1c17");
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

    const first = this.game.currentLevel.points[0];
    const last = this.game.currentLevel.points[this.game.currentLevel.points.length - 1];
    context.save();
    context.lineJoin = "round";
    context.lineCap = "round";
    context.strokeStyle = "rgba(8, 40, 36, 0.96)";
    context.lineWidth = 24;
    context.beginPath();
    context.moveTo(first.x, first.y);
    for (let index = 1; index < this.game.currentLevel.points.length; index += 1) {
      const point = this.game.currentLevel.points[index];
      context.lineTo(point.x, point.y);
    }
    context.stroke();
    context.strokeStyle = "rgba(109, 240, 194, 0.18)";
    context.lineWidth = 6;
    context.stroke();
    context.fillStyle = "rgba(109, 240, 194, 0.14)";
    context.beginPath();
    context.arc(last.x, last.y, 18, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  private drawPreview(context: CanvasRenderingContext2D): void {
    if (!this.game.pointer || !this.game.placingTower) {
      return;
    }

    const spec = TOWER_SPECS[this.game.placingTower];
    const valid = this.game.canPlaceTower(this.game.pointer) && this.game.money >= spec.cost;
    context.save();
    context.strokeStyle = valid ? "rgba(255, 255, 255, 0.35)" : "rgba(255, 120, 120, 0.45)";
    context.setLineDash([6, 6]);
    context.beginPath();
    context.moveTo(this.game.pointer.x, 0);
    context.lineTo(this.game.pointer.x, FIELD_HEIGHT);
    context.moveTo(0, this.game.pointer.y);
    context.lineTo(FIELD_WIDTH, this.game.pointer.y);
    context.stroke();
    context.setLineDash([]);
    context.strokeStyle = valid ? "rgba(92, 255, 158, 0.3)" : "rgba(255, 120, 120, 0.32)";
    context.fillStyle = valid ? "rgba(92, 255, 158, 0.08)" : "rgba(255, 120, 120, 0.08)";
    context.beginPath();
    context.arc(this.game.pointer.x, this.game.pointer.y, spec.range, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.beginPath();
    context.arc(this.game.pointer.x, this.game.pointer.y, TOWER_RADIUS, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }
}
