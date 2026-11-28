/* 컬러 링크: 같은 색 말끼리 겹치지 않는 길로 이어질 수 있게 번갈아 놓기 (1:1, 온라인/컴퓨터) */
(function () {
  const App = (globalThis.App = globalThis.App || {});
  const { h, rng: R } = App;

  // A–N 14색 + 미리 놓이는 검은색 X, 흰색 Y
  const LET = 'ABCDEFGHIJKLMNXY';
  const XI = 14, YI = 15;
  const COL = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4', '#469990', '#dcbeff', '#9a6324', '#800000', '#161616', '#f4f4f4'];
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
  // 라운드: 선이 말 1개 → 이후 차례마다 서로 다른 색 말 2개. 불가능 선언 → 5분 증명.
  // 증명 성공이면 증명한 사람, 실패면 선언한 사람이 승점 1. 5라운드 중 먼저 3점.
  const piecesLeft = (G) => G.left.reduce((a, b) => a + b, 0);
  const distinctLeft = (G) => G.left.filter((n) => n > 0).length;
  function setNeed(G) {
    if (!piecesLeft(G)) { G.need = 0; return; }
    G.need = Math.min(G.moves === 0 ? 1 : 2, distinctLeft(G));
  }
  // 검은색 X·흰색 Y 말을 미리 놓기 (이어질 수 있는 자리만)
  function preplace(G) {
    const N = G.N, dist = (a, b) => Math.abs(Math.floor(a / N) - Math.floor(b / N)) + Math.abs((a % N) - (b % N));
    for (const [c, p] of [[XI, 0.55], [YI, 0.4]]) {
      if (Math.random() > p) continue;
      for (let t = 0; t < 40; t++) {
        const a = Math.floor(Math.random() * N * N), b = Math.floor(Math.random() * N * N);
        if (a === b || G.board[a] !== -1 || G.board[b] !== -1 || dist(a, b) < 4 || dist(a, b) > 8) continue;
        const b2 = G.board.slice(); b2[a] = c; b2[b] = c;
        if (solve(N, b2, 20000).ok === true) { G.board = b2; break; }
      }
    }
  }
  function newRound(G) {
    G.board = Array(G.N * G.N).fill(-1);
    G.left = Array(G.K).fill(2);
    if (G.xy) preplace(G);
    Object.assign(G, { ph: 'play', turn: G.rfirst, moves: 0, tc: [], cur: [], last: null, prover: -1, challenger: -1, proof: null, rw: -1, why: '', loser: -1 });
    setNeed(G);
  }
  function endRound(G, w, why) {
    G.pts[w]++;
    G.rw = w; G.why = why;
    G.hist.push([G.round, w]);
    if (G.pts[w] >= G.target) { G.ph = 'end'; G.win = w; }
    else { G.ph = 'order'; G.loser = 1 - w; }
  }
  function endTurn(G, seat) {
    G.last = { s: seat, cells: G.cur.slice() };
    G.cur = []; G.tc = [];
    G.turn = 1 - seat;
    setNeed(G);
  }

  const engine = {
    id: 'link',
    minPlayers: 2, maxPlayers: 2, allowBots: true, defaultBots: 2,
    defaultOpts: { size: 7, ai: 'normal', xy: 1 },
    botNames: ['컴퓨터'],
    start(players, o) {
      const N = o.size === 6 ? 6 : 7;
      const G = { N, K: N === 6 ? 12 : 14, xy: o.xy !== 0, ai: o.ai || 'normal', pts: [0, 0], target: 3, maxRounds: 5, round: 1, rfirst: Math.random() < 0.5 ? 0 : 1, win: -1, hist: [] };
      newRound(G);
      return G;
    },
    act(G, seat, a) {
      if (!a || G.ph === 'end') throw new Error('게임이 끝났어요');
      if (G.ph === 'order') {
        if (seat !== G.loser || a.t !== 'order') throw new Error('지금은 다음 라운드 선후공을 정하는 중이에요');
        G.rfirst = a.first ? seat : 1 - seat;
        G.round++;
        newRound(G);
        return;
      }
      if (G.ph === 'play') {
        if (seat !== G.turn) throw new Error('내 차례가 아니에요');
        if (a.t === 'put') {
          const c = a.c | 0, i = a.i | 0;
          if (!G.need) throw new Error('놓을 말이 없어요');
          if (!(c >= 0 && c < G.K && G.left[c] > 0)) throw new Error('그 색 말은 남아 있지 않아요');
          if (G.tc.includes(c)) throw new Error('한 차례에는 서로 다른 색 말을 놓아야 해요');
          if (!(i >= 0 && i < G.N * G.N) || G.board[i] !== -1) throw new Error('빈 칸에만 놓을 수 있어요');
          G.board[i] = c; G.left[c]--; G.moves++; G.tc.push(c); G.cur.push(i);
          const more = G.left.some((n, k) => n > 0 && !G.tc.includes(k));
          if (G.tc.length >= G.need || !more) endTurn(G, seat);
          return;
        }
        if (a.t === 'call') {
          if (G.tc.length) throw new Error('말을 놓기 시작한 뒤에는 선언할 수 없어요');
          if (!G.last || G.last.s === seat) throw new Error('상대가 말을 놓은 직후에만 선언할 수 있어요');
          G.ph = 'proof'; G.prover = G.last.s; G.challenger = seat;
          return;
        }
        if (a.t === 'accept') {
          if (piecesLeft(G)) throw new Error('아직 놓을 말이 남아 있어요');
          endRound(G, G.last ? G.last.s : 1 - seat, '모든 말이 놓였고, 이어질 수 있다고 인정했어요');
          return;
        }
        if (a.t === 'timeout') { endRound(G, 1 - seat, '제한 시간 안에 말을 놓지 못해 라운드에서 졌어요'); return; }
        if (a.t === 'give') { endRound(G, 1 - seat, '상대가 이번 라운드를 포기했어요'); return; }
      }
      if (G.ph === 'proof') {
        if (seat !== G.prover) throw new Error('증명할 사람이 아니에요');
        if (a.t === 'proof') {
          const err = checkProof(G.N, G.board, a.p);
          if (err) throw new Error(err);
          G.proof = a.p;
          endRound(G, seat, '모든 색을 이어 보여서 증명에 성공했어요');
          return;
        }
        if (a.t === 'fail') { endRound(G, G.challenger, '제한 시간 안에 증명하지 못해 불가능 선언이 맞았어요'); return; }
      }
      throw new Error('알 수 없는 행동');
    },
    pending(G) { return G.ph === 'play' ? [G.turn] : G.ph === 'proof' ? [G.prover] : G.ph === 'order' ? [G.loser] : []; },
    timeLimit(G) { return G.ph === 'proof' ? 300000 : 180000; },
    timeout(G, seat) { return G.ph === 'proof' ? { t: 'fail' } : G.ph === 'order' ? { t: 'order', first: 1 } : { t: 'timeout' }; },
    bot(G, seat) {
      if (G.ph === 'proof') {
        const r = solve(G.N, G.board, 400000);
        return r.ok ? { t: 'proof', p: solutionToProof(G.N, G.board, r) } : { t: 'fail' };
      }
      if (G.ph === 'order') return { t: 'order', first: Math.random() < 0.5 ? 1 : 0 };
      return botPlay(G, seat, G.ai, false);
    },
    botDelay() { return 900 + Math.random() * 900; },
    publicView(G) {
      return {
        N: G.N, K: G.K, ph: G.ph, turn: G.turn, b: G.board.map((c) => (c < 0 ? '.' : LET[c])).join(''), left: G.left,
        last: G.last, cur: G.cur, tc: G.tc, need: G.need, moves: G.moves, prover: G.prover, challenger: G.challenger, proof: G.proof,
        win: G.win, why: G.why, pts: G.pts, round: G.round, rfirst: G.rfirst, rw: G.rw, loser: G.loser, target: G.target,
      };
    },
    over(G) { return G.ph === 'end'; },
    results(G) { return { win: G.win, scores: G.pts.slice() }; },
  };

  // ---------- 컴퓨터 ----------
  function botPlay(G, seat, level, noCall) {
    const N = G.N;
    // 1) 상대가 방금 불가능한 판을 만들었는지
    if (!noCall && !(G.tc && G.tc.length) && G.last && G.last.s !== seat) {
      const r = solve(N, G.board, level === 'easy' ? 6000 : 60000);
      if (r.ok === false) return { t: 'call' };
    }
    if (!piecesLeft(G)) return { t: 'accept' };
    // 2) 놓을 수 후보를 뽑아 안전한 수 중 상대를 가장 답답하게 하는 수
    const empties = [];
    G.board.forEach((c, i) => { if (c === -1) empties.push(i); });
    const colors = G.left.map((n, c) => (n > 0 && !(G.tc || []).includes(c) ? c : -1)).filter((c) => c >= 0);
    if (!colors.length) return { t: 'accept' };
    const tried = new Set();
    let best = null, bestScore = -Infinity, fallback = null;
    const tries = level === 'easy' ? 25 : 70;
    // 후보: 한 개만 놓인 색의 짝을 5칸 안팎 떨어진 곳에 두는 수(6칸짜리 길이 나오기 쉬움) + 무작위 수
    const cand = [];
    const dist = (a, b) => Math.abs(Math.floor(a / N) - Math.floor(b / N)) + Math.abs((a % N) - (b % N));
    G.board.forEach((c, i) => {
      if (c < 0 || c >= G.K || !(G.left[c] > 0) || (G.tc || []).includes(c)) return;
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
      const isLast = (st.last && st.last.cells && st.last.cells.includes(i)) || (st.cur && st.cur.includes(i));
      const cell = h('div', { class: 'lk-cell' + (isLast ? ' last' : '') + (opts.placeable && c < 0 ? ' open' : ''), 'data-i': String(i) },
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
    const key = W.gn + ':' + st.round + ':' + st.moves + ':' + st.ph;
    if (L.key !== key) {
      if (L.gameKey !== W.gn + ':' + st.round) { L.gameKey = W.gn + ':' + st.round; L.color = null; }
      L.key = key; L.paths = new Map(); L.active = null; L.msg = '';
      if (L.color != null && (!(st.left[L.color] > 0) || st.tc.includes(L.color))) L.color = null;
    }
    const board = st.b.split('').map((ch) => (ch === '.' ? -1 : LET.indexOf(ch)));
    const myTurn = me >= 0 && st.ph === 'play' && st.turn === me && !s.waiting;
    const proving = me >= 0 && st.ph === 'proof' && st.prover === me;
    const active = (i) => (st.ph === 'play' && st.turn === i) || (st.ph === 'proof' && st.prover === i) || (st.ph === 'order' && st.loser === i);

    g.append(h('div', { class: 'wl-head' },
      [0, 1].map((i) => h('span', { class: 'wl-player' + (active(i) ? ' turn' : '') },
        App.avatar.seat(W, i), names[i], i === me ? ' (나)' : '', i === st.rfirst ? h('span', { class: 'chip-tag' }, '선') : null,
        h('b', { class: 'wl-score' }, String(st.pts[i])),
        active(i) ? h('span', { class: 'timer', 'data-timer-seat': i }) : null)),
      h('span', { class: 'pill' }, '라운드 ' + st.round + ' · 먼저 ' + st.target + '점'),
      h('span', { class: 'pill' }, '놓인 말 ' + st.moves + ' / ' + st.K * 2)));

    let msg;
    if (st.ph === 'play') {
      if (!st.need) msg = myTurn ? '말이 모두 놓였어요. 이 판이 정말 이어질 수 있는지 판단하세요.' : names[st.turn] + '이(가) 마지막 판을 판단하는 중';
      else if (myTurn) {
        const head = st.moves === 0 ? '첫 차례: 말 1개를 놓으세요.' : '서로 다른 색 말 ' + st.need + '개를 놓으세요 (' + (st.tc.length + 1) + '/' + st.need + ').';
        msg = head + ' ' + (L.color == null ? '먼저 색을 고르세요.' : LET[L.color] + ' 말을 놓을 빈 칸을 누르세요.') + (st.tc.length === 0 && st.last && st.last.s !== me ? ' 상대 수가 이어질 수 없다면 불가능 선언!' : '');
      } else msg = names[st.turn] + '이(가) 말을 놓는 중' + (st.need === 2 ? ' (' + st.tc.length + '/2)' : '');
    } else if (st.ph === 'proof') {
      msg = proving ? '불가능 선언을 받았어요! 5분 안에 모든 색을 6칸 이상 길로 이어 보이세요. 말에서 시작해 끌거나 이웃 칸을 차례로 누르세요.' : names[st.challenger] + '이(가) 불가능을 선언했어요. ' + names[st.prover] + '이(가) 증명하는 중…';
    } else msg = st.ph === 'end' ? '게임 종료' : '라운드 ' + st.round + ' 끝';
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
      // 남은 말 (이번 차례에 이미 놓은 색은 못 고름)
      const pool = h('div', { class: 'lk-pool' }, st.left.map((n, c) => h('button', {
        class: 'lk-pool-btn' + (L.color === c ? ' on' : ''), type: 'button', disabled: !myTurn || !n || st.tc.includes(c), 'aria-pressed': L.color === c ? 'true' : 'false',
        onclick: () => { L.color = L.color === c ? null : c; s.onUpdate(s); },
      }, h('span', { class: 'lk-piece sm', style: { background: COL[c], color: INK[c] } }, LET[c]), h('small', null, '×' + n))));
      g.append(pool);
      if (myTurn) {
        const canCall = st.tc.length === 0 && st.last && st.last.s !== me;
        g.append(h('div', { class: 'row wrap center' },
          canCall ? h('button', { class: 'btn danger', onclick: () => s.send({ t: 'call' }) }, '불가능 선언') : null,
          !st.need ? h('button', { class: 'btn', onclick: () => s.send({ t: 'accept' }) }, '이어질 수 있다고 인정 (상대 +1점)') : null,
          h('button', { class: 'btn ghost tiny', onclick: () => s.send({ t: 'give' }) }, '이번 라운드 포기')));
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
          h('p', { class: 'note' }, '길은 양 끝 말을 포함해 6칸 이상이어야 해요. 한 개만 놓인 색은 길을 원하는 빈 칸에서 끝내면 그 자리에 짝이 놓여요(점선 원). 검은 X·흰 Y 말도 이어야 해요.'));
      }
    }

    if (st.ph === 'order' || st.ph === 'end') {
      const fin = st.ph === 'end';
      g.append(h('div', { class: 'result-box' + ((fin ? st.win : st.rw) === me ? ' ok' : '') },
        h('strong', { class: 'result-big' }, fin ? (st.win === me ? '최종 승리!' : me >= 0 ? '최종 패배' : names[st.win] + ' 최종 승리') : '라운드 ' + st.round + ': ' + names[st.rw] + ' +1점'),
        h('p', null, st.why),
        h('p', null, '승점 ' + names[0] + ' ' + st.pts[0] + ' : ' + st.pts[1] + ' ' + names[1] + (fin ? '' : ' (먼저 ' + st.target + '점)'))));
      if (st.ph === 'order') {
        if (me === st.loser) {
          g.append(h('div', { class: 'row wrap center' },
            h('button', { class: 'btn primary', disabled: s.waiting, onclick: () => s.send({ t: 'order', first: 1 }) }, '다음 라운드 선공(먼저 놓기)'),
            h('button', { class: 'btn', disabled: s.waiting, onclick: () => s.send({ t: 'order', first: 0 }) }, '다음 라운드 후공')),
            h('p', { class: 'note center-text' }, '직전 라운드에서 진 사람이 3분 안에 다음 라운드 선후공을 정해요. 다음 라운드는 새 판으로 시작해요.'));
        } else g.append(h('p', { class: 'note center-text' }, names[st.loser] + '이(가) 다음 라운드 선후공을 고르는 중이에요…'));
      }
      if (st.proof) {
        bv.drawPaths(st.proof, st.proof.filter(([c, P]) => board[P[P.length - 1]] === -1).map(([c, P]) => [c, P[P.length - 1]]));
      } else {
        // 실제로 이어질 수 있었는지 계산해서 보여줌 (라운드마다 한 번만 계산)
        const ek = W.gn + ':' + st.round;
        if (L.endKey !== ek) { L.endKey = ek; L.endSol = solve(N, board, 300000); }
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
      h('div', { class: 'seg small' }, [[7, '7×7 · 14쌍'], [6, '6×6 · 12쌍']].map(([v, l]) => h('button', { class: 'seg-btn' + (W.o.size === v ? ' on' : ''), disabled, onclick: () => s.setOpt('size', v) }, l))),
      h('div', { class: 'seg small' }, [[1, '검은·흰 말 가끔 미리 놓기'], [0, '빈 판으로']].map(([v, l]) => h('button', { class: 'seg-btn' + ((W.o.xy === 0 ? 0 : 1) === v ? ' on' : ''), disabled, onclick: () => s.setOpt('xy', v) }, l))));
    if (W.pl.some((p) => p.b)) bar.append(h('span', { class: 'opt-label' }, '컴퓨터 실력'),
      h('div', { class: 'seg small' }, [['easy', '쉬움'], ['normal', '보통']].map(([v, l]) => h('button', { class: 'seg-btn' + (W.o.ai === v ? ' on' : ''), disabled, onclick: () => s.setOpt('ai', v) }, l))));
    o.append(bar);
  }

  function mount(root, ctx) {
    return App.multi.mount(root, ctx, { gameId: 'link', engine, renderGame, renderOptions, soloLabel: '컴퓨터와 1:1' });
  }

  App.games.push({
    id: 'link',
    name: '컬러 링크',
    kicker: '결승 전략',
    players: '1:1 · 온라인 / 컴퓨터',
    blurb: '같은 색 말끼리 겹치지 않는 길로 이어질 수 있게 서로 다른 색 2개씩 놓습니다. 이을 수 없어 보이면 “불가능 선언”! 5라운드 중 먼저 3점.',
    mount,
    rules: `
<p>같은 색 말 2개를 잇는 길들이 <b>서로 겹치지 않도록</b> 말을 놓는 1:1 게임입니다.</p>
<div class="demo" data-demo="rules-link"></div>
<ul>
<li>14가지 색 말 28개(A~N)를 씁니다. 라운드마다 새 판을 쓰고, 검은색(X)·흰색(Y) 말이 미리 놓여 있을 수도 있습니다. 미리 놓인 말도 이어져야 합니다.</li>
<li><b>말 배치</b>: 라운드 첫 차례에는 선 플레이어가 말 1개를 놓습니다. 그다음부터는 각자 차례에 <b>서로 다른 색 말 2개</b>를 놓습니다. 제한 시간 3분 안에 놓지 못하면 그 라운드는 바로 집니다.</li>
<li><b>배치 조건</b>: 같은 색 1쌍은 길로 이어져야 하고, 길은 말이 있는 칸을 포함해 <b>최소 6칸</b>이어야 합니다. 판 위의 말이 모두 이어진다고 할 때 길끼리 겹치거나 교차하면 안 됩니다. 길은 상하좌우 이웃 빈 칸으로만 지나고, 다른 말을 지날 수 없습니다.</li>
<li><b>불가능 선언</b>: 상대의 배치가 끝났을 때 조건을 만족할 수 없다고 판단되면, 내 차례 시작에 선언할 수 있습니다. 직전에 놓은 사람은 <b>5분 안에</b> 판 위의 모든 같은 색 말을 겹치지 않게 이어 보여야 합니다. 하나만 놓인 색은 남은 짝도 놓으면서(6칸 이상 길의 끝 빈 칸에) 증명합니다.</li>
<li><b>승점</b>: 증명에 성공하면 증명한 사람이, 실패하면 선언한 사람이 승점 1점을 얻고 라운드가 끝납니다.</li>
<li>총 5라운드이고 <b>먼저 3점</b>을 얻으면 이깁니다. 1라운드 선후공은 동전 던지기(무작위)로, 이후에는 직전 라운드에서 진 사람이 3분 안에 정합니다.</li>
</ul>
<p class="note">방송 규칙을 바탕으로 했고, 판 크기(7×7, 6×6은 12쌍), 미리 놓이는 X·Y 말의 수와 자리, 말이 모두 놓였는데 아무도 선언하지 않았을 때(다음 사람이 “이어질 수 있다”고 인정하면 마지막에 놓은 사람이 1점)는 이 사이트에서 정했습니다.</p>`,
    guide: `
<h4>1. 매 턴의 첫 질문: “지금 판이 이어지나?”</h4>
<p>상대가 이어질 수 없는 판을 만들었다면 내 차례가 시작될 때 바로 선언해야 점수를 얻습니다. 선언하지 않고 내가 말을 놓기 시작하면, 판은 여전히 이어질 수 없으니 이번에는 내가 선언당할 수 있습니다. 말을 놓기 전에 항상 판 전체를 먼저 점검하세요.</p>
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
<h4>6. 2개씩 놓는 차례 쓰기</h4>
<p>한 차례에 서로 다른 색 2개를 놓으니, 첫 말로 판을 조이고 두 번째 말로 그 압박이 나에게 돌아오지 않게 정리할 수 있습니다. 반대로 두 말이 서로의 통로를 막지 않는지도 함께 확인하세요. 내가 둔 두 말 때문에 판이 막히면 상대가 바로 선언합니다.</p>
<h4>7. 라운드 운영</h4>
<p>먼저 3점을 내면 이기니 한 라운드에 너무 매달리지 않아도 됩니다. 진 사람이 다음 라운드 선후공을 정하는데, 선은 첫 차례에 말 1개만 놓아 판을 열고, 후공은 첫 차례부터 2개를 놓아 판을 조일 수 있어요.</p>
<h4>8. 끝까지 갔을 때</h4>
<p>7×7 판(49칸)에 14쌍을 모두 6칸 이상으로 잇는 것은 불가능하기 때문에, 판이 차오르면 결국 누군가는 이을 수 없는 수를 둘 수밖에 없습니다. 안전한 칸이 몇 개 남았는지 세면서, 상대 차례에 안전한 칸이 바닥나도록 판을 조이세요. 방송 결승에서도 두 색의 연결을 끝까지 확인하지 않고 승리를 확신했다가 판이 뒤집힌 장면이 있었습니다.</p>`,
  });

  App.link = { solve, checkProof, solutionToProof, engine, LET };
})();
