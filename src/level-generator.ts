import { MonsterKind, type LevelData, type Point } from "./types";
import { calculateDistance, calculateDistanceToSegment, clamp, randomRange } from "./utils";

export interface ProceduralRouteConfig {
  fieldWidth: number;
  fieldHeight: number;
  randomRouteBaseWidth: number;
  randomRouteMargin: number;
}

type RouteTemplate = (config: ProceduralRouteConfig) => Point[];

const MIN_TURN_ROAD_CLEARANCE = 72;
const MIN_CROSSING_TURN_CLEARANCE = 84;
const ROUTE_ATTEMPTS = 80;

function randomInt(min: number, max: number): number {
  return Math.floor(randomRange(min, max + 1));
}

function xFromBase(x: number, config: ProceduralRouteConfig): number {
  return (x / config.randomRouteBaseWidth) * config.fieldWidth;
}

function pick<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function point(x: number, y: number, config: ProceduralRouteConfig): Point {
  return {
    x: Math.round(clamp(x, config.randomRouteMargin, config.fieldWidth - config.randomRouteMargin)),
    y: Math.round(clamp(y, config.randomRouteMargin + 8, config.fieldHeight - config.randomRouteMargin - 8)),
  };
}

function jitter(value: number, amount: number): number {
  return value + randomRange(-amount, amount);
}

function yAt(ratio: number, config: ProceduralRouteConfig): number {
  const minY = config.randomRouteMargin + 8;
  const maxY = config.fieldHeight - config.randomRouteMargin - 8;
  return minY + ((maxY - minY) * ratio);
}

function oppositeY(y: number, config: ProceduralRouteConfig): number {
  return y < config.fieldHeight / 2
    ? randomRange(yAt(0.68, config), yAt(0.95, config))
    : randomRange(yAt(0.05, config), yAt(0.32, config));
}

function buildMonsterSequence(): MonsterKind[] {
  const rushPool: MonsterKind[] = [MonsterKind.Ball, MonsterKind.Runner, MonsterKind.Runner, MonsterKind.Square, MonsterKind.Triangle, MonsterKind.Triangle];
  const bruiserPool: MonsterKind[] = [
    MonsterKind.Square,
    MonsterKind.Triangle,
    MonsterKind.Tank,
    MonsterKind.Runner,
    MonsterKind.Splitter,
    MonsterKind.Tank,
    MonsterKind.Berserker,
    MonsterKind.Bulwark,
  ];
  const sequenceLength = randomInt(12, 15);
  const sequence: MonsterKind[] = [MonsterKind.Ball, MonsterKind.Runner, MonsterKind.Triangle];

  while (sequence.length < sequenceLength - 4) {
    const pool = sequence.length % 4 === 3 ? bruiserPool : rushPool;
    sequence.push(pick(pool));
  }

  sequence.push(MonsterKind.Splitter);
  sequence.push(MonsterKind.Tank);
  sequence.push(MonsterKind.Bulwark);
  sequence.push(MonsterKind.Berserker);
  return sequence;
}

function crossingSwitchbackRoute(config: ProceduralRouteConfig): Point[] {
  const lowStart = randomRange(yAt(0.72, config), yAt(0.94, config));
  const high = randomRange(yAt(0.08, config), yAt(0.28, config));
  const low = randomRange(yAt(0.66, config), yAt(0.9, config));
  const center = randomRange(yAt(0.38, config), yAt(0.62, config));
  const verticalX = randomRange(xFromBase(285, config), xFromBase(350, config));
  const entryX = config.randomRouteMargin;
  const exitX = config.fieldWidth - config.randomRouteMargin;

  return [
    point(entryX, lowStart, config),
    point(jitter(xFromBase(178, config), xFromBase(20, config)), high, config),
    point(jitter(xFromBase(178, config), xFromBase(20, config)), low, config),
    point(jitter(xFromBase(438, config), xFromBase(24, config)), high + randomRange(-8, 34), config),
    point(verticalX, high + randomRange(-4, 18), config),
    point(verticalX, low + randomRange(-18, 18), config),
    point(jitter(xFromBase(560, config), xFromBase(22, config)), center, config),
    point(exitX, oppositeY(center, config), config),
  ];
}

function verticalGateRoute(config: ProceduralRouteConfig): Point[] {
  const start = randomRange(yAt(0.1, config), yAt(0.36, config));
  const firstLow = randomRange(yAt(0.7, config), yAt(0.94, config));
  const secondHigh = randomRange(yAt(0.05, config), yAt(0.24, config));
  const end = randomRange(yAt(0.56, config), yAt(0.88, config));
  const firstX = randomRange(xFromBase(210, config), xFromBase(260, config));
  const secondX = randomRange(xFromBase(455, config), xFromBase(520, config));
  const entryX = config.randomRouteMargin;
  const exitX = config.fieldWidth - config.randomRouteMargin;

  return [
    point(entryX, start, config),
    point(firstX, firstLow, config),
    point(firstX, secondHigh, config),
    point(secondX, firstLow + randomRange(-28, 18), config),
    point(secondX, secondHigh + randomRange(-12, 28), config),
    point(jitter(xFromBase(172, config), xFromBase(28, config)), yAt(0.52, config), config),
    point(jitter(xFromBase(552, config), xFromBase(24, config)), yAt(0.52, config) + randomRange(-24, 24), config),
    point(exitX, end, config),
  ];
}

function hourglassRoute(config: ProceduralRouteConfig): Point[] {
  const top = randomRange(yAt(0.05, config), yAt(0.24, config));
  const bottom = randomRange(yAt(0.74, config), yAt(0.95, config));
  const center = randomRange(yAt(0.43, config), yAt(0.57, config));
  const leftPost = randomRange(xFromBase(138, config), xFromBase(190, config));
  const rightPost = randomRange(xFromBase(500, config), xFromBase(565, config));
  const entryX = config.randomRouteMargin;
  const exitX = config.fieldWidth - config.randomRouteMargin;

  return [
    point(entryX, bottom, config),
    point(leftPost, bottom, config),
    point(rightPost, top, config),
    point(rightPost, bottom, config),
    point(leftPost + randomRange(xFromBase(60, config), xFromBase(100, config)), top, config),
    point(leftPost + randomRange(xFromBase(60, config), xFromBase(100, config)), bottom - randomRange(18, 52), config),
    point(jitter(xFromBase(420, config), xFromBase(34, config)), center, config),
    point(exitX, top + randomRange(40, 130), config),
  ];
}

function centerSpineRoute(config: ProceduralRouteConfig): Point[] {
  const spineX = randomRange(xFromBase(320, config), xFromBase(380, config));
  const start = randomRange(yAt(0.12, config), yAt(0.36, config));
  const top = randomRange(yAt(0.05, config), yAt(0.18, config));
  const bottom = randomRange(yAt(0.78, config), yAt(0.95, config));
  const exit = randomRange(yAt(0.34, config), yAt(0.72, config));
  const entryX = config.randomRouteMargin;
  const exitX = config.fieldWidth - config.randomRouteMargin;

  return [
    point(entryX, start, config),
    point(jitter(xFromBase(260, config), xFromBase(30, config)), bottom, config),
    point(spineX, bottom, config),
    point(spineX, top, config),
    point(jitter(xFromBase(150, config), xFromBase(28, config)), top + randomRange(70, 130), config),
    point(jitter(xFromBase(505, config), xFromBase(26, config)), bottom - randomRange(42, 92), config),
    point(jitter(xFromBase(505, config), xFromBase(26, config)), top + randomRange(16, 56), config),
    point(exitX, exit, config),
  ];
}

const ROUTE_TEMPLATES: readonly RouteTemplate[] = [
  crossingSwitchbackRoute,
  verticalGateRoute,
  hourglassRoute,
  centerSpineRoute,
];

function segmentsShareTurn(firstIndex: number, secondIndex: number): boolean {
  return Math.abs(firstIndex - secondIndex) <= 1;
}

function isTurnTooCloseToRoad(points: Point[], turnIndex: number): boolean {
  const turn = points[turnIndex];

  for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex += 1) {
    if (segmentIndex === turnIndex || segmentIndex === turnIndex - 1) {
      continue;
    }

    const start = points[segmentIndex];
    const end = points[segmentIndex + 1];
    const distance = calculateDistanceToSegment(turn.x, turn.y, start.x, start.y, end.x, end.y);
    if (distance < MIN_TURN_ROAD_CLEARANCE) {
      return true;
    }
  }

  return false;
}

function getSegmentIntersection(a: Point, b: Point, c: Point, d: Point): Point | undefined {
  const denominator = ((b.x - a.x) * (d.y - c.y)) - ((b.y - a.y) * (d.x - c.x));
  if (Math.abs(denominator) < 0.001) {
    return undefined;
  }

  const numeratorA = ((c.x - a.x) * (d.y - c.y)) - ((c.y - a.y) * (d.x - c.x));
  const numeratorB = ((c.x - a.x) * (b.y - a.y)) - ((c.y - a.y) * (b.x - a.x));
  const ratioA = numeratorA / denominator;
  const ratioB = numeratorB / denominator;

  if (ratioA <= 0 || ratioA >= 1 || ratioB <= 0 || ratioB >= 1) {
    return undefined;
  }

  return {
    x: a.x + ((b.x - a.x) * ratioA),
    y: a.y + ((b.y - a.y) * ratioA),
  };
}

function isCrossingTooCloseToTurn(points: Point[], firstSegmentIndex: number, secondSegmentIndex: number): boolean {
  const intersection = getSegmentIntersection(
    points[firstSegmentIndex],
    points[firstSegmentIndex + 1],
    points[secondSegmentIndex],
    points[secondSegmentIndex + 1],
  );

  if (!intersection) {
    return false;
  }

  return [
    points[firstSegmentIndex],
    points[firstSegmentIndex + 1],
    points[secondSegmentIndex],
    points[secondSegmentIndex + 1],
  ].some((turn) => calculateDistance(intersection.x, intersection.y, turn.x, turn.y) < MIN_CROSSING_TURN_CLEARANCE);
}

function hasCrowdedTurns(points: Point[]): boolean {
  for (let turnIndex = 1; turnIndex < points.length - 1; turnIndex += 1) {
    if (isTurnTooCloseToRoad(points, turnIndex)) {
      return true;
    }
  }

  for (let firstSegmentIndex = 0; firstSegmentIndex < points.length - 1; firstSegmentIndex += 1) {
    for (let secondSegmentIndex = firstSegmentIndex + 1; secondSegmentIndex < points.length - 1; secondSegmentIndex += 1) {
      if (!segmentsShareTurn(firstSegmentIndex, secondSegmentIndex) && isCrossingTooCloseToTurn(points, firstSegmentIndex, secondSegmentIndex)) {
        return true;
      }
    }
  }

  return false;
}

function buildRoutePoints(config: ProceduralRouteConfig): Point[] {
  let fallback = pick(ROUTE_TEMPLATES)(config);

  for (let attempt = 0; attempt < ROUTE_ATTEMPTS; attempt += 1) {
    const route = pick(ROUTE_TEMPLATES)(config);
    if (!hasCrowdedTurns(route)) {
      return route;
    }
    fallback = route;
  }

  return fallback;
}

export function createProceduralLevel(config: ProceduralRouteConfig): LevelData {
  return {
    name: "Random",
    monsterCount: randomInt(156, 190),
    allowEscape: randomInt(8, 10),
    monsterSequence: buildMonsterSequence(),
    points: buildRoutePoints(config),
  };
}
