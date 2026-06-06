import fs from "node:fs";
import path from "node:path";
import { repoRoot, runBenchmarkPage } from "./benchmark-browser-harness.mjs";

const comparisonPath = path.resolve(repoRoot, "artifacts/escape-fragment-bitmap-comparison.png");

const html = String.raw`
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Escape Fragment Bitmap Benchmarks</title>
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
      const { EscapeFragmentParticle } = await import("/src/entities/effects/escape-fragment-particle.ts");
      const { FastEscapeFragmentParticle } = await import("/src/entities/effects/fast-escape-fragment-particle.ts");
      const {
        BitmapEscapeFragmentParticle,
        prewarmBitmapEscapeFragmentSprites,
      } = await import("/src/entities/effects/bitmap-escape-fragment-particle.ts");
      const { randomRange } = await import("/src/utils.ts");

      const canvas = document.getElementById("bench");
      const context = canvas.getContext("2d", { alpha: false });
      const FIELD_WIDTH = 960;
      const FIELD_HEIGHT = 540;
      const BURST_X = 480;
      const BURST_Y = 270;
      const LARGE_FRAGMENT_COUNT = 88;
      const SMALL_FRAGMENT_COUNT = 48;
      const SMOKE_COUNT = 0;
      const STATIC_EFFECT_COUNT = 0;
      const FRAGMENT_COUNT = LARGE_FRAGMENT_COUNT + SMALL_FRAGMENT_COUNT;
      const PARTICLES_PER_BURST = FRAGMENT_COUNT + SMOKE_COUNT + STATIC_EFFECT_COUNT;
      const COLORS = ["#b0ffe1", "#6df0c2", "#ffe36f", "#f4fff8", "#7fd7ff"];
      const UPDATE_CONTEXT = {
        deltaSeconds: 1 / 60,
        fieldWidth: FIELD_WIDTH,
        fieldHeight: FIELD_HEIGHT,
        activeMonsters: [],
      };

      const cacheStart = performance.now();
      await withSeedAsync(2001, async () => {
        await prewarmBitmapEscapeFragmentSprites();
      });
      const cacheGenerationMs = performance.now() - cacheStart;

      window.__benchmarkResults = {
        cache: [{
          method: "bitmap sprite cache generation",
          sprites: 240,
          ms: round(cacheGenerationMs),
        }],
        spawn: [
          runSpawnBenchmark("vector escape burst spawn", EscapeFragmentParticle, 3101),
          runSpawnBenchmark("fast vector escape burst spawn", FastEscapeFragmentParticle, 3101),
          runSpawnBenchmark("bitmap escape burst spawn warm-cache", BitmapEscapeFragmentParticle, 3101),
        ],
        draw: [
          runDrawBenchmark("vector fragments draw only", () => makeFragments(EscapeFragmentParticle, FRAGMENT_COUNT, 4101)),
          runDrawBenchmark("fast vector fragments draw only", () => makeFragments(FastEscapeFragmentParticle, FRAGMENT_COUNT, 4101)),
          runDrawBenchmark("bitmap fragments draw only", () => makeFragments(BitmapEscapeFragmentParticle, FRAGMENT_COUNT, 4101)),
          runDrawBenchmark("vector full escape burst draw only", () => createEscapeBurst(EscapeFragmentParticle, 5101)),
          runDrawBenchmark("fast vector full escape burst draw only", () => createEscapeBurst(FastEscapeFragmentParticle, 5101)),
          runDrawBenchmark("bitmap full escape burst draw only", () => createEscapeBurst(BitmapEscapeFragmentParticle, 5101)),
          runDrawBenchmark("vector three overlapping bursts draw only", () => createOverlappingBursts(EscapeFragmentParticle, 6101)),
          runDrawBenchmark("fast vector three overlapping bursts draw only", () => createOverlappingBursts(FastEscapeFragmentParticle, 6101)),
          runDrawBenchmark("bitmap three overlapping bursts draw only", () => createOverlappingBursts(BitmapEscapeFragmentParticle, 6101)),
        ],
        frame: [
          runFrameBenchmark("vector repeated-burst update+draw", EscapeFragmentParticle, 7101),
          runFrameBenchmark("fast vector repeated-burst update+draw", FastEscapeFragmentParticle, 7101),
          runFrameBenchmark("bitmap repeated-burst update+draw", BitmapEscapeFragmentParticle, 7101),
        ],
        comparisonPngDataUrl: createComparisonPngDataUrl(),
      };

      function runSpawnBenchmark(name, FragmentClass, seed) {
        const sampleCount = 7;
        const burstsPerSample = 260;
        const samples = [];
        for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
          const particleCount = withSeed(seed + sampleIndex, () => {
            const start = performance.now();
            let count = 0;
            for (let burstIndex = 0; burstIndex < burstsPerSample; burstIndex += 1) {
              count += createEscapeBurst(FragmentClass, seed + burstIndex).length;
            }
            samples.push(performance.now() - start);
            return count;
          });
          if (particleCount !== burstsPerSample * PARTICLES_PER_BURST) {
            throw new Error("Unexpected escape burst particle count.");
          }
        }

        const medianMs = median(samples);
        return {
          method: name,
          bursts: burstsPerSample,
          particlesPerBurst: PARTICLES_PER_BURST,
          msPerBurst: round(medianMs / burstsPerSample),
          usPerParticle: round((medianMs * 1000) / (burstsPerSample * PARTICLES_PER_BURST)),
          minMs: round(Math.min(...samples)),
          maxMs: round(Math.max(...samples)),
        };
      }

      function runDrawBenchmark(name, makeParticles) {
        const sampleCount = 7;
        const warmupIterations = 30;
        const measuredIterations = 140;
        const particles = makeParticles();
        const samples = [];

        drawParticlesMany(particles, warmupIterations);
        context.getImageData(0, 0, 1, 1);
        for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
          const start = performance.now();
          drawParticlesMany(particles, measuredIterations);
          context.getImageData(0, 0, 1, 1);
          samples.push(performance.now() - start);
        }

        const medianMs = median(samples);
        return {
          method: name,
          particles: particles.length,
          msPerFrame: round(medianMs / measuredIterations),
          usPerParticleDraw: round((medianMs * 1000) / (measuredIterations * particles.length)),
          minMs: round(Math.min(...samples)),
          maxMs: round(Math.max(...samples)),
        };
      }

      function runFrameBenchmark(name, FragmentClass, seed) {
        const sampleCount = 5;
        const warmupFrames = 30;
        const measuredFrames = 210;
        const samples = [];
        const maxParticleCounts = [];

        for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
          const result = withSeed(seed + sampleIndex, () => {
            const particles = [];
            let maxParticleCount = 0;
            for (let frame = 0; frame < warmupFrames; frame += 1) {
              advanceRepeatedBurstFrame(particles, FragmentClass, frame);
              maxParticleCount = Math.max(maxParticleCount, particles.length);
            }

            const start = performance.now();
            for (let frame = 0; frame < measuredFrames; frame += 1) {
              advanceRepeatedBurstFrame(particles, FragmentClass, frame + warmupFrames);
              maxParticleCount = Math.max(maxParticleCount, particles.length);
            }
            context.getImageData(0, 0, 1, 1);

            return {
              elapsedMs: performance.now() - start,
              maxParticleCount,
            };
          });
          samples.push(result.elapsedMs);
          maxParticleCounts.push(result.maxParticleCount);
        }

        const medianMs = median(samples);
        return {
          method: name,
          measuredFrames,
          msPerFrame: round(medianMs / measuredFrames),
          maxParticles: Math.max(...maxParticleCounts),
          minMs: round(Math.min(...samples)),
          maxMs: round(Math.max(...samples)),
        };
      }

      function advanceRepeatedBurstFrame(particles, FragmentClass, frame) {
        if (frame % 34 === 0) {
          particles.push(...createEscapeBurst(FragmentClass, 8000 + frame));
        }

        for (const particle of particles) {
          if (!particle.removed) {
            particle.update(UPDATE_CONTEXT);
          }
        }

        for (let index = particles.length - 1; index >= 0; index -= 1) {
          if (particles[index].removed) {
            particles.splice(index, 1);
          }
        }

        drawParticles(particles);
      }

      function drawParticlesMany(particles, iterationCount) {
        for (let iteration = 0; iteration < iterationCount; iteration += 1) {
          drawParticles(particles);
        }
      }

      function drawParticles(particles) {
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.globalAlpha = 1;
        context.globalCompositeOperation = "source-over";
        context.clearRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
        context.fillStyle = "#020807";
        context.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
        for (const particle of particles) {
          if (!particle.removed) {
            particle.draw(context);
          }
        }
      }

      function createOverlappingBursts(FragmentClass, seed) {
        return [
          ...createEscapeBurstAt(FragmentClass, BURST_X - 54, BURST_Y + 8, seed),
          ...createEscapeBurstAt(FragmentClass, BURST_X + 8, BURST_Y - 30, seed + 1),
          ...createEscapeBurstAt(FragmentClass, BURST_X + 62, BURST_Y + 22, seed + 2),
        ];
      }

      function createEscapeBurst(FragmentClass, seed) {
        return createEscapeBurstAt(FragmentClass, BURST_X, BURST_Y, seed);
      }

      function createEscapeBurstAt(FragmentClass, x, y, seed) {
        return withSeed(seed, () => {
          const particles = [];

          for (let index = 0; index < LARGE_FRAGMENT_COUNT; index += 1) {
            particles.push(createLargeFragment(FragmentClass, x, y));
          }

          for (let index = 0; index < SMALL_FRAGMENT_COUNT; index += 1) {
            particles.push(createSmallFragment(FragmentClass, x, y));
          }

          return particles;
        });
      }

      function makeFragments(FragmentClass, count, seed) {
        return withSeed(seed, () => {
          const particles = [];
          for (let index = 0; index < count; index += 1) {
            particles.push(index < LARGE_FRAGMENT_COUNT
              ? createLargeFragment(FragmentClass, BURST_X, BURST_Y)
              : createSmallFragment(FragmentClass, BURST_X, BURST_Y));
          }
          return particles;
        });
      }

      function createLargeFragment(FragmentClass, x, y) {
        return new FragmentClass(
          x,
          y,
          getRandomColor(),
          randomRange(-Math.PI, Math.PI),
          randomRange(185, 500),
          randomRange(5.5, 13),
          randomRange(2.4, 5.2),
          randomRange(3, 9),
        );
      }

      function createSmallFragment(FragmentClass, x, y) {
        return new FragmentClass(
          x,
          y,
          getRandomColor(),
          randomRange(-Math.PI, Math.PI),
          randomRange(260, 620),
          randomRange(2.8, 6.8),
          randomRange(1.1, 2.6),
          randomRange(2, 11),
        );
      }

      function getRandomColor() {
        return COLORS[Math.floor(randomRange(0, COLORS.length))] ?? "#b0ffe1";
      }

      function createComparisonPngDataUrl() {
        const comparisonCanvas = document.createElement("canvas");
        comparisonCanvas.width = 1120;
        comparisonCanvas.height = 420;
        const comparisonContext = comparisonCanvas.getContext("2d", { alpha: false });
        if (!comparisonContext) {
          throw new Error("Comparison canvas could not be initialized.");
        }

        comparisonContext.fillStyle = "#020807";
        comparisonContext.fillRect(0, 0, comparisonCanvas.width, comparisonCanvas.height);
        comparisonContext.font = "700 22px Avenir Next, sans-serif";
        comparisonContext.textAlign = "center";
        comparisonContext.fillStyle = "#f4fff8";
        comparisonContext.fillText("Vector fragments", 280, 38);
        comparisonContext.fillText("Cached bitmap fragments", 840, 38);

        drawComparisonBurst(comparisonContext, EscapeFragmentParticle, 280, 230, 9101);
        drawComparisonBurst(comparisonContext, BitmapEscapeFragmentParticle, 840, 230, 9101);
        return comparisonCanvas.toDataURL("image/png");
      }

      function drawComparisonBurst(targetContext, FragmentClass, x, y, seed) {
        const particles = createEscapeBurstAt(FragmentClass, x, y, seed);
        for (let frame = 0; frame < 9; frame += 1) {
          for (const particle of particles) {
            if (!particle.removed) {
              particle.update(UPDATE_CONTEXT);
            }
          }
        }

        for (const particle of particles) {
          if (!particle.removed) {
            particle.draw(targetContext);
          }
        }
      }

      function withSeed(seed, action) {
        const originalRandom = Math.random;
        Math.random = createSeededRandom(seed);
        try {
          return action();
        } finally {
          Math.random = originalRandom;
        }
      }

      async function withSeedAsync(seed, action) {
        const originalRandom = Math.random;
        Math.random = createSeededRandom(seed);
        try {
          return await action();
        } finally {
          Math.random = originalRandom;
        }
      }

      function createSeededRandom(seed) {
        let state = seed >>> 0;
        return () => {
          state += 0x6D2B79F5;
          let value = state;
          value = Math.imul(value ^ (value >>> 15), value | 1);
          value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
          return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
        };
      }

      function median(values) {
        const sorted = values.toSorted((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
      }

      function round(value) {
        return Math.round(value * 1000) / 1000;
      }
    </script>
  </body>
</html>
`;

const value = await runBenchmarkPage({
  html,
  path: "/__escape-fragment-benchmark",
  pluginName: "escape-fragment-benchmark-page",
  timeoutMs: 180_000,
});

fs.mkdirSync(path.dirname(comparisonPath), { recursive: true });
const pngData = value.comparisonPngDataUrl.replace(/^data:image\/png;base64,/, "");
fs.writeFileSync(comparisonPath, Buffer.from(pngData, "base64"));

console.log(`Comparison image: ${comparisonPath}`);
console.log("\nCache");
console.table(value.cache);
console.log("\nSpawn");
console.table(value.spawn);
console.log("\nDraw");
console.table(value.draw);
console.log("\nRepeated burst frame");
console.table(value.frame);
