import { AudioCue } from "./audio-manifest";
import { findTowerShortcut } from "./entities/towers/tower-registry";
import { createBrowserCampaignProgressStore } from "./campaign-progress";
import { type GameProfile } from "./game-profile";
import { GameAudio } from "./game-audio";
import type { BoardRenderer } from "./board-renderer";
import { runBoundedSimulationSubsteps } from "./simulation-timing";
import { RendererStatus } from "./renderer-status";
import {
  Game,
  createLevels,
} from "./game-engine";
import {
  INITIAL_HUD_SNAPSHOT,
  INITIAL_RUNTIME_HUD_STATS,
  createHudSnapshot,
  createModalView,
  performModalAction,
  type RuntimeHudStats,
} from "./game-view";
import { type ModalAction, type ModalView, type Point, type TowerKind } from "./types";
import { readonly, writable } from "svelte/store";

const NERD_STATS_SAMPLE_MS = 500;
const TOWER_DRAG_THRESHOLD_PX = 6;
const KEYBOARD_INPUT_SELECTOR = "input, select, textarea";
const KEYBOARD_ACTIVATION_SELECTOR = "a[href], button, summary, [role='button'], [role='link']";

interface CanvasGeometry {
  rect: DOMRect;
}

export interface BoardSurface {
  canvas: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
}

function eventPathMatches(event: KeyboardEvent, selector: string): boolean {
  return event.composedPath().some((target) => target instanceof HTMLElement && target.matches(selector));
}

function shouldIgnoreGameShortcut(event: KeyboardEvent): boolean {
  if (
    event.defaultPrevented
    || event.repeat
    || event.isComposing
    || event.altKey
    || event.ctrlKey
    || event.metaKey
    || event.shiftKey
  ) {
    return true;
  }

  const path = event.composedPath();
  const isTextEntry = eventPathMatches(event, KEYBOARD_INPUT_SELECTOR)
    || path.some((target) => target instanceof HTMLElement && target.isContentEditable);
  if (isTextEntry) {
    return true;
  }

  const isNativeActivationKey = event.code === "Space" || event.key === "Enter";
  return isNativeActivationKey && eventPathMatches(event, KEYBOARD_ACTIVATION_SELECTOR);
}

export function createGameSession(profile: GameProfile) {
  const hudStore = writable(INITIAL_HUD_SNAPSHOT);
  const modalStore = writable<ModalView | null>(null);
  const soundEnabledStore = writable(true);
  const rendererStatusStore = writable<RendererStatus>(RendererStatus.Loading);
  const startupTimingsStore = writable<Record<string, number> | null>(null);
  const audio = new GameAudio(profile.fieldWidth);
  const progressStore = createBrowserCampaignProgressStore(window);
  let canvas: HTMLCanvasElement | null = null;
  let game: Game | null = null;
  let mountToken = 0;
  let boardReady = false;
  let windowListenersAttached = false;
  let soundEnabled = true;
  let frameId = 0;
  let previousFrameTime = 0;
  let pendingSimulationSeconds = 0;
  let runtimeStats: RuntimeHudStats = { ...INITIAL_RUNTIME_HUD_STATS };
  let sampledFrameCount = 0;
  let sampledFrameDurationMs = 0;
  let sampledUpdateDurationMs = 0;
  let sampledDrawDurationMs = 0;
  let lastNerdStatsSampleTime = 0;
  let nerdStatsEnabled = false;
  let canvasResizeObserver: ResizeObserver | null = null;
  let canvasGeometry: CanvasGeometry | null = null;
  let towerDrag:
    | {
      kind: TowerKind;
      pointerId: number;
      startClientX: number;
      startClientY: number;
      active: boolean;
    }
    | null = null;

  function resetFrameClock(): void {
    previousFrameTime = 0;
    pendingSimulationSeconds = 0;
  }

  function handleVisibilityChange(): void {
    resetFrameClock();
  }

  function requestGameFrame(): void {
    if (!game?.needsAnimationFrame() || frameId !== 0) {
      return;
    }

    resetFrameClock();
    frameId = window.requestAnimationFrame(frame);
  }

  function syncAnimationLoop(): void {
    if (game?.needsAnimationFrame()) {
      requestGameFrame();
      return;
    }

    if (frameId !== 0) {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    }
    resetFrameClock();
    game?.draw();
  }

  const publish = (forceHud = false, forceModal = false): void => {
    if (!game) {
      return;
    }

    if (forceHud || game.hudDirty) {
      hudStore.set(createHudSnapshot(game, runtimeStats));
      game.hudDirty = false;
    }

    if (forceModal || game.modalDirty) {
      modalStore.set(createModalView(game));
      game.modalDirty = false;
    }
  };

  const withGame = (action: (currentGame: Game) => void, force = false): void => {
    if (!game) {
      return;
    }

    audio.unlock();
    action(game);
    publish(force, force);
    syncAnimationLoop();
  };

  const refreshCanvasGeometry = (): void => {
    if (!canvas) {
      canvasGeometry = null;
      return;
    }

    canvasGeometry = { rect: canvas.getBoundingClientRect() };
  };

  const toCanvasPoint = (event: PointerEvent): Point | null => {
    const geometry = canvasGeometry;
    if (!geometry || !game) {
      return null;
    }

    return game.renderer.clientToField(event.clientX, event.clientY, geometry.rect);
  };

  const isPointerInsideCanvas = (event: PointerEvent): boolean => {
    if (!canvasGeometry) {
      return false;
    }

    const { rect } = canvasGeometry;
    return event.clientX >= rect.left
      && event.clientX <= rect.right
      && event.clientY >= rect.top
      && event.clientY <= rect.bottom;
  };

  const resetNerdStatsSamples = (): void => {
    sampledFrameCount = 0;
    sampledFrameDurationMs = 0;
    sampledUpdateDurationMs = 0;
    sampledDrawDurationMs = 0;
    lastNerdStatsSampleTime = 0;
  };

  function frame(timestamp: number): void {
    frameId = 0;
    const activeGame = game;
    // Hold the simulation while no board is visible (async 3D load) so play never runs unseen;
    // attaching the renderer restarts the loop.
    if (!activeGame?.needsAnimationFrame() || !boardReady) {
      resetFrameClock();
      return;
    }

    const hasPreviousFrame = previousFrameTime !== 0;
    const elapsedSeconds = hasPreviousFrame ? (timestamp - previousFrameTime) / 1000 : 0;

    if (nerdStatsEnabled && hasPreviousFrame) {
      sampledFrameCount += 1;
      sampledFrameDurationMs += timestamp - previousFrameTime;

      if (lastNerdStatsSampleTime === 0) {
        lastNerdStatsSampleTime = timestamp;
      }
    }

    const updateStart = nerdStatsEnabled ? performance.now() : 0;
    if (!hasPreviousFrame) {
      activeGame.updateSimulation(0);
    } else {
      const substeps = runBoundedSimulationSubsteps(
        pendingSimulationSeconds + elapsedSeconds,
        (deltaSeconds) => {
          activeGame.updateSimulation(deltaSeconds);
          return activeGame.needsAnimationFrame();
        },
      );
      pendingSimulationSeconds = activeGame.needsAnimationFrame() ? substeps.remainingSeconds : 0;
    }
    const drawStart = nerdStatsEnabled ? performance.now() : 0;
    activeGame.draw();

    if (nerdStatsEnabled && hasPreviousFrame) {
      sampledUpdateDurationMs += drawStart - updateStart;
      sampledDrawDurationMs += performance.now() - drawStart;

      if (timestamp - lastNerdStatsSampleTime >= NERD_STATS_SAMPLE_MS && sampledFrameDurationMs > 0) {
        runtimeStats = {
          fps: (sampledFrameCount * 1000) / sampledFrameDurationMs,
          frameTimeMs: sampledFrameDurationMs / sampledFrameCount,
          updateTimeMs: sampledUpdateDurationMs / sampledFrameCount,
          drawTimeMs: sampledDrawDurationMs / sampledFrameCount,
        };
        sampledFrameCount = 0;
        sampledFrameDurationMs = 0;
        sampledUpdateDurationMs = 0;
        sampledDrawDurationMs = 0;
        lastNerdStatsSampleTime = timestamp;
        activeGame.requestHudSync();
      }
    }
    publish();
    previousFrameTime = timestamp;
    if (activeGame.needsAnimationFrame()) {
      frameId = window.requestAnimationFrame(frame);
    } else {
      resetFrameClock();
    }
  }

  const ensureGame = (): Game => {
    if (game) {
      return game;
    }

    game = new Game(createLevels(profile.mode), audio, profile, progressStore);
    if (import.meta.env.DEV) {
      // Dev-only handle for render/benchmark scripts: mutate the game, then call sync().
      (window as unknown as { __vectorDefence?: unknown }).__vectorDefence = {
        game,
        sync: () => withGame(() => {}, true),
      };
    }
    runtimeStats = { ...INITIAL_RUNTIME_HUD_STATS };
    resetNerdStatsSamples();
    publish(true, true);
    return game;
  };

  const attachWindowListeners = (): void => {
    if (windowListenersAttached) {
      return;
    }

    windowListenersAttached = true;
    window.addEventListener("resize", refreshCanvasGeometry);
    window.addEventListener("scroll", refreshCanvasGeometry, true);
    window.visualViewport?.addEventListener("resize", refreshCanvasGeometry);
    window.visualViewport?.addEventListener("scroll", refreshCanvasGeometry);
    document.addEventListener("visibilitychange", handleVisibilityChange);
  };

  const detachWindowListeners = (): void => {
    if (!windowListenersAttached) {
      return;
    }

    windowListenersAttached = false;
    window.removeEventListener("resize", refreshCanvasGeometry);
    window.removeEventListener("scroll", refreshCanvasGeometry, true);
    window.visualViewport?.removeEventListener("resize", refreshCanvasGeometry);
    window.visualViewport?.removeEventListener("scroll", refreshCanvasGeometry);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };

  const attachRenderer = (activeGame: Game, renderer: BoardRenderer): void => {
    activeGame.setRenderer(renderer);
    boardReady = true;
    refreshCanvasGeometry();
    activeGame.draw();
    rendererStatusStore.set(RendererStatus.Ready);
    publish(true, false);
    resetFrameClock();
    requestGameFrame();
  };

  const reportRendererFailure = (error: unknown): void => {
    console.error("WebGPU board renderer unavailable.", error);
    rendererStatusStore.set(RendererStatus.Failed);
  };

  const mountBoardRenderer = (activeGame: Game, surface: BoardSurface, token: number): void => {
    rendererStatusStore.set(RendererStatus.Loading);
    const importStartedAt = performance.now();
    let importMs = 0;
    void import("./render3d/webgpu-board-renderer")
      .then(({ createWebGpuBoardRenderer }) => {
        importMs = performance.now() - importStartedAt;
        return createWebGpuBoardRenderer(surface.canvas, surface.overlay, activeGame, () => {
          if (token === mountToken) {
            // A lost device (driver reset, GPU process crash) gets a fresh renderer.
            boardReady = false;
            activeGame.detachRenderer();
            mountBoardRenderer(activeGame, surface, token);
          }
        });
      })
      .then(({ renderer, startupTimings }) => {
        if (token !== mountToken || game !== activeGame) {
          renderer.dispose();
          return;
        }
        const timings = { importMs, ...startupTimings, pageReadyMs: performance.now() };
        startupTimingsStore.set(timings);
        if (import.meta.env.DEV) {
          console.info("3D board startup (ms)", timings);
          (window as unknown as { __vectorDefenceStartup?: unknown }).__vectorDefenceStartup = timings;
        }
        attachRenderer(activeGame, renderer);
      })
      .catch((error: unknown) => {
        if (token === mountToken) {
          reportRendererFailure(error);
        }
      });
  };

  const mount = (surface: BoardSurface): void => {
    unmount();

    const activeGame = ensureGame();
    const token = mountToken;
    canvas = surface.overlay;
    refreshCanvasGeometry();
    canvasResizeObserver = new ResizeObserver(() => {
      if (!game) {
        return;
      }

      game.resize();
      refreshCanvasGeometry();
      game.draw();
    });
    canvasResizeObserver.observe(canvas);
    attachWindowListeners();

    mountBoardRenderer(activeGame, surface, token);

    resetFrameClock();
    requestGameFrame();
  };

  const unmount = (): void => {
    mountToken += 1;
    boardReady = false;
    endTowerDrag();
    canvasResizeObserver?.disconnect();
    canvasResizeObserver = null;
    game?.setPointer();
    game?.detachRenderer();
    canvasGeometry = null;
    canvas = null;
  };

  const destroy = (): void => {
    unmount();

    if (frameId !== 0) {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    }

    detachWindowListeners();
    resetFrameClock();
    runtimeStats = { ...INITIAL_RUNTIME_HUD_STATS };
    resetNerdStatsSamples();
    game = null;
  };

  const setNerdStatsEnabled = (enabled: boolean): void => {
    nerdStatsEnabled = enabled;

    if (!enabled) {
      runtimeStats = { ...INITIAL_RUNTIME_HUD_STATS };
      resetNerdStatsSamples();
      publish(true, false);
      return;
    }

    resetNerdStatsSamples();
  };

  const toggleSound = (): void => {
    if (soundEnabled) {
      audio.play(AudioCue.SoundToggle);
    }
    soundEnabled = audio.toggle();
    if (soundEnabled) {
      audio.unlock();
      audio.play(AudioCue.SoundToggle);
    }
    soundEnabledStore.set(soundEnabled);
  };

  const togglePause = (): void => {
    withGame((currentGame) => {
      currentGame.togglePause();
      if (!currentGame.canPerformBattleAction()) {
        endTowerDrag();
      }
    }, true);
  };

  const skipBreak = (): void => {
    withGame((currentGame) => {
      currentGame.skipBuildBreak();
    });
  };

  const openMenu = (): void => {
    withGame((currentGame) => {
      currentGame.openMenu();
    }, true);
  };

  const restart = (): void => {
    withGame((currentGame) => {
      currentGame.playSound(AudioCue.UiClick);
      currentGame.restart();
    }, true);
  };

  const upgradeSelectedTower = (): void => {
    withGame((currentGame) => {
      currentGame.upgradeSelectedTower();
    });
  };

  const toggleSelectedLaserLock = (): void => {
    withGame((currentGame) => {
      currentGame.toggleSelectedLaserLock();
    });
  };

  const sellSelectedTower = (): void => {
    withGame((currentGame) => {
      currentGame.sellSelectedTower();
    });
  };

  const cancelBuild = (): void => {
    withGame((currentGame) => {
      currentGame.cancelTowerPlacement();
    });
  };

  const toggleTowerPlacement = (kind: TowerKind): void => {
    withGame((currentGame) => {
      currentGame.toggleTowerPlacement(kind);
    });
  };

  const handleModalAction = (action: ModalAction): void => {
    withGame((currentGame) => {
      currentGame.playSound(AudioCue.UiConfirm);
      performModalAction(currentGame, action);
    }, true);
  };

  const selectLevel = (levelIndex: number): void => {
    withGame((currentGame) => {
      currentGame.startLevelByIndex(levelIndex);
    }, true);
  };

  const handleCanvasMove = (event: PointerEvent): void => {
    const point = toCanvasPoint(event);
    if (!game || !point) {
      return;
    }

    game.setPointer(point);
  };

  const handleCanvasDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.pointerType !== "touch") {
      return;
    }

    refreshCanvasGeometry();
    const point = toCanvasPoint(event);
    if (!point) {
      return;
    }

    event.preventDefault();
    game?.setPointer(point);
    withGame((currentGame) => {
      currentGame.handleBoardClick(point);
    });
  };

  const handleCanvasLeave = (): void => {
    if (game) {
      game.setPointer();
    }
  };

  const endTowerDrag = (): void => {
    window.removeEventListener("pointermove", handleTowerDragMove);
    window.removeEventListener("pointerup", handleTowerDragEnd);
    window.removeEventListener("pointercancel", handleTowerDragCancel);
    towerDrag = null;
  };

  function handleTowerDragMove(event: PointerEvent): void {
    const drag = towerDrag;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    if (!game?.canPerformBattleAction()) {
      endTowerDrag();
      return;
    }

    const distance = Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY);
    if (!drag.active) {
      if (distance < TOWER_DRAG_THRESHOLD_PX) {
        return;
      }

      drag.active = true;
      withGame((currentGame) => {
        currentGame.startTowerPlacement(drag.kind);
      }, true);
    }

    event.preventDefault();
    const point = toCanvasPoint(event);
    if (!point || !isPointerInsideCanvas(event)) {
      game?.setPointer();
      return;
    }

    game?.setPointer(point);
  }

  function handleTowerDragEnd(event: PointerEvent): void {
    const drag = towerDrag;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    if (!game?.canPerformBattleAction()) {
      endTowerDrag();
      return;
    }

    const wasActive = drag.active;
    const point = toCanvasPoint(event);
    const isOnCanvas = isPointerInsideCanvas(event);
    const releasePoint = point && isOnCanvas
      ? point
      : game?.runtime.pointer;

    if (wasActive) {
      event.preventDefault();
      if (releasePoint) {
        game?.setPointer(releasePoint);
        withGame((currentGame) => {
          if (!currentGame.placeTower(drag.kind, releasePoint)) {
            currentGame.cancelTowerPlacement();
          }
        });
      } else {
        cancelBuild();
        game?.setPointer();
      }
    }

    endTowerDrag();
  }

  function handleTowerDragCancel(event: PointerEvent): void {
    if (!towerDrag || event.pointerId !== towerDrag.pointerId) {
      return;
    }

    if (towerDrag.active) {
      cancelBuild();
      game?.setPointer();
    }
    endTowerDrag();
  }

  const handleTowerButtonPointerDown = (kind: TowerKind, event: PointerEvent): void => {
    if (event.button !== 0 && event.pointerType !== "touch") {
      return;
    }

    if (!game?.canPerformBattleAction()) {
      event.preventDefault();
      return;
    }
    if (!game.isTowerAvailable(kind)) {
      event.preventDefault();
      return;
    }

    refreshCanvasGeometry();
    towerDrag = {
      kind,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      active: false,
    };
    window.addEventListener("pointermove", handleTowerDragMove, { passive: false });
    window.addEventListener("pointerup", handleTowerDragEnd);
    window.addEventListener("pointercancel", handleTowerDragCancel);
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (shouldIgnoreGameShortcut(event)) {
      return;
    }

    const key = event.key.toLowerCase();

    if (import.meta.env.DEV && key === "j") {
      event.preventDefault();
      withGame((currentGame) => {
        currentGame.finishLevel();
      }, true);
      return;
    }

    if (import.meta.env.DEV && key === "k") {
      event.preventDefault();
      withGame((currentGame) => {
        currentGame.loseLevel();
      }, true);
      return;
    }

    if (import.meta.env.DEV && key === "o") {
      event.preventDefault();
      withGame((currentGame) => {
        currentGame.unlockAllLevelsForDebug();
      }, true);
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      togglePause();
      return;
    }

    if (!game?.canPerformBattleAction()) {
      return;
    }

    if (key === "u") {
      event.preventDefault();
      upgradeSelectedTower();
      return;
    }

    if (key === "escape") {
      event.preventDefault();
      cancelBuild();
      return;
    }

    const towerKind = findTowerShortcut(key, game.currentLevel?.availableTowers ?? []);
    if (!towerKind) {
      return;
    }

    event.preventDefault();
    toggleTowerPlacement(towerKind);
  };

  return {
    profile,
    hud: readonly(hudStore),
    modal: readonly(modalStore),
    soundEnabled: readonly(soundEnabledStore),
    rendererStatus: readonly(rendererStatusStore),
    startupTimings: readonly(startupTimingsStore),
    toggleSound,
    setNerdStatsEnabled,
    mount,
    unmount,
    destroy,
    handleKeyDown,
    handleCanvasMove,
    handleCanvasDown,
    handleCanvasLeave,
    handleTowerButtonPointerDown,
    togglePause,
    skipBreak,
    openMenu,
    restart,
    upgradeSelectedTower,
    toggleSelectedLaserLock,
    sellSelectedTower,
    cancelBuild,
    toggleTowerPlacement,
    handleModalAction,
    selectLevel,
  };
}

export type GameSession = ReturnType<typeof createGameSession>;
