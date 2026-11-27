const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const srv = http.createServer((q, r) => { r.setHeader('content-type','text/html; charset=utf-8'); r.end(fs.readFileSync(path.join(__dirname, '../dist/preview.html'))); }).listen(8770);
const URL = 'http://localhost:8770/';
(async () => {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1100, height: 1000 } });
  const errs = []; const A = await ctx.newPage(), B = await ctx.newPage();
  for (const [n, p] of [['A', A], ['B', B]]) p.on('pageerror', e => errs.push(n + ' ' + e.message));
  await A.goto(URL + '#jang'); await B.goto(URL + '#jang');
  await A.click('button:has-text("온라인 방 만들기")'); await A.waitForSelector('.lobby .code-tiles');
  const code = (await A.getAttribute('.lobby .code-tiles', 'data-code')).trim();
  await B.fill('#jang-code', code); await B.click('button:has-text("참가하기")');
  await A.waitForFunction(() => document.querySelectorAll('.seats .seat:not(.empty)').length === 2, null, { timeout: 8000 });
  await A.click('button:has-text("게임 시작")'); await B.waitForSelector('.jg-board');
  for (const p of [A, B]) { for (let k = 0; k < 5; k++) await p.click('.jg-hand button.jg-card >> nth=0'); await p.click('button:has-text("순서 확정")'); }
  await A.waitForTimeout(800);
  let moves = 0;
  for (let t = 0; t < 12; t++) {
    for (const p of [A, B]) { const can = await p.$('.jg-cell.can'); if (can) { await can.click(); const d = await p.$('.jg-cell.dest'); if (d) { await d.click(); moves++; await p.waitForTimeout(400); } } }
  }
  console.log('moves made', moves, '| A head:', await A.textContent('.wl-head'), '| B head:', await B.textContent('.wl-head'));
  console.log('B board flipped (own king at bottom):', await B.evaluate(() => { const cells = [...document.querySelectorAll('.jg-cell')]; const last = cells.slice(-5).map(c => c.textContent).join(''); return last; }));
  console.log('ERRORS', errs.length ? errs : 'none');
  await browser.close(); srv.close();
})();
