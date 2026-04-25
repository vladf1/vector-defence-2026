<script lang="ts">
  import { onMount } from "svelte";
  import { getGameSessionContext } from "../game-context";
  import GameModal from "./GameModal.svelte";

  const session = getGameSessionContext();
  let backgroundCanvas: HTMLCanvasElement;
  let gameCanvas: HTMLCanvasElement;

  onMount(() => {
    session.mount(backgroundCanvas, gameCanvas);

    return () => {
      session.destroy();
    };
  });
</script>

<svelte:window onkeydown={session.handleKeyDown} onresize={session.handleResize} />

<section class="board-card">
  <div class="board-frame">
    <div class="board-stage">
      <canvas
        bind:this={backgroundCanvas}
        class="board-canvas board-background"
        width="700"
        height="450"
        aria-hidden="true"
      ></canvas>
      <canvas
        bind:this={gameCanvas}
        class="board-canvas board-game"
        id="game"
        width="700"
        height="450"
        onmousemove={session.handleCanvasMove}
        onmouseleave={session.handleCanvasLeave}
        onmousedown={session.handleCanvasDown}
      ></canvas>
    </div>
    <GameModal />
  </div>
</section>
