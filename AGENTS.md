# Agents

Active browser implementation lives in this repo root.

Key paths:

- Browser app entry: `src/main.ts`
- Root Svelte component: `src/App.svelte`
- Svelte components: `src/components/`
- Svelte session context: `src/game-context.ts`
- Svelte/game bridge: `src/game-session.ts`
- Browser HUD/modal view-models: `src/game-view.ts`
- Browser simulation engine: `src/game-engine.ts`
- Browser renderer/canvas orchestration: `src/game-renderer.ts`
- Browser gameplay entities: `src/entities/`
- Tower metadata/shortcuts/previews: `src/entities/towers/tower-registry.ts`
- Browser campaign builder: `src/campaign.ts`
- Procedural route generator used by campaign seeding: `src/level-generator.ts`
- Shared browser types: `src/types.ts`
- Shared browser constants: `src/constants.ts`
- Shared browser utilities: `src/utils.ts`
- Browser styles: `src/style.css`
- Browser package/scripts: `package.json`
- Browser level data: `game-levels.json`

Repository notes:

- The project root is the active browser app repo.
- The browser app in `src/` is the active implementation.
- The browser app is a Svelte 5 + Vite app. Avoid reintroducing hand-built DOM/UI glue when a small Svelte component or view model is the cleaner boundary.
- `window.__vectorDefence` is intentionally populated by `src/game-session.ts` for browser/dev smoke checks.

Current code structure:

- `src/main.ts` owns Svelte app bootstrapping.
- `src/App.svelte` wires the main shell and creates the shared game session context.
- `src/components/ChromeBar.svelte`, `src/components/GameBoard.svelte`, `src/components/GameModal.svelte`, and `src/components/TowerPanel.svelte` own the declarative UI around the canvas.
- `src/game-context.ts` owns the Svelte context helpers for the shared `GameSession`.
- `src/game-session.ts` bridges Svelte stores/events to the imperative game runtime, handles keyboard/pointer input, and publishes HUD/modal snapshots.
- `src/game-engine.ts` owns gameplay state, campaign progression, placement rules, and simulation.
- `src/game-renderer.ts` owns canvas sizing, background caching, board rendering, placement previews, and orchestration of entity drawing.
- `src/game-view.ts` owns HUD/modal view-model generation for Svelte.
- `src/entities/` owns active gameplay entities split by concern: towers, monsters, projectiles, effects, and entity-local game access.
- `src/entities/monsters/monster.ts` owns shared monster movement, damage, slow recovery, lifecycle event emission, and health-bar rendering.
- Concrete monster classes live under `src/entities/monsters/` and own monster-specific base stats, body rendering, and special behavior (`berserker` ramps speed as it loses health; `bulwark` mitigates incoming damage).
- Projectile classes live under `src/entities/projectiles/`; import the concrete `projectile.ts` or `missile.ts` file directly.
- Effect classes live under `src/entities/effects/`; import the concrete `particle.ts` or `link-effect.ts` file directly.
- Tower classes live under `src/entities/towers/`; `Tower` in `tower.ts` owns shared targeting/upgrade/selection behavior.
- `src/entities/towers/tower-registry.ts` is the source of truth for tower class lookup, keyboard shortcuts, and tower preview instances used by the Svelte toolbar.
- `src/entities/game-access.ts` contains the entity-local `GameAccess` interface used by towers and projectiles.
- `src/campaign.ts` turns the base route list plus four procedural routes into the 10-level campaign used by the browser game.
- `src/level-generator.ts` creates the procedural route seeds consumed by `src/campaign.ts`; there is no separate random-route menu path anymore.
- `src/types.ts` is the source of truth for shared browser types such as `TowerKind`, `MonsterKind`, `GameState`, `Point`, `LevelData`, `WaveData`, and `HudSnapshot`.
- `src/constants.ts` and `src/utils.ts` are shared by the active runtime, so prefer reusing those helpers instead of re-declaring gameplay constants or math utilities.
- `src/entities.ts`, `src/entities/monsters.ts`, `src/entities/projectiles.ts`, and `src/entities/effects.ts` have been removed; do not recreate monolithic entity files or barrel files unless there is a clear payoff.

Data / naming conventions:

- Monster identifiers in `game-levels.json` use the readable string values from `MonsterKind`, not one-letter codes:
  - `ball`
  - `square`
  - `triangle`
  - `tank`
  - `runner`
  - `splitter`
  - `berserker`
  - `bulwark`
- `GameState`, `MonsterKind`, and `TowerKind` are `as const` value objects with derived union types in `src/types.ts`, not TypeScript enums.
- Keep `game-levels.json` monster identifiers as plain strings. `src/utils.ts` normalizes them to `MonsterKind` values at runtime.
- `game-levels.json` provides the handcrafted base routes. The actual playable campaign data is generated at runtime by `createCampaignLevels(...)`, which expands those routes into per-wave monster sequences and build windows.
- Monster constructors pass private named constants to `Monster` with `super(path, COLOR, SPEED, HIT_POINTS, BOUNTY, RADIUS)`.
- Monster constructor stats use `hitPoints`, not `hp`.
- `hitPoints` is current monster health. `maxHitPoints` is the full-health denominator used by the health bar.
- Monster constructors take the concrete `Point[]` path they should follow, not `LevelData`.
- For unusual spawn positions, build a new path array that starts at the custom spawn point and continues through the remaining route.
- Monsters expose lifecycle event handlers such as `onKilled` and `onEscaped`; wire those handlers in `Game.createMonster(...)`.
- Concrete monster classes should not import `GameAccess` or call game orchestration methods directly.
- Monster instances do not carry `MonsterKind`; use `MonsterKind` for level/campaign data and `instanceof` for runtime class-specific behavior.
- Towers use `TowerKind` values as keys into `TOWER_SPECS`; keep tower identifiers readable strings.

Gameplay / UI notes:

- The campaign is a fixed 10-level progression with unlocks stored in memory for the current session.
- Initial build time is campaign-driven, not a fixed global delay: early levels start around 10 seconds and later ones reach 14 seconds.
- Intermission build windows between later waves are shorter and are generated per wave in `src/campaign.ts` (roughly 2.5 to 5.5 seconds).
- Level 1 introduces `splitter` monsters in later waves. Splitters burst into weakened runner children when killed.
- Later campaign waves and procedural routes also introduce `bulwark` and `berserker` monsters; do not assume the handcrafted `game-levels.json` sequences cover the full runtime enemy roster.
- Monster spawning and lifecycle event wiring are centralized in `Game.createMonster(...)`; tower creation is centralized in `Game.createTower(...)`.
- Combat callers should iterate `game.activeMonsters` instead of `game.monsters` when they only want non-removed monsters.
- Monster classes should own their own body rendering. Shared monster rendering concerns belong in `Monster`.
- Tower classes should own their own drawing and attack behavior. Shared tower rendering/selection concerns belong in `Tower`.
- Svelte components should consume `HudSnapshot` and `ModalView` data rather than reaching into the `Game` object directly.
- The HUD selection card supports upgrade, sell, and cancel-build actions; keep those interactions flowing through `GameSession` and the HUD snapshot rather than binding components directly to `Game`.
- Keyboard shortcuts:
  - `1` / `G` = Gun tower
  - `2` / `L` = Laser tower
  - `3` / `M` = Missile tower
  - `4` / `S` = Slow tower
  - `U` = Upgrade selected tower
  - `Esc` = Cancel build mode
  - `Space` = Pause / resume
- Keyboard shortcut lookup lives in `findTowerShortcut(...)` in `src/entities/towers/tower-registry.ts`; add new bindings there instead of open-coding them in `src/game-session.ts`.
- The campaign modal doubles as the map screen, win/loss screen, and resume flow.

To run the browser version:

- `npm run dev`

Useful validation commands:

- `npm run build`
- `npm run build:single`
- `npm run dev`

Maintenance preferences:

- Prefer named imports from `src/constants.ts` and `src/types.ts` so call sites show their dependencies clearly.
- Keep Svelte UI declarative and thin; put formatting and modal/HUD derivation in `src/game-view.ts`.
- Keep imperative simulation logic in `src/game-engine.ts` or entity classes, not in Svelte components.
- When adding monsters, add a `MonsterKind` value, a concrete monster class, a `Game.createMonster(...)` branch, and campaign/level-generator usage as needed.
- When adding towers, add a `TowerKind` value, `TOWER_SPECS` entry, tower class, shortcut entry, and `Game.createTower(...)` branch.
