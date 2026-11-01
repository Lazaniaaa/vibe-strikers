// M3 part 1 e2e: character select on the menu, chosen characters shown to others, online kill feed,
// TAB scoreboard (name, character, kills, deaths, ping), only own-room rows.
// Needs: local SpacetimeDB + module, `npm run game:dev` (or GAME_BASE), Playwright.
// Usage: node scripts/e2e-m3a.mjs [shotPrefix]
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const shot = process.argv[2];
const BASE = process.env.GAME_BASE || 'http://127.0.0.1:5190/';
let failed = 0;
function check(cond, msg) { if (cond) console.log('ok', msg); else { failed++; console.log('FAIL', msg); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false } });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  const { characters } = await vite.ssrLoadModule('/src/characters/characters.ts');
  const label = (i) => characters[i].name.replace(/^vibe-vibers-/, '');
  const page = async (label, url) => {
    const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
    const p = await ctx.newPage();
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`${label}: ${m.text().slice(0, 200)}`); });
    p.on('pageerror', (e) => errors.push(`${label} pageerror: ${e.message}`));
    await p.goto(url);
    return p;
  };

  // Menu: 33 character buttons; clicking one selects it and shows its name.
  const menu = await page('menu', `${BASE}?debug=1`);
  await menu.setViewportSize({ width: 640, height: 900 });
  await menu.waitForSelector('.menu-char');
  const count = await menu.locator('.menu-char').count();
  check(count === characters.length, `menu lists all ${count} characters`);
  await menu.locator('.menu-char').nth(17).click();
  const shown = await menu.locator('.menu-char-name').textContent();
  check(shown === label(17) && await menu.locator('.menu-char.selected').count() === 1, `selecting a character shows its name (${shown})`);
  await menu.selectOption('.menu-difficulty', 'hard');
  check(await menu.evaluate(() => localStorage.getItem('voxel-difficulty')) === 'hard', 'bot difficulty select is saved');
  await menu.click('.menu-offline');
  await menu.waitForFunction(() => window.__game && document.querySelector('.hud-room')?.textContent.includes('hard'), null, { timeout: 60000 }).catch(() => undefined);
  check(await menu.evaluate(() => document.querySelector('.hud-room')?.textContent ?? ''), `offline practice uses it: "${await menu.evaluate(() => document.querySelector('.hud-room')?.textContent ?? '')}"`);
  await menu.evaluate(() => localStorage.setItem('voxel-difficulty', 'normal'));
  if (shot) await menu.screenshot({ path: `${shot}-menu.jpg`, type: 'jpeg', quality: 70 });
  await menu.context().close();

  // Two players with chosen characters in a room with bots.
  const ready = (p) => p.waitForFunction(() => window.__online && window.__online.stats.frames > 20 && window.__online.net.me, null, { timeout: 90000 });
  const tabA = await page('A', `${BASE}?debug=1&auto=create&name=Alice&character=5`);
  await ready(tabA);
  const code = await tabA.evaluate(() => window.__online.net.room.code);
  const tabB = await page('B', `${BASE}?debug=1&auto=join&code=${code}&name=Bob&character=20`);
  await ready(tabB);
  await tabA.waitForFunction(() => window.__online.net.players.size === 8, null, { timeout: 20000 }).catch(() => undefined);
  const rowsA = await tabA.evaluate(() => window.__online.scoreRows());
  const bobRow = rowsA.find((r) => r.name === 'Bob'), aliceRow = rowsA.find((r) => r.name === 'Alice');
  check(rowsA.length === 8, `scoreboard has 8 rows (${rowsA.length})`);
  check(bobRow?.character === label(20) && aliceRow?.character === label(5), `chosen characters are seen by others (Alice ${aliceRow?.character}, Bob ${bobRow?.character})`);
  const bobRemote = await tabA.evaluate((id) => { const r = window.__online.net.players.get(BigInt(id)); return r?.character; }, bobRow.id);
  check(bobRemote === 20, 'tab A renders Bob with character 20');
  check(rowsA.filter((r) => r.isBot).length === 6 && rowsA.filter((r) => r.isBot).every((r) => r.character), 'bots have random characters');
  const rooms = await tabA.evaluate(() => window.__online.net.knownRoomIds().map(String));
  check(rooms.length === 1, `tab A only receives its own room (${rooms.length})`);

  // Kill feed: wait for the first kill (bots fight; the round starts after the freeze).
  const fed = await tabA.waitForFunction(() => window.__online.feed.length > 0, null, { timeout: 90000 }).then(() => true, () => false);
  const feed = await tabA.evaluate(() => window.__online.feed.slice());
  check(fed && /\[(rifle|pistol)/.test(feed[0]), `kill feed shows kills: "${feed[0]}"`);
  // Ping is reported every 2 s by humans.
  await sleep(2500);
  const rows2 = await tabA.evaluate(() => window.__online.scoreRows());
  check(rows2.filter((r) => !r.isBot).every((r) => r.ping > 0), `humans have a ping on the scoreboard (${rows2.filter((r) => !r.isBot).map((r) => r.ping).join(', ')})`);
  const kd = rows2.reduce((n, r) => n + r.kills, 0), dd = rows2.reduce((n, r) => n + r.deaths, 0);
  check(kd >= 1 && dd >= kd, `scoreboard kills ${kd}, deaths ${dd}`);

  // TAB shows the scoreboard.
  await tabA.bringToFront();
  await tabA.keyboard.down('Tab');
  await sleep(600);
  const visible = await tabA.evaluate(() => getComputedStyle(document.querySelector('.scoreboard')).display !== 'none' &&
    document.querySelectorAll('.scoreboard tr').length);
  check(visible === 10, `holding TAB shows the scoreboard (${visible} table rows incl. 2 headers)`);
  if (shot) await tabA.screenshot({ path: `${shot}-scoreboard.jpg`, type: 'jpeg', quality: 70 });
  await tabA.keyboard.up('Tab');
  await sleep(400);
  const hidden = await tabA.evaluate(() => getComputedStyle(document.querySelector('.scoreboard')).display === 'none');
  check(hidden, 'releasing TAB hides it');
  check(errors.length === 0, `no console errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
  console.log(failed ? `E2E M3a FAILED (${failed})` : 'E2E M3a PASS');
  process.exitCode = failed ? 1 : 0;
} catch (e) {
  console.log('ERROR', e.message, JSON.stringify(errors.slice(0, 5)));
  process.exitCode = 1;
} finally {
  await browser.close();
  await vite.close();
  setTimeout(() => process.exit(), 200);
}
