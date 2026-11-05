// Marketplace rules against a local SpacetimeDB (GAME.md 6.7): wallets and starter items, listing checks, buying,
// fees, races between buyers, cancelling, rate limit, and the economy invariant (sum of coins == minted - burned).
// Usage: node scripts/test-market.mjs   (needs `spacetime start` + `npm run server:publish`)
import { createServer } from 'vite';

const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
function check(cond, msg) { if (cond) console.log('ok', msg); else { failed++; console.log('FAIL', msg); } }
async function waitFor(fn, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(20); }
  return null;
}
/** The server's refusal text, or '' if the call succeeded. */
const reason = (p) => p.then(() => '', (e) => (e instanceof Error ? e.message : String(e)));

try {
  const { GameNet } = await vite.ssrLoadModule('/src/network/client.ts');
  const { MARKET } = await vite.ssrLoadModule('/src/config/market.ts');
  const { CATALOG, saleFee } = await vite.ssrLoadModule('/src/gameplay/market.ts');
  const nets = [];
  const client = async (all = false) => { const n = new GameNet(); await n.connect(); await n.subscribeMarket(all); nets.push(n); return n; };

  // Auditor sees everything; checks the invariants at the end.
  const audit = await client(true);
  const a = await client(), b = await client(), c = await client();
  await waitFor(() => a.market.wallet && b.market.wallet && c.market.wallet && a.market.items.size && b.market.items.size);
  const starter = MARKET.starter.characters + MARKET.starter.emotes;
  check(a.market.wallet?.coins === MARKET.startCoins && b.market.wallet?.coins === MARKET.startCoins, `new wallets have ${MARKET.startCoins} coins`);
  const refsA = [...a.market.items.values()].map((i) => i.ref);
  check(refsA.length === starter && new Set(refsA).size === starter && refsA.every((r) => CATALOG.some((x) => x.ref === r)),
    `starter set: ${starter} distinct catalog items (${refsA.join(', ')})`);
  check([a, b, c].every((n) => [...n.market.items.values()].every((i) => i.owner.toHexString() === n.identityHex)) &&
    a.market.wallets.size === 1, 'a client only receives its own items and wallet');

  // Listing checks.
  const itemA = [...a.market.items.values()][0], itemB = [...b.market.items.values()][0];
  check((await reason(a.listItem(itemA.id, MARKET.price.min - 1))).includes('price'), 'price below the minimum is refused');
  check((await reason(a.listItem(itemA.id, MARKET.price.max + 1))).includes('price'), 'price above the maximum is refused');
  check((await reason(a.listItem(itemB.id, 100))).includes('do not own'), "listing someone else's item is refused");
  check((await reason(a.listItem(itemA.id, 100))) === '', 'own item listed at 100');
  const lst = await waitFor(() => [...b.market.listings.values()].find((l) => l.itemId === itemA.id));
  check(!!lst && lst.price === 100 && lst.seller.toHexString() === a.identityHex, 'other clients see the listing');
  check((await reason(a.listItem(itemA.id, 120))).includes('already listed'), 'listing the same item twice is refused');

  // Buying.
  check((await reason(a.buyListing(lst.id, 100))).includes('own listing'), 'buying your own listing is refused');
  check((await reason(b.buyListing(lst.id, 99))).includes('price changed'), 'buying at a different price is refused');
  const burned0 = audit.market.economy?.burned ?? 0n;
  check((await reason(b.buyListing(lst.id, 100))) === '', 'b buys the listing');
  await waitFor(() => b.market.items.has(itemA.id) && !a.market.items.has(itemA.id) && audit.market.economy?.burned !== burned0);
  const fee = saleFee(100);
  check(b.market.wallet.coins === MARKET.startCoins - 100 && a.market.wallet.coins === MARKET.startCoins + 100 - fee,
    `coins moved: buyer ${b.market.wallet.coins}, seller ${a.market.wallet.coins} (fee ${fee})`);
  check(b.market.items.get(itemA.id)?.owner.toHexString() === b.identityHex && !b.market.listings.has(lst.id), 'item moved to the buyer, listing gone');
  check(audit.market.economy.burned - burned0 === BigInt(fee), `fee ${fee} burned`);
  const tr = await waitFor(() => [...audit.market.trades.values()].find((t) => t.itemId === itemA.id));
  check(!!tr && tr.price === 100 && tr.fee === fee && tr.buyer.toHexString() === b.identityHex, 'trade logged');
  check((await reason(c.buyListing(lst.id, 100))).includes('gone'), 'a sold listing cannot be bought again');

  // Race: two buyers, one listing, same moment.
  const itemB2 = [...b.market.items.values()].find((i) => i.id !== itemA.id);
  await b.listItem(itemB2.id, 50);
  const race = await waitFor(() => [...a.market.listings.values()].find((l) => l.itemId === itemB2.id));
  const [ra, rc] = await Promise.all([reason(a.buyListing(race.id, 50)), reason(c.buyListing(race.id, 50))]);
  check([ra, rc].filter((r) => r === '').length === 1 && [ra, rc].some((r) => r.includes('gone')), `race: exactly one buyer wins (${JSON.stringify([ra, rc])})`);

  // Not enough coins.
  const itemC = [...c.market.items.values()].find((i) => !c.market.listings.has(i.id));
  await c.listItem(itemC.id, MARKET.price.max);
  const rich = await waitFor(() => [...b.market.listings.values()].find((l) => l.itemId === itemC.id));
  check((await reason(b.buyListing(rich.id, MARKET.price.max))).includes('not enough coins'), 'buying without enough coins is refused');

  // Cancel.
  check((await reason(b.cancelListing(rich.id))).includes('not your listing'), "cancelling someone else's listing is refused");
  check((await reason(c.cancelListing(rich.id))) === '', 'seller cancels the listing');
  await waitFor(() => !b.market.listings.has(rich.id));
  check(!b.market.listings.has(rich.id), 'cancelled listing disappears');

  // Rate limit.
  await sleep(MARKET.rateLimit.windowMs + 100);
  const burst = await Promise.all(Array.from({ length: MARKET.rateLimit.actions + 4 }, () => reason(c.cancelListing(999999n))));
  check(burst.filter((r) => r.includes('too many')).length >= 4, `rate limit: ${burst.filter((r) => r.includes('too many')).length} of ${burst.length} refused`);

  // Economy invariant (auditor sees every wallet).
  await sleep(300);
  const sum = [...audit.market.wallets.values()].reduce((s, w) => s + BigInt(w.coins), 0n);
  const e = audit.market.economy;
  check(e && sum === e.minted - e.burned, `coins conserved: sum ${sum} == minted ${e?.minted} - burned ${e?.burned}`);
  const owners = new Map();
  for (const it of audit.market.items.values()) owners.set(it.id, (owners.get(it.id) ?? 0) + 1);
  check([...audit.market.listings.values()].every((l) => audit.market.items.get(l.itemId)?.owner.toHexString() === l.seller.toHexString()),
    'every listing points at an item its seller owns');

  for (const n of nets) n.disconnect();
} catch (err) {
  failed++;
  console.error(err);
} finally {
  await vite.close();
}
if (failed) { console.log(`MARKET TEST FAILED (${failed})`); process.exit(1); }
console.log('MARKET TEST PASS');
process.exit(0);
