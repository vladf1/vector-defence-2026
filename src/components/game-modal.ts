import { h } from "../dom";
import type { GameSession } from "../game-session";
import type { ModalLevelCardView, ModalStarAwardView, ModalView } from "../types";

const STAR_VALUES = [1, 2, 3];

function createStars(earnedStars: number, starAttributes: Readonly<Record<string, string>>): HTMLSpanElement[] {
  return STAR_VALUES.map((star) => h("span", star <= earnedStars ? { ...starAttributes, class: "earned" } : starAttributes, "★"));
}

function containTab(event: KeyboardEvent): void {
  if (event.key !== "Tab" || !(event.currentTarget instanceof HTMLElement)) return;
  const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
  const first = buttons[0], last = buttons[buttons.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

/** Shows the campaign/result dialog inside `container` whenever the session publishes a modal view. */
export function createGameModal(session: GameSession, container: HTMLElement): void {
  const panel = h("div", {});
  const dialog = h("div", { role: "dialog", "aria-modal": "true", tabindex: "-1" }, panel);
  dialog.addEventListener("keydown", containTab);
  let renderedView = "";
  let opener: Element | null = null;

  function createActions(view: ModalView): HTMLElement[] {
    if (view.actions.length === 0) return [];
    return [h("div", { class: "selection-actions" }, ...view.actions.map((item) => {
      const button = h("button", { class: `modal-button modal-action-${item.action}`, type: "button" }, item.label);
      button.addEventListener("click", () => session.handleModalAction(item.action));
      return button;
    }))];
  }

  function createStarAward(award: ModalStarAwardView): HTMLElement {
    return h(
      "div",
      { class: `star-award${award.perfect ? " perfect-award" : ""}`, "aria-label": award.label },
      h("div", { class: "star-award-row", "aria-hidden": "true" }, ...createStars(award.stars, {})),
      h("strong", {}, award.title),
      h("span", {}, award.description),
    );
  }

  function createLevelCard(item: ModalLevelCardView): HTMLButtonElement {
    const button = h(
      "button",
      {
        class: `level-card${item.unlocked ? "" : " locked"}${item.cleared ? " cleared" : ""}${item.current ? " current" : ""}`,
        type: "button",
      },
      h("div", { class: "level-card-heading" }, h("strong", {}, item.title), h("span", { class: "level-pill" }, item.status)),
      ...(item.stars > 0
        ? [h("span", { class: "level-stars", "aria-label": item.starsLabel }, ...createStars(item.stars, { "aria-hidden": "true" }))]
        : []),
      h("span", {}, item.description),
      h("small", {}, item.summary),
    );
    button.disabled = !item.unlocked;
    button.addEventListener("click", () => session.selectLevel(item.index));
    return button;
  }

  function render(view: ModalView): void {
    // Views are plain data and are republished on every forced HUD sync; rebuilding identical
    // content would reset focus, hover, and level-grid scroll for no visible change.
    const serializedView = JSON.stringify(view);
    if (serializedView === renderedView) return;
    renderedView = serializedView;

    dialog.className = `modal${view.sheet ? " sheet" : ""}`;
    dialog.setAttribute("aria-label", view.title);
    panel.className = `modal-panel${view.sheet ? " modal-sheet" : ""}${view.levelCards ? " level-map-panel" : ""}`;

    if (!view.levelCards) {
      panel.replaceChildren(
        h("h2", {}, view.title),
        h("p", {}, view.description),
        ...(view.starAward ? [createStarAward(view.starAward)] : []),
        ...createActions(view),
      );
      return;
    }

    panel.replaceChildren(
      h(
        "div",
        { class: "level-map-header" },
        h("div", {}, h("h2", {}, view.title), h("p", {}, view.description)),
        ...createActions(view),
      ),
      h("div", { class: "level-grid" }, ...view.levelCards.map(createLevelCard)),
    );
  }

  function focusFirst(): void {
    if (dialog.isConnected && !dialog.contains(document.activeElement)) {
      (dialog.querySelector<HTMLButtonElement>("button:not(:disabled)") ?? dialog).focus();
    }
  }

  session.modal.subscribe((view) => {
    if (!view) {
      if (dialog.isConnected) {
        dialog.remove();
        renderedView = "";
        const closedOpener = opener;
        opener = null;
        queueMicrotask(() => {
          if (!session.modal.get() && closedOpener instanceof HTMLElement && closedOpener.isConnected) closedOpener.focus();
        });
      }
      return;
    }

    if (!dialog.isConnected) {
      opener = document.activeElement;
      container.append(dialog);
    }
    render(view);
    queueMicrotask(focusFirst);
  });
}
