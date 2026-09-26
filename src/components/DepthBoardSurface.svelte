<script lang="ts">
  import { onMount } from "svelte";
  import { getGameSessionContext } from "../game-context";
  import { RendererStatus, ViewMode, shouldShowStartupTimings } from "../view-mode";

  const session = getGameSessionContext();
  const rendererStatus = session.rendererStatus;
  const startupTimings = session.startupTimings;
  const showTimings = shouldShowStartupTimings(window);
  let sceneCanvas: HTMLCanvasElement;
  let overlayCanvas: HTMLCanvasElement;

  onMount(() => {
    session.mount({ mode: ViewMode.Depth, canvas: sceneCanvas, overlay: overlayCanvas });

    return () => {
      session.unmount();
    };
  });
</script>

<canvas bind:this={sceneCanvas} class="board-canvas board-background board-depth" aria-hidden="true"></canvas>
<canvas
  bind:this={overlayCanvas}
  class="board-canvas board-game board-depth-overlay"
  id="game"
  onpointermove={session.handleCanvasMove}
  onpointerleave={session.handleCanvasLeave}
  onpointerdown={session.handleCanvasDown}
></canvas>
{#if showTimings && $startupTimings}
  <dl class="board-timings">
    {#each Object.entries($startupTimings) as [phase, value] (phase)}
      <dt>{phase}</dt>
      <dd>{Math.round(value)}</dd>
    {/each}
  </dl>
{/if}
{#if $rendererStatus === RendererStatus.Loading}
  <div class="board-loading" role="status" aria-live="polite">
    <span class="board-loading-spinner" aria-hidden="true"></span>
    <span>Building 3D battlefield</span>
  </div>
{/if}
