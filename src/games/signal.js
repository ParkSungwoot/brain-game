/* 수식 신호등: 숨은 등식을 초록·노랑·빨강 신호로 추리 (혼자 / 1:1 온라인) */
(function () {
  const App = (globalThis.App = globalThis.App || {});
  const { h, rng: R } = App;
  const E = App.eq;

  // ---------- 문제 만들기 ----------
  function randNum() {
    const r = Math.random();
    if (r < 0.06) return '0';
    const d = r < 0.55 ? 1 : r < 0.93 ? 2 : 3;
    let s = String(R.int(1, 9));
    for (let i = 1; i < d; i++) s += R.int(0, 9);
    return s;
  }

  function trivial(lhs) {
    const t = E.tokenize(lhs);
    for (let i = 0; i < t.length; i++) {
      if (t[i].k !== 'n') continue;
      const v = t[i].v[0];
      const L = t[i - 1] && t[i - 1].v, Rr = t[i + 1] && t[i + 1].v;
      if (v === 0 && L !== '^' && Rr !== '^') return true;
      if (v === 1 && (L === '*' || L === '/' || Rr === '*' || L === '^')) return true;
    }
    return false;
  }

  function genEquation(len, usePow) {
    const basic = ['+', '-', '*', '/'];
    const wantPow = usePow && Math.random() < 0.6;
    for (let t = 0; t < 80000; t++) {
      const nOps = R.int(1, len >= 9 ? 3 : 2);
      let lhs = randNum();
      let last = lhs;
      let powUsed = false;
      for (let k = 0; k < nOps; k++) {
        let op = R.pick(basic);
        if (wantPow && !powUsed && Math.random() < 0.45) op = '^';
        let num;
        if (op === '^') { powUsed = true; num = String(R.pick([0, 0, 2, 2, 3, 3, 4, 5])); if (+last > 30) { num = '2'; } }
        else if (op === '/') num = String(R.int(1, 12));
        else num = randNum();
        lhs += op + num;
        last = num;
      }
      let v;
      try { v = E.evalExpr(lhs); } catch (e) { continue; }
      if (v[1] !== 1 || v[0] < 0) continue;
      const eq = lhs + '=' + v[0];
      if (eq.length !== len) continue;
      if (wantPow && !lhs.includes('^')) continue;
      if (trivial(lhs) && Math.random() < 0.8) continue; // 너무 뻔한 ×1, +0 같은 식 줄이기
      return eq;
    }
    return len === 7 ? '12+5=17' : len === 8 ? '6*7-2=40' : len === 10 ? '8*9-15=57'.padEnd(10, '') : '7*8-29=27';
  }

  function grade(guess, ans) {
    return guess.split('').map((c, i) => (c === ans[i] ? 'g' : ans.includes(c) ? 'y' : 'r')).join('');
  }

  function validateGuess(s, len, pow) {
    if (s.length !== len) return len + '칸을 모두 채워 주세요';
    if (!pow && s.includes('^')) return '이 판에서는 ^ 를 쓸 수 없어요';
    const c = E.checkEquation(s);
    return c.ok ? null : c.msg;
  }

  // 추리로 내는 줄: 참인 등식이 아니어도 되고 = 가 없어도 됨. 칸 수와 쓸 수 있는 문자만 확인
  function validateProbe(s, len, pow) {
    if (s.length !== len) return len + '칸을 모두 채워 주세요';
    if (!pow && s.includes('^')) return '이 판에서는 ^ 를 쓸 수 없어요';
    if (!/^[0-9+\-*/^=]+$/.test(s)) return '숫자와 + − × ÷ ^ = 만 쓸 수 있어요';
    return null;
  }

  function triesFor(len) { return len <= 7 ? 6 : len === 8 ? 7 : 8; }

  // ---------- 입력용 화면 조각 ----------
  const KEYS_NUM = '1234567890'.split('');
  function keyStates(guesses, fbs) {
    const st = {};
    const rank = { g: 3, y: 2, r: 1 };
    guesses.forEach((g, i) => g.split('').forEach((c, j) => {
      const f = fbs[i][j];
      if (!st[c] || rank[f] > rank[st[c]]) st[c] = f;
    }));
    return st;
  }

  function rowEl(text, fb, len, opts) {
    opts = opts || {};
    const cells = [];
    for (let i = 0; i < len; i++) {
      const c = text[i] || '';
      const f = fb ? fb[i] : '';
      cells.push(h('span', { class: 'sq' + (f ? ' f-' + f : '') + (opts.active && i === text.length ? ' cursor' : '') + (c && !f ? ' filled' : ''), 'aria-label': c ? E.show(c) + (f ? ' ' + ({ g: '초록', y: '노랑', r: '빨강' })[f] : '') : '빈 칸' }, c ? E.show(c) : ''));
    }
    return h('div', { class: 'sq-row' + (opts.shake ? ' shake' : '') }, cells);
  }

  function keyboardEl(pow, states, onKey) {
    const ops = pow ? ['+', '-', '*', '/', '^', '='] : ['+', '-', '*', '/', '='];
    const key = (k, label, cls) => h('button', { class: 'key ' + (cls || '') + (states[k] ? ' f-' + states[k] : ''), type: 'button', onclick: () => onKey(k), 'aria-label': label || E.show(k) }, label || E.show(k));
    return h('div', { class: 'kbd' },
      h('div', { class: 'kbd-row' }, KEYS_NUM.map((k) => key(k))),
      h('div', { class: 'kbd-row' }, ops.map((k) => key(k, null, 'op')), key('back', '지우기', 'wide'), key('enter', '입력', 'wide enter')));
  }

  function normKey(e) {
    const k = e.key;
    if (k === 'Enter') return 'enter';
    if (k === 'Backspace') return 'back';
    const map = { 'x': '*', 'X': '*', '×': '*', '÷': '/', '−': '-' };
    const c = map[k] || k;
    if (c.length === 1 && '0123456789+-*/^='.includes(c)) return c;
    return null;
  }

  // ---------- 1:1 온라인 규칙 (방장 화면에서 계산) ----------
  const engine = {
    id: 'signal',
    minPlayers: 2, maxPlayers: 2, allowBots: false,
    defaultOpts: { len: 9, pow: 1 },
    start(players, o) {
      return { len: o.len || 9, pow: o.pow ? 1 : 0, ph: 'set', sec: [null, null], gs: [[], []], fb: [[], []], sub: [null, null], turn: 1, maxT: 10, win: null, why: '' };
    },
    act(G, seat, a) {
      if (!a || seat < 0 || seat > 1) throw new Error('잘못된 행동');
      if (a.t === 'sec') {
        if (G.ph !== 'set' || G.sec[seat]) throw new Error('지금은 수식을 정할 수 없어요');
        const err = validateGuess(String(a.eq || ''), G.len, G.pow);
        if (err) throw new Error(err);
        G.sec[seat] = String(a.eq);
        if (G.sec[0] && G.sec[1]) G.ph = 'guess';
        return;
      }
      if (a.t === 'g') {
        if (G.ph !== 'guess' || G.sub[seat]) throw new Error('지금은 낼 수 없어요');
        const err = validateProbe(String(a.eq || ''), G.len, G.pow);
        if (err) throw new Error(err);
        G.sub[seat] = String(a.eq);
        if (G.sub[0] && G.sub[1]) {
          const solved = [false, false];
          for (let s = 0; s < 2; s++) {
            const f = grade(G.sub[s], G.sec[1 - s]);
            G.gs[s].push(G.sub[s]);
            G.fb[s].push(f);
            solved[s] = f === 'g'.repeat(G.len);
          }
          G.sub = [null, null];
          if (solved[0] || solved[1]) {
            G.ph = 'end';
            G.win = solved[0] && solved[1] ? -1 : solved[0] ? 0 : 1;
            G.why = solved[0] && solved[1] ? '같은 턴에 둘 다 맞혔어요' : G.turn + '턴 만에 맞혔어요';
          } else if (G.turn >= G.maxT) {
            G.ph = 'end';
            const gc = [0, 1].map((s) => G.fb[s][G.fb[s].length - 1].split('').filter((x) => x === 'g').length);
            G.win = gc[0] === gc[1] ? -1 : gc[0] > gc[1] ? 0 : 1;
            G.why = G.maxT + '턴 종료: 마지막 줄 초록 ' + gc[0] + ' 대 ' + gc[1];
          } else G.turn++;
        }
        return;
      }
      throw new Error('알 수 없는 행동');
    },
    pending(G) {
      if (G.ph === 'set') return [0, 1].filter((s) => !G.sec[s]);
      if (G.ph === 'guess') return [0, 1].filter((s) => !G.sub[s]);
      return [];
    },
    timeLimit(G) { return G.ph === 'set' ? 180000 : 150000; },
    timeout(G, seat) { return { t: G.ph === 'set' ? 'sec' : 'g', eq: genEquation(G.len, G.pow) }; },
    bot(G, seat) { return engine.timeout(G, seat); },
    publicView(G) {
      return { len: G.len, pow: G.pow, ph: G.ph, turn: G.turn, maxT: G.maxT, gs: G.gs, fb: G.fb, sub: G.sub.map((x) => (x ? 1 : 0)), set: G.sec.map((x) => (x ? 1 : 0)), win: G.win, why: G.why, sec: G.ph === 'end' ? G.sec : null };
    },
    over(G) { return G.ph === 'end'; },
    results(G) { return { win: G.win, scores: [0, 1].map((s) => (s === G.win ? 1 : 0)) }; },
  };

  // ---------- 화면 ----------
  function mount(root, ctx) {
    let keyHandler = null;
    const onDoc = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = normKey(e);
      if (k && keyHandler) { e.preventDefault(); keyHandler(k); }
    };
    document.addEventListener('keydown', onDoc);

    const tabs = h('div', { class: 'seg', role: 'tablist' });
    const body = h('div');
    root.append(tabs, body);
    let cleanupMode = null;
    function setMode(m) {
      if (cleanupMode) cleanupMode();
      App.clear(body);
      keyHandler = null;
      App.clear(tabs);
      [['solo', '혼자 풀기'], ['duel', '1:1 온라인']].forEach(([id, label]) => tabs.append(h('button', { class: 'seg-btn' + (m === id ? ' on' : ''), role: 'tab', 'aria-selected': m === id ? 'true' : 'false', onclick: () => setMode(id) }, label)));
      cleanupMode = m === 'solo' ? solo(body) : duel(body);
    }

    // ----- 혼자 풀기 -----
    function solo(el) {
      let len = App.store.get('signal.len', 9);
      let pow = App.store.get('signal.pow', 1);
      let ans, guesses, fbs, cur, done, msg, shake;
      function fresh(randomVariant) {
        if (randomVariant) { len = R.pick([7, 8, 9, 9, 10]); pow = R.chance(0.6) ? 1 : 0; }
        App.store.set('signal.len', len); App.store.set('signal.pow', pow);
        ans = genEquation(len, pow);
        guesses = []; fbs = []; cur = ''; done = false; msg = ''; shake = false;
        draw();
      }
      function onKey(k) {
        if (done) return;
        shake = false;
        if (k === 'back') cur = cur.slice(0, -1);
        else if (k === 'enter') {
          const err = validateProbe(cur, len, pow);
          if (err) { msg = err; shake = true; draw(); return; }
          const f = grade(cur, ans);
          guesses.push(cur); fbs.push(f); cur = ''; msg = '';
          if (f === 'g'.repeat(len)) { done = true; msg = guesses.length + '번 만에 맞혔어요!'; ctx.finished({}); }
          else if (guesses.length >= triesFor(len)) { done = true; msg = '아쉬워요. 정답은 ' + E.show(ans) + ' 였어요.'; ctx.finished({}); }
        } else if (k === '^' && !pow) return;
        else if (cur.length < len) cur += k;
        draw();
      }
      function draw() {
        App.clear(el);
        keyHandler = onKey;
        const tries = triesFor(len);
        const opt = h('div', { class: 'toolbar' },
          h('div', { class: 'seg small' }, [7, 8, 9, 10].map((n) => h('button', { class: 'seg-btn' + (len === n ? ' on' : ''), onclick: () => { len = n; fresh(); } }, n + '칸'))),
          h('div', { class: 'seg small' }, [[0, '+ − × ÷'], [1, '^ 포함']].map(([v, l]) => h('button', { class: 'seg-btn' + (pow === v ? ' on' : ''), onclick: () => { pow = v; fresh(); } }, l))),
          h('button', { class: 'btn tiny', onclick: () => fresh(true) }, '랜덤 변형'),
          h('button', { class: 'btn tiny ghost', onclick: () => fresh() }, '새 문제'));
        const rows = [];
        for (let i = 0; i < tries; i++) {
          if (i < guesses.length) rows.push(rowEl(guesses[i], fbs[i], len));
          else if (i === guesses.length && !done) rows.push(rowEl(cur, null, len, { active: true, shake }));
          else rows.push(rowEl('', null, len));
        }
        el.append(opt,
          h('p', { class: 'hint' }, '숨은 ', h('b', null, len + '칸'), ' 등식을 ', h('b', null, tries + '번'), ' 안에 맞히세요. 내는 줄은 등식이 아니어도 돼요. 숫자·기호를 아무 자리에나 넣어 확인해 보세요.'),
          h('div', { class: 'sq-board', style: { '--len': len } }, rows),
          h('p', { class: 'status' + (done ? ' strong' : ''), 'aria-live': 'polite' }, msg || ' '),
          done ? h('div', { class: 'row center' }, h('button', { class: 'btn primary', onclick: () => fresh() }, '다음 문제'), h('button', { class: 'btn', onclick: () => fresh(true) }, '랜덤 변형으로')) : keyboardEl(pow, keyStates(guesses, fbs), onKey));
      }
      fresh();
      return () => { keyHandler = null; };
    }

    // ----- 1:1 온라인 -----
    function duel(el) {
      return App.multi.mount(el, ctx, {
        gameId: 'signal',
        engine,
        renderOptions(o, s, disabled) {
          const W = s.W;
          o.append(h('div', { class: 'toolbar' },
            h('span', { class: 'opt-label' }, '수식 길이'),
            h('div', { class: 'seg small' }, [7, 8, 9, 10].map((n) => h('button', { class: 'seg-btn' + (W.o.len === n ? ' on' : ''), disabled, onclick: () => s.setOpt('len', n) }, n + '칸'))),
            h('span', { class: 'opt-label' }, '연산'),
            h('div', { class: 'seg small' }, [[0, '+ − × ÷'], [1, '^ 포함']].map(([v, l]) => h('button', { class: 'seg-btn' + ((W.o.pow ? 1 : 0) === v ? ' on' : ''), disabled, onclick: () => s.setOpt('pow', v) }, l)))));
        },
        renderGame(g, s) {
          const W = s.W, st = W.s, me = s.mySeat, len = st.len;
          const L = s.local;
          if (L.gn !== W.gn) { L.gn = W.gn; L.buf = ''; L.secret = null; L.shake = false; L.msg = ''; }
          const names = W.pl.map((p) => p.n);
          const timer = (seat) => h('span', { class: 'timer', 'data-timer-seat': seat });
          function onKey(k) {
            if (st.ph === 'end' || me < 0) return;
            const canType = (st.ph === 'set' && !st.set[me] && !L.secret) || (st.ph === 'guess' && !st.sub[me]);
            if (!canType || s.waiting) return;
            L.shake = false;
            if (k === 'back') L.buf = L.buf.slice(0, -1);
            else if (k === 'enter') {
              const err = st.ph === 'set' ? validateGuess(L.buf, len, st.pow) : validateProbe(L.buf, len, st.pow);
              if (err) { L.msg = err; L.shake = true; s.onUpdate(s); return; }
              if (st.ph === 'set') { L.secret = L.buf; s.send({ t: 'sec', eq: L.buf }); }
              else s.send({ t: 'g', eq: L.buf });
              L.buf = ''; L.msg = '';
            } else if (k === '^' && !st.pow) return;
            else if (L.buf.length < len) L.buf += k;
            s.onUpdate(s);
          }
          keyHandler = onKey;
          const head = h('div', { class: 'duel-head' },
            names.map((n, i) => h('span', { class: 'duel-name' + (i === me ? ' me' : '') }, h('span', { class: 'seat-dot', style: { background: `var(--p${i})` } }), n, i === me ? ' (나)' : '')),
            h('span', { class: 'turn-pill' }, st.ph === 'set' ? '수식 정하기' : st.ph === 'guess' ? st.turn + ' / ' + st.maxT + '턴' : '종료'));
          g.append(head);

          if (st.ph === 'set') {
            const mine = me >= 0 && (st.set[me] || L.secret);
            g.append(h('div', { class: 'panel' },
              h('h4', { class: 'sub' }, me < 0 ? '두 사람이 비밀 수식을 정하는 중' : mine ? '내 비밀 수식' : '상대가 맞힐 비밀 수식을 만드세요'),
              me >= 0 ? rowEl(mine ? (L.secret || '') : L.buf, null, len, { active: !mine, shake: L.shake }) : null,
              h('p', { class: 'status' }, L.msg || (mine ? (st.set[1 - me] ? '' : '상대가 수식을 정하는 중… ') : '참인 등식 ' + len + '칸. 반복되는 문자나 ^0 같은 함정을 넣으면 맞히기 어려워져요. '), me >= 0 && !mine ? timer(me) : null),
              me >= 0 && !mine ? keyboardEl(st.pow, {}, onKey) : null));
            return;
          }

          const opp = me >= 0 ? 1 - me : 1;
          const viewer = me >= 0 ? me : 0;
          function board(seat, title, extra) {
            const rows = st.gs[seat].map((x, i) => rowEl(x, st.fb[seat][i], len));
            return h('div', { class: 'panel' }, h('h4', { class: 'sub' }, title), extra || null, h('div', { class: 'sq-board compact', style: { '--len': len } }, rows.length ? rows : h('p', { class: 'note' }, '아직 낸 줄이 없어요.')));
          }
          const myBoard = board(viewer, me >= 0 ? '내 추리 → ' + names[opp] + '의 수식' : names[0] + '의 추리');
          if (st.ph === 'guess' && me >= 0) {
            const sentRow = st.sub[me] ? h('p', { class: 'status' }, '제출했어요. ' + names[opp] + '을(를) 기다리는 중… ', timer(opp)) : null;
            myBoard.append(st.sub[me] ? sentRow : h('div', null,
              rowEl(L.buf, null, len, { active: true, shake: L.shake }),
              h('p', { class: 'status' }, L.msg || (s.waiting ? '보내는 중…' : '이번 턴의 추리를 입력하세요. 등식이 아니어도 돼요. '), timer(me))));
          }
          const oppBoard = board(opp, me >= 0 ? names[opp] + '의 추리 → 내 수식' : names[1] + '의 추리',
            me >= 0 && L.secret ? h('div', { class: 'secret' }, '내 수식 ', h('b', null, E.show(L.secret))) : null);
          g.append(h('div', { class: 'duel-grid' }, myBoard, oppBoard));
          if (st.ph === 'guess' && me >= 0 && !st.sub[me]) g.append(keyboardEl(st.pow, keyStates(st.gs[me], st.fb[me]), onKey));
          if (st.ph === 'end') {
            const res = st.win === -1 ? '무승부' : (st.win === me ? '승리!' : me >= 0 ? '패배' : names[st.win] + ' 승리');
            g.append(h('div', { class: 'result-box' },
              h('strong', { class: 'result-big' }, res), h('p', null, st.why),
              st.sec ? h('p', null, names[0] + ': ', h('b', null, E.show(st.sec[0])), ' · ', names[1] + ': ', h('b', null, E.show(st.sec[1]))) : null));
          }
        },
      });
    }

    setMode('solo');
    return () => { document.removeEventListener('keydown', onDoc); if (cleanupMode) cleanupMode(); };
  }

  App.games.push({
    id: 'signal',
    name: '수식 신호등',
    kicker: '추리 퍼즐',
    players: '혼자 · 1:1 온라인',
    blurb: '숨은 등식을 초록·노랑·빨강 신호만 보고 맞힙니다. 7~10칸, 거듭제곱 포함 여부가 매번 바뀌어요.',
    accent: 'signal',
    mount,
    rules: `
<p>숨겨진 등식 하나를 정해진 횟수 안에 맞히는 게임입니다. 한 칸에는 숫자(0~9) 또는 기호(+ − × ÷ ^ =) 하나가 들어갑니다.</p>
<div class="demo" data-demo="rules-signal"></div>
<ul>
<li>매번 칸 수에 맞춰 한 줄을 냅니다. 내는 줄은 <b>참인 등식이 아니어도 되고, = 가 없어도 됩니다.</b> 어떤 숫자나 기호든 아무 자리에 넣어서 그 문자가 정답에 있는지, 어디 있는지 확인할 수 있습니다. 예: <code>123456789</code>, <code>=0+−×÷=−×</code></li>
<li>숨은 정답은 항상 참인 등식입니다. 예: <code>7×8−29=27</code></li>
<li>입력하면 칸마다 신호가 켜집니다.
  <ul>
  <li><span class="dot g"></span> <b>초록</b>: 그 문자가 그 자리에 정확히 있음</li>
  <li><span class="dot y"></span> <b>노랑</b>: 그 문자가 정답 어딘가에 있음. 몇 번 나오는지는 세지 않습니다.</li>
  <li><span class="dot r"></span> <b>빨강</b>: 정답에 없는 문자</li>
  </ul></li>
<li>계산 순서는 거듭제곱 → 곱셈·나눗셈 → 덧셈·뺄셈입니다. 0이 아닌 수의 0제곱은 1이고, 0의 0제곱은 쓸 수 없습니다.</li>
<li>두 자리 이상의 수는 0으로 시작할 수 없고, 맨 앞에 −를 붙인 음수도 쓸 수 없습니다. = 양쪽 모두 식이어도 됩니다.</li>
</ul>
<h4>혼자 풀기</h4>
<p>7칸은 6번, 8칸은 7번, 9~10칸은 8번 안에 맞히면 성공입니다. “랜덤 변형”은 칸 수와 거듭제곱 포함 여부를 무작위로 바꿉니다.</p>
<h4>1:1 온라인</h4>
<p>두 사람이 각자 상대가 맞힐 비밀 수식을 정합니다. 비밀 수식은 참인 등식이어야 합니다. 그다음 매 턴 동시에 한 줄씩 추리를 냅니다. 먼저 맞힌 사람이 이기고, 같은 턴에 둘 다 맞히면 무승부입니다. 10턴 안에 아무도 못 맞히면 10턴째 줄의 초록 개수가 많은 쪽이 이깁니다.</p>`,
    guide: `
<h4>1. 첫 줄은 정보를 모으는 줄</h4>
<p>내는 줄은 등식이 아니어도 되니, 첫 줄은 맞히려 하지 말고 서로 다른 문자를 최대한 많이 확인하는 데 씁니다. 9칸이라면 <code>123456789</code>처럼 숫자만 몰아 넣어 어떤 숫자가 쓰이는지 한 번에 알아냅니다. 둘째 줄은 남은 0과 + − × ÷ ^ = 같은 기호를 모아 시험합니다. 문자가 겹치지 않을수록 빨강이 많이 나와서 후보가 빨리 줄어듭니다.</p>
<h4>2. = 의 위치부터 확정하기</h4>
<p>= 가 어디 있는지 알면 오른쪽 값의 자릿수가 정해지고, 왼쪽 식의 크기도 따라서 정해집니다. 오른쪽이 한 자리면 빼기나 나누기, 세 자리 이상이면 곱셈이나 거듭제곱일 가능성이 큽니다.</p>
<p>같은 문자를 여러 자리에 넣으면 그 문자가 실제로 있는 자리는 초록, 나머지는 노랑으로 켜집니다. 그래서 = 를 서너 자리에 흩어 놓으면 = 의 자리가 한 줄 만에 드러납니다. 남는 칸에는 아직 확인하지 않은 문자를 채워 정보를 더 얻으세요.</p>
<h4>3. 노랑은 개수를 알려주지 않는다</h4>
<p>노랑은 “그 문자가 정답에 있다”는 뜻일 뿐입니다. 같은 문자를 두 번 넣었는데 하나가 초록이면, 다른 하나도 노랑으로 켜집니다. 그러니 노랑을 “하나 더 있다”로 읽으면 안 됩니다. 반대로 빨강은 그 문자가 어디에도 없다는 확실한 정보라서 가장 값집니다.</p>
<div class="demo" data-demo="signal"></div>
<h4>4. 끝자리와 크기로 좁히기</h4>
<ul>
<li>곱셈 결과의 끝자리는 곱하는 수들의 끝자리로 정해집니다. 5가 들어간 곱은 0이나 5로 끝납니다.</li>
<li>짝수 × 아무 수 = 짝수, 홀수 + 홀수 = 짝수 같은 홀짝 규칙으로 후보를 빠르게 지웁니다.</li>
<li>나누기가 있다면 결과가 정수가 되도록 나누어떨어지는 조합만 남깁니다.</li>
</ul>
<h4>5. 거듭제곱의 함정</h4>
<p>^ 가 있는 판에서는 <b>0이 아닌 수의 0제곱은 1</b>, 1의 거듭제곱은 1, 0의 (0이 아닌) 거듭제곱은 0이라는 점을 꼭 떠올리세요. 예를 들어 <code>9^0+8=9</code>처럼 큰 숫자가 결과에 아무 영향을 주지 않는 식이 정답일 수 있습니다. 2^5=32, 3^4=81, 4^3=64, 5^3=125 정도는 외워두면 계산이 빨라집니다.</p>
<h4>6. 1:1에서 수식 만들기와 마지막 턴</h4>
<ul>
<li>같은 문자를 반복해서 쓰면 노랑이 개수를 알려주지 않기 때문에 상대가 찾기 어렵습니다. 예: <code>11×11=121</code></li>
<li>÷, ^0, 0처럼 사람들이 잘 시험하지 않는 문자를 섞으면 후보가 늦게 줄어듭니다.</li>
<li>10턴째에는 맞힐 자신이 없더라도 초록이 가장 많이 나올 줄을 내는 것이 유리합니다. 판정은 마지막 줄의 초록 개수입니다. 등식이 아니어도 되니 자리마다 가장 가능성 높은 문자를 골라 채우세요.</li>
</ul>`,
  });

  App.signal = { genEquation, grade, validateGuess, validateProbe, engine };
})();
