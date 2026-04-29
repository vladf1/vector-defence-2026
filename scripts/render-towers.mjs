import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputPath = path.resolve(repoRoot, process.argv[2] ?? "artifacts/tower-render.png");

const html = String.raw`
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Tower Renderer</title>
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
    <canvas id="tower-render"></canvas>
    <script type="module">
      import { FIELD_WIDTH, MAX_TOWER_LEVEL } from "/src/constants.ts";
      import { GunTower } from "/src/entities/towers/gun-tower.ts";
      import { LaserTower } from "/src/entities/towers/laser-tower.ts";
      import { MissileTower } from "/src/entities/towers/missile-tower.ts";
      import { SlowTower } from "/src/entities/towers/slow-tower.ts";

      const towerRows = [
        { label: "Gun", TowerClass: GunTower, angle: -Math.PI / 5 },
        { label: "Laser", TowerClass: LaserTower, angle: -Math.PI / 16 },
        { label: "Missile", TowerClass: MissileTower, angle: -Math.PI / 7 },
        { label: "Slow", TowerClass: SlowTower, pulse: Math.PI / 2 },
      ];

      const cellSize = 182;
      const rowHeaderWidth = 112;
      const titleHeight = 84;
      const levelHeaderHeight = 48;
      const topHeaderHeight = titleHeight + levelHeaderHeight;
      const towerScale = 3.35;
      const width = rowHeaderWidth + ((MAX_TOWER_LEVEL + 1) * cellSize) + 36;
      const height = topHeaderHeight + (towerRows.length * cellSize) + 28;
      const canvas = document.getElementById("tower-render");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");

      context.fillStyle = "#020807";
      context.fillRect(0, 0, width, height);
      drawGrid(context, width, height, cellSize);
      drawLabels(context, towerRows, cellSize, rowHeaderWidth, topHeaderHeight);

      for (const [rowIndex, row] of towerRows.entries()) {
        for (let level = 0; level <= MAX_TOWER_LEVEL; level += 1) {
          const centerX = rowHeaderWidth + (level * cellSize) + (cellSize / 2);
          const centerY = topHeaderHeight + (rowIndex * cellSize) + (cellSize / 2);
          const tower = new row.TowerClass(0, 0);
          for (let upgrade = 0; upgrade < level; upgrade += 1) {
            tower.upgrade();
          }
          if ("angle" in tower && row.angle !== undefined) {
            tower.angle = row.angle;
          }
          if ("pulse" in tower && row.pulse !== undefined) {
            tower.pulse = row.pulse;
          }
          if ("orbit" in tower) {
            tower.orbit = Math.PI / 5;
          }
          context.save();
          context.translate(centerX, centerY);
          context.scale(towerScale, towerScale);
          tower.draw(context, false);
          context.restore();
        }
      }

      window.__towerRenderDataUrl = canvas.toDataURL("image/png");

      function drawGrid(context, width, height, cellSize) {
        context.save();
        context.strokeStyle = "rgba(255, 255, 255, 0.055)";
        context.lineWidth = 1;
        for (let x = 0; x <= width; x += 48) {
          context.beginPath();
          context.moveTo(x, 0);
          context.lineTo(x, height);
          context.stroke();
        }
        for (let y = 0; y <= height; y += 48) {
          context.beginPath();
          context.moveTo(0, y);
          context.lineTo(width, y);
          context.stroke();
        }
        context.strokeStyle = "rgba(255, 255, 255, 0.08)";
        for (let level = 0; level <= MAX_TOWER_LEVEL + 1; level += 1) {
          const x = rowHeaderWidth + (level * cellSize);
          context.beginPath();
          context.moveTo(x, topHeaderHeight);
          context.lineTo(x, height);
          context.stroke();
        }
        context.restore();
      }

      function drawLabels(context, towerRows, cellSize, rowHeaderWidth, topHeaderHeight) {
        context.save();
        context.fillStyle = "rgba(239, 255, 247, 0.94)";
        context.shadowColor = "rgba(92, 255, 158, 0.18)";
        context.shadowBlur = 4;
        context.font = "900 36px Avenir Next, Arial Black, Trebuchet MS, system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText("Tower Upgrade Render Sheet", width / 2, 42);
        context.shadowBlur = 0;

        context.fillStyle = "rgba(239, 255, 247, 0.9)";
        context.font = "900 21px Avenir Next, Arial Black, Trebuchet MS, system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        for (let level = 0; level <= MAX_TOWER_LEVEL; level += 1) {
          context.fillText(String(level + 1), rowHeaderWidth + (level * cellSize) + (cellSize / 2), 112);
        }
        context.textAlign = "right";
        context.font = "900 20px Avenir Next, Arial Black, Trebuchet MS, system-ui, sans-serif";
        for (const [rowIndex, row] of towerRows.entries()) {
          context.fillText(row.label, rowHeaderWidth - 18, topHeaderHeight + (rowIndex * cellSize) + (cellSize / 2));
        }
        context.restore();
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
      name: "tower-renderer-page",
      configureServer(viteServer) {
        viteServer.middlewares.use("/__tower-renderer", (_request, response) => {
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
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 920, height: 540 }, deviceScaleFactor: 2 });
  await page.goto(`${url}__tower-renderer`, { waitUntil: "networkidle" });
  const dataUrl = await page.waitForFunction(() => window.__towerRenderDataUrl, undefined, { timeout: 5000 });
  const pngBase64 = (await dataUrl.jsonValue()).replace(/^data:image\/png;base64,/, "");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(pngBase64, "base64"));
  console.log(outputPath);
} finally {
  await browser?.close();
  await server.close();
}
