import assert from "node:assert/strict";
import { runBenchmarkPage } from "./benchmark-browser-harness.mjs";

const refreshRates = [15, 30, 60, 90, 120, 144];
const html = String.raw`
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Damage consistency check</title>
  </head>
  <body>
    <script type="module">
      const { BulwarkMonster } = await import("/src/entities/monsters/bulwark-monster.ts");
      const { LaserTower } = await import("/src/entities/towers/laser-tower.ts");
      const { LinearActiveCircleSweepCollisionIndex } = await import("/src/game-engine/collision-detection.ts");
      const { UpdateResult } = await import("/src/game-engine/update-context.ts");
      const { createPathEntries } = await import("/src/route-path.ts");

      const refreshRates = ${JSON.stringify(refreshRates)};
      const damageByRefreshRate = refreshRates.map((refreshRate) => ({
        refreshRate,
        damage: simulateLaserDamage(refreshRate, 0),
      }));
      const upgradedDamageAt60Hz = simulateLaserDamage(60, 6);
      const discreteDamage = measureDamage((monster) => monster.takeDamage(10));
      const continuousDamage = measureDamage((monster) => monster.takeContinuousDamage(10));

      window.__benchmarkResults = {
        damageByRefreshRate,
        upgradedDamageAt60Hz,
        discreteDamage,
        continuousDamage,
      };

      function simulateLaserDamage(refreshRate, towerLevel) {
        const monster = createBulwark();
        const tower = new LaserTower(0, 0);
        const result = new UpdateResult();
        const activeMonsters = [monster];
        const context = {
          deltaSeconds: 1 / refreshRate,
          fieldWidth: 960,
          fieldHeight: 560,
          activeMonsters,
          monsterCollisionIndex: new LinearActiveCircleSweepCollisionIndex(activeMonsters),
          activeDrones: [],
          droneAssignments: new Map(),
        };

        tower.directionLocked = true;
        tower.angle = 0;
        for (let level = 0; level < towerLevel; level += 1) {
          tower.upgrade();
        }

        let beamStarted = false;
        for (let frame = 0; frame < refreshRate * 2; frame += 1) {
          tower.update(context, result);
          beamStarted ||= tower.beamAlpha > 0;
          result.clear();
          if (beamStarted && tower.beamAlpha === 0) {
            break;
          }
        }

        return monster.maxHitPoints - monster.hitPoints;
      }

      function measureDamage(applyDamage) {
        const monster = createBulwark();
        applyDamage(monster);
        return monster.maxHitPoints - monster.hitPoints;
      }

      function createBulwark() {
        const path = createPathEntries([
          { x: 50, y: 0 },
          { x: 500, y: 0 },
        ]);
        return new BulwarkMonster(path, 1);
      }
    </script>
  </body>
</html>
`;

const results = await runBenchmarkPage({
  pluginName: "damage-consistency-check",
  path: "/__damage-consistency-check__",
  html,
});

const damages = results.damageByRefreshRate.map(({ damage }) => damage);
const spread = Math.max(...damages) - Math.min(...damages);
assert.ok(spread < 1e-9, `Laser damage varied across refresh rates by ${spread}.`);
assert.ok(
  Math.abs((results.upgradedDamageAt60Hz / damages[2]) - 2.5) < 1e-9,
  "Laser upgrades must continue to scale continuous damage against Bulwarks.",
);
assert.equal(results.discreteDamage, 6.5, "Bulwark flat armor must still mitigate discrete hits.");
assert.equal(results.continuousDamage, 10, "Continuous damage must not be reduced per callback.");

console.table(results.damageByRefreshRate.map(({ refreshRate, damage }) => ({
  refreshRate: `${refreshRate} Hz`,
  damage: damage.toFixed(6),
})));
console.log("Bulwark discrete hit damage:", results.discreteDamage.toFixed(1));
console.log("Bulwark continuous damage:", results.continuousDamage.toFixed(1));
console.log("Level-6 laser beam damage at 60 Hz:", results.upgradedDamageAt60Hz.toFixed(6));
