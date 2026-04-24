<script lang="ts">
  import { onMount } from "svelte";
  import { FIELD_HEIGHT, FIELD_WIDTH } from "../constants";
  import { getGameSessionContext } from "../game-context";
  import GameModal from "./GameModal.svelte";

  const session = getGameSessionContext();
  const { hud } = session;

  let canvas: HTMLCanvasElement;

  function selectedTowerActionStyle(x: number, y: number): string {
    const leftPercent = (x / FIELD_WIDTH) * 100;
    const topPercent = (y / FIELD_HEIGHT) * 100;
    const placeAbove = y > FIELD_HEIGHT - 56;
    const top = placeAbove
      ? `calc(${topPercent}% - 20px)`
      : `calc(${topPercent}% + 28px)`;
    const translateY = placeAbove ? "-100%" : "0";

    return `left: clamp(42px, ${leftPercent}%, calc(100% - 42px)); top: ${top}; transform: translate(-50%, ${translateY});`;
  }

  onMount(() => {
    session.mount(canvas);

    return () => {
      session.destroy();
    };
  });
</script>

<svelte:window onkeydown={session.handleKeyDown} onresize={session.handleResize} onmouseup={session.handleCanvasUp} />

<section class="board-card">
  <div class="board-frame">
    <div class="board-stage">
      <canvas
        bind:this={canvas}
        id="game"
        width="700"
        height="450"
        onmousemove={session.handleCanvasMove}
        onmouseleave={session.handleCanvasLeave}
        onmousedown={session.handleCanvasDown}
        onmouseup={session.handleCanvasUp}
        onwheel={session.handleCanvasWheel}
        ondblclick={session.handleCanvasDoubleClick}
        oncontextmenu={session.handleCanvasContextMenu}
      ></canvas>
      {#if $hud.selectedTowerPoint}
        <div class="tower-actions-overlay" style={selectedTowerActionStyle($hud.selectedTowerPoint.x, $hud.selectedTowerPoint.y)}>
          <button
            class="tower-action-fab"
            type="button"
            title="Upgrade tower"
            aria-label="Upgrade tower"
            onclick={session.upgradeSelectedTower}
            disabled={$hud.upgradeDisabled}
          >
            <span class="tower-action-icon tower-action-icon-upgrade">▲</span>
          </button>
        </div>
      {/if}
    </div>
    <div class="banner">
      <div class="banner-chip">{$hud.banner}</div>
    </div>
    <GameModal />
  </div>
</section>
