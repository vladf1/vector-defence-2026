import path from "node:path";
import process from "node:process";
import {
  repoRoot,
  runBrowserPage,
  waitForPageResult,
  writeDataUrlPng,
} from "./benchmark-browser-harness.mjs";

const outputPath = path.resolve(repoRoot, process.argv[2] ?? "artifacts/tower-render.png");

const dataUrl = await runBrowserPage({
  path: "/debug/towers.html",
  waitUntil: "networkidle",
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
}, (page) => waitForPageResult(page, "__towerRenderDataUrl", 5_000));

await writeDataUrlPng(outputPath, dataUrl);
console.log(outputPath);
