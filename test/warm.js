const { chromium, devices } = require('playwright');
const S = require('os').tmpdir() + '/bgr-shots/';
const URL = 'file://' + __dirname + '/../dist/preview.html';
(async () => { const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: 1100, height: 900 } }); p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(600); await p.evaluate(() => window.scrollTo(0, 380)); await p.waitForTimeout(200);
  await p.screenshot({ path: S + 'warm-home.png' });
  await p.goto(URL + '#heavy'); await p.click('button:has-text("바로 시작")'); await p.click('button:has-text("게임 시작")'); await p.waitForTimeout(600);
  await p.screenshot({ path: S + 'warm-heavy.png' });
  await p.goto(URL + '#signal'); await p.waitForTimeout(400); await p.screenshot({ path: S + 'warm-signal.png' });
  await p.goto(URL + '#cubes'); await p.waitForTimeout(600); await p.screenshot({ path: S + 'warm-cubes.png' });
  const m = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  for (const r of ['', '#magic', '#jang', '#link']) { await m.goto(URL + r); await m.waitForTimeout(400); const o = await m.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth); if (o) console.log('OVERFLOW', r); }
  console.log('errors', errs.length ? errs : 'none'); await b.close(); })();
