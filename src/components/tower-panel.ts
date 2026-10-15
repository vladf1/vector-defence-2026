import { h, setAttribute, setProperty, setText, syncChildren } from "../dom";
import type { Tower } from "../entities/towers/tower";
import { TOWER_TOOLBAR_PREVIEWS } from "../entities/towers/tower-registry";
import type { GameSession } from "../game-session";
import type { HudSnapshot } from "../types";
import { formatMoney } from "../utils";

const ICON_SIZE = 60;

interface TowerButton {
  tower: Tower;
  element: HTMLButtonElement;
}

function formatShortcuts(shortcuts: readonly string[]): string {
  return shortcuts.map((shortcut) => shortcut.toUpperCase()).join("/");
}

function drawTowerPreview(canvas: HTMLCanvasElement, tower: Tower): void {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const scaledSize = Math.round(ICON_SIZE * dpr);
  if (canvas.width !== scaledSize || canvas.height !== scaledSize) {
    canvas.width = scaledSize;
    canvas.height = scaledSize;
  }

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, ICON_SIZE, ICON_SIZE);

  tower.draw(context, false);
}

function setButtonLabel(button: HTMLButtonElement, label: string): void {
  setAttribute(button, "aria-label", label);
  setAttribute(button, "title", label);
}

function createActionButton(className: string, onClick: () => void, ...children: Node[]): HTMLButtonElement {
  const button = h("button", { class: className, type: "button" }, ...children);
  button.addEventListener("click", onClick);
  return button;
}

export function createTowerPanel(session: GameSession): HTMLElement {
  const mobile = session.profile.mode === "mobile";
  const showShortcutLabels = session.profile.ui.showShortcutLabels;

  const towerButtons: TowerButton[] = TOWER_TOOLBAR_PREVIEWS.map((tower) => {
    const towerClass = tower.towerClass;
    const meta = h("div", { class: "tower-button-meta" }, h("span", {}, formatMoney(towerClass.baseCost)));
    if (showShortcutLabels) {
      meta.append(h("span", { class: "shortcut-chip" }, formatShortcuts(towerClass.shortcuts)));
    }
    const icon = h("canvas", { class: "tower-icon", "aria-hidden": "true" });
    drawTowerPreview(icon, tower);
    const element = h("button", { class: "tower-button", type: "button", value: tower.kind }, meta, icon);
    element.addEventListener("click", () => session.toggleTowerPlacement(tower.kind));
    element.addEventListener("pointerdown", (event) => session.handleTowerButtonPointerDown(tower.kind, event));
    return { tower, element };
  });
  const towerStrip = h("div", { class: "tower-strip" });

  const selectionName = h("strong", {});
  const selectionSummary = h("span", {});
  const selectionCopy = h("div", { class: "selection-copy" });
  const cancelBuildButton = createActionButton(
    "action-button cancel-build-button",
    session.cancelBuild,
    h("span", { "aria-hidden": "true" }, "×"),
  );
  setButtonLabel(cancelBuildButton, "Cancel build");
  const sellButton = createActionButton(
    "action-button sell selection-sell-button",
    session.sellSelectedTower,
    h("span", { "aria-hidden": "true" }, "💰"),
  );
  setButtonLabel(sellButton, "Sell");
  const selectionHeader = h("div", { class: "selection-header" }, selectionCopy);

  const upgradeValue = h("span", { class: "mobile-action-value" });
  const mobileUpgradeButton = createActionButton(
    "action-button",
    session.upgradeSelectedTower,
    h("span", { "aria-hidden": "true" }, "▲"),
    upgradeValue,
  );
  const laserLockIcon = h("span", { "aria-hidden": "true" });
  const laserLockValue = h("span", { class: "mobile-action-value" });
  const mobileLaserLockButton = createActionButton(
    "action-button",
    session.toggleSelectedLaserLock,
    laserLockIcon,
    laserLockValue,
  );
  const sellValue = h("span", { class: "mobile-action-value" });
  const mobileSellButton = createActionButton(
    "action-button sell",
    session.sellSelectedTower,
    h("span", { "aria-hidden": "true" }, "💰"),
    sellValue,
  );
  const mobileActions = h("div", {
    class: "mobile-selection-actions",
    role: "group",
    "aria-label": "Selected tower actions",
  });

  const selectionCard = h("div", { class: "control-card selection-card" }, selectionHeader);
  const element = h(
    "section",
    { class: "controls-grid" },
    h("div", { class: "tower-strip-card" }, towerStrip),
    selectionCard,
  );

  function updateTowerStrip(hud: HudSnapshot): void {
    const visibleButtons = towerButtons.filter(({ tower }) => hud.availableTowers.includes(tower.kind));
    for (const { tower, element: button } of visibleButtons) {
      const towerClass = tower.towerClass;
      const canAffordTower = hud.affordableTowers[tower.kind];
      const cost = formatMoney(towerClass.baseCost);
      button.classList.toggle("active", hud.placingTower === tower.kind);
      button.classList.toggle("unaffordable", !canAffordTower);
      setAttribute(button, "title", `${towerClass.label} tower: ${canAffordTower ? towerClass.summary : `need ${cost}`}`);
      setAttribute(
        button,
        "aria-label",
        `${towerClass.label} tower for ${cost}. ${canAffordTower ? towerClass.summary : "Not enough money yet."} Shortcuts ${formatShortcuts(towerClass.shortcuts)}.`,
      );
      setProperty(button, "disabled", hud.towerButtonsDisabled);
    }
    syncChildren(towerStrip, visibleButtons.map(({ element: button }) => button));
  }

  function updateSelectionCard(hud: HudSnapshot): void {
    const idle = !hud.hasSelectedTower && !hud.placingTower;
    const mobileIdle = mobile && idle;
    selectionCard.classList.toggle("disabled-selection-panel", hud.towerButtonsDisabled);
    selectionCard.classList.toggle("tower-border-panel", hud.towerButtonsDisabled || (!mobile && idle));
    selectionCard.classList.toggle("idle-selection-card", mobileIdle);
    setAttribute(selectionCard, "aria-disabled", String(hud.towerButtonsDisabled));

    setText(selectionName, mobileIdle ? "Build towers" : hud.selectionName);
    setText(selectionSummary, mobileIdle ? "Tap a tower to inspect" : hud.selectionSummary);
    syncChildren(selectionCopy, [
      ...(mobileIdle || hud.selectionName ? [selectionName] : []),
      ...(mobileIdle || hud.selectionSummary ? [selectionSummary] : []),
    ]);

    setProperty(cancelBuildButton, "disabled", hud.cancelBuildDisabled);
    setProperty(sellButton, "disabled", hud.sellDisabled);
    syncChildren(selectionHeader, [
      selectionCopy,
      ...(hud.placingTower && !hud.hasSelectedTower ? [cancelBuildButton] : []),
      ...(hud.hasSelectedTower && !mobile ? [sellButton] : []),
    ]);

    const showMobileActions = mobile && hud.hasSelectedTower;
    if (showMobileActions) {
      mobileUpgradeButton.classList.toggle("unaffordable", hud.upgradeUnaffordable);
      setButtonLabel(mobileUpgradeButton, hud.upgradeLabel);
      setProperty(mobileUpgradeButton, "disabled", hud.upgradeDisabled);
      setText(upgradeValue, hud.upgradeValue);

      const laserLockLabel = hud.laserLocked ? "Unlock" : "Lock";
      setButtonLabel(mobileLaserLockButton, laserLockLabel);
      setProperty(mobileLaserLockButton, "disabled", hud.laserLockDisabled);
      setText(laserLockIcon, hud.laserLocked ? "🔓" : "🔒");
      setText(laserLockValue, laserLockLabel);

      setButtonLabel(mobileSellButton, hud.sellLabel);
      setProperty(mobileSellButton, "disabled", hud.sellDisabled);
      setText(sellValue, hud.sellValue);

      mobileActions.classList.toggle("laser-actions", hud.hasLaserLockAction);
      syncChildren(mobileActions, [
        mobileUpgradeButton,
        ...(hud.hasLaserLockAction ? [mobileLaserLockButton] : []),
        mobileSellButton,
      ]);
    }
    syncChildren(selectionCard, showMobileActions ? [selectionHeader, mobileActions] : [selectionHeader]);
  }

  session.hud.subscribe((hud) => {
    element.classList.toggle("selected-tower-controls", mobile && hud.hasSelectedTower);
    updateTowerStrip(hud);
    updateSelectionCard(hud);
  });

  session.modal.subscribe((modal) => {
    setProperty(element, "inert", modal !== null);
  });

  return element;
}
