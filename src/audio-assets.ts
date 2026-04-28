import escapeBurstUrl from "./assets/audio/escape-burst.wav";
import gunFireUrl from "./assets/audio/gun-fire.wav";
import laserFireUrl from "./assets/audio/laser-fire.wav";
import levelLossUrl from "./assets/audio/level-loss.wav";
import levelStartUrl from "./assets/audio/level-start.wav";
import levelWinUrl from "./assets/audio/level-win.wav";
import missileExplosionUrl from "./assets/audio/missile-explosion.wav";
import missileLaunchUrl from "./assets/audio/missile-launch.wav";
import monsterHeavyDeathUrl from "./assets/audio/monster-heavy-death.wav";
import monsterPopUrl from "./assets/audio/monster-pop.wav";
import monsterShatterUrl from "./assets/audio/monster-shatter.wav";
import projectileImpactUrl from "./assets/audio/projectile-impact.wav";
import slowPulseUrl from "./assets/audio/slow-pulse.wav";
import splitterBurstUrl from "./assets/audio/splitter-burst.wav";
import towerPlaceUrl from "./assets/audio/tower-place.wav";
import towerSellUrl from "./assets/audio/tower-sell.wav";
import towerUpgradeUrl from "./assets/audio/tower-upgrade.wav";
import waveClearUrl from "./assets/audio/wave-clear.wav";
import {
  AudioCue,
  type AudioCueId,
} from "./types";

export const AUDIO_ASSET_URLS = {
  [AudioCue.EscapeBurst.id]: escapeBurstUrl,
  [AudioCue.GunFire.id]: gunFireUrl,
  [AudioCue.LaserFire.id]: laserFireUrl,
  [AudioCue.LevelLoss.id]: levelLossUrl,
  [AudioCue.LevelStart.id]: levelStartUrl,
  [AudioCue.LevelWin.id]: levelWinUrl,
  [AudioCue.MissileExplosion.id]: missileExplosionUrl,
  [AudioCue.MissileLaunch.id]: missileLaunchUrl,
  [AudioCue.MonsterHeavyDeath.id]: monsterHeavyDeathUrl,
  [AudioCue.MonsterPop.id]: monsterPopUrl,
  [AudioCue.MonsterShatter.id]: monsterShatterUrl,
  [AudioCue.ProjectileImpact.id]: projectileImpactUrl,
  [AudioCue.SlowPulse.id]: slowPulseUrl,
  [AudioCue.SplitterBurst.id]: splitterBurstUrl,
  [AudioCue.TowerPlace.id]: towerPlaceUrl,
  [AudioCue.TowerSell.id]: towerSellUrl,
  [AudioCue.TowerUpgrade.id]: towerUpgradeUrl,
  [AudioCue.WaveClear.id]: waveClearUrl,
} satisfies Record<AudioCueId, string>;
