// Season skin NFTs (owner 2026-11-06, GAME.md 6.11). Testnet only: Robinhood Chain testnet. Earned on the season track,
// kept in the game until the player asks to send one to their wallet; the owner then mints it from the admin site.
import type { RarityId } from './market.ts';

export interface NftReward { weapon: string; rarity: RarityId }

export const NFT = {
  /** SeasonSkins contract (contracts/SeasonSkins.sol), deployed by the owner 2026-11-07. Empty = sending stays closed. */
  contract: '0x23e30403814d584a3a2b462b6cf3622d246cd589',
  /** The owner's wallet: the only account that may mark NFTs as sent. Local tests add theirs to the `nft_admin` table. */
  admin: '0x08e4f62ed093124aa3ce257830c81b2bc14a51e9',
  /** Tokens per mintBatch transaction. */
  batchSize: 50,
  /** Season level => reward. Fixed and visible in advance: no random boxes. */
  rewards: {
    5: { weapon: 'pistol', rarity: 'common' },
    10: { weapon: 'shotgun', rarity: 'common' },
    15: { weapon: 'rifle', rarity: 'rare' },
    20: { weapon: 'sniper', rarity: 'epic' },
    25: { weapon: 'knife', rarity: 'legendary' },
    30: { weapon: 'rifle', rarity: 'mythic' },
  } as Readonly<Record<number, NftReward>>,
  /** Tier of Codex's skin generator that draws a game tier (owner 2026-11-06: no uncommon tier, common uses its art). */
  skinArt: { common: 'uncommon', rare: 'rare', epic: 'epic', legendary: 'legendary', mythic: 'mythic' } as Readonly<Record<RarityId, string>>,
  /** Number of each weapon in the on-chain word. Add at the end only: minted tokens keep their numbers. */
  weaponCodes: ['knife', 'pistol', 'rifle', 'sniper', 'shotgun'] as readonly string[],
} as const;
