<script lang="ts">
  import { onMount } from "svelte";
  import { getGameSessionContext } from "../game-context";
  import GameModal from "./GameModal.svelte";

  const session = getGameSessionContext();
  const { hud } = session;

  let canvas: HTMLCanvasElement;

  onMount(() => {
    session.mount(canvas);

    return () => {
      session.destroy();
    };
  });
</script>

<svelte:window on:keydown={session.handleKeyDown} on:resize={session.handleResize} />

<section class="board-card">
  <div class="board-frame">
    <canvas
      bind:this={canvas}
      id="game"
      width="700"
      height="450"
      on:mousemove={session.handleCanvasMove}
      on:mouseleave={session.handleCanvasLeave}
      on:mousedown={session.handleCanvasDown}
    ></canvas>
    <div class="banner">
      <div class="banner-chip">{$hud.banner}</div>
    </div>
    <GameModal />
  </div>
</section>
