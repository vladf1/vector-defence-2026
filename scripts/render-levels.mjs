import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.resolve(repoRoot, process.argv[2] ?? "artifacts/level-renders");

const html = String.raw`
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Level Renderer</title>
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
    <canvas id="level-render"></canvas>
    <script type="module">
      import levelsJson from "/game-levels.json";
      import { DESKTOP_GAME_PROFILE, MOBILE_GAME_PROFILE, GameMode } from "/src/game-profile.ts";
      import { createRouteMotionPath } from "/src/route-path.ts";
      import { calculateDistance, isWithinDistanceToSegment, withinDistance } from "/src/utils.ts";

      const ROAD_COLOR = "rgba(8, 40, 36, 0.96)";
      const ROAD_BORDER_COLOR = "rgb(18, 61, 54)";
      const VALID_TOWER_COLOR = "rgba(91, 255, 158, 0.6)";
      const VALID_TOWER_RING = "rgba(91, 255, 158, 0.22)";
      const EXIT_MARKER_RADIUS = 18;

      const canvas = document.getElementById("level-render");
      const context = canvas.getContext("2d");

      window.__levelRender = {
        render(mode) {
          const profile = mode === GameMode.Mobile ? MOBILE_GAME_PROFILE : DESKTOP_GAME_PROFILE;
          const levels = normalizeLevels(levelsJson, mode);
          const cellPadding = mode === GameMode.Mobile ? 28 : 34;
          const titleHeight = mode === GameMode.Mobile ? 56 : 58;
          const footerHeight = mode === GameMode.Mobile ? 42 : 40;
          const cellWidth = profile.fieldWidth + (cellPadding * 2);
          const cellHeight = profile.fieldHeight + titleHeight + footerHeight + (cellPadding * 2);
          const columns = mode === GameMode.Mobile ? 2 : 2;
          const rows = Math.ceil(levels.length / columns);
          const width = columns * cellWidth;
          const height = rows * cellHeight;

          canvas.width = width * 2;
          canvas.height = height * 2;
          canvas.style.width = width + "px";
          canvas.style.height = height + "px";
          context.setTransform(2, 0, 0, 2, 0, 0);
          context.fillStyle = "#020807";
          context.fillRect(0, 0, width, height);

          const metrics = [];
          for (const [index, level] of levels.entries()) {
            const column = index % columns;
            const row = Math.floor(index / columns);
            const x = column * cellWidth;
            const y = row * cellHeight;
            metrics.push(drawLevel(context, level, profile, index, x, y, cellWidth, cellHeight, cellPadding, titleHeight, footerHeight));
          }

          return {
            dataUrl: canvas.toDataURL("image/png"),
            metrics,
          };
        },
      };

      function normalizeLevels(data, mode) {
        return data.map((level) => {
          const normalized = mode !== GameMode.Mobile || !level.mobile
            ? { ...level }
            : { ...level, ...level.mobile };
          delete normalized.mobile;
          return {
            ...normalized,
            points: normalized.points.map(normalizeLevelPoint),
          };
        });
      }

      function normalizeLevelPoint(point) {
        const [x, y] = point;
        return { x, y };
      }

      function drawLevel(context, level, profile, index, x, y, cellWidth, cellHeight, cellPadding, titleHeight, footerHeight) {
        const fieldX = x + cellPadding;
        const fieldY = y + titleHeight + cellPadding;
        const routePath = createRouteMotionPath(level.points, profile.roadTurnRadius, profile.routeCurveSampleStep);
        const candidates = findPlacementCandidates(routePath, profile);
        const pathLength = routePath.entries[routePath.entries.length - 1]?.totalDistance ?? 0;

        drawCardBackground(context, x, y, cellWidth, cellHeight);
        drawTitle(context, level, index, x, y, cellWidth, titleHeight);

        context.save();
        context.translate(fieldX, fieldY);
        drawField(context, profile);
        drawPlacementCandidates(context, candidates, profile);
        drawRoute(context, routePath, level, profile);
        context.restore();

        drawFooter(context, level, profile, candidates.length, pathLength, x, fieldY + profile.fieldHeight, cellWidth, footerHeight);

        return {
          level: index + 1,
          name: level.name,
          candidates: candidates.length,
          pathLength: Math.round(pathLength),
          pointCount: level.points.length,
        };
      }

      function drawCardBackground(context, x, y, width, height) {
        context.save();
        context.fillStyle = "#020807";
        context.fillRect(x, y, width, height);
        context.strokeStyle = "rgba(255, 255, 255, 0.08)";
        context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
        context.restore();
      }

      function drawTitle(context, level, index, x, y, width, titleHeight) {
        context.save();
        context.fillStyle = "rgba(239, 255, 247, 0.95)";
        context.font = "900 20px Avenir Next, Arial Black, Trebuchet MS, system-ui, sans-serif";
        context.textAlign = "left";
        context.textBaseline = "middle";
        context.fillText(String(index + 1).padStart(2, "0") + " " + level.name, x + 22, y + (titleHeight / 2));
        context.restore();
      }

      function drawFooter(context, level, profile, candidateCount, pathLength, x, y, width, footerHeight) {
        context.save();
        context.fillStyle = "rgba(239, 255, 247, 0.72)";
        context.font = "700 13px Inter, system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        const text = profile.mode + "  |  " + candidateCount + " tower gaps  |  route " + Math.round(pathLength) + "px  |  $" + level.startingMoney;
        context.fillText(text, x + (width / 2), y + (footerHeight / 2));
        context.restore();
      }

      function drawField(context, profile) {
        const gradient = context.createLinearGradient(0, 0, 0, profile.fieldHeight);
        gradient.addColorStop(0, "#010302");
        gradient.addColorStop(0.5, "#050d0a");
        gradient.addColorStop(1, "#010302");
        context.fillStyle = gradient;
        context.fillRect(0, 0, profile.fieldWidth, profile.fieldHeight);

        context.save();
        context.strokeStyle = "rgba(255, 255, 255, 0.06)";
        context.lineWidth = 1;
        for (let gridX = 0; gridX <= profile.fieldWidth; gridX += 35) {
          context.beginPath();
          context.moveTo(gridX, 0);
          context.lineTo(gridX, profile.fieldHeight);
          context.stroke();
        }
        for (let gridY = 0; gridY <= profile.fieldHeight; gridY += 35) {
          context.beginPath();
          context.moveTo(0, gridY);
          context.lineTo(profile.fieldWidth, gridY);
          context.stroke();
        }
        context.restore();
      }

      function drawPlacementCandidates(context, candidates, profile) {
        context.save();
        for (const candidate of candidates) {
          context.fillStyle = VALID_TOWER_COLOR;
          context.beginPath();
          context.arc(candidate.x, candidate.y, profile.mode === GameMode.Mobile ? 2.5 : 3, 0, Math.PI * 2);
          context.fill();
        }
        for (const candidate of candidates) {
          context.strokeStyle = VALID_TOWER_RING;
          context.beginPath();
          context.arc(candidate.x, candidate.y, profile.towerRadius, 0, Math.PI * 2);
          context.stroke();
        }
        context.restore();
      }

      function drawRoute(context, routePath, level, profile) {
        const last = level.points[level.points.length - 1];
        context.save();
        context.lineJoin = "round";
        context.lineCap = "round";

        context.strokeStyle = ROAD_BORDER_COLOR;
        context.lineWidth = profile.roadWidth + 3;
        traceRoutePath(context, routePath);
        context.stroke();

        context.fillStyle = ROAD_BORDER_COLOR;
        context.beginPath();
        context.arc(last.x, last.y, EXIT_MARKER_RADIUS + 1.5, 0, Math.PI * 2);
        context.fill();

        context.strokeStyle = ROAD_COLOR;
        context.lineWidth = profile.roadWidth;
        traceRoutePath(context, routePath);
        context.stroke();

        context.fillStyle = ROAD_COLOR;
        context.beginPath();
        context.arc(last.x, last.y, EXIT_MARKER_RADIUS, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = "rgba(238, 255, 248, 0.86)";
        context.font = "700 15px Inter, system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(String(level.allowEscape), last.x, last.y + 1);
        context.restore();
      }

      function traceRoutePath(context, routePath) {
        context.beginPath();
        context.moveTo(routePath.start.x, routePath.start.y);
        for (const command of routePath.commands) {
          if (command.kind === "line") {
            context.lineTo(command.point.x, command.point.y);
          } else {
            context.quadraticCurveTo(command.control.x, command.control.y, command.point.x, command.point.y);
          }
        }
      }

      function findPlacementCandidates(routePath, profile) {
        const candidates = [];
        const step = profile.mode === GameMode.Mobile ? 27 : 32;
        const start = profile.towerRadius + 2;
        for (let y = start; y <= profile.fieldHeight - profile.towerRadius; y += step) {
          for (let x = start; x <= profile.fieldWidth - profile.towerRadius; x += step) {
            const point = { x, y };
            if (!canPlaceCandidate(point, routePath, candidates, profile)) {
              continue;
            }
            candidates.push(point);
          }
        }
        return candidates;
      }

      function canPlaceCandidate(point, routePath, candidates, profile) {
        for (const candidate of candidates) {
          if (withinDistance(point, candidate, profile.placement.minDistanceToOtherTowers)) {
            return false;
          }
        }
        for (let index = 0; index < routePath.entries.length - 1; index += 1) {
          const start = routePath.entries[index];
          const end = routePath.entries[index + 1];
          if (isWithinDistanceToSegment(point, start, end, profile.placement.minDistanceToRoad)) {
            return false;
          }
        }
        return true;
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
      name: "level-renderer-page",
      configureServer(viteServer) {
        viteServer.middlewares.use("/__level-renderer", (_request, response) => {
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
  browser = await launchChromium();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(`${url}__level-renderer`, { waitUntil: "networkidle" });
  await mkdir(outputDir, { recursive: true });

  const summaries = [];
  for (const mode of ["desktop", "mobile"]) {
    const result = await page.evaluate((renderMode) => window.__levelRender.render(renderMode), mode);
    const pngBase64 = result.dataUrl.replace(/^data:image\/png;base64,/, "");
    const outputPath = path.join(outputDir, `${mode}.png`);
    await writeFile(outputPath, Buffer.from(pngBase64, "base64"));
    summaries.push({ mode, outputPath, metrics: result.metrics });
  }

  const summaryPath = path.join(outputDir, "summary.json");
  await writeFile(summaryPath, `${JSON.stringify(summaries, null, 2)}\n`);
  console.log(summaryPath);
  for (const summary of summaries) {
    console.log(summary.outputPath);
  }
} finally {
  await browser?.close();
  await server.close();
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
