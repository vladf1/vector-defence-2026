# Gameplay notes for making Vector Defence more replayable

## High-impact next changes

1. Add persistent campaign progress.
   - Store `highestUnlockedLevelIndex` and `campaignCleared` in `localStorage`.
   - Add a small reset-progress action from the campaign map.

2. Add 1-3 stars per level.
   - 3 stars: no leaks.
   - 2 stars: survived with at least half of escape allowance.
   - 1 star: cleared.
   - This gives free players a reason to replay without adding monetization.

3. Make the first two levels teach one idea each.
   - Level 1: cheap gun + upgrade.
   - Level 2: laser/slow synergy.
   - Use small banner hints only before the wave starts so the game does not feel interrupted.

4. Add wave previews.
   - Show the next wave's dominant enemy types during build time.
   - Let players decide whether to buy splash, slow, or single-target upgrades.

5. Add tower synergy bonuses.
   - Slow tower marks enemies so laser does +10% damage.
   - Lightning chains farther through slowed enemies.
   - Missile splash briefly exposes bulwarks.
   - These make the tower set feel like a system instead of five independent buttons.

6. Add optional challenge modifiers after campaign clear.
   - Fast lanes, low budget, one-tower-type ban, double runners, no leaks.
   - Keep this free and lightweight: one daily seed is enough.

7. Add a score/leaderboard-ready summary.
   - Time, leaks, money spent, sell losses, waves skipped, stars.
   - Even without an online leaderboard, this improves the end-of-level payoff.

8. Improve level personality.
   - Keep the Pacific Northwest city names, but make each route correspond to a tactical idea:
     Bellevue = warm-up S route, Seattle = loop, Tacoma = kill box, Redmond = diagonals, Vortex = finale spiral.

## Balance risks to watch

- If early levels feel too easy, reduce `allowEscape` before increasing enemy count.
- If late levels feel grindy, shorten route length or spawn intervals rather than adding more enemies.
- If players ignore expensive towers, add enemy types or wave previews that clearly reward them.
- If mobile feels cramped, reduce route crossings first; do not shrink tower hit areas.
