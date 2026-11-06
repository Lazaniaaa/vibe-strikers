// Marketplace rules against a local SpacetimeDB (GAME.md 6.7, 6.8): wallet login (test keys), wallets and starter
// items, listing checks, buying, fees, races between buyers, cancelling, rate limit, leaderboard stats, and the
// economy invariant (sum of coins == minted - burned).
// Usage: node scripts/test-market.mjs   (needs `spacetime start` + `npm run server:publish`)
import { spawnSync } from 'node:child_process';
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
  const charNames = CATALOG.filter((c) => c.kind === 'character').map((c) => c.name);
  check(new Set(charNames.map((n) => n.toLowerCase())).size === charNames.length && charNames.every((n) => /^[A-Z][A-Za-z ]{2,13}$/.test(n)),
    `${charNames.length} characters have unique, short English names`);
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
  // Weekly STRIKE points (GAME.md 6.9) count real matches only.
  check(!p1.market.weekStats.get(p1.market.account), 'week stats: a match that does not pay gives no STRIKE points');
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
    const xp0 = h.market.progress.get(h.market.account)?.xp ?? 0;
    let kills = 0;
    const ended = await waitFor(() => { if (h.me) kills = h.me.kills; return h.room?.phase === 'matchEnd'; }, 330000);
    const seconds = (Date.now() - started) / 1000;
    await sleep(500);
    const won = h.room?.matchWinner !== '' && h.room?.matchWinner === h.me?.team;
    const { DAY_STREAK } = await vite.ssrLoadModule('/src/config/season.ts');
    const dayOne = seconds >= MARKET.reward.minMatchSeconds ? DAY_STREAK.coins[0] : 0;
    const expected = seconds >= MARKET.reward.minMatchSeconds ? matchReward(won, kills, 0, won && h.market.wallet.lastWinDay !== '') + dayOne : 0;
    check(!!ended, `slow: match ended after ${seconds.toFixed(0)} s (${h.players.size} players)`);
    const hs = h.market.stats.get(h.market.account);
    check(!!hs && hs.matches === 1 && hs.kills === kills, `slow: stats ${hs?.matches} match, ${hs?.kills} kills, ${hs?.deaths} deaths`);
    if (seconds >= MARKET.reward.minMatchSeconds) {
      const wk = h.market.weekStats.get(h.market.account);
      check(!!wk && wk.matches === 1 && wk.wins === (won ? 1 : 0) && wk.kills === kills && wk.week === h.market.week,
        `slow: week stats ${wk?.matches} match, ${wk?.wins} wins, ${wk?.kills} kills`);
    }
    check(h.market.wallet.coins - coins0 === expected || (won && h.market.wallet.coins - coins0 === matchReward(won, kills, 0, false) + dayOne),
      `slow: paid ${h.market.wallet.coins - coins0} coins for a ${won ? 'win' : 'loss'} with ${kills} kills (expected ${expected})`);
    if (seconds >= MARKET.reward.minMatchSeconds) {
      const { matchXp } = await vite.ssrLoadModule('/src/gameplay/progression.ts');
      const earned = (h.market.progress.get(h.market.account)?.xp ?? 0) - xp0;
      check(earned >= matchXp(won, kills, 0, false), `slow: ${earned} XP for the match`);
      check(h.market.seasonProgress.get(h.market.account)?.xp === earned, 'slow: the season track got the same XP');
      check(h.market.streaks.get(h.market.account)?.streak === 1, 'slow: day streak 1');
      for (const kind of ['day', 'week', 'season']) {
        const q = h.market.myQuests(kind);
        check(q?.matches === 1 && q?.kills === kills, `slow: ${kind} missions count 1 match, ${kills} kills`);
      }
    }
    await h.leave();
  }

  // Season rewards (GAME.md 6.10). XP normally comes from real matches; here the owner's SQL sets it for the claim checks.
  const { SEASON } = await vite.ssrLoadModule('/src/config/season.ts');
  const { seasonClaim } = await vite.ssrLoadModule('/src/gameplay/progression.ts');
  for (const ref of Object.values(SEASON.items)) check(CATALOG.some((c) => c.ref === ref), `season item ${ref} is in the catalog`);
  const sp = await client();
  const spAddr = sp.market.account;
  check((await reason(guest.claimSeasonRewards())).includes('log in'), 'season: a guest cannot claim');
  await sleep(MARKET.rateLimit.windowMs + 100);
  check((await reason(sp.claimSeasonRewards())).includes('no season rewards'), 'season: nothing to claim without XP');
  const sql = (q) => {
    const r = spawnSync('spacetime', ['sql', '--server', 'local', 'voxel-arena', q], { encoding: 'utf8', shell: true });
    if (r.status !== 0) throw new Error(`spacetime sql failed: ${r.stderr}`);
  };
  const spId = `${SEASON.id}:${spAddr}`;
  sql(`INSERT INTO season_progress (id, season, owner, xp, claimed_level) VALUES ('${spId}', ${SEASON.id}, '${spAddr}', ${SEASON.xpPerLevel * 12 + 5}, 0)`);
  await waitFor(() => sp.market.seasonProgress.get(spAddr));
  const spCoins = sp.market.wallet.coins, spItems = sp.market.items.size, first12 = seasonClaim(0, 12);
  check((await reason(sp.claimSeasonRewards())) === '', 'season: level 12 claims');
  await waitFor(() => sp.market.wallet.coins === spCoins + first12.coins && sp.market.items.size === spItems + first12.items.length);
  check(sp.market.wallet.coins === spCoins + first12.coins, `season: ${first12.coins} coins paid`);
  check(sp.market.items.size === spItems + first12.items.length + 2, `season: ${first12.items.length} items and 2 NFTs given`);
  check(sp.market.seasonProgress.get(spAddr)?.claimedLevel === 12, 'season: claimed level stored');
  check((await reason(sp.claimSeasonRewards())).includes('no season rewards'), 'season: the same rewards cannot be claimed twice');
  sql(`UPDATE season_progress SET xp = ${SEASON.xpPerLevel * 99} WHERE id = '${spId}'`);
  await waitFor(() => (sp.market.seasonProgress.get(spAddr)?.xp ?? 0) > SEASON.xpPerLevel * 50);
  const rest = seasonClaim(12, SEASON.levels), spCoins2 = sp.market.wallet.coins, spItems2 = sp.market.items.size;
  check((await reason(sp.claimSeasonRewards())) === '', 'season: the rest of the track claims');
  await waitFor(() => sp.market.wallet.coins === spCoins2 + rest.coins && sp.market.items.size === spItems2 + rest.items.length);
  check(sp.market.wallet.coins === spCoins2 + rest.coins && sp.market.items.size === spItems2 + rest.items.length + 4, 'season: capped at the last level, totals right (4 more NFTs)');
  check(sp.market.seasonProgress.get(spAddr)?.claimedLevel === SEASON.levels, 'season: all levels claimed');

  // Season NFTs (GAME.md 6.11): in the game first, sold like items, one way to a wallet, marked by the admin only.
  const { nftRef, nftRarity, nftTokenId, nftSeed } = await vite.ssrLoadModule('/src/gameplay/nft.ts');
  const { NFT } = await vite.ssrLoadModule('/src/config/nft.ts');
  const { loadNftQueue, nftAdminSession, markNftsSent } = await vite.ssrLoadModule('/src/network/nftAdmin.ts');
  const { itemRarity } = await vite.ssrLoadModule('/src/gameplay/marketRules.ts');
  await sleep(MARKET.rateLimit.windowMs + 100);
  const nftsOf = (n, addr) => [...n.market.nfts.values()].filter((r) => r.earner === addr);
  const mine = nftsOf(sp, spAddr);
  check(mine.length === 6 && mine.every((r) => r.status === 'game' && r.recipient === '' && r.tokenId === nftTokenId(1, r.level, spAddr).toString() && r.seed === nftSeed(r.ref)), 'nft: 6 rows, in the game, stable ids and seeds');
  check(nftRarity(nftRef(1, 30, spAddr)) === 'mythic' && itemRarity(nftRef(1, 5, spAddr)) === 'common', 'nft: rarity comes from the level');
  const itemOf = (n, level) => [...n.market.items.values()].find((i) => i.ref === nftRef(1, level, spAddr));
  const nft5 = itemOf(sp, 5), nft10 = itemOf(sp, 10), nft15 = itemOf(sp, 15);
  check(!!nft5 && !!nft10 && !!nft15, 'nft: they are items of the holder');

  // Sold in the game, then the buyer asks for it: the recipient is the buyer, the earner stays.
  const nb = await client();
  await waitFor(() => nb.market.nfts.size >= 6);
  check((await reason(sp.listItem(nft10.id, 100))) === '', 'nft: can be listed');
  const nl = await waitFor(() => [...nb.market.listings.values()].find((l) => l.itemId === nft10.id));
  check((await reason(sp.requestNftSend(nft10.id))).includes('cancel the listing'), 'nft: a listed NFT cannot be sent');
  check((await reason(nb.requestNftSend(nft5.id))).includes('do not own'), 'nft: only the holder can send it');
  check((await reason(nb.buyListing(nl.id, 100))) === '', 'nft: can be bought');
  const bought = await waitFor(() => [...nb.market.items.values()].find((i) => i.ref === nft10.ref));
  check(!!bought, 'nft: the buyer holds it');
  check((await reason(nb.requestNftSend(bought.id))) === '', 'nft: the buyer asks to send it');
  const q10 = await waitFor(() => { const r = nb.market.nfts.get(nft10.ref); return r?.status === 'queued' ? r : null; });
  check(q10?.recipient === nb.market.account && q10?.earner === spAddr, 'nft: goes to the buyer, earner unchanged');
  check((await reason(nb.requestNftSend(bought.id))).includes('already'), 'nft: cannot be sent twice');
  check((await reason(nb.listItem(bought.id, 100))).includes('waiting'), 'nft: a queued NFT cannot be listed');
  await sleep(MARKET.rateLimit.windowMs + 100);
  check((await reason(sp.requestNftSend(nft5.id))) === '', 'nft: the earner sends another');
  await waitFor(() => sp.market.nfts.get(nft5.ref)?.status === 'queued');

  // Admin site calls, over plain HTTP as on the site.
  const http = 'http://127.0.0.1:3000', dbName = 'voxel-arena';
  const queue = await loadNftQueue(http, dbName);
  const qa = queue.find((x) => x.ref === nft10.ref);
  check(queue.length >= 2 && qa?.recipient === nb.market.account && qa?.tokenId === nftTokenId(1, 10, spAddr), 'nft: the admin site reads the queue');
  check(qa && qa.skin >> 64n === 1n && ((qa.skin >> 48n) & 0xffffn) === 10n, 'nft: the queue has the skin word');
  const adminKey = newKey();
  const signWith = (key) => async (message) => {
    const { secp256k1 } = await import('@noble/curves/secp256k1.js');
    const { personalHash } = await vite.ssrLoadModule('/src/gameplay/walletAuth.ts');
    const sig = secp256k1.sign(personalHash(message), key, { prehash: false, format: 'recovered' });
    const raw = new Uint8Array(65); raw.set(sig.slice(1), 0); raw[64] = 27 + sig[0];
    return `0x${Buffer.from(raw).toString('hex')}`;
  };
  const { addressOfPublicKey } = await vite.ssrLoadModule('/src/gameplay/walletAuth.ts');
  const { secp256k1 } = await import('@noble/curves/secp256k1.js');
  const adminAddr = addressOfPublicKey(secp256k1.getPublicKey(adminKey, false));
  const session = await nftAdminSession(http, dbName, adminAddr, signWith(adminKey));
  const fakeTx = `0x${'ab'.repeat(32)}`;
  check((await reason(markNftsSent(session, [nft10.ref], fakeTx))).includes('not allowed'), 'nft: a stranger cannot mark as sent');
  check(nb.market.nfts.get(nft10.ref)?.status === 'queued', 'nft: still queued');
  sql(`INSERT INTO nft_admin (address) VALUES ('${adminAddr}')`);
  check((await reason(markNftsSent(session, [nft10.ref], 'nope'))).includes('bad transaction'), 'nft: a bad hash is refused');
  check((await reason(markNftsSent(session, [nft10.ref, 'nft:9:9:0x0', nft15.ref], fakeTx))) === '', 'nft: the admin marks (unknown and not queued refs ignored)');
  const sent = await waitFor(() => { const r = nb.market.nfts.get(nft10.ref); return r?.status === 'sent' ? r : null; });
  check(sent?.tx === fakeTx, 'nft: sent, with its transaction');
  check(nb.market.nfts.get(nft15.ref)?.status === 'game', 'nft: an NFT nobody asked for stays in the game');
  check((await reason(nb.listItem(bought.id, 100))).includes('in a wallet'), 'nft: a sent NFT cannot be listed');
  check(!(await loadNftQueue(http, dbName)).some((x) => x.ref === nft10.ref), 'nft: it left the queue');
  check(NFT.admin === NFT.admin.toLowerCase(), 'nft: the admin address is lowercase, like accounts');
  const spAgain = await waitFor(() => sp.market.seasonProgress.get(spAddr)?.claimedLevel === SEASON.levels);
  check(!!spAgain && (await reason(sp.claimSeasonRewards())).includes('no season rewards'), 'nft: a second claim gives nothing');

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
