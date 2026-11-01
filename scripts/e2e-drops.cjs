// Weapon drops in the browser (offline practice): a killed bot's primary lies on the ground as a spinning
// weapon model, the HUD shows "E: pick up", E swaps the primary. Needs `npm run game:dev`.
// Usage: node scripts/e2e-drops.cjs [screenshot.jpg]
const { chromium } = require('playwright');
const URL = process.env.GAME_URL || 'http://127.0.0.1:5190/?offline=1&debug=1&freeze=1';
const shot = process.argv[2];
let failed = 0;
function check(cond, msg) { if (cond) console.log('ok', msg); else { failed++; console.log('FAIL', msg); } }

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const snap = () => page.evaluate(() => window.__game.snapshot());
  try {
    await page.goto(URL);
    await page.waitForFunction(() => window.__game && window.__game.sim.round.phase === 'live', null, { timeout: 90000 });
    // Freeze every bot in place (tests only), then kill enemy bot 4 in the open mid square: its rifle drops.
    await page.evaluate(() => {
      const g = window.__game, sim = g.sim;
      g.teleport(0, 0, 0.05, -6, 0);
      g.teleport(4, 0, 0.05, -8.5, 0);
      const bot = sim.actors[4];
      bot.slots[0].mag = 11;
      sim.kill(bot, sim.local, false); // private in TS; fine for a test
    });
    await page.waitForTimeout(300);
    let s = await snap();
    const drop = s.items[0];
    check(s.items.length >= 1 && drop.weapon === 'rifle' && drop.mag === 11, `dead bot's rifle dropped (${drop?.weapon} ${drop?.mag} / ${drop?.reserve})`);
    await page.waitForFunction(() => window.__game.snapshot().itemViews >= 1, null, { timeout: 5000 }).catch(() => undefined);
    s = await snap();
    check(s.itemViews === s.items.length, `drops are drawn (${s.itemViews} models)`);
    // Make it a shotgun so the swap is visible, stand next to it, look at it.
    await page.evaluate(() => {
      const it = window.__game.sim.items[0];
      it.weapon = 'shotgun'; it.mag = 5; it.reserve = 12;
      window.__game.teleport(0, it.x + 0.6, 0.05, it.z + 1.35, 0.4);
      window.__game.input.debugLook = { yaw: 0.4, pitch: -0.62 };
    });
    await page.waitForTimeout(1200);
    s = await snap();
    check(s.hint.startsWith('E: pick up SHOTGUN'), `HUD hint: "${s.hint}"`);
    if (shot) await page.screenshot({ path: shot, type: 'jpeg', quality: 75 });
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(500);
    s = await snap();
    const me = s.actors[0];
    check(me.weapon === 'shotgun' && me.mag === 5 && me.reserve === 12, `E swaps the primary: ${me.weapon} ${me.mag} / ${me.reserve}`);
    check(s.items.some((i) => i.weapon === 'rifle' && Math.hypot(i.x - me.x, i.z - me.z) < 0.5), 'old rifle dropped at the feet');
    check(errors.length === 0, `no console errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
  } catch (e) {
    failed++;
    console.log('ERROR', e.message, JSON.stringify(errors.slice(0, 5)));
  }
  await browser.close();
  console.log(failed ? `E2E DROPS FAILED (${failed})` : 'E2E DROPS PASS');
  process.exit(failed ? 1 : 0);
})();
