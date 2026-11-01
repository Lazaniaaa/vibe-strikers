// Load time of the production build (needs `npm run game:build` + `npm run game:preview` on :5191).
// Measures: JS downloaded, time until the menu is shown, time to the first rendered game frame (offline practice),
// on a fast local link and with a throttled link (10 Mbit/s, 40 ms latency) like a public link.
// Usage: node scripts/measure-load.cjs [base] [loading.jpg]
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:5191/';
const shot = process.argv[3]; // optional: screenshot of the loading screen (throttled run)
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const throttled of [false, true]) {
    const ctx = await browser.newContext({ viewport: { width: 800, height: 450 } });
    const page = await ctx.newPage();
    if (throttled) {
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 10e6 / 8, uploadThroughput: 5e6 / 8 });
    }
    let js = 0;
    page.on('response', async (r) => { if (r.url().endsWith('.js')) { try { js += (await r.body()).length; } catch { /* ignore */ } } });
    const t0 = Date.now();
    await page.goto(BASE + '?debug=1');
    await page.waitForSelector('.menu-offline', { state: 'visible', timeout: 120000 });
    const menuMs = Date.now() - t0;
    const jsMenu = js;
    const t1 = Date.now();
    await page.click('.menu-offline');
    if (throttled && shot) { await page.waitForSelector('.loading', { timeout: 5000 }).catch(() => undefined); await page.waitForTimeout(250); await page.screenshot({ path: shot, type: 'jpeg', quality: 70 }); }
    await page.waitForFunction(() => window.__game && window.__game.stats.frames >= 1, null, { timeout: 180000, polling: 20 });
    const gameMs = Date.now() - t1;
    console.log(`${throttled ? 'throttled 10 Mbit/s' : 'local          '}: menu ${menuMs} ms (JS ${(jsMenu / 1e6).toFixed(2)} MB), ` +
      `first game frame ${gameMs} ms after "Practice offline" (total ${menuMs + gameMs} ms, JS ${(js / 1e6).toFixed(2)} MB)`);
    await ctx.close();
  }
  await browser.close();
})();
