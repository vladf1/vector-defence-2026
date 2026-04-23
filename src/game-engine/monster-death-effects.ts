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
import type { Point } from "../types";
import { randomRange } from "../utils";

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
    createExplosion(game, monster.x, monster.y, 30, randomRange(1.5, 4), monster.color, 2.5);
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

  createExplosion(game, monster.x, monster.y, 6, randomRange(1.5, 2.8), monster.color, randomRange(2.4, 3.6));
  createExplosion(game, monster.x, monster.y, 4, randomRange(1, 1.8), "#dcfffe", randomRange(3, 4.2));
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

  createExplosion(game, monster.x, monster.y, 6, randomRange(1.2, 2.2), "#ffffff", randomRange(3, 4.4));
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

  createExplosion(game, monster.x, monster.y, 5, randomRange(1.1, 2), "#fff0c8", randomRange(3.1, 4.2));
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

  createExplosion(game, monster.x, monster.y, 5, randomRange(1.2, 2.2), "#ffffff", randomRange(3.2, 4.4));
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

  createExplosion(game, monster.x, monster.y, 12, randomRange(2.6, 4.8), "#fff1a6", randomRange(1.8, 2.5));
  createExplosion(game, monster.x, monster.y, 8, randomRange(1.5, 2.8), "#dfe6f3", randomRange(2.6, 3.8));
}

function createExplosion(game: Game, x: number, y: number, count: number, size: number, color: string, alphaFadePerSecond: number): void {
  const particleCount = Math.min(count, Math.max(0, MAX_PARTICLES - game.runtime.particles.length));
  for (let index = 0; index < particleCount; index += 1) {
    game.addParticle(new Particle(x, y, size, color, alphaFadePerSecond));
  }
}

function addBurstParticle(game: Game, x: number, y: number, color: string, size: number, alphaFadePerSecond: number, angle: number, speedPerSecond: number): void {
  const particle = new Particle(x, y, size, color, alphaFadePerSecond, 0, 0);
  particle.velocityXPerSecond = Math.cos(angle) * speedPerSecond;
  particle.velocityYPerSecond = Math.sin(angle) * speedPerSecond;
  particle.x = x;
  particle.y = y;
  game.addParticle(particle);
}

function buildShards(outline: Point[], pivot: Point, shardCount: number): Point[][] {
  const perimeterPoints = samplePolygonPerimeter(outline, shardCount);
  const shards: Point[][] = [];
  for (let index = 0; index < shardCount; index += 1) {
    shards.push([pivot, perimeterPoints[index], perimeterPoints[index + 1]]);
  }
  return shards;
}

function samplePolygonPerimeter(outline: Point[], sampleCount: number): Point[] {
  const edgeLengths: number[] = [];
  let perimeterLength = 0;
  for (let index = 0; index < outline.length; index += 1) {
    const start = outline[index];
    const end = outline[(index + 1) % outline.length];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    edgeLengths.push(length);
    perimeterLength += length;
  }

  const distances = Array.from({ length: sampleCount }, () => randomRange(0, perimeterLength)).sort((left, right) => left - right);
  const points = distances.map((distance) => samplePointOnPolygonPerimeter(outline, edgeLengths, distance));
  points.push(points[0]);
  return points;
}

function samplePointOnPolygonPerimeter(outline: Point[], edgeLengths: number[], distance: number): Point {
  let traversed = 0;
  for (let index = 0; index < outline.length; index += 1) {
    const edgeLength = edgeLengths[index];
    if (distance <= traversed + edgeLength) {
      const start = outline[index];
      const end = outline[(index + 1) % outline.length];
      const ratio = edgeLength === 0 ? 0 : (distance - traversed) / edgeLength;
      return {
        x: start.x + ((end.x - start.x) * ratio),
        y: start.y + ((end.y - start.y) * ratio),
      };
    }
    traversed += edgeLength;
  }

  return outline[0];
}

function randomPointInsideTriangle(a: Point, b: Point, c: Point): Point {
  let weightA = Math.random();
  let weightB = Math.random();
  if (weightA + weightB > 1) {
    weightA = 1 - weightA;
    weightB = 1 - weightB;
  }
  const weightC = 1 - weightA - weightB;
  return {
    x: (a.x * weightA) + (b.x * weightB) + (c.x * weightC),
    y: (a.y * weightA) + (b.y * weightB) + (c.y * weightC),
  };
}

function rotatePoint(point: Point, angle: number): Point {
  return {
    x: (point.x * Math.cos(angle)) - (point.y * Math.sin(angle)),
    y: (point.x * Math.sin(angle)) + (point.y * Math.cos(angle)),
  };
}

function pointOnRadius(angle: number, radius: number): Point {
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

function createCoreShardVertices(center: Point, radius: number): Point[] {
  const vertexCount = Math.round(randomRange(3, 5));
  const vertices: Point[] = [];
  const startAngle = randomRange(-Math.PI, Math.PI);
  for (let index = 0; index < vertexCount; index += 1) {
    const angle = startAngle + ((Math.PI * 2 * index) / vertexCount) + randomRange(-0.18, 0.18);
    const distance = radius * randomRange(0.55, 1);
    vertices.push({
      x: center.x + (Math.cos(angle) * distance),
      y: center.y + (Math.sin(angle) * distance),
    });
  }
  return vertices;
}

function sampleCircleArcs(arcCount: number): Array<{ startAngle: number; sweepAngle: number }> {
  const weights = Array.from({ length: arcCount }, () => randomRange(0.65, 1.45));
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const startAngleOffset = randomRange(-Math.PI, Math.PI);
  const arcs: Array<{ startAngle: number; sweepAngle: number }> = [];
  let startAngle = startAngleOffset;
  for (const weight of weights) {
    const sweepAngle = (weight / weightTotal) * Math.PI * 2;
    arcs.push({ startAngle, sweepAngle });
    startAngle += sweepAngle;
  }
  return arcs;
}
