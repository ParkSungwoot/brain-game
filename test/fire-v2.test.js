// 온라인 대결(기록 대결·팀전), 오늘의 문제, 동시 접속자 — Firebase 에뮬레이터에서 세 기기로 점검
const { chromium, devices } = require('playwright');
const URL = 'http://127.0.0.1:8791/index.html';
const EMU = () => { window.App = Object.assign(window.App || {}, { FIREBASE_EMU: { host: '127.0.0.1', authPort: 9099, dbPort: 9000 } }); };
const SHOT = process.argv[2] || require('os').tmpdir();
const sig = (p) => p.evaluate(() => JSON.stringify(App.quick.lastPuzzle).slice(0, 120));
async function answer(p, sel, give) {
  await p.waitForSelector(sel, { timeout: 20000 });
  if (give) { await p.click('button:text-is("포기하고 정답 보기")'); return; }
  const a = await p.evaluate(() => App.quick.lastPuzzle.hits.length); await p.fill(sel, String(a)); await p.press(sel, 'Enter');
}
async function solveSet(p, n, giveAt) { const sigs = []; for (let i = 0; i < n; i++) { await p.waitForSelector('#nemo-ans', { timeout: 20000 }); sigs.push(await sig(p)); await answer(p, '#nemo-ans', i === giveAt); await p.click(i === n - 1 ? 'button:text-is("결과 보기")' : 'button:text-is("다음 문제")'); } return sigs; }
(async () => {
  const b = await chromium.launch();
  const mk = async (o) => { const c = await b.newContext(o); await c.addInitScript(EMU); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
  const errs = [];
  const A = await mk({ viewport: { width: 1000, height: 900 } }), B = await mk({ ...devices['iPhone 13'] }), C = await mk({ viewport: { width: 900, height: 900 } });
  // 1) 동시 접속자
  await A.goto(URL); await B.goto(URL);
  await A.waitForFunction(() => { const e = document.querySelector('.online-count'); return e && !e.hidden && /동시 접속자 \d+/.test(e.textContent); }, null, { timeout: 20000 });
  await A.waitForFunction(() => +document.querySelector('.online-count b').textContent >= 2, null, { timeout: 20000 });
  console.log('home count A:', await A.textContent('.online-count'));
  await A.screenshot({ path: SHOT + '/home-count.png', clip: { x: 0, y: 300, width: 1000, height: 420 } });
  // 2) 오늘의 문제
  await A.goto(URL + '#nemo'); await A.click('button:text-is("오늘의 문제")'); await A.fill('#nemo-set-nick', '현진');
  console.log('daily intro:', await A.textContent('.room-made-head'), '|', await A.textContent('.room-made-sub'));
  await A.click('button:text-is("시작하기")'); const dA = await solveSet(A, 5, -1);
  await A.waitForSelector('.rank-box .result-big', { timeout: 20000 });
  console.log('A daily:', await A.textContent('.rank-box .result-big'), '|', await A.textContent('.rank-box .result-box p:nth-of-type(2)'));
  await B.goto(URL + '#nemo'); await B.tap('button:text-is("오늘의 문제")'); await B.fill('#nemo-set-nick', '친구');
  await B.waitForFunction(() => /1명 참가/.test(document.querySelector('.room-made')?.textContent || ''), null, { timeout: 15000 });
  console.log('B intro stats:', (await B.textContent('.room-made .note')).trim());
  await B.tap('button:text-is("시작하기")'); const dB = await solveSet(B, 5, 2);
  await B.waitForSelector('.rank-box .result-big', { timeout: 20000 });
  console.log('same daily puzzles:', JSON.stringify(dA) === JSON.stringify(dB), '| B daily:', await B.textContent('.rank-box .result-big'), '|', await B.textContent('.rank-box .result-box'));
  await B.screenshot({ path: SHOT + '/daily-b.png', fullPage: true });
  await A.click('button:text-is("↻ 순위 새로고침")'); await A.waitForSelector('.rank-box .result-big');
  console.log('A after refresh:', await A.textContent('.rank-box .result-big'));
  // 3) 기록 대결
  await A.click('button:text-is("온라인 대결")'); await A.fill('#nemo-nick', '현진');
  await A.click('button:text-is("온라인 방 만들기")'); await A.waitForSelector('.lobby .code-tiles');
  const code = await A.getAttribute('.lobby .code-tiles', 'data-code');
  await A.click('button:text-is("⏱ 기록 대결")'); await A.click('button:text-is("3문제")');
  await B.tap('button:text-is("온라인 대결")'); await B.fill('#nemo-nick', '친구'); await B.fill('#nemo-code', code); await B.tap('button:text-is("참가하기")');
  await A.waitForFunction(() => document.querySelectorAll('.seats .seat:not(.empty)').length === 2, null, { timeout: 15000 });
  await A.click('button:text-is("게임 시작")');
  await B.waitForSelector('.count-big', { timeout: 15000 });
  console.log('countdown B:', await B.textContent('.count-big'));
  const [ta, tb] = await Promise.all([A, B].map((p) => p.waitForSelector('#nemo-ans', { timeout: 20000 }).then(() => p.evaluate(() => Date.now()))));
  console.log('rec start diff ms:', Math.abs(ta - tb));
  await answer(A, '#nemo-ans'); await A.click('button:text-is("다음 문제")');
  await B.waitForFunction(() => /현진 2\/3번 · 1개 정답/.test(document.querySelector('.live-strip')?.textContent || ''), null, { timeout: 15000 });
  console.log('B sees progress:', await B.textContent('.live-strip'));
  for (let i = 1; i < 3; i++) { await answer(A, '#nemo-ans'); await A.click(i === 2 ? 'button:text-is("결과 보기")' : 'button:text-is("다음 문제")'); }
  await A.waitForFunction(() => /기다리는 중/.test(document.body.textContent), null, { timeout: 15000 });
  for (let i = 0; i < 3; i++) { await answer(B, '#nemo-ans', i === 0); await B.tap(i === 2 ? 'button:text-is("결과 보기")' : 'button:text-is("다음 문제")'); }
  await A.waitForFunction(() => /2명 중 1위/.test(document.querySelector('.result-box .result-big')?.textContent || ''), null, { timeout: 15000 });
  console.log('rec end A:', await A.textContent('.result-box .result-big'), '| B:', await B.textContent('.result-box .result-big'), '| announce:', (await A.textContent('.announce')).slice(0, 60));
  await A.screenshot({ path: SHOT + '/rec-end-a.png', fullPage: true });
  // 방장이 나간 뒤 C 가 같은 방 코드로 → 같은 문제 풀고 순위에 합쳐짐
  await A.click('button:text-is("나가기")'); await B.tap('button:text-is("처음으로")').catch(() => {}); await B.waitForTimeout(500);
  await C.goto(URL + '#nemo'); await C.click('button:text-is("온라인 대결")'); await C.fill('#nemo-nick', '늦은친구'); await C.fill('#nemo-code', code); await C.click('button:text-is("참가하기")');
  await C.waitForSelector('.room-made-head', { timeout: 30000 });
  console.log('late C:', await C.textContent('.room-made-head'), '|', await C.textContent('.chal-lead'));
  await C.click('button:text-is("시작하기")');
  for (let i = 0; i < 3; i++) { await answer(C, '#nemo-ans'); await C.click(i === 2 ? 'button:text-is("결과 보기")' : 'button:text-is("다음 문제")'); }
  await C.waitForSelector('.rank-box .result-big', { timeout: 20000 });
  console.log('late C rank:', await C.textContent('.rank-box .result-big'), '|', await C.$$eval('.rank-box tbody tr', (r) => r.map((x) => x.textContent)));
  // 4) 빨리 맞히기 팀전
  await A.click('button:text-is("온라인 방 만들기")').catch(async () => { await A.click('button:text-is("온라인 대결")'); await A.click('button:text-is("온라인 방 만들기")'); });
  await A.waitForSelector('.lobby .code-tiles'); const code2 = await A.getAttribute('.lobby .code-tiles', 'data-code');
  await A.click('button:text-is("팀전")');
  await B.goto(URL + '#nemo'); await B.tap('button:text-is("온라인 대결")'); await B.fill('#nemo-code', code2); await B.tap('button:text-is("참가하기")');
  await A.waitForFunction(() => document.querySelectorAll('.seats .seat:not(.empty)').length === 2, null, { timeout: 15000 });
  await A.click('button:text-is("+ 컴퓨터")'); await A.click('button:text-is("+ 컴퓨터")');
  await A.waitForFunction(() => document.querySelectorAll('.seats .seat:not(.empty)').length === 4);
  console.log('teams:', await A.$$eval('.seats .seat:not(.empty)', (s) => s.map((x) => x.querySelector('.seat-name').textContent + ':' + (x.querySelector('.team-btn,.team-tag')?.textContent || '-'))));
  await A.click('.seg-btn:text("3판")');
  await A.screenshot({ path: SHOT + '/team-lobby.png', fullPage: true });
  await A.click('button:text-is("게임 시작")');
  const bTeam = await B.evaluate(() => 0);
  await answer(B, '#nemo-race-ans');
  await A.waitForSelector('.result-box', { timeout: 15000 });
  console.log('team round:', await A.textContent('.result-box .result-big'), '| head:', (await A.textContent('.q-head')).replace(/\s+/g, ' '));
  console.log('errors', errs.length ? errs : 'none');
  await b.close();
})();
