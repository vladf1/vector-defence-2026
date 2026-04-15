import type { TowerKind, TowerSpec } from "./types";

export const FIELD_WIDTH = 700;
export const FIELD_HEIGHT = 450;
export const TOWER_RADIUS = 10;
export const MAX_TOWER_LEVEL = 6;
export const STARTING_MONEY = 260;
export const UPGRADE_COST = 50;
export const MIN_DISTANCE_TO_ROAD = 20;
export const MIN_DISTANCE_TO_OTHER_TOWERS = 32;
export const MAX_PARTICLES = 2000;
export const MAX_LINKS = 120;

export const TOWER_SPECS: Record<TowerKind, TowerSpec> = {
  gun: { label: "Gun", cost: 20, range: 60, summary: "Fast, cheap, accurate lead shots." },
  laser: { label: "Laser", cost: 30, range: 100, summary: "Piercing beam that melts lines of enemies." },
  missile: { label: "Missile", cost: 50, range: 150, summary: "Slow launcher with splash damage." },
  slow: { label: "Slow", cost: 30, range: 70, summary: "Freezes clusters so the rest can clean up." },
};
