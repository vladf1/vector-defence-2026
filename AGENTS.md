# Agents

Active browser implementation lives in this repo root.

Key paths:

- Browser app entry: `src/main.ts`
- Shared browser types: `src/types.ts`
- Browser styles: `src/style.css`
- Browser package/scripts: `package.json`
- Browser level data: `Levels.json`

Repository notes:

- The project root is the active browser app repo.

Current code structure:

- The game currently runs from `src/main.ts`.
- `src/types.ts` is the source of truth for shared browser types such as `TowerKind`, `MonsterCode`, `GameState`, `Point`, `LevelData`, and `HudSnapshot`.
- `src/constants.ts`, `src/entities.ts`, and `src/utils.ts` exist as split-out groundwork, but the active runtime logic is still primarily in `src/main.ts`.
- If continuing the file-splitting refactor, prefer importing from `src/types.ts` rather than re-declaring types in new files.

Data / naming conventions:

- Monster identifiers in the browser code and `Levels.json` use readable strings, not one-letter codes:
  - `ball`
  - `square`
  - `triangle`
- `TowerKind` is a string enum in `src/types.ts`.
- `GameState` is currently a string union type in `src/types.ts`.

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

- `npm run dev`

Useful validation commands:

- `npm run build`
- `npm run dev`
