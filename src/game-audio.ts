import { AUDIO_ASSET_URLS } from "./audio-assets";
import { FIELD_WIDTH } from "./constants";
import {
  AudioCue,
  type AudioCue as AudioCueValue,
} from "./types";

interface AudioCueOptions {
  intensity?: number;
  panX?: number;
}

type AudioContextConstructor = new () => AudioContext;

interface AudioWindow extends Window {
  webkitAudioContext?: AudioContextConstructor;
}

const MASTER_VOLUME = 0.34;
const DEFAULT_INTENSITY = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class GameAudio {
  private context?: AudioContext;
  private masterGain?: GainNode;
  private output?: AudioNode;
  private recentCueTimes = new Map<AudioCueValue, number>();
  private bufferPromises = new Map<AudioCueValue, Promise<AudioBuffer>>();
  private buffers = new Map<AudioCueValue, AudioBuffer>();
  private enabled = true;

  get isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(enabled ? MASTER_VOLUME : 0, this.context?.currentTime ?? 0, 0.015);
    }
  }

  toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  preload(): void {
    const context = this.getContext();
    if (!context) {
      return;
    }

    for (const cue of Object.values(AudioCue)) {
      void this.loadBuffer(cue, context);
    }
  }

  unlock(): void {
    if (!this.enabled) {
      return;
    }

    const context = this.getContext();
    if (!context) {
      return;
    }

    if (context.state === "suspended") {
      void context.resume();
    }
    this.preload();
  }

  play(cue: AudioCueValue, options: AudioCueOptions = {}): void {
    if (!this.enabled) {
      return;
    }

    const context = this.getContext();
    if (!context || !this.output) {
      return;
    }

    if (context.state === "suspended") {
      void context.resume();
    }

    const now = context.currentTime;
    const previousTime = this.recentCueTimes.get(cue) ?? Number.NEGATIVE_INFINITY;
    if (now - previousTime < cue.cooldownSeconds) {
      return;
    }
    this.recentCueTimes.set(cue, now);

    const intensity = clamp(options.intensity ?? DEFAULT_INTENSITY, 0.25, 2.2);
    const cachedBuffer = this.buffers.get(cue);
    if (cachedBuffer) {
      this.playBuffer(cue, cachedBuffer, options.panX, intensity);
      return;
    }

    void this.loadBuffer(cue, context).then((buffer) => {
      if (this.enabled) {
        this.playBuffer(cue, buffer, options.panX, intensity);
      }
    });
  }

  private getContext(): AudioContext | undefined {
    if (this.context) {
      return this.context;
    }

    const AudioContextClass = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!AudioContextClass) {
      return undefined;
    }

    const context = new AudioContextClass();
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 20;
    compressor.ratio.value = 7;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.12;

    const masterGain = context.createGain();
    masterGain.gain.value = this.enabled ? MASTER_VOLUME : 0;
    compressor.connect(masterGain);
    masterGain.connect(context.destination);

    this.context = context;
    this.masterGain = masterGain;
    this.output = compressor;
    return context;
  }

  private loadBuffer(cue: AudioCueValue, context: AudioContext): Promise<AudioBuffer> {
    const cachedBuffer = this.buffers.get(cue);
    if (cachedBuffer) {
      return Promise.resolve(cachedBuffer);
    }

    const cachedPromise = this.bufferPromises.get(cue);
    if (cachedPromise) {
      return cachedPromise;
    }

    const bufferPromise = fetch(AUDIO_ASSET_URLS[cue.id])
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load audio asset ${cue.id}: ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        this.buffers.set(cue, buffer);
        return buffer;
      });

    this.bufferPromises.set(cue, bufferPromise);
    return bufferPromise;
  }

  private playBuffer(cue: AudioCueValue, buffer: AudioBuffer, panX: number | undefined, intensity: number): void {
    const context = this.context;
    if (!context || !this.output) {
      return;
    }

    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = 1 + ((Math.random() * 2 - 1) * cue.rateVariation);
    gain.gain.value = clamp(cue.gain * intensity, 0.01, 1.4);

    source.connect(gain);

    if (panX !== undefined && "createStereoPanner" in context) {
      const panner = context.createStereoPanner();
      panner.pan.value = clamp((panX / FIELD_WIDTH) * 1.5 - 0.75, -0.75, 0.75);
      gain.connect(panner);
      panner.connect(this.output);
      window.setTimeout(() => {
        source.disconnect();
        gain.disconnect();
        panner.disconnect();
      }, Math.ceil((buffer.duration + 0.25) * 1000));
    } else {
      gain.connect(this.output);
      window.setTimeout(() => {
        source.disconnect();
        gain.disconnect();
      }, Math.ceil((buffer.duration + 0.25) * 1000));
    }

    source.start();
  }
}
