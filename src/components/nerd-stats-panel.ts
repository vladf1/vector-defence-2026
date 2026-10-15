import { h, setText } from "../dom";
import type { GameSession } from "../game-session";
import type { HudSnapshot } from "../types";

type NerdStatKey = keyof HudSnapshot["nerdStats"];

const NERD_STATS: readonly { key: NerdStatKey; label: string }[] = [
  { key: "fps", label: "FPS" },
  { key: "frameTime", label: "Frame Time" },
  { key: "updateTime", label: "Update Avg" },
  { key: "drawTime", label: "Draw Avg" },
  { key: "trackedObjects", label: "Tracked" },
  { key: "towers", label: "Towers" },
  { key: "hostiles", label: "Hostiles" },
  { key: "shots", label: "Shots" },
  { key: "effects", label: "FX" },
];

export interface NerdStatsPanel {
  element: HTMLElement;
  destroy: () => void;
}

export function createNerdStatsPanel(session: GameSession): NerdStatsPanel {
  const values = NERD_STATS.map(() => h("strong", {}));
  const element = h(
    "section",
    { class: "nerd-panel" },
    h("div", { class: "nerd-grid" }, ...NERD_STATS.map((stat, index) => (
      h("div", { class: "nerd-stat" }, h("span", {}, `${stat.label}:`), values[index])
    ))),
  );

  const unsubscribe = session.hud.subscribe((hud) => {
    NERD_STATS.forEach((stat, index) => setText(values[index], hud.nerdStats[stat.key]));
  });

  return {
    element,
    destroy: () => {
      unsubscribe();
      element.remove();
    },
  };
}
