<script lang="ts">
  import { getGameSessionContext } from "../game-context";

  const session = getGameSessionContext();
  const { hud, soundEnabled } = session;
  const profile = session.profile;
</script>

<header class="topbar">
  {#if profile.ui.showTitle}
    <div class="title-block">
      <h1>Vector Defence</h1>
    </div>
  {/if}
  <section class="hud">
    {#each [
      { label: "Level", value: $hud.levelName, className: "level-stat" },
      { label: "Money", value: $hud.money, className: "money-stat" },
      { label: "Wave", value: $hud.wave, className: "wave-stat" },
    ] as stat}
      <div class={`stat-card ${stat.className}`}>
        <span>{stat.label}</span>
        <strong>{stat.value}</strong>
      </div>
    {/each}
  </section>
  <div class="actions">
    <button
      class="chrome-button sound-button"
      type="button"
      aria-label={$soundEnabled ? "Mute sound" : "Unmute sound"}
      aria-pressed={$soundEnabled}
      title={$soundEnabled ? "Mute sound" : "Unmute sound"}
      onclick={session.toggleSound}
    >
      <span class="sound-icon" aria-hidden="true">{$soundEnabled ? "🔊" : "🔇"}</span>
    </button>
    {#if profile.mode === "mobile"}
      <button
        class="chrome-button pause-button"
        type="button"
        aria-label={$hud.paused ? "Resume" : "Pause"}
        disabled={!$hud.canTogglePause}
        onclick={session.togglePause}
      >
        {$hud.paused ? ">" : "||"}
      </button>
    {/if}
    <button class="chrome-button" type="button" onclick={session.openMenu}>Campaign</button>
    {#if profile.ui.showChromeRestart}
      <button class="chrome-button" type="button" onclick={session.restart}>Restart</button>
    {/if}
  </div>
</header>
