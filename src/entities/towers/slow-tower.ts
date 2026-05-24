import { TOWER_RADIUS } from "../../constants";
import type { UpdateContext, UpdateResult } from "../../game-engine/update-context";
import { AudioCue, TowerKind } from "../../types";
import { withinDistance } from "../../utils";
import { LinkEffect } from "../effects/link-effect";
import { Tower } from "./tower";

const SLOW_FACTOR = 0.5;
const RECOVERY_SPEED_PER_SECOND = 36;

export class SlowTower extends Tower {
  static readonly kind = TowerKind.Slow;
  static readonly label = "Slow";
  static readonly summary = "Freezes clusters so the rest can clean up.";
  static readonly baseCost = 3;
  static readonly baseRange = 70;
  static readonly shortcuts = ["4", "s"] as const;

  pulse = 0;
  orbit = 0;

  constructor(x: number, y: number) {
    super(x, y);
  }

  protected updateTower(context: UpdateContext, result: UpdateResult): void {
    this.pulse += 4.8 * context.deltaSeconds;
    this.orbit += this.getOrbitSpeedPerSecond() * context.deltaSeconds;
    if (!this.ready()) {
      return;
    }

    let affected = 0;
    const maxTargets = this.level + 2;
    for (const monster of context.activeMonsters) {
      if (!withinDistance(this, monster, this.range)) {
        continue;
      }
      monster.slowDown(SLOW_FACTOR, RECOVERY_SPEED_PER_SECOND);
      result.addLink(new LinkEffect(monster, "#d8ff4f", 1, this));
      affected += 1;
      if (affected === maxTargets) {
        break;
      }
    }

    if (affected === 0) {
      return;
    }

    this.resetCooldown(1);
    result.playSound(AudioCue.SlowPulse, this.x, 0.85 + (affected * 0.1));
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
    this.drawBase(context, gradient, "#ffffff", `rgba(216, 255, 79, ${0.22 + (this.level * 0.02)})`);

    if (this.level > 0) {
      const nodeCount = Math.min(6, this.level + 1);
      const orbitRadius = 7 + (this.level * 0.75);
      context.fillStyle = "#ffe27a";
      context.beginPath();
      for (let i = 0; i < nodeCount; i += 1) {
        if (i % 2 !== 0) {
          continue;
        }
        const angle = this.orbit + ((Math.PI * 2 * i) / nodeCount);
        const nodeX = Math.cos(angle) * orbitRadius;
        const nodeY = Math.sin(angle) * orbitRadius;
        const nodeRadius = 1.8 + (this.level * 0.12);
        context.moveTo(nodeX + nodeRadius, nodeY);
        context.arc(nodeX, nodeY, nodeRadius, 0, Math.PI * 2);
      }
      context.fill();

      context.fillStyle = "#d8ff4f";
      context.beginPath();
      for (let i = 1; i < nodeCount; i += 2) {
        const angle = this.orbit + ((Math.PI * 2 * i) / nodeCount);
        const nodeX = Math.cos(angle) * orbitRadius;
        const nodeY = Math.sin(angle) * orbitRadius;
        const nodeRadius = 1.8 + (this.level * 0.12);
        context.moveTo(nodeX + nodeRadius, nodeY);
        context.arc(nodeX, nodeY, nodeRadius, 0, Math.PI * 2);
      }
      context.fill();
    }

    if (active) {
      this.drawSelection(context);
    }
    context.restore();
  }
}
