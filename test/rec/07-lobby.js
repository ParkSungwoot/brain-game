// 로비: 닉네임을 적고 픽셀 캐릭터를 고른 뒤 온라인 방을 만들면, 내 자리에 내 캐릭터가 앉고
// 친구가 코드로 들어와 옆자리가 친구 캐릭터로 채워지는 모습 (무거운 13, 최대 7명)
const { record, SITE, H } = require('./rec');

record('07-lobby', async (r) => {
  const p = r.page;
  const docTop = (sel) => p.locator(sel).first().evaluate((el) => el.getBoundingClientRect().top + scrollY);
  const rect = (sel) => p.locator(sel).first().evaluate((el) => { const q = el.getBoundingClientRect(); return { top: q.top, bottom: q.bottom }; });
  const shape = (i) => p.locator('.av-picker .av-row:not(.colors) .av-opt').nth(i);
  const color = (i) => p.locator('.av-picker .av-row.colors .av-swatch').nth(i);
  const avName = () => p.evaluate(() => { const b = document.querySelector('.av-picker .av-name'); return b ? b.textContent : ''; });

  // ---------- 준비 (영상에 안 나옴) ----------
  // 처음 캐릭터는 무작위라서, 매번 같은 영상이 되게 「검정 정장」으로 시작
  await r.go('#heavy');
  await p.waitForSelector('#heavy-nick', { timeout: 15000 });
  await p.evaluate(() => App.avatar.setMine([0, 9]));
  await p.reload();
  await p.waitForLoadState('networkidle').catch(() => {});
  await p.waitForSelector('#heavy-nick', { timeout: 15000 });
  await p.waitForSelector('button:has-text("온라인 방 만들기"):not([disabled])', { timeout: 15000 });
  await p.waitForFunction(() => /방을 만들고 코드를 알려 주면/.test((document.querySelector('.mp-choose > .note') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
  await p.evaluate(() => document.fonts && document.fonts.ready);

  // 친구(녹화 안 됨): 같은 게임 페이지를 열고 이름·캐릭터를 정해 둠 (하늘 묶음머리)
  const F = await r.newFriend();
  await F.goto(SITE + '#heavy');
  await F.waitForSelector('#heavy-nick', { timeout: 15000 });
  await F.waitForSelector('button:has-text("참가하기"):not([disabled])', { timeout: 15000 });
  await F.evaluate(() => App.avatar.setMine([5, 5]));
  await F.fill('#heavy-nick', '친구');

  await p.evaluate(() => scrollTo(0, 0));
  await p.waitForTimeout(400);
  await r.start();

  // ---------- 녹화 ----------
  await r.wait(1000);                                   // 무거운 13 · 플레이 탭 · 빈 닉네임 · 내 캐릭터 「검정 정장」
  await r.tap('#heavy-nick');
  await r.wait(350);
  await r.type('도전자', 300);                          // 닉네임 입력
  await r.wait(800);

  await r.tap('.av-mine button:has-text("바꾸기")');   // 캐릭터 고르기 판 열기
  await p.waitForSelector('.av-mine .av-picker');
  await r.wait(500);
  {
    // 고르기 판 전체(모양·색 줄)가 화면 안에 들어오게. 닉네임 칸은 위에 남김
    const b = await rect('.av-mine .av-picker');
    const dy = Math.ceil(b.bottom - (H - 18));
    if (dy > 4) await r.swipe(dy, 700);
  }
  await r.wait(600);

  // 모양 둘러보기: 모자 → 로봇 → 고양이, 색 둘러보기: 하늘 → 분홍 → 주황
  const picks = [[shape, 2, 750], [shape, 12, 750], [shape, 13, 900], [color, 5, 700], [color, 8, 700], [color, 1, 1100]];
  for (const [kind, i, pause] of picks) {
    const before = await avName();
    await r.tap(kind(i));
    await p.waitForFunction((b) => { const n = document.querySelector('.av-picker .av-name'); return n && n.textContent !== b; }, before, { timeout: 3000 });
    await r.wait(pause);
  }
  const mine = await p.evaluate(() => App.avatar.mine());
  if (mine[0] !== 13 || mine[1] !== 1) throw new Error('캐릭터가 주황 고양이가 아님: ' + JSON.stringify(mine));

  await r.tap('.av-mine .av-picker button:has-text("닫기")');   // 닫기 → 한 줄로 「주황 고양이」
  await p.waitForSelector('.av-mine .av-mine-row');
  await r.wait(900);

  // 온라인 방 만들기
  await r.scrollTo('button:has-text("온라인 방 만들기")', 900);
  await r.wait(600);
  await r.tap('button:has-text("온라인 방 만들기")');
  await p.waitForSelector('.lobby .code-tiles', { timeout: 15000 });
  const code = (await p.getAttribute('.lobby .code-tiles', 'data-code')).trim();
  await r.wait(1600);                                   // 「✅ 방이 만들어졌어요!」 · 방 코드 4자리 · 자리 1 / 7

  // 친구가 코드를 넣고 참가하기 → 「🙋 친구님이 들어왔어요」, 자리 2 / 7
  // (사이트 문제: 들어왔어요 알림이 뜰 때 방장 화면이 맨 위로 튀어 올라감. 그래서 친구가 들어온 뒤에 내려 봄)
  await F.fill('#heavy-code', code);
  await F.click('button:has-text("참가하기")');
  await p.waitForFunction(() => document.querySelectorAll('.seats .seat:not(.empty)').length === 2, null, { timeout: 15000 });
  await r.wait(1100);

  // 방 코드와 자리 칸이 한 화면에 (위: 방 코드 줄·코드 칸, 아래: P1 나 · P2 친구)
  {
    const y = Math.round(await docTop('.mp-bar'));
    const dy = Math.round(y - 8 - (await p.evaluate(() => scrollY)));
    if (Math.abs(dy) > 4) await r.swipe(dy, 900);
  }
  // 알림이 사라지고 깨끗한 자리 칸에서 멈춤
  await p.waitForFunction(() => { const t = document.getElementById('toast'); return !t || t.hidden || !t.classList.contains('show'); }, null, { timeout: 5000 }).catch(() => {});
  await r.wait(1400);                                   // P1 주황 고양이 도전자(방장·나) · P2 하늘 묶음머리 친구
});
