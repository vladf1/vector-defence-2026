# Agents

Active browser implementation lives in this repo root.

Key paths:

- Browser app entry: `src/main.ts`
- Browser gameplay entities: `src/entities/`
- Browser campaign builder: `src/campaign.ts`
- Procedural route generator used by campaign seeding: `src/level-generator.ts`
- Shared browser types: `src/types.ts`
- Shared browser constants: `src/constants.ts`
- Shared browser utilities: `src/utils.ts`
- Browser styles: `src/style.css`
- Browser package/scripts: `package.json`
- Browser level data: `Levels.json`

Repository notes:

- The project root is the active browser app repo.
- Legacy Silverlight source still exists in the repo, but the browser app in `src/` is the active implementation.

Current code structure:

- `src/main.ts` owns Svelte app bootstrapping.
- `src/game-session.ts` bridges Svelte state/events to the imperative game runtime.
- `src/game-engine.ts` owns gameplay state, campaign progression, placement rules, and simulation.
- `src/game-renderer.ts` owns canvas sizing, background caching, previews, and drawing.
- `src/game-view.ts` owns HUD/modal view-model generation for Svelte.
- `src/entities/` owns active gameplay entities split by concern: towers, monsters, projectiles, effects, and entity-local types.
- `src/campaign.ts` turns the base route list plus four procedural routes into the 10-level campaign used by the browser game.
- `src/level-generator.ts` creates the procedural route seeds consumed by `src/campaign.ts`; there is no separate random-route menu path anymore.
- `src/types.ts` is the source of truth for shared browser types such as `TowerKind`, `MonsterCode`, `GameState`, `Point`, `LevelData`, `WaveData`, and `HudSnapshot`.
- `src/constants.ts` and `src/utils.ts` are shared by the active runtime, so prefer reusing those helpers instead of re-declaring gameplay constants or math utilities.

Data / naming conventions:

- Monster identifiers in the browser code and `Levels.json` use readable strings, not one-letter codes:
  - `ball`
  - `square`
  - `triangle`
  - `tank`
  - `runner`
- `TowerKind` is a string enum in `src/types.ts`.
- `GameState` is currently a string union type in `src/types.ts`.
- `Levels.json` provides the handcrafted base routes. The actual playable campaign data is generated at runtime by `createCampaignLevels(...)`.

Gameplay / UI notes:

- The campaign is a fixed 10-level progression with unlocks stored in memory for the current session.
- Initial build time is campaign-driven, not a fixed global delay: early levels start around 10 seconds and later ones reach 14 seconds.
- Intermission build windows between later waves are shorter and are generated per wave in `src/campaign.ts` (roughly 2.5 to 5.5 seconds).
- Keyboard shortcuts:
  - `1` / `G` = Gun tower
  - `2` / `L` = Laser tower
  - `3` / `M` = Missile tower
  - `4` / `S` = Slow tower
  - `U` = Upgrade selected tower
  - `Esc` = Cancel build mode
  - `Space` = Pause / resume
- The campaign modal doubles as the map screen, win/loss screen, and resume flow.

To run the browser version:

- `npm run dev`

Useful validation commands:

- `npm run build`
- `npm run build:single`
- `npm run dev`
