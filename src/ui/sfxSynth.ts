// ZzFX-style sound synthesis into a sample array (pure; unit-tested in Node).
import type { SoundDef } from '../config/audio.ts';

/** Render one sound at `sampleRate`. `random` is injectable for tests. */
export function synth(def: SoundDef, sampleRate: number, random: () => number = Math.random): Float32Array<ArrayBuffer> {
  const total = def.attack + def.sustain + def.release;
  const n = Math.max(1, Math.round(total * sampleRate));
  const out = new Float32Array(n);
  let phase = 0, lp = 0;
  const alpha = def.lowpass > 0 ? 1 - Math.exp((-2 * Math.PI * def.lowpass) / sampleRate) : 1;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const f = def.freq + (def.freqEnd - def.freq) * (t / total);
    phase += f / sampleRate;
    const p = phase % 1;
    let osc: number;
    switch (def.wave) {
      case 'sine': osc = Math.sin(p * Math.PI * 2); break;
      case 'square': osc = p < 0.5 ? 1 : -1; break;
      case 'saw': osc = p * 2 - 1; break;
      case 'triangle': osc = 1 - Math.abs(p * 4 - 2); break;
      default: osc = random() * 2 - 1;
    }
    const noise = random() * 2 - 1;
    let v = osc * (1 - def.noise) + noise * def.noise;
    lp += (v - lp) * alpha;
    v = lp;
    const env = t < def.attack ? t / def.attack : t < def.attack + def.sustain ? 1 : Math.max(0, 1 - (t - def.attack - def.sustain) / def.release);
    out[i] = v * env * def.volume;
  }
  return out;
}
