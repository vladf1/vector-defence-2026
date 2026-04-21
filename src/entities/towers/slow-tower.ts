import { TOWER_RADIUS } from "../../constants";
import { TowerKind } from "../../types";
import { withinDistance } from "../../utils";
import { LinkEffect } from "../effects/link-effect";
import type { GameAccess } from "../game-access";
import { Tower } from "./tower";

export class SlowTower extends Tower {
  static readonly kind = TowerKind.Slow;
  static readonly label = "Slow";
  static readonly summary = "Freezes clusters so the rest can clean up.";
  static readonly baseCost = 30;
  static readonly baseRange = 70;
  static readonly shortcuts = ["4", "s"] as const;

  pulse = 0;

  constructor(x: number, y: number) {
    super(x, y);
  }

  protected onUpdate(game: GameAccess, deltaSeconds: number): void {
    this.pulse += 4.8 * deltaSeconds;
    if (!this.ready()) {
      return;
    }

    let affected = 0;
    const maxTargets = this.level + 2;
    for (const monster of game.activeMonsters) {
      if (!withinDistance(this.x, this.y, monster.x, monster.y, this.range)) {
        continue;
      }
      monster.slowDown(0.5);
      game.addLink(new LinkEffect(monster, "#d8ff4f", 1, { x: this.x, y: this.y }));
      affected += 1;
      if (affected === maxTargets) {
        break;
      }
    }

    if (affected === 0) {
      return;
    }

    this.resetCooldown(1);
  }

  protected onUpgrade(): void {
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
    if (active) {
      this.drawSelection(context);
    }
    context.restore();
  }
}
