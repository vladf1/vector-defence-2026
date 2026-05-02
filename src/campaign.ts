import { STARTING_MONEY } from "./constants";
import { createProceduralLevel } from "./level-generator";
import { MonsterKind, type LevelData, type WaveData } from "./types";
import { clamp } from "./utils";

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
    return buildLevelOneShowcaseSequence(baseSequence, waveIndex);
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

function buildLevelOneShowcaseSequence(baseSequence: MonsterKind[], waveIndex: number): MonsterKind[] {
  const source = baseSequence.length > 0 ? baseSequence : [MonsterKind.Ball];
  const sequence: MonsterKind[] = [];
  for (let index = 0; index < source.length + 2; index += 1) {
    sequence.push(
      source[(index + waveIndex) % source.length]
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
    reward: Math.round((65 + (levelIndex * 10) + (waveIndex * 14)) / 10),
    label: labelPool[Math.min(labelPool.length - 1, waveIndex)] ?? `Wave ${waveIndex + 1}`,
  };
}

export function createCampaignLevels(routes: LevelData[]): LevelData[] {
  return routes.map((route, levelIndex) => {
    const waveTotal = route.waveCount ?? 6;
    const buildTime = route.initialBuildTime ?? 12;
    const waves = Array.from({ length: waveTotal }, (_, waveIndex) =>
      buildWave(levelIndex, waveIndex, waveTotal, route.monsterSequence, buildTime),
    );

    return {
      ...route,
      id: `campaign-${levelIndex + 1}`,
      levelNumber: levelIndex + 1,
      subtitle: route.subtitle ?? "Hold the route and keep scaling your defense.",
      startingMoney: route.startingMoney ?? STARTING_MONEY,
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
    startingMoney: 47,
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
