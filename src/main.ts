import "./style.css";
import { mount } from "svelte";
import App from "./App.svelte";
import { selectStartupGameProfile } from "./game-profile";

const target = document.querySelector<HTMLDivElement>("#app");

if (!target) {
  throw new Error("Missing app root.");
}

mount(App, {
  target,
  props: {
    profile: selectStartupGameProfile(window),
  },
});
