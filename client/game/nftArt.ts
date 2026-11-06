// Pictures of season skin NFTs for the lobby (GAME.md 6.11), drawn once by Codex's generator from the wallet, level and rarity.
// The generator and three.js load on the first request. If drawing fails the panels keep their ◆ icon.
import { NFT } from '../../src/config/nft';
import { nftReward, nftSeed, parseNftRef } from '../../src/gameplay/nft';
import type { SkinRarity, SkinTraits } from '../../src/weapons/skinTraits';
import type { WeaponId } from '../../src/weapons/types';

const ART_SIZE = 128;

/** The generator's input for an NFT: the same in the lobby, on the character and in the metadata. */
export async function nftTraits(ref: string): Promise<SkinTraits | null> {
  const parsed = parseNftRef(ref), reward = parsed && nftReward(parsed.level);
  if (!reward) return null;
  const { generateSkinTraits } = await import('../../src/weapons/skinTraits');
  return generateSkinTraits({ weapon: reward.weapon as WeaponId, rarity: NFT.skinArt[reward.rarity] as SkinRarity, seed: nftSeed(ref) });
}
const art = new Map<string, string>();
const asked = new Set<string>();

/** The picture of an NFT, or undefined while it is being drawn; `ready` runs when it is done. */
export function nftArt(ref: string, ready: () => void): string | undefined {
  const url = art.get(ref);
  if (url || asked.has(ref)) return url;
  asked.add(ref);
  void (async () => {
    try {
      const [traits, { renderSkinImage }] = await Promise.all([nftTraits(ref), import('../../src/weapons/renderSkinImage')]);
      if (!traits) return;
      art.set(ref, await renderSkinImage(traits, ART_SIZE));
      ready();
    } catch (e) {
      console.warn('NFT picture failed', e);
    }
  })();
  return undefined;
}
