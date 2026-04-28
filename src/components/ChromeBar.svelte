<script lang="ts">
  import { getGameSessionContext } from "../game-context";

  const session = getGameSessionContext();
  const { hud, soundEnabled } = session;
</script>

<header class="topbar">
  <div class="title-block">
    <h1>Vector Defence</h1>
  </div>
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
    <button class="chrome-button" type="button" onclick={session.openMenu}>Campaign</button>
    <button class="chrome-button" type="button" onclick={session.restart}>Restart</button>
  </div>
</header>
