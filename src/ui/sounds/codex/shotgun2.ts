import type { SoundRecipe } from '../types.ts';
import { air, buffer, finish, knock, tone } from './synthesis.ts';

/** Dry pneumatic pillow cannon: rounded bass, soft air displacement, no ballistic crack. */
const pillowCannon: SoundRecipe = (rate, random) => {
  const out = buffer(rate, .245), pitch = .97 + random() * .06;
  air(out, rate, random, { duration: .045, gain: .62, high: 180, low: 1650,
    endLow: 650, attack: .0035, decay: .009 });
  air(out, rate, random, { at: .001, duration: .185, gain: 2.9, high: 65,
    low: 1400, endLow: 260, attack: .006, decay: .031 });
  knock(out, rate, random, .002, .12, 290 * pitch, .65, 1.4, .023);
  tone(out, rate, .001, .16, 161 * pitch, 57 * pitch, .013, .91, .031, .003);
  tone(out, rate, .002, .095, 355 * pitch, 143 * pitch, .014, .2, .018, .003);
  air(out, rate, random, { at: .035, duration: .17, gain: .2, high: 180,
    low: 1050, endLow: 330, attack: .005, decay: .027 });
  return finish(out, rate, .9, 1.5, .0025);
};

/** A cardboard confetti blaster: papery WHAP with overlapping fluffy grains, not echoes. */
const confettiBox: SoundRecipe = (rate, random) => {
  const out = buffer(rate, .205), pitch = .965 + random() * .07;
  air(out, rate, random, { duration: .023, gain: .7, high: 520, low: 2500,
    endLow: 1200, attack: .0025, decay: .0055 });
  air(out, rate, random, { at: .001, duration: .107, gain: 1.8, high: 210,
    low: 2200, endLow: 620, attack: .004, decay: .019 });
  air(out, rate, random, { at: .009, duration: .09, gain: .83, high: 350,
    low: 1750, endLow: 520, attack: .006, decay: .014 });
  air(out, rate, random, { at: .019, duration: .08, gain: .45, high: 250,
    low: 1400, endLow: 420, attack: .007, decay: .013 });
  knock(out, rate, random, .001, .095, 540 * pitch, .55, 1.45, .018);
  tone(out, rate, .001, .12, 187 * pitch, 83 * pitch, .01, .66, .022, .002);
  tone(out, rate, .002, .065, 410 * pitch, 182 * pitch, .009, .18, .012, .002);
  air(out, rate, random, { at: .043, duration: .115, gain: .09, high: 440,
    low: 1800, endLow: 700, attack: .003, decay: .018 });
  return finish(out, rate, .9, 1.45, .002);
};

/** A fast damped pitch bend adds a rubbery vocal BWOMP, with no second strike or ringing sustain. */
function rubberBody(out: Float32Array, rate: number, pitch: number): void {
  const seconds = .19, count = Math.min(out.length, Math.ceil(rate * seconds));
  const fall = Math.exp(-1 / (rate * .033)), settle = Math.exp(-1 / (rate * .014));
  const wobbleFall = Math.exp(-1 / (rate * .045));
  const base = Math.min(rate * .15, 65 * pitch), bend = 163 * pitch;
  const phaseStep = Math.PI * 2 / rate, wobbleStep = phaseStep * 18;
  let phase = 0, wobble = 0, drop = 1, wobbleLevel = 1, amplitude = .92;
  for (let i = 0; i < count; i++) {
    const attack = Math.min(1, i / (rate * .0035));
    const release = Math.min(1, (count - 1 - i) / (rate * .008));
    out[i] += Math.sin(phase) * amplitude * attack * attack * (3 - 2 * attack) * release * release;
    phase += phaseStep * (base + bend * drop + 20 * pitch * Math.sin(wobble) * wobbleLevel);
    wobble += wobbleStep; drop *= settle; wobbleLevel *= wobbleFall; amplitude *= fall;
  }
}

/** Oversized rubber cork/plunger: low rounded punch and a brief elastic formant, ending dead dry. */
const rubberCork: SoundRecipe = (rate, random) => {
  const out = buffer(rate, .265), pitch = .96 + random() * .08;
  air(out, rate, random, { duration: .021, gain: .35, high: 220, low: 1450,
    endLow: 700, attack: .003, decay: .006 });
  rubberBody(out, rate, pitch);
  tone(out, rate, .001, .125, 490 * pitch, 155 * pitch, .013, .23, .022, .003);
  knock(out, rate, random, .002, .12, 185 * pitch, .85, 1.4, .026);
  air(out, rate, random, { at: .001, duration: .15, gain: 2.15, high: 90,
    low: 1050, endLow: 290, attack: .006, decay: .029 });
  air(out, rate, random, { at: .032, duration: .15, gain: .16, high: 300,
    low: 1600, endLow: 460, attack: .004, decay: .023 });
  return finish(out, rate, .9, 1.55, .0025);
};

/** v1: pillow cannon; v2: confetti box; v3: rubber cork. No reverb, delays or sample assets. */
export const CODEX_SHOTGUN2: readonly SoundRecipe[] = [pillowCannon, confettiBox, rubberCork];
