/* 수식의 탑: 규칙 계산과 최단 수 탐색 (화면 없이 동작)
   블록 = 숫자 하나 + (있을 수도 있는) 기호 하나. 예: "7", "+3", "×4".
   탑은 맨 위층부터 아래로 읽고, 맨 위층은 기호가 없는 숫자 블록이어야 식이 된다. */
(function () {
  const App = (globalThis.App = globalThis.App || {});
  const R = App.rng;

  const OPS = ['+', '-', '*'];
  const SHOW = { '+': '+', '-': '−', '*': '×' };
  const TNAMES = ['왼쪽', '가운데', '오른쪽'];
  const NT = 3; // 블록을 놓는 자리 수

  function face(b) { return (b.o ? SHOW[b.o] : '') + b.d; }

  // 블록 n개 중 plain 개는 기호 없는 숫자
  function makeBlocks(n, plain) {
    n = n || 7; plain = plain == null ? 2 : plain;
    for (;;) {
      const B = [];
      for (let i = 0; i < n; i++) B.push({ d: R.int(1, 9), o: i < plain ? '' : R.pick(OPS) });
      const ops = new Set(B.filter((b) => b.o).map((b) => b.o));
      const digits = new Set(B.map((b) => b.d));
      const muls = B.filter((b) => b.o === '*').length;
      if (ops.size >= 2 && muls <= 2 && digits.size >= n - 2) return B;
    }
  }

  // 자리 3곳에 나눠 쌓기 (빈 자리 없이)
  function randomTowers(n) {
    for (;;) {
      const T = Array.from({ length: NT }, () => []);
      R.shuffle([...Array(n).keys()]).forEach((id, i) => T[i < NT ? i : R.int(0, NT - 1)].push(id));
      if (T.every((t) => t.length <= 4)) return T;
    }
  }

  const key = (T) => T.map((t) => String.fromCharCode.apply(null, t.map((c) => 97 + c))).join('|');
  const unkey = (k) => k.split('|').map((s) => [...s].map((ch) => ch.charCodeAt(0) - 97));

  // 탑 하나를 위에서 아래로 읽기. 식이 아니면 null
  // 기호 없는 숫자 블록이 이어지면 여러 자리 수로 읽음 (5 아래 3 → 53)
  function readTower(B, tw) {
    if (!tw.length) return null;
    const top = B[tw[tw.length - 1]];
    if (top.o) return null;
    let sum = 0, prod = 1, sign = 1, num = 0, pendingOp = null;
    const parts = [];
    for (let i = tw.length - 1; i >= 0; i--) {
      const b = B[tw[i]];
      if (b.o) {
        // 앞의 수를 마무리
        prod = pendingOp === '*' ? prod * num : num;
        if (b.o !== '*') { sum += sign * prod; sign = b.o === '-' ? -1 : 1; pendingOp = null; prod = 1; }
        else pendingOp = '*';
        num = b.d;
        parts.push(SHOW[b.o], String(b.d));
      } else {
        num = num * 10 + b.d;
        if (parts.length && /\d$/.test(parts[parts.length - 1])) parts[parts.length - 1] += String(b.d);
        else parts.push(String(b.d));
      }
    }
    prod = pendingOp === '*' ? prod * num : num;
    sum += sign * prod;
    return { toks: parts, text: parts.join(' '), value: sum };
  }

  // 이동: {f: 출발 자리, k: 위에서 몇 개, t: 도착 자리, flip: 묶음을 위아래로 뒤집기}
  function apply(T, m) {
    const N = T.map((t) => t.slice());
    let grp = N[m.f].splice(N[m.f].length - m.k, m.k);
    if (m.flip) grp = grp.reverse();
    N[m.t].push(...grp);
    return N;
  }

  function validMove(T, m) {
    if (!m || !(m.f >= 0 && m.f < NT && m.t >= 0 && m.t < NT)) return false;
    if (!(m.k >= 1 && m.k <= T[m.f].length)) return false;
    if (m.f === m.t) return !!m.flip && m.k >= 2; // 제자리에서 뒤집기만 (1개 뒤집기는 그대로라 안 됨)
    return true;
  }

  function moves(T) {
    const out = [];
    for (let f = 0; f < NT; f++) {
      for (let k = 1; k <= T[f].length; k++) {
        for (let t = 0; t < NT; t++) {
          if (t === f) { if (k >= 2) out.push({ f, k, t, flip: true }); }
          else { out.push({ f, k, t, flip: false }); if (k >= 2) out.push({ f, k, t, flip: true }); }
        }
      }
    }
    return out;
  }

  function goalMet(B, T, goal) {
    for (const tw of T) {
      if (tw.length !== goal.h) continue;
      const r = readTower(B, tw);
      if (r && r.value === goal.v) return true;
    }
    return false;
  }

  // 시작 상태에서 maxDepth 수 안에 만들 수 있는 모든 (값, 층수)와 최단 수
  function explore(B, start, maxDepth, maxStates, minH, maxH) {
    minH = minH || 2; maxH = maxH || 6; maxStates = maxStates || 400000;
    const sk = key(start);
    const parent = new Map([[sk, null]]);
    const goals = new Map();
    function record(T, d, k) {
      for (const tw of T) {
        if (tw.length < minH || tw.length > maxH) continue;
        const r = readTower(B, tw);
        if (!r || r.value < 1 || r.value > 150) continue;
        const gk = r.value + '@' + tw.length;
        if (!goals.has(gk)) goals.set(gk, { v: r.value, h: tw.length, d, key: k, text: r.text });
      }
    }
    record(start, 0, sk);
    let frontier = [start];
    for (let d = 1; d <= maxDepth && frontier.length; d++) {
      const next = [];
      for (const T of frontier) {
        const pk = key(T);
        for (const m of moves(T)) {
          const N = apply(T, m);
          const k = key(N);
          if (parent.has(k)) continue;
          parent.set(k, [pk, m]);
          next.push(N);
          record(N, d, k);
        }
        if (parent.size > maxStates) break;
      }
      frontier = next;
      if (parent.size > maxStates) break;
    }
    return { goals, parent, startKey: sk };
  }

  function pathTo(ex, k) {
    const out = [];
    while (k !== ex.startKey) {
      const [pk, m] = ex.parent.get(k);
      out.push(m);
      k = pk;
    }
    return out.reverse();
  }

  // 특정 목표의 최단 풀이 (못 찾으면 null)
  function solve(B, T, goal, maxDepth) {
    if (goalMet(B, T, goal)) return [];
    const sk = key(T);
    const parent = new Map([[sk, null]]);
    let frontier = [T];
    for (let d = 1; d <= (maxDepth || 6) && frontier.length; d++) {
      const next = [];
      for (const S of frontier) {
        const pk = key(S);
        for (const m of moves(S)) {
          const N = apply(S, m);
          const k = key(N);
          if (parent.has(k)) continue;
          parent.set(k, [pk, m]);
          if (goalMet(B, N, goal)) {
            const out = [];
            let c = k;
            while (c !== sk) { const [p, mm] = parent.get(c); out.push(mm); c = p; }
            return out.reverse();
          }
          next.push(N);
        }
      }
      frontier = next;
    }
    return null;
  }

  // 라운드 목표 고르기: 최단 수가 want 근처인 목표 (avoid: 이미 낸 목표)
  function pickGoal(B, T, want, avoid) {
    const ex = explore(B, T, Math.min(5, want + 1), 400000);
    const list = [...ex.goals.values()].filter((g) => g.d >= 1 && g.h >= 3 && g.h <= 5 && !(avoid && avoid.has(g.v + '@' + g.h)));
    if (!list.length) return null;
    let best = Infinity;
    list.forEach((g) => {
      g.score = Math.abs(g.d - want) * 10 + (g.v > 99 ? 4 : 0) + (g.v < 5 ? 2 : 0) + Math.random() * 4;
      if (g.score < best) best = g.score;
    });
    const pool = list.filter((g) => g.score <= best + 3);
    const g = R.pick(pool);
    return { v: g.v, h: g.h, d: g.d, path: pathTo(ex, g.key), text: g.text };
  }

  function describe(m) {
    if (m.f === m.t) return TNAMES[m.f] + ' 위 ' + m.k + '개를 제자리에서 뒤집기';
    return TNAMES[m.f] + ' 위 ' + m.k + '개 → ' + TNAMES[m.t] + (m.flip ? ' (뒤집어서)' : '');
  }

  App.towerCore = { OPS, SHOW, TNAMES, NT, face, makeBlocks, randomTowers, key, unkey, readTower, apply, validMove, moves, goalMet, explore, pathTo, solve, pickGoal, describe };
})();
