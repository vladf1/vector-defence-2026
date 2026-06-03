import type { UpdateContext } from "../../game-engine/update-context";
import { hexWithAlpha } from "../../utils";
import { Particle } from "./particle";

const SHOCKWAVE_POINT_COUNT = 18;
const OUTER_RADIUS_START = 5.75;
const OUTER_RADIUS_GROWTH = 44;
const INNER_FRONT_SCALE = 0.62;
const CORE_RADIUS = 13;
const HALF_TURN = Math.PI * 2;
const RIDGE_PHASE_STEP = 1.73;
const BREAK_PHASE_STEP = 2.41;
const STREAK_COUNT = 9;
const STREAK_PHASE_STEP = 0.7;
const ARC_SEGMENTS = 6;
const POINTS_PER_ARC_SEGMENT = SHOCKWAVE_POINT_COUNT / ARC_SEGMENTS;

interface FrontSample {
  angleCos: number;
  angleSin: number;
  broadWave: number;
  tornWaveSin: number;
  tornWaveCos: number;
  fineWave: number;
}

interface StreakSample {
  angleCos: number;
  angleSin: number;
  endAngleCos: number;
  endAngleSin: number;
  lengthScale: number;
  startRadiusScale: number;
}

export class ShockwaveEffect extends Particle {
  private ageSeconds = 0;
  private readonly rotation: number;
  private readonly frontSamples: FrontSample[];
  private readonly breakValues: number[];
  private readonly streakSamples: StreakSample[];

  constructor(x: number, y: number, private readonly scale: number) {
    super(x, y, 0, "#fff0a8", 1, { speedPerSecond: 0, offset: 0, angle: 0 });
    this.alpha = 1;
    this.rotation = (x * 0.013) + (y * 0.019) + (scale * 0.7);
    this.frontSamples = this.createFrontSamples();
    this.breakValues = this.createBreakValues();
    this.streakSamples = this.createStreakSamples();
  }

  override update(context: UpdateContext): void {
    this.ageSeconds += context.deltaSeconds;
    this.alpha = Math.max(0, 1 - (this.ageSeconds * 4.15));
    if (this.alpha <= 0) {
      this.removed = true;
    }
  }

  override draw(context: CanvasRenderingContext2D): void {
    const progress = Math.min(1, this.ageSeconds * 4.15);
    const coreAlpha = Math.max(0, 1 - (progress * 4.5));
    const shockRadius = (OUTER_RADIUS_START + (progress * OUTER_RADIUS_GROWTH)) * this.scale;

    context.save();
    context.globalCompositeOperation = "lighter";
    if (coreAlpha > 0) {
      const coreRadius = CORE_RADIUS * this.scale;
      const coreGradient = context.createRadialGradient(this.x, this.y, 0, this.x, this.y, coreRadius);
      coreGradient.addColorStop(0, hexWithAlpha("#ffffff", coreAlpha));
      coreGradient.addColorStop(0.38, hexWithAlpha("#fff0a8", coreAlpha * 0.9));
      coreGradient.addColorStop(1, hexWithAlpha("#ff7a3d", 0));
      context.fillStyle = coreGradient;
      context.beginPath();
      context.arc(this.x, this.y, coreRadius, 0, Math.PI * 2);
      context.fill();
    }

    const tornPhase = progress * RIDGE_PHASE_STEP;
    const tornPhaseSin = Math.sin(tornPhase);
    const tornPhaseCos = Math.cos(tornPhase);

    this.drawPressureBloom(context, progress, shockRadius, tornPhaseSin, tornPhaseCos);
    this.drawFragmentedFront(context, progress, shockRadius, tornPhaseSin, tornPhaseCos);
    this.drawRadialStreaks(context, progress, shockRadius);
    context.restore();
  }

  private drawPressureBloom(
    context: CanvasRenderingContext2D,
    progress: number,
    radius: number,
    tornPhaseSin: number,
    tornPhaseCos: number,
  ): void {
    const gradient = context.createRadialGradient(this.x, this.y, radius * 0.18, this.x, this.y, radius * 1.16);
    gradient.addColorStop(0, hexWithAlpha("#fff2bf", 0));
    gradient.addColorStop(0.46, hexWithAlpha("#ffb46e", this.alpha * 0.08));
    gradient.addColorStop(0.74, hexWithAlpha("#f99a5f", this.alpha * 0.14));
    gradient.addColorStop(1, hexWithAlpha("#f99a5f", 0));

    context.fillStyle = gradient;
    this.traceDistortedFront(context, radius, progress, 0.72, tornPhaseSin, tornPhaseCos);
    context.fill();
  }

  private drawFragmentedFront(
    context: CanvasRenderingContext2D,
    progress: number,
    radius: number,
    tornPhaseSin: number,
    tornPhaseCos: number,
  ): void {
    context.lineCap = "round";
    context.lineJoin = "round";

    context.strokeStyle = hexWithAlpha("#f99a5f", this.alpha * 0.86);
    context.lineWidth = Math.max(0.42, 3.15 * this.scale * (1 - (progress * 0.45)));
    this.strokeBrokenFront(context, radius, progress, 0.98, 0, tornPhaseSin, tornPhaseCos);

    context.strokeStyle = hexWithAlpha("#fff2bf", this.alpha * 0.62);
    context.lineWidth = Math.max(0.28, 1.05 * this.scale);
    this.strokeBrokenFront(context, radius * INNER_FRONT_SCALE, progress + 0.18, 0.72, 1, tornPhaseSin, tornPhaseCos);
  }

  private strokeBrokenFront(
    context: CanvasRenderingContext2D,
    radius: number,
    progress: number,
    wobbleScale: number,
    phaseOffset: number,
    tornPhaseSin: number,
    tornPhaseCos: number,
  ): void {
    let hasSegment = false;
    const breakValueOffset = phaseOffset * ARC_SEGMENTS;
    const visibleThreshold = -0.45 + (progress * 0.28);
    context.beginPath();

    for (let segment = 0; segment < ARC_SEGMENTS; segment += 1) {
      const breakValue = this.breakValues[segment + breakValueOffset] ?? 0;
      if (breakValue < visibleThreshold) {
        continue;
      }

      const startIndex = segment * POINTS_PER_ARC_SEGMENT;
      const endIndex = startIndex + Math.max(2, Math.round(POINTS_PER_ARC_SEGMENT * (0.58 + (0.22 * Math.max(0, breakValue)))));
      this.traceDistortedArc(context, radius, progress, wobbleScale, startIndex, endIndex, tornPhaseSin, tornPhaseCos);
      hasSegment = true;
    }

    if (hasSegment) {
      context.stroke();
    }
  }

  private drawRadialStreaks(context: CanvasRenderingContext2D, progress: number, radius: number): void {
    context.strokeStyle = hexWithAlpha("#fff2bf", this.alpha * 0.28);
    context.lineWidth = Math.max(0.22, 0.88 * this.scale * (1 - (progress * 0.35)));
    context.lineCap = "round";

    const centerX = this.x;
    const centerY = this.y;
    context.beginPath();
    for (let index = 0; index < STREAK_COUNT; index += 1) {
      const sample = this.streakSamples[index];
      const startRadius = radius * sample.startRadiusScale;
      const endRadius = startRadius + (radius * sample.lengthScale);

      context.moveTo(
        centerX + (sample.angleCos * startRadius),
        centerY + (sample.angleSin * startRadius),
      );
      context.lineTo(
        centerX + (sample.endAngleCos * endRadius),
        centerY + (sample.endAngleSin * endRadius),
      );
    }
    context.stroke();
  }

  private traceDistortedFront(
    context: CanvasRenderingContext2D,
    radius: number,
    progress: number,
    wobbleScale: number,
    tornPhaseSin: number,
    tornPhaseCos: number,
  ): void {
    const centerX = this.x;
    const centerY = this.y;
    const settledWobble = wobbleScale * (1 - (progress * 0.38));
    context.beginPath();
    for (let pointIndex = 0; pointIndex <= SHOCKWAVE_POINT_COUNT; pointIndex += 1) {
      const sampleIndex = pointIndex === SHOCKWAVE_POINT_COUNT ? 0 : pointIndex;
      const sample = this.frontSamples[sampleIndex];
      const pointRadius = this.getDistortedRadius(radius, sample, settledWobble, tornPhaseSin, tornPhaseCos);
      const x = centerX + (sample.angleCos * pointRadius);
      const y = centerY + (sample.angleSin * pointRadius);
      if (pointIndex === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.closePath();
  }

  private traceDistortedArc(
    context: CanvasRenderingContext2D,
    radius: number,
    progress: number,
    wobbleScale: number,
    startIndex: number,
    endIndex: number,
    tornPhaseSin: number,
    tornPhaseCos: number,
  ): void {
    const centerX = this.x;
    const centerY = this.y;
    const settledWobble = wobbleScale * (1 - (progress * 0.38));
    for (let pointIndex = startIndex; pointIndex <= endIndex; pointIndex += 1) {
      const sampleIndex = pointIndex === SHOCKWAVE_POINT_COUNT ? 0 : pointIndex;
      const sample = this.frontSamples[sampleIndex];
      const pointRadius = this.getDistortedRadius(radius, sample, settledWobble, tornPhaseSin, tornPhaseCos);
      const x = centerX + (sample.angleCos * pointRadius);
      const y = centerY + (sample.angleSin * pointRadius);
      if (pointIndex === startIndex) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
  }

  private getDistortedRadius(
    radius: number,
    sample: FrontSample,
    settledWobble: number,
    tornPhaseSin: number,
    tornPhaseCos: number,
  ): number {
    const tornWave = ((sample.tornWaveSin * tornPhaseCos) + (sample.tornWaveCos * tornPhaseSin)) * 0.044;
    return radius * (1 + ((sample.broadWave + tornWave + sample.fineWave) * settledWobble));
  }

  private createFrontSamples(): FrontSample[] {
    const samples: FrontSample[] = [];
    for (let pointIndex = 0; pointIndex < SHOCKWAVE_POINT_COUNT; pointIndex += 1) {
      const angle = this.rotation + ((pointIndex / SHOCKWAVE_POINT_COUNT) * HALF_TURN);
      const tornAngle = (angle * 7) - this.rotation;
      samples.push({
        angleCos: Math.cos(angle),
        angleSin: Math.sin(angle),
        broadWave: Math.sin((angle * 3) + this.rotation) * 0.075,
        tornWaveSin: Math.sin(tornAngle),
        tornWaveCos: Math.cos(tornAngle),
        fineWave: Math.sin((angle * 13) + (this.rotation * 0.7)) * 0.018,
      });
    }
    return samples;
  }

  private createBreakValues(): number[] {
    const values: number[] = [];
    for (let phaseOffset = 0; phaseOffset <= 1; phaseOffset += 1) {
      for (let segment = 0; segment < ARC_SEGMENTS; segment += 1) {
        values.push(Math.sin(this.rotation + phaseOffset + (segment * BREAK_PHASE_STEP)));
      }
    }
    return values;
  }

  private createStreakSamples(): StreakSample[] {
    const samples: StreakSample[] = [];
    for (let index = 0; index < STREAK_COUNT; index += 1) {
      const angle = this.rotation + (index * STREAK_PHASE_STEP);
      const endAngle = angle + (0.08 * Math.sin(index));
      samples.push({
        angleCos: Math.cos(angle),
        angleSin: Math.sin(angle),
        endAngleCos: Math.cos(endAngle),
        endAngleSin: Math.sin(endAngle),
        lengthScale: 0.14 + (0.08 * Math.sin(this.rotation + index)),
        startRadiusScale: 0.54 + (0.1 * Math.sin(angle * 1.9)),
      });
    }
    return samples;
  }
}
