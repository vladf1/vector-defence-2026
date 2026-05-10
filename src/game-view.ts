import { STARTING_MONEY } from "./constants";
import { createBannerText } from "./banner-text";
import { LaserTower } from "./entities/towers/laser-tower";
import { getTowerClass } from "./entities/towers/tower-registry";
import { TEMPORARILY_UNLOCK_ALL_LEVELS } from "./game-engine";
import { formatMoney } from "./utils";
import type { Game } from "./game-engine";
import {
  GameState,
  ModalAction,
  TowerKind,
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
  monsters: "",
  banner: "Awaiting orders",
  selectionTitle: "",
  selectionBody: "Select a tower to view upgrades, range, and sell value.",
  mobileSelectionBody: "Select a tower to view upgrades, range, and sell value.",
  upgradeActionLabel: "Upgrade",
  sellActionLabel: "Sell",
  upgradeDisabled: true,
  upgradeUnaffordable: false,
  hasSelectedTower: false,
  hasLaserLockAction: false,
  laserLocked: false,
  laserLockDisabled: true,
  sellDisabled: true,
  cancelBuildDisabled: true,
  canTogglePause: false,
  canSkipBreak: false,
  paused: false,
  dragOnlyTowerPlacement: false,
  towerButtonsDisabled: true,
  affordableTowers: {
    [TowerKind.Gun]: false,
    [TowerKind.Laser]: false,
    [TowerKind.Missile]: false,
    [TowerKind.Slow]: false,
    [TowerKind.Lightning]: false,
  },
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
  const battleActionsDisabled = !game.canPerformBattleAction();
  const levelName = currentLevel
    ? `${currentLevel.levelNumber ?? "?"} · ${currentLevel.name}`
    : "Campaign Map";
  const wave = currentLevel
    ? (activeWave
        ? (game.profile.mode === "desktop"
            ? `${runtime.currentWaveIndex + 1} of ${runtime.waveTotal}`
            : game.state === GameState.Playing && runtime.spawnDelay > 0
            ? `${runtime.currentWaveIndex + 1}/${runtime.waveTotal}`
            : `${runtime.currentWaveIndex + 1}/${runtime.waveTotal} · ${Math.min(runtime.waveSpawnedMonsters, activeWave.count)}/${activeWave.count}`)
        : `All ${game.waveTotal} waves cleared`)
    : "Idle";
  const monsters = activeWave
    ? `${Math.min(runtime.waveSpawnedMonsters, activeWave.count)} of ${activeWave.count}`
    : "";
  const banner = createBannerText(game);

  let selectionTitle = "";
  let selectionBody = "Select a tower to view upgrades, range, and sell value.";
  let mobileSelectionBody = selectionBody;
  let upgradeActionLabel = "Upgrade";
  let sellActionLabel = "Sell";

  if (selected) {
    const rangeLabel = `Range ${Math.round(selected.range)}`;
    selectionTitle = `${getTowerClass(selected.kind).label} Tower · Level ${selected.level + 1} · ${rangeLabel}`;
    selectionBody = "";
    mobileSelectionBody = `Level ${selected.level + 1} · ${rangeLabel}`;
    upgradeActionLabel = selected.canUpgrade() ? `Upgrade - ${formatMoney(selected.upgradeCost)}` : "Max";
    sellActionLabel = `Sell - ${formatMoney(selected.resaleValue)}`;
  } else if (runtime.placingTower) {
    const towerClass = getTowerClass(runtime.placingTower);
    selectionTitle = `Placing ${towerClass.label} Tower`;
    selectionBody = towerClass.summary;
    mobileSelectionBody = selectionBody;
  }

  const shotsTracked = runtime.projectiles.length + runtime.missiles.length;
  const effectsTracked = runtime.particles.length + runtime.links.length;
  const trackedObjects = runtime.towers.length + runtime.monsters.length + shotsTracked + effectsTracked;
  const upgradeUnaffordable = selected !== undefined
    && selected.canUpgrade()
    && runtime.money < selected.upgradeCost;

  return {
    levelName,
    money: formatMoney(runtime.money),
    wave,
    monsters,
    banner,
    selectionTitle,
    selectionBody,
    mobileSelectionBody,
    upgradeActionLabel,
    sellActionLabel,
    upgradeDisabled: !selected || !selected.canUpgrade() || runtime.money < selected.upgradeCost || battleActionsDisabled,
    upgradeUnaffordable,
    hasSelectedTower: selected !== undefined,
    hasLaserLockAction: selected instanceof LaserTower,
    laserLocked: selected instanceof LaserTower && selected.directionLocked,
    laserLockDisabled: !(selected instanceof LaserTower) || battleActionsDisabled,
    sellDisabled: !selected || battleActionsDisabled,
    cancelBuildDisabled: !runtime.placingTower || battleActionsDisabled,
    canTogglePause: game.state === GameState.Playing || game.state === GameState.Paused,
    canSkipBreak: game.state === GameState.Playing
      && !!activeWave
      && runtime.spawnDelay > 0
      && !battleActionsDisabled,
    paused: game.state === GameState.Paused,
    dragOnlyTowerPlacement: game.profile.ui.dragOnlyTowerPlacement,
    placingTower: runtime.placingTower,
    towerButtonsDisabled: battleActionsDisabled,
    affordableTowers: {
      [TowerKind.Gun]: runtime.money >= getTowerClass(TowerKind.Gun).baseCost,
      [TowerKind.Laser]: runtime.money >= getTowerClass(TowerKind.Laser).baseCost,
      [TowerKind.Missile]: runtime.money >= getTowerClass(TowerKind.Missile).baseCost,
      [TowerKind.Slow]: runtime.money >= getTowerClass(TowerKind.Slow).baseCost,
      [TowerKind.Lightning]: runtime.money >= getTowerClass(TowerKind.Lightning).baseCost,
    },
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
      description: `${game.campaignLevelCount} campaign battles. Hold each route and finish the full run.`,
      actions,
      actionClassName: "campaign-actions",
      levelCards: createModalLevelCards(game),
    };
  }

  if (game.state === GameState.Won) {
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
      description: `All ${game.campaignLevelCount} campaign levels are secure.`,
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
    const unlocked = TEMPORARILY_UNLOCK_ALL_LEVELS || game.campaignCleared || index <= game.highestUnlockedLevelIndex;
    const cleared = game.campaignCleared || index < game.highestUnlockedLevelIndex;
    const current = game.currentLevelIndex === index && !!game.currentLevel;
    const status = !unlocked
      ? "Locked"
      : (cleared ? "Cleared" : (index === Math.min(game.highestUnlockedLevelIndex, game.campaignLevelCount - 1) ? "Next" : "Ready"));

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
