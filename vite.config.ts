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
        soundboard: resolve(rootDir, "soundboard.html"),
        explosions: resolve(rootDir, "explosions.html"),
        escapeExplosion: resolve(rootDir, "escape-explosion.html"),
      },
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },
});
