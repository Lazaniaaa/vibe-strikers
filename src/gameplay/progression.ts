// Player level, season track and weekly missions (GAME.md 6.10). Pure math shared by the server module and the UI.
import { PROGRESSION, SEASON } from '../config/season.ts';

export interface LevelInfo { level: number; into: number; need: number }
export interface MissionCounts { matches: number; wins: number; kills: number }
export interface SeasonReward { coins: number; item: string }

/** XP cost of going from `level` to the next one. */
export function levelCost(level: number): number {
  return PROGRESSION.level.baseXp + PROGRESSION.level.stepXp * (level - 1);
}

/** Player level (starts at 1) of a total XP, with the progress inside that level. At the max level need = 0. */
export function levelOf(xp: number): LevelInfo {
  let level = 1, left = Math.max(0, xp);
  while (level < PROGRESSION.level.max && left >= levelCost(level)) { left -= levelCost(level); level++; }
  return level >= PROGRESSION.level.max ? { level, into: 0, need: 0 } : { level, into: left, need: levelCost(level) };
}

/** XP of one finished match. */
export function matchXp(won: boolean, kills: number, headshots: number, firstWinOfDay: boolean): number {
  const x = PROGRESSION.xp;
  const earned = x.match + (won ? x.win : 0) + kills * x.kill + headshots * x.headshot;
  return Math.min(x.matchCap, earned) + (firstWinOfDay ? x.firstWinOfDay : 0);
}

export function seasonActive(ms: number): boolean { return ms >= SEASON.startMs && ms < SEASON.endMs; }

/** Season level reached with this season XP (0 = none yet). */
export function seasonLevel(xp: number): number {
  return Math.min(SEASON.levels, Math.floor(Math.max(0, xp) / SEASON.xpPerLevel));
}

/** Reward of one season level: an item on the listed levels, coins on the others, both on the last one. */
export function seasonReward(level: number): SeasonReward {
  const item = SEASON.items[level] ?? '';
  const coins = level === SEASON.levels ? SEASON.finalCoins : item ? 0 : SEASON.coinsPerLevel;
  return { coins, item };
}

/** Everything earned by claiming levels after `claimed` up to `reached`. */
export function seasonClaim(claimed: number, reached: number): { coins: number; items: string[] } {
  let coins = 0;
  const items: string[] = [];
  for (let level = claimed + 1; level <= Math.min(reached, SEASON.levels); level++) {
    const r = seasonReward(level);
    coins += r.coins;
    if (r.item) items.push(r.item);
  }
  return { coins, items };
}

/** Bit mask of the missions these counts complete. */
export function missionsDone(c: MissionCounts): number {
  let done = 0;
  SEASON.missions.forEach((m, i) => { if (c[m.field] >= m.target) done |= 1 << i; });
  return done;
}

/** XP of the missions in `done` that are not in `before`. */
export function missionXp(before: number, done: number): number {
  let xp = 0;
  SEASON.missions.forEach((m, i) => { if (done & ~before & (1 << i)) xp += m.xp; });
  return xp;
}
