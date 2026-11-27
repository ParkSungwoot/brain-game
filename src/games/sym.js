/* 대칭 퍼즐: 조각들을 돌려 붙여 선대칭 도형 하나를 만들기 */
(function () {
  const App = (globalThis.App = globalThis.App || {});
  const { h } = App;

  const norm = (cells) => {
    const mx = Math.min(...cells.map((c) => c[0])), my = Math.min(...cells.map((c) => c[1]));
    return cells.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  };
  const rot = (cells) => { const maxY = Math.max(...cells.map((c) => c[1])); return norm(cells.map(([x, y]) => [maxY - y, x])); };
  const flip = (cells) => norm(cells.map(([x, y]) => [-x, y]));
  const key = (x, y) => x + ',' + y;

  // 합친 모양이 선대칭인지 (세로·가로·두 대각선 축). 맞으면 축 이름
  function symmetryAxis(cells) {
    const n = norm(cells);
    const S = new Set(n.map(([x, y]) => key(x, y)));
    const w = Math.max(...n.map((c) => c[0])) + 1, hh = Math.max(...n.map((c) => c[1])) + 1;
    const test = (f) => n.every(([x, y]) => { const [a, b] = f(x, y); return S.has(key(a, b)); });
    if (test((x, y) => [w - 1 - x, y])) return '세로축';
    if (test((x, y) => [x, hh - 1 - y])) return '가로축';
    if (w === hh && test((x, y) => [y, x])) return '대각선 축';
    if (w === hh && test((x, y) => [hh - 1 - y, w - 1 - x])) return '대각선 축';
    return null;
  }
  function connected(cells) {
    const S = new Set(cells.map(([x, y]) => key(x, y)));
    const seen = new Set([key(...cells[0])]);
    const st = [cells[0]];
    while (st.length) {
      const [x, y] = st.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k2 = key(x + dx, y + dy);
        if (S.has(k2) && !seen.has(k2)) { seen.add(k2); st.push([x + dx, y + dy]); }
      }
    }
    return seen.size === S.size;
  }

  // 조각들(돌리기, 허용되면 뒤집기)로 n칸짜리 꽉 찬 직사각형을 만들 수 있는지
  function orientations(cells, allowFlip) {
    const out = [], seenO = new Set();
    let c = norm(cells);
    for (let f = 0; f < (allowFlip ? 2 : 1); f++) {
      for (let r = 0; r < 4; r++) {
        const k2 = JSON.stringify(c);
        if (!seenO.has(k2)) { seenO.add(k2); out.push(c); }
        c = rot(c);
      }
      c = flip(c);
    }
    return out;
  }
  function canTileRect(pieces, allowFlip, n) {
    const ors = pieces.map((p) => orientations(p, allowFlip));
    for (let w = 1; w <= n; w++) {
      if (n % w) continue;
      const hgt = n / w;
      if (w > hgt) break;
      const grid = new Uint8Array(n);
      const used = Array(pieces.length).fill(false);
      const fill = () => {
        const e = grid.indexOf(0);
        if (e < 0) return true;
        const ex = e % w, ey = Math.floor(e / w);
        for (let p = 0; p < pieces.length; p++) {
          if (used[p]) continue;
          for (const o of ors[p]) {
            const [fx, fy] = o[0];
            const cellsAt = o.map(([x, y]) => [x - fx + ex, y - fy + ey]);
            if (cellsAt.some(([x, y]) => x < 0 || y < 0 || x >= w || y >= hgt || grid[y * w + x])) continue;
            cellsAt.forEach(([x, y]) => { grid[y * w + x] = 1; });
            used[p] = true;
            if (fill()) return true;
            used[p] = false;
            cellsAt.forEach(([x, y]) => { grid[y * w + x] = 0; });
          }
        }
        return false;
      };
      if (fill()) return true;
    }
    return false;
  }

  function gen(seed, o) {
    const R = App.srng(seed);
    const k = o.pieces || 3;
    const big = o.size === 'M';
    for (let tries = 0; tries < 800; tries++) {
      const hw = big ? R.int(3, 4) : R.int(2, 3);
      const hh = big ? R.int(4, 5) : R.int(3, 4);
      const odd = R.chance(0.5);
      // 축에 닿은 칸에서 시작해 반쪽 모양을 키움
      const half = new Set([key(hw - 1, R.int(0, hh - 1))]);
      const tgt = Math.round(hw * hh * R.float(0.55, 0.85));
      let guard = 0;
      while (half.size < tgt && guard++ < 400) {
        const [x, y] = R.pick([...half]).split(',').map(Number);
        const [dx, dy] = R.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < hw && ny >= 0 && ny < hh) half.add(key(nx, ny));
      }
      const full = new Set();
      for (const s of half) {
        const [x, y] = s.split(',').map(Number);
        full.add(key(x, y));
        full.add(key(odd ? 2 * (hw - 1) - x : 2 * hw - 1 - x, y));
      }
      const cells = [...full].map((s) => s.split(',').map(Number));
      const n = cells.length;
      if (n < k * 3 || n > k * 6) continue;
      // 조각 나누기
      const owner = new Map();
      const seeds = R.shuffle(cells).slice(0, k);
      seeds.forEach((c, i) => owner.set(key(...c), i));
      const sizes = Array(k).fill(1);
      let stuck = 0;
      while (owner.size < n && stuck < 2000) {
        stuck++;
        const minSize = Math.min(...sizes);
        const cand = [...Array(k).keys()].filter((i) => sizes[i] <= minSize + 1);
        const p = R.pick(cand);
        const mine = cells.filter((c) => owner.get(key(...c)) === p);
        const front = [];
        for (const [x, y] of mine) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k2 = key(x + dx, y + dy);
          if (full.has(k2) && !owner.has(k2)) front.push(k2);
        }
        if (!front.length) { sizes[p] += 100; if (Math.min(...sizes) >= 100) break; continue; }
        owner.set(R.pick(front), p);
        sizes[p]++;
      }
      if (owner.size < n) continue;
      const pieces = [...Array(k).keys()].map((i) => cells.filter((c) => owner.get(key(...c)) === i));
      if (pieces.some((p) => p.length < 3)) continue;
      // 조각 하나가 이미 전체와 같은 대칭 모양이면 너무 쉬움 → 다시
      if (pieces.some((p) => p.length > n / 2)) continue;
      // 정답이 꽉 찬 직사각형·정사각형이거나, 조각들로 직사각형을 만들 수 있으면 너무 쉬움 → 다시
      const bw = Math.max(...cells.map((c) => c[0])) - Math.min(...cells.map((c) => c[0])) + 1;
      const bh = Math.max(...cells.map((c) => c[1])) - Math.min(...cells.map((c) => c[1])) + 1;
      if (bw * bh === n) continue;
      if (canTileRect(pieces, !!o.flip, n)) continue;
      const shown = pieces.map((p) => {
        let c = norm(p);
        for (let r = R.int(0, 3); r > 0; r--) c = rot(c);
        if (o.flip && R.chance(0.5)) c = flip(c);
        return c;
      });
      return { k, board: big ? [12, 10] : [10, 9], pieces: shown, sol: pieces, flip: !!o.flip, axisOdd: odd };
    }
    throw new Error('대칭 퍼즐 문제 생성 실패');
  }

  function mini(cells, color, size) {
    const w = Math.max(...cells.map((c) => c[0])) + 1, hh = Math.max(...cells.map((c) => c[1])) + 1;
    const g = h('div', { class: 'sym-mini', style: { '--w': w, '--h': hh, '--cs': (size || 16) + 'px' } });
    for (const [x, y] of cells) g.append(h('span', { style: { gridColumn: String(x + 1), gridRow: String(y + 1), background: color } }));
    return g;
  }

  function mount(pz, api) {
    const [BW, BH] = pz.board;
    const P = pz.pieces.map((c) => ({ cells: c.map((x) => x.slice()), pos: null }));
    let sel = null, hover = null, solved = false, msg = '', cellEls = [];
    let press = null, drag = null, boardEl = null;
    let canHover = false;
    try { canHover = matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) { /* 무시 */ }
    const LONG_MS = 150; // 가만히 누르고 있으면 이만큼 뒤 끌기 시작 (누른 채 움직이면 바로 시작)
    const DRAG_PX = 10; // 손가락이 이만큼 넘게 움직이면 끌기 (흔들림은 탭)
    const el = h('div', { class: 'sym' });

    function occupancy(skip) {
      const occ = new Map();
      P.forEach((p, i) => { if (i === skip || !p.pos) return; for (const [x, y] of p.cells) occ.set(key(x + p.pos[0], y + p.pos[1]), i); });
      return occ;
    }
    function fitsAt(i, cells, ox, oy) {
      const occ = occupancy(i);
      return cells.every(([x, y]) => { const X = x + ox, Y = y + oy; return X >= 0 && Y >= 0 && X < BW && Y < BH && !occ.has(key(X, Y)); });
    }
    function check() {
      if (P.some((p) => !p.pos)) return;
      const all = [];
      P.forEach((p) => p.cells.forEach(([x, y]) => all.push([x + p.pos[0], y + p.pos[1]])));
      if (!connected(all)) { msg = '조각들이 변으로 이어진 한 덩어리가 되어야 해요.'; return; }
      const ax = symmetryAxis(all);
      if (!ax) { msg = '아직 선대칭이 아니에요. 접었을 때 딱 겹쳐야 해요.'; return; }
      solved = true;
      sel = null;
      msg = ax + ' 대칭 완성!';
      api.done();
    }
    // 칸 누르기: 조각이 있으면 선택, 빈칸이면 선택한 조각을 그 자리로
    function tap(x, y) {
      if (solved) return;
      const owner = occupancy(-1).get(key(x, y));
      if (owner != null) {
        sel = sel === owner ? null : owner;
        msg = sel != null ? '판 위 조각을 골랐어요. ↻ 돌리기로 회전하거나, 빈칸을 눌러 옮기거나, 누른 채 끌어서 옮길 수 있어요.' : '';
        draw();
        return;
      }
      if (sel == null) return;
      const p = P[sel];
      const [fx, fy] = p.cells[0];
      const ox = x - fx, oy = y - fy;
      if (!fitsAt(sel, p.cells, ox, oy)) { msg = '그 자리에는 놓을 수 없어요. 다른 조각과 겹치거나 판 밖으로 나가요.'; draw(); return; }
      const fromTray = !p.pos;
      p.pos = [ox, oy];
      if (fromTray) sel = null;
      msg = '';
      check();
      draw();
    }
    // 판 위 조각은 무게중심을 유지하며 돌리고, 자리가 없으면 가까운 빈자리로 비켜 놓음
    function turn(fn) {
      if (sel == null || solved) return;
      const p = P[sel];
      const nc = fn(p.cells);
      if (!p.pos) { p.cells = nc; msg = ''; draw(); return; }
      const avg = (cs, k) => cs.reduce((a, c) => a + c[k], 0) / cs.length;
      const cx = avg(p.cells, 0) + p.pos[0], cy = avg(p.cells, 1) + p.pos[1];
      const bx = Math.round(cx - avg(nc, 0)), by = Math.round(cy - avg(nc, 1));
      const offs = [[0, 0]];
      for (let r = 1; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) offs.push([dx, dy]);
      for (const [dx, dy] of offs) {
        if (fitsAt(sel, nc, bx + dx, by + dy)) { p.cells = nc; p.pos = [bx + dx, by + dy]; msg = ''; check(); draw(); return; }
      }
      msg = '돌릴 공간이 없어요. 조각을 조금 옮긴 뒤 돌려 보세요.';
      draw();
    }

    function cellFromEvent(e) {
      const t = document.elementFromPoint(e.clientX, e.clientY);
      const c = t && t.closest ? t.closest('.sym-cell') : null;
      if (!c || !boardEl || !boardEl.contains(c)) return null;
      const i = +c.dataset.i;
      return [i % BW, Math.floor(i / BW)];
    }
    function onDown(e) {
      if (solved || e.button > 0) return;
      if (press || drag || e.isPrimary === false) return; // 두 번째 손가락은 무시
      const c = cellFromEvent(e);
      if (!c) return;
      const owner = occupancy(-1).get(key(c[0], c[1]));
      const pr = { c, owner, sx: e.clientX, sy: e.clientY, moved: false, timer: null, id: e.pointerId };
      press = pr;
      try { boardEl.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      if (owner != null) pr.timer = setTimeout(() => { if (press === pr && !pr.moved) startDrag(); }, LONG_MS);
    }
    // 판 위 조각 끌기 시작 (조금만 눌러 있거나, 누른 채 움직이면 바로)
    function startDrag(e) {
      const pr = press;
      if (!pr || pr.owner == null) return;
      press = null;
      clearTimeout(pr.timer);
      const p = P[pr.owner];
      drag = { i: pr.owner, off: [pr.c[0] - p.pos[0], pr.c[1] - p.pos[1]], target: p.pos.slice(), from: p.pos.slice(), c: pr.c, prevSel: sel, id: pr.id };
      sel = pr.owner;
      if (e) { const c = cellFromEvent(e); if (c) drag.target = [c[0] - drag.off[0], c[1] - drag.off[1]]; }
      msg = '끌어서 옮길 곳에 놓으세요.';
      paint();
      const st = el.querySelector('.status'); if (st) st.textContent = msg;
      if (navigator.vibrate) { try { navigator.vibrate(10); } catch (err) { /* 무시 */ } }
    }
    function onMove(e) {
      if (drag) {
        if (e.pointerId !== drag.id) return;
        const c = cellFromEvent(e);
        if (c) { drag.target = [c[0] - drag.off[0], c[1] - drag.off[1]]; paint(); }
        e.preventDefault();
        return;
      }
      if (press) {
        if (e.pointerId !== press.id) return;
        if (Math.hypot(e.clientX - press.sx, e.clientY - press.sy) <= DRAG_PX) return;
        if (press.owner != null) { startDrag(e); e.preventDefault(); return; }
        // 빈칸을 누른 경우: 손가락이 다른 칸으로 넘어갔을 때만 누르기를 취소 (살짝 흔들린 건 그대로 탭)
        const c = cellFromEvent(e);
        if (!c || c[0] !== press.c[0] || c[1] !== press.c[1]) { press.moved = true; clearTimeout(press.timer); }
        return;
      }
      if (canHover && sel != null) {
        const c = cellFromEvent(e);
        if (!c || !hover || c[0] !== hover[0] || c[1] !== hover[1]) { hover = c; paint(); }
      }
    }
    function onUp(e) {
      if (drag) {
        if (e && e.pointerId !== drag.id) return;
        const d = drag;
        drag = null;
        // 다른 칸으로 옮기지 않았으면 그냥 누른 것(탭): 선택하거나 선택 풀기
        if (d.target[0] === d.from[0] && d.target[1] === d.from[1]) { sel = d.prevSel; msg = ''; tap(d.c[0], d.c[1]); return; }
        const p = P[d.i];
        if (fitsAt(d.i, p.cells, d.target[0], d.target[1])) { p.pos = d.target; msg = ''; check(); }
        else msg = '그 자리에는 옮길 수 없어요. 다른 조각과 겹치거나 판 밖으로 나가요.';
        draw();
        return;
      }
      if (press) {
        if (e && e.pointerId !== press.id) return;
        clearTimeout(press.timer);
        const pr = press;
        press = null;
        if (!pr.moved) tap(pr.c[0], pr.c[1]);
      }
    }
    function onCancel(e) {
      if (press && (!e || e.pointerId === press.id)) { clearTimeout(press.timer); press = null; }
      if (drag && (!e || e.pointerId === drag.id)) { drag = null; draw(); }
    }

    function draw() {
      App.clear(el);
      const occ = occupancy(-1);
      cellEls = [];
      const board = h('div', { class: 'sym-board' + (solved ? ' solved' : ''), style: { '--bw': BW, '--bh': BH } });
      boardEl = board;
      for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
        const i = occ.get(key(x, y));
        const cell = h('button', { class: 'sym-cell' + (i != null && i === sel ? ' selp' : ''), type: 'button', 'data-i': String(y * BW + x), 'aria-label': (y + 1) + '행 ' + (x + 1) + '열' + (i != null ? ' 조각 ' + (i + 1) : ''), style: i != null ? { background: `var(--p${i})` } : null });
        // 키보드(Enter)로 누른 경우만 처리, 손가락·마우스는 판 전체에서 처리
        cell.addEventListener('click', (e) => { if (e.detail === 0) tap(x, y); });
        cellEls.push(cell);
        board.append(cell);
      }
      board.addEventListener('pointerdown', onDown);
      board.addEventListener('pointermove', onMove);
      board.addEventListener('pointerup', onUp);
      board.addEventListener('pointercancel', onCancel);
      board.addEventListener('contextmenu', (e) => e.preventDefault());
      board.addEventListener('mouseleave', () => { if (!drag) { hover = null; paint(); } });
      const tray = h('div', { class: 'sym-tray' });
      P.forEach((p, i) => {
        if (p.pos) return;
        tray.append(h('button', { class: 'sym-piece' + (sel === i ? ' on' : ''), type: 'button', 'aria-label': '조각 ' + (i + 1), onclick: () => { sel = sel === i ? null : i; hover = null; msg = ''; draw(); } }, mini(p.cells, `var(--p${i})`, sel === i ? 20 : 16)));
      });
      const selPlaced = sel != null && P[sel].pos;
      const ctl = h('div', { class: 'row wrap center' },
        h('button', { class: 'btn', disabled: sel == null || solved, onclick: () => turn(rot) }, '↻ 돌리기'),
        pz.flip ? h('button', { class: 'btn', disabled: sel == null || solved, onclick: () => turn(flip) }, '⇋ 뒤집기') : null,
        h('button', { class: 'btn ghost', disabled: !selPlaced || solved, onclick: () => { P[sel].pos = null; msg = ''; draw(); } }, '판에서 빼기'),
        h('button', { class: 'btn ghost', disabled: solved || P.every((p) => !p.pos), onclick: () => { P.forEach((p) => { p.pos = null; }); sel = null; msg = ''; draw(); } }, '모두 내리기'));
      const hint = sel == null ? '아래 조각을 고르거나, 판 위 조각을 눌러 선택하세요. 판 위 조각은 누른 채 끌어서 옮길 수도 있어요.'
        : selPlaced ? '선택한 조각: ↻ 돌리기로 회전, 빈칸을 누르면 그 자리로 이동, 누른 채 끌어서 옮기기도 돼요.'
          : '판의 빈칸을 누르면 조각의 맨 위 왼쪽 칸이 그 자리에 놓여요.';
      el.append(...[
        h('p', { class: 'hint' }, hint),
        h('div', { class: 'sym-scroll' }, board),
        tray.childNodes.length ? tray : null,
        ctl,
        h('p', { class: 'status' + (solved ? ' strong' : ''), 'aria-live': 'polite' }, msg || ' ')].filter(Boolean));
      paint();
    }
    // 미리 보기: 판 밖 조각을 놓을 자리(마우스) 또는 끌고 있는 조각의 새 자리
    function paint() {
      const ghost = new Map();
      const lifting = new Set();
      if (drag) {
        const p = P[drag.i];
        const ok = fitsAt(drag.i, p.cells, drag.target[0], drag.target[1]);
        for (const [x, y] of p.cells) { ghost.set(key(x + drag.target[0], y + drag.target[1]), ok ? 'ok' : 'bad'); lifting.add(key(x + p.pos[0], y + p.pos[1])); }
      } else if (sel != null && hover && !P[sel].pos) {
        const p = P[sel];
        const [fx, fy] = p.cells[0];
        const ok = fitsAt(sel, p.cells, hover[0] - fx, hover[1] - fy);
        for (const [x, y] of p.cells) ghost.set(key(x + hover[0] - fx, y + hover[1] - fy), ok ? 'ok' : 'bad');
      }
      cellEls.forEach((c, i) => {
        const k2 = key(i % BW, Math.floor(i / BW));
        const g = ghost.get(k2);
        c.classList.toggle('ghost-ok', g === 'ok');
        c.classList.toggle('ghost-bad', g === 'bad');
        c.classList.toggle('lifting', lifting.has(k2));
      });
    }
    draw();
    return { el, reveal() { /* 해설에서 정답 모양을 보여줌 */ } };
  }

  function prompt(pz) {
    return h('div', { class: 'q-prompt' }, h('span', null, '조각 ' + pz.k + '개를 ' + (pz.flip ? '돌리거나 뒤집어' : '돌려서만') + ' 붙여 '), h('strong', { class: 'q-mid' }, '선대칭 도형'), h('span', null, '을 만드세요'));
  }

  function explain(pz) {
    const all = [];
    pz.sol.forEach((p, i) => p.forEach(([x, y]) => all.push([x, y, i])));
    const n = norm(all.map(([x, y]) => [x, y]));
    const mx = Math.min(...all.map((c) => c[0])), my = Math.min(...all.map((c) => c[1]));
    const w = Math.max(...n.map((c) => c[0])) + 1, hh = Math.max(...n.map((c) => c[1])) + 1;
    const g = h('div', { class: 'sym-mini sol', style: { '--w': w, '--h': hh, '--cs': '22px' } });
    for (const [x, y, i] of all) g.append(h('span', { style: { gridColumn: String(x - mx + 1), gridRow: String(y - my + 1), background: `var(--p${i})` } }));
    return h('div', { class: 'sym-explain' }, h('p', null, '출제할 때 만든 모양 하나예요. 세로축으로 접으면 겹쳐요. 다른 모양으로 만들어도 선대칭이면 정답이에요.'), g);
  }

  App.quick.register({
    id: 'sym',
    name: '대칭 퍼즐',
    kicker: '스피드 퍼즐',
    blurb: '조각 몇 개를 돌려 붙여서 접으면 딱 겹치는 선대칭 도형 하나를 만듭니다. 조각 모양이 매번 달라요.',
    kind: 'task',
    defaultOpts: { pieces: 3, size: 'S', flip: 0 },
    randomOpts: () => ({ pieces: App.rng.pick([3, 3, 4]), size: App.rng.pick(['S', 'M']), flip: App.rng.chance(0.3) ? 1 : 0 }),
    optionsUI(bar, o, set, disabled) {
      bar.append(
        h('div', { class: 'seg small' }, [3, 4].map((n) => h('button', { class: 'seg-btn' + (o.pieces === n ? ' on' : ''), disabled, onclick: () => set('pieces', n) }, '조각 ' + n + '개'))),
        h('div', { class: 'seg small' }, [['S', '작게'], ['M', '크게']].map(([v, l]) => h('button', { class: 'seg-btn' + (o.size === v ? ' on' : ''), disabled, onclick: () => set('size', v) }, l))),
        h('div', { class: 'seg small' }, [[0, '돌리기만'], [1, '뒤집기 허용']].map(([v, l]) => h('button', { class: 'seg-btn' + ((o.flip ? 1 : 0) === v ? ' on' : ''), disabled, onclick: () => set('flip', v) }, l))));
    },
    gen, mount, prompt, explain,
    check: () => true,
    answer: () => 0,
    botTime: (pz) => 30 + pz.k * 14 + (pz.flip ? -10 : 0),
    rules: `
<p>주어진 조각들을 모두 써서, <b>한 줄을 기준으로 접으면 딱 겹치는 도형(선대칭 도형)</b> 하나를 만드는 게임입니다.</p>
<div class="demo" data-demo="rules-sym"></div>
<ul>
<li>조각은 돌릴 수 있습니다. 기본 규칙에서는 <b>뒤집을 수 없습니다</b>. “뒤집기 허용” 변형에서만 뒤집을 수 있어요.</li>
<li>조각끼리 겹칠 수 없고, 모든 조각이 변으로 이어져 한 덩어리가 되어야 합니다.</li>
<li>대칭축은 세로, 가로, 대각선 어느 방향이어도 됩니다. 안쪽에 구멍이 생겨도 대칭이면 괜찮습니다.</li>
<li>조각을 고른 뒤 판의 칸을 누르면 놓입니다. 판 위 조각을 누르면 선택되어 「↻ 돌리기」로 돌리거나 빈 칸을 눌러 옮길 수 있고, 누른 채 끌어서 옮길 수도 있어요. 「판에서 빼기」로 다시 내려놓을 수 있습니다.</li>
</ul>
<h4>혼자 연습</h4>
<p>5문제의 시간을 잽니다.</p>
<h4>오늘의 문제</h4>
<p>날마다 모든 사람에게 같은 5문제가 나옵니다. 다 풀면 오늘 푼 사람 중 몇 위인지(상위 몇 %인지)와 평균 시간을 보여 줍니다. 하루에 첫 기록만 순위에 들어가고, 날짜가 바뀌면 새 문제가 나옵니다.</p>
<h4>온라인 대결</h4>
<p>방을 만들 때 방식을 고릅니다. 친구는 같은 게임의 「참가하기」에 방 코드 4자리를 넣으면 들어옵니다. 빈자리는 컴퓨터로 채울 수 있어요.</p>
<ul>
<li><b>빨리 맞히기</b>: 모두 같은 조각을 받고, 가장 먼저 완성한 사람이 1점을 얻습니다. 정한 라운드가 끝나면 점수가 가장 높은 사람이 이깁니다. <b>팀전</b>으로 하면 같은 팀 누가 맞혀도 팀 점수가 됩니다.</li>
<li><b>기록 대결</b>: 같은 문제 묶음을 5초 카운트다운 뒤 다 같이 시작해서 각자 끝까지 풉니다. 맞힌 문제가 많은 순, 같으면 총 시간이 짧은 순으로 순위를 정합니다. 푸는 동안 다른 사람이 몇 번 문제를 풀고 있는지 보이고, 나중에 같은 방 코드로 들어온 사람도 같은 문제를 풀고 순위에 합쳐집니다.</li>
</ul>`,
    guide: `
<h4>1. 칸 수부터 세기</h4>
<p>모든 조각의 칸 수를 더하세요. 세로축 대칭이라면 축 위에 걸치는 칸을 빼고 나머지는 좌우로 짝을 이뤄야 합니다. 전체 칸 수가 홀수라면 축 위에 놓이는 칸(한가운데 줄)이 반드시 있어야 합니다.</p>
<h4>2. 거울 짝 찾기</h4>
<p>뒤집을 수 없으니, 대칭의 왼쪽과 오른쪽은 서로 다른 조각이 맡거나 한 조각이 축 위에 걸쳐 스스로 대칭을 이뤄야 합니다. L자처럼 비대칭인 조각이 두 개 있다면 그 둘이 서로의 거울상인지(돌려 보면 좌우가 반대인 모양인지) 먼저 확인하세요.</p>
<h4>3. 스스로 대칭인 조각은 가운데로</h4>
<p>T자, 一자, 정사각형처럼 혼자서도 대칭인 조각은 축 위에 세우기 좋습니다. 가운데에 그런 조각을 놓고 양쪽에 짝이 되는 조각을 붙이는 것이 가장 흔한 완성 형태입니다.</p>
<div class="demo" data-demo="sym"></div>
<h4>4. 축 방향을 바꿔 생각하기</h4>
<p>세로축으로 안 될 때는 가로축이나 대각선 축을 생각해 보세요. 조각을 90도 돌리는 것은 축을 90도 돌리는 것과 같습니다. 대각선 대칭은 가로·세로 길이가 같은 모양에서만 가능합니다.</p>
<h4>5. 빈칸도 대칭이어야 한다</h4>
<p>구멍이 생겨도 되지만, 구멍도 축을 기준으로 대칭이어야 합니다. 한쪽에만 움푹 들어간 곳이 있다면 그 반대편 같은 자리도 비워야 합니다.</p>`,
  });

  App.sym = { gen, symmetryAxis, connected, rot, flip, norm, canTileRect };
})();
