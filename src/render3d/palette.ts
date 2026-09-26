import { Color } from "three/webgpu";

/** A linear-space RGB triple; entity colors are authored as sRGB hex strings. */
export interface LinearColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const cache = new Map<string, LinearColor>();

/** Parses (once) any CSS color string into linear RGB. */
export function linearColor(css: string): LinearColor {
  let color = cache.get(css);
  if (!color) {
    const parsed = new Color(css);
    color = { r: parsed.r, g: parsed.g, b: parsed.b };
    cache.set(css, color);
  }
  return color;
}

export const HOLOGRAM_VALID = linearColor("#5cff9e");
export const HOLOGRAM_INVALID = linearColor("#ff6a6a");
