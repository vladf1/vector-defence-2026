# Vector Defence

Vector Defence is a browser-based tower defense game built with Svelte 5, TypeScript, and Vite. This repository's active implementation is the browser app at the repo root, with the current runtime living in `src/`.

The game features a fixed 10-level campaign, canvas-based combat, four tower types, and routes generated from handcrafted level data plus procedural campaign seeding.

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

Preview the production build locally:

```bash
npm run preview
```

Create a single-file build:

```bash
npm run build:single
```

Useful validation commands:

```bash
npm run build
npm run build:single
npm run dev
```

## Controls

- `1` / `G`: Gun tower
- `2` / `L`: Laser tower
- `3` / `M`: Missile tower
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
