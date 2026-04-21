import { FIELD_HEIGHT, FIELD_WIDTH } from "./constants";
import { findTowerShortcut } from "./entities/towers/tower-registry";
import {
  Game,
  isModalState,
  levels,
} from "./game-engine";
import {
  INITIAL_HUD_SNAPSHOT,
  INITIAL_RUNTIME_HUD_STATS,
  createHudSnapshot,
  createModalView,
  performModalAction,
  type RuntimeHudStats,
} from "./game-view";
import type { HudSnapshot, ModalView, Point, TowerKind } from "./types";
import { readonly, writable, type Readable } from "svelte/store";

const MAX_FRAME_DELTA = 1 / 15;
const NERD_STATS_SAMPLE_MS = 500;

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
  handleCanvasLeave(): void;
  togglePause(): void;
  openMenu(): void;
  restart(): void;
  upgradeSelectedTower(): void;
  sellSelectedTower(): void;
  cancelBuild(): void;
  toggleTowerPlacement(kind: TowerKind): void;
  handleModalAction(action: string): void;
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

  const toCanvasPoint = (event: MouseEvent): Point | null => {
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
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas context unavailable.");
    }

    game = new Game(levels, canvas, ctx);
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
      if (!currentGame.placingTower) {
        return;
      }

      currentGame.placingTower = undefined;
      currentGame.requestHudSync();
    });
  };

  const toggleTowerPlacement = (kind: TowerKind): void => {
    withGame((currentGame) => {
      if (!currentGame.currentLevel || isModalState(currentGame.state)) {
        return;
      }

      currentGame.selectedTower = undefined;
      currentGame.placingTower = currentGame.placingTower === kind ? undefined : kind;
      currentGame.requestHudSync();
    });
  };

  const handleModalAction = (action: string): void => {
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
    const point = toCanvasPoint(event);
    if (!game || !point) {
      return;
    }

    game.pointer = point;
  };

  const handleCanvasDown = (event: MouseEvent): void => {
    if (event.button !== 0) {
      return;
    }

    const point = toCanvasPoint(event);
    if (!point) {
      return;
    }

    withGame((currentGame) => {
      if (isModalState(currentGame.state)) {
        return;
      }

      if (currentGame.placingTower) {
        currentGame.placeTower(currentGame.placingTower, point);
        return;
      }

      currentGame.selectTowerAt(point);
    });
  };

  const handleCanvasLeave = (): void => {
    if (game) {
      game.pointer = undefined;
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
