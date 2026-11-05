// Marketplace simulation (GAME.md 6.7, 6.8): many bot traders (each logged in with its own test wallet key; every
// fifth one also trades from a second connection with the same key, like a second device) at once against a local SpacetimeDB, with honest and
// adversarial actions (selling someone else's item, buying your own, stale prices, several bots buying the same
// listing at the same moment, bursts over the rate limit, disconnecting mid-trade and reconnecting with the same
// token). An auditor connection sees every row and checks the invariants every `--check` ms and at the end.
// Usage: node scripts/sim-market.mjs [--bots 30] [--seconds 60] [--check 2000] [--seed 1] [--out file.json]
// Needs `spacetime start` + `npm run server:publish`. Exit code 1 if an invariant broke or a reducer failed unexpectedly.
import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';

const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : def; };
const BOTS = Number(arg('bots', 30)), SECONDS = Number(arg('seconds', 60)), CHECK_MS = Number(arg('check', 2000));
const OUT = arg('out', '');
let seed = Number(arg('seed', 1)) >>> 0;
const rand = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (list) => list[Math.floor(rand() * list.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false } });
const { GameNet } = await vite.ssrLoadModule('/src/network/client.ts');
const { MARKET } = await vite.ssrLoadModule('/src/config/market.ts');
const { saleFee, CATALOG } = await vite.ssrLoadModule('/src/gameplay/market.ts');
const { signLogin } = await vite.ssrLoadModule('/src/gameplay/walletAuth.ts');

/** Server refusals the rules expect; anything else is a bug. */
const EXPECTED = ['price must', 'do not own', 'already listed', 'at most', 'listing is gone', 'not your listing', 'own listing',
  'price changed', 'not enough coins', 'too many market actions', 'not connected', 'connection lost', 'log in with a wallet'];
/** A call that gets no answer within this time counts as "no answer" (expected only when its connection was dropped). */
const CALL_TIMEOUT_MS = 6000;
const stats = { actions: {}, refusals: {}, unexpected: [], violations: [], checks: 0, trades: 0, feesSeen: 0, reconnects: 0 };
const count = (bucket, key) => { bucket[key] = (bucket[key] ?? 0) + 1; };

async function attempt(kind, promise) {
  count(stats.actions, kind);
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('no answer')), CALL_TIMEOUT_MS); });
  try { await Promise.race([promise, timeout]); count(stats.refusals, `${kind}: ok`); return true; } catch (e) {
    if (e instanceof Error && e.message === 'no answer' && kind === 'buy-then-drop') { count(stats.refusals, `${kind}: no answer`); return false; }
    const msg = e instanceof Error ? e.message : String(e);
    const known = EXPECTED.find((x) => msg.includes(x));
    if (known) count(stats.refusals, `${kind}: ${known}`);
    else stats.unexpected.push(`${kind}: ${msg}`);
    return false;
  } finally { clearTimeout(timer); }
}

/** Connect; with a key, log in (a reconnect with the same token keeps its login session). */
async function connect(token, key) {
  const n = new GameNet({ token, onToken: (t) => { n.token = t; } });
  await n.connect();
  await n.subscribeMarket(false);
  if (key) {
    const t = Date.now(), s = signLogin(key, n.identityHex, t);
    await n.login(s.address, t, s.signature);
  }
  const end = Date.now() + 5000;
  while (Date.now() < end && !(n.market.account && n.market.wallet && n.market.items.size)) await sleep(20);
  return n;
}

const audit = new GameNet();
await audit.connect();
await audit.subscribeMarket(true);
const startEconomy = audit.market.economy ? { ...audit.market.economy } : { minted: 0n, burned: 0n };
const feesDuring = { sum: 0n };
const tradesDuring = new Map();
audit.onMarketChange = () => {};
const origTradeInsert = audit.conn.db.trade;
origTradeInsert.onInsert((_ctx, row) => {
  stats.trades++; feesDuring.sum += BigInt(row.fee); tradesDuring.set(row.id, row);
  if (row.fee !== saleFee(row.price)) stats.violations.push(`trade ${row.id}: fee ${row.fee} != saleFee(${row.price})`);
});

console.log(`connecting ${BOTS} traders...`);
const bots = [];
for (let i = 0; i < BOTS; i++) {
  const key = crypto.getRandomValues(new Uint8Array(32));
  bots.push(await connect(undefined, key));
  if (i % 5 === 4) bots.push(await connect(undefined, key)); // second device of the same account
  if (i % 10 === 9) await sleep(50);
}
await sleep(800);

const hex = (account) => account; // accounts are address strings
function check(label) {
  stats.checks++;
  const m = audit.market, e = m.economy;
  const sum = [...m.wallets.values()].reduce((s, w) => s + BigInt(w.coins), 0n);
  if (!e || sum !== e.minted - e.burned) stats.violations.push(`${label}: coins ${sum} != minted ${e?.minted} - burned ${e?.burned}`);
  for (const w of m.wallets.values()) if (!Number.isInteger(w.coins) || w.coins < 0) stats.violations.push(`${label}: bad balance ${w.coins}`);
  const perWallet = MARKET.starter.characters + MARKET.starter.emotes;
  if (m.items.size !== m.wallets.size * perWallet) stats.violations.push(`${label}: ${m.items.size} items for ${m.wallets.size} wallets (expected x${perWallet})`);
  for (const it of m.items.values()) {
    if (!CATALOG.some((c) => c.ref === it.ref)) stats.violations.push(`${label}: item ${it.id} has unknown ref ${it.ref}`);
    if (!m.wallets.has(hex(it.owner))) stats.violations.push(`${label}: item ${it.id} owner has no wallet`);
  }
  const listedItems = new Set();
  for (const l of m.listings.values()) {
    const it = m.items.get(l.itemId);
    if (!it || hex(it.owner) !== hex(l.seller)) stats.violations.push(`${label}: listing ${l.id} for item ${l.itemId} not owned by its seller`);
    if (it && it.ref !== l.ref) stats.violations.push(`${label}: listing ${l.id} ref ${l.ref} != item ref ${it.ref}`);
    if (listedItems.has(l.itemId)) stats.violations.push(`${label}: item ${l.itemId} listed twice`);
    listedItems.add(l.itemId);
    if (l.price < MARKET.price.min || l.price > MARKET.price.max) stats.violations.push(`${label}: listing ${l.id} price ${l.price}`);
  }
  if (e && e.burned - startEconomy.burned !== feesDuring.sum) stats.violations.push(`${label}: burned +${e.burned - startEconomy.burned} != fees seen ${feesDuring.sum}`);
}

/** One trader's behaviour loop. */
async function trader(bot, index, until) {
  while (Date.now() < until) {
    await sleep(250 + rand() * 450);
    const m = bot.market, me = bot.market.account;
    const mine = [...m.items.values()].filter((i) => hex(i.owner) === me);
    const myListed = new Set([...m.listings.values()].filter((l) => hex(l.seller) === me).map((l) => l.itemId));
    const others = [...m.listings.values()].filter((l) => hex(l.seller) !== me);
    const r = rand();
    if (r < 0.30 && mine.some((i) => !myListed.has(i.id))) {
      const it = pick(mine.filter((i) => !myListed.has(i.id)));
      await attempt('list', bot.listItem(it.id, Math.round(MARKET.price.min + rand() * rand() * 400)));
    } else if (r < 0.62 && others.length) {
      const l = pick(others);
      await attempt('buy', bot.buyListing(l.id, l.price));
    } else if (r < 0.70 && myListed.size) {
      const l = pick([...m.listings.values()].filter((x) => hex(x.seller) === me));
      await attempt('cancel', bot.cancelListing(l.id));
    } else if (r < 0.74 && others.length) {
      // Several bots buy the same listing at once.
      const l = pick(others), buyers = bots.filter((b) => b.connected && b.market.account !== l.seller).sort(() => rand() - 0.5).slice(0, 3);
      const results = await Promise.all(buyers.map((b) => attempt('race-buy', b.buyListing(l.id, l.price))));
      if (results.filter(Boolean).length > 1) stats.violations.push(`race: listing ${l.id} sold ${results.filter(Boolean).length} times`);
    } else if (r < 0.78) {
      // Adversarial: someone else's item, my own listing, stale price, invalid prices.
      const any = [...audit.market.items.values()].find((i) => hex(i.owner) !== me);
      if (any) await attempt('cheat-list-foreign', bot.listItem(any.id, 100));
      const own = [...m.listings.values()].find((l) => hex(l.seller) === me);
      if (own) await attempt('cheat-buy-own', bot.buyListing(own.id, own.price));
      if (others.length) { const l = pick(others); await attempt('cheat-stale-price', bot.buyListing(l.id, Math.max(0, l.price - 1))); }
      if (mine.length) await attempt('cheat-bad-price', bot.listItem(mine[0].id, pick([0, MARKET.price.min - 1, MARKET.price.max + 1])));
      const foreign = others[0];
      if (foreign) await attempt('cheat-cancel-foreign', bot.cancelListing(foreign.id));
    } else if (r < 0.80) {
      // Burst over the rate limit.
      await Promise.all(Array.from({ length: MARKET.rateLimit.actions + 3 }, () => attempt('burst', bot.cancelListing(987654321n))));
      await sleep(MARKET.rateLimit.windowMs);
    } else if (r < 0.82 && others.length) {
      // Buy and drop the connection at once, then come back with the same token.
      const l = pick(others), token = bot.token;
      void attempt('buy-then-drop', bot.buyListing(l.id, l.price));
      bot.disconnect();
      await sleep(300 + rand() * 500);
      const id = bot.identityHex, again = await connect(token);
      if (again.identityHex !== id) stats.violations.push(`reconnect gave a new identity (${id.slice(0, 8)} -> ${again.identityHex.slice(0, 8)})`);
      if (again.market.account !== me) stats.violations.push(`reconnect lost the login (${me} -> ${again.market.account || 'guest'})`);
      bots[index] = again; bot = again; stats.reconnects++;
    }
  }
}

const until = Date.now() + SECONDS * 1000;
const timer = setInterval(() => check(`t+${Math.round((Date.now() - (until - SECONDS * 1000)) / 1000)}s`), CHECK_MS);
await Promise.all(bots.map((b, i) => trader(b, i, until)));
clearInterval(timer);
await sleep(1500); // let every subscription settle
check('final');

// Each trader's own view must match the auditor's (wallet and items).
let mismatched = 0;
for (const b of bots) {
  const me = b.market.account, w = audit.market.wallets.get(me);
  const ownA = [...audit.market.items.values()].filter((i) => i.owner === me).map((i) => i.id).sort();
  const ownB = [...b.market.items.values()].filter((i) => i.owner === me).map((i) => i.id).sort();
  if (!w || b.market.wallet?.coins !== w.coins || ownA.join() !== ownB.join()) mismatched++;
}
if (mismatched) stats.violations.push(`final: ${mismatched} trader views differ from the auditor`);

const summary = {
  bots: BOTS, connections: bots.length, seconds: SECONDS, seed: Number(arg('seed', 1)), trades: stats.trades, reconnects: stats.reconnects, checks: stats.checks,
  listingsOpenAtEnd: audit.market.listings.size, wallets: audit.market.wallets.size, items: audit.market.items.size,
  economy: { minted: String(audit.market.economy?.minted), burned: String(audit.market.economy?.burned) },
  actions: stats.actions, outcomes: stats.refusals,
  unexpected: stats.unexpected.slice(0, 30), unexpectedCount: stats.unexpected.length,
  violations: stats.violations.slice(0, 30), violationCount: stats.violations.length,
};
console.log(JSON.stringify(summary, null, 1));
if (OUT) writeFileSync(OUT, JSON.stringify(summary, null, 2) + '\n');
for (const b of bots) b.disconnect();
audit.disconnect();
await vite.close();
const bad = stats.violations.length + stats.unexpected.length;
console.log(bad ? `MARKET SIM FAILED (${stats.violations.length} violations, ${stats.unexpected.length} unexpected errors)` : 'MARKET SIM PASS');
process.exit(bad ? 1 : 0);
