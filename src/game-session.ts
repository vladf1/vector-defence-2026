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
const ROTATION_RADIANS_PER_CANVAS_PIXEL = 0.012;

interface GameWindow extends Window {
  __vectorDefence?: Game;
}

export interface GameSession {
  hud: Readable<HudSnapshot>;
  modal: Readable<ModalView | null>;
  setNerdStatsEnabled(enabled: boolean): void;
  mount(canvas: HTMLCanvasElement): void;
  destroy(): void;
  handleResize(): void;
  handleKeyDown(event: KeyboardEvent): void;
  handleCanvasMove(event: MouseEvent): void;
  handleCanvasDown(event: MouseEvent): void;
  handleCanvasUp(event: MouseEvent): void;
  handleCanvasWheel(event: WheelEvent): void;
  handleCanvasDoubleClick(event: MouseEvent): void;
  handleCanvasContextMenu(event: MouseEvent): void;
  handleCanvasLeave(): void;
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
  let viewDrag: {
    mode: "pan" | "rotate";
    clientX: number;
    clientY: number;
  } | null = null;

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

  const toCanvasLocalPoint = (event: MouseEvent): Point | null => {
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

  const toBoardPoint = (event: MouseEvent): Point | null => {
    if (!game) {
      return null;
    }

    const point = toCanvasLocalPoint(event);
    return point ? game.screenToBoardPoint(point) : null;
  };

  const getCanvasDelta = (event: MouseEvent): Point | null => {
    if (!canvas || !viewDrag) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }

    const delta = {
      x: ((event.clientX - viewDrag.clientX) / rect.width) * FIELD_WIDTH,
      y: ((event.clientY - viewDrag.clientY) / rect.height) * FIELD_HEIGHT,
    };
    viewDrag.clientX = event.clientX;
    viewDrag.clientY = event.clientY;
    return delta;
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

  const mount = (nextCanvas: HTMLCanvasElement): void => {
    if (canvas === nextCanvas && game) {
      return;
    }

    destroy();

    canvas = nextCanvas;
    game = new Game(createLevels(), canvas);
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

  const handleCanvasMove = (event: MouseEvent): void => {
    if (!game) {
      return;
    }

    if (viewDrag) {
      const delta = getCanvasDelta(event);
      const canvasPoint = toCanvasLocalPoint(event);
      if (!delta || !canvasPoint) {
        return;
      }

      event.preventDefault();
      if (viewDrag.mode === "pan") {
        game.panBoardView(delta.x, delta.y);
      } else {
        game.rotateBoardViewAt(canvasPoint, delta.x * ROTATION_RADIANS_PER_CANVAS_PIXEL);
      }
      publish(true, false);
      return;
    }

    const point = toBoardPoint(event);
    if (!point) {
      return;
    }
    game.setPointer(point);
  };

  const handleCanvasDown = (event: MouseEvent): void => {
    if (!game) {
      return;
    }

    if (event.button === 1 || event.button === 2) {
      event.preventDefault();
      viewDrag = {
        mode: "pan",
        clientX: event.clientX,
        clientY: event.clientY,
      };
      return;
    }

    if (event.button === 0 && event.shiftKey) {
      event.preventDefault();
      viewDrag = {
        mode: "rotate",
        clientX: event.clientX,
        clientY: event.clientY,
      };
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const point = toBoardPoint(event);
    if (!point) {
      return;
    }

    withGame((currentGame) => {
      currentGame.handleBoardClick(point);
    });
  };

  const handleCanvasUp = (event: MouseEvent): void => {
    if (!viewDrag) {
      return;
    }

    event.preventDefault();
    viewDrag = null;
  };

  const handleCanvasWheel = (event: WheelEvent): void => {
    if (!game) {
      return;
    }

    const point = toCanvasLocalPoint(event);
    if (!point) {
      return;
    }

    event.preventDefault();
    game.zoomBoardViewAt(point, event.deltaY);
    const boardPoint = game.screenToBoardPoint(point);
    game.setPointer(boardPoint);
    publish(true, false);
  };

  const handleCanvasDoubleClick = (event: MouseEvent): void => {
    if (!game) {
      return;
    }

    event.preventDefault();
    game.resetBoardView();
    publish(true, false);
  };

  const handleCanvasContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  const handleCanvasLeave = (): void => {
    if (game) {
      game.setPointer();
    }
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
    handleCanvasUp,
    handleCanvasWheel,
    handleCanvasDoubleClick,
    handleCanvasContextMenu,
    handleCanvasLeave,
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
