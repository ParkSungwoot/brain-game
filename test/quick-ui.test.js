const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const SHOTS = require('os').tmpdir() + '/bgr-shots/';
const srv = http.createServer((q, r) => { r.setHeader('content-type','text/html; charset=utf-8'); r.end(fs.readFileSync(path.join(__dirname, '../dist/preview.html'))); }).listen(8766);
const URL = 'http://localhost:8766/';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  await page.goto(URL); await page.waitForSelector('.gcard');
  console.log('cards', await page.$$eval('.gname', e => e.map(x => x.textContent).join(', ')));
  await page.screenshot({ path: SHOTS + 'home2.png', fullPage: true });

  // nemo solo: wrong then correct
  await page.goto(URL + '#nemo'); await page.waitForSelector('.nm-grid');
  let ans = await page.evaluate(() => App.quick.lastPuzzle.hits.length);
  await page.fill('#nemo-ans', String(ans + 1)); await page.keyboard.press('Enter');
  console.log('nemo after wrong:', await page.textContent('.quick .status'));
  await page.waitForTimeout(5300);
  await page.fill('#nemo-ans', String(ans)); await page.keyboard.press('Enter');
  await page.waitForSelector('.nm-explain');
  console.log('nemo result:', (await page.textContent('.result-box .result-big')));
  await page.screenshot({ path: SHOTS + 'nemo.png', fullPage: true });

  // cubes solo
  await page.goto(URL + '#cubes'); await page.waitForSelector('.cube-canvas');
  await page.waitForTimeout(300);
  await page.screenshot({ path: SHOTS + 'cubes.png', fullPage: true });
  ans = await page.evaluate(() => App.quick.lastPuzzle.answer);
  await page.fill('#cubes-ans', String(ans)); await page.keyboard.press('Enter');
  await page.waitForSelector('.cube-explain');
  await page.screenshot({ path: SHOTS + 'cubes-explain.png', fullPage: true });

  // (숨은 차이 찾기는 빠진 게임이라 점검하지 않음)
  // sym solo: place the pieces using the solution
  await page.goto(URL + '#sym'); await page.waitForSelector('.sym-board');
  await page.screenshot({ path: SHOTS + 'sym.png', fullPage: true });
  // give up to see explanation
  await page.click('button:has-text("포기하고 정답 보기")');
  await page.waitForSelector('.sym-explain');
  await page.screenshot({ path: SHOTS + 'sym-explain.png', fullPage: true });

  // online race: nemo with A host, B guest
  const A = page, B = await ctx.newPage();
  B.on('pageerror', e => errs.push('B ' + e.message));
  await A.goto(URL + '#nemo'); await B.goto(URL + '#nemo');
  await A.click('.seg-btn:text("온라인 경주")'); await B.click('.seg-btn:text("온라인 경주")');
  await A.fill('#nemo-nick', '방장'); await A.click('button:has-text("온라인 방 만들기")'); await A.waitForSelector('.lobby .code-tiles');
  const code = (await A.getAttribute('.lobby .code-tiles', 'data-code')).trim();
  await B.fill('#nemo-nick', '친구'); await B.fill('#nemo-code', code); await B.click('button:has-text("참가하기")');
  await A.waitForFunction(() => document.querySelectorAll('.seats .seat:not(.empty)').length === 2, null, { timeout: 8000 });
  await A.click('.seg-btn:text("3판")');
  await A.click('button:has-text("게임 시작")');
  await B.waitForSelector('.nm-grid');
  ans = await B.evaluate(() => App.quick.lastPuzzle.hits.length);
  await B.fill('#nemo-race-ans', String(ans + 2)); await B.keyboard.press('Enter');
  await B.waitForTimeout(700);
  console.log('B after wrong:', await B.textContent('.game-area .status'));
  await A.fill('#nemo-race-ans', String(ans)); await A.keyboard.press('Enter');
  await B.waitForSelector('.result-box', { timeout: 5000 });
  console.log('B sees:', await B.textContent('.result-box .result-big'));
  await B.screenshot({ path: SHOTS + 'race-nemo-guest.png', fullPage: true });
  await B.waitForSelector('.nm-grid', { timeout: 12000 });
  console.log('B round2 head:', await B.textContent('.q-head'));
  console.log('ERRORS', errs.length ? errs : 'none');
  await browser.close(); srv.close();
})();
