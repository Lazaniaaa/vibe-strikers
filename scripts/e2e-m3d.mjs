// M3 part 2d e2e: settings panel (menu), saved in the browser, applied in game (FOV, crosshair, ADS hold).
// Usage: node scripts/e2e-m3d.mjs [screenshot.jpg]
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
  const ctx = await browser.newContext({ viewport: { width: 640, height: 480 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`${BASE}?debug=1`);
  await page.click('.menu-settings');
  check(await page.isVisible('.settings-card'), 'Settings button opens the panel');
  const set = (key, value) => page.evaluate(([k, v]) => {
    const el = document.querySelector(`.settings [data-key="${k}"]`); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true }));
  }, [key, String(value)]);
  await set('fov', 100); await set('crosshairSize', 14); await set('crosshairColor', '#ff0000');
  await set('volume', 0.3); await set('sensitivity', 3); await set('adsMode', 'hold');
  if (shot) await page.screenshot({ path: shot, type: 'jpeg', quality: 70 });
  await page.click('.settings-close');
  check(!(await page.isVisible('.settings-card')), 'Close hides the panel');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('voxel-settings')));
  check(saved.fov === 100 && saved.crosshairSize === 14 && saved.crosshairColor === '#ff0000' && saved.volume === 0.3 &&
    Math.abs(saved.sensitivity - 0.003) < 1e-9 && saved.adsMode === 'hold', `saved: ${JSON.stringify(saved)}`);

  // Same browser profile: reload into a game.
  await page.goto(`${BASE}?debug=1&auto=create&bots=0&name=Set`);
  await page.waitForFunction(() => window.__online && window.__online.stats.frames > 20 && window.__online.net.me, null, { timeout: 90000 });
  await sleep(300);
  const v = await page.evaluate(() => window.__online.view());
  check(Math.abs(v.fov - 100) < 0.5, `in game: FOV ${v.fov.toFixed(1)}`);
  const ch = await page.evaluate(() => { const c = document.querySelector('.hud-crosshair'); return [c.style.getPropertyValue('--ch-color'), c.style.getPropertyValue('--ch-size')]; });
  check(ch[0] === '#ff0000' && ch[1] === '14px', `crosshair style ${ch.join(' ')}`);
  // ADS hold mode: aims only while the right button is held.
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ button: 'right' });
  await page.waitForFunction(() => window.__online.view().ads >= 1, null, { timeout: 5000 }).catch(() => undefined);
  const held = (await page.evaluate(() => window.__online.view())).ads;
  await page.mouse.up({ button: 'right' });
  await page.waitForFunction(() => window.__online.view().ads === 0, null, { timeout: 5000 }).catch(() => undefined);
  const released = (await page.evaluate(() => window.__online.view())).ads;
  check(held === 1 && released === 0, `ADS hold mode: held ${held}, released ${released}`);
  check(errors.length === 0, `no console errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
  console.log(failed ? `E2E M3d FAILED (${failed})` : 'E2E M3d PASS');
  process.exitCode = failed ? 1 : 0;
} catch (e) {
  console.log('ERROR', e.message, JSON.stringify(errors.slice(0, 5)));
  process.exitCode = 1;
} finally {
  await browser.close();
  setTimeout(() => process.exit(), 200);
}
