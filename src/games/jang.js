/* 카드 장기: 이동 카드 5장의 순서를 몰래 정하고, 한 장씩 동시에 공개하며 말을 움직이는 1:1 장기 */
(function () {
  const App = (globalThis.App = globalThis.App || {});
  const { h, rng: R } = App;

  const ROWS = 6, COLS = 5, ROUNDS = 6;
  // 이동은 [앞으로, 옆으로] (앞 = 상대 쪽). 모든 카드는 좌우 대칭
  const CARDS = [
    { name: '전진', moves: [[1, 0]] },
    { name: '돌진', moves: [[1, 0], [2, 0]], slide: true },
    { name: '옆걸음', moves: [[0, 1], [0, -1]] },
    { name: '사선', moves: [[1, 1], [1, -1]] },
    { name: '후퇴', moves: [[-1, 0], [-1, 1], [-1, -1]] },
    { name: '말', moves: [[2, 1], [2, -1], [1, 2], [1, -2]] },
    { name: '한 걸음', moves: [[1, 0], [1, 1], [1, -1], [0, 1], [0, -1], [-1, 0], [-1, 1], [-1, -1]] },
    { name: '긴 사선', moves: [[1, 1], [1, -1], [2, 2], [2, -2]], slide: true },
  ];
  const KING_HOME = [5 * COLS + 2, 0 * COLS + 2];
  const inPalace = (seat, i) => { const r = Math.floor(i / COLS), c = i % COLS; return c >= 1 && c <= 3 && (seat === 0 ? r >= 4 : r <= 1); };

  function moveTargets(board, i, cardId) {
    const p = board[i];
    if (!p) return [];
    const card = CARDS[cardId];
    const r = Math.floor(i / COLS), c = i % COLS;
    const fwd = p.s === 0 ? -1 : 1, side = p.s === 0 ? 1 : -1;
    const out = [];
    for (const [f, d] of card.moves) {
      const nr = r + f * fwd, nc = c + d * side;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      if (card.slide && (Math.abs(f) === 2 || Math.abs(d) === 2)) {
        const mr = r + (f / 2) * fwd, mc = c + (d / 2) * side;
        if (board[mr * COLS + mc]) continue;
      }
      const j = nr * COLS + nc;
      if (board[j] && board[j].s === p.s) continue;
      if (p.k === 'K' && !inPalace(p.s, j)) continue;
      out.push(j);
    }
    return out;
  }
  function legal(board, seat, cardId) {
    const out = [];
    board.forEach((p, i) => { if (p && p.s === seat) for (const j of moveTargets(board, i, cardId)) out.push([i, j]); });
    return out;
  }

  // ---------- 규칙 ----------
  function newRound(G) {
    G.round++;
    if (G.round > ROUNDS) {
      const cnt = [0, 1].map((s) => G.board.filter((p) => p && p.s === s).length);
      G.ph = 'end';
      G.win = cnt[0] === cnt[1] ? -1 : cnt[0] > cnt[1] ? 0 : 1;
      G.why = ROUNDS + '라운드가 끝나 남은 말 수로 판정 (' + cnt[0] + ' 대 ' + cnt[1] + ')';
      return;
    }
    G.deal = R.shuffle([...CARDS.keys()]).slice(0, 5).sort((a, b) => a - b);
    G.order = [null, null];
    G.ph = 'order';
    G.k = 0;
  }
  function startStep(G) {
    G.half = 0;
    G.cur = G.gstep % 2 === 0 ? G.first : 1 - G.first;
    autoPass(G);
  }
  function advance(G) {
    if (G.ph !== 'play') return;
    if (G.half === 0) { G.half = 1; G.cur = 1 - G.cur; autoPass(G); return; }
    G.k++; G.gstep++;
    if (G.k >= 5) newRound(G); else startStep(G);
  }
  function autoPass(G) {
    const card = G.order[G.cur][G.k];
    if (!legal(G.board, G.cur, card).length) {
      pushLog(G, [G.cur, 'pass', card]);
      advance(G);
    }
  }
  function pushLog(G, e) { G.log.push(e); if (G.log.length > 8) G.log.shift(); }

  const engine = {
    id: 'jang',
    minPlayers: 2, maxPlayers: 2, allowBots: true, defaultBots: 2,
    defaultOpts: { ai: 'normal' },
    botNames: ['장기 봇'],
    start(players, o) {
      const board = Array(ROWS * COLS).fill(null);
      board[KING_HOME[0]] = { s: 0, k: 'K' }; board[KING_HOME[1]] = { s: 1, k: 'K' };
      for (const c of [0, 1, 3, 4]) { board[4 * COLS + c] = { s: 0, k: 'P' }; board[1 * COLS + c] = { s: 1, k: 'P' }; }
      const G = { board, round: 0, gstep: 0, first: Math.random() < 0.5 ? 0 : 1, ph: 'order', deal: [], order: [null, null], k: 0, half: 0, cur: -1, last: null, log: [], win: -1, why: '', ai: o.ai || 'normal' };
      newRound(G);
      return G;
    },
    act(G, seat, a) {
      if (!a || G.ph === 'end') throw new Error('게임이 끝났어요');
      if (a.t === 'order') {
        if (G.ph !== 'order' || G.order[seat]) throw new Error('지금은 순서를 정할 수 없어요');
        const o = Array.isArray(a.o) ? a.o.map((x) => x | 0) : [];
        if (o.length !== 5 || [...o].sort((x, y) => x - y).join() !== G.deal.join()) throw new Error('이번 라운드 카드 5장을 모두 한 번씩 써야 해요');
        G.order[seat] = o;
        if (G.order[0] && G.order[1]) { G.ph = 'play'; startStep(G); }
        return;
      }
      if (a.t === 'mv') {
        if (G.ph !== 'play' || G.cur !== seat) throw new Error('내 차례가 아니에요');
        const card = G.order[seat][G.k];
        const from = a.from | 0, to = a.to | 0;
        if (!legal(G.board, seat, card).some(([x, y]) => x === from && y === to)) throw new Error('이 카드로는 그렇게 움직일 수 없어요');
        const p = G.board[from], cap = G.board[to];
        G.board[to] = p; G.board[from] = null;
        G.last = { s: seat, from, to };
        pushLog(G, [seat, 'mv', card, p.k, from, to, cap ? cap.k : '']);
        if (cap && cap.k === 'K') { G.ph = 'end'; G.win = seat; G.why = '상대의 궁을 잡았어요'; return; }
        if (to === KING_HOME[1 - seat] && p.k === 'P') { G.ph = 'end'; G.win = seat; G.why = '졸이 상대 궁 자리에 들어갔어요'; return; }
        advance(G);
        return;
      }
      if (a.t === 'give') { G.ph = 'end'; G.win = 1 - seat; G.why = '상대가 기권했어요'; return; }
      throw new Error('알 수 없는 행동');
    },
    pending(G) { return G.ph === 'order' ? [0, 1].filter((s) => !G.order[s]) : G.ph === 'play' ? [G.cur] : []; },
    timeLimit(G) { return G.ph === 'order' ? 75000 : 30000; },
    timeout(G, seat) { return G.ph === 'order' ? { t: 'order', o: R.shuffle(G.deal) } : botMove(G, seat, 'easy'); },
    bot(G, seat) { return G.ph === 'order' ? botOrder(G, seat) : botMove(G, seat, G.ai); },
    botDelay(G) { return G.ph === 'order' ? 1200 + Math.random() * 1500 : 700 + Math.random() * 700; },
    publicView(G) {
      const shown = G.ph === 'end' ? 5 : G.ph === 'play' ? G.k + 1 : 0;
      return {
        b: G.board.map((p) => (!p ? '.' : p.s === 0 ? p.k : p.k.toLowerCase())).join(''),
        round: G.round, rounds: ROUNDS, ph: G.ph, deal: G.deal, ready: G.order.map((x) => (x ? 1 : 0)),
        rev: G.order.map((o) => (o ? o.slice(0, shown) : [])), k: G.k, half: G.half, cur: G.cur, first: G.first, gstep: G.gstep,
        last: G.last, log: G.log, win: G.win, why: G.why,
      };
    },
    over(G) { return G.ph === 'end'; },
    results(G) { return { win: G.win, scores: [0, 1].map((s) => (s === G.win ? 1 : 0)) }; },
  };

  // ---------- 컴퓨터 ----------
  const rc = (i) => [Math.floor(i / COLS), i % COLS];
  function distTo(i, j) { const [a, b] = rc(i), [c, d] = rc(j); return Math.max(Math.abs(a - c), Math.abs(b - d)); }
  function threatened(board, seat, cell, cards) {
    for (const card of cards) for (const [, y] of legal(board, 1 - seat, card)) if (y === cell) return true;
    return false;
  }
  function scoreMove(G, board, seat, from, to, oppNow, oppLater) {
    const p = board[from], cap = board[to];
    if (cap && cap.k === 'K') return 10000;
    if (p.k === 'P' && to === KING_HOME[1 - seat]) return 9000;
    const b2 = board.slice(); b2[to] = p; b2[from] = null;
    let sc = cap ? 40 : 0;
    if (p.k === 'P') sc += (distTo(from, KING_HOME[1 - seat]) - distTo(to, KING_HOME[1 - seat])) * 6;
    const myKing = b2.findIndex((q) => q && q.s === seat && q.k === 'K');
    if (oppNow.length && threatened(b2, seat, myKing, oppNow)) sc -= 3000;
    else if (threatened(b2, seat, myKing, oppLater)) sc -= 60;
    if (oppNow.length && threatened(b2, seat, to, oppNow)) sc -= p.k === 'P' ? 30 : 0;
    else if (threatened(b2, seat, to, oppLater)) sc -= 8;
    // 상대 졸이 내 궁 자리에 다가오는 것 막기
    b2.forEach((q, i) => { if (q && q.s !== seat && q.k === 'P') sc -= Math.max(0, 4 - distTo(i, KING_HOME[seat])) * 3; });
    return sc;
  }
  function botMove(G, seat, level) {
    const card = G.order[seat][G.k];
    const moves = legal(G.board, seat, card);
    if (!moves.length) return null;
    if (level === 'easy' && Math.random() < 0.5) { const m = R.pick(moves); return { t: 'mv', from: m[0], to: m[1] }; }
    const opp = 1 - seat;
    const oppNow = G.half === 0 ? [G.order[opp][G.k]] : [];
    const usedOpp = G.order[opp].slice(0, G.k + 1);
    const oppLater = G.deal.filter((c) => !usedOpp.includes(c));
    let best = moves[0], bs = -Infinity;
    for (const [f, t] of moves) {
      const sc = scoreMove(G, G.board, seat, f, t, oppNow, oppLater) + Math.random() * (level === 'easy' ? 25 : 3);
      if (sc > bs) { bs = sc; best = [f, t]; }
    }
    return { t: 'mv', from: best[0], to: best[1] };
  }
  function botOrder(G, seat) {
    if (G.ai === 'easy') return { t: 'order', o: R.shuffle(G.deal) };
    // 상대가 가만히 있다고 보고 각 순서를 혼자 시험해 본 뒤, 앞으로 많이 나아가는 순서를 고름
    const perms = [];
    (function gen(arr, rest) { if (!rest.length) { perms.push(arr); return; } rest.forEach((x, i) => gen(arr.concat([x]), rest.filter((_, j) => j !== i))); })([], G.deal);
    let best = perms[0], bs = -Infinity;
    for (const o of perms) {
      let board = G.board.slice(), sc = Math.random() * 4;
      for (const card of o) {
        const ms = legal(board, seat, card);
        if (!ms.length) { sc -= 2; continue; }
        let bm = null, bms = -Infinity;
        for (const [f, t] of ms) { const v = scoreMove(G, board, seat, f, t, [], []); if (v > bms) { bms = v; bm = [f, t]; } }
        sc += Math.max(-20, Math.min(bms, 200)) * 0.1;
        board = board.slice(); board[bm[1]] = board[bm[0]]; board[bm[0]] = null;
      }
      if (sc > bs) { bs = sc; best = o; }
    }
    return { t: 'order', o: best };
  }

  // ---------- 화면 ----------
  function cardEl(id, opts) {
    opts = opts || {};
    const c = CARDS[id];
    const g = h('div', { class: 'jg-pat' });
    const set = new Set(c.moves.map(([f, d]) => (2 - f) * 5 + (2 + d)));
    for (let i = 0; i < 25; i++) g.append(h('span', { class: i === 12 ? 'me' : set.has(i) ? 'mv' : '' }));
    return h(opts.button ? 'button' : 'div', { class: 'jg-card' + (opts.cls ? ' ' + opts.cls : ''), type: opts.button ? 'button' : null, onclick: opts.onclick, disabled: opts.disabled, 'aria-label': '카드 ' + c.name },
      h('b', null, c.name), g);
  }

  function renderGame(g, s) {
    const W = s.W, st = W.s, me = s.mySeat;
    const names = W.pl.map((p) => p.n);
    const L = s.local;
    const rkey = W.gn + ':' + st.round;
    if (L.rkey !== rkey) { L.rkey = rkey; L.seq = []; L.mine = null; }
    const skey = rkey + ':' + st.gstep + ':' + st.half;
    if (L.skey !== skey) { L.skey = skey; L.sel = null; }
    const viewer = me >= 0 ? me : 0;
    const flip = viewer === 1;
    const board = st.b.split('').map((ch) => (ch === '.' ? null : { s: ch === ch.toUpperCase() ? 0 : 1, k: ch.toUpperCase() }));
    const myTurn = me >= 0 && st.ph === 'play' && st.cur === me && !s.waiting;
    const myCard = st.ph === 'play' && me >= 0 ? (st.rev[me] || [])[st.k] : null;

    g.append(h('div', { class: 'wl-head' },
      [0, 1].map((i) => h('span', { class: 'wl-player' + (st.ph === 'play' && st.cur === i ? ' turn' : '') },
        h('span', { class: 'seat-dot', style: { background: `var(--p${i})` } }), names[i], i === me ? ' (나)' : '',
        st.ph === 'order' ? (st.ready[i] ? h('span', { class: 'chip-tag' }, '순서 확정') : h('span', { class: 'chip-tag warn' }, '고르는 중')) : null,
        (st.ph === 'play' && st.cur === i) || (st.ph === 'order' && !st.ready[i]) ? h('span', { class: 'timer', 'data-timer-seat': i }) : null)),
      h('span', { class: 'pill' }, '라운드 ' + Math.min(st.round, st.rounds) + ' / ' + st.rounds),
      st.ph === 'play' ? h('span', { class: 'pill strong' }, (st.k + 1) + '번째 카드') : null));

    // 판
    const legalNow = myTurn ? legal(board, me, myCard) : [];
    const fromSet = new Set(legalNow.map((m) => m[0]));
    const toSet = new Set(L.sel != null ? legalNow.filter((m) => m[0] === L.sel).map((m) => m[1]) : []);
    const grid = h('div', { class: 'jg-board' });
    for (let vr = 0; vr < ROWS; vr++) for (let vc = 0; vc < COLS; vc++) {
      const r = flip ? ROWS - 1 - vr : vr, c = flip ? COLS - 1 - vc : vc;
      const i = r * COLS + c;
      const p = board[i];
      const cls = ['jg-cell'];
      if (inPalace(0, i) || inPalace(1, i)) cls.push('palace');
      if (i === KING_HOME[0] || i === KING_HOME[1]) cls.push('home');
      if (st.last && (st.last.from === i || st.last.to === i)) cls.push('last');
      if (fromSet.has(i)) cls.push('can');
      if (L.sel === i) cls.push('sel');
      if (toSet.has(i)) cls.push('dest');
      const cell = h('button', { class: cls.join(' '), type: 'button', 'aria-label': (p ? names[p.s] + '의 ' + (p.k === 'K' ? '궁' : '졸') : '빈 칸') },
        p ? h('span', { class: 'jg-piece' + (p.k === 'K' ? ' king' : ''), style: { background: `var(--p${p.s})` } }, p.k === 'K' ? '궁' : '졸') : null);
      cell.addEventListener('click', () => {
        if (!myTurn) return;
        if (toSet.has(i)) { s.send({ t: 'mv', from: L.sel, to: i }); return; }
        if (fromSet.has(i)) { L.sel = L.sel === i ? null : i; s.onUpdate(s); }
      });
      grid.append(cell);
    }
    const side = h('div', { class: 'jg-side' });
    g.append(h('div', { class: 'jg-layout' }, h('div', { class: 'jg-board-wrap' }, grid), side));

    // 카드 순서 정하기
    if (st.ph === 'order') {
      if (me >= 0 && !st.ready[me]) {
        const remaining = st.deal.filter((c) => !L.seq.includes(c));
        side.append(
          h('h4', { class: 'sub' }, '이번 라운드 카드 5장의 순서를 몰래 정하세요'),
          h('p', { class: 'note' }, '카드를 누르면 다음 순서 칸에 들어가요. 칸을 누르면 빠져요. 그림의 위쪽이 상대 방향이에요.'),
          h('div', { class: 'jg-slots' }, [0, 1, 2, 3, 4].map((k) => L.seq[k] != null
            ? cardEl(L.seq[k], { button: true, cls: 'slot filled', onclick: () => { L.seq.splice(k, 1); s.onUpdate(s); } })
            : h('div', { class: 'jg-card slot empty' }, h('b', null, (k + 1) + '번')))),
          h('div', { class: 'jg-hand' }, remaining.map((c) => cardEl(c, { button: true, onclick: () => { if (L.seq.length < 5) { L.seq.push(c); s.onUpdate(s); } } }))),
          h('div', { class: 'row wrap' },
            h('button', { class: 'btn primary', disabled: L.seq.length !== 5 || s.waiting, onclick: () => { L.mine = L.seq.slice(); s.send({ t: 'order', o: L.seq.slice() }); } }, '순서 확정'),
            h('button', { class: 'btn ghost tiny', onclick: () => { L.seq = []; s.onUpdate(s); } }, '비우기')));
      } else {
        side.append(h('h4', { class: 'sub' }, '이번 라운드 카드'), h('div', { class: 'jg-hand' }, st.deal.map((c) => cardEl(c))),
          h('p', { class: 'status' }, me >= 0 ? '순서를 확정했어요. 상대를 기다리는 중…' : '두 사람이 순서를 정하는 중…'));
      }
    }

    // 진행
    if (st.ph === 'play' || st.ph === 'end') {
      const rowFor = (seat) => {
        const known = seat === me && L.mine ? L.mine : null;
        return h('div', { class: 'jg-seq' }, h('span', { class: 'jg-seq-name' }, h('span', { class: 'seat-dot', style: { background: `var(--p${seat})` } }), names[seat]),
          h('div', { class: 'jg-seq-cards' }, [0, 1, 2, 3, 4].map((k) => {
            const id = st.rev[seat][k] != null ? st.rev[seat][k] : known ? known[k] : null;
            const cur = st.ph === 'play' && k === st.k;
            if (id == null) return h('div', { class: 'jg-card back' + (cur ? ' cur' : '') }, h('b', null, '?'));
            return cardEl(id, { cls: (cur ? 'cur' : '') + (k < st.k || st.ph === 'end' ? ' used' : '') + (st.rev[seat][k] == null ? ' secret' : '') });
          })));
      };
      side.append(rowFor(viewer), rowFor(1 - viewer));
      if (st.ph === 'play') {
        const firstSeat = st.gstep % 2 === 0 ? st.first : 1 - st.first;
        side.append(h('p', { class: 'note' }, '이번 카드는 ' + names[firstSeat] + '이(가) 먼저 움직여요.'));
        if (myTurn) side.append(h('p', { class: 'status strong' }, '내 차례: “' + CARDS[myCard].name + '” 카드로 말 하나를 움직이세요.', h('span', { class: 'timer', 'data-timer-seat': me })));
        else side.append(h('p', { class: 'status' }, names[st.cur] + '이(가) 움직이는 중…'));
      }
      if (st.log.length) side.append(h('ul', { class: 'hv-log' }, st.log.slice().reverse().slice(0, 5).map((e) => {
        if (e[1] === 'pass') return h('li', null, names[e[0]] + ': “' + CARDS[e[2]].name + '”로 움직일 수 있는 말이 없어 넘어갔어요');
        return h('li', { class: e[6] ? 'boom' : '' }, names[e[0]] + ': “' + CARDS[e[2]].name + '”로 ' + (e[3] === 'K' ? '궁' : '졸') + ' 이동' + (e[6] ? ' — ' + (e[6] === 'K' ? '궁' : '졸') + '을 잡음' : ''));
      })));
      if (st.ph === 'play' && me >= 0) side.append(h('button', { class: 'btn ghost tiny', onclick: () => s.send({ t: 'give' }) }, '기권'));
    }
    if (st.ph === 'end') {
      g.append(h('div', { class: 'result-box' },
        h('strong', { class: 'result-big' }, st.win === -1 ? '무승부' : st.win === me ? '승리!' : me >= 0 ? '패배' : names[st.win] + ' 승리'),
        h('p', null, st.why)));
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
    blurb: '라운드마다 이동 카드 5장의 순서를 몰래 정한 뒤, 한 장씩 동시에 공개하며 말을 움직입니다. 상대의 궁을 잡거나 졸로 궁 자리에 들어가면 승리.',
    mount,
    rules: `
<p>5×6 판에서 두 사람이 겨루는 장기 변형입니다. 말을 어떻게 움직일지는 <b>미리 순서를 정해 둔 이동 카드</b>가 결정합니다.</p>
<div class="demo" data-demo="rules-jang"></div>
<ul>
<li>각자 <b>궁 1개와 졸 4개</b>로 시작합니다. 궁은 자기 궁성(색이 칠해진 가운데 3×2 칸) 밖으로 나갈 수 없습니다.</li>
<li>라운드마다 두 사람에게 <b>같은 이동 카드 5장</b>이 주어집니다. 각자 5장의 <b>순서를 몰래</b> 정합니다.</li>
<li>순서가 정해지면 1번 카드부터 두 사람의 카드가 동시에 공개됩니다. 한 사람씩 <b>자기 카드에 그려진 대로 말 하나</b>를 움직입니다. 움직일 수 있는 말이 없으면 넘어갑니다.</li>
<li>카드마다 먼저 움직이는 사람이 번갈아 바뀝니다. 첫 카드의 선은 무작위로 정해집니다.</li>
<li>상대 말이 있는 칸으로 가면 그 말을 잡습니다. 카드 그림의 위쪽이 상대 방향입니다. ‘돌진’과 ‘긴 사선’의 두 칸 이동은 가운데 칸이 비어 있어야 하고, ‘말’은 뛰어넘을 수 있습니다.</li>
<li><b>상대의 궁을 잡거나, 졸이 상대 궁의 처음 자리(별표 칸)에 들어가면</b> 바로 이깁니다.</li>
<li>6라운드가 끝날 때까지 승부가 나지 않으면 남은 말이 많은 쪽이 이기고, 같으면 무승부입니다.</li>
</ul>
<p class="note">방송에서 공개된 설명은 “이동 카드 5장의 순서를 미리 정한다”와 “상대 궁을 잡거나 궁 자리에 들어가면 이긴다”까지입니다. 판 크기, 말 구성, 카드 종류 등 나머지는 이 사이트에서 정했습니다. 온라인에서 순서 정하기는 75초, 한 수는 30초입니다.</p>`,
    guide: `
<h4>1. 카드는 같고, 순서만 다르다</h4>
<p>두 사람이 받는 카드 5장은 똑같습니다. 차이는 순서뿐이니, 상대가 어떤 순서를 고를지 상상하는 것이 핵심입니다. 예를 들어 ‘돌진’이 있는 라운드에는 상대도 졸을 두 칸 밀고 들어올 수 있다는 것을 먼저 계산하세요.</p>
<h4>2. 먼저 움직이는 카드를 기억하기</h4>
<p>카드마다 먼저 움직이는 사람이 번갈아 바뀝니다. 내가 먼저 움직이는 차례의 카드에 공격 카드를 놓으면 상대가 피할 틈 없이 잡을 수 있고, 내가 나중에 움직이는 차례에는 상대가 방금 한 수를 보고 대응할 수 있습니다. 순서를 정할 때 “이 카드는 내가 먼저인가, 나중인가?”를 같이 적어 두세요.</p>
<div class="demo" data-demo="jang"></div>
<h4>3. 궁은 도망칠 곳이 좁다</h4>
<p>궁은 궁성 밖으로 못 나가서 몰리면 금방 잡힙니다. ‘후퇴’나 ‘옆걸음’ 같은 카드를 궁을 지키는 데 쓸 수 있도록 한두 장은 뒤쪽 순서에 남겨 두면 안전합니다.</p>
<h4>4. 궁 자리 노리기</h4>
<p>졸이 상대 궁의 처음 자리에 들어가기만 해도 이깁니다. 상대 궁이 그 자리를 비우면 기회입니다. ‘돌진’·‘말’ 카드로 두 칸씩 접근하면 상대가 막을 시간이 부족해집니다. 반대로 내 궁 자리 근처에 상대 졸이 다가오면 궁이 그 자리를 지키거나 졸을 잡는 수를 우선하세요.</p>
<h4>5. 움직일 말이 없으면 손해</h4>
<p>카드에 맞는 말이 하나도 없으면 그 카드는 그냥 버려집니다. 졸이 모두 판 끝에 몰려 있으면 ‘전진’ 카드가 쓸모없어질 수 있으니, 말들을 여러 방향으로 움직일 수 있게 흩어 두는 것이 좋습니다.</p>`,
  });

  App.jang = { engine, legal, CARDS };
})();
