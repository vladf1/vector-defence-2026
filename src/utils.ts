import type { Point } from "./types";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function calculateDistance(source: Point, target: Point): number {
  return Math.hypot(source.x - target.x, source.y - target.y);
}

export function withinDistance(source: Point, target: Point, maxDistance: number): boolean {
  const dx = target.x - source.x;
  if (Math.abs(dx) > maxDistance) {
    return false;
  }

  const dy = target.y - source.y;
  if (Math.abs(dy) > maxDistance) {
    return false;
  }

  return (dx * dx) + (dy * dy) <= (maxDistance * maxDistance);
}

export function isOutsideBounds(point: Point, width: number, height: number, margin: number): boolean {
  return point.x < -margin || point.y < -margin || point.x > width + margin || point.y > height + margin;
}

export function angleBetween(source: Point, target: Point): number {
  return Math.atan2(target.y - source.y, target.x - source.x);
}

export function drawPath(context: CanvasRenderingContext2D, points: readonly Point[], fill: boolean): void {
  if (points.length === 0) {
    return;
  }

  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }
  context.closePath();
  if (fill) {
    context.fill();
  }
  context.stroke();
}

export function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function turnAngleTowards(current: number, target: number, maxStep: number): number {
  const delta = normalizeAngle(target - current);
  const step = clamp(delta, -maxStep, maxStep);
  return normalizeAngle(current + step);
}

export function closestPointOnSegment(point: Point, start: Point, end: Point): Point {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentLengthSquared = (segmentX * segmentX) + (segmentY * segmentY);
  if (segmentLengthSquared === 0) {
    return start;
  }

  const projection = projectPointOntoSegment(point, start, segmentX, segmentY, segmentLengthSquared);
  return {
    x: start.x + (projection * segmentX),
    y: start.y + (projection * segmentY),
  };
}

export function isWithinDistanceToSegment(point: Point, start: Point, end: Point, maxDistance: number): boolean {
  if (
    point.x < Math.min(start.x, end.x) - maxDistance ||
    point.x > Math.max(start.x, end.x) + maxDistance ||
    point.y < Math.min(start.y, end.y) - maxDistance ||
    point.y > Math.max(start.y, end.y) + maxDistance
  ) {
    return false;
  }

  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentLengthSquared = (segmentX * segmentX) + (segmentY * segmentY);
  if (segmentLengthSquared === 0) {
    return withinDistance(point, start, maxDistance);
  }

  const projection = projectPointOntoSegment(point, start, segmentX, segmentY, segmentLengthSquared);
  const closestX = start.x + (projection * segmentX);
  const closestY = start.y + (projection * segmentY);
  const distanceX = closestX - point.x;
  const distanceY = closestY - point.y;
  return (distanceX * distanceX) + (distanceY * distanceY) <= (maxDistance * maxDistance);
}

function projectPointOntoSegment(
  point: Point,
  start: Point,
  segmentX: number,
  segmentY: number,
  segmentLengthSquared: number,
): number {
  const dotProduct = ((point.x - start.x) * segmentX) + ((point.y - start.y) * segmentY);
  return clamp(dotProduct / segmentLengthSquared, 0, 1);
}

export function randomRange(min: number, max: number): number {
  return min + (Math.random() * (max - min));
}

export function hexWithAlpha(hex: string, alpha: number): string {
  const value = clamp(Math.round(alpha * 255), 0, 255).toString(16).padStart(2, "0");
  return `${hex}${value}`;
}

export function formatMoney(value: number): string {
  return `$${Math.round(value)}`;
}

export function compactInPlace<T extends { removed: boolean }>(items: T[]): void {
  const itemCount = items.length;
  let writeIndex = 0;

  while (writeIndex < itemCount && !items[writeIndex].removed) {
    writeIndex += 1;
  }

  if (writeIndex === itemCount) {
    return;
  }

  for (let readIndex = writeIndex + 1; readIndex < itemCount; readIndex += 1) {
    const item = items[readIndex];
    if (!item.removed) {
      items[writeIndex] = item;
      writeIndex += 1;
    }
  }
  items.length = writeIndex;
}
