import { findTowerShortcut } from "./entities/towers/tower-registry";
import { createBrowserCampaignProgressStore } from "./campaign-progress";
import { type GameProfile } from "./game-profile";
import { GameAudio } from "./game-audio";
import { getCenteredFieldViewport, type CenteredFieldViewport } from "./game-renderer";
import { runBoundedSimulationSubsteps } from "./simulation-timing";
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
import { AudioCue, type ModalAction, type ModalView, type Point, type TowerKind } from "./types";
import { readonly, writable } from "svelte/store";

const NERD_STATS_SAMPLE_MS = 500;
const TOWER_DRAG_THRESHOLD_PX = 6;
const KEYBOARD_INPUT_SELECTOR = "input, select, textarea";
const KEYBOARD_ACTIVATION_SELECTOR = "a[href], button, summary, [role='button'], [role='link']";

interface CanvasGeometry {
  rect: DOMRect;
  viewport: CenteredFieldViewport;
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
  const audio = new GameAudio(profile.fieldWidth);
  const progressStore = createBrowserCampaignProgressStore(window);
  let canvas: HTMLCanvasElement | null = null;
  let game: Game | null = null;
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

    const rect = canvas.getBoundingClientRect();
    canvasGeometry = {
      rect,
      viewport: getCenteredFieldViewport(rect.width, rect.height, profile.fieldWidth, profile.fieldHeight),
    };
  };

  const toCanvasPoint = (event: PointerEvent): Point | null => {
    const geometry = canvasGeometry;
    if (!geometry) {
      return null;
    }

    const { rect, viewport } = geometry;
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }

    const viewportPoint = {
      x: ((event.clientX - rect.left) / rect.width) * viewport.width,
      y: ((event.clientY - rect.top) / rect.height) * viewport.height,
    };
    return {
      x: viewportPoint.x - viewport.fieldOffsetX,
      y: viewportPoint.y - viewport.fieldOffsetY,
    };
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
    if (!activeGame?.needsAnimationFrame()) {
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

    const updateStart = performance.now();
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
    const updateDurationMs = performance.now() - updateStart;
    const drawStart = performance.now();
    activeGame.draw();
    const drawDurationMs = performance.now() - drawStart;

    if (nerdStatsEnabled && hasPreviousFrame) {
      sampledUpdateDurationMs += updateDurationMs;
      sampledDrawDurationMs += drawDurationMs;

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

  const mount = (nextBackgroundCanvas: HTMLCanvasElement, nextCanvas: HTMLCanvasElement): void => {
    if (canvas === nextCanvas && game) {
      return;
    }

    destroy();

    canvas = nextCanvas;
    const backgroundCtx = nextBackgroundCanvas.getContext("2d");
    if (!backgroundCtx) {
      throw new Error("Background canvas context unavailable.");
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas context unavailable.");
    }

    game = new Game(
      createLevels(profile.mode),
      nextBackgroundCanvas,
      backgroundCtx,
      canvas,
      ctx,
      audio,
      profile,
      progressStore,
    );
    game.resize();
    refreshCanvasGeometry();
    game.draw();
    canvasResizeObserver = new ResizeObserver(() => {
      if (!game) {
        return;
      }

      game.resize();
      refreshCanvasGeometry();
      game.draw();
    });
    canvasResizeObserver.observe(canvas);
    window.addEventListener("resize", refreshCanvasGeometry);
    window.addEventListener("scroll", refreshCanvasGeometry, true);
    window.visualViewport?.addEventListener("resize", refreshCanvasGeometry);
    window.visualViewport?.addEventListener("scroll", refreshCanvasGeometry);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    runtimeStats = { ...INITIAL_RUNTIME_HUD_STATS };
    resetNerdStatsSamples();
    publish(true, true);
    resetFrameClock();
    requestGameFrame();
  };

  const destroy = (): void => {
    endTowerDrag();

    if (frameId !== 0) {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    }

    canvasResizeObserver?.disconnect();
    canvasResizeObserver = null;
    window.removeEventListener("resize", refreshCanvasGeometry);
    window.removeEventListener("scroll", refreshCanvasGeometry, true);
    window.visualViewport?.removeEventListener("resize", refreshCanvasGeometry);
    window.visualViewport?.removeEventListener("scroll", refreshCanvasGeometry);
    document.removeEventListener("visibilitychange", handleVisibilityChange);

    resetFrameClock();
    runtimeStats = { ...INITIAL_RUNTIME_HUD_STATS };
    resetNerdStatsSamples();
    canvasGeometry = null;
    canvas = null;
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
    if (profile.ui.dragOnlyTowerPlacement) {
      return;
    }

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
          if (currentGame.isTowerAvailable(drag.kind) && currentGame.canPlaceTower(releasePoint) && currentGame.canAffordTower(drag.kind)) {
            currentGame.placeTower(drag.kind, releasePoint);
          } else {
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

    if (profile.ui.dragOnlyTowerPlacement) {
      event.preventDefault();
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

    if (profile.ui.dragOnlyTowerPlacement) {
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
    toggleSound,
    setNerdStatsEnabled,
    mount,
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
