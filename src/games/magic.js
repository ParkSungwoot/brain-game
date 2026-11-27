/* 마법 격자: 마방진 채우기 (크기·시작 숫자·빈칸이 매번 달라짐) */
(function () {
  const App = (globalThis.App = globalThis.App || {});
  const { h, rng: R } = App;

  // ---------- 마방진 만들기 ----------
  function siamese(n) {
    const M = Array.from({ length: n }, () => Array(n).fill(0));
    let i = 0, j = (n - 1) / 2;
    for (let k = 1; k <= n * n; k++) {
      M[i][j] = k;
      let ni = (i - 1 + n) % n, nj = (j + 1) % n;
      if (M[ni][nj]) { ni = (i + 1) % n; nj = j; }
      i = ni; j = nj;
    }
    return M;
  }

  function linear(n) {
    // n이 5 이상의 소수일 때: 두 직교 라틴 방진을 겹쳐 만든 마방진 (가로·세로·두 대각선 모두 맞음)
    for (;;) {
      const a = R.int(1, n - 1), b = R.int(1, n - 1), d = R.int(1, n - 1), e = R.int(1, n - 1);
      if (a === b || (a + b) % n === 0 || d === e || (d + e) % n === 0) continue;
      if (((a * e - b * d) % n + n) % n === 0) continue;
      const c = R.int(0, n - 1), f = R.int(0, n - 1);
      const M = [];
      for (let i = 0; i < n; i++) { M.push([]); for (let j = 0; j < n; j++) M[i].push(n * ((a * i + b * j + c) % n) + ((d * i + e * j + f) % n) + 1); }
      return M;
    }
  }

  const BASE4 = [
    [[16, 3, 2, 13], [5, 10, 11, 8], [9, 6, 7, 12], [4, 15, 14, 1]],
    [[16, 2, 3, 13], [5, 11, 10, 8], [9, 7, 6, 12], [4, 14, 15, 1]],
    [[1, 8, 13, 12], [14, 11, 2, 7], [4, 5, 16, 9], [15, 10, 3, 6]],
    [[1, 15, 14, 4], [12, 6, 7, 9], [8, 10, 11, 5], [13, 3, 2, 16]],
  ];
  const LOSHU = [[2, 7, 6], [9, 5, 1], [4, 3, 8]];

  const copy = (M) => M.map((r) => r.slice());
  function rotate(M) { const n = M.length; return M.map((r, i) => r.map((_, j) => M[n - 1 - j][i])); }
  function mirror(M) { return M.map((r) => r.slice().reverse()); }
  function permBoth(M, P) { return P.map((pi) => P.map((pj) => M[pi][pj])); }
  function complement(M) { const n = M.length; return M.map((r) => r.map((x) => n * n + 1 - x)); }
  function symmetry(M) { let X = copy(M); for (let k = R.int(0, 3); k > 0; k--) X = rotate(X); if (R.chance(0.5)) X = mirror(X); return X; }

  function isMagic(M) {
    const n = M.length, S = n * (n * n + 1) / 2;
    let d1 = 0, d2 = 0;
    for (let i = 0; i < n; i++) {
      let r = 0, c = 0;
      for (let j = 0; j < n; j++) { r += M[i][j]; c += M[j][i]; }
      if (r !== S || c !== S) return false;
      d1 += M[i][i]; d2 += M[i][n - 1 - i];
    }
    const seen = new Set(M.flat());
    return d1 === S && d2 === S && seen.size === n * n;
  }

  // family: 'any' | 'classic' (정석 풀이법으로 재현 가능한 계열)
  function makeSquare(n, family) {
    let M;
    if (n === 3) M = symmetry(LOSHU);
    else if (n === 4) {
      M = copy(family === 'classic' ? BASE4[1] : R.pick(BASE4));
      if (family !== 'classic') {
        for (let k = R.int(0, 3); k > 0; k--) M = permBoth(M, R.pick([[1, 0, 3, 2], [0, 2, 1, 3]]));
        if (R.chance(0.5)) M = complement(M);
      }
      M = symmetry(M);
    } else {
      M = family === 'classic' || R.chance(0.4) ? siamese(n) : linear(n);
      if (family !== 'classic' && R.chance(0.3)) M = complement(M);
      M = symmetry(M);
    }
    if (!isMagic(M)) throw new Error('마방진 생성 오류');
    return M;
  }

  function lines(n) {
    const L = [];
    for (let i = 0; i < n; i++) { L.push(Array.from({ length: n }, (_, j) => i * n + j)); L.push(Array.from({ length: n }, (_, j) => j * n + i)); }
    L.push(Array.from({ length: n }, (_, i) => i * n + i));
    L.push(Array.from({ length: n }, (_, i) => i * n + (n - 1 - i)));
    return L;
  }

  // 한 줄에 빈칸이 하나뿐이면 채우는 방식만으로 풀리는지
  function solvable(vals, n, S, LS) {
    const g = vals.slice();
    let changed = true;
    while (changed) {
      changed = false;
      for (const line of LS) {
        let blank = -1, cnt = 0, sum = 0;
        for (const k of line) { if (g[k] == null) { cnt++; blank = k; } else sum += g[k]; }
        if (cnt === 1) { g[blank] = S - sum; changed = true; }
      }
    }
    return g.every((x) => x != null);
  }

  // 보통 난이도용: 줄 하나 남은 칸 + 후보가 하나뿐인 칸 + 갈 곳이 하나뿐인 숫자 (합의 최소·최대 범위로 후보를 거름)
  function solvable2(vals, n, S, LS, pool) {
    const g = vals.slice();
    const N2 = n * n;
    const cellLines = Array.from({ length: N2 }, () => []);
    LS.forEach((L) => L.forEach((k) => cellLines[k].push(L)));
    for (let guard = 0; guard < 400; guard++) {
      let progress = false;
      for (const line of LS) {
        let blank = -1, cnt = 0, sum = 0;
        for (const k of line) { if (g[k] == null) { cnt++; blank = k; } else sum += g[k]; }
        if (cnt === 1) { g[blank] = S - sum; progress = true; }
      }
      if (progress) continue;
      const used = new Set(g.filter((x) => x != null));
      const U = pool.filter((v) => !used.has(v));
      if (!U.length) break;
      const cands = {};
      for (let k = 0; k < N2; k++) {
        if (g[k] != null) continue;
        cands[k] = U.filter((v) => cellLines[k].every((L) => {
          let b = 0, sum = 0;
          for (const j of L) { if (j === k) continue; if (g[j] == null) b++; else sum += g[j]; }
          const r = S - sum - v;
          if (b === 0) return r === 0;
          const rest = U.filter((x) => x !== v);
          let mn = 0, mx = 0;
          for (let t = 0; t < b; t++) { mn += rest[t]; mx += rest[rest.length - 1 - t]; }
          return r >= mn && r <= mx;
        }));
        if (cands[k].length === 0) return false;
        if (cands[k].length === 1) { g[k] = cands[k][0]; progress = true; break; }
      }
      if (progress) continue;
      for (const v of U) {
        const where = Object.keys(cands).filter((k) => cands[k].includes(v));
        if (where.length === 1) { g[+where[0]] = v; progress = true; break; }
      }
      if (!progress) break;
    }
    return g.every((x) => x != null);
  }

  function makePuzzle(n, diff, start) {
    const off = start - 1;
    const M = makeSquare(n, diff === 'blank' ? 'classic' : 'any');
    const sol = M.flat().map((x) => x + off);
    const S = n * (n * n + 1) / 2 + n * off;
    const LS = lines(n);
    let given = sol.slice();
    if (diff === 'blank') {
      given = Array(n * n).fill(null);
      const keep = n === 3 ? 1 : R.int(1, 2);
      R.shuffle([...Array(n * n).keys()]).slice(0, keep).forEach((k) => { given[k] = sol[k]; });
    } else {
      const pool = sol.slice().sort((a, b) => a - b);
      const ok = diff === 'easy' ? (g) => solvable(g, n, S, LS) : (g) => solvable2(g, n, S, LS, pool);
      const order = R.shuffle([...Array(n * n).keys()]);
      const cap = diff === 'easy' ? Math.max(3, Math.round(0.22 * n * n)) : n * n;
      let blanks = 0;
      for (const k of order) {
        if (blanks >= cap) break;
        const v = given[k];
        given[k] = null;
        if (!ok(given)) given[k] = v; else blanks++;
      }
    }
    return { n, start, S, sol, given, diff };
  }

  // ---------- 화면 ----------
  function mount(root, ctx) {
    let n = App.store.get('magic.n', 7);
    let diff = App.store.get('magic.diff', 'medium');
    let pz, vals, t0, solved, hints, timerId, pendingMsg = '';
    let sel = null, armed = null; // 선택한 칸, 먼저 고른 숫자 조각
    let lastPtr = 0;
    const fine = (() => { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) { return false; } })();

    const wrap = h('div', { class: 'magic' });
    root.append(wrap);

    function fresh(randomVariant) {
      let start = 1;
      if (randomVariant) {
        n = R.pick([3, 4, 5, 5, 7, 7]);
        diff = R.pick(['easy', 'medium', 'medium', 'blank']);
        start = R.chance(0.5) ? 1 : R.int(2, 20);
      }
      App.store.set('magic.n', n); App.store.set('magic.diff', diff);
      pz = makePuzzle(n, diff, start);
      App.magic.lastPuzzle = pz; // 점검용
      vals = pz.given.slice();
      t0 = Date.now(); solved = false; hints = 0; sel = null; armed = null;
      draw();
    }

    const DIFFS = [['easy', '쉬움'], ['medium', '보통'], ['blank', '빈 판 도전']];

    function draw() {
      App.clear(wrap);
      const N = pz.n, lo = pz.start, hi = pz.start + N * N - 1;
      const toolbar = h('div', { class: 'toolbar' },
        h('div', { class: 'seg small' }, [3, 4, 5, 7].map((k) => h('button', { class: 'seg-btn' + (n === k ? ' on' : ''), onclick: () => { n = k; fresh(); } }, k + '×' + k))),
        h('div', { class: 'seg small' }, DIFFS.map(([id, l]) => h('button', { class: 'seg-btn' + (diff === id ? ' on' : ''), onclick: () => { diff = id; fresh(); } }, l))),
        h('button', { class: 'btn tiny', onclick: () => fresh(true) }, '랜덤 변형'),
        h('button', { class: 'btn tiny ghost', onclick: () => fresh() }, '새 문제'));
      const info = h('div', { class: 'magic-info' },
        h('span', { class: 'pill' }, lo + ' ~ ' + hi + ' 한 번씩'),
        h('span', { class: 'pill strong' }, '모든 줄의 합 ' + pz.S),
        lo !== 1 ? h('span', { class: 'pill warn' }, '변형: ' + lo + '부터 시작') : null,
        h('span', { class: 'pill', id: 'magic-clock' }, '0:00'));

      const grid = h('div', { class: 'mg', style: { '--n': N } });
      const cellEls = [];
      const sumEls = { r: [], c: [], d: null, a: null };
      // 대각선 합(왼쪽 위)
      for (let i = 0; i <= N; i++) {
        for (let j = 0; j <= N; j++) {
          if (i < N && j < N) {
            const k = i * N + j;
            if (pz.given[k] != null) {
              cellEls[k] = h('div', { class: 'mg-cell given', 'aria-label': (i + 1) + '행 ' + (j + 1) + '열 ' + pz.given[k] }, String(pz.given[k]));
            } else {
              const inp = h('input', { class: 'mg-cell', id: 'mg-' + k, inputmode: fine ? 'numeric' : 'none', autocomplete: 'off', maxlength: String(String(hi).length), 'aria-label': (i + 1) + '행 ' + (j + 1) + '열', value: vals[k] == null ? '' : String(vals[k]) });
              // 휴대폰에서는 키보드를 띄우지 않고 칸 선택 → 숫자 조각 선택으로 입력
              if (!fine || solved) inp.readOnly = true;
              inp.addEventListener('pointerdown', () => { lastPtr = Date.now(); tapCell(k); });
              // 키보드(Tab·화살표)로 옮겨 왔을 때만 선택. 누를 때는 pointerdown이 처리
              inp.addEventListener('focus', () => { if (Date.now() - lastPtr > 400 && sel !== k) select(k); });
              inp.addEventListener('input', () => {
                const t = inp.value.replace(/[^0-9]/g, '');
                inp.value = t;
                vals[k] = t === '' ? null : parseInt(t, 10);
                update();
              });
              inp.addEventListener('keydown', (e) => {
                const mv = { ArrowUp: -N, ArrowDown: N, ArrowLeft: -1, ArrowRight: 1 }[e.key];
                if (!mv) return;
                let t = k;
                for (let s = 0; s < N * N; s++) {
                  t += mv;
                  if (t < 0 || t >= N * N) return;
                  if ((mv === 1 || mv === -1) && Math.floor(t / N) !== i) return;
                  const el = document.getElementById('mg-' + t);
                  if (el) { e.preventDefault(); el.focus(); el.select(); return; }
                }
              });
              cellEls[k] = inp;
            }
            grid.append(cellEls[k]);
          } else if (i < N && j === N) { sumEls.r[i] = h('div', { class: 'mg-sum' }); grid.append(sumEls.r[i]); }
          else if (i === N && j < N) { sumEls.c[j] = h('div', { class: 'mg-sum' }); grid.append(sumEls.c[j]); }
          else { sumEls.d = h('div', { class: 'mg-sum diag', title: '대각선 합 (↘ / ↙)' }); grid.append(sumEls.d); }
        }
      }
      const trayHint = h('p', { class: 'tray-hint' }, fine
        ? '빈칸을 누르고 아래 숫자 조각을 누르세요. 키보드로 바로 쳐도 돼요.'
        : '빈칸을 누른 다음 숫자 조각을 누르세요. 숫자를 먼저 골라도 돼요.');
      const tray = h('div', { class: 'tray pick', role: 'group', 'aria-label': '숫자 조각' });
      const trayEls = {};
      const keepFocus = (el) => { el.addEventListener('mousedown', (e) => e.preventDefault()); return el; };
      for (let v = lo; v <= hi; v++) {
        trayEls[v] = keepFocus(h('button', { class: 'tray-n', type: 'button', 'aria-label': '숫자 ' + v, onclick: () => tapNum(v) }, String(v)));
        tray.append(trayEls[v]);
      }
      tray.append(keepFocus(h('button', { class: 'tray-n erase', type: 'button', onclick: erase }, '⌫ 지우기')));
      const status = h('p', { class: 'status', 'aria-live': 'polite' }, pendingMsg || '\u00a0');
      pendingMsg = '';
      const ctl = h('div', { class: 'row wrap center' },
        h('button', { class: 'btn primary', onclick: check }, '정답 확인'),
        h('button', { class: 'btn', onclick: hint }, '한 칸 알려주기'),
        h('button', { class: 'btn ghost', onclick: () => { vals = pz.given.slice(); draw(); } }, '모두 지우기'));

      wrap.append(toolbar, info, h('div', { class: 'mg-scroll' }, grid), trayHint, tray, status, ctl);

      // ---------- 칸 선택 + 숫자 조각 ----------
      const rc = (k) => (Math.floor(k / N) + 1) + '행 ' + (k % N + 1) + '열';
      const open = (k) => k != null && pz.given[k] == null;
      function paintPick() {
        cellEls.forEach((el, j) => { if (el) el.classList.toggle('sel', j === sel); });
        for (let v = lo; v <= hi; v++) { trayEls[v].classList.toggle('armed', armed === v); trayEls[v].setAttribute('aria-pressed', armed === v ? 'true' : 'false'); }
      }
      function select(k) { sel = open(k) ? k : null; paintPick(); }
      function syncCells() {
        vals.forEach((v, k) => { if (open(k) && cellEls[k]) cellEls[k].value = v == null ? '' : String(v); });
      }
      function place(k, v) {
        if (solved || !open(k)) return;
        if (v == null) vals[k] = null;
        else {
          if (pz.given.includes(v)) { status.textContent = v + '은(는) 이미 고정된 칸에 있어요.'; return; }
          let moved = -1;
          vals.forEach((x, j) => { if (j !== k && open(j) && x === v) { vals[j] = null; moved = j; } });
          vals[k] = v;
          status.textContent = moved >= 0 ? v + ' 조각을 ' + rc(moved) + '에서 ' + rc(k) + '로 옮겼어요.' : '\u00a0';
        }
        syncCells(); update();
      }
      function tapCell(k) {
        if (solved) return;
        // 숫자를 먼저 고른 경우: 넣고 나서 칸 선택은 두지 않음 (다음에도 숫자 먼저 고르기 그대로)
        if (armed != null) { const v = armed; armed = null; place(k, v); sel = null; paintPick(); return; }
        if (sel === k && !fine) { sel = null; paintPick(); return; } // 같은 칸을 다시 누르면 선택 해제
        select(k);
      }
      function tapNum(v) {
        if (solved) return;
        if (open(sel)) { place(sel, vals[sel] === v ? null : v); armed = null; }
        else armed = armed === v ? null : v;
        paintPick();
        if (fine && open(sel) && cellEls[sel]) cellEls[sel].focus();
      }
      function erase() {
        if (solved) return;
        if (open(sel)) place(sel, null);
        else if (armed != null) armed = null;
        else status.textContent = '지울 칸을 먼저 누르세요.';
        paintPick();
      }
      if (sel != null && !open(sel)) sel = null;
      if (solved) { sel = null; armed = null; tray.querySelectorAll('button').forEach((b) => { b.disabled = true; }); }
      paintPick();

      function lineSum(idx) { let s = 0, full = true; for (const k of idx) { if (vals[k] == null) full = false; else s += vals[k]; } return { s, full }; }
      function paint(el, r) {
        el.textContent = r.s;
        el.dataset.state = r.s > pz.S ? 'over' : r.full ? (r.s === pz.S ? 'ok' : 'bad') : 'part';
      }
      function update() {
        for (let i = 0; i < N; i++) {
          paint(sumEls.r[i], lineSum(Array.from({ length: N }, (_, j) => i * N + j)));
          paint(sumEls.c[i], lineSum(Array.from({ length: N }, (_, j) => j * N + i)));
        }
        const d = lineSum(Array.from({ length: N }, (_, i) => i * N + i));
        const a = lineSum(Array.from({ length: N }, (_, i) => i * N + (N - 1 - i)));
        sumEls.d.textContent = '';
        sumEls.d.append(h('span', { 'data-state': d.s > pz.S ? 'over' : d.full ? (d.s === pz.S ? 'ok' : 'bad') : 'part' }, '↘' + d.s), h('span', { 'data-state': a.s > pz.S ? 'over' : a.full ? (a.s === pz.S ? 'ok' : 'bad') : 'part' }, '↙' + a.s));
        const count = {};
        vals.forEach((v) => { if (v != null) count[v] = (count[v] || 0) + 1; });
        for (let v = lo; v <= hi; v++) trayEls[v].dataset.state = count[v] > 1 ? 'dup' : count[v] ? 'used' : '';
        vals.forEach((v, k) => {
          const el = cellEls[k];
          el.classList.toggle('dup', v != null && (count[v] > 1 || v < lo || v > hi));
        });
      }
      function check() {
        if (solved) return;
        const empty = vals.filter((v) => v == null).length;
        if (empty) { status.textContent = '아직 빈칸이 ' + empty + '개 있어요.'; return; }
        const M = []; for (let i = 0; i < N; i++) M.push(vals.slice(i * N, i * N + N).map((x) => x - (pz.start - 1)));
        if (isMagic(M)) {
          solved = true;
          const sec = Math.round((Date.now() - t0) / 1000);
          status.textContent = '완성! ' + App.fmtTime(sec * 1000) + (hints ? ' · 힌트 ' + hints + '번' : '') + ' — 다른 크기나 랜덤 변형에도 도전해 보세요.';
          status.classList.add('strong');
          wrap.querySelectorAll('input.mg-cell').forEach((x) => { x.readOnly = true; });
          sel = null; armed = null; paintPick();
          tray.querySelectorAll('button').forEach((b) => { b.disabled = true; });
          ctx.finished({});
        } else {
          const bad = [];
          for (let v = lo; v <= hi; v++) if (!vals.includes(v)) bad.push(v);
          status.textContent = bad.length ? '빠진 숫자가 있어요: ' + bad.slice(0, 6).join(', ') + (bad.length > 6 ? ' …' : '') : '합이 맞지 않는 줄이 있어요. 빨간 합계를 확인하세요.';
        }
      }
      function hint() {
        if (solved) return;
        const cand = [];
        vals.forEach((v, k) => { if (pz.given[k] == null && v !== pz.sol[k]) cand.push(k); });
        if (!cand.length) { status.textContent = '알려줄 칸이 없어요. 정답 확인을 눌러 보세요.'; return; }
        const k = R.pick(cand);
        vals[k] = pz.sol[k];
        // 같은 숫자를 다른 칸에 넣었다면 지움
        vals.forEach((v, j) => { if (j !== k && pz.given[j] == null && v === pz.sol[k]) vals[j] = null; });
        pz.given[k] = pz.sol[k];
        hints++;
        pendingMsg = (Math.floor(k / N) + 1) + '행 ' + (k % N + 1) + '열을 채웠어요. 정답은 여러 개일 수 있는데, 이 칸은 출제자가 만든 답을 기준으로 했어요.';
        draw();
      }
      update();
    }

    timerId = setInterval(() => {
      const el = document.getElementById('magic-clock');
      if (el && !solved) el.textContent = App.fmtTime(Date.now() - t0);
    }, 500);
    fresh();
    return () => clearInterval(timerId);
  }

  App.games.push({
    id: 'magic',
    name: '마법 격자',
    kicker: '숫자 퍼즐',
    players: '혼자',
    blurb: '가로·세로·대각선의 합이 모두 같도록 숫자를 채웁니다. 3×3부터 7×7까지, 시작 숫자와 빈칸 위치가 매번 달라요.',
    accent: 'magic',
    mount,
    rules: `
<p>n×n 칸에 정해진 범위의 숫자를 <b>한 번씩</b> 넣어서, 모든 가로줄·세로줄·두 대각선의 합이 같아지도록 만드는 퍼즐입니다. 이런 배열을 마방진이라고 부릅니다.</p>
<ul>
<li>기본은 1부터 n²까지입니다. 7×7이면 1~49를 쓰고 모든 줄의 합은 175가 됩니다.</li>
<li>합은 n(n²+1)/2 로 정해집니다. 3×3은 15, 4×4는 34, 5×5는 65, 7×7은 175입니다.</li>
<li><b>변형</b>에서는 시작 숫자가 바뀝니다. 예를 들어 5부터 시작하는 5×5는 5~29를 쓰고, 합은 65 + 5×4 = 85가 됩니다.</li>
<li>쉬움·보통은 미리 채워진 칸에서 출발합니다. 빈 판 도전은 한두 칸만 주어지고 나머지를 직접 만들어야 합니다.</li>
<li>정답은 여러 개일 수 있습니다. 주어진 칸을 지키고 모든 줄의 합이 맞으면 성공입니다.</li>
<li><b>입력</b>: 빈칸을 누르고 아래 숫자 조각을 누르면 들어갑니다. 숫자를 먼저 고르고 칸을 눌러도 돼요. 이미 쓴 숫자를 다른 칸에 넣으면 그 칸으로 옮겨집니다. 컴퓨터에서는 키보드로 바로 쳐도 됩니다.</li>
</ul>
<p>오른쪽과 아래의 숫자는 각 줄의 현재 합입니다. 초록은 완성, 빨강은 넘침이나 틀린 합, 회색은 아직 채우는 중입니다.</p>`,
    guide: `
<h4>1. 줄에 빈칸이 하나 남으면 바로 계산</h4>
<p>쉬움·보통 문제는 “빈칸이 하나뿐인 줄”을 찾는 것만으로 끝까지 풀리도록 만들어져 있습니다. 가로·세로뿐 아니라 대각선도 꼭 확인하세요. 한 칸을 채우면 그 칸이 걸친 다른 줄에서 새로 빈칸 하나짜리 줄이 생기는 경우가 많습니다.</p>
<h4>2. 홀수 크기: 계단식 배치법 (시암법)</h4>
<p>3×3, 5×5, 7×7처럼 홀수 크기는 외워둔 규칙 하나로 빈 판에서도 바로 만들 수 있습니다.</p>
<ol>
<li>맨 윗줄 가운데 칸에 가장 작은 수(보통 1)를 놓습니다.</li>
<li>다음 수는 <b>오른쪽 위 대각선</b> 칸에 놓습니다. 판 밖으로 나가면 반대편 끝으로 이어 붙입니다. (위로 나가면 맨 아래 줄, 오른쪽으로 나가면 맨 왼쪽 줄)</li>
<li>그 칸이 이미 차 있으면 대신 <b>바로 아래 칸</b>에 놓습니다.</li>
</ol>
<p>이렇게 하면 7×7에서 가운데 칸은 25(1~49의 가운데 값)가 되고, 모든 줄의 합이 175가 됩니다. 빈 판 도전에서 주어진 숫자가 맨 윗줄 가운데에 있지 않다면, 판을 돌리거나 뒤집은 모양입니다. 1이 놓인 변이 “위쪽”이 되도록 머릿속으로 판을 돌린 뒤 같은 규칙을 쓰세요. 다음 수가 왼쪽 위로 이어진다면 좌우가 뒤집힌 판입니다.</p>
<div class="demo" data-demo="magic"></div>
<h4>3. 4×4: 대각선 뒤집기</h4>
<ol>
<li>1부터 16까지를 왼쪽 위부터 차례로 씁니다.</li>
<li>두 대각선 위에 있는 8칸만 17에서 뺀 값으로 바꿉니다. (1↔16, 6↔11, 4↔13, 7↔10)</li>
</ol>
<p>결과는 16 2 3 13 / 5 11 10 8 / 9 7 6 12 / 4 14 15 1 입니다. 4×4 마방진은 이 밖에도 880가지가 있어서, 쉬움·보통에서는 다른 모양도 나옵니다.</p>
<h4>4. 시작 숫자가 바뀐 변형</h4>
<p>시작 숫자가 s라면, 1부터 만든 마방진의 모든 칸에 (s−1)을 더하면 됩니다. 줄마다 n칸이 있으므로 합은 n×(s−1)만큼 늘어납니다. 계산이 헷갈리면 먼저 1부터 시작하는 판을 떠올린 뒤 마지막에 더하세요.</p>
<h4>5. 빠르게 검산하는 법</h4>
<ul>
<li>가운데 칸(홀수 크기)은 사용하는 수들의 가운데 값이 되는 경우가 많습니다. 시암법으로 만든 판이라면 항상 그렇습니다.</li>
<li>중심을 기준으로 마주 보는 두 칸의 합이 일정한 판(대칭 마방진)이 많습니다. 7×7 시암법 판은 마주 보는 두 칸의 합이 항상 50입니다.</li>
<li>숫자 줄의 회색 칸이 남아 있다면 아직 안 쓴 숫자입니다. 빨간 숫자는 두 번 쓴 숫자입니다.</li>
</ul>`,
  });

  App.magic = { makeSquare, makePuzzle, isMagic, solvable, solvable2, lines, siamese };
})();
