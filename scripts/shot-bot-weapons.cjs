// Screenshot: offline bots carry random primaries (sniper / shotgun / rifle). Needs `npm run game:dev`.
// Usage: node scripts/shot-bot-weapons.cjs out.jpg
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await page.goto('http://127.0.0.1:5190/?offline=1&debug=1&freeze=30');
  await page.waitForFunction(() => window.__game && window.__game.stats.frames > 30, null, { timeout: 90000 });
  // Freeze phase: bots stand at their spawn. Look at team B from 3.6 m.
  const weapons = await page.evaluate(() => {
    const g = window.__game, sim = g.sim, b = sim.actors.filter((a) => a.team === 'B');
    const cx = b.reduce((s, a) => s + a.x, 0) / b.length, cz = b.reduce((s, a) => s + a.z, 0) / b.length;
    const x = cx - 3.6, z = cz;
    g.teleport(0, x, b[0].y + 0.05, z, 0);
    g.input.debugLook = { yaw: Math.atan2(-(cx - x), -(cz - z)), pitch: -0.05 };
    return sim.actors.map((a) => `${a.team}:${a.slots[0].stats.id}`);
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: process.argv[2] || 'bots.jpg', type: 'jpeg', quality: 75 });
  console.log('primaries:', weapons.join(' '), 'errors:', errors.length);
  await browser.close();
})();
