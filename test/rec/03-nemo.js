// 네모 세기: 혼자 연습에서 판을 살펴보고 네모 개수를 입력해 맞힌 뒤, 정답 네모를 번호로 하나씩 눌러 보는 모습
const { record } = require('./rec');
record('03-nemo', async (r) => {
  const p = r.page;
  const puzzle = () => p.evaluate(() => { const z = App.quick.lastPuzzle; return { n: z.hits.length, target: z.target, neg: z.cells.some((v) => v < 0) }; });
  const topOf = (sel) => p.evaluate((s) => document.querySelector(s).getBoundingClientRect().top, sel);

  await r.go('#nemo');
  await p.waitForSelector('.nm-grid', { timeout: 15000 });
  await p.evaluate(() => document.fonts && document.fonts.ready);

  // ---- 녹화 전 준비 (영상에 안 들어감) ----
  // 한 번 해 본 사람처럼: 첫 문제를 풀어 공략을 열어 둠 → 녹화 중에 「공략이 열렸어요」 알림이 판을 가리지 않음
  await p.fill('#nemo-ans', String((await puzzle()).n));
  await p.click('.ans-row .btn.primary');
  await p.waitForSelector('.result-box.ok', { timeout: 5000 });
  await p.waitForFunction(() => { const t = document.getElementById('toast'); return !t || t.hidden; }, null, { timeout: 8000 }).catch(() => {});
  // 보여 주기 좋은 문제(정답 4~5개)가 나올 때까지 「처음부터」
  for (let i = 0; i < 80; i++) {
    await p.click('.toolbar button:has-text("처음부터")');
    await p.waitForTimeout(20);
    const z = await puzzle();
    if (z.n >= 4 && z.n <= 5 && !z.neg) break;
  }
  await p.evaluate(() => scrollTo(0, 0));
  await p.waitForTimeout(400);
  await r.start();

  // ---- 녹화 ----
  await r.wait(1100);                                   // 게임 제목·탭과 판 윗부분
  // 「혼자 연습」부터 답 입력칸까지 한 화면에
  await r.swipe((await topOf('.panel-play > .seg')) - 12, 1000);
  await r.wait(2300);                                   // 목표 합을 보고 판을 세는 시간

  const z = await puzzle();
  await r.tap('#nemo-ans');
  await r.wait(400);
  await r.type(String(z.n), 200);
  await r.wait(600);
  await r.tap('.ans-row .btn.primary');                // 답하기
  await p.waitForSelector('.result-box.ok', { timeout: 5000 });
  await r.wait(1200);                                   // 「0:0○ 만에 정답」

  // 문제 문장부터 「다음 문제」까지 한 화면에: 정답 네모를 번호로 하나씩 확인
  await r.swipe((await topOf('.q-prompt')) - 14, 900);
  await r.wait(900);
  const btns = p.locator('.nm-explain .row button');
  for (let i = 1; i < z.n; i++) {                       // 1번은 처음부터 켜져 있음 → 2번부터 끝까지
    await r.tap(btns.nth(i));
    await r.wait(850);
  }
  await r.wait(1250);
});
