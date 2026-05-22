import { TankTurretParticle } from "../effects/tank-turret-particle";
import type { UpdateResult } from "../../game-engine/update-context";
import type { PathEntry } from "../../route-path";
import { AudioCue } from "../../types";
import { randomRange } from "../../utils";
import { createPolygonShardParticles, rotatePoint } from "./death-effect-helpers";
import { Monster } from "./monster";
import { createPolygonShardSplitterConfig, PolygonShardSplitter } from "./polygon-shard-splitter";
import { drawTankTurret } from "./tank-turret-rendering";

const COLOR = "#9fb6ff";
const SPEED_PER_SECOND = 41;
const HIT_POINTS = 462;
const BOUNTY = 6;
const RADIUS = 10.5;
const HULL_RECT = {
  x: -RADIUS,
  y: -RADIUS * 0.72,
  width: RADIUS * 2.1,
  height: RADIUS * 1.44,
};
const HULL_OUTLINE = [
  { x: HULL_RECT.x, y: HULL_RECT.y },
  { x: HULL_RECT.x + HULL_RECT.width, y: HULL_RECT.y },
  { x: HULL_RECT.x + HULL_RECT.width, y: HULL_RECT.y + HULL_RECT.height },
  { x: HULL_RECT.x, y: HULL_RECT.y + HULL_RECT.height },
];
const SHARD_SPLITTER = new PolygonShardSplitter(createPolygonShardSplitterConfig({
  minShardCount: 6,
  maxShardCount: 13,
}));

export class TankMonster extends Monster {
  constructor(path: PathEntry[], speedScale: number) {
    super(path, COLOR, SPEED_PER_SECOND * speedScale, HIT_POINTS, BOUNTY, RADIUS);
  }

  protected drawBody(context: CanvasRenderingContext2D): void {
    context.rotate(this.angle);
    context.fillRect(HULL_RECT.x, HULL_RECT.y, HULL_RECT.width, HULL_RECT.height);
    context.strokeRect(HULL_RECT.x, HULL_RECT.y, HULL_RECT.width, HULL_RECT.height);
    drawTankTurret(context, this.radius, 0.42, 1.52);
  }

  override addDeathEffect(result: UpdateResult): void {
    const hullPivot = {
      x: randomRange(-this.radius * 0.15, this.radius * 0.35),
      y: randomRange(-this.radius * 0.22, this.radius * 0.22),
    };
    const turretCenterOffset = rotatePoint(
      { x: this.radius * 0.38, y: 0 },
      this.angle,
    );
    createPolygonShardParticles(
      result,
      this.x,
      this.y,
      this.color,
      HULL_OUTLINE,
      hullPivot,
      this.angle,
      125,
      220,
      0,
      SHARD_SPLITTER,
    );
    result.addParticle(new TankTurretParticle(
      this.x + turretCenterOffset.x,
      this.y + turretCenterOffset.y,
      this.radius,
      this.color,
      this.angle,
    ));
    result.playSound(AudioCue.MonsterHeavyDeath, this.x, 1.25);
  }

}
