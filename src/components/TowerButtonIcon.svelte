<script lang="ts">
  import { GunTower } from "../entities/towers/gun-tower";
  import { LaserTower } from "../entities/towers/laser-tower";
  import { MissileTower } from "../entities/towers/missile-tower";
  import { SlowTower } from "../entities/towers/slow-tower";
  import { TowerKind, type TowerKind as TowerKindType } from "../types";
  import type { TowerClass } from "../entities/towers/tower";

  const ICON_SIZE = 60;
  type PreviewTower = GunTower | LaserTower | MissileTower | SlowTower;
  type PreviewFactory = (x: number, y: number) => PreviewTower;

  const PREVIEW_FACTORIES: Record<TowerKindType, PreviewFactory> = {
    [TowerKind.Gun]: (x, y) => {
      const tower = new GunTower(x, y);
      tower.angle = -Math.PI / 4;
      return tower;
    },
    [TowerKind.Laser]: (x, y) => {
      const tower = new LaserTower(x, y);
      tower.angle = -Math.PI / 10;
      return tower;
    },
    [TowerKind.Missile]: (x, y) => {
      const tower = new MissileTower(x, y);
      tower.angle = -Math.PI / 6;
      return tower;
    },
    [TowerKind.Slow]: (x, y) => {
      const tower = new SlowTower(x, y);
      tower.pulse = Math.PI / 2;
      return tower;
    },
  };

  let { towerClass }: { towerClass: TowerClass } = $props();
  let canvas = $state<HTMLCanvasElement | undefined>();

  function drawPreview(): void {
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const cssSize = `${ICON_SIZE}px`;

    if (canvas.style.width !== cssSize) {
      canvas.style.width = cssSize;
      canvas.style.height = cssSize;
    }

    const scaledSize = Math.round(ICON_SIZE * dpr);
    if (canvas.width !== scaledSize || canvas.height !== scaledSize) {
      canvas.width = scaledSize;
      canvas.height = scaledSize;
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, ICON_SIZE, ICON_SIZE);

    const tower = PREVIEW_FACTORIES[towerClass.kind](ICON_SIZE / 2, ICON_SIZE / 2);
    tower.draw(context, false);
  }

  $effect(() => {
    if (!canvas) {
      return;
    }

    drawPreview();
  });
</script>

<canvas bind:this={canvas} class="tower-icon" aria-hidden="true"></canvas>
