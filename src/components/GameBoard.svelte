<script lang="ts">
  import { onMount } from "svelte";
  import { getGameSessionContext } from "../game-context";
  import GameModal from "./GameModal.svelte";

  const session = getGameSessionContext();
  const profile = session.profile;
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
    </div>
    <GameModal />
  </div>
</section>
