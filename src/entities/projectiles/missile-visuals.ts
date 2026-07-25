import { clamp } from "../../utils";

const BASE_TAIL_X = -7.8;
const BASE_BODY_FRONT_X = 3.4;
const BASE_NOSE_TIP_X = 8.9;
const ROCKET_OFFSET_X = 1.8;
const BODY_HALF_HEIGHT = 1.65;
const NOSE_HALF_HEIGHT = 1.9;
const TAIL_CAP_LENGTH = 1.8;
const TAIL_CAP_HALF_HEIGHT = 0.85;

const MISSILE_EXHAUST_SMOKE_PUFFS = [
  { distanceBehindTail: 0.8, y: -0.18, radius: 2.2, alpha: 0.25 },
  { distanceBehindTail: 3.4, y: 0.22, radius: 3.1, alpha: 0.28 },
  { distanceBehindTail: 6.6, y: -0.35, radius: 4, alpha: 0.24 },
  { distanceBehindTail: 10.4, y: 0.18, radius: 4.8, alpha: 0.18 },
  { distanceBehindTail: 14.5, y: -0.08, radius: 5.7, alpha: 0.12 },
] as const;

export interface MissileVisual {
  bodyColor: string;
  noseColor: string;
  lengthBonus: number;
  coordinateScaleX: number;
  coordinateScaleY: number;
}

interface MissileGeometry {
  tailX: number;
  bodyFrontX: number;
  noseTipX: number;
  bodyHalfHeight: number;
  noseHalfHeight: number;
  tailCapLeftX: number;
  tailCapHalfHeight: number;
}

export function getMissileScale(level: number): number {
  return 1 + (0.05 * level);
}

export function createMissileVisual(level: number): MissileVisual {
  const levelScale = getMissileScale(level);
  return {
    bodyColor: "#ff9d5c",
    noseColor: "#ffe27a",
    lengthBonus: 3.2,
    coordinateScaleX: (1 + (0.03 * level)) / levelScale,
    coordinateScaleY: (1 + (0.04 * level)) / levelScale,
  };
}

export function getMissileHalfLength(visual: MissileVisual): number {
  const geometry = getMissileGeometry(visual);
  return Math.max(
    Math.abs(geometry.tailCapLeftX),
    Math.abs(geometry.noseTipX),
  );
}

export function drawMissileBody(context: CanvasRenderingContext2D, visual: MissileVisual): void {
  const geometry = getMissileGeometry(visual);
  context.fillStyle = visual.bodyColor;
  context.strokeStyle = "#06100f";
  context.lineWidth = 0.8;
  context.beginPath();
  context.rect(
    geometry.tailX,
    -geometry.bodyHalfHeight,
    geometry.bodyFrontX - geometry.tailX,
    geometry.bodyHalfHeight * 2,
  );
  context.fill();
  context.stroke();

  context.fillStyle = visual.noseColor;
  context.beginPath();
  context.moveTo(geometry.bodyFrontX, -geometry.noseHalfHeight);
  context.lineTo(geometry.noseTipX, 0);
  context.lineTo(geometry.bodyFrontX, geometry.noseHalfHeight);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = "#ff9d5c";
  context.fillRect(
    geometry.tailCapLeftX,
    -geometry.tailCapHalfHeight,
    geometry.tailX - geometry.tailCapLeftX,
    geometry.tailCapHalfHeight * 2,
  );
  context.strokeRect(
    geometry.tailCapLeftX,
    -geometry.tailCapHalfHeight,
    geometry.tailX - geometry.tailCapLeftX,
    geometry.tailCapHalfHeight * 2,
  );
}

export function drawMissileExhaust(
  context: CanvasRenderingContext2D,
  visual: MissileVisual,
  launchBloom: number,
): void {
  const bloom = clamp(launchBloom, 0, 1);
  const geometry = getMissileGeometry(visual);
  const exhaustOriginX = geometry.tailCapLeftX;
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

function getMissileGeometry(visual: MissileVisual): MissileGeometry {
  const scaleX = (x: number) => (x + ROCKET_OFFSET_X) * visual.coordinateScaleX;
  return {
    tailX: scaleX(BASE_TAIL_X),
    bodyFrontX: scaleX(BASE_BODY_FRONT_X + visual.lengthBonus),
    noseTipX: scaleX(BASE_NOSE_TIP_X + visual.lengthBonus),
    bodyHalfHeight: BODY_HALF_HEIGHT * visual.coordinateScaleY,
    noseHalfHeight: NOSE_HALF_HEIGHT * visual.coordinateScaleY,
    tailCapLeftX: scaleX(BASE_TAIL_X - TAIL_CAP_LENGTH),
    tailCapHalfHeight: TAIL_CAP_HALF_HEIGHT * visual.coordinateScaleY,
  };
}
