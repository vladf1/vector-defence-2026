import { TowerKind } from "../../types";
import { GunTower } from "./gun-tower";
import { LaserTower } from "./laser-tower";
import { MissileTower } from "./missile-tower";
import { SlowTower } from "./slow-tower";
import type { Tower, TowerClass } from "./tower";

const PREVIEW_CENTER = 30;

export const TOWER_CLASSES = [
  GunTower,
  LaserTower,
  MissileTower,
  SlowTower,
] as const satisfies readonly TowerClass[];

export const TOWER_PREVIEW_TOWERS = [
  Object.assign(new GunTower(PREVIEW_CENTER, PREVIEW_CENTER), { angle: -Math.PI / 4 }),
  Object.assign(new LaserTower(PREVIEW_CENTER, PREVIEW_CENTER), { angle: -Math.PI / 10 }),
  Object.assign(new MissileTower(PREVIEW_CENTER, PREVIEW_CENTER), { angle: -Math.PI / 6 }),
  Object.assign(new SlowTower(PREVIEW_CENTER, PREVIEW_CENTER), { pulse: Math.PI / 2 }),
] as const satisfies readonly Tower[];

const TOWER_CLASS_BY_KIND = TOWER_CLASSES.reduce<Record<TowerKind, TowerClass>>((classes, towerClass) => {
  classes[towerClass.kind] = towerClass;
  return classes;
}, {} as Record<TowerKind, TowerClass>);

const TOWER_KIND_BY_SHORTCUT: Record<string, TowerKind> = Object.fromEntries(
  TOWER_CLASSES.flatMap((towerClass) => towerClass.shortcuts.map((shortcut) => [shortcut, towerClass.kind] as const)),
) as Record<string, TowerKind>;

export function getTowerClass(kind: TowerKind): TowerClass {
  return TOWER_CLASS_BY_KIND[kind];
}

export function findTowerShortcut(key: string): TowerKind | undefined {
  return TOWER_KIND_BY_SHORTCUT[key.toLowerCase()];
}
