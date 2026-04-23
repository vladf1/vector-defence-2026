import type { Game } from "../game-engine";
import { BallMonster } from "../entities/monsters/ball-monster";
import { BerserkerMonster } from "../entities/monsters/berserker-monster";
import { BulwarkMonster } from "../entities/monsters/bulwark-monster";
import type { Monster } from "../entities/monsters/monster";
import { RunnerMonster } from "../entities/monsters/runner-monster";
import { SplitterMonster } from "../entities/monsters/splitter-monster";
import { SquareMonster } from "../entities/monsters/square-monster";
import { TankMonster } from "../entities/monsters/tank-monster";
import { TriangleMonster } from "../entities/monsters/triangle-monster";
import { MonsterKind, type Point } from "../types";
import { calculateDistance, randomRange } from "../utils";

export function createMonster(game: Game, kind: MonsterKind, path: Point[]): Monster {
  const monster = createBaseMonster(kind, path);
  const levelHitPointMultiplier = getLevelHitPointMultiplier(game);
  monster.hitPoints *= levelHitPointMultiplier;
  monster.maxHitPoints *= levelHitPointMultiplier;

  monster.addEventListener("killed", () => {
    game.onMonsterKilled(monster);
  });
  if (monster instanceof SplitterMonster) {
    monster.addEventListener("killed", () => {
      game.spawnSplitters(monster);
    });
  }
  monster.addEventListener("escaped", () => {
    game.onMonsterEscaped(monster);
  });
  return monster;
}

export function createSplitterChildren(game: Game, monster: Monster): Monster[] {
  const children: Monster[] = [];
  const childCount = 2;
  const splitAngle = monster.angle;
  const forwardX = Math.cos(splitAngle);
  const forwardY = Math.sin(splitAngle);
  const segmentStart = monster.path[Math.max(0, monster.targetIndex - 1)] ?? { x: monster.x, y: monster.y };
  const segmentEnd = monster.path[monster.targetIndex] ?? { x: monster.x, y: monster.y };
  const distanceFromSegmentStart = calculateDistance(segmentStart.x, segmentStart.y, monster.x, monster.y);
  const distanceToNextWaypoint = calculateDistance(monster.x, monster.y, segmentEnd.x, segmentEnd.y);
  const maxOffsetDistance = Math.min(12, distanceFromSegmentStart, distanceToNextWaypoint);
  const minSpeedMultiplier = 0.89;
  const maxSpeedMultiplier = 0.97;

  for (let index = 0; index < childCount; index += 1) {
    const forwardOffset = randomRange(-maxOffsetDistance, maxOffsetDistance);
    const spawnPoint = {
      x: monster.x + (forwardX * forwardOffset),
      y: monster.y + (forwardY * forwardOffset),
    };
    const childPath = [spawnPoint, ...monster.path.slice(monster.targetIndex)];
    const child = createMonster(game, MonsterKind.Runner, childPath);
    const speedMultiplier = randomRange(minSpeedMultiplier, maxSpeedMultiplier);
    child.angle = splitAngle + randomRange(-0.12, 0.12);
    child.maxSpeedPerSecond *= speedMultiplier;
    child.speedPerSecond = child.maxSpeedPerSecond;
    child.velocityXPerSecond = Math.cos(child.angle) * child.speedPerSecond;
    child.velocityYPerSecond = Math.sin(child.angle) * child.speedPerSecond;
    child.hitPoints = Math.round(child.maxHitPoints * 0.72);
    child.maxHitPoints = child.hitPoints;
    child.bounty = Math.max(8, Math.round(child.bounty * 0.55));
    child.radius *= 0.86;
    children.push(child);
  }

  return children;
}

function createBaseMonster(kind: MonsterKind, path: Point[]): Monster {
  switch (kind) {
    case MonsterKind.Ball:
      return new BallMonster(path);
    case MonsterKind.Berserker:
      return new BerserkerMonster(path);
    case MonsterKind.Bulwark:
      return new BulwarkMonster(path);
    case MonsterKind.Square:
      return new SquareMonster(path);
    case MonsterKind.Triangle:
      return new TriangleMonster(path);
    case MonsterKind.Tank:
      return new TankMonster(path);
    case MonsterKind.Splitter:
      return new SplitterMonster(path);
    default:
      return new RunnerMonster(path);
  }
}

function getLevelHitPointMultiplier(game: Game): number {
  const levelOffset = Math.max(0, game.currentLevelIndex);
  const bonusPerLevel = 0.05;
  return 1 + (levelOffset * bonusPerLevel);
}
