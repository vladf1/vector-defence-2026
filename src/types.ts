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
  PackMan: "packman",
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
  Lightning: "lightning",
} as const;

export type TowerKind = typeof TowerKind[keyof typeof TowerKind];

export const AudioCue = {
  CampaignComplete: { id: "campaign-complete", cooldownSeconds: 0.8, gain: 0.48, rateVariation: 0 },
  EscapeBurst: { id: "escape-burst", cooldownSeconds: 0.16, gain: 0.52, rateVariation: 0 },
  GunFire: { id: "gun-fire", cooldownSeconds: 0.026, gain: 0.58, rateVariation: 0.035 },
  InvalidAction: { id: "invalid-action", cooldownSeconds: 0.12, gain: 0.32, rateVariation: 0 },
  LaserFire: { id: "laser-fire", cooldownSeconds: 0.18, gain: 0.45, rateVariation: 0 },
  LaserLockOff: { id: "laser-lock-off", cooldownSeconds: 0.08, gain: 0.34, rateVariation: 0 },
  LaserLockOn: { id: "laser-lock-on", cooldownSeconds: 0.08, gain: 0.34, rateVariation: 0 },
  LightningShock: { id: "lightning-shock", cooldownSeconds: 0.09, gain: 0.34, rateVariation: 0.035 },
  LevelLoss: { id: "level-loss", cooldownSeconds: 0.8, gain: 0.46, rateVariation: 0 },
  LevelStart: { id: "level-start", cooldownSeconds: 0.25, gain: 0.36, rateVariation: 0 },
  LevelWin: { id: "level-win", cooldownSeconds: 0.8, gain: 0.42, rateVariation: 0 },
  MenuOpen: { id: "menu-open", cooldownSeconds: 0.12, gain: 0.32, rateVariation: 0 },
  MissileExplosion: { id: "missile-explosion", cooldownSeconds: 0.08, gain: 0.4, rateVariation: 0 },
  MissileLaunch: { id: "missile-launch", cooldownSeconds: 0.08, gain: 0.54, rateVariation: 0.025 },
  MonsterHeavyDeath: { id: "monster-heavy-death", cooldownSeconds: 0.08, gain: 0.7, rateVariation: 0 },
  MonsterPop: { id: "monster-pop", cooldownSeconds: 0.035, gain: 0.44, rateVariation: 0.06 },
  MonsterShatter: { id: "monster-shatter", cooldownSeconds: 0.045, gain: 0.42, rateVariation: 0.04 },
  Pause: { id: "pause", cooldownSeconds: 0.08, gain: 0.32, rateVariation: 0 },
  ProjectileImpact: { id: "projectile-impact", cooldownSeconds: 0.018, gain: 0.34, rateVariation: 0.06 },
  Resume: { id: "resume", cooldownSeconds: 0.08, gain: 0.32, rateVariation: 0 },
  SlowPulse: { id: "slow-pulse", cooldownSeconds: 0.11, gain: 0.34, rateVariation: 0 },
  SoundToggle: { id: "sound-toggle", cooldownSeconds: 0.08, gain: 0.32, rateVariation: 0 },
  SplitterBurst: { id: "splitter-burst", cooldownSeconds: 0.1, gain: 0.5, rateVariation: 0 },
  TowerPlace: { id: "tower-place", cooldownSeconds: 0.05, gain: 0.44, rateVariation: 0 },
  TowerSelect: { id: "tower-select", cooldownSeconds: 0.06, gain: 0.28, rateVariation: 0 },
  TowerSell: { id: "tower-sell", cooldownSeconds: 0.08, gain: 0.34, rateVariation: 0 },
  TowerUpgrade: { id: "tower-upgrade", cooldownSeconds: 0.08, gain: 0.38, rateVariation: 0 },
  UiClick: { id: "ui-click", cooldownSeconds: 0.04, gain: 0.28, rateVariation: 0 },
  UiConfirm: { id: "ui-confirm", cooldownSeconds: 0.08, gain: 0.34, rateVariation: 0 },
  WaveClear: { id: "wave-clear", cooldownSeconds: 0.5, gain: 0.34, rateVariation: 0 },
  WaveStart: { id: "wave-start", cooldownSeconds: 0.4, gain: 0.34, rateVariation: 0 },
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
  initialBuildTime?: number;
  startingMoney: number;
  waveCount?: number;
  waves?: WaveData[];
}

export interface LevelJsonData {
  name: string;
  subtitle?: string;
  initialBuildTime?: number;
  startingMoney: number;
  waveCount?: number;
  monsterCount: number;
  allowEscape: number;
  monsterSequence: string[];
  points: Point[];
  mobile?: Partial<Omit<LevelJsonData, "mobile">>;
}

export interface HudSnapshot {
  levelName: string;
  money: string;
  wave: string;
  monsters: string;
  banner: string;
  selectionTitle: string;
  selectionBody: string;
  mobileSelectionBody: string;
  upgradeActionLabel: string;
  sellActionLabel: string;
  upgradeDisabled: boolean;
  upgradeUnaffordable: boolean;
  hasSelectedTower: boolean;
  hasLaserLockAction: boolean;
  laserLocked: boolean;
  laserLockDisabled: boolean;
  sellDisabled: boolean;
  cancelBuildDisabled: boolean;
  canTogglePause: boolean;
  showStatusHud: boolean;
  canSkipBreak: boolean;
  paused: boolean;
  dragOnlyTowerPlacement: boolean;
  placingTower?: TowerKind;
  towerButtonsDisabled: boolean;
  affordableTowers: Record<TowerKind, boolean>;
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
  sheet?: boolean;
  levelCards?: ModalLevelCardView[];
}
