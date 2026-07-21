<script lang="ts">
  import controlHomeIcon from "../assets/ui/control-home.png";
  import controlPauseIcon from "../assets/ui/control-pause.png";
  import controlPlayIcon from "../assets/ui/control-play.png";
  import controlSoundMutedIcon from "../assets/ui/control-sound-muted.png";
  import controlSoundOnIcon from "../assets/ui/control-sound-on.png";
  import { getGameSessionContext } from "../game-context";
  import { formatMoney } from "../utils";

  const session = getGameSessionContext();
  const { hud, soundEnabled } = session;
  const profile = session.profile;

  function formatLevel(levelNumber: number | undefined): string {
    const value = levelNumber ?? "?";
    return profile.mode === "mobile" ? `Level ${value}` : String(value);
  }

  function formatProgress(current: number | undefined, total: number | undefined): string {
    return current === undefined || total === undefined ? "" : `${current} of ${total}`;
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
        { label: profile.mode === "mobile" ? "" : "Level", value: formatLevel($hud.levelNumber), className: "level-stat" },
        { label: profile.mode === "mobile" ? "" : "Money", value: formatMoney($hud.money), className: "money-stat" },
        { label: profile.mode === "mobile" ? "" : "Wave", value: formatProgress($hud.waveCurrent, $hud.waveTotal), className: "wave-stat" },
        ...(profile.mode === "mobile" || $hud.waveMonsterTotal === undefined ? [] : [
          { label: "Monsters", value: formatProgress($hud.waveMonstersSpawned, $hud.waveMonsterTotal), className: "monsters-stat" },
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
