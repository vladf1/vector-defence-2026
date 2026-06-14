<script lang="ts">
  import { getGameSessionContext } from "../game-context";

  const session = getGameSessionContext();
  const { modal } = session;
  const STAR_VALUES = [1, 2, 3];

  function trimFinalPeriod(text: string): string {
    return text.endsWith(".") ? text.slice(0, -1) : text;
  }

  function formatStarCount(stars: number): string {
    return `${stars} star${stars === 1 ? "" : "s"}`;
  }

  function awardTitle(stars: number): string {
    if (stars === 3) {
      return "Perfect route";
    }
    if (stars === 2) {
      return "Strong clear";
    }
    return "Route secured";
  }

  function awardCopy(stars: number, bestStars: number): string {
    if (bestStars > stars) {
      return `Best clear remains ${formatStarCount(bestStars)}.`;
    }
    if (stars === 3) {
      return "No leaks. Full control.";
    }
    if (stars === 2) {
      return "Cleared with escape room to spare.";
    }
    return "Replay for a cleaner defense.";
  }
</script>

{#if $modal}
  <div class={`modal${$modal.sheet ? " sheet" : ""}`}>
    <div class={`modal-panel${$modal.sheet ? " modal-sheet" : ""}${$modal.levelCards ? " level-map-panel" : ""}`}>
      {#if !$modal.levelCards}
        <h2>{$modal.title}</h2>
        <p>{trimFinalPeriod($modal.description)}</p>

        {#if $modal.starAward}
          <div
            class:perfect-award={$modal.starAward.perfect}
            class="star-award"
            aria-label={`${formatStarCount($modal.starAward.stars)} awarded`}
          >
            <div class="star-award-row" aria-hidden="true">
              {#each STAR_VALUES as star}
                <span class:earned={star <= $modal.starAward.stars}>★</span>
              {/each}
            </div>
            <strong>{awardTitle($modal.starAward.stars)}</strong>
            <span>{awardCopy($modal.starAward.stars, $modal.starAward.bestStars)}</span>
          </div>
        {/if}

        {#if $modal.actions.length > 0}
          <div class="selection-actions">
            {#each $modal.actions as item}
              <button class={`modal-button modal-action-${item.action}`} type="button" onclick={() => session.handleModalAction(item.action)}>
                {item.label}
              </button>
            {/each}
          </div>
        {/if}
      {:else}
        <div class="level-map-header">
          <div>
            <h2>{$modal.title}</h2>
            <p>{trimFinalPeriod($modal.description)}</p>
          </div>

          {#if $modal.actions.length > 0}
            <div class="selection-actions">
              {#each $modal.actions as item}
                <button class={`modal-button modal-action-${item.action}`} type="button" onclick={() => session.handleModalAction(item.action)}>
                  {item.label}
                </button>
              {/each}
            </div>
          {/if}
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
              {#if item.stars > 0}
                <span class="level-stars" aria-label={`${formatStarCount(item.stars)} best clear`}>
                  {#each STAR_VALUES as star}
                    <span class:earned={star <= item.stars} aria-hidden="true">★</span>
                  {/each}
                </span>
              {/if}
              <span>{trimFinalPeriod(item.level.subtitle ?? "Hold the route.")}</span>
              <small>{item.level.waves?.length ?? 1} waves · {item.level.monsterCount} enemies</small>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
