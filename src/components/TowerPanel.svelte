<script lang="ts">
  import { TOWER_KINDS, TOWER_SHORTCUTS } from "../game-engine";
  import { TOWER_SPECS } from "../constants";
  import { getGameSessionContext } from "../game-context";
  import type { TowerKind } from "../types";
  import { formatMoney } from "../utils";

  const session = getGameSessionContext();
  const { hud } = session;

  const shortcutLabel = (kind: TowerKind): string => TOWER_SHORTCUTS[kind].map((shortcut) => shortcut.toUpperCase()).join("/");
</script>

<section class="controls-grid">
  <div class="control-card">
    <div class="tower-strip">
      {#each TOWER_KINDS as kind}
        <button
          class={`tower-button${$hud.placingTower === kind ? " active" : ""}`}
          type="button"
          title={`${TOWER_SPECS[kind].label} tower (${shortcutLabel(kind)})`}
          disabled={$hud.towerButtonsDisabled}
          on:click={() => session.toggleTowerPlacement(kind)}
        >
          <strong>
            {TOWER_SPECS[kind].label}
            <span class="shortcut-chip">{shortcutLabel(kind)}</span>
          </strong>
          <span>{formatMoney(TOWER_SPECS[kind].cost)} · {TOWER_SPECS[kind].summary}</span>
        </button>
      {/each}
    </div>
  </div>

  <div class="control-card selection-card">
    <div class="selection-copy">
      <strong>{$hud.selectionTitle}</strong>
      <span>{$hud.selectionBody}</span>
    </div>
    <div class="selection-actions">
      <button class="action-button" type="button" on:click={session.upgradeSelectedTower} disabled={$hud.upgradeDisabled}>Upgrade</button>
      <button class="action-button sell" type="button" on:click={session.sellSelectedTower} disabled={$hud.sellDisabled}>Sell</button>
      <button class="action-button" type="button" on:click={session.cancelBuild} disabled={$hud.cancelDisabled}>Cancel Build</button>
    </div>
  </div>
</section>
