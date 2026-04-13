import { STARTING_MONEY } from "./constants";
import { createProceduralLevel } from "./level-generator";
import type { LevelData, MonsterCode, WaveData } from "./types";

const CAMPAIGN_NOTES = [
  "Warm up on a forgiving route and learn the shape of the field.",
  "Faster side-lanes start to punish weak coverage.",
  "The path opens up and asks for better crossfire.",
  "Split pressure starts appearing from wave to wave.",
  "Long corners reward towers that can hold a lane.",
  "Bruisers begin arriving in real numbers.",
  "A wider route tests how well you scale your economy.",
  "Dense mixed waves force you to balance single-target and splash.",
  "Almost every wave now contains a hard anchor enemy.",
  "The final route is a siege. Build fast and spend well.",
] as const;

const LEVEL_BUILD_TIMES = [10, 10, 11, 11, 12, 12, 13, 13, 14, 14] as const;
const LEVEL_ESCAPES = [15, 15, 14, 13, 12, 12, 11, 10, 9, 8] as const;
const LEVEL_STARTING_MONEY = [320, 335, 350, 365, 380, 395, 410, 430, 450, 470] as const;
const LEVEL_WAVE_TOTALS = [4, 4, 5, 5, 5, 6, 6, 6, 7, 7] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function uniqueSequence(sequence: MonsterCode[]): MonsterCode[] {
  const seen = new Set<MonsterCode>();
  const result: MonsterCode[] = [];
  for (const code of sequence) {
    if (!seen.has(code)) {
      seen.add(code);
      result.push(code);
    }
  }
  return result;
}

function buildWaveSequence(baseSequence: MonsterCode[], levelIndex: number, waveIndex: number): MonsterCode[] {
  const pressure = (levelIndex * 0.85) + (waveIndex * 0.9);
  const pool: MonsterCode[] = [...baseSequence];

  if (pressure >= 1.2) {
    pool.push("square", "runner");
  }
  if (pressure >= 2.2) {
    pool.push("triangle", "triangle");
  }
  if (pressure >= 3.3) {
    pool.push("tank");
  }
  if (pressure >= 4.6) {
    pool.push("runner", "square", "tank");
  }
  if (pressure >= 6.1) {
    pool.push("triangle", "runner", "tank");
  }

  const source = uniqueSequence(pool);
  const length = clamp(5 + waveIndex + Math.floor(levelIndex / 2), 5, 12);
  const sequence: MonsterCode[] = [];

  for (let index = 0; index < length; index += 1) {
    sequence.push(source[(index + waveIndex + (levelIndex * 2)) % source.length] ?? "ball");
  }

  if (pressure < 2.4) {
    sequence.unshift("ball");
  } else if (pressure < 4.4) {
    sequence.unshift("runner");
  } else {
    sequence.unshift("square");
  }

  if (pressure >= 3.1) {
    sequence.push(waveIndex % 2 === 0 ? "tank" : "triangle");
  }
  if (pressure >= 5.4) {
    sequence.push("runner");
  }

  return sequence;
}

function buildWave(levelIndex: number, waveIndex: number, waveTotal: number, baseSequence: MonsterCode[], initialBuildTime: number): WaveData {
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

function createBonusRoutes(): LevelData[] {
  return Array.from({ length: 4 }, (_, index) => {
    const generated = createProceduralLevel();
    generated.name = `Frontier ${index + 1}: ${generated.name}`;
    return generated;
  });
}

export function createCampaignLevels(routes: LevelData[]): LevelData[] {
  const routePool = [...routes, ...createBonusRoutes()].slice(0, 10);

  return routePool.map((route, levelIndex) => {
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
