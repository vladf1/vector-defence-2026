# Vector Defence

Vector Defence is a browser-based tower defense game built with Svelte 5, TypeScript, and Vite. This repository's active implementation is the browser app at the repo root, with the current runtime living in `src/`.

The game features a fixed 9-level campaign, an unlocked random challenge, canvas-based combat, four tower types, and routes generated from handcrafted level data.

Play online: [https://vladf1.github.io/vector-defence-2026/](https://vladf1.github.io/vector-defence-2026/)

## Requirements

- Node.js
- npm

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
npm run dev
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
- `U`: Upgrade selected tower
- `Esc`: Cancel build mode
- `Space`: Pause or resume

## Project Notes

- App entry: `src/main.ts`
- Root Svelte component: `src/App.svelte`
- Shared session bridge: `src/game-session.ts`
- Simulation engine: `src/game-engine.ts`
- Campaign builder: `src/campaign.ts`
- Renderer: `src/game-renderer.ts`
- Browser level data: `game-levels.json`
