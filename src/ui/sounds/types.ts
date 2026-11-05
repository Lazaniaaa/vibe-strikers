// Shared contract for the code-made sound sets (2026-11-05 A/B round: claude.ts vs codex.ts, compared blind in
// the sound lab, ?soundlab=1). A recipe renders samples once at load; the game never synthesises per shot.

/** Every sound a set must provide. */
export const SOUND_IDS = ['uiHover', 'knife', 'pistol', 'rifle', 'sniper', 'shotgun', 'step', 'hit', 'headshot', 'loot'] as const;
export type SoundId = (typeof SOUND_IDS)[number];

/**
 * Renders one sound: mono samples in [-1, 1] at `sampleRate`. `random` is injected (seeded in tests); the game
 * calls `step` several times to get variations. Pure code: no Web Audio, no files, no packages.
 */
export type SoundRecipe = (sampleRate: number, random: () => number) => Float32Array;

export type SoundSet = Readonly<Record<SoundId, SoundRecipe>>;

/** Hard limits every recipe must meet (checked by the tests). Durations in seconds. */
export const SOUND_LIMITS = {
  maxDuration: {
    uiHover: 0.12, knife: 0.35, pistol: 0.6, rifle: 0.45, sniper: 1.5, shotgun: 0.9,
    step: 0.25, hit: 0.2, headshot: 0.4, loot: 0.5,
  } satisfies Record<SoundId, number>,
  /** Peak level. */
  maxPeak: 0.95,
  /** First and last sample must be this close to 0 (no clicks). */
  edge: 0.02,
  /** Render time per sound at 48 kHz in Node, ms. */
  maxRenderMs: 30,
} as const;
