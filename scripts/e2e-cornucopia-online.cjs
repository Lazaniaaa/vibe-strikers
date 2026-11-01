// Online Cornucopia smoke test: a browser tab creates a private Cornucopia room (teams, bots) on the local server:
// loot models on pedestals, pistol start, HUD, bots arm themselves from the loot, no console errors.
// Needs `spacetime start` + module + `npm run game:dev`. Usage: node scripts/e2e-cornucopia-online.cjs [shot.jpg]
const { chromium } = require('playwright');
let failed = 0;
function check(cond, msg) { if (cond) console.log('ok', msg); else { failed++; console.log('FAIL', msg); } }
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  try {
    await page.goto('http://127.0.0.1:5190/?debug=1&auto=create&bots=1&mode=cornucopia&teams=1&name=Corn');
    await page.waitForFunction(() => window.__online && window.__online.stats.frames > 20 && window.__online.net.me, null, { timeout: 90000 });
    await page.waitForFunction(() => window.__online.snapshot().itemViews >= 20, null, { timeout: 20000 }).catch(() => undefined);
    let s = await page.evaluate(() => window.__online.snapshot());
    check(s.mode === 'cornucopia' && s.teams === true, `online room: ${s.mode}, teams ${s.teams}`);
    check(s.items.length === 20 && s.itemViews === 20 && s.items.every((i) => i.pedestal), `loot on pedestals drawn (${s.itemViews})`);
    check(s.primary === '' && s.localState.active === 1 && s.localState.pistol[0] === 12 && s.localState.pistol[1] === 0, `pistol start ${s.localState.pistol.join(' / ')}`);
    check(s.center === 'Cornucopia' || s.scoreLine.includes('Cornucopia'), `HUD: "${s.center}" / "${s.scoreLine}"`);
    await page.screenshot({ path: process.argv[2] || 'work/tmp/corn-online.jpg', type: 'jpeg', quality: 70 });
    await page.waitForFunction(() => [...window.__online.net.players.values()].some((p) => p.isBot && p.primary !== ''), null, { timeout: 60000 }).catch(() => undefined);
    const armed = await page.evaluate(() => [...window.__online.net.players.values()].filter((p) => p.isBot && p.primary !== '').map((p) => p.primary));
    check(armed.length >= 1, `server bots take weapons from the pedestals (${armed.join(', ')})`);
    check(errors.length === 0, `no console errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
  } catch (e) { failed++; console.log('ERROR', e.message, JSON.stringify(errors.slice(0, 5))); }
  await browser.close();
  console.log(failed ? `E2E CORNUCOPIA ONLINE FAILED (${failed})` : 'E2E CORNUCOPIA ONLINE PASS');
  process.exit(failed ? 1 : 0);
})();
