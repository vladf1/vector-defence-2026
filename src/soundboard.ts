import { AudioCue } from "./audio-manifest";

const board = document.querySelector<HTMLElement>(".board")!;
const status = document.querySelector<HTMLElement>(".status")!;
const audioVersion = Date.now().toString(36);
let activeButton: HTMLButtonElement | undefined;

const soundEntries = Object.values(AudioCue).map((cue) => {
  const sourceUrl = new URL(cue.url, document.baseURI);
  sourceUrl.searchParams.set("v", audioVersion);
  const audio = document.createElement("audio");
  const button = document.createElement("button");
  const label = document.createElement("span");
  const icon = document.createElement("span");

  audio.id = cue.id;
  audio.preload = "auto";
  audio.src = sourceUrl.href;
  button.type = "button";
  button.dataset.audioId = cue.id;
  label.className = "label";
  label.textContent = cue.label;
  icon.className = "play-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "▶";

  button.append(label, icon);
  board.append(button);
  document.body.append(audio);

  audio.addEventListener("ended", resetActiveButton);
  audio.addEventListener("error", () => {
    setStatus(`Could not load ${cue.label}.`);
    resetActiveButton();
  });

  button.addEventListener("click", async () => {
    resetActiveButton();
    for (const { audio: otherAudio } of soundEntries) {
      if (otherAudio !== audio) {
        otherAudio.pause();
        otherAudio.currentTime = 0;
      }
    }

    audio.currentTime = 0;
    activeButton = button;
    button.classList.add("playing");
    setStatus(`Playing ${cue.label}`);

    try {
      await audio.play();
    } catch {
      setStatus(`Browser blocked ${cue.label}. Try the button again.`);
      resetActiveButton();
    }
  });

  return { audio, button };
});

function setStatus(message: string) {
  status.textContent = message;
}

function resetActiveButton() {
  if (activeButton) {
    activeButton.classList.remove("playing");
    activeButton = undefined;
  }
}
