const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export const ControlIcon = {
  Home: "home",
  Pause: "pause",
  Play: "play",
  SoundOn: "sound-on",
  SoundMuted: "sound-muted",
} as const;
export type ControlIcon = (typeof ControlIcon)[keyof typeof ControlIcon];

/** One stroke pass of a neon tube: stroke color (`#rrggbb` or `#rrggbbaa`) and width in viewBox units. */
type TubeLayer = readonly [color: string, width: number];

// Each tube repeats its shapes from the widest/dimmest stroke to the thinnest/brightest core.
const CYAN_TUBE: readonly TubeLayer[] = [
  ["#07f862", 4.5],
  ["#00f3f2", 2.8],
  ["#f4fffe", 1.4],
];
const CYAN_WIDE_TUBE: readonly TubeLayer[] = [
  ["#07f862", 5.25],
  ["#00f3f2", 3.4],
  ["#f4fffe", 1.6],
];
const CYAN_THIN_TUBE: readonly TubeLayer[] = [
  ["#00f3f2", 1.4],
  ["#e8fffd", 0.5],
];
const PALE_LINE: readonly TubeLayer[] = [["#d9f3f5b3", 0.75]];
const LIME_TUBE: readonly TubeLayer[] = [
  ["#b2ff4238", 5],
  ["#a8ff3f", 2.5],
  ["#ecffd8", 0.75],
];
const MAGENTA_HALO: readonly TubeLayer[] = [
  ["#ff00f026", 9.5],
  ["#ff20f24d", 6.5],
];
const MAGENTA_TUBE: readonly TubeLayer[] = [
  ["#ff22f2", 4.25],
  ["#ffe8ff", 1.6],
];

function tube(shapes: string, layers: readonly TubeLayer[]): string {
  return layers.map(([color, width]) => `<g stroke="${color}" stroke-width="${width}">${shapes}</g>`).join("");
}

const SPEAKER = tube('<path d="M15 22.5H5.75v18H15M15 22.5 34.5 7.75v48.5L15 40.5z"/>', CYAN_WIDE_TUBE);
// The halo keeps round caps on a shortened line so its glow wraps the square-cut slash ends.
const MUTE_SLASH =
  tube('<path d="M12.6 51.9 51.4 13.1"/>', MAGENTA_HALO) +
  tube('<path stroke-linecap="butt" d="M10.5 54 53.5 11"/>', MAGENTA_TUBE);
const SOUND_WAVES = tube('<path d="M41.25 20a17.5 17.5 0 0 1 0 24M47.25 15.75a23.5 23.5 0 0 1 0 32.5"/>', LIME_TUBE);

const ICON_MARKUP: Record<ControlIcon, string> = {
  [ControlIcon.Home]:
    tube('<path d="M32 8 7 33h6v22.5h13.25V40h11.5v15.5H51V33h6z"/>', CYAN_TUBE) +
    tube('<path d="M15 33.5 32 16.5l17 17"/>', PALE_LINE) +
    tube('<path d="M18.5 34.5 29 24h6l10.5 10.5M17.5 37v14.25H22m24.5-14.25v14.25H42"/>', CYAN_THIN_TUBE),
  [ControlIcon.Pause]: tube(
    '<rect x="16" y="6.75" width="9.5" height="50.5" rx="2.75"/><rect x="38.5" y="6.75" width="9.5" height="50.5" rx="2.75"/>',
    CYAN_TUBE,
  ),
  [ControlIcon.Play]: tube('<path d="M13.25 6v51.5l37.5-25.75z"/>', CYAN_TUBE),
  [ControlIcon.SoundOn]: SPEAKER + SOUND_WAVES,
  [ControlIcon.SoundMuted]: SPEAKER + SOUND_WAVES + MUTE_SLASH,
};

/** Returns a fresh <svg class="control-icon" aria-hidden="true" focusable="false" viewBox=...> element. */
export function createControlIcon(icon: ControlIcon): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("class", "control-icon");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.innerHTML = ICON_MARKUP[icon];
  return svg;
}
