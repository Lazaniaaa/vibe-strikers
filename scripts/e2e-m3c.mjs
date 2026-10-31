// M3 part 2c e2e: killcam (3 s from the killer's view) then spectate living teammates.
// Tab A (team A) + Node teammate Eve (team A) + Node enemy Carl (team B) in a room without bots.
// Usage: node scripts/e2e-m3c.mjs [screenshot.jpg]
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import { loadMods, walkTo, findVisibleSpot } from './netbot.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const shot = process.argv[2];
const BASE = process.env.GAME_BASE || 'http://127.0.0.1:5190/';
let failed = 0;
function check(cond, msg) { if (cond) console.log('ok', msg); else { failed++; console.log('FAIL', msg); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false } });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  const { GameNet } = await vite.ssrLoadModule('/src/network/client.ts');
  const { KILLCAM } = await vite.ssrLoadModule('/src/config/game.ts');
  const mods = await loadMods(vite);
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
  const tab = await ctx.newPage();
  tab.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  tab.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await tab.goto(`${BASE}?debug=1&auto=create&bots=0&name=Alice`);
  await tab.waitForFunction(() => window.__online && window.__online.stats.frames > 20 && window.__online.net.me, null, { timeout: 90000 });
  const code = await tab.evaluate(() => window.__online.net.room.code);
  const carl = new GameNet(), eve = new GameNet();
  await carl.connect(); await eve.connect();
  const pump = setInterval(() => { carl.update(); eve.update(); }, 10);
  await carl.joinByCode(code, 'Carl', 12);
  await eve.joinByCode(code, 'Eve', 2);
  await sleep(800);
  const alice = await tab.evaluate(() => { const n = window.__online.net; return { id: String(n.me.id), x: n.me.x, y: n.me.y, z: n.me.z, team: n.me.team }; });
  check(carl.me.team !== alice.team && eve.me.team === alice.team, `teams: Alice ${alice.team}, Eve ${eve.me.team}, Carl ${carl.me.team}`);
  // Eve walks away from Alice so Carl's spread cannot hit her.
  const far = mods.M.spawnPoints(mods.map, alice.team).reduce((b, s) => (Math.hypot(s.x - alice.x, s.z - alice.z) > Math.hypot(b.x - alice.x, b.z - alice.z) ? s : b));
  await walkTo(mods, eve, far.x, far.z);
  const spot = findVisibleSpot(mods, alice.x, alice.y + 1.62, alice.z, 7, 13, 9);
  await walkTo(mods, carl, spot.x, spot.z);
  await tab.waitForFunction(() => window.__online.net.room?.phase === 'live', null, { timeout: 30000 });
  // Carl shoots Alice (body) until she dies.
  for (let i = 0; i < 12; i++) {
    const a = carl.players.get(BigInt(alice.id));
    if (!a?.alive) break;
    const dx = a.x - carl.me.x, dz = a.z - carl.me.z, dy = a.y + 0.5 - (carl.me.y + 1.62);
    carl.fire(Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)), carl.serverTimeAt(performance.now()));
    await sleep(150);
  }
  await tab.waitForFunction(() => window.__online.view().camMode === 'killcam', null, { timeout: 5000 }).catch(() => undefined);
  const k = await tab.evaluate(() => window.__online.view());
  check(k.camMode === 'killcam' && k.camTarget === String(carl.me.id), `killcam follows the killer (mode ${k.camMode})`);
  await sleep(600);
  const center = await tab.evaluate(() => document.querySelector('.hud-center').textContent);
  check(center === 'Killed by Carl', `banner: "${center}"`);
  if (shot) await tab.screenshot({ path: shot, type: 'jpeg', quality: 70 });
  await sleep(KILLCAM.duration * 1000);
  const sp = await tab.evaluate(() => window.__online.view());
  const sub = await tab.evaluate(() => document.querySelector('.hud-sub').textContent);
  check(sp.camMode === 'spectate' && sp.camTarget === String(eve.me.id), `after ${KILLCAM.duration} s: spectating teammate Eve (${sp.camMode})`);
  check(sub.startsWith('Spectating Eve'), `hint: "${sub}"`);
  const heard = await tab.evaluate(() => window.__online.sounds);
  check((heard.shot_rifle ?? 0) > 0 && (heard.hurt ?? 0) > 0, `heard the enemy's shots (${heard.shot_rifle}) and got hurt (${heard.hurt})`);
  clearInterval(pump);
  carl.disconnect(); eve.disconnect();
  check(errors.length === 0, `no console errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
  console.log(failed ? `E2E M3c FAILED (${failed})` : 'E2E M3c PASS');
  process.exitCode = failed ? 1 : 0;
} catch (e) {
  console.log('ERROR', e.message, JSON.stringify(errors.slice(0, 5)));
  process.exitCode = 1;
} finally {
  await browser.close();
  await vite.close();
  setTimeout(() => process.exit(), 200);
}
