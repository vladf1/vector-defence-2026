import type { Particle } from "./entities/effects/particle";
import { PackManMonster } from "./entities/monsters/packman-monster";
import { BerserkerMonster } from "./entities/monsters/berserker-monster";
import { BulwarkMonster } from "./entities/monsters/bulwark-monster";
import { Monster } from "./entities/monsters/monster";
import { RunnerMonster } from "./entities/monsters/runner-monster";
import { SplitterMonster } from "./entities/monsters/splitter-monster";
import { SquareMonster } from "./entities/monsters/square-monster";
import { TankMonster } from "./entities/monsters/tank-monster";
import { TriangleMonster } from "./entities/monsters/triangle-monster";
import { Missile } from "./entities/projectiles/missile";
import { createMissileVisual } from "./entities/projectiles/missile-visuals";
import { LinearActiveCircleSweepCollisionIndex } from "./game-engine/collision-detection";
import { UpdateResult, type UpdateContext } from "./game-engine/update-context";
import type { PathEntry } from "./route-path";
import { startVisibilityAwareAnimationLoop } from "./visibility-animation-loop";

const EMPTY_MONSTER_COLLISION_INDEX = new LinearActiveCircleSweepCollisionIndex<Monster>([]);

const canvasElement = document.querySelector<HTMLCanvasElement>("#explosion-testing");
if (!canvasElement) {
  throw new Error("Monster explosion testing canvas is missing.");
}

const canvas = canvasElement;
const canvasContext = canvas.getContext("2d");
if (!canvasContext) {
  throw new Error("Monster explosion testing canvas could not be initialized.");
}
const context = canvasContext;
const monsterNameTarget = document.querySelector<HTMLElement>("#monster-name");
const phaseNameTarget = document.querySelector<HTMLElement>("#phase-name");
const monsterModeTarget = document.querySelector<HTMLButtonElement>("#monster-mode");
const missileModeTarget = document.querySelector<HTMLButtonElement>("#missile-mode");
const combinedModeTarget = document.querySelector<HTMLButtonElement>("#combined-mode");
const playbackToggleTarget = document.querySelector<HTMLButtonElement>("#playback-toggle");
const nextMonsterTarget = document.querySelector<HTMLButtonElement>("#next-monster");
const repeatMonsterTarget = document.querySelector<HTMLButtonElement>("#repeat-monster");
const approachSpeedSliderTarget = document.querySelector<HTMLInputElement>("#approach-speed-slider");
const approachSpeedValueTarget = document.querySelector<HTMLElement>("#approach-speed-value");
const explosionSpeedSliderTarget = document.querySelector<HTMLInputElement>("#explosion-speed-slider");
const explosionSpeedValueTarget = document.querySelector<HTMLElement>("#explosion-speed-value");
const zoomSliderTarget = document.querySelector<HTMLInputElement>("#zoom-slider");
const zoomValueTarget = document.querySelector<HTMLElement>("#zoom-value");
if (
  !monsterNameTarget ||
  !phaseNameTarget ||
  !monsterModeTarget ||
  !missileModeTarget ||
  !combinedModeTarget ||
  !playbackToggleTarget ||
  !nextMonsterTarget ||
  !repeatMonsterTarget ||
  !approachSpeedSliderTarget ||
  !approachSpeedValueTarget ||
  !explosionSpeedSliderTarget ||
  !explosionSpeedValueTarget ||
  !zoomSliderTarget ||
  !zoomValueTarget
) {
  throw new Error("Monster explosion testing controls are missing.");
}
const monsterNameElement = monsterNameTarget;
const phaseNameElement = phaseNameTarget;
const monsterModeButton = monsterModeTarget;
const missileModeButton = missileModeTarget;
const combinedModeButton = combinedModeTarget;
const playbackToggleButton = playbackToggleTarget;
const nextMonsterButton = nextMonsterTarget;
const repeatMonsterButton = repeatMonsterTarget;
const approachSpeedSlider = approachSpeedSliderTarget;
const approachSpeedValueElement = approachSpeedValueTarget;
const explosionSpeedSlider = explosionSpeedSliderTarget;
const explosionSpeedValueElement = explosionSpeedValueTarget;
const zoomSlider = zoomSliderTarget;
const zoomValueElement = zoomValueTarget;

type MonsterConstructor = new (path: PathEntry[], speedScale: number) => Monster;
type MonsterBodyDrawable = Monster & {
  drawBody(context: CanvasRenderingContext2D): void;
};
type LabMode = "monster" | "missile" | "combined";

const EFFECT_FIELD_WIDTH = 800;
const EFFECT_FIELD_HEIGHT = 560;

interface MonsterSpec {
  label: string;
  MonsterClass: MonsterConstructor;
  approachDistance: number;
  initialRotation?: number;
  initialAngle?: number;
  lowHealthRatio?: number;
}

interface ActiveScene {
  mode: LabMode;
  spec: MonsterSpec;
  monster: Monster;
  missile?: Missile;
  particles: Particle[];
  phase: "approach" | "explode";
  phaseSeconds: number;
}

const CENTER = {
  x: EFFECT_FIELD_WIDTH / 2,
  y: EFFECT_FIELD_HEIGHT / 2,
};
const APPROACH_SECONDS = 3.15;
const EXPLOSION_SECONDS = 5.6;
const MIN_EXPLOSION_SECONDS = 4;
const MONSTER_TIME_SCALE = 0.36;
const MISSILE_TIME_SCALE = 0.22;
const EXPLOSION_TIME_SCALE = 0.12;
const GRID_SPACING = 40;
const WORLD_STROKE_WIDTH = 1.5;
const MAX_DEVICE_PIXEL_RATIO = 2;
const DEFAULT_SPEED = 1;
const MONSTER_WORLD_ZOOM = 10;
const MISSILE_WORLD_ZOOM = 4;
const DEFAULT_ZOOM_SCALE = 1;
const MISSILE_LABEL = "Missile";
const COMBINED_LABEL = "Missile + Monster";
const MISSILE_APPROACH_DISTANCE = 88;
const MISSILE_SOURCE_OFFSET = 10;
const MISSILE_PREVIEW_LEVEL = 0;
const COMBINED_TARGET_HIT_POINTS = 1;

const monsterSpecs: MonsterSpec[] = [
  { label: "PackMan", MonsterClass: PackManMonster, approachDistance: 112, initialAngle: 0 },
  { label: "Square", MonsterClass: SquareMonster, approachDistance: 112, initialRotation: Math.PI * 0.1 },
  { label: "Triangle", MonsterClass: TriangleMonster, approachDistance: 110, initialAngle: 0 },
  { label: "Runner", MonsterClass: RunnerMonster, approachDistance: 116, initialAngle: 0 },
  { label: "Splitter", MonsterClass: SplitterMonster, approachDistance: 116, initialRotation: Math.PI * 0.08 },
  { label: "Tank", MonsterClass: TankMonster, approachDistance: 120, initialAngle: 0 },
  { label: "Bulwark", MonsterClass: BulwarkMonster, approachDistance: 118, initialAngle: 0 },
  { label: "Berserker", MonsterClass: BerserkerMonster, approachDistance: 116, initialAngle: 0, lowHealthRatio: 0.18 },
];

let viewportWidth = 0;
let viewportHeight = 0;
let devicePixelRatio = 1;
let labMode: LabMode = "monster";
let sceneIndex = 0;
let activeScene = createScene(sceneIndex);
let isPaused = false;
let approachSpeed = DEFAULT_SPEED;
let explosionSpeed = DEFAULT_SPEED;
let zoomScale = DEFAULT_ZOOM_SCALE;

approachSpeedSlider.value = String(DEFAULT_SPEED);
explosionSpeedSlider.value = String(DEFAULT_SPEED);
zoomSlider.value = String(DEFAULT_ZOOM_SCALE);
monsterModeButton.addEventListener("click", () => switchMode("monster"));
missileModeButton.addEventListener("click", () => switchMode("missile"));
combinedModeButton.addEventListener("click", () => switchMode("combined"));
playbackToggleButton.addEventListener("click", togglePlayback);
nextMonsterButton.addEventListener("click", advanceToNextMonster);
repeatMonsterButton.addEventListener("click", repeatCurrentMonster);
approachSpeedSlider.addEventListener("input", updateApproachSpeed);
explosionSpeedSlider.addEventListener("input", updateExplosionSpeed);
zoomSlider.addEventListener("input", updateZoomScale);
updateHudLabels();
updatePlaybackButton();
updateSpeedValues();
updateZoomValue();
resizeCanvas();
window.addEventListener("resize", resizeCanvas);
startVisibilityAwareAnimationLoop((deltaSeconds) => {
  if (!isPaused) {
    updateScene(deltaSeconds * getActivePhaseSpeed());
  }
  drawScene();
});

function updateScene(deltaSeconds: number): void {
  activeScene.phaseSeconds += deltaSeconds;

  if (activeScene.phase === "approach") {
    if (activeScene.mode === "monster") {
      updateMonsterApproach(activeScene, deltaSeconds);
    } else {
      updateMissileApproach(activeScene, deltaSeconds);
    }
    updateParticles(activeScene.particles, deltaSeconds, EFFECT_FIELD_WIDTH, EFFECT_FIELD_HEIGHT);
    if (activeScene.phaseSeconds >= APPROACH_SECONDS) {
      startExplosion(activeScene);
    }
    return;
  }

  if (activeScene.phase === "explode") {
    updateParticles(activeScene.particles, deltaSeconds, EFFECT_FIELD_WIDTH, EFFECT_FIELD_HEIGHT, true);
    updateParticles(activeScene.particles, deltaSeconds * EXPLOSION_TIME_SCALE, EFFECT_FIELD_WIDTH, EFFECT_FIELD_HEIGHT, false);
    if (
      (activeScene.phaseSeconds >= MIN_EXPLOSION_SECONDS && allParticlesOffScreen(activeScene.particles))
      || activeScene.phaseSeconds >= EXPLOSION_SECONDS
    ) {
      advanceToNextMonster();
    }
  }
}

function updateMonsterApproach(scene: ActiveScene, deltaSeconds: number): void {
  const result = new UpdateResult();
  if (!(scene.monster instanceof TankMonster)) {
    scene.monster.update(createPreviewUpdateContext(scene.monster, deltaSeconds * MONSTER_TIME_SCALE), result);
    applyPreviewUpdateResult(scene, result);
  }

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

  if (scene.monster instanceof TankMonster) {
    scene.monster.update(createPreviewUpdateContext(scene.monster, 0), result);
    applyPreviewUpdateResult(scene, result);
  }
}

function updateMissileApproach(scene: ActiveScene, deltaSeconds: number): void {
  const missile = scene.missile;
  if (!missile) {
    return;
  }

  const particleCountBeforeUpdate = scene.particles.length;
  const result = new UpdateResult();
  missile.update(createPreviewUpdateContext(scene.monster, deltaSeconds * MISSILE_TIME_SCALE), result);
  applyPreviewUpdateResult(scene, result);
  scene.monster.x = CENTER.x;
  scene.monster.y = CENTER.y;
  scene.monster.angle = scene.spec.initialAngle ?? 0;
  scene.monster.velocityXPerSecond = 0;
  scene.monster.velocityYPerSecond = 0;

  if (missile.removed) {
    scene.particles = scene.particles.slice(particleCountBeforeUpdate);
    if (scene.mode === "combined") {
      const result = new UpdateResult();
      scene.monster.update(createPreviewUpdateContext(scene.monster, 0), result);
      addMonsterDeathEffect(scene.monster, scene);
    }
    scene.phase = "explode";
    scene.phaseSeconds = 0;
    updatePhaseName();
  }
}

function startExplosion(scene: ActiveScene): void {
  if (scene.mode === "missile") {
    scene.phase = "explode";
    scene.phaseSeconds = 0;
    updatePhaseName();
    return;
  }

  scene.monster.x = CENTER.x;
  scene.monster.y = CENTER.y;
  scene.monster.angle = scene.spec.initialAngle ?? 0;
  addMonsterDeathEffect(scene.monster, scene);
  scene.phase = "explode";
  scene.phaseSeconds = 0;
  updatePhaseName();
}

function advanceToNextMonster(): void {
  sceneIndex = (sceneIndex + 1) % monsterSpecs.length;
  activeScene = createScene(sceneIndex);
  updateHudLabels();
}

function repeatCurrentMonster(): void {
  activeScene = createScene(sceneIndex);
  updateHudLabels();
}

function updateParticles(particles: Particle[], deltaSeconds: number, fieldWidth: number, fieldHeight: number, drawsUnderEntities?: boolean): void {
  const context: UpdateContext = {
    deltaSeconds,
    fieldWidth,
    fieldHeight,
    activeMonsters: [],
    monsterCollisionIndex: EMPTY_MONSTER_COLLISION_INDEX,
    activeDrones: [],
    droneAssignments: new Map(),
  };
  for (const particle of particles) {
    if (!particle.removed && (drawsUnderEntities === undefined || particle.drawsUnderEntities === drawsUnderEntities)) {
      particle.update(context);
    }
  }
}

function allParticlesOffScreen(particles: Particle[]): boolean {
  if (particles.length === 0) {
    return false;
  }

  const bounds = getVisibleWorldBounds();
  return particles.every((particle) => particle.removed || !isParticleVisible(particle, bounds));
}

function getVisibleWorldBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
  const sceneZoom = getSceneZoom();
  const halfWidth = viewportWidth / (sceneZoom * 2);
  const halfHeight = viewportHeight / (sceneZoom * 2);
  return {
    minX: CENTER.x - halfWidth,
    minY: CENTER.y - halfHeight,
    maxX: CENTER.x + halfWidth,
    maxY: CENTER.y + halfHeight,
  };
}

function isParticleVisible(
  particle: Particle,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return particle.x + particle.size >= bounds.minX
    && particle.x - particle.size <= bounds.maxX
    && particle.y + particle.size >= bounds.minY
    && particle.y - particle.size <= bounds.maxY;
}

function drawScene(): void {
  context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  context.clearRect(0, 0, viewportWidth, viewportHeight);
  drawBackdrop();

  context.save();
  context.translate(viewportWidth / 2, viewportHeight / 2);
  const sceneZoom = getSceneZoom();
  context.scale(sceneZoom, sceneZoom);
  context.translate(-CENTER.x, -CENTER.y);

  if (activeScene.phase === "approach") {
    drawParticles(activeScene.particles, true);
    drawMonsterBody(activeScene.monster);
    if (activeScene.missile) {
      activeScene.missile.draw(context);
    }
    drawParticles(activeScene.particles, false);
  } else {
    drawParticles(activeScene.particles, true);
    drawParticles(activeScene.particles, false);
  }
  context.restore();

  drawOverlay();
}

function drawParticles(particles: Particle[], drawsUnderEntities?: boolean): void {
  for (const particle of particles) {
    if (!particle.removed && (drawsUnderEntities === undefined || particle.drawsUnderEntities === drawsUnderEntities)) {
      particle.draw(context);
    }
  }
}

function drawBackdrop(): void {
  context.fillStyle = "#020807";
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
  const barY = margin + 29;

  context.fillStyle = "rgba(232, 255, 248, 0.34)";
  context.fillRect(margin, barY, barWidth, barHeight);
  context.fillStyle = activeScene.phase === "approach" ? "rgba(93, 242, 239, 0.82)" : "rgba(255, 228, 148, 0.86)";
  context.fillRect(margin, barY, barWidth * Math.min(1, progress), barHeight);

}

function createScene(index: number): ActiveScene {
  const spec = monsterSpecs[index];
  const monster = createMonster(spec);
  const particles: Particle[] = [];
  if (labMode === "combined") {
    prepareCombinedTarget(monster);
  }
  const missile = labMode === "missile" || labMode === "combined" ? createMissile(monster) : undefined;
  return {
    mode: labMode,
    spec,
    monster,
    missile,
    particles,
    phase: "approach",
    phaseSeconds: 0,
  };
}

function switchMode(mode: LabMode): void {
  if (labMode === mode) {
    return;
  }

  labMode = mode;
  activeScene = createScene(sceneIndex);
  updateHudLabels();
  updateModeButtons();
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
    const result = new UpdateResult();
    monster.update(createPreviewUpdateContext(monster, 0), result);
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

function createMissile(monster: Monster): Missile {
  const source = {
    x: CENTER.x - MISSILE_APPROACH_DISTANCE,
    y: CENTER.y - MISSILE_SOURCE_OFFSET,
  };
  monster.x = CENTER.x;
  monster.y = CENTER.y;
  monster.previousX = CENTER.x;
  monster.previousY = CENTER.y;
  monster.removed = false;
  return new Missile(
    source,
    monster,
    MISSILE_PREVIEW_LEVEL,
    createMissileVisual(MISSILE_PREVIEW_LEVEL),
    0,
  );
}

function prepareCombinedTarget(monster: Monster): void {
  monster.hitPoints = COMBINED_TARGET_HIT_POINTS;
}

function createPreviewUpdateContext(monster: Monster, deltaSeconds: number): UpdateContext {
  const activeMonsters = monster.removed ? [] : [monster];
  return {
    deltaSeconds,
    fieldWidth: EFFECT_FIELD_WIDTH,
    fieldHeight: EFFECT_FIELD_HEIGHT,
    activeMonsters,
    monsterCollisionIndex: new LinearActiveCircleSweepCollisionIndex(activeMonsters),
    activeDrones: [],
    droneAssignments: new Map(),
  };
}

function applyPreviewUpdateResult(scene: ActiveScene, result: UpdateResult): void {
  if (result.particles.length > 0) {
    scene.particles.push(...result.particles);
  }
}

function addMonsterDeathEffect(monster: Monster, scene: ActiveScene): void {
  const result = new UpdateResult();
  monster.addDeathEffect(result);
  applyPreviewUpdateResult(scene, result);
}

function resizeCanvas(): void {
  viewportWidth = window.innerWidth;
  viewportHeight = window.innerHeight;
  devicePixelRatio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
  canvas.width = Math.floor(viewportWidth * devicePixelRatio);
  canvas.height = Math.floor(viewportHeight * devicePixelRatio);
}

function updateHudLabels(): void {
  monsterNameElement.textContent = getSceneLabel(activeScene);
  updatePhaseName();
  updateModeButtons();
}

function updatePhaseName(): void {
  if (activeScene.phase === "approach") {
    phaseNameElement.textContent = activeScene.mode === "monster" ? "approach" : `impacting ${activeScene.spec.label}`;
    return;
  }
  if (activeScene.mode === "monster") {
    phaseNameElement.textContent = `explosion / ${activeScene.particles.length} shards`;
    return;
  }
  phaseNameElement.textContent = activeScene.mode === "missile"
    ? `impact / ${activeScene.particles.length} particles`
    : `combined / ${activeScene.particles.length} particles`;
}

function updateModeButtons(): void {
  monsterModeButton.setAttribute("aria-pressed", labMode === "monster" ? "true" : "false");
  missileModeButton.setAttribute("aria-pressed", labMode === "missile" ? "true" : "false");
  combinedModeButton.setAttribute("aria-pressed", labMode === "combined" ? "true" : "false");
}

function getSceneLabel(scene: ActiveScene): string {
  if (scene.mode === "missile") {
    return MISSILE_LABEL;
  }
  if (scene.mode === "combined") {
    return COMBINED_LABEL;
  }
  return scene.spec.label;
}

function togglePlayback(): void {
  isPaused = !isPaused;
  updatePlaybackButton();
}

function updatePlaybackButton(): void {
  playbackToggleButton.textContent = isPaused ? "▶️" : "⏸️";
  playbackToggleButton.setAttribute("aria-label", isPaused ? "Play" : "Pause");
}

function updateApproachSpeed(): void {
  approachSpeed = Number(approachSpeedSlider.value);
  updateSpeedValues();
}

function updateExplosionSpeed(): void {
  explosionSpeed = Number(explosionSpeedSlider.value);
  updateSpeedValues();
}

function updateSpeedValues(): void {
  approachSpeedValueElement.textContent = `${approachSpeed.toFixed(1)}x`;
  explosionSpeedValueElement.textContent = `${explosionSpeed.toFixed(1)}x`;
}

function updateZoomScale(): void {
  zoomScale = Number(zoomSlider.value);
  updateZoomValue();
}

function updateZoomValue(): void {
  zoomValueElement.textContent = `${zoomScale.toFixed(1)}x`;
}

function getActivePhaseSpeed(): number {
  return activeScene.phase === "approach" ? approachSpeed : explosionSpeed;
}

function getSceneZoom(): number {
  const baseZoom = activeScene.mode === "monster" ? MONSTER_WORLD_ZOOM : MISSILE_WORLD_ZOOM;
  return baseZoom * zoomScale;
}

function easeOutCubic(value: number): number {
  return 1 - ((1 - value) ** 3);
}
