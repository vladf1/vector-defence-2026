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

export const AudioCue = {
  EscapeBurst: { id: "escape-burst", cooldownSeconds: 0.16, gain: 0.52, rateVariation: 0 },
  GunFire: { id: "gun-fire", cooldownSeconds: 0.026, gain: 0.58, rateVariation: 0.035 },
  LaserFire: { id: "laser-fire", cooldownSeconds: 0.18, gain: 0.45, rateVariation: 0 },
  LevelLoss: { id: "level-loss", cooldownSeconds: 0.8, gain: 0.46, rateVariation: 0 },
  LevelStart: { id: "level-start", cooldownSeconds: 0.25, gain: 0.36, rateVariation: 0 },
  LevelWin: { id: "level-win", cooldownSeconds: 0.8, gain: 0.42, rateVariation: 0 },
  MissileExplosion: { id: "missile-explosion", cooldownSeconds: 0.08, gain: 0.82, rateVariation: 0 },
  MissileLaunch: { id: "missile-launch", cooldownSeconds: 0.08, gain: 0.54, rateVariation: 0.025 },
  MonsterHeavyDeath: { id: "monster-heavy-death", cooldownSeconds: 0.08, gain: 0.7, rateVariation: 0 },
  MonsterPop: { id: "monster-pop", cooldownSeconds: 0.035, gain: 0.44, rateVariation: 0.06 },
  MonsterShatter: { id: "monster-shatter", cooldownSeconds: 0.045, gain: 0.42, rateVariation: 0.04 },
  ProjectileImpact: { id: "projectile-impact", cooldownSeconds: 0.018, gain: 0.34, rateVariation: 0.06 },
  SlowPulse: { id: "slow-pulse", cooldownSeconds: 0.11, gain: 0.34, rateVariation: 0 },
  SplitterBurst: { id: "splitter-burst", cooldownSeconds: 0.1, gain: 0.5, rateVariation: 0 },
  TowerPlace: { id: "tower-place", cooldownSeconds: 0.05, gain: 0.44, rateVariation: 0 },
  TowerSell: { id: "tower-sell", cooldownSeconds: 0.08, gain: 0.34, rateVariation: 0 },
  TowerUpgrade: { id: "tower-upgrade", cooldownSeconds: 0.08, gain: 0.38, rateVariation: 0 },
  WaveClear: { id: "wave-clear", cooldownSeconds: 0.5, gain: 0.34, rateVariation: 0 },
} as const;

export type AudioCue = typeof AudioCue[keyof typeof AudioCue];
export type AudioCueId = AudioCue["id"];

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
