import escapeBurstUrl from "./assets/audio/escape-burst.m4a";
import gunFireUrl from "./assets/audio/gun-fire.m4a";
import laserFireUrl from "./assets/audio/laser-fire.m4a";
import levelLossUrl from "./assets/audio/level-loss.m4a";
import levelStartUrl from "./assets/audio/level-start.m4a";
import levelWinUrl from "./assets/audio/level-win.m4a";
import missileExplosionUrl from "./assets/audio/missile-explosion.m4a";
import missileLaunchUrl from "./assets/audio/missile-launch.m4a";
import monsterHeavyDeathUrl from "./assets/audio/monster-heavy-death.m4a";
import monsterPopUrl from "./assets/audio/monster-pop.m4a";
import monsterShatterUrl from "./assets/audio/monster-shatter.m4a";
import projectileImpactUrl from "./assets/audio/projectile-impact.m4a";
import slowPulseUrl from "./assets/audio/slow-pulse.m4a";
import splitterBurstUrl from "./assets/audio/splitter-burst.m4a";
import towerPlaceUrl from "./assets/audio/tower-place.m4a";
import towerSellUrl from "./assets/audio/tower-sell.m4a";
import towerUpgradeUrl from "./assets/audio/tower-upgrade.m4a";
import waveClearUrl from "./assets/audio/wave-clear.m4a";
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
