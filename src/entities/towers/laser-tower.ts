import { createLaserImpactParticles } from "../../game-engine/combat-effects";
import type { UpdateContext, UpdateResult } from "../../game-engine/update-context";
import { AudioCue, type Point, TowerKind } from "../../types";
import { angleBetween, closestPointOnSegment, isWithinDistanceToSegment, randomRange, turnAngleTowards, withinDistance } from "../../utils";
import { Tower } from "./tower";

const LASER_COLORS = [
  { body: "#5bf4ff", accent: "#9dffd7", ring: "110, 255, 152", beam: "110, 255, 152" },
  { body: "#6dff9c", accent: "#d8ff4f", ring: "185, 255, 105", beam: "185, 255, 105" },
  { body: "#ffe36f", accent: "#ff9d5c", ring: "255, 227, 111", beam: "255, 227, 111" },
  { body: "#ffad4f", accent: "#ff6d8c", ring: "255, 157, 92", beam: "255, 157, 92" },
  { body: "#ff8edb", accent: "#b58cff", ring: "255, 142, 219", beam: "255, 142, 219" },
  { body: "#b58cff", accent: "#78a7ff", ring: "181, 140, 255", beam: "181, 140, 255" },
  { body: "#4f8cff", accent: "#f6f0ff", ring: "79, 140, 255", beam: "79, 140, 255" },
] as const;
const BEAM_FADE_PER_SECOND = 0.9;

export class LaserTower extends Tower {
  static readonly kind = TowerKind.Laser;
  static readonly label = "Laser";
  static readonly summary = "Piercing beam that melts lines of enemies.";
  static readonly baseCost = 3;
  static readonly baseRange = 100;
  static readonly shortcuts = ["2", "z"] as const;

  angle = randomRange(-Math.PI, Math.PI);
  beamAlpha = 0;
  beamTarget = { x: 0, y: 0 };
  damagePerSecond = 60;
  directionLocked = false;
  laserSparkCooldownSeconds = 0;
  turnSpeedPerSecond = 6.72;

  constructor(x: number, y: number) {
    super(x, y);
  }

  protected updateTower(context: UpdateContext, result: UpdateResult): void {
    this.laserSparkCooldownSeconds = Math.max(0, this.laserSparkCooldownSeconds - context.deltaSeconds);

    this.beamTarget = {
      x: this.x + (Math.cos(this.angle) * 1000),
      y: this.y + (Math.sin(this.angle) * 1000),
    };

    if (this.directionLocked) {
      if (this.ready() && this.hasMonsterInBeam(context)) {
        this.fire(result);
      }
    } else {
      const tracked = this.findTrackedMonsterInContext(context);
      if (tracked) {
        const targetAngle = angleBetween(this, tracked);
        this.angle = turnAngleTowards(this.angle, targetAngle, this.turnSpeedPerSecond * context.deltaSeconds);
        this.beamTarget = {
          x: this.x + (Math.cos(this.angle) * 1000),
          y: this.y + (Math.sin(this.angle) * 1000),
        };

        const alignedToTarget = this.isAimedAtTarget(this.angle, targetAngle);
        if (alignedToTarget && this.ready()) {
          this.fire(result);
        }
      }
    }

    const integratedBeamStrengthSeconds = this.advanceBeam(context.deltaSeconds);
    if (integratedBeamStrengthSeconds <= 0) {
      return;
    }

    const muzzleOffset = this.getMuzzleOffset();
    const source = {
      x: this.x + (Math.cos(this.angle) * muzzleOffset),
      y: this.y + (Math.sin(this.angle) * muzzleOffset),
    };
    const shouldCreateSparks = this.laserSparkCooldownSeconds <= 0;
    let sparkBurstsCreated = 0;
    const colors = this.getLaserColors();

    for (const monster of context.activeMonsters) {
      if (!this.isMonsterActive(monster)) {
        continue;
      }
      if (isWithinDistanceToSegment(monster, source, this.beamTarget, monster.radius)) {
        monster.takeContinuousDamage(this.damagePerSecond * integratedBeamStrengthSeconds);
        if (shouldCreateSparks && sparkBurstsCreated < 2) {
          const impact = closestPointOnSegment(monster, source, this.beamTarget);
          for (const particle of createLaserImpactParticles(impact.x, impact.y, this.angle, colors.accent)) {
            result.addParticle(particle);
          }
          sparkBurstsCreated += 1;
        }
      }
    }

    if (sparkBurstsCreated > 0) {
      this.laserSparkCooldownSeconds = 0.055;
    }
  }

  private advanceBeam(deltaSeconds: number): number {
    if (this.beamAlpha <= 0 || deltaSeconds <= 0) {
      return 0;
    }

    const startingAlpha = this.beamAlpha;
    const activeSeconds = Math.min(deltaSeconds, startingAlpha / BEAM_FADE_PER_SECOND);
    const endingAlpha = Math.max(0, startingAlpha - (BEAM_FADE_PER_SECOND * activeSeconds));
    this.beamAlpha = endingAlpha;
    return activeSeconds * ((startingAlpha + endingAlpha) / 2);
  }

  protected onUpgrade(): void {
    this.damagePerSecond = 60 + (15 * this.level);
  }

  toggleDirectionLock(): void {
    this.directionLocked = !this.directionLocked;
  }

  private getLaserColors(): typeof LASER_COLORS[number] {
    return LASER_COLORS[Math.min(this.level, LASER_COLORS.length - 1)];
  }

  private getMuzzleOffset(): number {
    return 8.5 + (this.level * 0.78);
  }

  private fire(result: UpdateResult): void {
    this.beamAlpha = 1;
    this.resetCooldown(1.5);
    result.playSound(AudioCue.LaserFire, this.x, 0.9 + (this.level * 0.1));
  }

  private hasMonsterInBeam(context: UpdateContext): boolean {
    const source = this.getBeamSource();

    for (const monster of context.activeMonsters) {
      if (!this.isMonsterActive(monster)) {
        continue;
      }
      if (!withinDistance(this, monster, this.range)) {
        continue;
      }

      if (isWithinDistanceToSegment(monster, source, this.beamTarget, monster.radius)) {
        return true;
      }
    }
    return false;
  }

  private getBeamSource(): Point {
    const muzzleOffset = this.getMuzzleOffset();
    return {
      x: this.x + (Math.cos(this.angle) * muzzleOffset),
      y: this.y + (Math.sin(this.angle) * muzzleOffset),
    };
  }

  draw(context: CanvasRenderingContext2D, active: boolean): void {
    const colors = this.getLaserColors();

    context.save();
    context.translate(this.x, this.y);
    this.drawBase(context, "#050908", "#ffffff", `rgba(${colors.ring}, ${0.22 + (this.level * 0.02)})`);

    context.rotate(this.angle);
    const visualLevel = this.level + 1;
    const muzzleOffset = this.getMuzzleOffset();
    const tailX = -8.5 - (visualLevel * 0.36);
    const shoulderX = -1.8 + (this.level * 0.18);
    const halfHeight = 3.6 + (visualLevel * 0.26);
    const shoulderHalfHeight = 2.9 + (visualLevel * 0.18);

    context.fillStyle = colors.body;
    this.traceLaserBody(context, tailX, shoulderX, muzzleOffset, halfHeight, shoulderHalfHeight);
    context.fill();
    context.stroke();

    if (this.level > 0) {
      context.fillStyle = colors.accent;
      const powerbankX = -6.9;
      const powerbankLength = 6.22 + ((this.level - 1) * 1.14);
      context.fillRect(powerbankX, -halfHeight - 2.6, powerbankLength, 1.5 + (this.level * 0.06));
      context.fillRect(powerbankX, halfHeight + 1.1, powerbankLength, 1.5 + (this.level * 0.06));
      context.beginPath();
      context.arc(muzzleOffset - 1.4, 0, 1.25 + (this.level * 0.16), 0, Math.PI * 2);
      context.fill();
    }

    if (this.directionLocked) {
      context.fillStyle = "#ffe36f";
      context.strokeStyle = "#06100f";
      context.lineWidth = 0.8;
      context.beginPath();
      context.arc(-5.2, 0, 2.3, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }

    context.strokeStyle = "#ffffff";
    context.lineWidth = 1.5;
    this.traceLaserBody(context, tailX, shoulderX, muzzleOffset, halfHeight, shoulderHalfHeight);
    context.stroke();

    if (active) {
      this.drawSelection(context);
    }
    context.restore();

    if (this.beamAlpha > 0) {
      const source = this.getBeamSource();
      context.save();
      context.globalCompositeOperation = "lighter";
      context.shadowColor = `rgba(${colors.beam}, ${0.7 * this.beamAlpha})`;
      context.shadowBlur = 14 + (this.level * 2);
      context.strokeStyle = `rgba(${colors.beam}, ${0.2 * this.beamAlpha})`;
      context.lineWidth = 7 + (this.level * 0.55);
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(source.x, source.y);
      context.lineTo(this.beamTarget.x, this.beamTarget.y);
      context.stroke();
      context.strokeStyle = `rgba(${colors.beam}, ${0.85 * this.beamAlpha})`;
      context.lineWidth = 1.5 + (this.level / 3);
      context.beginPath();
      context.moveTo(source.x, source.y);
      context.lineTo(this.beamTarget.x, this.beamTarget.y);
      context.stroke();
      context.fillStyle = `rgba(${colors.beam}, ${0.35 * this.beamAlpha})`;
      context.beginPath();
      context.arc(source.x, source.y, 4 + (this.level * 0.35), 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  private traceLaserBody(
    context: CanvasRenderingContext2D,
    tailX: number,
    shoulderX: number,
    muzzleOffset: number,
    halfHeight: number,
    shoulderHalfHeight: number,
  ): void {
    context.beginPath();
    context.moveTo(tailX, halfHeight);
    context.lineTo(shoulderX, shoulderHalfHeight);
    context.lineTo(muzzleOffset, 0);
    context.lineTo(shoulderX, -shoulderHalfHeight);
    context.lineTo(tailX, -halfHeight);
    context.closePath();
  }
}
