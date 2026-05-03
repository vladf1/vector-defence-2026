import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  MAX_TOWER_LEVEL,
  ROAD_TURN_RADIUS,
  ROAD_WIDTH,
  ROUTE_CURVE_SAMPLE_STEP,
  TOWER_RADIUS,
  TOWER_ROAD_EDGE_OVERLAP_ALLOWANCE,
  TOWER_UPGRADE_RING_GROWTH,
  TOWER_UPGRADE_RING_OFFSET,
} from "./constants";
import type { ProceduralRouteConfig } from "./level-generator";
import type { PlacementGeometry } from "./placement-rules";

export const GameMode = {
  Desktop: "desktop",
  Mobile: "mobile",
} as const;

export type GameMode = typeof GameMode[keyof typeof GameMode];

export interface GameProfile {
  mode: GameMode;
  fieldWidth: number;
  fieldHeight: number;
  fieldAspectRatio: string;
  fieldAspectScale: number;
  towerRadius: number;
  towerSelectionPadding: number;
  towerRangeScale: number;
  roadTurnRadius: number;
  roadWidth: number;
  routeCurveSampleStep: number;
  placement: PlacementGeometry;
  proceduralRoute: ProceduralRouteConfig;
  ui: {
    dragOnlyTowerPlacement: boolean;
    drawCanvasTowerActions: boolean;
    drawCanvasPauseButton: boolean;
    showChromeRestart: boolean;
    showShortcutLabels: boolean;
    showTitle: boolean;
    showFootnote: boolean;
    portraitOnly: boolean;
  };
}

function createProfile(options: {
  mode: GameMode;
  fieldWidth: number;
  fieldHeight: number;
  towerRadius: number;
  towerSelectionPadding: number;
  towerRangeScale: number;
  minDistanceToOtherTowers: number;
  roadTurnRadius: number;
  roadWidth: number;
  routeCurveSampleStep: number;
  randomRouteBaseWidth: number;
  randomRouteMargin: number;
  ui: GameProfile["ui"];
}): GameProfile {
  const maxTowerBodyRadius = options.towerRadius
    + TOWER_UPGRADE_RING_OFFSET
    + (MAX_TOWER_LEVEL * TOWER_UPGRADE_RING_GROWTH);

  const placement = {
    fieldWidth: options.fieldWidth,
    fieldHeight: options.fieldHeight,
    towerRadius: options.towerRadius,
    towerSelectionPadding: options.towerSelectionPadding,
    minDistanceToOtherTowers: options.minDistanceToOtherTowers,
    minDistanceToRoad: (options.roadWidth / 2) + maxTowerBodyRadius - TOWER_ROAD_EDGE_OVERLAP_ALLOWANCE,
  };

  return {
    mode: options.mode,
    fieldWidth: options.fieldWidth,
    fieldHeight: options.fieldHeight,
    fieldAspectRatio: `${options.fieldWidth} / ${options.fieldHeight}`,
    fieldAspectScale: options.fieldWidth / options.fieldHeight,
    towerRadius: options.towerRadius,
    towerSelectionPadding: options.towerSelectionPadding,
    towerRangeScale: options.towerRangeScale,
    roadTurnRadius: options.roadTurnRadius,
    roadWidth: options.roadWidth,
    routeCurveSampleStep: options.routeCurveSampleStep,
    placement,
    proceduralRoute: {
      fieldWidth: options.fieldWidth,
      fieldHeight: options.fieldHeight,
      randomRouteBaseWidth: options.randomRouteBaseWidth,
      randomRouteMargin: options.randomRouteMargin,
    },
    ui: options.ui,
  };
}

export const DESKTOP_GAME_PROFILE = createProfile({
  mode: GameMode.Desktop,
  fieldWidth: FIELD_WIDTH,
  fieldHeight: FIELD_HEIGHT,
  towerRadius: TOWER_RADIUS,
  towerRangeScale: 1,
  minDistanceToOtherTowers: 32,
  towerSelectionPadding: 6,
  roadTurnRadius: ROAD_TURN_RADIUS,
  roadWidth: ROAD_WIDTH,
  routeCurveSampleStep: ROUTE_CURVE_SAMPLE_STEP,
  randomRouteBaseWidth: 700,
  randomRouteMargin: 36,
  ui: {
    dragOnlyTowerPlacement: false,
    drawCanvasTowerActions: true,
    drawCanvasPauseButton: true,
    showChromeRestart: true,
    showShortcutLabels: true,
    showTitle: true,
    showFootnote: true,
    portraitOnly: false,
  },
});

export const MOBILE_GAME_PROFILE = createProfile({
  mode: GameMode.Mobile,
  fieldWidth: 390,
  fieldHeight: 560,
  towerRadius: TOWER_RADIUS,
  towerRangeScale: 0.82,
  minDistanceToOtherTowers: 27,
  towerSelectionPadding: 12,
  roadTurnRadius: 34,
  roadWidth: 28,
  routeCurveSampleStep: 4,
  randomRouteBaseWidth: 390,
  randomRouteMargin: 24,
  ui: {
    dragOnlyTowerPlacement: true,
    drawCanvasTowerActions: false,
    drawCanvasPauseButton: false,
    showChromeRestart: false,
    showShortcutLabels: false,
    showTitle: false,
    showFootnote: false,
    portraitOnly: true,
  },
});

export function selectStartupGameProfile(viewport: Window): GameProfile {
  const coarsePointer = viewport.matchMedia("(hover: none) and (pointer: coarse)").matches;
  const shortestSide = Math.min(viewport.innerWidth, viewport.innerHeight);
  const longestSide = Math.max(viewport.innerWidth, viewport.innerHeight);
  const iPhoneSized = shortestSide <= 480 && longestSide <= 940;
  const touchCapable = viewport.navigator.maxTouchPoints > 0;

  return coarsePointer && touchCapable && iPhoneSized
    ? MOBILE_GAME_PROFILE
    : DESKTOP_GAME_PROFILE;
}
