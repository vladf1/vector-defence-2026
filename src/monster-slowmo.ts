import { EFFECT_FIELD_HEIGHT, EFFECT_FIELD_WIDTH } from "./constants";
import type { Particle } from "./entities/effects/particle";
import { BallMonster } from "./entities/monsters/ball-monster";
import { BerserkerMonster } from "./entities/monsters/berserker-monster";
import { BulwarkMonster } from "./entities/monsters/bulwark-monster";
import { Monster } from "./entities/monsters/monster";
import { RunnerMonster } from "./entities/monsters/runner-monster";
import { SplitterMonster } from "./entities/monsters/splitter-monster";
import { SquareMonster } from "./entities/monsters/square-monster";
import { TankMonster } from "./entities/monsters/tank-monster";
import { TriangleMonster } from "./entities/monsters/triangle-monster";
import type { PathEntry } from "./route-path";

const canvasElement = document.querySelector<HTMLCanvasElement>("#monster-slowmo");
if (!canvasElement) {
  throw new Error("Monster slow motion canvas is missing.");
}

const canvas = canvasElement;
const canvasContext = canvas.getContext("2d");
if (!canvasContext) {
  throw new Error("Monster slow motion canvas could not be initialized.");
}
const context = canvasContext;
const monsterNameTarget = document.querySelector<HTMLElement>("#monster-name");
const phaseNameTarget = document.querySelector<HTMLElement>("#phase-name");
const playbackToggleTarget = document.querySelector<HTMLButtonElement>("#playback-toggle");
const speedSliderTarget = document.querySelector<HTMLInputElement>("#speed-slider");
const speedValueTarget = document.querySelector<HTMLElement>("#speed-value");
if (!monsterNameTarget || !phaseNameTarget || !playbackToggleTarget || !speedSliderTarget || !speedValueTarget) {
  throw new Error("Monster slow motion controls are missing.");
}
const monsterNameElement = monsterNameTarget;
const phaseNameElement = phaseNameTarget;
const playbackToggleButton = playbackToggleTarget;
const speedSlider = speedSliderTarget;
const speedValueElement = speedValueTarget;

type MonsterConstructor = new (path: PathEntry[], speedScale: number) => Monster;
type MonsterBodyDrawable = Monster & {
  drawBody(context: CanvasRenderingContext2D): void;
};

interface MonsterSpec {
  label: string;
  MonsterClass: MonsterConstructor;
  zoom: number;
  approachDistance: number;
  initialRotation?: number;
  initialAngle?: number;
  lowHealthRatio?: number;
}

interface ActiveScene {
  spec: MonsterSpec;
  monster: Monster;
  particles: Particle[];
  phase: "approach" | "explode";
  phaseSeconds: number;
}

const CENTER = {
  x: EFFECT_FIELD_WIDTH / 2,
  y: EFFECT_FIELD_HEIGHT / 2,
};
const APPROACH_SECONDS = 3.15;
const EXPLOSION_SECONDS = 4.6;
const MONSTER_TIME_SCALE = 0.36;
const EXPLOSION_TIME_SCALE = 0.12;
const GRID_SPACING = 40;
const WORLD_STROKE_WIDTH = 1.5;
const MAX_DEVICE_PIXEL_RATIO = 2;
const DEFAULT_PLAYBACK_SPEED = 1;

const monsterSpecs: MonsterSpec[] = [
  { label: "Ball", MonsterClass: BallMonster, zoom: 10.5, approachDistance: 112, initialAngle: 0 },
  { label: "Square", MonsterClass: SquareMonster, zoom: 10.8, approachDistance: 112, initialRotation: Math.PI * 0.1 },
  { label: "Triangle", MonsterClass: TriangleMonster, zoom: 11.2, approachDistance: 110, initialAngle: 0 },
  { label: "Runner", MonsterClass: RunnerMonster, zoom: 12.2, approachDistance: 116, initialAngle: 0 },
  { label: "Splitter", MonsterClass: SplitterMonster, zoom: 9.9, approachDistance: 116, initialRotation: Math.PI * 0.08 },
  { label: "Tank", MonsterClass: TankMonster, zoom: 8.5, approachDistance: 120, initialAngle: 0 },
  { label: "Bulwark", MonsterClass: BulwarkMonster, zoom: 8.9, approachDistance: 118, initialAngle: 0 },
  { label: "Berserker", MonsterClass: BerserkerMonster, zoom: 9.8, approachDistance: 116, initialAngle: 0, lowHealthRatio: 0.18 },
];

let viewportWidth = 0;
let viewportHeight = 0;
let devicePixelRatio = 1;
let sceneIndex = 0;
let activeScene = createScene(sceneIndex);
let lastTimestamp = performance.now();
let isPaused = false;
let playbackSpeed = DEFAULT_PLAYBACK_SPEED;

speedSlider.value = String(DEFAULT_PLAYBACK_SPEED);
playbackToggleButton.addEventListener("click", togglePlayback);
speedSlider.addEventListener("input", updatePlaybackSpeed);
updateHudLabels();
updatePlaybackButton();
updateSpeedValue();
resizeCanvas();
window.addEventListener("resize", resizeCanvas);
requestAnimationFrame(animate);

function animate(timestamp: number): void {
  const deltaSeconds = Math.min(0.05, (timestamp - lastTimestamp) / 1000);
  lastTimestamp = timestamp;
  if (!isPaused) {
    updateScene(deltaSeconds * playbackSpeed);
  }
  drawScene();
  requestAnimationFrame(animate);
}

function updateScene(deltaSeconds: number): void {
  activeScene.phaseSeconds += deltaSeconds;

  if (activeScene.phase === "approach") {
    updateMonsterApproach(activeScene, deltaSeconds);
    if (activeScene.phaseSeconds >= APPROACH_SECONDS) {
      startExplosion(activeScene);
    }
    return;
  }

  if (activeScene.phase === "explode") {
    updateParticles(activeScene.particles, deltaSeconds * EXPLOSION_TIME_SCALE);
    if (activeScene.phaseSeconds >= EXPLOSION_SECONDS) {
      advanceToNextMonster();
    }
  }
}

function updateMonsterApproach(scene: ActiveScene, deltaSeconds: number): void {
  scene.monster.update(deltaSeconds * MONSTER_TIME_SCALE);

  const ratio = Math.min(1, scene.phaseSeconds / APPROACH_SECONDS);
  const easedRatio = easeOutCubic(ratio);
  const startX = CENTER.x - scene.spec.approachDistance;
  scene.monster.x = startX + (scene.spec.approachDistance * easedRatio);
  scene.monster.y = CENTER.y;
  scene.monster.distanceAlongPath = scene.spec.approachDistance * easedRatio;
  scene.monster.targetIndex = 1;
  scene.monster.angle = scene.spec.initialAngle ?? 0;
  scene.monster.velocityXPerSecond = Math.cos(scene.monster.angle) * scene.monster.speedPerSecond;
  scene.monster.velocityYPerSecond = Math.sin(scene.monster.angle) * scene.monster.speedPerSecond;
}

function startExplosion(scene: ActiveScene): void {
  scene.monster.x = CENTER.x;
  scene.monster.y = CENTER.y;
  scene.monster.angle = scene.spec.initialAngle ?? 0;
  scene.particles = scene.monster.createDeathEffect().particles;
  scene.phase = "explode";
  scene.phaseSeconds = 0;
  updatePhaseName();
}

function advanceToNextMonster(): void {
  sceneIndex = (sceneIndex + 1) % monsterSpecs.length;
  activeScene = createScene(sceneIndex);
  updateHudLabels();
}

function updateParticles(particles: Particle[], deltaSeconds: number): void {
  for (const particle of particles) {
    if (!particle.removed) {
      particle.update(deltaSeconds);
    }
  }
}

function drawScene(): void {
  context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  context.clearRect(0, 0, viewportWidth, viewportHeight);
  drawBackdrop();

  context.save();
  context.translate(viewportWidth / 2, viewportHeight / 2);
  context.scale(activeScene.spec.zoom, activeScene.spec.zoom);
  context.translate(-CENTER.x, -CENTER.y);

  if (activeScene.phase === "approach") {
    drawMonsterBody(activeScene.monster);
  } else {
    for (const particle of activeScene.particles) {
      if (!particle.removed) {
        particle.draw(context);
      }
    }
  }
  context.restore();

  drawOverlay();
}

function drawBackdrop(): void {
  const centerX = viewportWidth / 2;
  const centerY = viewportHeight / 2;
  const glow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(viewportWidth, viewportHeight) * 0.58);
  glow.addColorStop(0, "rgba(22, 255, 202, 0.12)");
  glow.addColorStop(0.35, "rgba(7, 29, 25, 0.44)");
  glow.addColorStop(1, "rgba(1, 5, 4, 1)");
  context.fillStyle = glow;
  context.fillRect(0, 0, viewportWidth, viewportHeight);

  context.strokeStyle = "rgba(193, 255, 237, 0.055)";
  context.lineWidth = 1;
  for (let x = 0; x < viewportWidth + GRID_SPACING; x += GRID_SPACING) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, viewportHeight);
    context.stroke();
  }
  for (let y = 0; y < viewportHeight + GRID_SPACING; y += GRID_SPACING) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(viewportWidth, y);
    context.stroke();
  }
}

function drawMonsterBody(monster: Monster): void {
  const body = monster as MonsterBodyDrawable;
  context.save();
  context.translate(monster.x, monster.y);
  context.strokeStyle = monster.color;
  context.fillStyle = "#050908";
  context.lineWidth = WORLD_STROKE_WIDTH;
  body.drawBody(context);
  context.restore();
}

function drawOverlay(): void {
  const margin = 32;
  const progress = activeScene.phase === "approach"
    ? activeScene.phaseSeconds / APPROACH_SECONDS
    : activeScene.phaseSeconds / EXPLOSION_SECONDS;
  const barWidth = Math.min(340, viewportWidth * 0.28);
  const barHeight = 4;
  const barY = margin + 22;

  context.fillStyle = "rgba(232, 255, 248, 0.34)";
  context.fillRect(margin, barY, barWidth, barHeight);
  context.fillStyle = activeScene.phase === "approach" ? "rgba(93, 242, 239, 0.82)" : "rgba(255, 228, 148, 0.86)";
  context.fillRect(margin, barY, barWidth * Math.min(1, progress), barHeight);
}

function createScene(index: number): ActiveScene {
  const spec = monsterSpecs[index];
  const monster = createMonster(spec);
  return {
    spec,
    monster,
    particles: [],
    phase: "approach",
    phaseSeconds: 0,
  };
}

function createMonster(spec: MonsterSpec): Monster {
  const path = createPath(spec);
  const monster = new spec.MonsterClass(path, 1);
  const displaySpeedPerSecond = spec.approachDistance / (APPROACH_SECONDS * MONSTER_TIME_SCALE);
  monster.speedPerSecond = displaySpeedPerSecond;
  monster.maxSpeedPerSecond = displaySpeedPerSecond;
  monster.x = path[0].x;
  monster.y = path[0].y;
  monster.angle = spec.initialAngle ?? 0;
  monster.velocityXPerSecond = Math.cos(monster.angle) * monster.speedPerSecond;
  monster.velocityYPerSecond = Math.sin(monster.angle) * monster.speedPerSecond;

  if (spec.initialRotation !== undefined) {
    monster.rotation = spec.initialRotation;
  }
  if (spec.lowHealthRatio !== undefined) {
    monster.hitPoints = monster.maxHitPoints * spec.lowHealthRatio;
    monster.update(0);
    monster.speedPerSecond = displaySpeedPerSecond;
    monster.maxSpeedPerSecond = displaySpeedPerSecond;
  }

  return monster;
}

function createPath(spec: MonsterSpec): PathEntry[] {
  return [
    {
      x: CENTER.x - spec.approachDistance,
      y: CENTER.y,
      totalDistance: 0,
    },
    {
      x: CENTER.x,
      y: CENTER.y,
      totalDistance: spec.approachDistance,
    },
  ];
}

function resizeCanvas(): void {
  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;
  devicePixelRatio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
  canvas.width = Math.floor(viewportWidth * devicePixelRatio);
  canvas.height = Math.floor(viewportHeight * devicePixelRatio);
}

function updateHudLabels(): void {
  monsterNameElement.textContent = activeScene.spec.label;
  updatePhaseName();
}

function updatePhaseName(): void {
  phaseNameElement.textContent = activeScene.phase === "approach" ? "approach" : "explosion";
}

function togglePlayback(): void {
  isPaused = !isPaused;
  updatePlaybackButton();
}

function updatePlaybackButton(): void {
  playbackToggleButton.textContent = isPaused ? "Play" : "Pause";
}

function updatePlaybackSpeed(): void {
  playbackSpeed = Number(speedSlider.value);
  updateSpeedValue();
}

function updateSpeedValue(): void {
  speedValueElement.textContent = `${playbackSpeed.toFixed(1)}x`;
}

function easeOutCubic(value: number): number {
  return 1 - ((1 - value) ** 3);
}
