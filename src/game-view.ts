import { STARTING_MONEY, TOWER_SPECS } from "./constants";
import { isBattleState, isModalState } from "./game-engine";
import { formatMoney } from "./utils";
import type { Game } from "./game-engine";
import type { HudSnapshot, ModalLevelCardView, ModalView } from "./types";

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
  cancelDisabled: true,
  towerButtonsDisabled: true,
};

export function createHudSnapshot(game: Game): HudSnapshot {
  const selected = game.selectedTower;
  const activeWave = game.activeWave;
  const levelName = game.currentLevel
    ? `Level ${game.currentLevel.levelNumber ?? "?"} · ${game.currentLevel.name}`
    : "Campaign Map";
  const wave = game.currentLevel
    ? (activeWave && game.state === "playing" && game.spawnDelay > 0
        ? `Wave ${game.currentWaveIndex + 1}/${game.waveTotal} in ${Math.ceil(game.spawnDelay)}s`
        : activeWave
          ? `Wave ${game.currentWaveIndex + 1}/${game.waveTotal} · ${Math.min(game.waveSpawnedMonsters, activeWave.count)} / ${activeWave.count}`
          : `All ${game.waveTotal} waves cleared`)
    : "Idle";
  const banner = game.state === "playing" && activeWave && game.spawnDelay > 0
    ? `Wave ${game.currentWaveIndex + 1} ${activeWave.label} in ${Math.ceil(game.spawnDelay)}`
    : (game.bannerTimer > 0 ? game.bannerText : (game.state === "menu" ? "Awaiting orders" : game.statusText));

  let selectionTitle = "No tower selected";
  let selectionBody = "Choose a build from the toolbar, then click the field to place it.";

  if (selected) {
    selectionTitle = `${TOWER_SPECS[selected.kind].label} Tower · Lv ${selected.level + 1}`;
    selectionBody = `Range ${Math.round(selected.range)} · Upgrade ${formatMoney(selected.upgradeCost)} · Sell ${formatMoney(selected.resaleValue)}`;
  } else if (game.placingTower) {
    const spec = TOWER_SPECS[game.placingTower];
    selectionTitle = `Placing ${spec.label}`;
    selectionBody = `${spec.summary} Cost ${formatMoney(spec.cost)}. Click the field to place it.`;
  } else if (game.currentLevel) {
    selectionTitle = game.currentLevel.name;
    selectionBody = game.currentLevel.subtitle ?? "Hold the route and keep your towers overlapping.";
  }

  game.hudDirty = false;

  return {
    levelName,
    money: formatMoney(game.money),
    escapes: String(Math.max(0, game.escapesLeft)),
    wave,
    banner,
    pauseLabel: game.state === "paused" ? "Resume" : "Pause",
    pauseDisabled: !isBattleState(game.state),
    selectionTitle,
    selectionBody,
    upgradeDisabled: !selected || !selected.canUpgrade() || game.money < selected.upgradeCost || isModalState(game.state),
    sellDisabled: !selected || isModalState(game.state),
    cancelDisabled: !game.placingTower || isModalState(game.state),
    placingTower: game.placingTower,
    towerButtonsDisabled: isModalState(game.state),
  };
}

export function createModalView(game: Game): ModalView | null {
  game.modalDirty = false;

  if (game.state === "menu") {
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

  if (game.state === "won") {
    return {
      title: "Level Clear",
      description: `Level ${game.currentLevel?.levelNumber ?? "?"} is secure. Keep the pressure on and push into the next route.`,
      actions: [
        { action: "next-level", label: `Continue to Level ${(game.currentLevel?.levelNumber ?? 0) + 1}` },
        { action: "replay", label: "Replay This Level" },
        { action: "campaign-map", label: "Campaign Map" },
      ],
    };
  }

  if (game.state === "campaign-won") {
    return {
      title: "You Won the Campaign",
      description: "All ten levels are secured. The prototype is now a full campaign run, and the frontier held.",
      actions: [
        { action: "restart-campaign", label: "Restart Campaign" },
        { action: "replay", label: "Replay Final Level" },
        { action: "campaign-map", label: "Campaign Map" },
      ],
    };
  }

  if (game.state === "lost") {
    return {
      title: "Defeat",
      description: "The route broke through. Rework the build, lean on the intermissions, and try again.",
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
