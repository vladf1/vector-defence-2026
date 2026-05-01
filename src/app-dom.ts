import { FIELD_ASPECT_RATIO, FIELD_ASPECT_SCALE, FIELD_HEIGHT, FIELD_WIDTH } from "./constants";
import { TOWER_TOOLBAR_PREVIEWS } from "./entities/towers/tower-registry";
import type { Tower } from "./entities/towers/tower";
import type { GameSession, Unsubscribe } from "./game-session";
import type { HudSnapshot, ModalAction, ModalView, NerdStatsSnapshot, TowerKind } from "./types";
import { formatMoney } from "./utils";

const TOWER_ICON_SIZE = 60;
const NERD_STAT_ITEMS = [
  { key: "fps", label: "FPS:" },
  { key: "frameTime", label: "Frame Time:" },
  { key: "updateTime", label: "Update Avg:" },
  { key: "drawTime", label: "Draw Avg:" },
  { key: "trackedObjects", label: "Tracked:" },
  { key: "towers", label: "Towers:" },
  { key: "hostiles", label: "Hostiles:" },
  { key: "shots", label: "Shots:" },
  { key: "effects", label: "FX:" },
  { key: "pixelRatio", label: "Pixel Ratio:" },
] as const satisfies readonly { key: keyof NerdStatsSnapshot; label: string }[];

interface AppDom {
  root: HTMLElement;
  boardStage: HTMLElement;
  backgroundCanvas: HTMLCanvasElement;
  gameCanvas: HTMLCanvasElement;
  modalRoot: HTMLElement;
  towerStrip: HTMLElement;
  towerButtons: HTMLButtonElement[];
  level: HTMLElement;
  money: HTMLElement;
  wave: HTMLElement;
  selectionTitle: HTMLElement;
  selectionBody: HTMLElement;
  sellTower: HTMLButtonElement;
  soundToggle: HTMLButtonElement;
  soundIcon: HTMLElement;
  openMenu: HTMLButtonElement;
  restart: HTMLButtonElement;
  numberShortcuts: HTMLElement;
  letterShortcuts: HTMLElement;
  nerdToggle: HTMLButtonElement;
  nerdPanel: HTMLElement;
  nerdGrid: HTMLElement;
  nerdStats: Record<keyof NerdStatsSnapshot, HTMLElement>;
  towerButtonTemplate: HTMLTemplateElement;
  nerdStatTemplate: HTMLTemplateElement;
  modalTemplate: HTMLTemplateElement;
  levelCardTemplate: HTMLTemplateElement;
}

interface MountedApp {
  destroy(): void;
}

export function mountApp(root: HTMLElement, session: GameSession): MountedApp {
  const dom = getAppDom(root);
  const unsubs: Unsubscribe[] = [];
  let showNerdStats = false;

  dom.boardStage.style.setProperty("--field-aspect-ratio", String(FIELD_ASPECT_RATIO));
  dom.boardStage.style.setProperty("--field-aspect-scale", String(FIELD_ASPECT_SCALE));
  dom.backgroundCanvas.width = FIELD_WIDTH;
  dom.backgroundCanvas.height = FIELD_HEIGHT;
  dom.gameCanvas.width = FIELD_WIDTH;
  dom.gameCanvas.height = FIELD_HEIGHT;

  renderTowerButtons(dom, session);
  renderNerdStats(dom);
  renderShortcutTip(dom);
  unsubs.push(bindStaticActions(dom, session));

  unsubs.push(session.hud.subscribe((hud) => renderHud(dom, hud)));
  unsubs.push(session.modal.subscribe((modal) => renderModal(dom, session, modal)));
  unsubs.push(session.soundEnabled.subscribe((enabled) => renderSound(dom, enabled)));

  window.addEventListener("keydown", session.handleKeyDown);
  window.addEventListener("resize", session.handleResize);
  dom.gameCanvas.addEventListener("pointermove", session.handleCanvasMove);
  dom.gameCanvas.addEventListener("pointerleave", session.handleCanvasLeave);
  dom.gameCanvas.addEventListener("pointerdown", session.handleCanvasDown);
  dom.nerdToggle.addEventListener("click", toggleNerdStats);

  session.mount(dom.backgroundCanvas, dom.gameCanvas);

  function toggleNerdStats(): void {
    showNerdStats = !showNerdStats;
    dom.nerdPanel.classList.toggle("hidden", !showNerdStats);
    dom.nerdToggle.textContent = showNerdStats ? "Hide stats for nerds" : "Show stats for nerds";
    session.setNerdStatsEnabled(showNerdStats);
  }

  return {
    destroy() {
      session.destroy();
      for (const unsubscribe of unsubs) {
        unsubscribe();
      }
      window.removeEventListener("keydown", session.handleKeyDown);
      window.removeEventListener("resize", session.handleResize);
      dom.gameCanvas.removeEventListener("pointermove", session.handleCanvasMove);
      dom.gameCanvas.removeEventListener("pointerleave", session.handleCanvasLeave);
      dom.gameCanvas.removeEventListener("pointerdown", session.handleCanvasDown);
      dom.nerdToggle.removeEventListener("click", toggleNerdStats);
    },
  };
}

function getAppDom(root: HTMLElement): AppDom {
  return {
    root,
    boardStage: getRequiredElement(root, "[data-board-stage]", HTMLElement),
    backgroundCanvas: getRequiredElement(root, "[data-background-canvas]", HTMLCanvasElement),
    gameCanvas: getRequiredElement(root, "[data-game-canvas]", HTMLCanvasElement),
    modalRoot: getRequiredElement(root, "[data-modal-root]", HTMLElement),
    towerStrip: getRequiredElement(root, "[data-tower-strip]", HTMLElement),
    towerButtons: [],
    level: getRequiredElement(root, "[data-hud-level]", HTMLElement),
    money: getRequiredElement(root, "[data-hud-money]", HTMLElement),
    wave: getRequiredElement(root, "[data-hud-wave]", HTMLElement),
    selectionTitle: getRequiredElement(root, "[data-selection-title]", HTMLElement),
    selectionBody: getRequiredElement(root, "[data-selection-body]", HTMLElement),
    sellTower: getRequiredElement(root, "[data-sell-tower]", HTMLButtonElement),
    soundToggle: getRequiredElement(root, "[data-sound-toggle]", HTMLButtonElement),
    soundIcon: getRequiredElement(root, ".sound-icon", HTMLElement),
    openMenu: getRequiredElement(root, "[data-open-menu]", HTMLButtonElement),
    restart: getRequiredElement(root, "[data-restart]", HTMLButtonElement),
    numberShortcuts: getRequiredElement(root, "[data-number-shortcuts]", HTMLElement),
    letterShortcuts: getRequiredElement(root, "[data-letter-shortcuts]", HTMLElement),
    nerdToggle: getRequiredElement(root, "[data-toggle-nerd-stats]", HTMLButtonElement),
    nerdPanel: getRequiredElement(root, "[data-nerd-panel]", HTMLElement),
    nerdGrid: getRequiredElement(root, "[data-nerd-grid]", HTMLElement),
    nerdStats: {} as Record<keyof NerdStatsSnapshot, HTMLElement>,
    towerButtonTemplate: getRequiredElement(document, "#tower-button-template", HTMLTemplateElement),
    nerdStatTemplate: getRequiredElement(document, "#nerd-stat-template", HTMLTemplateElement),
    modalTemplate: getRequiredElement(document, "#modal-template", HTMLTemplateElement),
    levelCardTemplate: getRequiredElement(document, "#level-card-template", HTMLTemplateElement),
  };
}

function bindStaticActions(dom: AppDom, session: GameSession): Unsubscribe {
  dom.soundToggle.addEventListener("click", session.toggleSound);
  dom.openMenu.addEventListener("click", session.openMenu);
  dom.restart.addEventListener("click", session.restart);
  dom.sellTower.addEventListener("click", session.sellSelectedTower);

  return () => {
    dom.soundToggle.removeEventListener("click", session.toggleSound);
    dom.openMenu.removeEventListener("click", session.openMenu);
    dom.restart.removeEventListener("click", session.restart);
    dom.sellTower.removeEventListener("click", session.sellSelectedTower);
  };
}

function renderShortcutTip(dom: AppDom): void {
  dom.numberShortcuts.textContent = TOWER_TOOLBAR_PREVIEWS
    .map((tower) => tower.towerClass.shortcuts[0]?.toUpperCase() ?? "")
    .join("-");
  dom.letterShortcuts.textContent = TOWER_TOOLBAR_PREVIEWS
    .map((tower) => tower.towerClass.shortcuts[1]?.toUpperCase() ?? "")
    .join("/");
}

function renderTowerButtons(dom: AppDom, session: GameSession): void {
  dom.towerStrip.replaceChildren();
  dom.towerButtons = [];

  for (const preview of TOWER_TOOLBAR_PREVIEWS) {
    const button = cloneTemplateElement(dom.towerButtonTemplate, HTMLButtonElement);
    const towerClass = preview.towerClass;
    const shortcuts = formatShortcuts(towerClass.shortcuts);
    const canvas = getRequiredElement(button, "canvas", HTMLCanvasElement);

    button.value = preview.kind;
    button.title = `${towerClass.label} tower: ${towerClass.summary}`;
    button.ariaLabel = `${towerClass.label} tower for ${formatMoney(towerClass.baseCost)}. ${towerClass.summary} Shortcuts ${shortcuts}.`;
    setText(button, "[data-tower-cost]", formatMoney(towerClass.baseCost));
    setText(button, "[data-tower-shortcuts]", shortcuts);
    drawTowerPreview(canvas, preview);

    button.addEventListener("click", () => session.toggleTowerPlacement(preview.kind));
    button.addEventListener("pointerdown", (event) => session.handleTowerButtonPointerDown(preview.kind, event));
    dom.towerButtons.push(button);
    dom.towerStrip.append(button);
  }
}

function renderNerdStats(dom: AppDom): void {
  dom.nerdGrid.replaceChildren();

  for (const item of NERD_STAT_ITEMS) {
    const stat = cloneTemplateElement(dom.nerdStatTemplate, HTMLDivElement);
    const value = getRequiredElement(stat, "strong", HTMLElement);

    setText(stat, "[data-nerd-label]", item.label);
    value.dataset.nerdStat = item.key;
    dom.nerdStats[item.key] = value;
    dom.nerdGrid.append(stat);
  }
}

function renderHud(dom: AppDom, hud: HudSnapshot): void {
  dom.level.textContent = hud.levelName;
  dom.money.textContent = hud.money;
  dom.wave.textContent = hud.wave;
  dom.selectionTitle.textContent = hud.selectionTitle;
  dom.selectionTitle.classList.toggle("hidden", hud.selectionTitle.length === 0);
  dom.selectionBody.textContent = hud.selectionBody;
  dom.sellTower.disabled = hud.sellDisabled;
  dom.sellTower.classList.toggle("hidden", !hud.hasSelectedTower);

  for (const button of dom.towerButtons) {
    const kind = button.value as TowerKind;
    button.disabled = hud.towerButtonsDisabled;
    button.classList.toggle("active", hud.placingTower === kind);
  }

  for (const key of Object.keys(dom.nerdStats) as Array<keyof NerdStatsSnapshot>) {
    dom.nerdStats[key].textContent = hud.nerdStats[key];
  }
}

function renderSound(dom: AppDom, enabled: boolean): void {
  const label = enabled ? "Mute sound" : "Unmute sound";
  dom.soundToggle.ariaLabel = label;
  dom.soundToggle.ariaPressed = String(enabled);
  dom.soundToggle.title = label;
  dom.soundIcon.textContent = enabled ? "🔊" : "🔇";
}

function renderModal(dom: AppDom, session: GameSession, modal: ModalView | null): void {
  dom.modalRoot.replaceChildren();

  if (!modal) {
    return;
  }

  const modalElement = cloneTemplateElement(dom.modalTemplate, HTMLDivElement);
  const panel = getRequiredElement(modalElement, ".modal-panel", HTMLDivElement);
  const copy = getRequiredElement(modalElement, "[data-modal-copy]", HTMLElement);
  const actions = getRequiredElement(modalElement, "[data-modal-actions]", HTMLDivElement);
  const levelGrid = getRequiredElement(modalElement, "[data-level-grid]", HTMLDivElement);

  modalElement.classList.toggle("centered", modal.centered === true);
  panel.classList.toggle("centered", modal.centered === true);

  if (modal.levelCards) {
    copy.classList.add("hidden");
    for (const card of modal.levelCards) {
      const cardButton = cloneTemplateElement(dom.levelCardTemplate, HTMLButtonElement);
      cardButton.disabled = !card.unlocked;
      cardButton.classList.toggle("locked", !card.unlocked);
      cardButton.classList.toggle("cleared", card.cleared);
      cardButton.classList.toggle("current", card.current);
      setText(cardButton, "[data-level-status]", card.status);
      setText(cardButton, "[data-level-title]", `Level ${card.level.levelNumber ?? "?"}: ${card.level.name}`);
      setText(cardButton, "[data-level-subtitle]", card.level.subtitle ?? "Hold the route.");
      setText(
        cardButton,
        "[data-level-details]",
        `${card.level.waves?.length ?? 1} waves · ${card.level.monsterCount} enemies · ${card.level.allowEscape} leaks`,
      );
      cardButton.addEventListener("click", () => session.selectLevel(card.index));
      levelGrid.append(cardButton);
    }
  } else {
    levelGrid.classList.add("hidden");
    setText(panel, "[data-modal-title]", modal.title);
    setText(panel, "[data-modal-description]", modal.description);
    actions.className = `selection-actions ${modal.actionClassName ?? ""}`.trim();
    for (const action of modal.actions) {
      actions.append(createModalButton(action.label, action.action, session));
    }
  }

  dom.modalRoot.append(modalElement);
}

function createModalButton(label: string, action: ModalAction, session: GameSession): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "modal-button";
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", () => session.handleModalAction(action));
  return button;
}

function drawTowerPreview(canvas: HTMLCanvasElement, tower: Tower): void {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const cssSize = `${TOWER_ICON_SIZE}px`;

  if (canvas.style.width !== cssSize) {
    canvas.style.width = cssSize;
    canvas.style.height = cssSize;
  }

  const scaledSize = Math.round(TOWER_ICON_SIZE * dpr);
  if (canvas.width !== scaledSize || canvas.height !== scaledSize) {
    canvas.width = scaledSize;
    canvas.height = scaledSize;
  }

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, TOWER_ICON_SIZE, TOWER_ICON_SIZE);
  tower.draw(context, false);
}

function formatShortcuts(shortcuts: readonly string[]): string {
  return shortcuts.map((shortcut) => shortcut.toUpperCase()).join("/");
}

function setText(parent: ParentNode, selector: string, text: string): void {
  getRequiredElement(parent, selector, HTMLElement).textContent = text;
}

function cloneTemplateElement<T extends HTMLElement>(
  template: HTMLTemplateElement,
  elementType: { new(): T },
): T {
  const firstElement = template.content.firstElementChild;
  if (!firstElement) {
    throw new Error(`Template #${template.id} is empty.`);
  }

  const clone = firstElement.cloneNode(true);
  if (!(clone instanceof elementType)) {
    throw new Error(`Template #${template.id} has an unexpected root element.`);
  }

  return clone;
}

function getRequiredElement<T extends Element>(
  parent: ParentNode,
  selector: string,
  elementType: { new(): T },
): T {
  const element = parent.querySelector(selector);
  if (!(element instanceof elementType)) {
    throw new Error(`Missing required element: ${selector}`);
  }

  return element;
}
