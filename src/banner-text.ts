import { GameState, type GameState as GameStateValue, type WaveData } from "./types";

export interface BannerTextSource {
  state: GameStateValue;
  runtime: {
    activeWave?: WaveData;
    currentWaveIndex: number;
    spawnDelay: number;
  };
  bannerTimer: number;
  bannerText: string;
  statusText: string;
}

export function createBannerText(source: BannerTextSource): string {
  const activeWave = source.runtime.activeWave;

  if (source.state === GameState.Playing && activeWave && source.runtime.spawnDelay > 0) {
    return `Wave ${source.runtime.currentWaveIndex + 1} ${activeWave.label} in ${Math.ceil(source.runtime.spawnDelay)}`;
  }

  if (source.state === GameState.Won || source.state === GameState.CampaignWon || source.state === GameState.Lost) {
    return "";
  }

  if (source.bannerTimer > 0) {
    return source.bannerText;
  }

  if (source.state === GameState.Playing) {
    return "";
  }

  return source.state === GameState.Menu ? "Awaiting orders" : source.statusText;
}
