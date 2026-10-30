import type { BoxSpec, CharacterConfig, HexColor, PartName, Vec3 } from './types';
import { batch1 } from './batch1';
import { batch2 } from './batch2';
import { batch3 } from './batch3';
import { batch4 } from './batch4';
import { batch5 } from './batch5';
import { batch6 } from './batch6';
import { holdReach } from './holdReach';

const b = (part: PartName, size: Vec3, position: Vec3, color: HexColor,
  options: Partial<Omit<BoxSpec, 'part' | 'size' | 'position' | 'color'>> = {}): BoxSpec =>
  ({ part, size, position, color, ...options });
const originalColors = {
  body: '#C33C93', top: '#E35AAA', outline: '#535352', lens: '#D7EAFC',
  frame: '#E7E0D2', eye: '#E3DED4', antenna: '#73654F', antennaTop: '#8B7B62',
  glove: '#2E3238', gloveTop: '#535352', chest: '#202F5A',
} as const;

/** Data migration preserves the exact original box ordering and all 01 hashes. */
function originalExtras(): BoxSpec[] {
  const c = originalColors;
  const boxes: BoxSpec[] = [];
  for (const side of [-1, 1]) {
    boxes.push(b('head', [0.11, 0.22, 0.16], [side * 0.595, 0.31, 0], c.body, { topColor: c.top }));
  }
  for (const side of [-1, 1]) {
    boxes.push(b('head', [0.31, 0.42, 0.09], [side * 0.338, 0.27, -0.433], c.lens,
      { topColor: c.frame, border: 0.016 }));
    boxes.push(b('head', [0.112, 0.235, 0.016], [side * 0.338, 0.25, -0.489], c.eye,
      { topColor: c.eye, border: 0.012 }));
  }
  boxes.push(b('head', [0.78, 0.13, 0.105], [0, 0.535, -0.44], c.frame));
  boxes.push(b('head', [0.56, 0.12, 0.11], [0, 0.645, -0.445], c.frame));
  for (const side of [-1, 1]) {
    boxes.push(b('head', [0.12, 0.33, 0.12], [side * 0.30, 1.055, -0.19], c.antenna,
      { topColor: c.antennaTop }));
    boxes.push(b('head', [0.12, 0.26, 0.12], [side * 0.40, 1.03, 0.18], c.antenna,
      { topColor: c.antennaTop }));
  }
  boxes.push(b('torso', [0.12, 0.095, 0.02], [0, -0.035, -0.24], c.chest, { border: 0.007 }));
  boxes.push(b('torso', [0.53, 0.115, 0.024], [0, -0.155, -0.242], c.chest, { border: 0.008 }));
  boxes.push(b('torso', [0.33, 0.09, 0.024], [-0.055, -0.26, -0.242], c.chest, { border: 0.007 }));
  return boxes;
}

const sharedGuesses = ['H0: приховані спина та бік без нового декору',
  'H1: парні кінцівки продовжені за видимою формою', 'P0: розміри й глибина оцінені з одного ракурсу'];

/** Shared template, original 01 plus the surveyed collection. */
const collection: readonly CharacterConfig[] = [
  { id: 'reference-01', name: 'Малиновий', colors: originalColors, extras: originalExtras() },
  {
    id: 'vibe-vibers-bureau-8', name: 'vibe-vibers-bureau-8',
    colors: { body: '#9481C0', top: '#A68FD7', side: '#756497', outline: '#130F0C',
      glove: '#17191A', dark: '#121416', eyes: '#9AB7FF', chest: '#282C31', trim: '#64A650' },
    proportions: { head: [1.12, 0.98, 0.88], torso: [0.77, 0.42, 0.55],
      arm: [0.25, 0.42, 0.29], hand: [0.36, 0.36, 0.42], leg: [0.23, 0.15, 0.28], foot: [0.23, 0.10, 0.35] },
    surfaces: {
      head: { color: '#9481C0', topColor: '#A68FD7', sideColor: '#756497' },
      torso: { color: '#9481C0', sideColor: '#756497' },
      arm: { color: '#17191A', sideColor: '#121416' },
      hand: { color: '#17191A', sideColor: '#121416' },
      leg: { color: '#17191A', sideColor: '#121416' }, foot: { color: '#17191A', sideColor: '#121416' },
    },
    layout: { centers: { armL: [0, -0.18, 0], armR: [0, -0.18, 0],
      handL: [0, -0.45, -0.18], handR: [0, -0.45, -0.18] } },
    extras: [
      b('head', [1.12, 0.86, 0.065], [0, 0.43, -0.475], '#17191A'),
      b('head', [0.16, 0.135, 0.055], [0.38, 0.40, -0.535], '#9AB7FF'),
      b('head', [0.16, 0.135, 0.055], [-0.38, 0.40, -0.535], '#9AB7FF'),
      b('armL', [0.25, 0.22, 0.29], [0, 0, 0], '#9481C0', { topColor: '#A68FD7', sideColor: '#756497' }),
      b('armR', [0.25, 0.22, 0.29], [0, 0, 0], '#9481C0', { topColor: '#A68FD7', sideColor: '#756497' }),
      b('torso', [0.67, 0.10, 0.08], [0, -0.07, -0.32], '#17191A'),
      b('torso', [0.67, 0.14, 0.08], [0, -0.32, -0.32], '#17191A'),
      b('torso', [0.075, 0.30, 0.08], [0.31, -0.20, -0.32], '#17191A'),
      b('torso', [0.075, 0.30, 0.08], [-0.31, -0.20, -0.32], '#17191A'),
      b('torso', [0.48, 0.085, 0.04], [0, -0.20, -0.296], '#282C31'),
      b('torso', [0.13, 0.12, 0.09], [-0.235, -0.21, -0.38], '#9AB7FF'),
      b('torso', [0.51, 0.08, 0.04], [0, -0.445, -0.28], '#64A650'),
    ],
    flags: [...sharedGuesses, 'P2: чорні опори не відділені на гомілку/черевик у референсі',
      'Рукавиці трохи нижче стоп у спокійній позі; силует не затиснуто під габарити 01'],
  },
  {
    id: 'vibe-vibers-viber-extra-12', name: 'vibe-vibers-viber-extra-12',
    colors: { body: '#97895E', top: '#A79967', side: '#776A4A', outline: '#130F0C',
      dark: '#17191A', light: '#CECBC1', lightSide: '#A29E96', eyes: '#FFF3A1' },
    proportions: { head: [1.12, 0.96, 0.88], torso: [0.78, 0.47, 0.55],
      arm: [0.12, 0.58, 0.14], hand: [0.26, 0.13, 0.27], leg: [0.27, 0.20, 0.28], foot: [0.25, 0.12, 0.32] },
    surfaces: { head: { color: '#97895E', topColor: '#A79967', sideColor: '#776A4A' },
      torso: { color: '#97895E', sideColor: '#776A4A' }, arm: { color: '#97895E', sideColor: '#776A4A' },
      hand: { color: '#CECBC1', topColor: '#E7E2D6', sideColor: '#A29E96' },
      leg: { color: '#CECBC1', sideColor: '#A29E96' }, foot: { color: '#17191A', sideColor: '#121416' } },
    extras: [
      b('head', [0.35, 0.34, 0.08], [0.34, 0.34, -0.48], '#17191A'),
      b('head', [0.35, 0.34, 0.08], [-0.34, 0.34, -0.48], '#17191A'),
      b('head', [0.12, 0.11, 0.08], [0.34, 0.34, -0.56], '#FFF3A1', { glow: true, border: 0.007 }),
      b('head', [0.12, 0.11, 0.08], [-0.34, 0.34, -0.56], '#FFF3A1', { glow: true, border: 0.007 }),
      b('head', [0.10, 0.48, 0.14], [0.65, 1.10, -0.35], '#97895E', { topColor: '#A79967', sideColor: '#776A4A' }),
      b('head', [0.10, 0.24, 0.14], [0.65, 0.74, -0.35], '#CECBC1'),
      ...[-1, 1].flatMap((side) => [
        b('torso', [0.22, 0.095, 0.075], [side * 0.22, -0.06, -0.31], '#17191A'),
        b('torso', [0.22, 0.095, 0.075], [side * 0.22, -0.29, -0.31], '#17191A'),
      ]),
    ],
    flags: [...sharedGuesses, 'H4: один бічний стрижень, без дзеркальної копії',
      'C2/G1: очі світні; ореол не відтворюється окремою геометрією'],
  },
  {
    id: 'vibe-vibers-viber-142', name: 'vibe-vibers-viber-142',
    colors: { body: '#D99E82', side: '#A97A66', outline: '#130F0C', eyes: '#FF8678',
      dark: '#17191A', light: '#CECBC1', lightSide: '#A29E96', trim: '#9E6047',
      hat: '#635848', hatTop: '#6F6250', hatSide: '#4E4538' },
    proportions: { head: [1.05, 0.89, 0.85], torso: [0.69, 0.43, 0.52],
      arm: [0.24, 0.30, 0.31], hand: [0.25, 0.22, 0.34], leg: [0.20, 0.26, 0.25], foot: [0.24, 0.08, 0.36],
      sides: { legL: [0.32, 0.26, 0.40], footL: [0.32, 0.08, 0.40],
        legR: [0.07, 0.08, 0.10], footR: [0.07, 0.04, 0.10] } },
    layout: { pivots: { head: [0, 0.77, 0], torso: [0, 0.77, 0],
      armL: [-0.50, 0.71, 0], armR: [0.50, 0.71, 0], legL: [0, 0.34, 0], legR: [-0.24, 0.27, 0.14] },
      centers: { legL: [0, -0.13, 0], footL: [0, -0.30, 0],
        legR: [0, -0.04, 0], footR: [0, -0.10, 0], handL: [0, -0.27, 0], handR: [0, -0.27, 0] } },
    surfaces: { head: { color: '#D99E82', sideColor: '#A97A66' },
      torso: { color: '#D99E82', sideColor: '#A97A66' }, arm: { color: '#D99E82', sideColor: '#A97A66' },
      hand: { color: '#9E6047', sideColor: '#7B4938' }, legL: { color: '#17191A' }, footL: { color: '#17191A' },
      legR: { color: '#CECBC1' }, footR: { color: '#CECBC1' } },
    extras: [
      b('head', [1.38, 0.065, 1.12], [0, 0.925, 0], '#635848', { topColor: '#6F6250', sideColor: '#4E4538' }),
      b('head', [0.64, 0.22, 0.64], [0, 1.065, 0.07], '#635848', { topColor: '#6F6250', sideColor: '#4E4538' }),
      b('head', [0.58, 0.10, 0.055], [0, 1.015, -0.275], '#9E6047'),
      ...[-1, 1].flatMap((side) => [
        b('head', [0.30, 0.28, 0.10], [side * 0.32, 0.31, -0.475], '#17191A'),
        b('head', [0.10, 0.09, 0.065], [side * 0.32, 0.30, -0.555], '#FF8678', { border: 0.006 }),
        b('head', [0.10, 0.25, 0.12], [side * 0.32, 0.045, -0.49], '#CECBC1'),
        b('head', [0.23, 0.33, 0.14], [side * 0.32, -0.245, -0.51], '#CECBC1', { sideColor: '#A29E96' }),
      ]),
      b('torso', [0.69, 0.06, 0.045], [0, -0.04, -0.285], '#9E6047'),
      b('torso', [0.69, 0.06, 0.045], [0, -0.16, -0.285], '#9E6047'),
      b('torso', [0.69, 0.06, 0.045], [0, -0.38, -0.285], '#9E6047'),
      b('torso', [0.39, 0.10, 0.04], [0, -0.26, -0.31], '#635848'),
    ],
    flags: [...sharedGuesses, 'H3/P1: верх голови під капелюхом оцінений',
      'P3: центральна чорна опора та малий світлий задній фрагмент, будову прихованої ноги не доведено',
      'Світлі передні підвіски приєднані до head, це не додаткові руки'],
  },
  {
    id: 'vibe-vibers-viber-extra-11', name: 'vibe-vibers-viber-extra-11',
    colors: { body: '#462F22', side: '#37241D', outline: '#130F0C', headObserved: '#63573B',
      headTopObserved: '#736E54', hat: '#635848', hatSide: '#4E4538', lens: '#D4F49E',
      eyes: '#DBEAB5', glowChest: '#D2F69A', trim: '#BB4333', noseTopObserved: '#D2855D', light: '#CECBC1', dark: '#282C31' },
    proportions: { head: [1.08, 0.90, 0.88], torso: [0.80, 0.45, 0.55],
      arm: [0.24, 0.24, 0.28], hand: [0.25, 0.13, 0.30], leg: [0.26, 0.15, 0.29], foot: [0.40, 0.14, 0.56] },
    surfaces: { head: { color: '#63573B', topColor: '#736E54', sideColor: '#37241D' },
      torso: { color: '#462F22', sideColor: '#37241D' }, arm: { color: '#462F22', sideColor: '#37241D' },
      hand: { color: '#CECBC1', sideColor: '#A29E96' }, leg: { color: '#282C31', sideColor: '#1F2326' },
      foot: { color: '#282C31', sideColor: '#1F2326' } },
    extras: [
      b('head', [0.76, 0.11, 0.65], [0, 0.955, 0.025], '#635848', { topColor: '#6F6250', sideColor: '#4E4538' }),
      b('head', [0.10, 0.09, 0.10], [0.045, 1.055, 0.045], '#CECBC1'),
      b('head', [0.10, 0.09, 0.10], [-0.045, 1.055, -0.045], '#CECBC1'),
      ...[-1, 1].flatMap((side) => [
        b('head', [0.43, 0.43, 0.085], [side * 0.29, 0.43, -0.483], '#D4F49E', { glow: true }),
        b('head', [0.23, 0.25, 0.05], [side * 0.29, 0.43, -0.552], '#DBEAB5'),
      ]),
      b('head', [0.84, 0.10, 0.08], [0, 0.12, -0.48], '#BB4333', { topColor: '#D2855D' }),
      b('head', [0.80, 0.075, 0.08], [0, 0.035, -0.47], '#CECBC1'),
      b('head', [0.20, 0.54, 0.24], [-0.59, 0.13, 0.24], '#635848', { sideColor: '#4E4538' }),
      b('head', [0.12, 0.43, 0.14], [-0.59, 0.60, 0.24], '#CECBC1'),
      b('head', [0.28, 0.22, 0.24], [-0.59, 0.31, -0.025], '#635848', { sideColor: '#4E4538' }),
      b('torso', [0.62, 0.33, 0.075], [0, -0.225, -0.31], '#17191A'),
      b('torso', [0.13, 0.22, 0.065], [0.16, -0.19, -0.38], '#D2F69A', { glow: true }),
      b('torso', [0.13, 0.12, 0.065], [-0.16, -0.24, -0.38], '#BB4333'),
      b('torso', [0.59, 0.065, 0.04], [0, -0.48, -0.29], '#BB4333'),
    ],
    flags: [...sharedGuesses, 'H2: один задньобічний модуль, без невидимих ременів і другого модуля',
      'C2: observed head F #63573B (550,300), T #736E54 (520,265); первинний колір до засвітки невідомий',
      'G1: яскраві лінзи й груди; без ореолу; по одному glow-мешу на head і torso'],
  },
  ...batch1,
  ...batch2,
  ...batch3,
  ...batch4,
  ...batch5,
  ...batch6,
];
export const characters: readonly CharacterConfig[] = collection.map(c=>holdReach[c.id]?{...c,holdReach:holdReach[c.id]}:c);
