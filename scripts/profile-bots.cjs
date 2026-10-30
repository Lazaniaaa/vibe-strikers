// CPU profile of a bot round in headless Chromium (needs `npm run game:dev` or `game:preview` running).
// Usage: node scripts/profile-bots.cjs [seconds] [profile.cpuprofile]
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.GAME_URL || 'http://127.0.0.1:5190/?debug=1&freeze=1';
const seconds = Number(process.argv[2] || 25);

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.__game && window.__game.sim.round.phase === 'live', null, { timeout: 90000 });
  // Sample simulation sections every frame from inside the page.
  await page.evaluate(() => {
    const g = window.__game; window.__samples = [];
    const loop = () => { const n = g.perf.now; window.__samples.push([n.sim, n.bots, n.motor, n.weapons, n.render, n.pose, n.poseMaxCall]); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  await page.waitForTimeout(seconds * 1000);
  const { profile } = await cdp.send('Profiler.stop');
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(profile));
  const res = await page.evaluate(() => ({ samples: window.__samples, long: window.__game.perf.longFrames, snap: window.__game.snapshot() }));

  // Self time per function.
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  const dts = profile.timeDeltas;
  for (let i = 0; i < profile.samples.length; i++) {
    const n = byId.get(profile.samples[i]); const f = n.callFrame;
    const key = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}`;
    self.set(key, (self.get(key) || 0) + (dts[i] || 0) / 1000);
  }
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  console.log('TOP SELF TIME (ms of', total.toFixed(0), ')');
  for (const [k, v] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(v.toFixed(1).padStart(9), k);

  const cols = ['sim', 'bots', 'motor', 'weapons', 'render', 'pose', 'pose1'];
  const s = res.samples;
  console.log('frames sampled', s.length);
  cols.forEach((c, i) => {
    const v = s.map((r) => r[i]).sort((a, b) => a - b);
    const p = (q) => v[Math.min(v.length - 1, Math.floor(q * v.length))].toFixed(2);
    console.log(c.padEnd(8), 'median', p(0.5), 'p99', p(0.99), 'max', v[v.length - 1].toFixed(2));
  });
  console.log('frames with sim > 20 ms:', s.filter((r) => r[0] > 20).length, '| pose > 20 ms:', s.filter((r) => r[5] > 20).length, '| pose > 50 ms:', s.filter((r) => r[5] > 50).length);
  const rs = s.map((r, i) => [i, r[4]]).filter((x) => x[1] > 50);
  console.log('render > 50 ms at frames:', JSON.stringify(rs.map((x) => `${x[0]}:${Math.round(x[1])}`)));
  console.log('kills', res.snap.actors.reduce((n, a) => n + a.kills, 0), 'round', res.snap.round, 'phase', res.snap.phase);
  console.log('errors', JSON.stringify(errors));
  await browser.close();
})();
