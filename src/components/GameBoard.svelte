<script lang="ts">
  import { onMount } from "svelte";
  import { getGameSessionContext } from "../game-context";
  import GameModal from "./GameModal.svelte";

  const session = getGameSessionContext();
  const profile = session.profile;
  const hud = session.hud;
  let backgroundCanvas: HTMLCanvasElement;
  let gameCanvas: HTMLCanvasElement;

  onMount(() => {
    session.mount(backgroundCanvas, gameCanvas);

    return () => {
      session.destroy();
    };
  });

  function handleSkipBreak(event: MouseEvent): void {
    event.stopPropagation();
    session.skipBreak();
  }
</script>

<svelte:window onkeydown={session.handleKeyDown} />

<section class="board-card">
  <div class="board-frame">
    <div
      class="board-stage"
      style={`--field-aspect-ratio: ${profile.fieldAspectRatio}; --field-aspect-scale: ${profile.fieldAspectScale};`}
    >
      <canvas
        bind:this={backgroundCanvas}
        class="board-canvas board-background"
        width={profile.fieldWidth}
        height={profile.fieldHeight}
        aria-hidden="true"
      ></canvas>
      <canvas
        bind:this={gameCanvas}
        class="board-canvas board-game"
        id="game"
        width={profile.fieldWidth}
        height={profile.fieldHeight}
        onpointermove={session.handleCanvasMove}
        onpointerleave={session.handleCanvasLeave}
        onpointerdown={session.handleCanvasDown}
      ></canvas>
      {#if $hud.banner}
        {#if $hud.canSkipBreak}
          <button
            type="button"
            class="board-banner skippable"
            aria-label="Start the next wave now"
            onclick={handleSkipBreak}
          >
            <span class="board-banner-text">{$hud.banner}</span>
            <span class="board-banner-action" aria-hidden="true">SKIP »</span>
          </button>
        {:else}
          <div class="board-banner" role="status" aria-live="polite">
            <span class="board-banner-text">{$hud.banner}</span>
          </div>
        {/if}
      {/if}
    </div>
    <GameModal />
  </div>
</section>
