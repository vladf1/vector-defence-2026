<script lang="ts">
  import { onMount } from "svelte";
  import { FIELD_ASPECT_RATIO, FIELD_ASPECT_SCALE, FIELD_HEIGHT, FIELD_WIDTH } from "../constants";
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
    <div
      class="board-stage"
      style={`--field-aspect-ratio: ${FIELD_ASPECT_RATIO}; --field-aspect-scale: ${FIELD_ASPECT_SCALE};`}
    >
      <canvas
        bind:this={backgroundCanvas}
        class="board-canvas board-background"
        width={FIELD_WIDTH}
        height={FIELD_HEIGHT}
        aria-hidden="true"
      ></canvas>
      <canvas
        bind:this={gameCanvas}
        class="board-canvas board-game"
        id="game"
        width={FIELD_WIDTH}
        height={FIELD_HEIGHT}
        onpointermove={session.handleCanvasMove}
        onpointerleave={session.handleCanvasLeave}
        onpointerdown={session.handleCanvasDown}
      ></canvas>
    </div>
    <GameModal />
  </div>
</section>
