/* 벽바둑 2: 말을 움직이고 담장을 세워 더 넓은 땅을 차지 (1:1, 온라인/컴퓨터) */
(function () {
  const App = (globalThis.App = globalThis.App || {});
  const { h, rng: R } = App;
  const N = 7;
  const DIRS = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };
  const DNAME = { U: '위', D: '아래', L: '왼쪽', R: '오른쪽' };

  // 담장: hw[r*N+c] = (r,c) 아래쪽 담장 (r<N-1), vw[r*N+c] = (r,c) 오른쪽 담장 (c<N-1)
  function wallBetween(G, r, c, d) {
    if (d === 'U') return r === 0 || G.hw[(r - 1) * N + c] === '1';
    if (d === 'D') return r === N - 1 || G.hw[r * N + c] === '1';
    if (d === 'L') return c === 0 || G.vw[r * N + c - 1] === '1';
    return c === N - 1 || G.vw[r * N + c] === '1';
  }
  function setWall(G, r, c, d) {
    const put = (s, i) => s.slice(0, i) + '1' + s.slice(i + 1);
    if (d === 'U') G.hw = put(G.hw, (r - 1) * N + c);
    else if (d === 'D') G.hw = put(G.hw, r * N + c);
    else if (d === 'L') G.vw = put(G.vw, r * N + c - 1);
    else G.vw = put(G.vw, r * N + c);
  }

  function occupied(G) {
    const occ = new Map();
    G.pc.forEach((list, s) => list.forEach((p, i) => occ.set(p[0] * N + p[1], [s, i])));
    return occ;
  }

  // 0~2칸 이동 가능한 칸 (방향 전환 가능, 담장·말 통과 불가)
  function reach(G, seat, i) {
    const [r0, c0] = G.pc[seat][i];
    const occ = occupied(G);
    const seen = new Map([[r0 * N + c0, 0]]);
    let frontier = [[r0, c0]];
    for (let step = 1; step <= 2; step++) {
      const next = [];
      for (const [r, c] of frontier) {
        for (const d of 'UDLR') {
          if (wallBetween(G, r, c, d)) continue;
          const nr = r + DIRS[d][0], nc = c + DIRS[d][1];
          const k = nr * N + nc;
          if (seen.has(k) || occ.has(k)) continue;
          seen.set(k, step);
          next.push([nr, nc]);
        }
      }
      frontier = next;
    }
    return [...seen.keys()];
  }

  function openSides(G, r, c) { return 'UDLR'.split('').filter((d) => !wallBetween(G, r, c, d)); }

  function legalMoves(G, seat) {
    const out = [];
    G.pc[seat].forEach((_, i) => {
      for (const k of reach(G, seat, i)) {
        const r = Math.floor(k / N), c = k % N;
        for (const w of openSides(G, r, c)) out.push({ t: 'mv', i, r, c, w });
      }
    });
    return out;
  }

  // 구역 나누기
  function regions(G) {
    const id = Array(N * N).fill(-1);
    const regs = [];
    const occ = occupied(G);
    for (let s = 0; s < N * N; s++) {
      if (id[s] >= 0) continue;
      const reg = { cells: [], owners: new Set() };
      const stack = [s];
      id[s] = regs.length;
      while (stack.length) {
        const k = stack.pop();
        reg.cells.push(k);
        if (occ.has(k)) reg.owners.add(occ.get(k)[0]);
        const r = Math.floor(k / N), c = k % N;
        for (const d of 'UDLR') {
          if (wallBetween(G, r, c, d)) continue;
          const nk = (r + DIRS[d][0]) * N + c + DIRS[d][1];
          if (id[nk] < 0) { id[nk] = regs.length; stack.push(nk); }
        }
      }
      regs.push(reg);
    }
    return { regs, id };
  }

  function score(G) {
    const { regs } = regions(G);
    const sc = [0, 0];
    let separated = true;
    for (const rg of regs) {
      if (rg.owners.size > 1) separated = false;
      else if (rg.owners.size === 1) sc[[...rg.owners][0]] += rg.cells.length;
    }
    return { sc, separated, regs };
  }

  // ---------- 규칙 ----------
  const START = [[[1, 1], [5, 5]], [[1, 5], [5, 1]]];
  const PLACE_ORDER = [0, 1, 1, 0];

  const engine = {
    id: 'wall',
    minPlayers: 2, maxPlayers: 2, allowBots: true, defaultBots: 2,
    defaultOpts: { ai: 'normal' },
    botNames: ['담장 봇'],
    start(players, o) {
      return {
        ph: 'place', pi: 0, turn: PLACE_ORDER[0], moves: 0,
        pc: START.map((x) => x.map((p) => p.slice())),
        hw: '0'.repeat(N * N), vw: '0'.repeat(N * N),
        last: null, ai: o.ai || 'normal', res: null,
      };
    },
    act(G, seat, a) {
      if (G.ph === 'end') throw new Error('게임이 끝났어요');
      if (seat !== G.turn) throw new Error('내 차례가 아니에요');
      if (G.ph === 'place') {
        if (a.t !== 'put') throw new Error('먼저 말을 놓아야 해요');
        const r = a.r | 0, c = a.c | 0;
        if (r < 0 || r >= N || c < 0 || c >= N || occupied(G).has(r * N + c)) throw new Error('빈 칸에만 놓을 수 있어요');
        G.pc[seat].push([r, c]);
        G.last = { s: seat, put: [r, c] };
        G.pi++;
        if (G.pi >= PLACE_ORDER.length) { G.ph = 'move'; G.turn = 0; }
        else G.turn = PLACE_ORDER[G.pi];
        return;
      }
      if (a.t !== 'mv') throw new Error('말을 움직이고 담장을 세워 주세요');
      const i = a.i | 0, r = a.r | 0, c = a.c | 0, w = String(a.w);
      if (!G.pc[seat][i]) throw new Error('없는 말이에요');
      if (!reach(G, seat, i).includes(r * N + c)) throw new Error('그 칸으로는 갈 수 없어요');
      if (!DIRS[w]) throw new Error('담장 방향이 잘못됐어요');
      const from = G.pc[seat][i].slice();
      G.pc[seat][i] = [r, c];
      if (wallBetween(G, r, c, w)) { G.pc[seat][i] = from; throw new Error('이미 담장이 있는 면이에요'); }
      setWall(G, r, c, w);
      G.moves++;
      G.last = { s: seat, from, to: [r, c], w };
      const sc = score(G);
      if (sc.separated) { G.ph = 'end'; G.res = sc.sc; return; }
      // 다음 사람이 둘 수 없으면 차례를 넘김, 둘 다 못 두면 종료
      const nxt = 1 - seat;
      if (legalMoves(G, nxt).length) G.turn = nxt;
      else if (legalMoves(G, seat).length) G.turn = seat;
      else { G.ph = 'end'; G.res = sc.sc; }
    },
    pending(G) { return G.ph === 'end' ? [] : [G.turn]; },
    timeLimit(G) { return G.ph === 'place' ? 45000 : 90000; },
    bot(G, seat) { return think(G, seat, G.ai); },
    timeout(G, seat) { return think(G, seat, 'easy'); },
    botDelay() { return 600 + Math.random() * 600; },
    publicView(G) {
      return { ph: G.ph, turn: G.turn, pc: G.pc, hw: G.hw, vw: G.vw, last: G.last, moves: G.moves, res: G.res, pi: G.pi };
    },
    over(G) { return G.ph === 'end'; },
    results(G) { return { res: G.res, scores: G.res ? G.res.slice() : [0, 0] }; },
  };

  // ---------- 컴퓨터 ----------
  function clone(G) { return { ph: G.ph, pi: G.pi, turn: G.turn, pc: G.pc.map((l) => l.map((p) => p.slice())), hw: G.hw, vw: G.vw }; }

  // 영역 예상: 담장을 따라 더 가까운 쪽이 차지 (닫힌 구역은 확정)
  function evaluate(G, seat) {
    const dist = [Array(N * N).fill(99), Array(N * N).fill(99)];
    for (let s = 0; s < 2; s++) {
      const q = [];
      G.pc[s].forEach((p) => { const k = p[0] * N + p[1]; dist[s][k] = 0; q.push(k); });
      for (let qi = 0; qi < q.length; qi++) {
        const k = q[qi], r = Math.floor(k / N), c = k % N;
        for (const d of 'UDLR') {
          if (wallBetween(G, r, c, d)) continue;
          const nk = (r + DIRS[d][0]) * N + c + DIRS[d][1];
          if (dist[s][nk] > dist[s][k] + 1) { dist[s][nk] = dist[s][k] + 1; q.push(nk); }
        }
      }
    }
    const { regs } = regions(G);
    let v = 0;
    for (const rg of regs) {
      if (rg.owners.size === 1) { v += ([...rg.owners][0] === seat ? 1 : -1) * rg.cells.length * 1.15; continue; }
      if (rg.owners.size === 0) continue;
      for (const k of rg.cells) {
        const a = dist[seat][k], b = dist[1 - seat][k];
        if (a < b) v += 1; else if (b < a) v -= 1;
      }
    }
    return v;
  }

  function think(G, seat, level) {
    if (G.ph === 'place') {
      const occ = occupied(G);
      let best = null, bv = -Infinity;
      for (let k = 0; k < N * N; k++) {
        if (occ.has(k)) continue;
        const H = clone(G);
        H.pc[seat].push([Math.floor(k / N), k % N]);
        const v = evaluate(H, seat) + Math.random() * (level === 'easy' ? 6 : 0.5);
        if (v > bv) { bv = v; best = { t: 'put', r: Math.floor(k / N), c: k % N }; }
      }
      return best;
    }
    const moves = legalMoves(G, seat);
    if (!moves.length) return null;
    const noise = level === 'easy' ? 5 : level === 'normal' ? 1.2 : 0.2;
    const scored = moves.map((m) => {
      const H = clone(G);
      H.pc[seat][m.i] = [m.r, m.c];
      setWall(H, m.r, m.c, m.w);
      return { m, H, v: evaluate(H, seat) };
    });
    if (level === 'hard') {
      scored.sort((a, b) => b.v - a.v);
      const top = scored.slice(0, 10);
      for (const s of top) {
        // 상대의 가장 좋은 응수
        const opp = legalMoves(s.H, 1 - seat);
        let worst = Infinity;
        for (const om of opp) {
          const H2 = clone(s.H);
          H2.pc[1 - seat][om.i] = [om.r, om.c];
          setWall(H2, om.r, om.c, om.w);
          const v = evaluate(H2, seat);
          if (v < worst) worst = v;
        }
        s.v2 = opp.length ? worst : s.v;
      }
      top.sort((a, b) => b.v2 - a.v2 + (Math.random() - 0.5) * noise);
      return top[0].m;
    }
    let best = scored[0], bv = -Infinity;
    for (const s of scored) { const v = s.v + Math.random() * noise; if (v > bv) { bv = v; best = s; } }
    return best.m;
  }

  // ---------- 화면 ----------
  function renderGame(g, s) {
    const W = s.W, st = W.s, me = s.mySeat;
    const names = W.pl.map((p) => p.n);
    const L = s.local;
    if (L.key !== W.gn + ':' + st.moves + ':' + st.pi) { L.key = W.gn + ':' + st.moves + ':' + st.pi; L.sel = null; L.dest = null; }
    const myTurn = me >= 0 && st.turn === me && st.ph !== 'end' && !s.waiting;
    const view = { pc: st.pc, hw: st.hw, vw: st.vw };
    const sc = score(view);

    g.append(h('div', { class: 'wl-head' },
      [0, 1].map((i) => h('span', { class: 'wl-player' + (st.turn === i && st.ph !== 'end' ? ' turn' : '') + (i === me ? ' me' : '') },
        h('span', { class: 'seat-dot', style: { background: `var(--p${i})` } }), names[i], i === me ? ' (나)' : '',
        h('b', { class: 'wl-score' }, String(sc.sc[i])), st.turn === i && st.ph !== 'end' ? h('span', { class: 'timer', 'data-timer-seat': i }) : null)),
    ));
    let msg;
    if (st.ph === 'end') msg = '게임 종료';
    else if (st.ph === 'place') msg = (st.turn === me ? '내 차례: 빈 칸을 눌러 말을 놓으세요' : names[st.turn] + '이(가) 말을 놓는 중') + ' (' + (st.pi + 1) + ' / 4)';
    else if (st.turn === me) msg = !L.sel ? '내 말을 고르세요' : L.dest == null ? '갈 칸을 고르세요 (제자리도 가능)' : '담장을 세울 면을 고르세요';
    else msg = names[st.turn] + '의 차례';
    g.append(h('p', { class: 'hint wl-msg' }, msg));

    const reachSet = new Set();
    if (myTurn && st.ph === 'move' && L.sel != null) reach(view, me, L.sel).forEach((k) => reachSet.add(k));
    const { id: regId, regs } = regions(view);

    const board = h('div', { class: 'wl-board', style: { '--n': N } });
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const k = r * N + c;
        let owner = null;
        for (let sIdx = 0; sIdx < 2; sIdx++) st.pc[sIdx].forEach((p, i) => { if (p[0] === r && p[1] === c) owner = [sIdx, i]; });
        const rg = regs[regId[k]];
        const terr = rg.owners.size === 1 ? [...rg.owners][0] : -1;
        const cls = ['wl-cell'];
        if (terr >= 0) cls.push('terr' + terr);
        if (reachSet.has(k)) cls.push('reach');
        if (L.dest === k) cls.push('dest');
        if (st.last && st.last.to && st.last.to[0] === r && st.last.to[1] === c) cls.push('lastmv');
        const walls = [];
        if (r < N - 1 && st.hw[k] === '1') walls.push(h('span', { class: 'w-h' }));
        if (c < N - 1 && st.vw[k] === '1') walls.push(h('span', { class: 'w-v' }));
        const cell = h('div', { class: cls.join(' '), role: 'button', tabindex: myTurn ? '0' : '-1', 'aria-label': (r + 1) + '행 ' + (c + 1) + '열' + (owner ? ' ' + names[owner[0]] + '의 말' : '') },
          owner ? h('span', { class: 'piece' + (L.sel === owner[1] && owner[0] === me ? ' sel' : ''), style: { background: `var(--p${owner[0]})` } }) : null,
          walls);
        const click = () => {
          if (!myTurn) return;
          if (st.ph === 'place') { if (!owner) s.send({ t: 'put', r, c }); return; }
          if (owner && owner[0] === me && L.dest == null) { L.sel = L.sel === owner[1] ? null : owner[1]; s.onUpdate(s); return; }
          if (L.sel != null && reachSet.has(k)) { L.dest = L.dest === k ? null : k; s.onUpdate(s); return; }
          if (L.sel != null && L.dest != null) { L.dest = null; s.onUpdate(s); }
        };
        cell.addEventListener('click', click);
        cell.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); click(); } });
        // 담장 고르기 버튼
        if (myTurn && st.ph === 'move' && L.dest === k) {
          const tmp = { pc: st.pc.map((l) => l.map((p) => p.slice())), hw: st.hw, vw: st.vw };
          tmp.pc[me][L.sel] = [r, c];
          for (const d of openSides(tmp, r, c)) {
            cell.append(h('button', { class: 'wall-pick wp-' + d, 'aria-label': DNAME[d] + '에 담장', onclick: (e) => { e.stopPropagation(); s.send({ t: 'mv', i: L.sel, r, c, w: d }); } }));
          }
        }
        board.append(cell);
      }
    }
    g.append(h('div', { class: 'wl-wrap' }, board));
    if (myTurn && st.ph === 'move' && L.sel != null) g.append(h('div', { class: 'row center' }, h('button', { class: 'btn tiny ghost', onclick: () => { L.sel = null; L.dest = null; s.onUpdate(s); } }, '선택 취소')));

    if (st.ph === 'end') {
      const r = st.res || sc.sc;
      const win = r[0] === r[1] ? -1 : r[0] > r[1] ? 0 : 1;
      g.append(h('div', { class: 'result-box' },
        h('strong', { class: 'result-big' }, win === -1 ? '무승부' : win === me ? '승리!' : me >= 0 ? '패배' : names[win] + ' 승리'),
        h('p', null, names[0] + ' ' + r[0] + '칸 · ' + names[1] + ' ' + r[1] + '칸 (모든 구역이 한 사람의 말만 담게 되어 끝났어요)')));
    }
  }

  function renderOptions(o, s, disabled) {
    const W = s.W;
    if (!W.pl.some((p) => p.b)) return;
    o.append(h('div', { class: 'toolbar' }, h('span', { class: 'opt-label' }, '컴퓨터 실력'),
      h('div', { class: 'seg small' }, [['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']].map(([v, l]) => h('button', { class: 'seg-btn' + (W.o.ai === v ? ' on' : ''), disabled, onclick: () => s.setOpt('ai', v) }, l)))));
  }

  function mount(root, ctx) {
    return App.multi.mount(root, ctx, { gameId: 'wall', engine, renderGame, renderOptions, soloLabel: '컴퓨터와 1:1' });
  }

  App.games.push({
    id: 'wall',
    name: '벽바둑 2',
    kicker: '전략',
    players: '1:1 · 온라인 / 컴퓨터',
    blurb: '7×7 판에서 말을 두 칸까지 움직이고 담장을 세웁니다. 내 말만 있는 구역이 넓은 쪽이 이겨요.',
    accent: 'wall',
    mount,
    rules: `
<p>7×7 판에서 두 사람이 말을 움직이며 담장을 세워 땅을 나누는 게임입니다.</p>
<ul>
<li>각자 말 4개를 씁니다. 2개는 정해진 자리에서 시작하고, 나머지 2개는 <b>1번 → 2번 → 2번 → 1번</b> 순서로 원하는 빈 칸에 놓습니다.</li>
<li>자기 차례에는 말 하나를 <b>0~2칸</b> 상하좌우로 움직입니다. 움직이는 도중 방향을 바꿀 수 있지만 담장이나 다른 말을 지나갈 수는 없습니다.</li>
<li>움직인 뒤에는 반드시 <b>그 말이 선 칸의 한 면</b>에 담장을 세웁니다. 이미 담장이 있는 면이나 판의 테두리에는 세울 수 없습니다.</li>
<li>담장으로 나뉜 모든 구역이 <b>한 사람의 말만</b> 담게 되면 게임이 끝납니다.</li>
<li>내 말만 들어 있는 구역의 칸 수를 모두 더한 값이 점수입니다. 아무 말도 없는 구역은 누구의 점수도 아닙니다. 점수가 큰 쪽이 이깁니다.</li>
</ul>
<p class="note">판 위의 색칠은 이미 확정된 구역입니다. 머리 위 숫자는 지금까지 확정된 칸 수예요. 온라인에서 한 수의 제한 시간은 90초입니다.</p>`,
    guide: `
<h4>1. 넓은 쪽을 먼저 막아 두기</h4>
<p>담장은 내 말이 선 칸에만 세울 수 있습니다. 그래서 “어디에 담장을 세울지”가 곧 “어디로 말을 보낼지”를 정합니다. 내 말 근처의 넓은 빈 땅과 상대 말 사이에 담장을 하나씩 쌓아 경계를 만드세요. 경계가 완성되기 전까지는 그 땅이 확정되지 않습니다.</p>
<div class="demo" data-demo="wall"></div>
<h4>2. 처음 놓는 말 2개가 판의 절반을 정한다</h4>
<p>준비 단계의 말 2개는 상대 말들 사이, 특히 상대가 차지하려는 큰 공간 한가운데에 놓으면 효과가 큽니다. 내 말이 끼어 있는 구역은 상대가 혼자 가질 수 없기 때문입니다. 반대로 내 시작 말 근처에 몰아서 놓으면 안전하지만 땅이 넓어지지 않습니다.</p>
<h4>3. 상대 말을 가두기</h4>
<p>상대 말이 좁은 곳에 있다면 그 출구를 담장으로 막아 작은 구역에 가두세요. 갇힌 말은 그 작은 구역의 점수만 얻고, 나머지 판에서는 힘을 쓰지 못합니다. 말 하나를 가두면 사실상 상대가 말 3개로 싸우는 셈이 됩니다.</p>
<h4>4. 내 말이 갇히지 않게 하기</h4>
<p>말 주변 세 면에 담장이 생기면 빠져나갈 길이 하나뿐입니다. 이 상태의 말은 상대가 마지막 출구를 막는 순간 갇힙니다. 말이 좁은 통로에 들어가기 전에, 그 통로가 막혀도 괜찮은지 먼저 생각하세요.</p>
<h4>5. 두 칸 이동으로 경계를 넘나들기</h4>
<p>말은 두 칸까지 갈 수 있어서 상대의 경계가 한 칸 비어 있으면 그 틈으로 들어가 땅을 나눠 가질 수 있습니다. 경계를 만들 때는 상대 말이 두 칸 안에 들어올 수 있는 틈이 없는지 확인하세요. 제자리에 머무르며 담장만 세우는 것도 좋은 수입니다.</p>
<h4>6. 끝내는 시점 고르기</h4>
<p>모든 구역이 나뉘는 순간 게임이 끝납니다. 내가 앞서 있다면 서둘러 마지막 경계를 닫고, 뒤처져 있다면 상대 구역에 말을 넣어 경계가 닫히지 않게 버티며 역전 기회를 노리세요.</p>`,
  });

  App.wall = { engine, score, legalMoves, reach, think };
})();
