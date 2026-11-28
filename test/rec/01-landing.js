// 첫 화면에 들어와 스크롤을 내리며 게임들을 둘러보는 모습
const { record } = require('./rec');
record('01-landing', async (r) => {
  await r.go('');
  await r.page.waitForSelector('.online-count:not([hidden])', { timeout: 15000 }).catch(() => {});
  await r.page.evaluate(() => document.fonts && document.fonts.ready);
  await r.wait(400);
  await r.start();
  await r.wait(1800);                 // 배너와 제목을 잠깐 보여 줌
  await r.swipe(330, 1100);           // 소개 문구
  await r.wait(900);
  await r.swipe(420, 1200);           // 게임 카드 시작
  await r.wait(800);
  for (let i = 0; i < 5; i++) { await r.swipe(400, 1150); await r.wait(650); }  // 게임 카드 훑어보기
  await r.wait(700);
});
