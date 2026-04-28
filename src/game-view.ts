import { STARTING_MONEY } from "./constants";
import { createBannerText } from "./banner-text";
import { getTowerClass } from "./entities/towers/tower-registry";
import { isModalState } from "./game-engine";
import { formatMoney } from "./utils";
import type { Game } from "./game-engine";
import {
  GameState,
  ModalAction,
  type HudSnapshot,
  type ModalActionView,
  type ModalLevelCardView,
  type ModalView,
} from "./types";

export interface RuntimeHudStats {
  fps: number;
  frameTimeMs: number;
  updateTimeMs: number;
  drawTimeMs: number;
}

export const INITIAL_RUNTIME_HUD_STATS: RuntimeHudStats = {
  fps: 0,
  frameTimeMs: 0,
  updateTimeMs: 0,
  drawTimeMs: 0,
};

export const INITIAL_HUD_SNAPSHOT: HudSnapshot = {
  levelName: "Campaign Map",
  money: formatMoney(STARTING_MONEY),
  wave: "Idle",
  banner: "Awaiting orders",
  selectionTitle: "No tower selected",
  selectionBody: "Choose a build from the toolbar.",
  upgradeDisabled: true,
  hasSelectedTower: false,
  sellDisabled: true,
  towerButtonsDisabled: true,
  nerdStats: {
    fps: "0",
    frameTime: "0.0 ms",
    updateTime: "0.0 ms",
    drawTime: "0.0 ms",
    trackedObjects: "0",
    towers: "0",
    hostiles: "0",
    shots: "0",
    effects: "0",
    pixelRatio: "1x",
  },
};

function formatTimingMs(value: number): string {
  return `${value.toFixed(3)} ms`;
}

export function createHudSnapshot(game: Game, runtimeStats: RuntimeHudStats = INITIAL_RUNTIME_HUD_STATS): HudSnapshot {
  const currentLevel = game.currentLevel;
  const runtime = game.runtime;
  const selected = runtime.selectedTower;
  const activeWave = runtime.activeWave;
  const levelName = currentLevel
    ? `${currentLevel.levelNumber ?? "?"} · ${currentLevel.name}`
    : "Campaign Map";
  const wave = currentLevel
    ? (activeWave
        ? (game.state === GameState.Playing && runtime.spawnDelay > 0
            ? `${runtime.currentWaveIndex + 1}/${runtime.waveTotal}`
            : `${runtime.currentWaveIndex + 1}/${runtime.waveTotal} · ${Math.min(runtime.waveSpawnedMonsters, activeWave.count)}/${activeWave.count}`)
        : `All ${game.waveTotal} waves cleared`)
    : "Idle";
  const banner = createBannerText(game);

  let selectionTitle = "No tower selected";
  let selectionBody = "Choose a build from the toolbar.";

  if (selected) {
    selectionTitle = `${getTowerClass(selected.kind).label} Tower · Level ${selected.level + 1}`;
    selectionBody = [
      `Range ${Math.round(selected.range)}`,
      selected.canUpgrade() ? `Upgrade ${formatMoney(selected.upgradeCost)}` : undefined,
      `Sell ${formatMoney(selected.resaleValue)}`,
    ].filter((item) => item !== undefined).join(" · ");
  } else if (runtime.placingTower) {
    const towerClass = getTowerClass(runtime.placingTower);
    selectionTitle = `Placing ${towerClass.label}`;
    selectionBody = towerClass.summary;
  } else if (currentLevel) {
    selectionTitle = currentLevel.name;
    selectionBody = currentLevel.subtitle ?? "Hold the route and keep your towers overlapping.";
  }

  const shotsTracked = runtime.projectiles.length + runtime.missiles.length;
  const effectsTracked = runtime.particles.length + runtime.links.length;
  const trackedObjects = runtime.towers.length + runtime.monsters.length + shotsTracked + effectsTracked;

  return {
    levelName,
    money: formatMoney(runtime.money),
    wave,
    banner,
    selectionTitle,
    selectionBody,
    upgradeDisabled: !selected || !selected.canUpgrade() || runtime.money < selected.upgradeCost || isModalState(game.state),
    hasSelectedTower: selected !== undefined,
    sellDisabled: !selected || isModalState(game.state),
    placingTower: runtime.placingTower,
    towerButtonsDisabled: isModalState(game.state),
    nerdStats: {
      fps: String(Math.max(0, Math.round(runtimeStats.fps))),
      frameTime: `${runtimeStats.frameTimeMs.toFixed(1)} ms`,
      updateTime: formatTimingMs(runtimeStats.updateTimeMs),
      drawTime: formatTimingMs(runtimeStats.drawTimeMs),
      trackedObjects: String(trackedObjects),
      towers: String(runtime.towers.length),
      hostiles: String(runtime.monsters.length),
      shots: String(shotsTracked),
      effects: String(effectsTracked),
      pixelRatio: `${game.renderer.currentDpr.toFixed(game.renderer.currentDpr % 1 === 0 ? 0 : 1)}x`,
    },
  };
}

export function createModalView(game: Game): ModalView | null {
  if (game.state === GameState.Menu) {
    const actions: ModalActionView[] = [
      {
        action: game.menuReturnState && game.currentLevel ? ModalAction.Resume : ModalAction.PlayUnlocked,
        label: game.menuReturnState && game.currentLevel
          ? "Resume Battle"
          : (game.campaignCleared ? "Replay Campaign" : "Play Next Campaign Level"),
      },
    ];

    if (game.highestUnlockedLevelIndex > 0 || game.campaignCleared) {
      actions.push({
        action: ModalAction.RestartCampaign,
        label: "Restart Campaign",
      });
    }

    return {
      title: "Campaign Map",
      description: `${game.campaignLevelCount} authored campaign battles plus an unlocked random challenge.`,
      actions,
      actionClassName: "campaign-actions",
      levelCards: createModalLevelCards(game),
    };
  }

  if (game.state === GameState.Won) {
    if (game.currentLevel?.isChallenge) {
      return {
        title: "Challenge Clear",
        description: "The random route held. Try another layout from the map when you want a fresh run.",
        centered: true,
        actions: [
          { action: ModalAction.Replay, label: "Replay This Route" },
          { action: ModalAction.CampaignMap, label: "Campaign Map" },
        ],
      };
    }

    return {
      title: "Level Clear",
      description: `Level ${game.currentLevel?.levelNumber ?? "?"} is secure. Keep the pressure on and push into the next route.`,
      centered: true,
      actions: [
        { action: ModalAction.NextLevel, label: `Continue to Level ${(game.currentLevel?.levelNumber ?? 0) + 1}` },
        { action: ModalAction.Replay, label: "Replay This Level" },
        { action: ModalAction.CampaignMap, label: "Campaign Map" },
      ],
    };
  }

  if (game.state === GameState.CampaignWon) {
    return {
      title: "You Won the Campaign",
      description: `All ${game.campaignLevelCount} campaign levels are secure. The random challenge is still open from the map.`,
      centered: true,
      actions: [
        { action: ModalAction.RestartCampaign, label: "Restart Campaign" },
        { action: ModalAction.Replay, label: "Replay Final Level" },
        { action: ModalAction.CampaignMap, label: "Campaign Map" },
      ],
    };
  }

  if (game.state === GameState.Lost) {
    return {
      title: "Defeat",
      description: "The route broke through. Rework the build, lean on the intermissions, and try again.",
      centered: true,
      actions: [
        { action: ModalAction.Replay, label: "Try Again" },
        { action: ModalAction.CampaignMap, label: "Campaign Map" },
      ],
    };
  }

  return null;
}

export function performModalAction(game: Game, action: ModalAction): void {
  switch (action) {
    case ModalAction.Resume:
      game.resumeBattle();
      break;
    case ModalAction.PlayUnlocked:
      game.startLevelByIndex(game.campaignCleared ? 0 : game.highestUnlockedLevelIndex);
      break;
    case ModalAction.RestartCampaign:
      game.restartCampaign();
      break;
    case ModalAction.NextLevel:
      game.startNextLevel();
      break;
    case ModalAction.Replay:
      game.restart();
      break;
    case ModalAction.CampaignMap:
      game.openMenu();
      break;
    default:
      assertNever(action);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled modal action: ${value}`);
}

function createModalLevelCards(game: Game): ModalLevelCardView[] {
  return game.levels.map((level, index) => {
    const unlocked = level.isChallenge || game.campaignCleared || index <= game.highestUnlockedLevelIndex;
    const cleared = !level.isChallenge && (game.campaignCleared || index < game.highestUnlockedLevelIndex);
    const current = game.currentLevelIndex === index && !!game.currentLevel;
    const status = level.isChallenge
      ? (current ? "Current" : "Random")
      : (!unlocked ? "Locked" : (cleared ? "Cleared" : (index === Math.min(game.highestUnlockedLevelIndex, game.campaignLevelCount - 1) ? "Next" : "Ready")));

    return {
      index,
      unlocked,
      cleared,
      current,
      status,
      level,
    };
  });
}
