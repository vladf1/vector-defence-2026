<script lang="ts">
  import ChromeBar from "./components/ChromeBar.svelte";
  import GameBoard from "./components/GameBoard.svelte";
  import TowerPanel from "./components/TowerPanel.svelte";
  import { setGameSessionContext } from "./game-context";
  import { createGameSession } from "./game-session";

  setGameSessionContext(createGameSession());
</script>

<div class="shell">
  <ChromeBar />
  <GameBoard />
  <TowerPanel />

  <p class="footnote">Tip: press <strong>1-4</strong> or <strong>G/L/M/S</strong> for towers, <strong>U</strong> to upgrade, <strong>Esc</strong> to cancel build mode, and <strong>Space</strong> to pause or resume.</p>
</div>
