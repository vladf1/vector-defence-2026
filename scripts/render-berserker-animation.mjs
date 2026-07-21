import path from "node:path";
import process from "node:process";
import { repoRoot, runBrowserPage, waitForPageResult, writeDataUrlPng } from "./benchmark-browser-harness.mjs";

const outputPath = path.resolve(repoRoot, process.argv[2] ?? "artifacts/berserker-rage-animation.png");

const html = String.raw`
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Berserker Rage Animation</title>
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
    <canvas id="sheet"></canvas>
    <script type="module">
      const { BerserkerMonster } = await import("/src/entities/monsters/berserker-monster.ts");
      const { UpdateResult } = await import("/src/game-engine/update-context.ts");
      const { LinearActiveCircleSweepCollisionIndex } = await import("/src/game-engine/collision-detection.ts");

      const FRAME_COUNT = 12;
      const ROWS = [
        { label: "calm", hitRatio: 1 },
        { label: "enraged", hitRatio: 0.49 },
        { label: "frenzied", hitRatio: 0.18 },
        { label: "pack", hitRatio: 0.18, count: 3 },
      ];
      const ANIMATION_SECONDS = 1.05;
      const CELL_SIZE = 220;
      const LABEL_WIDTH = 180;
      const TITLE_HEIGHT = 76;
      const SCALE = 8.5;
      const MONSTER_STROKE_WIDTH = 1.5;
      const WIDTH = LABEL_WIDTH + FRAME_COUNT * CELL_SIZE;
      const HEIGHT = TITLE_HEIGHT + ROWS.length * CELL_SIZE;

      const canvas = document.getElementById("sheet");
      const context = canvas.getContext("2d");
      canvas.width = WIDTH;
      canvas.height = HEIGHT;

      context.fillStyle = "#020807";
      context.fillRect(0, 0, WIDTH, HEIGHT);
      drawTitle(context);

      for (const [rowIndex, row] of ROWS.entries()) {
        const monsters = Array.from({ length: row.count ?? 1 }, (_, index) => createMonster(row.hitRatio, (rowIndex * 10) + index));
        let elapsedSeconds = 0;
        for (let frameIndex = 0; frameIndex < FRAME_COUNT; frameIndex += 1) {
          const targetSeconds = (ANIMATION_SECONDS * frameIndex) / (FRAME_COUNT - 1);
          const deltaSeconds = targetSeconds - elapsedSeconds;
          if (deltaSeconds > 0) {
            for (const monster of monsters) {
              monster.update(createUpdateContext(deltaSeconds, monster), new UpdateResult());
            }
            elapsedSeconds = targetSeconds;
          }
          drawCell(context, monsters, row, rowIndex, frameIndex, targetSeconds);
        }
      }

      window.__berserkerAnimationRender = canvas.toDataURL("image/png");

      function createMonster(hitRatio, seedOffset) {
        Math.random = createSeededRandom(4817 + seedOffset);
        const path = [
          { x: 0, y: 0, totalDistance: 0 },
          { x: 1200, y: 0, totalDistance: 1200 },
        ];
        const monster = new BerserkerMonster(path, 1);
        monster.hitPoints = monster.maxHitPoints * hitRatio;
        monster.angle = 0;
        monster.update(createUpdateContext(0, monster), new UpdateResult());
        monster.x = 0;
        monster.y = 0;
        monster.angle = 0;
        return monster;
      }

      function createUpdateContext(deltaSeconds, monster) {
        const activeMonsters = monster.removed ? [] : [monster];
        return {
          deltaSeconds,
          fieldWidth: 1200,
          fieldHeight: 720,
          activeMonsters,
          monsterCollisionIndex: new LinearActiveCircleSweepCollisionIndex(activeMonsters),
          activeDrones: [],
          droneAssignments: new Map(),
        };
      }

      function drawCell(context, monsters, row, rowIndex, frameIndex, seconds) {
        const x = LABEL_WIDTH + frameIndex * CELL_SIZE;
        const y = TITLE_HEIGHT + rowIndex * CELL_SIZE;

        context.save();
        context.fillStyle = "#04100e";
        context.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        context.strokeStyle = "rgba(239, 255, 247, 0.12)";
        context.strokeRect(x + 0.5, y + 0.5, CELL_SIZE - 1, CELL_SIZE - 1);

        const monsterScale = monsters.length > 1 ? SCALE * 0.72 : SCALE;
        for (const [monsterIndex, monster] of monsters.entries()) {
          context.save();
          context.translate(
            x + CELL_SIZE / 2,
            y + CELL_SIZE / 2 + ((monsterIndex - ((monsters.length - 1) / 2)) * 52),
          );
          context.scale(monsterScale, monsterScale);
          context.strokeStyle = monster.color;
          context.fillStyle = "#050908";
          context.lineWidth = MONSTER_STROKE_WIDTH;
          monster.drawBody(context);
          context.restore();
        }
        context.restore();

        context.fillStyle = "rgba(239, 255, 247, 0.9)";
        context.font = "800 16px Avenir Next, Arial, sans-serif";
        context.fillText(seconds.toFixed(2) + "s", x + 14, y + 28);
      }

      function drawTitle(context) {
        context.fillStyle = "rgba(239, 255, 247, 0.96)";
        context.font = "900 30px Avenir Next, Arial Black, Arial, sans-serif";
        context.fillText("Berserker rage animation / 1.05s", 28, 42);
        context.font = "800 18px Avenir Next, Arial, sans-serif";
        context.fillStyle = "rgba(239, 255, 247, 0.74)";
        context.fillText("frames show the real monster draw method after timed update steps", 28, 66);

        for (const [rowIndex, row] of ROWS.entries()) {
          const y = TITLE_HEIGHT + rowIndex * CELL_SIZE;
          context.fillStyle = "rgba(239, 255, 247, 0.92)";
          context.font = "900 24px Avenir Next, Arial Black, Arial, sans-serif";
          context.fillText(row.label, 28, y + 96);
          context.font = "800 16px Avenir Next, Arial, sans-serif";
          context.fillStyle = "rgba(239, 255, 247, 0.64)";
          const countLabel = row.count ? " x" + row.count : "";
          context.fillText(Math.round(row.hitRatio * 100) + "% health" + countLabel, 28, y + 124);
        }
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

const dataUrl = await runBrowserPage({
  pluginName: "berserker-animation-renderer-page",
  path: "/__berserker-animation-renderer",
  html,
  waitUntil: "networkidle",
  viewport: { width: 1600, height: 720 },
  deviceScaleFactor: 1,
}, (page) => waitForPageResult(page, "__berserkerAnimationRender", 10_000));

await writeDataUrlPng(outputPath, dataUrl);
console.log(outputPath);
