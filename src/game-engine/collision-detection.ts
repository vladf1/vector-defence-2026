export interface CircleSweep {
  readonly previousX: number;
  readonly previousY: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export interface ActiveCircleSweep extends CircleSweep {
  readonly removed: boolean;
  readonly hitPoints: number;
}

export interface CircleSweepCollision<T extends CircleSweep> {
  readonly target: T;
  readonly time: number;
  readonly x: number;
  readonly y: number;
}

export function findEarliestActiveCircleSweepCollision<T extends ActiveCircleSweep>(
  source: CircleSweep,
  targets: readonly T[],
): CircleSweepCollision<T> | undefined {
  let hitTarget: T | undefined;
  let hitTime = Number.POSITIVE_INFINITY;

  for (const target of targets) {
    if (target.removed || target.hitPoints <= 0) {
      continue;
    }

    const collisionTime = getSweptCircleCollisionTime(source, target);
    if (collisionTime !== undefined && collisionTime < hitTime) {
      hitTarget = target;
      hitTime = collisionTime;
    }
  }

  if (!hitTarget) {
    return undefined;
  }

  return {
    target: hitTarget,
    time: hitTime,
    x: source.previousX + ((source.x - source.previousX) * hitTime),
    y: source.previousY + ((source.y - source.previousY) * hitTime),
  };
}

/** Returns the first contact time from 0 to 1, or undefined when the sweeps do not collide. */
export function getSweptCircleCollisionTime(source: CircleSweep, target: CircleSweep): number | undefined {
  // Make the target stationary by subtracting its frame movement from the source movement.
  const startX = source.previousX - target.previousX;
  const startY = source.previousY - target.previousY;
  const endX = source.x - target.x;
  const endY = source.y - target.y;
  const combinedRadius = source.radius + target.radius;
  if (!relativeSweepBoundsOverlap(startX, startY, endX, endY, combinedRadius)) {
    return undefined;
  }

  const movementX = endX - startX;
  const movementY = endY - startY;
  const c = (startX * startX) + (startY * startY) - (combinedRadius * combinedRadius);

  if (c <= 0) {
    return 0;
  }

  const a = (movementX * movementX) + (movementY * movementY);
  if (a === 0) {
    return undefined;
  }

  const b = (startX * movementX) + (startY * movementY);
  const discriminant = (b * b) - (a * c);
  if (discriminant < 0) {
    return undefined;
  }

  const time = (-b - Math.sqrt(discriminant)) / a;
  return time >= 0 && time <= 1 ? time : undefined;
}

function relativeSweepBoundsOverlap(startX: number, startY: number, endX: number, endY: number, radius: number): boolean {
  return !(
    (startX < -radius && endX < -radius)
    || (startX > radius && endX > radius)
    || (startY < -radius && endY < -radius)
    || (startY > radius && endY > radius)
  );
}
