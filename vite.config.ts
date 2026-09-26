import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [svelte()],
  server: {
    allowedHosts: [".trycloudflare.com"],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, "index.html"),
        debug: resolve(rootDir, "debug/index.html"),
        debugTowers: resolve(rootDir, "debug/towers.html"),
        debugSoundboard: resolve(rootDir, "debug/soundboard.html"),
        debugExplosions: resolve(rootDir, "debug/explosions.html"),
        debugEscapeExplosion: resolve(rootDir, "debug/escape-explosion.html"),
      },
      output: {
        manualChunks(id) {
          // three.js is only reached through the dynamically imported 3D renderer; keep it
          // out of the shared vendor chunk so the 2D board never downloads it.
          if (id.includes("node_modules/three/")) {
            return "three";
          }
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },
});
