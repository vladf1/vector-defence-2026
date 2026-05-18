<script lang="ts">
  import controlHomeIcon from "../assets/ui/control-home.png";
  import controlPauseIcon from "../assets/ui/control-pause.png";
  import controlPlayIcon from "../assets/ui/control-play.png";
  import controlSoundMutedIcon from "../assets/ui/control-sound-muted.png";
  import controlSoundOnIcon from "../assets/ui/control-sound-on.png";
  import { getGameSessionContext } from "../game-context";

  const session = getGameSessionContext();
  const { hud, soundEnabled } = session;
  const profile = session.profile;

  function formatMobileWave(wave: string): string {
    const [wavePart] = wave.split(" ");
    const [currentWave, waveTotal] = wavePart.split("/");
    return currentWave && waveTotal ? `${currentWave} of ${waveTotal}` : wave;
  }
</script>

<header class="topbar">
  {#if profile.ui.showTitle}
    <div class="title-block">
      <h1>Vector Defence</h1>
    </div>
  {/if}
  {#if $hud.showStatusHud}
    <section class="hud">
      {#each [
        { label: profile.mode === "mobile" ? "" : "Level", value: $hud.levelName, className: "level-stat" },
        { label: profile.mode === "mobile" ? "" : "Money", value: $hud.money, className: "money-stat" },
        { label: profile.mode === "mobile" ? "" : "Wave", value: profile.mode === "mobile" ? formatMobileWave($hud.wave) : $hud.wave, className: "wave-stat" },
        ...(profile.mode === "mobile" || !$hud.monsters ? [] : [
          { label: "Monsters", value: $hud.monsters, className: "monsters-stat" },
        ]),
      ].filter((stat) => stat.value) as stat}
        <div class={`stat-card ${stat.className}`}>
          {#if stat.label}
            <span>{stat.label}</span>
          {/if}
          <strong>{stat.value}</strong>
        </div>
      {/each}
    </section>
  {/if}
  <div class="actions">
    <button
      class="chrome-button sound-button"
      type="button"
      aria-label={$soundEnabled ? "Mute sound" : "Unmute sound"}
      aria-pressed={$soundEnabled}
      title={$soundEnabled ? "Mute sound" : "Unmute sound"}
      onclick={session.toggleSound}
    >
      <img class="control-icon" src={$soundEnabled ? controlSoundOnIcon : controlSoundMutedIcon} alt="" aria-hidden="true" />
    </button>
    <button
      class="chrome-button pause-button"
      type="button"
      aria-label={$hud.paused ? "Resume" : "Pause"}
      title={$hud.paused ? "Resume" : "Pause"}
      disabled={!$hud.canTogglePause}
      onclick={session.togglePause}
    >
      <img class="control-icon" src={$hud.paused ? controlPlayIcon : controlPauseIcon} alt="" aria-hidden="true" />
    </button>
    <button
      class="chrome-button campaign-button"
      type="button"
      aria-label="Campaign"
      title="Campaign"
      onclick={session.openMenu}
    >
      <img class="control-icon" src={controlHomeIcon} alt="" aria-hidden="true" />
    </button>
  </div>
</header>
