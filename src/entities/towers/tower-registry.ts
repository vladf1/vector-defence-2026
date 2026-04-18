import { TowerKind } from "../../types";
import { GunTower } from "./gun-tower";
import { LaserTower } from "./laser-tower";
import { MissileTower } from "./missile-tower";
import { SlowTower } from "./slow-tower";
import type { TowerClass } from "./tower";

export const TOWER_CLASSES = [GunTower, LaserTower, MissileTower, SlowTower] as const satisfies readonly TowerClass[];

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
  const normalizedKey = key.toLowerCase();
  return TOWER_CLASSES.find((towerClass) => towerClass.shortcuts.some((shortcut) => shortcut === normalizedKey))?.kind;
}
