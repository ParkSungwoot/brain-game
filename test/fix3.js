const { chromium, devices } = require('playwright');
const S = require('os').tmpdir() + '/bgr-shots/';
const URL = 'file://' + __dirname + '/../dist/preview.html';
(async () => { const b = await chromium.launch(); const errs = [];
  // 데스크톱: 한 문제 맞히면 공략 열림, 입력칸 자동 포커스
  const p = await b.newPage({ viewport: { width: 1000, height: 900 } }); p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL + '#cubes'); await p.waitForSelector('.cube-canvas'); await p.waitForTimeout(300);
  console.log('desktop autofocus:', await p.evaluate(() => document.activeElement && document.activeElement.id));
  const ans = await p.evaluate(() => App.quick.lastPuzzle.answer);
  await p.fill('#cubes-ans', String(ans)); await p.keyboard.press('Enter'); await p.waitForSelector('.cube-explain');
  console.log('guide tab after 1 solve:', await p.textContent('#tab-guide'));
  await p.screenshot({ path: S + 'cube-nohole.png', clip: await p.$eval('.cube-wrap', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }) });
  await p.goto(URL + '#tower'); await p.waitForSelector('.declare .btn.primary'); await p.click('.declare .btn.primary'); await p.click('button:has-text("포기")');
  console.log('tower guide after 1 round:', await p.textContent('#tab-guide'));
  // 휴대폰: 자동 포커스 없음
  const m = await (await b.newContext({ ...devices['iPhone 13'] })).newPage(); m.on('pageerror', e => errs.push('m ' + e.message));
  await m.goto(URL + '#nemo'); await m.waitForSelector('#nemo-ans'); await m.waitForTimeout(300);
  console.log('mobile focused element:', await m.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName)));
  await m.goto(URL + '#cubes'); await m.waitForSelector('#cubes-ans'); await m.waitForTimeout(300);
  console.log('mobile cubes focused:', await m.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName)));
  console.log('errors', errs.length ? errs : 'none'); await b.close(); })();
