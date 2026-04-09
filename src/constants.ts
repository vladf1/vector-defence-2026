import type { MonsterCode, MonsterPreset, TowerKind, TowerSpec } from "./types";

export const FIELD_WIDTH = 700;
export const FIELD_HEIGHT = 450;
export const TOWER_RADIUS = 10;
export const MAX_TOWER_LEVEL = 6;
export const STARTING_MONEY = 260;
export const UPGRADE_COST = 50;
export const MIN_DISTANCE_TO_ROAD = 20;
export const MIN_DISTANCE_TO_OTHER_TOWERS = 32;
export const PRE_WAVE_DELAY = 5;
export const MAX_PARTICLES = 320;
export const MAX_LINKS = 120;

export const TOWER_SPECS: Record<TowerKind, TowerSpec> = {
  gun: { label: "Gun", cost: 20, range: 60, summary: "Fast, cheap, accurate lead shots." },
  laser: { label: "Laser", cost: 30, range: 100, summary: "Piercing beam that melts lines of enemies." },
  missile: { label: "Missile", cost: 50, range: 150, summary: "Slow launcher with splash damage." },
  slow: { label: "Slow", cost: 30, range: 70, summary: "Freezes clusters so the rest can clean up." },
};

export const MONSTER_PRESETS: Record<MonsterCode, MonsterPreset> = {
  ball: { color: "#5df2ef", speed: 1.5, hp: 200, bounty: 20, radius: 7.5 },
  square: { color: "#ff6f62", speed: 1.25, hp: 150, bounty: 25, radius: 6.5 },
  triangle: { color: "#ffba4f", speed: 1.75, hp: 100, bounty: 30, radius: 7 },
  tank: { color: "#9fb6ff", speed: 0.75, hp: 420, bounty: 55, radius: 10.5 },
  runner: { color: "#91ff63", speed: 2.45, hp: 75, bounty: 18, radius: 5.5 },
};
