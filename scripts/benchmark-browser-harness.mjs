import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, "..");

export async function runBenchmarkPage(options) {
  const server = await createServer({
    root: repoRoot,
    logLevel: "error",
    server: {
      host: "127.0.0.1",
    },
    plugins: [
      {
        name: options.pluginName,
        configureServer(viteServer) {
          viteServer.middlewares.use(options.path, (_request, response) => {
            response.setHeader("Content-Type", "text/html; charset=utf-8");
            response.end(options.html);
          });
        },
      },
    ],
  });

  let browser;
  try {
    await server.listen(0);
    const url = server.resolvedUrls.local[0];
    browser = await launchChromium();
    const page = await browser.newPage({
      viewport: options.viewport ?? { width: 960, height: 540 },
      deviceScaleFactor: options.deviceScaleFactor ?? 1,
    });
    page.on("pageerror", (error) => {
      console.error(error);
    });
    page.on("console", (message) => {
      if (options.forwardConsole) {
        console.log(message.text());
      }
    });
    const targetUrl = new URL(options.path.replace(/^\//, ""), url);
    targetUrl.search = options.query?.replace(/^\?/, "") ?? "";
    await page.goto(targetUrl.href, { waitUntil: "domcontentloaded" });
    const results = await page.waitForFunction(
      () => window.__benchmarkResults,
      null,
      { timeout: options.timeoutMs ?? 120_000 },
    );
    return await results.jsonValue();
  } finally {
    await browser?.close();
    await server.close();
  }
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
