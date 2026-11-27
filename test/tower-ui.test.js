// 수식의 탑 화면 점검: 컴퓨터와 하기(모바일) → 버저 → 추가 제시 → 도전, 2명 온라인
const { chromium, devices } = require('playwright');
const URL = 'file://' + __dirname + '/../dist/preview.html';
const OUT = process.argv[2] || require('os').tmpdir();
// 화면의 탑 상태로 최단 풀이를 구해 그대로 눌러 보기
async function solveAndPlay(p) {
  const path = await p.evaluate(() => {
    const el = document.querySelector('.tower-game .towers, .mp .towers');
    const B = App.tower.decodeBlocks(el.dataset.b), T = JSON.parse(el.dataset.t);
    const [v, hh] = el.dataset.goal.split('@').map(Number);
    return App.towerCore.solve(B, T, { v, h: hh }, 6);
  });
  for (const m of path) {
    const tg = await p.$('.tw-bar .toggle');
    const on = (await tg.getAttribute('aria-pressed')) === 'true';
    if (on !== m.flip) await tg.click();
    await p.click(`.towers .tw-col:nth-child(${m.f + 1}) .tw-stack .tile:nth-child(${m.k})`);
    if (m.f === m.t) await p.click('button:has-text("제자리 뒤집기")');
    else await p.click(`.towers .tw-col:nth-child(${m.t + 1}) .tw-label`);
    await p.waitForTimeout(250);
  }
  return path.length;
}
(async () => {
  const b = await chromium.launch(); const errs = [];
  const m = await (await b.newContext({ ...devices['iPhone 13'] })).newPage(); m.on('pageerror', (e) => errs.push(e.message));
  await m.goto(URL + '#tower');
  await m.waitForSelector('.seg-btn:has-text("대결")');
  console.log('탭:', await m.$$eval('[role=tablist] .seg-btn', (e) => e.map((x) => x.textContent).join(' | ')));
  await m.tap('button:has-text("바로 시작")');
  await m.tap('.seg-btn:has-text("쉬움 (2~3번)")').catch(() => {});
  await m.tap('.toolbar .seg-btn:text-is("쉬움")').catch(() => {});
  await m.tap('button:has-text("게임 시작")');
  await m.waitForSelector('.btn.buzzer', { timeout: 10000 });
  console.log('목표:', await m.textContent('.goal-card'));
  await m.screenshot({ path: OUT + '/tower-buzz.png', fullPage: true });
  for (let i = 0; i < 6; i++) await m.tap('.stepper button[aria-label="하나 늘리기"]');
  await m.tap('.btn.buzzer');
  await m.waitForSelector('text=제시했어요', { timeout: 8000 });
  console.log('추가 제시 단계:', (await m.textContent('.declare')).slice(0, 80));
  await m.screenshot({ path: OUT + '/tower-under.png', fullPage: true });
  await m.waitForFunction(() => /도전/.test(document.querySelector('.status')?.textContent || ''), null, { timeout: 20000 });
  const st = await m.textContent('.status');
  console.log('도전 단계:', st.slice(0, 60));
  if (/내 도전/.test(st)) {
    await m.screenshot({ path: OUT + '/tower-try.png', fullPage: true });
    const n = await solveAndPlay(m);
    console.log('내가 둔 수:', n);
  }
  await m.waitForSelector('.result-box', { timeout: 30000 });
  console.log('결과:', (await m.textContent('.result-box .result-big')), '| 점수', await m.$$eval('.wl-score', (e) => e.map((x) => x.textContent).join(',')));
  await m.screenshot({ path: OUT + '/tower-result.png', fullPage: true });
  console.log('overflow', await m.evaluate(() => document.documentElement.scrollWidth));
  // 혼자 연습
  await m.tap('.seg-btn:has-text("혼자 연습")');
  await m.waitForSelector('.tower-game .goal-card');
  await m.tap('button:has-text("번 안에 도전")');
  const n2 = await solveAndPlay(m);
  await m.waitForSelector('.tower-game .result-box');
  console.log('혼자 연습:', n2, '수 →', await m.textContent('.tower-game .result-big'), '| overflow', await m.evaluate(() => document.documentElement.scrollWidth));
  await m.screenshot({ path: OUT + '/tower-solo.png', fullPage: true });

  // 온라인 2명 (같은 브라우저 탭)
  const ctx = await b.newContext({ viewport: { width: 1000, height: 1000 } });
  const A = await ctx.newPage(), Bp = await ctx.newPage();
  for (const p of [A, Bp]) p.on('pageerror', (e) => errs.push(e.message));
  await A.goto(URL + '#tower'); await Bp.goto(URL + '#tower');
  await A.click('button:has-text("온라인 방 만들기")'); await A.waitForSelector('.lobby .code-tiles');
  const code = await A.getAttribute('.lobby .code-tiles', 'data-code');
  await Bp.fill('#tower-code', code); await Bp.click('button:has-text("참가하기")');
  await A.waitForFunction(() => document.querySelectorAll('.seat.filled, .seat.on').length >= 2, null, { timeout: 15000 }).catch(() => {});
  await A.click('button:has-text("게임 시작")');
  await A.waitForSelector('.btn.buzzer', { timeout: 15000 }); await Bp.waitForSelector('.btn.buzzer', { timeout: 15000 });
  for (let i = 0; i < 3; i++) await A.click('.stepper button[aria-label="하나 늘리기"]');
  await A.click('.btn.buzzer');
  await Bp.waitForSelector('button:has-text("번으로 더 적게")', { timeout: 10000 });
  console.log('B 화면:', (await Bp.textContent('.declare .status')), '| A 화면:', (await A.textContent('.declare .note')).slice(0, 40));
  // B가 최단 수를 계산해서 부름
  const d = await Bp.evaluate(() => { const el = document.querySelector('.towers'); const [v, hh] = el.dataset.goal.split('@').map(Number); return App.towerCore.solve(App.tower.decodeBlocks(el.dataset.b), JSON.parse(el.dataset.t), { v, h: hh }, 6).length; });
  const cur = await Bp.$eval('.step-v', (e) => parseInt(e.textContent));
  for (let i = cur; i > d; i--) await Bp.click('.stepper button[aria-label="하나 줄이기"]');
  await Bp.click('button:has-text("번으로 더 적게")');
  await Bp.waitForSelector('text=내 도전', { timeout: 10000 });
  console.log('B 도전 (최단', d, '번) | A 화면:', (await A.textContent('.status')).slice(0, 40));
  await solveAndPlay(Bp);
  await A.waitForSelector('.result-box', { timeout: 10000 });
  console.log('A가 본 결과:', await A.textContent('.result-box .result-big'), '| 점수', await A.$$eval('.wl-score', (e) => e.map((x) => x.textContent).join(',')));
  await A.screenshot({ path: OUT + '/tower-online.png', fullPage: true });
  console.log('errors', errs.length ? errs : 'none');
  await b.close();
})();
