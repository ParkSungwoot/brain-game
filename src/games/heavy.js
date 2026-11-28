/* 무거운 13: 받침대 합이 13을 넘지 않도록 바위를 올리는 심리전 (3~7인, 온라인/컴퓨터) */
(function () {
  const App = (globalThis.App = globalThis.App || {});
  const { h, rng: R } = App;

  const COLORS = ['빨강', '초록', '파랑', '무지개'];
  const CHIP_START = [2, 2, 2, 1];
  const LIMIT = 13;
  const HALF = 7;
  const ROUNDS = 14;

  const sum = (ped) => ped.reduce((a, x) => a + x[1], 0);

  // ---------- 규칙 (방장 화면에서 계산) ----------
  const engine = {
    id: 'heavy',
    minPlayers: 3, maxPlayers: 7, allowBots: true, defaultBots: 5,
    defaultOpts: {},
    botNames: ['컴퓨터 A', '컴퓨터 B', '컴퓨터 C', '컴퓨터 D', '컴퓨터 E', '컴퓨터 F'],
    start(players) {
      const n = players.length;
      return {
        n, round: 1, first: 0, ph: 'choose',
        ped: [[], [], []],
        pen: Array(n).fill(0), penAt: Array(n).fill(0), penSeq: 0, lastPen: -1,
        cards: Array(n).fill(127), chips: Array.from({ length: n }, () => CHIP_START.slice()),
        sub: Array(n).fill(null),
        rev: null, // 공개된 제출 [[seat, card, chip], ...]
        queue: [], passed: [], placed: [], cur: -1,
        log: [],
      };
    },
    act(G, seat, a) {
      if (!a) throw new Error('잘못된 행동');
      if (a.t === 'sub') {
        if (G.ph !== 'choose') throw new Error('지금은 낼 수 없어요');
        if (G.sub[seat]) throw new Error('이미 냈어요');
        const card = a.card | 0, chip = a.chip | 0;
        if (card < 0 || card > 6 || !(G.cards[seat] & (1 << card))) throw new Error('그 바위 카드는 이미 썼어요');
        if (chip < 0 || chip > 3 || G.chips[seat][chip] <= 0) throw new Error('그 색 칩이 남아 있지 않아요');
        G.sub[seat] = [card, chip];
        if (G.sub.every(Boolean)) reveal(G);
        return;
      }
      if (a.t === 'place' || a.t === 'pass') {
        if (G.ph !== 'place' || G.cur !== seat) throw new Error('내 차례가 아니에요');
        const [card, chip] = G.sub[seat];
        if (a.t === 'pass') {
          if (G.passed.includes(seat)) throw new Error('한 라운드에 한 번만 미룰 수 있어요');
          G.passed.push(seat);
          G.queue.shift();
          pushLog(G, [seat, 'pass']);
          advance(G);
          return;
        }
        let ped = chip === 3 ? a.ped | 0 : chip;
        if (ped < 0 || ped > 2) throw new Error('받침대를 골라 주세요');
        G.queue.shift();
        place(G, seat, ped, card);
        advance(G);
        return;
      }
      throw new Error('알 수 없는 행동');
    },
    pending(G) {
      if (G.ph === 'choose') return G.sub.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
      if (G.ph === 'place') return [G.cur];
      return [];
    },
    timeLimit(G) { return G.ph === 'choose' ? 180000 : 25000; },
    timeout(G, seat) {
      if (G.ph === 'choose') return botChoose(G, seat, true);
      return botPlace(G, seat, true);
    },
    bot(G, seat) { return G.ph === 'choose' ? botChoose(G, seat) : botPlace(G, seat); },
    botDelay(G) { return G.ph === 'choose' ? 500 + Math.random() * 1200 : 700 + Math.random() * 700; },
    publicView(G) {
      return {
        n: G.n, round: G.round, first: G.first, ph: G.ph, ped: G.ped, pen: G.pen,
        cards: G.cards, chips: G.chips, sb: G.sub.map((x) => (x ? 1 : 0)),
        rev: G.rev, queue: G.queue, passed: G.passed, placed: G.placed, cur: G.cur, log: G.log,
        rank: G.ph === 'end' ? ranking(G) : null,
      };
    },
    over(G) { return G.ph === 'end'; },
    // scores: 높을수록 좋은 점수 (벌점 적을수록, 같으면 벌점을 덜 최근에 받을수록 위)
    results(G) { return { rank: ranking(G), scores: G.pen.map((p, i) => -(p * 10000 + G.penAt[i])) }; },
  };

  function pushLog(G, e) { G.log.push(e); if (G.log.length > 6) G.log.shift(); }

  function seatOrderFrom(G, s) { return (s - G.first + G.n) % G.n; }

  function reveal(G) {
    const n = G.n;
    G.rev = [];
    for (let s = 0; s < n; s++) G.rev.push([s, G.sub[s][0], G.sub[s][1]]);
    // 놓는 순서: 무지개 칩 먼저 → 숫자 큰 순 → 같으면 선 플레이어부터 시계 방향
    const order = G.rev.slice().sort((a, b) => {
      const ra = a[2] === 3 ? 0 : 1, rb = b[2] === 3 ? 0 : 1;
      if (ra !== rb) return ra - rb;
      if (a[1] !== b[1]) return b[1] - a[1];
      return seatOrderFrom(G, a[0]) - seatOrderFrom(G, b[0]);
    });
    G.queue = order.map((x) => x[0]);
    G.passed = [];
    G.placed = [];
    // 손에서 사용 처리
    for (let s = 0; s < n; s++) { G.cards[s] &= ~(1 << G.sub[s][0]); G.chips[s][G.sub[s][1]]--; }
    G.ph = 'place';
    advance(G);
  }

  function advance(G) {
    if (G.queue.length) { G.cur = G.queue[0]; return; }
    // 미룬 사람: 먼저 미룬 사람이 가장 늦게
    const rest = G.passed.filter((s) => !G.placed.includes(s));
    if (rest.length) {
      G.queue = rest.slice().reverse();
      G.cur = G.queue[0];
      G.passed = G.passed.slice(); // 다시 미룰 수 없음 (passed 에 남아 있음)
      return;
    }
    endRound(G);
  }

  function place(G, seat, ped, card) {
    const P = G.ped[ped];
    const total = sum(P) + card;
    G.placed.push(seat);
    if (total >= LIMIT) {
      const removed = P.length;
      G.pen[seat] += removed;
      G.penSeq++;
      G.penAt[seat] = G.penSeq;
      G.lastPen = seat;
      G.ped[ped] = [[seat, card]];
      pushLog(G, [seat, 'boom', ped, card, removed, total]);
    } else {
      P.push([seat, card]);
      pushLog(G, [seat, 'put', ped, card, total]);
    }
  }

  function endRound(G) {
    G.sub = Array(G.n).fill(null);
    G.cur = -1;
    if (G.lastPen >= 0) G.first = G.lastPen;
    if (G.round >= ROUNDS) { G.ph = 'end'; return; }
    if (G.round === HALF) {
      G.cards = Array(G.n).fill(127);
      G.chips = Array.from({ length: G.n }, () => CHIP_START.slice());
      pushLog(G, [-1, 'half']);
    }
    G.round++;
    G.ph = 'choose';
    G.rev = null;
    G.queue = []; G.passed = []; G.placed = [];
  }

  function ranking(G) {
    // 벌점 적은 순. 같으면 최근에 벌점을 받은 사람이 아래
    const idx = [...Array(G.n).keys()];
    idx.sort((a, b) => G.pen[a] - G.pen[b] || G.penAt[a] - G.penAt[b]);
    return idx;
  }

  // ---------- 컴퓨터 플레이어 ----------
  function avail(G, seat) {
    const cards = [];
    for (let c = 0; c <= 6; c++) if (G.cards[seat] & (1 << c)) cards.push(c);
    const chips = [];
    for (let k = 0; k < 4; k++) if (G.chips[seat][k] > 0) chips.push(k);
    return { cards, chips };
  }

  function botChoose(G, seat, lazy) {
    const { cards, chips } = avail(G, seat);
    if (lazy) return { t: 'sub', card: R.pick(cards), chip: R.pick(chips) };
    const left = cards.length; // 이번 절반에 남은 라운드 수
    let best = null, bestScore = -Infinity;
    for (const c of cards) {
      for (const k of chips) {
        let sc;
        const peds = k === 3 ? [0, 1, 2] : [k];
        sc = Math.max(...peds.map((p) => {
          const s = sum(G.ped[p]), cnt = G.ped[p].length;
          const after = s + c;
          // 다른 사람이 먼저 올릴 것을 감안한 위험도
          const slack = LIMIT - 1 - after;
          let risk = after >= LIMIT ? cnt + 1 : slack <= 2 ? (cnt + 1) * (3 - slack) * 0.35 : 0;
          if (after >= LIMIT && cnt <= 1) risk = cnt * 0.6; // 적게 치우면 감수할 만함
          return -risk + c * 0.25 * (left / HALF) + (after >= LIMIT ? 0 : after * 0.05);
        }));
        if (k === 3) sc -= left > 2 ? 1.2 : 0; // 무지개는 아껴 둠
        sc += Math.random() * 0.9;
        if (sc > bestScore) { bestScore = sc; best = { t: 'sub', card: c, chip: k }; }
      }
    }
    return best;
  }

  function botPlace(G, seat, lazy) {
    const [card, chip] = G.sub[seat];
    const canPass = !G.passed.includes(seat) && G.queue.length > 1;
    if (chip === 3) {
      // 넘지 않는 받침대 중 가장 무거운 곳, 없으면 바위가 적은 곳
      let best = 0, bs = -Infinity;
      for (let p = 0; p < 3; p++) {
        const s = sum(G.ped[p]) + card, cnt = G.ped[p].length;
        const sc = s < LIMIT ? 100 + s : -cnt * 10 + Math.random();
        if (sc > bs) { bs = sc; best = p; }
      }
      if (!lazy && bs < 100 && canPass && G.ped[best].length >= 2) return { t: 'pass' };
      return { t: 'place', ped: best };
    }
    const s = sum(G.ped[chip]) + card, cnt = G.ped[chip].length;
    if (!lazy && s >= LIMIT && canPass && cnt >= 2) {
      // 뒤에 같은 받침대를 터뜨려 줄 사람이 있으면 미룸
      const after = G.queue.slice(1);
      const helper = after.some((o) => { const [oc, ok] = G.sub[o]; return (ok === chip || ok === 3) && oc > 0; });
      if (helper || Math.random() < 0.5) return { t: 'pass' };
    }
    return { t: 'place', ped: chip };
  }

  // ---------- 화면 ----------
  const PED_CLS = ['red', 'green', 'blue'];

  function renderGame(g, s) {
    const W = s.W, st = W.s, me = s.mySeat;
    const names = W.pl.map((p) => p.n);
    const L = s.local;
    const key = W.gn + ':' + st.round;
    if (L.key !== key) { L.key = key; L.card = null; L.chip = null; L.sent = null; }

    const half = st.round <= HALF ? '전반' : '후반';
    g.append(h('div', { class: 'hv-head' },
      h('span', { class: 'pill strong' }, '라운드 ' + st.round + ' / ' + ROUNDS),
      h('span', { class: 'pill' }, half + ' ' + (((st.round - 1) % HALF) + 1) + ' / ' + HALF),
      h('span', { class: 'pill' }, '선: ' + names[st.first]),
      st.ph === 'choose' ? h('span', { class: 'pill warn' }, '모두 비공개로 고르는 중') : st.ph === 'place' ? h('span', { class: 'pill warn' }, '순서대로 놓는 중') : h('span', { class: 'pill' }, '게임 종료')));

    // 받침대
    const peds = h('div', { class: 'peds' });
    st.ped.forEach((P, i) => {
      const total = sum(P);
      peds.append(h('div', { class: 'ped ' + PED_CLS[i] },
        h('div', { class: 'ped-top' }, h('span', { class: 'ped-name' }, COLORS[i]), h('span', { class: 'ped-sum' + (total >= 10 ? ' hot' : '') }, total + ' / 13')),
        h('div', { class: 'ped-meter', role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': '13', 'aria-valuenow': String(total), 'aria-label': COLORS[i] + ' 받침대 합 ' + total }, h('span', { style: { width: Math.min(100, total / 13 * 100) + '%' } })),
        h('div', { class: 'rocks' }, P.length ? P.map(([o, v]) => h('span', { class: 'rock', style: { '--pc': `var(--p${o})` }, title: names[o] + '의 바위 ' + v }, String(v))) : h('span', { class: 'note' }, '비어 있음')),
        h('div', { class: 'ped-foot' }, '쌓인 바위 ' + P.length + '개')));
    });
    g.append(peds);

    // 공개 순서 / 진행
    if (st.ph === 'place' && st.rev) {
      const order = st.placed.concat(st.queue.filter((x) => !st.placed.includes(x)));
      const pending = st.passed.filter((x) => !st.placed.includes(x) && !st.queue.includes(x));
      const seq = order.concat(pending);
      g.append(h('div', { class: 'reveal' },
        h('h4', { class: 'sub' }, '이번 라운드 공개'),
        h('ol', { class: 'rev-list' }, seq.map((seat) => {
          const r = st.rev.find((x) => x[0] === seat);
          const done = st.placed.includes(seat);
          return h('li', { class: 'rev' + (seat === st.cur ? ' cur' : '') + (done ? ' done' : '') },
            App.avatar.seat(W, seat),
            h('span', { class: 'pname' }, names[seat]),
            h('span', { class: 'card-mini' }, String(r[1])),
            h('span', { class: 'chip-mini c' + r[2] }, COLORS[r[2]]),
            st.passed.includes(seat) && !done ? h('span', { class: 'chip-tag' }, '미룸') : null,
            seat === st.cur ? h('span', { class: 'timer', 'data-timer-seat': seat }) : null);
        }))));
    }

    // 내 차례 조작
    if (me >= 0 && st.ph === 'choose') {
      const hand = h('div', { class: 'hand panel' });
      if (st.sb[me] || L.sent) {
        const sent = L.sent;
        hand.append(h('p', { class: 'status' }, sent ? '냈어요: 바위 ' + sent[0] + ' · ' + COLORS[sent[1]] + ' 칩. ' : '냈어요. ', '다른 사람을 기다리는 중…'));
      } else {
        const cardsRow = h('div', { class: 'cards-row' });
        for (let c = 0; c <= 6; c++) {
          const has = st.cards[me] & (1 << c);
          cardsRow.append(h('button', { class: 'card' + (L.card === c ? ' on' : ''), disabled: !has, 'aria-pressed': L.card === c ? 'true' : 'false', onclick: () => { L.card = c; s.onUpdate(s); } }, String(c)));
        }
        const chipsRow = h('div', { class: 'chips-row' });
        for (let k = 0; k < 4; k++) {
          const cnt = st.chips[me][k];
          chipsRow.append(h('button', { class: 'chip c' + k + (L.chip === k ? ' on' : ''), disabled: !cnt, 'aria-pressed': L.chip === k ? 'true' : 'false', onclick: () => { L.chip = k; s.onUpdate(s); } }, COLORS[k], h('small', null, '×' + cnt)));
        }
        const ready = L.card != null && L.chip != null;
        hand.append(
          h('h4', { class: 'sub' }, '바위 카드 1장과 색 칩 1개를 고르세요 ', h('span', { class: 'timer', 'data-timer-seat': me })),
          cardsRow, chipsRow,
          h('button', { class: 'btn primary', disabled: !ready || s.waiting, onclick: () => { L.sent = [L.card, L.chip]; s.send({ t: 'sub', card: L.card, chip: L.chip }); } }, ready ? '바위 ' + L.card + ' · ' + COLORS[L.chip] + ' 내기' : '카드와 칩을 고르세요'));
      }
      g.append(hand);
    }
    if (me >= 0 && st.ph === 'place' && st.cur === me) {
      const r = st.rev.find((x) => x[0] === me);
      const [card, chip] = [r[1], r[2]];
      const canPass = !st.passed.includes(me);
      const box = h('div', { class: 'hand panel turn' }, h('h4', { class: 'sub' }, '내 차례: 바위 ' + card + ' (' + COLORS[chip] + ' 칩)'));
      const btns = h('div', { class: 'row wrap' });
      const peds2 = chip === 3 ? [0, 1, 2] : [chip];
      peds2.forEach((p) => {
        const after = sum(st.ped[p]) + card;
        const boom = after >= LIMIT;
        btns.append(h('button', { class: 'btn ' + (boom ? 'danger' : 'primary'), disabled: s.waiting, onclick: () => s.send({ t: 'place', ped: p }) }, COLORS[p] + '에 놓기 (' + after + (boom ? ', 벌점 ' + st.ped[p].length : '') + ')'));
      });
      if (canPass) btns.append(h('button', { class: 'btn', disabled: s.waiting, onclick: () => s.send({ t: 'pass' }) }, '패스 (맨 뒤로)'));
      box.append(btns, h('p', { class: 'note' }, canPass ? '패스하면 이번 라운드 맨 뒤에 놓습니다. 먼저 패스한 사람이 가장 늦게 놓아요. 한 라운드에 한 번만 미룰 수 있어요.' : '이미 미뤘기 때문에 지금 놓아야 해요.'));
      g.append(box);
    }

    // 점수표
    const table = h('table', { class: 'score' },
      h('thead', null, h('tr', null, h('th', null, '플레이어'), h('th', null, '벌점'), h('th', null, '남은 카드'), h('th', null, '남은 칩'), h('th', null, ''))),
      h('tbody', null, W.pl.map((p, i) => {
        const cards = [];
        for (let c = 0; c <= 6; c++) if (st.cards[i] & (1 << c)) cards.push(c);
        return h('tr', { class: i === me ? 'me' : '' },
          h('td', null, App.avatar.seat(W, i), ' ', p.n, i === st.first ? h('span', { class: 'chip-tag' }, '선') : null, !p.on ? h('span', { class: 'chip-tag warn' }, '끊김') : null),
          h('td', { class: 'num' }, String(st.pen[i])),
          h('td', { class: 'mono' }, cards.join(' ') || '—'),
          h('td', null, h('div', { class: 'chips-cell' }, st.chips[i].map((c, k) => (c ? h('span', { class: 'chip-dot c' + k, title: COLORS[k] + ' ' + c + '개' }, c > 1 ? String(c) : '') : null)))),
          h('td', null, st.ph === 'choose' ? (st.sb[i] ? '✓ 냄' : h('span', { class: 'muted' }, '고르는 중 ', h('span', { class: 'timer', 'data-timer-seat': i }))) : ''));
      })));
    g.append(h('div', { class: 'table-wrap' }, table));

    // 기록
    if (st.log.length) {
      g.append(h('ul', { class: 'hv-log' }, st.log.slice().reverse().map((e) => {
        if (e[1] === 'half') return h('li', null, '전반 종료: 모두 카드와 칩을 새로 받았어요. 받침대 바위는 그대로예요.');
        if (e[1] === 'pass') return h('li', null, names[e[0]] + '이(가) 놓기를 미뤘어요.');
        if (e[1] === 'boom') return h('li', { class: 'boom' }, names[e[0]] + '이(가) ' + COLORS[e[2]] + '에 ' + e[3] + '을 놓아 ' + e[5] + '! 바위 ' + e[4] + '개를 치우고 벌점 +' + e[4]);
        return h('li', null, names[e[0]] + ': ' + COLORS[e[2]] + '에 ' + e[3] + ' → 합 ' + e[4]);
      })));
    }

    if (st.ph === 'end' && st.rank) {
      const last = st.rank[st.rank.length - 1];
      g.append(h('div', { class: 'result-box' },
        h('strong', { class: 'result-big' }, me === last ? '최하위… 다음엔 꼭!' : me === st.rank[0] ? '1위!' : me >= 0 ? (st.rank.indexOf(me) + 1) + '위' : '게임 종료'),
        h('ol', { class: 'rank' }, st.rank.map((i) => h('li', null, names[i] + ' — 벌점 ' + st.pen[i]))),
        h('p', { class: 'note' }, '벌점이 같으면 더 최근에 벌점을 받은 사람이 아래 순위예요.')));
    }
  }

  function mount(root, ctx) {
    return App.multi.mount(root, ctx, { gameId: 'heavy', engine, renderGame, soloLabel: '컴퓨터 5명과 하기' });
  }

  App.games.push({
    id: 'heavy',
    name: '무거운 13',
    kicker: '심리전',
    players: '3~7인 · 온라인 / 컴퓨터',
    blurb: '세 받침대에 바위를 올립니다. 합이 13 이상이 되게 만든 사람이 그동안 쌓인 바위만큼 벌점을 받아요.',
    accent: 'heavy',
    mount,
    rules: `
<p>빨강·초록·파랑 받침대 세 개에 바위를 올리는 게임입니다. <b>벌점이 가장 많은 사람이 집니다.</b></p>
<div class="demo" data-demo="rules-heavy"></div>
<ul>
<li>각자 바위 카드 0~6 일곱 장과 색 칩 일곱 개(빨강·초록·파랑 2개씩, 무지개 1개)를 가지고 시작합니다.</li>
<li>매 라운드 모두가 <b>바위 카드 1장과 칩 1개</b>를 비공개로 고릅니다. 모두 고르면 한꺼번에 공개합니다.</li>
<li>공개 후 <b>무지개 칩 → 숫자가 큰 순서 → 같으면 선 플레이어부터 시계 방향</b>으로 한 명씩 바위를 놓습니다. 칩 색깔의 받침대에 놓고, 무지개 칩은 놓을 때 받침대를 고릅니다.</li>
<li>자기 차례에 <b>패스</b>를 하면 그 라운드의 맨 뒤로 갑니다. 여러 명이 패스하면 패스한 순서의 역순으로 놓습니다(먼저 패스한 사람이 가장 늦게). 라운드마다 한 번만 미룰 수 있습니다.</li>
<li>바위를 놓아서 받침대 합이 <b>13 이상</b>이 되면, 원래 있던 바위를 모두 치우고 그 개수만큼 벌점을 받습니다. 방금 놓은 바위는 남습니다.</li>
<li>마지막으로 벌점을 받은 사람이 다음 라운드의 선 플레이어가 됩니다.</li>
<li>7라운드가 끝나면 카드와 칩을 새로 받습니다(받침대 위 바위는 그대로). 총 14라운드 후 벌점이 가장 많은 사람이 최하위입니다. 벌점이 같으면 더 최근에 벌점을 받은 사람이 아래입니다.</li>
</ul>
<p class="note">온라인에서 고르는 시간은 3분, 놓는 시간은 25초입니다. 시간이 지나거나 연결이 끊기면 컴퓨터가 대신 둡니다.</p>`,
    guide: `
<h4>1. 벌점은 “쌓인 바위 개수”다</h4>
<p>합을 13 이상으로 만든 사람이 받는 벌점은 숫자의 크기가 아니라 <b>받침대에 있던 바위 개수</b>입니다. 바위 1~2개짜리 받침대를 터뜨리는 것은 작은 손해지만, 0과 1이 잔뜩 쌓인 받침대를 터뜨리면 한 번에 벌점 4~5점을 받을 수 있습니다. 위험한 것은 합이 높은 받침대가 아니라 바위가 많은 받침대입니다.</p>
<div class="demo" data-demo="heavy"></div>
<h4>2. 큰 카드는 일찍, 작은 카드는 늦게</h4>
<p>절반(7라운드) 안에 일곱 장을 모두 써야 합니다. 6, 5 같은 큰 카드는 받침대가 비어 있거나 가벼울 때 내야 안전합니다. 반대로 0과 1은 거의 꽉 찬 받침대에도 안전하게 넣을 수 있어서 마지막까지 아껴 두는 “보험”입니다. 다만 0·1을 넣을수록 그 받침대의 바위 개수가 늘어서 다음 사람의 벌점이 커집니다.</p>
<h4>3. 놓는 순서를 계산하기</h4>
<p>숫자가 큰 사람부터 놓습니다. 내가 6을 내면 대부분 먼저 놓게 되고, 0을 내면 거의 마지막에 놓습니다. 마지막에 놓는 사람은 앞사람들이 받침대를 터뜨리거나 채운 결과를 보고 판단할 수 있지만, 이미 꽉 찬 받침대에 놓아야 할 수도 있습니다. 다른 사람들의 남은 카드는 점수표에 공개되니, 이번 라운드에 누가 어떤 숫자를 낼 수 있는지 미리 따져 보세요.</p>
<h4>4. 패스는 “남이 터뜨려 주길” 기다리는 수</h4>
<p>내 바위가 받침대를 터뜨리게 생겼다면, 같은 색 칩을 낸 사람이 뒤에 있는지 확인하세요. 그 사람이 먼저 터뜨려 주면 나는 바위 하나만 남은 받침대에 안전하게 놓을 수 있습니다. 하지만 먼저 패스한 사람이 가장 늦게 놓으므로, 여러 명이 패스하면 결국 맨 마지막에 가장 나쁜 상황을 떠안을 수 있습니다.</p>
<h4>5. 무지개 칩은 탈출구</h4>
<p>무지개 칩은 가장 먼저 놓는 대신 받침대를 고를 수 있습니다. 모든 받침대가 위험해질 후반부에 쓰는 것이 좋습니다. 단, 무지개를 낸 사람이 많으면 그 사람들끼리 숫자 순서로 먼저 놓는다는 점을 기억하세요.</p>
<h4>6. 선 플레이어와 동점 규칙</h4>
<p>마지막으로 벌점을 받은 사람이 선이 됩니다. 같은 숫자끼리는 선부터 놓으니, 선은 같은 숫자 경쟁에서 먼저 위험을 떠안습니다. 또 벌점이 같으면 더 최근에 벌점을 받은 사람이 아래 순위이므로, 마지막 라운드에 벌점을 받는 것이 가장 치명적입니다.</p>`,
  });

  App.heavy = { engine };
})();
