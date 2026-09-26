# Vector Defence

Vector Defence is a browser-based tower defense game built with Svelte 5, TypeScript, and Vite. This repository's active implementation is the browser app at the repo root, with the current runtime living in `src/`.

The game features a fixed 10-level campaign, a 2.5D WebGPU battlefield, six tower types, and waves generated from handcrafted routes.

Play online: [https://vladf1.github.io/vector-defence-2026/](https://vladf1.github.io/vector-defence-2026/)

## WebGPU board

The board is a 2.5D scene drawn with raw WebGPU: no rendering library, a fixed set of 13 WGSL pipelines created asynchronously at startup, instanced procedural geometry, and a small HDR bloom chain. Browsers without WebGPU see a "WebGPU required" notice instead of the board.

- `?timings` shows how long each startup phase took (useful when profiling a phone).
- `?shaderSalt=N` (dev server only) perturbs every shader so GPU shader caches miss, for first-visit compile measurements.

## Requirements

- Node.js 20.19+, 22.12+, or 24+
- npm 10.8.2+

## Getting Started

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

Vite will print a local URL in the terminal, typically `http://localhost:5173/`.

## Build

Create a production build:

```bash
npm run build
```

Create a GitHub Pages build with the repository base path:

```bash
npm run build:pages
```

Preview the production build locally:

```bash
npm run preview
```

Useful validation commands:

```bash
npm run build
npm run build:pages
npm run check:runtime
npm run dev
npm run render:3d
npm run benchmark:3d
npm run benchmark:3d:startup
```

## Deploy To GitHub Pages

This repository includes a GitHub Actions workflow that builds the app for the `vector-defence-2026` Pages path and deploys the generated `dist/` output whenever changes are pushed to `main`.

One-time GitHub setup:

1. Open the repository Settings page on GitHub.
2. Open Pages.
3. Set the publishing source to `GitHub Actions`.

Deploy from `main`:

```bash
git push origin main
```

Deployment runs are available in [GitHub Actions](https://github.com/vladf1/vector-defence-2026/actions/workflows/deploy-pages.yml).

The published site is available at [https://vladf1.github.io/vector-defence-2026/](https://vladf1.github.io/vector-defence-2026/).

## Controls

- `1` / `G`: Gun tower
- `2` / `Z`: Laser tower
- `3` / `R`: Missile tower
- `4` / `S`: Slow tower
- `5` / `D`: Drone tower on routes that offer it
- `5` / `E`: Lightning tower on routes that offer it
- `U`: Upgrade selected tower
- `Esc`: Cancel build mode
- `Space`: Pause or resume

## Project Notes

- App entry: `src/main.ts`
- Root Svelte component: `src/App.svelte`
- Shared session bridge: `src/game-session.ts`
- Simulation engine: `src/game-engine.ts`
- Campaign builder: `src/campaign.ts`
- WebGPU board renderer: `src/render3d/` (entry `src/render3d/webgpu-board-renderer.ts`, shaders in `src/render3d/shaders.ts`)
- Browser level data: `game-levels.json`
