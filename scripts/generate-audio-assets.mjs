import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const sampleRate = 24_000;
const outputDir = resolve(process.cwd(), "src", "assets", "audio");

const cues = {
  "escape-burst": {
    duration: 0.58,
    sounds: [
      tone("sine", 220, 88, 0.35, 0.22, 0),
      tone("triangle", 880, 660, 0.18, 0.12, 0.035),
      noise("bandpass", 1250, 0.24, 0.2, 0.02),
    ],
  },
  "gun-fire": {
    duration: 0.18,
    sounds: [
      tone("square", 760, 190, 0.055, 0.21, 0),
      noise("highpass", 2400, 0.045, 0.15, 0),
    ],
  },
  "laser-fire": {
    duration: 0.88,
    sounds: [
      tone("sawtooth", 160, 230, 0.72, 0.13, 0),
      tone("sawtooth", 420, 760, 0.58, 0.16, 0.02),
      tone("triangle", 840, 1180, 0.5, 0.12, 0.04),
      tone("sine", 1320, 980, 0.42, 0.1, 0.1),
      noise("bandpass", 1450, 0.62, 0.13, 0.03),
      noise("highpass", 3100, 0.22, 0.05, 0.1),
    ],
  },
  "level-loss": {
    duration: 0.88,
    sounds: [
      tone("sawtooth", 220, 110, 0.34, 0.18, 0),
      tone("sine", 110, 55, 0.52, 0.24, 0.16),
      noise("lowpass", 380, 0.26, 0.2, 0.12),
    ],
  },
  "level-start": {
    duration: 0.52,
    sounds: [
      tone("triangle", 196, 196, 0.11, 0.11, 0),
      tone("triangle", 294, 294, 0.12, 0.1, 0.11),
      tone("triangle", 392, 392, 0.18, 0.12, 0.23),
    ],
  },
  "level-win": {
    duration: 0.92,
    sounds: [
      tone("triangle", 392, 392, 0.1, 0.1, 0),
      tone("triangle", 523, 523, 0.1, 0.1, 0.12),
      tone("triangle", 659, 659, 0.12, 0.1, 0.24),
      tone("triangle", 1046, 1046, 0.28, 0.12, 0.38),
    ],
  },
  "missile-explosion": {
    duration: 0.72,
    sounds: [
      tone("sine", 92, 36, 0.42, 0.55, 0),
      noise("lowpass", 520, 0.38, 0.5, 0.01),
      noise("bandpass", 2600, 0.08, 0.32, 0),
    ],
  },
  "missile-launch": {
    duration: 0.38,
    sounds: [
      tone("sawtooth", 115, 260, 0.18, 0.24, 0),
      noise("lowpass", 850, 0.22, 0.2, 0.015),
      tone("triangle", 520, 720, 0.075, 0.1, 0.025),
    ],
  },
  "monster-heavy-death": {
    duration: 0.62,
    sounds: [
      tone("sine", 128, 54, 0.36, 0.34, 0),
      noise("lowpass", 620, 0.25, 0.34, 0.015),
      noise("bandpass", 2100, 0.12, 0.18, 0.04),
    ],
  },
  "monster-pop": {
    duration: 0.28,
    sounds: [
      tone("triangle", 320, 140, 0.12, 0.18, 0),
      noise("bandpass", 1800, 0.12, 0.22, 0.005),
    ],
  },
  "monster-shatter": {
    duration: 0.38,
    sounds: [
      noise("highpass", 3300, 0.2, 0.22, 0),
      tone("triangle", 760, 380, 0.08, 0.1, 0.015),
      tone("triangle", 1050, 640, 0.11, 0.08, 0.035),
    ],
  },
  "projectile-impact": {
    duration: 0.13,
    sounds: [
      tone("triangle", 940, 420, 0.035, 0.16, 0),
      noise("bandpass", 3600, 0.055, 0.12, 0.004),
    ],
  },
  "slow-pulse": {
    duration: 0.42,
    sounds: [
      tone("sine", 220, 196, 0.3, 0.12, 0),
      tone("triangle", 440, 587, 0.22, 0.1, 0.015),
      tone("sine", 660, 880, 0.18, 0.08, 0.05),
    ],
  },
  "splitter-burst": {
    duration: 0.5,
    sounds: [
      tone("sawtooth", 330, 520, 0.12, 0.14, 0),
      tone("triangle", 520, 260, 0.16, 0.14, 0.055),
      noise("bandpass", 2500, 0.18, 0.24, 0.02),
    ],
  },
  "tower-place": {
    duration: 0.32,
    sounds: [
      noise("highpass", 2200, 0.045, 0.12, 0),
      tone("square", 180, 120, 0.075, 0.1, 0),
      tone("triangle", 320, 480, 0.1, 0.16, 0.035),
      tone("sine", 640, 905, 0.12, 0.12, 0.105),
    ],
  },
  "tower-sell": {
    duration: 0.28,
    sounds: [
      tone("triangle", 520, 260, 0.18, 0.13, 0),
      noise("bandpass", 1800, 0.06, 0.08, 0.025),
    ],
  },
  "tower-upgrade": {
    duration: 0.36,
    sounds: [
      tone("triangle", 392, 392, 0.08, 0.1, 0),
      tone("triangle", 523, 523, 0.08, 0.1, 0.08),
      tone("triangle", 784, 784, 0.12, 0.11, 0.16),
    ],
  },
  "wave-clear": {
    duration: 0.5,
    sounds: [
      tone("triangle", 392, 392, 0.08, 0.1, 0),
      tone("triangle", 587, 587, 0.1, 0.1, 0.09),
      tone("triangle", 784, 784, 0.14, 0.12, 0.19),
    ],
  },
};

function tone(type, frequencyStart, frequencyEnd, duration, gain, delay) {
  return { kind: "tone", type, frequencyStart, frequencyEnd, duration, gain, delay };
}

function noise(type, frequency, duration, gain, delay) {
  return { kind: "noise", type, frequency, duration, gain, delay };
}

function createRandom(seedText) {
  let seed = 0x811c9dc5;
  for (const char of seedText) {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 0x01000193);
  }

  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function oscillatorValue(type, phase) {
  const cycle = (phase / (Math.PI * 2)) % 1;
  switch (type) {
    case "sine":
      return Math.sin(phase);
    case "square":
      return Math.sin(phase) >= 0 ? 1 : -1;
    case "sawtooth":
      return (2 * cycle) - 1;
    case "triangle":
      return 1 - (4 * Math.abs(cycle - 0.5));
    default:
      throw new Error(`Unknown oscillator type: ${type}`);
  }
}

function envelope(progress) {
  const attack = 0.08;
  if (progress <= 0) {
    return 0;
  }
  if (progress < attack) {
    return progress / attack;
  }
  return (1 - ((progress - attack) / (1 - attack))) ** 1.8;
}

function renderCue(name, cue) {
  const random = createRandom(name);
  const sampleCount = Math.ceil(cue.duration * sampleRate);
  const samples = new Float32Array(sampleCount);

  for (const sound of cue.sounds) {
    const startSample = Math.floor(sound.delay * sampleRate);
    const endSample = Math.min(sampleCount, Math.ceil((sound.delay + sound.duration) * sampleRate));

    if (sound.kind === "tone") {
      let phase = random() * Math.PI * 2;
      for (let index = startSample; index < endSample; index += 1) {
        const localTime = (index - startSample) / sampleRate;
        const progress = localTime / sound.duration;
        const ratio = sound.frequencyEnd / sound.frequencyStart;
        const frequency = sound.frequencyStart * (ratio ** progress);
        phase += (Math.PI * 2 * frequency) / sampleRate;
        samples[index] += oscillatorValue(sound.type, phase) * envelope(progress) * sound.gain;
      }
      continue;
    }

    let low = 0;
    let high = 0;
    const alpha = Math.min(0.98, (Math.PI * 2 * sound.frequency) / (Math.PI * 2 * sound.frequency + sampleRate));
    for (let index = startSample; index < endSample; index += 1) {
      const localTime = (index - startSample) / sampleRate;
      const progress = localTime / sound.duration;
      const white = (random() * 2) - 1;
      low += alpha * (white - low);
      high = white - low;
      const filtered = sound.type === "lowpass"
        ? low
        : sound.type === "highpass"
          ? high
          : low - (low * 0.35) + (high * 0.45);
      samples[index] += filtered * envelope(progress) * sound.gain;
    }
  }

  let peak = 0;
  for (const sample of samples) {
    peak = Math.max(peak, Math.abs(sample));
  }

  const normalization = peak > 0 ? Math.min(1, 0.92 / peak) : 1;
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.tanh(samples[index] * normalization * 1.35) * 0.86;
  }

  return samples;
}

function encodeWav(samples) {
  const bytesPerSample = 2;
  const buffer = Buffer.alloc(44 + (samples.length * bytesPerSample));
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + (samples.length * bytesPerSample), 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples.length * bytesPerSample, 40);

  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + (index * bytesPerSample));
  }

  return buffer;
}

mkdirSync(outputDir, { recursive: true });

const tempDir = mkdtempSync(resolve(tmpdir(), "vector-defence-audio-"));

function commandExists(command, args = ["-version"]) {
  const result = spawnSync(command, args, { stdio: "ignore" });
  return !result.error;
}

const encoder =
  commandExists("afconvert", ["-h"])
    ? (inputPath, outputPath) => spawnSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", "64000", inputPath, outputPath], {
        stdio: "inherit",
      })
    : commandExists("ffmpeg")
      ? (inputPath, outputPath) => spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", inputPath, "-c:a", "aac", "-b:a", "64k", outputPath], {
          stdio: "inherit",
        })
      : undefined;

if (!encoder) {
  console.error("Audio generation requires afconvert or ffmpeg to encode 64 kbps AAC assets.");
  rmSync(tempDir, { recursive: true, force: true });
  process.exit(1);
}

for (const [name, cue] of Object.entries(cues)) {
  const samples = renderCue(name, cue);
  const wavPath = resolve(tempDir, `${name}.wav`);
  const m4aPath = resolve(outputDir, `${name}.m4a`);
  writeFileSync(wavPath, encodeWav(samples));
  const result = encoder(wavPath, m4aPath);
  if (result.status !== 0) {
    rmSync(tempDir, { recursive: true, force: true });
    process.exit(result.status ?? 1);
  }
}

rmSync(tempDir, { recursive: true, force: true });

console.log(`Wrote ${Object.keys(cues).length} audio assets to ${outputDir}`);
