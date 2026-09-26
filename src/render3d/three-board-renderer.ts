import {
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  LinearSRGBColorSpace,
  NoToneMapping,
  Scene,
  Vector3,
  WebGPURenderer,
  type Material,
  type Object3D,
  type Texture,
} from "three/webgpu";
import type { BoardRenderer } from "../board-renderer";
import type { Game } from "../game-engine";
import type { LevelRuntime } from "../level-runtime";
import { createRouteMotionPath } from "../route-path";
import type { FieldBounds, Point } from "../types";
import { BoardScene } from "./board-scene";
import { CameraRig } from "./camera-rig";
import { EffectView } from "./effect-view";
import type { FrameContext } from "./frame-math";
import { FxSystem } from "./fx-system";
import { createMaterialSet, createMaterialUniforms, type MaterialSet, type MaterialUniforms } from "./materials";
import { MonsterView } from "./monster-view";
import { OverlayView } from "./overlay-view";
import { PlacementView } from "./placement-view";
import { PostProcessing } from "./post-processing";
import { createPuffAtlasTexture } from "./procedural-textures";
import { ProjectileView } from "./projectile-view";
import { RenderBatches } from "./render-batches";
import { ResolutionGovernor, selectRenderQuality, type RenderQuality } from "./render-quality";
import { TowerView } from "./tower-view";

const CAMERA_FOV_DEGREES = 24;
const CAMERA_PITCH_RADIANS = 0.25;
const CAMERA_MARGIN = 0.006;
const MAX_FRAME_DELTA_SECONDS = 0.1;

interface BackendResources {
  device?: { destroy(): void; queue: { onSubmittedWorkDone(): Promise<void> } };
  gl?: WebGL2RenderingContext;
}

/** Milliseconds spent in each startup phase, for diagnosing slow devices. */
export interface StartupTimings {
  deviceMs: number;
  setupMs: number;
  sceneCompileMs: number;
  warmupFrameMs: number;
  gpuDrainMs: number;
  totalMs: number;
  nodeBuilds: number;
  pipelines: number;
  pipelinesBeforeWarmup: number;
}

interface RendererCacheInternals {
  _nodes?: { nodeBuilderCache?: Map<unknown, unknown> };
  _pipelines?: { caches?: Map<unknown, unknown> };
}

/** Waits until the GPU has finished every submitted command (including pipeline builds). */
async function drainGpu(renderer: WebGPURenderer): Promise<void> {
  const backend = renderer.backend as unknown as BackendResources;
  if (backend.device) {
    await backend.device.queue.onSubmittedWorkDone();
  } else {
    backend.gl?.finish();
  }
}

/** three.js leaves the GPU device/context alive on dispose; release it so remounts never pile up. */
function releaseGraphicsDevice(renderer: WebGPURenderer): void {
  const backend = renderer.backend as unknown as BackendResources;
  backend.device?.destroy();
  backend.gl?.getExtension("WEBGL_lose_context")?.loseContext();
}

/**
 * WebGPU (with automatic WebGL2 fallback) board renderer. It never mutates the
 * simulation: every frame it reads `Game.runtime` and refills instanced batches.
 */
class ThreeBoardRenderer implements BoardRenderer {
  private readonly renderer: WebGPURenderer;
  private readonly scene = new Scene();
  private readonly content = new Group();
  private readonly rig: CameraRig;
  private readonly quality: RenderQuality;
  private readonly governor: ResolutionGovernor;
  private readonly overlay: OverlayView;
  private readonly viewDirection = new Vector3(0, -1, 0);
  private readonly sun = new DirectionalLight("#e4fff4", 2.7);
  private uniforms!: MaterialUniforms;
  private materials!: MaterialSet;
  private puffTexture?: Texture;
  private batches!: RenderBatches;
  private board!: BoardScene;
  private fx!: FxSystem;
  private towers!: TowerView;
  private monsters!: MonsterView;
  private projectiles!: ProjectileView;
  private effects!: EffectView;
  private placement!: PlacementView;
  private post!: PostProcessing;
  private ready = false;
  private disposed = false;
  private activeRuntime?: LevelRuntime;
  private lastSimulationSeconds = 0;
  private frameIndex = 0;
  startupTimings: StartupTimings | null = null;
  // Dev-only `?shaderSalt=N` defeats GPU shader caches so benchmarks can measure first-visit compiles.
  private readonly shaderSalt = import.meta.env.DEV ? Number(new URLSearchParams(window.location.search).get("shaderSalt") ?? 0) : 0;
  private width = 1;
  private height = 1;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    overlayCanvas: HTMLCanvasElement,
    private readonly game: Game,
    onDeviceLost: () => void,
  ) {
    this.quality = selectRenderQuality(game.profile);
    this.governor = new ResolutionGovernor(this.quality, window.devicePixelRatio || 1);
    // three.js falls back to its WebGL2 backend automatically; `?backend=webgl2` forces it for testing.
    const forceWebGL = new URLSearchParams(window.location.search).get("backend") === "webgl2";
    this.renderer = new WebGPURenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance", forceWebGL });
    this.renderer.onDeviceLost = () => {
      if (this.disposed) {
        return;
      }
      this.ready = false;
      onDeviceLost();
    };
    this.rig = new CameraRig({
      fieldWidth: game.profile.fieldWidth,
      fieldHeight: game.profile.fieldHeight,
      verticalFovDegrees: CAMERA_FOV_DEGREES,
      pitchRadians: CAMERA_PITCH_RADIANS,
      margin: CAMERA_MARGIN,
    });
    this.overlay = new OverlayView(overlayCanvas, this.rig, game);
  }

  async initialize(): Promise<void> {
    const startedAt = performance.now();
    await this.renderer.init();
    const deviceReadyAt = performance.now();
    const { profile } = this.game;
    // The post chain tone-maps and sRGB-encodes itself; with neutral renderer output three
    // draws straight to the canvas instead of adding its own full-screen output pass.
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.outputColorSpace = LinearSRGBColorSpace;

    this.uniforms = createMaterialUniforms(profile.fieldWidth, profile.fieldHeight, profile.roadWidth + 3);
    this.puffTexture = createPuffAtlasTexture();
    this.materials = createMaterialSet(this.uniforms, this.puffTexture, this.shaderSalt);
    this.batches = new RenderBatches(this.materials, profile.roadWidth, {
      glowSprites: this.quality.glowSprites,
      smokeSprites: this.quality.smokeSprites,
      ribbons: this.quality.ribbons,
    });
    this.board = new BoardScene(profile.fieldWidth, profile.fieldHeight, profile.roadWidth, this.materials.ground, this.materials.road);
    this.fx = new FxSystem(this.scene, this.rig, { particles: this.quality.fxParticles, lights: this.quality.flashLights });
    this.towers = new TowerView(this.fx);
    this.monsters = new MonsterView(this.fx);
    this.projectiles = new ProjectileView(this.monsters);
    this.effects = new EffectView(this.fx, this.monsters, this.projectiles);
    this.placement = new PlacementView(this.game, this.towers);

    this.buildScene();
    this.buildPipeline();
    this.resize();
    const setupDoneAt = performance.now();
    const phases = await this.precompile();
    const internals = this.renderer as unknown as RendererCacheInternals;
    this.startupTimings = {
      deviceMs: deviceReadyAt - startedAt,
      setupMs: setupDoneAt - deviceReadyAt,
      sceneCompileMs: phases.sceneCompileMs,
      warmupFrameMs: phases.warmupFrameMs,
      gpuDrainMs: phases.gpuDrainMs,
      totalMs: performance.now() - startedAt,
      nodeBuilds: internals._nodes?.nodeBuilderCache?.size ?? -1,
      pipelines: internals._pipelines?.caches?.size ?? -1,
      pipelinesBeforeWarmup: phases.pipelinesBeforeWarmup,
    };
    this.ready = !this.disposed;
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, Math.round(rect.width));
    this.height = Math.max(1, Math.round(rect.height));
    const devicePixelRatio = window.devicePixelRatio || 1;
    this.governor.updateViewport(this.width, this.height, devicePixelRatio);
    this.renderer.setPixelRatio(this.governor.currentPixelRatio);
    this.renderer.setSize(this.width, this.height, false);
    this.post?.resize();
    this.rig.resize(this.width, this.height);
    this.rig.logicalCamera.getWorldDirection(this.viewDirection);
    this.overlay.resize(this.width, this.height, devicePixelRatio);
  }

  renderBackgroundLayer(): void {
    // Board geometry follows the runtime's route on the next draw.
  }

  draw(): void {
    if (!this.ready) {
      return;
    }

    const now = performance.now();
    if (this.governor.recordFrame(now, this.game.needsAnimationFrame())) {
      this.renderer.setPixelRatio(this.governor.currentPixelRatio);
      this.post.resize();
    }

    const runtime = this.game.runtime;
    if (runtime !== this.activeRuntime) {
      this.switchRuntime(runtime);
    }

    const time = this.game.simulationSeconds;
    const deltaSeconds = Math.min(MAX_FRAME_DELTA_SECONDS, Math.max(0, time - this.lastSimulationSeconds));
    this.lastSimulationSeconds = time;
    this.uniforms.time.value = time;
    this.frameIndex += 1;
    const frame: FrameContext = {
      deltaSeconds,
      time,
      frame: this.frameIndex,
      viewDirection: this.viewDirection,
    };

    const batches = this.batches;
    this.board.notifyEscapes(runtime.escapesLeft);
    batches.begin();
    this.board.write(batches, frame);
    this.towers.write(runtime.towers, runtime.selectedTower, batches, frame);
    this.monsters.write(runtime, batches, frame);
    this.projectiles.write(runtime, batches, frame);
    this.effects.write(runtime, batches, frame);
    this.placement.write(batches, frame);
    this.fx.update(deltaSeconds);
    this.fx.write(batches);
    batches.finish();

    this.rig.update(deltaSeconds);
    this.renderFrame();
    this.overlay.draw();
  }

  private renderFrame(): void {
    this.post.render(this.scene, this.rig.renderCamera);
  }

  getVisibleFieldBounds(): FieldBounds {
    return this.rig.fieldBounds;
  }

  isPointInUpgradeButton(point: Point): boolean {
    return this.overlay.isPointInUpgradeButton(point);
  }

  isPointInLaserLockButton(point: Point): boolean {
    return this.overlay.isPointInLaserLockButton(point);
  }

  clientToField(clientX: number, clientY: number, surfaceRect: DOMRect): Point | null {
    return this.rig.clientToField(clientX, clientY, surfaceRect);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.ready = false;
    this.batches?.dispose();
    this.board?.dispose();
    this.post?.dispose();
    if (this.materials) {
      for (const material of [this.materials.neon, this.materials.ground, this.materials.road, this.materials.ribbon, this.materials.decal, this.materials.healthBar, this.materials.range, this.materials.groundGlow]) {
        material.dispose();
      }
    }
    this.puffTexture?.dispose();
    this.renderer.dispose();
    releaseGraphicsDevice(this.renderer);
  }

  private switchRuntime(runtime: LevelRuntime): void {
    this.activeRuntime = runtime;
    this.lastSimulationSeconds = this.game.simulationSeconds;
    this.towers.reset();
    this.monsters.reset(runtime);
    this.projectiles.reset();
    this.effects.reset();
    this.fx.clear();
    this.board.setRoute(runtime.routePath);
  }

  private buildScene(): void {
    const { fieldWidth, fieldHeight } = this.game.profile;
    const centerX = fieldWidth / 2;
    const centerZ = fieldHeight / 2;
    this.scene.background = new Color("#010403");
    this.scene.add(this.content);
    this.content.add(this.board.group);
    this.content.add(this.batches.group);

    this.scene.add(new HemisphereLight("#4fb39a", "#020504", 0.55));

    // Shadows are blob decals (RenderBatches.pushBlobShadow), so the key light needs no shadow map.
    const sun = this.sun;
    sun.position.set(centerX - 320, 820, centerZ - 430);
    sun.target.position.set(centerX, 0, centerZ);
    this.scene.add(sun, sun.target);

    const rim = new DirectionalLight("#39d8ff", 0.7);
    rim.position.set(centerX + 400, 260, centerZ + 520);
    rim.target.position.set(centerX, 0, centerZ);
    this.scene.add(rim, rim.target);
  }

  private buildPipeline(): void {
    this.post = new PostProcessing(this.renderer, this.quality.msaaSamples, this.quality.bloomResolution, this.shaderSalt);
  }

  /**
   * three's compileAsync awaits each object's GPU pipeline in turn, which serializes the
   * expensive driver compiles (notably Metal on Safari). One object per distinct material
   * compiles concurrently so unique pipelines build in parallel; a final pass over the whole
   * scene then only hits the shared caches.
   */
  private async compileScene(): Promise<void> {
    const renderer = this.renderer;
    const camera = this.rig.renderCamera;
    const representatives = new Map<Material, Object3D>();
    this.content.traverseVisible((object) => {
      const material = (object as Object3D & { material?: Material | Material[] }).material;
      if (material && !Array.isArray(material) && !representatives.has(material)) {
        representatives.set(material, object);
      }
    });

    // compileAsync captures the active render target synchronously, so target the scene
    // pass while the calls start, then restore it.
    const previousTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.post.sceneTarget);
    const distinctPipelines: Promise<unknown>[] = [...representatives.values()].map((object) => renderer.compileAsync(object, camera, this.scene));
    renderer.setRenderTarget(previousTarget);
    distinctPipelines.push(this.post.compileAsync());
    await Promise.all(distinctPipelines);
    if (this.disposed) {
      return;
    }

    renderer.setRenderTarget(this.post.sceneTarget);
    const remaining = renderer.compileAsync(this.scene, camera);
    renderer.setRenderTarget(previousTarget);
    await remaining;
  }

  /**
   * Builds every pipeline before the first visible frame: all batches draw one hidden
   * instance, every scene and post pipeline compiles asynchronously and in parallel, and a
   * warm-up frame (which should find everything cached) is drained before reporting ready.
   */
  private async precompile(): Promise<{ sceneCompileMs: number; warmupFrameMs: number; gpuDrainMs: number; pipelinesBeforeWarmup: number }> {
    this.batches.prepareForCompile();
    this.board.setRoute(createRouteMotionPath([{ x: -400, y: -400 }, { x: -300, y: -400 }], 24, 7));

    const start = performance.now();
    await this.compileScene();
    const sceneCompiled = performance.now();
    const pipelinesBeforeWarmup = (this.renderer as unknown as RendererCacheInternals)._pipelines?.caches?.size ?? -1;
    if (!this.disposed) {
      this.renderFrame();
    }
    const warmupRendered = performance.now();
    if (!this.disposed) {
      await drainGpu(this.renderer);
    }
    const gpuDrained = performance.now();

    this.board.setRoute(undefined);
    this.batches.begin();
    this.batches.finish();
    return {
      sceneCompileMs: sceneCompiled - start,
      warmupFrameMs: warmupRendered - sceneCompiled,
      gpuDrainMs: gpuDrained - warmupRendered,
      pipelinesBeforeWarmup,
    };
  }
}

export async function createThreeBoardRenderer(
  canvas: HTMLCanvasElement,
  overlayCanvas: HTMLCanvasElement,
  game: Game,
  onDeviceLost: () => void,
): Promise<{ renderer: BoardRenderer; startupTimings: StartupTimings | null }> {
  const renderer = new ThreeBoardRenderer(canvas, overlayCanvas, game, onDeviceLost);
  try {
    await renderer.initialize();
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  return { renderer, startupTimings: renderer.startupTimings };
}
