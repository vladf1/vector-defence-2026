<script lang="ts">
  import type { Action } from "svelte/action";
  import { TOWER_TOOLBAR_PREVIEWS } from "../entities/towers/tower-registry";
  import { getGameSessionContext } from "../game-context";
  import type { TowerKind } from "../types";
  import type { Tower } from "../entities/towers/tower";
  import { formatMoney } from "../utils";

  const ICON_SIZE = 60;
  const session = getGameSessionContext();
  const profile = session.profile;
  const hud = session.hud;

  function formatShortcuts(shortcuts: readonly string[]): string {
    return shortcuts.map((shortcut) => shortcut.toUpperCase()).join("/");
  }

  function formatMobileSelectionBody(body: string): string {
    return body.split(" · ")[0] ?? body;
  }

  function formatMobileSelectionTitle(title: string): string {
    return title.replace(" Tower · Level ", " - ");
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
    if (profile.ui.dragOnlyTowerPlacement) {
      return;
    }

    session.toggleTowerPlacement(event.currentTarget.value as TowerKind);
  }

  function handleTowerButtonPointerDown(
    event: PointerEvent & { currentTarget: EventTarget & HTMLButtonElement },
  ): void {
    session.handleTowerButtonPointerDown(event.currentTarget.value as TowerKind, event);
  }
</script>

<section class="controls-grid">
  <div class="tower-strip-card">
    <div class="tower-strip">
      {#each TOWER_TOOLBAR_PREVIEWS as tower (tower.kind)}
        {@const towerClass = tower.towerClass}
        {@const shortcutText = formatShortcuts(towerClass.shortcuts)}
        {@const canAffordTower = $hud.affordableTowers[tower.kind]}
        <button
          class={`tower-button${$hud.placingTower === tower.kind ? " active" : ""}${canAffordTower ? "" : " unaffordable"}`}
          type="button"
          value={tower.kind}
          title={`${towerClass.label} tower: ${canAffordTower ? towerClass.summary : `need ${formatMoney(towerClass.baseCost)}`}`}
          aria-label={`${towerClass.label} tower for ${formatMoney(towerClass.baseCost)}. ${canAffordTower ? towerClass.summary : "Not enough money yet."} Shortcuts ${shortcutText}.`}
          disabled={$hud.towerButtonsDisabled}
          onclick={handleTowerButtonClick}
          onpointerdown={handleTowerButtonPointerDown}
        >
          <div class="tower-button-meta">
            <span>{formatMoney(towerClass.baseCost)}</span>
            {#if profile.ui.showShortcutLabels}
              <span class="shortcut-chip">{shortcutText}</span>
            {/if}
          </div>
          <canvas use:towerIcon={tower} class="tower-icon" aria-hidden="true"></canvas>
        </button>
      {/each}
    </div>
  </div>

  <div class="control-card selection-card">
    <div class="selection-header">
      <div class="selection-copy">
        {#if $hud.selectionTitle}
          <strong>{profile.mode === "mobile" ? formatMobileSelectionTitle($hud.selectionTitle) : $hud.selectionTitle}</strong>
        {/if}
        <span>{profile.mode === "mobile" && $hud.hasSelectedTower ? formatMobileSelectionBody($hud.selectionBody) : $hud.selectionBody}</span>
      </div>
      {#if $hud.hasSelectedTower && profile.mode !== "mobile"}
        <button
          class="action-button sell selection-sell-button"
          type="button"
          aria-label="Sell"
          title="Sell"
          onclick={session.sellSelectedTower}
          disabled={$hud.sellDisabled}
        >
          <span aria-hidden="true">💰</span>
        </button>
      {/if}
    </div>
    {#if profile.mode === "mobile" && ($hud.hasSelectedTower || $hud.placingTower)}
      <div class="mobile-selection-actions">
        {#if $hud.hasSelectedTower}
          {#if $hud.hasLaserLockAction}
            <button
              class="action-button"
              type="button"
              aria-label={$hud.laserLocked ? "Unlock" : "Lock"}
              title={$hud.laserLocked ? "Unlock" : "Lock"}
              onclick={session.toggleSelectedLaserLock}
              disabled={$hud.laserLockDisabled}
            >
              <span aria-hidden="true">{$hud.laserLocked ? "🔓" : "🔒"}</span>
            </button>
          {:else}
            <span class="action-button action-placeholder" aria-hidden="true"></span>
          {/if}
          <button
            class="action-button"
            type="button"
            aria-label="Upgrade"
            title="Upgrade"
            onclick={session.upgradeSelectedTower}
            disabled={$hud.upgradeDisabled}
          >
            <span aria-hidden="true">▲</span>
          </button>
          <button
            class="action-button sell"
            type="button"
            aria-label="Sell"
            title="Sell"
            onclick={session.sellSelectedTower}
            disabled={$hud.sellDisabled}
          >
            <span aria-hidden="true">💰</span>
          </button>
        {:else if $hud.placingTower}
          <button
            class="action-button"
            type="button"
            onclick={session.cancelBuild}
            disabled={$hud.cancelBuildDisabled}
          >
            Cancel
          </button>
        {/if}
      </div>
    {/if}
  </div>
</section>
