import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { startDevServer, startStaticServer } from "./browser-server.mjs";
import { repoRoot } from "./site-config.mjs";

export { repoRoot };

export async function runBrowserPage(options, runPage) {
  let temporaryDirectory;
  let server;
  let browser;
  try {
    const serverOptions = { hostname: "127.0.0.1", port: 0 };
    if (options.html === undefined) {
      server = await startDevServer(serverOptions);
    } else {
      await mkdir(path.join(repoRoot, "artifacts"), { recursive: true });
      temporaryDirectory = await mkdtemp(path.join(repoRoot, "artifacts/browser-page-"));
      // Bun bundles external module scripts. Materialize the existing fixtures
      // without changing their measurements, seeds, or browser-side code.
      let moduleIndex = 0;
      const modules = [];
      const html = options.html.replace(/<script type="module">([\s\S]*?)<\/script>/g, (_tag, source) => {
        const filename = `fixture-${moduleIndex++}.mjs`;
        const resolvedSource = source.replace(/(["'])\/(?=src\/|game-levels\.json)/g, `$1${repoRoot}/`)
          .replaceAll("game-levels.json?import", "game-levels.json");
        modules.push(writeFile(path.join(temporaryDirectory, filename), resolvedSource));
        return `<script type="module" src="./${filename}"></script>`;
      });
      await Promise.all(modules);
      const entrypoint = path.join(temporaryDirectory, "index.html");
      await writeFile(entrypoint, html);
      const directory = path.join(temporaryDirectory, "dist");
      const build = await Bun.build({ entrypoints: [entrypoint], outdir: directory, target: "browser", publicPath: "/", splitting: true });
      if (!build.success) throw new AggregateError(build.logs, "Browser fixture build failed");
      server = startStaticServer({ ...serverOptions, directory, basePath: "/" });
    }
    const url = server.url;
    browser = await launchChromium();
    const page = await browser.newPage({
      viewport: options.viewport ?? { width: 960, height: 540 },
      deviceScaleFactor: options.deviceScaleFactor ?? 1,
    });
    page.on("console", (message) => {
      if (options.forwardConsole) {
        console.log(message.text());
      }
    });
    const targetUrl = new URL(options.html === undefined ? options.path : "/", url);
    targetUrl.search = options.query?.replace(/^\?/, "") ?? "";
    const pageError = new Promise((_resolve, reject) => {
      page.once("pageerror", reject);
    });
    const pageWork = (async () => {
      await page.goto(targetUrl.href, { waitUntil: options.waitUntil ?? "domcontentloaded" });
      return runPage(page);
    })();
    return await Promise.race([pageWork, pageError]);
  } finally {
    await browser?.close();
    server?.stop(true);
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export function runBenchmarkPage(options) {
  return runBrowserPage(options, (page) => waitForPageResult(page, "__benchmarkResults", options.timeoutMs ?? 120_000));
}

export async function waitForPageResult(page, resultName, timeoutMs) {
  const result = await page.waitForFunction((name) => window[name], resultName, { timeout: timeoutMs });
  return result.jsonValue();
}

export async function writeDataUrlPng(outputPath, dataUrl) {
  const pngBase64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(pngBase64, "base64"));
}

export async function writeDataUrlPngMap(outputDir, dataUrls) {
  await Promise.all(Object.entries(dataUrls).map(([filename, dataUrl]) =>
    writeDataUrlPng(path.join(outputDir, `${filename}.png`), dataUrl),
  ));
}

async function launchChromium() {
  try {
    return await chromium.launch();
  } catch (error) {
    if (!String(error).includes("Executable doesn't exist")) {
      throw error;
    }
    return chromium.launch({ channel: "chrome" });
  }
}
