/* 수식의 탑: 규칙 계산과 최단 수 탐색 (화면 없이 동작) */
(function () {
  const App = (globalThis.App = globalThis.App || {});
  const R = App.rng;

  const OPS = ['+', '-', '*'];
  const TNAMES = ['왼쪽', '가운데', '오른쪽'];

  // 블록 코드 = 번호*2 + 면 (0: 숫자 면이 보임, 1: 기호 면이 보임)
  function tok(tiles, code) { const t = tiles[code >> 1]; return (code & 1) ? t.o : String(t.d); }

  function makeTiles(count) {
    for (;;) {
      const tiles = [];
      for (let i = 0; i < count; i++) tiles.push({ d: R.int(1, 9), o: R.pick(OPS) });
      const ops = new Set(tiles.map((t) => t.o));
      const digits = new Set(tiles.map((t) => t.d));
      if (ops.size >= 2 && digits.size >= count - 1) return tiles;
    }
  }

  function randomTowers(count) {
    const towers = [[], [], []];
    const order = R.shuffle([...Array(count).keys()]);
    order.forEach((id, i) => {
      const t = i < 3 ? i : R.int(0, 2);
      towers[t].push(id * 2 + R.int(0, 1));
    });
    return R.shuffle(towers);
  }

  function key(T) { return T.map((t) => t.map((c) => String.fromCharCode(97 + c)).join('')).join('|'); }

  // 위에서 아래로 읽은 식. 올바른 식이 아니면 null
  function readTower(tiles, tower) {
    if (!tower.length || tower.length % 2 === 0) return null;
    const toks = tower.slice().reverse().map((c) => tok(tiles, c));
    for (let i = 0; i < toks.length; i++) {
      const isNum = /^[0-9]$/.test(toks[i]);
      if ((i % 2 === 0) !== isNum) return null;
    }
    try {
      const v = App.eq.evalTokens(toks.map((x) => (/^[0-9]$/.test(x) ? { k: 'n', v: [+x, 1] } : { k: 'o', v: x })));
      if (v[1] !== 1) return null;
      return { toks, value: v[0] };
    } catch (e) { return null; }
  }

  // 이동: {f: 출발 탑, k: 위에서 몇 개, t: 도착 탑, flip: 뒤집기}
  function apply(T, m) {
    const N = T.map((t) => t.slice());
    let grp = N[m.f].splice(N[m.f].length - m.k, m.k);
    if (m.flip) grp = grp.reverse().map((c) => c ^ 1);
    N[m.t].push(...grp);
    return N;
  }

  function moves(T) {
    const out = [];
    for (let f = 0; f < 3; f++) {
      for (let k = 1; k <= T[f].length; k++) {
        for (let t = 0; t < 3; t++) {
          if (t === f) out.push({ f, k, t, flip: true });
          else { out.push({ f, k, t, flip: false }); out.push({ f, k, t, flip: true }); }
        }
      }
    }
    return out;
  }

  function goalMet(tiles, T, goal) {
    for (const tw of T) {
      if (tw.length !== goal.h) continue;
      const r = readTower(tiles, tw);
      if (r && r.value === goal.v) return true;
    }
    return false;
  }

  // 시작 상태에서 maxDepth 수 안에 만들 수 있는 모든 (값, 층수)와 최단 수
  function explore(tiles, start, maxDepth, maxStates) {
    const sk = key(start);
    const parent = new Map([[sk, null]]);
    const goals = new Map();
    function record(T, d, k) {
      for (const tw of T) {
        if (tw.length !== 3 && tw.length !== 5) continue;
        const r = readTower(tiles, tw);
        if (!r || r.value < 2 || r.value > 300) continue;
        const gk = r.value + '@' + tw.length;
        if (!goals.has(gk)) goals.set(gk, { v: r.value, h: tw.length, d, key: k });
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

  // 라운드 목표 고르기: 원하는 최단 수(want)에 가장 가까운 목표
  function pickGoal(tiles, T, want, avoid) {
    const ex = explore(tiles, T, Math.min(4, want), 300000);
    const list = [...ex.goals.values()].filter((g) => g.d >= 2 && !(avoid && avoid.has(g.v + '@' + g.h)));
    if (!list.length) return null;
    let best = Infinity;
    list.forEach((g) => { g.score = Math.abs(g.d - want) * 10 + (g.h === 5 ? 0 : 2) + (g.v < 10 ? 2 : 0) + Math.random() * 3; if (g.score < best) best = g.score; });
    const pool = list.filter((g) => g.score <= best + 3);
    const g = R.pick(pool);
    return { v: g.v, h: g.h, d: g.d, path: pathTo(ex, g.key) };
  }

  function describe(m) {
    if (m.f === m.t) return TNAMES[m.f] + ' 탑 위 ' + m.k + '개를 제자리에서 뒤집기';
    return TNAMES[m.f] + ' 탑 위 ' + m.k + '개 → ' + TNAMES[m.t] + ' 탑' + (m.flip ? ' (뒤집어서)' : '');
  }

  App.towerCore = { makeTiles, randomTowers, key, readTower, apply, moves, goalMet, explore, pathTo, pickGoal, describe, tok, TNAMES };
})();
