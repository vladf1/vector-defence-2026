import { TOWER_RADIUS, TOWER_UPGRADE_RING_GROWTH, TOWER_UPGRADE_RING_OFFSET } from "../../constants";
import type { Game } from "../../game-engine";
import { AudioCue, TowerKind } from "../../types";
import { withinDistance } from "../../utils";
import { LightningLinkEffect } from "../effects/lightning-link-effect";
import type { Monster } from "../monsters/monster";
import { Tower } from "./tower";

const LIGHTNING_COLORS = [
  "#8ff7ff",
  "#7fe5ff",
  "#71d0ff",
  "#9fb8ff",
  "#c9a7ff",
  "#f09cff",
  "#f5fbff",
] as const;

const SLOW_FACTOR = 0.06;
const RECOVERY_SPEED_PER_SECOND = 100;

export class LightningTower extends Tower {
  static readonly kind = TowerKind.Lightning;
  static readonly label = "Lightning";
  static readonly summary = "Chains shocks that damage and heavily slow monsters.";
  static readonly baseCost = 5;
  static readonly baseRange = 74;
  static readonly shortcuts = ["5", "e"] as const;

  chargeSeconds = 0;

  constructor(x: number, y: number) {
    super(x, y);
  }

  protected onUpdate(game: Game, deltaSeconds: number): void {
    this.chargeSeconds = Math.max(0, this.chargeSeconds - deltaSeconds);
    if (!this.ready()) {
      return;
    }

    const firstTarget = this.getClosestMonster(game);
    if (!firstTarget) {
      return;
    }

    const targets = this.collectChainTargets(game, firstTarget);
    const damage = this.getDamage();
    const color = this.getColor();
    let source: Tower | Monster = this;

    for (const target of targets) {
      target.takeDamage(damage);
      target.slowDown(SLOW_FACTOR, RECOVERY_SPEED_PER_SECOND);
      game.addLink(new LightningLinkEffect(source, target, color));
      source = target;
    }

    this.chargeSeconds = 0.18;
    this.resetCooldown(this.getCooldownSeconds());
    game.playSound(AudioCue.LightningShock, this.x, 0.95 + (this.level * 0.09));
  }

  private collectChainTargets(game: Game, firstTarget: Monster): Monster[] {
    const targets = [firstTarget];
    let source = firstTarget;
    const maxTargets = Math.min(6, 2 + Math.floor(this.level / 2));
    const chainRange = 58 + (this.level * 5);

    while (targets.length < maxTargets) {
      let nextTarget: Monster | undefined;
      let closestDistanceSquared = Number.POSITIVE_INFINITY;

      for (const monster of game.runtime.getActiveMonsters()) {
        if (targets.includes(monster)) {
          continue;
        }
        if (!withinDistance(source.x, source.y, monster.x, monster.y, chainRange)) {
          continue;
        }

        const dx = monster.x - source.x;
        const dy = monster.y - source.y;
        const distanceSquared = (dx * dx) + (dy * dy);
        if (distanceSquared < closestDistanceSquared) {
          closestDistanceSquared = distanceSquared;
          nextTarget = monster;
        }
      }

      if (!nextTarget) {
        break;
      }

      targets.push(nextTarget);
      source = nextTarget;
    }

    return targets;
  }

  private getDamage(): number {
    return 12 + (this.level * 4.8);
  }

  private getCooldownSeconds(): number {
    return Math.max(0.72, 1.12 - (this.level * 0.055));
  }

  private getColor(): string {
    return LIGHTNING_COLORS[Math.min(this.level, LIGHTNING_COLORS.length - 1)];
  }

  draw(context: CanvasRenderingContext2D, active: boolean): void {
    const color = this.getColor();
    const intensity = this.level / 6;

    context.save();
    context.translate(this.x, this.y);
    context.strokeStyle = "#ffffff";
    context.fillStyle = "#050908";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(0, 0, TOWER_RADIUS, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    if (this.level > 0) {
      context.strokeStyle = `rgba(255, 226, 122, ${0.22 + (this.level * 0.02)})`;
      context.lineWidth = 0.9 + (this.level * 0.08);
      context.beginPath();
      context.arc(0, 0, TOWER_RADIUS + TOWER_UPGRADE_RING_OFFSET + (this.level * TOWER_UPGRADE_RING_GROWTH), 0, Math.PI * 2);
      context.stroke();
    }

    context.save();
    const boltScale = 0.96 + (this.level * 0.026);
    context.save();
    context.translate(0, -2);
    context.rotate(-0.08);

    if (this.level > 0) {
      context.save();
      context.globalCompositeOperation = "lighter";
      context.shadowColor = color;
      context.shadowBlur = 3 + (this.level * 1.25);
      context.globalAlpha = 0.22 + (intensity * 0.26);
      context.fillStyle = color;
      this.drawCentralBolt(context, boltScale);
      context.fill();
      context.strokeStyle = color;
      context.lineWidth = 1.7 + (this.level * 0.16);
      this.drawBoltSpine(context, boltScale);
      context.stroke();
      context.restore();
    }

    context.fillStyle = intensity > 0.72 ? "#ffffff" : color;
    context.strokeStyle = "#ffffff";
    context.lineWidth = 0.6 + (this.level * 0.035);
    this.drawCentralBolt(context, boltScale);
    context.fill();
    context.stroke();

    context.strokeStyle = `rgba(143, 247, 255, ${0.35 + (intensity * 0.28)})`;
    context.lineWidth = 0.55;
    this.drawBoltSpine(context, boltScale);
    context.stroke();

    context.restore();

    this.drawUpgradeDots(context, color);
    context.restore();

    if (active) {
      this.drawSelection(context);
    }
    context.restore();
  }

  private drawCentralBolt(context: CanvasRenderingContext2D, scale: number): void {
    context.beginPath();
    context.moveTo(3.3 * scale, -11.7 * scale);
    context.lineTo(-3.2 * scale, -0.6 * scale);
    context.lineTo(0.1 * scale, -0.7 * scale);
    context.lineTo(-4.4 * scale, 11.2 * scale);
    context.lineTo(5.3 * scale, -2.8 * scale);
    context.lineTo(1.7 * scale, -2.6 * scale);
    context.closePath();
  }

  private drawBoltSpine(context: CanvasRenderingContext2D, scale: number): void {
    context.beginPath();
    context.moveTo(2.2 * scale, -9.4 * scale);
    context.lineTo(-1.6 * scale, -0.2 * scale);
    context.lineTo(1.3 * scale, -0.4 * scale);
    context.lineTo(-2.7 * scale, 8.5 * scale);
  }

  private drawUpgradeDots(context: CanvasRenderingContext2D, color: string): void {
    const dotCount = this.level;
    if (dotCount === 0) {
      return;
    }

    const dotSpacing = Math.PI * 0.16;
    const centerAngle = 1.18;
    const dotRadius = 9.1;
    context.fillStyle = color;
    context.strokeStyle = "#ffffff";
    context.lineWidth = 0.65;

    for (let index = 0; index < dotCount; index += 1) {
      const angle = centerAngle - ((dotSpacing * (dotCount - 1)) / 2) + (dotSpacing * index);
      const x = Math.cos(angle) * dotRadius;
      const y = Math.sin(angle) * dotRadius;
      context.beginPath();
      context.arc(x, y, 1.25 + (this.level * 0.05), 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
  }

}
