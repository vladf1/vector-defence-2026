import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const htmlPages = [
  "index.html",
  "debug/index.html",
  "debug/towers.html",
  "debug/soundboard.html",
  "debug/explosions.html",
  "debug/escape-explosion.html",
];
