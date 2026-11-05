// The owner's picks from the sound A/B rounds (2026-11-06, docs/PROGRESS.md): which code-made recipe plays for
// each game sound. Volumes and pitch variation are in src/config/audio.ts (PICKED_SOUNDS).
import type { SoundName } from '../../config/audio.ts';
import type { SoundRecipe } from './types.ts';
import { CLAUDE_SOUNDS } from './claude.ts';
import { CODEX_SOUNDS } from './codex.ts';
import { ROUND2, ROUND3 } from './round2.ts';

const pick = (list: readonly SoundRecipe[] | undefined, i: number): SoundRecipe => {
  const r = list?.[i];
  if (!r) throw new Error(`sound pick ${i} missing`);
  return r;
};

export const PICKED_RECIPES: Partial<Record<SoundName, SoundRecipe>> = {
  shot_knife: CLAUDE_SOUNDS.knife, // round 1: Claude
  shot_pistol: pick(ROUND2.pistol, 2), // round 2 v3 "cap gun" (v2 kept as the alternative)
  shot_rifle: pick(ROUND2.rifle, 2), // round 2 v3 "pew-tak"
  shot_shotgun: pick(ROUND2.shotgun, 2), // round 2 v3 "poof"
  shot_sniper: pick(ROUND3.sniper, 0), // round 3 v1 "BAM" (for now)
  hit: pick(ROUND2.hit, 1), // round 2 v2 "thock"
  headshot: CODEX_SOUNDS.headshot, // round 1: Codex
  step: CLAUDE_SOUNDS.step, // round 1: Claude
  hover: CODEX_SOUNDS.uiHover, // round 1: Codex
  loot: CODEX_SOUNDS.loot, // round 1: Codex
};
