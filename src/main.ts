import "./style.css";
import levelsJson from "../Levels.json";
import { createCampaignLevels } from "./campaign";
import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  MAX_LINKS,
  MAX_PARTICLES,
  MIN_DISTANCE_TO_OTHER_TOWERS,
  MIN_DISTANCE_TO_ROAD,
  STARTING_MONEY,
  TOWER_RADIUS,
  TOWER_SPECS,
} from "./constants";
import {
  LinkEffect,
  Missile,
  Monster,
  Particle,
  Projectile,
  Tower,
  createTower,
} from "./entities";
import {
  compactInPlace,
  distanceSquaredXY,
  formatMoney,
  must,
  normalizeLevels,
  pointToSegmentDistanceSquaredXY,
  randomRange,
} from "./utils";
import {
  TowerKind,
  type GameState,
  type HudSnapshot,
  type LevelData,
  type LevelJsonData,
  type Point,
  type WaveData,
} from "./types";

const TOWER_KINDS = [TowerKind.Gun, TowerKind.Laser, TowerKind.Missile, TowerKind.Slow] as const;

const TOWER_SHORTCUTS: Record<TowerKind, string[]> = {
  [TowerKind.Gun]: ["1", "g"],
  [TowerKind.Laser]: ["2", "l"],
  [TowerKind.Missile]: ["3", "m"],
  [TowerKind.Slow]: ["4", "s"],
};

function isBattleState(state: GameState): state is "playing" | "paused" {
  return state === "playing" || state === "paused";
}

function isModalState(state: GameState): boolean {
  return state === "menu" || state === "won" || state === "lost" || state === "campaign-won";
}

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing app root.");
}

root.innerHTML = `
  <div class="shell">
    <header class="topbar">
      <div class="title-block">
        <h1>Vector Defence</h1>
        <p>Push through a full ten-level campaign, survive every wave, and secure the frontier.</p>
      </div>
      <div class="actions">
        <button class="chrome-button" id="pause-button">Pause</button>
        <button class="chrome-button" id="level-button">Campaign</button>
        <button class="chrome-button" id="restart-button">Restart</button>
      </div>
    </header>

    <section class="hud">
      <div class="stat-card">
        <span>Level</span>
        <strong id="level-name">Campaign Map</strong>
      </div>
      <div class="stat-card">
        <span>Money</span>
        <strong id="money-value">$0</strong>
      </div>
      <div class="stat-card">
        <span>Leaks Left</span>
        <strong id="escapes-value">0</strong>
      </div>
      <div class="stat-card">
        <span>Wave</span>
        <strong id="wave-value">Idle</strong>
      </div>
    </section>

    <section class="board-card">
      <div class="board-frame">
        <canvas id="game" width="${FIELD_WIDTH}" height="${FIELD_HEIGHT}"></canvas>
        <div class="banner"><div class="banner-chip" id="banner">Awaiting orders</div></div>
        <div class="modal" id="modal"></div>
      </div>
    </section>

    <section class="controls-grid">
      <div class="control-card">
        <div class="tower-strip" id="tower-strip"></div>
      </div>
      <div class="control-card selection-card">
        <div class="selection-copy">
          <strong id="selection-title">No tower selected</strong>
          <span id="selection-body">Choose a build from the toolbar, then click the field to place it.</span>
        </div>
        <div class="selection-actions">
          <button class="action-button" id="upgrade-button">Upgrade</button>
          <button class="action-button sell" id="sell-button">Sell</button>
          <button class="action-button" id="cancel-button">Cancel Build</button>
        </div>
      </div>
    </section>

    <p class="footnote">Tip: press <strong>1-4</strong> or <strong>G/L/M/S</strong> for towers, <strong>U</strong> to upgrade, <strong>Esc</strong> to cancel build mode, and <strong>Space</strong> to pause or resume.</p>
  </div>
`;

const canvas = must(document.querySelector<HTMLCanvasElement>("#game"), "Missing canvas.");
const modal = must(document.querySelector<HTMLDivElement>("#modal"), "Missing modal.");
const towerStrip = must(document.querySelector<HTMLDivElement>("#tower-strip"), "Missing tower strip.");
const banner = must(document.querySelector<HTMLDivElement>("#banner"), "Missing banner.");
const levelNameValue = must(document.querySelector<HTMLElement>("#level-name"), "Missing level name.");
const moneyValue = must(document.querySelector<HTMLElement>("#money-value"), "Missing money value.");
const escapesValue = must(document.querySelector<HTMLElement>("#escapes-value"), "Missing escapes value.");
const waveValue = must(document.querySelector<HTMLElement>("#wave-value"), "Missing wave value.");
const selectionTitle = must(document.querySelector<HTMLElement>("#selection-title"), "Missing selection title.");
const selectionBody = must(document.querySelector<HTMLElement>("#selection-body"), "Missing selection body.");
const pauseButton = must(document.querySelector<HTMLButtonElement>("#pause-button"), "Missing pause button.");
const levelButton = must(document.querySelector<HTMLButtonElement>("#level-button"), "Missing campaign button.");
const restartButton = must(document.querySelector<HTMLButtonElement>("#restart-button"), "Missing restart button.");
const upgradeButton = must(document.querySelector<HTMLButtonElement>("#upgrade-button"), "Missing upgrade button.");
const sellButton = must(document.querySelector<HTMLButtonElement>("#sell-button"), "Missing sell button.");
const cancelButton = must(document.querySelector<HTMLButtonElement>("#cancel-button"), "Missing cancel button.");

const ctx = must(canvas.getContext("2d"), "Canvas 2D context unavailable.");

class Game {
  levels: LevelData[];
  currentLevel?: LevelData;
  currentLevelIndex = -1;
  highestUnlockedLevelIndex = 0;
  campaignCleared = false;
  menuReturnState?: "playing" | "paused";
  state: GameState = "menu";
  money = STARTING_MONEY;
  escapesLeft = 0;
  spawnDelay = 0;
  spawnCooldown = 0;
  spawnIndex = 0;
  spawnedMonsters = 0;
  currentWaveIndex = 0;
  waveSpawnedMonsters = 0;
  towers: Tower[] = [];
  monsters: Monster[] = [];
  projectiles: Projectile[] = [];
  missiles: Missile[] = [];
  particles: Particle[] = [];
  links: LinkEffect[] = [];
  selectedTower?: Tower;
  placingTower?: TowerKind;
  pointer?: Point;
  statusText = "Select a map";
  bannerText = "Awaiting orders";
  bannerTimer = 0;
  currentDpr = window.devicePixelRatio || 1;
  winDelay = 0;
  hudDirty = true;
  lastHudSnapshot?: HudSnapshot;
  backgroundCanvas = document.createElement("canvas");
  backgroundCtx = must(this.backgroundCanvas.getContext("2d"), "Background canvas unavailable.");

  constructor(levels: LevelData[]) {
    this.levels = levels;
  }

  get activeWave(): WaveData | undefined {
    return this.currentLevel?.waves?.[this.currentWaveIndex];
  }

  get waveTotal(): number {
    return this.currentLevel?.waves?.length ?? 1;
  }

  addParticle(particle: Particle): void {
    if (this.particles.length < MAX_PARTICLES) {
      this.particles.push(particle);
    }
  }

  addLink(link: LinkEffect): void {
    if (this.links.length < MAX_LINKS) {
      this.links.push(link);
    }
  }

  requestHudSync(): void {
    this.hudDirty = true;
  }

  setBanner(text: string, duration = 1.6): void {
    this.bannerText = text;
    this.bannerTimer = duration;
    this.requestHudSync();
  }

  setState(next: GameState): void {
    this.state = next;
    if (next === "playing") {
      this.statusText = "Playing";
    } else if (next === "paused") {
      this.statusText = "Paused";
    } else if (next === "won") {
      this.statusText = "Level secured";
    } else if (next === "campaign-won") {
      this.statusText = "Campaign complete";
    } else if (next === "lost") {
      this.statusText = "Base overrun";
    } else {
      this.statusText = "Select a map";
    }
    this.requestHudSync();
  }

  resetField(): void {
    this.towers = [];
    this.monsters = [];
    this.projectiles = [];
    this.missiles = [];
    this.particles = [];
    this.links = [];
    this.selectedTower = undefined;
    this.placingTower = undefined;
    this.winDelay = 0;
    this.requestHudSync();
  }

  startLevel(level: LevelData): void {
    this.currentLevel = level;
    this.currentLevelIndex = this.levels.findIndex((candidate) => candidate.id === level.id || candidate === level);
    this.money = level.startingMoney ?? STARTING_MONEY;
    this.escapesLeft = level.allowEscape;
    this.spawnDelay = level.waves?.[0]?.buildTime ?? 8;
    this.spawnCooldown = 0.2;
    this.spawnIndex = 0;
    this.spawnedMonsters = 0;
    this.currentWaveIndex = 0;
    this.waveSpawnedMonsters = 0;
    this.menuReturnState = undefined;
    this.lastHudSnapshot = undefined;
    this.resetField();
    this.setBanner(`Level ${level.levelNumber ?? "?"}: ${level.name}`, 2.4);
    this.setState("playing");
    this.rebuildBackgroundCache();
    renderModal();
  }

  startLevelByIndex(index: number): void {
    const level = this.levels[index];
    if (!level) {
      return;
    }
    if (!this.campaignCleared && index > this.highestUnlockedLevelIndex) {
      return;
    }
    this.startLevel(level);
  }

  restart(): void {
    if (this.currentLevel) {
      this.startLevel(this.currentLevel);
    } else {
      renderModal();
    }
  }

  restartCampaign(): void {
    this.highestUnlockedLevelIndex = 0;
    this.campaignCleared = false;
    this.startLevelByIndex(0);
  }

  startNextLevel(): void {
    if (this.currentLevelIndex < 0) {
      this.startLevelByIndex(0);
      return;
    }
    const nextIndex = Math.min(this.currentLevelIndex + 1, this.levels.length - 1);
    this.startLevelByIndex(nextIndex);
  }

  openMenu(): void {
    this.menuReturnState = isBattleState(this.state) ? this.state : undefined;
    this.setState("menu");
    renderModal();
  }

  resumeBattle(): void {
    if (!this.currentLevel || !this.menuReturnState) {
      return;
    }
    this.setState(this.menuReturnState);
    this.menuReturnState = undefined;
    renderModal();
  }

  togglePause(): void {
    if (this.state === "playing") {
      this.setState("paused");
    } else if (this.state === "paused") {
      this.setState("playing");
    }
    renderModal();
  }

  spawnMonster(): void {
    if (!this.currentLevel) {
      return;
    }
    const sequence = this.activeWave?.monsterSequence ?? this.currentLevel.monsterSequence;
    const code = sequence[this.spawnIndex] ?? "ball";
    this.spawnIndex = (this.spawnIndex + 1) % sequence.length;
    this.spawnedMonsters += 1;
    this.waveSpawnedMonsters += 1;
    this.monsters.push(new Monster(code, this.currentLevel));
  }

  onMonsterKilled(monster: Monster): void {
    this.money += monster.bounty;
    if (monster.kind === "tank") {
      this.createTankExplosion(monster.x, monster.y, monster.color);
    } else {
      this.createExplosion(monster.x, monster.y, 30, randomRange(1.5, 4), monster.color, 1 / 24);
    }
    this.requestHudSync();
  }

  onMonsterEscaped(monster: Monster): void {
    this.createEscapeBurst(monster.x, monster.y);
    this.escapesLeft = Math.max(0, this.escapesLeft - 1);
    if (this.escapesLeft === 0) {
      this.monsters.forEach((item) => {
        item.removed = true;
      });
      this.setState("lost");
      this.menuReturnState = undefined;
      this.setBanner("Defeat", 5);
      renderModal();
    }
    this.requestHudSync();
  }

  createExplosion(x: number, y: number, count: number, size: number, color: string, burnRate: number): void {
    const particleCount = Math.min(count, Math.max(0, MAX_PARTICLES - this.particles.length));
    for (let index = 0; index < particleCount; index += 1) {
      this.addParticle(new Particle(x, y, size, color, burnRate));
    }
  }

  createTankExplosion(x: number, y: number, color: string): void {
    this.createExplosion(x, y, 32, randomRange(3, 6), "#fff1a6", 1 / 28);
    this.createExplosion(x, y, 34, randomRange(2.5, 5), color, 1 / 24);
    this.createExplosion(x, y, 26, randomRange(2, 4.5), "#7e858c", 1 / 36);

    const debrisCount = Math.min(22, Math.max(0, MAX_PARTICLES - this.particles.length));
    for (let index = 0; index < debrisCount; index += 1) {
      const debrisColor = index % 3 === 0 ? "#ffffff" : (index % 2 === 0 ? "#b0bdc8" : "#5b6470");
      this.addParticle(new Particle(
        x,
        y,
        randomRange(2.5, 5.5),
        debrisColor,
        1 / 42,
        randomRange(5, 10),
        randomRange(2, 10),
      ));
    }
  }

  createEscapeBurst(x: number, y: number): void {
    const particleCount = Math.min(90, Math.max(0, MAX_PARTICLES - this.particles.length));
    for (let index = 0; index < particleCount; index += 1) {
      const color = `#${Math.floor(randomRange(0x555555, 0xffffff)).toString(16).padStart(6, "0")}`;
      this.addParticle(new Particle(x, y, randomRange(1, 4), color, 1 / 40));
    }
  }

  canPlaceTower(point: Point): boolean {
    if (!this.currentLevel) {
      return false;
    }

    const outsideBounds =
      point.x < TOWER_RADIUS ||
      point.y < TOWER_RADIUS ||
      point.x > FIELD_WIDTH - TOWER_RADIUS ||
      point.y > FIELD_HEIGHT - TOWER_RADIUS;

    if (outsideBounds) {
      return false;
    }

    for (const tower of this.towers) {
      if (distanceSquaredXY(point.x, point.y, tower.x, tower.y) <= MIN_DISTANCE_TO_OTHER_TOWERS ** 2) {
        return false;
      }
    }

    for (let index = 0; index < this.currentLevel.points.length - 1; index += 1) {
      const start = this.currentLevel.points[index];
      const end = this.currentLevel.points[index + 1];
      if (pointToSegmentDistanceSquaredXY(point.x, point.y, start.x, start.y, end.x, end.y) <= MIN_DISTANCE_TO_ROAD ** 2) {
        return false;
      }
    }

    return true;
  }

  placeTower(kind: TowerKind, point: Point): void {
    const tower = createTower(kind, point.x, point.y);
    if (this.money < tower.cost || !this.canPlaceTower(point)) {
      return;
    }
    this.money -= tower.cost;
    this.towers.push(tower);
    this.selectedTower = tower;
    this.placingTower = undefined;
    this.requestHudSync();
  }

  selectTowerAt(point: Point): void {
    let hit: Tower | undefined;
    for (let index = this.towers.length - 1; index >= 0; index -= 1) {
      const tower = this.towers[index];
      if (distanceSquaredXY(point.x, point.y, tower.x, tower.y) <= (TOWER_RADIUS + 6) ** 2) {
        hit = tower;
        break;
      }
    }
    this.selectedTower = hit;
    this.requestHudSync();
  }

  sellSelectedTower(): void {
    if (!this.selectedTower) {
      return;
    }
    this.money += this.selectedTower.resaleValue;
    this.selectedTower.removed = true;
    this.towers = this.towers.filter((tower) => tower !== this.selectedTower);
    this.selectedTower = undefined;
    this.requestHudSync();
  }

  upgradeSelectedTower(): void {
    if (!this.selectedTower || !this.selectedTower.canUpgrade() || this.money < this.selectedTower.upgradeCost) {
      return;
    }
    this.money -= this.selectedTower.upgradeCost;
    this.selectedTower.upgrade();
    this.requestHudSync();
  }

  completeCurrentWave(): void {
    const wave = this.activeWave;
    if (!wave) {
      return;
    }

    this.money += wave.reward;
    this.currentWaveIndex += 1;
    this.waveSpawnedMonsters = 0;
    this.spawnIndex = 0;
    this.spawnCooldown = 0.2;
    this.requestHudSync();

    const nextWave = this.activeWave;
    if (nextWave) {
      this.spawnDelay = nextWave.buildTime;
      this.setBanner(`Wave ${this.currentWaveIndex} cleared · +${formatMoney(wave.reward)}`, 2.3);
    } else {
      this.spawnDelay = 0;
      this.setBanner(`Final wave cleared · +${formatMoney(wave.reward)}`, 2.6);
    }
  }

  finishLevel(): void {
    if (!this.currentLevel) {
      return;
    }

    const isFinalLevel = this.currentLevelIndex >= this.levels.length - 1;
    this.menuReturnState = undefined;

    if (isFinalLevel) {
      this.campaignCleared = true;
      this.highestUnlockedLevelIndex = this.levels.length - 1;
      this.setState("campaign-won");
      this.setBanner("Campaign Complete", 5.5);
    } else {
      this.highestUnlockedLevelIndex = Math.max(this.highestUnlockedLevelIndex, this.currentLevelIndex + 1);
      this.setState("won");
      this.setBanner("Level Clear", 5);
    }
    renderModal();
  }

  resize(): void {
    this.currentDpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(FIELD_WIDTH * this.currentDpr);
    canvas.height = Math.round(FIELD_HEIGHT * this.currentDpr);
    ctx.setTransform(this.currentDpr, 0, 0, this.currentDpr, 0, 0);
    this.rebuildBackgroundCache();
  }

  rebuildBackgroundCache(): void {
    this.backgroundCanvas.width = Math.round(FIELD_WIDTH * this.currentDpr);
    this.backgroundCanvas.height = Math.round(FIELD_HEIGHT * this.currentDpr);
    this.backgroundCtx.setTransform(this.currentDpr, 0, 0, this.currentDpr, 0, 0);
    this.drawBackground(this.backgroundCtx);
  }

  update(dt: number): void {
    const multiplier = dt * 60;
    const previousBannerActive = this.bannerTimer > 0;
    const previousPreWaveSecond = this.state === "playing" && this.activeWave && this.spawnDelay > 0
      ? Math.ceil(this.spawnDelay)
      : -1;

    if (this.bannerTimer > 0) {
      this.bannerTimer = Math.max(0, this.bannerTimer - dt);
      if (previousBannerActive && this.bannerTimer === 0) {
        this.requestHudSync();
      }
    }

    if (this.state !== "playing") {
      if (this.hudDirty) {
        syncHud();
      }
      this.draw();
      return;
    }

    const wave = this.activeWave;
    if (wave && this.spawnDelay > 0) {
      this.spawnDelay = Math.max(0, this.spawnDelay - dt);
      const nextPreWaveSecond = this.activeWave && this.spawnDelay > 0 ? Math.ceil(this.spawnDelay) : -1;
      if (previousPreWaveSecond !== nextPreWaveSecond) {
        this.requestHudSync();
      }
    } else if (wave && this.waveSpawnedMonsters < wave.count) {
      this.spawnCooldown -= dt;
      if (this.spawnCooldown <= 0) {
        this.spawnMonster();
        this.spawnCooldown = randomRange(wave.spawnIntervalMin, wave.spawnIntervalMax);
        this.requestHudSync();
      }
    }

    for (const monster of this.monsters) {
      monster.update(this, multiplier);
    }

    for (const projectile of this.projectiles) {
      projectile.update(this, multiplier);
    }

    for (const missile of this.missiles) {
      missile.update(this, multiplier, dt);
    }

    for (const particle of this.particles) {
      particle.update(multiplier);
    }

    for (const link of this.links) {
      link.update(multiplier);
    }

    for (const tower of this.towers) {
      tower.update(this, dt, multiplier);
    }

    compactInPlace(this.monsters);
    compactInPlace(this.projectiles);
    compactInPlace(this.missiles);
    compactInPlace(this.particles);
    compactInPlace(this.links);

    if (wave && this.waveSpawnedMonsters >= wave.count && this.monsters.length === 0) {
      this.completeCurrentWave();
    }

    if (!this.activeWave && this.currentLevel && this.spawnedMonsters >= this.currentLevel.monsterCount && this.monsters.length === 0) {
      this.winDelay += dt;
      if (this.winDelay >= 0.6 && this.state === "playing") {
        this.finishLevel();
      }
    } else {
      this.winDelay = 0;
    }

    if (this.hudDirty) {
      syncHud();
    }
    this.draw();
  }

  drawBackground(context: CanvasRenderingContext2D): void {
    const fieldGradient = context.createLinearGradient(0, 0, 0, FIELD_HEIGHT);
    fieldGradient.addColorStop(0, "#050b08");
    fieldGradient.addColorStop(1, "#0c1c17");
    context.fillStyle = fieldGradient;
    context.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

    context.save();
    context.strokeStyle = "rgba(255, 255, 255, 0.04)";
    for (let x = 0; x <= FIELD_WIDTH; x += 35) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, FIELD_HEIGHT);
      context.stroke();
    }
    for (let y = 0; y <= FIELD_HEIGHT; y += 35) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(FIELD_WIDTH, y);
      context.stroke();
    }
    context.restore();

    if (this.currentLevel) {
      const first = this.currentLevel.points[0];
      const last = this.currentLevel.points[this.currentLevel.points.length - 1];
      context.save();
      context.lineJoin = "round";
      context.lineCap = "round";
      context.strokeStyle = "rgba(8, 40, 36, 0.96)";
      context.lineWidth = 24;
      context.beginPath();
      context.moveTo(first.x, first.y);
      for (let index = 1; index < this.currentLevel.points.length; index += 1) {
        const point = this.currentLevel.points[index];
        context.lineTo(point.x, point.y);
      }
      context.stroke();
      context.strokeStyle = "rgba(109, 240, 194, 0.18)";
      context.lineWidth = 6;
      context.stroke();
      context.fillStyle = "rgba(109, 240, 194, 0.14)";
      context.beginPath();
      context.arc(last.x, last.y, 18, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  drawPreview(context: CanvasRenderingContext2D): void {
    if (!this.pointer || !this.placingTower) {
      return;
    }
    const spec = TOWER_SPECS[this.placingTower];
    const valid = this.canPlaceTower(this.pointer) && this.money >= spec.cost;
    context.save();
    context.strokeStyle = valid ? "rgba(255, 255, 255, 0.35)" : "rgba(255, 120, 120, 0.45)";
    context.setLineDash([6, 6]);
    context.beginPath();
    context.moveTo(this.pointer.x, 0);
    context.lineTo(this.pointer.x, FIELD_HEIGHT);
    context.moveTo(0, this.pointer.y);
    context.lineTo(FIELD_WIDTH, this.pointer.y);
    context.stroke();
    context.setLineDash([]);
    context.strokeStyle = valid ? "rgba(92, 255, 158, 0.3)" : "rgba(255, 120, 120, 0.32)";
    context.fillStyle = valid ? "rgba(92, 255, 158, 0.08)" : "rgba(255, 120, 120, 0.08)";
    context.beginPath();
    context.arc(this.pointer.x, this.pointer.y, spec.range, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.beginPath();
    context.arc(this.pointer.x, this.pointer.y, TOWER_RADIUS, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  draw(): void {
    ctx.clearRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
    ctx.drawImage(this.backgroundCanvas, 0, 0, FIELD_WIDTH, FIELD_HEIGHT);

    for (const link of this.links) {
      link.draw(ctx);
    }

    for (const projectile of this.projectiles) {
      projectile.draw(ctx);
    }

    for (const missile of this.missiles) {
      missile.draw(ctx);
    }

    for (const monster of this.monsters) {
      monster.draw(ctx);
    }

    for (const tower of this.towers) {
      tower.draw(ctx, tower === this.selectedTower);
    }

    for (const particle of this.particles) {
      particle.draw(ctx);
    }

    this.drawPreview(ctx);
  }
}

const baseRoutes = normalizeLevels(levelsJson as LevelJsonData[]);
const levels = createCampaignLevels(baseRoutes);

const game = new Game(levels);
game.resize();

if (import.meta.env.DEV) {
  Object.assign(window, {
    __vectorDefence: game,
  });
}

const towerButtons = new Map<TowerKind, HTMLButtonElement>();

function toggleTowerPlacement(kind: TowerKind): void {
  if (isModalState(game.state)) {
    return;
  }
  game.placingTower = game.placingTower === kind ? undefined : kind;
  game.selectedTower = undefined;
  syncHud();
}

function setupTowerButtons(): void {
  towerStrip.innerHTML = "";
  TOWER_KINDS.forEach((kind) => {
    const spec = TOWER_SPECS[kind];
    const shortcuts = TOWER_SHORTCUTS[kind].map((shortcut) => shortcut.toUpperCase()).join("/");
    const button = document.createElement("button");
    button.className = "tower-button";
    button.innerHTML = `<strong>${spec.label} <span class="shortcut-chip">${shortcuts}</span></strong><span>${formatMoney(spec.cost)} · ${spec.summary}</span>`;
    button.title = `${spec.label} tower (${shortcuts})`;
    button.addEventListener("click", () => {
      toggleTowerPlacement(kind);
    });
    towerButtons.set(kind, button);
    towerStrip.append(button);
  });
}

function syncHud(): void {
  const selected = game.selectedTower;
  const activeWave = game.activeWave;
  const levelName = game.currentLevel
    ? `Level ${game.currentLevel.levelNumber ?? "?"} · ${game.currentLevel.name}`
    : "Campaign Map";
  const wave = game.currentLevel
    ? (activeWave && game.state === "playing" && game.spawnDelay > 0
        ? `Wave ${game.currentWaveIndex + 1}/${game.waveTotal} in ${Math.ceil(game.spawnDelay)}s`
        : activeWave
          ? `Wave ${game.currentWaveIndex + 1}/${game.waveTotal} · ${Math.min(game.waveSpawnedMonsters, activeWave.count)} / ${activeWave.count}`
          : `All ${game.waveTotal} waves cleared`)
    : "Idle";
  const bannerText = game.state === "playing" && activeWave && game.spawnDelay > 0
    ? `Wave ${game.currentWaveIndex + 1} ${activeWave.label} in ${Math.ceil(game.spawnDelay)}`
    : (game.bannerTimer > 0 ? game.bannerText : (game.state === "menu" ? "Awaiting orders" : game.statusText));

  let selectionTitleText: string;
  let selectionBodyText: string;
  if (selected) {
    selectionTitleText = `${TOWER_SPECS[selected.kind].label} Tower · Lv ${selected.level + 1}`;
    selectionBodyText = `Range ${Math.round(selected.range)} · Upgrade ${formatMoney(selected.upgradeCost)} · Sell ${formatMoney(selected.resaleValue)}`;
  } else if (game.placingTower) {
    const spec = TOWER_SPECS[game.placingTower];
    selectionTitleText = `Placing ${spec.label}`;
    selectionBodyText = `${spec.summary} Cost ${formatMoney(spec.cost)}. Click the field to place it.`;
  } else if (game.currentLevel) {
    selectionTitleText = `${game.currentLevel.name}`;
    selectionBodyText = game.currentLevel.subtitle ?? "Hold the route and keep your towers overlapping.";
  } else {
    selectionTitleText = "No tower selected";
    selectionBodyText = "Choose a build from the toolbar, then click the field to place it.";
  }

  const snapshot: HudSnapshot = {
    levelName,
    money: formatMoney(game.money),
    escapes: String(Math.max(0, game.escapesLeft)),
    wave,
    banner: bannerText,
    pauseLabel: game.state === "paused" ? "Resume" : "Pause",
    pauseDisabled: !isBattleState(game.state),
    selectionTitle: selectionTitleText,
    selectionBody: selectionBodyText,
    upgradeDisabled: !selected || !selected.canUpgrade() || game.money < selected.upgradeCost || isModalState(game.state),
    sellDisabled: !selected || isModalState(game.state),
    cancelDisabled: !game.placingTower || isModalState(game.state),
    placingTower: game.placingTower,
    towerButtonsDisabled: isModalState(game.state),
  };

  const previous = game.lastHudSnapshot;
  if (!previous || previous.levelName !== snapshot.levelName) {
    levelNameValue.textContent = snapshot.levelName;
  }
  if (!previous || previous.money !== snapshot.money) {
    moneyValue.textContent = snapshot.money;
  }
  if (!previous || previous.escapes !== snapshot.escapes) {
    escapesValue.textContent = snapshot.escapes;
  }
  if (!previous || previous.wave !== snapshot.wave) {
    waveValue.textContent = snapshot.wave;
  }
  if (!previous || previous.banner !== snapshot.banner) {
    banner.textContent = snapshot.banner;
  }
  if (!previous || previous.pauseLabel !== snapshot.pauseLabel) {
    pauseButton.textContent = snapshot.pauseLabel;
  }
  if (!previous || previous.pauseDisabled !== snapshot.pauseDisabled) {
    pauseButton.disabled = snapshot.pauseDisabled;
  }
  if (!previous || previous.selectionTitle !== snapshot.selectionTitle) {
    selectionTitle.textContent = snapshot.selectionTitle;
  }
  if (!previous || previous.selectionBody !== snapshot.selectionBody) {
    selectionBody.textContent = snapshot.selectionBody;
  }
  if (!previous || previous.upgradeDisabled !== snapshot.upgradeDisabled) {
    upgradeButton.disabled = snapshot.upgradeDisabled;
  }
  if (!previous || previous.sellDisabled !== snapshot.sellDisabled) {
    sellButton.disabled = snapshot.sellDisabled;
  }
  if (!previous || previous.cancelDisabled !== snapshot.cancelDisabled) {
    cancelButton.disabled = snapshot.cancelDisabled;
  }

  for (const [kind, button] of towerButtons.entries()) {
    const isActive = snapshot.placingTower === kind;
    if (!previous || previous.placingTower !== snapshot.placingTower) {
      button.className = `tower-button${isActive ? " active" : ""}`;
    }
    if (!previous || previous.towerButtonsDisabled !== snapshot.towerButtonsDisabled) {
      button.disabled = snapshot.towerButtonsDisabled;
    }
  }

  game.lastHudSnapshot = snapshot;
  game.hudDirty = false;
}

function modalLevelCards(): string {
  return levels
    .map((level, index) => {
      const unlocked = game.campaignCleared || index <= game.highestUnlockedLevelIndex;
      const cleared = game.campaignCleared || index < game.highestUnlockedLevelIndex;
      const current = game.currentLevelIndex === index && !!game.currentLevel;
      const classes = [
        "level-card",
        unlocked ? "" : "locked",
        cleared ? "cleared" : "",
        current ? "current" : "",
      ].filter(Boolean).join(" ");
      const status = !unlocked ? "Locked" : (cleared ? "Cleared" : (index === game.highestUnlockedLevelIndex ? "Next" : "Ready"));

      return `
        <button class="${classes}" data-level-index="${index}" ${unlocked ? "" : "disabled"}>
          <span class="level-pill">${status}</span>
          <strong>Level ${level.levelNumber}: ${level.name}</strong>
          <span>${level.subtitle ?? "Hold the route."}</span>
          <small>${level.waves?.length ?? 1} waves · ${level.monsterCount} enemies · ${level.allowEscape} leaks</small>
        </button>
      `;
    })
    .join("");
}

function renderModal(): void {
  if (game.state === "menu") {
    const quickAction = game.menuReturnState && game.currentLevel
      ? `<button class="modal-button" data-action="resume">Resume Battle</button>`
      : `<button class="modal-button" data-action="play-unlocked">Play Unlocked Level</button>`;
    const restartAction = game.highestUnlockedLevelIndex > 0 || game.campaignCleared
      ? `<button class="modal-button" data-action="restart-campaign">Restart Campaign</button>`
      : "";

    modal.classList.remove("hidden");
    modal.innerHTML = `
      <div class="modal-panel">
        <h2>Campaign Map</h2>
        <p>Ten routed battles, longer wave trains, and short build breaks between pushes. Clear each level to unlock the next.</p>
        <div class="selection-actions campaign-actions">
          ${quickAction}
          ${restartAction}
        </div>
        <div class="level-grid">${modalLevelCards()}</div>
      </div>
    `;
  } else if (game.state === "won") {
    modal.classList.remove("hidden");
    modal.innerHTML = `
      <div class="modal-panel">
        <h2>Level Clear</h2>
        <p>Level ${game.currentLevel?.levelNumber ?? "?"} is secure. Keep the pressure on and push into the next route.</p>
        <div class="selection-actions">
          <button class="modal-button" data-action="next-level">Continue to Level ${(game.currentLevel?.levelNumber ?? 0) + 1}</button>
          <button class="modal-button" data-action="replay">Replay This Level</button>
          <button class="modal-button" data-action="campaign-map">Campaign Map</button>
        </div>
      </div>
    `;
  } else if (game.state === "campaign-won") {
    modal.classList.remove("hidden");
    modal.innerHTML = `
      <div class="modal-panel">
        <h2>You Won the Campaign</h2>
        <p>All ten levels are secured. The prototype is now a full campaign run, and the frontier held.</p>
        <div class="selection-actions">
          <button class="modal-button" data-action="restart-campaign">Restart Campaign</button>
          <button class="modal-button" data-action="replay">Replay Final Level</button>
          <button class="modal-button" data-action="campaign-map">Campaign Map</button>
        </div>
      </div>
    `;
  } else if (game.state === "lost") {
    modal.classList.remove("hidden");
    modal.innerHTML = `
      <div class="modal-panel">
        <h2>Defeat</h2>
        <p>The route broke through. Rework the build, lean on the intermissions, and try again.</p>
        <div class="selection-actions">
          <button class="modal-button" data-action="replay">Try Again</button>
          <button class="modal-button" data-action="campaign-map">Campaign Map</button>
        </div>
      </div>
    `;
  } else {
    modal.classList.add("hidden");
    modal.innerHTML = "";
  }

  modal.querySelectorAll<HTMLElement>("[data-level-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const levelIndex = Number(button.dataset.levelIndex);
      game.startLevelByIndex(levelIndex);
    });
  });

  modal.querySelectorAll<HTMLElement>("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "resume") {
        game.resumeBattle();
      } else if (action === "play-unlocked") {
        game.startLevelByIndex(game.campaignCleared ? game.levels.length - 1 : game.highestUnlockedLevelIndex);
      } else if (action === "restart-campaign") {
        game.restartCampaign();
      } else if (action === "next-level") {
        game.startNextLevel();
      } else if (action === "replay") {
        game.restart();
      } else if (action === "campaign-map") {
        game.openMenu();
      }
    });
  });
}

function pointerFromEvent(event: MouseEvent): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * FIELD_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * FIELD_HEIGHT,
  };
}

canvas.addEventListener("mousemove", (event) => {
  game.pointer = pointerFromEvent(event);
});

canvas.addEventListener("mouseleave", () => {
  game.pointer = undefined;
});

canvas.addEventListener("mousedown", (event) => {
  if (!game.currentLevel || isModalState(game.state)) {
    return;
  }

  const point = pointerFromEvent(event);
  if (game.placingTower) {
    game.placeTower(game.placingTower, point);
  } else {
    game.selectTowerAt(point);
  }
});

pauseButton.addEventListener("click", () => {
  game.togglePause();
  syncHud();
});

levelButton.addEventListener("click", () => {
  game.openMenu();
  syncHud();
});

restartButton.addEventListener("click", () => {
  game.restart();
});

upgradeButton.addEventListener("click", () => {
  game.upgradeSelectedTower();
});

sellButton.addEventListener("click", () => {
  game.sellSelectedTower();
});

cancelButton.addEventListener("click", () => {
  game.placingTower = undefined;
  syncHud();
});

window.addEventListener("keydown", (event) => {
  if (event.repeat) {
    return;
  }

  const shortcutTower = (Object.entries(TOWER_SHORTCUTS) as [TowerKind, string[]][])
    .find(([, shortcuts]) => shortcuts.includes(event.key.toLowerCase()))?.[0];

  if (shortcutTower) {
    event.preventDefault();
    toggleTowerPlacement(shortcutTower);
    return;
  }

  if (event.key.toLowerCase() === "u") {
    event.preventDefault();
    game.upgradeSelectedTower();
    return;
  }

  if (event.key === "Escape") {
    game.placingTower = undefined;
    syncHud();
  }

  if (event.key === " ") {
    event.preventDefault();
    game.togglePause();
    syncHud();
  }
});

window.addEventListener("resize", () => {
  game.resize();
  game.draw();
});

setupTowerButtons();
renderModal();
syncHud();

let lastFrame = performance.now();

function frame(now: number): void {
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  game.update(dt);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
