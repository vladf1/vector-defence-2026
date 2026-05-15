import { findTowerShortcut } from "./entities/towers/tower-registry";
import { type GameProfile } from "./game-profile";
import { GameAudio } from "./game-audio";
import { getCenteredFieldViewport } from "./game-renderer";
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
import { AudioCue, type HudSnapshot, type ModalAction, type ModalView, type Point, type TowerKind } from "./types";
import { readonly, writable, type Readable } from "svelte/store";

const MAX_FRAME_DELTA = 1 / 15;
const NERD_STATS_SAMPLE_MS = 500;
const TOWER_DRAG_THRESHOLD_PX = 6;

export interface GameSession {
  profile: GameProfile;
  hud: Readable<HudSnapshot>;
  modal: Readable<ModalView | null>;
  soundEnabled: Readable<boolean>;
  toggleSound(): void;
  setNerdStatsEnabled(enabled: boolean): void;
  mount(backgroundCanvas: HTMLCanvasElement, gameCanvas: HTMLCanvasElement): void;
  destroy(): void;
  handleResize(): void;
  handleKeyDown(event: KeyboardEvent): void;
  handleCanvasMove(event: PointerEvent): void;
  handleCanvasDown(event: PointerEvent): void;
  handleCanvasLeave(): void;
  handleTowerButtonPointerDown(kind: TowerKind, event: PointerEvent): void;
  togglePause(): void;
  skipBreak(): void;
  openMenu(): void;
  restart(): void;
  upgradeSelectedTower(): void;
  toggleSelectedLaserLock(): void;
  sellSelectedTower(): void;
  cancelBuild(): void;
  toggleTowerPlacement(kind: TowerKind): void;
  handleModalAction(action: ModalAction): void;
  selectLevel(levelIndex: number): void;
}

export function createGameSession(profile: GameProfile): GameSession {
  const hudStore = writable(INITIAL_HUD_SNAPSHOT);
  const modalStore = writable<ModalView | null>(null);
  const soundEnabledStore = writable(true);
  const audio = new GameAudio(profile.fieldWidth);
  let canvas: HTMLCanvasElement | null = null;
  let game: Game | null = null;
  let soundEnabled = true;
  let frameId = 0;
  let previousFrameTime = 0;
  let runtimeStats: RuntimeHudStats = { ...INITIAL_RUNTIME_HUD_STATS };
  let sampledFrameCount = 0;
  let sampledFrameDurationMs = 0;
  let sampledUpdateDurationMs = 0;
  let sampledDrawDurationMs = 0;
  let lastNerdStatsSampleTime = 0;
  let nerdStatsEnabled = false;
  let canvasResizeObserver: ResizeObserver | null = null;
  let towerDrag:
    | {
      kind: TowerKind;
      pointerId: number;
      startClientX: number;
      startClientY: number;
      active: boolean;
    }
    | null = null;

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
  };

  const toCanvasPoint = (event: PointerEvent): Point | null => {
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }

    const viewport = getCenteredFieldViewport(rect.width, rect.height, profile.fieldWidth, profile.fieldHeight);
    const viewportPoint = {
      x: ((event.clientX - rect.left) / rect.width) * viewport.width,
      y: ((event.clientY - rect.top) / rect.height) * viewport.height,
    };
    return game?.renderer.toFieldPoint(viewportPoint) ?? {
      x: viewportPoint.x - viewport.fieldOffsetX,
      y: viewportPoint.y - viewport.fieldOffsetY,
    };
  };

  const isPointerInsideCanvas = (event: PointerEvent): boolean => {
    if (!canvas) {
      return false;
    }

    const rect = canvas.getBoundingClientRect();
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

  const frame = (timestamp: number): void => {
    if (!game) {
      return;
    }

    const deltaSeconds = previousFrameTime === 0
      ? 0
      : Math.min((timestamp - previousFrameTime) / 1000, MAX_FRAME_DELTA);

    if (nerdStatsEnabled && previousFrameTime !== 0) {
      sampledFrameCount += 1;
      sampledFrameDurationMs += timestamp - previousFrameTime;

      if (lastNerdStatsSampleTime === 0) {
        lastNerdStatsSampleTime = timestamp;
      }
    }

    const frameTimings = game.update(deltaSeconds);
    if (nerdStatsEnabled && previousFrameTime !== 0) {
      sampledUpdateDurationMs += frameTimings.updateMs;
      sampledDrawDurationMs += frameTimings.drawMs;

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
        game.requestHudSync();
      }
    }
    publish();
    frameId = window.requestAnimationFrame(frame);
    previousFrameTime = timestamp;
  };

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
    );
    game.resize();
    game.draw();
    canvasResizeObserver = new ResizeObserver(() => {
      if (!game) {
        return;
      }

      game.resize();
      game.draw();
    });
    canvasResizeObserver.observe(canvas);
    runtimeStats = { ...INITIAL_RUNTIME_HUD_STATS };
    resetNerdStatsSamples();
    publish(true, true);
    previousFrameTime = 0;
    frameId = window.requestAnimationFrame(frame);
  };

  const destroy = (): void => {
    endTowerDrag();

    if (frameId !== 0) {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    }

    canvasResizeObserver?.disconnect();
    canvasResizeObserver = null;

    previousFrameTime = 0;
    runtimeStats = { ...INITIAL_RUNTIME_HUD_STATS };
    resetNerdStatsSamples();
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

  const handleResize = (): void => {
    withGame((currentGame) => {
      currentGame.resize();
      currentGame.draw();
    }, true);
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
    if (!towerDrag || event.pointerId !== towerDrag.pointerId) {
      return;
    }

    if (!game?.canPerformBattleAction()) {
      endTowerDrag();
      return;
    }

    const distance = Math.hypot(event.clientX - towerDrag.startClientX, event.clientY - towerDrag.startClientY);
    if (!towerDrag.active) {
      if (distance < TOWER_DRAG_THRESHOLD_PX) {
        return;
      }

      towerDrag.active = true;
      withGame((currentGame) => {
        currentGame.startTowerPlacement(towerDrag!.kind);
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
    if (!towerDrag || event.pointerId !== towerDrag.pointerId) {
      return;
    }

    if (!game?.canPerformBattleAction()) {
      endTowerDrag();
      return;
    }

    const wasActive = towerDrag.active;
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
          if (currentGame.canPlaceTower(releasePoint) && currentGame.canAffordTower(towerDrag!.kind)) {
            currentGame.placeTower(towerDrag!.kind, releasePoint);
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

    if (profile.ui.dragOnlyTowerPlacement) {
      event.preventDefault();
    }

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

    if (profile.ui.dragOnlyTowerPlacement) {
      return;
    }

    if (event.defaultPrevented) {
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

    const towerKind = findTowerShortcut(key);
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
    handleResize,
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
