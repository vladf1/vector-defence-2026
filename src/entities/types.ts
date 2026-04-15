import type { LinkEffect, Particle } from "./effects";
import type { Monster } from "./monsters";
import type { Missile, Projectile } from "./projectiles";

export interface GameAccess {
  monsters: Monster[];
  projectiles: Projectile[];
  missiles: Missile[];
  particles: Particle[];
  links: LinkEffect[];
  onMonsterKilled(monster: Monster): void;
  onMonsterEscaped(monster: Monster): void;
  createExplosion(x: number, y: number, count: number, size: number, color: string, burnRate: number): void;
  addParticle(particle: Particle): void;
  addLink(link: LinkEffect): void;
}
