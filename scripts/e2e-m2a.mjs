// M2a end-to-end: two real browser tabs in one room by code, with optional artificial latency.
// Needs: local SpacetimeDB with the module published, `npm run game:dev`, Playwright.
// Usage: node scripts/e2e-m2a.mjs [lagMs] [screenshotPrefix]
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const lag = Number(process.argv[2] || 0);
const shot = process.argv[3];
const BASE = process.env.GAME_BASE || 'http://127.0.0.1:5190/';
let failed = 0;
function check(cond, msg) { if (cond) console.log('ok', msg); else { failed++; console.log('FAIL', msg); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false } });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  const { GameNet } = await vite.ssrLoadModule('/src/network/client.ts');
  const open = async (label, query) => {
    const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${label}: ${m.text().slice(0, 200)}`); });
    page.on('pageerror', (e) => errors.push(`${label} pageerror: ${e.message}`));
    await page.goto(`${BASE}?debug=1&lag=${lag}&${query}`);
    await page.waitForFunction(() => window.__online && window.__online.stats.frames > 20 && window.__online.net.me, null, { timeout: 90000 });
    return page;
  };
  const snap = (p) => p.evaluate(() => window.__online.snapshot());

  const tabA = await open('A', 'auto=create&name=Alice');
  const code = (await snap(tabA)).room;
  check(/^[A-Z0-9]{5}$/.test(code), `tab A created room ${code} (lag ${lag} ms)`);
  // A Node client takes team B, so tab B lands on team A next to tab A.
  const node = new GameNet();
  await node.connect();
  const pump = setInterval(() => node.update(), 20);
  await node.joinByCode(code, 'NodeBot', 9);
  const tabB = await open('B', `auto=join&code=${code}&name=Bob`);
  await tabA.waitForFunction(() => window.__online.net.players.size === 8, null, { timeout: 20000 }).catch(() => undefined);
  const a0 = await snap(tabA), b0 = await snap(tabB);
  check(a0.players === 8 && b0.players === 8, `both tabs see 8 players (A ${a0.players}, B ${b0.players})`);
  check(a0.remotes === 7 && b0.remotes === 7, `both tabs render 7 other characters (A ${a0.remotes}, B ${b0.remotes})`);
  check(a0.me.team === b0.me.team, `tabs on the same team (${a0.me.team}) with the Node client on ${node.me?.team}`);

  // Real KCC movement in tab A: walk + jump. The server must accept it (no snap-back).
  await tabA.bringToFront();
  const startA = (await snap(tabA)).local;
  await tabA.keyboard.down('KeyS');
  for (let i = 0; i < 3; i++) { await tabA.keyboard.press('Space'); await sleep(500); }
  await tabA.keyboard.up('KeyS');
  await sleep(1500 + lag);
  const a1 = await snap(tabA);
  const walked = Math.hypot(a1.local.x - startA.x, a1.local.z - startA.z);
  check(walked > 0.5, `tab A walked ${walked.toFixed(2)} m with jumps`);
  check(a1.snapBacks === 0, `server accepted real movement (snap-backs: ${a1.snapBacks}, violations ${a1.me.violations})`);
  check(Math.hypot(a1.me.x - a1.local.x, a1.me.z - a1.local.z) < 0.3, 'server position matches tab A');
  const idA = a1.me.id;
  const seen = await tabB.evaluate((id) => { const r = window.__online.net.players.get(BigInt(id)); return r && { x: r.x, z: r.z }; }, idA);
  check(seen && Math.hypot(seen.x - a1.local.x, seen.z - a1.local.z) < 0.3, 'tab B sees tab A at the new position');

  if (shot) {
    // Tab A looks at tab B's character.
    const posB = (await snap(tabB)).local;
    await tabA.evaluate(([x, z]) => {
      const l = window.__online.local; const dx = x - l.x, dz = z - l.z;
      l.yaw = Math.atan2(-dx, -dz); l.pitch = -0.05;
    }, [posB.x, posB.z]);
    await sleep(400);
    await tabA.screenshot({ path: `${shot}-tabA.jpg`, type: 'jpeg', quality: 70 });
    await tabB.screenshot({ path: `${shot}-tabB.jpg`, type: 'jpeg', quality: 70 });
  }

  // Leaving: tab B closes, a bot takes its place in tab A.
  await tabB.context().close();
  const refilled = await tabA.waitForFunction(() => {
    const n = window.__online.net; let humans = 0; for (const r of n.players.values()) if (!r.isBot) humans++;
    return humans === 2 && n.players.size === 8;
  }, null, { timeout: 15000 }).then(() => true, () => false);
  check(refilled, 'tab B closed: a bot took its place (2 humans + 6 bots in tab A)');
  clearInterval(pump);
  node.disconnect();
  check(errors.length === 0, `no console errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
  console.log(failed ? `E2E M2a FAILED (${failed})` : `E2E M2a PASS (lag ${lag} ms)`);
  process.exitCode = failed ? 1 : 0;
} catch (e) {
  console.log('ERROR', e.message, JSON.stringify(errors.slice(0, 5)));
  process.exitCode = 1;
} finally {
  await browser.close();
  await vite.close();
  setTimeout(() => process.exit(), 200);
}
