// Marketplace rules against a local SpacetimeDB (GAME.md 6.7, 6.8): wallet login (test keys), wallets and starter
// items, listing checks, buying, fees, races between buyers, cancelling, rate limit, leaderboard stats, and the
// economy invariant (sum of coins == minted - burned).
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
  const { signLogin } = await vite.ssrLoadModule('/src/gameplay/walletAuth.ts');
  const { AUTH } = await vite.ssrLoadModule('/src/config/auth.ts');
  const starter = MARKET.starter.characters + MARKET.starter.emotes;
  const nets = [];
  const newKey = () => crypto.getRandomValues(new Uint8Array(32));
  const login = async (n, key = newKey()) => {
    const t = Date.now(), s = signLogin(key, n.identityHex, t);
    await n.login(s.address, t, s.signature);
    await waitFor(() => n.market.account === s.address && n.market.wallet && n.market.items.size >= starter);
    return s.address;
  };
  const client = async (all = false, logIn = true) => {
    const n = new GameNet(); await n.connect(); await n.subscribeMarket(all); nets.push(n);
    if (logIn) await login(n);
    return n;
  };
  const pump = setInterval(() => nets.forEach((n) => n.update()), 10); // room rows arrive through GameNet.update()

  // Wallet login.
  const guest = await client(false, false);
  check(guest.market.account === '' && guest.market.wallet === null, 'a new connection is a guest (no wallet)');
  const someItem = 1n;
  check((await reason(guest.listItem(someItem, 100))).includes('log in'), 'a guest cannot use the market');
  const key0 = newKey(), now0 = Date.now(), s0 = signLogin(key0, guest.identityHex, now0);
  check((await reason(guest.login(s0.address, now0 + 1, s0.signature))).includes('does not match'), 'a changed message is refused');
  const other = await client(false, false);
  check((await reason(other.login(s0.address, now0, s0.signature))).includes('does not match'), "another session's signature is refused (no replay)");
  const old = Date.now() - AUTH.maxAgeMs - 1000, sOld = signLogin(key0, guest.identityHex, old);
  check((await reason(guest.login(sOld.address, old, sOld.signature))).includes('expired'), 'an old signature is refused');
  check((await reason(guest.login(s0.address, now0, '0x1234'))).includes('bad signature'), 'a malformed signature is refused');
  const addr0 = await login(guest, key0);
  check(guest.market.wallet?.coins === MARKET.startCoins && guest.market.items.size === starter,
    `first login: ${MARKET.startCoins} coins and ${starter} items`);
  await login(other, key0);
  check(other.market.account === addr0 && other.market.items.size === starter && other.market.wallet?.coins === MARKET.startCoins,
    'the same wallet on a second connection is the same account (no second gift)');
  await guest.logout();
  await waitFor(() => guest.market.account === '');
  check(guest.market.account === '' && guest.market.wallet === null && guest.market.items.size === 0, 'logout makes the connection a guest again');
  check(other.market.account === addr0, 'the other connection stays logged in');

  // Auditor sees everything; checks the invariants at the end.
  const audit = await client(true, false);
  const a = await client(), b = await client(), c = await client();
  check(a.market.wallet?.coins === MARKET.startCoins && b.market.wallet?.coins === MARKET.startCoins, `new wallets have ${MARKET.startCoins} coins`);
  const refsA = [...a.market.items.values()].map((i) => i.ref);
  check(refsA.length === starter && new Set(refsA).size === starter && refsA.every((r) => CATALOG.some((x) => x.ref === r)),
    `starter set: ${starter} distinct catalog items (${refsA.join(', ')})`);
  check([a, b, c].every((n) => [...n.market.items.values()].every((i) => i.owner === n.market.account)), 'a client only receives its own items');

  // Listing checks.
  const itemA = [...a.market.items.values()][0], itemB = [...b.market.items.values()][0];
  check((await reason(a.listItem(itemA.id, MARKET.price.min - 1))).includes('price'), 'price below the minimum is refused');
  check((await reason(a.listItem(itemA.id, MARKET.price.max + 1))).includes('price'), 'price above the maximum is refused');
  check((await reason(a.listItem(itemB.id, 100))).includes('do not own'), "listing someone else's item is refused");
  check((await reason(a.listItem(itemA.id, 100))) === '', 'own item listed at 100');
  const lst = await waitFor(() => [...b.market.listings.values()].find((l) => l.itemId === itemA.id));
  check(!!lst && lst.price === 100 && lst.seller === a.market.account, 'other clients see the listing');
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
  check(b.market.items.get(itemA.id)?.owner === b.market.account && !b.market.listings.has(lst.id), 'item moved to the buyer, listing gone');
  check(audit.market.economy.burned - burned0 === BigInt(fee), `fee ${fee} burned`);
  const tr = await waitFor(() => [...audit.market.trades.values()].find((t) => t.itemId === itemA.id));
  check(!!tr && tr.price === 100 && tr.fee === fee && tr.buyer === b.market.account, 'trade logged');
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

  // Match reward farming: a free-for-all match where the only opponent leaves after the freeze ends at once
  // (last player alive). Too short and alone at the end -> no reward (MARKET.reward.minPlayers / minMatchSeconds).
  const p1 = await client(), p2 = await client();
  await waitFor(() => p1.market.wallet && p2.market.wallet);
  await p1.createPrivateRoom('Winner', 1, false, 'normal', 'cornucopia', false, '');
  const ffa = await waitFor(() => p1.me && p1.room);
  await p2.joinByCode(ffa.code, 'Leaver', 2);
  await waitFor(() => p2.me && p1.room?.phase === 'live', 15000);
  check(p1.room?.phase === 'live', 'free-for-all match is live');
  const before1 = p1.market.wallet.coins, before2 = p2.market.wallet.coins, minted0 = audit.market.economy.minted;
  await p2.leave();
  await waitFor(() => p1.room?.phase === 'matchEnd', 4000);
  await sleep(500);
  check(p1.market.wallet.coins === before1, `instant win alone pays nothing (${p1.market.wallet.coins - before1})`);
  await waitFor(() => p1.room?.phase === 'matchEnd', 2000);
  check(p1.room?.phase === 'matchEnd', 'the match ended');
  check(p2.market.wallet.coins === before2, `the player who left gets nothing (${p2.market.wallet.coins - before2})`);
  check(audit.market.economy.minted === minted0 && p1.market.wallet.lastWinDay === '', 'nothing minted, first-win bonus not used up');
  // Leaderboard stats count every online match (owner 2026-11-06), paid or not.
  const st1 = await waitFor(() => { const s = p1.market.stats.get(p1.market.account); return s && s.matches === 1 ? s : null; }, 2000);
  check(!!st1 && st1.wins === 1 && st1.name === 'Winner', `stats: the winner has 1 match, 1 win (${JSON.stringify(st1 && { m: st1.matches, w: st1.wins, n: st1.name })})`);
  check(!p2.market.stats.get(p2.market.account)?.matches, 'stats: the player who left has no match');
  // Weekly stats (STRIKE rewards, GAME.md 6.9) mirror the all-time ones for this week.
  const wk1 = await waitFor(() => { const w = p1.market.weekStats.get(p1.market.account); return w && w.matches === 1 ? w : null; }, 2000);
  check(!!wk1 && wk1.wins === 1 && wk1.week === p1.market.week && wk1.kills === st1?.kills && wk1.headshots === st1?.headshots,
    `week stats: the winner has 1 match, 1 win in week ${p1.market.week}`);
  await p1.leave();

  // --slow: a real match pays. Free-for-all with bots (8 players): the human idles, bots fight until one is left
  // (or the round timer ends); the human gets the loss (or win) reward for that match.
  if (process.argv.includes('--slow')) {
    const { matchReward } = await vite.ssrLoadModule('/src/gameplay/market.ts');
    const h = await client();
    await waitFor(() => h.market.wallet);
    await h.createPrivateRoom('Idler', 4, true, 'easy', 'cornucopia', false, '');
    await waitFor(() => h.me && h.room, 5000);
    const coins0 = h.market.wallet.coins, started = Date.now();
    let kills = 0;
    const ended = await waitFor(() => { if (h.me) kills = h.me.kills; return h.room?.phase === 'matchEnd'; }, 330000);
    const seconds = (Date.now() - started) / 1000;
    await sleep(500);
    const won = h.room?.matchWinner !== '' && h.room?.matchWinner === h.me?.team;
    const expected = seconds >= MARKET.reward.minMatchSeconds ? matchReward(won, kills, 0, won && h.market.wallet.lastWinDay !== '') : 0;
    check(!!ended, `slow: match ended after ${seconds.toFixed(0)} s (${h.players.size} players)`);
    const hs = h.market.stats.get(h.market.account);
    check(!!hs && hs.matches === 1 && hs.kills === kills, `slow: stats ${hs?.matches} match, ${hs?.kills} kills, ${hs?.deaths} deaths`);
    check(h.market.wallet.coins - coins0 === expected || (won && h.market.wallet.coins - coins0 === matchReward(won, kills, 0, false)),
      `slow: paid ${h.market.wallet.coins - coins0} coins for a ${won ? 'win' : 'loss'} with ${kills} kills (expected ${expected})`);
    await h.leave();
  }

  // Economy invariant (auditor sees every wallet).
  await sleep(300);
  const sum = [...audit.market.wallets.values()].reduce((s, w) => s + BigInt(w.coins), 0n);
  const e = audit.market.economy;
  check(e && sum === e.minted - e.burned, `coins conserved: sum ${sum} == minted ${e?.minted} - burned ${e?.burned}`);
  const owners = new Map();
  for (const it of audit.market.items.values()) owners.set(it.id, (owners.get(it.id) ?? 0) + 1);
  check([...audit.market.listings.values()].every((l) => audit.market.items.get(l.itemId)?.owner === l.seller),
    'every listing points at an item its seller owns');

  clearInterval(pump);
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
