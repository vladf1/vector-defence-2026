import { STARTING_MONEY } from "./constants";
import type { LinkEffect } from "./entities/effects/link-effect";
import type { Particle } from "./entities/effects/particle";
import type { Monster } from "./entities/monsters/monster";
import type { Missile } from "./entities/projectiles/missile";
import type { Projectile } from "./entities/projectiles/projectile";
import type { Tower } from "./entities/towers/tower";
import { createRouteMotionPath, type RouteMotionPath } from "./route-path";
import type { LevelData, Point, TowerKind, WaveData } from "./types";
import { compactInPlace } from "./utils";

export class LevelRuntime {
  readonly level?: LevelData;
  readonly routePath?: RouteMotionPath;
  money: number;
  escapesLeft: number;
  spawnDelay: number;
  spawnCooldown: number;
  spawnIndex = 0;
  spawnedMonsters = 0;
  currentWaveIndex = 0;
  waveSpawnedMonsters = 0;
  towers: Tower[] = [];
  monsters: Monster[] = [];
  projectiles: Projectile[] = [];
  missiles: Missile[] = [];
  particles: Particle[] = [];
  links: LinkEffect[] = [];
  selectedTower?: Tower;
  placingTower?: TowerKind;
  pointer?: Point;
  winDelay = 0;

  constructor(level?: LevelData) {
    this.level = level;
    this.routePath = level ? createRouteMotionPath(level.points) : undefined;
    this.money = level?.startingMoney ?? STARTING_MONEY;
    this.escapesLeft = level?.allowEscape ?? 0;
    this.spawnDelay = level ? (level.waves?.[0]?.buildTime ?? 8) : 0;
    this.spawnCooldown = level ? 0.2 : 0;
  }

  get activeWave(): WaveData | undefined {
    return this.level?.waves?.[this.currentWaveIndex];
  }

  get waveTotal(): number {
    return this.level?.waves?.length ?? 1;
  }

  *getActiveMonsters(): IterableIterator<Monster> {
    for (const monster of this.monsters) {
      if (!monster.removed) {
        yield monster;
      }
    }
  }

  compactRemoved(): void {
    compactInPlace(this.monsters);
    compactInPlace(this.projectiles);
    compactInPlace(this.missiles);
    compactInPlace(this.particles);
    compactInPlace(this.links);
  }
}
