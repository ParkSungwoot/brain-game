// 카드 장기 화면 점검: 컴퓨터와 1:1 (카드 배치 → 이동), 2명 온라인(같은 브라우저 탭)
const { chromium, devices } = require('playwright');
const URL = 'file://' + __dirname + '/../dist/preview.html';
const OUT = process.argv[2] || require('os').tmpdir();
async function arrange(p) {
  const n = await p.$$eval('.jg-slots .jg-card', (e) => e.length);
  for (let k = 0; k < n; k++) await p.click('.jg-hand button.jg-card >> nth=0');
  await p.click('button:text-is("배치 확정")');
  return n;
}
async function moveOnce(p) {
  await p.click('.jg-board .jg-cell.can >> nth=0');
  await p.click('.jg-board .jg-cell.dest >> nth=0');
}
(async () => {
  const b = await chromium.launch(); const errs = [];
  const m = await (await b.newContext({ ...devices['iPhone 13'] })).newPage(); m.on('pageerror', (e) => errs.push(e.message));
  await m.goto(URL + '#jang'); await m.tap('button:has-text("바로 시작")'); await m.tap('button:has-text("게임 시작")');
  await m.waitForSelector('.jg-slots', { timeout: 8000 });
  const n = await arrange(m);
  console.log('내 첫 배치 장 수:', n, '(선이면 5, 후공이면 4)');
  await m.waitForSelector('.jg-seq', { timeout: 8000 });
  for (let t = 0; t < 3; t++) {
    await m.waitForFunction(() => /내 차례|다시 배치|라운드|최종/.test(document.querySelector('.jg-side')?.textContent || document.body.textContent), null, { timeout: 15000 });
    if (await m.$('.jg-slots')) { console.log('재배치 화면'); await arrange(m); continue; }
    if (await m.$('.result-box')) break;
    if (!(await m.$('.jg-board .jg-cell.can'))) { await m.waitForTimeout(1500); continue; }
    await moveOnce(m); await m.waitForTimeout(400);
  }
  console.log('상태:', (await m.textContent('.jg-side .status')).slice(0, 60), '| 공개 카드', await m.$$eval('.jg-seq .jg-card.cur b', (e) => e.map((x) => x.textContent).join(' / ')));
  console.log('overflow', await m.evaluate(() => document.documentElement.scrollWidth));
  await m.screenshot({ path: OUT + '/jang-m.png', fullPage: true });
  // 온라인 2명
  const ctx = await b.newContext({ viewport: { width: 1000, height: 1000 } });
  const A = await ctx.newPage(), B = await ctx.newPage();
  for (const p of [A, B]) p.on('pageerror', (e) => errs.push(e.message));
  await A.goto(URL + '#jang'); await B.goto(URL + '#jang');
  await A.click('button:has-text("온라인 방 만들기")'); await A.waitForSelector('.lobby .code-tiles');
  const code = await A.getAttribute('.lobby .code-tiles', 'data-code');
  await B.fill('#jang-code', code); await B.click('button:has-text("참가하기")');
  await A.waitForFunction(() => document.querySelectorAll('.seats .seat:not(.empty)').length === 2, null, { timeout: 8000 });
  await A.click('button:has-text("게임 시작")'); await B.waitForSelector('.jg-slots');
  const na = await arrange(A), nb = await arrange(B);
  console.log('온라인 배치: A', na, '장, B', nb, '장');
  await A.waitForTimeout(600);
  const who = (await A.$('.jg-board .jg-cell.can')) ? A : B;
  await moveOnce(who); await A.waitForTimeout(700);
  console.log('A 기록:', await A.$$eval('.hv-log li', (e) => e.map((x) => x.textContent).join(' | ')));
  console.log('B 내 남은 카드(내 것만 보임):', await B.$$eval('.jg-seq', (e) => e.map((x) => x.querySelectorAll('.jg-card.secret').length).join(',')));
  await A.screenshot({ path: OUT + '/jang-a.png', fullPage: true });
  console.log('errors', errs.length ? errs : 'none');
  await b.close();
})();
