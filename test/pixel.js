const { chromium, devices } = require('playwright');
const S = require('os').tmpdir() + '/bgr-shots/';
const URL = 'file://' + __dirname + '/../dist/preview.html';
(async () => { const b = await chromium.launch(); const errs = [];
  const d = await b.newPage({ viewport: { width: 1100, height: 900 } }); d.on('pageerror', e => errs.push(e.message)); d.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  await d.goto(URL); await d.waitForTimeout(800);
  console.log('font loaded:', await d.evaluate(() => document.fonts.check('16px Galmuri11', '두뇌 서바이벌')), await d.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight).join(', ')));
  await d.screenshot({ path: S + 'px-home.png' });
  for (const [r, act] of [['#signal', null], ['#heavy', 'local'], ['#cubes', null], ['#jang', 'local'], ['#wall', 'local'], ['#magic', null]]) {
    await d.goto(URL + r); await d.waitForTimeout(500);
    if (act) { await d.click('button:has-text("바로 시작")'); await d.click('button:has-text("게임 시작")'); await d.waitForTimeout(900); }
    await d.screenshot({ path: S + 'px-' + r.slice(1) + '.png' });
  }
  const m = await (await b.newContext({ ...devices['iPhone 13'] })).newPage(); m.on('pageerror', e => errs.push('m ' + e.message));
  for (const r of ['', '#signal', '#link', '#jang', '#nemo', '#sym', '#heavy']) { await m.goto(URL + r); await m.waitForTimeout(500); const o = await m.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); if (o.sw > o.cw) console.log('OVERFLOW', r, o.sw); }
  await m.goto(URL); await m.waitForTimeout(500); await m.screenshot({ path: S + 'px-m-home.png' });
  console.log('errors', errs.length ? errs : 'none'); await b.close(); })();
