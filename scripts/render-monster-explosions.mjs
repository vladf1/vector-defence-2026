import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.resolve(repoRoot, "artifacts/monster-explosion-sequence");

const html = String.raw`
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Monster Explosion Sequences</title>
    <style>
      body {
        margin: 0;
        background: #020807;
      }
      canvas {
        display: block;
      }
    </style>
  </head>
  <body>
    <canvas id="frame"></canvas>
    <canvas id="sheet"></canvas>
    <script type="module">
      const FRAME_COUNT = 30;
      const FRAME_WIDTH = 720;
      const FRAME_HEIGHT = 720;
      const SHEET_COLUMNS = 6;
      const SHEET_ROWS = Math.ceil(FRAME_COUNT / SHEET_COLUMNS);
      const SHEET_WIDTH = FRAME_WIDTH * SHEET_COLUMNS;
      const SHEET_HEIGHT = FRAME_HEIGHT * SHEET_ROWS;
      const DELTA_SECONDS = 1 / 420;
      const MONSTER_STROKE_WIDTH = 1.5;

      const { PackManMonster } = await import("/src/entities/monsters/packman-monster.ts");
      const { SquareMonster } = await import("/src/entities/monsters/square-monster.ts");
      const { TriangleMonster } = await import("/src/entities/monsters/triangle-monster.ts");
      const { RunnerMonster } = await import("/src/entities/monsters/runner-monster.ts");
      const { SplitterMonster } = await import("/src/entities/monsters/splitter-monster.ts");
      const { TankMonster } = await import("/src/entities/monsters/tank-monster.ts");
      const { BulwarkMonster } = await import("/src/entities/monsters/bulwark-monster.ts");
      const { BerserkerMonster } = await import("/src/entities/monsters/berserker-monster.ts");
      const { UpdateResult } = await import("/src/game-engine/update-context.ts");

      const monsterSpecs = [
        { slug: "packman", label: "PackMan", MonsterClass: PackManMonster, seed: 2201, zoom: 11.5, angle: 0 },
        { slug: "square", label: "Square", MonsterClass: SquareMonster, seed: 2208, zoom: 11.3, rotation: Math.PI * 0.08 },
        { slug: "triangle", label: "Triangle", MonsterClass: TriangleMonster, seed: 2202, zoom: 12, angle: 0.15 },
        { slug: "runner", label: "Runner", MonsterClass: RunnerMonster, seed: 2203, zoom: 13, angle: 0 },
        { slug: "splitter", label: "Splitter", MonsterClass: SplitterMonster, seed: 2204, zoom: 10.6, rotation: Math.PI * 0.08 },
        { slug: "tank", label: "Tank", MonsterClass: TankMonster, seed: 2205, zoom: 8.7, angle: 0.1 },
        { slug: "bulwark", label: "Bulwark", MonsterClass: BulwarkMonster, seed: 2206, zoom: 9.2, angle: 0.05 },
        { slug: "berserker", label: "Berserker", MonsterClass: BerserkerMonster, seed: 2207, zoom: 10.4, angle: 0 },
      ];

      const frameCanvas = document.getElementById("frame");
      const frameContext = frameCanvas.getContext("2d");
      const sheetCanvas = document.getElementById("sheet");
      const sheetContext = sheetCanvas.getContext("2d");

      frameCanvas.width = FRAME_WIDTH;
      frameCanvas.height = FRAME_HEIGHT;
      sheetCanvas.width = SHEET_WIDTH;
      sheetCanvas.height = SHEET_HEIGHT;

      const outputs = {};

      for (const monsterSpec of monsterSpecs) {
        Math.random = createSeededRandom(monsterSpec.seed);
        const monster = createMonster(monsterSpec);
        const result = new UpdateResult();
        monster.addDeathEffect(result);
        const particles = result.particles;

        sheetContext.fillStyle = "#020807";
        sheetContext.fillRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);

        for (let frameIndex = 0; frameIndex < FRAME_COUNT; frameIndex += 1) {
          drawFrame(frameContext, monster, particles, frameIndex, monsterSpec);
          const sheetX = (frameIndex % SHEET_COLUMNS) * FRAME_WIDTH;
          const sheetY = Math.floor(frameIndex / SHEET_COLUMNS) * FRAME_HEIGHT;
          sheetContext.drawImage(frameCanvas, sheetX, sheetY);

          if (frameIndex > 0) {
            for (const particle of particles) {
              particle.update(DELTA_SECONDS);
            }
          }
        }

        outputs[monsterSpec.slug + "-explosion-early-contact-sheet-large"] = sheetCanvas.toDataURL("image/png");
      }

      window.__monsterExplosionRender = outputs;

      function createMonster(spec) {
        const path = [
          { x: 0, y: 0, totalDistance: 0 },
          { x: 100, y: 0, totalDistance: 100 },
        ];
        const monster = new spec.MonsterClass(path, 1);
        monster.x = 0;
        monster.y = 0;
        if (spec.angle !== undefined) {
          monster.angle = spec.angle;
        }
        if (spec.rotation !== undefined) {
          monster.rotation = spec.rotation;
        }
        if (spec.slug === "berserker") {
          monster.hitPoints = monster.maxHitPoints * 0.18;
          monster.update(createStaticUpdateContext(monster), new UpdateResult());
          monster.x = 0;
          monster.y = 0;
          monster.angle = spec.angle;
        }
        return monster;
      }

      function createStaticUpdateContext(monster) {
        return {
          deltaSeconds: 0,
          fieldWidth: FRAME_WIDTH,
          fieldHeight: FRAME_HEIGHT,
          activeMonsters: monster.removed ? [] : [monster],
          activeDrones: [],
        };
      }

      function drawFrame(context, monster, particles, frameIndex, monsterSpec) {
        context.save();
        context.fillStyle = "#020807";
        context.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);

        context.strokeStyle = "rgba(255, 255, 255, 0.04)";
        context.lineWidth = 1;
        for (let x = 0; x <= FRAME_WIDTH; x += 48) {
          context.beginPath();
          context.moveTo(x, 0);
          context.lineTo(x, FRAME_HEIGHT);
          context.stroke();
        }
        for (let y = 0; y <= FRAME_HEIGHT; y += 48) {
          context.beginPath();
          context.moveTo(0, y);
          context.lineTo(FRAME_WIDTH, y);
          context.stroke();
        }

        context.translate(FRAME_WIDTH / 2, FRAME_HEIGHT / 2);
        context.scale(monsterSpec.zoom, monsterSpec.zoom);
        context.lineWidth = 1 / monsterSpec.zoom;
        context.strokeStyle = "rgba(255, 255, 255, 0.2)";
        context.strokeRect(-13, -13, 26, 26);

        if (frameIndex === 0) {
          drawIntactMonster(context, monster);
        } else {
          for (const particle of particles) {
            if (!particle.removed) {
              particle.draw(context);
            }
          }
        }

        context.restore();
        context.fillStyle = "rgba(239, 255, 247, 0.94)";
        context.font = "900 28px Avenir Next, Arial Black, Arial, sans-serif";
        context.fillText(monsterSpec.label, 28, 42);
        context.font = "800 22px Avenir Next, Arial, sans-serif";
        const frameLabel = frameIndex === 0 ? "intact" : String(frameIndex).padStart(2, "0");
        context.fillText(frameLabel, 28, 75);
      }

      function drawIntactMonster(context, monster) {
        context.save();
        context.strokeStyle = monster.color;
        context.fillStyle = "#050908";
        context.lineWidth = MONSTER_STROKE_WIDTH;
        monster.drawBody(context);
        context.restore();
      }

      function createSeededRandom(seed) {
        let state = seed >>> 0;
        return () => {
          state = (state + 0x6D2B79F5) >>> 0;
          let value = state;
          value = Math.imul(value ^ (value >>> 15), value | 1);
          value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
          return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
        };
      }
    </script>
  </body>
</html>
`;

const server = await createServer({
  root: repoRoot,
  logLevel: "error",
  server: {
    host: "127.0.0.1",
  },
  plugins: [
    {
      name: "monster-explosion-renderer-page",
      configureServer(viteServer) {
        viteServer.middlewares.use("/__monster-explosion-renderer", (_request, response) => {
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(html);
        });
      },
    },
  ],
});

let browser;
try {
  await server.listen(0);
  const url = server.resolvedUrls.local[0];
  browser = await launchBrowser();
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1,
  });
  await page.goto(`${url}__monster-explosion-renderer`, { waitUntil: "networkidle" });
  const resultHandle = await page.waitForFunction(() => window.__monsterExplosionRender, undefined, { timeout: 10000 });
  const result = await resultHandle.jsonValue();
  await mkdir(outputDir, { recursive: true });

  for (const [filename, dataUrl] of Object.entries(result)) {
    const pngBase64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    await writeFile(path.join(outputDir, `${filename}.png`), Buffer.from(pngBase64, "base64"));
  }

  console.log(outputDir);
} finally {
  await browser?.close();
  await server.close();
}

async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch (error) {
    if (String(error).includes("Executable doesn't exist")) {
      return chromium.launch({ channel: "chrome" });
    }
    throw error;
  }
}
