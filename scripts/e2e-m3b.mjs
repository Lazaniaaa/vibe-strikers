// M3 part 2b e2e: ADS (toggle with the real right mouse button), FOV zoom, sniper scope overlay with the
// viewmodel hidden, ADS cancelled by a weapon switch, other players never see ADS.
// Usage: node scripts/e2e-m3b.mjs [screenshot.jpg]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const shot = process.argv[2];
const BASE = process.env.GAME_BASE || 'http://127.0.0.1:5190/';
let failed = 0;
function check(cond, msg) { if (cond) console.log('ok', msg); else { failed++; console.log('FAIL', msg); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
  const tab = await ctx.newPage();
  tab.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  tab.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await tab.goto(`${BASE}?debug=1&auto=create&bots=0&name=Scope&primary=sniper`);
  await tab.waitForFunction(() => window.__online && window.__online.stats.frames > 20 && window.__online.net.me, null, { timeout: 90000 });
  await tab.waitForFunction(() => window.__online.view().weapon === 'sniper', null, { timeout: 15000 }).catch(() => undefined);
  const view = () => tab.evaluate(() => window.__online.view());
  const v0 = await view();
  check(v0.weapon === 'sniper' && Math.abs(v0.fov - 90) < 0.5 && v0.ads === 0 && v0.viewmodelVisible, `hip: sniper, FOV ${v0.fov.toFixed(1)}, viewmodel visible`);
  const canvas = tab.locator('canvas');
  const box = await canvas.boundingBox();
  const rmb = async () => { await tab.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await tab.mouse.down({ button: 'right' }); await tab.mouse.up({ button: 'right' }); };
  await rmb();
  await tab.waitForFunction(() => window.__online.view().ads >= 1, null, { timeout: 5000 }).catch(() => undefined);
  await sleep(200);
  const v1 = await view();
  check(v1.ads === 1 && v1.fov < 40, `right click toggles ADS on: ads ${v1.ads}, FOV ${v1.fov.toFixed(1)} (zoom from fovForAds)`);
  check(!v1.viewmodelVisible && Number(v1.scope) > 0.99 && v1.crosshairHidden, `sniper scoped: viewmodel hidden, scope overlay ${v1.scope}, crosshair hidden`);
  if (shot) await tab.screenshot({ path: shot, type: 'jpeg', quality: 70 });
  const me = await tab.evaluate(() => { const n = window.__online.net; return n.players.get(n.me.id); });
  check(me && !('ads' in me) && !('scoped' in me), 'player row has no ADS field (others never see ADS)');
  await rmb();
  await tab.waitForFunction(() => window.__online.view().ads === 0, null, { timeout: 5000 }).catch(() => undefined);
  const v2 = await view();
  check(v2.ads === 0 && Math.abs(v2.fov - 90) < 0.5 && v2.viewmodelVisible, 'second right click: ADS off, FOV back to 90');
  await rmb();
  await tab.waitForFunction(() => window.__online.view().ads > 0.5, null, { timeout: 5000 }).catch(() => undefined);
  await tab.keyboard.press('Digit2');
  await tab.waitForFunction(() => window.__online.view().ads === 0 && window.__online.view().weapon === 'pistol', null, { timeout: 5000 }).catch(() => undefined);
  const v3 = await view();
  check(v3.weapon === 'pistol' && v3.ads === 0, 'switching weapon cancels ADS');
  await rmb();
  await tab.waitForFunction(() => window.__online.view().ads >= 1, null, { timeout: 5000 }).catch(() => undefined);
  const v4 = await view();
  check(v4.ads === 1 && v4.fov > 70 && v4.fov < 90 && v4.viewmodelVisible, `pistol ADS: smaller zoom (FOV ${v4.fov.toFixed(1)}), viewmodel stays`);
  check(errors.length === 0, `no console errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
  console.log(failed ? `E2E M3b FAILED (${failed})` : 'E2E M3b PASS');
  process.exitCode = failed ? 1 : 0;
} catch (e) {
  console.log('ERROR', e.message, JSON.stringify(errors.slice(0, 5)));
  process.exitCode = 1;
} finally {
  await browser.close();
  setTimeout(() => process.exit(), 200);
}
