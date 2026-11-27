// 동시 접속 100명 초과 안내 (에뮬레이터 필요): DB 포트를 막아 101번째 접속자를 흉내 → 안내·컴퓨터와 하기·저장 멈춤 없음
// 그 다음 정상 연결에서 이 기기에만 남은 오늘의 문제 기록이 자동으로 올라가는지
const { chromium, devices } = require('playwright');
const SITE = 'http://127.0.0.1:8791/';
const OUT = process.argv[2] || require('os').tmpdir();
let bad = 0; const check = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const emu = (dbPort) => (port) => { window.App = Object.assign(window.App || {}, { FIREBASE_EMU: { host: '127.0.0.1', authPort: 9099, dbPort: port } }); };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const A = await b.newContext({ ...devices['iPhone 13'] });
  await A.addInitScript(emu(), 9999);
  const p = await A.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  // 1) 첫 화면 안내
  await p.goto(SITE); 
  await p.waitForSelector('.online-count.down', { timeout: 20000 }).catch(() => {});
  const home = await p.textContent('.online-count').catch(() => '');
  check(/가득/.test(home) && /혼자 연습과 컴퓨터와 대결은 그대로/.test(home), '첫 화면: ' + home.trim());
  await p.screenshot({ path: OUT + '/full-home2.png' });
  // 2) 온라인 방 만들기 → 가득 참 화면 → 컴퓨터와 하기
  await p.goto(SITE + '#heavy'); await p.waitForTimeout(800);
  const note = await p.textContent('.mp-choose .note:last-child');
  check(/혼자 연습과 컴퓨터와 대결/.test(note), '고르기 화면 안내: ' + note.slice(0, 50));
  const t0 = Date.now();
  await p.tap('button:has-text("온라인 방 만들기")');
  await p.waitForSelector('.full-msg', { timeout: 25000 }).catch(() => {});
  const full = await p.textContent('.mp').catch(() => '');
  check(/가득/.test(full), '방 만들기 → ' + Math.round((Date.now() - t0) / 1000) + '초 뒤 안내: ' + full.slice(0, 70));
  await p.screenshot({ path: OUT + '/full-room2.png', fullPage: true });
  await p.tap('.full-msg button:has-text("컴퓨터")');
  await p.waitForSelector('button:has-text("게임 시작")', { timeout: 5000 });
  check(true, '가득 참 화면에서 「컴퓨터 5명과 하기」로 바로 시작');
  // 3) 오늘의 문제: 안내 + 끝까지 풀어도 저장에서 멈추지 않음
  await p.goto(SITE + '#cubes'); await p.waitForTimeout(500);
  await p.tap('.seg-btn:has-text("오늘의 문제")');
  await p.waitForFunction(() => /가득|인터넷/.test(document.querySelector('.room-made')?.textContent || ''), null, { timeout: 25000 }).catch(() => {});
  check(/가득/.test(await p.textContent('.room-made')), '오늘의 문제 참가 현황 자리 안내');
  await p.tap('button:has-text("시작하기")');
  for (let i = 0; i < 5; i++) {
    await p.tap('button:has-text("포기하고 정답 보기")');
    await p.tap(i < 4 ? 'button:has-text("다음 문제")' : 'button:has-text("결과 보기")');
  }
  const t1 = Date.now();
  await p.waitForSelector('.rank-box .warn-note', { timeout: 40000 }).catch(() => {});
  const rb = await p.textContent('.rank-box').catch(() => '');
  check(/가득/.test(rb) && /이 기기에 저장/.test(rb) && /\/ 5 정답/.test(rb), Math.round((Date.now() - t1) / 1000) + '초 만에 결과 화면(내 점수 포함): ' + rb.slice(0, 90));
  // 컴퓨터 상대가 없는 1:1 온라인(수식 신호등)은 혼자 풀기만 안내
  await p.goto(SITE + '#signal'); await p.waitForTimeout(500);
  await p.tap('.seg-btn:has-text("1:1 온라인")'); await p.waitForTimeout(1500);
  const sn = await p.textContent('.mp-choose .note:last-child').catch(() => '');
  check(/혼자 연습\(혼자 풀기\)/.test(sn) && !/컴퓨터와 대결/.test(sn), '수식 신호등 1:1 안내: ' + sn.slice(-40));
  await p.screenshot({ path: OUT + '/full-daily2.png', fullPage: true });
  const ls = await p.evaluate(() => Object.assign({}, localStorage));
  // 4) 정상 연결된 다른 기기 흉내: 같은 저장값으로 열면 기록이 서버에 올라감
  const B = await b.newContext({ viewport: { width: 1000, height: 900 } });
  await B.addInitScript(emu(), 9000);
  await B.addInitScript((kv) => { for (const k in kv) if (!localStorage.getItem(k)) localStorage.setItem(k, kv[k]); }, ls);
  const q = await B.newPage(); q.on('pageerror', (e) => errs.push('B ' + e.message));
  await q.goto(SITE); await q.waitForSelector('.online-count:not([hidden])', { timeout: 20000 }).catch(() => {});
  const home2 = await q.textContent('.online-count').catch(() => '');
  check(/동시 접속자/.test(home2) && !/가득 차서/.test(home2), '정상 연결 첫 화면: ' + home2.trim());
  await q.goto(SITE + '#cubes'); await q.waitForTimeout(400);
  await q.click('.seg-btn:has-text("오늘의 문제")');
  await q.waitForFunction(() => /명 중/.test(document.querySelector('.rank-box')?.textContent || ''), null, { timeout: 25000 }).catch(() => {});
  check(/명 중 \d+위/.test(await q.textContent('.rank-box').catch(() => '')) && !!(await q.$('.rank-box tr.me')), '연결되자 이 기기 기록 자동 업로드: ' + (await q.textContent('.rank-box .result-big').catch(() => '-')));
  // 5) 처음엔 DB 연결이 막혔다가 풀리면: 안내 → 저절로 다시 연결 → 이 기기 기록이 순위에 올라감
  const C = await b.newContext({ viewport: { width: 1000, height: 900 } });
  await C.addInitScript(emu(), 9000);
  let blocked = true;
  await C.routeWebSocket(/127\.0\.0\.1:9000/, (ws) => { if (!blocked) ws.connectToServer(); else ws.close(); });
  await C.route(/127\.0\.0\.1:9000/, (r) => (blocked ? r.abort() : r.continue()));
  const c = await C.newPage(); c.on('pageerror', (e) => errs.push('C ' + e.message));
  await c.goto(SITE + '#cubes'); await c.waitForTimeout(400);
  await c.click('.seg-btn:has-text("오늘의 문제")');
  await c.click('button:has-text("시작하기")');
  for (let i = 0; i < 5; i++) { await c.click('button:has-text("포기하고 정답 보기")'); await c.click(i < 4 ? 'button:has-text("다음 문제")' : 'button:has-text("결과 보기")'); }
  await c.waitForSelector('.rank-box .warn-note', { timeout: 40000 }).catch(() => {});
  check(/가득/.test(await c.textContent('.rank-box').catch(() => '')), '막힌 동안: 가득 참 안내');
  blocked = false; const t2 = Date.now();
  await c.waitForFunction(() => /명 중/.test(document.querySelector('.rank-box')?.textContent || ''), null, { timeout: 70000 }).catch(() => {});
  const back = await c.textContent('.rank-box .result-big').catch(() => '-');
  check(/명 중/.test(back), '연결이 풀리자 ' + Math.round((Date.now() - t2) / 1000) + '초 만에 저절로 순위 표시: ' + back);
  console.log('errors', errs.length ? errs : 'none');
  console.log(bad ? 'FAILED ' + bad : 'all ok');
  await b.close();
})();
