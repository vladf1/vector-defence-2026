import type { FieldBounds, Point } from "./types";

/**
 * Presentation boundary between `Game` and a concrete board renderer.
 * Renderers read `Game.runtime` each frame; they never mutate simulation state.
 */
export interface BoardRenderer {
  resize(): void;
  /** Called when static board content (route, escape allowance) changes. */
  renderBackgroundLayer(): void;
  draw(): void;
  getVisibleFieldBounds(): FieldBounds;
  isPointInUpgradeButton(point: Point): boolean;
  isPointInLaserLockButton(point: Point): boolean;
  /** Maps a client-space pointer position over the input surface to field coordinates. */
  clientToField(clientX: number, clientY: number, surfaceRect: DOMRect): Point | null;
  dispose(): void;
}

/** Stand-in used while no board surface is mounted, or while an async renderer is loading. */
export class DetachedBoardRenderer implements BoardRenderer {
  constructor(private readonly bounds: FieldBounds) {}

  resize(): void {
  }

  renderBackgroundLayer(): void {
  }

  draw(): void {
  }

  getVisibleFieldBounds(): FieldBounds {
    return this.bounds;
  }

  isPointInUpgradeButton(): boolean {
    return false;
  }

  isPointInLaserLockButton(): boolean {
    return false;
  }

  clientToField(): Point | null {
    return null;
  }

  dispose(): void {
  }
}
