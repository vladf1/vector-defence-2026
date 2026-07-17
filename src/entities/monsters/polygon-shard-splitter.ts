import type { Point } from "../../types";
import { clamp } from "../../utils";

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

export type PolygonShardSplitterConfigOptions = {
  minShardCount: number;
  maxShardCount: number;
  random?: () => number;
} & Partial<Omit<PolygonShardSplitterConfig, "minShardCount" | "maxShardCount" | "random">>;

export interface Shard {
  vertices: Point[];
}

interface WorkingShard extends Shard {
  area: number;
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

interface InteriorSampleGeometry {
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  center: Point;
  diagonal: number;
  minEdgeDistanceSquared: number;
}

export function createPolygonShardSplitterConfig(
  options: PolygonShardSplitterConfigOptions,
): PolygonShardSplitterConfig {
  return {
    minShardCount: options.minShardCount,
    maxShardCount: options.maxShardCount,
    maxConsecutiveSplitFailures: options.maxConsecutiveSplitFailures ?? 360,
    crackAttemptsPerShard: options.crackAttemptsPerShard ?? 16,
    minBoundarySeparationRatio: options.minBoundarySeparationRatio ?? 0.2,
    boundaryEndpointInsetRatio: options.boundaryEndpointInsetRatio ?? 0.055,
    interiorPointAttempts: options.interiorPointAttempts ?? 72,
    minInteriorDotEdgeDistanceRatio: options.minInteriorDotEdgeDistanceRatio ?? 0.025,
    minShardAreaRatio: options.minShardAreaRatio ?? 0.034,
    maxShardAreaRatio: options.maxShardAreaRatio ?? 0.56,
    maxSplitChildAreaRatio: options.maxSplitChildAreaRatio ?? 0.72,
    preferredMaxShardVertices: options.preferredMaxShardVertices ?? 9,
    maxShardVertices: options.maxShardVertices ?? 11,
    minBendCountPerCrackSegment: options.minBendCountPerCrackSegment ?? 1,
    maxBendCountPerCrackSegment: options.maxBendCountPerCrackSegment ?? 1,
    bendOffsetRatio: options.bendOffsetRatio ?? 0.18,
    pointMergeDistance: options.pointMergeDistance ?? 0.025,
    collinearDistance: options.collinearDistance ?? 0.035,
    areaToleranceRatio: options.areaToleranceRatio ?? 0.035,
    maxCrackVertices: options.maxCrackVertices ?? 5,
    random: options.random ?? Math.random,
  };
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
    let shards: WorkingShard[] = [{ vertices: sourcePolygon, area: sourceArea }];
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
      vertices: shard.vertices.map(clonePoint),
    }));
  }

  private chooseShardIndex(shards: WorkingShard[], sourceArea: number): number {
    const minCandidateArea = sourceArea * this.config.minShardAreaRatio * 2.15;
    const oversizedArea = sourceArea * this.config.maxShardAreaRatio;
    let hasOversizedCandidate = false;
    let totalWeight = 0;
    let lastCandidateIndex = -1;

    for (let index = 0; index < shards.length; index += 1) {
      const area = shards[index].area;
      if (area < minCandidateArea) {
        continue;
      }

      const isOversized = area > oversizedArea;
      if (isOversized && !hasOversizedCandidate) {
        hasOversizedCandidate = true;
        totalWeight = 0;
        lastCandidateIndex = -1;
      }
      if (hasOversizedCandidate && !isOversized) {
        continue;
      }

      totalWeight += area * area;
      lastCandidateIndex = index;
    }

    if (lastCandidateIndex === -1) {
      return -1;
    }

    let threshold = this.config.random() * totalWeight;
    for (let index = 0; index < shards.length; index += 1) {
      const area = shards[index].area;
      if (
        area < minCandidateArea ||
        (hasOversizedCandidate && area <= oversizedArea)
      ) {
        continue;
      }

      threshold -= area * area;
      if (threshold <= 0) {
        return index;
      }
    }

    return lastCandidateIndex;
  }

  private trySplitShard(shard: WorkingShard, sourceArea: number): [WorkingShard, WorkingShard] | null {
    const polygon = shard.vertices;
    const polygonAreaValue = shard.area;
    const edgeMetrics = createEdgeMetrics(polygon);
    if (edgeMetrics.perimeter === 0) {
      return null;
    }
    const interiorSampleGeometry = createInteriorSampleGeometry(polygon, this.config);

    for (let attempt = 0; attempt < this.config.crackAttemptsPerShard; attempt += 1) {
      const boundaryPair = this.sampleBoundaryPair(polygon, edgeMetrics);
      if (boundaryPair === null) {
        continue;
      }

      const interiorDot = this.sampleInteriorDot(polygon, interiorSampleGeometry);
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

      const firstArea = polygonArea(split[0]);
      const secondArea = polygonArea(split[1]);
      const splitArea = firstArea + secondArea;
      const areaDeltaRatio = Math.abs(splitArea - polygonAreaValue) / polygonAreaValue;
      if (areaDeltaRatio > this.config.areaToleranceRatio) {
        continue;
      }

      const largestChildAreaRatio = Math.max(firstArea, secondArea) / polygonAreaValue;
      if (largestChildAreaRatio > this.config.maxSplitChildAreaRatio) {
        continue;
      }

      if (
        isReadableShard(split[0], firstArea, sourceArea, this.config) &&
        isSimplePolygon(split[0], this.config.pointMergeDistance) &&
        isReadableShard(split[1], secondArea, sourceArea, this.config) &&
        isSimplePolygon(split[1], this.config.pointMergeDistance)
      ) {
        return [
          { vertices: split[0], area: firstArea },
          { vertices: split[1], area: secondArea },
        ];
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

  private sampleInteriorDot(
    polygon: Point[],
    geometry: InteriorSampleGeometry,
  ): Point | null {
    for (let attempt = 0; attempt < this.config.interiorPointAttempts; attempt += 1) {
      const angle = this.config.random() * Math.PI * 2;
      const distance = Math.sqrt(this.config.random()) * geometry.diagonal * 0.28;
      const point = {
        x: geometry.center.x + Math.cos(angle) * distance,
        y: geometry.center.y + Math.sin(angle) * distance,
      };

      if (
        pointInsidePolygon(point, polygon, this.config.pointMergeDistance) &&
        isPointFarEnoughFromPolygonBoundary(point, polygon, geometry.minEdgeDistanceSquared)
      ) {
        return point;
      }
    }

    for (let attempt = 0; attempt < this.config.interiorPointAttempts; attempt += 1) {
      const point = {
        x: geometry.bounds.minX + (this.config.random() * (geometry.bounds.maxX - geometry.bounds.minX)),
        y: geometry.bounds.minY + (this.config.random() * (geometry.bounds.maxY - geometry.bounds.minY)),
      };

      if (
        pointInsidePolygon(point, polygon, this.config.pointMergeDistance) &&
        isPointFarEnoughFromPolygonBoundary(point, polygon, geometry.minEdgeDistanceSquared)
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

function createInteriorSampleGeometry(
  polygon: Point[],
  config: PolygonShardSplitterConfig,
): InteriorSampleGeometry {
  let minX = polygon[0].x;
  let maxX = polygon[0].x;
  let minY = polygon[0].y;
  let maxY = polygon[0].y;
  let signedAreaTotal = 0;
  let xTotal = 0;
  let yTotal = 0;

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    minX = Math.min(minX, current.x);
    maxX = Math.max(maxX, current.x);
    minY = Math.min(minY, current.y);
    maxY = Math.max(maxY, current.y);

    const signedArea = (current.x * next.y) - (next.x * current.y);
    signedAreaTotal += signedArea;
    xTotal += (current.x + next.x) * signedArea;
    yTotal += (current.y + next.y) * signedArea;
  }

  const bounds = { minX, maxX, minY, maxY };
  const diagonal = Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  const minEdgeDistance = diagonal * config.minInteriorDotEdgeDistanceRatio;
  return {
    bounds,
    center: Math.abs(signedAreaTotal) < 0.000001
      ? polygon[0]
      : {
        x: xTotal / (signedAreaTotal * 3),
        y: yTotal / (signedAreaTotal * 3),
      },
    diagonal,
    minEdgeDistanceSquared: minEdgeDistance * minEdgeDistance,
  };
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
  const chain = [start.point];
  let index = (start.edgeIndex + 1) % polygon.length;
  const stopIndex = (end.edgeIndex + 1) % polygon.length;
  let guard = 0;

  while (index !== stopIndex && guard <= polygon.length) {
    chain.push(polygon[index]);
    index = (index + 1) % polygon.length;
    guard += 1;
  }

  chain.push(end.point);
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
  area: number,
  sourceArea: number,
  config: PolygonShardSplitterConfig,
): boolean {
  return (
    shard.length >= 3 &&
    shard.length <= config.maxShardVertices &&
    area >= sourceArea * config.minShardAreaRatio
  );
}

function maxShardAreaRatio(shards: WorkingShard[], sourceArea: number): number {
  let maxArea = 0;
  for (const shard of shards) {
    maxArea = Math.max(maxArea, shard.area);
  }
  return maxArea / sourceArea;
}

function shardSetScore(
  shards: WorkingShard[],
  sourceArea: number,
  config: PolygonShardSplitterConfig,
): number {
  let preferredVertexCount = 0;
  for (const shard of shards) {
    if (shard.vertices.length <= config.preferredMaxShardVertices) {
      preferredVertexCount += 1;
    }
  }
  const largestShardPenalty = maxShardAreaRatio(shards, sourceArea) * 80;
  return (shards.length * 100) + preferredVertexCount - largestShardPenalty;
}

function simplifyPolygon(
  points: Point[],
  config: PolygonShardSplitterConfig,
): Point[] {
  const pointMergeDistanceSquared = config.pointMergeDistance * config.pointMergeDistance;
  let simplified = removeDuplicatePoints(points, pointMergeDistanceSquared);
  const collinearDistanceSquared = config.collinearDistance * config.collinearDistance;
  let changed = true;

  while (changed && simplified.length >= 3) {
    changed = false;
    for (let index = 0; index < simplified.length; index += 1) {
      const previous = simplified[(index - 1 + simplified.length) % simplified.length];
      const current = simplified[index];
      const next = simplified[(index + 1) % simplified.length];
      if (
        distanceSquaredToSegment(current, previous, next) <= collinearDistanceSquared ||
        pointsEqual(previous, next, pointMergeDistanceSquared)
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

function removeDuplicatePoints(points: Point[], epsilonSquared: number): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    if (
      result.length === 0 ||
      !pointsEqual(result[result.length - 1], point, epsilonSquared)
    ) {
      result.push(point);
    }
  }

  if (
    result.length > 1 &&
    pointsEqual(result[0], result[result.length - 1], epsilonSquared)
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

function isPointFarEnoughFromPolygonBoundary(
  point: Point,
  polygon: readonly Point[],
  minDistanceSquared: number,
): boolean {
  for (let index = 0; index < polygon.length; index += 1) {
    if (
      distanceSquaredToSegment(point, polygon[index], polygon[(index + 1) % polygon.length])
        < minDistanceSquared
    ) {
      return false;
    }
  }
  return true;
}

function distanceSquaredToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = (dx * dx) + (dy * dy);
  if (lengthSquared === 0) {
    const pointDx = point.x - start.x;
    const pointDy = point.y - start.y;
    return (pointDx * pointDx) + (pointDy * pointDy);
  }

  const ratio = clamp(
    (((point.x - start.x) * dx) + ((point.y - start.y) * dy)) / lengthSquared,
    0,
    1,
  );
  const pointDx = point.x - (start.x + (dx * ratio));
  const pointDy = point.y - (start.y + (dy * ratio));
  return (pointDx * pointDx) + (pointDy * pointDy);
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

function pointsEqual(left: Point, right: Point, epsilonSquared: number): boolean {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return (dx * dx) + (dy * dy) <= epsilonSquared;
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
