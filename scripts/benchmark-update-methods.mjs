import { runBenchmarkPage } from "./benchmark-browser-harness.mjs";

const html = String.raw`
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Update Benchmarks</title>
  </head>
  <body>
    <script type="module">
      const { Game, createLevels } = await import("/src/game-engine.ts");
      const { DESKTOP_GAME_PROFILE } = await import("/src/game-profile.ts");
      const { createMonster } = await import("/src/game-engine/monster-factory.ts");
      const { createPathEntriesFromDistance } = await import("/src/route-path.ts");
      const { GameState, MonsterKind, TowerKind } = await import("/src/types.ts");
      const { Particle } = await import("/src/entities/effects/particle.ts");
      const { LightningLinkEffect } = await import("/src/entities/effects/lightning-link-effect.ts");
      const { LinkEffect } = await import("/src/entities/effects/link-effect.ts");
      const { Projectile } = await import("/src/entities/projectiles/projectile.ts");
      const { Missile } = await import("/src/entities/projectiles/missile.ts");

      const scenarios = [
        createBusyScenario("busy:mixed-48m-25t", { monsterCount: 48, towerRows: 5, projectileCount: 35, missileCount: 10, particleCount: 80, linkCount: 18 }),
        createBusyScenario("busy:mixed-96m-40t", { monsterCount: 96, towerRows: 8, projectileCount: 80, missileCount: 22, particleCount: 160, linkCount: 36 }),
        createBusyScenario("busy:swarm-180m-40t", { monsterCount: 180, towerRows: 8, projectileCount: 80, missileCount: 22, particleCount: 160, linkCount: 36 }),
        createBusyScenario("busy:projectile-stress", { monsterCount: 140, towerRows: 2, projectileCount: 220, missileCount: 50, particleCount: 80, linkCount: 8 }),
      ];

      window.__benchmarkResults = {
        summary: scenarios.map((scenario) => runUpdateScenario(scenario))
          .sort((a, b) => b.medianUpdateMsPerFrame - a.medianUpdateMsPerFrame),
      };

      function createBusyScenario(name, config) {
        return { name, config };
      }

      function runUpdateScenario(scenario) {
        const game = createBenchmarkGame();
        game.draw = () => {
        };
        populateBusyBoard(game, scenario.config);
        const warmupFrames = 30;
        const sampleCount = 3;
        const framesPerSample = 20;
        const deltaSeconds = 1 / 60;

        for (let frame = 0; frame < warmupFrames; frame += 1) {
          game.update(deltaSeconds);
          maintainBusyBoard(game, scenario.config, frame);
        }

        const samples = [];
        for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
          maintainBusyBoard(game, scenario.config, sampleIndex + warmupFrames);
          game.setState(GameState.Playing);
          game.runtime.escapesLeft = 999999;
          const start = performance.now();
          for (let frame = 0; frame < framesPerSample; frame += 1) {
            game.update(deltaSeconds);
            boundBusyBoard(game, scenario.config);
          }
          samples.push((performance.now() - start) / framesPerSample);
        }

        samples.sort((a, b) => a - b);
        const median = samples[Math.floor(samples.length / 2)];
        const p95 = samples[Math.floor(samples.length * 0.95)];
        const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
        return {
          name: scenario.name,
          medianUpdateMsPerFrame: round(median),
          meanUpdateMsPerFrame: round(mean),
          p95UpdateMsPerFrame: round(p95),
          minUpdateMsPerFrame: round(samples[0]),
          maxUpdateMsPerFrame: round(samples[samples.length - 1]),
          towers: game.runtime.towers.length,
          monsters: game.runtime.monsters.length,
          projectiles: game.runtime.projectiles.length,
          missiles: game.runtime.missiles.length,
          particles: game.runtime.particles.length,
          links: game.runtime.links.length,
          state: game.state,
        };
      }

      function createBenchmarkGame() {
        const gameCanvas = document.createElement("canvas");
        const backgroundCanvas = document.createElement("canvas");
        gameCanvas.width = DESKTOP_GAME_PROFILE.fieldWidth;
        gameCanvas.height = DESKTOP_GAME_PROFILE.fieldHeight;
        backgroundCanvas.width = DESKTOP_GAME_PROFILE.fieldWidth;
        backgroundCanvas.height = DESKTOP_GAME_PROFILE.fieldHeight;
        const audio = { play() {} };
        const game = new Game(
          createLevels("desktop"),
          backgroundCanvas,
          backgroundCanvas.getContext("2d"),
          gameCanvas,
          gameCanvas.getContext("2d"),
          audio,
          DESKTOP_GAME_PROFILE,
        );
        game.startLevelByIndex(9);
        game.runtime.spawnDelay = 999;
        game.runtime.waveSpawnedMonsters = game.activeWave?.count ?? 999;
        game.runtime.spawnedMonsters = game.currentLevel?.monsterCount ?? 999;
        game.runtime.escapesLeft = 999999;
        game.bannerTimer = 0;
        game.setState(GameState.Playing);
        return game;
      }

      function populateBusyBoard(game, config) {
        const routePath = game.runtime.routePath;
        if (!routePath) {
          throw new Error("Expected benchmark level to have a route path.");
        }
        const routeLength = routePath.entries[routePath.entries.length - 1].totalDistance;
        const monsterKinds = [
          MonsterKind.PackMan,
          MonsterKind.Square,
          MonsterKind.Triangle,
          MonsterKind.Tank,
          MonsterKind.Runner,
          MonsterKind.Splitter,
          MonsterKind.Berserker,
          MonsterKind.Bulwark,
        ];
        for (let index = 0; index < config.monsterCount; index += 1) {
          const distance = 12 + ((routeLength - 36) * ((index % config.monsterCount) / config.monsterCount));
          const monster = createMonster(game, monsterKinds[index % monsterKinds.length], createPathEntriesFromDistance(routePath.entries, distance));
          makeBenchmarkMonsterDurable(monster);
          game.runtime.monsters.push(monster);
        }

        const towerKinds = [TowerKind.Gun, TowerKind.Laser, TowerKind.Missile, TowerKind.Slow, TowerKind.Lightning];
        for (let row = 0; row < config.towerRows; row += 1) {
          for (let column = 0; column < towerKinds.length; column += 1) {
            const tower = game.createTower(towerKinds[column], {
              x: 80 + (column * 92) + ((row % 2) * 22),
              y: 70 + (row * 54),
            });
            while (tower.canUpgrade()) {
              tower.upgrade();
            }
            tower.cooldownSeconds = 0;
            tower.angle = 0;
            game.runtime.towers.push(tower);
          }
        }

        maintainBusyBoard(game, config, 0);
      }

      function maintainBusyBoard(game, config, frame) {
        boundBusyBoard(game, config);
        refillMonsters(game, config.monsterCount);
        refillProjectiles(game, config.projectileCount);
        refillMissiles(game, config.missileCount);
        refillParticles(game, config.particleCount, frame);
        refillLinks(game, config.linkCount);
      }

      function boundBusyBoard(game, config) {
        game.runtime.monsters.length = Math.min(game.runtime.monsters.length, config.monsterCount);
        game.runtime.projectiles.length = Math.min(game.runtime.projectiles.length, config.projectileCount);
        game.runtime.missiles.length = Math.min(game.runtime.missiles.length, config.missileCount);
        game.runtime.particles.length = Math.min(game.runtime.particles.length, config.particleCount * 3);
        game.runtime.links.length = Math.min(game.runtime.links.length, config.linkCount * 3);
      }

      function refillMonsters(game, count) {
        const routePath = game.runtime.routePath;
        if (!routePath) {
          return;
        }
        const routeLength = routePath.entries[routePath.entries.length - 1].totalDistance;
        const kinds = [MonsterKind.Runner, MonsterKind.Tank, MonsterKind.Bulwark, MonsterKind.Berserker, MonsterKind.Splitter];
        while (game.runtime.monsters.length < count) {
          const index = game.runtime.monsters.length;
          const distance = 18 + ((routeLength - 48) * ((index % count) / count));
          const monster = createMonster(game, kinds[index % kinds.length], createPathEntriesFromDistance(routePath.entries, distance));
          makeBenchmarkMonsterDurable(monster);
          game.runtime.monsters.push(monster);
        }
      }

      function makeBenchmarkMonsterDurable(monster) {
        monster.hitPoints = 1_000_000_000_000;
        monster.maxHitPoints = 1_000_000_000_000;
        monster.speedPerSecond = 0;
        monster.maxSpeedPerSecond = 0;
        monster.velocityXPerSecond = 0;
        monster.velocityYPerSecond = 0;
      }

      function refillProjectiles(game, count) {
        const targets = game.runtime.monsters;
        while (game.runtime.projectiles.length < count && targets.length > 0) {
          const index = game.runtime.projectiles.length;
          const targetMonster = targets[index % targets.length];
          const projectile = new Projectile(
            { x: 40 + ((index * 37) % 500), y: 40 + ((index * 53) % 300) },
            { x: targetMonster.x + ((index % 5) * 6), y: targetMonster.y },
            0.02,
            4,
          );
          projectile.x = 4 + (index % 7);
          projectile.y = 4 + (index % 11);
          projectile.velocityXPerSecond = 0;
          projectile.velocityYPerSecond = 0;
          game.runtime.projectiles.push(projectile);
        }
      }

      function refillMissiles(game, count) {
        const targets = game.runtime.monsters;
        while (game.runtime.missiles.length < count && targets.length > 0) {
          const index = game.runtime.missiles.length;
          const targetMonster = targets[(index * 3) % targets.length];
          const missile = new Missile(
            { x: 60 + ((index * 71) % 460), y: 60 + ((index * 41) % 280) },
            targetMonster,
            0.04,
            72,
            180,
            0.3 + (index * 0.17),
          );
          missile.x = 260 + (index % 17);
          missile.y = 20 + (index % 13);
          missile.trackedMonster = undefined;
          missile.angle = 0;
          missile.speedPerSecond = -180;
          game.runtime.missiles.push(missile);
        }
      }

      function refillParticles(game, count, frame) {
        while (game.runtime.particles.length < count) {
          const index = game.runtime.particles.length + frame;
          game.addParticle(new Particle(
            30 + ((index * 29) % 560),
            30 + ((index * 31) % 340),
            2 + (index % 4),
            index % 2 === 0 ? "#8ff7ff" : "#ff8f45",
            0.15,
            { speedPerSecond: 30 + (index % 80), offset: 0, angle: index * 0.31 },
          ));
        }
      }

      function refillLinks(game, count) {
        const targets = game.runtime.monsters;
        while (game.runtime.links.length < count && targets.length > 0) {
          const index = game.runtime.links.length;
          const targetMonster = targets[(index * 5) % targets.length];
          const source = {
            x: 90 + ((index * 83) % 420),
            y: 70 + ((index * 47) % 260),
            level: 6,
            removed: false,
          };
          game.addLink(index % 2 === 0
            ? new LightningLinkEffect(source, targetMonster, "#8ff7ff")
            : new LinkEffect(targetMonster, "#d8ff4f", 0.2, source));
        }
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
  path: "/__update-benchmark",
  pluginName: "update-benchmark-page",
  timeoutMs: 120_000,
});

console.table(value.summary);
