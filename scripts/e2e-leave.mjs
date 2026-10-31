// Playtest fix 2: "Leave match" (Esc overlay, with confirm) back to the menu; a bot refills the slot;
// rejoining works without reloading; offline practice leaves to the menu too.
// Usage: node scripts/e2e-leave.mjs
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.GAME_BASE || 'http://127.0.0.1:5190/';
let failed = 0;
function check(cond, msg) { if (cond) console.log('ok', msg); else { failed++; console.log('FAIL', msg); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false } });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  const { GameNet } = await vite.ssrLoadModule('/src/network/client.ts');
  const tab = await browser.newPage({ viewport: { width: 640, height: 360 } });
  tab.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  tab.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  const inGame = () => tab.waitForFunction(() => window.__online && window.__online.stats.frames > 20 && window.__online.net.me, null, { timeout: 90000 });
  await tab.goto(`${BASE}?debug=1&auto=create&name=Leaver`);
  await inGame();
  const code = await tab.evaluate(() => window.__online.net.room.code);
  const obs = new GameNet();
  await obs.connect();
  const pump = setInterval(() => obs.update(), 10);
  await obs.joinByCode(code, 'Watcher', 3);
  await sleep(1000);
  const humans = () => [...obs.players.values()].filter((p) => !p.isBot).length;
  check(humans() === 2 && obs.players.size === 8, `room has 2 humans + bots (${humans()}, ${obs.players.size})`);
  // Esc overlay -> Leave match -> confirm.
  await tab.evaluate(() => document.querySelector('.hud-leave-btn').click());
  check(await tab.evaluate(() => getComputedStyle(document.querySelector('.hud-leave-confirm')).display !== 'none'), 'Leave match asks "Are you sure?"');
  await tab.evaluate(() => document.querySelector('.hud-leave-no').click());
  check(await tab.evaluate(() => !!window.__online), '"No" keeps you in the match');
  await tab.evaluate(() => document.querySelector('.hud-leave-btn').click());
  await tab.evaluate(() => document.querySelector('.hud-leave-yes').click());
  await tab.waitForFunction(() => getComputedStyle(document.querySelector('.menu')).display !== 'none', null, { timeout: 10000 }).catch(() => undefined);
  check(await tab.evaluate(() => getComputedStyle(document.querySelector('.menu')).display !== 'none' && !window.__online
    && document.getElementById('hud').childElementCount === 0), 'back at the main menu, game and HUD removed');
  await sleep(1000);
  check(humans() === 1 && obs.players.size === 8, `server freed the slot and a bot took it (${humans()} human, ${obs.players.size} players)`);
  // Rejoin the same room by code, without reloading.
  await tab.fill('.menu-code', code);
  await tab.click('.menu-join');
  await inGame();
  await tab.waitForFunction(() => window.__online.net.players.size === 8, null, { timeout: 15000 }).catch(() => undefined);
  const s = await tab.evaluate(() => ({ players: window.__online.net.players.size, perf: document.querySelectorAll('.hud-perf').length,
    alive: window.__online.net.me.alive, spawnSeen: window.__online.local.x !== 0 }));
  check(s.players === 8 && s.perf === 1 && s.alive && s.spawnSeen, `rejoined without reloading: ${JSON.stringify(s)}`);
  await sleep(800);
  check(humans() === 2, `observer sees 2 humans again (${humans()})`);
  // Leave again, then offline practice, then leave offline.
  await tab.evaluate(() => { document.querySelector('.hud-leave-btn').click(); document.querySelector('.hud-leave-yes').click(); });
  await tab.waitForFunction(() => getComputedStyle(document.querySelector('.menu')).display !== 'none', null, { timeout: 10000 }).catch(() => undefined);
  await tab.click('.menu-offline');
  await tab.waitForFunction(() => window.__game && window.__game.stats.frames > 10, null, { timeout: 60000 }).catch(() => undefined);
  check(await tab.evaluate(() => !!window.__game), 'offline practice starts from the menu');
  await tab.evaluate(() => { document.querySelector('.hud-leave-btn').click(); document.querySelector('.hud-leave-yes').click(); });
  await tab.waitForFunction(() => getComputedStyle(document.querySelector('.menu')).display !== 'none', null, { timeout: 10000 }).catch(() => undefined);
  check(await tab.evaluate(() => !window.__game && getComputedStyle(document.querySelector('.menu')).display !== 'none'), 'offline: Leave match goes back to the menu');
  clearInterval(pump);
  obs.disconnect();
  check(errors.length === 0, `no console errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
  console.log(failed ? `E2E LEAVE FAILED (${failed})` : 'E2E LEAVE PASS');
  process.exitCode = failed ? 1 : 0;
} catch (e) {
  console.log('ERROR', e.message, JSON.stringify(errors.slice(0, 5)));
  process.exitCode = 1;
} finally {
  await browser.close();
  await vite.close();
  setTimeout(() => process.exit(), 200);
}
