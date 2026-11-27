const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const SHOTS = require('os').tmpdir() + '/bgr-shots/';
const srv = http.createServer((q, r) => { r.setHeader('content-type','text/html; charset=utf-8'); r.end(fs.readFileSync(path.join(__dirname, '../dist/preview.html'))); }).listen(8768);
const URL = 'http://localhost:8768/';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 1000 } });
  const errs = [];
  const A = await ctx.newPage(), B = await ctx.newPage();
  for (const [n, p] of [['A', A], ['B', B]]) p.on('pageerror', e => errs.push(n + ' ' + e.message));
  // home: title & cards
  await A.goto(URL); await A.waitForSelector('.gcard');
  console.log('cards:', await A.$$eval('.gname', e => e.map(x => x.textContent).join(', ')));
  console.log('eyebrow:', await A.textContent('.eyebrow'));
  await A.screenshot({ path: SHOTS + 'home3.png', clip: { x: 0, y: 0, width: 1000, height: 420 } });
  // online duel: A host, B guest
  await A.goto(URL + '#link'); await B.goto(URL + '#link');
  await A.fill('#link-nick', '현'); await A.click('button:has-text("온라인 방 만들기")'); await A.waitForSelector('.lobby .code-tiles');
  const code = (await A.getAttribute('.lobby .code-tiles', 'data-code')).trim();
  await B.fill('#link-nick', '장'); await B.fill('#link-code', code); await B.click('button:has-text("참가하기")');
  await A.waitForFunction(() => document.querySelectorAll('.seats .seat:not(.empty)').length === 2, null, { timeout: 8000 });
  await A.click('button:has-text("6×6")');
  await A.click('button:has-text("게임 시작")');
  await B.waitForSelector('.lk-board');
  // figure out who is first
  const firstIsA = await A.evaluate(() => !!document.querySelector('.lk-pool-btn:not([disabled])'));
  const P1 = firstIsA ? A : B, P2 = firstIsA ? B : A;
  console.log('first:', firstIsA ? 'A(host)' : 'B(guest)');
  // P1 places A at cell 0; P2 places A at cell 35 (far corner) ; then P1 places B at 5 ; P2 places B at 30 -> crossing? (A: 0-35 diagonal, B: 5-30 other diagonal) -> possible on open board.
  async function put(p, color, cell) { await p.click('.lk-pool-btn >> nth=' + color); await p.click('.lk-cell >> nth=' + cell); await p.waitForTimeout(500); }
  await put(P1, 0, 0); await put(P2, 0, 35); await put(P1, 1, 5); await put(P2, 1, 3);
  console.log('P1 msg:', await P1.textContent('.wl-msg'));
  // P1 calls impossible (wrong: it is possible) -> P2 must prove by drawing
  await P1.click('button:has-text("불가능 선언")'); await P2.waitForSelector('.lk-board.drawing', { timeout: 6000 });
  console.log('P2 proving msg:', await P2.textContent('.wl-msg'));
  // draw A: 0 -> right along top row? B at 5 blocks (0,5). Path for A: 0 down column0 to 30? 30 is B. Let's draw A: 0,6,7,8,9,10,16,22,28,34,35 ; B: 5,11,17,23,29... must avoid A's 10/16/22/28/34 -> B: 5,4,3? Let me compute: rows 6 cols. Use solver path instead via evaluate
  const proof = await P2.evaluate(() => { const st = document.querySelectorAll('.lk-cell'); return null; });
  const sol = await P2.evaluate(() => { const b = Array(36).fill(-1); b[0]=0; b[35]=0; b[5]=1; b[3]=1; const r = App.link.solve(6, b, 100000); return App.link.solutionToProof(6, b, r); });
  console.log('solution', JSON.stringify(sol));
  const box = await P2.$eval('.lk-board', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const center = (i) => ({ x: box.x + ((i % 6) + 0.5) * box.w / 6, y: box.y + (Math.floor(i / 6) + 0.5) * box.h / 6 });
  for (const [c, P] of sol) { const s0 = center(P[0]); await P2.mouse.move(s0.x, s0.y); await P2.mouse.down(); for (const x of P.slice(1)) { const p = center(x); await P2.mouse.move(p.x, p.y, { steps: 3 }); } await P2.mouse.up(); }
  await P2.screenshot({ path: SHOTS + 'link-proof.png', fullPage: true });
  await P2.click('button:has-text("증명 제출")');
  await P1.waitForSelector('.result-box', { timeout: 6000 });
  console.log('P1 result:', await P1.textContent('.result-box'));
  console.log('P2 result:', await P2.textContent('.result-box'));
  await P1.screenshot({ path: SHOTS + 'link-end.png', fullPage: true });
  // local vs computer quick check
  const C = await ctx.newPage(); C.on('pageerror', e => errs.push('C ' + e.message));
  await C.goto(URL + '#link'); await C.click('button:has-text("바로 시작")'); await C.click('button:has-text("게임 시작")');
  await C.waitForSelector('.lk-board'); await C.waitForTimeout(2500);
  if (await C.$('.lk-pool-btn:not([disabled])')) { await C.click('.lk-pool-btn:not([disabled]) >> nth=0'); await C.click('.lk-cell.open >> nth=10'); }
  await C.waitForTimeout(2500);
  console.log('local msg:', await C.textContent('.wl-msg'), '| moves pill', await C.textContent('.wl-head .pill'));
  await C.screenshot({ path: SHOTS + 'link-local.png', fullPage: true });
  // mobile
  const m = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();
  await m.goto(URL + '#link'); await m.click('button:has-text("바로 시작")'); await m.click('button:has-text("게임 시작")'); await m.waitForTimeout(1500);
  const o = await m.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  console.log('mobile', o.sw > o.cw ? 'OVERFLOW' : 'ok');
  await m.goto(URL); await m.waitForTimeout(500); await m.screenshot({ path: SHOTS + 'm-home3.png' });
  console.log('ERRORS', errs.length ? errs : 'none');
  await browser.close(); srv.close();
})();
