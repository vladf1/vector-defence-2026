import { FIELD_HEIGHT, FIELD_WIDTH } from "./constants";
import { MonsterKind, type LevelData, type Point } from "./types";
import { clamp, randomRange } from "./utils";

type Beat = "far-sweep" | "follow-through" | "snap-back" | "center-cut" | "edge-dive" | "pocket" | "weave" | "settle";

interface RouteStyle {
  beats: Beat[];
  prefixes: readonly string[];
  suffixes: readonly string[];
}

interface RouteState {
  edgeBias: number;
  flowDir: number;
}

interface AnchorNode {
  x: number;
  y: number;
  lane: number;
}

const ROUTE_STYLES: readonly RouteStyle[] = [
  {
    beats: ["far-sweep", "follow-through", "center-cut", "snap-back", "edge-dive", "settle"],
    prefixes: ["Neon", "Comet", "Solar"],
    suffixes: ["Circuit", "Run", "Drift"],
  },
  {
    beats: ["pocket", "far-sweep", "snap-back", "weave", "pocket", "center-cut"],
    prefixes: ["Chaos", "Ricochet", "Prism"],
    suffixes: ["Maze", "Crossfire", "Switch"],
  },
  {
    beats: ["edge-dive", "follow-through", "weave", "center-cut", "far-sweep", "snap-back"],
    prefixes: ["Nova", "Breaker", "Pulse"],
    suffixes: ["Channel", "Gauntlet", "Spiral"],
  },
  {
    beats: ["weave", "center-cut", "pocket", "far-sweep", "follow-through", "settle"],
    prefixes: ["Vector", "Aurora", "Ion"],
    suffixes: ["Braid", "Drift", "Tangle"],
  },
] as const;

const Y_LANES = [50, 98, 148, 206, 268, 330, 396];
const CENTER_LANE = Math.floor(Y_LANES.length / 2);
const ENTRY_X = 42;
const EXIT_X = FIELD_WIDTH - 58;
const ROUTE_MARGIN_Y = 40;
const MIN_SEGMENT_WIDTH = 64;

function randomInt(min: number, max: number): number {
  return Math.floor(randomRange(min, max + 1));
}

function pick<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function lerp(start: number, end: number, t: number): number {
  return start + ((end - start) * t);
}

function randomSign(): number {
  return Math.random() < 0.5 ? -1 : 1;
}

function laneToY(lane: number): number {
  return Y_LANES[clamp(lane, 0, Y_LANES.length - 1)];
}

function clampY(value: number): number {
  return clamp(value, ROUTE_MARGIN_Y, FIELD_HEIGHT - ROUTE_MARGIN_Y);
}

function createLevelName(style: RouteStyle): string {
  return `${pick(style.prefixes)} ${pick(style.suffixes)}`;
}

function buildMonsterSequence(): MonsterKind[] {
  const rushPool: MonsterKind[] = [MonsterKind.Ball, MonsterKind.Runner, MonsterKind.Runner, MonsterKind.Square, MonsterKind.Triangle, MonsterKind.Triangle];
  const bruiserPool: MonsterKind[] = [MonsterKind.Square, MonsterKind.Triangle, MonsterKind.Tank, MonsterKind.Runner, MonsterKind.Tank, MonsterKind.Berserker];
  const sequenceLength = randomInt(11, 14);
  const sequence: MonsterKind[] = [MonsterKind.Ball, MonsterKind.Runner, MonsterKind.Triangle];

  while (sequence.length < sequenceLength - 3) {
    const pool = sequence.length % 4 === 3 ? bruiserPool : rushPool;
    sequence.push(pick(pool));
  }

  sequence.push(MonsterKind.Square);
  sequence.push(MonsterKind.Tank);
  sequence.push(MonsterKind.Berserker);
  return sequence;
}

function createSegmentXs(segmentCount: number): number[] {
  const totalWidth = EXIT_X - ENTRY_X;
  const baseSegment = totalWidth / segmentCount;
  const xs = [ENTRY_X];
  let previousX = ENTRY_X;

  for (let index = 1; index < segmentCount; index += 1) {
    const remainingSegments = segmentCount - index;
    const ideal = ENTRY_X + (baseSegment * index);
    const jitter = randomRange(-baseSegment * 0.28, baseSegment * 0.28);
    const minX = previousX + MIN_SEGMENT_WIDTH;
    const maxX = EXIT_X - (remainingSegments * MIN_SEGMENT_WIDTH);
    const x = Math.round(clamp(ideal + jitter, minX, maxX));
    xs.push(x);
    previousX = x;
  }

  xs.push(EXIT_X);
  return xs;
}

function addLaneCandidate(candidates: Map<number, number>, lane: number, weight: number): void {
  if (lane < 0 || lane >= Y_LANES.length || weight <= 0) {
    return;
  }
  candidates.set(lane, (candidates.get(lane) ?? 0) + weight);
}

function weightedLanePick(candidates: Map<number, number>, currentLane: number): number {
  const entries = [...candidates.entries()]
    .map(([lane, weight]) => [lane, lane === currentLane ? weight * 0.2 : weight] as const)
    .filter(([, weight]) => weight > 0);

  if (entries.length === 0) {
    return clamp(currentLane + randomSign(), 0, Y_LANES.length - 1);
  }

  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let choice = randomRange(0, totalWeight);
  for (const [lane, weight] of entries) {
    choice -= weight;
    if (choice <= 0) {
      return lane;
    }
  }

  return entries[entries.length - 1][0];
}

function chooseLaneForBeat(beat: Beat, currentLane: number, previousDelta: number, state: RouteState): number {
  const candidates = new Map<number, number>();
  const direction = previousDelta === 0 ? state.flowDir : Math.sign(previousDelta);
  const reverseDirection = direction * -1;
  const towardCenter = Math.sign(CENTER_LANE - currentLane) || reverseDirection;
  const edgeLane = state.edgeBias < 0 ? randomInt(0, 1) : randomInt(Y_LANES.length - 2, Y_LANES.length - 1);
  const oppositeEdgeLane = state.edgeBias < 0 ? randomInt(Y_LANES.length - 2, Y_LANES.length - 1) : randomInt(0, 1);

  switch (beat) {
    case "far-sweep":
      addLaneCandidate(candidates, currentLane + (direction * 2), 4);
      addLaneCandidate(candidates, currentLane + (direction * 3), 3);
      addLaneCandidate(candidates, currentLane + (reverseDirection * 2), 2);
      addLaneCandidate(candidates, CENTER_LANE + direction, 1);
      break;
    case "follow-through":
      addLaneCandidate(candidates, currentLane + direction, 4);
      addLaneCandidate(candidates, currentLane + (direction * 2), 3);
      addLaneCandidate(candidates, currentLane + towardCenter, 2);
      addLaneCandidate(candidates, CENTER_LANE, 1);
      break;
    case "snap-back":
      addLaneCandidate(candidates, currentLane + (reverseDirection * 2), 4);
      addLaneCandidate(candidates, currentLane + (reverseDirection * 3), 3);
      addLaneCandidate(candidates, CENTER_LANE - direction, 2);
      addLaneCandidate(candidates, oppositeEdgeLane, 1);
      break;
    case "center-cut":
      addLaneCandidate(candidates, CENTER_LANE, 4);
      addLaneCandidate(candidates, CENTER_LANE - 1, 2);
      addLaneCandidate(candidates, CENTER_LANE + 1, 2);
      addLaneCandidate(candidates, currentLane + towardCenter, 2);
      break;
    case "edge-dive":
      addLaneCandidate(candidates, edgeLane, 4);
      addLaneCandidate(candidates, currentLane + (state.edgeBias * 2), 3);
      addLaneCandidate(candidates, currentLane + state.edgeBias, 2);
      addLaneCandidate(candidates, currentLane + reverseDirection, 1);
      break;
    case "pocket":
      addLaneCandidate(candidates, currentLane + direction, 3);
      addLaneCandidate(candidates, currentLane + reverseDirection, 3);
      addLaneCandidate(candidates, currentLane + (direction * 2), 2);
      addLaneCandidate(candidates, CENTER_LANE + reverseDirection, 1);
      break;
    case "weave":
      addLaneCandidate(candidates, currentLane + direction, 3);
      addLaneCandidate(candidates, currentLane + reverseDirection, 3);
      addLaneCandidate(candidates, currentLane + (direction * 2), 2);
      addLaneCandidate(candidates, CENTER_LANE + randomSign(), 2);
      break;
    case "settle":
      addLaneCandidate(candidates, CENTER_LANE, 3);
      addLaneCandidate(candidates, currentLane + towardCenter, 3);
      addLaneCandidate(candidates, currentLane, 1);
      addLaneCandidate(candidates, CENTER_LANE + state.flowDir, 1);
      break;
  }

  return weightedLanePick(candidates, currentLane);
}

function createAnchorNode(x: number, lane: number, jitter = 10): AnchorNode {
  return {
    x: Math.round(x),
    lane,
    y: Math.round(clampY(laneToY(lane) + randomRange(-jitter, jitter))),
  };
}

function createAnchorNodes(style: RouteStyle): AnchorNode[] {
  const xs = createSegmentXs(style.beats.length);
  const nodes: AnchorNode[] = [];
  const state: RouteState = {
    edgeBias: randomSign(),
    flowDir: randomSign(),
  };

  let currentLane = randomInt(1, Y_LANES.length - 2);
  let previousDelta = state.flowDir;
  nodes.push(createAnchorNode(xs[0], currentLane, 6));

  for (let index = 0; index < style.beats.length; index += 1) {
    const beat = style.beats[index];
    const nextLane = chooseLaneForBeat(beat, currentLane, previousDelta, state);
    const delta = nextLane - currentLane;
    if (delta !== 0) {
      previousDelta = delta;
      state.flowDir = Math.sign(delta);
    } else if (Math.random() < 0.35) {
      state.flowDir *= -1;
    }
    currentLane = nextLane;
    nodes.push(createAnchorNode(xs[index + 1], currentLane, index === style.beats.length - 1 ? 8 : 11));
  }

  return nodes;
}

function createControlPoint(x: number, y: number): Point {
  return {
    x: Math.round(x),
    y: Math.round(clampY(y)),
  };
}

function createSegmentControlPoints(from: AnchorNode, to: AnchorNode, beat: Beat): Point[] {
  const gap = to.x - from.x;
  const dy = to.y - from.y;
  const points: Point[] = [];

  if (gap < 74) {
    return points;
  }

  switch (beat) {
    case "far-sweep":
      points.push(createControlPoint(
        lerp(from.x, to.x, randomRange(0.42, 0.62)),
        lerp(from.y, to.y, 0.48) + randomRange(-55, 55),
      ));
      break;
    case "follow-through":
      if (gap > 96) {
        points.push(createControlPoint(
          lerp(from.x, to.x, randomRange(0.34, 0.46)),
          from.y + (dy * randomRange(0.18, 0.34)) + randomRange(-24, 24),
        ));
      }
      break;
    case "snap-back":
      if (gap > 120) {
        points.push(createControlPoint(
          lerp(from.x, to.x, randomRange(0.25, 0.35)),
          from.y + randomRange(-46, 46),
        ));
      }
      points.push(createControlPoint(
        lerp(from.x, to.x, randomRange(0.62, 0.74)),
        lerp(from.y, to.y, 0.55) + randomRange(-72, 72),
      ));
      break;
    case "center-cut":
      points.push(createControlPoint(
        lerp(from.x, to.x, randomRange(0.44, 0.58)),
        lerp(from.y, to.y, 0.5) + randomRange(-38, 38),
      ));
      break;
    case "edge-dive":
      points.push(createControlPoint(
        lerp(from.x, to.x, randomRange(0.56, 0.72)),
        lerp(from.y, to.y, 0.6) + randomRange(-58, 58),
      ));
      break;
    case "pocket":
      if (gap > 110) {
        points.push(createControlPoint(
          lerp(from.x, to.x, randomRange(0.24, 0.34)),
          from.y + randomRange(-26, 26),
        ));
      }
      points.push(createControlPoint(
        lerp(from.x, to.x, randomRange(0.6, 0.74)),
        to.y + randomRange(-60, 60),
      ));
      break;
    case "weave":
      points.push(createControlPoint(
        lerp(from.x, to.x, randomRange(0.38, 0.52)),
        lerp(from.y, to.y, 0.4) + randomRange(-46, 46),
      ));
      break;
    case "settle":
      if (Math.abs(dy) > 36 && gap > 100) {
        points.push(createControlPoint(
          lerp(from.x, to.x, randomRange(0.48, 0.62)),
          lerp(from.y, to.y, 0.52) + randomRange(-20, 20),
        ));
      }
      break;
  }

  return points;
}

function buildRoutePoints(style: RouteStyle): Point[] {
  const anchors = createAnchorNodes(style);
  const points: Point[] = [createControlPoint(anchors[0].x, anchors[0].y)];

  for (let index = 0; index < style.beats.length; index += 1) {
    const from = anchors[index];
    const to = anchors[index + 1];
    const controls = createSegmentControlPoints(from, to, style.beats[index]);
    points.push(...controls, createControlPoint(to.x, to.y));
  }

  return points;
}

export function createProceduralLevel(): LevelData {
  const style = pick(ROUTE_STYLES);

  return {
    name: createLevelName(style),
    monsterCount: randomInt(148, 182),
    allowEscape: randomInt(8, 11),
    monsterSequence: buildMonsterSequence(),
    points: buildRoutePoints(style),
  };
}
