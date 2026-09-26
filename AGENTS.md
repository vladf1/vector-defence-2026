# Agents

Active browser implementation lives in this repo root.

Key paths:

- Browser app entry: `src/main.ts`
- Root Svelte component: `src/App.svelte`
- Svelte components: `src/components/`
- Svelte session context: `src/game-context.ts`
- Svelte/game bridge: `src/game-session.ts`
- Desktop/mobile runtime profiles: `src/game-profile.ts`
- Frame backlog/substep policy: `src/simulation-timing.ts`
- Browser HUD/modal view-models: `src/game-view.ts`
- Browser banner text derivation: `src/game-view.ts`
- Browser simulation engine: `src/game-engine.ts`
- Browser level runtime state: `src/level-runtime.ts`
- Browser campaign progress persistence: `src/campaign-progress.ts`
- Browser route geometry/motion samples: `src/route-path.ts`
- Browser placement geometry/tower hit-testing: `src/placement-rules.ts`
- Browser renderer/canvas orchestration: `src/game-renderer.ts`
- Board renderer interface: `src/board-renderer.ts`
- 2D/3D view-mode preference: `src/view-mode.ts`
- 3D (WebGPU) board renderer: `src/render3d/`
- 3D board render sheet script: `scripts/render-3d-board.mjs`
- 3D renderer benchmark: `scripts/benchmark-3d-renderer.mjs`
- 3D startup profiler: `scripts/benchmark-3d-startup.mjs`
- Browser gameplay entities: `src/entities/`
- Browser gameplay engine helpers: `src/game-engine/`
- Browser audio orchestration: `src/game-audio.ts`
- Browser audio cue manifest: `src/audio-manifest.ts`
- Tower metadata/shortcuts/previews: `src/entities/towers/tower-registry.ts`
- Browser campaign builder: `src/campaign.ts`
- Shared browser types: `src/types.ts`
- Shared browser constants: `src/constants.ts`
- Shared browser utilities: `src/utils.ts`
- Browser styles: `src/style.css`
- Browser package/scripts: `package.json`
- Browser level data: `game-levels.json`
- Browser audio assets: `src/assets/audio/`
- Level render sheet script: `scripts/render-levels.mjs`
- Monster explosion render sheet script: `scripts/render-monster-explosions.mjs`
- Browser render/benchmark harness: `scripts/benchmark-browser-harness.mjs`
- Debug tools hub: `debug/index.html`
- Tower render table page: `debug/towers.html`
- Monster explosion testing page: `debug/explosions.html`
- Monster explosion testing script: `src/explosion-testing.ts`
- Escape explosion testing page: `debug/escape-explosion.html`
- Escape explosion testing script: `src/escape-explosion-testing.ts`
- Shared auxiliary-page animation loop: `src/visibility-animation-loop.ts`
- Audio soundboard: `debug/soundboard.html`

Repository notes:

- The project root is the active browser app repo.
- The browser app in `src/` is the active implementation.
- The browser app is a Svelte 5 + Vite app. Avoid reintroducing hand-built DOM/UI glue when a small Svelte component or view model is the cleaner boundary.

Current code structure:

- `src/main.ts` owns Svelte app bootstrapping, startup profile selection, and visual-viewport height synchronization.
- `src/App.svelte` wires the main shell and creates the shared game session context.
- `src/components/ChromeBar.svelte`, `src/components/GameBoard.svelte`, `src/components/GameModal.svelte`, `src/components/TowerPanel.svelte`, and `src/components/NerdStatsPanel.svelte` own the declarative UI around the canvas.
- `src/game-context.ts` owns the Svelte context helpers for the shared `GameSession`.
- `src/game-session.ts` bridges Svelte stores/events to the imperative game runtime, handles keyboard/pointer input, owns the animation-frame loop and bounded simulation backlog, and publishes HUD/modal snapshots. It mounts a `BoardSurface` (2D canvases or the 3D canvas + overlay), lazily imports the 3D renderer, holds the simulation while an async renderer loads, and falls back to 2D if 3D init fails or the GPU device is lost. In dev builds it exposes `window.__vectorDefence = { game, sync }` for render/benchmark scripts.
- `src/simulation-timing.ts` owns the bounded substep policy: native high-refresh deltas are preserved, slow frames are split into steps of at most 1/60 second, catch-up work is capped, and drawing still happens once per rendered frame.
- `src/game-profile.ts` owns desktop/mobile logical dimensions, movement/range scales, placement geometry, UI flags, and startup profile selection.
- `src/game-engine.ts` owns gameplay state, campaign progression, lifecycle resolution, and `updateSimulation(...)`; rendering is a separate once-per-frame `draw()` call.
- `src/level-runtime.ts` owns per-level mutable runtime collections such as monsters, towers, projectiles, particles, links, placement state, money, wave counters, and route path.
- `src/campaign-progress.ts` owns campaign unlock/star persistence through `localStorage`, with an in-memory fallback when browser storage is unavailable.
- `src/game-engine/update-context.ts` defines the per-update read model and the `UpdateResult` accumulator through which monsters, towers, projectiles, and drones report lifecycle outcomes, spawned entities, presentation effects, and sounds.
- `src/game-engine/collision-detection.ts` owns the active-monster swept-collision index plus its linear comparison implementation.
- `src/game-engine/monster-factory.ts` owns monster class lookup, level hit-point scaling, and splitter child creation through explicit speed-scale and level-index inputs; it does not depend on `Game`.
- `src/game-engine/combat-effects.ts` owns shared hit, laser, missile, and escape particle construction. Monster polygon breakup lives in `src/entities/monsters/death-effect-helpers.ts` and `src/entities/monsters/polygon-shard-splitter.ts`.
- `src/placement-rules.ts` owns tower placement geometry and board hit-testing through explicit route/tower inputs; it should not import `Game`.
- `src/route-path.ts` owns route drawing commands plus the sampled motion path entries used by monster movement.
- `src/board-renderer.ts` defines the `BoardRenderer` boundary `Game` talks to (resize, draw, visible bounds, canvas action hit tests, client-to-field picking, dispose) plus the `DetachedBoardRenderer` used while no board is mounted. `Game` owns no canvases; the session attaches a renderer with `game.setRenderer(...)`.
- `src/game-renderer.ts` is the classic 2D `BoardRenderer`: canvas sizing, background caching, board rendering, placement previews, and orchestration of entity drawing.
- `src/view-mode.ts` owns the `2d`/`3d` preference (`?view=` URL override, then `localStorage`, then 3D wherever `navigator.gpu` exists) and the renderer loading status.
- `src/game-view.ts` owns HUD/modal view-model generation for Svelte.
- `src/visibility-animation-loop.ts` owns the visibility-aware request-animation-frame lifecycle shared by the two standalone effect labs; lab-specific update and drawing policy stays in each lab module.
- `src/entities/` owns active gameplay entities split by concern: towers, monsters, projectiles, and effects.
- `src/render3d/` is the 3D board renderer (three.js `three/webgpu`, automatic WebGL2 fallback, `?backend=webgl2` forces it). It is only reached through a dynamic import, and `vite.config.ts` keeps three.js in its own chunk, so the 2D board never downloads it. It reads `Game.runtime` every frame and never mutates simulation state:
  - `three-board-renderer.ts` owns the WebGPU renderer, scene, lights, precompilation (with per-phase `StartupTimings`), resize, and per-frame orchestration.
  - `post-processing.ts` is a lean custom HDR bloom (prefilter/downsample, separable blur at two resolutions, composite with ACES tone mapping, sRGB encode, and vignette onto the canvas): three distinct shaders, all precompiled asynchronously. The renderer's own tone mapping/output color space stay neutral so three never adds a hidden output pass. Passes are plain meshes over three's full-screen triangle, not `QuadMesh` (its `render()` swaps in a private vertex shader, so precompiled pipelines would never match).
  - `camera-rig.ts` fits the tilted perspective camera to the field, ray-casts pointer picking onto the ground, projects field points for the overlay, and applies screen shake to a separate render camera (picking never shakes). `inspect(...)` frames a close-up for render scripts.
  - `materials.ts` is the complete, fixed material set; `render-batches.ts` is the complete, fixed list of instanced batches. `instanced-batch.ts` and `sprite-batch.ts` are refill-every-frame instance buffers written straight into typed arrays. Instanced batches are plain meshes over an `InstancedBufferGeometry` with one interleaved per-instance buffer (`instanceMatrix0..3`, `instanceTint`, `instanceExtra`) that the materials apply themselves; three keys `InstancedMesh` shader builds per object, so this is what lets every batch sharing a material share one build.
  - Lit materials are Lambert (the neon look comes from emissive trims, rims, an analytic key-light highlight, and bloom; full PBR compiled markedly slower on first launch). Shadows are soft blob decals pushed through `RenderBatches.pushBlobShadow(...)`, offset along the key light by each object's height; there are no shadow maps.
  - `models.ts` / `geometry-kit.ts` build all procedural low-poly models (monsters at unit radius, towers in field units). Every neon part geometry carries exactly `position`, `normal`, and a per-vertex `glow` mask, non-indexed.
  - `monster-view.ts`, `tower-view.ts`, `projectile-view.ts`, `effect-view.ts`, `placement-view.ts`, and `board-scene.ts` compose entities into batches; `fx-system.ts` owns renderer-only spectacle (pooled 3D sparks, fireballs, smoke, ground rings, a fixed point-light pool, scorch decals, camera trauma); `overlay-view.ts` draws the screen-space tower actions and escape counter on a 2D canvas above the 3D canvas.
  - `render-quality.ts` holds the desktop/mobile budgets and the dynamic-resolution governor.
- `src/entities/monsters/monster.ts` owns shared monster movement, damage, slow recovery, lifecycle outcome reporting, and health-bar rendering.
- Concrete monster classes live under `src/entities/monsters/` and own monster-specific base stats, body rendering, and special behavior (`berserker` ramps speed as it loses health; `bulwark` mitigates incoming damage).
- Projectile classes live under `src/entities/projectiles/`; import the exact base or concrete file (`projectile.ts`, `gun-projectile.ts`, `drone-projectile.ts`, `missile.ts`, or `drone.ts`) rather than adding a barrel.
- General effect classes live under `src/entities/effects/`; import the concrete effect file directly.
- Shared and entity-specific drawing helpers currently live in `src/entities/drone-visuals.ts` and `src/entities/monsters/tank-effects.ts`; the tank module also owns its track and detached-turret particles. Keep these helpers narrow and colocated with the entities that use them.
- Tower classes live under `src/entities/towers/`; `Tower` in `tower.ts` owns shared targeting/upgrade/selection behavior.
- `src/entities/towers/tower-registry.ts` is the source of truth for tower class lookup, keyboard shortcuts, and tower preview instances used by the Svelte toolbar.
- Towers, projectiles, drones, monsters, and presentation effects update through `UpdateContext`; gameplay entities report additions and lifecycle outcomes through `UpdateResult`. Do not give them a `Game` dependency when the context/result boundary is sufficient.
- `src/campaign.ts` turns the ten authored routes into the campaign.
- `src/game-view.ts` derives banner, HUD, and modal presentation data; keep text/formatting policy out of Svelte components and the renderer where practical.
- `src/types.ts` is the source of truth for shared browser types such as `TowerKind`, `MonsterKind`, `GameState`, `Point`, `LevelData`, `WaveData`, and `HudSnapshot`.
- `src/constants.ts` and `src/utils.ts` are shared by the active runtime, so prefer reusing those helpers instead of re-declaring gameplay constants or math utilities.
- `src/entities.ts`, `src/entities/monsters.ts`, `src/entities/projectiles.ts`, and `src/entities/effects.ts` have been removed; do not recreate monolithic entity files or barrel files unless there is a clear payoff.

Data / naming conventions:

- Monster identifiers in `game-levels.json` use the readable string values from `MonsterKind`, not one-letter codes:
  - `packman`
  - `square`
  - `triangle`
  - `tank`
  - `runner`
  - `splitter`
  - `berserker`
  - `bulwark`
- `GameState`, `MonsterKind`, and `TowerKind` are `as const` value objects with derived union types in `src/types.ts`, not TypeScript enums.
- Keep `game-levels.json` monster identifiers as plain strings. `src/game-engine.ts` applies the selected mobile overrides and normalizes JSON route data before `src/campaign.ts` expands it.
- `game-levels.json` provides the ten campaign routes. The actual playable campaign data is generated at runtime by `createCampaignLevels(...)`, which expands those authored routes into per-wave monster sequences and build windows.
- Authored routes do not own `monsterCount`; playable `LevelData.monsterCount` is derived from the generated waves in `src/campaign.ts`.
- Monster constructors pass private named constants to `Monster` with `super(path, COLOR, SPEED, HIT_POINTS, BOUNTY, RADIUS)`.
- Monster constructor stats use `hitPoints`, not `hp`.
- `hitPoints` is current monster health. `maxHitPoints` is the full-health denominator used by the health bar.
- Monster constructors take the concrete `PathEntry[]` path they should follow, not `LevelData`.
- For unusual spawn positions, build a new `PathEntry[]` with route-path helpers such as `createPathEntriesFromDistance(...)` instead of passing raw level points to monsters.
- Monsters report `killed` and `escaped` lifecycle outcomes through `UpdateResult`; `Game` resolves those outcomes after monster updates.
- Concrete monster classes should not import `Game` or call game orchestration methods directly.
- Monster instances do not carry `MonsterKind`; use `MonsterKind` for level/campaign data and `instanceof` for runtime class-specific behavior.

Gameplay / UI notes:

- The campaign is a fixed 10-level progression with unlocks and stars persisted in browser `localStorage`; `CampaignProgressStore` falls back to memory if storage access fails.
- Initial build time is campaign-driven, not a fixed global delay: early levels start around 10 seconds and later ones reach 14 seconds.
- Intermission build windows between later waves are shorter and are generated per wave in `src/campaign.ts` (roughly 2.5 to 5.5 seconds).
- Level 1 is an introductory route and is not intended to showcase the full monster roster; its generated waves should stay within the monster pool authored for `Outer Line` in `game-levels.json`.
- Later campaign waves introduce heavier and specialist monsters such as `tank`, `splitter`, `bulwark`, and `berserker`. Splitters burst into weakened runner children when killed.
- Monster spawning is orchestrated by `Game.spawnMonster(...)`, while monster construction/scaling and splitter children are centralized in `src/game-engine/monster-factory.ts`; tower creation is registry-driven through `Game.createTower(...)` and `getTowerClass(...)`.
- The main frame loop preserves native high-refresh updates, uses bounded substeps to recover slow-frame time, draws once, and freezes background-tab time by resetting the frame clock on visibility changes.
- Bulwark flat armor applies only to discrete `takeDamage(...)` hits. Continuous effects use `takeContinuousDamage(...)`; laser beam damage is analytically integrated over its fade so results do not depend on refresh rate.
- Monster classes should own their own body rendering. Shared monster rendering concerns belong in `Monster`.
- The 3D renderer is the exception: 3D bodies live in `src/render3d/` (so three.js stays out of the entity modules and the 2D bundle) and read small public presentation getters on entities (for example `currentMouthAngle`, `getDashPulse()`, `getReloadProgress()`). When adding a monster or tower, add its 3D model in `models.ts`, a batch in `render-batches.ts`, and an `instanceof` branch in the matching view; expose read-only presentation state rather than moving rendering into the entity.
- 3D shader budget rules: all entity parts share the one `neon` material and instance tint carries identity, so new visuals should add geometry/batches, not materials. Never change anything that is part of three's shader key at runtime (light count, MSAA samples, material features); resolution is the only runtime quality knob. Keep persistent meshes persistent (the road ribbon is rewritten in place; replacing meshes releases cached shader state and recompiles mid-game). Avoid transparent `DoubleSide` materials (three draws them in two passes with two pipelines; ribbons are single-sided and always faced toward the camera).
- 3D startup rules: first-visit cost is dominated by GPU driver shader compiles, which run serially for pipelines created synchronously. Everything must compile through the parallel async batch in `compileScene()` (one object per distinct material concurrently, plus the post chain) before the warm-up frame; the warm-up frame should add no new shader programs. `npm run benchmark:3d` warns if gameplay compiles a pipeline the warm-up missed, and `npm run benchmark:3d:startup -- --cold` measures first-visit startup by salting every shader (`?shaderSalt=N`, dev only) so driver caches miss. `?timings` shows the startup phase breakdown on the board in any build.
- 3D effects are driven from simulation state: the effect view maps each simulation particle/link class to a 3D treatment (shards and turret debris get height, gravity, tumble, and bounce), monster disappearances are classified into kill/escape by hit points and path progress, and `ShockwaveEffect` instances trigger missile blasts. Presentation time comes from `Game.simulationSeconds`, so 3D effects freeze with the game.
- Monster-specific visual animations, such as tank turret spins or packman mouth/body flourishes, should live on the concrete monster class and run through `updateSpecial(...)`; if an animation changes visible body geometry or orientation, keep that current shape reflected in the monster's `addDeathEffect(...)` outline/rotation so shards match the death frame.
- Use shared easing helpers from `src/utils.ts` for monster animation progress, and keep mutually exclusive monster flourishes in one local state machine when they should not overlap.
- Tower classes should own their own drawing and attack behavior. Shared tower rendering/selection concerns belong in `Tower`.
- Svelte components should consume `HudSnapshot` and `ModalView` data rather than reaching into the `Game` object directly.
- The HUD selection card supports upgrade, sell, and cancel-build actions; keep those interactions flowing through `GameSession` and the HUD snapshot rather than binding components directly to `Game`.
- Mobile layout support starts at a `375 x 812` CSS-pixel viewport. Do not optimize for older/smaller phone viewports such as `320 x 568` or `360 x 667` unless explicitly asked.
- The campaign modal doubles as the map screen, win/loss screen, and resume flow.

To run the browser version:

- `npm run dev`

Useful validation commands:

- `npm run build`
- `npm run check:runtime` (browser regression checks for timing, collisions, effects, and UI state)
- `npm run build:pages`
- `npm run dev`
- `npm run benchmark:update`
- `npm run benchmark:death-effects`
- `npm run benchmark:draw`
- `npm run benchmark:draw:towers`
- `npm run render:levels`
- `npm run render:3d` (staged 3D overview, per-monster/tower close-ups, explosion, tank-death, and breach sequences under `artifacts/3d-board/`; `--mobile`, `--webgl2`, `--level=N`)
- `npm run benchmark:3d` (time to ready, shader/pipeline counts before and after a crowded fight, per-frame CPU draw cost, draw calls; `--mobile`, `--webgl2`)
- `npm run benchmark:3d:startup` (median per-phase 3D startup timings; `--mobile`, `--webgl2`, `--cpu=4` CPU throttling, `--cold` for first-visit shader compiles, `--runs=N`)

The supported runtime ranges are declared in `package.json`; `.nvmrc` pins the local/CI Node release. There is currently no general `test`, `lint`, or `format:check` script, so do not claim those checks ran unless they have been added.

GitHub Pages branch publishing:

- To publish a non-main branch for testing, use the existing `Deploy GitHub Pages` workflow with `workflow_dispatch` on that branch. If the `github-pages` environment blocks the branch, temporarily add a deployment branch policy for that exact branch, run the workflow, then remove the temporary policy after the deploy succeeds.
- Do not create or push a `gh-pages` branch for branch testing. The Pages publish path for this repo is the Actions artifact workflow, not a deploy branch workaround.

Tower render table:

- `debug/towers.html` displays a table of individual canvas previews for each tower, projectile, and level.
- `src/tower-testing.ts` imports the real tower classes, upgrades each tower from level 1 through 7, and calls the actual canvas `draw()` methods.

Monster explosion render sheets:

- `node scripts/render-monster-explosions.mjs` generates large early-stage contact sheets for every monster under `artifacts/monster-explosion-sequence/`.
- The script starts a temporary Vite server, opens it with Playwright, imports the real monster classes, calls each monster's actual `addDeathEffect(...)`, and renders detailed early explosion frames with the intact monster as frame 0.
- Generated PNGs under `artifacts/` are ignored by Git and should normally stay uncommitted.

Other render and benchmark tooling:

- `npm run render:levels` renders desktop and mobile route/placement sheets.
- `node scripts/render-polygon-shards.mjs` renders seeded polygon-breakup variants under `artifacts/polygon-shards/`.
- `node scripts/render-berserker-animation.mjs [output.png]` renders the berserker rage sequence.
- `npm run benchmark:death-effects` measures synchronous monster death-effect construction with seeded, resettable randomness.
- `npm run benchmark:update` reports both the reconstructed busy-runtime method timings and separate seeded `Game.updateSimulation(...)` timings with drones and lifecycle effects. Whole-engine samples exclude drawing and fixture maintenance; they are not full browser-frame timings.
- `npm run benchmark:draw` and `npm run benchmark:draw:towers` report CPU-submission and forced-GPU-flush draw timings separately. Keep benchmark methodology and fixture coverage intact when interpreting changes.
- `scripts/benchmark-browser-harness.mjs` centralizes temporary Vite pages, Playwright/Chrome launch fallback, page-error handling, cleanup, result waiting, and PNG data-URL writing for browser benchmarks and render scripts.

Monster explosion testing showcase:

- `debug/index.html` is the index for standalone development and inspection tools.
- `debug/towers.html` renders the actual tower and projectile classes across levels 1 through 7.
- `debug/explosions.html` is a separate desktop-only Vite page for inspecting monsters zoomed way in as they move into center and explode in slow motion.
- Its behavior lives in `src/explosion-testing.ts`; keep changes isolated there unless deliberately promoting the page into the main game runtime.
- The page reuses the real monster classes and each monster's actual `addDeathEffect(...)` particles, and intentionally uses normal runtime randomness rather than seeded output.
- The production build emits the pages under `debug/` as separate Rollup entries; keep `src/explosion-testing.ts` and `src/tower-testing.ts` out of the main game imports so the game does not load testing-only JavaScript.

Escape explosion testing showcase:

- `debug/escape-explosion.html` is a separate desktop-only lab for tuning escape burst particle geometry and motion.
- Its behavior lives in `src/escape-explosion-testing.ts`; it uses the production `createEscapeBurstParticles(...)` recipe and `ESCAPE_BURST_CONFIG` from `src/game-engine/combat-effects.ts`, passing slider-derived overrides for lab tuning while keeping lab UI and animation code out of the main bundle.
- Both animation labs pause while the document is hidden and resume without accumulating a large background-tab delta.
- The production build emits `debug/escape-explosion.html` alongside the other pages under `debug/`.

Audio assets:

- The committed `.m4a` files in `src/assets/audio/` are the source of truth for game sound effects.
- `src/audio-manifest.ts` is the single source of truth for cue IDs, soundboard labels, imported asset URLs, cooldowns, gain, and rate variation. `src/game-audio.ts` and `debug/soundboard.html` both consume that manifest.
- `src/game-audio.ts` owns Web Audio loading, retryable buffer caching, cooldowns, panning, playback, and `AudioBufferSourceNode.onended` cleanup. Keep rejected loads recoverable and do not queue repeated transient playbacks behind one unresolved load.
- Audio sources are documented in `src/assets/audio/README.md` at the source-pack level.
- When replacing audio, overwrite the relevant `.m4a` files directly, keep the source-pack documentation current, and verify the soundboard/build before committing.

Maintenance preferences:

- Prefer named imports from `src/constants.ts` and `src/types.ts` so call sites show their dependencies clearly.
- Keep Svelte UI declarative and thin; put formatting and modal/HUD derivation in `src/game-view.ts`.
- Keep imperative simulation logic in `src/game-engine.ts` or entity classes, not in Svelte components.
- Keep gameplay rates time-based and compatible with variable substep sizes. Reuse `CalibratedExponentialDecay` for calibrated particle damping instead of introducing `1 - k * deltaSeconds` velocity damping.
- Avoid default parameter values in new code; make call sites pass behavior-affecting values explicitly.
- When changing tower drawing code, inspect every level in `debug/towers.html` and run `npm run build` before calling the visuals done.
- When adding monsters, add a `MonsterKind` value, a concrete monster class, a `createBaseMonster(...)` branch in `src/game-engine/monster-factory.ts`, and campaign usage as needed.
- When adding towers, add a `TowerKind` value and concrete tower class, then add one `registerTower(...)` entry with any preview pose configuration. `TOWER_CLASSES` and `TOWER_TOOLBAR_PREVIEWS` are derived from that registration list. `Game.createTower(...)` already resolves classes through the registry; do not add a kind switch there.
