import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace } from "three/webgpu";

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

/**
 * A 2x2 atlas of soft, lumpy puffs generated at startup (no download). Smoke uses the
 * cells directly; scorch decals reuse them as a noisy mask.
 */
export function createPuffAtlasTexture(): CanvasTexture {
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

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = NoColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  texture.name = "puff-atlas";
  return texture;
}
