<script lang="ts">
  import { TOWER_CLASSES } from "../entities/towers/tower-registry";
  import { getGameSessionContext } from "../game-context";
  import { formatMoney } from "../utils";

  const session = getGameSessionContext();
  const { hud } = session;

  const formatShortcuts = (shortcuts: readonly string[]): string => shortcuts.map((shortcut) => shortcut.toUpperCase()).join("/");
</script>

<section class="controls-grid">
  <div class="control-card">
    <div class="tower-strip">
      {#each TOWER_CLASSES as towerClass}
        <button
          class={`tower-button${$hud.placingTower === towerClass.kind ? " active" : ""}`}
          type="button"
          title={`${towerClass.label} tower (${formatShortcuts(towerClass.shortcuts)})`}
          disabled={$hud.towerButtonsDisabled}
          on:click={() => session.toggleTowerPlacement(towerClass.kind)}
        >
          <strong>
            {towerClass.label}
            <span class="shortcut-chip">{formatShortcuts(towerClass.shortcuts)}</span>
          </strong>
          <span>{formatMoney(towerClass.baseCost)} · {towerClass.summary}</span>
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
