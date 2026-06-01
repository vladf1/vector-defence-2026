import { EscapeFragmentParticle } from "./entities/effects/escape-fragment-particle";
import { HitRingEffect } from "./entities/effects/hit-ring-effect";
import { SmokeParticle } from "./entities/effects/missile-explosion-effect";
import type { Particle } from "./entities/effects/particle";
import { ShockwaveEffect } from "./entities/effects/shockwave-effect";
import type { UpdateContext } from "./game-engine/update-context";
import { randomRange } from "./utils";

const canvasTarget = document.querySelector<HTMLCanvasElement>("#escape-explosion-testing");
if (!canvasTarget) {
  throw new Error("Escape explosion testing canvas is missing.");
}

const canvas = canvasTarget;
const canvasContext = canvas.getContext("2d");
if (!canvasContext) {
  throw new Error("Escape explosion testing canvas could not be initialized.");
}
const context = canvasContext;

const particleReadoutTarget = document.querySelector<HTMLElement>("#particle-readout");
const largeFragmentsTarget = document.querySelector<HTMLInputElement>("#large-fragments");
const largeFragmentsValueTarget = document.querySelector<HTMLElement>("#large-fragments-value");
const smallFragmentsTarget = document.querySelector<HTMLInputElement>("#small-fragments");
const smallFragmentsValueTarget = document.querySelector<HTMLElement>("#small-fragments-value");
const smokeCountTarget = document.querySelector<HTMLInputElement>("#smoke-count");
const smokeCountValueTarget = document.querySelector<HTMLElement>("#smoke-count-value");
const burstSpeedTarget = document.querySelector<HTMLInputElement>("#burst-speed");
const burstSpeedValueTarget = document.querySelector<HTMLElement>("#burst-speed-value");
const timeScaleTarget = document.querySelector<HTMLInputElement>("#time-scale");
const timeScaleValueTarget = document.querySelector<HTMLElement>("#time-scale-value");
const zoomScaleTarget = document.querySelector<HTMLInputElement>("#zoom-scale");
const zoomScaleValueTarget = document.querySelector<HTMLElement>("#zoom-scale-value");
const triggerBurstTarget = document.querySelector<HTMLButtonElement>("#trigger-burst");
const autoRepeatTarget = document.querySelector<HTMLButtonElement>("#auto-repeat");
const resetDefaultsTarget = document.querySelector<HTMLButtonElement>("#reset-defaults");
const clearBurstsTarget = document.querySelector<HTMLButtonElement>("#clear-bursts");

if (
  !particleReadoutTarget ||
  !largeFragmentsTarget ||
  !largeFragmentsValueTarget ||
  !smallFragmentsTarget ||
  !smallFragmentsValueTarget ||
  !smokeCountTarget ||
  !smokeCountValueTarget ||
  !burstSpeedTarget ||
  !burstSpeedValueTarget ||
  !timeScaleTarget ||
  !timeScaleValueTarget ||
  !zoomScaleTarget ||
  !zoomScaleValueTarget ||
  !triggerBurstTarget ||
  !autoRepeatTarget ||
  !resetDefaultsTarget ||
  !clearBurstsTarget
) {
  throw new Error("Escape explosion testing controls are missing.");
}

const particleReadout = particleReadoutTarget;
const largeFragmentsSlider = largeFragmentsTarget;
const largeFragmentsValue = largeFragmentsValueTarget;
const smallFragmentsSlider = smallFragmentsTarget;
const smallFragmentsValue = smallFragmentsValueTarget;
const smokeCountSlider = smokeCountTarget;
const smokeCountValue = smokeCountValueTarget;
const burstSpeedSlider = burstSpeedTarget;
const burstSpeedValue = burstSpeedValueTarget;
const timeScaleSlider = timeScaleTarget;
const timeScaleValue = timeScaleValueTarget;
const zoomScaleSlider = zoomScaleTarget;
const zoomScaleValue = zoomScaleValueTarget;
const triggerBurstButton = triggerBurstTarget;
const autoRepeatButton = autoRepeatTarget;
const resetDefaultsButton = resetDefaultsTarget;
const clearBurstsButton = clearBurstsTarget;

interface BurstSettings {
  largeFragments: number;
  smallFragments: number;
  smokeCount: number;
  speedScale: number;
  timeScale: number;
  zoomScale: number;
}

const DEFAULT_SETTINGS: BurstSettings = {
  largeFragments: 58,
  smallFragments: 30,
  smokeCount: 18,
  speedScale: 1,
  timeScale: 1,
  zoomScale: 1,
};

const FIELD_WIDTH = 800;
const FIELD_HEIGHT = 450;
const GRID_SPACING = 40;
const MAX_DEVICE_PIXEL_RATIO = 2;
const AUTO_REPEAT_SECONDS = 1.45;
const COLORS = ["#b0ffe1", "#6df0c2", "#ffe36f", "#f4fff8", "#7fd7ff"];
const ESCAPE_POINT = {
  x: 724,
  y: 350,
};

let viewportWidth = 0;
let viewportHeight = 0;
let devicePixelRatio = 1;
let particles: Particle[] = [];
let lastTimestamp = performance.now();
let autoRepeat = false;
let autoRepeatTimer = AUTO_REPEAT_SECONDS;

triggerBurstButton.addEventListener("click", () => triggerBurst());
autoRepeatButton.addEventListener("click", toggleAutoRepeat);
resetDefaultsButton.addEventListener("click", resetDefaults);
clearBurstsButton.addEventListener("click", clearBursts);
canvas.addEventListener("pointerdown", (event) => triggerBurstAtPointer(event));

for (const slider of [
  largeFragmentsSlider,
  smallFragmentsSlider,
  smokeCountSlider,
  burstSpeedSlider,
  timeScaleSlider,
  zoomScaleSlider,
]) {
  slider.addEventListener("input", updateControlLabels);
}

resizeCanvas();
updateControlLabels();
triggerBurst();
window.addEventListener("resize", resizeCanvas);
requestAnimationFrame(animate);

function animate(timestamp: number): void {
  const deltaSeconds = Math.min(0.05, (timestamp - lastTimestamp) / 1000);
  lastTimestamp = timestamp;

  if (autoRepeat) {
    autoRepeatTimer -= deltaSeconds;
    if (autoRepeatTimer <= 0) {
      triggerBurst();
      autoRepeatTimer = AUTO_REPEAT_SECONDS;
    }
  }

  updateParticles(deltaSeconds * readSettings().timeScale);
  drawScene();
  requestAnimationFrame(animate);
}

function readSettings(): BurstSettings {
  return {
    largeFragments: Number(largeFragmentsSlider.value),
    smallFragments: Number(smallFragmentsSlider.value),
    smokeCount: Number(smokeCountSlider.value),
    speedScale: Number(burstSpeedSlider.value),
    timeScale: Number(timeScaleSlider.value),
    zoomScale: Number(zoomScaleSlider.value),
  };
}

function updateControlLabels(): void {
  const settings = readSettings();
  largeFragmentsValue.textContent = String(settings.largeFragments);
  smallFragmentsValue.textContent = String(settings.smallFragments);
  smokeCountValue.textContent = String(settings.smokeCount);
  burstSpeedValue.textContent = `${settings.speedScale.toFixed(1)}x`;
  timeScaleValue.textContent = `${settings.timeScale.toFixed(1)}x`;
  zoomScaleValue.textContent = `${settings.zoomScale.toFixed(1)}x`;
  updateReadout();
}

function updateReadout(): void {
  particleReadout.textContent = `${particles.filter((particle) => !particle.removed).length} particles`;
}

function triggerBurst(): void {
  particles.push(...createEscapeBurstParticles(ESCAPE_POINT.x, ESCAPE_POINT.y, readSettings()));
  updateReadout();
}

function triggerBurstAtPointer(event: PointerEvent): void {
  const point = screenToWorldPoint(event.clientX, event.clientY);
  particles.push(...createEscapeBurstParticles(point.x, point.y, readSettings()));
  autoRepeatTimer = AUTO_REPEAT_SECONDS;
  updateReadout();
}

function toggleAutoRepeat(): void {
  autoRepeat = !autoRepeat;
  autoRepeatButton.setAttribute("aria-pressed", String(autoRepeat));
  autoRepeatTimer = autoRepeat ? 0 : AUTO_REPEAT_SECONDS;
}

function resetDefaults(): void {
  largeFragmentsSlider.value = String(DEFAULT_SETTINGS.largeFragments);
  smallFragmentsSlider.value = String(DEFAULT_SETTINGS.smallFragments);
  smokeCountSlider.value = String(DEFAULT_SETTINGS.smokeCount);
  burstSpeedSlider.value = String(DEFAULT_SETTINGS.speedScale);
  timeScaleSlider.value = String(DEFAULT_SETTINGS.timeScale);
  zoomScaleSlider.value = String(DEFAULT_SETTINGS.zoomScale);
  updateControlLabels();
  clearBursts();
  triggerBurst();
}

function clearBursts(): void {
  particles = [];
  updateReadout();
}

function createEscapeBurstParticles(x: number, y: number, settings: BurstSettings): Particle[] {
  const burstParticles: Particle[] = [
    new ShockwaveEffect(x, y, 1.45),
    new HitRingEffect(x, y, "#b0ffe1", 24),
    new HitRingEffect(x, y, "#ffe36f", 12),
  ];

  for (let index = 0; index < settings.largeFragments; index += 1) {
    burstParticles.push(new EscapeFragmentParticle(
      x,
      y,
      getRandomColor(),
      randomRange(-Math.PI, Math.PI),
      randomRange(185, 500) * settings.speedScale,
      randomRange(5.5, 13),
      randomRange(2.4, 5.2),
      randomRange(3, 9),
    ));
  }

  for (let index = 0; index < settings.smallFragments; index += 1) {
    burstParticles.push(new EscapeFragmentParticle(
      x,
      y,
      getRandomColor(),
      randomRange(-Math.PI, Math.PI),
      randomRange(260, 620) * settings.speedScale,
      randomRange(2.8, 6.8),
      randomRange(1.1, 2.6),
      randomRange(2, 11),
    ));
  }

  for (let index = 0; index < settings.smokeCount; index += 1) {
    burstParticles.push(new SmokeParticle(x, y, randomRange(-Math.PI, Math.PI), 2));
  }

  return burstParticles;
}

function getRandomColor(): string {
  return COLORS[Math.floor(randomRange(0, COLORS.length))] ?? "#b0ffe1";
}

function updateParticles(deltaSeconds: number): void {
  const updateContext: UpdateContext = {
    deltaSeconds,
    fieldWidth: FIELD_WIDTH,
    fieldHeight: FIELD_HEIGHT,
    activeMonsters: [],
  };
  for (const particle of particles) {
    if (!particle.removed) {
      particle.update(updateContext);
    }
  }
  particles = particles.filter((particle) => !particle.removed);
  updateReadout();
}

function drawScene(): void {
  context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  context.clearRect(0, 0, viewportWidth, viewportHeight);
  context.fillStyle = "#020807";
  context.fillRect(0, 0, viewportWidth, viewportHeight);

  context.save();
  applyWorldTransform(context);
  drawGrid(context);
  drawRouteEnd(context);
  for (const particle of particles) {
    if (!particle.removed) {
      particle.draw(context);
    }
  }
  context.restore();
}

function drawGrid(targetContext: CanvasRenderingContext2D): void {
  targetContext.strokeStyle = "rgba(176, 255, 225, 0.08)";
  targetContext.lineWidth = 1;
  for (let x = 0; x <= FIELD_WIDTH; x += GRID_SPACING) {
    targetContext.beginPath();
    targetContext.moveTo(x, 0);
    targetContext.lineTo(x, FIELD_HEIGHT);
    targetContext.stroke();
  }
  for (let y = 0; y <= FIELD_HEIGHT; y += GRID_SPACING) {
    targetContext.beginPath();
    targetContext.moveTo(0, y);
    targetContext.lineTo(FIELD_WIDTH, y);
    targetContext.stroke();
  }
}

function drawRouteEnd(targetContext: CanvasRenderingContext2D): void {
  targetContext.save();
  targetContext.translate(ESCAPE_POINT.x, ESCAPE_POINT.y);
  targetContext.fillStyle = "rgba(176, 255, 225, 0.1)";
  targetContext.strokeStyle = "rgba(176, 255, 225, 0.5)";
  targetContext.lineWidth = 2;
  targetContext.beginPath();
  targetContext.arc(0, 0, 21, 0, Math.PI * 2);
  targetContext.fill();
  targetContext.stroke();
  targetContext.fillStyle = "rgba(255, 228, 148, 0.92)";
  targetContext.font = "800 12px Avenir Next, sans-serif";
  targetContext.textAlign = "center";
  targetContext.textBaseline = "middle";
  targetContext.fillText("ESC", 0, 0);
  targetContext.restore();
}

function applyWorldTransform(targetContext: CanvasRenderingContext2D): void {
  const settings = readSettings();
  const baseScale = Math.min(viewportWidth / FIELD_WIDTH, viewportHeight / FIELD_HEIGHT);
  const scale = baseScale * settings.zoomScale;
  const translateX = (viewportWidth - (FIELD_WIDTH * scale)) / 2;
  const translateY = (viewportHeight - (FIELD_HEIGHT * scale)) / 2;
  targetContext.translate(translateX, translateY);
  targetContext.scale(scale, scale);
}

function screenToWorldPoint(clientX: number, clientY: number): { x: number; y: number } {
  const settings = readSettings();
  const baseScale = Math.min(viewportWidth / FIELD_WIDTH, viewportHeight / FIELD_HEIGHT);
  const scale = baseScale * settings.zoomScale;
  const translateX = (viewportWidth - (FIELD_WIDTH * scale)) / 2;
  const translateY = (viewportHeight - (FIELD_HEIGHT * scale)) / 2;
  return {
    x: (clientX - translateX) / scale,
    y: (clientY - translateY) / scale,
  };
}

function resizeCanvas(): void {
  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;
  devicePixelRatio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
  canvas.width = Math.round(viewportWidth * devicePixelRatio);
  canvas.height = Math.round(viewportHeight * devicePixelRatio);
}
