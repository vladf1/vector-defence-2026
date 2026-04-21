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
  const selected = game.selectedTower;
  const activeWave = game.activeWave;
  const levelName = game.currentLevel
    ? `${game.currentLevel.levelNumber ?? "?"} · ${game.currentLevel.name}`
    : "Campaign Map";
  const wave = game.currentLevel
    ? (activeWave
        ? (game.state === GameState.Playing && game.spawnDelay > 0
            ? `Wave ${game.currentWaveIndex + 1}/${game.waveTotal}`
            : `Wave ${game.currentWaveIndex + 1}/${game.waveTotal} · ${Math.min(game.waveSpawnedMonsters, activeWave.count)} / ${activeWave.count}`)
        : `All ${game.waveTotal} waves cleared`)
    : "Idle";
  const banner = game.state === GameState.Playing && activeWave && game.spawnDelay > 0
    ? `Wave ${game.currentWaveIndex + 1} ${activeWave.label} in ${Math.ceil(game.spawnDelay)}`
    : (game.bannerTimer > 0 ? game.bannerText : (game.state === GameState.Menu ? "Awaiting orders" : game.statusText));

  let selectionTitle = "No tower selected";
  let selectionBody = "Choose a build from the toolbar, then click the field to place it.";

  if (selected) {
    selectionTitle = `${getTowerClass(selected.kind).label} Tower · Lv ${selected.level + 1}`;
    selectionBody = `Range ${Math.round(selected.range)} · Upgrade ${formatMoney(selected.upgradeCost)} · Sell ${formatMoney(selected.resaleValue)}`;
  } else if (game.placingTower) {
    const towerClass = getTowerClass(game.placingTower);
    selectionTitle = `Placing ${towerClass.label}`;
    selectionBody = `${towerClass.summary} Cost ${formatMoney(towerClass.baseCost)}. Click the field to place it.`;
  } else if (game.currentLevel) {
    selectionTitle = game.currentLevel.name;
    selectionBody = game.currentLevel.subtitle ?? "Hold the route and keep your towers overlapping.";
  }

  const shotsTracked = game.projectiles.length + game.missiles.length;
  const effectsTracked = game.particles.length + game.links.length;
  const trackedObjects = game.towers.length + game.monsters.length + shotsTracked + effectsTracked;

  return {
    levelName,
    money: formatMoney(game.money),
    escapes: String(Math.max(0, game.escapesLeft)),
    wave,
    banner,
    pauseLabel: game.state === GameState.Paused ? "Resume" : "Pause",
    pauseDisabled: !isBattleState(game.state),
    selectionTitle,
    selectionBody,
    upgradeDisabled: !selected || !selected.canUpgrade() || game.money < selected.upgradeCost || isModalState(game.state),
    sellDisabled: !selected || isModalState(game.state),
    selectedTowerPoint: selected && !isModalState(game.state)
      ? { x: selected.x, y: selected.y }
      : undefined,
    placingTower: game.placingTower,
    towerButtonsDisabled: isModalState(game.state),
    nerdStats: {
      fps: String(Math.max(0, Math.round(runtimeStats.fps))),
      frameTime: `${runtimeStats.frameTimeMs.toFixed(1)} ms`,
      trackedObjects: String(trackedObjects),
      towers: String(game.towers.length),
      hostiles: String(game.monsters.length),
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
