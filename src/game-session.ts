import { FIELD_HEIGHT, FIELD_WIDTH } from "./constants";
import { findTowerShortcut } from "./entities/towers/tower-registry";
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
import type { HudSnapshot, ModalAction, ModalView, Point, TowerKind } from "./types";
import { readonly, writable, type Readable } from "svelte/store";

const MAX_FRAME_DELTA = 1 / 15;
const NERD_STATS_SAMPLE_MS = 500;
const TOWER_DRAG_THRESHOLD_PX = 6;

interface GameWindow extends Window {
  __vectorDefence?: Game;
}

export interface GameSession {
  hud: Readable<HudSnapshot>;
  modal: Readable<ModalView | null>;
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
  openMenu(): void;
  restart(): void;
  upgradeSelectedTower(): void;
  sellSelectedTower(): void;
  cancelBuild(): void;
  toggleTowerPlacement(kind: TowerKind): void;
  handleModalAction(action: ModalAction): void;
  selectLevel(levelIndex: number): void;
}

export function createGameSession(): GameSession {
  const hudStore = writable(INITIAL_HUD_SNAPSHOT);
  const modalStore = writable<ModalView | null>(null);
  let canvas: HTMLCanvasElement | null = null;
  let game: Game | null = null;
  let frameId = 0;
  let previousFrameTime = 0;
  let runtimeStats: RuntimeHudStats = { ...INITIAL_RUNTIME_HUD_STATS };
  let sampledFrameCount = 0;
  let sampledFrameDurationMs = 0;
  let lastNerdStatsSampleTime = 0;
  let nerdStatsEnabled = false;
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

    return {
      x: ((event.clientX - rect.left) / rect.width) * FIELD_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * FIELD_HEIGHT,
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
      } else if (timestamp - lastNerdStatsSampleTime >= NERD_STATS_SAMPLE_MS && sampledFrameDurationMs > 0) {
        runtimeStats = {
          fps: (sampledFrameCount * 1000) / sampledFrameDurationMs,
          frameTimeMs: sampledFrameDurationMs / sampledFrameCount,
        };
        sampledFrameCount = 0;
        sampledFrameDurationMs = 0;
        lastNerdStatsSampleTime = timestamp;
        game.requestHudSync();
      }
    }

    game.update(deltaSeconds);
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

    game = new Game(createLevels(), nextBackgroundCanvas, backgroundCtx, canvas, ctx);
    (window as GameWindow).__vectorDefence = game;
    game.resize();
    game.draw();
    runtimeStats = { ...INITIAL_RUNTIME_HUD_STATS };
    sampledFrameCount = 0;
    sampledFrameDurationMs = 0;
    lastNerdStatsSampleTime = 0;
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

    if ((window as GameWindow).__vectorDefence === game) {
      delete (window as GameWindow).__vectorDefence;
    }

    previousFrameTime = 0;
    runtimeStats = { ...INITIAL_RUNTIME_HUD_STATS };
    sampledFrameCount = 0;
    sampledFrameDurationMs = 0;
    lastNerdStatsSampleTime = 0;
    canvas = null;
    game = null;
  };

  const setNerdStatsEnabled = (enabled: boolean): void => {
    nerdStatsEnabled = enabled;

    if (!enabled) {
      runtimeStats = { ...INITIAL_RUNTIME_HUD_STATS };
      sampledFrameCount = 0;
      sampledFrameDurationMs = 0;
      lastNerdStatsSampleTime = 0;
      publish(true, false);
      return;
    }

    sampledFrameCount = 0;
    sampledFrameDurationMs = 0;
    lastNerdStatsSampleTime = 0;
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
    }, true);
  };

  const openMenu = (): void => {
    withGame((currentGame) => {
      currentGame.openMenu();
    }, true);
  };

  const restart = (): void => {
    withGame((currentGame) => {
      currentGame.restart();
    }, true);
  };

  const upgradeSelectedTower = (): void => {
    withGame((currentGame) => {
      currentGame.upgradeSelectedTower();
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

    const wasActive = towerDrag.active;
    const point = toCanvasPoint(event);
    const isOnCanvas = isPointerInsideCanvas(event);

    if (wasActive) {
      event.preventDefault();
      if (point && isOnCanvas) {
        game?.setPointer(point);
        withGame((currentGame) => {
          currentGame.placeTower(towerDrag!.kind, point);
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
    if (event.defaultPrevented) {
      return;
    }

    const key = event.key.toLowerCase();
    if (event.code === "Space") {
      event.preventDefault();
      togglePause();
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
    hud: readonly(hudStore),
    modal: readonly(modalStore),
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
    openMenu,
    restart,
    upgradeSelectedTower,
    sellSelectedTower,
    cancelBuild,
    toggleTowerPlacement,
    handleModalAction,
    selectLevel,
  };
}
