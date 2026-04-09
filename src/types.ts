export type MonsterCode = "ball" | "square" | "triangle" | "tank" | "runner";
export type GameState = "menu" | "playing" | "paused" | "won" | "lost";

export enum TowerKind {
  Gun = "gun",
  Laser = "laser",
  Missile = "missile",
  Slow = "slow",
}

export interface Point {
  x: number;
  y: number;
}

export interface LevelData {
  name: string;
  monsterCount: number;
  allowEscape: number;
  monsterSequence: MonsterCode[];
  points: Point[];
}

export interface MonsterPreset {
  color: string;
  speed: number;
  hp: number;
  bounty: number;
  radius: number;
}

export interface TowerSpec {
  label: string;
  cost: number;
  range: number;
  summary: string;
}

export interface LevelJsonData {
  name: string;
  monsterCount: number;
  allowEscape: number;
  monsterSequence: string[];
  points: Point[];
}

export interface HudSnapshot {
  levelName: string;
  money: string;
  escapes: string;
  wave: string;
  banner: string;
  pauseLabel: string;
  pauseDisabled: boolean;
  selectionTitle: string;
  selectionBody: string;
  upgradeDisabled: boolean;
  sellDisabled: boolean;
  cancelDisabled: boolean;
  selectedTowerKind?: TowerKind;
  selectedTowerLevel?: number;
  placingTower?: TowerKind;
  towerButtonsDisabled: boolean;
}
