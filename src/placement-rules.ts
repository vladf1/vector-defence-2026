import type { Tower } from "./entities/towers/tower";
import type { RouteMotionPath } from "./route-path";
import type { Point } from "./types";
import { isWithinDistanceToSegment, withinDistance } from "./utils";

export interface PlacementGeometry {
  fieldWidth: number;
  fieldHeight: number;
  towerRadius: number;
  towerSelectionPadding: number;
  minDistanceToOtherTowers: number;
  minDistanceToRoad: number;
}

export function canPlaceTower(
  point: Point,
  routePath: RouteMotionPath | undefined,
  towers: readonly Tower[],
  geometry: PlacementGeometry,
): boolean {
  if (!routePath) {
    return false;
  }

  const outsideBounds =
    point.x < geometry.towerRadius ||
    point.y < geometry.towerRadius ||
    point.x > geometry.fieldWidth - geometry.towerRadius ||
    point.y > geometry.fieldHeight - geometry.towerRadius;

  if (outsideBounds) {
    return false;
  }

  for (const tower of towers) {
    if (withinDistance(point.x, point.y, tower.x, tower.y, geometry.minDistanceToOtherTowers)) {
      return false;
    }
  }

  for (let index = 0; index < routePath.entries.length - 1; index += 1) {
    const start = routePath.entries[index];
    const end = routePath.entries[index + 1];
    if (isWithinDistanceToSegment(point.x, point.y, start.x, start.y, end.x, end.y, geometry.minDistanceToRoad)) {
      return false;
    }
  }

  return true;
}

export function findTowerAtPoint(
  point: Point,
  towers: readonly Tower[],
  towerRadius: number,
  towerSelectionPadding: number,
): Tower | undefined {
  for (let index = towers.length - 1; index >= 0; index -= 1) {
    const tower = towers[index];
    if (withinDistance(point.x, point.y, tower.x, tower.y, towerRadius + towerSelectionPadding)) {
      return tower;
    }
  }

  return undefined;
}
