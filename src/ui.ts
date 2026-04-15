import { TOWER_SPECS } from "./constants";
import { TowerKind, type HudSnapshot, type LevelData } from "./types";
import { formatMoney, must } from "./utils";

export interface AppElements {
  root: HTMLDivElement;
  canvas: HTMLCanvasElement;
  modal: HTMLDivElement;
  towerStrip: HTMLDivElement;
  banner: HTMLDivElement;
  levelNameValue: HTMLElement;
  moneyValue: HTMLElement;
  escapesValue: HTMLElement;
  waveValue: HTMLElement;
  selectionTitle: HTMLElement;
  selectionBody: HTMLElement;
  pauseButton: HTMLButtonElement;
  levelButton: HTMLButtonElement;
  restartButton: HTMLButtonElement;
  upgradeButton: HTMLButtonElement;
  sellButton: HTMLButtonElement;
  cancelButton: HTMLButtonElement;
  towerButtons: Map<TowerKind, HTMLButtonElement>;
}

export interface ModalActionConfig {
  action: string;
  label: string;
}

export interface ModalLevelCardConfig {
  index: number;
  unlocked: boolean;
  cleared: boolean;
  current: boolean;
  status: string;
  level: LevelData;
}

export interface ModalViewConfig {
  title: string;
  description: string;
  actions: ModalActionConfig[];
  actionClassName?: string;
  levelCards?: ModalLevelCardConfig[];
}

interface ModalHandlers {
  onAction(action: string): void;
  onLevelSelect(index: number): void;
}

export function getAppElements(root: HTMLDivElement): AppElements {
  return {
    root,
    canvas: must(root.querySelector<HTMLCanvasElement>("#game"), "Missing canvas."),
    modal: must(root.querySelector<HTMLDivElement>("#modal"), "Missing modal."),
    towerStrip: must(root.querySelector<HTMLDivElement>("#tower-strip"), "Missing tower strip."),
    banner: must(root.querySelector<HTMLDivElement>("#banner"), "Missing banner."),
    levelNameValue: must(root.querySelector<HTMLElement>("#level-name"), "Missing level name."),
    moneyValue: must(root.querySelector<HTMLElement>("#money-value"), "Missing money value."),
    escapesValue: must(root.querySelector<HTMLElement>("#escapes-value"), "Missing escapes value."),
    waveValue: must(root.querySelector<HTMLElement>("#wave-value"), "Missing wave value."),
    selectionTitle: must(root.querySelector<HTMLElement>("#selection-title"), "Missing selection title."),
    selectionBody: must(root.querySelector<HTMLElement>("#selection-body"), "Missing selection body."),
    pauseButton: must(root.querySelector<HTMLButtonElement>("#pause-button"), "Missing pause button."),
    levelButton: must(root.querySelector<HTMLButtonElement>("#level-button"), "Missing campaign button."),
    restartButton: must(root.querySelector<HTMLButtonElement>("#restart-button"), "Missing restart button."),
    upgradeButton: must(root.querySelector<HTMLButtonElement>("#upgrade-button"), "Missing upgrade button."),
    sellButton: must(root.querySelector<HTMLButtonElement>("#sell-button"), "Missing sell button."),
    cancelButton: must(root.querySelector<HTMLButtonElement>("#cancel-button"), "Missing cancel button."),
    towerButtons: new Map<TowerKind, HTMLButtonElement>(),
  };
}

export function setupTowerButtons(
  elements: AppElements,
  towerKinds: readonly TowerKind[],
  towerShortcuts: Record<TowerKind, string[]>,
  onSelect: (kind: TowerKind) => void,
): void {
  elements.towerStrip.replaceChildren();
  elements.towerButtons.clear();

  for (const kind of towerKinds) {
    const spec = TOWER_SPECS[kind];
    const shortcuts = towerShortcuts[kind].map((shortcut) => shortcut.toUpperCase()).join("/");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tower-button";
    button.title = `${spec.label} tower (${shortcuts})`;
    button.addEventListener("click", () => {
      onSelect(kind);
    });

    const title = document.createElement("strong");
    title.append(`${spec.label} `);

    const shortcutChip = document.createElement("span");
    shortcutChip.className = "shortcut-chip";
    shortcutChip.textContent = shortcuts;
    title.append(shortcutChip);

    const summary = document.createElement("span");
    summary.textContent = `${formatMoney(spec.cost)} · ${spec.summary}`;

    button.append(title, summary);
    elements.towerStrip.append(button);
    elements.towerButtons.set(kind, button);
  }
}

export function applyHudSnapshot(elements: AppElements, snapshot: HudSnapshot, previous?: HudSnapshot): void {
  if (!previous || previous.levelName !== snapshot.levelName) {
    elements.levelNameValue.textContent = snapshot.levelName;
  }
  if (!previous || previous.money !== snapshot.money) {
    elements.moneyValue.textContent = snapshot.money;
  }
  if (!previous || previous.escapes !== snapshot.escapes) {
    elements.escapesValue.textContent = snapshot.escapes;
  }
  if (!previous || previous.wave !== snapshot.wave) {
    elements.waveValue.textContent = snapshot.wave;
  }
  if (!previous || previous.banner !== snapshot.banner) {
    elements.banner.textContent = snapshot.banner;
  }
  if (!previous || previous.pauseLabel !== snapshot.pauseLabel) {
    elements.pauseButton.textContent = snapshot.pauseLabel;
  }
  if (!previous || previous.pauseDisabled !== snapshot.pauseDisabled) {
    elements.pauseButton.disabled = snapshot.pauseDisabled;
  }
  if (!previous || previous.selectionTitle !== snapshot.selectionTitle) {
    elements.selectionTitle.textContent = snapshot.selectionTitle;
  }
  if (!previous || previous.selectionBody !== snapshot.selectionBody) {
    elements.selectionBody.textContent = snapshot.selectionBody;
  }
  if (!previous || previous.upgradeDisabled !== snapshot.upgradeDisabled) {
    elements.upgradeButton.disabled = snapshot.upgradeDisabled;
  }
  if (!previous || previous.sellDisabled !== snapshot.sellDisabled) {
    elements.sellButton.disabled = snapshot.sellDisabled;
  }
  if (!previous || previous.cancelDisabled !== snapshot.cancelDisabled) {
    elements.cancelButton.disabled = snapshot.cancelDisabled;
  }

  for (const [kind, button] of elements.towerButtons.entries()) {
    const isActive = snapshot.placingTower === kind;
    if (!previous || previous.placingTower !== snapshot.placingTower) {
      button.className = `tower-button${isActive ? " active" : ""}`;
    }
    if (!previous || previous.towerButtonsDisabled !== snapshot.towerButtonsDisabled) {
      button.disabled = snapshot.towerButtonsDisabled;
    }
  }
}

export function renderModal(modal: HTMLDivElement, view: ModalViewConfig | null, handlers: ModalHandlers): void {
  if (!view) {
    modal.classList.add("hidden");
    modal.replaceChildren();
    return;
  }

  const panel = document.createElement("div");
  panel.className = "modal-panel";

  const heading = document.createElement("h2");
  heading.textContent = view.title;
  panel.append(heading);

  const description = document.createElement("p");
  description.textContent = view.description;
  panel.append(description);

  if (view.actions.length > 0) {
    const actions = document.createElement("div");
    actions.className = view.actionClassName ? `selection-actions ${view.actionClassName}` : "selection-actions";

    for (const item of view.actions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "modal-button";
      button.textContent = item.label;
      button.addEventListener("click", () => {
        handlers.onAction(item.action);
      });
      actions.append(button);
    }

    panel.append(actions);
  }

  if (view.levelCards) {
    const grid = document.createElement("div");
    grid.className = "level-grid";

    for (const item of view.levelCards) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = [
        "level-card",
        item.unlocked ? "" : "locked",
        item.cleared ? "cleared" : "",
        item.current ? "current" : "",
      ].filter(Boolean).join(" ");
      button.disabled = !item.unlocked;
      button.addEventListener("click", () => {
        handlers.onLevelSelect(item.index);
      });

      const pill = document.createElement("span");
      pill.className = "level-pill";
      pill.textContent = item.status;

      const title = document.createElement("strong");
      title.textContent = `Level ${item.level.levelNumber ?? "?"}: ${item.level.name}`;

      const subtitle = document.createElement("span");
      subtitle.textContent = item.level.subtitle ?? "Hold the route.";

      const meta = document.createElement("small");
      meta.textContent = `${item.level.waves?.length ?? 1} waves · ${item.level.monsterCount} enemies · ${item.level.allowEscape} leaks`;

      button.append(pill, title, subtitle, meta);
      grid.append(button);
    }

    panel.append(grid);
  }

  modal.classList.remove("hidden");
  modal.replaceChildren(panel);
}
