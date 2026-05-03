<script lang="ts">
  import ChromeBar from "./components/ChromeBar.svelte";
  import GameBoard from "./components/GameBoard.svelte";
  import NerdStatsPanel from "./components/NerdStatsPanel.svelte";
  import TowerPanel from "./components/TowerPanel.svelte";
  import { untrack } from "svelte";
  import { TOWER_TOOLBAR_PREVIEWS } from "./entities/towers/tower-registry";
  import { setGameSessionContext } from "./game-context";
  import type { GameProfile } from "./game-profile";
  import { createGameSession } from "./game-session";

  const { profile }: { profile: GameProfile } = $props();
  const session = untrack(() => createGameSession(profile));
  const towerNumberShortcuts = TOWER_TOOLBAR_PREVIEWS.map((tower) => tower.towerClass.shortcuts[0]?.toUpperCase() ?? "").join("-");
  const towerLetterShortcuts = TOWER_TOOLBAR_PREVIEWS.map((tower) => tower.towerClass.shortcuts[1]?.toUpperCase() ?? "").join("/");
  let showNerdStats = $state(false);

  function toggleNerdStats(): void {
    showNerdStats = !showNerdStats;
    session.setNerdStatsEnabled(showNerdStats);
  }

  setGameSessionContext(session);
</script>

<div class={`shell ${profile.mode === "mobile" ? "mobile-shell" : ""}`}>
  {#if profile.ui.portraitOnly}
    <div class="orientation-blocker">
      <strong>Rotate to portrait</strong>
      <span>Vector Defence mobile is tuned for upright play.</span>
    </div>
  {/if}
  <ChromeBar />
  <GameBoard />
  <TowerPanel />

  {#if profile.ui.showFootnote}
    <p class="footnote">
      Tip: press <strong>{towerNumberShortcuts}</strong> or <strong>{towerLetterShortcuts}</strong> for towers, <strong>U</strong> to upgrade, <strong>Esc</strong> to cancel build mode, and <strong>Space</strong> to pause or resume.
      <button class="footnote-link" type="button" onclick={toggleNerdStats}>
        {showNerdStats ? "Hide" : "Show"} stats for nerds
      </button>
    </p>
  {/if}
  {#if profile.ui.showFootnote && showNerdStats}
    <NerdStatsPanel />
  {/if}
</div>
