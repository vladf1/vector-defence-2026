import type { LinkEffect } from "./effects/link-effect";
import type { Particle } from "./effects/particle";
import type { MonsterBase } from "./monsters/monster-base";
import type { Missile } from "./projectiles/missile";
import type { Projectile } from "./projectiles/projectile";

export interface GameAccess {
  monsters: MonsterBase[];
  readonly activeMonsters: Iterable<MonsterBase>;
  projectiles: Projectile[];
  missiles: Missile[];
  particles: Particle[];
  links: LinkEffect[];
  createExplosion(x: number, y: number, count: number, size: number, color: string, burnRate: number): void;
  addParticle(particle: Particle): void;
  addLink(link: LinkEffect): void;
}
