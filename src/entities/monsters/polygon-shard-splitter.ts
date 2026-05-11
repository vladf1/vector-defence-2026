import type { Point } from "../../types";

export interface PolygonShardSplitterConfig {
  minShardCount: number;
  maxShardCount: number;
  maxConsecutiveSplitFailures: number;
  crackAttemptsPerShard: number;
  minBoundarySeparationRatio: number;
  boundaryEndpointInsetRatio: number;
  interiorPointAttempts: number;
  minInteriorDotEdgeDistanceRatio: number;
  minShardAreaRatio: number;
  maxShardAreaRatio: number;
  maxSplitChildAreaRatio: number;
  preferredMaxShardVertices: number;
  maxShardVertices: number;
  minBendCountPerCrackSegment: number;
  maxBendCountPerCrackSegment: number;
  bendOffsetRatio: number;
  pointMergeDistance: number;
  collinearDistance: number;
  areaToleranceRatio: number;
  maxCrackVertices: number;
  random: () => number;
}

export interface Shard {
  vertices: Point[];
}

interface BoundarySample {
  point: Point;
  edgeIndex: number;
  distance: number;
  ratio: number;
}

interface EdgeMetric {
  length: number;
  distanceAtStart: number;
}

export class PolygonShardSplitter {
  constructor(private readonly config: PolygonShardSplitterConfig) {}

  splitIntoShards(outline: readonly Point[]): Shard[] {
    const sourcePolygon = simplifyPolygon([...outline], this.config);
    if (sourcePolygon.length < 3) {
      return [];
    }

    const sourceArea = polygonArea(sourcePolygon);
    if (sourceArea === 0) {
      return [];
    }

    const targetShardCount = randomInteger(
      this.config.minShardCount,
      this.config.maxShardCount,
      this.config.random,
    );
    let shards = [sourcePolygon];
    let bestShards = shards;
    let consecutiveFailures = 0;

    while (
      (
        shards.length < targetShardCount ||
        maxShardAreaRatio(shards, sourceArea) > this.config.maxShardAreaRatio
      ) &&
      shards.length < this.config.maxShardCount &&
      consecutiveFailures < this.config.maxConsecutiveSplitFailures
    ) {
      const shardIndex = this.chooseShardIndex(shards, sourceArea);
      if (shardIndex === -1) {
        break;
      }

      const split = this.trySplitShard(shards[shardIndex], sourceArea);
      if (split === null) {
        consecutiveFailures += 1;
        continue;
      }

      shards = [
        ...shards.slice(0, shardIndex),
        split[0],
        split[1],
        ...shards.slice(shardIndex + 1),
      ];
      consecutiveFailures = 0;

      if (
        shardSetScore(shards, sourceArea, this.config) >
          shardSetScore(bestShards, sourceArea, this.config)
      ) {
        bestShards = shards;
      }
    }

    return bestShards.map((shard) => ({
      vertices: simplifyPolygon(shard, this.config),
    }));
  }

  private chooseShardIndex(shards: Point[][], sourceArea: number): number {
    const candidates = shards
      .map((shard, index) => ({
        index,
        area: polygonArea(shard),
      }))
      .filter(
        ({ area }) => area >= sourceArea * this.config.minShardAreaRatio * 2.15,
      );

    if (candidates.length === 0) {
      return -1;
    }

    const oversizedCandidates = candidates.filter(
      ({ area }) => area > sourceArea * this.config.maxShardAreaRatio,
    );
    const weightedCandidates = oversizedCandidates.length > 0
      ? oversizedCandidates
      : candidates;

    const totalWeight = weightedCandidates.reduce(
      (sum, candidate) => sum + (candidate.area * candidate.area),
      0,
    );
    let threshold = this.config.random() * totalWeight;
    for (const candidate of weightedCandidates) {
      threshold -= candidate.area * candidate.area;
      if (threshold <= 0) {
        return candidate.index;
      }
    }

    return weightedCandidates[weightedCandidates.length - 1].index;
  }

  private trySplitShard(polygon: Point[], sourceArea: number): [Point[], Point[]] | null {
    const polygonAreaValue = polygonArea(polygon);
    const edgeMetrics = createEdgeMetrics(polygon);
    if (edgeMetrics.perimeter === 0) {
      return null;
    }

    for (let attempt = 0; attempt < this.config.crackAttemptsPerShard; attempt += 1) {
      const boundaryPair = this.sampleBoundaryPair(polygon, edgeMetrics);
      if (boundaryPair === null) {
        continue;
      }

      const interiorDot = this.sampleInteriorDot(polygon);
      if (interiorDot === null) {
        continue;
      }

      const crackPath = this.createCrackPath(
        boundaryPair.start.point,
        interiorDot,
        boundaryPair.end.point,
        polygon,
      );
      if (crackPath === null) {
        continue;
      }

      if (!this.isValidCrackPath(crackPath, polygon, boundaryPair.start, boundaryPair.end)) {
        continue;
      }

      const split = splitPolygonWithCrack(
        polygon,
        boundaryPair.start,
        boundaryPair.end,
        crackPath,
        this.config,
      );
      if (split === null) {
        continue;
      }

      const splitArea = polygonArea(split[0]) + polygonArea(split[1]);
      const areaDeltaRatio = Math.abs(splitArea - polygonAreaValue) / polygonAreaValue;
      if (areaDeltaRatio > this.config.areaToleranceRatio) {
        continue;
      }

      const largestChildAreaRatio = Math.max(
        polygonArea(split[0]),
        polygonArea(split[1]),
      ) / polygonAreaValue;
      if (largestChildAreaRatio > this.config.maxSplitChildAreaRatio) {
        continue;
      }

      if (
        split.every((shard) =>
          isReadableShard(shard, sourceArea, this.config) &&
          isSimplePolygon(shard, this.config.pointMergeDistance)
        )
      ) {
        return split;
      }
    }

    return null;
  }

  private sampleBoundaryPair(
    polygon: Point[],
    edgeMetrics: { edges: EdgeMetric[]; perimeter: number },
  ): { start: BoundarySample; end: BoundarySample } | null {
    const maxAttempts = this.config.crackAttemptsPerShard * 3;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const start = sampleBoundaryAtDistance(
        polygon,
        edgeMetrics.edges,
        this.config.random() * edgeMetrics.perimeter,
      );
      const end = sampleBoundaryAtDistance(
        polygon,
        edgeMetrics.edges,
        this.config.random() * edgeMetrics.perimeter,
      );
      if (start.edgeIndex === end.edgeIndex) {
        continue;
      }
      if (
        start.ratio < this.config.boundaryEndpointInsetRatio ||
        start.ratio > 1 - this.config.boundaryEndpointInsetRatio ||
        end.ratio < this.config.boundaryEndpointInsetRatio ||
        end.ratio > 1 - this.config.boundaryEndpointInsetRatio
      ) {
        continue;
      }

      const directDistance = Math.abs(start.distance - end.distance);
      const separation = Math.min(
        directDistance,
        edgeMetrics.perimeter - directDistance,
      );
      if (separation < edgeMetrics.perimeter * this.config.minBoundarySeparationRatio) {
        continue;
      }

      return { start, end };
    }

    return null;
  }

  private sampleInteriorDot(polygon: Point[]): Point | null {
    const bounds = polygonBounds(polygon);
    const center = polygonCentroid(polygon);
    const diagonal = Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    const minEdgeDistance = diagonal * this.config.minInteriorDotEdgeDistanceRatio;

    for (let attempt = 0; attempt < this.config.interiorPointAttempts; attempt += 1) {
      const angle = this.config.random() * Math.PI * 2;
      const distance = Math.sqrt(this.config.random()) * diagonal * 0.28;
      const point = {
        x: center.x + Math.cos(angle) * distance,
        y: center.y + Math.sin(angle) * distance,
      };

      if (
        pointInsidePolygon(point, polygon, this.config.pointMergeDistance) &&
        distanceToPolygonBoundary(point, polygon) >= minEdgeDistance
      ) {
        return point;
      }
    }

    for (let attempt = 0; attempt < this.config.interiorPointAttempts; attempt += 1) {
      const point = {
        x: bounds.minX + (this.config.random() * (bounds.maxX - bounds.minX)),
        y: bounds.minY + (this.config.random() * (bounds.maxY - bounds.minY)),
      };

      if (
        pointInsidePolygon(point, polygon, this.config.pointMergeDistance) &&
        distanceToPolygonBoundary(point, polygon) >= minEdgeDistance
      ) {
        return point;
      }
    }

    return null;
  }

  private createCrackPath(
    start: Point,
    interiorDot: Point,
    end: Point,
    polygon: Point[],
  ): Point[] | null {
    const firstBends = this.createBends(start, interiorDot);
    const secondBends = this.createBends(interiorDot, end);
    const crackPath = [start, ...firstBends, interiorDot, ...secondBends, end];
    if (crackPath.length > this.config.maxCrackVertices) {
      return null;
    }

    for (const point of crackPath.slice(1, -1)) {
      if (!pointInsidePolygon(point, polygon, this.config.pointMergeDistance)) {
        return null;
      }
    }

    return crackPath;
  }

  private createBends(start: Point, end: Point): Point[] {
    const bendCount = randomInteger(
      this.config.minBendCountPerCrackSegment,
      this.config.maxBendCountPerCrackSegment,
      this.config.random,
    );
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    const normalX = length === 0 ? 0 : -dy / length;
    const normalY = length === 0 ? 0 : dx / length;
    const bends: Point[] = [];

    for (let index = 0; index < bendCount; index += 1) {
      const baseRatio = (index + 1) / (bendCount + 1);
      const ratio = baseRatio + ((this.config.random() - 0.5) * 0.18);
      const offset = (this.config.random() - 0.5) * length * this.config.bendOffsetRatio;
      bends.push({
        x: start.x + (dx * ratio) + (normalX * offset),
        y: start.y + (dy * ratio) + (normalY * offset),
      });
    }

    return bends;
  }

  private isValidCrackPath(
    crackPath: Point[],
    polygon: Point[],
    start: BoundarySample,
    end: BoundarySample,
  ): boolean {
    for (let index = 0; index < crackPath.length - 1; index += 1) {
      const segmentStart = crackPath[index];
      const segmentEnd = crackPath[index + 1];
      const midpoint = {
        x: (segmentStart.x + segmentEnd.x) / 2,
        y: (segmentStart.y + segmentEnd.y) / 2,
      };
      if (!pointInsidePolygon(midpoint, polygon, this.config.pointMergeDistance)) {
        return false;
      }

      for (let edgeIndex = 0; edgeIndex < polygon.length; edgeIndex += 1) {
        if (
          (index === 0 && edgeIndex === start.edgeIndex) ||
          (index === crackPath.length - 2 && edgeIndex === end.edgeIndex)
        ) {
          continue;
        }

        const edgeStart = polygon[edgeIndex];
        const edgeEnd = polygon[(edgeIndex + 1) % polygon.length];
        if (
          segmentsIntersect(
            segmentStart,
            segmentEnd,
            edgeStart,
            edgeEnd,
            this.config.pointMergeDistance,
          )
        ) {
          return false;
        }
      }
    }

    for (let leftIndex = 0; leftIndex < crackPath.length - 1; leftIndex += 1) {
      for (let rightIndex = leftIndex + 2; rightIndex < crackPath.length - 1; rightIndex += 1) {
        if (
          segmentsIntersect(
            crackPath[leftIndex],
            crackPath[leftIndex + 1],
            crackPath[rightIndex],
            crackPath[rightIndex + 1],
            this.config.pointMergeDistance,
          )
        ) {
          return false;
        }
      }
    }

    return true;
  }
}

function splitPolygonWithCrack(
  polygon: Point[],
  start: BoundarySample,
  end: BoundarySample,
  crackPath: Point[],
  config: PolygonShardSplitterConfig,
): [Point[], Point[]] | null {
  const startToEndBoundary = boundaryChain(polygon, start, end);
  const endToStartBoundary = boundaryChain(polygon, end, start);
  const reversedCrackInterior = crackPath.slice(1, -1).reverse();
  const crackInterior = crackPath.slice(1, -1);

  const firstShard = simplifyPolygon(
    [...startToEndBoundary, ...reversedCrackInterior],
    config,
  );
  const secondShard = simplifyPolygon(
    [crackPath[0], ...crackInterior, crackPath[crackPath.length - 1], ...endToStartBoundary.slice(1, -1)],
    config,
  );

  if (firstShard.length < 3 || secondShard.length < 3) {
    return null;
  }

  return [firstShard, secondShard];
}

function boundaryChain(polygon: Point[], start: BoundarySample, end: BoundarySample): Point[] {
  const chain = [clonePoint(start.point)];
  let index = (start.edgeIndex + 1) % polygon.length;
  const stopIndex = (end.edgeIndex + 1) % polygon.length;
  let guard = 0;

  while (index !== stopIndex && guard <= polygon.length) {
    chain.push(clonePoint(polygon[index]));
    index = (index + 1) % polygon.length;
    guard += 1;
  }

  chain.push(clonePoint(end.point));
  return chain;
}

function createEdgeMetrics(polygon: Point[]): { edges: EdgeMetric[]; perimeter: number } {
  const edges: EdgeMetric[] = [];
  let perimeter = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    edges.push({ length, distanceAtStart: perimeter });
    perimeter += length;
  }

  return { edges, perimeter };
}

function sampleBoundaryAtDistance(
  polygon: Point[],
  edgeMetrics: EdgeMetric[],
  distance: number,
): BoundarySample {
  for (let index = 0; index < edgeMetrics.length; index += 1) {
    const edge = edgeMetrics[index];
    if (distance <= edge.distanceAtStart + edge.length) {
      const start = polygon[index];
      const end = polygon[(index + 1) % polygon.length];
      const ratio = edge.length === 0 ? 0 : (distance - edge.distanceAtStart) / edge.length;
      return {
        point: {
          x: start.x + ((end.x - start.x) * ratio),
          y: start.y + ((end.y - start.y) * ratio),
        },
        edgeIndex: index,
        distance,
        ratio,
      };
    }
  }

  return {
    point: clonePoint(polygon[0]),
    edgeIndex: 0,
    distance: 0,
    ratio: 0,
  };
}

function isReadableShard(
  shard: Point[],
  sourceArea: number,
  config: PolygonShardSplitterConfig,
): boolean {
  const area = polygonArea(shard);
  return (
    shard.length >= 3 &&
    shard.length <= config.maxShardVertices &&
    area >= sourceArea * config.minShardAreaRatio
  );
}

function maxShardAreaRatio(shards: Point[][], sourceArea: number): number {
  return Math.max(...shards.map((shard) => polygonArea(shard) / sourceArea));
}

function shardSetScore(
  shards: Point[][],
  sourceArea: number,
  config: PolygonShardSplitterConfig,
): number {
  const preferredVertexCount = shards.filter(
    (shard) => shard.length <= config.preferredMaxShardVertices,
  ).length;
  const largestShardPenalty = maxShardAreaRatio(shards, sourceArea) * 80;
  return (shards.length * 100) + preferredVertexCount - largestShardPenalty;
}

function simplifyPolygon(
  points: Point[],
  config: PolygonShardSplitterConfig,
): Point[] {
  let simplified = removeDuplicatePoints(points, config.pointMergeDistance);
  let changed = true;

  while (changed && simplified.length >= 3) {
    changed = false;
    for (let index = 0; index < simplified.length; index += 1) {
      const previous = simplified[(index - 1 + simplified.length) % simplified.length];
      const current = simplified[index];
      const next = simplified[(index + 1) % simplified.length];
      if (
        distanceToSegment(current, previous, next) <= config.collinearDistance ||
        pointsEqual(previous, next, config.pointMergeDistance)
      ) {
        simplified = [
          ...simplified.slice(0, index),
          ...simplified.slice(index + 1),
        ];
        changed = true;
        break;
      }
    }
  }

  return simplified;
}

function removeDuplicatePoints(points: Point[], epsilon: number): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    if (
      result.length === 0 ||
      !pointsEqual(result[result.length - 1], point, epsilon)
    ) {
      result.push(clonePoint(point));
    }
  }

  if (
    result.length > 1 &&
    pointsEqual(result[0], result[result.length - 1], epsilon)
  ) {
    result.pop();
  }

  return result;
}

function isSimplePolygon(polygon: Point[], epsilon: number): boolean {
  for (let leftIndex = 0; leftIndex < polygon.length; leftIndex += 1) {
    const leftStart = polygon[leftIndex];
    const leftEnd = polygon[(leftIndex + 1) % polygon.length];
    for (let rightIndex = leftIndex + 1; rightIndex < polygon.length; rightIndex += 1) {
      const rightStart = polygon[rightIndex];
      const rightEnd = polygon[(rightIndex + 1) % polygon.length];
      const adjacent =
        rightIndex === leftIndex + 1 ||
        (leftIndex === 0 && rightIndex === polygon.length - 1);
      if (adjacent) {
        continue;
      }

      if (segmentsIntersect(leftStart, leftEnd, rightStart, rightEnd, epsilon)) {
        return false;
      }
    }
  }

  return true;
}

function polygonArea(polygon: readonly Point[]): number {
  let total = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    total += (current.x * next.y) - (next.x * current.y);
  }
  return Math.abs(total) / 2;
}

function polygonCentroid(polygon: readonly Point[]): Point {
  let signedAreaTotal = 0;
  let xTotal = 0;
  let yTotal = 0;

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const signedArea = (current.x * next.y) - (next.x * current.y);
    signedAreaTotal += signedArea;
    xTotal += (current.x + next.x) * signedArea;
    yTotal += (current.y + next.y) * signedArea;
  }

  if (Math.abs(signedAreaTotal) < 0.000001) {
    return polygon[0];
  }

  return {
    x: xTotal / (signedAreaTotal * 3),
    y: yTotal / (signedAreaTotal * 3),
  };
}

function polygonBounds(polygon: readonly Point[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = polygon[0].x;
  let maxX = polygon[0].x;
  let minY = polygon[0].y;
  let maxY = polygon[0].y;
  for (const point of polygon) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, maxX, minY, maxY };
}

function pointInsidePolygon(point: Point, polygon: readonly Point[], epsilon: number): boolean {
  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index];
    const previous = polygon[previousIndex];

    if (pointOnSegment(point, previous, current, epsilon)) {
      return true;
    }

    if (
      (current.y > point.y) !== (previous.y > point.y) &&
      point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x
    ) {
      inside = !inside;
    }
  }

  return inside;
}

function distanceToPolygonBoundary(point: Point, polygon: readonly Point[]): number {
  let minDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < polygon.length; index += 1) {
    minDistance = Math.min(
      minDistance,
      distanceToSegment(point, polygon[index], polygon[(index + 1) % polygon.length]),
    );
  }
  return minDistance;
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = (dx * dx) + (dy * dy);
  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const ratio = clamp(
    (((point.x - start.x) * dx) + ((point.y - start.y) * dy)) / lengthSquared,
    0,
    1,
  );
  return Math.hypot(
    point.x - (start.x + (dx * ratio)),
    point.y - (start.y + (dy * ratio)),
  );
}

function segmentsIntersect(
  a: Point,
  b: Point,
  c: Point,
  d: Point,
  epsilon: number,
): boolean {
  const directionA = orientation(a, b, c);
  const directionB = orientation(a, b, d);
  const directionC = orientation(c, d, a);
  const directionD = orientation(c, d, b);

  if (
    Math.abs(directionA) <= epsilon &&
    pointOnSegment(c, a, b, epsilon)
  ) {
    return true;
  }
  if (
    Math.abs(directionB) <= epsilon &&
    pointOnSegment(d, a, b, epsilon)
  ) {
    return true;
  }
  if (
    Math.abs(directionC) <= epsilon &&
    pointOnSegment(a, c, d, epsilon)
  ) {
    return true;
  }
  if (
    Math.abs(directionD) <= epsilon &&
    pointOnSegment(b, c, d, epsilon)
  ) {
    return true;
  }

  return (
    (directionA > 0) !== (directionB > 0) &&
    (directionC > 0) !== (directionD > 0)
  );
}

function orientation(a: Point, b: Point, c: Point): number {
  return ((b.x - a.x) * (c.y - a.y)) - ((b.y - a.y) * (c.x - a.x));
}

function pointOnSegment(point: Point, start: Point, end: Point, epsilon: number): boolean {
  return (
    Math.abs(orientation(start, end, point)) <= epsilon &&
    point.x >= Math.min(start.x, end.x) - epsilon &&
    point.x <= Math.max(start.x, end.x) + epsilon &&
    point.y >= Math.min(start.y, end.y) - epsilon &&
    point.y <= Math.max(start.y, end.y) + epsilon
  );
}

function pointsEqual(left: Point, right: Point, epsilon: number): boolean {
  return Math.hypot(left.x - right.x, left.y - right.y) <= epsilon;
}

function randomInteger(
  minValue: number,
  maxValue: number,
  random: () => number,
): number {
  return minValue + Math.floor(random() * (maxValue - minValue + 1));
}

function clonePoint(point: Point): Point {
  return { x: point.x, y: point.y };
}

function clamp(value: number, minValue: number, maxValue: number): number {
  return Math.min(maxValue, Math.max(minValue, value));
}
