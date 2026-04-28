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
  Bulwark: "bulwark",
} as const;

export type MonsterKind = typeof MonsterKind[keyof typeof MonsterKind];

export const TowerKind = {
  Gun: "gun",
  Laser: "laser",
  Missile: "missile",
  Slow: "slow",
} as const;

export type TowerKind = typeof TowerKind[keyof typeof TowerKind];

export const ModalAction = {
  Resume: "resume",
  PlayUnlocked: "play-unlocked",
  RestartCampaign: "restart-campaign",
  NextLevel: "next-level",
  Replay: "replay",
  CampaignMap: "campaign-map",
} as const;

export type ModalAction = typeof ModalAction[keyof typeof ModalAction];

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
  isChallenge?: boolean;
  subtitle?: string;
  startingMoney?: number;
  waves?: WaveData[];
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
  wave: string;
  banner: string;
  selectionTitle: string;
  selectionBody: string;
  upgradeDisabled: boolean;
  hasSelectedTower: boolean;
  sellDisabled: boolean;
  placingTower?: TowerKind;
  towerButtonsDisabled: boolean;
  nerdStats: NerdStatsSnapshot;
}

export interface NerdStatsSnapshot {
  fps: string;
  frameTime: string;
  updateTime: string;
  drawTime: string;
  trackedObjects: string;
  towers: string;
  hostiles: string;
  shots: string;
  effects: string;
  pixelRatio: string;
}

export interface ModalActionView {
  action: ModalAction;
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
  centered?: boolean;
  levelCards?: ModalLevelCardView[];
}
