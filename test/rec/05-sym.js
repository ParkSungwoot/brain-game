// 대칭 퍼즐: 혼자 연습에서 조각을 골라 (필요하면 ↻ 돌리기) 판에 놓고,
// 한 칸 어긋나게 놓은 조각을 손가락으로 끌어 바로잡아 선대칭 도형을 완성하는 모습
const { record, H } = require('./rec');

// 지금 문제(App.quick.lastPuzzle)를 읽어 사람이 둘 수순을 계산 (화면 조작은 하지 않음)
//  - 출제 때 만든 정답 모양(sol)을 그대로 또는 180° 돌려(세로축 유지) 판 가운데에 둠
//  - 조각마다 ↻ 몇 번 돌려야 하는지, 판의 어느 칸을 누르면 그 자리에 놓이는지
//  - 마지막 조각은 한 칸 어긋나게 놓을 자리(아직 대칭이 아닌 자리)도 계산
function planPuzzle() {
  const z = App.quick.lastPuzzle, S = App.sym;
  if (!z || !z.sol || z.k !== 3 || z.flip) return null;
  const [BW, BH] = z.board;
  // 조각 칸에서 고른 조각이 커져도 ↻ 버튼이 화면 안에 남도록, 가로·세로 3칸 이하 조각만
  if (z.pieces.some((c) => Math.max(...c.map((q) => Math.max(q[0], q[1]))) > 2)) return null;
  const J = (c) => JSON.stringify(c);
  const turn = (cells) => { const m = Math.max(...cells.map((c) => c[1])); return cells.map(([x, y]) => [m - y, x]); };
  let best = null;
  for (const g of [0, 2]) {
    // 정답 전체를 g번 돌림 (조각 번호 유지)
    let all = [];
    z.sol.forEach((p, i) => p.forEach(([x, y]) => all.push([x, y, i])));
    for (let t = 0; t < g; t++) { const m = Math.max(...all.map((c) => c[1])); all = all.map(([x, y, i]) => [m - y, x, i]); }
    const mx = Math.min(...all.map((c) => c[0])), my = Math.min(...all.map((c) => c[1]));
    all = all.map(([x, y, i]) => [x - mx, y - my, i]);
    const w = Math.max(...all.map((c) => c[0])) + 1, hh = Math.max(...all.map((c) => c[1])) + 1;
    if (w > BW || hh > BH) continue;
    const ox = Math.floor((BW - w) / 2), oy = Math.floor((BH - hh) / 2);
    const pieces = [];
    let ok = true, cost = 0;
    for (let i = 0; i < z.k; i++) {
      const abs = all.filter((c) => c[2] === i).map(([x, y]) => [x + ox, y + oy]);
      const want = J(S.norm(abs));
      let c = z.pieces[i], k = -1;
      for (let r = 0; r < 4; r++) { if (J(S.norm(c)) === want) { k = r; break; } c = S.rot(c); }
      if (k < 0) { ok = false; break; }
      const cells = S.norm(c);
      const px = Math.min(...abs.map((a) => a[0])), py = Math.min(...abs.map((a) => a[1]));
      pieces.push({ i, k, abs, pos: [px, py], tap: [px + cells[0][0], py + cells[0][1]], cells });
      cost += k;
    }
    if (!ok) continue;
    if (!best || cost < best.cost) best = { g, cost, pieces, w, hh };
  }
  if (!best) return null;
  // 놓는 순서: 안 돌려도 되는 조각 → 돌려야 하는 조각 → 마지막(어긋나게 놓았다가 끌어서 바로잡을 조각)
  const P = best.pieces;
  const turned = P.filter((p) => p.k > 0), plain = P.filter((p) => p.k === 0);
  if (turned.length === 0 || best.cost > 2) return null;
  const order = [];
  // 마지막 조각 후보: 어긋난 자리에서 한 덩어리지만 대칭이 아니고, 판 안·안 겹침
  const key = (x, y) => x + ',' + y;
  const tryLast = (last) => {
    const others = P.filter((p) => p !== last);
    const occ = new Set();
    others.forEach((p) => p.abs.forEach(([x, y]) => occ.add(key(x, y))));
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const moved = last.abs.map(([x, y]) => [x + dx, y + dy]);
      if (moved.some(([x, y]) => x < 0 || y < 0 || x >= BW || y >= BH || occ.has(key(x, y)))) continue;
      const fig = others.flatMap((p) => p.abs).concat(moved);
      if (!S.connected(fig) || S.symmetryAxis(fig)) continue;
      return { dx, dy };
    }
    return null;
  };
  // 돌리는 조각은 가운데(두 번째)에, 어긋날 조각은 돌리지 않는 조각 중에서 고르면 흐름이 자연스러움
  const cands = plain.concat(turned);
  let last = null, off = null;
  for (const c of cands) { const o = tryLast(c); if (o) { last = c; off = o; break; } }
  if (!last) return null;
  const rest = P.filter((p) => p !== last).sort((a, b) => a.k - b.k);
  order.push(...rest, last);
  // 어긋난 자리 탭 칸, 끌기 시작 칸(조각 가운데쯤 칸), 끌어서 놓을 칸
  const wrongTap = [last.tap[0] + off.dx, last.tap[1] + off.dy];
  const cx = last.abs.reduce((a, c) => a + c[0], 0) / last.abs.length, cy = last.abs.reduce((a, c) => a + c[1], 0) / last.abs.length;
  const grab0 = last.abs.slice().sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy))[0];
  const grab = [grab0[0] + off.dx, grab0[1] + off.dy];
  return { BW, cost: best.cost, g: best.g, order: order.map((p) => ({ i: p.i, k: p.k, tap: p.tap })), wrongTap, grab, drop: grab0, off };
}

record('05-sym', async (r) => {
  const p = r.page;
  const cellSel = (BW, [x, y]) => `.sym-board .sym-cell[data-i="${y * BW + x}"]`;
  const topOf = (sel) => p.evaluate((s) => document.querySelector(s).getBoundingClientRect().top, sel);
  // 누를 곳이 화면 밖(아래·위)에 걸쳐 있으면 사람처럼 살짝 쓸어 올려서 보이게 (갑자기 튀는 스크롤 방지)
  const see = async (target) => {
    const loc = typeof target === 'string' ? p.locator(target).first() : target;
    const b = await loc.evaluate((el) => { const q = el.getBoundingClientRect(); return { top: q.top, bottom: q.bottom }; });
    if (b.bottom > H - 8) await r.swipe(Math.ceil(b.bottom - H + 24), 500);
    else if (b.top < 8) await r.swipe(Math.floor(b.top - 24), 500);
  };
  const tap = async (target) => { await see(target); await r.tap(target); };

  await r.go('#sym');
  await p.waitForSelector('.sym-board', { timeout: 15000 });
  await p.evaluate(() => document.fonts && document.fonts.ready);

  // ---- 녹화 전 준비 (영상에 안 들어감) ----
  // 한 번 해 본 사람처럼: 첫 판을 마쳐 공략을 열어 둠 → 녹화 중 「공략이 열렸어요」 알림이 판을 가리지 않음
  await p.click('#panel-play button:has-text("포기하고 정답 보기")');
  await p.waitForSelector('#panel-play .result-box', { timeout: 5000 });
  await p.waitForFunction(() => { const t = document.getElementById('toast'); return !t || t.hidden; }, null, { timeout: 8000 }).catch(() => {});
  // 보여 주기 좋은 문제(조각 3개, ↻ 1~2번이면 되는 문제)가 나올 때까지 「처음부터」
  let plan = null;
  for (let i = 0; i < 150 && !plan; i++) {
    await p.click('#panel-play .toolbar button:has-text("처음부터")');
    await p.waitForSelector('.sym-board', { timeout: 5000 });
    plan = await p.evaluate(planPuzzle);
  }
  if (!plan) throw new Error('알맞은 문제를 찾지 못함');
  console.log('[05-sym] plan', JSON.stringify(plan));
  await p.evaluate(() => scrollTo(0, 0));
  await p.waitForTimeout(700);
  await r.start();

  // ---- 녹화 ----
  await r.wait(1300);                                    // 게임 제목, 플레이 · 혼자 연습
  // 문제 문장 → 판 → 조각 칸 → ↻ 돌리기 버튼이 한 화면에 오도록
  await r.swipe((await topOf('#panel-play .q-prompt')) - 10, 1100);
  await r.wait(1400);                                    // 조각들과 빈 판을 살펴봄

  const rotBtn = p.locator('.sym .row .btn', { hasText: '돌리기' });
  for (let n = 0; n < plan.order.length; n++) {
    const s = plan.order[n];
    const isLast = n === plan.order.length - 1;
    await tap(`.sym-tray .sym-piece[aria-label="조각 ${s.i + 1}"]`);   // 조각 고르기
    await r.wait(s.k ? 650 : 750);
    for (let t = 0; t < s.k; t++) { await tap(rotBtn); await r.wait(650); }   // ↻ 돌리기
    if (s.k) await r.wait(250);
    await tap(cellSel(plan.BW, isLast ? plan.wrongTap : s.tap));       // 판에 놓기 (마지막 조각은 한 칸 어긋나게)
    await r.wait(isLast ? 1300 : 850);
  }
  // 한 칸 어긋난 조각을 누른 채 끌어서 제자리로
  const a = await r.center(cellSel(plan.BW, plan.grab));
  const b = await r.center(cellSel(plan.BW, plan.drop));
  await r.drag([a, a, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, b, b], 170);
  await p.waitForSelector('.sym-board.solved', { timeout: 3000 });
  await r.wait(1300);                                    // 초록 테두리, 「세로축 대칭 완성!」
  // 판 전체 + 「세로축 대칭 완성!」 + 결과 상자(○초 만에 정답)가 한 화면에 오도록 살짝 내림
  {
    const dy = Math.round((await topOf('#panel-play .sym-board')) - 12);
    if (dy > 4) await r.swipe(dy, 900);
  }
  await r.wait(1500);
});
