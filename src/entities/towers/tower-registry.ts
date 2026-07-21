import { TowerKind } from "../../types";
import { DroneTower } from "./drone-tower";
import { GunTower } from "./gun-tower";
import { LaserTower } from "./laser-tower";
import { LightningTower } from "./lightning-tower";
import { MissileTower } from "./missile-tower";
import { SlowTower } from "./slow-tower";
import type { Tower, TowerClass } from "./tower";

const PREVIEW_CENTER = 30;

interface TowerRegistration {
  towerClass: TowerClass;
  preview: Tower;
}

function registerTower<T extends Tower>(
  towerClass: TowerClass<T>,
  configurePreview?: (preview: T) => void,
): TowerRegistration {
  const preview = new towerClass(PREVIEW_CENTER, PREVIEW_CENTER);
  configurePreview?.(preview);
  return { towerClass, preview };
}

const TOWER_REGISTRATIONS = [
  registerTower(GunTower, (preview) => { preview.angle = -Math.PI / 4; }),
  registerTower(LaserTower, (preview) => { preview.angle = -Math.PI / 4; }),
  registerTower(MissileTower, (preview) => { preview.angle = -Math.PI / 4; }),
  registerTower(SlowTower, (preview) => { preview.pulse = Math.PI / 2; }),
  registerTower(DroneTower),
  registerTower(LightningTower),
] as const satisfies readonly TowerRegistration[];

export const TOWER_CLASSES = TOWER_REGISTRATIONS.map(({ towerClass }) => towerClass);
export const TOWER_TOOLBAR_PREVIEWS = TOWER_REGISTRATIONS.map(({ preview }) => preview);

const TOWER_CLASS_BY_KIND = TOWER_CLASSES.reduce<Record<TowerKind, TowerClass>>((classes, towerClass) => {
  classes[towerClass.kind] = towerClass;
  return classes;
}, {} as Record<TowerKind, TowerClass>);

export function getTowerClass(kind: TowerKind): TowerClass {
  return TOWER_CLASS_BY_KIND[kind];
}

export function findTowerShortcut(key: string, availableTowers: readonly TowerKind[]): TowerKind | undefined {
  const normalizedKey = key.toLowerCase();
  for (const towerClass of TOWER_CLASSES) {
    if (availableTowers.includes(towerClass.kind) && (towerClass.shortcuts as readonly string[]).includes(normalizedKey)) {
      return towerClass.kind;
    }
  }
  return undefined;
}
