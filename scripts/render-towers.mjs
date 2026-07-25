import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { repoRoot, runBrowserPage } from "./benchmark-browser-harness.mjs";

const outputPath = path.resolve(repoRoot, process.argv[2] ?? "artifacts/tower-render.png");

const png = await runBrowserPage({
  path: "/debug/towers.html",
  waitUntil: "networkidle",
  viewport: { width: 1200, height: 1500 },
  deviceScaleFactor: 2,
}, async (page) => {
  const table = page.locator("#tower-testing");
  await table.waitFor({ state: "visible" });
  return table.screenshot({ type: "png" });
});

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, png);
console.log(outputPath);
