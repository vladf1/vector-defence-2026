import { h, setProperty, setText, syncChildren } from "../dom";
import type { GameSession } from "../game-session";
import { createGameModal } from "./game-modal";

export interface GameBoard {
  element: HTMLElement;
  /** Starts the game on the board canvases; call once the board is in the document. */
  mount: () => void;
}

export function createGameBoard(session: GameSession): GameBoard {
  const profile = session.profile;
  const canvasSize = { width: String(profile.fieldWidth), height: String(profile.fieldHeight) };
  const backgroundCanvas = h("canvas", { class: "board-canvas board-background", ...canvasSize, "aria-hidden": "true" });
  const gameCanvas = h("canvas", { class: "board-canvas board-game", id: "game", ...canvasSize });
  gameCanvas.addEventListener("pointermove", session.handleCanvasMove);
  gameCanvas.addEventListener("pointerleave", session.handleCanvasLeave);
  gameCanvas.addEventListener("pointerdown", session.handleCanvasDown);

  const skipBannerText = h("span", { class: "board-banner-text" });
  const skipBanner = h(
    "button",
    { type: "button", class: "board-banner skippable", "aria-label": "Start the next wave now" },
    skipBannerText,
    h("span", { class: "board-banner-action", "aria-hidden": "true" }, "SKIP »"),
  );
  skipBanner.addEventListener("click", (event) => {
    event.stopPropagation();
    session.skipBreak();
  });
  const statusBannerText = h("span", { class: "board-banner-text" });
  const statusBanner = h("div", { class: "board-banner", role: "status", "aria-live": "polite" }, statusBannerText);

  const stage = h("div", {
    class: "board-stage",
    style: `--field-aspect-ratio: ${profile.fieldAspectRatio}; --field-aspect-scale: ${profile.fieldAspectScale};`,
  });
  const frame = h("div", { class: "board-frame" }, stage);
  const element = h("section", { class: "board-card" }, frame);

  session.hud.subscribe((hud) => {
    const banner = hud.banner ? (hud.canSkipBreak ? skipBanner : statusBanner) : null;
    if (banner) {
      setText(banner === skipBanner ? skipBannerText : statusBannerText, hud.banner);
    }
    syncChildren(stage, banner ? [backgroundCanvas, gameCanvas, banner] : [backgroundCanvas, gameCanvas]);
  });

  session.modal.subscribe((modal) => {
    setProperty(stage, "inert", modal !== null);
  });

  createGameModal(session, frame);

  return {
    element,
    mount: () => session.mount(backgroundCanvas, gameCanvas),
  };
}
