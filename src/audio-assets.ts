import buildModeCancelUrl from "./assets/audio/build-mode-cancel.m4a";
import buildModeOnUrl from "./assets/audio/build-mode-on.m4a";
import campaignCompleteUrl from "./assets/audio/campaign-complete.m4a";
import escapeBurstUrl from "./assets/audio/escape-burst.m4a";
import gunFireUrl from "./assets/audio/gun-fire.m4a";
import invalidActionUrl from "./assets/audio/invalid-action.m4a";
import laserFireUrl from "./assets/audio/laser-fire.m4a";
import laserLockOffUrl from "./assets/audio/laser-lock-off.m4a";
import laserLockOnUrl from "./assets/audio/laser-lock-on.m4a";
import levelLossUrl from "./assets/audio/level-loss.m4a";
import levelStartUrl from "./assets/audio/level-start.m4a";
import levelWinUrl from "./assets/audio/level-win.m4a";
import menuOpenUrl from "./assets/audio/menu-open.m4a";
import missileExplosionUrl from "./assets/audio/missile-explosion.m4a";
import missileLaunchUrl from "./assets/audio/missile-launch.m4a";
import monsterHeavyDeathUrl from "./assets/audio/monster-heavy-death.m4a";
import monsterPopUrl from "./assets/audio/monster-pop.m4a";
import monsterShatterUrl from "./assets/audio/monster-shatter.m4a";
import pauseUrl from "./assets/audio/pause.m4a";
import projectileImpactUrl from "./assets/audio/projectile-impact.m4a";
import resumeUrl from "./assets/audio/resume.m4a";
import slowPulseUrl from "./assets/audio/slow-pulse.m4a";
import soundToggleUrl from "./assets/audio/sound-toggle.m4a";
import splitterBurstUrl from "./assets/audio/splitter-burst.m4a";
import towerPlaceUrl from "./assets/audio/tower-place.m4a";
import towerSelectUrl from "./assets/audio/tower-select.m4a";
import towerSellUrl from "./assets/audio/tower-sell.m4a";
import towerUpgradeUrl from "./assets/audio/tower-upgrade.m4a";
import uiClickUrl from "./assets/audio/ui-click.m4a";
import uiConfirmUrl from "./assets/audio/ui-confirm.m4a";
import waveClearUrl from "./assets/audio/wave-clear.m4a";
import waveStartUrl from "./assets/audio/wave-start.m4a";
import {
  AudioCue,
  type AudioCueId,
} from "./types";

export const AUDIO_ASSET_URLS = {
  [AudioCue.BuildModeCancel.id]: buildModeCancelUrl,
  [AudioCue.BuildModeOn.id]: buildModeOnUrl,
  [AudioCue.CampaignComplete.id]: campaignCompleteUrl,
  [AudioCue.EscapeBurst.id]: escapeBurstUrl,
  [AudioCue.GunFire.id]: gunFireUrl,
  [AudioCue.InvalidAction.id]: invalidActionUrl,
  [AudioCue.LaserFire.id]: laserFireUrl,
  [AudioCue.LaserLockOff.id]: laserLockOffUrl,
  [AudioCue.LaserLockOn.id]: laserLockOnUrl,
  [AudioCue.LevelLoss.id]: levelLossUrl,
  [AudioCue.LevelStart.id]: levelStartUrl,
  [AudioCue.LevelWin.id]: levelWinUrl,
  [AudioCue.MenuOpen.id]: menuOpenUrl,
  [AudioCue.MissileExplosion.id]: missileExplosionUrl,
  [AudioCue.MissileLaunch.id]: missileLaunchUrl,
  [AudioCue.MonsterHeavyDeath.id]: monsterHeavyDeathUrl,
  [AudioCue.MonsterPop.id]: monsterPopUrl,
  [AudioCue.MonsterShatter.id]: monsterShatterUrl,
  [AudioCue.Pause.id]: pauseUrl,
  [AudioCue.ProjectileImpact.id]: projectileImpactUrl,
  [AudioCue.Resume.id]: resumeUrl,
  [AudioCue.SlowPulse.id]: slowPulseUrl,
  [AudioCue.SoundToggle.id]: soundToggleUrl,
  [AudioCue.SplitterBurst.id]: splitterBurstUrl,
  [AudioCue.TowerPlace.id]: towerPlaceUrl,
  [AudioCue.TowerSelect.id]: towerSelectUrl,
  [AudioCue.TowerSell.id]: towerSellUrl,
  [AudioCue.TowerUpgrade.id]: towerUpgradeUrl,
  [AudioCue.UiClick.id]: uiClickUrl,
  [AudioCue.UiConfirm.id]: uiConfirmUrl,
  [AudioCue.WaveClear.id]: waveClearUrl,
  [AudioCue.WaveStart.id]: waveStartUrl,
} satisfies Record<AudioCueId, string>;
