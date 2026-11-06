// Player level, season track and weekly missions (GAME.md 6.10). Pure math shared by the server module and the UI.
import { DAY_MS, PROGRESSION, QUESTS, SEASON, type QuestKind } from '../config/season.ts';
import { REWARDS } from '../config/rewards.ts';

export interface LevelInfo { level: number; into: number; need: number }
export interface QuestCounts { matches: number; wins: number; kills: number; headshots: number }
/** What the UI shows for one mission line. */
export interface QuestLine { label: string; tier: number; tiers: number; value: number; target: number; xp: number; complete: boolean }
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

/** Row key part of the current period of a kind: `d20398`, `w2965`, `s1`. */
export function questScope(kind: QuestKind, ms: number): string {
  if (kind === 'day') return `d${Math.floor(ms / DAY_MS)}`;
  if (kind === 'week') return `w${Math.floor((ms - REWARDS.weekStartOffsetMs) / REWARDS.weekMs)}`;
  return `s${SEASON.id}`;
}

/** When the current period of a kind ends. */
export function questEndMs(kind: QuestKind, ms: number): number {
  if (kind === 'day') return (Math.floor(ms / DAY_MS) + 1) * DAY_MS;
  if (kind === 'week') return (Math.floor((ms - REWARDS.weekStartOffsetMs) / REWARDS.weekMs) + 1) * REWARDS.weekMs + REWARDS.weekStartOffsetMs;
  return SEASON.endMs;
}

/** Bit of a tier in the `done` mask: 8 bits per line. */
const questBit = (track: number, tier: number) => 1 << (track * 8 + tier);

/** Mask of the tiers these counts complete. */
export function questsDone(kind: QuestKind, c: QuestCounts): number {
  let done = 0;
  QUESTS[kind].tracks.forEach((t, track) => t.targets.forEach((target, tier) => { if (c[t.field] >= target) done |= questBit(track, tier); }));
  return done;
}

/** XP of the tiers in `done` that are not in `before`. */
export function questXp(kind: QuestKind, before: number, done: number): number {
  let xp = 0;
  QUESTS[kind].tracks.forEach((t, track) => t.targets.forEach((_, tier) => {
    const bit = questBit(track, tier);
    if ((done & bit) !== 0 && (before & bit) === 0) xp += QUESTS[kind].xp[tier];
  }));
  return xp;
}

/** The mission tiers in `done` that are not in `before`, for the end-of-match card. */
export function questsNewlyDone(kind: QuestKind, before: number, done: number): { label: string; xp: number }[] {
  const out: { label: string; xp: number }[] = [];
  QUESTS[kind].tracks.forEach((t, track) => t.targets.forEach((target, tier) => {
    const bit = questBit(track, tier);
    if ((done & bit) !== 0 && (before & bit) === 0) out.push({ label: t.label(target), xp: QUESTS[kind].xp[tier] });
  }));
  return out;
}

/** The tier a mission line is on: the first one not done, or the last one when all are done. */
export function questLine(kind: QuestKind, track: number, c: QuestCounts | undefined, done: number): QuestLine {
  const t = QUESTS[kind].tracks[track], tiers = t.targets.length;
  let tier = 0;
  while (tier < tiers && (done & questBit(track, tier)) !== 0) tier++;
  const complete = tier >= tiers, shown = complete ? tiers - 1 : tier, target = t.targets[shown];
  return { label: t.label(target), tier, tiers, value: Math.min(target, c?.[t.field] ?? 0), target, xp: QUESTS[kind].xp[shown], complete };
}
