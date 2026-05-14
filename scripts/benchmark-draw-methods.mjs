import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const runLightningProfile = process.argv.includes("--lightning-profile");
const runTowerProfile = process.argv.includes("--tower-profile");
const flushCanvas = process.argv.includes("--flush-canvas");

const html = String.raw`
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Draw Method Benchmarks</title>
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
    <canvas id="bench" width="960" height="540"></canvas>
    <script type="module">
      const { BerserkerMonster } = await import("/src/entities/monsters/berserker-monster.ts");
      const { BulwarkMonster } = await import("/src/entities/monsters/bulwark-monster.ts");
      const { PackManMonster } = await import("/src/entities/monsters/packman-monster.ts");
      const { RunnerMonster } = await import("/src/entities/monsters/runner-monster.ts");
      const { SplitterMonster } = await import("/src/entities/monsters/splitter-monster.ts");
      const { SquareMonster } = await import("/src/entities/monsters/square-monster.ts");
      const { TankMonster } = await import("/src/entities/monsters/tank-monster.ts");
      const { TriangleMonster } = await import("/src/entities/monsters/triangle-monster.ts");
      const { GlassShardParticle } = await import("/src/entities/effects/glass-shard-particle.ts");
      const { HitRingEffect } = await import("/src/entities/effects/hit-ring-effect.ts");
      const { LightningLinkEffect } = await import("/src/entities/effects/lightning-link-effect.ts");
      const { LinkEffect } = await import("/src/entities/effects/link-effect.ts");
      const { MissileShockwaveEffect, SmokeParticle, EmberStreakParticle } = await import("/src/entities/effects/missile-explosion-effect.ts");
      const { Particle } = await import("/src/entities/effects/particle.ts");
      const { TankTurretParticle } = await import("/src/entities/effects/tank-turret-particle.ts");
      const { GunTower } = await import("/src/entities/towers/gun-tower.ts");
      const { LaserTower } = await import("/src/entities/towers/laser-tower.ts");
      const { LightningTower } = await import("/src/entities/towers/lightning-tower.ts");
      const { MissileTower } = await import("/src/entities/towers/missile-tower.ts");
      const { SlowTower } = await import("/src/entities/towers/slow-tower.ts");

      const canvas = document.getElementById("bench");
      const context = canvas.getContext("2d", { alpha: false });
      const path = [
        { x: 480, y: 270, totalDistance: 0 },
        { x: 800, y: 270, totalDistance: 320 },
      ];
      const source = { x: 420, y: 250, level: 4, removed: false };
      const target = new TankMonster(path, 1);
      target.x = 535;
      target.y = 282;
      target.angle = 0.35;

      const monsterSpecs = [
        ["monster:berserker.draw", () => prepareMonster(new BerserkerMonster(path, 1), { hitRatio: 0.16 })],
        ["monster:bulwark.draw", () => prepareMonster(new BulwarkMonster(path, 1))],
        ["monster:packman.draw", () => prepareMonster(new PackManMonster(path, 1))],
        ["monster:runner.draw", () => prepareMonster(new RunnerMonster(path, 1))],
        ["monster:splitter.draw", () => prepareMonster(new SplitterMonster(path, 1))],
        ["monster:square.draw", () => prepareMonster(new SquareMonster(path, 1))],
        ["monster:tank.draw", () => prepareMonster(new TankMonster(path, 1))],
        ["monster:triangle.draw", () => prepareMonster(new TriangleMonster(path, 1))],
      ];

      const particleSpecs = [
        ["particle:Particle.draw", () => new Particle(480, 270, 4, "#5df2ef", 0.8, { speedPerSecond: 0, offset: 0, angle: 0 })],
        ["particle:GlassShardParticle.draw", () => new GlassShardParticle(480, 270, "#ff6f62", [
          { x: -5, y: -4 },
          { x: 6, y: -2 },
          { x: 3, y: 5 },
          { x: -4, y: 3 },
        ], { x: 0, y: 0 }, 0.7, 160, 3)],
        ["particle:TankTurretParticle.draw", () => new TankTurretParticle(480, 270, 10.5, "#9fb6ff", 0.3)],
        ["particle:HitRingEffect.draw", () => warmed(new HitRingEffect(480, 270, "#d8ff4f", 18), 0.09)],
        ["particle:MissileShockwaveEffect.draw", () => warmed(new MissileShockwaveEffect(480, 270, 1), 0.08)],
        ["particle:SmokeParticle.draw", () => warmed(new SmokeParticle(480, 270, 0.4), 0.12)],
        ["particle:EmberStreakParticle.draw", () => new EmberStreakParticle(480, 270, 0.4)],
        ["effect:LinkEffect.draw", () => warmed(new LinkEffect(target, "#d8ff4f", 1.8, source), 0.08)],
        ["effect:LightningLinkEffect.draw", () => warmed(new LightningLinkEffect(source, target, "#8ff7ff"), 0.08)],
      ];

      const lightningProfileSpecs = [
        ["lightning:pointsOnly", () => makeLightningProfiler("pointsOnly")],
        ["lightning:singleStrokeNoShadow", () => makeLightningProfiler("singleStrokeNoShadow")],
        ["lightning:twoStrokesNoShadow", () => makeLightningProfiler("twoStrokesNoShadow")],
        ["lightning:singleStrokeShadow", () => makeLightningProfiler("singleStrokeShadow")],
        ["lightning:twoStrokesShadow", () => makeLightningProfiler("twoStrokesShadow")],
        ["lightning:arcsNoShadow", () => makeLightningProfiler("arcsNoShadow")],
        ["lightning:arcsShadow", () => makeLightningProfiler("arcsShadow")],
        ["lightning:arcsBatchedShadow", () => makeLightningProfiler("arcsBatchedShadow")],
        ["lightning:fullWithoutShadow", () => makeLightningProfiler("fullWithoutShadow")],
        ["lightning:fullBatchedArcs", () => makeLightningProfiler("fullBatchedArcs")],
        ["lightning:fullBatchedArcsSegment18", () => makeLightningProfiler("fullBatchedArcsSegment18")],
        ["lightning:fullBatchedArcsSegment27", () => makeLightningProfiler("fullBatchedArcsSegment27")],
        ["lightning:actualDraw", () => warmed(new LightningLinkEffect(source, target, "#8ff7ff"), 0.08)],
      ];

      const towerClasses = [
        ["gun", GunTower],
        ["laser", LaserTower],
        ["missile", MissileTower],
        ["slow", SlowTower],
        ["lightning", LightningTower],
      ];
      const towerProfileSpecs = towerClasses.flatMap(([name, TowerClass]) =>
        Array.from({ length: 7 }, (_, index) => {
          const level = index + 1;
          return [
            "tower:" + name + ":level" + level + ".draw",
            () => createTower(TowerClass, level),
          ];
        }),
      );
      towerProfileSpecs.push([
        "tower:sheet:levels1-7.draw",
        () => towerClasses.flatMap(([, TowerClass]) =>
          Array.from({ length: 7 }, (_, index) => createTower(TowerClass, index + 1)),
        ),
      ]);

      const monsterBodySpecs = monsterSpecs.map(([name, makeMonster]) => [
        name.replace("monster:", "monster-body:").replace(".draw", ".drawBodyOnly"),
        () => makeMonsterBodyDrawable(makeMonster()),
      ]);

      const deathParticleSpecs = monsterSpecs.map(([name, makeMonster]) => [
        name.replace("monster:", "death-particles:").replace(".draw", ".createDeathEffect().particles.draw"),
        () => makeMonster().createDeathEffect().particles,
      ]);

      const benchmarks = [
        ...monsterSpecs.map(([name, make]) => ({ name, kind: "single", make })),
        ...monsterBodySpecs.map(([name, make]) => ({ name, kind: "single", make })),
        ...particleSpecs.map(([name, make]) => ({ name, kind: "single", make })),
        ...deathParticleSpecs.map(([name, make]) => ({ name, kind: "collection", make })),
      ];

      const searchParams = new URLSearchParams(location.search);
      if (searchParams.has("lightning-profile")) {
        window.__drawBenchmarkResults = {
          orders: [],
          summary: lightningProfileSpecs.map(([name, make]) => runBenchmark({
            name,
            kind: "single",
            make,
            warmupIterations: 80,
            measuredIterations: 600,
            flushCanvas: true,
          })).sort((a, b) => b.usPerDraw - a.usPerDraw),
        };
      } else if (searchParams.has("tower-profile")) {
        window.__drawBenchmarkResults = {
          orders: [],
          summary: towerProfileSpecs.map(([name, make]) => runBenchmark({
            name,
            kind: name.includes(":sheet:") ? "collection" : "single",
            make,
            warmupIterations: name.includes(":sheet:") ? 20 : 80,
            measuredIterations: name.includes(":sheet:") ? 80 : 600,
            flushCanvas: true,
          })).sort((a, b) => b.usPerDraw - a.usPerDraw),
        };
      } else {
        runFullBenchmarkSuite();
      }

      function runFullBenchmarkSuite() {
        const orders = getBenchmarkOrders();
        const orderResults = orders.map((order) => ({
          name: order.name,
          results: order.benchmarks.map((benchmark, index) => ({
            orderIndex: index,
            ...runBenchmark({
              ...benchmark,
              flushCanvas: ${flushCanvas ? "true" : "false"},
              warmupIterations: ${flushCanvas ? "30" : "undefined"},
              measuredIterations: ${flushCanvas ? "120" : "undefined"},
            }),
          })),
        }));
        window.__drawBenchmarkResults = {
          orders: orderResults,
          summary: summarizeOrderResults(orderResults),
        };
      }

      function getBenchmarkOrders() {
        if (${flushCanvas ? "true" : "false"}) {
          return [{ name: "original-flushed", benchmarks }];
        }
        return [
          { name: "original", benchmarks },
          { name: "reversed", benchmarks: [...benchmarks].reverse() },
          { name: "shuffle-a", benchmarks: shuffleBenchmarks(benchmarks, 739391) },
          { name: "shuffle-b", benchmarks: shuffleBenchmarks(benchmarks, 991807) },
        ];
      }

      function prepareMonster(monster, options = {}) {
        monster.x = 480;
        monster.y = 270;
        monster.angle = 0.4;
        monster.rotation = 0.7;
        if (options.hitRatio !== undefined) {
          monster.hitPoints = monster.maxHitPoints * options.hitRatio;
          monster.update(0);
          monster.x = 480;
          monster.y = 270;
          monster.angle = 0.4;
        }
        return monster;
      }

      function createTower(TowerClass, level) {
        const tower = new TowerClass(480, 270);
        for (let index = 0; index < level - 1; index += 1) {
          tower.upgrade();
        }
        tower.angle = -Math.PI / 4;
        tower.pulse = Math.PI / 2;
        tower.orbit = 0.74;
        tower.chargeSeconds = 0.08;
        tower.muzzleFlashSeconds = 0.06;
        return tower;
      }

      function makeMonsterBodyDrawable(monster) {
        return {
          draw(context) {
            context.save();
            context.translate(monster.x, monster.y);
            context.strokeStyle = monster.color;
            context.fillStyle = "#050908";
            context.lineWidth = 1.5;
            monster.drawBody(context);
            context.restore();
          },
        };
      }

      function warmed(drawable, seconds) {
        drawable.update(seconds);
        return drawable;
      }

      function makeLightningProfiler(mode) {
        const color = "#8ff7ff";
        const alpha = 0.92 - (3.8 * 0.08);
        const ageSeconds = 0.08;
        const sourceLevel = source.level ?? 0;
        const segmentLength = mode.includes("Segment27")
          ? 27
          : (mode.includes("Segment18") ? 18 : 9);
        return {
          draw(context) {
            const points = createLightningPoints(ageSeconds, segmentLength);
            if (mode === "pointsOnly") {
              return;
            }

            context.save();
            context.globalCompositeOperation = "lighter";
            context.lineCap = "round";
            context.lineJoin = "round";
            if (mode.includes("Shadow")) {
              context.shadowColor = color;
              context.shadowBlur = 10 + sourceLevel;
            }

            if (mode.includes("singleStroke")) {
              context.strokeStyle = colorWithAlpha(color, alpha * 0.42);
              context.lineWidth = 5 + (sourceLevel * 0.32);
              strokeLightningBolt(context, points);
            } else if (mode.includes("twoStrokes")) {
              context.strokeStyle = colorWithAlpha(color, alpha * 0.42);
              context.lineWidth = 5 + (sourceLevel * 0.32);
              strokeLightningBolt(context, points);
              context.strokeStyle = colorWithAlpha("#ffffff", alpha * 0.9);
              context.lineWidth = 1.15 + (sourceLevel * 0.08);
              strokeLightningBolt(context, points);
            } else if (mode.includes("arcsBatched")) {
              context.strokeStyle = colorWithAlpha(color, alpha * 0.72);
              context.lineWidth = 1;
              drawLightningStaticArcsBatched(context, ageSeconds, sourceLevel);
            } else if (mode.includes("arcs")) {
              context.strokeStyle = colorWithAlpha(color, alpha * 0.72);
              context.lineWidth = 1;
              drawLightningStaticArcs(context, ageSeconds, sourceLevel);
            } else if (mode === "fullWithoutShadow") {
              context.strokeStyle = colorWithAlpha(color, alpha * 0.42);
              context.lineWidth = 5 + (sourceLevel * 0.32);
              strokeLightningBolt(context, points);
              context.strokeStyle = colorWithAlpha("#ffffff", alpha * 0.9);
              context.lineWidth = 1.15 + (sourceLevel * 0.08);
              strokeLightningBolt(context, points);
              context.strokeStyle = colorWithAlpha(color, alpha * 0.72);
              context.lineWidth = 1;
              drawLightningStaticArcs(context, ageSeconds, sourceLevel);
            } else if (mode === "fullBatchedArcs" || mode === "fullBatchedArcsSegment18" || mode === "fullBatchedArcsSegment27") {
              context.shadowColor = color;
              context.shadowBlur = 10 + sourceLevel;
              context.strokeStyle = colorWithAlpha(color, alpha * 0.42);
              context.lineWidth = 5 + (sourceLevel * 0.32);
              strokeLightningBolt(context, points);
              context.strokeStyle = colorWithAlpha("#ffffff", alpha * 0.9);
              context.lineWidth = 1.15 + (sourceLevel * 0.08);
              strokeLightningBolt(context, points);
              context.strokeStyle = colorWithAlpha(color, alpha * 0.72);
              context.lineWidth = 1;
              drawLightningStaticArcsBatched(context, ageSeconds, sourceLevel);
            }
            context.restore();
          },
        };
      }

      function createLightningPoints(ageSeconds, segmentLength) {
        const fromX = source.x;
        const fromY = source.y;
        const toX = target.x;
        const toY = target.y;
        const deltaX = toX - fromX;
        const deltaY = toY - fromY;
        const distance = Math.hypot(deltaX, deltaY);
        const segmentCount = Math.max(2, Math.ceil(distance / segmentLength));
        const normalX = distance > 0 ? -deltaY / distance : 0;
        const normalY = distance > 0 ? deltaX / distance : 0;
        const points = [{ x: fromX, y: fromY }];

        for (let index = 1; index < segmentCount; index += 1) {
          const t = index / segmentCount;
          const envelope = Math.sin(Math.PI * t);
          const jitter = Math.sin((ageSeconds * 55) + (index * 4.31)) * 5.6 * envelope;
          points.push({
            x: fromX + (deltaX * t) + (normalX * jitter),
            y: fromY + (deltaY * t) + (normalY * jitter),
          });
        }

        points.push({ x: toX, y: toY });
        return points;
      }

      function strokeLightningBolt(context, points) {
        const start = points[0];
        context.beginPath();
        context.moveTo(start.x, start.y);
        for (let index = 1; index < points.length; index += 1) {
          context.lineTo(points[index].x, points[index].y);
        }
        context.stroke();
      }

      function drawLightningStaticArcs(context, ageSeconds, sourceLevel) {
        const arcCount = Math.min(5, 3 + sourceLevel);
        const radius = target.radius + 4 + (sourceLevel * 0.32);
        const spin = ageSeconds * 18;
        for (let index = 0; index < arcCount; index += 1) {
          const angle = spin + ((Math.PI * 2 * index) / arcCount);
          context.beginPath();
          context.moveTo(
            target.x + (Math.cos(angle) * (radius - 3)),
            target.y + (Math.sin(angle) * (radius - 3)),
          );
          context.lineTo(
            target.x + (Math.cos(angle + 0.22) * (radius + 2.2)),
            target.y + (Math.sin(angle + 0.22) * (radius + 2.2)),
          );
          context.stroke();
        }
      }

      function drawLightningStaticArcsBatched(context, ageSeconds, sourceLevel) {
        const arcCount = Math.min(5, 3 + sourceLevel);
        const radius = target.radius + 4 + (sourceLevel * 0.32);
        const spin = ageSeconds * 18;
        context.beginPath();
        for (let index = 0; index < arcCount; index += 1) {
          const angle = spin + ((Math.PI * 2 * index) / arcCount);
          context.moveTo(
            target.x + (Math.cos(angle) * (radius - 3)),
            target.y + (Math.sin(angle) * (radius - 3)),
          );
          context.lineTo(
            target.x + (Math.cos(angle + 0.22) * (radius + 2.2)),
            target.y + (Math.sin(angle + 0.22) * (radius + 2.2)),
          );
        }
        context.stroke();
      }

      function colorWithAlpha(color, alpha) {
        const normalized = Math.max(0, Math.min(1, alpha));
        const value = Math.round(normalized * 255).toString(16).padStart(2, "0");
        return color + value;
      }

      function runBenchmark(benchmark) {
        const sampleCount = 5;
        const warmupIterations = benchmark.warmupIterations ?? (benchmark.kind === "collection" ? 50 : 500);
        const measuredIterations = benchmark.measuredIterations ?? (benchmark.kind === "collection" ? 180 : 2_500);
        const samples = [];
        const created = benchmark.make();
        const drawables = Array.isArray(created) ? created : [created];
        const drawsPerIteration = drawables.length;

        drawMany(drawables, warmupIterations);
        if (benchmark.flushCanvas) {
          context.getImageData(0, 0, 1, 1);
        }
        for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
          const start = performance.now();
          drawMany(drawables, measuredIterations);
          if (benchmark.flushCanvas) {
            context.getImageData(0, 0, 1, 1);
          }
          const elapsedMs = performance.now() - start;
          samples.push((elapsedMs * 1000) / (measuredIterations * drawsPerIteration));
        }

        samples.sort((a, b) => a - b);
        const medianUs = samples[Math.floor(samples.length / 2)];
        const meanUs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
        return {
          name: benchmark.name,
          drawables: drawsPerIteration,
          usPerDraw: round(medianUs),
          meanUsPerDraw: round(meanUs),
          drawsPerSecond: Math.round(1_000_000 / medianUs),
          sampleMinUs: round(samples[0]),
          sampleMaxUs: round(samples[samples.length - 1]),
        };
      }

      function drawMany(drawables, iterationCount) {
        for (let iteration = 0; iteration < iterationCount; iteration += 1) {
          for (const drawable of drawables) {
            drawable.draw(context);
          }
        }
      }

      function round(value) {
        return Math.round(value * 1000) / 1000;
      }

      function summarizeOrderResults(orderResults) {
        const byName = new Map();
        for (const order of orderResults) {
          for (const result of order.results) {
            const entry = byName.get(result.name) ?? {
              name: result.name,
              drawables: result.drawables,
              orderValues: [],
            };
            entry.orderValues.push({
              order: order.name,
              orderIndex: result.orderIndex,
              usPerDraw: result.usPerDraw,
              meanUsPerDraw: result.meanUsPerDraw,
            });
            byName.set(result.name, entry);
          }
        }

        const summary = [...byName.values()].map((entry) => {
          const values = entry.orderValues.map((value) => value.usPerDraw).sort((a, b) => a - b);
          const min = values[0];
          const max = values[values.length - 1];
          const median = values[Math.floor(values.length / 2)];
          return {
            name: entry.name,
            drawables: entry.drawables,
            medianAcrossOrdersUs: round(median),
            minAcrossOrdersUs: round(min),
            maxAcrossOrdersUs: round(max),
            spreadUs: round(max - min),
            orderValues: entry.orderValues,
          };
        });
        summary.sort((a, b) => b.medianAcrossOrdersUs - a.medianAcrossOrdersUs);
        return summary;
      }

      function shuffleBenchmarks(items, seed) {
        const random = createSeededRandom(seed);
        const shuffled = [...items];
        for (let index = shuffled.length - 1; index > 0; index -= 1) {
          const swapIndex = Math.floor(random() * (index + 1));
          const item = shuffled[index];
          shuffled[index] = shuffled[swapIndex];
          shuffled[swapIndex] = item;
        }
        return shuffled;
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
      name: "draw-benchmark-page",
      configureServer(viteServer) {
        viteServer.middlewares.use("/__draw-benchmark", (_request, response) => {
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
  browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 1,
  });
  const benchmarkUrl = runLightningProfile
    ? `${url}__draw-benchmark?lightning-profile=1`
    : runTowerProfile
      ? `${url}__draw-benchmark?tower-profile=1`
    : `${url}__draw-benchmark${flushCanvas ? "?flush-canvas=1" : ""}`;
  await page.goto(benchmarkUrl, { waitUntil: "networkidle" });
  const results = await page.waitForFunction(() => window.__drawBenchmarkResults, null, { timeout: 120_000 });
  const value = await results.jsonValue();
  if (runLightningProfile || runTowerProfile) {
    console.table(value.summary.map((result) => ({
      name: result.name,
      medianUs: result.usPerDraw,
      meanUs: result.meanUsPerDraw,
      minUs: result.sampleMinUs,
      maxUs: result.sampleMaxUs,
    })));
  } else {
    console.table(value.summary.map((result) => ({
      name: result.name,
      medianUs: result.medianAcrossOrdersUs,
      minUs: result.minAcrossOrdersUs,
      maxUs: result.maxAcrossOrdersUs,
      spreadUs: result.spreadUs,
      orderValues: result.orderValues.map((value) => `${value.order}:${value.usPerDraw}`).join(" "),
    })));
  }
} finally {
  await browser?.close();
  await server.close();
}
