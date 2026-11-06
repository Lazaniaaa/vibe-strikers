// Player levels and seasons (owner 2026-11-06, GAME.md 6.10). XP comes from real online matches (the same guard as
// coins: MARKET.reward.minPlayers / minMatchSeconds) of logged-in players. Rewards are fixed and visible in advance
// (no random boxes), characters stay playable for everyone: reward items only add to the tradable collection.

export const PROGRESSION = {
  /** XP per match event. Pacing: a match of about 3 minutes gives about 100 XP. */
  xp: { match: 50, win: 50, kill: 10, headshot: 5, firstWinOfDay: 100, matchCap: 500 },
  /** Player level: reaching level L + 1 from L costs baseXp + stepXp * (L - 1). Levels stop at `max`. */
  level: { baseXp: 500, stepXp: 100, max: 100 },
} as const;

export interface SeasonMission { readonly id: string; readonly label: string; readonly field: 'matches' | 'wins' | 'kills'; readonly target: number; readonly xp: number }

export const SEASON = {
  id: 1,
  name: 'Season 1',
  /** 4 weeks. XP stops counting for the season at `endMs`; rewards earned stay claimable. */
  startMs: Date.UTC(2026, 10, 6),
  endMs: Date.UTC(2026, 11, 4),
  levels: 30,
  /**
   * Pacing: 25 minutes a day = about 7 matches = 800 XP a day with the first win; 28 days + 12 missions = about
   * 26 000 XP = 87% of the track, so the last levels ask for a bit more play.
   */
  xpPerLevel: 1000,
  /** Reward of a level without an item. */
  coinsPerLevel: 30,
  /** Fixed reward items (catalog refs; the unit test checks them against the catalog). */
  items: {
    5: 'emote:hop',
    10: 'character:vibe-vibers-viber-142',
    15: 'emote:dance',
    20: 'character:vibe-vibers-bureau-25',
    25: 'emote:cheer',
    30: 'character:vibe-vibers-viber-extra-20',
  } as Readonly<Record<number, string>>,
  /** Extra coins with the last level's item. */
  finalCoins: 500,
  /** Missions of every week (weeks start Monday 00:00 UTC, weekOf); XP is given once a mission is done. */
  missions: [
    { id: 'matches', label: 'Play 5 matches', field: 'matches', target: 5, xp: 300 },
    { id: 'kills', label: 'Get 20 kills', field: 'kills', target: 20, xp: 300 },
    { id: 'wins', label: 'Win 3 matches', field: 'wins', target: 3, xp: 300 },
  ] as readonly SeasonMission[],
} as const;
