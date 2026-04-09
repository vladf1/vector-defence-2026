# Agents

Active browser implementation lives in `browser/`.

Key paths:

- Browser app entry: `browser/src/main.ts`
- Shared browser types: `browser/src/types.ts`
- Browser styles: `browser/src/style.css`
- Browser package/scripts: `browser/package.json`
- Browser level data: `browser/Levels.json`

Repository notes:

- `browser/` is its own standalone Git repo.
- The project root is not the active web app repo; when making browser commits, run Git commands inside `browser/`.

Current code structure:

- The game currently runs from `browser/src/main.ts`.
- `browser/src/types.ts` is the source of truth for shared browser types such as `TowerKind`, `MonsterCode`, `GameState`, `Point`, `LevelData`, and `HudSnapshot`.
- `browser/src/constants.ts`, `browser/src/entities.ts`, and `browser/src/utils.ts` exist as split-out groundwork, but the active runtime logic is still primarily in `browser/src/main.ts`.
- If continuing the file-splitting refactor, prefer importing from `browser/src/types.ts` rather than re-declaring types in new files.

Data / naming conventions:

- Monster identifiers in the browser code and `browser/Levels.json` use readable strings, not one-letter codes:
  - `ball`
  - `square`
  - `triangle`
- `TowerKind` is a string enum in `browser/src/types.ts`.
- `GameState` is currently a string union type in `browser/src/types.ts`.

Gameplay / UI notes:

- There is a 5-second build phase before monsters start spawning.
- Keyboard shortcuts:
  - `1` / `G` = Gun tower
  - `2` / `L` = Laser tower
  - `3` / `M` = Missile tower
  - `4` / `S` = Slow tower
  - `U` = Upgrade selected tower
  - `Esc` = Cancel build mode
  - `Space` = Pause / resume

Legacy Silverlight source remains at the project root and in `VectorDefenceSL/`.

To run the browser version:

- `cd browser`
- `npm run dev`

Useful validation commands:

- `cd browser && npm run build`
- `cd browser && npm run dev`
