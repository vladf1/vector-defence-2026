import { runBrowserPage } from "./benchmark-browser-harness.mjs";

const checks = await runBrowserPage({
  path: "/__runtime-checks",
  html: "<!doctype html><body></body>",
  pluginName: "runtime-checks",
}, (page) => page.evaluate(async () => {
  let seed = 42;
  Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const { Game, createLevels } = await import("/src/game-engine.ts");
  const { createMonster } = await import("/src/game-engine/monster-factory.ts");
  const { UpdateResult } = await import("/src/game-engine/update-context.ts");
  const { ActiveCircleSweepCollisionIndex } = await import("/src/game-engine/collision-detection.ts");
  const { GunTower } = await import("/src/entities/towers/gun-tower.ts");
  const { LaserTower } = await import("/src/entities/towers/laser-tower.ts");
  const { Drone } = await import("/src/entities/projectiles/drone.ts");
  const { GunProjectile } = await import("/src/entities/projectiles/gun-projectile.ts");
  const { DESKTOP_GAME_PROFILE, MOBILE_GAME_PROFILE } = await import("/src/game-profile.ts");
  const { CampaignProgressStore } = await import("/src/campaign-progress.ts");
  const { calculateIntercept } = await import("/src/utils.ts");
  const { createHudSnapshot, createModalView } = await import("/src/game-view.ts");
  const { createGameSession } = await import("/src/game-session.ts");
  const { GameRenderer } = await import("/src/game-renderer.ts");
  const { GameAudio } = await import("/src/game-audio.ts");
  const { default: authoredLevels } = await import("/game-levels.json?import");
  const passed = [];
  const check = (condition, name) => {
    if (!condition) throw new Error(name);
    passed.push(name);
  };
  const near = (a, b) => Math.abs(a - b) < 1e-7;
  const path = [{ x: 100, y: 100, totalDistance: 0 }, { x: 1000, y: 100, totalDistance: 900 }];
  const result = new UpdateResult();
  const target = createMonster("square", path, 1, 0);
  target.velocityXPerSecond = target.velocityYPerSecond = 0;
  const index = new ActiveCircleSweepCollisionIndex(64);
  index.rebuild([target]);
  const context = { deltaSeconds: 1 / 60, fieldWidth: 1200, fieldHeight: 600, activeMonsters: [target], activeDrones: [], droneAssignments: new Map(), monsterCollisionIndex: index };
  function makeGame(profile) {
    const canvas = document.createElement("canvas"), background = document.createElement("canvas");
    return new Game(createLevels(profile.mode), background, background.getContext("2d"), canvas, canvas.getContext("2d"), { play() {} }, profile, new CampaignProgressStore(undefined));
  }

  function countShots(entity, seconds, hz) {
    context.deltaSeconds = 1 / hz;
    let shots = 0;
    for (let frame = 0; frame < hz * seconds; frame++) {
      result.clear();
      entity.update(context, result);
      shots += result.projectiles.length;
    }
    return shots;
  }

  for (const hz of [60, 120, 144, 240]) {
    const gun = new GunTower(0, 100);
    gun.angle = 0;
    gun.range = 200;
    const shots = countShots(gun, 60, hz);
    check(shots === 300, `Gun: ${shots} shots in 60 seconds at ${hz} Hz`);
    const drone = new Drone({ x: 60, y: 100 }, 6);
    const droneShots = countShots(drone, 10, hz);
    check(droneShots === 27, `Drone: ${droneShots} shots in 10 seconds at ${hz} Hz`);
    const game = makeGame(DESKTOP_GAME_PROFILE);
    game.startLevelByIndex(0);
    game.runtime.spawnDelay = 0;
    Object.assign(game.activeWave, { count: 1000, spawnIntervalMin: 0.23, spawnIntervalMax: 0.23 });
    game.runtime.escapesLeft = 1000;
    for (let frame = 0; frame < hz * 10; frame++) game.updateSimulation(1 / hz);
    check(game.runtime.spawnedMonsters === 43, `Spawning: ${game.runtime.spawnedMonsters} monsters in 10 seconds at ${hz} Hz`);
  }
  context.deltaSeconds = 1 / 60;
  const idleGun = new GunTower(0, 100);
  idleGun.angle = 0;
  idleGun.range = 200;
  for (let frame = 0; frame < 600; frame++) idleGun.update({ ...context, activeMonsters: [] }, result);
  const idleShots = countShots(idleGun, 0.2, 60);
  check(idleShots === 1, "Idle weapons do not bank shots");

  const sweep = { previousX: 50, previousY: 100, x: 150, y: 100, radius: 1 };
  const collisionTime = index.findEarliestCollision(sweep).time;
  target.shakeFromHit();
  check(target.x === 100 && target.y === 100 && index.findEarliestCollision(sweep).time === collisionTime, "Hit shake leaves position and swept collision unchanged");
  for (const kind of ["packman", "square", "triangle", "tank", "runner", "splitter", "berserker", "bulwark"]) {
    const monster = createMonster(kind, path, 1, 0);
    seed = 42;
    const before = new UpdateResult();
    monster.addDeathEffect(before);
    monster.shakeFromHit();
    const dx = monster.visualX - monster.x, dy = monster.visualY - monster.y;
    seed = 42;
    const after = new UpdateResult();
    monster.addDeathEffect(after);
    const matchingOffsets = before.particles.length === after.particles.length
      && before.particles.every((particle, index) =>
        near(after.particles[index].x - particle.x, dx) && near(after.particles[index].y - particle.y, dy));
    check(matchingOffsets, `${kind}: death particles match the visual shake offset`);
  }
  for (const [velocity, expected] of [[10, 125], [-50, 50], [-100, 100 / 3], [100, 100]]) {
    const intercept = calculateIntercept({ x: 100, y: 0, velocityXPerSecond: velocity, velocityYPerSecond: 0 }, 50, { x: 0, y: 0 });
    check(near(intercept.x, expected), `Intercept: target velocity ${velocity}`);
  }
  const laser = new LaserTower(0, 100);
  laser.angle = 0;
  laser.range = 200;
  const endpoint = laser.beamTarget;
  laser.update(context, result);
  laser.directionLocked = true;
  laser.update(context, result);
  check(laser.beamTarget === endpoint && near(endpoint.x, 1000) && near(endpoint.y, 100), "Laser reuses its endpoint in tracked and locked modes");

  const authoredSequence = authoredLevels[0].monsterSequence;
  try {
    for (const sequence of [["typo-monster"], []]) {
      authoredLevels[0].monsterSequence = sequence;
      let message = "";
      try { createLevels("desktop"); } catch (error) { message = error.message; }
      check(message.includes(authoredLevels[0].name) && message.includes(sequence[0] ?? "non-empty"), `Malformed monster sequence ${JSON.stringify(sequence)} reports its level and cause: ${message}`);
    }
  } finally { authoredLevels[0].monsterSequence = authoredSequence; }
  for (const profile of [DESKTOP_GAME_PROFILE, MOBILE_GAME_PROFILE]) {
    const game = makeGame(profile);
    game.startLevelByIndex(0);
    const tower = game.createTower("gun", { x: 50, y: 100 });
    game.runtime.selectedTower = tower;
    const hud = createHudSnapshot(game);
    check(hud.selectionName === (profile.mode === "mobile" ? "Gun Tower" : "Gun Tower · Level 1 · Range 60") && hud.upgradeLabel === "Upgrade - $5", `${profile.mode}: selection and action labels`);
    game.finishLevel();
    check(createModalView(game).starAward.title === "Perfect route", `${profile.mode}: star award copy`);
    game.startLevelByIndex(0);
    game.runtime.spawnDelay = 999;
    const monster = createMonster("square", path, 1, 0);
    game.runtime.monsters.push(monster);
    game.updateSimulation(1 / 60);
    // No projectiles: the collision index can stay dormant.
    const shot = new GunProjectile({ x: monster.x, y: monster.y }, { x: monster.x + 1, y: monster.y }, 0);
    game.runtime.projectiles.push(shot);
    game.updateSimulation(1 / 60);
    check(shot.removed && monster.hitPoints < monster.maxHitPoints, `${profile.mode}: first projectile activates collision queries`);
  }

  const session = createGameSession(DESKTOP_GAME_PROFILE);
  const originalDraw = GameRenderer.prototype.draw, originalUnlock = GameAudio.prototype.unlock, originalPlay = GameAudio.prototype.play;
  let draws = 0, paintedPlacement;
  GameRenderer.prototype.draw = function () {
    draws++;
    paintedPlacement = this.game.runtime.placingTower;
    originalDraw.call(this);
  };
  GameAudio.prototype.unlock = GameAudio.prototype.play = () => {};
  try {
    const background = document.createElement("canvas"), canvas = document.createElement("canvas");
    document.body.append(background, canvas);
    session.mount(background, canvas);
    session.selectLevel(0);
    session.toggleTowerPlacement("gun");
    await new Promise(requestAnimationFrame);
    check(paintedPlacement === "gun", "Placement is painted before pause");
    const beforePause = draws;
    session.togglePause();
    check(draws === beforePause + 1 && paintedPlacement === undefined, "Pausing immediately paints the cleared placement");
  } finally {
    session.destroy();
    GameRenderer.prototype.draw = originalDraw;
    GameAudio.prototype.unlock = originalUnlock;
    GameAudio.prototype.play = originalPlay;
  }
  return passed;
}));
console.log(`${checks.length} runtime checks passed`);
for (const check of checks) console.log(`  ${check}`);
