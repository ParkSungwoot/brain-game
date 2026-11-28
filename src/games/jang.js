/* 카드 장기: 행마 카드 5장의 순서를 몰래 정해 두고, 번갈아 공개된 카드대로 말을 움직이는 1:1 (3판 2선승) */
(function () {
  const App = (globalThis.App = globalThis.App || {});
  const { h, rng: R } = App;

  const N = 5, ROUNDS = 3, MAX_PLY = 120;
  // 행마 카드: [행 변화, 열 변화]. 모두 상하좌우 대칭이라 방향을 따로 뒤집을 필요 없음
  const CARDS = [
    { name: '쥐', desc: '상하좌우 한 방향으로 1칸', moves: [[1, 0], [-1, 0], [0, 1], [0, -1]] },
    { name: '말', desc: '상하좌우 한 방향으로 2칸 간 뒤, 좌우로 꺾어 1칸 더', moves: [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [-1, 2], [1, -2], [-1, -2]] },
    { name: '원숭이', desc: '둘레 8칸 중 한 칸', moves: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] },
    { name: '코끼리', desc: '대각선 한 방향으로 1~2칸', moves: [[1, 1], [2, 2], [1, -1], [2, -2], [-1, 1], [-2, 2], [-1, -1], [-2, -2]] },
    { name: '기린', desc: '상하좌우 한 방향으로 2칸', moves: [[2, 0], [-2, 0], [0, 2], [0, -2]] },
  ];
  const ALL = [0, 1, 2, 3, 4];
  // 시작 배치(이 사이트에서 정함): 큰 말은 맨 뒷줄 가운데, 작은 말은 그 양옆과 앞
  const HOME = [4 * N + 2, 0 * N + 2]; // 각자 큰 말의 시작 칸
  function startBoard() {
    const b = Array(N * N).fill(null);
    b[HOME[0]] = { s: 0, k: 'B' }; b[HOME[1]] = { s: 1, k: 'B' };
    for (const i of [4 * N + 1, 4 * N + 3, 3 * N + 2]) b[i] = { s: 0, k: 'S' };
    for (const i of [0 * N + 1, 0 * N + 3, 1 * N + 2]) b[i] = { s: 1, k: 'S' };
    return b;
  }

  function targets(board, i, card) {
    const p = board[i];
    if (!p || card == null) return [];
    const r = Math.floor(i / N), c = i % N, out = [];
    for (const [dr, dc] of CARDS[card].moves) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
      const j = nr * N + nc;
      if (board[j] && board[j].s === p.s) continue;
      out.push(j);
    }
    return out;
  }
  function legal(board, seat, card) {
    const out = [];
    board.forEach((p, i) => { if (p && p.s === seat) for (const j of targets(board, i, card)) out.push([i, j]); });
    return out;
  }
  const pieces = (board, s) => board.filter((p) => p && p.s === s).length;

  // ---------- 규칙 ----------
  function pushLog(G, e) { G.log.push(e); if (G.log.length > 8) G.log.shift(); }
  function startRound(G) {
    G.board = startBoard();
    G.q = [[], []]; G.front = [null, null];
    G.turn = G.first; G.ply = 0; G.last = null; G.forcer = -1; G.rw = -1;
    // 첫 배치: 선은 5장, 후공은 4장
    G.need = [0, 0]; G.need[G.first] = 5; G.need[1 - G.first] = 4;
    G.ph = 'arrange';
  }
  function endRound(G, w, why) {
    G.rw = w; G.why = why;
    if (w >= 0) G.wins[w]++;
    G.hist.push([G.round, w]);
    const done = G.wins[0] >= 2 || G.wins[1] >= 2 || G.round >= ROUNDS;
    if (done) {
      G.ph = 'end';
      G.win = G.wins[0] === G.wins[1] ? -1 : G.wins[0] > G.wins[1] ? 0 : 1;
    } else {
      G.ph = 'between';
      G.until = Date.now() + 6000;
    }
  }
  // 움직인 뒤: 승패 확인 → 다음 카드 공개(다 썼으면 재배치) → 상대 차례
  function afterMove(G, mover, cap, to, p) {
    if (cap && cap.k === 'B') return endRound(G, cap.s === mover ? 1 - mover : mover, cap.s === mover ? '자기 큰 말이 잡혔어요' : '상대의 큰 말을 잡았어요');
    if (p && p.k === 'B' && to === HOME[1 - p.s]) return endRound(G, p.s, '큰 말이 상대 큰 말의 시작 칸에 들어갔어요');
    G.ply++;
    if (G.ply >= MAX_PLY) {
      const a = pieces(G.board, 0), b = pieces(G.board, 1);
      return endRound(G, a === b ? -1 : a > b ? 0 : 1, '수가 너무 길어져 남은 말 수로 판정했어요 (' + a + ' 대 ' + b + ')');
    }
    nextCard(G, mover);
  }
  function nextCard(G, seat) {
    if (G.q[seat].length) { G.front[seat] = G.q[seat].shift(); passTurn(G, seat); return; }
    G.front[seat] = null; G.need[seat] = 5; G.ph = 'rearr'; G.re = seat; // 마지막 카드를 썼으면 5장 재배치
  }
  function passTurn(G, seat) {
    G.ph = 'move'; G.turn = 1 - seat;
    autoPass(G);
  }
  // 공개된 카드로 움직일 말이 없으면 그 카드를 버리고 넘어감
  function autoPass(G) {
    for (let guard = 0; guard < 4 && G.ph === 'move'; guard++) {
      const s = G.turn;
      if (legal(G.board, s, G.front[s]).length) return;
      pushLog(G, [s, 'pass', G.front[s]]);
      G.ply++;
      nextCard(G, s);
    }
  }

  const engine = {
    id: 'jang',
    minPlayers: 2, maxPlayers: 2, allowBots: true, defaultBots: 2,
    defaultOpts: { ai: 'normal' },
    botNames: ['컴퓨터'],
    start(players, o) {
      const G = { round: 1, wins: [0, 0], first: Math.random() < 0.5 ? 0 : 1, log: [], hist: [], win: -1, why: '', ai: o.ai || 'normal' };
      startRound(G);
      return G;
    },
    act(G, seat, a) {
      if (!a || G.ph === 'end' || G.ph === 'between') throw new Error('지금은 둘 수 없어요');
      if (a.t === 'arr') {
        const need = G.need[seat];
        const okPh = (G.ph === 'arrange' && need && !G.front[seat] && !G.q[seat].length) || (G.ph === 'rearr' && G.re === seat);
        if (!okPh) throw new Error('지금은 카드를 배치할 수 없어요');
        const o = Array.isArray(a.o) ? a.o.map((x) => x | 0) : [];
        if (o.length !== need || new Set(o).size !== need || o.some((x) => x < 0 || x > 4)) throw new Error('카드 ' + need + '장을 서로 다르게 골라 순서를 정해 주세요');
        G.q[seat] = o.slice(); G.need[seat] = 0;
        if (G.ph === 'arrange') {
          if (!G.need[0] && !G.need[1]) {
            // 두 사람 모두 배치 → 첫 카드 동시 공개
            for (const s of [0, 1]) G.front[s] = G.q[s].shift();
            G.ph = 'move'; G.turn = G.first;
            pushLog(G, [-1, 'open']);
            autoPass(G);
          }
        } else {
          G.front[seat] = G.q[seat].shift();
          passTurn(G, seat);
        }
        return;
      }
      if (a.t === 'mv' || a.t === 'force') {
        const forced = a.t === 'force';
        if (forced ? G.ph !== 'force' || G.forcer !== seat : G.ph !== 'move' || G.turn !== seat) throw new Error('내 차례가 아니에요');
        const mover = forced ? 1 - seat : seat;
        const card = G.front[mover];
        const from = a.from | 0, to = a.to | 0;
        if (!legal(G.board, mover, card).some(([x, y]) => x === from && y === to)) throw new Error('이 카드로는 그렇게 움직일 수 없어요');
        const p = G.board[from], cap = G.board[to];
        G.board[to] = p; G.board[from] = null;
        G.last = { s: mover, from, to };
        pushLog(G, [mover, forced ? 'forced' : 'mv', card, p.k, cap ? cap.k : '']);
        G.ph = 'move'; G.forcer = -1;
        afterMove(G, mover, cap, to, p);
        return;
      }
      if (a.t === 'timeout') {
        if (G.ph !== 'move' || G.turn !== seat) throw new Error('지금은 아니에요');
        G.ph = 'force'; G.forcer = 1 - seat; // 시간 초과: 상대가 내 카드로 내 말을 움직임
        pushLog(G, [seat, 'late']);
        return;
      }
      if (a.t === 'give') { endRound(G, 1 - seat, '상대가 이번 라운드를 포기했어요'); return; }
      throw new Error('알 수 없는 행동');
    },
    tick(G, now) {
      if (G.ph === 'between' && now >= G.until) { G.round++; G.first = 1 - G.first; startRound(G); return true; }
      return false;
    },
    pending(G) {
      if (G.ph === 'arrange') return [0, 1].filter((s) => G.need[s]);
      if (G.ph === 'rearr') return [G.re];
      if (G.ph === 'move') return [G.turn];
      if (G.ph === 'force') return [G.forcer];
      return [];
    },
    timeLimit(G) { return G.ph === 'arrange' || G.ph === 'rearr' ? 180000 : 90000; },
    timeout(G, seat) {
      if (G.ph === 'arrange' || G.ph === 'rearr') return { t: 'arr', o: R.shuffle(ALL).slice(0, G.need[seat]) };
      if (G.ph === 'move') return { t: 'timeout' };
      const m = R.pick(legal(G.board, 1 - seat, G.front[1 - seat]));
      return { t: 'force', from: m[0], to: m[1] };
    },
    bot(G, seat) {
      if (G.ph === 'arrange' || G.ph === 'rearr') return botArrange(G, seat);
      if (G.ph === 'force') return botForce(G, seat);
      return botMove(G, seat, G.ai);
    },
    botDelay(G) { return G.ph === 'arrange' || G.ph === 'rearr' ? 1200 + Math.random() * 1200 : 800 + Math.random() * 700; },
    publicView(G) {
      return {
        b: G.board.map((p) => (!p ? '.' : p.s === 0 ? p.k : p.k.toLowerCase())).join(''),
        round: G.round, rounds: ROUNDS, wins: G.wins, first: G.first, ph: G.ph, turn: G.turn, front: G.front,
        qlen: G.q.map((q) => q.length), need: G.need, re: G.re, forcer: G.forcer, ply: G.ply,
        last: G.last, log: G.log, win: G.win, why: G.why, rw: G.rw, hist: G.hist,
        rem: G.ph === 'between' ? Math.max(0, G.until - Date.now()) : 0,
      };
    },
    over(G) { return G.ph === 'end'; },
    results(G) { return { win: G.win, scores: G.wins.slice() }; },
  };

  // ---------- 컴퓨터 ----------
  const rc = (i) => [Math.floor(i / N), i % N];
  const dist = (i, j) => { const [a, b] = rc(i), [c, d] = rc(j); return Math.max(Math.abs(a - c), Math.abs(b - d)); };
  function hits(board, seat, cell, cards) {
    for (const card of cards) for (const [, y] of legal(board, seat, card)) if (y === cell) return true;
    return false;
  }
  // seat 가 from→to 로 움직인 결과 점수 (상대가 다음에 쓸 카드 oppNow 는 공개돼 있음)
  function scoreMove(board, seat, from, to, oppNow) {
    const p = board[from], cap = board[to];
    if (cap && cap.k === 'B') return 10000;
    if (p.k === 'B' && to === HOME[1 - seat]) return 9000;
    const b2 = board.slice(); b2[to] = p; b2[from] = null;
    let sc = cap ? 60 : 0;
    const myBig = b2.findIndex((q) => q && q.s === seat && q.k === 'B');
    const oppCards = oppNow != null ? [oppNow] : ALL;
    if (hits(b2, 1 - seat, myBig, oppCards)) sc -= 5000;
    else if (hits(b2, 1 - seat, myBig, ALL)) sc -= 40;
    if (hits(b2, 1 - seat, HOME[seat], oppCards) && b2.some((q, i) => q && q.s !== seat && q.k === 'B' && targets(b2, i, oppNow).includes(HOME[seat]))) sc -= 4000;
    if (hits(b2, 1 - seat, to, oppCards)) sc -= 25;
    // 내 큰 말을 상대 시작 칸 쪽으로, 상대 큰 말을 노리는 위치로
    const oppBig = b2.findIndex((q) => q && q.s !== seat && q.k === 'B');
    if (p.k === 'B') sc += (dist(from, HOME[1 - seat]) - dist(to, HOME[1 - seat])) * 4;
    if (oppBig >= 0) sc += (dist(from, oppBig) - dist(to, oppBig)) * 3;
    return sc;
  }
  function botMove(G, seat, level) {
    const moves = legal(G.board, seat, G.front[seat]);
    if (!moves.length) return null;
    if (level === 'easy' && Math.random() < 0.4) { const m = R.pick(moves); return { t: 'mv', from: m[0], to: m[1] }; }
    let best = moves[0], bs = -Infinity;
    for (const [f, t] of moves) {
      const sc = scoreMove(G.board, seat, f, t, G.front[1 - seat]) + Math.random() * (level === 'easy' ? 30 : 3);
      if (sc > bs) { bs = sc; best = [f, t]; }
    }
    return { t: 'mv', from: best[0], to: best[1] };
  }
  // 시간을 넘긴 상대의 말을 내가 움직일 때: 상대에게 가장 나쁜 수
  function botForce(G, seat) {
    const victim = 1 - seat;
    const moves = legal(G.board, victim, G.front[victim]);
    let best = moves[0], bs = Infinity;
    for (const [f, t] of moves) { const sc = scoreMove(G.board, victim, f, t, G.front[seat]) + Math.random(); if (sc < bs) { bs = sc; best = [f, t]; } }
    return { t: 'force', from: best[0], to: best[1] };
  }
  function botArrange(G, seat) {
    const need = G.need[seat];
    if (G.ai === 'easy') return { t: 'arr', o: R.shuffle(ALL).slice(0, need) };
    // 상대가 가만히 있다고 보고 순서를 시험해서 많이 나아가는 순서를 고름
    const perms = [];
    (function gen(arr, rest) { if (arr.length === need) { perms.push(arr); return; } rest.forEach((x, i) => gen(arr.concat([x]), rest.filter((_, j) => j !== i))); })([], ALL);
    let best = perms[0], bs = -Infinity;
    for (const o of perms) {
      let board = G.board.slice(), sc = Math.random() * 6;
      for (const card of o) {
        const ms = legal(board, seat, card);
        if (!ms.length) { sc -= 3; continue; }
        let bm = null, bms = -Infinity;
        for (const [f, t] of ms) { const v = scoreMove(board, seat, f, t, null); if (v > bms) { bms = v; bm = [f, t]; } }
        sc += Math.max(-30, Math.min(bms, 300)) * 0.1;
        board = board.slice(); board[bm[1]] = board[bm[0]]; board[bm[0]] = null;
      }
      if (sc > bs) { bs = sc; best = o; }
    }
    return { t: 'arr', o: best };
  }

  // ---------- 화면 ----------
  function cardEl(id, opts) {
    opts = opts || {};
    const c = CARDS[id];
    const g = h('div', { class: 'jg-pat' });
    const set = new Set(c.moves.map(([dr, dc]) => (2 + dr) * 5 + (2 + dc)));
    for (let i = 0; i < 25; i++) g.append(h('span', { class: i === 12 ? 'me' : set.has(i) ? 'mv' : '' }));
    return h(opts.button ? 'button' : 'div', { class: 'jg-card' + (opts.cls ? ' ' + opts.cls : ''), type: opts.button ? 'button' : null, onclick: opts.onclick, disabled: opts.disabled, 'aria-label': '카드 ' + c.name + ': ' + c.desc, title: c.desc },
      h('b', null, c.name), g);
  }
  const PNAME = { B: '큰 말', S: '작은 말' };

  function renderGame(g, s) {
    const W = s.W, st = W.s, me = s.mySeat;
    const names = W.pl.map((p) => p.n);
    const L = s.local;
    const rkey = W.gn + ':' + st.round;
    if (L.rkey !== rkey) { L.rkey = rkey; L.seq = []; L.mine = []; }
    const skey = rkey + ':' + st.ply + ':' + st.ph;
    if (L.skey !== skey) { L.skey = skey; L.sel = null; }
    const viewer = me >= 0 ? me : 0;
    const flip = viewer === 1;
    const board = st.b.split('').map((ch) => (ch === '.' ? null : { s: ch === ch.toUpperCase() ? 0 : 1, k: ch.toUpperCase() }));
    const myTurn = me >= 0 && st.ph === 'move' && st.turn === me && !s.waiting;
    const forcing = me >= 0 && st.ph === 'force' && st.forcer === me && !s.waiting;
    const mover = forcing ? 1 - me : me;
    const useCard = myTurn || forcing ? st.front[mover] : null;
    const active = (i) => (st.ph === 'move' && st.turn === i) || (st.ph === 'force' && st.forcer === i) || (st.ph === 'rearr' && st.re === i) || (st.ph === 'arrange' && st.need[i]);

    g.append(h('div', { class: 'wl-head' },
      [0, 1].map((i) => h('span', { class: 'wl-player' + (active(i) ? ' turn' : '') },
        App.avatar.seat(W, i), names[i], i === me ? ' (나)' : '', i === st.first ? h('span', { class: 'chip-tag' }, '선') : null,
        h('b', { class: 'wl-score' }, '●'.repeat(st.wins[i]) + '○'.repeat(Math.max(0, 2 - st.wins[i]))),
        active(i) ? h('span', { class: 'timer', 'data-timer-seat': i }) : null)),
      h('span', { class: 'pill' }, '라운드 ' + st.round + ' / ' + st.rounds + ' · 2판 먼저')));

    // 판
    const legalNow = useCard != null ? legal(board, mover, useCard) : [];
    const fromSet = new Set(legalNow.map((m) => m[0]));
    const toSet = new Set(L.sel != null ? legalNow.filter((m) => m[0] === L.sel).map((m) => m[1]) : []);
    const grid = h('div', { class: 'jg-board' });
    for (let vr = 0; vr < N; vr++) for (let vc = 0; vc < N; vc++) {
      const r = flip ? N - 1 - vr : vr, c = flip ? N - 1 - vc : vc;
      const i = r * N + c;
      const p = board[i];
      const cls = ['jg-cell'];
      if (i === HOME[0] || i === HOME[1]) cls.push('home');
      if (st.last && (st.last.from === i || st.last.to === i)) cls.push('last');
      if (fromSet.has(i)) cls.push('can');
      if (L.sel === i) cls.push('sel');
      if (toSet.has(i)) cls.push('dest');
      const cell = h('button', { class: cls.join(' '), type: 'button', 'aria-label': (p ? names[p.s] + '의 ' + PNAME[p.k] : '빈 칸') + (i === HOME[0] || i === HOME[1] ? ' (큰 말 시작 칸)' : '') },
        p ? h('span', { class: 'jg-piece' + (p.k === 'B' ? ' king' : ''), style: { background: `var(--p${p.s})` } }, p.k === 'B' ? '大' : '小') : null);
      cell.addEventListener('click', () => {
        if (!(myTurn || forcing)) return;
        if (toSet.has(i)) { s.send({ t: forcing ? 'force' : 'mv', from: L.sel, to: i }); return; }
        if (fromSet.has(i)) { L.sel = L.sel === i ? null : i; s.onUpdate(s); }
      });
      grid.append(cell);
    }
    const side = h('div', { class: 'jg-side' });
    g.append(h('div', { class: 'jg-layout' }, h('div', { class: 'jg-board-wrap' }, grid), side));

    // 카드 배치 (처음 / 다 쓴 뒤 재배치)
    const iArrange = me >= 0 && ((st.ph === 'arrange' && st.need[me]) || (st.ph === 'rearr' && st.re === me));
    if (iArrange) {
      const need = st.need[me];
      const remaining = ALL.filter((c) => !L.seq.includes(c));
      side.append(
        h('h4', { class: 'sub' }, (st.ph === 'arrange' ? '카드 ' + need + '장의 순서를 몰래 정하세요' : '카드를 다 썼어요! 5장을 다시 배치하세요')),
        h('p', { class: 'note' }, (need === 4 ? '첫 배치에서 후공은 4장만 놓아요. ' : '') + '카드를 누르면 다음 순서 칸에 들어가요. 칸을 누르면 빠져요. 3분 안에 정하세요.'),
        h('div', { class: 'jg-slots' }, Array.from({ length: need }, (_, k) => (L.seq[k] != null
          ? cardEl(L.seq[k], { button: true, cls: 'slot filled', onclick: () => { L.seq.splice(k, 1); s.onUpdate(s); } })
          : h('div', { class: 'jg-card slot empty' }, h('b', null, (k + 1) + '번'))))),
        h('div', { class: 'jg-hand' }, remaining.map((c) => cardEl(c, { button: true, onclick: () => { if (L.seq.length < need) { L.seq.push(c); s.onUpdate(s); } } }))),
        h('div', { class: 'row wrap' },
          h('button', { class: 'btn primary', disabled: L.seq.length !== need || s.waiting, onclick: () => { L.mine = L.seq.slice(1); s.send({ t: 'arr', o: L.seq.slice() }); L.seq = []; } }, '배치 확정'),
          h('button', { class: 'btn ghost tiny', onclick: () => { L.seq = []; s.onUpdate(s); } }, '비우기')));
    } else if (st.ph === 'arrange' || st.ph === 'rearr') {
      side.append(h('p', { class: 'status' }, st.ph === 'arrange' ? (me >= 0 && !st.need[me] ? '배치를 마쳤어요. 상대를 기다리는 중…' : '두 사람이 카드 순서를 정하는 중…') : names[st.re] + '이(가) 카드 5장을 다시 배치하는 중…'));
    }

    // 공개된 카드와 남은 순서
    if (st.ph !== 'arrange') {
      const rowFor = (seat) => {
        const hidden = st.qlen[seat];
        const mine = seat === me ? L.mine.slice(Math.max(0, L.mine.length - hidden)) : null;
        return h('div', { class: 'jg-seq' }, h('span', { class: 'jg-seq-name' }, App.avatar.seat(W, seat), names[seat] + (seat === me ? ' (나)' : '')),
          h('div', { class: 'jg-seq-cards' },
            st.front[seat] != null ? cardEl(st.front[seat], { cls: 'cur' }) : h('div', { class: 'jg-card back' }, h('b', null, '배치 중')),
            Array.from({ length: hidden }, (_, k) => (mine && mine[k] != null ? cardEl(mine[k], { cls: 'secret' }) : h('div', { class: 'jg-card back' }, h('b', null, '?'))))));
      };
      side.append(rowFor(viewer), rowFor(1 - viewer));
      if (st.ph === 'move') {
        if (myTurn) side.append(h('p', { class: 'status strong' }, '내 차례: “' + CARDS[st.front[me]].name + '” 카드로 말 하나를 움직이세요. (' + CARDS[st.front[me]].desc + ')'));
        else side.append(h('p', { class: 'status' }, names[st.turn] + '이(가) “' + CARDS[st.front[st.turn]].name + '” 카드로 움직이는 중…'));
      }
      if (st.ph === 'force') {
        if (forcing) side.append(h('p', { class: 'status strong' }, names[1 - me] + '이(가) 시간을 넘겼어요! 상대의 “' + CARDS[st.front[1 - me]].name + '” 카드로 상대 말 하나를 내가 움직여요.'));
        else side.append(h('p', { class: 'status' }, (me >= 0 && st.forcer === 1 - me ? '시간을 넘겨서 상대가 내 카드로 내 말을 움직이는 중…' : names[st.forcer] + '이(가) 상대 말을 움직이는 중…')));
      }
      if (st.log.length) side.append(h('ul', { class: 'hv-log' }, st.log.slice().reverse().slice(0, 5).map((e) => {
        if (e[1] === 'open') return h('li', null, '두 사람의 첫 카드를 동시에 공개했어요');
        if (e[1] === 'pass') return h('li', null, names[e[0]] + ': “' + CARDS[e[2]].name + '”로 움직일 수 있는 말이 없어 넘어갔어요');
        if (e[1] === 'late') return h('li', null, names[e[0]] + ': 시간 초과! 상대가 대신 움직여요');
        return h('li', { class: e[4] ? 'boom' : '' }, names[e[0]] + ': “' + CARDS[e[2]].name + '”로 ' + PNAME[e[3]] + ' 이동' + (e[1] === 'forced' ? ' (상대가 대신)' : '') + (e[4] ? ' — ' + PNAME[e[4]] + '을 잡음' : ''));
      })));
      if ((st.ph === 'move' || st.ph === 'force') && me >= 0) side.append(h('button', { class: 'btn ghost tiny', onclick: () => s.send({ t: 'give' }) }, '이번 라운드 포기'));
    }
    if (st.ph === 'between' || st.ph === 'end') {
      const fin = st.ph === 'end';
      g.append(h('div', { class: 'result-box' + ((fin ? st.win : st.rw) === me ? ' ok' : '') },
        h('strong', { class: 'result-big' }, fin ? (st.win === -1 ? '무승부' : st.win === me ? '최종 승리!' : me >= 0 ? '최종 패배' : names[st.win] + ' 최종 승리') : '라운드 ' + st.round + ': ' + (st.rw >= 0 ? names[st.rw] + ' 승리' : '무승부')),
        h('p', null, st.why),
        h('p', null, '라운드 승리 ' + names[0] + ' ' + st.wins[0] + ' : ' + st.wins[1] + ' ' + names[1]),
        fin ? null : h('p', { class: 'note' }, '다음 라운드는 선후공을 바꿔서 ', h('b', { 'data-until': String(Date.now() + st.rem) }, Math.ceil(st.rem / 1000) + '초'), ' 뒤에 시작해요.')));
    }
  }

  function renderOptions(o, s, disabled) {
    const W = s.W;
    if (!W.pl.some((p) => p.b)) return;
    o.append(h('div', { class: 'toolbar' }, h('span', { class: 'opt-label' }, '컴퓨터 실력'),
      h('div', { class: 'seg small' }, [['easy', '쉬움'], ['normal', '보통']].map(([v, l]) => h('button', { class: 'seg-btn' + (W.o.ai === v ? ' on' : ''), disabled, onclick: () => s.setOpt('ai', v) }, l)))));
  }

  function mount(root, ctx) {
    return App.multi.mount(root, ctx, { gameId: 'jang', engine, renderGame, renderOptions, soloLabel: '컴퓨터와 1:1' });
  }

  App.games.push({
    id: 'jang',
    name: '카드 장기',
    kicker: '결승 전략',
    players: '1:1 · 온라인 / 컴퓨터',
    blurb: '쥐·말·원숭이·코끼리·기린 행마 카드 5장의 순서를 몰래 정하고, 공개된 카드대로 번갈아 말을 움직입니다. 상대 큰 말을 잡거나 그 시작 칸에 들어가면 승리. 3판 2선승.',
    accent: 'jang',
    mount,
    rules: `
<p>행마 카드를 배치하고 사용해서 말을 전략적으로 움직이는 1:1 게임입니다.</p>
<div class="demo" data-demo="rules-jang"></div>
<h4>준비</h4>
<ul>
<li>두 사람은 각자 <b>큰 말 1개, 작은 말 3개, 행마 카드 5장</b>을 받습니다. 말은 시작 자리에 미리 놓여 있습니다.</li>
<li><b>행마 카드</b>
  <ul>
  <li><b>쥐</b>: 상하좌우 중 한 방향으로 1칸</li>
  <li><b>말</b>: 상하좌우 중 한 방향으로 2칸 간 뒤, 좌우로 꺾어 1칸 더</li>
  <li><b>원숭이</b>: 둘레 8칸 중 한 칸</li>
  <li><b>코끼리</b>: 대각선 중 한 방향으로 1~2칸</li>
  <li><b>기린</b>: 상하좌우 중 한 방향으로 2칸</li>
  </ul></li>
<li>1라운드 선후공은 동전 던지기(무작위)로 정하고, 다음 라운드부터는 번갈아 선이 됩니다.</li>
</ul>
<h4>카드 배치</h4>
<ul>
<li>각자 사용할 카드의 순서를 정해 뒤집어 놓습니다. <b>첫 배치에 한해 후공은 4장만</b> 놓습니다.</li>
<li>첫 배치가 끝나면 두 사람이 동시에 첫 번째 카드를 공개합니다.</li>
<li>마지막 카드를 쓸 때마다 3분 안에 5장을 다시 배치하고, 첫 카드를 공개합니다.</li>
</ul>
<h4>말 이동</h4>
<ul>
<li>선공부터 90초 안에 <b>공개된 내 카드대로 원하는 말 하나</b>를 움직이고, 다음 순서의 카드를 공개합니다. 그다음 상대 차례입니다.</li>
<li>상대 말이 있는 칸으로 가면 그 말을 잡습니다. 내 말이 있는 칸으로는 갈 수 없습니다.</li>
<li>시간을 넘기면 <b>상대가</b> 내 카드대로 원하는 내 말을 움직입니다.</li>
</ul>
<h4>승리</h4>
<ul>
<li>상대의 <b>큰 말을 잡거나</b>, 내 <b>큰 말이 상대 큰 말의 시작 칸(★)</b>에 들어가면 그 라운드를 이깁니다.</li>
<li>총 3라운드이고, <b>먼저 두 라운드를 이기면</b> 승리합니다.</li>
</ul>
<p class="note">방송 규칙을 바탕으로 했고, 5×5 판과 시작 자리(큰 말은 맨 뒷줄 가운데, 작은 말은 그 양옆과 앞), 말이 다른 말을 뛰어넘을 수 있는 점, 움직일 말이 없으면 그 카드를 버리고 넘어가는 점, 한 라운드가 ${MAX_PLY}수를 넘으면 남은 말 수로 판정하는 점은 이 사이트에서 정했습니다.</p>`,
    guide: `
<h4>1. 상대의 다음 카드는 보인다</h4>
<p>카드를 쓰고 나면 바로 다음 카드를 공개하므로, 내 차례에는 상대가 다음에 쓸 카드가 이미 보입니다. 그 카드로 내 큰 말이 잡히는 자리, 또는 상대 큰 말이 내 시작 칸(★)에 들어오는 자리가 없는지부터 확인하세요.</p>
<div class="demo" data-demo="jang"></div>
<h4>2. 큰 말은 공격수이자 약점</h4>
<p>큰 말이 상대 시작 칸에 들어가면 이기지만, 잡히면 바로 집니다. 큰 말을 앞으로 내보낼 때는 상대의 공개된 카드 범위 밖에 두고, 작은 말로 길을 열어 주세요.</p>
<h4>3. 카드 순서는 “내가 쓸 차례”로 생각하기</h4>
<p>카드는 번갈아 한 장씩 쓰이니, 순서를 정할 때 각 카드가 쓰일 즈음 판이 어떻게 될지 떠올려 보세요. 멀리 가는 기린·코끼리·말로 공격하고, 쥐·원숭이로 가까운 위험을 막는 식으로 섞어 두면 좋습니다.</p>
<h4>4. 재배치 타이밍과 후공의 4장</h4>
<p>후공은 첫 배치에서 4장만 놓아서 재배치가 한 차례 빨리 옵니다. 재배치 직후에는 상대가 내 다음 카드를 모르므로 기습하기 좋습니다. 반대로 상대가 재배치할 때는 어떤 카드든 나올 수 있다고 보고 큰 말을 안전한 곳에 두세요.</p>
<h4>5. 시간을 넘기지 않기</h4>
<p>90초를 넘기면 상대가 내 카드로 내 말을 움직입니다. 상대는 당연히 나에게 가장 나쁜 수를 고르니, 시간 안에 꼭 두세요.</p>`,
  });

  App.jang = { engine, legal, CARDS, HOME, startBoard };
})();
