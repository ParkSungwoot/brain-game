const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const SHOTS = require('os').tmpdir() + '/bgr-shots/';
const srv = http.createServer((q, r) => { r.setHeader('content-type','text/html; charset=utf-8'); r.end(fs.readFileSync(path.join(__dirname, '../dist/preview.html'))); }).listen(8765);
const URL = 'http://localhost:8765/';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const A = await ctx.newPage(), B = await ctx.newPage();
  for (const [n, p] of [['A', A], ['B', B]]) { p.on('pageerror', e => console.log(n, 'pageerror', e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(n, m.type(), m.text()); }); }

  // ---- heavy ----
  await A.goto(URL + '#heavy'); await B.goto(URL + '#heavy');
  await A.fill('#heavy-nick', '호스트'); await A.click('button:has-text("온라인 방 만들기")');
  await A.waitForSelector('.lobby .code-tiles');
  const code = (await A.getAttribute('.lobby .code-tiles', 'data-code')).trim();
  console.log('code', code);
  await B.fill('#heavy-nick', '게스트'); await B.fill('#heavy-code', code); await B.click('button:has-text("참가하기")');
  await A.waitForFunction(() => document.querySelectorAll('.seats .seat:not(.empty)').length === 2, null, { timeout: 8000 });
  console.log('A lobby:', await A.$$eval('.seats .seat-name', e => e.map(x => x.textContent)));
  await B.waitForSelector('.seats .seat-name'); console.log('B lobby:', await B.$$eval('.seats .seat-name', e => e.map(x => x.textContent)));
  await A.click('button:has-text("+ 컴퓨터")');
  await A.click('button:has-text("게임 시작")');
  await B.waitForSelector('.cards-row', { timeout: 8000 });
  await B.click('.card:text("5")'); await B.click('.chip.c1'); await B.click('.hand .btn.primary');
  await A.click('.card:text("2")'); await A.click('.chip.c2'); await A.click('.hand .btn.primary');
  // 놓기 단계: 각자 차례가 오면 놓기
  for (let i = 0; i < 20; i++) {
    for (const p of [A, B]) { const t = await p.$('.hand.turn .btn.primary, .hand.turn .btn.danger'); if (t) await t.click().catch(()=>{}); }
    await A.waitForTimeout(400);
    const head = await B.textContent('.hv-head');
    if (head.includes('라운드 2')) break;
  }
  console.log('B head:', await B.textContent('.hv-head'));
  console.log('A peds:', await A.$$eval('.ped-sum', e => e.map(x => x.textContent)), 'B peds:', await B.$$eval('.ped-sum', e => e.map(x => x.textContent)));
  await B.screenshot({ path: SHOTS + 'online-heavy-guest.png' });
  await A.click('.mp-bar button:has-text("나가기")');
  await B.waitForSelector('text=방장이 방을 나갔어요', { timeout: 8000 }).then(() => console.log('B saw host left')).catch(() => console.log('B did NOT see host left'));

  // ---- signal duel ----
  await A.goto(URL + '#signal'); await B.goto(URL + '#signal');
  await A.click('.seg-btn:text("1:1 온라인")'); await B.click('.seg-btn:text("1:1 온라인")');
  await A.click('button:has-text("온라인 방 만들기")'); await A.waitForSelector('.lobby .code-tiles');
  const code2 = (await A.getAttribute('.lobby .code-tiles', 'data-code')).trim();
  await B.fill('#signal-code', code2); await B.click('button:has-text("참가하기")');
  await A.waitForFunction(() => document.querySelectorAll('.seats .seat:not(.empty)').length === 2, null, { timeout: 8000 });
  await A.click('.seg-btn:text("7칸")');
  await A.click('button:has-text("게임 시작")');
  await B.waitForSelector('.kbd', { timeout: 8000 });
  const typeEq = async (p, s) => { for (const k of s) await p.keyboard.press(k === '*' ? 'x' : k); await p.keyboard.press('Enter'); await p.waitForTimeout(250); };
  await typeEq(A, '12+5=17'); await typeEq(B, '6*7=42'); // B 6칸 → 오류여야 함
  await B.waitForTimeout(300);
  console.log('B status after short eq:', await B.textContent('.panel .status'));
  for (let i = 0; i < 6; i++) await B.keyboard.press('Backspace');
  await typeEq(B, '9*9=81'.replace('=', '=') + ''); // still 6
  for (let i = 0; i < 6; i++) await B.keyboard.press('Backspace');
  await typeEq(B, '8*9=72'); for (let i = 0; i < 6; i++) await B.keyboard.press('Backspace');
  await typeEq(B, '50-8=42');
  await A.waitForSelector('.duel-grid', { timeout: 8000 });
  await typeEq(A, '50-8=42'); await typeEq(B, '13+4=17');
  await A.waitForTimeout(1200);
  console.log('A result:', await A.textContent('.result-box').catch(() => 'no result'));
  console.log('B result:', await B.textContent('.result-box').catch(() => 'no result'));
  await B.screenshot({ path: SHOTS + 'online-signal-guest.png', fullPage: true });
  console.log('B guide tab:', await B.textContent('#tab-guide'));
  console.log('A announce:', await A.textContent('.announce').catch(() => 'NONE'));
  console.log('B announce:', await B.textContent('.announce').catch(() => 'NONE'));

  // ---- wall online ----
  await A.goto(URL + '#wall'); await B.goto(URL + '#wall');
  await A.click('button:has-text("온라인 방 만들기")'); await A.waitForSelector('.lobby .code-tiles');
  const code3 = (await A.getAttribute('.lobby .code-tiles', 'data-code')).trim();
  await B.fill('#wall-code', code3); await B.click('button:has-text("참가하기")');
  await A.waitForFunction(() => document.querySelectorAll('.seats .seat:not(.empty)').length === 2, null, { timeout: 8000 });
  await A.click('button:has-text("게임 시작")');
  await B.waitForSelector('.wl-board');
  // 선 플레이어는 무작위: 차례인 쪽이 빈 칸에 사각 말을 놓음
  for (const k of [24, 10, 38, 22]) { const who = /^내 차례/.test(await A.textContent('.wl-msg')) ? A : B; await who.click('.wl-cell >> nth=' + k); await who.waitForTimeout(500); }
  console.log('A msg:', await A.textContent('.wl-msg'), '| B msg:', await B.textContent('.wl-msg'));
  console.log('B msg after placement:', await B.textContent('.wl-msg'), 'pieces on B:', await B.$$eval('.wl-board .piece', e => e.length));
  await B.screenshot({ path: SHOTS + 'online-wall-guest.png' });
  await browser.close(); srv.close();
})();
