import { createProceduralLevel } from "./level-generator";
import type { LevelData } from "./types";

export const RANDOM_ROUTE_ACTION = "procedural-level";
export const RANDOM_ROUTE_MENU_COPY = "The classic routes come from the old Silverlight XML, and the random route spins up a brand-new long path every time you launch it.";

export function renderRandomRouteCard(): string {
  return `
    <button class="level-card procedural-card" data-action="${RANDOM_ROUTE_ACTION}">
      <strong>Random Route</strong>
      <span>Long path with diagonals and surprises</span>
    </button>
  `;
}

export function resolveRandomRoute(action: string | undefined): LevelData | undefined {
  if (action !== RANDOM_ROUTE_ACTION) {
    return undefined;
  }

  return createProceduralLevel();
}
