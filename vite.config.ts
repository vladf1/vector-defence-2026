import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

const singleFileBuild = process.env.VECTOR_DEFENCE_SINGLE_FILE === "1";

export default defineConfig({
  plugins: [svelte()],
  build: {
    rollupOptions: {
      output: singleFileBuild
        ? {
            inlineDynamicImports: true,
          }
        : {
            manualChunks(id) {
              if (id.includes("node_modules")) {
                return "vendor";
              }
            },
          },
    },
  },
});
