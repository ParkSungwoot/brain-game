// 벽바둑 2: 컴퓨터 2명과 3인전. 원형 말·사각 말을 놓고, 말을 움직여 벽을 세우며
// 판 모서리 땅을 벽으로 둘러싸 내 영역(색칠된 칸 + 점수)으로 만드는 모습
const { record } = require('./rec');

// ---------- 화면에 그려진 판 읽기 + 수 고르기 (페이지 안에서 실행, 상태는 읽기만) ----------
// 모서리 직사각형(2×2 등)을 목표로, 내 말만 들어 있게 둘러쌀 수 있는 가장 짧은 수순을 찾음
function wallPlanner(arg) {
  const { N, legalMoves, score, think, walk } = App.wall;
  const me = 0;
  const read = () => {
    const cells = [...document.querySelectorAll('.wl-board .wl-cell')];
    let hw = '', vw = '';
    const pc = [[], [], []];
    cells.forEach((el, k) => {
      hw += el.querySelector(':scope > .w-h') ? '1' : '0';
      vw += el.querySelector(':scope > .w-v') ? '1' : '0';
      const p = el.querySelector('.piece');
      if (p) {
        const s = +((/--p(\d)/.exec(p.getAttribute('style') || '') || [0, 0])[1]);
        pc[s].push([Math.floor(k / N), k % N, p.classList.contains('sq') ? 'S' : 'C']);
      }
    });
    return { pc, hw, vw };
  };
  const st = read();
  const mk = (pc) => ({ rnd: 1, brk: [0, 0, 0], pc, hw: st.hw, vw: st.vw, seats: [0, 1, 2], ph: 'move' });
  const wkey = (r, c, d) => (d === 'U' ? 'h' + ((r - 1) * N + c) : d === 'D' ? 'h' + (r * N + c) : d === 'L' ? 'v' + (r * N + c - 1) : 'v' + (r * N + c));
  const across = (r, c, d) => (d === 'U' ? (r - 1) * N + c : d === 'D' ? (r + 1) * N + c : d === 'L' ? r * N + c - 1 : r * N + c + 1);
  const has = (G, k) => (k[0] === 'h' ? G.hw : G.vw)[+k.slice(1)] === '1';
  const apply = (G, m) => {
    const H = { rnd: 1, brk: G.brk, pc: G.pc.map((l) => l.map((p) => p.slice())), hw: G.hw, vw: G.vw, seats: G.seats, ph: 'move' };
    H.pc[me][m.i][0] = m.to[0]; H.pc[me][m.i][1] = m.to[1];
    const k = wkey(m.to[0], m.to[1], m.w), i = +k.slice(1);
    if (k[0] === 'h') H.hw = H.hw.slice(0, i) + '1' + H.hw.slice(i + 1); else H.vw = H.vw.slice(0, i) + '1' + H.vw.slice(i + 1);
    return H;
  };
  const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
  const targets = [];
  for (const [br, bc] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
    for (let a = 1; a <= 3; a++) for (let b = 1; b <= 3; b++) {
      if (a * b < (arg.minSize || 4)) continue;
      const rows = br ? range(N - a, N) : range(0, a), cols = bc ? range(N - b, N) : range(0, b);
      const inside = new Set();
      rows.forEach((r) => cols.forEach((c) => inside.add(r * N + c)));
      const req = [];
      for (const k of inside) {
        const r = Math.floor(k / N), c = k % N;
        for (const d of 'UDLR') {
          const rr = r + (d === 'U' ? -1 : d === 'D' ? 1 : 0), cc = c + (d === 'L' ? -1 : d === 'R' ? 1 : 0);
          if (rr < 0 || rr >= N || cc < 0 || cc >= N) continue;
          if (!inside.has(rr * N + cc)) req.push(wkey(r, c, d));
        }
      }
      targets.push({ inside, req, size: a * b, name: (br ? 'B' : 'T') + (bc ? 'R' : 'L') + a + 'x' + b });
    }
  }
  const oppIn = (G, t) => [1, 2].some((s) => G.pc[s].some((p) => t.inside.has(p[0] * N + p[1])));
  const mineIn = (G, t) => G.pc[me].some((p) => t.inside.has(p[0] * N + p[1]));
  // 가장 짧은 수순들 (최대 limit 개)
  function search(G, t, depth, freeLeft, seq, out, limit) {
    if (out.length >= limit) return;
    if (oppIn(G, t)) return;
    const missing = t.req.filter((k) => !has(G, k));
    if (!missing.length && mineIn(G, t)) { out.push(seq.slice()); return; }
    if (depth === 0 || missing.length > depth) return;
    const seenFree = new Set();
    for (const m of legalMoves(G, me)) {
      if (m.b) continue;
      const k = wkey(m.to[0], m.to[1], m.w);
      if (!missing.includes(k)) {
        // 자리만 옮기는 수(한 번까지): 목표 땅 안쪽을 가르는 벽은 안 됨
        if (!freeLeft || missing.length >= depth) continue;
        const a = m.to[0] * N + m.to[1], nb = across(m.to[0], m.to[1], m.w);
        if (t.inside.has(a) || t.inside.has(nb)) continue;
        if (seenFree.has(m.i + ':' + a)) continue;
        seenFree.add(m.i + ':' + a);
        seq.push(m); search(apply(G, m), t, depth - 1, freeLeft - 1, seq, out, limit); seq.pop();
        continue;
      }
      seq.push(m); search(apply(G, m), t, depth - 1, freeLeft, seq, out, limit); seq.pop();
    }
  }
  const oppDist = (G, t) => {
    let best = 99;
    for (const s of [1, 2]) for (const p of G.pc[s]) for (const k of t.inside) best = Math.min(best, Math.abs(p[0] - Math.floor(k / N)) + Math.abs(p[1] - k % N));
    return best;
  };
  function bestPlan(G, budget) {
    let best = null;
    for (const t of targets) {
      if (oppIn(G, t)) continue;
      for (let d = 1; d <= budget; d++) {
        const out = [];
        search(G, t, d, 1, [], out, 40);
        if (!out.length) continue;
        for (const seq of out) {
          const pieces = new Set(seq.map((m) => m.i)).size;
          const turn = seq.some((m) => m.path.length === 2 && m.path[0] !== m.path[1]) ? 1 : 0;
          // 짧을수록, 넓을수록, 상대 말에서 멀수록, 두 말을 다 쓰고 원형 말이 꺾는 수가 있으면 더 좋게
          const v = -d * 100 + t.size * 10 + Math.min(oppDist(G, t), 4) * 3 + pieces * 2 + turn;
          if (!best || v > best.v) best = { v, n: d, t: t.name, size: t.size, seq };
        }
        break;
      }
    }
    return best;
  }
  const show = (m, G) => ({ from: G.pc[me][m.i].slice(0, 2), to: m.to, w: m.w, path: m.path, kind: G.pc[me][m.i][2] });

  if (arg.mode === 'place') {
    // 마지막 말(사각 말) 놓을 자리: 그 뒤 가장 빨리 둘러쌀 수 있는 칸
    const occ = new Set(st.pc.flat().map((p) => p[0] * N + p[1]));
    let best = null;
    for (let k = 0; k < N * N; k++) {
      if (occ.has(k)) continue;
      const pc = st.pc.map((l) => l.map((p) => p.slice()));
      pc[me].push([Math.floor(k / N), k % N, arg.kind]);
      const p = bestPlan(mk(pc), arg.budget);
      if (!p) continue;
      const usesNew = p.seq.some((m) => m.i === pc[me].length - 1) ? 5 : 0;
      const v = p.v + usesNew;
      if (!best || v > best.v) best = { v, r: Math.floor(k / N), c: k % N, plan: p.t + ' in ' + p.n };
    }
    if (!best) {
      // 둘러쌀 수순이 안 보이면 내 원형 말 옆 빈 칸
      const me0 = st.pc[me][0] || [0, 0];
      let d0 = 99;
      for (let k = 0; k < N * N; k++) {
        if (occ.has(k)) continue;
        const d = Math.abs(Math.floor(k / N) - me0[0]) + Math.abs(k % N - me0[1]);
        if (d < d0) { d0 = d; best = { r: Math.floor(k / N), c: k % N, plan: 'near' }; }
      }
    }
    return best;
  }
  const G = mk(st.pc);
  const sc = score(G);
  const p = bestPlan(G, arg.budget);
  if (p) return { move: show(p.seq[0], G), plan: p.t + ' in ' + p.n, area: sc.area };
  // 둘러쌀 수순이 없으면 컴퓨터(어려움)가 고르는 수
  const t = think(Object.assign(G, { ph: 'move' }), me, 'hard');
  if (!t) return null;
  const w = walk(G, me, t.i, t.path, false);
  return { move: { from: G.pc[me][t.i].slice(0, 2), to: w.to, w: t.w, path: t.path, kind: G.pc[me][t.i][2] }, plan: 'fallback', area: sc.area };
}

record('04-wall', async (r) => {
  const p = r.page;
  const N = 7;
  const msg = () => p.evaluate(() => (document.querySelector('.wl-msg') || {}).textContent || '');
  const cell = (rc) => p.locator('.wl-board .wl-cell').nth(rc[0] * N + rc[1]);
  const myArea = () => p.evaluate(() => +(document.querySelector('.wl-player.me .wl-score') || {}).textContent || 0);
  const waitMsg = (re, ms) => p.waitForFunction((src) => new RegExp(src).test((document.querySelector('.wl-msg') || {}).textContent || ''), re.source, { timeout: ms || 15000 });

  // ---------- 준비 (영상에 안 나옴): 컴퓨터와 하기 → 로비 → 게임 시작 ----------
  // 내가 세 번째 순서(A → B → 나 → 나 → B → A)인 판을 고름: 판에 한 사람 말만 있으면 사이트가 판 전체(49칸)를
  // 그 사람 영역으로 칠하는데, 세 번째면 내 첫 말을 놓을 때 이미 A·B 말이 있어 그런 장면이 안 나옴
  await r.go('#wall');
  await p.waitForSelector('.mp-choose', { timeout: 15000 });
  await p.evaluate(() => document.fonts && document.fonts.ready);
  let third = false;
  for (let tries = 0; tries < 30 && !third; tries++) {
    await p.click('.mode-card button:has-text("바로 시작")');
    await p.waitForSelector('.lobby-start:not([disabled])', { timeout: 8000 });
    await p.click('.lobby-start');
    await p.waitForSelector('.wl-board', { timeout: 8000 });
    await waitMsg(/^내 차례/, 15000);
    third = /^내 차례.*\(3 \/ 6\)/.test(await msg());
    if (!third) { await p.click('.mp-bar button:has-text("나가기")'); await p.waitForSelector('.mp-choose', { timeout: 8000 }); }
  }
  if (!third) throw new Error('세 번째 순서가 되지 못함');
  // 참가자 점수·안내 문구·판(+ 말을 고르면 아래에 나오는 버튼 줄)이 한 화면에
  await p.evaluate(() => { const t = document.querySelector('.wl-head').getBoundingClientRect().top + scrollY; window.scrollTo(0, Math.round(t - 12)); });
  await r.wait(500);
  await r.start();

  // ---------- 말 놓기: 원형 말을 골라 빈 모서리 근처에 ----------
  // 컴퓨터 A, B 가 하나씩 놓은 판 → 「내 차례: 사각 말을 놓을 빈 칸을 누르세요 (3 / 6)」
  const corner = await p.evaluate(() => {
    const N = 7, occ = new Set();
    document.querySelectorAll('.wl-board .wl-cell').forEach((el, k) => { if (el.querySelector('.piece')) occ.add(k); });
    // 상대 말에서 가장 먼 모서리 쪽 (1,1)/(1,5)/(5,1)/(5,5)
    const opp = [...occ].map((k) => [Math.floor(k / N), k % N]);
    let best = null;
    for (const [r, c] of [[1, 1], [1, 5], [5, 1], [5, 5]]) {
      if (occ.has(r * N + c)) continue;
      const d = Math.min(...opp.map(([a, b]) => Math.abs(a - r) + Math.abs(b - c)));
      if (!best || d > best.d) best = { d, rc: [r, c] };
    }
    return best.rc;
  });
  await r.wait(700);
  await r.tap(p.locator('.seg-btn', { hasText: '원형 말' }));
  await r.wait(420);                                    // 문구가 「원형 말을 놓을 …」로 바뀜
  await r.tap(cell(corner));
  // 바로 이어서 내 차례 (4 / 6): 남은 사각 말
  await waitMsg(/^내 차례.*\(4 \/ 6\)/);
  const putP = p.evaluate(wallPlanner, { mode: 'place', kind: 'S', budget: 4 });
  await r.wait(450);
  const put = await putP;
  console.log('원형 말:', JSON.stringify(corner), '사각 말 자리:', JSON.stringify(put));
  await r.tap(cell([put.r, put.c]));
  // 컴퓨터 B, A 가 두 번째 말을 놓고 (5 / 6, 6 / 6) → 컴퓨터 A, B 가 먼저 움직임

  // ---------- 말 움직이고 벽 세우기 (컴퓨터 A, B 의 수가 사이사이에) ----------
  const maxTurns = 4;
  for (let turn = 1; turn <= maxTurns; turn++) {
    await waitMsg(/^움직일 내 말을 고르세요/);
    const planP = p.evaluate(wallPlanner, { budget: maxTurns - turn + 1 });
    await r.wait(turn === 1 ? 430 : 360);               // 방금 둔 컴퓨터의 수를 볼 시간
    const plan = await planP;
    console.log('차례', turn, JSON.stringify(plan));
    if (!plan) break;
    const m = plan.move;
    await r.tap(cell(m.from));                           // 말 고르기 → 갈 수 있는 칸 표시
    await p.waitForSelector('.wl-cell .piece.sel', { timeout: 3000 });
    await r.wait(300);
    await r.tap(cell(m.to));                             // 갈 칸 → 벽 세울 면 표시
    await p.waitForSelector('.wl-cell.dest .wall-pick.wp-' + m.w, { timeout: 3000 });
    await r.wait(350);
    await r.tap(p.locator('.wl-cell.dest .wall-pick.wp-' + m.w));   // 벽 세우기
    await r.wait(150);
    if ((await myArea()) > 0) break;                     // 모서리 땅이 내 영역으로 닫힘
  }
  // 컴퓨터가 막아서 못 닫은 판이면 결말 없는 영상 대신 실패로 알림 (다시 실행하면 새 판)
  if (!((await myArea()) > 0)) throw new Error('이번 판은 영역을 닫지 못함 — 다시 실행해 주세요');
  await r.wait(1100);                                   // 색칠된 내 영역과 점수에서 멈춤
});
