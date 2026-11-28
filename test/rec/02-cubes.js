// 큐브 세기: 혼자 연습에서 돌아가는 큐브 더미를 보고 개수를 맞히기 (두 문제, 두 번째는 더 빨리)
const { record } = require('./rec');

record('02-cubes', async (r) => {
  const page = r.page;
  const answer = () => page.evaluate(() => App.quick.lastPuzzle.answer);
  // 입력칸 + 답하기 버튼이 있는 문제 화면이 보이도록 (문제 머리 줄이 화면 위쪽에)
  const topOfPuzzle = () => page.evaluate(() => {
    const q = document.querySelector('#panel-play .q-head').getBoundingClientRect();
    return Math.round(q.top + scrollY - 12);
  });

  // ---------- 준비 (영상에 안 나옴) ----------
  await r.go('#cubes');
  await page.waitForSelector('#cubes-ans', { timeout: 15000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  // 처음 한 문제를 맞히면 뜨는 "공략이 열렸어요" 알림이 녹화 중 결과를 가리지 않도록, 녹화 전에 한 문제를 풀어 둠
  await r.tap('#cubes-ans');
  await r.type(String(await answer()), 30);
  await r.tap('#panel-play .ans-row .btn');
  await page.waitForSelector('#panel-play .result-box.ok', { timeout: 5000 });
  await page.waitForFunction(() => { const t = document.getElementById('toast'); return !t || t.hidden; }, null, { timeout: 8000 });
  // 「처음부터」로 새 5문제 시작 (시계 0초부터)
  await r.tap(page.locator('#panel-play .toolbar button', { hasText: '처음부터' }));
  await page.waitForSelector('#cubes-ans', { timeout: 5000 });
  await page.evaluate((y) => window.scrollTo(0, y), await topOfPuzzle());
  await r.wait(700);                                  // 손가락 표시가 사라지고 그림이 한 번 그려질 때까지
  await r.start();

  // ---------- 1번 문제: 천천히 생각하고 풀기 ----------
  await r.wait(3000);                                 // 돌아가는 큐브를 보며 세는 중
  const a1 = String(await answer());
  await r.tap('#cubes-ans', { after: 350 });
  await r.type(a1, 230);
  await r.wait(450);
  await r.tap('#panel-play .ans-row .btn');           // 답하기
  await page.waitForSelector('#panel-play .result-box.ok');
  await r.wait(900);                                  // 아래쪽에 초록 "정답" 상자가 나타남
  await r.scrollTo('#panel-play .result-box', 900);   // 결과(높이 지도 해설)와 다음 문제 버튼
  await r.wait(1300);
  await r.tap(page.locator('#panel-play .result-box .btn.primary'));   // 다음 문제
  await page.waitForSelector('#cubes-ans');
  await r.wait(350);
  // 새 문제가 그려지면 문제 머리 줄(문제 2 / 5)까지 살짝 올려 봄
  {
    const dy = (await topOfPuzzle()) - (await page.evaluate(() => scrollY));
    if (Math.abs(dy) > 4) await r.swipe(dy, 550);
  }

  // ---------- 2번 문제: 조금 더 빨리 ----------
  await r.wait(700);                                  // 이번엔 금방 셈
  const a2 = String(await answer());
  await r.tap('#cubes-ans', { after: 220 });
  await r.type(a2, 150);
  await r.wait(280);
  await r.tap('#panel-play .ans-row .btn');
  await page.waitForSelector('#panel-play .result-box.ok');
  await r.wait(700);
  await r.scrollTo('#panel-play .result-box', 850);
  await r.wait(1300);                                 // 정답 결과에서 멈춤
});
