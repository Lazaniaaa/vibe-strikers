// Second-person view (GAME.md 5) offline: V shows the own character from the front (2.5 m, pulled in by walls),
// shooting is disabled, reloading works, V again returns to first person. Needs `npm run game:dev`.
// Usage: node scripts/e2e-second-person.cjs [shot.jpg]
const { chromium } = require('playwright');
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
    await page.goto('http://127.0.0.1:5190/?offline=1&debug=1&freeze=1');
    await page.waitForFunction(() => window.__game && window.__game.sim.round.phase === 'live', null, { timeout: 90000 });
    await page.evaluate(() => { for (const a of window.__game.sim.actors) if (a.id !== 0) { a.isBot = false; Object.assign(a.intent, { forward: 0, right: 0, fire: false }); } });
    // Open square, look along +x (yaw -pi/2): fire 3 rifle shots first person.
    await page.evaluate(() => { const g = window.__game; g.teleport(0, 0, 0.05, -6, -Math.PI / 2); g.input.debugLook = { yaw: -Math.PI / 2, pitch: 0 }; });
    await page.waitForTimeout(300);
    await page.evaluate(() => { window.__game.input.debugFire = true; });
    await page.waitForTimeout(300);
    await page.evaluate(() => { window.__game.input.debugFire = false; });
    const shots0 = (await snap()).stats.localShots;
    await page.keyboard.press('KeyV');
    await page.waitForTimeout(500);
    let s = await snap();
    check(s.secondPerson && s.secondDistance > 1, `V: second-person view, camera ${s.secondDistance.toFixed(2)} m in front`);
    await page.evaluate(() => { window.__game.input.debugFire = true; });
    await page.waitForTimeout(700);
    await page.evaluate(() => { window.__game.input.debugFire = false; });
    s = await snap();
    check(s.stats.localShots === shots0, `no shooting in second person (${s.stats.localShots - shots0} shots)`);
    const mag = s.actors[0].mag;
    await page.keyboard.press('KeyR');
    await page.waitForTimeout(300);
    check(await page.evaluate(() => window.__game.sim.local.slots[window.__game.sim.local.active].reloadLeft > 0) || (await snap()).actors[0].mag > mag,
      `reloading works in second person (mag ${mag})`);
    if (process.argv[2]) await page.screenshot({ path: process.argv[2], type: 'jpeg', quality: 75 });
    // Facing a wall at 1 m: the camera is pulled in.
    const pulled = await page.evaluate(() => {
      const g = window.__game;
      for (let x = -30; x < 30; x += 0.5) {
        if (!g.los(x, 1.7, -6, x + 1.2, 1.7, -6)) { g.teleport(0, x - 0.2, 0.05, -6, -Math.PI / 2); g.input.debugLook = { yaw: -Math.PI / 2, pitch: 0 }; return x; }
      }
      return null;
    });
    await page.waitForTimeout(600);
    s = await snap();
    check(pulled !== null && s.secondDistance < 2, `camera pulled in by a wall (${s.secondDistance.toFixed(2)} m)`);
    await page.keyboard.press('KeyV');
    await page.waitForTimeout(400);
    check(!(await snap()).secondPerson, 'V again: back to first person');
    check(errors.length === 0, `no console errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
  } catch (e) { failed++; console.log('ERROR', e.message, JSON.stringify(errors.slice(0, 5))); }
  await browser.close();
  console.log(failed ? `E2E SECOND PERSON FAILED (${failed})` : 'E2E SECOND PERSON PASS');
  process.exit(failed ? 1 : 0);
})();
