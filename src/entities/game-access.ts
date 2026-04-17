import type { LinkEffect } from "./effects/link-effect";
import type { Particle } from "./effects/particle";
import type { Monster } from "./monsters/monster";
import type { Missile } from "./projectiles/missile";
import type { Projectile } from "./projectiles/projectile";

export interface GameAccess {
  monsters: Monster[];
  projectiles: Projectile[];
  missiles: Missile[];
  particles: Particle[];
  links: LinkEffect[];
  createExplosion(x: number, y: number, count: number, size: number, color: string, alphaFadePerSecond: number): void;
  addParticle(particle: Particle): void;
  addLink(link: LinkEffect): void;
}
