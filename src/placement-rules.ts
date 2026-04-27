import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  MIN_DISTANCE_TO_OTHER_TOWERS,
  MIN_DISTANCE_TO_ROAD,
  TOWER_RADIUS,
} from "./constants";
import type { Tower } from "./entities/towers/tower";
import type { RouteMotionPath } from "./route-path";
import type { Point } from "./types";
import { isWithinDistanceToSegment, withinDistance } from "./utils";

export function canPlaceTower(point: Point, routePath: RouteMotionPath | undefined, towers: readonly Tower[]): boolean {
  if (!routePath) {
    return false;
  }

  const outsideBounds =
    point.x < TOWER_RADIUS ||
    point.y < TOWER_RADIUS ||
    point.x > FIELD_WIDTH - TOWER_RADIUS ||
    point.y > FIELD_HEIGHT - TOWER_RADIUS;

  if (outsideBounds) {
    return false;
  }

  for (const tower of towers) {
    if (withinDistance(point.x, point.y, tower.x, tower.y, MIN_DISTANCE_TO_OTHER_TOWERS)) {
      return false;
    }
  }

  for (let index = 0; index < routePath.entries.length - 1; index += 1) {
    const start = routePath.entries[index];
    const end = routePath.entries[index + 1];
    if (isWithinDistanceToSegment(point.x, point.y, start.x, start.y, end.x, end.y, MIN_DISTANCE_TO_ROAD)) {
      return false;
    }
  }

  return true;
}

export function findTowerAtPoint(point: Point, towers: readonly Tower[]): Tower | undefined {
  for (let index = towers.length - 1; index >= 0; index -= 1) {
    const tower = towers[index];
    if (withinDistance(point.x, point.y, tower.x, tower.y, TOWER_RADIUS + 6)) {
      return tower;
    }
  }

  return undefined;
}
