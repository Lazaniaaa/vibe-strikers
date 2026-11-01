// Team pings: a browser tab (team A) + Node clients Enemy (B) and Mate (A) in one room, no bots.
// Mate's ping shows in the tab (marker + HUD line + sound), Enemy's does not; rate limit; the tab's own Z ping
// reaches Mate. Needs the local server + `npm run game:dev`. Usage: node scripts/e2e-pings.mjs [shot.jpg]
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.GAME_BASE || 'http://127.0.0.1:5190/';
let failed = 0;
function check(cond, msg) { if (cond) console.log('ok', msg); else { failed++; console.log('FAIL', msg); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false } });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  const { GameNet } = await vite.ssrLoadModule('/src/network/client.ts');
  const tab = await (await browser.newContext({ viewport: { width: 800, height: 450 } })).newPage();
  tab.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  tab.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await tab.goto(`${BASE}?debug=1&auto=create&bots=0&name=Tab`);
  await tab.waitForFunction(() => window.__online && window.__online.stats.frames > 20 && window.__online.net.me, null, { timeout: 90000 });
  const code = await tab.evaluate(() => window.__online.net.room.code);
  const nets = [];
  const join = async (name) => { const n = new GameNet(); await n.connect(); nets.push(n); await n.joinByCode(code, name, 1); return n; };
  const enemy = await join('Enemy'), mate = await join('Mate');
  const pump = setInterval(() => nets.forEach((n) => n.update()), 10);
  await sleep(800);
  const tabTeam = await tab.evaluate(() => window.__online.net.me.team);
  check(mate.me.team === tabTeam && enemy.me.team !== tabTeam, `teams: tab ${tabTeam}, Mate ${mate.me.team}, Enemy ${enemy.me.team}`);
  const got = [];
  mate.onPing = (p) => { if (p.team === mate.me.team) got.push(p); }; // the app shows only its team's pings
  const sounds0 = await tab.evaluate(() => window.__online.sounds.ping ?? 0);
  enemy.ping(enemy.me.x + 2, enemy.me.y, enemy.me.z);
  for (let i = 0; i < 3; i++) mate.ping(mate.me.x + 3, mate.me.y, mate.me.z + i);
  await sleep(1200);
  let s = await tab.evaluate(() => window.__online.snapshot());
  check(s.pings === 1 && s.pingText.includes('Mate') && !s.pingText.includes('Enemy'), `tab shows Mate's ping only (${s.pings}: "${s.pingText}")`);
  check((await tab.evaluate(() => window.__online.sounds.ping ?? 0)) === sounds0 + 1, 'ping sound played once');
  check(got.length === 1, `rate limit: 3 pings at once -> ${got.length} event`);
  mate.ping(mate.me.x + 500, mate.me.y, mate.me.z);
  await sleep(1300);
  check(got.length === 1, 'a ping too far away is rejected');
  // The tab presses Z looking at the ground in front.
  await tab.evaluate(() => { window.__online.local.pitch = -0.6; });
  await tab.keyboard.press('KeyZ');
  await sleep(1000);
  check(got.length === 2 && got[1].playerId === (await tab.evaluate(() => window.__online.net.me.id)), 'Z in the tab: Mate receives the ping');
  s = await tab.evaluate(() => window.__online.snapshot());
  check(s.pings === 2 && s.pingText.includes('You'), `tab shows its own ping too ("${s.pingText.replace(/\n/g, ' | ')}")`);
  if (process.argv[2]) await tab.screenshot({ path: process.argv[2], type: 'jpeg', quality: 70 });
  // 5 s of game time (headless frames are slow and capped, so allow more wall time).
  const gone = await tab.waitForFunction(() => window.__online.snapshot().pings === 0, null, { timeout: 20000 }).then(() => true, () => false);
  check(gone, 'pings vanish after 5 s');
  clearInterval(pump);
  for (const n of nets) n.disconnect();
  check(errors.length === 0, `no console errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
} catch (e) { failed++; console.log('ERROR', e.message, JSON.stringify(errors.slice(0, 3))); }
await browser.close();
await vite.close();
console.log(failed ? `E2E PINGS FAILED (${failed})` : 'E2E PINGS PASS');
process.exit(failed ? 1 : 0);
