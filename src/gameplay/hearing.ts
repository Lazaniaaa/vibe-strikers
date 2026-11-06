// How loud a remote sound is at a distance (GAME.md 12). Pure, used by src/ui/sfx.ts and the unit test.
import { AUDIO, type SoundName } from '../config/audio.ts';

/** Gain 0..1 of a sound `dist` metres away. Sounds in AUDIO.hearing fade linearly to silence; others fall off as 1/d. */
export function hearingGain(name: SoundName, dist: number): number {
  const near = (AUDIO.hearing as Partial<Record<SoundName, { ref: number; max: number }>>)[name];
  if (near) {
    if (dist >= near.max) return 0;
    return dist <= near.ref ? 1 : (near.max - dist) / (near.max - near.ref);
  }
  if (dist > AUDIO.maxDistance) return 0;
  return dist <= AUDIO.refDistance ? 1 : AUDIO.refDistance / dist;
}
