import { MAX_PARTICLES } from "../constants";
import { CircleShardParticle } from "../entities/effects/circle-shard-particle";
import { GlassShardParticle } from "../entities/effects/glass-shard-particle";
import { Particle } from "../entities/effects/particle";
import { TankTurretParticle } from "../entities/effects/tank-turret-particle";
import { BallMonster } from "../entities/monsters/ball-monster";
import { BerserkerMonster } from "../entities/monsters/berserker-monster";
import { BulwarkMonster } from "../entities/monsters/bulwark-monster";
import type { Monster } from "../entities/monsters/monster";
import { RunnerMonster } from "../entities/monsters/runner-monster";
import { SplitterMonster } from "../entities/monsters/splitter-monster";
import { SquareMonster } from "../entities/monsters/square-monster";
import { TankMonster } from "../entities/monsters/tank-monster";
import { TriangleMonster } from "../entities/monsters/triangle-monster";
import type { Game } from "../game-engine";
import { randomRange } from "../utils";
import { createExplosionEffect } from "./combat-effects";
import {
  buildShards,
  createCoreShardVertices,
  pointOnRadius,
  randomPointInsideTriangle,
  rotatePoint,
  sampleCircleArcs,
} from "./death-effect-geometry";

export function createMonsterDeathEffect(game: Game, monster: Monster): void {
  if (monster instanceof BallMonster) {
    createBallShatterExplosion(game, monster);
  } else if (monster instanceof RunnerMonster) {
    createRunnerShearExplosion(game, monster);
  } else if (monster instanceof SquareMonster) {
    createSquareShatterExplosion(game, monster);
  } else if (monster instanceof TriangleMonster) {
    createTriangleShatterExplosion(game, monster);
  } else if (monster instanceof BulwarkMonster) {
    createBulwarkBreakExplosion(game, monster);
  } else if (monster instanceof BerserkerMonster) {
    createBerserkerRageExplosion(game, monster);
  } else if (monster instanceof TankMonster) {
    createTankExplosion(game, monster);
  } else if (monster instanceof SplitterMonster) {
    createSplitterBurstExplosion(game, monster);
  } else {
    createExplosionEffect(game, monster.x, monster.y, 30, randomRange(1.5, 4), monster.color, 2.5);
  }
}

function createBallShatterExplosion(game: Game, monster: BallMonster): void {
  const shardCount = Math.round(randomRange(4, 9));
  const availableSlots = Math.max(0, MAX_PARTICLES - game.runtime.particles.length);
  const particleCount = Math.min(shardCount, availableSlots);
  if (particleCount === 0) {
    return;
  }

  for (const arc of sampleCircleArcs(particleCount)) {
    const sweepShare = arc.sweepAngle / (Math.PI * 2);
    const innerStartAngle = arc.startAngle + (arc.sweepAngle * randomRange(0.12, 0.32));
    const innerEndAngle = arc.startAngle + arc.sweepAngle - (arc.sweepAngle * randomRange(0.12, 0.32));
    const innerPeakAngle = arc.startAngle + (arc.sweepAngle * randomRange(0.32, 0.68));
    const speedPerSecond = randomRange(135, 215) + (sweepShare * 28);
    game.addParticle(new CircleShardParticle(
      monster.x,
      monster.y,
      monster.radius * randomRange(0.95, 1.1),
      monster.color,
      arc.startAngle,
      arc.sweepAngle,
      pointOnRadius(innerStartAngle, monster.radius * randomRange(0.18, 0.52)),
      pointOnRadius(innerPeakAngle, monster.radius * randomRange(0.05, 0.36)),
      pointOnRadius(innerEndAngle, monster.radius * randomRange(0.18, 0.52)),
      speedPerSecond,
    ));
  }

  const coreShardCount = Math.min(Math.round(randomRange(2, 4)), Math.max(0, MAX_PARTICLES - game.runtime.particles.length));
  for (let index = 0; index < coreShardCount; index += 1) {
    const coreCenter = pointOnRadius(randomRange(-Math.PI, Math.PI), monster.radius * randomRange(0.05, 0.28));
    const coreVertices = createCoreShardVertices(coreCenter, monster.radius * randomRange(0.16, 0.34));
    game.addParticle(new GlassShardParticle(
      monster.x,
      monster.y,
      monster.color,
      coreVertices,
      randomRange(-Math.PI, Math.PI),
      randomRange(95, 170),
    ));
  }

  createExplosionEffect(game, monster.x, monster.y, 6, randomRange(1.5, 2.8), monster.color, randomRange(2.4, 3.6));
  createExplosionEffect(game, monster.x, monster.y, 4, randomRange(1, 1.8), "#dcfffe", randomRange(3, 4.2));
}

function createRunnerShearExplosion(game: Game, monster: RunnerMonster): void {
  const availableSlots = Math.max(0, MAX_PARTICLES - game.runtime.particles.length);
  if (availableSlots === 0) {
    return;
  }

  const runnerOutline = [
    { x: monster.radius * 1.7, y: 0 },
    { x: -monster.radius * 0.1, y: -monster.radius * 0.82 },
    { x: -monster.radius * 1.35, y: 0 },
    { x: -monster.radius * 0.1, y: monster.radius * 0.82 },
  ];
  const pivot = {
    x: randomRange(-monster.radius * 0.35, monster.radius * 0.3),
    y: randomRange(-monster.radius * 0.16, monster.radius * 0.16),
  };
  const shardCount = Math.min(Math.round(randomRange(3, 5)), availableSlots);
  for (const shardVertices of buildShards(runnerOutline, pivot, shardCount)) {
    game.addParticle(new GlassShardParticle(
      monster.x,
      monster.y,
      monster.color,
      shardVertices,
      monster.angle,
      randomRange(155, 255),
    ));
  }

  for (let index = 0; index < 6; index += 1) {
    addBurstParticle(
      game,
      monster.x,
      monster.y,
      index % 2 === 0 ? "#dfffc4" : monster.color,
      randomRange(1, 2.2),
      randomRange(3.2, 4.6),
      monster.angle + randomRange(-0.3, 0.3),
      randomRange(150, 260),
    );
  }
}

function createSquareShatterExplosion(game: Game, monster: SquareMonster): void {
  const availableSlots = Math.max(0, MAX_PARTICLES - game.runtime.particles.length);
  if (availableSlots === 0) {
    return;
  }

  const squareOutline = [
    { x: -monster.radius, y: -monster.radius },
    { x: monster.radius, y: -monster.radius },
    { x: monster.radius, y: monster.radius },
    { x: -monster.radius, y: monster.radius },
  ];
  const pivot = {
    x: randomRange(-monster.radius * 0.24, monster.radius * 0.24),
    y: randomRange(-monster.radius * 0.24, monster.radius * 0.24),
  };
  const shardCount = Math.min(Math.round(randomRange(5, 10)), availableSlots);
  for (const shardVertices of buildShards(squareOutline, pivot, shardCount)) {
    game.addParticle(new GlassShardParticle(
      monster.x,
      monster.y,
      monster.color,
      shardVertices,
      monster.rotation,
      randomRange(130, 235),
    ));
  }

  createExplosionEffect(game, monster.x, monster.y, 6, randomRange(1.2, 2.2), "#ffffff", randomRange(3, 4.4));
}

function createTriangleShatterExplosion(game: Game, monster: TriangleMonster): void {
  const availableSlots = Math.max(0, MAX_PARTICLES - game.runtime.particles.length);
  if (availableSlots === 0) {
    return;
  }

  const triangleOutline = [
    { x: monster.radius, y: 0 },
    { x: -monster.radius, y: -monster.radius },
    { x: -monster.radius, y: monster.radius },
  ];
  const shardCount = Math.min(Math.round(randomRange(4, 8)), availableSlots);
  const pivot = randomPointInsideTriangle(triangleOutline[0], triangleOutline[1], triangleOutline[2]);
  for (const shardVertices of buildShards(triangleOutline, pivot, shardCount)) {
    game.addParticle(new GlassShardParticle(
      monster.x,
      monster.y,
      monster.color,
      shardVertices,
      monster.angle,
      randomRange(145, 245),
    ));
  }

  createExplosionEffect(game, monster.x, monster.y, 5, randomRange(1.1, 2), "#fff0c8", randomRange(3.1, 4.2));
}

function createBulwarkBreakExplosion(game: Game, monster: BulwarkMonster): void {
  const availableSlots = Math.max(0, MAX_PARTICLES - game.runtime.particles.length);
  if (availableSlots === 0) {
    return;
  }

  const shellOutline = [
    { x: monster.radius * 1.35, y: 0 },
    { x: monster.radius * 0.82, y: -monster.radius * 0.8 },
    { x: -monster.radius * 0.2, y: -monster.radius * 0.98 },
    { x: -monster.radius * 1.08, y: -monster.radius * 0.8 },
    { x: -monster.radius * 1.32, y: 0 },
    { x: -monster.radius * 1.08, y: monster.radius * 0.8 },
    { x: -monster.radius * 0.2, y: monster.radius * 0.98 },
    { x: monster.radius * 0.82, y: monster.radius * 0.8 },
  ];
  const shellPivot = {
    x: randomRange(-monster.radius * 0.18, monster.radius * 0.18),
    y: randomRange(-monster.radius * 0.18, monster.radius * 0.18),
  };
  const shellShardCount = Math.min(Math.round(randomRange(6, 10)), availableSlots);
  for (const shardVertices of buildShards(shellOutline, shellPivot, shellShardCount)) {
    game.addParticle(new GlassShardParticle(
      monster.x,
      monster.y,
      "#dff7ff",
      shardVertices,
      monster.angle,
      randomRange(120, 205),
    ));
  }

  const coreOutline = [
    { x: monster.radius * 0.98, y: 0 },
    { x: monster.radius * 0.42, y: -monster.radius * 0.46 },
    { x: -monster.radius * 0.3, y: -monster.radius * 0.46 },
    { x: -monster.radius * 0.72, y: 0 },
    { x: -monster.radius * 0.3, y: monster.radius * 0.46 },
    { x: monster.radius * 0.42, y: monster.radius * 0.46 },
  ];
  const corePivot = {
    x: randomRange(-monster.radius * 0.08, monster.radius * 0.08),
    y: randomRange(-monster.radius * 0.08, monster.radius * 0.08),
  };
  for (const shardVertices of buildShards(coreOutline, corePivot, 4)) {
    game.addParticle(new GlassShardParticle(
      monster.x,
      monster.y,
      monster.color,
      shardVertices,
      monster.angle,
      randomRange(105, 175),
    ));
  }

  for (let index = 0; index < 10; index += 1) {
    addBurstParticle(
      game,
      monster.x,
      monster.y,
      index % 2 === 0 ? "#dff7ff" : "#9bf4ff",
      randomRange(1.1, 2.1),
      randomRange(2.7, 4),
      ((Math.PI * 2) * index / 10) + randomRange(-0.08, 0.08),
      randomRange(110, 185),
    );
  }

  createExplosionEffect(game, monster.x, monster.y, 5, randomRange(1.2, 2.2), "#ffffff", randomRange(3.2, 4.4));
}

function createBerserkerRageExplosion(game: Game, monster: BerserkerMonster): void {
  const availableSlots = Math.max(0, MAX_PARTICLES - game.runtime.particles.length);
  if (availableSlots === 0) {
    return;
  }

  const berserkerOutline = [
    { x: monster.radius * 1.55, y: 0 },
    { x: monster.radius * 0.4, y: -monster.radius * 0.8 },
    { x: -monster.radius * 0.1, y: -monster.radius * 1.08 },
    { x: -monster.radius * 1.28, y: -monster.radius * 0.44 },
    { x: -monster.radius * 0.72, y: 0 },
    { x: -monster.radius * 1.28, y: monster.radius * 0.44 },
    { x: -monster.radius * 0.1, y: monster.radius * 1.08 },
    { x: monster.radius * 0.4, y: monster.radius * 0.8 },
  ];
  const pivot = {
    x: randomRange(-monster.radius * 0.15, monster.radius * 0.22),
    y: randomRange(-monster.radius * 0.15, monster.radius * 0.15),
  };
  const shardCount = Math.min(Math.round(randomRange(6, 10)), availableSlots);
  for (const shardVertices of buildShards(berserkerOutline, pivot, shardCount)) {
    game.addParticle(new GlassShardParticle(
      monster.x,
      monster.y,
      monster.color,
      shardVertices,
      monster.angle,
      randomRange(140, 230),
    ));
  }

  for (let index = 0; index < 8; index += 1) {
    addBurstParticle(
      game,
      monster.x,
      monster.y,
      index % 3 === 0 ? "#ffd1a3" : monster.color,
      randomRange(1.2, 2.6),
      randomRange(2.6, 3.7),
      monster.angle + randomRange(-0.55, 0.55),
      randomRange(145, 260),
    );
  }

  for (let index = 0; index < 5; index += 1) {
    addBurstParticle(
      game,
      monster.x,
      monster.y,
      "#ffffff",
      randomRange(0.8, 1.6),
      randomRange(3.6, 5),
      monster.angle + randomRange(-0.18, 0.18),
      randomRange(190, 295),
    );
  }
}

function createSplitterBurstExplosion(game: Game, monster: SplitterMonster): void {
  const availableSlots = Math.max(0, MAX_PARTICLES - game.runtime.particles.length);
  if (availableSlots === 0) {
    return;
  }

  const splitterOutline = [
    { x: monster.radius * 1.15, y: 0 },
    { x: Math.cos(Math.PI / 3) * monster.radius * 0.72, y: Math.sin(Math.PI / 3) * monster.radius * 0.72 },
    { x: Math.cos((Math.PI / 3) * 2) * monster.radius * 1.15, y: Math.sin((Math.PI / 3) * 2) * monster.radius * 1.15 },
    { x: Math.cos(Math.PI) * monster.radius * 0.72, y: Math.sin(Math.PI) * monster.radius * 0.72 },
    { x: Math.cos((Math.PI / 3) * 4) * monster.radius * 1.15, y: Math.sin((Math.PI / 3) * 4) * monster.radius * 1.15 },
    { x: Math.cos((Math.PI / 3) * 5) * monster.radius * 0.72, y: Math.sin((Math.PI / 3) * 5) * monster.radius * 0.72 },
  ];
  const pivot = {
    x: randomRange(-monster.radius * 0.14, monster.radius * 0.14),
    y: randomRange(-monster.radius * 0.14, monster.radius * 0.14),
  };
  const shardCount = Math.min(Math.round(randomRange(6, 9)), availableSlots);
  for (const shardVertices of buildShards(splitterOutline, pivot, shardCount)) {
    game.addParticle(new GlassShardParticle(
      monster.x,
      monster.y,
      monster.color,
      shardVertices,
      monster.rotation,
      randomRange(110, 185),
    ));
  }

  for (let index = 0; index < 7; index += 1) {
    addBurstParticle(
      game,
      monster.x,
      monster.y,
      index % 2 === 0 ? "#ffd9f2" : "#ffffff",
      randomRange(0.9, 1.9),
      randomRange(3, 4.1),
      randomRange(-Math.PI, Math.PI),
      randomRange(95, 175),
    );
  }
}

function createTankExplosion(game: Game, monster: TankMonster): void {
  const availableSlots = Math.max(0, MAX_PARTICLES - game.runtime.particles.length);
  if (availableSlots === 0) {
    return;
  }

  const hullOutline = [
    { x: -monster.radius, y: -monster.radius * 0.72 },
    { x: monster.radius * 1.1, y: -monster.radius * 0.72 },
    { x: monster.radius * 1.1, y: monster.radius * 0.72 },
    { x: -monster.radius, y: monster.radius * 0.72 },
  ];
  const hullPivot = {
    x: randomRange(-monster.radius * 0.15, monster.radius * 0.35),
    y: randomRange(-monster.radius * 0.22, monster.radius * 0.22),
  };
  const turretSlotsReserved = availableSlots > 0 ? 1 : 0;
  const shardCount = Math.min(Math.round(randomRange(7, 12)), Math.max(0, availableSlots - turretSlotsReserved));
  for (const shardVertices of buildShards(hullOutline, hullPivot, shardCount)) {
    game.addParticle(new GlassShardParticle(
      monster.x,
      monster.y,
      monster.color,
      shardVertices,
      monster.angle,
      randomRange(125, 220),
    ));
  }

  if (game.runtime.particles.length < MAX_PARTICLES) {
    const turretCenterOffset = rotatePoint({ x: monster.radius * 0.38, y: 0 }, monster.angle);
    game.addParticle(new TankTurretParticle(
      monster.x + turretCenterOffset.x,
      monster.y + turretCenterOffset.y,
      monster.radius,
      monster.color,
      monster.angle,
    ));
  }

  createExplosionEffect(game, monster.x, monster.y, 12, randomRange(2.6, 4.8), "#fff1a6", randomRange(1.8, 2.5));
  createExplosionEffect(game, monster.x, monster.y, 8, randomRange(1.5, 2.8), "#dfe6f3", randomRange(2.6, 3.8));
}

function addBurstParticle(game: Game, x: number, y: number, color: string, size: number, alphaFadePerSecond: number, angle: number, speedPerSecond: number): void {
  const particle = new Particle(x, y, size, color, alphaFadePerSecond, { speedPerSecond: 0, offset: 0 });
  particle.velocityXPerSecond = Math.cos(angle) * speedPerSecond;
  particle.velocityYPerSecond = Math.sin(angle) * speedPerSecond;
  particle.x = x;
  particle.y = y;
  game.addParticle(particle);
}
