<script lang="ts">
  import { getGameSessionContext } from "../game-context";

  const session = getGameSessionContext();
  const { modal } = session;

  function trimFinalPeriod(text: string): string {
    return text.endsWith(".") ? text.slice(0, -1) : text;
  }
</script>

{#if $modal}
  <div class={`modal${$modal.centered ? " centered" : ""}${$modal.completion ? " completion" : ""}`}>
    <div class={`modal-panel${$modal.centered ? " centered" : ""}${$modal.completion ? " completion-sheet" : ""}${$modal.levelCards ? " level-map-panel" : ""}`}>
      {#if !$modal.levelCards}
        <h2>{$modal.title}</h2>
        <p>{trimFinalPeriod($modal.description)}</p>

        {#if $modal.actions.length > 0}
          <div class={`selection-actions ${$modal.actionClassName ?? ""}`.trim()}>
            {#each $modal.actions as item}
              <button class={`modal-button modal-action-${item.action}`} type="button" onclick={() => session.handleModalAction(item.action)}>
                {item.label}
              </button>
            {/each}
          </div>
        {/if}
      {/if}

      {#if $modal.levelCards}
        <div class="level-map-header">
          <h2>{$modal.title}</h2>
        </div>
        <div class="level-grid">
          {#each $modal.levelCards as item}
            <button
              class={`level-card${item.unlocked ? "" : " locked"}${item.cleared ? " cleared" : ""}${item.current ? " current" : ""}`}
              type="button"
              disabled={!item.unlocked}
              onclick={() => session.selectLevel(item.index)}
            >
              <div class="level-card-heading">
                <strong>{item.level.levelNumber ?? "?"} - {item.level.name}</strong>
                <span class="level-pill">{item.status}</span>
              </div>
              <span>{trimFinalPeriod(item.level.subtitle ?? "Hold the route.")}</span>
              <small>{item.level.waves?.length ?? 1} waves · {item.level.monsterCount} enemies</small>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
