// Round presets (GAME.md section 2.1).

export interface RoundPreset {
  /** First team to this many round wins takes the match. */
  winsToMatch: number;
  roundTime: number;
  freezeTime: number;
  roundEndTime: number;
}

export const ROUND_PRESETS = {
  test: { winsToMatch: 3, roundTime: 45, freezeTime: 5, roundEndTime: 4 },
  live: { winsToMatch: 7, roundTime: 105, freezeTime: 5, roundEndTime: 4 },
} as const satisfies Record<string, RoundPreset>;

export type RoundPresetId = keyof typeof ROUND_PRESETS;

export const MATCH = {
  preset: 'test' as RoundPresetId,
  /** Team size including the local player (team A). GAME.md default 4v4. */
  teamSize: 4,
  friendlyFire: false,
  maxHealth: 100,
} as const;
