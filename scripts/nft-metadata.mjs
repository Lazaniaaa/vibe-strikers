// Writes the metadata and the picture of every minted NFT into client/public (GAME.md 6.11), to be deployed with the site.
// Run after minting, then commit and deploy. A browser draws each skin with the same code as the lobby.
// Usage: npm run nft:metadata   (needs network: reads the live server's public `nft` table)
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const SERVER = 'https://maincloud.spacetimedb.com', DB = 'vibe-strikers', SIZE = 512;
const root = process.cwd();

const { token } = await (await fetch(`${SERVER}/v1/identity`, { method: 'POST' })).json();
const res = await fetch(`${SERVER}/v1/database/${DB}/sql`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: "SELECT ref, token_id FROM nft WHERE status = 'sent'" });
if (!res.ok) throw new Error(`server answered ${res.status}: ${await res.text()}`);
const [table] = await res.json();
const rows = table.rows.map((r) => ({ ref: String(r[0]), tokenId: String(r[1]) }));
console.log(`${rows.length} minted NFT(s)`);

const vite = await createServer({ configFile: false, root, logLevel: 'error', server: { port: 5199, strictPort: true, hmr: false } });
await vite.listen();
const browser = await chromium.launch({ args: ['--use-angle=d3d11'] });
const page = await browser.newPage();
const origin = 'http://localhost:5199';
await page.route(`${origin}/blank`, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>NFT</title>' }));
await page.goto(`${origin}/blank`);

const draw = (input) => page.evaluate(async ({ ref, tokenId, size }) => {
  const [{ nftTraits }, { renderSkinImage }, { skinMetadata }, { nftName, nftReward, parseNftRef }, { NFT }] = await Promise.all([
    import('/client/game/nftArt.ts'), import('/src/weapons/renderSkinImage.ts'), import('/src/weapons/skinTraits.ts'), import('/src/gameplay/nft.ts'), import('/src/config/nft.ts')]);
  const traits = await nftTraits(ref);
  const parsed = parseNftRef(ref), reward = nftReward(parsed.level), base = skinMetadata(traits, tokenId);
  const attributes = base.attributes.map((a) => (a.trait_type === 'Rarity' ? { trait_type: 'Rarity', value: reward.rarity } : a));
  attributes.push({ trait_type: 'Season level', value: parsed.level });
  return { png: await renderSkinImage(traits, size), meta: { name: `${nftName(ref)} · Season ${parsed.season}`, description: base.description,
    image: `${NFT.siteUrl}/nft-img/${tokenId}.png`, external_url: NFT.siteUrl, attributes } };
}, { ...input, size: SIZE });

mkdirSync(resolve(root, 'client/public/nft'), { recursive: true });
mkdirSync(resolve(root, 'client/public/nft-img'), { recursive: true });
for (const row of rows) {
  let out;
  try { out = await draw(row); } catch { await page.reload(); out = await draw(row); } // the dev server may reload once for new dependencies
  writeFileSync(resolve(root, 'client/public/nft-img', `${row.tokenId}.png`), Buffer.from(out.png.split(',')[1], 'base64'));
  writeFileSync(resolve(root, 'client/public/nft', row.tokenId), `${JSON.stringify(out.meta, null, 2)}\n`);
  console.log(`${out.meta.name} -> ${row.tokenId}`);
}
await browser.close();
await vite.close();
process.exit(0);
