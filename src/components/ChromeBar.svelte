<script lang="ts">
  import { getGameSessionContext } from "../game-context";

  const session = getGameSessionContext();
  const { hud, soundEnabled } = session;
  const profile = session.profile;

  function formatMobileWave(wave: string): string {
    const [wavePart] = wave.split(" ");
    const [currentWave, waveTotal] = wavePart.split("/");
    return currentWave && waveTotal ? `Wave ${currentWave} of ${waveTotal}` : wave;
  }
</script>

<header class="topbar">
  {#if profile.ui.showTitle}
    <div class="title-block">
      <h1>Vector Defence</h1>
    </div>
  {/if}
  {#if $hud.canTogglePause}
    <section class="hud">
      {#each [
        { label: profile.mode === "mobile" ? "" : "Level", value: $hud.levelName, className: "level-stat" },
        { label: profile.mode === "mobile" ? "" : "Money", value: $hud.money, className: "money-stat" },
        { label: profile.mode === "mobile" ? "" : "Wave", value: profile.mode === "mobile" ? formatMobileWave($hud.wave) : $hud.wave, className: "wave-stat" },
        ...(profile.mode === "mobile" || !$hud.monsters ? [] : [
          { label: "Monsters", value: $hud.monsters, className: "monsters-stat" },
        ]),
      ] as stat}
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
      <span class="sound-icon" aria-hidden="true">{$soundEnabled ? "🔊" : "🔇"}</span>
    </button>
    <button
      class="chrome-button pause-button"
      type="button"
      aria-label={$hud.paused ? "Resume" : "Pause"}
      title={$hud.paused ? "Resume" : "Pause"}
      disabled={!$hud.canTogglePause}
      onclick={session.togglePause}
    >
      <span aria-hidden="true">{$hud.paused ? "▶️" : "⏸️"}</span>
    </button>
    <button
      class="chrome-button campaign-button"
      type="button"
      aria-label="Campaign"
      title="Campaign"
      onclick={session.openMenu}
    >
      <span aria-hidden="true">🎮</span>
    </button>
  </div>
</header>
