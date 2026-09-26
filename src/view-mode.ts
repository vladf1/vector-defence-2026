export const ViewMode = {
  Classic: "2d",
  Depth: "3d",
} as const;

export type ViewMode = typeof ViewMode[keyof typeof ViewMode];

export const RendererStatus = {
  Loading: "loading",
  Ready: "ready",
  Failed: "failed",
} as const;

export type RendererStatus = typeof RendererStatus[keyof typeof RendererStatus];

const VIEW_MODE_STORAGE_KEY = "vector-defence:view-mode";
const VIEW_MODE_QUERY_PARAMETER = "view";

function parseViewMode(value: string | null): ViewMode | undefined {
  return value === ViewMode.Classic || value === ViewMode.Depth ? value : undefined;
}

function readStoredViewMode(viewport: Window): ViewMode | undefined {
  try {
    return parseViewMode(viewport.localStorage.getItem(VIEW_MODE_STORAGE_KEY));
  } catch {
    return undefined;
  }
}

/** URL `?view=2d|3d` wins, then the stored preference, then 3D wherever WebGPU is exposed. */
export function selectStartupViewMode(viewport: Window): ViewMode {
  const requested = parseViewMode(new URLSearchParams(viewport.location.search).get(VIEW_MODE_QUERY_PARAMETER));
  if (requested) {
    return requested;
  }

  const stored = readStoredViewMode(viewport);
  if (stored) {
    return stored;
  }

  return "gpu" in viewport.navigator ? ViewMode.Depth : ViewMode.Classic;
}

/** `?timings` shows the 3D startup phase breakdown on the board (for profiling devices). */
export function shouldShowStartupTimings(viewport: Window): boolean {
  return new URLSearchParams(viewport.location.search).has("timings");
}

export function storeViewModePreference(viewport: Window, mode: ViewMode): void {
  try {
    viewport.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    // Storage can be unavailable in private modes; the choice still applies to this session.
  }
}
