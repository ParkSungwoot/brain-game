// 「잘하는 방법」이 열리는 장면: 잠긴 탭 → 한 판 풀기 → "공략이 열렸어요!" → 열린 공략과 움직이는 설명 그림
const { record } = require('./rec');

record('08-guide-unlock', async (r) => {
  const page = r.page;
  const answer = () => page.evaluate(() => App.quick.lastPuzzle.answer);
  const scrollToY = async (y, ms) => { const dy = y - (await page.evaluate(() => scrollY)); if (Math.abs(dy) > 4) await r.swipe(dy, ms); };

  // ---------- 준비 (영상에 안 나옴) ----------
  await r.go('#cubes');
  await page.waitForSelector('#cubes-ans', { timeout: 15000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.evaluate(() => window.scrollTo(0, 0));
  await r.wait(600);
  await r.start();

  // ---------- 잠긴 탭 ----------
  await r.wait(1400);                                        // 제목과 「잘하는 방법 (잠김)」 탭
  await r.tap('#tab-guide', { after: 400 });                 // 잠긴 탭 누르기
  await page.waitForSelector('#panel-guide .locked');
  await r.wait(1900);                                        // "한 판을 끝까지 하면 열려요"
  await r.tap(page.locator('#panel-guide .locked .btn'));    // 플레이하러 가기
  await page.waitForSelector('#panel-play:not([hidden]) #cubes-ans');
  await r.wait(400);

  // ---------- 한 문제 풀기 ----------
  const qTop = await page.evaluate(() => Math.round(document.querySelector('#panel-play .q-head').getBoundingClientRect().top + scrollY - 10));
  await scrollToY(qTop, 900);                                // 문제와 답 칸이 한 화면에
  await r.wait(1500);                                        // 돌아가는 큐브를 보며 세는 중
  await r.tap('#cubes-ans', { after: 300 });
  await r.type(String(await answer()), 200);
  await r.wait(350);
  await r.tap('#panel-play .ans-row .btn');                  // 답하기
  await page.waitForSelector('#panel-play .result-box.ok');
  await r.wait(1700);                                        // 정답 + "공략이 열렸어요!" 알림

  // ---------- 열린 공략 ----------
  await scrollToY(0, 1000);                                  // 위로: 탭 이름이 「잘하는 방법」으로 바뀜
  await r.wait(1000);
  await r.tap('#tab-guide', { after: 500 });                 // 열린 탭 누르기
  await page.waitForSelector('#panel-guide h4');
  await r.wait(1600);                                        // 공략 첫 부분 읽기
  const demoTop = await page.evaluate(() => { const d = document.querySelector('#panel-guide .demo'); return d ? Math.round(d.getBoundingClientRect().top + scrollY - 120) : 0; });
  if (demoTop > 0) await scrollToY(demoTop, 1300);           // 움직이는 설명 그림까지
  await r.wait(3600);                                        // 설명 그림이 움직이는 모습
});
