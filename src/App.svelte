<script lang="ts">
  import ChromeBar from "./components/ChromeBar.svelte";
  import GameBoard from "./components/GameBoard.svelte";
  import NerdStatsPanel from "./components/NerdStatsPanel.svelte";
  import TowerPanel from "./components/TowerPanel.svelte";
  import { TOWER_CLASSES } from "./entities/towers/tower-registry";
  import { setGameSessionContext } from "./game-context";
  import { createGameSession } from "./game-session";

  const session = createGameSession();
  const towerNumberShortcuts = TOWER_CLASSES.map((towerClass) => towerClass.shortcuts[0]?.toUpperCase() ?? "").join("-");
  const towerLetterShortcuts = TOWER_CLASSES.map((towerClass) => towerClass.shortcuts[1]?.toUpperCase() ?? "").join("/");
  let showNerdStats = $state(false);

  function toggleNerdStats(): void {
    showNerdStats = !showNerdStats;
    session.setNerdStatsEnabled(showNerdStats);
  }

  setGameSessionContext(session);
</script>

<div class="shell">
  <ChromeBar />
  <GameBoard />
  <TowerPanel />

  <p class="footnote">
    Tip: press <strong>{towerNumberShortcuts}</strong> or <strong>{towerLetterShortcuts}</strong> for towers, <strong>U</strong> to upgrade, <strong>Esc</strong> to cancel build mode, and <strong>Space</strong> to pause or resume.
    <button class="footnote-link" type="button" onclick={toggleNerdStats}>
      {showNerdStats ? "Hide" : "Show"} stats for nerds
    </button>
  </p>
  {#if showNerdStats}
    <NerdStatsPanel />
  {/if}
</div>
