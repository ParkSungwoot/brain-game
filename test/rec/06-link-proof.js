// 컬러 링크 — 증명 장면: 온라인 방에서 내가 마지막으로 말 2개를 놓자 상대가 「불가능 선언」,
// 판 위의 모든 색을 겹치지 않는 6칸 이상 길로 손가락으로 끌어 이어 보이고 증명에 성공하는 모습
//
// 판 (7×7, 빈 판으로 시작). 빨강 A 와 초록 B 가 X 자로 엇갈려 보여 「불가능!」 같지만,
// A 는 가운데 줄로, B 는 판 바깥쪽(오른쪽 → 아래)으로 크게 돌아가면 이어짐
//
//      0 1 2 3 4 5 6
//   0  . . . . . . .
//   1  . A c c c B b        A: 빨강 (1,1)-(5,5)   a: A 길
//   2  . a C . c C b        B: 초록 (1,5)-(5,1)   b: B 길
//   3  . a a a a a b        C: 노랑 (2,2)-(2,5)   c: C 길 (상대가 먼저일 때만)
//   4  . . D d d a b        D: 파랑 (4,2) 한 개   d: D 길 → (5,2) 에 짝이 놓임
//   5  . B d d d A b
//   6  . b b b b b b
const { record, SITE, W, H } = require('./rec');

const N = 7;
const I = (r, c) => r * N + c;
const A = 0, B = 1, C = 2, D = 3;
const COL = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8'];   // link.js 의 A~D 색 (그려진 길 확인용)
const PATH = {
  [A]: [[1, 1], [2, 1], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [4, 5], [5, 5]],
  [B]: [[1, 5], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6], [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [5, 1]],
  [C]: [[2, 2], [1, 2], [1, 3], [1, 4], [2, 4], [2, 5]],
  [D]: [[4, 2], [4, 3], [4, 4], [5, 4], [5, 3], [5, 2]],
};
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

record('06-link-proof', async (r) => {
  const p = r.page;
  // 규칙·공략 탭의 움직이는 그림에도 lk-board 가 있으므로 플레이 화면 안으로 한정
  const G = '#panel-play .mp ';
  const cellSel = (i) => `${G}.lk-board .lk-cell[data-i="${i}"]`;
  const poolSel = (c) => `${G}.lk-pool .lk-pool-btn >> nth=${c}`;
  const moves = (pg) => pg.evaluate(() => {
    const t = [...document.querySelectorAll('.wl-head .pill')].map((x) => x.textContent).join(' ');
    const m = /놓인 말 (\d+)/.exec(t);
    return m ? +m[1] : -1;
  });
  const waitMoves = (pg, n) => pg.waitForFunction((n) => {
    const t = [...document.querySelectorAll('.wl-head .pill')].map((x) => x.textContent).join(' ');
    const m = /놓인 말 (\d+)/.exec(t);
    return m && +m[1] === n;
  }, n, { timeout: 15000 });
  // 녹화 전 준비용 (영상에 안 들어감): 색 고르고 칸 누르기
  const put = async (pg, c, i) => {
    const n = await moves(pg);
    await pg.click(poolSel(c));
    await pg.click(cellSel(i));
    await waitMoves(pg, n + 1);
    await pg.waitForTimeout(250);
  };
  const rect = (sel) => p.locator(sel).first().evaluate((el) => { const q = el.getBoundingClientRect(); return { top: q.top, bottom: q.bottom }; });

  // ---- 녹화 전 준비: 방 만들기 → 친구 참가 → 게임 시작 → 앞 수순 ----
  await r.go('#link');
  await p.waitForSelector('#link-nick', { timeout: 15000 });
  await p.evaluate(() => document.fonts && document.fonts.ready);
  await p.fill('#link-nick', '하늘');
  await p.waitForSelector('button:has-text("온라인 방 만들기"):not([disabled])', { timeout: 15000 });
  await p.click('button:has-text("온라인 방 만들기")');
  await p.waitForSelector('.lobby .code-tiles', { timeout: 15000 });
  const code = (await p.getAttribute('.lobby .code-tiles', 'data-code')).trim();

  const F = await r.newFriend();
  await F.goto(SITE + '#link');
  await F.waitForSelector('#link-nick', { timeout: 15000 });
  await F.fill('#link-nick', '바다');
  await F.waitForSelector('button:has-text("참가하기"):not([disabled])', { timeout: 15000 });
  await F.fill('#link-code', code);
  await F.click('button:has-text("참가하기")');
  await p.waitForFunction(() => document.querySelectorAll('.seats .seat:not(.empty)').length === 2, null, { timeout: 15000 });

  await p.click('.seg-btn:has-text("빈 판으로")');      // 검은·흰 말 없이 빈 판
  await p.waitForTimeout(300);
  await p.click('button:has-text("게임 시작")');
  await p.waitForSelector(G + '.lk-board', { timeout: 15000 });
  await F.waitForSelector(G + '.lk-board', { timeout: 15000 });
  await p.waitForTimeout(500);
  const meFirst = await p.evaluate(() => !!document.querySelector('.lk-pool-btn:not([disabled])'));

  // 누가 먼저인지에 따라 앞 수순 (모두 녹화 전). 녹화는 내가 마지막 2개(B, D)를 놓는 차례부터
  let colors;
  if (meFirst) {
    // 나 A │ 상대 A, B │ (녹화) 나 B, D
    colors = [A, B, D];
    await put(p, A, I(1, 1));
    await waitMoves(F, 1); await F.waitForSelector('.lk-pool-btn:not([disabled])');
    await put(F, A, I(5, 5)); await put(F, B, I(1, 5));
    await waitMoves(p, 3);
  } else {
    // 상대 A │ 나 A, C │ 상대 C, B │ (녹화) 나 B, D
    colors = [A, B, C, D];
    await F.waitForSelector('.lk-pool-btn:not([disabled])');
    await put(F, A, I(1, 1));
    await waitMoves(p, 1); await p.waitForSelector('.lk-pool-btn:not([disabled])');
    await put(p, A, I(5, 5)); await put(p, C, I(2, 2));
    await waitMoves(F, 3); await F.waitForSelector('.lk-pool-btn:not([disabled])');
    await put(F, C, I(2, 5)); await put(F, B, I(1, 5));
    await waitMoves(p, 5);
  }
  await p.waitForSelector('.lk-pool-btn:not([disabled])');
  const total = await moves(p);

  // 계획한 길이 실제 규칙(App.link.checkProof)으로도 맞는지 확인 (읽기만)
  const plan = colors.map((c) => [c, PATH[c].map(([y, x]) => I(y, x))]);
  const bad = await p.evaluate(([plan, N]) => {
    const b = Array(N * N).fill(-1);
    for (const [c, P] of plan) { b[P[0]] = c; if (c !== 3) b[P[P.length - 1]] = c; }
    return App.link.checkProof(N, b, plan);
  }, [plan, N]);
  if (bad) throw new Error('계획한 길이 틀림: ' + bad);

  // 들어왔어요 알림이 사라질 때까지
  await p.waitForFunction(() => { const t = document.getElementById('toast'); return !t || t.hidden || !t.offsetParent; }, null, { timeout: 10000 }).catch(() => {});
  // 두 사람 이름·남은 시간 · 안내 문구 · 판 · 남은 말이 한 화면에
  const headTop = await p.evaluate(() => document.querySelector('.wl-head').getBoundingClientRect().top + scrollY);
  await p.evaluate((y) => scrollTo(0, y), Math.round(headTop - 8));
  // 준비 중 마우스로 누른 자리에 칸 강조(hover)가 남지 않게, 마우스는 화면 오른쪽 여백으로
  await p.mouse.move(W - 3, Math.round(H / 2));
  await p.waitForTimeout(600);
  await r.start();

  // ---- 녹화 ----
  await r.wait(1100);                                    // 판 위 말들, 「서로 다른 색 말 2개를 놓으세요 (1/2)」
  await r.tap(poolSel(B)); await r.wait(550);           // 초록 B 고르기
  await r.tap(cellSel(I(5, 1)));                         // B 를 왼쪽 아래에 → 빨강 A 와 X 자로 엇갈림
  await waitMoves(p, total + 1);
  await r.wait(800);
  await r.tap(poolSel(D)); await r.wait(550);           // 파랑 D 고르기
  await r.tap(cellSel(I(4, 2)));                         // D 를 엇갈린 곳 안쪽에
  await waitMoves(p, total + 2);

  // 상대가 판을 보고 잠깐 고민하다가 「불가능 선언」
  await F.waitForSelector('button:has-text("불가능 선언")', { timeout: 10000 });
  await sleep(1100);
  await F.click('button:has-text("불가능 선언")');
  await p.waitForSelector(G + '.lk-board.drawing', { timeout: 10000 });
  await r.wait(1700);                                    // 「불가능 선언을 받았어요! 5분 안에 …」, 내 이름 옆 5:00
  {
    const b = await rect(G + '.lk-board');
    if (b.bottom > H - 10) await r.swipe(Math.ceil(b.bottom - H + 24), 600);
  }

  // 색마다 말에서 시작해 이웃 칸을 따라 끌기
  for (const c of colors) {
    const pts = [];
    for (const [y, x] of PATH[c]) pts.push(await r.center(cellSel(I(y, x))));
    await r.drag([pts[0], ...pts], PATH[c].length > 9 ? 150 : 175);
    // 그 색 길이 끝까지 그려졌는지 확인 (읽기만)
    await p.waitForFunction(([sel, color, n]) => [...document.querySelectorAll(sel)].some((pl) => pl.getAttribute('stroke') === color && pl.getAttribute('points').split(' ').length === n),
      [G + '.lk-paths polyline', COL[c], PATH[c].length], { timeout: 3000 });
    await r.wait(c === D ? 900 : 650);
  }

  // 증명 제출
  {
    const b = await rect('button:has-text("증명 제출")');
    if (b.bottom > H - 40) await r.swipe(Math.ceil(b.bottom - H + 70), 700);
    await r.wait(350);
  }
  await r.tap('button:has-text("증명 제출")');
  await p.waitForSelector(G + '.result-box', { timeout: 10000 });
  await r.wait(900);
  // 「놓인 말」 · 「라운드 1 끝」 · 판(증명한 길) · 결과 상자 「라운드 1: 하늘 +1점」이 한 화면에
  {
    const pill = (await rect(G + '.wl-head .pill:last-child')).top;
    const bottom = (await rect(G + '.result-box')).bottom;
    let dy = Math.round(pill - 8);
    if (bottom - dy > H - 12) dy = Math.round(bottom - (H - 16));
    if (Math.abs(dy) > 6) await r.swipe(dy, 800);
  }
  await r.wait(1500);
});
