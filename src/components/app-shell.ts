import { h, setProperty } from "../dom";
import type { GameProfile } from "../game-profile";
import { createGameSession, type GameSession } from "../game-session";
import { createChromeBar } from "./chrome-bar";
import { createGameBoard } from "./game-board";
import { createNerdStatsPanel, type NerdStatsPanel } from "./nerd-stats-panel";
import { createTowerPanel } from "./tower-panel";

function createFootnote(session: GameSession, shell: HTMLElement): HTMLElement {
  let nerdStatsPanel: NerdStatsPanel | null = null;
  const toggle = h("button", { class: "footnote-link", type: "button" }, "Show stats for nerds");
  toggle.addEventListener("click", () => {
    const showNerdStats = nerdStatsPanel === null;
    if (nerdStatsPanel) {
      nerdStatsPanel.destroy();
      nerdStatsPanel = null;
    } else {
      nerdStatsPanel = createNerdStatsPanel(session);
      shell.append(nerdStatsPanel.element);
    }
    toggle.textContent = `${showNerdStats ? "Hide" : "Show"} stats for nerds`;
    shell.classList.toggle("nerd-stats-open", showNerdStats);
    session.setNerdStatsEnabled(showNerdStats);
  });

  const footnote = h(
    "p",
    { class: "footnote" },
    "Tip: press the tower keys shown on available buttons, ",
    h("strong", {}, "U"),
    " to upgrade, ",
    h("strong", {}, "Esc"),
    " to cancel build mode, and ",
    h("strong", {}, "Space"),
    " to pause or resume. ",
    toggle,
  );
  session.modal.subscribe((modal) => {
    setProperty(footnote, "inert", modal !== null);
  });
  return footnote;
}

export function mountApp(target: HTMLElement, profile: GameProfile): void {
  const session = createGameSession(profile);
  const shell = h("div", {
    class: profile.mode === "mobile" ? "shell mobile-shell" : "shell",
    style: `--field-aspect-scale: ${profile.fieldAspectScale};`,
  });

  if (profile.ui.portraitOnly) {
    shell.append(h(
      "div",
      { class: "orientation-blocker" },
      h("strong", {}, "Rotate to portrait"),
      h("span", {}, "Vector Defence mobile is tuned for upright play."),
    ));
  }

  const board = createGameBoard(session);
  shell.append(createChromeBar(session), board.element, createTowerPanel(session));
  if (profile.ui.showFootnote) {
    shell.append(createFootnote(session, shell));
  }

  target.append(shell);
  window.addEventListener("keydown", session.handleKeyDown);
  board.mount();
}
