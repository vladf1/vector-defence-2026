import { GlassShardParticle } from "../effects/glass-shard-particle";
import type { Particle } from "../effects/particle";
import type { Point } from "../../types";
import { randomRange } from "../../utils";
import { PolygonShardSplitter, type PolygonShardSplitterConfig } from "./polygon-shard-splitter";

export function rotatePoint(point: Point, angle: number): Point {
  return {
    x: point.x * Math.cos(angle) - point.y * Math.sin(angle),
    y: point.x * Math.sin(angle) + point.y * Math.cos(angle),
  };
}

export function pointOnRadius(angle: number, radius: number): Point {
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

export function createPolygonShardParticles(
  x: number,
  y: number,
  color: string,
  outline: Point[],
  origin: Point,
  rotation: number,
  speedMinPerSecond: number,
  speedMaxPerSecond: number,
  initialSeparation: number,
  splitterConfig: PolygonShardSplitterConfig,
): Particle[] {
  const splitter = new PolygonShardSplitter(splitterConfig);
  return splitter.splitIntoShards(outline).map(
    (shard) =>
      new GlassShardParticle(
        x,
        y,
        color,
        shard.vertices,
        origin,
        rotation,
        randomRange(speedMinPerSecond, speedMaxPerSecond),
        initialSeparation,
      ),
  );
}
