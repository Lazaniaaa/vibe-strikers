// Cornucopia in the browser (offline practice, free-for-all): pedestals with loot, knife + pistol start,
// rocket boots (E) give a double jump with a glow box, bots pick up loot. Needs `npm run game:dev`.
// Usage: node scripts/e2e-cornucopia.cjs [screenshot.jpg] [boots-screenshot.jpg]
const { chromium } = require('playwright');
const URL = process.env.GAME_URL || 'http://127.0.0.1:5190/?offline=1&debug=1&freeze=1&mode=cornucopia&teams=0';
const [shot, shot2] = process.argv.slice(2);
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
    // Bots stand still for the first part (tests only): they would hunt the local player.
    await page.evaluate(() => { for (const a of window.__game.sim.actors) if (a.id !== 0) { a.isBot = false; Object.assign(a.intent, { forward: 0, right: 0, fire: false, jump: false, use: false }); } });
    let s = await snap();
    check(s.mode === 'cornucopia' && s.ffa && new Set(s.actors.map((a) => a.team)).size === 8, `mode ${s.mode}, free-for-all (${new Set(s.actors.map((a) => a.team)).size} teams)`);
    check(s.items.length >= 15 && s.items.every((i) => i.pedestal), `${s.items.length} loot items on pedestals (20 at the start; bots may take some during the first second)`);
    check(!s.local.hasPrimary && s.local.active === 1 && s.actors[0].weapon === 'pistol' && s.actors[0].mag === 12 && s.actors[0].reserve === 0,
      `start: pistol ${s.actors[0].mag} / ${s.actors[0].reserve}, no primary`);
    await page.keyboard.press('Digit1');
    await page.waitForTimeout(300);
    check((await snap()).local.active === 1, 'key 1 does nothing without a primary');
    await page.waitForFunction(() => window.__game.snapshot().itemViews === window.__game.sim.items.length, null, { timeout: 5000 }).catch(() => undefined);
    s = await snap();
    check(s.itemViews === s.items.length, `loot drawn (${s.itemViews} models)`);
    check(s.scoreLine.includes('Cornucopia') && s.scoreLine.includes('free-for-all'), `HUD: "${s.scoreLine}"`);
    // Screenshot: stand 3 m from a pedestal where the view to it is clear (debug line-of-sight helper).
    await page.evaluate(() => {
      const g = window.__game;
      for (const it of g.sim.items.filter((i) => i.y < 1)) {
        for (let k = 0; k < 8; k++) {
          const ang = (k / 8) * Math.PI * 2, x = it.x + Math.sin(ang) * 3, z = it.z + Math.cos(ang) * 3;
          if (!g.los(x, 1.7, z, it.x, 1.0, it.z) || !g.los(x, 1.7, z, it.x + Math.sin(ang) * 4.5, 1.7, it.z + Math.cos(ang) * 4.5)) continue;
          g.teleport(0, x, 0.05, z, 0);
          g.input.debugLook = { yaw: Math.atan2(-(it.x - x), -(it.z - z)), pitch: -0.3 };
          return;
        }
      }
    });
    await page.waitForTimeout(1200);
    if (shot) await page.screenshot({ path: shot, type: 'jpeg', quality: 75 });
    // Pedestals are solid: walk into one from 1.5 m for 1.5 s.
    const ped = await page.evaluate(() => {
      const g = window.__game, it = g.sim.items.find((i) => i.y < 1);
      g.teleport(0, it.x, 0.05, it.z + 1.5, 0); // yaw 0 = facing -z, toward the pedestal
      g.input.debugLook = { yaw: 0, pitch: 0 };
      return { x: it.x, z: it.z };
    });
    await page.waitForTimeout(300);
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
    const pz = (await snap()).actors[0];
    check(Math.abs(pz.z - ped.z) > 0.6 || Math.abs(pz.x - ped.x) > 0.6, `pedestal blocks the player (stopped ${Math.hypot(pz.x - ped.x, pz.z - ped.z).toFixed(2)} m from its centre)`);
    // Rocket boots on a balcony.
    await page.evaluate(() => {
      const g = window.__game, it = g.sim.items.find((i) => i.kind === 'boots');
      g.teleport(0, it.x + 0.8, it.y + 0.05, it.z, Math.PI / 2);
      return { x: it.x, y: it.y, z: it.z };
    });
    await page.waitForTimeout(800);
    s = await snap();
    check(s.hint.includes('ROCKET BOOTS'), `hint: "${s.hint}"`);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(400);
    s = await snap();
    check(s.local.boots, 'E: rocket boots on');
    // Single jump vs double jump on the ground below.
    await page.evaluate(() => window.__game.teleport(0, 0, 0.05, -6, 0));
    await page.waitForFunction(() => window.__game.sim.local.grounded, null, { timeout: 5000 });
    const peak = async (double) => {
      const y0 = (await snap()).actors[0].y;
      let maxY = y0, glow = 0;
      await page.keyboard.press('Space');
      for (let i = 0; i < 30; i++) {
        await page.waitForTimeout(40);
        const v = await page.evaluate(() => ({ y: window.__game.sim.local.y, vy: window.__game.sim.local.vy, glows: window.__game.snapshot().glows }));
        maxY = Math.max(maxY, v.y); glow = Math.max(glow, v.glows);
        if (double && v.y > y0 + 0.4 && v.vy < 2 && !peak.done) { peak.done = true; await page.keyboard.press('Space'); }
      }
      peak.done = false;
      await page.waitForFunction(() => window.__game.sim.local.grounded, null, { timeout: 8000 });
      return { h: maxY - y0, glow };
    };
    const one = await peak(false), two = await peak(true);
    check(two.h > one.h + 0.25, `double jump with boots: ${two.h.toFixed(2)} m vs single ${one.h.toFixed(2)} m`);
    check(two.glow >= 1 && one.glow === 0, `glow box under the feet while boosting (${two.glow})`);
    if (shot2) {
      await page.evaluate(() => { const g = window.__game; g.input.debugLook = { yaw: 0, pitch: -1.2 }; });
      await page.keyboard.press('Space');
      await page.waitForTimeout(250);
      await page.keyboard.press('Space');
      await page.waitForTimeout(120);
      await page.screenshot({ path: shot2, type: 'jpeg', quality: 75 });
    }
    // Bots: let them play, they go for loot.
    await page.evaluate(() => { const g = window.__game; for (const a of g.sim.actors) if (a.id !== 0) a.isBot = true; g.teleport(0, -40, 0.05, 40, 0); });
    await page.waitForFunction(() => window.__game.sim.actors.some((a) => a.id !== 0 && a.hasPrimary) || window.__game.sim.round.phase !== 'live', null, { timeout: 120000 }).catch(() => undefined);
    const b = await page.evaluate(() => ({ armed: window.__game.sim.actors.filter((a) => a.id !== 0 && a.hasPrimary).length, items: window.__game.sim.items.filter((i) => i.pedestal).length, phase: window.__game.sim.round.phase }));
    check(b.armed >= 1 && b.items < 19, `bots pick up loot: ${b.armed} bots armed, ${b.items} pedestal items left (${b.phase})`);
    check(errors.length === 0, `no console errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
  } catch (e) {
    failed++;
    console.log('ERROR', e.message, JSON.stringify(errors.slice(0, 5)));
  }
  await browser.close();
  console.log(failed ? `E2E CORNUCOPIA FAILED (${failed})` : 'E2E CORNUCOPIA PASS');
  process.exit(failed ? 1 : 0);
})();
