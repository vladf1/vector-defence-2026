import { MAX_PARTICLES } from "../constants";
import { HitRingEffect } from "../entities/effects/hit-ring-effect";
import { EmberStreakParticle, SmokeParticle } from "../entities/effects/missile-explosion-effect";
import { Particle } from "../entities/effects/particle";
import { ShockwaveEffect } from "../entities/effects/shockwave-effect";
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

export function createLaserImpactEffect(game: Game, x: number, y: number, beamAngle: number, color: string): void {
  const particleCount = Math.min(4, Math.max(0, MAX_PARTICLES - game.runtime.particles.length));
  for (let index = 0; index < particleCount; index += 1) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const angle = beamAngle + (side * (Math.PI / 2)) + randomRange(-0.55, 0.55);
    const sparkColor = index === 0 ? "#f6f0ff" : (index === 1 ? "#ffe36f" : color);
    game.addParticle(new Particle(x, y, randomRange(0.7, 1.45), sparkColor, randomRange(3.4, 5.2), {
      speedPerSecond: randomRange(45, 145),
      offset: randomRange(1.5, 4),
      angle,
    }));
  }
}

export function createMissileExplosionEffect(game: Game, x: number, y: number, blastAngle: number, level: number): void {
  game.addParticle(new ShockwaveEffect(x, y, 0.8 + (0.06 * level)));

  const emberCount = Math.min(14, Math.max(0, MAX_PARTICLES - game.runtime.particles.length));
  for (let index = 0; index < emberCount; index += 1) {
    game.addParticle(new EmberStreakParticle(x, y, blastAngle, level));
  }

  const smokeCount = Math.min(10, Math.max(0, MAX_PARTICLES - game.runtime.particles.length));
  for (let index = 0; index < smokeCount; index += 1) {
    game.addParticle(new SmokeParticle(x, y, blastAngle, level));
  }
}

export function createEscapeBurstEffect(game: Game, x: number, y: number): void {
  game.addParticle(new ShockwaveEffect(x, y, 1.65));
  game.addParticle(new HitRingEffect(x, y, "#b0ffe1", 24));
  game.addParticle(new HitRingEffect(x, y, "#ffe36f", 15));

  const colors = ["#b0ffe1", "#6df0c2", "#ffe36f", "#ffffff", "#7fd7ff"];
  const particleCount = Math.min(130, Math.max(0, MAX_PARTICLES - game.runtime.particles.length));
  for (let index = 0; index < particleCount; index += 1) {
    const color = colors[Math.floor(randomRange(0, colors.length))] ?? "#b0ffe1";
    game.addParticle(new Particle(x, y, randomRange(1.5, 5.5), color, randomRange(1.1, 1.8), {
      speedPerSecond: randomRange(150, 520),
      offset: randomRange(1, 7),
    }));
  }
}
