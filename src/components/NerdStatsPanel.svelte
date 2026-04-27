<script lang="ts">
  import { getGameSessionContext } from "../game-context";

  const session = getGameSessionContext();
  const { hud } = session;
</script>

<section class="nerd-panel">
  <div class="nerd-grid">
    {#each [
      { label: "FPS", value: $hud.nerdStats.fps },
      { label: "Frame Time", value: $hud.nerdStats.frameTime },
      { label: "Tracked", value: $hud.nerdStats.trackedObjects },
      { label: "Towers", value: $hud.nerdStats.towers },
      { label: "Hostiles", value: $hud.nerdStats.hostiles },
      { label: "Shots", value: $hud.nerdStats.shots },
      { label: "FX", value: $hud.nerdStats.effects },
      { label: "Pixel Ratio", value: $hud.nerdStats.pixelRatio },
    ] as stat (stat.label)}
      <div class="nerd-stat">
        <span>{stat.label}:</span>
        <strong>{stat.value}</strong>
      </div>
    {/each}
  </div>
</section>
