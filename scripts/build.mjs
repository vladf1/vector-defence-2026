import { rm } from "node:fs/promises";
import path from "node:path";
import { htmlPages, repoRoot } from "./site-config.mjs";

const publicPath = process.argv.includes("--pages") ? "/vector-defence-2026/" : "/";
const outdir = path.join(repoRoot, "dist");
await rm(outdir, { recursive: true, force: true });
const result = await Bun.build({
  entrypoints: htmlPages.map(page => path.join(repoRoot, page)),
  root: repoRoot,
  outdir,
  target: "browser",
  minify: true,
  splitting: true,
  publicPath,
});
if (!result.success) throw new AggregateError(result.logs, "Browser build failed");
console.log(`Built ${result.outputs.length} files in dist/ (base ${publicPath})`);
