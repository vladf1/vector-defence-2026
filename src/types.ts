export const GameState = {
  Menu: "menu",
  Playing: "playing",
  Paused: "paused",
  Won: "won",
  Lost: "lost",
  CampaignWon: "campaign-won",
} as const;

export type GameState = typeof GameState[keyof typeof GameState];

export const MonsterKind = {
  Ball: "ball",
  Square: "square",
  Triangle: "triangle",
  Tank: "tank",
  Runner: "runner",
  Splitter: "splitter",
  Berserker: "berserker",
} as const;

export type MonsterKind = typeof MonsterKind[keyof typeof MonsterKind];

export const TowerKind = {
  Gun: "gun",
  Laser: "laser",
  Missile: "missile",
  Slow: "slow",
} as const;

export type TowerKind = typeof TowerKind[keyof typeof TowerKind];

export interface Point {
  x: number;
  y: number;
}

export interface WaveData {
  count: number;
  monsterSequence: MonsterKind[];
  spawnIntervalMin: number;
  spawnIntervalMax: number;
  buildTime: number;
  reward: number;
  label: string;
}

export interface LevelData {
  name: string;
  monsterCount: number;
  allowEscape: number;
  monsterSequence: MonsterKind[];
  points: Point[];
  id?: string;
  levelNumber?: number;
  subtitle?: string;
  startingMoney?: number;
  waves?: WaveData[];
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
  placingTower?: TowerKind;
  towerButtonsDisabled: boolean;
}

export interface ModalActionView {
  action: string;
  label: string;
}

export interface ModalLevelCardView {
  index: number;
  unlocked: boolean;
  cleared: boolean;
  current: boolean;
  status: string;
  level: LevelData;
}

export interface ModalView {
  title: string;
  description: string;
  actions: ModalActionView[];
  actionClassName?: string;
  levelCards?: ModalLevelCardView[];
}
