/* 수식의 탑 (방송 규칙)
   매 라운드 타깃 넘버와 목표 층수가 공개되면, 버저를 눌러 "몇 번 만에 만들 수 있는지" 제시한다.
   처음 제시가 나오면 다른 사람들은 2분 동안 더 적은 횟수를 한 번씩 부를 수 있고,
   가장 적게 부른 사람만 2분 안에 직접 블록을 옮겨 도전한다. 7점을 먼저 얻으면 끝. */
(function () {
  const App = (globalThis.App = globalThis.App || {});
  const { h } = App;
  const R = App.rng;
  const C = App.towerCore;

  const BUZZ_MS = 300000, UNDER_MS = 120000, TRY_MS = 120000, BETWEEN_MS = 9000;
  const WIN = 7, MAX_ROUNDS = 40, NB = 7, PLAIN = 2, MAXBID = 9;
  const clock = () => (App.towerClock ? App.towerClock() : Date.now());

  function wantFor(G) {
    if (G.lvl === 'easy') return R.pick([2, 2, 3]);
    return G.round <= 1 ? R.pick([2, 3]) : R.pick([3, 3, 4]);
  }

  // 컴퓨터 실력별 생각 속도: 처음 찾는 풀이(k0)를 t0에, 최단 풀이를 t1에 알게 됨
  const LV = {
    easy: { base: 60000, per: 20000, spread: 70000, extra: [0.35, 0.45], t1: [40000, 90000], bluff: 0.12, react: [4000, 9000] },
    normal: { base: 28000, per: 13000, spread: 45000, extra: [0.6, 0.35], t1: [20000, 60000], bluff: 0.06, react: [3000, 7000] },
    hard: { base: 12000, per: 7000, spread: 22000, extra: [0.85, 0.15], t1: [8000, 25000], bluff: 0.03, react: [2000, 5000] },
  };
  function makePlan(G) {
    const L = LV[G.ai] || LV.normal, d = G.sol.d;
    const r = Math.random();
    const extra = r < L.extra[0] ? 0 : r < L.extra[0] + L.extra[1] ? 1 : 2;
    const t0 = Math.min(BUZZ_MS - 20000, L.base + L.per * d + Math.random() * L.spread);
    return {
      k0: Math.min(MAXBID, d + extra), t0,
      t1: extra ? t0 + L.t1[0] + Math.random() * (L.t1[1] - L.t1[0]) : t0,
      bluff: Math.random() < L.bluff,
      react: L.react[0] + Math.random() * (L.react[1] - L.react[0]),
    };
  }

  function pushLog(G, e) { G.log.push(e); if (G.log.length > 8) G.log.shift(); }

  function newRound(G, now) {
    G.round++;
    let goal = null;
    for (let tries = 0; tries < 4 && !goal; tries++) {
      goal = C.pickGoal(G.B, G.T, wantFor(G), new Set(G.used));
      if (!goal) G.T = C.randomTowers(NB); // 만들 수 있는 목표가 없을 때만 (거의 없음)
    }
    G.goal = { v: goal.v, h: goal.h };
    G.sol = { d: goal.d, path: goal.path };
    G.used.push(goal.v + '@' + goal.h);
    if (G.used.length > 30) G.used.shift();
    G.ph = 'buzz'; G.rStart = now; G.until = now + BUZZ_MS;
    G.low = null; G.bids = []; G.done = Array(G.n).fill(false); G.att = null; G.res = null; G.lastMv = null;
    G.plan = Array.from({ length: G.n }, () => makePlan(G));
  }

  function startTry(G, now) {
    G.ph = 'try';
    G.att = { s: G.low.s, bid: G.low.n, w: G.low.w, used: 0 };
    G.until = now + TRY_MS;
    pushLog(G, [G.low.s, 'try', G.low.n]);
  }

  function checkUnder(G, now) {
    if (G.low.n <= 1 || G.done.every(Boolean)) startTry(G, now);
  }

  function finishTry(G, ok, now, why) {
    const A = G.att;
    const delta = (A.w === 'first' ? 1 : 2) * (ok ? 1 : -1);
    G.pts[A.s] += delta;
    G.res = { s: A.s, ok, delta, bid: A.bid, used: A.used, w: A.w, why };
    G.hist.push([G.round, A.s, A.bid, A.w === 'first' ? 1 : 2, ok ? 1 : 0, delta]);
    pushLog(G, [A.s, ok ? 'ok' : 'fail', delta]);
    G.ph = 'between'; G.until = now + BETWEEN_MS;
  }

  function afterRound(G, now) {
    const hi = Math.max(...G.pts), lo = Math.min(...G.pts);
    const lows = G.pts.filter((p) => p === lo).length;
    if ((hi >= WIN && (lows === 1 || hi === lo)) || G.round >= MAX_ROUNDS) return endGame(G, lows > 1);
    if (hi >= WIN && lows > 1) G.ot = true; // 최하위 동점: 한 명이 가려질 때까지 연장
    newRound(G, now);
  }

  function endGame(G, tied) {
    G.ph = 'end';
    const lo = Math.min(...G.pts), hi = Math.max(...G.pts);
    const cand = G.pts.map((p, i) => (p === lo ? i : -1)).filter((i) => i >= 0);
    G.places = Array(G.n).fill('live');
    G.how = '';
    if (lo !== hi) {
      const ex = cand.length > 1 ? R.pick(cand) : cand[0];
      if (cand.length > 1) G.how = 'lot';
      G.places[ex] = 'exile';
      G.exile = ex;
    } else G.exile = -1;
    G.top = G.pts.map((p, i) => (p === hi ? i : -1)).filter((i) => i >= 0);
    G.tied = tied;
  }

  // 컴퓨터가 할 행동과 그 시각
  function botPlan(G, s) {
    const P = G.plan[s], d = G.sol.d;
    if (G.ph === 'buzz') return { at: G.rStart + P.t0, a: { t: 'buzz', n: P.k0 } };
    if (G.ph === 'under') {
      const low = G.low.n, start = G.underAt + P.react, end = G.until - 800;
      const cands = [];
      if (P.k0 < low) cands.push({ at: Math.max(start, G.rStart + P.t0), n: P.k0 });
      if (d < low) cands.push({ at: Math.max(start, G.rStart + P.t1), n: d });
      const c = cands.filter((x) => x.at <= end).sort((a, b) => a.at - b.at || a.n - b.n)[0];
      if (c) return { at: c.at, a: { t: 'under', n: c.n } };
      if (P.bluff && low >= 2) return { at: start + 3000, a: { t: 'under', n: low - 1 } };
      return { at: start, a: { t: 'pass' } };
    }
    return null;
  }
  function botTryMove(G) {
    const A = G.att, path = G.sol.path;
    const m = path[A.used] || C.moves(G.T)[0];
    return { t: 'mv', f: m.f, k: m.k, to: m.t, flip: m.flip };
  }

  const engine = {
    id: 'tower',
    minPlayers: 2, maxPlayers: 6, allowBots: true, defaultBots: 4,
    defaultOpts: { ai: 'normal', lvl: 'normal' },
    botNames: ['컴퓨터 A', '컴퓨터 B', '컴퓨터 C', '컴퓨터 D', '컴퓨터 E'],
    start(players, o) {
      const n = players.length;
      const G = {
        n, bot: players.map((p) => !!p.b), ai: (o && o.ai) || 'normal', lvl: (o && o.lvl) || 'normal',
        B: C.makeBlocks(NB, PLAIN), T: C.randomTowers(NB), round: 0, pts: Array(n).fill(0),
        used: [], log: [], hist: [], ot: false,
      };
      newRound(G, clock());
      return G;
    },
    act(G, s, a) {
      const now = clock();
      if (!a || !a.t) throw new Error('알 수 없는 행동');
      if (a.t === 'buzz') {
        if (G.ph !== 'buzz') throw new Error('지금은 버저를 누를 수 없어요');
        const n = a.n | 0;
        if (n < 1 || n > MAXBID) throw new Error('1~' + MAXBID + '번 사이로 제시하세요');
        G.low = { s, n, w: 'first' };
        G.bids.push([s, n, 1]);
        G.done[s] = true;
        pushLog(G, [s, 'buzz', n]);
        G.ph = 'under'; G.underAt = now; G.until = now + UNDER_MS;
        checkUnder(G, now);
        return;
      }
      if (a.t === 'under' || a.t === 'pass') {
        if (G.ph !== 'under') throw new Error('지금은 제시할 수 없어요');
        if (G.done[s]) throw new Error(G.bids[0][0] === s ? '처음 제시한 사람은 더 부를 수 없어요' : '이미 한 번 제시했어요');
        if (a.t === 'under') {
          const n = a.n | 0;
          if (n < 1 || n >= G.low.n) throw new Error(G.low.n + '번보다 적게 제시해야 해요');
          G.low = { s, n, w: 'under' };
          G.bids.push([s, n, 2]);
          pushLog(G, [s, 'under', n]);
        } else pushLog(G, [s, 'pass']);
        G.done[s] = true;
        checkUnder(G, now);
        return;
      }
      if (a.t === 'mv') {
        if (G.ph !== 'try' || G.att.s !== s) throw new Error('지금은 블록을 옮길 수 없어요');
        const m = { f: a.f | 0, k: a.k | 0, t: a.to | 0, flip: !!a.flip };
        if (!C.validMove(G.T, m)) throw new Error('그렇게 옮길 수 없어요');
        G.T = C.apply(G.T, m);
        G.att.used++;
        G.lastMv = m;
        if (C.goalMet(G.B, G.T, G.goal)) finishTry(G, true, now, '');
        else if (G.att.used >= G.att.bid) finishTry(G, false, now, 'moves');
        return;
      }
      if (a.t === 'give') {
        if (G.ph !== 'try' || G.att.s !== s) throw new Error('지금은 포기할 수 없어요');
        finishTry(G, false, now, 'give');
        return;
      }
      throw new Error('알 수 없는 행동');
    },
    tick(G, now) {
      if (G.ph === 'end' || now < G.until) return false;
      if (G.ph === 'buzz') {
        G.res = { void: 1 };
        G.hist.push([G.round, -1]);
        pushLog(G, [-1, 'void']);
        G.ph = 'between'; G.until = now + BETWEEN_MS;
      } else if (G.ph === 'under') startTry(G, now);
      else if (G.ph === 'try') finishTry(G, false, now, 'time');
      else if (G.ph === 'between') afterRound(G, now);
      return true;
    },
    pending(G) {
      if (G.ph === 'buzz') return [...Array(G.n).keys()];
      if (G.ph === 'under') return [...Array(G.n).keys()].filter((s) => !G.done[s]);
      if (G.ph === 'try') return [G.att.s];
      return [];
    },
    // 제한 시간은 단계 전체에 걸리므로 엔진의 tick 이 직접 처리
    timeLimit() { return 0; },
    timeout(G, s) { return engine.bot(G, s); },
    bot(G, s) {
      const now = clock();
      if (!G.bot[s]) { // 연결이 끊긴 사람: 버저는 안 누르고, 추가 제시는 패스, 도전은 포기
        if (G.ph === 'under') return { t: 'pass' };
        if (G.ph === 'try') return { t: 'give' };
        return null;
      }
      if (G.ph === 'try') return botTryMove(G);
      const p = botPlan(G, s);
      return p && now >= p.at - 50 ? p.a : null;
    },
    botDelay(G, s) {
      if (!G.bot[s]) return G.ph === 'try' ? 20000 : 6000;
      if (G.ph === 'try') return 1300 + Math.random() * 900;
      const p = botPlan(G, s);
      return p ? Math.max(250, p.at - clock()) : 1000;
    },
    publicView(G) {
      const showSol = (G.ph === 'between' || G.ph === 'end') && G.sol;
      return {
        B: G.B.map((b) => b.o + b.d).join(','), T: G.T, round: G.round, pts: G.pts, ph: G.ph, goal: G.goal,
        low: G.low, bids: G.bids, done: G.done, att: G.att, res: G.res, ot: G.ot, log: G.log, lastMv: G.lastMv,
        sol: showSol ? G.sol.path : null, sd: showSol ? G.sol.d : 0, lvl: G.lvl,
        rem: G.ph === 'end' ? 0 : Math.max(0, G.until - clock()),
        hist: G.ph === 'end' ? G.hist : null, places: G.places || null, how: G.how || '', top: G.top || null,
      };
    },
    over(G) { return G.ph === 'end'; },
    results(G) { return { scores: G.pts.slice(), places: G.places, exile: G.exile, exileHow: G.how }; },
  };

  // ---------- 화면 공통 ----------
  function decodeBlocks(str) {
    return str.split(',').map((x) => (/^[0-9]/.test(x) ? { d: +x, o: '' } : { d: +x.slice(1), o: x[0] }));
  }

  function blockEl(B, id, cls, onclick) {
    const b = B[id];
    return h(onclick ? 'button' : 'div', {
      class: 'tile tb ' + (b.o ? 'op' : 'num') + (cls || ''), type: onclick ? 'button' : null, onclick,
      'aria-label': b.o ? '기호 블록 ' + C.face(b) : '숫자 블록 ' + b.d,
    }, C.face(b));
  }

  // I: 조작 {sel, flip, pick(ti, k), drop(ti)} 또는 null(보기만)
  function towersView(B, T, goal, I, lastMv) {
    const row = h('div', { class: 'towers', 'data-b': B.map((b) => b.o + b.d).join(','), 'data-t': JSON.stringify(T), 'data-goal': goal ? goal.v + '@' + goal.h : '' });
    T.forEach((tw, ti) => {
      const src = I && I.sel && I.sel.t === ti;
      const canDrop = I && I.sel && (I.sel.t !== ti || (I.flip && I.sel.k >= 2));
      const col = h('div', { class: 'tw-col' + (canDrop ? ' droppable' : '') + (src ? ' source' : '') + (lastMv && lastMv.t === ti ? ' moved' : '') });
      const stack = h('div', { class: 'tw-stack' });
      for (let i = tw.length - 1; i >= 0; i--) {
        const k = tw.length - i;
        stack.append(blockEl(B, tw[i], src && k <= I.sel.k ? ' sel' : '', I ? (e) => { e.stopPropagation(); I.pick(ti, k); } : null));
      }
      const r = C.readTower(B, tw);
      const hit = r && goal && tw.length === goal.h && r.value === goal.v;
      col.append(
        h('div', { class: 'tw-label' }, C.TNAMES[ti] + ' · ' + tw.length + '층'),
        stack,
        h('div', { class: 'tw-base' }),
        h('div', { class: 'tw-read' + (hit ? ' hit' : '') }, r ? r.text + ' = ' + r.value : tw.length ? '식이 아님(맨 위가 기호)' : '비어 있음'));
      if (I) col.addEventListener('click', () => I.drop(ti));
      row.append(col);
    });
    return row;
  }

  // 블록 선택 → 놓을 자리 누르기
  function makeInteraction(state, doMove, redraw) {
    return {
      sel: state.sel, flip: state.flip,
      pick(ti, k) {
        if (state.sel && state.sel.t !== ti) { doMove({ f: state.sel.t, k: state.sel.k, t: ti, flip: state.flip }); return; }
        state.sel = state.sel && state.sel.t === ti && state.sel.k === k ? null : { t: ti, k };
        redraw();
      },
      drop(ti) {
        if (!state.sel) return;
        if (state.sel.t === ti) {
          if (state.flip && state.sel.k >= 2) doMove({ f: ti, k: state.sel.k, t: ti, flip: true });
          else { state.sel = null; redraw(); }
          return;
        }
        doMove({ f: state.sel.t, k: state.sel.k, t: ti, flip: state.flip });
      },
    };
  }

  function moveBar(state, used, bid, redraw, doMove) {
    return h('div', { class: 'tw-bar' },
      h('span', { class: 'moves' + (used === bid - 1 ? ' last' : '') }, '이동 ', h('b', null, used), ' / ' + bid),
      h('button', { class: 'toggle' + (state.flip ? ' on' : ''), 'aria-pressed': state.flip ? 'true' : 'false', onclick: () => { state.flip = !state.flip; redraw(); } }, state.flip ? '뒤집어서 놓기 켜짐' : '뒤집어서 놓기 꺼짐'),
      state.sel && state.sel.k >= 2 ? h('button', { class: 'btn tiny', onclick: () => doMove({ f: state.sel.t, k: state.sel.k, t: state.sel.t, flip: true }) }, '선택한 ' + state.sel.k + '개 제자리 뒤집기') : null);
  }

  function goalCard(goal, extra) {
    return h('div', { class: 'goal-card' },
      h('span', { class: 'goal-k' }, '타깃 넘버'), h('strong', { class: 'goal-v' }, String(goal.v)),
      h('span', { class: 'goal-k' }, '목표 층수'), h('strong', { class: 'goal-v' }, goal.h + '층'),
      extra || null);
  }

  function stepper(val, min, max, set) {
    return h('div', { class: 'stepper' },
      h('button', { class: 'btn', 'aria-label': '하나 줄이기', disabled: val <= min, onclick: () => set(Math.max(min, val - 1)) }, '−'),
      h('strong', { class: 'step-v' }, val + '번'),
      h('button', { class: 'btn', 'aria-label': '하나 늘리기', disabled: val >= max, onclick: () => set(Math.min(max, val + 1)) }, '+'));
  }

  function solutionEl(path, d, open) {
    return h('details', { class: 'solution', open: open ? '' : null },
      h('summary', null, '라운드 시작 상태에서의 최단 풀이 (' + d + '번)'),
      h('ol', null, path.map((m) => h('li', null, C.describe(m)))));
  }

  // ---------- 대결 화면 ----------
  const WHY = { moves: '제시한 횟수를 다 썼지만 만들지 못했어요.', time: '2분 안에 만들지 못했어요.', give: '도전을 포기했어요.' };

  function renderGame(g, s) {
    const W = s.W, st = W.s, me = s.mySeat, L = s.local;
    const names = W.pl.map((p) => p.n);
    const B = decodeBlocks(st.B);
    const rk = W.gn + ':' + st.round;
    if (L.rk !== rk) { L.rk = rk; L.sel = null; L.flip = false; L.bid = null; }
    const pk = rk + ':' + st.ph;
    if (L.pk !== pk) { L.pk = pk; L.bid = null; L.sel = null; }
    if (L.vk !== W.v) { L.vk = W.v; L.until = Date.now() + (st.rem || 0); }
    // 나와 관계있는 단계 시간이면 data-hurry: 15초 안쪽에서 배경 음악이 빨라짐
    const mine = me >= 0 && (st.ph === 'buzz' || (st.ph === 'under' && !st.done[me]) || (st.ph === 'try' && st.att && st.att.s === me));
    const timer = (label) => h('span', { class: 'pill' }, label + ' ', h('b', { 'data-until': String(L.until), 'data-hurry': mine ? '1' : null }, App.leftText(L.until - Date.now())));
    const active = (i) => (st.ph === 'buzz') || (st.ph === 'under' && !st.done[i]) || (st.ph === 'try' && st.att.s === i);

    g.append(h('div', { class: 'wl-head' },
      names.map((nm, i) => h('span', { class: 'wl-player' + (st.ph !== 'buzz' && active(i) ? ' turn' : '') },
        App.avatar.seat(W, i), nm, i === me ? ' (나)' : '',
        h('b', { class: 'wl-score' }, st.pts[i] + '점'))),
      h('span', { class: 'pill' }, '라운드 ' + st.round + (st.ot ? ' · 연장' : '') + ' · ' + WIN + '점 먼저')));

    if (st.ph === 'end') { renderEnd(g, s, names); return; }

    const phaseTimer = st.ph === 'buzz' ? timer('버저') : st.ph === 'under' ? timer('추가 제시') : st.ph === 'try' ? timer('도전') : null;
    g.append(goalCard(st.goal, phaseTimer));

    const myTry = st.ph === 'try' && st.att.s === me && !s.waiting;
    const doMove = (m) => { L.sel = null; s.send({ t: 'mv', f: m.f, k: m.k, to: m.t, flip: m.flip }); };
    const redraw = () => s.onUpdate(s);
    if (L.flip == null) L.flip = false;

    const bidsEl = () => (st.bids.length ? h('div', { class: 'tw-bids' }, st.bids.map(([who, n, w]) => h('span', { class: 'chip-tag' + (st.low && st.low.s === who ? ' on' : '') }, names[who] + ' ' + n + '번' + (w === 1 ? ' (최초)' : ' (추가)')))) : null);

    if (st.ph === 'buzz') {
      g.append(towersView(B, st.T, st.goal, null));
      const box = h('div', { class: 'declare' },
        h('p', null, '블록을 머릿속으로 옮겨 보고, ', h('b', null, st.goal.h + '층짜리 ' + st.goal.v), ' 탑을 ', h('b', null, '몇 번 만에'), ' 만들 수 있는지 버저를 눌러 제시하세요.'));
      if (me >= 0) {
        if (L.bid == null) L.bid = 3;
        box.append(stepper(L.bid, 1, MAXBID, (v) => { L.bid = v; redraw(); }),
          h('button', { class: 'btn primary big buzzer', disabled: s.waiting, onclick: () => s.send({ t: 'buzz', n: L.bid }) }, '🔔 ' + L.bid + '번에 만들게요'));
      }
      box.append(h('p', { class: 'note' }, '5분 안에 아무도 버저를 누르지 않으면 이번 문제는 무효예요.'));
      g.append(box);
    } else if (st.ph === 'under') {
      g.append(towersView(B, st.T, st.goal, null));
      const box = h('div', { class: 'declare' },
        h('p', { class: 'status strong' }, names[st.low.s] + ' 님이 ' + st.low.n + '번을 제시했어요!'), bidsEl());
      const canBid = me >= 0 && !st.done[me];
      if (canBid) {
        const max = st.low.n - 1;
        if (L.bid == null || L.bid > max) L.bid = max;
        box.append(h('p', null, '더 적은 횟수로 만들 수 있다면 한 번만 부를 수 있어요. 성공하면 ', h('b', null, '+2점'), ', 실패하면 ', h('b', null, '−2점'), '.'),
          stepper(L.bid, 1, max, (v) => { L.bid = v; redraw(); }),
          h('div', { class: 'row wrap center' },
            h('button', { class: 'btn primary big', disabled: s.waiting, onclick: () => s.send({ t: 'under', n: L.bid }) }, L.bid + '번으로 더 적게'),
            h('button', { class: 'btn ghost', disabled: s.waiting, onclick: () => s.send({ t: 'pass' }) }, '패스')));
      } else if (me >= 0) {
        box.append(h('p', { class: 'note' }, me === st.bids[0][0] ? '처음 제시한 사람은 더 부를 수 없어요. 다른 사람의 제시를 기다리는 중…' : '제시를 마쳤어요. 다른 사람을 기다리는 중…'));
      }
      box.append(h('p', { class: 'note' }, names.map((nm, i) => nm + ': ' + (st.bids.some((b) => b[0] === i) ? '제시' : st.done[i] ? '패스' : '생각 중')).join(' · ')));
      g.append(box);
    } else if (st.ph === 'try') {
      const A = st.att;
      if (myTry) {
        g.append(h('p', { class: 'status strong' }, '내 도전! ' + A.bid + '번 안에 ' + st.goal.h + '층짜리 ' + st.goal.v + ' 탑을 만드세요. (' + (A.w === 'first' ? '성공 +1 / 실패 −1' : '성공 +2 / 실패 −2') + ')'));
        g.append(moveBar(L, A.used, A.bid, redraw, doMove));
        g.append(h('p', { class: 'hint' }, L.sel ? '놓을 자리를 누르세요. 같은 자리를 다시 누르면 선택이 풀려요.' : '블록을 누르면 그 블록과 그 위에 있는 블록이 함께 들려요. 한 번 옮기면 되돌릴 수 없어요.'));
        g.append(towersView(B, st.T, st.goal, makeInteraction(L, doMove, redraw), st.lastMv));
        g.append(h('div', { class: 'row wrap center' }, h('button', { class: 'btn ghost', onclick: () => s.send({ t: 'give' }) }, '도전 포기')));
      } else {
        g.append(h('p', { class: 'status' }, names[A.s] + ' 님이 ' + A.bid + '번 안에 도전 중… (' + A.used + ' / ' + A.bid + '번 이동)'), bidsEl());
        g.append(towersView(B, st.T, st.goal, null, st.lastMv));
      }
    } else if (st.ph === 'between') {
      const r = st.res;
      g.append(towersView(B, st.T, st.goal, null, st.lastMv));
      const box = h('div', { class: 'result-box' + (r && !r.void && r.s === me ? (r.ok ? ' ok' : ' bad') : '') });
      if (!r || r.void) box.append(h('strong', { class: 'result-big' }, '무효'), h('p', null, '5분 동안 아무도 버저를 누르지 않아 이번 문제는 무효예요.'));
      else {
        box.append(h('strong', { class: 'result-big' }, names[r.s] + (r.ok ? ' 성공! ' : ' 실패 ') + (r.delta > 0 ? '+' : '') + r.delta + '점'),
          h('p', null, (r.w === 'first' ? '처음 제시' : '추가 시간 제시') + ' ' + r.bid + '번 · 실제 ' + r.used + '번 이동' + (r.ok ? '' : ' — ' + (WHY[r.why] || ''))));
      }
      if (st.sol) box.append(solutionEl(st.sol, st.sd, !r || r.void || !r.ok));
      box.append(h('p', { class: 'note' }, '탑은 지금 모양 그대로 다음 라운드로 이어져요. ', h('b', { 'data-until': String(L.until) }, App.leftText(L.until - Date.now())), ' 뒤 다음 문제.'));
      g.append(box);
    }

    if (st.log.length) g.append(h('ul', { class: 'hv-log' }, st.log.slice().reverse().slice(0, 5).map((e) => {
      const who = e[0] >= 0 ? names[e[0]] : '';
      if (e[1] === 'buzz') return h('li', null, '🔔 ' + who + ': ' + e[2] + '번 제시');
      if (e[1] === 'under') return h('li', null, '⏱ ' + who + ': 추가 시간에 ' + e[2] + '번 제시');
      if (e[1] === 'pass') return h('li', null, who + ': 패스');
      if (e[1] === 'try') return h('li', null, who + ': ' + e[2] + '번 안에 도전 시작');
      if (e[1] === 'void') return h('li', null, '아무도 버저를 누르지 않아 무효');
      return h('li', { class: e[1] === 'ok' ? '' : 'boom' }, who + ': ' + (e[1] === 'ok' ? '성공 ' : '실패 ') + (e[2] > 0 ? '+' : '') + e[2] + '점');
    })));
  }

  function renderEnd(g, s, names) {
    const st = s.W.s, me = s.mySeat;
    const order = [...names.keys()].sort((a, b) => st.pts[b] - st.pts[a]);
    const ex = st.places ? st.places.indexOf('exile') : -1;
    g.append(h('div', { class: 'result-box' + (ex >= 0 && ex === me ? ' bad' : st.top && st.top.includes(me) ? ' ok' : '') },
      h('strong', { class: 'result-big' }, st.top && st.top.length === 1 ? names[st.top[0]] + ' 1위!' : '게임 종료'),
      h('ol', { class: 'tw-final' }, order.map((i) => h('li', { class: i === me ? 'me' : '' }, names[i] + ' — ' + st.pts[i] + '점' + (st.top && st.top.includes(i) ? ' (1위 · 피스 3개)' : '') + (i === ex ? ' (최하위 탈락)' : '')))),
      null));
  }

  function renderOptions(o, s, disabled) {
    const W = s.W;
    o.append(h('div', { class: 'toolbar' }, h('span', { class: 'opt-label' }, '문제 난도'),
      h('div', { class: 'seg small' }, [['easy', '쉬움 (2~3번)'], ['normal', '보통 (3~4번)']].map(([v, l]) => h('button', { class: 'seg-btn' + ((W.o.lvl || 'normal') === v ? ' on' : ''), disabled, onclick: () => s.setOpt('lvl', v) }, l)))));
    if (!W.pl.some((p) => p.b)) return;
    o.append(h('div', { class: 'toolbar' }, h('span', { class: 'opt-label' }, '컴퓨터 실력'),
      h('div', { class: 'seg small' }, [['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']].map(([v, l]) => h('button', { class: 'seg-btn' + ((W.o.ai || 'normal') === v ? ' on' : ''), disabled, onclick: () => s.setOpt('ai', v) }, l)))));
  }

  // ---------- 혼자 연습 ----------
  const SOLO_ROUNDS = 5;
  function solo(root, ctx) {
    const wrap = h('div', { class: 'tower-game' });
    root.append(wrap);
    let G;
    let firstDone = false;

    function newGame() {
      G = { B: C.makeBlocks(NB, PLAIN), T: C.randomTowers(NB), round: 0, score: 0, log: [], used: new Set(), sel: null, flip: false };
      if (App.music) App.music.claim('tower-solo'); // 연습하는 동안 배경 음악
      nextRound();
    }
    function nextRound() {
      G.round++;
      if (G.round > SOLO_ROUNDS) { G.phase = 'over'; if (App.music) App.music.release('tower-solo'); draw(); return; }
      const want = G.round <= 2 ? 2 + (G.round - 1) : R.pick([3, 4]);
      let goal = C.pickGoal(G.B, G.T, want, G.used);
      if (!goal) { G.T = C.randomTowers(NB); goal = C.pickGoal(G.B, G.T, want, G.used); }
      G.goal = goal;
      G.used.add(goal.v + '@' + goal.h);
      G.declared = Math.min(MAXBID, goal.d + 1);
      G.start = G.T.map((t) => t.slice());
      G.moves = 0; G.sel = null; G.flip = false; G.lastMv = null;
      G.phase = 'declare';
      draw();
    }
    function doMove(m) {
      if (!C.validMove(G.T, m)) { G.sel = null; draw(); return; }
      G.T = C.apply(G.T, m);
      G.moves++; G.sel = null; G.lastMv = m;
      if (C.goalMet(G.B, G.T, G.goal)) return endRound(true);
      if (G.moves >= G.declared) return endRound(false);
      draw();
    }
    function endRound(ok, gaveUp) {
      const pts = ok ? (G.declared === G.goal.d ? 2 : 1) : -1;
      G.score += pts;
      G.last = { ok, pts, gaveUp };
      G.log.push({ round: G.round, goal: G.goal.v + ' · ' + G.goal.h + '층', declared: G.declared, ok, pts });
      G.phase = 'result';
      draw();
      if (!firstDone) { firstDone = true; ctx.finished({}); } // 첫 라운드만 끝내도 공략이 열림
    }
    function draw() {
      App.clear(wrap);
      wrap.append(h('div', { class: 'tw-head' },
        h('span', { class: 'pill' }, '라운드 ' + Math.min(G.round, SOLO_ROUNDS) + ' / ' + SOLO_ROUNDS),
        h('span', { class: 'pill strong' }, '점수 ' + G.score),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn tiny ghost', onclick: newGame }, '새 블록')));
      if (G.phase === 'over') {
        wrap.append(h('div', { class: 'result-box' },
          h('strong', { class: 'result-big' }, '최종 ' + G.score + '점'),
          h('p', null, '연습 점수: 제시한 횟수가 최단 수와 같으면 +2, 제시한 횟수 안에 성공하면 +1, 실패하면 −1이에요.'),
          h('table', { class: 'log' },
            h('thead', null, h('tr', null, ['라운드', '목표', '제시', '결과'].map((x) => h('th', null, x)))),
            h('tbody', null, G.log.map((r) => h('tr', null, h('td', null, r.round), h('td', null, r.goal), h('td', null, r.declared + '번'), h('td', null, (r.ok ? '성공 ' : '실패 ') + (r.pts > 0 ? '+' : '') + r.pts))))),
          h('button', { class: 'btn primary', onclick: newGame }, '새 블록으로 다시')));
        return;
      }
      wrap.append(goalCard(G.goal));
      if (G.phase === 'declare') {
        wrap.append(towersView(G.B, G.T, G.goal, null));
        wrap.append(h('div', { class: 'declare' },
          h('p', null, '몇 번 만에 ', h('b', null, G.goal.h + '층짜리 ' + G.goal.v), ' 탑을 만들 수 있을까요? 머릿속으로 옮겨 보고 횟수를 제시하세요.'),
          stepper(G.declared, 1, MAXBID, (v) => { G.declared = v; draw(); }),
          h('button', { class: 'btn primary big', onclick: () => { G.phase = 'play'; draw(); } }, G.declared + '번 안에 도전')));
        return;
      }
      if (G.phase === 'play') {
        wrap.append(moveBar(G, G.moves, G.declared, draw, doMove));
        wrap.append(h('p', { class: 'hint' }, G.sel ? '놓을 자리를 누르세요. 같은 자리를 다시 누르면 선택이 풀려요.' : '블록을 누르면 그 블록과 그 위에 있는 블록이 함께 들려요. 방송처럼 한 번 옮기면 되돌릴 수 없어요.'));
        wrap.append(towersView(G.B, G.T, G.goal, makeInteraction(G, doMove, draw), G.lastMv));
        wrap.append(h('div', { class: 'row wrap center' }, h('button', { class: 'btn ghost', onclick: () => endRound(false, true) }, '포기')));
        return;
      }
      const Lr = G.last;
      wrap.append(towersView(G.B, G.T, G.goal, null, G.lastMv));
      wrap.append(h('div', { class: 'result-box' + (Lr.ok ? ' ok' : ' bad') },
        h('strong', { class: 'result-big' }, Lr.ok ? '성공 +' + Lr.pts : (Lr.gaveUp ? '포기 ' : '실패 ') + Lr.pts),
        h('p', null, '제시 ' + G.declared + '번 · 실제 ' + G.moves + '번 · 최단 ' + G.goal.d + '번' + (Lr.ok && Lr.pts === 2 ? ' — 최단 수를 정확히 제시했어요!' : '')),
        solutionEl(G.goal.path, G.goal.d, !Lr.ok),
        h('p', { class: 'note' }, '방송 규칙처럼 성공하든 실패하든 지금 탑 모양 그대로 다음 라운드를 시작해요.'),
        h('button', { class: 'btn primary', onclick: nextRound }, G.round >= SOLO_ROUNDS ? '최종 결과 보기' : '다음 라운드')));
    }
    newGame();
    return () => { if (App.music) App.music.release('tower-solo'); };
  }

  function mount(root, ctx) {
    const tabs = h('div', { class: 'seg', role: 'tablist' });
    const body = h('div');
    root.append(tabs, body);
    let cleanup = null;
    function setMode(m) {
      if (cleanup) cleanup();
      App.clear(body); App.clear(tabs);
      App.store.set('tower.mode', m);
      [['multi', '대결 (컴퓨터·온라인)'], ['solo', '혼자 연습']].forEach(([id, label]) => tabs.append(h('button', { class: 'seg-btn' + (m === id ? ' on' : ''), role: 'tab', 'aria-selected': m === id ? 'true' : 'false', onclick: () => setMode(id) }, label)));
      cleanup = m === 'solo' ? solo(body, ctx) : App.multi.mount(body, ctx, { gameId: 'tower', engine, renderGame, renderOptions, soloLabel: '컴퓨터와 하기' });
    }
    setMode(App.store.get('tower.mode', 'multi') === 'solo' ? 'solo' : 'multi');
    return () => { if (cleanup) cleanup(); };
  }

  App.tower = { engine, decodeBlocks, towersView };

  App.games.push({
    id: 'tower',
    name: '수식의 탑',
    kicker: '감옥 매치',
    players: '2~6인 · 온라인 / 컴퓨터 · 혼자 연습',
    blurb: '타깃 넘버와 목표 층수가 공개되면 버저를 눌러 “몇 번 만에 만들 수 있는지” 부릅니다. 가장 적게 부른 사람이 직접 블록을 옮겨 도전! 7점을 먼저 얻으면 끝.',
    accent: 'tower',
    mount,
    rules: `
<p>숫자 블록을 옮겨 탑을 쌓아 <b>타깃 넘버</b>를 완성하는 게임입니다.</p>
<div class="demo" data-demo="rules-tower"></div>
<h4>블록과 탑</h4>
<ul>
<li>블록은 <b>기호가 없는 숫자 블록</b>(예: 7)과 <b>기호가 붙은 숫자 블록</b>(예: +3, ×4)이 있습니다. 블록 7개가 세 자리에 나뉘어 쌓여 있습니다.</li>
<li>수식은 <b>탑의 맨 위층부터 아래로</b> 읽습니다. 맨 위층은 <b>기호가 없는 숫자 블록</b>이어야 식이 됩니다. 예: 위에서부터 5, ×4, +3 → 5 × 4 + 3 = 23.</li>
<li>곱셈(×)을 덧셈·뺄셈보다 먼저 계산합니다. 기호 없는 블록이 이어지면 여러 자리 수로 읽습니다(5 아래 3 → 53).</li>
</ul>
<h4>한 라운드</h4>
<ol>
<li>매 라운드 <b>타깃 넘버</b>(식의 값)와 <b>목표 층수</b>(탑의 층수)가 공개됩니다. 예: 타깃 23, 3층.</li>
<li><b>5분</b> 안에 버저를 눌러 <b>이동 횟수</b>를 제시합니다. 아무도 누르지 않으면 그 문제는 무효이고 다음 라운드로 넘어갑니다.</li>
<li>누군가 처음 제시하면 5분은 끝나고, 다른 사람들에게 <b>더 적은 횟수</b>를 부를 수 있는 <b>2분</b>이 주어집니다. 한 사람당 한 번만 부를 수 있습니다.</li>
<li><b>가장 적은 횟수</b>를 부른 사람만 실제로 도전합니다. <b>2분</b> 안에, 제시한 횟수 이내로 블록을 옮겨 목표 층수의 탑이 타깃 넘버가 되면 성공입니다.</li>
</ol>
<h4>이동</h4>
<ul>
<li>한 자리에 쌓인 블록을 <b>위에서부터 원하는 개수만큼</b> 들어 올려 원하는 자리에 내려놓는 것이 1번의 이동입니다.</li>
<li>내려놓을 때 들어 올린 묶음을 <b>위아래로 뒤집어</b> 놓을 수 있습니다(순서가 거꾸로 됩니다). 들어 올린 자리에 뒤집어 다시 놓아도 1번입니다.</li>
</ul>
<h4>승점과 종료</h4>
<ul>
<li>처음 5분 안에 제시한 사람이 도전하면 성공 <b>+1점</b>, 실패 <b>−1점</b>입니다.</li>
<li>추가 2분에 더 적게 부른 사람이 도전하면 성공 <b>+2점</b>, 실패 <b>−2점</b>입니다.</li>
<li>다음 라운드는 <b>지금 탑 모양 그대로</b> 새 타깃 넘버와 목표 층수로 진행합니다.</li>
<li>누군가 <b>7점</b>이 되면 게임이 끝나고, 그때 <b>최하위</b>가 탈락합니다. 최하위가 동점이면 한 명이 가려질 때까지 연장합니다. 1위는 피스 3개를 받습니다.</li>
</ul>
<p class="note">이 사이트에서 정한 것: 블록 7개(기호 없는 블록 2개)와 자리 3곳, 곱셈 먼저 계산, 이어진 숫자는 여러 자리 수, 제시는 1~9번, 연장이 40라운드까지 가도 가려지지 않으면 추첨.</p>`,
    guide: `
<h4>1. 타깃 넘버부터 거꾸로 식을 정하기</h4>
<p>“어떤 식이면 타깃 넘버가 나오는가”를 먼저 정합니다. 목표 층수가 3층이면 숫자 블록 1개 아래 기호 블록 2개, 4층이면 기호 블록 3개입니다. 맨 위에 올릴 <b>기호 없는 블록</b>이 두 개뿐이니, 어느 쪽을 맨 위에 둘지부터 정하면 후보가 확 줄어듭니다. 곱셈이 먼저라는 점도 이용하세요. 예: 타깃 23, 3층이라면 23 = 5 × 4 + 3 이니 맨 위에 기호 없는 5, 그 아래 ×4, 맨 아래 +3을 쌓으면 됩니다.</p>
<h4>2. 뒤집기는 순서를 거꾸로 만든다</h4>
<p>묶음을 뒤집어 놓으면 위아래 순서가 반대가 됩니다. 원하는 순서와 정확히 거꾸로 붙어 있는 묶음은 뒤집어서 한 번에 옮기면 됩니다. 맨 아래 깔린 기호 없는 블록을 맨 위로 올리고 싶을 때도 “통째로 들어 뒤집기”가 가장 쌉니다.</p>
<div class="demo" data-demo="tower"></div>
<h4>3. 이동 횟수는 “집는 횟수”</h4>
<p>블록 개수가 아니라 들어 올리는 횟수를 셉니다. 이미 올바른 순서로 붙어 있는 2~3개는 한 번에 옮기세요. 비어 있는 자리가 생기면 완성할 탑의 바닥으로 쓰고, 남은 한 곳을 임시 보관용으로 쓰면 계획이 단순해집니다.</p>
<h4>4. 언제 버저를 누를까</h4>
<p>처음 제시는 성공 +1 / 실패 −1이라 부담이 적습니다. 대신 다른 사람이 더 적게 부르면 도전 기회를 뺏깁니다. 풀이를 찾았다면 일단 누르는 것이 좋고, 시간이 남았다면 한 번 더 줄일 수 있는지 확인해 보세요.</p>
<h4>5. 추가 2분은 확신이 있을 때만</h4>
<p>추가 시간의 제시는 성공 +2 / 실패 −2입니다. 남이 부른 횟수보다 적게 만드는 경로를 <b>끝까지 따라가 본 경우에만</b> 부르세요. 점수가 앞서 있다면 패스해서 위험을 피하는 것도 방법입니다. 결과 화면의 “최단 풀이”로 놓친 이동을 확인해 보세요.</p>`,
  });
})();
