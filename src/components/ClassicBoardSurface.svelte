<script lang="ts">
  import { onMount } from "svelte";
  import { getGameSessionContext } from "../game-context";
  import { ViewMode } from "../view-mode";

  const session = getGameSessionContext();
  const profile = session.profile;
  let backgroundCanvas: HTMLCanvasElement;
  let gameCanvas: HTMLCanvasElement;

  onMount(() => {
    session.mount({ mode: ViewMode.Classic, background: backgroundCanvas, canvas: gameCanvas });

    return () => {
      session.unmount();
    };
  });
</script>

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
