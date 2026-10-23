# Vector Defence

Vector Defence is a browser-based tower defense game built with TypeScript, Vite, and plain DOM/canvas (no UI framework). This repository's active implementation is the browser app at the repo root, with the current runtime living in `src/`.

The game features a fixed 10-level campaign, canvas-based combat, six tower types, and waves generated from handcrafted routes.

Play online: [https://vladf1.github.io/vector-defence-2026/](https://vladf1.github.io/vector-defence-2026/)

## Requirements

- Node.js 24.22+ (24.x)
- Bun 1.4.4 (pinned in `package.json`)

Install Bun using the [official installation guide](https://bun.sh/docs/installation).
Node.js is still used by Vite and the browser tooling scripts.

## Getting Started

Install dependencies:

```bash
bun install --frozen-lockfile
```

Start the local development server:

```bash
bun run dev
```

Vite will print a local URL in the terminal, typically `http://localhost:5173/`.

## Build

Create a production build:

```bash
bun run build
```

Create a GitHub Pages build with the repository base path:

```bash
bun run build:pages
```

Preview the production build locally:

```bash
bun run preview
```

Useful validation commands:

```bash
bun run build
bun run build:pages
bun run check:runtime
bun run dev
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
- App shell: `src/components/app-shell.ts`
- Shared session bridge: `src/game-session.ts`
- Simulation engine: `src/game-engine.ts`
- Campaign builder: `src/campaign.ts`
- Renderer: `src/game-renderer.ts`
- Browser level data: `game-levels.json`
