/** Independent sample-domain DSP. Seconds, Hz and linear gains; no playback or global PRNG. */
const TAU = Math.PI * 2;
type Random = () => number;

export function buffer(rate: number, seconds: number): Float32Array {
  if (!Number.isFinite(rate) || rate < 1000 || rate > 384000) throw new RangeError('Unsupported sample rate');
  return new Float32Array(Math.ceil(rate * seconds));
}

const pole = (hz: number, rate: number): number => 1 - Math.exp(-TAU * Math.min(rate * .44, Math.max(10, hz)) / rate);
/** Evaluate only the short attack/release ramps; the exponential decay is a multiplicative recurrence. */
const edge = (i: number, count: number, attack: number, release: number): number => {
  let gain = 1;
  if (i < attack) { const x = i / attack; gain = x * x * (3 - 2 * x); }
  const remaining = count - 1 - i;
  if (remaining < release) { const x = remaining / release; gain *= x * x * (3 - 2 * x); }
  return gain;
};

export interface Air {
  at?: number; duration: number; gain: number; attack?: number; decay: number;
  high: number; low: number; endLow?: number; endHigh?: number;
}

/** Two one-poles isolate a noise band; independently moving corners give an air/filter sweep. */
export function air(out: Float32Array, rate: number, random: Random, p: Air): void {
  const start = Math.round((p.at ?? 0) * rate), count = Math.min(Math.ceil(p.duration * rate), out.length - start);
  const lo0 = pole(p.low, rate), lo1 = pole(p.endLow ?? p.low, rate);
  const hi0 = pole(p.high, rate), hi1 = pole(p.endHigh ?? p.high, rate);
  const attack = Math.max(1, (p.attack ?? .0005) * rate), release = Math.min(.008, p.duration * .2) * rate;
  const decay = Math.exp(-1 / (rate * p.decay));
  let low = 0, high = 0, gain = p.gain;
  for (let i = 0; i < count; i++) {
    const u = i / count, noise = random() * 2 - 1;
    high += (noise - high) * (hi0 + (hi1 - hi0) * u);
    low += (noise - high - low) * (lo0 + (lo1 - lo0) * u);
    out[start + i] += low * gain * edge(i, count, attack, release); gain *= decay;
  }
}

/** A constant-peak RBJ bandpass, excited by noise. Resonant body without a laser-like pitched whistle. */
export function knock(out: Float32Array, rate: number, random: Random, at: number, duration: number,
  frequency: number, q: number, gain: number, decay: number): void {
  const w = TAU * Math.min(rate * .4, frequency) / rate, alpha = Math.sin(w) / (2 * q);
  const b0 = alpha / (1 + alpha), a1 = -2 * Math.cos(w) / (1 + alpha), a2 = (1 - alpha) / (1 + alpha);
  const start = Math.round(at * rate), count = Math.min(Math.ceil(duration * rate), out.length - start);
  const fall = Math.exp(-1 / (rate * decay)), attack = .0007 * rate, release = Math.min(.008, duration * .2) * rate;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, level = gain;
  for (let i = 0; i < count; i++) {
    const x = random() * 2 - 1;
    const y = b0 * (x - x2) - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    out[start + i] += y * level * edge(i, count, attack, release); level *= fall;
  }
}

/** Exponential frequency settling, integrated analytically: no discontinuous pitch steps. */
export function tone(out: Float32Array, rate: number, at: number, duration: number,
  from: number, to: number, settle: number, gain: number, decay: number, attack = .0008): void {
  const start = Math.round(at * rate), count = Math.min(Math.ceil(duration * rate), out.length - start);
  // Keep even the upper inharmonic modes below Nyquist when rendering at reduced sample rates.
  const f0 = Math.min(rate * .43, from), f1 = Math.min(rate * .43, to);
  const fall = Math.exp(-1 / (rate * decay)), sweep = Math.exp(-1 / (rate * settle));
  const release = Math.min(.008, duration * .2) * rate, phaseStep = TAU * f1 / rate;
  const sweepPhase = TAU * (f0 - f1) * settle;
  let level = gain, exponential = 1, basePhase = 0;
  for (let i = 0; i < count; i++) {
    out[start + i] += Math.sin(basePhase + sweepPhase * (1 - exponential)) * level * edge(i, count, attack * rate, release);
    basePhase += phaseStep; exponential *= sweep; level *= fall;
  }
}

/** A few inharmonic decaying modes make a small physical/toy strike rather than an 8-bit waveform. */
export function metal(out: Float32Array, rate: number, at: number, duration: number,
  fundamental: number, gain: number, decay: number): void {
  tone(out, rate, at, duration, fundamental * 1.012, fundamental, .008, gain, decay, .001);
  tone(out, rate, at, duration * .8, fundamental * 2.713, fundamental * 2.701, .006, gain * .26, decay * .53, .0006);
  tone(out, rate, at, duration * .55, fundamental * 4.109, fundamental * 4.091, .004, gain * .09, decay * .3, .0005);
}

/** Short damped feedback combs plus one allpass. Used sparingly, only on already-rendered samples. */
export function room(out: Float32Array, rate: number, wet: number, span: number): void {
  const dry = out.slice(), delayA = Math.max(1, Math.round(rate * span));
  const delayB = Math.max(1, Math.round(rate * span * 1.317));
  const combA = new Float32Array(delayA), combB = new Float32Array(delayB);
  const allpass = new Float32Array(Math.max(1, Math.round(rate * .0047)));
  let ia = 0, ib = 0, ip = 0, lowA = 0, lowB = 0;
  const damping = pole(2100, rate);
  for (let i = 0; i < out.length; i++) {
    lowA += (combA[ia] - lowA) * damping; lowB += (combB[ib] - lowB) * damping;
    combA[ia] = dry[i] + lowA * .29; combB[ib] = dry[i] + lowB * .23;
    const input = (lowA + lowB) * .5, delayed = allpass[ip], diffused = delayed - input * .46;
    allpass[ip] = input + diffused * .46;
    out[i] += diffused * wet;
    if (++ia === delayA) ia = 0; if (++ib === delayB) ib = 0; if (++ip === allpass.length) ip = 0;
  }
}

/** Remove DC, soften peaks, taper both edges, then set the intended relative loudness. */
export function finish(out: Float32Array, rate: number, peak: number, drive = 1.3, attack = .0004): Float32Array {
  const dcPole = Math.exp(-TAU * 28 / rate), fadeIn = Math.max(1, Math.round(rate * attack));
  const fadeOut = Math.max(1, Math.round(rate * .006));
  let previous = 0, dc = 0, maximum = 0;
  for (let i = 0; i < out.length; i++) {
    const input = out[i]; dc = input - previous + dcPole * dc; previous = input;
    const x = dc * drive, soft = x / (1 + Math.abs(x));
    out[i] = soft * edge(i, out.length, fadeIn, fadeOut);
    maximum = Math.max(maximum, Math.abs(out[i]));
  }
  const gain = maximum > 0 ? Math.min(.94, peak) / maximum : 0;
  for (let i = 0; i < out.length; i++) out[i] *= gain;
  out[0] = out[out.length - 1] = 0;
  return out;
}
