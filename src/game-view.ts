import { STARTING_MONEY } from "./constants";
import { getTowerClass } from "./entities/towers/tower-registry";
import { isBattleState, isModalState } from "./game-engine";
import { formatMoney } from "./utils";
import type { Game } from "./game-engine";
import { GameState, type HudSnapshot, type ModalLevelCardView, type ModalView } from "./types";

export interface RuntimeHudStats {
  fps: number;
  frameTimeMs: number;
}

export const INITIAL_RUNTIME_HUD_STATS: RuntimeHudStats = {
  fps: 0,
  frameTimeMs: 0,
};

export const INITIAL_HUD_SNAPSHOT: HudSnapshot = {
  levelName: "Campaign Map",
  money: formatMoney(STARTING_MONEY),
  escapes: "0",
  wave: "Idle",
  banner: "Awaiting orders",
  pauseLabel: "Pause",
  pauseDisabled: true,
  selectionTitle: "No tower selected",
  selectionBody: "Choose a build from the toolbar, then click the field to place it.",
  upgradeDisabled: true,
  sellDisabled: true,
  towerButtonsDisabled: true,
  nerdStats: {
    fps: "0",
    frameTime: "0.0 ms",
    trackedObjects: "0",
    towers: "0",
    hostiles: "0",
    shots: "0",
    effects: "0",
    renderScale: "1x",
  },
};

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
            ? `Wave ${runtime.currentWaveIndex + 1}/${runtime.waveTotal}`
            : `Wave ${runtime.currentWaveIndex + 1}/${runtime.waveTotal} · ${Math.min(runtime.waveSpawnedMonsters, activeWave.count)} / ${activeWave.count}`)
        : `All ${game.waveTotal} waves cleared`)
    : "Idle";
  const banner = game.state === GameState.Playing && activeWave && runtime.spawnDelay > 0
    ? `Wave ${runtime.currentWaveIndex + 1} ${activeWave.label} in ${Math.ceil(runtime.spawnDelay)}`
    : (game.bannerTimer > 0 ? game.bannerText : (game.state === GameState.Menu ? "Awaiting orders" : game.statusText));

  let selectionTitle = "No tower selected";
  let selectionBody = "Choose a build from the toolbar, then click the field to place it.";

  if (selected) {
    selectionTitle = `${getTowerClass(selected.kind).label} Tower · Lv ${selected.level + 1}`;
    selectionBody = `Range ${Math.round(selected.range)} · Upgrade ${formatMoney(selected.upgradeCost)} · Sell ${formatMoney(selected.resaleValue)}`;
  } else if (runtime.placingTower) {
    const towerClass = getTowerClass(runtime.placingTower);
    selectionTitle = `Placing ${towerClass.label}`;
    selectionBody = `${towerClass.summary} Cost ${formatMoney(towerClass.baseCost)}. Click the field to place it.`;
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
    escapes: String(Math.max(0, runtime.escapesLeft)),
    wave,
    banner,
    pauseLabel: game.state === GameState.Paused ? "Resume" : "Pause",
    pauseDisabled: !isBattleState(game.state),
    selectionTitle,
    selectionBody,
    upgradeDisabled: !selected || !selected.canUpgrade() || runtime.money < selected.upgradeCost || isModalState(game.state),
    sellDisabled: !selected || isModalState(game.state),
    selectedTowerPoint: selected && !isModalState(game.state)
      ? { x: selected.x, y: selected.y }
      : undefined,
    placingTower: runtime.placingTower,
    towerButtonsDisabled: isModalState(game.state),
    nerdStats: {
      fps: String(Math.max(0, Math.round(runtimeStats.fps))),
      frameTime: `${runtimeStats.frameTimeMs.toFixed(1)} ms`,
      trackedObjects: String(trackedObjects),
      towers: String(runtime.towers.length),
      hostiles: String(runtime.monsters.length),
      shots: String(shotsTracked),
      effects: String(effectsTracked),
      renderScale: `${game.renderer.currentDpr.toFixed(game.renderer.currentDpr % 1 === 0 ? 0 : 1)}x`,
    },
  };
}

export function createModalView(game: Game): ModalView | null {
  if (game.state === GameState.Menu) {
    const actions = [
      {
        action: game.menuReturnState && game.currentLevel ? "resume" : "play-unlocked",
        label: game.menuReturnState && game.currentLevel ? "Resume Battle" : "Play Unlocked Level",
      },
    ];

    if (game.highestUnlockedLevelIndex > 0 || game.campaignCleared) {
      actions.push({
        action: "restart-campaign",
        label: "Restart Campaign",
      });
    }

    return {
      title: "Campaign Map",
      description: "Ten routed battles, longer wave trains, and short build breaks between pushes. Clear each level to unlock the next.",
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
        { action: "next-level", label: `Continue to Level ${(game.currentLevel?.levelNumber ?? 0) + 1}` },
        { action: "replay", label: "Replay This Level" },
        { action: "campaign-map", label: "Campaign Map" },
      ],
    };
  }

  if (game.state === GameState.CampaignWon) {
    return {
      title: "You Won the Campaign",
      description: "All ten levels are secured. The prototype is now a full campaign run, and the frontier held.",
      centered: true,
      actions: [
        { action: "restart-campaign", label: "Restart Campaign" },
        { action: "replay", label: "Replay Final Level" },
        { action: "campaign-map", label: "Campaign Map" },
      ],
    };
  }

  if (game.state === GameState.Lost) {
    return {
      title: "Defeat",
      description: "The route broke through. Rework the build, lean on the intermissions, and try again.",
      centered: true,
      actions: [
        { action: "replay", label: "Try Again" },
        { action: "campaign-map", label: "Campaign Map" },
      ],
    };
  }

  return null;
}

export function performModalAction(game: Game, action: string): void {
  if (action === "resume") {
    game.resumeBattle();
  } else if (action === "play-unlocked") {
    game.startLevelByIndex(game.campaignCleared ? game.levels.length - 1 : game.highestUnlockedLevelIndex);
  } else if (action === "restart-campaign") {
    game.restartCampaign();
  } else if (action === "next-level") {
    game.startNextLevel();
  } else if (action === "replay") {
    game.restart();
  } else if (action === "campaign-map") {
    game.openMenu();
  }
}

function createModalLevelCards(game: Game): ModalLevelCardView[] {
  return game.levels.map((level, index) => {
    const unlocked = game.campaignCleared || index <= game.highestUnlockedLevelIndex;
    const cleared = game.campaignCleared || index < game.highestUnlockedLevelIndex;
    const current = game.currentLevelIndex === index && !!game.currentLevel;

    return {
      index,
      unlocked,
      cleared,
      current,
      status: !unlocked ? "Locked" : (cleared ? "Cleared" : (index === game.highestUnlockedLevelIndex ? "Next" : "Ready")),
      level,
    };
  });
}
