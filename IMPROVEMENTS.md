# Vector Defence Improvement Backlog

Last reviewed: 2026-07-17

This document captures the repository-wide correctness, performance, tooling,
accessibility, and maintainability audit. Keep item numbers stable so work can
be referenced across Codex tasks, commits, and pull requests.

## Status legend

- `[ ]` Not started
- `[~]` Partially addressed or awaiting a decision
- `[x]` Completed and verified
- **Confirmed defect**: directly reproducible incorrect behavior
- **Measured hotspot**: supported by the repository's current benchmarks
- **Investigation**: measure or decide before changing behavior

## Highest priority

### 1. [x] Make Bulwark damage independent of refresh rate

**Type:** Confirmed defect — completed 2026-07-17

Bulwark's flat armor previously ran once per animation-frame laser callback.
A base laser therefore dealt about 6.9 damage at 15 Hz and 64.4 at 144 Hz.

Implemented:

- Added an explicit continuous-damage path in
  `src/entities/monsters/monster.ts`.
- Kept Bulwark flat armor for discrete projectile/lightning impacts in
  `src/entities/monsters/bulwark-monster.ts`.
- Analytically integrated the fading laser beam in
  `src/entities/towers/laser-tower.ts`.
- Updated the tower render fixture for the new monster damage method.

Verification:

- Base laser damage is exactly `33.333333` at 15, 30, 60, 90, 120, and
  144 Hz.
- A level-6 laser deals `83.333333`, so upgrades continue to scale.
- A discrete 10-point hit still deals 6.5 damage through Bulwark armor.
- `npm run build`, the update benchmark, and a fresh tower render sheet pass.

### 2. [x] Replace gameplay `shadowBlur` effects

**Type:** Measured hotspot — completed 2026-07-17

Forced-GPU-flush measurements found upgraded Lightning tower draws around
1.62–1.72 ms, compared with roughly 8.75 us at the base level without its
blurred glow. Active gun and missile muzzle flashes measured approximately
0.82–0.87 ms per draw.

Implemented:

- Replaced Lightning tower, gun/missile muzzle flash, and laser beam blur with
  layered translucent fills and strokes.
- Extended the tower benchmark and render sheet so active laser and muzzle
  effects are actually exercised.
- Preserved the bright core, colored glow hierarchy, and per-level color and
  geometry progression in a fresh `artifacts/tower-render-layered-final.png`.

Forced-GPU-flush medians across the affected levels changed from:

- Active laser: 2,761–2,891 us to 101–119 us.
- Upgraded Lightning: 1,471–1,543 us to 21–29 us.
- Active gun muzzle flash: 779–801 us to 14–20 us.
- Active missile muzzle flash: 738–773 us to 14–28 us.

A live Chrome battle smoke through two waves exercised gun, laser, and missile
effects with no console warnings or errors. The available Chrome control channel
did not expose DevTools trace capture; the repaired forced-GPU-flush benchmark,
fresh render sheet, and live smoke were accepted as sufficient verification.

### 3. [ ] Apply particle and link budgets before construction

**Type:** Confirmed inefficiency

`UpdateResult` accepts every effect object, while `Game.applyUpdateResult()`
checks `MAX_PARTICLES` and `MAX_LINKS` only after construction. Saturated
frames still pay for allocations, random generation, and geometry that will
be discarded.

Actions:

- Give `UpdateResult` the remaining particle/link capacity for the frame.
- Check admission before constructing an effect, using an explicit capacity
  guard or lazy factory. Returning `false` from `addParticle(new Particle(...))`
  is too late because the allocation and random/geometry work already happened.
- Return whether admission succeeded so grouped effects can stop early.
- Prioritize gameplay-readable effects when capacity is scarce.
- Expose dropped-effect counts in nerd stats.
- Consider pooling only after the admission fix is benchmarked.

### 4. [x] Recover elapsed time with bounded simulation substeps

**Type:** Correctness and consistency — completed 2026-07-17

The old frame loop discarded elapsed time beyond 66.7 ms. The replacement
preserves native high-refresh updates while splitting slow frames into steps no
larger than 1/60 second, then draws only once.

Implemented:

- Added bounded timing policy in `src/simulation-timing.ts`.
- A 120 Hz frame receives one 1/120-second update; it does not duplicate a
  60 Hz simulation frame.
- A 100 ms frame receives six updates of at most 1/60 second.
- At most eight substeps run in one rendered frame; remaining time is retained
  for subsequent frames.
- Backlog is capped at 500 ms to prevent unbounded catch-up work.
- The frame clock and backlog reset when animation stops or tab visibility
  changes, so background-tab time is intentionally frozen.
- Split `Game.updateSimulation()` from the once-per-frame `Game.draw()`.
- A one-off timing validator passed before being removed.

### 5. [x] Replace linear velocity damping with exponential damping

**Type:** Correctness — completed 2026-07-17

Replaced the four `1 - k * deltaSeconds` particle damping paths with shared,
analytically integrated exponential decay.

Implemented:

- Covered base particles plus escape fragments, glass shards, and tank turrets.
- Calibrated each decay to preserve the old 60 Hz velocity and displacement.
- Integrated displacement analytically so both position and velocity are
  invariant across refresh rates, not only final velocity.
- Cached decay factors per timestep so a particle class performs at most one
  `Math.exp` calculation per distinct substep rather than one per particle.
- A one-off 15–144 Hz damping validator passed before being removed.

### 6. [ ] Establish an automated test suite

**Type:** Correctness infrastructure

The repository still lacks a general unit/integration test command. Start
with deterministic simulation boundaries:

- Swept projectile collision and spatial-index cell boundaries.
- Route sampling, distances, curves, and headings.
- Placement boundaries, route clearance, and tower overlap.
- Wave spawning, intermissions, completion, and defeat transitions.
- Splitter children and monster lifecycle ordering.
- Campaign generation and progress migration.
- Tower upgrade costs, ranges, and damage scaling.
- Invalid level-data rejection.
- Playwright smoke flows for start, place, upgrade, sell, pause, and mobile.

CI should run the tests before the Pages build.

## Correctness and reliability

### 7. [ ] Reject invalid monster identifiers

Level normalization silently filters unknown monster strings while invalid
tower identifiers throw an error. Validate all level data and report the
level, field, array index, and bad value. Reject an empty monster sequence.

### 8. [ ] Define laser range semantics

Target acquisition uses the advertised range, but the active 1,000-unit beam
can damage aligned monsters beyond it. Decide between:

- Clipping the damage segment to tower range, or
- Documenting and testing unlimited piercing after in-range acquisition.

Update the HUD summary to match the chosen behavior.

### 9. [ ] Confirm the tower range-upgrade formula

`Tower.upgrade()` adds `level * TOWER_RANGE_UPGRADE_STEP`, producing larger
increments at every level. Confirm this is intended, encode it in tests, and
rename the constant if it represents progressive rather than fixed growth.

### 10. [ ] Define simultaneous escape behavior

After defeat becomes pending, additional monsters escaping in the same frame
can still generate redundant escape bursts and sounds. Decide whether a
simultaneous breach should produce one presentation or one per monster, then
batch or suppress effects accordingly.

### 11. [ ] Store level results by stable level ID

Campaign stars are keyed by array index. Reordering or inserting routes can
attach saved results to the wrong level. Store by stable campaign ID and add a
one-time migration from the current index keys.

### 12. [x] Remove or restore ownership of authored `monsterCount`

**Type:** Correctness and data ownership — completed 2026-07-17

Removed the dead authored `monsterCount` values from `game-levels.json` and
from the JSON input type. `CampaignRouteData` now represents normalized route
input without a count, while playable `LevelData` requires the count derived
from its generated waves. A one-off validator confirmed every desktop and
mobile level reports exactly the sum of its generated wave counts, then was
removed.

### 13. [ ] Validate tower shortcut uniqueness

Drone and Lightning both accept `5`. Current campaign availability happens to
avoid the collision, while lookup simply returns the first match. Assign
distinct global shortcuts or validate uniqueness within every level.

### 14. [ ] Make audio loading recoverable

Rejected buffer promises remain cached, and callers do not handle rejection.
A failed fetch/decode can permanently disable a cue and produce an unhandled
promise rejection.

Actions:

- Remove failed promises from the cache.
- Log each asset failure once and permit retry.
- Avoid queueing many transient sounds behind one unresolved load.
- Preload important cues or deliberately drop uncached rapid-fire cues.

### 15. [ ] Use `AudioBufferSourceNode.onended` for cleanup

Audio nodes are disconnected with duration-based timers even though playback
rate varies. Use `onended` for exact cleanup and retain a defensive fallback
only if necessary.

### 16. [ ] Model non-empty geometry explicitly

`noUncheckedIndexedAccess` currently reports 193 errors, concentrated in
route paths, polygon splitting, render geometry, and fixed-size visual arrays.
Introduce focused `NonEmptyArray<T>` types and validation at data boundaries
instead of broad non-null assertions.

### 17. [ ] Adopt stricter TypeScript checks incrementally

Audit results:

- `noUnusedLocals` / `noUnusedParameters`: 1 error.
- `noUncheckedIndexedAccess`: 193 errors.
- `exactOptionalPropertyTypes`: 31 errors.
- `noImplicitOverride`: 11 errors.

Enable unused checks first, then override checks and optional-property
cleanup. Stage unchecked indexing after non-empty geometry types exist.

### 18. [ ] Make runtime states explicit

`LevelRuntime` represents both empty and active levels through optional
properties, while `Game` mutates several public runtime collections. Consider
explicit `LevelRuntime.empty()` / `LevelRuntime.forLevel(...)` constructors
and narrow transition methods for start, pause, win, loss, and restart.

## Performance

### 19. [ ] Measure and reduce polygon-shard construction cost

Polygonal monster deaths synchronously run a splitter with high failure and
geometry-attempt limits. Current update/draw benchmarks do not measure this
construction path.

Actions:

- Add a mass-death scenario and record p50/p95/p99 frame time.
- If it spikes, precompute a small seeded topology bank per monster/body state.
- Keep visual randomness in velocity, rotation, and topology selection.

### 20. [ ] Reduce link-effect rendering cost

`LightningLinkEffect` measured about 34 us per forced-flush draw and creates
temporary point objects each draw. At the 120-link cap this can become
material.

Actions:

- Reuse instance scratch storage.
- Simplify segment count as links fade.
- Batch links by composite mode, stroke width, and color where practical.
- Benchmark before and after each change.

### 21. [ ] Cache gradients only after isolated measurements

Smoke, shockwaves, and missile exhaust create gradients while drawing.
Benchmark cached gradients or pre-rendered sprites independently. Prior work
showed that bitmap conversion is not automatically faster than vector draws.

### 22. [x] Cache canvas geometry for pointer movement

Avoid repeated layout reads during high-frequency pointer movement. Cache the
canvas rectangle and logical viewport, updating them on resize, scroll, and
pointer-down so coordinate conversion remains correct.

### 23. [x] Preserve the spatial collision index

The extreme update fixture measured approximately:

- Spatial index: 1.367 ms/frame.
- Linear search: 23.868 ms/frame.

This is roughly a 17.5x improvement. Keep the index and add tests around cell
boundaries, hash collisions, target ordering, and fast swept projectiles.

### 24. [x] Continue using cached backgrounds and full animated redraws

Canvas backing-store scaling and background caching are correct. Dirty-rect
rendering would add complexity while most of the scene is animated. Revisit
only if fresh live profiling shows full redraw is the limiting factor after
items 2, 3, 19, and 20.

### 25. [x] Pause auxiliary animation pages while hidden

The explosion and escape labs continuously request frames. Suspend their
loops on `visibilitychange` and resume without a large accumulated delta.

## Benchmarks, build, and tooling

### 26. [x] Repair draw-benchmark reporting

**Type:** Benchmark correctness — completed 2026-07-17

The full draw suite uses one benchmark order, then reports min/max across
orders. Those values are identical and hide the five samples collected inside
each benchmark.

Implemented:

- Reports sample count plus min, median, mean, and max directly.
- Runs normal, reversed, and deterministically randomized orders.
- Keeps forced-GPU-flush results separate from bounded CPU submission timing.
- Drains the canvas command queue outside CPU-submission timing so samples do
  not accumulate GPU backpressure.
- Uses larger full-suite batches so even `Particle.draw()` has non-zero medians.
- Supports targeted `--filter=...` runs and exposes `benchmark:draw` and
  `benchmark:draw:towers` package scripts.

Verification:

- Every summary contains 15 samples across three orders.
- The cheapest measured draw reported 0.167 us CPU submission and 0.333 us
  forced-GPU-flush medians instead of rounding to zero.
- The full draw suite and the active-effect tower suite pass.

### 27. [ ] Add an end-to-end frame benchmark

The update benchmark reconstructs the runtime loops and omits lifecycle
construction, spawn work, HUD synchronization, audio, and some drone paths.
Keep it as a component benchmark, then add real `Game` scenarios for:

- A steady wave.
- Projectile and missile saturation.
- Mass deaths and shard construction.
- Mass escapes.
- Effect-budget saturation.
- Drone-heavy play.

### 28. [ ] Fix seeded explosion rendering

The explosion render script imports monster modules before replacing
`Math.random`. Singleton shard splitters therefore capture the original random
function, and their topology is not actually seeded. Inject a random source
or seed before module initialization; avoid global `Math.random` mutation.

### 29. [ ] Consolidate browser render harnesses

Tower, level, explosion, and polygon scripts duplicate temporary Vite and
Playwright setup. Share port selection, Chromium fallback, console forwarding,
timeouts, cleanup, and artifact handling.

### 30. [ ] Expose diagnostics through package scripts

Add consistent scripts such as:

- `test`
- `check`
- `benchmark:draw`
- `render:explosions`
- `lint`
- `format:check`

Keep permanent scripts limited to reusable project checks rather than one-off
implementation validators.

### 31. [ ] Declare the supported Node and npm versions

CI uses Node 20 while the package does not declare `engines`. Define the
supported range and keep local Vite/TypeScript behavior aligned with CI.

### 32. [ ] Upgrade dependencies with current advisories

The 2026-07-17 full `npm audit` reported fixable advisory groups for Svelte,
Vite, and transitive `devalue`. Some apply to SSR or Windows development
servers rather than this static production build, but dependencies should be
updated deliberately and followed by build and browser verification.

## UI, accessibility, and maintainability

### 33. [ ] Give the battlefield an accessible interface

The foreground canvas has pointer handlers but no accessible label, role,
instructions, or keyboard placement mechanism. Add an accessible name and
instructions, then define keyboard placement if full non-pointer play is in
scope.

### 34. [ ] Add dialog semantics and focus management

The campaign/game modal needs `role="dialog"`, `aria-modal`, sensible initial
focus, focus containment, and focus restoration. Confirm Escape behavior for
menu, pause, victory, and defeat states.

### 35. [ ] Restore browser zoom

Remove `maximum-scale=1` and `user-scalable=no` from the viewport metadata.
Use CSS `touch-action` to control game gestures without blocking pinch zoom.

### 36. [ ] Support reduced motion

Honor `prefers-reduced-motion` for modal, star, banner, and decorative
animations without changing simulation timing.

### 37. [ ] Define tall-screen logical-field behavior

Tall layouts can expose logical space below the authored 960x560 route and
allow placement there. The current 375x812 layout is visually sound, so this
is a design decision: explicitly allow the extra build area or clip placement
to the canonical field, then test the chosen policy.

### 38. [ ] Split large files only at behavioral boundaries

Useful future extractions are wave/spawn orchestration, lifecycle resolution,
and input gesture state. Avoid splitting `game-engine.ts`, `game-session.ts`,
or `style.css` solely to reduce line count.

### 39. [ ] Generate duplicated audio metadata

The soundboard inventory can drift from the TypeScript audio registry. Generate
both from one manifest or shared data source.

### 40. [ ] Update stale documentation

`README.md` describes four tower types and only shortcuts 1–4. The game has six
towers. `GAMEPLAY_NOTES.md` also refers to five independent towers. Update the
roster, controls, campaign generation description, and validation commands.

## Current validation baseline

As of 2026-07-17:

- `npm run build`: passes with zero Svelte errors and warnings.
- `npm run build:pages`: passes.
- A one-off campaign validator confirmed derived desktop/mobile totals.
- A one-off damage validator passed across 15–144 Hz.
- A one-off damping validator preserved position and velocity across 15–144 Hz.
- A one-off timing validator confirmed native 120 Hz updates and bounded catch-up.
- All `scripts/*.mjs` pass Node syntax checking.
- Ten desktop/mobile routes pass identifier, coordinate, and numeric checks.
- Desktop campaign selection, placement, and pause smoke checks pass.
- Mobile 375x812 smoke check has no body overflow or console errors.
- Canvas backing stores correctly include display scale and device pixel ratio.
- The collision index remains the largest confirmed update-performance win.

## Recommended implementation order

1. Item 3: remove saturated-effect construction waste.
2. Item 6, then items 7–18: build coverage and harden correctness boundaries.
3. Items 19–22: measure and optimize remaining runtime hotspots.
4. Items 27–32: make benchmarks and CI enforce the intended behavior.
5. Items 33–40: accessibility, documentation, and structural cleanup.
