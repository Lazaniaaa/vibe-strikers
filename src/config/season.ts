// Player levels and seasons (owner 2026-11-06, GAME.md 6.10). XP comes from real online matches (the same guard as
// coins: MARKET.reward.minPlayers / minMatchSeconds) of logged-in players. Rewards are fixed and visible in advance
// (no random boxes), characters stay playable for everyone: reward items only add to the tradable collection.

export const PROGRESSION = {
  /** XP per match event. Pacing: a match of about 3 minutes gives about 100 XP. */
  xp: { match: 50, win: 50, kill: 10, headshot: 5, firstWinOfDay: 100, matchCap: 500 },
  /** Player level: reaching level L + 1 from L costs baseXp + stepXp * (L - 1). Levels stop at `max`. */
  level: { baseXp: 500, stepXp: 100, max: 100 },
} as const;

export const DAY_MS = 24 * 60 * 60 * 1000;

export type QuestKind = 'day' | 'week' | 'season';
export type QuestField = 'matches' | 'wins' | 'kills' | 'headshots';
/** One mission line: every next tier asks for more (`targets`) and pays more (the kind's `xp`). */
export interface QuestTrack { readonly field: QuestField; readonly label: (n: number) => string; readonly targets: readonly number[] }

const games = (n: number) => `Play ${n} game${n === 1 ? '' : 's'}`;
const kills = (n: number) => `Get ${n} kills`;
const wins = (n: number) => `Win ${n} game${n === 1 ? '' : 's'}`;
const headshots = (n: number) => `Get ${n} headshots`;

/**
 * Missions with tiers (owner 2026-11-06). A game = a finished match, first to 3 round wins. XP is given once a tier is
 * done. `xp` = XP of tier 1, 2, 3. Days start 00:00 UTC, weeks Monday 00:00 UTC, season missions last the whole season.
 */
export const QUESTS: Readonly<Record<QuestKind, { readonly label: string; readonly xp: readonly number[]; readonly tracks: readonly QuestTrack[] }>> = {
  day: { label: 'Daily', xp: [50, 100, 200], tracks: [
    { field: 'matches', label: games, targets: [2, 5, 10] },
    { field: 'kills', label: kills, targets: [10, 25, 50] },
    { field: 'wins', label: wins, targets: [1, 3, 5] },
  ] },
  week: { label: 'Weekly', xp: [100, 200, 400], tracks: [
    { field: 'matches', label: games, targets: [5, 15, 30] },
    { field: 'kills', label: kills, targets: [20, 60, 150] },
    { field: 'wins', label: wins, targets: [3, 8, 15] },
  ] },
  season: { label: 'Season', xp: [300, 600, 1200], tracks: [
    { field: 'matches', label: games, targets: [20, 60, 150] },
    { field: 'kills', label: kills, targets: [100, 300, 800] },
    { field: 'wins', label: wins, targets: [10, 30, 60] },
    { field: 'headshots', label: headshots, targets: [20, 60, 150] },
  ] },
};

export const SEASON = {
  id: 1,
  name: 'Season 1',
  /** 4 weeks. XP stops counting for the season at `endMs`; rewards earned stay claimable. */
  startMs: Date.UTC(2026, 10, 6),
  endMs: Date.UTC(2026, 11, 4),
  levels: 30,
  /**
   * Pacing: 25 minutes a day = about 7 matches, 3 wins, 20 kills = 800 XP from matches + 350 from daily tiers; over 28
   * days with about 6800 from weekly and 7200 from season tiers = about 46 000 XP = 85% of the track, so the last levels
   * ask for a bit more play.
   */
  xpPerLevel: 1800,
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
} as const;
