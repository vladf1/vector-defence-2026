import { ROAD_TURN_RADIUS, ROUTE_CURVE_SAMPLE_STEP } from "./constants";
import type { Point } from "./types";
import { calculateDistance } from "./utils";

export type RoutePathCommand =
  | { kind: "line"; point: Point }
  | { kind: "quadratic"; control: Point; point: Point };

export interface PathEntry extends Point {
  totalDistance: number;
}

export interface RouteMotionPath {
  start: Point;
  commands: RoutePathCommand[];
  entries: PathEntry[];
}

interface RoundedTurn {
  index: number;
  entry: Point;
  control: Point;
  exit: Point;
}

export function createRouteMotionPath(points: readonly Point[]): RouteMotionPath {
  const start = points[0] ?? { x: 0, y: 0 };
  const smoothedPoints: Point[] = [{ x: start.x, y: start.y }];

  if (points.length < 2) {
    return {
      start,
      commands: [],
      entries: createPathEntries(smoothedPoints),
    };
  }

  const turns = createRoundedTurns(points);
  const commands: RoutePathCommand[] = [];
  let current = start;
  let turnIndex = 0;

  for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex += 1) {
    const nextTurn = turns[turnIndex];
    const segmentEnd = nextTurn?.index === segmentIndex + 1
      ? nextTurn.entry
      : points[segmentIndex + 1];

    appendLine(commands, smoothedPoints, current, segmentEnd);
    current = segmentEnd;

    if (nextTurn?.index === segmentIndex + 1) {
      appendQuadratic(commands, smoothedPoints, nextTurn.entry, nextTurn.control, nextTurn.exit);
      current = nextTurn.exit;
      turnIndex += 1;
    }
  }

  return {
    start,
    commands,
    entries: createPathEntries(smoothedPoints),
  };
}

export function createPathEntries(points: Point[]): PathEntry[] {
  const entries: PathEntry[] = [];
  let totalDistance = 0;

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (index > 0) {
      const previous = points[index - 1];
      totalDistance += calculateDistance(previous.x, previous.y, point.x, point.y);
    }
    entries.push({
      x: point.x,
      y: point.y,
      totalDistance,
    });
  }

  return entries;
}

export function createPathEntriesFromTail(spawnPoint: Point, source: readonly PathEntry[], tailStartIndex: number): PathEntry[] {
  const firstTailIndex = Math.min(Math.max(0, tailStartIndex), source.length);
  const entries: PathEntry[] = [{
    x: spawnPoint.x,
    y: spawnPoint.y,
    totalDistance: 0,
  }];

  const firstTailEntry = source[firstTailIndex];
  if (!firstTailEntry) {
    return entries;
  }

  const firstSegmentLength = calculateDistance(spawnPoint.x, spawnPoint.y, firstTailEntry.x, firstTailEntry.y);
  const sourceBaseDistance = firstTailEntry.totalDistance;
  for (let index = firstTailIndex; index < source.length; index += 1) {
    const entry = source[index];
    entries.push({
      x: entry.x,
      y: entry.y,
      totalDistance: firstSegmentLength + (entry.totalDistance - sourceBaseDistance),
    });
  }

  return entries;
}

function createRoundedTurns(points: readonly Point[]): RoundedTurn[] {
  const turns: RoundedTurn[] = [];

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const control = points[index];
    const next = points[index + 1];
    const previousLength = calculateDistance(previous.x, previous.y, control.x, control.y);
    const nextLength = calculateDistance(control.x, control.y, next.x, next.y);
    const turnDistance = Math.min(ROAD_TURN_RADIUS, previousLength * 0.45, nextLength * 0.45);

    if (turnDistance <= 1) {
      continue;
    }

    turns.push({
      index,
      entry: pointToward(control, previous, turnDistance),
      control,
      exit: pointToward(control, next, turnDistance),
    });
  }

  return turns;
}

function pointToward(source: Point, target: Point, distance: number): Point {
  const total = calculateDistance(source.x, source.y, target.x, target.y);
  if (total === 0) {
    return { x: source.x, y: source.y };
  }

  const ratio = distance / total;
  return {
    x: source.x + ((target.x - source.x) * ratio),
    y: source.y + ((target.y - source.y) * ratio),
  };
}

function appendLine(
  commands: RoutePathCommand[],
  points: Point[],
  start: Point,
  end: Point,
): void {
  const length = calculateDistance(start.x, start.y, end.x, end.y);
  if (length <= 0) {
    return;
  }

  commands.push({ kind: "line", point: end });
  const steps = Math.max(1, Math.ceil(length / ROUTE_CURVE_SAMPLE_STEP));
  for (let step = 1; step <= steps; step += 1) {
    const ratio = step / steps;
    appendPoint(points, {
      x: start.x + ((end.x - start.x) * ratio),
      y: start.y + ((end.y - start.y) * ratio),
    });
  }
}

function appendQuadratic(
  commands: RoutePathCommand[],
  points: Point[],
  start: Point,
  control: Point,
  end: Point,
): void {
  commands.push({ kind: "quadratic", control, point: end });
  const estimatedLength = calculateDistance(start.x, start.y, control.x, control.y)
    + calculateDistance(control.x, control.y, end.x, end.y);
  const steps = Math.max(4, Math.ceil(estimatedLength / ROUTE_CURVE_SAMPLE_STEP));

  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const inverse = 1 - t;
    appendPoint(points, {
      x: (inverse * inverse * start.x) + (2 * inverse * t * control.x) + (t * t * end.x),
      y: (inverse * inverse * start.y) + (2 * inverse * t * control.y) + (t * t * end.y),
    });
  }
}

function appendPoint(points: Point[], point: Point): void {
  const previous = points[points.length - 1];
  if (calculateDistance(previous.x, previous.y, point.x, point.y) <= 0) {
    return;
  }

  points.push(point);
}
