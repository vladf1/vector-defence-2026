import { ControlIcon, createControlIcon } from "../control-icons";
import { h, setAttribute, setProperty, setText, syncChildren } from "../dom";
import type { GameSession } from "../game-session";
import type { HudSnapshot } from "../types";
import { formatMoney } from "../utils";

interface StatView {
  label: string;
  value: string;
  className: string;
}

interface StatCard {
  element: HTMLDivElement;
  value: HTMLElement;
}

interface IconButton {
  element: HTMLButtonElement;
  setIcon: (icon: ControlIcon) => void;
}

function createIconButton(className: string, onClick: () => void): IconButton {
  const element = h("button", { class: className, type: "button" });
  element.addEventListener("click", onClick);
  let currentIcon: ControlIcon | null = null;

  return {
    element,
    setIcon(icon) {
      if (icon !== currentIcon) {
        currentIcon = icon;
        element.replaceChildren(createControlIcon(icon));
      }
    },
  };
}

function setButtonLabel(button: HTMLButtonElement, label: string): void {
  setAttribute(button, "aria-label", label);
  setAttribute(button, "title", label);
}

export function createChromeBar(session: GameSession): HTMLElement {
  const profile = session.profile;
  const mobile = profile.mode === "mobile";
  const statCards = new Map<string, StatCard>();

  function formatLevel(levelNumber: number | undefined): string {
    const value = levelNumber ?? "?";
    return mobile ? `Level ${value}` : String(value);
  }

  function formatProgress(current: number | undefined, total: number | undefined): string {
    return current === undefined || total === undefined ? "" : `${current} of ${total}`;
  }

  function createStats(hud: HudSnapshot): StatView[] {
    const stats: StatView[] = [
      { label: mobile ? "" : "Level", value: formatLevel(hud.levelNumber), className: "level-stat" },
      { label: mobile ? "" : "Money", value: formatMoney(hud.money), className: "money-stat" },
      { label: mobile ? "" : "Wave", value: formatProgress(hud.waveCurrent, hud.waveTotal), className: "wave-stat" },
    ];
    if (!mobile && hud.waveMonsterTotal !== undefined) {
      stats.push({
        label: "Monsters",
        value: formatProgress(hud.waveMonstersSpawned, hud.waveMonsterTotal),
        className: "monsters-stat",
      });
    }
    return stats.filter((stat) => stat.value);
  }

  function getStatCard(stat: StatView): StatCard {
    let card = statCards.get(stat.className);
    if (!card) {
      const value = h("strong", {});
      const element = h("div", { class: `stat-card ${stat.className}` });
      if (stat.label) {
        element.append(h("span", {}, stat.label));
      }
      element.append(value);
      card = { element, value };
      statCards.set(stat.className, card);
    }
    return card;
  }

  const titleBlock = profile.ui.showTitle ? h("div", { class: "title-block" }, h("h1", {}, "Vector Defence")) : null;
  const hudSection = h("section", { class: "hud" });
  const soundButton = createIconButton("chrome-button sound-button", session.toggleSound);
  const pauseButton = createIconButton("chrome-button pause-button", session.togglePause);
  const campaignButton = createIconButton("chrome-button campaign-button", session.openMenu);
  setButtonLabel(campaignButton.element, "Campaign");
  campaignButton.setIcon(ControlIcon.Home);
  const actions = h("div", { class: "actions" }, soundButton.element, pauseButton.element, campaignButton.element);
  const header = h("header", { class: "topbar" });

  session.hud.subscribe((hud) => {
    syncChildren(header, [
      ...(titleBlock ? [titleBlock] : []),
      ...(hud.showStatusHud ? [hudSection] : []),
      actions,
    ]);

    if (hud.showStatusHud) {
      syncChildren(hudSection, createStats(hud).map((stat) => {
        const card = getStatCard(stat);
        setText(card.value, stat.value);
        return card.element;
      }));
    }

    const pauseLabel = hud.paused ? "Resume" : "Pause";
    setButtonLabel(pauseButton.element, pauseLabel);
    setProperty(pauseButton.element, "disabled", !hud.canTogglePause);
    pauseButton.setIcon(hud.paused ? ControlIcon.Play : ControlIcon.Pause);
  });

  session.soundEnabled.subscribe((soundEnabled) => {
    setButtonLabel(soundButton.element, soundEnabled ? "Mute sound" : "Unmute sound");
    setAttribute(soundButton.element, "aria-pressed", String(soundEnabled));
    soundButton.setIcon(soundEnabled ? ControlIcon.SoundOn : ControlIcon.SoundMuted);
  });

  session.modal.subscribe((modal) => {
    setProperty(header, "inert", modal !== null);
  });

  return header;
}
