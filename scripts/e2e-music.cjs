// Generative music: menu loop after the first click, light rhythm in a round, tension in the last 15 s,
// a win sting at the round end, "Music volume" setting saved. Needs `npm run game:dev`.
const { chromium } = require('playwright');
let failed = 0;
function check(cond, msg) { if (cond) console.log('ok', msg); else { failed++; console.log('FAIL', msg); } }
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  try {
    const menu = await browser.newPage({ viewport: { width: 800, height: 600 } });
    menu.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await menu.goto('http://127.0.0.1:5190/?debug=1');
    await menu.waitForSelector('.menu-offline');
    await menu.mouse.click(5, 5);
    await menu.waitForTimeout(3000);
    const m = await menu.evaluate(() => ({ mood: window.__music.mood, pad: window.__music.notes.pad ?? 0 }));
    check(m.mood === 'menu' && m.pad > 0, `menu: calm loop (${m.pad} pad notes)`);
    await menu.click('.menu-settings');
    const def = await menu.evaluate(() => document.querySelector('[data-key="musicVolume"]').value);
    check(Number(def) === 0.25, `Music volume slider, default ${def}`);
    await menu.evaluate(() => { const el = document.querySelector('[data-key="musicVolume"]'); el.value = '0.5'; el.dispatchEvent(new Event('input')); });
    const saved = await menu.evaluate(() => JSON.parse(localStorage.getItem('voxel-settings') ?? '{}').musicVolume);
    check(saved === 0.5, `music volume saved in the browser (${saved})`);
    await menu.evaluate(() => { const el = document.querySelector('[data-key="musicVolume"]'); el.value = '0.25'; el.dispatchEvent(new Event('input')); });
    await menu.close();
    const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (x) => { if (x.type() === 'error') errors.push(x.text().slice(0, 200)); });
    await page.goto('http://127.0.0.1:5190/?offline=1&debug=1&freeze=1');
    await page.waitForFunction(() => window.__game && window.__game.sim.round.phase === 'live', null, { timeout: 90000 });
    await page.mouse.click(5, 5);
    await page.evaluate(() => { for (const a of window.__game.sim.actors) if (a.id !== 0) { a.isBot = false; Object.assign(a.intent, { forward: 0, right: 0, fire: false }); } });
    await page.waitForTimeout(2500);
    let s = (await page.evaluate(() => window.__game.snapshot())).music;
    check(s.mood === 'round' && (s.notes.bass ?? 0) > 0 && (s.notes.hat ?? 0) > 0, `round: light rhythm (bass ${s.notes.bass}, hats ${s.notes.hat})`);
    const arp0 = s.notes.arp ?? 0;
    await page.evaluate(() => { window.__game.sim.round.timeLeft = 12; });
    await page.waitForTimeout(2500);
    s = (await page.evaluate(() => window.__game.snapshot())).music;
    check(s.mood === 'tension' && (s.notes.arp ?? 0) > arp0 + 4, `last 15 s: tension (arp notes +${(s.notes.arp ?? 0) - arp0})`);
    await page.evaluate(() => { const g = window.__game; for (const a of g.sim.actors) if (a.team !== g.sim.local.team) g.sim.kill(a, g.sim.local, false); });
    await page.waitForFunction(() => window.__game.snapshot().music.stings.win >= 1, null, { timeout: 10000 }).catch(() => undefined);
    s = (await page.evaluate(() => window.__game.snapshot())).music;
    check(s.stings.win === 1 && s.stings.lose === 0, `round won: win sting (${JSON.stringify(s.stings)})`);
    check(errors.length === 0, `no console errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
  } catch (e) { failed++; console.log('ERROR', e.message, JSON.stringify(errors.slice(0, 3))); }
  await browser.close();
  console.log(failed ? `E2E MUSIC FAILED (${failed})` : 'E2E MUSIC PASS');
  process.exit(failed ? 1 : 0);
})();
