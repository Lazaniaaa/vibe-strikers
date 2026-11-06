// Season skin NFT rules (GAME.md 6.11): pure, shared by the server, the lobby and the admin site. No chain calls.
import { MARKET, type RarityId } from '../config/market.ts';
import { NFT, type NftReward } from '../config/nft.ts';
import { textHash } from './textHash.ts';

export type NftStatus = 'game' | 'queued' | 'sent';

/** The NFT earned at a season level, if any. */
export function nftReward(level: number): NftReward | undefined { return NFT.rewards[level]; }

/** Item id of an NFT in `owned_item`: one per earner, season and level, whoever holds it now. */
export function nftRef(season: number, level: number, earner: string): string { return `nft:${season}:${level}:${earner}`; }

export function parseNftRef(ref: string): { season: number; level: number; earner: string } | null {
  const m = /^nft:(\d+):(\d+):(0x[0-9a-f]{40})$/.exec(ref);
  return m ? { season: Number(m[1]), level: Number(m[2]), earner: m[3] } : null;
}

/** Rarity of an NFT item, or null if `ref` is not one. */
export function nftRarity(ref: string): RarityId | null {
  const p = parseNftRef(ref);
  return (p && nftReward(p.level)?.rarity) || null;
}

/** Fixes the look together with the weapon and the rarity: the same wallet and level always give the same skin. */
export function nftSeed(ref: string): number { return textHash(ref); }

/** Stable token id: earner, season and level, so the same NFT can never be minted twice. */
export function nftTokenId(season: number, level: number, earner: string): bigint {
  return (BigInt(earner) << 32n) | (BigInt(season) << 16n) | BigInt(level);
}

/** The word stored on chain: season << 64 | level << 48 | rarity << 40 | weapon << 32 | seed. */
export function nftSkinWord(season: number, level: number, reward: NftReward, seed: number): bigint {
  const rarity = MARKET.rarity.tiers.indexOf(reward.rarity), weapon = NFT.weaponCodes.indexOf(reward.weapon);
  if (rarity < 0 || weapon < 0) throw new Error(`unknown NFT reward: ${reward.rarity} ${reward.weapon}`);
  return (BigInt(season) << 64n) | (BigInt(level) << 48n) | (BigInt(rarity) << 40n) | (BigInt(weapon) << 32n) | BigInt(seed >>> 0);
}

/** "Mythic Rifle skin". */
export function nftRewardName(r: NftReward): string {
  const cap = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`;
  return `${cap(r.rarity)} ${cap(r.weapon)} skin`;
}

export function nftName(ref: string): string {
  const p = parseNftRef(ref), r = p && nftReward(p.level);
  return r ? nftRewardName(r) : ref;
}

/** Why an NFT cannot go on the market, or ''. */
export function nftListError(status: string | undefined): string {
  if (status === 'queued') return 'this NFT is waiting to be sent to a wallet';
  if (status === 'sent') return 'this NFT is in a wallet';
  return '';
}
