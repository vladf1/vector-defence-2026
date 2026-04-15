<script lang="ts">
  import { getGameSessionContext } from "../game-context";

  const session = getGameSessionContext();
  const { hud } = session;

  $: stats = [
    { label: "Level", value: $hud.levelName },
    { label: "Money", value: $hud.money },
    { label: "Leaks Left", value: $hud.escapes },
    { label: "Wave", value: $hud.wave },
  ];
</script>

<header class="topbar">
  <div class="title-block">
    <h1>Vector Defence</h1>
  </div>
  <div class="actions">
    <button class="chrome-button" type="button" on:click={session.togglePause} disabled={$hud.pauseDisabled}>
      {$hud.pauseLabel}
    </button>
    <button class="chrome-button" type="button" on:click={session.openMenu}>Campaign</button>
    <button class="chrome-button" type="button" on:click={session.restart}>Restart</button>
  </div>
</header>

<section class="hud">
  {#each stats as stat}
    <div class="stat-card">
      <span>{stat.label}</span>
      <strong>{stat.value}</strong>
    </div>
  {/each}
</section>
