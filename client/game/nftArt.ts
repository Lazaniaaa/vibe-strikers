// Pictures of season skin NFTs for the lobby (GAME.md 6.11), drawn once by Codex's generator from the wallet, level and rarity.
// The generator and three.js load on the first request. If drawing fails the panels keep their ◆ icon.
import { NFT } from '../../src/config/nft';
import { nftReward, nftSeed, parseNftRef } from '../../src/gameplay/nft';
import type { SkinRarity } from '../../src/weapons/skinTraits';
import type { WeaponId } from '../../src/weapons/types';

const ART_SIZE = 128;
const art = new Map<string, string>();
const asked = new Set<string>();

/** The picture of an NFT, or undefined while it is being drawn; `ready` runs when it is done. */
export function nftArt(ref: string, ready: () => void): string | undefined {
  const url = art.get(ref);
  if (url || asked.has(ref)) return url;
  const parsed = parseNftRef(ref), reward = parsed && nftReward(parsed.level);
  if (!reward) return undefined;
  asked.add(ref);
  void (async () => {
    try {
      const [{ generateSkinTraits }, { renderSkinImage }] = await Promise.all([import('../../src/weapons/skinTraits'), import('../../src/weapons/renderSkinImage')]);
      const traits = generateSkinTraits({ weapon: reward.weapon as WeaponId, rarity: NFT.skinArt[reward.rarity] as SkinRarity, seed: nftSeed(ref) });
      art.set(ref, await renderSkinImage(traits, ART_SIZE));
      ready();
    } catch (e) {
      console.warn('NFT picture failed', e);
    }
  })();
  return undefined;
}
