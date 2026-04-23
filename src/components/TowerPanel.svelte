<script lang="ts">
  import type { Action } from "svelte/action";
  import { TOWER_TOOLBAR_PREVIEWS } from "../entities/towers/tower-registry";
  import { getGameSessionContext } from "../game-context";
  import type { TowerKind } from "../types";
  import type { Tower } from "../entities/towers/tower";
  import { formatMoney } from "../utils";

  const ICON_SIZE = 60;
  const session = getGameSessionContext();
  const hud = session.hud;

  function formatShortcuts(shortcuts: readonly string[]): string {
    return shortcuts.map((shortcut) => shortcut.toUpperCase()).join("/");
  }

  function drawTowerPreview(canvas: HTMLCanvasElement, tower: Tower): void {
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const cssSize = `${ICON_SIZE}px`;

    if (canvas.style.width !== cssSize) {
      canvas.style.width = cssSize;
      canvas.style.height = cssSize;
    }

    const scaledSize = Math.round(ICON_SIZE * dpr);
    if (canvas.width !== scaledSize || canvas.height !== scaledSize) {
      canvas.width = scaledSize;
      canvas.height = scaledSize;
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, ICON_SIZE, ICON_SIZE);

    tower.draw(context, false);
  }

  const towerIcon: Action<HTMLCanvasElement, Tower> = (canvas, tower) => {
    drawTowerPreview(canvas, tower);
  };

  function handleTowerButtonClick(event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }): void {
    session.toggleTowerPlacement(event.currentTarget.value as TowerKind);
  }
</script>

<section class="controls-grid">
  <div class="tower-strip-card">
    <div class="tower-strip">
      {#each TOWER_TOOLBAR_PREVIEWS as tower (tower.kind)}
        {@const towerClass = tower.towerClass}
        <button
          class={`tower-button${$hud.placingTower === tower.kind ? " active" : ""}`}
          type="button"
          value={tower.kind}
          title={`${towerClass.label} tower (${formatShortcuts(towerClass.shortcuts)})`}
          aria-label={`${towerClass.label} tower for ${formatMoney(towerClass.baseCost)} (${formatShortcuts(towerClass.shortcuts)})`}
          disabled={$hud.towerButtonsDisabled}
          onclick={handleTowerButtonClick}
        >
          <div class="tower-button-meta">
            <span>{formatMoney(towerClass.baseCost)}</span>
            <span class="shortcut-chip">{formatShortcuts(towerClass.shortcuts)}</span>
          </div>
          <canvas use:towerIcon={tower} class="tower-icon" aria-hidden="true"></canvas>
          <strong class="tower-button-label">{towerClass.label}</strong>
        </button>
      {/each}
    </div>
  </div>

  <div class="control-card selection-card">
    <div class="selection-header">
      <div class="selection-copy">
        <strong>{$hud.selectionTitle}</strong>
        <span>{$hud.selectionBody}</span>
      </div>
      <button
        class="action-button sell selection-sell-button"
        type="button"
        onclick={session.sellSelectedTower}
        disabled={$hud.sellDisabled}
      >
        Sell
      </button>
    </div>
  </div>
</section>
