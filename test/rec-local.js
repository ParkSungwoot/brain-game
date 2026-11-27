const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8791/index.html';
const EMU = () => { window.App = Object.assign(window.App || {}, { FIREBASE_EMU: { host: '127.0.0.1', authPort: 9099, dbPort: 9000 } }); };
(async () => { const b = await chromium.launch(); const c = await b.newContext(); await c.addInitScript(EMU); const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL + '#nemo'); await p.click('button:text-is("온라인 대결")'); await p.click('button:text-is("바로 시작")');
  await p.click('button:text-is("⏱ 기록 대결")'); await p.click('button:text-is("3문제")'); await p.click('button:text-is("게임 시작")');
  await p.waitForSelector('.count-big'); console.log('countdown', await p.textContent('.count-big'));
  for (let i = 0; i < 3; i++) { await p.waitForSelector('#nemo-ans', { timeout: 20000 }); const a = await p.evaluate(() => App.quick.lastPuzzle.hits.length); await p.fill('#nemo-ans', String(a)); await p.press('#nemo-ans', 'Enter'); await p.click(i === 2 ? 'button:text-is("결과 보기")' : 'button:text-is("다음 문제")'); }
  await p.waitForSelector('.live-strip'); console.log('waiting:', await p.textContent('.status'), '|', await p.textContent('.live-strip'));
  await p.waitForFunction(() => /명 중/.test(document.querySelector('.result-box .result-big')?.textContent || ''), null, { timeout: 280000 });
  console.log('end:', await p.textContent('.result-box .result-big'), '|', await p.$$eval('.rank tbody tr', (r) => r.map((x) => x.textContent)));
  console.log('errors', errs.length ? errs : 'none'); await b.close(); })();
