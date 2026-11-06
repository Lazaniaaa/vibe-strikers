// Feedback in a match: kill streak banners and the first-match controls hint (owner 2026-11-06, GAME.md 6.10).
export const KILL_STREAK = {
  /** A next kill within this time continues the chain. */
  windowMs: 4000,
  /** Banner by chain length; longer chains use the last one. */
  labels: ['', '', 'DOUBLE KILL', 'TRIPLE KILL', 'QUAD KILL', 'MULTI KILL'],
  /** Banner for killing the whole enemy side alone in one round (needs at least `aceMinEnemies`). */
  aceLabel: 'ACE',
  aceMinEnemies: 2,
  bannerSeconds: 1.8,
} as const;

export const FIRST_MATCH_HINT = {
  /** How long the controls stay on screen in the player's first match; shown once per browser. */
  ms: 12_000,
  storageKey: 'vs-controls-seen',
} as const;
