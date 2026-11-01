// Playtest fixes e2e (offline): dead body removed after ~1 s, death marker until the next round.
// Usage: node scripts/e2e-fixes.mjs [screenshot.jpg]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const shot = process.argv[2];
const BASE = process.env.GAME_BASE || 'http://127.0.0.1:5190/';
let failed = 0;
function check(cond, msg) { if (cond) console.log('ok', msg); else { failed++; console.log('FAIL', msg); } }
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`${BASE}?offline=1&debug=1&freeze=1`);
  await page.waitForFunction(() => window.__game && window.__game.sim.round.phase === 'live', null, { timeout: 90000 });
  const waitFor = (fn, arg, ms = 30000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
  await page.evaluate(() => window.__game.teleport(0, 0, 0.05, -6, 0));
  await page.waitForTimeout(300);
  const me = await page.evaluate(() => { const a = window.__game.sim.local; return { x: a.x, z: a.z }; });
  await page.evaluate(([x, z]) => window.__game.teleport(4, x, 0.05, z - 5, Math.PI), [me.x, me.z]);
  await page.evaluate(() => { window.__game.input.debugFire = true; });
  for (let i = 0; i < 80; i++) {
    const alive = await page.evaluate(() => { window.__game.aimAt(4); return window.__game.sim.actors[4].alive; });
    if (!alive) break;
    await page.waitForTimeout(50);
  }
  await page.evaluate(() => { window.__game.input.debugFire = false; window.__game.input.debugLook = { yaw: 0, pitch: -0.35 }; });
  const t0 = await page.evaluate(() => window.__game.sim.time);
  check(await waitFor(() => window.__game.markers() >= 1, null, 5000), 'a death marker appears');
  check(await waitFor(() => window.__game.bodies() === 0 && !window.__game.sim.actors[4].alive, null, 20000), 'the dead body disappears');
  const t1 = await page.evaluate(() => window.__game.sim.time);
  check(t1 - t0 < 1.6, `body removed after ${(t1 - t0).toFixed(2)} s of game time (about 1 s)`);
  await page.waitForTimeout(300);
  if (shot) await page.screenshot({ path: shot, type: 'jpeg', quality: 72 });
  // Marker stays until the next round.
  const roundNow = await page.evaluate(() => window.__game.sim.round.round);
  check(await waitFor((r) => window.__game.sim.round.round > r, roundNow, 240000), 'next round starts');
  await page.waitForTimeout(500);
  check((await page.evaluate(() => window.__game.markers())) === 0, 'markers are cleared on the next round');
  check(errors.length === 0, `no console errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
  console.log(failed ? `E2E FIXES FAILED (${failed})` : 'E2E FIXES PASS');
  process.exitCode = failed ? 1 : 0;
} catch (e) {
  console.log('ERROR', e.message, JSON.stringify(errors.slice(0, 5)));
  process.exitCode = 1;
} finally {
  await browser.close();
  setTimeout(() => process.exit(), 200);
}
