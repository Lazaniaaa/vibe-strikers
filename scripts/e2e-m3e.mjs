// M3 part 2e e2e: procedural sounds fire at the right moments (offline practice; counts per sound).
// Usage: node scripts/e2e-m3e.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.GAME_BASE || 'http://127.0.0.1:5190/';
let failed = 0;
function check(cond, msg) { if (cond) console.log('ok', msg); else { failed++; console.log('FAIL', msg); } }
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`${BASE}?offline=1&debug=1&freeze=1`);
  await page.waitForFunction(() => window.__game && window.__game.sim.round.phase === 'live', null, { timeout: 90000 });
  const sounds = () => page.evaluate(() => ({ ...window.__game.sounds }));
  const waitFor = (fn, arg, ms = 30000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
  await page.evaluate(() => window.__game.teleport(0, 0, 0.05, -6, 0));
  // Run forward: footsteps.
  await page.keyboard.down('KeyW');
  check(await waitFor(() => window.__game.stats.localSteps > 0), 'running makes footsteps');
  await page.keyboard.up('KeyW');
  const steps0 = await page.evaluate(() => window.__game.stats.localSteps);
  // Shift walk is silent.
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyS');
  await page.waitForTimeout(2500);
  await page.keyboard.up('KeyS'); await page.keyboard.up('ShiftLeft');
  const steps1 = await page.evaluate(() => window.__game.stats.localSteps);
  check(steps1 === steps0, `Shift walk is silent (own steps ${steps0} -> ${steps1})`);
  // Shoot an enemy in front: shot + hit/kill sounds.
  const me = await page.evaluate(() => { const a = window.__game.sim.local; return { x: a.x, z: a.z }; });
  await page.evaluate(([x, z]) => window.__game.teleport(4, x, 0.05, z - 6, Math.PI), [me.x, me.z]);
  await page.evaluate(() => { window.__game.input.debugFire = true; });
  for (let i = 0; i < 60; i++) {
    const alive = await page.evaluate(() => { window.__game.aimAt(4); return window.__game.sim.actors[4].alive; });
    if (!alive) break;
    await page.waitForTimeout(60);
  }
  await page.evaluate(() => { window.__game.input.debugFire = false; });
  const s2 = await sounds();
  check((s2.shot_rifle ?? 0) > 0, `rifle shots (${s2.shot_rifle})`);
  check((s2.hit ?? 0) + (s2.headshot ?? 0) > 0 && (s2.kill ?? 0) >= 1, `hit ${s2.hit ?? 0}, headshot ${s2.headshot ?? 0}, kill ${s2.kill ?? 0}`);
  await page.keyboard.press('KeyR');
  check(await waitFor(() => (window.__game.sounds.reload ?? 0) >= 2), 'reload makes two clicks');
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.__game.input.debugFire = true; });
  check(await waitFor(() => (window.__game.sounds.shot_knife ?? 0) > 0, null, 15000), 'knife swing sound');
  await page.evaluate(() => { window.__game.input.debugFire = false; });
  const ctxState = await page.evaluate(() => typeof AudioContext);
  check(ctxState === 'function', 'Web Audio available');
  check(errors.length === 0, `no console errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
  console.log('sounds', JSON.stringify(await sounds()));
  console.log(failed ? `E2E M3e FAILED (${failed})` : 'E2E M3e PASS');
  process.exitCode = failed ? 1 : 0;
} catch (e) {
  console.log('ERROR', e.message, JSON.stringify(errors.slice(0, 5)));
  process.exitCode = 1;
} finally {
  await browser.close();
  setTimeout(() => process.exit(), 200);
}
