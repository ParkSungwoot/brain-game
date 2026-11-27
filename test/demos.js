const { chromium, devices } = require('playwright');
const S = require('os').tmpdir() + '/bgr-shots/';
const URL = 'file://' + __dirname + '/../dist/preview.html';
const IDS = ['cubes', 'nemo', 'heavy', 'wall', 'tower', 'magic', 'sym', 'jang', 'link', 'signal'];
(async () => { const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1000, height: 900 } });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(URL); await p.evaluate((ids) => { for (const id of ids) localStorage.setItem('bgr.plays.' + id, '1'); }, IDS);
  for (const id of IDS) {
    await p.goto(URL + '#' + id); await p.waitForSelector('#tab-guide'); await p.click('#tab-guide');
    await p.waitForSelector('.demo-box', { timeout: 3000 }).catch(() => {});
    const n = await p.$$eval('.demo-box', e => e.length);
    // 두 번째 장면으로 넘겨서 캡처
    if (n) { await p.click('.demo-ctl button:has-text("다음")'); await p.click('.demo-ctl button:has-text("다음")'); await p.waitForTimeout(250); }
    const cap = n ? await p.textContent('.demo-cap') : '';
    console.log(id.padEnd(7), 'demos:', n, '|', cap.slice(0, 60));
    if (n) await p.screenshot({ path: S + 'demo-' + id + '.png', clip: await p.$eval('.demo-box', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y + window.scrollY, width: r.width, height: r.height }; }), fullPage: true });
  }
  // 자동 재생으로 장면이 넘어가는지
  await p.goto(URL + '#magic'); await p.click('#tab-guide'); await p.waitForSelector('.demo-prog');
  const a = await p.textContent('.demo-prog'); await p.waitForTimeout(2300); const c = await p.textContent('.demo-prog');
  console.log('autoplay:', a, '→', c);
  const m = await (await b.newContext({ ...devices['iPhone 13'] })).newPage(); m.on('pageerror', e => errs.push('m ' + e.message));
  await m.goto(URL); await m.evaluate((ids) => { for (const id of ids) localStorage.setItem('bgr.plays.' + id, '1'); }, IDS);
  for (const id of IDS) { await m.goto(URL + '#' + id); await m.click('#tab-guide'); await m.waitForTimeout(300); const o = await m.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth); if (o) console.log('MOBILE OVERFLOW', id); }
  await m.goto(URL + '#heavy'); await m.click('#tab-guide'); await m.waitForTimeout(300); await m.screenshot({ path: S + 'demo-m-heavy.png', fullPage: true });
  console.log('errors', errs.length ? errs : 'none'); await b.close(); })();
