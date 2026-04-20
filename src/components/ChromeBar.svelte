<script lang="ts">
  import { getGameSessionContext } from "../game-context";

  const session = getGameSessionContext();
  const { hud } = session;
</script>

<header class="topbar">
  <div class="title-block">
    <h1>Vector Defence</h1>
  </div>
  <section class="hud">
    {#each [
      { label: "Level", value: $hud.levelName },
      { label: "Money", value: $hud.money },
      { label: "Leaks Left", value: $hud.escapes },
      { label: "Wave", value: $hud.wave },
    ] as stat}
      <div class="stat-card">
        <span>{stat.label}</span>
        <strong>{stat.value}</strong>
      </div>
    {/each}
  </section>
  <div class="actions">
    <button class="chrome-button" type="button" onclick={session.togglePause} disabled={$hud.pauseDisabled}>
      {$hud.pauseLabel}
    </button>
    <button class="chrome-button" type="button" onclick={session.openMenu}>Campaign</button>
    <button class="chrome-button" type="button" onclick={session.restart}>Restart</button>
  </div>
</header>
