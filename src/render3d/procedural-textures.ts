import { PUFF_FORMAT } from "./gpu-pipelines";
import { TextureUsage } from "./gpu-flags";

const PUFF_ATLAS_SIZE = 256;
const PUFF_CELL_SIZE = PUFF_ATLAS_SIZE / 2;
const PUFF_BLOB_COUNT = 34;

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Coverage per texel, bottom row first (the previous three.js texture used flipY). */
function drawPuffAtlas(): Uint8Array {
  const canvas = document.createElement("canvas");
  canvas.width = PUFF_ATLAS_SIZE;
  canvas.height = PUFF_ATLAS_SIZE;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to create procedural texture canvas.");
  }

  const random = createSeededRandom(0x5eed);
  for (let cellIndex = 0; cellIndex < 4; cellIndex += 1) {
    const originX = (cellIndex % 2) * PUFF_CELL_SIZE;
    const originY = Math.floor(cellIndex / 2) * PUFF_CELL_SIZE;
    const centerX = originX + (PUFF_CELL_SIZE / 2);
    const centerY = originY + (PUFF_CELL_SIZE / 2);

    context.save();
    context.beginPath();
    context.rect(originX, originY, PUFF_CELL_SIZE, PUFF_CELL_SIZE);
    context.clip();
    for (let blob = 0; blob < PUFF_BLOB_COUNT; blob += 1) {
      const angle = random() * Math.PI * 2;
      const distance = Math.pow(random(), 0.7) * PUFF_CELL_SIZE * 0.26;
      const x = centerX + (Math.cos(angle) * distance);
      const y = centerY + (Math.sin(angle) * distance);
      const radius = PUFF_CELL_SIZE * (0.08 + (random() * 0.17));
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      const alpha = 0.16 + (random() * 0.22);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      gradient.addColorStop(0.55, `rgba(255, 255, 255, ${alpha * 0.45})`);
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      context.fillStyle = gradient;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    // Fade every cell to transparent before its border so atlas cells never bleed.
    context.globalCompositeOperation = "destination-in";
    const mask = context.createRadialGradient(centerX, centerY, PUFF_CELL_SIZE * 0.18, centerX, centerY, PUFF_CELL_SIZE * 0.48);
    mask.addColorStop(0, "rgba(255, 255, 255, 1)");
    mask.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = mask;
    context.fillRect(originX, originY, PUFF_CELL_SIZE, PUFF_CELL_SIZE);
    context.restore();
  }

  const pixels = context.getImageData(0, 0, PUFF_ATLAS_SIZE, PUFF_ATLAS_SIZE).data;
  const coverage = new Uint8Array(PUFF_ATLAS_SIZE * PUFF_ATLAS_SIZE);
  for (let row = 0; row < PUFF_ATLAS_SIZE; row += 1) {
    const sourceRow = PUFF_ATLAS_SIZE - 1 - row;
    for (let column = 0; column < PUFF_ATLAS_SIZE; column += 1) {
      coverage[(row * PUFF_ATLAS_SIZE) + column] = pixels[(((sourceRow * PUFF_ATLAS_SIZE) + column) * 4) + 3];
    }
  }
  return coverage;
}

function downsample(source: Uint8Array, size: number): Uint8Array {
  const half = size / 2;
  const target = new Uint8Array(half * half);
  for (let row = 0; row < half; row += 1) {
    for (let column = 0; column < half; column += 1) {
      const top = (row * 2 * size) + (column * 2);
      const bottom = top + size;
      target[(row * half) + column] = (source[top] + source[top + 1] + source[bottom] + source[bottom + 1] + 2) >> 2;
    }
  }
  return target;
}

/**
 * A 2x2 atlas of soft, lumpy puffs generated at startup (no download), as a full mip chain
 * (largest first). Smoke uses the cells directly; scorch decals reuse them as a noisy mask.
 */
export function drawPuffAtlasLevels(): Uint8Array[] {
  const levels = [drawPuffAtlas()];
  for (let size = PUFF_ATLAS_SIZE; size > 1; size /= 2) {
    levels.push(downsample(levels[levels.length - 1], size));
  }
  return levels;
}

export function createPuffAtlasTexture(device: GPUDevice, levels: readonly Uint8Array[]): GPUTexture {
  const texture = device.createTexture({
    label: "puff-atlas",
    size: [PUFF_ATLAS_SIZE, PUFF_ATLAS_SIZE],
    format: PUFF_FORMAT,
    mipLevelCount: levels.length,
    usage: TextureUsage.TEXTURE_BINDING | TextureUsage.COPY_DST,
  });
  levels.forEach((level, mipLevel) => {
    const size = PUFF_ATLAS_SIZE >> mipLevel;
    device.queue.writeTexture({ texture, mipLevel }, level, { bytesPerRow: size }, [size, size]);
  });
  return texture;
}
