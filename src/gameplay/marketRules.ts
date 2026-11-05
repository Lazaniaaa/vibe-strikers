// Marketplace rules without the catalog (GAME.md 6.7): pure, loadable in plain Node (unit tests).
import { MARKET } from '../config/market.ts';

export type MarketKind = 'character' | 'emote';

export interface CatalogItem {
  /** Stable id stored in the tables, e.g. `character:vibe-vibers-viber-142`, `emote:wave`. */
  ref: string;
  kind: MarketKind;
  /** Index in its own list (character index for the renderer / portraits). */
  index: number;
  name: string;
}

/** Burned part of a sale: `feeRate` of the price, rounded down, at least 1 coin. */
export function saleFee(price: number): number { return Math.max(1, Math.floor(price * MARKET.feeRate)); }

/** Error text if `price` is not a valid listing price, else ''. */
export function priceError(price: number): string {
  if (!Number.isInteger(price)) return 'price must be a whole number of coins';
  if (price < MARKET.price.min || price > MARKET.price.max) return `price must be ${MARKET.price.min}-${MARKET.price.max} coins`;
  return '';
}

/** Coins for one finished match: base (win / loss) + kills + headshots, capped; first win of the day on top. */
export function matchReward(won: boolean, kills: number, headshots: number, firstWinOfDay: boolean): number {
  const r = MARKET.reward;
  const base = Math.min(r.matchCap, (won ? r.win : r.loss) + kills * r.kill + headshots * r.headshot);
  return base + (won && firstWinOfDay ? r.firstWinOfDay : 0);
}

/** UTC day key for the first-win bonus, e.g. `2026-11-05`. */
export function utcDay(ms: number): string { return new Date(ms).toISOString().slice(0, 10); }

/** Starter set: distinct random characters and emotes. `random` in [0, 1). */
export function starterRefs(catalog: readonly CatalogItem[], random: () => number): string[] {
  const pick = (kind: MarketKind, count: number) => {
    const pool = catalog.filter((c) => c.kind === kind).map((c) => c.ref);
    const out: string[] = [];
    while (out.length < count && pool.length > 0) out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
    return out;
  };
  return [...pick('character', MARKET.starter.characters), ...pick('emote', MARKET.starter.emotes)];
}

/**
 * Sliding-window rate limiter (per key): `allow` records the action and returns true, or returns false when `actions`
 * were already taken within the last `windowMs`.
 */
export class RateLimiter {
  private readonly times = new Map<string, number[]>();
  private readonly actions: number;
  private readonly windowMs: number;
  constructor(actions: number, windowMs: number) { this.actions = actions; this.windowMs = windowMs; }
  allow(key: string, now: number): boolean {
    const list = (this.times.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length >= this.actions) { this.times.set(key, list); return false; }
    list.push(now);
    this.times.set(key, list);
    return true;
  }
}
