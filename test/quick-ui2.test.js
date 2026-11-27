const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const SHOTS = require('os').tmpdir() + '/bgr-shots/';
const srv = http.createServer((q, r) => { r.setHeader('content-type','text/html; charset=utf-8'); r.end(fs.readFileSync(path.join(__dirname, '../dist/preview.html'))); }).listen(8767);
const URL = 'http://localhost:8767/';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  // sym: solve using the generator's solution
  await page.goto(URL + '#sym'); await page.waitForSelector('.sym-board');
  const plan = await page.evaluate(() => {
    const pz = App.quick.lastPuzzle, S = App.sym;
    const key = (c) => JSON.stringify(c);
    // 전체 해답을 판 가운데로 옮길 기준점
    const all = pz.sol.flat(); const mx = Math.min(...all.map(c=>c[0])), my = Math.min(...all.map(c=>c[1]));
    return pz.pieces.map((p, i) => {
      let c = p, r = 0;
      const target = key(S.norm(pz.sol[i]));
      while (key(c) !== target && r < 4) { c = S.rot(c); r++; }
      const solN = S.norm(pz.sol[i]);
      const offX = Math.min(...pz.sol[i].map(q=>q[0])) - mx + 1, offY = Math.min(...pz.sol[i].map(q=>q[1])) - my + 1;
      const first = solN[0];
      return { r, ax: offX + first[0], ay: offY + first[1], ok: key(c) === target };
    });
  });
  console.log('plan', JSON.stringify(plan));
  const W = await page.evaluate(() => App.quick.lastPuzzle.board[0]);
  for (let i = 0; i < plan.length; i++) {
    await page.click('.sym-piece >> nth=0');
    for (let r = 0; r < plan[i].r; r++) await page.click('button:text-is("↻ 돌리기")');
    await page.click('.sym-cell >> nth=' + (plan[i].ay * W + plan[i].ax));
  }
  await page.waitForTimeout(300);
  console.log('sym:', await page.textContent('.result-box .result-big').catch(() => 'not solved: ' + '')); 
  await page.screenshot({ path: SHOTS + 'sym-done.png', fullPage: true });
  console.log('guide tab:', await page.textContent('#tab-guide'));
  console.log('ERRORS', errs.length ? errs : 'none');
  await browser.close(); srv.close();
})();
