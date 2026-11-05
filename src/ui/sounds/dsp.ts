// Small sample-level DSP toolkit for the code-made sounds (src/ui/sounds/claude.ts). Pure functions on
// Float32Array: no Web Audio, so the sounds render the same in the browser and in Node tests.

export type Buf = Float32Array<ArrayBuffer>;

/** Silent buffer of `seconds`. */
export function buffer(sampleRate: number, seconds: number): Buf {
  return new Float32Array(Math.max(1, Math.round(seconds * sampleRate)));
}

/** White noise in [-1, 1]. */
export function noise(sampleRate: number, seconds: number, random: () => number): Buf {
  const out = buffer(sampleRate, seconds);
  for (let i = 0; i < out.length; i++) out[i] = random() * 2 - 1;
  return out;
}

/** Linear attack, then exponential decay with time constant `tau` (both seconds). */
export function envelope(t: number, attack: number, tau: number): number {
  if (t < attack) return t / attack;
  return Math.exp(-(t - attack) / tau);
}

/** Multiply in place by envelope(attack, tau), starting at `delay` seconds (silent before). */
export function shape(buf: Buf, sampleRate: number, attack: number, tau: number, delay = 0): Buf {
  const start = Math.min(buf.length, Math.max(0, Math.round(delay * sampleRate)));
  const rise = Math.max(1, Math.round(attack * sampleRate));
  buf.fill(0, 0, start);
  // Same curve as envelope(), with the decay as a per-sample multiplier (no exp per sample).
  const fall = Math.exp(-1 / (tau * sampleRate));
  let g = 1;
  for (let i = start; i < buf.length; i++) {
    const k = i - start;
    if (k < rise) buf[i] *= k / rise;
    else { buf[i] *= g; g *= fall; }
  }
  return buf;
}

export type Wave = 'sine' | 'triangle' | 'saw' | 'square';

/**
 * Oscillator whose frequency glides exponentially from `f0` to `f1` over `glide` seconds, then holds `f1`.
 */
export function tone(sampleRate: number, seconds: number, wave: Wave, f0: number, f1 = f0, glide = seconds): Buf {
  const out = buffer(sampleRate, seconds);
  let phase = 0, f = f0;
  // Exponential glide as a per-sample multiplier (no pow per sample).
  const glideSamples = Math.max(1, Math.round(glide * sampleRate)), step = Math.pow(f1 / f0, 1 / glideSamples);
  for (let i = 0; i < out.length; i++) {
    f = i < glideSamples ? f * step : f1;
    phase += f / sampleRate;
    if (phase >= 1) phase -= 1;
    out[i] = wave === 'sine' ? Math.sin(phase * Math.PI * 2)
      : wave === 'triangle' ? 1 - Math.abs(phase * 4 - 2)
      : wave === 'saw' ? phase * 2 - 1
      : phase < 0.5 ? 1 : -1;
  }
  return out;
}

export type FilterType = 'lowpass' | 'highpass' | 'bandpass';

/**
 * RBJ biquad filter in place. `cutoff` is a fixed frequency or a function of time (seconds) for sweeps;
 * coefficients are refreshed every 16 samples.
 */
export function biquad(buf: Buf, sampleRate: number, type: FilterType, cutoff: number | ((t: number) => number), q = 0.707): Buf {
  let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const update = (f: number) => {
    const w = 2 * Math.PI * Math.min(Math.max(f, 10), sampleRate * 0.45) / sampleRate;
    const cos = Math.cos(w), alpha = Math.sin(w) / (2 * q), a0 = 1 + alpha;
    if (type === 'lowpass') { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = b0; }
    else if (type === 'highpass') { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = b0; }
    else { b0 = alpha; b1 = 0; b2 = -alpha; }
    b0 /= a0; b1 /= a0; b2 /= a0; a1 = (-2 * cos) / a0; a2 = (1 - alpha) / a0;
  };
  const fixed = typeof cutoff === 'number';
  if (fixed) update(cutoff);
  for (let i = 0; i < buf.length; i++) {
    if (!fixed && (i & 15) === 0) update(cutoff(i / sampleRate));
    const x = buf[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    buf[i] = y;
  }
  return buf;
}

/** Exponential sweep from `from` to `to` Hz over `seconds` (for biquad cutoffs). */
export function sweep(from: number, to: number, seconds: number): (t: number) => number {
  const ratio = to / from;
  return (t) => (t >= seconds ? to : from * Math.pow(ratio, t / seconds));
}

/** Soft saturation in place (tanh, `drive` > 1 = more grit), level-compensated. */
export function saturate(buf: Buf, drive: number): Buf {
  const k = 1 / Math.tanh(drive);
  for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i] * drive) * k;
  return buf;
}

/** Add `src` × gain into `dst`, starting `delay` seconds in. */
export function mix(dst: Buf, src: Buf, sampleRate: number, gain = 1, delay = 0): Buf {
  const start = Math.round(delay * sampleRate);
  const n = Math.min(src.length, dst.length - start);
  for (let i = 0; i < n; i++) dst[start + i] += src[i] * gain;
  return dst;
}

/**
 * Short Schroeder reverb (4 combs + 2 allpasses). Returns dry + wet; `size` scales the delays (1 = small room),
 * `feedback` sets the tail length, `wet` its level.
 */
export function reverb(buf: Buf, sampleRate: number, size: number, feedback: number, wet: number): Buf {
  const combs = [0.0297, 0.0371, 0.0411, 0.0437].map((d) => Math.max(1, Math.round(d * size * sampleRate)));
  const out = new Float32Array(buf.length);
  for (const d of combs) {
    const line = new Float32Array(d);
    let p = 0, damp = 0;
    for (let i = 0; i < buf.length; i++) {
      const y = line[p];
      damp = damp * 0.3 + y * 0.7; // a little high-frequency damping in the loop
      line[p] = buf[i] + damp * feedback;
      if (++p === d) p = 0;
      out[i] += y / combs.length;
    }
  }
  for (const d0 of [0.005, 0.0017]) {
    const d = Math.max(1, Math.round(d0 * sampleRate)), line = new Float32Array(d);
    let p = 0;
    for (let i = 0; i < out.length; i++) {
      const delayed = line[p], x = out[i];
      const y = -0.5 * x + delayed;
      line[p] = x + 0.5 * y;
      if (++p === d) p = 0;
      out[i] = y;
    }
  }
  for (let i = 0; i < buf.length; i++) buf[i] += out[i] * wet;
  return buf;
}

/** Remove DC, fade the edges (`fade` seconds) and scale the peak to `peak`. */
export function finish(buf: Buf, sampleRate: number, peak: number, fade = 0.003): Buf {
  let mean = 0;
  for (let i = 0; i < buf.length; i++) mean += buf[i];
  mean /= buf.length;
  const nf = Math.max(1, Math.round(fade * sampleRate));
  let max = 0;
  for (let i = 0; i < buf.length; i++) {
    let v = buf[i] - mean;
    if (i < nf) v *= i / nf;
    const fromEnd = buf.length - 1 - i;
    if (fromEnd < nf * 4) v *= fromEnd / (nf * 4);
    buf[i] = v;
    max = Math.max(max, Math.abs(v));
  }
  if (max > 0) for (let i = 0; i < buf.length; i++) buf[i] *= peak / max;
  return buf;
}
