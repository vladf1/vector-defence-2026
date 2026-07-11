import { runBenchmarkPage } from "./benchmark-browser-harness.mjs";

const html = String.raw`
<!doctype html>
<html>
  <body>
    <script type="module">
      const {
        ActiveCircleSweepCollisionIndex,
        findEarliestActiveCircleSweepCollision,
      } = await import("/src/game-engine/collision-detection.ts");

      const random = createRandom(0x5eedc0de);
      const cellSizes = [24, 48, 64, 96];
      const scenariosPerCellSize = 1_000;

      for (const cellSize of cellSizes) {
        const index = new ActiveCircleSweepCollisionIndex(cellSize);
        for (let scenario = 0; scenario < scenariosPerCellSize; scenario += 1) {
          const targets = Array.from({ length: 50 }, () => createSweep(random, 36));
          const source = createSweep(random, 180);
          index.rebuild(targets);

          const expected = findEarliestActiveCircleSweepCollision(source, targets);
          const actual = index.findEarliestCollision(source);
          assertSameCollision(expected, actual, cellSize, scenario);
        }
      }

      window.__benchmarkResults = {
        cellSizes,
        scenarios: cellSizes.length * scenariosPerCellSize,
      };

      function createSweep(nextRandom, maxMovement) {
        const previousX = randomRange(nextRandom, -80, 680);
        const previousY = randomRange(nextRandom, -80, 500);
        return {
          previousX,
          previousY,
          x: previousX + randomRange(nextRandom, -maxMovement, maxMovement),
          y: previousY + randomRange(nextRandom, -maxMovement, maxMovement),
          radius: randomRange(nextRandom, 1, 20),
          removed: nextRandom() < 0.04,
          hitPoints: nextRandom() < 0.06 ? 0 : 100,
        };
      }

      function assertSameCollision(expected, actual, cellSize, scenario) {
        if (!expected && !actual) {
          return;
        }
        const timeMatches = expected && actual && Math.abs(expected.time - actual.time) < 1e-12;
        if (!expected || !actual || expected.target !== actual.target || !timeMatches) {
          throw new Error(
            "Collision mismatch for cellSize=" + cellSize
              + " scenario=" + scenario
              + " expected=" + describeCollision(expected)
              + " actual=" + describeCollision(actual),
          );
        }
      }

      function describeCollision(collision) {
        return collision ? collision.time.toFixed(12) : "none";
      }

      function randomRange(nextRandom, min, max) {
        return min + (nextRandom() * (max - min));
      }

      function createRandom(seed) {
        let state = seed >>> 0;
        return () => {
          state = ((state * 1_664_525) + 1_013_904_223) >>> 0;
          return state / 0x1_0000_0000;
        };
      }
    </script>
  </body>
</html>
`;

const result = await runBenchmarkPage({
  html,
  path: "/__validate-collision-index",
  pluginName: "validate-collision-index-page",
});

console.log(`Validated ${result.scenarios} randomized moving-sweep scenarios across cell sizes ${result.cellSizes.join(", ")}.`);
