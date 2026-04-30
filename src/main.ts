import "./style.css";
import { mountApp } from "./app-dom";
import { createGameSession } from "./game-session";

const target = document.querySelector<HTMLDivElement>("#app");

if (!target) {
  throw new Error("Missing app root.");
}

mountApp(target, createGameSession());
