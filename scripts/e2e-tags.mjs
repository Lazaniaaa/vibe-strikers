// Playtest fix 5: team identification. Offline, long freeze (bots stand still), bots teleported around the camera.
// Allies: tag always (through walls) within 40 m, faded near the limit. Enemies: tag only in line of sight
// and near the crosshair. Kill feed names coloured ally / enemy.
// Usage: node scripts/e2e-tags.mjs [screenshot.jpg]
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
  await page.goto(`${BASE}?offline=1&debug=1&freeze=120`);
  await page.waitForFunction(() => window.__game && window.__game.stats.frames > 20, null, { timeout: 90000 });
  const g = (fn, arg) => page.evaluate(fn, arg);
  // Player at the mid square looking along -Z.
  await g(() => { window.__game.teleport(0, 0, 0.05, 2, 0); window.__game.input.debugLook = { yaw: 0, pitch: 0 }; });
  // Park every bot far away first.
  await g(() => { for (let i = 1; i < 8; i++) window.__game.teleport(i, -30 + i, 0.05, 30, 0); });
  const settle = () => page.waitForTimeout(500);
  const tags = () => g(() => window.__game.tags());
  const tagOf = async (id) => (await tags()).find((t) => t.id === id);
  const me = await g(() => { const a = window.__game.sim.local; return { x: a.x, y: a.y + a.eyeHeight, z: a.z }; });
  // Find a spot ahead (within 25 m) hidden behind a map box, and one in clear sight.
  const spots = await g((e) => {
    const out = { hidden: null, clear: null };
    for (let d = 6; d <= 25 && (!out.hidden || !out.clear); d += 0.5) for (let side = -6; side <= 6; side += 1) {
      const x = e.x + side, z = e.z - d;
      const los = window.__game.los(e.x, e.y, e.z, x, 1.35, z);
      if (!los && !out.hidden && Math.abs(side) <= 1) out.hidden = { x, z };
      if (los && !out.clear && side === 0 && d >= 6) out.clear = { x, z };
    }
    return out;
  }, me);
  check(!!spots.clear, `clear spot ahead ${JSON.stringify(spots.clear)}`);
  // 1 = ally (team A, like the player), 4 = enemy (team B).
  await g((p) => window.__game.teleport(1, p.x - 1.5, 0.05, p.z, 0), spots.clear);
  await g((p) => window.__game.teleport(4, p.x + 0.3, 0.05, p.z, 0), spots.clear);
  await settle();
  const a1 = await tagOf(1), e1 = await tagOf(4);
  check(a1 && a1.ally && a1.name, `ally in front: blue tag "${a1?.name}"`);
  check(e1 && !e1.ally, `enemy in sight near the crosshair: red tag "${e1?.name}"`);
  if (shot) await page.screenshot({ path: shot, type: 'jpeg', quality: 72 });
  // Enemy off the crosshair (35 deg to the side) -> no tag.
  await g((p) => window.__game.teleport(4, p.x + 6, 0.05, p.z + 2, 0), spots.clear);
  await settle();
  check(!(await tagOf(4)), 'enemy far from the crosshair: no tag');
  if (spots.hidden) {
    await g((p) => window.__game.teleport(4, p.x, 0.05, p.z, 0), spots.hidden);
    await g((p) => window.__game.teleport(1, p.x + 0.4, 0.05, p.z, 0), spots.hidden);
    await settle();
    check(!(await tagOf(4)), 'enemy behind a wall near the crosshair: no tag (no wall hacks)');
    check(!!(await tagOf(1)), 'ally behind a wall: tag still shown');
  } else console.log('skip wall checks: no hidden spot found ahead');
  // Distance: ally at ~36 m -> faded; enemy and ally beyond 40 m -> hidden.
  await g((e) => window.__game.teleport(1, e.x, 0.05, e.z - 36, 0), me);
  await settle();
  const far = await tagOf(1);
  check(far && far.opacity < 0.8 && far.opacity > 0, `ally at 36 m: faded tag (opacity ${far?.opacity})`);
  await g((e) => window.__game.teleport(1, e.x, 0.05, e.z - 46, 0), me);
  await settle();
  check(!(await tagOf(1)), 'ally beyond 40 m: no tag');
  // Kill feed colours: shoot the enemy dead after the freeze is skipped.
  await g(() => { window.__game.sim.round.timeLeft = 0; });
  await page.waitForFunction(() => window.__game.sim.round.phase === 'live', null, { timeout: 10000 });
  await g((p) => window.__game.teleport(4, p.x, 0.05, p.z, Math.PI), spots.clear);
  await g(() => { window.__game.input.debugLook = null; window.__game.input.debugFire = true; });
  for (let i = 0; i < 80; i++) {
    const alive = await g(() => { window.__game.aimAt(4); return window.__game.sim.actors[4].alive; });
    if (!alive) break;
    await page.waitForTimeout(50);
  }
  await g(() => { window.__game.input.debugFire = false; });
  await page.waitForTimeout(400);
  const feed = await g(() => [...document.querySelectorAll('.hud-feed span')].map((s) => s.className));
  check(feed.includes('ally') && feed.includes('enemy'), `kill feed names coloured: ${feed.join(', ')}`);
  check(errors.length === 0, `no console errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
  console.log(failed ? `E2E TAGS FAILED (${failed})` : 'E2E TAGS PASS');
  process.exitCode = failed ? 1 : 0;
} catch (e) {
  console.log('ERROR', e.message, JSON.stringify(errors.slice(0, 5)));
  process.exitCode = 1;
} finally {
  await browser.close();
  setTimeout(() => process.exit(), 200);
}
