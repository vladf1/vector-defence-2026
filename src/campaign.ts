import { STARTING_MONEY } from "./constants";
import { createProceduralLevel } from "./level-generator";
import { MonsterKind, type LevelData, type WaveData } from "./types";
import { clamp } from "./utils";

const CAMPAIGN_NOTES = [
  "Warm up on a forgiving route and learn the shape of the field.",
  "Faster side-lanes start to punish weak coverage.",
  "The path opens up and asks for better crossfire.",
  "Split pressure starts appearing from wave to wave.",
  "Long corners reward towers that can hold a lane.",
  "Bruisers begin arriving in real numbers.",
  "Diagonal cuts and crossings make tower placement matter.",
  "Dense mixed waves force you to balance single-target and splash.",
  "The final route is a siege through crossing roads.",
] as const;

const LEVEL_BUILD_TIMES = [10, 10, 11, 11, 12, 12, 13, 13, 14] as const;
const LEVEL_ESCAPES = [15, 15, 14, 13, 12, 12, 11, 10, 8] as const;
const LEVEL_STARTING_MONEY = [320, 335, 350, 365, 380, 395, 415, 435, 465] as const;
const LEVEL_WAVE_TOTALS = [4, 4, 5, 5, 5, 6, 6, 6, 7] as const;
const LEVEL_ONE_SHOWCASE_SEQUENCE = [
  MonsterKind.Ball,
  MonsterKind.Runner,
  MonsterKind.Square,
  MonsterKind.Triangle,
  MonsterKind.Splitter,
  MonsterKind.Berserker,
  MonsterKind.Bulwark,
  MonsterKind.Tank,
] as const;

function uniqueSequence(sequence: MonsterKind[]): MonsterKind[] {
  const seen = new Set<MonsterKind>();
  const result: MonsterKind[] = [];
  for (const code of sequence) {
    if (!seen.has(code)) {
      seen.add(code);
      result.push(code);
    }
  }
  return result;
}

function buildWaveSequence(baseSequence: MonsterKind[], levelIndex: number, waveIndex: number): MonsterKind[] {
  if (levelIndex === 0) {
    return buildLevelOneShowcaseSequence(waveIndex);
  }

  const pressure = (levelIndex * 0.85) + (waveIndex * 0.9);
  const introduceSplitterEarly = levelIndex === 0 && waveIndex >= 2;
  const pool: MonsterKind[] = [...baseSequence];

  if (pressure >= 1.2) {
    pool.push(MonsterKind.Square, MonsterKind.Runner);
  }
  if (pressure >= 2.2) {
    pool.push(MonsterKind.Triangle, MonsterKind.Triangle);
  }
  if (pressure >= 3.3) {
    pool.push(MonsterKind.Tank);
  }
  if (pressure >= 3.7) {
    pool.push(MonsterKind.Bulwark);
  }
  if (pressure >= 4.1) {
    pool.push(MonsterKind.Berserker);
  }
  if (pressure >= 4.6) {
    pool.push(MonsterKind.Runner, MonsterKind.Square, MonsterKind.Tank, MonsterKind.Splitter, MonsterKind.Berserker, MonsterKind.Bulwark);
  }
  if (pressure >= 6.1) {
    pool.push(MonsterKind.Triangle, MonsterKind.Runner, MonsterKind.Tank, MonsterKind.Splitter, MonsterKind.Berserker, MonsterKind.Bulwark);
  }
  if (introduceSplitterEarly) {
    pool.push(MonsterKind.Splitter);
  }

  const source = uniqueSequence(pool);
  const length = clamp(5 + waveIndex + Math.floor(levelIndex / 2), 5, 12);
  const sequence: MonsterKind[] = [];

  for (let index = 0; index < length; index += 1) {
    sequence.push(source[(index + waveIndex + (levelIndex * 2)) % source.length] ?? MonsterKind.Ball);
  }

  if (pressure < 2.4) {
    sequence.unshift(MonsterKind.Ball);
  } else if (pressure < 4.4) {
    sequence.unshift(MonsterKind.Runner);
  } else {
    sequence.unshift(MonsterKind.Square);
  }

  if (pressure >= 3.1) {
    sequence.push(
      waveIndex % 3 === 0
        ? MonsterKind.Berserker
        : (waveIndex % 2 === 0 ? MonsterKind.Tank : MonsterKind.Triangle),
    );
  }
  if (pressure >= 4.3) {
    sequence.push(waveIndex % 2 === 0 ? MonsterKind.Bulwark : MonsterKind.Square);
  }
  if (pressure >= 5.4) {
    sequence.push(
      waveIndex % 3 === 1
        ? MonsterKind.Berserker
        : (waveIndex % 2 === 0 ? MonsterKind.Splitter : MonsterKind.Runner),
    );
  }
  if (introduceSplitterEarly) {
    sequence.push(MonsterKind.Splitter);
  }

  return sequence;
}

function buildLevelOneShowcaseSequence(waveIndex: number): MonsterKind[] {
  const sequence: MonsterKind[] = [];
  for (let index = 0; index < LEVEL_ONE_SHOWCASE_SEQUENCE.length + 2; index += 1) {
    sequence.push(
      LEVEL_ONE_SHOWCASE_SEQUENCE[(index + waveIndex) % LEVEL_ONE_SHOWCASE_SEQUENCE.length]
      ?? MonsterKind.Ball,
    );
  }
  return sequence;
}

function buildWave(levelIndex: number, waveIndex: number, waveTotal: number, baseSequence: MonsterKind[], initialBuildTime: number): WaveData {
  const countBase = 13 + (levelIndex * 1.6);
  const countStep = 4 + Math.floor(levelIndex / 3);
  const lastWaveBonus = waveIndex === waveTotal - 1 ? 4 + Math.round(levelIndex * 0.8) : 0;
  const count = Math.round(countBase + (waveIndex * countStep) + lastWaveBonus);
  const pressure = (levelIndex * 0.65) + (waveIndex * 0.55);
  const spawnIntervalMin = clamp(0.82 - (pressure * 0.07), 0.24, 0.82);
  const spawnIntervalMax = clamp(spawnIntervalMin + 0.34 - (Math.min(levelIndex, 6) * 0.01), spawnIntervalMin + 0.12, 1.08);
  const intermission = clamp(5.75 - (levelIndex * 0.18) - (waveIndex * 0.32), 2.5, 5.5);
  const labelPool = ["Probe", "Push", "Break", "Surge", "Anvil", "Siege", "Overrun"];

  return {
    count,
    monsterSequence: buildWaveSequence(baseSequence, levelIndex, waveIndex),
    spawnIntervalMin,
    spawnIntervalMax,
    buildTime: waveIndex === 0 ? initialBuildTime : intermission,
    reward: 65 + (levelIndex * 10) + (waveIndex * 14),
    label: labelPool[Math.min(labelPool.length - 1, waveIndex)] ?? `Wave ${waveIndex + 1}`,
  };
}

export function createCampaignLevels(routes: LevelData[]): LevelData[] {
  return routes.map((route, levelIndex) => {
    const waveTotal = LEVEL_WAVE_TOTALS[levelIndex] ?? LEVEL_WAVE_TOTALS[LEVEL_WAVE_TOTALS.length - 1];
    const buildTime = LEVEL_BUILD_TIMES[levelIndex] ?? LEVEL_BUILD_TIMES[LEVEL_BUILD_TIMES.length - 1];
    const waves = Array.from({ length: waveTotal }, (_, waveIndex) =>
      buildWave(levelIndex, waveIndex, waveTotal, route.monsterSequence, buildTime),
    );

    return {
      ...route,
      id: `campaign-${levelIndex + 1}`,
      levelNumber: levelIndex + 1,
      subtitle: CAMPAIGN_NOTES[levelIndex] ?? "Hold the route and keep scaling your defense.",
      allowEscape: LEVEL_ESCAPES[levelIndex] ?? 8,
      startingMoney: LEVEL_STARTING_MONEY[levelIndex] ?? STARTING_MONEY,
      waves,
      monsterCount: waves.reduce((total, wave) => total + wave.count, 0),
      monsterSequence: waves.flatMap((wave) => wave.monsterSequence),
    };
  });
}

export function getCampaignLevelCount(levels: readonly LevelData[]): number {
  return levels.filter((level) => !level.isChallenge).length;
}

export function createRandomChallengeLevel(campaignLevelCount: number): LevelData {
  const route = createProceduralLevel();
  const challengeIndex = campaignLevelCount;
  const waveTotal = 7;
  const buildTime = 14;
  const waves = Array.from({ length: waveTotal }, (_, waveIndex) =>
    buildWave(challengeIndex, waveIndex, waveTotal, route.monsterSequence, buildTime),
  );

  return {
    ...route,
    id: "random-challenge",
    levelNumber: campaignLevelCount + 1,
    isChallenge: true,
    name: "Random",
    subtitle: "A fresh crossing route with diagonal cuts, vertical runs, and no lock.",
    allowEscape: 9,
    startingMoney: 470,
    waves,
    monsterCount: waves.reduce((total, wave) => total + wave.count, 0),
    monsterSequence: waves.flatMap((wave) => wave.monsterSequence),
  };
}

export function createGameLevels(routes: LevelData[]): LevelData[] {
  const campaignLevels = createCampaignLevels(routes);

  return [
    ...campaignLevels,
    createRandomChallengeLevel(campaignLevels.length),
  ];
}
