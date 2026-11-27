const { chromium } = require('playwright');
const S = require('os').tmpdir() + '/bgr-shots/';
const URL = 'file://' + __dirname + '/../dist/preview.html';
(async () => { const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: 1000, height: 1100 } }); p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL + '#nemo'); await p.click('.seg-btn:text("온라인 경주")');
  await p.click('button:has-text("바로 시작")'); await p.click('button:has-text("+ 컴퓨터")'); await p.click('button:has-text("+ 컴퓨터")');
  await p.click('.seg-btn:text("3판")'); await p.click('button:has-text("게임 시작")');
  for (let r = 0; r < 3; r++) {
    await p.waitForFunction(() => document.querySelector('#nemo-race-ans') && !document.querySelector('#nemo-race-ans').disabled, null, { timeout: 15000 });
    const ans = await p.evaluate(() => App.quick.lastPuzzle.hits.length);
    if (r === 2) { await p.waitForTimeout(100); }
    await p.fill('#nemo-race-ans', String(ans)); await p.keyboard.press('Enter');
    await p.waitForSelector('.result-box', { timeout: 30000 });
    if (r < 2) await p.waitForSelector('.result-box', { state: 'detached', timeout: 15000 });
  }
  await p.waitForSelector('.announce', { timeout: 15000 });
  console.log(await p.$$eval('.ann', els => els.map(e => e.textContent).join(' | ')));
  await p.screenshot({ path: S + 'announce.png', fullPage: true });
  console.log('errors', errs.length ? errs : 'none'); await b.close(); })();
