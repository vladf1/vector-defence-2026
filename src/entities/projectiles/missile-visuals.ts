import { clamp } from "../../utils";

const BASE_TAIL_X = -7.8;
const BASE_BODY_FRONT_X = 3.4;
const BASE_NOSE_TIP_X = 8.9;
const ROCKET_OFFSET_X = 1.8;
const BODY_HALF_HEIGHT = 1.65;
const NOSE_HALF_HEIGHT = 1.9;
const TAIL_CAP_LENGTH = 2.4;
const TAIL_CAP_BODY_WIDTH_RATIO = 0.85;
const BASE_MISSILE_REAR_X = BASE_TAIL_X - TAIL_CAP_LENGTH + ROCKET_OFFSET_X;
const MISSILE_LENGTH_SCALE_PER_LEVEL = 0.03;

const MISSILE_EXHAUST_SMOKE_PUFFS = [
  { distanceBehindTail: 0.8, y: -0.18, radius: 2.2, alpha: 0.25 },
  { distanceBehindTail: 3.4, y: 0.22, radius: 3.1, alpha: 0.28 },
  { distanceBehindTail: 6.6, y: -0.35, radius: 4, alpha: 0.24 },
  { distanceBehindTail: 10.4, y: 0.18, radius: 4.8, alpha: 0.18 },
  { distanceBehindTail: 14.5, y: -0.08, radius: 5.7, alpha: 0.12 },
] as const;

export interface MissileVisual {
  readonly bodyColor: string;
  readonly noseColor: string;
  readonly tailX: number;
  readonly bodyFrontX: number;
  readonly noseTipX: number;
  readonly bodyHalfHeight: number;
  readonly noseHalfHeight: number;
  readonly tailCapLeftX: number;
  readonly tailCapHalfHeight: number;
}

export function getMissileScale(level: number): number {
  return 1 + (0.05 * level);
}

export function getMissileRearX(level: number): number {
  return BASE_MISSILE_REAR_X * (1 + (MISSILE_LENGTH_SCALE_PER_LEVEL * level));
}

export function createMissileVisual(level: number): MissileVisual {
  const levelScale = getMissileScale(level);
  const coordinateScaleX = (1 + (MISSILE_LENGTH_SCALE_PER_LEVEL * level)) / levelScale;
  const coordinateScaleY = (1 + (0.04 * level)) / levelScale;
  const scaleX = (x: number) => (x + ROCKET_OFFSET_X) * coordinateScaleX;
  return {
    bodyColor: "#ff9d5c",
    noseColor: "#ffe27a",
    tailX: scaleX(BASE_TAIL_X),
    bodyFrontX: scaleX(BASE_BODY_FRONT_X + 3.2),
    noseTipX: scaleX(BASE_NOSE_TIP_X + 3.2),
    bodyHalfHeight: BODY_HALF_HEIGHT * coordinateScaleY,
    noseHalfHeight: NOSE_HALF_HEIGHT * coordinateScaleY,
    tailCapLeftX: scaleX(BASE_TAIL_X - TAIL_CAP_LENGTH),
    tailCapHalfHeight: BODY_HALF_HEIGHT * TAIL_CAP_BODY_WIDTH_RATIO * coordinateScaleY,
  };
}

export function getMissileHalfLength(visual: MissileVisual): number {
  return Math.max(
    Math.abs(visual.tailCapLeftX),
    Math.abs(visual.noseTipX),
  );
}

export function drawMissileBody(context: CanvasRenderingContext2D, visual: MissileVisual): void {
  context.fillStyle = visual.bodyColor;
  context.strokeStyle = "#06100f";
  context.lineWidth = 0.8;
  context.beginPath();
  context.rect(
    visual.tailX,
    -visual.bodyHalfHeight,
    visual.bodyFrontX - visual.tailX,
    visual.bodyHalfHeight * 2,
  );
  context.fill();
  context.stroke();

  context.fillStyle = visual.noseColor;
  context.beginPath();
  context.moveTo(visual.bodyFrontX, -visual.noseHalfHeight);
  context.lineTo(visual.noseTipX, 0);
  context.lineTo(visual.bodyFrontX, visual.noseHalfHeight);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = "#ff9d5c";
  context.fillRect(
    visual.tailCapLeftX,
    -visual.tailCapHalfHeight,
    visual.tailX - visual.tailCapLeftX,
    visual.tailCapHalfHeight * 2,
  );
  context.strokeRect(
    visual.tailCapLeftX,
    -visual.tailCapHalfHeight,
    visual.tailX - visual.tailCapLeftX,
    visual.tailCapHalfHeight * 2,
  );
}

export function drawMissileExhaust(
  context: CanvasRenderingContext2D,
  visual: MissileVisual,
  launchBloom: number,
): void {
  const bloom = clamp(launchBloom, 0, 1);
  const exhaustOriginX = visual.tailCapLeftX;
  const trailStretch = 1 + (bloom * 0.65);
  const smokeScale = 1 + (bloom * 0.18);
  for (const puff of MISSILE_EXHAUST_SMOKE_PUFFS) {
    const puffX = exhaustOriginX - (puff.distanceBehindTail * trailStretch);
    const radius = puff.radius * smokeScale;
    const smoke = context.createRadialGradient(puffX, puff.y, 0, puffX, puff.y, radius);
    smoke.addColorStop(0, `rgba(126, 133, 140, ${puff.alpha * (1 + (bloom * 0.45))})`);
    smoke.addColorStop(1, "rgba(126, 133, 140, 0)");
    context.fillStyle = smoke;
    context.beginPath();
    context.arc(puffX, puff.y, radius, 0, Math.PI * 2);
    context.fill();
  }

  context.save();
  context.globalCompositeOperation = "lighter";
  const flameCenterX = exhaustOriginX - 0.4 - (bloom * 2.8);
  const flameRadius = 8.2 + (bloom * 4.8);
  const flameGlow = context.createRadialGradient(flameCenterX, 0, 0, flameCenterX, 0, flameRadius);
  flameGlow.addColorStop(0, `rgba(255, 240, 168, ${0.5 + (bloom * 0.24)})`);
  flameGlow.addColorStop(0.32, `rgba(255, 143, 69, ${0.38 + (bloom * 0.2)})`);
  flameGlow.addColorStop(1, "rgba(255, 143, 69, 0)");
  context.fillStyle = flameGlow;
  context.beginPath();
  context.ellipse(
    exhaustOriginX - 3.8 - (bloom * 3.6),
    0,
    6.9 + (bloom * 5.6),
    1.7 + (bloom * 0.55),
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.restore();
}
