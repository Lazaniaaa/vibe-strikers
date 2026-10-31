// M2b lag-compensation test: a browser tab with artificial latency shoots a strafing Node client.
// The tab aims at the target's RENDERED (interpolated) position, like a human. The server rewinds hit
// boxes to the tab's view time; each shot event also says whether the ray would hit WITHOUT rewind.
// Needs: local SpacetimeDB + module, `npm run game:dev` (or GAME_BASE for the preview), Playwright.
// Usage: node scripts/e2e-m2b.mjs [lagMs] [screenshot.jpg]
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import { loadMods, walkTo, findVisibleSpot, strafe } from './netbot.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const lag = Number(process.argv[2] || 200);
const shot = process.argv[3];
const BASE = process.env.GAME_BASE || 'http://127.0.0.1:5190/';
let failed = 0;
function check(cond, msg) { if (cond) console.log('ok', msg); else { failed++; console.log('FAIL', msg); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false } });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
let stopStrafe = false;
try {
  const { GameNet } = await vite.ssrLoadModule('/src/network/client.ts');
  const mods = await loadMods(vite);
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
  const tab = await ctx.newPage();
  tab.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  tab.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await tab.goto(`${BASE}?debug=1&lag=${lag}&auto=create&bots=0&name=Shooter`);
  await tab.waitForFunction(() => window.__online && window.__online.stats.frames > 20 && window.__online.net.me, null, { timeout: 90000 });
  const snap = () => tab.evaluate(() => window.__online.snapshot());
  const s0 = await snap();
  console.log(`room ${s0.room}, artificial lag ${lag} ms`);

  // Target: a Node client (no artificial lag) walks to a visible spot and strafes at 4.5 m/s.
  const target = new GameNet();
  await target.connect();
  const pump = setInterval(() => target.update(), 10);
  await target.joinByCode(s0.room, 'Target', 20);
  await sleep(500);
  const shooterPos = s0.local;
  const spot = findVisibleSpot(mods, shooterPos.x, shooterPos.y + 1.62, shooterPos.z, 7, 12, 9);
  check(!!spot, `strafe spot ${spot?.d.toFixed(1)} m from the shooter`);
  await walkTo(mods, target, spot.x, spot.z);
  await tab.waitForFunction(() => window.__online.net.room?.phase === 'live', null, { timeout: 30000 });
  const strafing = strafe(target, spot, () => stopStrafe);
  await sleep(600);
  const targetId = String(target.me.id);

  // Shooter: pistol, aim every frame at the rendered target, one tap every 400 ms (bloom recovers).
  await tab.keyboard.press('Digit2');
  await sleep(700);
  await tab.evaluate((id) => window.__online.setAutoAim(id), targetId);
  for (let i = 0; i < 12 && target.me?.alive; i++) {
    await tab.evaluate(() => window.__online.setFire(true));
    await sleep(120);
    await tab.evaluate(() => window.__online.setFire(false));
    await sleep(280);
    if (i === 2 && shot) await tab.screenshot({ path: shot, type: 'jpeg', quality: 70 });
  }
  await sleep(lag + 500);
  stopStrafe = true;
  await tab.evaluate(() => { window.__online.setAutoAim(null); window.__online.setFire(false); });
  console.log('server rewind per shot (ms):', JSON.stringify(await tab.evaluate(() => window.__online.rewinds)));
  await strafing;
  const st = (await snap()).stats;
  const rate = st.shots ? st.hits / st.shots : 0;
  console.log(`shots ${st.shots}, server shots ${st.serverShots}, hits ${st.hits}, hits that would also hit without rewind ${st.hitsWithoutRewind}`);
  check(st.shots >= 4 && st.serverShots === st.shots, `every predicted shot was accepted by the server (${st.serverShots}/${st.shots})`);
  // Needed rewind = round trip + interpolation delay; private rooms cap it at NET.maxRewindMsPrivate.
  const { NET } = await vite.ssrLoadModule('/src/config/net.ts');
  const needed = lag + NET.interpolationDelayMs, cap = NET.maxRewindMsPrivate;
  const rewinds = await tab.evaluate(() => window.__online.rewinds);
  if (needed < cap - 20) check(rate >= 0.6, `lag-compensated hit rate on a strafing target: ${(rate * 100).toFixed(0)}%`);
  else {
    check(rewinds.every((r) => r <= cap), `needed rewind ~${needed} ms is at/over the ${cap} ms cap: rewind clamped (hit rate ${(rate * 100).toFixed(0)}%, info only)`);
  }
  check(lag < 100 || st.hitsWithoutRewind < st.hits, `rewind mattered: without it ${st.hitsWithoutRewind} of ${st.hits} hits would land`);
  clearInterval(pump);
  target.disconnect();
  check(errors.length === 0, `no console errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
  console.log(failed ? `E2E M2b FAILED (${failed})` : `E2E M2b PASS (lag ${lag} ms)`);
  process.exitCode = failed ? 1 : 0;
} catch (e) {
  console.log('ERROR', e.message, JSON.stringify(errors.slice(0, 5)));
  process.exitCode = 1;
} finally {
  stopStrafe = true;
  await browser.close();
  await vite.close();
  setTimeout(() => process.exit(), 200);
}
