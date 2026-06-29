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

  function formatMobileSelectionTitle(title: string): string {
    const [towerName] = title.split(" · Level ");
    return towerName;
  }

  function formatMobileActionValue(label: string): string {
    const [, actionValue] = label.split(" - ");
    return actionValue ?? label;
  }

  function drawTowerPreview(canvas: HTMLCanvasElement, tower: Tower): void {
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
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

<section class:selected-tower-controls={profile.mode === "mobile" && $hud.hasSelectedTower} class="controls-grid">
  <div class="tower-strip-card">
    <div class="tower-strip">
      {#each TOWER_TOOLBAR_PREVIEWS as tower (tower.kind)}
        {#if $hud.availableTowers.includes(tower.kind)}
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
        {/if}
      {/each}
    </div>
  </div>

  {#if profile.mode === "mobile" && !$hud.hasSelectedTower && !$hud.placingTower}
    <div
      class:disabled-selection-panel={$hud.towerButtonsDisabled}
      class:tower-border-panel={$hud.towerButtonsDisabled}
      class="control-card selection-card idle-selection-card"
      aria-disabled={$hud.towerButtonsDisabled}
    >
      <div class="selection-header">
        <div class="selection-copy">
          <strong>Build towers</strong>
          <span>Tap a tower to inspect</span>
        </div>
      </div>
    </div>
  {:else if profile.mode !== "mobile" || $hud.hasSelectedTower || $hud.placingTower}
    <div
      class:disabled-selection-panel={$hud.towerButtonsDisabled}
      class:tower-border-panel={$hud.towerButtonsDisabled || (!$hud.hasSelectedTower && !$hud.placingTower)}
      class="control-card selection-card"
      aria-disabled={$hud.towerButtonsDisabled}
    >
      <div class="selection-header">
        <div class="selection-copy">
          {#if profile.mode === "mobile" && ($hud.hasSelectedTower || $hud.placingTower)}
            <strong>{formatMobileSelectionTitle($hud.selectionTitle)}</strong>
            {#if $hud.mobileSelectionBody}
              <span>{$hud.mobileSelectionBody}</span>
            {/if}
          {:else}
            {#if $hud.selectionTitle}
              <strong>{profile.mode === "mobile" ? formatMobileSelectionTitle($hud.selectionTitle) : $hud.selectionTitle}</strong>
            {/if}
            {#if $hud.selectionBody}
              <span>{$hud.selectionBody}</span>
            {/if}
          {/if}
        </div>
        {#if $hud.placingTower && !$hud.hasSelectedTower}
          <button
            class="action-button cancel-build-button"
            type="button"
            aria-label="Cancel build"
            title="Cancel build"
            onclick={session.cancelBuild}
            disabled={$hud.cancelBuildDisabled}
          >
            <span aria-hidden="true">×</span>
          </button>
        {/if}
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
      {#if profile.mode === "mobile" && $hud.hasSelectedTower}
        <div
          class:laser-actions={$hud.hasLaserLockAction}
          class="mobile-selection-actions"
          role="group"
          aria-label="Selected tower actions"
        >
          <button
            class={`action-button${$hud.upgradeUnaffordable ? " unaffordable" : ""}`}
            type="button"
            aria-label={$hud.upgradeActionLabel}
            title={$hud.upgradeActionLabel}
            onclick={session.upgradeSelectedTower}
            disabled={$hud.upgradeDisabled}
          >
            <span aria-hidden="true">▲</span>
            <span class="mobile-action-value">{formatMobileActionValue($hud.upgradeActionLabel)}</span>
          </button>
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
              <span class="mobile-action-value">{$hud.laserLocked ? "Unlock" : "Lock"}</span>
            </button>
          {/if}
          <button
            class="action-button sell"
            type="button"
            aria-label={$hud.sellActionLabel}
            title={$hud.sellActionLabel}
            onclick={session.sellSelectedTower}
            disabled={$hud.sellDisabled}
          >
            <span aria-hidden="true">💰</span>
            <span class="mobile-action-value">{formatMobileActionValue($hud.sellActionLabel)}</span>
          </button>
        </div>
      {/if}
    </div>
  {/if}
</section>
