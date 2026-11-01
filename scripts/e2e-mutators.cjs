// Mutators offline in the browser: HUD shows the mutator, big heads are drawn, low gravity jumps higher.
// Needs `npm run game:dev`. Usage: node scripts/e2e-mutators.cjs [bigHeads.jpg]
const { chromium } = require('playwright');
let failed = 0;
function check(cond, msg) { if (cond) console.log('ok', msg); else { failed++; console.log('FAIL', msg); } }
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  const open = async (mutator, freeze) => {
    const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await page.goto(`http://127.0.0.1:5190/?offline=1&debug=1&freeze=${freeze}&mutator=${mutator}`);
    await page.waitForFunction(() => window.__game && window.__game.stats.frames > 20, null, { timeout: 90000 });
    return page;
  };
  const jump = async (page) => {
    await page.evaluate(() => window.__game.teleport(0, 0, 0.05, -6, 0));
    await page.waitForFunction(() => window.__game.sim.local.grounded, null, { timeout: 8000 });
    const y0 = await page.evaluate(() => window.__game.sim.local.y);
    let maxY = y0;
    await page.keyboard.press('Space');
    for (let i = 0; i < 40; i++) { await page.waitForTimeout(40); maxY = Math.max(maxY, await page.evaluate(() => window.__game.sim.local.y)); }
    return maxY - y0;
  };
  try {
    let page = await open('bigHeads', 30);
    const s = await page.evaluate(() => window.__game.snapshot());
    check(s.mutator === 'bigHeads' && s.roomInfo.includes('Big heads'), `HUD: "${s.roomInfo}"`);
    if (process.argv[2]) {
      await page.evaluate(() => {
        const g = window.__game, b = g.sim.actors.filter((a) => a.team === 'B');
        const cx = b.reduce((t, a) => t + a.x, 0) / b.length, cz = b.reduce((t, a) => t + a.z, 0) / b.length;
        g.teleport(0, cx - 3.6, b[0].y + 0.05, cz, 0);
        g.input.debugLook = { yaw: Math.atan2(-3.6, 0), pitch: 0.05 };
      });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: process.argv[2], type: 'jpeg', quality: 75 });
    }
    const normal = await (async () => { const p = await open('', 1); await p.waitForFunction(() => window.__game.sim.round.phase === 'live', null, { timeout: 30000 }); const h = await jump(p); await p.close(); return h; })();
    await page.close();
    page = await open('lowGravity', 1);
    await page.waitForFunction(() => window.__game.sim.round.phase === 'live', null, { timeout: 30000 });
    const low = await jump(page);
    check(low > normal * 1.6, `low gravity jump ${low.toFixed(2)} m vs normal ${normal.toFixed(2)} m`);
    check(errors.length === 0, `no console errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
  } catch (e) { failed++; console.log('ERROR', e.message, JSON.stringify(errors.slice(0, 5))); }
  await browser.close();
  console.log(failed ? `E2E MUTATORS FAILED (${failed})` : 'E2E MUTATORS PASS');
  process.exit(failed ? 1 : 0);
})();
