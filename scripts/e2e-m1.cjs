// M1 end-to-end check in headless Chromium (needs `npm run game:dev` running and Playwright installed).
// Usage: node scripts/e2e-m1.cjs [screenshot.jpg]
const { chromium } = require('playwright');
const URL = process.env.GAME_URL || 'http://127.0.0.1:5190/?debug=1&freeze=1';

function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); console.log('ok', msg); }

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const snap = () => page.evaluate(() => window.__game.snapshot());
  const local = async () => (await snap()).actors[0];
  try {
    await page.goto(URL);
    await page.waitForFunction(() => window.__game && window.__game.sim.round.phase === 'live', null, { timeout: 90000 });
    console.log('game is live');
    // Put the player in the open mid square so movement tests do not depend on spawn walls.
    await page.evaluate(() => window.__game.teleport(0, 0, 0.05, -6, 0));
    await page.waitForTimeout(500);
    let me = await local();
    check(me.grounded && Math.abs(me.y) < 0.5, `player stands on the ground (y ${me.y})`);

    const start = me;
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1200); await page.keyboard.up('KeyW');
    me = await local();
    const moved = Math.hypot(me.x - start.x, me.z - start.z);
    check(moved > 1, `W moves the player (${moved.toFixed(2)} m)`);

    await page.keyboard.down('Space');
    let maxY = me.y;
    for (let i = 0; i < 8; i++) { await page.waitForTimeout(50); maxY = Math.max(maxY, (await local()).y); }
    await page.keyboard.up('Space');
    check(maxY > me.y + 0.3, `Space jumps (peak +${(maxY - me.y).toFixed(2)} m)`);
    check(await page.waitForFunction(() => window.__game.sim.local.grounded, null, { timeout: 15000 }).then(() => true, () => false), 'player lands again');

    // Shooting: place enemy 4 six metres in front and fire the rifle at it.
    me = await local();
    await page.evaluate(([x, z]) => { const g = window.__game; g.teleport(4, x, 0.05, z - 6, Math.PI); }, [me.x, me.z]);
    await page.waitForTimeout(300);
    const before = (await snap()).actors[4];
    await page.evaluate(() => { window.__game.input.debugFire = true; });
    // Fire until the target is dead (it shoots back), at most ~6 s.
    for (let i = 0; i < 100; i++) {
      const alive = await page.evaluate(() => { const g = window.__game; g.aimAt(4); return g.sim.actors[4].alive; });
      if (!alive) break;
      await page.waitForTimeout(60);
    }
    await page.evaluate(() => { window.__game.input.debugFire = false; });
    let s = await snap();
    const after = s.actors[4];
    check(s.stats.localShots > 0, `rifle fired ${s.stats.localShots} shots`);
    check(s.stats.localHits > 0 && (after.hp < before.hp || !after.alive), `hits register (${s.stats.localHits} hits, enemy hp ${after.hp.toFixed(0)}, alive ${after.alive})`);
    check(s.actors[0].mag < 30, `magazine goes down (${s.actors[0].mag})`);

    // Headless renders slowly and the sim caps dt, so wait for conditions instead of fixed times.
    const waitFor = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 30000 }).then(() => true, () => false);
    await page.keyboard.press('KeyR');
    check(await waitFor(() => window.__game.sim.local.slots[0].reloadLeft > 0), 'R starts a reload');
    check(await waitFor(() => window.__game.sim.local.slots[0].mag === 30), 'reload fills the magazine to 30');
    await page.keyboard.press('Digit2');
    check(await waitFor(() => window.__game.sim.local.active === 1), 'key 2 switches to pistol');
    await page.keyboard.press('Digit1');

    // Screenshot: an enemy and an ally in view.
    me = await local();
    await page.evaluate(([x, z]) => {
      const g = window.__game;
      g.teleport(5, x + 1.2, 0.05, z - 7, Math.PI); g.teleport(1, x - 1.5, 0.05, z - 3.5, 0);
    }, [me.x, me.z]);
    await page.evaluate(() => { window.__game.input.debugLook = { yaw: 0, pitch: -0.05 }; });
    await page.waitForTimeout(400);
    if (process.argv[2]) await page.screenshot({ path: process.argv[2], type: 'jpeg', quality: 72 });

    // Let the bots play the rest of the round(s) out.
    const t0 = Date.now();
    await page.waitForFunction(() => { const r = window.__game.sim.round; return r.scoreA + r.scoreB >= 1 || r.round > 1; }, null, { timeout: 240000, polling: 1000 });
    s = await snap();
    const kills = s.actors.reduce((n, a) => n + a.kills, 0);
    check(true, `round ended after ${((Date.now() - t0) / 1000).toFixed(0)} s real time: score A ${s.scoreA} B ${s.scoreB}, kills ${kills}`);
    check(kills > 0 || s.phase !== 'live', 'bots fight (kills or timeout)');
    console.log('perf', JSON.stringify(s.stats));
    check(errors.length === 0, `no console errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
    console.log('E2E PASS');
  } catch (e) {
    console.log(e.message);
    console.log('errors', JSON.stringify(errors.slice(0, 5)));
    process.exitCode = 1;
  } finally { await browser.close(); }
})();
