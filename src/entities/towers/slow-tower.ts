import { TOWER_RADIUS, TOWER_UPGRADE_RING_GROWTH, TOWER_UPGRADE_RING_OFFSET } from "../../constants";
import type { Game } from "../../game-engine";
import { AudioCue, TowerKind } from "../../types";
import { withinDistance } from "../../utils";
import { LinkEffect } from "../effects/link-effect";
import { Tower } from "./tower";

export class SlowTower extends Tower {
  static readonly kind = TowerKind.Slow;
  static readonly label = "Slow";
  static readonly summary = "Freezes clusters so the rest can clean up.";
  static readonly baseCost = 30;
  static readonly baseRange = 70;
  static readonly shortcuts = ["4", "s"] as const;

  pulse = 0;
  orbit = 0;

  constructor(x: number, y: number) {
    super(x, y);
  }

  protected onUpdate(game: Game, deltaSeconds: number): void {
    this.pulse += 4.8 * deltaSeconds;
    this.orbit += this.getOrbitSpeedPerSecond() * deltaSeconds;
    if (!this.ready()) {
      return;
    }

    let affected = 0;
    const maxTargets = this.level + 2;
    for (const monster of game.runtime.getActiveMonsters()) {
      if (!withinDistance(this.x, this.y, monster.x, monster.y, this.range)) {
        continue;
      }
      monster.slowDown(0.5);
      game.addLink(new LinkEffect(monster, "#d8ff4f", 1, this));
      affected += 1;
      if (affected === maxTargets) {
        break;
      }
    }

    if (affected === 0) {
      return;
    }

    this.resetCooldown(1);
    game.playSound(AudioCue.SlowPulse, this.x, 0.85 + (affected * 0.1));
  }

  private getOrbitSpeedPerSecond(): number {
    return 4.8 / (1 + (this.level * 0.7));
  }

  draw(context: CanvasRenderingContext2D, active: boolean): void {
    context.save();
    context.translate(this.x, this.y);
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, TOWER_RADIUS);
    gradient.addColorStop(0, "#050908");
    gradient.addColorStop(1, `rgba(255, 220, 92, ${0.6 + (Math.sin(this.pulse) * 0.2)})`);
    context.fillStyle = gradient;
    context.strokeStyle = "#ffffff";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(0, 0, TOWER_RADIUS, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    if (this.level > 0) {
      context.strokeStyle = `rgba(216, 255, 79, ${0.22 + (this.level * 0.02)})`;
      context.lineWidth = 0.9 + (this.level * 0.08);
      context.beginPath();
      context.arc(0, 0, TOWER_RADIUS + TOWER_UPGRADE_RING_OFFSET + (this.level * TOWER_UPGRADE_RING_GROWTH), 0, Math.PI * 2);
      context.stroke();

      const nodeCount = Math.min(6, this.level + 1);
      const orbitRadius = 7 + (this.level * 0.75);
      for (let i = 0; i < nodeCount; i += 1) {
        const angle = this.orbit + ((Math.PI * 2 * i) / nodeCount);
        context.fillStyle = i % 2 === 0 ? "#ffe27a" : "#d8ff4f";
        context.beginPath();
        context.arc(Math.cos(angle) * orbitRadius, Math.sin(angle) * orbitRadius, 1.8 + (this.level * 0.12), 0, Math.PI * 2);
        context.fill();
      }
    }

    if (active) {
      this.drawSelection(context);
    }
    context.restore();
  }
}
