import { TowerKind } from "../../types";
import { GunTower } from "./gun-tower";
import { LaserTower } from "./laser-tower";
import { MissileTower } from "./missile-tower";
import { SlowTower } from "./slow-tower";
import type { TowerClass } from "./tower";

export const TOWER_CLASSES = [GunTower, LaserTower, MissileTower, SlowTower] as const satisfies readonly TowerClass[];

const TOWER_KIND_BY_SHORTCUT: Record<string, TowerKind> = Object.fromEntries(
  TOWER_CLASSES.flatMap((towerClass) => towerClass.shortcuts.map((shortcut) => [shortcut, towerClass.kind] as const)),
) as Record<string, TowerKind>;

export function getTowerClass(kind: TowerKind): TowerClass {
  switch (kind) {
    case TowerKind.Gun:
      return GunTower;
    case TowerKind.Laser:
      return LaserTower;
    case TowerKind.Missile:
      return MissileTower;
    case TowerKind.Slow:
      return SlowTower;
  }
}

export function findTowerShortcut(key: string): TowerKind | undefined {
  return TOWER_KIND_BY_SHORTCUT[key.toLowerCase()];
}
