import type { Particle } from "../entities/effects/particle";
import type { Monster } from "../entities/monsters/monster";
import type { Missile } from "../entities/projectiles/missile";
import type { Projectile } from "../entities/projectiles/projectile";
import type { RuntimeLinkEffect } from "../level-runtime";
import type { AudioCue as AudioCueValue } from "../types";

export interface UpdateContext {
  readonly deltaSeconds: number;
  readonly fieldWidth: number;
  readonly fieldHeight: number;
  readonly activeMonsters: readonly Monster[];
}

export interface UpdateSound {
  cue: AudioCueValue;
  panX?: number;
  intensity?: number;
}

export class UpdateResult {
  readonly killedMonsters: Monster[] = [];
  readonly escapedMonsters: Monster[] = [];
  readonly particles: Particle[] = [];
  readonly links: RuntimeLinkEffect[] = [];
  readonly projectiles: Projectile[] = [];
  readonly missiles: Missile[] = [];
  readonly sounds: UpdateSound[] = [];

  addKilledMonster(monster: Monster): void {
    this.killedMonsters.push(monster);
  }

  addEscapedMonster(monster: Monster): void {
    this.escapedMonsters.push(monster);
  }

  addParticle(particle: Particle): void {
    this.particles.push(particle);
  }

  addLink(link: RuntimeLinkEffect): void {
    this.links.push(link);
  }

  addProjectile(projectile: Projectile): void {
    this.projectiles.push(projectile);
  }

  addMissile(missile: Missile): void {
    this.missiles.push(missile);
  }

  playSound(cue: AudioCueValue, panX?: number, intensity?: number): void {
    this.sounds.push({ cue, panX, intensity });
  }

  clear(): void {
    this.killedMonsters.length = 0;
    this.escapedMonsters.length = 0;
    this.particles.length = 0;
    this.links.length = 0;
    this.projectiles.length = 0;
    this.missiles.length = 0;
    this.sounds.length = 0;
  }
}
