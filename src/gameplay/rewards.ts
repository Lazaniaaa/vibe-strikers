// Weekly reward math (GAME.md 6.9), shared by the server module (week of a stat), the LEADERS tab (estimate) and the
// admin page (payout list). Pure, no chain calls. Token amounts are bigint base units (18 decimals).
import { REWARDS } from '../config/rewards.ts';

export interface WeekCounts { matches: number; wins: number; kills: number; headshots: number }
export interface WeekRow extends WeekCounts { owner: string }
export interface Payout { owner: string; points: number; amount: bigint }

/** Week number of a time (weeks start Monday 00:00 UTC). */
export function weekOf(ms: number): number {
  return Math.floor((ms - REWARDS.weekStartOffsetMs) / REWARDS.weekMs);
}
/** Start of a week (ms since the Unix epoch). */
export function weekStartMs(week: number): number {
  return week * REWARDS.weekMs + REWARDS.weekStartOffsetMs;
}
/** "2026-11-02 – 2026-11-08" (UTC dates of the Monday and the Sunday). */
export function weekLabel(week: number): string {
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const start = weekStartMs(week);
  return `${day(start)} – ${day(start + REWARDS.weekMs - 1)}`;
}

export function weekPoints(c: WeekCounts): number {
  const p = REWARDS.points;
  return c.wins * p.win + c.matches * p.match + c.kills * p.kill + c.headshots * p.headshot;
}

/** Whole tokens to base units. */
export function toUnits(tokens: number | bigint): bigint {
  return BigInt(tokens) * 10n ** BigInt(REWARDS.token.decimals);
}
/** Base units to a short token string ("1 234 567.5"). */
export function formatTokens(units: bigint): string {
  const one = 10n ** BigInt(REWARDS.token.decimals);
  const whole = units / one, frac = (units % one) * 10n / one;
  const w = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return frac ? `${w}.${frac}` : w;
}

/**
 * Who gets what from a week's pool: share by points among wallets with at least `minPoints`, each capped at
 * `maxShareBps` of the pool (the capped rest stays in the contract). Sorted by amount, then address.
 */
export function payoutPlan(rows: readonly WeekRow[], pool: bigint): Payout[] {
  const eligible = rows.map((r) => ({ owner: r.owner, points: weekPoints(r) }))
    .filter((r) => r.points >= REWARDS.minPoints && r.points > 0);
  const total = eligible.reduce((s, r) => s + BigInt(r.points), 0n);
  if (total === 0n || pool <= 0n) return [];
  const cap = pool * BigInt(REWARDS.maxShareBps) / 10_000n;
  const out = eligible.map((r) => {
    const share = pool * BigInt(r.points) / total;
    return { owner: r.owner, points: r.points, amount: share < cap ? share : cap };
  }).filter((p) => p.amount > 0n);
  return out.sort((a, b) => (a.amount === b.amount ? a.owner.localeCompare(b.owner) : a.amount > b.amount ? -1 : 1));
}
