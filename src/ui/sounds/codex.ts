import type { SoundSet } from './types.ts';
import { air, buffer, finish, knock, metal, room, tone } from './codex/synthesis.ts';

/** Independent A/B set: dry toy-metal attacks, noisy bodies, restrained sub and short coloured tails. */
export const CODEX_SOUNDS: SoundSet = {
  uiHover(rate, random) {
    const out = buffer(rate, .038);
    air(out, rate, random, { duration: .006, gain: .22, high: 1700, low: 5800, decay: .0018 });
    metal(out, rate, .0005, .026, 1260, .13, .0045);
    tone(out, rate, .001, .019, 310, 220, .003, .045, .005);
    air(out, rate, random, { at: .005, duration: .025, gain: .025, high: 850, low: 3400, decay: .005 });
    return finish(out, rate, .075, 1, .0008);
  },

  knife(rate, random) {
    const out = buffer(rate, .225), pitch = .96 + random() * .08;
    air(out, rate, random, { duration: .011, gain: .13, high: 2400, low: 7500, decay: .0028 });
    air(out, rate, random, { at: .009, duration: .17, gain: 1.05, high: 350, endHigh: 1400,
      low: 1500, endLow: 6500, attack: .028, decay: .048 });
    air(out, rate, random, { at: .025, duration: .145, gain: .27, high: 120, low: 800, endLow: 350, attack: .012, decay: .038 });
    metal(out, rate, .053, .12, 2860 * pitch, .048, .021);
    tone(out, rate, .018, .065, 190, 90, .015, .085, .017, .006);
    air(out, rate, random, { at: .105, duration: .11, gain: .1, high: 750, low: 4200, endLow: 1800, decay: .025, attack: .004 });
    return finish(out, rate, .49, 1.2, .0006);
  },

  pistol(rate, random) {
    const out = buffer(rate, .225), pitch = .985 + random() * .03;
    air(out, rate, random, { duration: .01, gain: 1.45, high: 1400, low: 8200, decay: .0025 });
    air(out, rate, random, { at: .001, duration: .072, gain: 1.6, high: 170, low: 5000, endLow: 1100, decay: .014 });
    knock(out, rate, random, .001, .08, 640 * pitch, .85, 1.25, .019);
    tone(out, rate, .001, .095, 174 * pitch, 76 * pitch, .011, .48, .025);
    air(out, rate, random, { at: .02, duration: .17, gain: .19, high: 260, low: 2600, endLow: 850, decay: .027, attack: .001 });
    metal(out, rate, .033, .044, 1770, .04, .006);
    room(out, rate, .075, .022);
    return finish(out, rate, .86, 1.55);
  },

  rifle(rate, random) {
    const out = buffer(rate, .108), pitch = .98 + random() * .04;
    air(out, rate, random, { duration: .007, gain: 1.4, high: 1800, low: 7800, decay: .0017 });
    air(out, rate, random, { at: .0005, duration: .052, gain: 1.65, high: 240, low: 4400, endLow: 950, decay: .0105 });
    knock(out, rate, random, .001, .055, 890 * pitch, .7, 1.1, .012);
    tone(out, rate, .0005, .065, 150 * pitch, 72 * pitch, .008, .48, .016);
    metal(out, rate, .025, .034, 2100, .035, .0045);
    air(out, rate, random, { at: .018, duration: .08, gain: .095, high: 480, low: 2000, endLow: 900, decay: .013 });
    // No room feedback: a 100 ms firing interval should remain a series of separate punches.
    return finish(out, rate, .82, 1.65, .0003);
  },

  sniper(rate, random) {
    const out = buffer(rate, .74), pitch = .985 + random() * .03;
    air(out, rate, random, { duration: .013, gain: 1.85, high: 1900, low: 9400, decay: .0028 });
    air(out, rate, random, { at: .001, duration: .185, gain: 2.15, high: 110, low: 5200, endLow: 850, decay: .033 });
    knock(out, rate, random, .002, .21, 410 * pitch, .72, 1.5, .042);
    tone(out, rate, .001, .3, 126 * pitch, 45 * pitch, .022, .94, .062);
    tone(out, rate, .002, .19, 231 * pitch, 104, .016, .17, .036);
    air(out, rate, random, { at: .036, duration: .64, gain: .34, high: 180, low: 3400, endLow: 650, decay: .11, attack: .002 });
    air(out, rate, random, { at: .085, duration: .2, gain: .075, high: 1800, low: 5300, decay: .026 });
    room(out, rate, .19, .041);
    return finish(out, rate, .93, 1.65);
  },

  shotgun(rate, random) {
    const out = buffer(rate, .415), pitch = .97 + random() * .06;
    air(out, rate, random, { duration: .01, gain: 1.3, high: 1200, low: 7600, decay: .0025 });
    air(out, rate, random, { at: .001, duration: .14, gain: 2, high: 90, low: 4400, endLow: 650, decay: .028 });
    // Slightly staggered noisy clusters add mass/width in mono, without stereo tricks or repeated clicks.
    knock(out, rate, random, .001, .12, 330 * pitch, .62, 1.6, .029);
    knock(out, rate, random, .0035, .105, 970 * pitch, .7, .65, .023);
    tone(out, rate, .001, .21, 138 * pitch, 49 * pitch, .018, .83, .039);
    air(out, rate, random, { at: .027, duration: .34, gain: .25, high: 180, low: 2700, endLow: 650, decay: .052, attack: .001 });
    metal(out, rate, .054, .055, 1320, .04, .009);
    room(out, rate, .095, .028);
    return finish(out, rate, .9, 1.85);
  },

  step(rate, random) {
    const length = .136 + random() * .035, pitch = .87 + random() * .26;
    const toe = .018 + random() * .011, grit = .7 + random() * .6, level = .19 + random() * .045;
    const out = buffer(rate, length);
    air(out, rate, random, { duration: .008, gain: .12, high: 400, low: 3000, decay: .002 });
    knock(out, rate, random, 0, .085, 285 * pitch, .85, .64, .019);
    tone(out, rate, .001, .096, 131 * pitch, 68 * pitch, .014, .5, .021, .002);
    air(out, rate, random, { at: toe, duration: length - toe - .008, gain: .23 * grit, high: 650,
      low: 3400, endLow: 1600, attack: .003, decay: .022 });
    knock(out, rate, random, toe, .062, 680 * pitch, .7, .23, .012);
    return finish(out, rate, level, 1.25, .0013);
  },

  hit(rate, random) {
    const out = buffer(rate, .102);
    air(out, rate, random, { duration: .009, gain: .7, high: 1800, low: 6500, decay: .002 });
    knock(out, rate, random, .001, .05, 1130, 1.1, .7, .01);
    tone(out, rate, .0008, .055, 820, 620, .005, .22, .011);
    tone(out, rate, .001, .052, 240, 145, .006, .23, .01);
    air(out, rate, random, { at: .009, duration: .077, gain: .09, high: 950, low: 3200, decay: .012 });
    return finish(out, rate, .66, 1.5);
  },

  headshot(rate, random) {
    const out = buffer(rate, .285);
    air(out, rate, random, { duration: .009, gain: .7, high: 2100, low: 8500, decay: .0024 });
    knock(out, rate, random, .001, .05, 870, .75, .7, .011);
    tone(out, rate, .001, .067, 280, 130, .007, .25, .012);
    metal(out, rate, .002, .255, 2130, .3, .045);
    tone(out, rate, .004, .15, 3270, 3240, .012, .09, .029);
    air(out, rate, random, { at: .012, duration: .11, gain: .085, high: 1400, low: 5200, decay: .019 });
    room(out, rate, .09, .014);
    return finish(out, rate, .74, 1.2);
  },

  loot(rate, random) {
    const out = buffer(rate, .365), shimmer = .997 + random() * .006;
    air(out, rate, random, { duration: .008, gain: .13, high: 2100, low: 6500, decay: .002 });
    // Rising consonant glass strikes: no square wave, bitcrushing, arpeggiator reset or piercing sustain.
    metal(out, rate, .001, .2, 1046.5 * shimmer, .21, .039);
    metal(out, rate, .048, .235, 1568 * shimmer, .18, .047);
    metal(out, rate, .095, .25, 2093 * shimmer, .15, .054);
    tone(out, rate, .001, .07, 340, 250, .012, .04, .018, .002);
    air(out, rate, random, { at: .05, duration: .25, gain: .045, high: 1900, low: 6200, endLow: 2800, decay: .055, attack: .007 });
    room(out, rate, .13, .018);
    return finish(out, rate, .39, 1.1, .0008);
  },
};
