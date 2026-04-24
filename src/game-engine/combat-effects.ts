import { MAX_PARTICLES } from "../constants";
import { HitRingEffect } from "../entities/effects/hit-ring-effect";
import { EmberStreakParticle, MissileShockwaveEffect, SmokeParticle } from "../entities/effects/missile-explosion-effect";
import { Particle } from "../entities/effects/particle";
import type { Game } from "../game-engine";
import { randomRange } from "../utils";

export function createHitImpactEffect(game: Game, x: number, y: number, color: string, sparkAngle?: number): void {
  game.addParticle(new HitRingEffect(x, y, color, randomRange(5.5, 9)));
  const particleCount = Math.min(5, Math.max(0, MAX_PARTICLES - game.runtime.particles.length));
  for (let index = 0; index < particleCount; index += 1) {
    const angle = sparkAngle === undefined ? randomRange(-Math.PI, Math.PI) : sparkAngle + randomRange(-0.95, 0.95);
    game.addParticle(new Particle(x, y, randomRange(0.8, 1.7), color, randomRange(4.2, 6), {
      speedPerSecond: randomRange(80, 210),
      offset: randomRange(1, 3),
      angle,
    }));
  }
}

export function createMissileExplosionEffect(game: Game, x: number, y: number, blastAngle: number): void {
  game.addParticle(new MissileShockwaveEffect(x, y));

  const emberCount = Math.min(12, Math.max(0, MAX_PARTICLES - game.runtime.particles.length));
  for (let index = 0; index < emberCount; index += 1) {
    game.addParticle(new EmberStreakParticle(x, y, blastAngle));
  }

  const smokeCount = Math.min(10, Math.max(0, MAX_PARTICLES - game.runtime.particles.length));
  for (let index = 0; index < smokeCount; index += 1) {
    game.addParticle(new SmokeParticle(x, y, blastAngle));
  }
}
