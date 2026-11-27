/* 벽바둑 2: 사각 말·원형 말을 움직이고 벽을 세워 내 영역을 넓히기
 * 3명: 1라운드 3인전(가장 넓은 사람 생존) → 2라운드 나머지 둘의 1:1(지면 탈락). 2명: 2라운드 규칙의 1:1 */
(function () {
  const App = (globalThis.App = globalThis.App || {});
  const { h } = App;
  const N = 7;
  const DIRS = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };
  const DNAME = { U: '위', D: '아래', L: '왼쪽', R: '오른쪽' };
  const KIND = { S: '사각 말', C: '원형 말' };
  // 사각 말: 한 방향으로 1~2칸 / 원형 말: 1칸, 또는 1칸 간 뒤 왼쪽·오른쪽으로 꺾어 1칸 더
  const PATHS = {
    S: ['U', 'UU', 'D', 'DD', 'L', 'LL', 'R', 'RR'],
    C: ['U', 'D', 'L', 'R', 'UL', 'UR', 'DL', 'DR', 'LU', 'LD', 'RU', 'RD'],
  };
  // 2라운드(1:1) 원형 말 2개의 정해진 시작 자리 (선, 후)
  const CIRCLE_START = [[[1, 1], [5, 5]], [[1, 5], [5, 1]]];

  // 벽: hw[r*N+c] = (r,c) 아래쪽 벽, vw[r*N+c] = (r,c) 오른쪽 벽. 판 테두리는 벽처럼 막혀 있지만 부술 수 없음
  function isEdge(r, c, d) { return (d === 'U' && r === 0) || (d === 'D' && r === N - 1) || (d === 'L' && c === 0) || (d === 'R' && c === N - 1); }
  function hasWall(G, r, c, d) {
    if (d === 'U') return G.hw[(r - 1) * N + c] === '1';
    if (d === 'D') return G.hw[r * N + c] === '1';
    if (d === 'L') return G.vw[r * N + c - 1] === '1';
    return G.vw[r * N + c] === '1';
  }
  function wallBetween(G, r, c, d) { return isEdge(r, c, d) || hasWall(G, r, c, d); }
  function setWall(G, r, c, d, v) {
    const ch = v || '1';
    const put = (s, i) => s.slice(0, i) + ch + s.slice(i + 1);
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
  function openSides(G, r, c) { return 'UDLR'.split('').filter((d) => !wallBetween(G, r, c, d)); }
  const canBreak = (G, seat) => G.rnd === 1 && !!G.brk && G.brk[seat] > 0;

  // 정해진 길로 움직여 보기. 부수기를 쓰면 길에 있는 벽 하나를 지날 수 있음 (꼭 하나를 지나야 함)
  function walk(G, seat, i, path, useBreak) {
    const p = G.pc[seat] && G.pc[seat][i];
    if (!p || !PATHS[p[2]] || !PATHS[p[2]].includes(path)) return null;
    const occ = occupied(G);
    let r = p[0], c = p[1], broke = null;
    for (const d of path) {
      if (isEdge(r, c, d)) return null;
      if (hasWall(G, r, c, d)) { if (!useBreak || broke) return null; broke = [r, c, d]; }
      r += DIRS[d][0]; c += DIRS[d][1];
      if (occ.has(r * N + c)) return null;
    }
    if (useBreak && !broke) return null;
    return { to: [r, c], broke };
  }

  function clone(G) { return { rnd: G.rnd, brk: (G.brk || []).slice(), pc: G.pc.map((l) => l.map((p) => p.slice())), hw: G.hw, vw: G.vw, seats: G.seats }; }
  function applyMove(H, seat, m) {
    if (m.broke) { setWall(H, m.broke[0], m.broke[1], m.broke[2], '0'); H.brk[seat] = 0; }
    H.pc[seat][m.i][0] = m.to[0]; H.pc[seat][m.i][1] = m.to[1];
    if (m.w) setWall(H, m.to[0], m.to[1], m.w);
    return H;
  }

  // 둘 수 있는 수 (벽 방향까지). withWalls=false 면 움직일 수 있는지만
  function legalMoves(G, seat, withWalls) {
    const out = [], seen = new Set();
    (G.pc[seat] || []).forEach((p, i) => {
      for (const path of PATHS[p[2]]) {
        for (const b of canBreak(G, seat) ? [0, 1] : [0]) {
          const m = walk(G, seat, i, path, !!b);
          if (!m) continue;
          if (withWalls === false) { out.push({ i, path, b, to: m.to }); continue; }
          const H = applyMove(clone(G), seat, { i, to: m.to, broke: m.broke });
          for (const w of openSides(H, m.to[0], m.to[1])) {
            const key = i + ':' + m.to + ':' + (m.broke || '') + ':' + w;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ t: 'mv', i, path, b, w, to: m.to, broke: m.broke });
          }
        }
      }
    });
    return out;
  }

  // 영역 나누기와 점수: 한 사람의 말만 있는 영역의 칸 수를 그 사람 점수로
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
    const { regs, id } = regions(G);
    const S = G.pc.length;
    const area = Array(S).fill(0), big = Array(S).fill(0);
    let separated = true;
    for (const rg of regs) {
      if (rg.owners.size > 1) { separated = false; continue; }
      if (rg.owners.size === 1) { const o = [...rg.owners][0]; area[o] += rg.cells.length; big[o] = Math.max(big[o], rg.cells.length); }
    }
    return { area, big, separated, regs, id };
  }

  // ---------- 규칙 ----------
  function startRound(G, rnd, seats, first) {
    G.rnd = rnd;
    G.seats = seats.slice();
    const k0 = seats.indexOf(first);
    G.turnOrder = seats.slice(k0).concat(seats.slice(0, k0));
    G.pc = Array.from({ length: G.n }, () => []);
    G.hw = '0'.repeat(N * N); G.vw = '0'.repeat(N * N);
    G.brk = Array(G.n).fill(rnd === 1 ? 1 : 0);
    G.toPlace = Array.from({ length: G.n }, () => []);
    G.lot = Array.from({ length: G.n }, () => Math.random());
    const ord = G.turnOrder;
    if (rnd === 1) {
      ord.forEach((s) => { G.toPlace[s] = ['S', 'C']; });
      G.order = ord.concat(ord.slice().reverse()); // 1 2 3 3 2 1
    } else {
      ord.forEach((s, k) => { CIRCLE_START[k].forEach(([r, c]) => G.pc[s].push([r, c, 'C'])); G.toPlace[s] = ['S', 'S']; });
      G.order = [ord[0], ord[1], ord[1], ord[0]];
    }
    G.pi = 0; G.ph = 'place'; G.turn = G.order[0]; G.last = null; G.moves = 0;
  }
  function rankOf(G, sc) {
    const seats = G.seats.slice();
    seats.sort((a, b) => sc.area[b] - sc.area[a] || sc.big[b] - sc.big[a] || G.lot[b] - G.lot[a]);
    const tie = (a, b) => sc.area[a] === sc.area[b] && sc.big[a] === sc.big[b];
    return { rank: seats, lot: seats.length > 1 && tie(seats[0], seats[1]), area: sc.area.slice(), big: sc.big.slice() };
  }
  function endRound(G) {
    const res = rankOf(G, score(G));
    if (G.rnd === 1) {
      G.r1 = res;
      G.ph = 'between';
      G.until = Date.now() + 9000;
      G.next2 = [res.rank[1], res.rank[2]]; // 1라운드에서 더 넓게 확보한 사람이 2라운드 선
    } else { G.r2 = res; G.ph = 'end'; }
  }
  function nextMover(G, from, includeSelf) {
    const ord = G.turnOrder;
    const k = ord.indexOf(from);
    for (let t = includeSelf ? 0 : 1; t <= ord.length; t++) {
      const s = ord[(k + t) % ord.length];
      if (legalMoves(G, s, false).length) return s;
    }
    return -1;
  }
  function afterTurn(G, seat) {
    if (score(G).separated) return endRound(G);
    const nx = nextMover(G, seat, false);
    if (nx < 0) return endRound(G); // 아무도 움직일 수 없으면 끝
    G.turn = nx;
  }

  const engine = {
    id: 'wall',
    minPlayers: 2, maxPlayers: 3, allowBots: true, defaultBots: 3,
    defaultOpts: { ai: 'normal' },
    botNames: ['컴퓨터 A', '컴퓨터 B'],
    start(players, o) {
      const G = { n: players.length, ai: o.ai || 'normal', r1: null, r2: null };
      if (G.n === 3) startRound(G, 1, [0, 1, 2], Math.floor(Math.random() * 3));
      else startRound(G, 2, [0, 1], Math.random() < 0.5 ? 0 : 1);
      return G;
    },
    act(G, seat, a) {
      if (G.ph !== 'place' && G.ph !== 'move') throw new Error('지금은 둘 수 없어요');
      if (seat !== G.turn) throw new Error('내 차례가 아니에요');
      if (G.ph === 'place') {
        if (!a || a.t !== 'put') throw new Error('먼저 말을 놓아야 해요');
        const r = a.r | 0, c = a.c | 0, k = a.k === 'C' ? 'C' : 'S';
        const left = G.toPlace[seat];
        const ki = left.indexOf(k);
        if (ki < 0) throw new Error(KIND[k] + '은 더 놓을 수 없어요');
        if (r < 0 || r >= N || c < 0 || c >= N || occupied(G).has(r * N + c)) throw new Error('빈 칸에만 놓을 수 있어요');
        left.splice(ki, 1);
        G.pc[seat].push([r, c, k]);
        G.last = { s: seat, put: [r, c], k };
        G.pi++;
        if (G.pi < G.order.length) { G.turn = G.order[G.pi]; return; }
        G.ph = 'move';
        if (score(G).separated) return endRound(G);
        const first = nextMover(G, G.turnOrder[0], true);
        if (first < 0) return endRound(G);
        G.turn = first;
        return;
      }
      if (!a || a.t !== 'mv') throw new Error('말을 움직이고 벽을 세워 주세요');
      const i = a.i | 0, path = String(a.path || ''), b = a.b ? 1 : 0, w = String(a.w);
      if (b && !canBreak(G, seat)) throw new Error('벽 부수기를 쓸 수 없어요');
      const m = walk(G, seat, i, path, !!b);
      if (!m) throw new Error('그렇게는 움직일 수 없어요');
      if (!DIRS[w]) throw new Error('벽 방향이 잘못됐어요');
      const H = applyMove(clone(G), seat, { i, to: m.to, broke: m.broke });
      if (wallBetween(H, m.to[0], m.to[1], w)) throw new Error('그 면에는 벽을 세울 수 없어요');
      const from = G.pc[seat][i].slice(0, 2);
      applyMove(G, seat, { i, to: m.to, broke: m.broke, w });
      G.moves++;
      G.last = { s: seat, from, to: m.to, w, broke: m.broke, path };
      afterTurn(G, seat);
    },
    tick(G, now) {
      if (G.ph === 'between' && now >= G.until) { startRound(G, 2, G.next2, G.next2[0]); return true; }
      return false;
    },
    pending(G) { return G.ph === 'place' || G.ph === 'move' ? [G.turn] : []; },
    timeLimit(G) { return G.ph === 'place' ? 45000 : 90000; },
    bot(G, seat) { return think(G, seat, G.ai); },
    timeout(G, seat) { return think(G, seat, 'easy'); },
    botDelay() { return 700 + Math.random() * 700; },
    publicView(G) {
      return {
        n: G.n, rnd: G.rnd, seats: G.seats, turnOrder: G.turnOrder, ph: G.ph, turn: G.turn, pc: G.pc, hw: G.hw, vw: G.vw, brk: G.brk,
        last: G.last, moves: G.moves, pi: G.pi, order: G.order, toPlace: G.toPlace, r1: G.r1, r2: G.r2,
        rem: G.ph === 'between' ? Math.max(0, G.until - Date.now()) : 0,
      };
    },
    over(G) { return G.ph === 'end'; },
    results(G) {
      if (G.n === 3) {
        const surv = G.r1.rank[0], [w, l] = G.r2.rank;
        const places = Array(3).fill('live'); places[l] = 'exile';
        const scores = Array(3).fill(0); scores[surv] = 3; scores[w] = 2; scores[l] = 1;
        return { places, scores, r1: G.r1, r2: G.r2 };
      }
      const r = G.r2, [w, l] = r.rank;
      const draw = r.lot;
      const scores = [0, 1].map((s) => r.area[s] * 100 + r.big[s]);
      return { places: draw ? ['live', 'live'] : [0, 1].map((s) => (s === l ? 'exile' : 'live')), scores, r2: r, draw, win: draw ? -1 : w };
    },
  };

  // ---------- 컴퓨터 ----------
  // 영역 예상: 닫힌 영역은 확정, 섞인 영역은 더 가까운 사람이 차지한다고 보고 나 - (가장 센 상대)
  function evaluate(G, seat) {
    const seats = G.seats;
    const dist = {};
    for (const s of seats) {
      const d = Array(N * N).fill(99), q = [];
      (G.pc[s] || []).forEach((p) => { const k = p[0] * N + p[1]; d[k] = 0; q.push(k); });
      for (let qi = 0; qi < q.length; qi++) {
        const k = q[qi], r = Math.floor(k / N), c = k % N;
        for (const dd of 'UDLR') {
          if (wallBetween(G, r, c, dd)) continue;
          const nk = (r + DIRS[dd][0]) * N + c + DIRS[dd][1];
          if (d[nk] > d[k] + 1) { d[nk] = d[k] + 1; q.push(nk); }
        }
      }
      dist[s] = d;
    }
    const val = {};
    seats.forEach((s) => { val[s] = 0; });
    const { regs } = regions(G);
    for (const rg of regs) {
      if (rg.owners.size === 1) { val[[...rg.owners][0]] += rg.cells.length * 1.15; continue; }
      if (rg.owners.size === 0) continue;
      for (const k of rg.cells) {
        let best = 99, who = -1;
        for (const s of seats) { if (dist[s][k] < best) { best = dist[s][k]; who = s; } else if (dist[s][k] === best) who = -1; }
        if (who >= 0) val[who] += 1;
      }
    }
    let other = -Infinity;
    for (const s of seats) if (s !== seat) other = Math.max(other, val[s]);
    return val[seat] - (other === -Infinity ? 0 : other);
  }

  function think(G, seat, level) {
    const noise = level === 'easy' ? 5 : level === 'normal' ? 1.2 : 0.2;
    if (G.ph === 'place') {
      const kinds = G.toPlace[seat];
      const k = kinds.includes('S') ? 'S' : kinds[0];
      const occ = occupied(G);
      let best = null, bv = -Infinity;
      for (let cell = 0; cell < N * N; cell++) {
        if (occ.has(cell)) continue;
        const H = clone(G);
        H.pc[seat].push([Math.floor(cell / N), cell % N, k]);
        const v = evaluate(H, seat) + Math.random() * (level === 'easy' ? 6 : 0.5);
        if (v > bv) { bv = v; best = { t: 'put', r: Math.floor(cell / N), c: cell % N, k }; }
      }
      return best;
    }
    if (G.ph !== 'move') return null;
    const moves = legalMoves(G, seat);
    if (!moves.length) return null;
    const scored = moves.map((m) => {
      const H = applyMove(clone(G), seat, m);
      return { m, H, v: evaluate(H, seat) - (m.broke ? 2.5 : 0) };
    });
    let pick;
    if (level === 'hard' && G.seats.length === 2) {
      const opp = G.seats.find((s) => s !== seat);
      scored.sort((a, b) => b.v - a.v);
      const top = scored.slice(0, 10);
      for (const s of top) {
        const om = legalMoves(s.H, opp);
        let worst = Infinity;
        for (const m2 of om) { const v = evaluate(applyMove(clone(s.H), opp, m2), seat); if (v < worst) worst = v; }
        s.v2 = om.length ? worst : s.v;
      }
      top.sort((a, b) => b.v2 - a.v2 + (Math.random() - 0.5) * noise);
      pick = top[0].m;
    } else {
      let bv = -Infinity;
      for (const s of scored) { const v = s.v + Math.random() * noise; if (v > bv) { bv = v; pick = s.m; } }
    }
    return { t: 'mv', i: pick.i, path: pick.path, b: pick.b, w: pick.w };
  }

  // ---------- 화면 ----------
  const seatName = (names, s, me) => names[s] + (s === me ? ' (나)' : '');
  function renderGame(g, s) {
    const W = s.W, st = W.s, me = s.mySeat;
    const names = W.pl.map((p) => p.n);
    const L = s.local;
    const key = W.gn + ':' + st.rnd + ':' + st.moves + ':' + st.pi + ':' + st.ph;
    if (L.key !== key) { L.key = key; L.sel = null; L.dest = null; L.brk = false; }
    const inRound = me >= 0 && st.seats.includes(me);
    const myTurn = inRound && st.turn === me && (st.ph === 'place' || st.ph === 'move') && !s.waiting;
    const view = { pc: st.pc, hw: st.hw, vw: st.vw, rnd: st.rnd, brk: st.brk, seats: st.seats };
    const sc = score(view);
    if (L.kind == null || !(st.toPlace[me] || []).includes(L.kind)) L.kind = (st.toPlace[me] || [])[0] || 'S';

    g.append(h('p', { class: 'wl-round' }, st.n === 3 ? (st.rnd === 1 ? '1라운드 · 3인전 (가장 넓은 사람 생존)' : '2라운드 · 1:1 (지면 탈락)') : '1:1'));
    g.append(h('div', { class: 'wl-head' },
      st.seats.map((i) => h('span', { class: 'wl-player' + (st.turn === i && (st.ph === 'place' || st.ph === 'move') ? ' turn' : '') + (i === me ? ' me' : '') },
        h('span', { class: 'seat-dot', style: { background: `var(--p${i})` } }), seatName(names, i, me),
        h('b', { class: 'wl-score' }, String(sc.area[i])),
        st.rnd === 1 ? h('span', { class: 'chip-tag' + (st.brk[i] ? '' : ' used') }, st.brk[i] ? '💥 1' : '💥 0') : null,
        st.turn === i && (st.ph === 'place' || st.ph === 'move') ? h('span', { class: 'timer', 'data-timer-seat': i }) : null)),
      st.n === 3 && st.rnd === 2 && st.r1 ? h('span', { class: 'wl-player done' }, h('span', { class: 'seat-dot', style: { background: `var(--p${st.r1.rank[0]})` } }), seatName(names, st.r1.rank[0], me) + ' · 생존 확정') : null));

    // 라운드 사이
    if (st.ph === 'between' && st.r1) {
      const r1 = st.r1;
      g.append(h('div', { class: 'result-box' },
        h('strong', { class: 'result-big' }, '1라운드 결과'),
        h('ol', { class: 'wl-rank' }, r1.rank.map((x, k) => h('li', null, seatName(names, x, me) + ' ' + r1.area[x] + '칸' + (k === 0 ? ' · 생존 확정' : '')))),
        r1.lot ? h('p', { class: 'note' }, '영역과 가장 넓은 영역이 모두 같아 추첨으로 정했어요.') : null,
        h('p', null, '2라운드: ' + names[r1.rank[1]] + '(선) vs ' + names[r1.rank[2]] + ' · ', h('b', { 'data-until': String(Date.now() + st.rem) }, Math.ceil(st.rem / 1000) + '초'), ' 뒤 시작')));
      return;
    }

    let msg;
    if (st.ph === 'end') msg = '게임 끝';
    else if (!inRound) msg = me >= 0 ? '생존 확정! 2라운드를 지켜보는 중이에요.' : names[st.turn] + '의 차례';
    else if (st.ph === 'place') msg = (st.turn === me ? '내 차례: ' + KIND[L.kind] + '을 놓을 빈 칸을 누르세요' : names[st.turn] + '이(가) 말을 놓는 중') + ' (' + (st.pi + 1) + ' / ' + st.order.length + ')';
    else if (st.turn === me) msg = L.sel == null ? '움직일 내 말을 고르세요' : L.dest == null ? (L.brk ? '벽을 부수고 갈 칸을 고르세요' : '갈 칸을 고르세요') : '벽을 세울 면을 고르세요';
    else msg = names[st.turn] + '의 차례';
    g.append(h('p', { class: 'hint wl-msg' }, msg));
    if (myTurn && st.ph === 'place' && new Set(st.toPlace[me]).size > 1) {
      g.append(h('div', { class: 'row center' }, h('div', { class: 'seg small' }, ['S', 'C'].map((k) => h('button', { class: 'seg-btn' + (L.kind === k ? ' on' : ''), onclick: () => { L.kind = k; s.onUpdate(s); } }, (k === 'S' ? '■ ' : '● ') + KIND[k])))));
    }

    // 고른 말이 갈 수 있는 칸 (부수기 모드면 벽 하나를 지나는 길만)
    const opts = new Map();
    if (myTurn && st.ph === 'move' && L.sel != null) {
      const p = st.pc[me][L.sel];
      for (const path of PATHS[p[2]]) {
        const m = walk(view, me, L.sel, path, L.brk);
        if (m) { const k = m.to[0] * N + m.to[1]; if (!opts.has(k)) opts.set(k, { path, broke: m.broke, to: m.to }); }
      }
    }
    const destOpt = L.dest != null ? opts.get(L.dest) : null;
    const { id: regId, regs } = regions(view);
    const board = h('div', { class: 'wl-board', style: { '--n': N } });
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const k = r * N + c;
        let owner = null;
        st.pc.forEach((list, sIdx) => list.forEach((p, i) => { if (p[0] === r && p[1] === c) owner = [sIdx, i, p[2]]; }));
        const rg = regs[regId[k]];
        const terr = rg.owners.size === 1 ? [...rg.owners][0] : -1;
        const cls = ['wl-cell'];
        if (terr >= 0) cls.push('terr' + terr);
        if (opts.has(k)) cls.push('reach', L.brk ? 'reach-brk' : '');
        if (L.dest === k) cls.push('dest');
        if (st.last && st.last.to && st.last.to[0] === r && st.last.to[1] === c) cls.push('lastmv');
        const walls = [];
        if (r < N - 1 && st.hw[k] === '1') walls.push(h('span', { class: 'w-h' }));
        if (c < N - 1 && st.vw[k] === '1') walls.push(h('span', { class: 'w-v' }));
        if (destOpt && destOpt.broke && destOpt.broke[0] === r && destOpt.broke[1] === c) walls.push(h('span', { class: 'w-brk w-brk-' + destOpt.broke[2] }, '💥'));
        const cell = h('div', { class: cls.filter(Boolean).join(' '), role: 'button', tabindex: myTurn ? '0' : '-1', 'aria-label': (r + 1) + '행 ' + (c + 1) + '열' + (owner ? ' ' + names[owner[0]] + '의 ' + KIND[owner[2]] : '') },
          owner ? h('span', { class: 'piece ' + (owner[2] === 'S' ? 'sq' : 'ci') + (L.sel === owner[1] && owner[0] === me ? ' sel' : ''), style: { background: `var(--p${owner[0]})` } }) : null,
          walls);
        const click = () => {
          if (!myTurn) return;
          if (st.ph === 'place') { if (!owner) s.send({ t: 'put', r, c, k: L.kind }); return; }
          if (owner && owner[0] === me && L.dest == null) { L.sel = L.sel === owner[1] ? null : owner[1]; s.onUpdate(s); return; }
          if (L.sel != null && opts.has(k)) { L.dest = L.dest === k ? null : k; s.onUpdate(s); return; }
          if (L.sel != null && L.dest != null) { L.dest = null; s.onUpdate(s); }
        };
        cell.addEventListener('click', click);
        cell.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); click(); } });
        if (destOpt && L.dest === k) {
          const tmp = applyMove(clone(view), me, { i: L.sel, to: destOpt.to, broke: destOpt.broke });
          for (const d of openSides(tmp, r, c)) {
            cell.append(h('button', { class: 'wall-pick wp-' + d, 'aria-label': DNAME[d] + '에 벽', onclick: (e) => { e.stopPropagation(); s.send({ t: 'mv', i: L.sel, path: destOpt.path, b: L.brk ? 1 : 0, w: d }); } }));
          }
        }
        board.append(cell);
      }
    }
    g.append(h('div', { class: 'wl-wrap' }, board));
    g.append(h('p', { class: 'note wl-legend' }, '■ 사각 말: 한 방향으로 1~2칸 · ● 원형 말: 1칸, 또는 1칸 간 뒤 꺾어서 1칸 더'));
    if (myTurn && st.ph === 'move' && L.sel != null) {
      g.append(h('div', { class: 'row center wrap' },
        canBreak(view, me) ? h('button', { class: 'btn tiny' + (L.brk ? ' primary' : ''), 'aria-pressed': L.brk ? 'true' : 'false', onclick: () => { L.brk = !L.brk; L.dest = null; s.onUpdate(s); } }, L.brk ? '💥 벽 부수기 켜짐 (끄기)' : '💥 벽 부수기 쓰기 (게임 중 1번)') : null,
        h('button', { class: 'btn tiny ghost', onclick: () => { L.sel = null; L.dest = null; L.brk = false; s.onUpdate(s); } }, '선택 취소')));
    }

    if (st.ph === 'end') {
      const res = W.res || {};
      if (st.n === 3 && st.r1 && st.r2) {
        const surv = st.r1.rank[0], [w, l] = st.r2.rank;
        const mine = me === l ? '탈락…' : me === surv || me === w ? '생존!' : '게임 끝';
        g.append(h('div', { class: 'result-box' + (me >= 0 && me !== l ? ' ok' : '') },
          h('strong', { class: 'result-big' }, mine),
          h('p', null, '1라운드 생존: ' + names[surv] + ' (' + st.r1.area[surv] + '칸)'),
          h('p', null, '2라운드: ' + names[w] + ' ' + st.r2.area[w] + '칸 : ' + names[l] + ' ' + st.r2.area[l] + '칸 → ' + names[l] + ' 탈락'),
          st.r2.lot ? h('p', { class: 'note' }, '2라운드 영역과 가장 넓은 영역이 모두 같아 추첨으로 정했어요.') : null));
      } else if (st.r2) {
        const r = st.r2, [a, b] = st.seats;
        const draw = res.draw, win = draw ? -1 : r.rank[0];
        g.append(h('div', { class: 'result-box' + (win === me ? ' ok' : '') },
          h('strong', { class: 'result-big' }, draw ? '무승부' : win === me ? '승리!' : me >= 0 ? '패배' : names[win] + ' 승리'),
          h('p', null, names[a] + ' ' + r.area[a] + '칸 · ' + names[b] + ' ' + r.area[b] + '칸'),
          !draw && r.area[a] === r.area[b] ? h('p', { class: 'note' }, '영역 합이 같아 더 넓은 영역 하나를 가진 쪽이 이겼어요.') : null));
      }
    }
  }

  function renderOptions(o, s, disabled) {
    const W = s.W;
    o.append(h('p', { class: 'note' }, W.pl.length >= 3 ? '3명: 1라운드 3인전 → 2라운드 1:1 (방송과 같은 방식)' : '2명: 1:1 (방송의 2라운드 규칙). 3명이면 1라운드 3인전부터 해요.'));
    if (!W.pl.some((p) => p.b)) return;
    o.append(h('div', { class: 'toolbar' }, h('span', { class: 'opt-label' }, '컴퓨터 실력'),
      h('div', { class: 'seg small' }, [['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']].map(([v, l]) => h('button', { class: 'seg-btn' + (W.o.ai === v ? ' on' : ''), disabled, onclick: () => s.setOpt('ai', v) }, l)))));
  }

  function mount(root, ctx) {
    return App.multi.mount(root, ctx, { gameId: 'wall', engine, renderGame, renderOptions, soloLabel: '컴퓨터와 하기' });
  }

  App.games.push({
    id: 'wall',
    name: '벽바둑 2',
    kicker: '전략',
    players: '2~3인 · 온라인 / 컴퓨터',
    blurb: '사각 말과 원형 말을 움직이고 벽을 세워 내 영역을 넓힙니다. 3인전에서 1등은 생존, 나머지 둘은 1:1로 탈락자를 가려요.',
    accent: 'wall',
    mount,
    rules: `
<p>7×7 게임판 위에 벽을 세워 <b>자신의 영역을 가장 넓게</b> 만드는 게임입니다.</p>
<div class="demo" data-demo="rules-wall"></div>
<h4>말</h4>
<ul>
<li><b>■ 사각 말</b>: 상하좌우 한 방향으로 1~2칸 움직입니다.</li>
<li><b>● 원형 말</b>: 상하좌우로 1칸 움직이고, 원하면 왼쪽이나 오른쪽으로 방향을 꺾어 1칸 더 움직입니다.</li>
<li>다른 말이 있는 칸으로는 갈 수 없고, 가는 길에 벽이 있으면 그 방향으로는 움직일 수 없습니다. 판 테두리도 넘을 수 없습니다.</li>
</ul>
<h4>진행</h4>
<ul>
<li>자기 차례에는 <b>말 하나를 반드시 움직인 뒤</b>, 움직인 말이 선 칸의 상하좌우 면 중 한 곳에 <b>벽을 반드시 세웁니다.</b> 이미 벽이 있는 면이나 판 테두리에는 세울 수 없습니다.</li>
<li>모든 플레이어의 말이 있는 영역이 벽으로 서로 나뉘면 <b>즉시 끝납니다.</b> 내 말이 있는 영역의 칸 수를 모두 더한 값이 점수예요.</li>
<li>점수가 같으면 더 넓은 영역 하나를 가진 사람이 앞섭니다.</li>
</ul>
<h4>3명일 때: 방송과 같은 2라운드</h4>
<ul>
<li><b>1라운드(3인전)</b>: 각자 사각 말 1개와 원형 말 1개를 받습니다. 선 플레이어부터 순서대로 둘 중 하나를 골라 원하는 빈 칸에 놓고, 두 번째 말은 역순으로 놓습니다(1→2→3→3→2→1).</li>
<li>1라운드에서만 각자 게임 중 <b>단 한 번 벽 부수기</b>를 할 수 있습니다. 이동하는 길에 있는 벽 하나를 부수고 지나갑니다. 다 쓰지 않은 사람이 있어도 영역이 모두 나뉘면 게임은 끝납니다.</li>
<li>1라운드에서 <b>가장 넓은 영역을 만든 사람은 생존 확정</b>입니다.</li>
<li><b>2라운드(1:1)</b>: 남은 두 사람이 겨룹니다. 1라운드에서 더 넓게 확보한 사람이 선입니다. 각자 사각 말 2개와 원형 말 2개를 쓰는데, 원형 말 2개는 정해진 자리에서 시작하고 사각 말 2개를 1→2→2→1 순서로 놓습니다. 벽 부수기는 없습니다.</li>
<li><b>2라운드에서 진 사람은 탈락</b>합니다.</li>
</ul>
<h4>2명일 때</h4>
<p>2라운드 규칙으로 바로 1:1을 합니다. 영역이 넓은 쪽이 이기고, 영역 합과 가장 넓은 영역이 모두 같으면 무승부입니다.</p>
<p class="note">방송 규칙을 바탕으로 했고, 게임판 크기(7×7)와 2라운드 원형 말의 시작 자리는 이 사이트에서 정했습니다. 한 수의 제한 시간은 90초(말 놓기는 45초)이고, 시간이 지나면 컴퓨터가 대신 아무 곳에나 둡니다. 영역이 완전히 같으면 추첨으로 순위를 정합니다.</p>`,
    guide: `
<h4>1. 넓은 쪽을 먼저 막아 두기</h4>
<p>벽은 방금 움직인 말이 선 칸에만 세울 수 있습니다. 그래서 “어디에 벽을 세울지”가 곧 “어디로 말을 보낼지”를 정합니다. 내 말 근처의 넓은 빈 땅과 상대 말 사이에 벽을 하나씩 쌓아 경계를 만드세요.</p>
<div class="demo" data-demo="wall"></div>
<h4>2. 사각 말은 길게 막고, 원형 말은 모서리를 돈다</h4>
<p>사각 말은 곧게 두 칸을 가서 긴 경계를 빠르게 이어 갑니다. 대신 꺾지 못해서, 막다른 곳에 들어가면 움직임이 크게 줄어요. 원형 말은 한 번 꺾을 수 있어 대각선 자리나 모서리를 돌며 경계의 꺾이는 부분을 막기 좋습니다. 경계를 만들 때는 두 말의 역할을 나눠 보세요.</p>
<h4>3. 3인전은 “1등”만 산다</h4>
<p>1라운드에서는 2등도 1:1로 가야 합니다. 두 상대가 서로 경계를 다투는 사이에 조용히 넓은 땅을 닫아 두는 것이 좋습니다. 한 사람만 견제하다 보면 세 번째 사람이 가장 넓은 땅을 가져갑니다.</p>
<h4>4. 벽 부수기는 탈출용이자 마지막 한 방</h4>
<p>벽 부수기는 갇히기 직전에 빠져나오거나, 상대가 거의 닫아 둔 넓은 땅에 뚫고 들어가 영역을 섞어 버릴 때 가장 강합니다. 다만 영역이 모두 나뉘는 순간 게임이 끝나서, 아껴 두다가 못 쓰고 끝날 수 있어요. 상대가 마지막 경계를 닫으려 할 때가 쓸 때입니다.</p>
<h4>5. 내 말이 갇히지 않게 하기</h4>
<p>매 차례 반드시 움직여야 하므로, 말 주변 세 면이 막히면 그 말은 거의 쓸모가 없어집니다. 좁은 통로에 들어가기 전에 그 통로가 막혀도 괜찮은지 먼저 생각하세요. 반대로 상대 말을 좁은 곳에 가두면 상대는 남은 말로만 싸워야 합니다.</p>
<h4>6. 2라운드: 사각 말 두 개의 자리가 판을 가른다</h4>
<p>2라운드에서는 원형 말 자리가 정해져 있어서, 사각 말 2개를 어디에 놓느냐가 승부를 크게 가릅니다. 상대 원형 말 사이의 넓은 공간에 끼워 넣으면 상대가 그 땅을 혼자 갖지 못합니다. 앞서고 있다면 서둘러 마지막 경계를 닫고, 뒤처져 있다면 상대 영역에 말을 넣어 경계가 닫히지 않게 버티세요.</p>`,
  });

  App.wall = { engine, score, legalMoves, walk, think, PATHS, N };
})();
