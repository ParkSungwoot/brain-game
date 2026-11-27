/* 색실 잇기: 같은 색 말끼리 겹치지 않는 길로 이어질 수 있게 번갈아 놓기 (1:1, 온라인/컴퓨터) */
(function () {
  const App = (globalThis.App = globalThis.App || {});
  const { h, rng: R } = App;

  const LET = 'ABCDEFGHIJKLMN';
  const COL = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4', '#469990', '#dcbeff', '#9a6324', '#800000'];
  const INK = COL.map((c) => { const n = parseInt(c.slice(1), 16); const l = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); return l > 150 ? '#141a2e' : '#ffffff'; });
  const BUDGET = {};

  const nbCache = {};
  function NB(N) {
    if (nbCache[N]) return nbCache[N];
    const out = [];
    for (let i = 0; i < N * N; i++) {
      const r = Math.floor(i / N), c = i % N, l = [];
      if (r > 0) l.push(i - N); if (r < N - 1) l.push(i + N); if (c > 0) l.push(i - 1); if (c < N - 1) l.push(i + 1);
      out.push(l);
    }
    return (nbCache[N] = out);
  }

  // 길은 양 끝 말을 포함해 6칸 이상이어야 함 (바로 옆 칸끼리는 이을 수 없음)
  const MIN_CELLS = 6;

  // 판 위의 모든 색을 겹치지 않는 길로 이을 수 있는지 찾기
  // 한 개만 놓인 색은 길을 원하는 빈 칸에서 끝내고 그 자리에 짝을 놓음
  // 결과: {ok:true, paths:{색:[칸...]}} | {ok:false} | {ok:null}(계산 한도 초과)
  function solve(N, board, budget) {
    const nb = NB(N);
    const used = new Int16Array(N * N).fill(-1);
    const pos = {};
    board.forEach((c, i) => { if (c >= 0) { used[i] = c; (pos[c] = pos[c] || []).push(i); } });
    const pairs = [], singles = [];
    for (const c in pos) (pos[c].length === 2 ? pairs : singles).push(+c);
    const paths = {};
    let steps = 0;
    const man = (a, b) => Math.abs(Math.floor(a / N) - Math.floor(b / N)) + Math.abs((a % N) - (b % N));
    const q = new Int16Array(N * N), dist = new Int16Array(N * N), seen = new Uint8Array(N * N);
    function bfs(a, b) {
      dist.fill(-1);
      let hd = 0, tl = 0;
      q[tl++] = a; dist[a] = 0;
      while (hd < tl) {
        const x = q[hd++];
        for (const y of nb[x]) {
          if (dist[y] >= 0) continue;
          if (y === b) return dist[x] + 1;
          if (used[y] !== -1) continue;
          dist[y] = dist[x] + 1;
          q[tl++] = y;
        }
      }
      return -1;
    }
    // a 에서 빈 칸을 따라 닿을 수 있는 칸 수 (need 개 이상이면 바로 멈춤)
    function freeCount(a, need) {
      if (need <= 0) return 0;
      seen.fill(0);
      let hd = 0, tl = 0, cnt = 0;
      q[tl++] = a; seen[a] = 1;
      while (hd < tl) {
        const x = q[hd++];
        for (const y of nb[x]) {
          if (seen[y] || used[y] !== -1) continue;
          seen[y] = 1; cnt++;
          if (cnt >= need) return cnt;
          q[tl++] = y;
        }
      }
      return cnt;
    }
    function route(remP, remS) {
      if (!remP.length && !remS.length) return true;
      for (const c of remP) if (bfs(pos[c][0], pos[c][1]) < 0) return false;
      for (const c of remS) if (freeCount(pos[c][0], MIN_CELLS - 1) < MIN_CELLS - 1) return false;
      let c, isPair = remP.length > 0;
      if (isPair) {
        let bd = Infinity;
        for (const x of remP) { const d = bfs(pos[x][0], pos[x][1]); if (d < bd) { bd = d; c = x; } }
      } else c = remS[0];
      const restP = remP.filter((x) => x !== c), restS = remS.filter((x) => x !== c);
      const a = pos[c][0], b = isPair ? pos[c][1] : -1;
      const path = [a];
      function dfs(cur) {
        if (++steps > budget) throw BUDGET;
        const len = path.length;
        // 한 개만 놓인 색: 6칸이 되었으면 여기에 짝을 놓고 끝내 보기
        if (!isPair && len >= MIN_CELLS) {
          paths[c] = path.slice();
          if (route(restP, restS)) return true;
        }
        const cand = nb[cur].filter((x) => (isPair && x === b) || used[x] === -1);
        if (isPair) cand.sort((x, y) => man(x, b) - man(y, b));
        for (const x of cand) {
          if (isPair && x === b) {
            if (len + 1 >= MIN_CELLS) { paths[c] = path.concat([b]); if (route(restP, restS)) return true; }
            continue;
          }
          used[x] = c; path.push(x);
          let ok = isPair ? bfs(x, b) >= 0 : (path.length >= MIN_CELLS || freeCount(x, MIN_CELLS - path.length) >= MIN_CELLS - path.length);
          // 이 칸을 쓰면 남은 다른 쌍이 끊기는지 미리 확인 (가지치기)
          if (ok) for (const o of restP) if (bfs(pos[o][0], pos[o][1]) < 0) { ok = false; break; }
          if (ok && dfs(x)) return true;
          used[x] = -1; path.pop();
        }
        return false;
      }
      return dfs(a);
    }
    try {
      if (!route(pairs, singles)) return { ok: false };
      return { ok: true, paths: Object.assign({}, paths) };
    } catch (e) {
      if (e === BUDGET) return { ok: null };
      throw e;
    }
  }

  // 사람이 그린 증명 확인. 문제가 없으면 null, 있으면 이유
  function checkProof(N, board, proof) {
    const nb = NB(N);
    const pos = {};
    board.forEach((c, i) => { if (c >= 0) (pos[c] = pos[c] || []).push(i); });
    const taken = new Set();
    const map = new Map();
    if (!Array.isArray(proof)) return '증명 형식이 잘못됐어요';
    for (const e of proof) if (Array.isArray(e) && Array.isArray(e[1])) map.set(e[0] | 0, e[1].map((x) => x | 0));
    for (const cs in pos) {
      const c = +cs;
      const P = map.get(c);
      const L = LET[c];
      if (!P || P.length < 2) return L + ' 색이 아직 이어지지 않았어요';
      const ends = pos[c];
      if (!ends.includes(P[0])) return L + ' 색 길이 말에서 시작하지 않아요';
      for (let k = 1; k < P.length; k++) if (!nb[P[k - 1]].includes(P[k])) return L + ' 색 길이 끊겨 있어요';
      if (new Set(P).size !== P.length) return L + ' 색 길이 같은 칸을 두 번 지나요';
      const last = P[P.length - 1];
      if (ends.length === 2) {
        const other = ends[0] === P[0] ? ends[1] : ends[0];
        if (last !== other) return L + ' 색 길이 짝 말까지 가지 않았어요';
      } else if (board[last] !== -1) return L + ' 색의 짝은 빈 칸에 놓아야 해요';
      if (P.length < MIN_CELLS) return L + ' 색 길이 너무 짧아요. 양 끝 말을 포함해 ' + MIN_CELLS + '칸 이상이어야 해요 (지금 ' + P.length + '칸)';
      const inner = ends.length === 2 ? P.slice(1, -1) : P.slice(1);
      for (const x of inner) {
        if (board[x] !== -1) return L + ' 색 길이 다른 말을 지나요';
        if (taken.has(x)) return L + ' 색 길이 다른 길과 겹쳐요';
        taken.add(x);
      }
    }
    return null;
  }

  function solutionToProof(N, board, r) {
    const pos = {};
    board.forEach((c, i) => { if (c >= 0) (pos[c] = pos[c] || []).push(i); });
    return Object.keys(pos).map((cs) => [+cs, r.paths[+cs]]);
  }

  // ---------- 규칙 ----------
  function endGame(G, win, why) { G.ph = 'end'; G.win = win; G.why = why; }
  const piecesLeft = (G) => G.left.reduce((a, b) => a + b, 0);

  const engine = {
    id: 'link',
    minPlayers: 2, maxPlayers: 2, allowBots: true, defaultBots: 2,
    defaultOpts: { size: 7, ai: 'normal' },
    botNames: ['색실 봇'],
    start(players, o) {
      const N = o.size === 6 ? 6 : 7;
      const K = N === 6 ? 12 : 14;
      const first = Math.random() < 0.5 ? 0 : 1;
      return { N, K, first, ph: 'play', turn: first, board: Array(N * N).fill(-1), left: Array(K).fill(2), last: null, moves: 0, prover: -1, challenger: -1, proof: null, win: -1, why: '', ai: o.ai || 'normal' };
    },
    act(G, seat, a) {
      if (!a || G.ph === 'end') throw new Error('게임이 끝났어요');
      if (G.ph === 'play') {
        if (seat !== G.turn) throw new Error('내 차례가 아니에요');
        if (a.t === 'put') {
          const c = a.c | 0, i = a.i | 0;
          if (!(G.left[c] > 0)) throw new Error('그 색 말은 남아 있지 않아요');
          if (G.board[i] !== -1) throw new Error('빈 칸에만 놓을 수 있어요');
          G.board[i] = c; G.left[c]--; G.last = { s: seat, i, c }; G.moves++;
          G.turn = 1 - seat;
          return;
        }
        if (a.t === 'call') {
          if (!G.last || G.last.s === seat) throw new Error('상대가 말을 놓은 직후에만 선언할 수 있어요');
          G.ph = 'proof'; G.prover = G.last.s; G.challenger = seat;
          return;
        }
        if (a.t === 'accept') {
          if (piecesLeft(G)) throw new Error('아직 놓을 말이 남아 있어요');
          endGame(G, G.last.s, '모든 말이 놓였고, 마지막 판도 이어질 수 있다고 인정했어요');
          return;
        }
        if (a.t === 'give') { endGame(G, 1 - seat, '상대가 기권했어요'); return; }
      }
      if (G.ph === 'proof') {
        if (seat !== G.prover) throw new Error('증명할 사람이 아니에요');
        if (a.t === 'proof') {
          const err = checkProof(G.N, G.board, a.p);
          if (err) throw new Error(err);
          G.proof = a.p;
          endGame(G, seat, '모든 색을 이어 보여서 불가능 선언이 틀렸어요');
          return;
        }
        if (a.t === 'fail') { endGame(G, G.challenger, '제한 시간 안에 증명하지 못했어요'); return; }
      }
      throw new Error('알 수 없는 행동');
    },
    pending(G) { return G.ph === 'play' ? [G.turn] : G.ph === 'proof' ? [G.prover] : []; },
    timeLimit(G) { return G.ph === 'proof' ? 300000 : 90000; },
    timeout(G, seat) { return G.ph === 'proof' ? { t: 'fail' } : botPlay(G, seat, 'easy', true); },
    bot(G, seat) {
      if (G.ph === 'proof') {
        const r = solve(G.N, G.board, 400000);
        return r.ok ? { t: 'proof', p: solutionToProof(G.N, G.board, r) } : { t: 'fail' };
      }
      return botPlay(G, seat, G.ai, false);
    },
    botDelay() { return 900 + Math.random() * 900; },
    publicView(G) {
      return {
        N: G.N, K: G.K, first: G.first, ph: G.ph, turn: G.turn, b: G.board.map((c) => (c < 0 ? '.' : LET[c])).join(''), left: G.left,
        last: G.last, moves: G.moves, prover: G.prover, challenger: G.challenger, proof: G.proof, win: G.win, why: G.why,
      };
    },
    over(G) { return G.ph === 'end'; },
    results(G) { return { win: G.win, scores: [0, 1].map((s) => (s === G.win ? 1 : 0)) }; },
  };

  // ---------- 컴퓨터 ----------
  function botPlay(G, seat, level, noCall) {
    const N = G.N;
    // 1) 상대가 방금 불가능한 판을 만들었는지
    if (!noCall && G.last && G.last.s !== seat) {
      const r = solve(N, G.board, level === 'easy' ? 6000 : 60000);
      if (r.ok === false) return { t: 'call' };
    }
    if (!piecesLeft(G)) return { t: 'accept' };
    // 2) 놓을 수 후보를 뽑아 안전한 수 중 상대를 가장 답답하게 하는 수
    const empties = [];
    G.board.forEach((c, i) => { if (c === -1) empties.push(i); });
    const colors = G.left.map((n, c) => (n > 0 ? c : -1)).filter((c) => c >= 0);
    const tried = new Set();
    let best = null, bestScore = -Infinity, fallback = null;
    const tries = level === 'easy' ? 25 : 70;
    // 후보: 한 개만 놓인 색의 짝을 5칸 안팎 떨어진 곳에 두는 수(6칸짜리 길이 나오기 쉬움) + 무작위 수
    const cand = [];
    const dist = (a, b) => Math.abs(Math.floor(a / N) - Math.floor(b / N)) + Math.abs((a % N) - (b % N));
    G.board.forEach((c, i) => {
      if (c < 0 || !(G.left[c] > 0)) return;
      for (const x of empties) { const d = dist(i, x); if (d >= 3 && d <= 6) cand.push([c, x]); }
    });
    for (let t = 0; t < tries * 3; t++) cand.push([R.pick(colors), R.pick(empties)]);
    const ordered = R.shuffle(cand.slice(0, cand.length - tries * 3)).concat(cand.slice(cand.length - tries * 3));
    for (const [c, i] of ordered) {
      if (tried.size >= tries + 20) break;
      const k = c * 100 + i;
      if (tried.has(k)) continue;
      tried.add(k);
      if (!fallback) fallback = { t: 'put', c, i };
      const b2 = G.board.slice(); b2[i] = c;
      const r = solve(N, b2, level === 'easy' ? 1500 : 3000);
      if (r.ok !== true) continue;
      let score = Math.random() * (level === 'easy' ? 20 : 2);
      if (level !== 'easy') for (const p of Object.values(r.paths)) score += p.length - 2;
      if (score > bestScore) { bestScore = score; best = { t: 'put', c, i }; }
    }
    return best || fallback || { t: 'give' };
  }

  // ---------- 화면 ----------
  function boardView(st, opts) {
    const N = st.N;
    const wrap = h('div', { class: 'lk-board', style: { '--n': N } });
    const cells = [];
    for (let i = 0; i < N * N; i++) {
      const ch = st.b[i];
      const c = ch === '.' ? -1 : LET.indexOf(ch);
      const cell = h('div', { class: 'lk-cell' + (st.last && st.last.i === i ? ' last' : '') + (opts.placeable && c < 0 ? ' open' : ''), 'data-i': String(i) },
        c >= 0 ? h('span', { class: 'lk-piece', style: { background: COL[c], color: INK[c] } }, LET[c]) : null);
      cells.push(cell);
      wrap.append(cell);
    }
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + N + ' ' + N);
    svg.setAttribute('class', 'lk-paths');
    svg.setAttribute('aria-hidden', 'true');
    wrap.append(svg);
    function drawPaths(list, partners) {
      svg.innerHTML = '';
      for (const [c, P] of list) {
        if (!P || P.length < 2) {
          if (P && P.length === 1) { const dot = document.createElementNS(NS, 'circle'); dot.setAttribute('cx', P[0] % N + 0.5); dot.setAttribute('cy', Math.floor(P[0] / N) + 0.5); dot.setAttribute('r', 0.18); dot.setAttribute('fill', COL[c]); svg.append(dot); }
          continue;
        }
        const pl = document.createElementNS(NS, 'polyline');
        pl.setAttribute('points', P.map((x) => (x % N + 0.5) + ',' + (Math.floor(x / N) + 0.5)).join(' '));
        pl.setAttribute('stroke', COL[c]);
        pl.setAttribute('class', 'lk-line');
        svg.append(pl);
      }
      for (const [c, x] of partners || []) {
        const g = document.createElementNS(NS, 'circle');
        g.setAttribute('cx', x % N + 0.5); g.setAttribute('cy', Math.floor(x / N) + 0.5); g.setAttribute('r', 0.34);
        g.setAttribute('fill', 'none'); g.setAttribute('stroke', COL[c]); g.setAttribute('stroke-width', 0.08); g.setAttribute('stroke-dasharray', '0.12 0.08');
        svg.append(g);
      }
    }
    return { el: wrap, cells, drawPaths };
  }

  function renderGame(g, s) {
    const W = s.W, st = W.s, me = s.mySeat, N = st.N;
    const names = W.pl.map((p) => p.n);
    const L = s.local;
    const key = W.gn + ':' + st.moves + ':' + st.ph;
    if (L.key !== key) {
      if (L.gameKey !== W.gn) { L.gameKey = W.gn; L.color = null; }
      L.key = key; L.paths = new Map(); L.active = null; L.msg = '';
      if (L.color != null && !(st.left[L.color] > 0)) L.color = null;
    }
    const board = st.b.split('').map((ch) => (ch === '.' ? -1 : LET.indexOf(ch)));
    const myTurn = me >= 0 && st.ph === 'play' && st.turn === me && !s.waiting;
    const proving = me >= 0 && st.ph === 'proof' && st.prover === me;

    g.append(h('div', { class: 'wl-head' },
      [0, 1].map((i) => h('span', { class: 'wl-player' + ((st.ph === 'play' && st.turn === i) || (st.ph === 'proof' && st.prover === i) ? ' turn' : '') },
        h('span', { class: 'seat-dot', style: { background: `var(--p${i})` } }), names[i], i === me ? ' (나)' : '', i === st.first ? h('span', { class: 'chip-tag' }, '선') : null,
        ((st.ph === 'play' && st.turn === i) || (st.ph === 'proof' && st.prover === i)) ? h('span', { class: 'timer', 'data-timer-seat': i }) : null)),
      h('span', { class: 'pill' }, '놓인 말 ' + st.moves + ' / ' + st.K * 2)));

    let msg;
    if (st.ph === 'play') {
      if (!(st.left.some((x) => x > 0))) msg = myTurn ? '말이 모두 놓였어요. 이 판이 정말 이어질 수 있는지 판단하세요.' : names[st.turn] + '이(가) 마지막 판을 판단하는 중';
      else msg = myTurn ? (L.color == null ? '놓을 색을 고르세요. 상대 수가 이어질 수 없다고 생각되면 불가능 선언!' : LET[L.color] + ' 말을 놓을 빈 칸을 누르세요') : names[st.turn] + '의 차례';
    } else if (st.ph === 'proof') {
      msg = proving ? '불가능 선언을 받았어요! 5분 안에 모든 색을 6칸 이상 길로 이어 보이세요. 말에서 시작해 끌거나 이웃 칸을 차례로 누르세요.' : names[st.challenger] + '이(가) 불가능을 선언했어요. ' + names[st.prover] + '이(가) 증명하는 중…';
    } else msg = '게임 종료';
    g.append(h('p', { class: 'hint wl-msg' }, msg));

    const bv = boardView(st, { placeable: myTurn && L.color != null });
    g.append(h('div', { class: 'lk-wrap' }, bv.el));

    if (st.ph === 'play') {
      if (myTurn) {
        bv.cells.forEach((cell, i) => cell.addEventListener('click', () => {
          if (L.color == null || board[i] !== -1) return;
          s.send({ t: 'put', c: L.color, i });
        }));
      }
      // 남은 말
      const pool = h('div', { class: 'lk-pool' }, st.left.map((n, c) => h('button', {
        class: 'lk-pool-btn' + (L.color === c ? ' on' : ''), type: 'button', disabled: !myTurn || !n, 'aria-pressed': L.color === c ? 'true' : 'false',
        onclick: () => { L.color = L.color === c ? null : c; s.onUpdate(s); },
      }, h('span', { class: 'lk-piece sm', style: { background: COL[c], color: INK[c] } }, LET[c]), h('small', null, '×' + n))));
      g.append(pool);
      if (myTurn) {
        const canCall = st.last && st.last.s !== me;
        const noneLeft = !st.left.some((x) => x > 0);
        g.append(h('div', { class: 'row wrap center' },
          canCall ? h('button', { class: 'btn danger', onclick: () => s.send({ t: 'call' }) }, '불가능 선언') : null,
          noneLeft ? h('button', { class: 'btn', onclick: () => s.send({ t: 'accept' }) }, '이어질 수 있다고 인정 (상대 승)') : null,
          h('button', { class: 'btn ghost tiny', onclick: () => s.send({ t: 'give' }) }, '기권')));
      }
    }

    if (st.ph === 'proof') {
      const list = [...L.paths.entries()];
      bv.drawPaths(list.map(([c, P]) => [c, P]), list.filter(([c, P]) => P.length > 1 && board[P[P.length - 1]] === -1).map(([c, P]) => [c, P[P.length - 1]]));
      if (proving) {
        const el = bv.el;
        el.classList.add('drawing');
        const occupiedByOther = (x, c) => { for (const [c2, P] of L.paths) if (c2 !== c && P.includes(x)) return true; return false; };
        const pairOf = (c) => board.map((v, i) => (v === c ? i : -1)).filter((i) => i >= 0);
        // 화면이 다시 그려져도 끌던 동작이 이어지도록 상태를 세션에 둠
        if (!L.upHook) { L.upHook = true; window.addEventListener('pointerup', () => { L.down = false; }); window.addEventListener('pointercancel', () => { L.down = false; }); }
        const cellAt = (e) => {
          const r = el.getBoundingClientRect();
          const cx = Math.floor((e.clientX - r.left) / r.width * N), cy = Math.floor((e.clientY - r.top) / r.height * N);
          if (cx < 0 || cy < 0 || cx >= N || cy >= N) return -1;
          return cy * N + cx;
        };
        const nb = NB(N);
        function touch(i, start) {
          if (i < 0) return;
          const c0 = board[i];
          if (start && c0 >= 0) { L.active = c0; L.paths.set(c0, [i]); redraw(); return; }
          const c = L.active;
          if (c == null) return;
          const P = L.paths.get(c);
          if (!P) return;
          const head = P[P.length - 1];
          if (i === head) return;
          if (P.length >= 2 && P[P.length - 2] === i) { P.pop(); redraw(); return; }
          if (!nb[head].includes(i)) return;
          const ends = pairOf(c);
          if (P.length >= 2 && ends.includes(head) && head !== P[0]) return; // 이미 짝에 도착
          if (ends.length === 2 && i === ends.find((x) => x !== P[0])) { P.push(i); redraw(); return; }
          if (board[i] !== -1 || P.includes(i) || occupiedByOther(i, c)) return;
          P.push(i); redraw();
        }
        function redraw() {
          const lst = [...L.paths.entries()];
          bv.drawPaths(lst, lst.filter(([c, P]) => P.length > 1 && board[P[P.length - 1]] === -1).map(([c, P]) => [c, P[P.length - 1]]));
          status.textContent = L.msg || ' ';
        }
        el.addEventListener('pointerdown', (e) => { L.down = true; try { el.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ } touch(cellAt(e), true); });
        el.addEventListener('pointermove', (e) => { if (L.down) touch(cellAt(e), false); });
        const status = h('p', { class: 'status', 'aria-live': 'polite' }, L.msg || ' ');
        g.append(status, h('div', { class: 'row wrap center' },
          h('button', { class: 'btn primary', disabled: s.waiting, onclick: () => {
            const proof = [...L.paths.entries()].map(([c, P]) => [c, P.slice()]);
            const err = checkProof(N, board, proof);
            if (err) { L.msg = err; status.textContent = err; return; }
            s.send({ t: 'proof', p: proof });
          } }, '증명 제출'),
          h('button', { class: 'btn', onclick: () => { L.paths = new Map(); L.active = null; L.msg = ''; redraw(); } }, '다시 그리기'),
          h('button', { class: 'btn ghost tiny', onclick: () => s.send({ t: 'fail' }) }, '증명 포기')),
          h('p', { class: 'note' }, '길은 양 끝 말을 포함해 6칸 이상이어야 해요. 한 개만 놓인 색은 길을 원하는 빈 칸에서 끝내면 그 자리에 짝이 놓여요(점선 원).'));
      }
    }

    if (st.ph === 'end') {
      const win = st.win;
      g.append(h('div', { class: 'result-box' },
        h('strong', { class: 'result-big' }, win === me ? '승리!' : me >= 0 ? '패배' : names[win] + ' 승리'),
        h('p', null, st.why)));
      if (st.proof) {
        bv.drawPaths(st.proof, st.proof.filter(([c, P]) => board[P[P.length - 1]] === -1).map(([c, P]) => [c, P[P.length - 1]]));
      } else {
        // 실제로 이어질 수 있었는지 계산해서 보여줌 (한 번만 계산)
        if (L.endKey !== W.gn) { L.endKey = W.gn; L.endSol = solve(N, board, 300000); }
        const r = L.endSol;
        const note = h('p', { class: 'note center-text' });
        if (r.ok) {
          const pf = solutionToProof(N, board, r);
          bv.drawPaths(pf, pf.filter(([c, P]) => board[P[P.length - 1]] === -1).map(([c, P]) => [c, P[P.length - 1]]));
          note.textContent = '참고: 이 판은 실제로 이렇게 이어질 수 있었어요.';
        } else if (r.ok === false) note.textContent = '참고: 이 판은 실제로 이어질 수 없는 판이었어요.';
        else note.textContent = '참고: 이 판은 계산 한도 안에서 판정하지 못했어요.';
        g.append(note);
      }
    }
  }

  function renderOptions(o, s, disabled) {
    const W = s.W;
    const bar = h('div', { class: 'toolbar' },
      h('span', { class: 'opt-label' }, '판'),
      h('div', { class: 'seg small' }, [[7, '7×7 · 14쌍'], [6, '6×6 · 12쌍']].map(([v, l]) => h('button', { class: 'seg-btn' + (W.o.size === v ? ' on' : ''), disabled, onclick: () => s.setOpt('size', v) }, l))));
    if (W.pl.some((p) => p.b)) bar.append(h('span', { class: 'opt-label' }, '컴퓨터 실력'),
      h('div', { class: 'seg small' }, [['easy', '쉬움'], ['normal', '보통']].map(([v, l]) => h('button', { class: 'seg-btn' + (W.o.ai === v ? ' on' : ''), disabled, onclick: () => s.setOpt('ai', v) }, l))));
    o.append(bar);
  }

  function mount(root, ctx) {
    return App.multi.mount(root, ctx, { gameId: 'link', engine, renderGame, renderOptions, soloLabel: '컴퓨터와 1:1' });
  }

  App.games.push({
    id: 'link',
    name: '색실 잇기',
    kicker: '결승 전략',
    players: '1:1 · 온라인 / 컴퓨터',
    blurb: '같은 색 말끼리 서로 겹치지 않는 길로 이어질 수 있도록 번갈아 놓습니다. 상대 수가 이어질 수 없다고 생각되면 “불가능”을 선언하세요.',
    mount,
    rules: `
<p>두 사람이 번갈아 색깔 말을 놓는 1:1 게임입니다. 판 위의 <b>같은 색 말끼리는 언제나 서로 겹치지 않는 길로 이어질 수 있어야</b> 합니다.</p>
<ul>
<li>7×7 판에 14가지 색 말이 2개씩, 모두 28개 있습니다(6×6 판은 12쌍 24개). 각 색은 알파벳으로도 표시됩니다.</li>
<li>자기 차례에 남은 말 중 <b>아무 색이나 하나</b>를 골라 빈 칸에 놓습니다. 먼저 놓는 사람(선)은 무작위로 정해집니다.</li>
<li>길은 상하좌우로 이웃한 빈 칸을 지나야 하고, 다른 말을 지나거나 다른 길과 겹칠 수 없습니다. 판을 다 채울 필요는 없습니다.</li>
<li>같은 색을 잇는 길은 <b>양 끝 말을 포함해 6칸 이상</b>이어야 합니다. 바로 옆 칸끼리(2칸) 붙여서 잇는 것은 안 되고, 붙어 있는 짝도 6칸 이상 돌아가는 길로 이어야 합니다.</li>
<li>상대가 말을 놓은 직후, 내 차례에 <b>불가능 선언</b>을 할 수 있습니다. 그러면 방금 놓은 사람이 <b>5분 안에</b> 판 위의 모든 색을 실제로 이어 보여야 합니다.
  <ul><li>증명에 성공하면 선언한 사람이 지고, 실패하면 놓은 사람이 집니다.</li>
  <li>한 개만 놓인 색은 증명할 때 6칸 이상 길을 그린 뒤 끝 칸(빈 칸)에 짝을 놓으면 됩니다.</li></ul></li>
<li>말이 모두 놓였는데 아무도 선언하지 않았다면, 마지막 차례인 사람은 불가능 선언을 하거나 “이어질 수 있다”고 인정해야 합니다. 인정하면 마지막 말을 놓은 사람이 이깁니다.</li>
</ul>
<p class="note">방송에서 공개된 설명(14쌍 28개, 겹치지 않는 6칸 이상의 길, 불가능 선언과 증명)을 바탕으로, 공개되지 않은 세부(판 크기, 끝까지 놓였을 때의 승부 등)는 이 사이트에서 정했습니다. 온라인에서 한 수는 90초, 증명은 5분입니다.</p>`,
    guide: `
<h4>1. 매 턴의 첫 질문: “지금 판이 이어지나?”</h4>
<p>상대가 이어질 수 없는 판을 만들었다면 그 즉시 선언하는 사람이 이깁니다. 선언하지 않고 내가 말을 하나 더 놓으면, 판은 여전히 이어질 수 없으니 이번에는 내가 선언당할 수 있습니다. 말을 놓기 전에 항상 판 전체를 먼저 점검하세요.</p>
<h4>2. 불가능은 대부분 “엇갈림”에서 생긴다</h4>
<p>벽이나 다른 길로 막힌 통로에서 두 색이 A·B·A·B 순서로 엇갈려 있으면 둘을 동시에 이을 수 없습니다. 특히 판 테두리를 따라 같은 색이 서로 엇갈려 놓이면 위험합니다. 테두리의 말 순서를 한 바퀴 읽어 보고, 같은 색끼리 괄호처럼 짝이 맞는지 확인하는 습관이 도움이 됩니다.</p>
<div class="demo" data-demo="link"></div>
<h4>3. 안전한 수: 6칸짜리 길이 확실히 들어가는 곳에</h4>
<p>길은 양 끝을 포함해 6칸 이상이어야 해서, 짝을 바로 옆에 붙이면 오히려 크게 돌아가는 길이 필요합니다. 칸을 가장 적게 쓰는 방법은 짝을 곧게 5칸 떨어진 곳(사이에 빈칸 4개)에 두거나, 빈 공간에 6칸짜리 ㄱ자·ㄷ자 길이 들어갈 자리에 두는 것입니다. 놓기 전에 그 길이 다른 색의 통로를 막지 않는지도 꼭 확인하세요.</p>
<h4>4. 공격: 상대가 안전하게 놓을 곳을 줄이기</h4>
<p>한 쌍마다 최소 6칸이 필요하니 빈 공간은 생각보다 빨리 바닥납니다. 짝을 멀리 떨어뜨려 놓아 긴 길이 필요하게 만들고, 좁은 통로를 여러 색이 함께 써야 하는 상황을 만드세요. 빈칸이 5칸 이하로 갇힌 곳에 놓인 말은 이을 수 없다는 점도 노려 보세요. 판이 빽빽해질수록 상대가 놓을 수 있는 안전한 칸이 사라지고, 결국 상대가 불가능한 수를 둘 수밖에 없게 됩니다. 단, 내 수 직후에도 판은 반드시 이어질 수 있어야 합니다.</p>
<h4>5. 증명하는 요령</h4>
<ul>
<li>가장 갇혀 있는 쌍(선택지가 적은 쌍)부터 잇고, 넓은 공간을 지나는 쌍은 마지막에 잇습니다.</li>
<li>벽에 붙은 쌍은 벽을 따라 이으면 다른 길을 덜 방해합니다.</li>
<li>한 개만 놓인 색은 빈 공간 쪽으로 6칸을 그린 뒤 끝 칸에 짝을 두면 됩니다. 다른 길이 지나갈 자리를 먹지 않게 벽 쪽으로 그리세요.</li>
<li>시간이 5분뿐이니, 막히면 “다시 그리기” 대신 막힌 색만 다시 그리세요. 말을 다시 누르면 그 색만 처음부터 그려집니다.</li>
</ul>
<h4>6. 끝까지 갔을 때</h4>
<p>7×7 판(49칸)에 14쌍을 모두 6칸 이상으로 잇는 것은 불가능하기 때문에, 판이 차오르면 결국 누군가는 이을 수 없는 수를 둘 수밖에 없습니다. 안전한 칸이 몇 개 남았는지 세면서, 상대 차례에 안전한 칸이 바닥나도록 판을 조이세요. 방송 결승에서도 두 색의 연결을 끝까지 확인하지 않고 승리를 확신했다가 판이 뒤집힌 장면이 있었습니다.</p>`,
  });

  App.link = { solve, checkProof, solutionToProof, engine, LET };
})();
