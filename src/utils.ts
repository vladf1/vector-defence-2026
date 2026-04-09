import type { MonsterCode, LevelData, LevelJsonData, Point } from "./types";

export function must<T>(value: T | null, message: string): T {
  if (value === null) {
    throw new Error(message);
  }
  return value;
}

export function isMonsterCode(value: string): value is MonsterCode {
  return value === "ball" || value === "square" || value === "triangle";
}

export function normalizeLevels(data: LevelJsonData[]): LevelData[] {
  return data.map((level) => ({
    ...level,
    monsterSequence: level.monsterSequence.filter(isMonsterCode),
  }));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function distanceSquaredXY(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return (dx * dx) + (dy * dy);
}

export function distanceXY(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(distanceSquaredXY(x1, y1, x2, y2));
}

export function angleBetween(source: Point, target: Point): number {
  return Math.atan2(target.y - source.y, target.x - source.x);
}

export function pointToSegmentDistanceSquaredXY(pointX: number, pointY: number, startX: number, startY: number, endX: number, endY: number): number {
  const px = endX - startX;
  const py = endY - startY;
  const denom = (px * px) + (py * py);
  if (denom === 0) {
    return distanceSquaredXY(pointX, pointY, startX, startY);
  }
  let t = (((pointX - startX) * px) + ((pointY - startY) * py)) / denom;
  t = clamp(t, 0, 1);
  const x = startX + (t * px);
  const y = startY + (t * py);
  return ((pointX - x) ** 2) + ((pointY - y) ** 2);
}

export function randomRange(min: number, max: number): number {
  return min + (Math.random() * (max - min));
}

export function hexWithAlpha(hex: string, alpha: number): string {
  const value = clamp(Math.round(alpha * 255), 0, 255).toString(16).padStart(2, "0");
  return `${hex}${value}`;
}

export function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

export function compactInPlace<T extends { removed: boolean }>(items: T[]): void {
  let writeIndex = 0;
  for (let readIndex = 0; readIndex < items.length; readIndex += 1) {
    const item = items[readIndex];
    if (!item.removed) {
      items[writeIndex] = item;
      writeIndex += 1;
    }
  }
  items.length = writeIndex;
}
