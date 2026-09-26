import "./style.css";
import { mount } from "svelte";
import App from "./App.svelte";
import { selectStartupGameProfile } from "./game-profile";
import { ViewMode, selectStartupViewMode } from "./view-mode";

const target = document.querySelector<HTMLDivElement>("#app");

if (!target) {
  throw new Error("Missing app root.");
}

function updateAppViewportHeight(): void {
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty("--app-viewport-height", `${viewportHeight}px`);
}

updateAppViewportHeight();
window.addEventListener("resize", updateAppViewportHeight);
window.visualViewport?.addEventListener("resize", updateAppViewportHeight);
window.visualViewport?.addEventListener("scroll", updateAppViewportHeight);

const viewMode = selectStartupViewMode(window);
if (viewMode === ViewMode.Depth) {
  // Start downloading the 3D renderer while Svelte mounts; the session's import reuses it
  // and reports any failure.
  import("./render3d/three-board-renderer").catch(() => undefined);
}

mount(App, {
  target,
  props: {
    profile: selectStartupGameProfile(window),
    viewMode,
  },
});
