import type { Point } from "../types";
import { randomRange } from "../utils";

export interface CircleArc {
  startAngle: number;
  sweepAngle: number;
}

export function buildShards(outline: Point[], pivot: Point, shardCount: number): Point[][] {
  const perimeterPoints = samplePolygonPerimeter(outline, shardCount);
  const shards: Point[][] = [];
  for (let index = 0; index < shardCount; index += 1) {
    shards.push([pivot, perimeterPoints[index], perimeterPoints[index + 1]]);
  }
  return shards;
}

export function randomPointInsideTriangle(a: Point, b: Point, c: Point): Point {
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

export function rotatePoint(point: Point, angle: number): Point {
  return {
    x: (point.x * Math.cos(angle)) - (point.y * Math.sin(angle)),
    y: (point.x * Math.sin(angle)) + (point.y * Math.cos(angle)),
  };
}

export function pointOnRadius(angle: number, radius: number): Point {
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

export function createCoreShardVertices(center: Point, radius: number): Point[] {
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

export function sampleCircleArcs(arcCount: number): CircleArc[] {
  const weights = Array.from({ length: arcCount }, () => randomRange(0.65, 1.45));
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const startAngleOffset = randomRange(-Math.PI, Math.PI);
  const arcs: CircleArc[] = [];
  let startAngle = startAngleOffset;
  for (const weight of weights) {
    const sweepAngle = (weight / weightTotal) * Math.PI * 2;
    arcs.push({ startAngle, sweepAngle });
    startAngle += sweepAngle;
  }
  return arcs;
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
