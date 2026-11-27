const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const SHOTS = require('os').tmpdir() + '/bgr-shots/';
const srv = http.createServer((q, r) => { r.setHeader('content-type','text/html; charset=utf-8'); r.end(fs.readFileSync(path.join(__dirname, '../dist/preview.html'))); }).listen(8769);
const URL = 'http://localhost:8769/';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 1000 } });
  const errs = [];
  const A = await ctx.newPage(); A.on('pageerror', e => errs.push('A ' + e.message));
  await A.goto(URL); await A.waitForSelector('.gsec');
  console.log('sections:', JSON.stringify(await A.$$eval('.gsec', els => els.map(s => s.querySelector('.gsec-title').firstChild.textContent + ': ' + [...s.querySelectorAll('.gname')].map(x => x.textContent).join(', ')))));
  console.log('eyebrow:', await A.textContent('.eyebrow'));
  await A.screenshot({ path: SHOTS + 'home4.png', fullPage: true });
  // local game vs computer
  await A.goto(URL + '#jang'); await A.click('button:has-text("바로 시작")'); await A.click('button:has-text("게임 시작")');
  await A.waitForSelector('.jg-board');
  for (let k = 0; k < 5; k++) await A.click('.jg-hand .jg-card >> nth=0');
  await A.click('button:has-text("순서 확정")');
  await A.waitForTimeout(3500);
  await A.screenshot({ path: SHOTS + 'jang-play.png', fullPage: true });
  // play my moves when it's my turn, for a while
  let moved = 0;
  for (let t = 0; t < 60 && !(await A.$('.result-box')); t++) {
    if (await A.$('.jg-hand button.jg-card')) { for (let k = 0; k < 5; k++) { const b = await A.$('.jg-hand button.jg-card'); if (b) await b.click(); } await A.click('button:has-text("순서 확정")').catch(() => {}); }
    const can = await A.$('.jg-cell.can');
    if (can) { await can.click(); const d = await A.$('.jg-cell.dest'); if (d) { await d.click(); moved++; } }
    await A.waitForTimeout(600);
  }
  console.log('my moves', moved, 'result:', await A.textContent('.result-box').catch(() => 'still playing'), '| head', await A.textContent('.wl-head'));
  await A.screenshot({ path: SHOTS + 'jang-end.png', fullPage: true });
  // mobile
  const m = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();
  m.on('pageerror', e => errs.push('m ' + e.message));
  await m.goto(URL + '#jang'); await m.click('button:has-text("바로 시작")'); await m.click('button:has-text("게임 시작")'); await m.waitForTimeout(800);
  let o = await m.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  console.log('mobile jang', o.sw > o.cw ? 'OVERFLOW ' + o.sw : 'ok');
  await m.screenshot({ path: SHOTS + 'm-jang.png', fullPage: true });
  await m.goto(URL); await m.waitForTimeout(500);
  o = await m.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  console.log('mobile home', o.sw > o.cw ? 'OVERFLOW' : 'ok');
  console.log('ERRORS', errs.length ? errs : 'none');
  await browser.close(); srv.close();
})();
