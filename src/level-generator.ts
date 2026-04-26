import { FIELD_HEIGHT, FIELD_WIDTH } from "./constants";
import { MonsterKind, type LevelData, type Point } from "./types";
import { calculateDistance, calculateDistanceToSegment, clamp, randomRange } from "./utils";

type RouteTemplate = () => Point[];

const BASE_FIELD_WIDTH = 700;
const ENTRY_X = 36;
const EXIT_X = FIELD_WIDTH - 36;
const MIN_Y = 44;
const MAX_Y = FIELD_HEIGHT - 44;
const MIN_TURN_ROAD_CLEARANCE = 72;
const MIN_CROSSING_TURN_CLEARANCE = 84;
const ROUTE_ATTEMPTS = 80;

function randomInt(min: number, max: number): number {
  return Math.floor(randomRange(min, max + 1));
}

function xFromBase(x: number): number {
  return (x / BASE_FIELD_WIDTH) * FIELD_WIDTH;
}

function pick<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function point(x: number, y: number): Point {
  return {
    x: Math.round(clamp(x, 24, FIELD_WIDTH - 24)),
    y: Math.round(clamp(y, MIN_Y, MAX_Y)),
  };
}

function jitter(value: number, amount: number): number {
  return value + randomRange(-amount, amount);
}

function yAt(ratio: number): number {
  return MIN_Y + ((MAX_Y - MIN_Y) * ratio);
}

function oppositeY(y: number): number {
  return y < FIELD_HEIGHT / 2
    ? randomRange(yAt(0.68), yAt(0.95))
    : randomRange(yAt(0.05), yAt(0.32));
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

function crossingSwitchbackRoute(): Point[] {
  const lowStart = randomRange(yAt(0.72), yAt(0.94));
  const high = randomRange(yAt(0.08), yAt(0.28));
  const low = randomRange(yAt(0.66), yAt(0.9));
  const center = randomRange(yAt(0.38), yAt(0.62));
  const verticalX = randomRange(xFromBase(285), xFromBase(350));

  return [
    point(ENTRY_X, lowStart),
    point(jitter(xFromBase(178), xFromBase(20)), high),
    point(jitter(xFromBase(178), xFromBase(20)), low),
    point(jitter(xFromBase(438), xFromBase(24)), high + randomRange(-8, 34)),
    point(verticalX, high + randomRange(-4, 18)),
    point(verticalX, low + randomRange(-18, 18)),
    point(jitter(xFromBase(560), xFromBase(22)), center),
    point(EXIT_X, oppositeY(center)),
  ];
}

function verticalGateRoute(): Point[] {
  const start = randomRange(yAt(0.1), yAt(0.36));
  const firstLow = randomRange(yAt(0.7), yAt(0.94));
  const secondHigh = randomRange(yAt(0.05), yAt(0.24));
  const end = randomRange(yAt(0.56), yAt(0.88));
  const firstX = randomRange(xFromBase(210), xFromBase(260));
  const secondX = randomRange(xFromBase(455), xFromBase(520));

  return [
    point(ENTRY_X, start),
    point(firstX, firstLow),
    point(firstX, secondHigh),
    point(secondX, firstLow + randomRange(-28, 18)),
    point(secondX, secondHigh + randomRange(-12, 28)),
    point(jitter(xFromBase(172), xFromBase(28)), yAt(0.52)),
    point(jitter(xFromBase(552), xFromBase(24)), yAt(0.52) + randomRange(-24, 24)),
    point(EXIT_X, end),
  ];
}

function hourglassRoute(): Point[] {
  const top = randomRange(yAt(0.05), yAt(0.24));
  const bottom = randomRange(yAt(0.74), yAt(0.95));
  const center = randomRange(yAt(0.43), yAt(0.57));
  const leftPost = randomRange(xFromBase(138), xFromBase(190));
  const rightPost = randomRange(xFromBase(500), xFromBase(565));

  return [
    point(ENTRY_X, bottom),
    point(leftPost, bottom),
    point(rightPost, top),
    point(rightPost, bottom),
    point(leftPost + randomRange(xFromBase(60), xFromBase(100)), top),
    point(leftPost + randomRange(xFromBase(60), xFromBase(100)), bottom - randomRange(18, 52)),
    point(jitter(xFromBase(420), xFromBase(34)), center),
    point(EXIT_X, top + randomRange(40, 130)),
  ];
}

function centerSpineRoute(): Point[] {
  const spineX = randomRange(xFromBase(320), xFromBase(380));
  const start = randomRange(yAt(0.12), yAt(0.36));
  const top = randomRange(yAt(0.05), yAt(0.18));
  const bottom = randomRange(yAt(0.78), yAt(0.95));
  const exit = randomRange(yAt(0.34), yAt(0.72));

  return [
    point(ENTRY_X, start),
    point(jitter(xFromBase(260), xFromBase(30)), bottom),
    point(spineX, bottom),
    point(spineX, top),
    point(jitter(xFromBase(150), xFromBase(28)), top + randomRange(70, 130)),
    point(jitter(xFromBase(505), xFromBase(26)), bottom - randomRange(42, 92)),
    point(jitter(xFromBase(505), xFromBase(26)), top + randomRange(16, 56)),
    point(EXIT_X, exit),
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

function buildRoutePoints(): Point[] {
  let fallback = pick(ROUTE_TEMPLATES)();

  for (let attempt = 0; attempt < ROUTE_ATTEMPTS; attempt += 1) {
    const route = pick(ROUTE_TEMPLATES)();
    if (!hasCrowdedTurns(route)) {
      return route;
    }
    fallback = route;
  }

  return fallback;
}

export function createProceduralLevel(): LevelData {
  return {
    name: "Random",
    monsterCount: randomInt(156, 190),
    allowEscape: randomInt(8, 10),
    monsterSequence: buildMonsterSequence(),
    points: buildRoutePoints(),
  };
}
