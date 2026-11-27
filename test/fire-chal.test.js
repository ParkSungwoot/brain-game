// 대결 코드 실시간: 둘 다 지금 풀기 → 5초 카운트다운 → 같이 시작, 진행 상황, 결과 자동 교환 (Firebase 에뮬레이터)
const { chromium, devices } = require('playwright');
const URL = 'http://127.0.0.1:8791/index.html';
const EMU = () => { window.App = Object.assign(window.App || {}, { FIREBASE_EMU: { host: '127.0.0.1', authPort: 9099, dbPort: 9000 } }); };
const SHOT = process.argv[2] || '/tmp';
async function solve(p, giveUp) {
  await p.waitForSelector('#nemo-ans');
  if (giveUp) await p.click('button:text-is("포기하고 정답 보기")');
  else { const a = await p.evaluate(() => App.quick.lastPuzzle.hits.length); await p.fill('#nemo-ans', String(a)); await p.press('#nemo-ans', 'Enter'); }
}
(async () => {
  const b = await chromium.launch();
  const cA = await b.newContext({ viewport: { width: 1000, height: 900 } }); const cB = await b.newContext({ ...devices['iPhone 13'] });
  await cA.addInitScript(EMU); await cB.addInitScript(EMU);
  const A = await cA.newPage(), B = await cB.newPage();
  const errs = []; for (const [n, p] of [['A', A], ['B', B]]) { p.on('pageerror', (e) => errs.push(n + ' ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(n + ' console ' + m.text().slice(0, 160)); }); }
  await A.goto(URL + '#nemo'); await A.click('button:text-is("대결 코드")'); await A.fill('#nemo-ch-nick', '현진');
  await A.click('button:text-is("3문제")'); await A.click('button:text-is("대결 코드 만들기")');
  const invite = await A.$eval('.share-text', (t) => t.value);
  console.log('invite:\n' + invite.split('\n').slice(0, 3).join(' / '));
  await B.goto(URL + '#nemo'); await B.tap('button:text-is("대결 코드")'); await B.fill('#nemo-ch-nick', '친구');
  await B.fill('#nemo-ch-paste', invite); await B.tap('button:text-is("열기")');
  await A.waitForSelector('.live-row', { timeout: 15000 });
  console.log('A sees:', await A.$$eval('.live-row', (r) => r.map((x) => x.textContent)), '| B sees:', await B.$$eval('.live-row', (r) => r.map((x) => x.textContent)).catch(() => []));
  // A 먼저 지금 풀기 → 대기
  await A.click('button:text-is("지금 풀기")');
  await A.waitForSelector('.count-wait');
  await B.waitForFunction(() => /준비 완료/.test(document.querySelector('.live-panel')?.textContent || ''), null, { timeout: 15000 });
  console.log('A waiting msg:', await A.textContent('.count-wait .room-made-sub'), '| B sees A:', await B.textContent('.live-row'));
  await A.waitForTimeout(1500);
  // B 도 지금 풀기 → 둘 다 카운트다운
  await B.tap('button:text-is("지금 풀기")');
  await A.waitForFunction(() => /^[1-5]$/.test(document.querySelector('.count-big')?.textContent || ''), null, { timeout: 15000 });
  await A.screenshot({ path: SHOT + '/count-a.png' });
  await B.screenshot({ path: SHOT + '/count-b.png' });
  console.log('countdown A:', await A.textContent('.count-big'), 'B:', await B.textContent('.count-big'));
  // 시작 시각 비교
  const [ta, tb] = await Promise.all([A, B].map((p) => p.waitForSelector('#nemo-ans', { timeout: 15000 }).then(() => p.evaluate(() => Date.now()))));
  console.log('start difference ms:', Math.abs(ta - tb), '| A banner:', await A.textContent('.chal .note.center-text').catch(() => '-'));
  // A 1문제 풀면 B 화면에 진행 상황
  await solve(A); await A.click('button:text-is("다음 문제")');
  await B.waitForFunction(() => /2\/3번/.test(document.querySelector('.live-strip')?.textContent || ''), null, { timeout: 15000 });
  console.log('B strip:', await B.textContent('.live-strip'));
  await B.screenshot({ path: SHOT + '/strip-b.png' });
  await solve(A); await A.click('button:text-is("다음 문제")'); await solve(A); await A.click('button:text-is("결과 보기")');
  await A.waitForSelector('.rank');
  console.log('A board alone:', (await A.textContent('.result-box .result-big')).trim(), '| A live:', await A.textContent('.live-panel'));
  for (let i = 0; i < 3; i++) { await solve(B, i === 1); await B.tap(i === 2 ? 'button:text-is("결과 보기")' : 'button:text-is("다음 문제")'); }
  await B.waitForSelector('.rank');
  await A.waitForFunction(() => /2명 중/.test(document.querySelector('.result-box .result-big')?.textContent || ''), null, { timeout: 15000 });
  console.log('A auto-updated:', (await A.textContent('.result-box .result-big')).trim(), '| B:', (await B.textContent('.result-box .result-big')).trim());
  console.log('A ranks:', await A.$$eval('.rank tbody tr', (r) => r.map((x) => x.textContent)));
  // 창 닫으면 방에서 빠짐
  await B.close();
  await A.waitForFunction(() => !document.querySelector('.live-row'), null, { timeout: 20000 }).then(() => console.log('B closed → removed from A list')).catch(() => console.log('B still listed after close'));
  console.log('errors', errs.length ? errs : 'none');
  await b.close();
})();
