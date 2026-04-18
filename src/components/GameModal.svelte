<script lang="ts">
  import { getGameSessionContext } from "../game-context";

  const session = getGameSessionContext();
  const { modal } = session;
</script>

{#if $modal}
  <div class="modal">
    <div class="modal-panel">
      <h2>{$modal.title}</h2>
      <p>{$modal.description}</p>

      {#if $modal.actions.length > 0}
        <div class={`selection-actions ${$modal.actionClassName ?? ""}`.trim()}>
          {#each $modal.actions as item}
            <button class="modal-button" type="button" onclick={() => session.handleModalAction(item.action)}>
              {item.label}
            </button>
          {/each}
        </div>
      {/if}

      {#if $modal.levelCards}
        <div class="level-grid">
          {#each $modal.levelCards as item}
            <button
              class={`level-card${item.unlocked ? "" : " locked"}${item.cleared ? " cleared" : ""}${item.current ? " current" : ""}`}
              type="button"
              disabled={!item.unlocked}
              onclick={() => session.selectLevel(item.index)}
            >
              <span class="level-pill">{item.status}</span>
              <strong>Level {item.level.levelNumber ?? "?"}: {item.level.name}</strong>
              <span>{item.level.subtitle ?? "Hold the route."}</span>
              <small>{item.level.waves?.length ?? 1} waves · {item.level.monsterCount} enemies · {item.level.allowEscape} leaks</small>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
