/* 규칙 탭의 움직이는 그림 설명: 게임마다 기본 규칙을 장면으로 보여 줌 */
(function () {
  const App = globalThis.App;
  const { h } = App;
  const { player, cell, grid, add, reduced } = App.demos;
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

  // ---------- 네모 세기 ----------
  add('rules-nemo', (root) => {
    const R = 3, C = 4, T = 5;
    // null = 칸이 없는 곳(구멍), 0 = 숫자 없는 칸
    const B = [2, 3, 0, 3, 4, 1, 2, null, 0, 5, 1, 3];
    let total = 0;
    for (let r1 = 0; r1 < R; r1++) for (let c1 = 0; c1 < C; c1++) for (let r2 = r1; r2 < R; r2++) for (let c2 = c1; c2 < C; c2++) {
      let s = 0, hole = false;
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) { const v = B[r * C + c]; if (v === null) hole = true; else s += v; }
      if (!hole && s === T) total++;
    }
    const steps = [
      { cap: '목표 합은 5예요. 안의 수를 모두 더하면 5가 되는 직사각형(네모)이 몇 개인지 맞혀요.', ms: 3200 },
      { rect: [0, 0, 0, 1], ok: true, sum: '2 + 3 = 5', cap: '가로 2칸: 2 + 3 = 5 → 하나 찾았어요 ✓' },
      { rect: [2, 1, 2, 1], ok: true, sum: '5', cap: '1칸짜리도 네모예요. 5 하나로 5 ✓' },
      { rect: [1, 0, 1, 1], ok: true, sum: '4 + 1 = 5', cap: '4 + 1 = 5 ✓ (정사각형이든 길쭉하든 직사각형이면 돼요)' },
      { rect: [2, 0, 2, 1], ok: true, sum: '0 + 5 = 5', cap: '숫자가 없는 칸은 0으로 세요. 0 + 5 = 5 ✓', ms: 2800 },
      { rect: [0, 2, 1, 3], bad: true, sum: '합 5지만 ✗', cap: '칸이 없는 곳(빗금)을 지나는 네모는 합이 5여도 셀 수 없어요 ✗', ms: 3400 },
      { cap: '이렇게 빠짐없이 세면 이 판의 정답은 ' + total + '개예요. 숫자로 답을 입력해요.', ms: 3400 },
    ];
    player(root, '어떤 네모를 셀까?', steps, (stage, s) => {
      const g = h('div', { class: 'nm-grid demo-nm', style: { '--rows': R, '--cols': C } });
      B.forEach((v, i) => {
        const pos = { gridRow: String(Math.floor(i / C) + 1), gridColumn: String(i % C + 1) };
        g.append(v === null ? h('div', { class: 'dm-hole', style: pos }) : h('div', { class: 'nm-cell' + (v === 0 ? ' blank' : ''), style: pos }, v ? String(v) : ''));
      });
      if (s.rect) {
        const [r1, c1, r2, c2] = s.rect;
        g.append(h('div', { class: 'nm-hl' + (s.ok ? ' ok' : s.bad ? ' over' : ''), style: { gridRow: (r1 + 1) + ' / ' + (r2 + 2), gridColumn: (c1 + 1) + ' / ' + (c2 + 2) } }));
      }
      stage.append(h('div', { class: 'demo-col' }, g, h('div', { class: 'demo-big' + (s.ok ? ' ok' : s.bad ? ' over' : '') }, s.sum || '목표 ' + T)));
    });
  });

  // ---------- 큐브 세기 ----------
  add('rules-cubes', (root) => {
    const pz = { nx: 3, ny: 2, H: 3, hm: [3, 1, 2, 2, 1, 1] };
    const total = pz.hm.reduce((a, b) => a + b, 0);
    const canvas = h('canvas', { class: 'cube-canvas demo-cube', role: 'img', 'aria-label': '천천히 도는 큐브 쌓기' });
    const view = App.cubes.makeView(pz, canvas);
    let theta = Math.PI * 0.25 + 0.35, last = 0, gone = 0;
    (function frame(t) {
      if (!canvas.isConnected) { if (++gone > 900) return; }
      else { gone = 0; if (last && !reduced()) theta += (t - last) * (2 * Math.PI / 24000); view.render(theta); }
      last = t;
      requestAnimationFrame(frame);
    })(0);
    const wrap = h('div', { class: 'demo-cube-wrap' }, canvas);
    // 앞에서 본 기둥 그림: cols = [[높이, 강조], ...], float = 공중에 뜬 예
    const stacks = (cols, o) => h('div', { class: 'dm-stacks' + (o && o.bad ? ' bad' : '') }, cols.map(([n, hl, gap]) => {
      const col = h('div', { class: 'dm-stack' });
      for (let z = 0; z < 3; z++) col.append(h('span', { class: 'dm-cube' + (z < n ? (gap && z === 0 ? ' gap' : ' on' + (hl ? ' hl' : '')) : ' off') }));
      return col;
    }), o && o.bad ? h('span', { class: 'dm-x' }, '✗') : null);
    const steps = [
      { show: 'cube', cap: '바닥 격자 위에 쌓인 큐브가 모두 몇 개인지 맞혀요. 그림은 천천히 돌아가요.', ms: 3200 },
      { show: 'stack', cols: [[3, true], [1], [2]], cap: '공중에 뜬 큐브는 없어요. 그래서 윗면이 보이는 기둥은 바닥까지 꽉 차 있어요.', ms: 3400 },
      { show: 'stack', cols: [[2, false, true], [1], [3]], bad: true, cap: '이렇게 아래가 빈 큐브는 나오지 않아요.' },
      { show: 'grid', k: 6, cap: '뒤에 가려서 안 보이는 큐브도 모두 세요. 기둥 높이를 더하면 3+1+2+2+1+1 = ' + total + '개!', ms: 3600 },
      { show: 'fill', cap: '‘빈 곳 세기’ 문제: 3×2 바닥에 3층 상자를 꽉 채우려면 ' + (pz.nx * pz.ny * pz.H) + ' − ' + total + ' = ' + (pz.nx * pz.ny * pz.H - total) + '개가 더 필요해요.', ms: 4000 },
    ];
    player(root, '큐브 세기 규칙', steps, (stage, s) => {
      stage.append(wrap);
      if (s.show === 'stack') stage.append(h('div', { class: 'demo-col' }, stacks(s.cols, { bad: s.bad }), h('div', { class: 'note' }, '앞에서 본 모습')));
      if (s.show === 'grid' || s.show === 'fill') {
        stage.append(h('div', { class: 'demo-col' }, grid(3, pz.hm.map((v) => cell(s.show === 'fill' ? 3 - v : v, s.show === 'fill' ? 'hl' : '')), 38),
          h('div', { class: 'demo-big' }, s.show === 'fill' ? '빈 곳 ' + (pz.nx * pz.ny * pz.H - total) : '합 ' + total)));
      }
    });
  });

  // ---------- 대칭 퍼즐 ----------
  add('rules-sym', (root) => {
    const col = { A: 'var(--p0)', B: 'var(--p1)', C: 'var(--p2)' };
    // L자 4칸 조각(빨강)과 그 거울 모양(파랑): 거울 모양은 돌려서는 만들 수 없음
    const P = { A: [[0, 0], [1, 0], [2, 0], [2, 1]], B: [[0, 1], [1, 1], [2, 1], [2, 0]], C: [[0, 0], [0, 1]] };
    const rotA = [[0, 0], [0, 1], [0, 2], [1, 0]];
    const mirA = P.B;
    const mini = (cells, color, o) => {
      const w = Math.max(...cells.map((c) => c[1])) + 1, hh = Math.max(...cells.map((c) => c[0])) + 1;
      const set = new Set(cells.map(([r, c]) => r * w + c));
      const g = h('div', { class: 'dm-grid', style: { gridTemplateColumns: `repeat(${w}, 22px)`, gridAutoRows: '22px' } });
      for (let i = 0; i < w * hh; i++) g.append(h('div', { class: 'dm-cell sym' + (set.has(i) ? ' on' : ''), style: set.has(i) ? { background: color } : { visibility: 'hidden' } }));
      return h('div', { class: 'demo-col sym-mini-demo' + (o && o.bad ? ' bad' : '') }, g, o && o.label ? h('span', { class: 'note' }, o.label) : null);
    };
    const W = 4, H = 4;
    const fin = { A: [[0, 0], [1, 0], [2, 0], [2, 1]], B: [[0, 3], [1, 3], [2, 3], [2, 2]], C: [[3, 1], [3, 2]] };
    const board = (o) => {
      const g = h('div', { class: 'dm-grid demo-sym', style: { gridTemplateColumns: `repeat(${W}, 30px)`, gridAutoRows: '30px' } });
      const at = {};
      if (o.put) for (const p of ['A', 'B', 'C']) for (const [r, c] of fin[p]) at[r * W + c] = p;
      for (let i = 0; i < W * H; i++) g.append(h('div', { class: 'dm-cell sym' + (at[i] ? ' on' : ''), style: at[i] ? { background: col[at[i]] } : null }));
      if (o.axis) g.append(h('div', { class: 'demo-axis', style: { left: (2 * 32 - 2) + 'px' } }));
      return g;
    };
    const diag = () => {
      const cells = new Set([0, 1, 2, 3, 6]);
      const g = h('div', { class: 'dm-grid demo-sym', style: { gridTemplateColumns: 'repeat(3, 30px)', gridAutoRows: '30px' } });
      for (let i = 0; i < 9; i++) g.append(h('div', { class: 'dm-cell sym' + (cells.has(i) ? ' on' : ''), style: cells.has(i) ? { background: 'var(--p3)' } : null }));
      const sv = svgEl('svg', { class: 'demo-diag', viewBox: '0 0 94 94' });
      sv.append(svgEl('line', { x1: '0', y1: '0', x2: '94', y2: '94', stroke: 'var(--accent)', 'stroke-width': '2.5', 'stroke-dasharray': '6 4' }));
      g.append(sv);
      return g;
    };
    const steps = [
      { v: 'tray', cap: '주어진 조각(빨강 L, 파랑 거울 L, 초록 막대)을 모두 써서, 한 줄로 접으면 딱 겹치는 모양(선대칭) 하나를 만들어요.', ms: 3200 },
      { v: 'rot', cap: '조각은 돌릴 수 있어요. ↻ 돌리기 OK!' },
      { v: 'flip', cap: '뒤집기(거울에 비추기)는 안 돼요. ‘뒤집기 허용’ 변형에서만 돼요. 그래서 거울 모양 조각이 따로 주어져요.', ms: 3800 },
      { v: 'board', put: true, cap: '조각끼리 겹치지 않고, 변으로 이어져 한 덩어리가 되게 놓아요.' },
      { v: 'board', put: true, axis: true, cap: '가운데 선으로 접으면 딱 겹쳐요 → 완성! ✓', ms: 3000 },
      { v: 'diag', cap: '접는 선은 세로·가로·대각선 어느 방향이든 괜찮아요. 안쪽에 구멍이 있어도 대칭이면 돼요.', ms: 3600 },
    ];
    player(root, '대칭 퍼즐 규칙', steps, (stage, s) => {
      if (s.v === 'tray') stage.append(h('div', { class: 'demo-tray' }, mini(P.A, col.A), mini(P.B, col.B), mini(P.C, col.C)));
      if (s.v === 'rot') stage.append(h('div', { class: 'demo-tray' }, mini(P.A, col.A, { label: '원래' }), h('span', { class: 'demo-arrow' }, '↻'), mini(rotA, col.A, { label: '돌린 모양 ✓' })));
      if (s.v === 'flip') stage.append(h('div', { class: 'demo-tray' }, mini(P.A, col.A, { label: '원래' }), h('span', { class: 'demo-arrow' }, '⇋'), mini(mirA, col.A, { label: '뒤집은 모양 ✗', bad: true })));
      if (s.v === 'board') stage.append(board(s));
      if (s.v === 'diag') stage.append(diag());
    });
  });

  // ---------- 7×7 마방진 ----------
  add('rules-magic', (root) => {
    const M = [2, 7, 6, 9, 5, 1, 4, 3, 8];
    const order = [[4], [0, 1, 2], [3, 5], [6, 7, 8]];
    const steps = [{ shown: [], cap: '숫자를 한 번씩 넣어서 가로·세로·두 대각선의 합을 모두 같게 만드는 퍼즐이에요. 3×3이면 1~9를 써요.', ms: 3400 }];
    let shown = [];
    const caps = ['가운데에 5', '윗줄 2 · 7 · 6 → 합 15', '9와 1 → 가운데 줄도 15', '마지막 줄 4 · 3 · 8 → 모든 줄이 15!'];
    order.forEach((add, i) => { shown = shown.concat(add); steps.push({ shown: shown.slice(), cap: caps[i] }); });
    steps.push({ shown, diag: true, cap: '대각선도 2+5+8 = 6+5+4 = 15. 합은 크기로 정해져요: 3×3은 15, 7×7은 175.', ms: 3800 });
    steps.push({ shown, cap: '변형에서는 시작 숫자가 바뀌어요. 예: 5부터 시작하는 5×5는 5~29를 쓰고 합은 85예요.', ms: 3600 });
    player(root, '마방진 규칙 (3×3 예시)', steps, (stage, s) => {
      const has = new Set(s.shown);
      const v = (k) => (has.has(k) ? M[k] : null);
      const line = (ks) => { const vals = ks.map(v); const full = vals.every((x) => x != null); const sum = vals.reduce((a, b) => a + (b || 0), 0); return { sum, full }; };
      const sumCell = (r, extra) => cell(r.sum || '', 'msum' + (r.full && r.sum === 15 ? ' ok' : '') + (extra || ''));
      const cells = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) { const k = r * 3 + c; cells.push(cell(v(k) == null ? '' : v(k), (s.diag && (r === c || r + c === 2) ? 'hl' : ''))); }
        cells.push(sumCell(line([r * 3, r * 3 + 1, r * 3 + 2])));
      }
      for (let c = 0; c < 3; c++) cells.push(sumCell(line([c, c + 3, c + 6])));
      const d1 = line([0, 4, 8]), d2 = line([2, 4, 6]);
      cells.push(cell(d1.full && d2.full ? '↘' + d1.sum : '', 'msum' + (d1.full && d1.sum === 15 && d2.sum === 15 ? ' ok' : '')));
      stage.append(grid(4, cells, 40));
    });
  });

  // ---------- 수식 신호등 ----------
  add('rules-signal', (root) => {
    const ans = '12+5=17';
    const G = ['15+2=17', '1111111', '12+5=17'];
    const F = G.map((g) => App.signal.grade(g, ans));
    const steps = [
      { rows: 0, hide: true, cap: '숨은 등식 하나를 정해진 횟수 안에 맞혀요. 한 칸에 숫자 하나나 기호(+ − × ÷ ^ =) 하나가 들어가요.', ms: 3600 },
      { rows: 1, color: 0, cap: '한 줄을 내면…' },
      { rows: 1, color: 1, cap: '초록 = 그 자리에 정확히 있음 · 노랑 = 다른 자리에 있음 · 빨강 = 정답에 없는 문자', ms: 3800 },
      { rows: 2, color: 2, cap: '내는 줄은 등식이 아니어도 돼요. 1을 일곱 번 내 보면 정답의 1 두 개 자리만 초록, 정답보다 많이 낸 나머지는 모두 빨강!', ms: 4200 },
      { rows: 3, color: 3, cap: '모든 칸이 초록이면 성공! 7칸은 6번, 8칸은 7번, 9~10칸은 8번 안에 맞혀야 해요.', ms: 3600 },
    ];
    player(root, '신호 색 규칙', steps, (stage, s) => {
      const board = h('div', { class: 'sq-board demo-sq', style: { '--len': 7 } });
      board.append(h('div', { class: 'sq-row' }, [...ans].map(() => h('span', { class: 'sq filled demo-hidden' }, '?'))));
      for (let r = 0; r < 3; r++) {
        const row = h('div', { class: 'sq-row' });
        for (let k = 0; k < 7; k++) {
          const ch = r < s.rows ? G[r][k] : '';
          const f = r < (s.color || 0) ? F[r][k] : '';
          row.append(h('span', { class: 'sq' + (f ? ' f-' + f : '') + (ch && !f ? ' filled' : '') }, ch ? App.eq.show(ch) : ''));
        }
        board.append(row);
      }
      stage.append(board);
    });
  });

  // ---------- 수식의 탑 ----------
  add('rules-tower', (root) => {
    const T = { a: { d: 3, o: '*' }, b: { d: 2, o: '+' }, c: { d: 4, o: '-' }, e: { d: 5, o: '*' }, f: { d: 1, o: '+' }, g: { d: 6, o: '-' } };
    const tile = (id, face, sel) => {
      const t = T[id];
      const up = face ? App.eq.show(t.o) : String(t.d), back = face ? String(t.d) : App.eq.show(t.o);
      return h('div', { class: 'tile ' + (face ? 'op' : 'num') + (sel ? ' sel' : '') }, h('span', { class: 'face' }, up), h('span', { class: 'back' }, back));
    };
    const col = (list, name, selN, hit, mark) => {
      const st = h('div', { class: 'tw-stack' });
      list.forEach(([id, f], i) => st.append(tile(id, f, i < selN)));
      let read = '';
      try {
        if (list.length % 2 === 1) {
          const v = App.eq.evalExpr(list.map(([id, f]) => (f ? T[id].o : String(T[id].d))).join(''));
          read = list.map(([id, f]) => (f ? App.eq.show(T[id].o) : String(T[id].d))).join(' ') + ' = ' + App.eq.fracStr(v);
        }
      } catch (e) { read = ''; }
      return h('div', { class: 'tw-col demo-tw' }, h('div', { class: 'tw-label' }, name), st, h('div', { class: 'tw-base' }),
        h('div', { class: 'tw-read' + (hit ? ' hit' : '') + (mark === 'bad' ? ' miss' : '') }, (read || '식이 아님') + (mark === 'ok' ? ' ✓' : mark === 'bad' ? ' ✗' : '')));
    };
    const L0 = [['a', 0], ['b', 1], ['c', 0]], M0 = [['e', 0]], R0 = [['f', 1], ['g', 0]];
    const steps = [
      { L: L0, M: M0, R: R0, cap: '블록마다 한 면엔 숫자, 다른 면엔 기호가 있어요. 큰 글씨가 보이는 면, 오른쪽 위 작은 글씨가 뒷면이에요.', ms: 3800 },
      { L: L0, M: M0, R: R0, hitL: true, cap: '탑은 위에서 아래로 읽어요. 왼쪽 탑 = 3 + 4 = 7. 곱셈은 먼저 계산해요.' },
      { L: L0, M: M0, R: R0, goal: true, cap: '이번 목표: 높이 3짜리 탑 하나를 값 10으로 만들기. 시작 전에 몇 번 만에 만들지 선언해요.', ms: 3400 },
      { L: L0, M: M0, R: R0, sel: 2, goal: true, cap: '한 번의 이동: 한 탑의 맨 위에서 원하는 개수만큼 집어요. (왼쪽 위 2개)' },
      { L: [['c', 0]], M: [['a', 0], ['b', 1], ['e', 0]], R: R0, goal: true, markM: 'bad', cap: '그대로 가운데 탑에 올리면 3 + 5 = 8. 아쉽게도 10이 아니에요.', ms: 3000 },
      { L: [['c', 0]], M: [['b', 0], ['a', 1], ['e', 0]], R: R0, goal: true, markM: 'ok', cap: '통째로 뒤집어 올리면 순서가 거꾸로, 면도 모두 반대로! 2 × 5 = 10 → 1번 만에 성공!', ms: 4200 },
      { L: [['c', 0]], M: [['b', 0], ['a', 1], ['e', 0]], R: R0, cap: '선언한 횟수 안에 만들면 +1점, 가장 짧은 수와 똑같이 선언해 성공하면 +2점, 실패하면 −1점.', ms: 3800 },
    ];
    player(root, '수식의 탑 규칙', steps, (stage, s) => {
      if (s.goal) stage.append(h('div', { class: 'demo-goal' }, '목표 ', h('b', null, '10'), ' · 높이 ', h('b', null, '3')));
      stage.append(h('div', { class: 'demo-towers three' }, col(s.L, '왼쪽', s.sel || 0, s.hitL), col(s.M, '가운데', 0, s.markM === 'ok', s.markM), col(s.R, '오른쪽', 0)));
    });
  });

  // ---------- 무거운 13 ----------
  add('rules-heavy', (root) => {
    const CH = { r: ['빨강', 'var(--ped-red)'], g: ['초록', 'var(--ped-green)'], b: ['파랑', 'var(--ped-blue)'], w: ['무지개', 'linear-gradient(135deg,#ef5350,#ffca28,#66bb6a,#42a5f5,#ab47bc)'] };
    const chip = (c) => h('span', { class: 'demo-chip', style: { background: CH[c][1] }, title: CH[c][0] });
    const ped = (name, cls, rocks, add, pen) => {
      const sum = rocks.reduce((a, b) => a + b, 0) + (add || 0);
      return h('div', { class: 'ped ' + cls + ' demo-ped' },
        h('div', { class: 'ped-top' }, h('span', { class: 'ped-name' }, name), h('span', { class: 'ped-sum' + (sum >= 13 ? ' hot' : '') }, sum + ' / 13')),
        h('div', { class: 'rocks' }, rocks.map((v) => h('span', { class: 'rock' }, String(v))), add != null ? h('span', { class: 'rock incoming' }, String(add)) : null),
        h('div', { class: 'ped-foot' }, pen ? h('b', { class: 'demo-pen' }, '벌점 +' + pen) : '바위 ' + rocks.length + '개'));
    };
    const picks = (open, order) => h('div', { class: 'demo-picks' }, [['나', 4, 'r'], ['A', 5, 'b'], ['B', 2, 'w']].map(([n, v, c], i) => h('div', { class: 'demo-pick' },
      h('b', null, n), open ? h('span', { class: 'rock' }, String(v)) : h('span', { class: 'demo-card' }, '?'), open ? chip(c) : h('span', { class: 'demo-chip back' }),
      order ? h('span', { class: 'chip-tag' }, ['3번째', '2번째', '1번째'][i]) : null)));
    const base = { r: [5, 4], g: [3, 1], b: [6, 5] };
    const steps = [
      { v: 'peds', P: base, cap: '빨강·초록·파랑 받침대에 바위를 올려요. 각자 바위 카드 0~6 일곱 장과 색 칩 일곱 개로 시작해요.', ms: 3600 },
      { v: 'pick', open: false, P: base, cap: '매 라운드 모두 바위 카드 1장과 칩 1개를 몰래 골라요.' },
      { v: 'pick', open: true, order: true, P: base, cap: '한꺼번에 공개! 무지개 칩이 가장 먼저, 그다음 숫자가 큰 순서로 놓아요.', ms: 3600 },
      { v: 'peds', P: base, addG: 2, cap: 'B: 무지개 칩은 받침대를 골라요 → 초록에 2' },
      { v: 'peds', P: { r: base.r, g: [3, 1, 2], b: base.b }, addB: 5, cap: 'A: 파랑 칩 → 파랑에 5. 6 + 5 + 5 = 16, 13 이상이 됐어요!' },
      { v: 'peds', P: { r: base.r, g: [3, 1, 2], b: [5] }, penB: 2, cap: '원래 있던 바위 2개를 치우고 A는 벌점 +2. 방금 놓은 5는 남아요.', ms: 3400 },
      { v: 'peds', P: { r: base.r, g: [3, 1, 2], b: [5] }, addR: 4, cap: '나: 빨강에 4 → 5 + 4 + 4 = 13! 나도 바위 2개만큼 벌점 +2.', ms: 3200 },
      { v: 'end', cap: '14라운드가 끝나면 벌점이 가장 많은 사람이 꼴찌예요. 마지막으로 벌점을 받은 사람이 다음 라운드의 선이 돼요.', ms: 3800 },
    ];
    player(root, '무거운 13 규칙', steps, (stage, s) => {
      if (s.v === 'pick') stage.append(picks(s.open, s.order));
      if (s.v === 'peds') stage.append(h('div', { class: 'peds demo-peds3' }, ped('빨강', 'red', s.P.r, s.addR, null), ped('초록', 'green', s.P.g, s.addG, null), ped('파랑', 'blue', s.P.b, s.addB, s.penB)));
      if (s.v === 'end') stage.append(h('div', { class: 'demo-col' }, h('div', { class: 'demo-big over' }, '벌점 최다 = 꼴찌'), h('div', { class: 'note' }, '벌점이 같으면 더 최근에 벌점을 받은 사람이 아래')));
    });
  });

  // ---------- 벽바둑 2 ----------
  add('rules-wall', (root) => {
    const N = 5;
    // 말: [행, 열, 자리(0 빨강·1 파랑·2 초록), 종류(S 사각·C 원형)]
    const P0 = [[1, 0, 0, 'S'], [3, 1, 0, 'C'], [0, 4, 1, 'S'], [2, 3, 1, 'C'], [4, 4, 2, 'S'], [4, 2, 2, 'C']];
    const mv = (list, from, to) => list.map((p) => (p[0] === from[0] && p[1] === from[1] ? [to[0], to[1], p[2], p[3]] : p));
    const P1 = mv(P0, [1, 0], [1, 2]);
    const P2 = mv(P1, [3, 1], [2, 1]);
    const P3 = mv(P2, [0, 4], [0, 2]);
    const END = [[1, 0, 0, 'S'], [3, 1, 0, 'C'], [0, 3, 1, 'S'], [2, 4, 1, 'C'], [4, 4, 2, 'S'], [3, 2, 2, 'C']];
    const endWalls = [0, 1, 2, 3, 4].map((r) => ['v', r, 1]).concat([2, 3, 4].map((c) => ['h', 2, c]));
    const R2 = [[1, 1, 1, 'C'], [3, 3, 1, 'C'], [1, 3, 2, 'C'], [3, 1, 2, 'C'], [2, 2, 1, 'S'], [0, 2, 2, 'S']];
    const steps = [
      { P: P0, W: [], cap: '1라운드(3인전): 각자 ■ 사각 말 1개와 ● 원형 말 1개를 받아 1→2→3→3→2→1 순서로 빈 칸에 놓아요. (실제 판은 7×7)', ms: 4000 },
      { P: P0, W: [], path: [[1, 1], [1, 2]], sel: [1, 0], cap: '■ 사각 말: 상하좌우 한 방향으로 곧게 1~2칸.', ms: 3000 },
      { P: P1, W: [['v', 1, 2]], cap: '움직인 뒤에는 그 말이 선 칸의 한 면에 벽을 꼭 세워요. 매 차례 반드시 움직여야 해요.', ms: 3400 },
      { P: P1, W: [['v', 1, 2]], path: [[2, 1]], sel: [3, 1], cap: '● 원형 말: 1칸 간 뒤, 원하면 왼쪽·오른쪽으로 꺾어 1칸 더 갈 수 있어요. (곧게 2칸은 안 돼요)', ms: 3600 },
      { P: P2, W: [['v', 1, 2], ['h', 1, 1], ['v', 0, 2]], path: [[0, 3], [0, 2]], sel: [0, 4], brk: [0, 2, 'R'], cap: '💥 벽 부수기: 1라운드에서 각자 딱 한 번, 가는 길을 막은 벽 하나를 부수고 지나갈 수 있어요.', ms: 4000 },
      { P: P3, W: [['v', 1, 2], ['h', 1, 1], ['v', 0, 1]], cap: '파랑 사각 말이 벽을 부수고 들어왔어요. 그리고 다시 벽을 하나 세워요.', ms: 3000 },
      { P: END, W: endWalls, terr: true, cap: '모두의 말이 벽으로 갈라지면 바로 끝! 내 말이 있는 영역의 칸 수가 점수: 빨강 10 · 파랑 9 · 초록 6 → 가장 넓은 빨강은 생존 확정!', ms: 4600 },
      { P: R2, W: [], cap: '2라운드는 남은 둘의 1:1. 각자 사각 2 · 원형 2 (원형은 정해진 자리), 벽 부수기 없음. 지는 사람은 탈락!', ms: 4200 },
    ];
    const terrOf = (r, c) => (c <= 1 ? 0 : r <= 2 ? 1 : 2);
    player(root, '벽바둑 2 규칙', steps, (stage, s) => {
      const b = h('div', { class: 'wl-board demo-wl', style: { '--n': N } });
      const hw = new Set(s.W.filter((w) => w[0] === 'h').map((w) => w[1] * N + w[2]));
      const vw = new Set(s.W.filter((w) => w[0] === 'v').map((w) => w[1] * N + w[2]));
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const k = r * N + c;
        const pc = s.P.find((p) => p[0] === r && p[1] === c);
        const onPath = s.path && s.path.some(([a, bb]) => a === r && bb === c);
        const cls = 'wl-cell' + (s.terr ? ' terr' + terrOf(r, c) : '') + (onPath ? ' demo-path' : '');
        b.append(h('div', { class: cls },
          pc ? h('span', { class: 'piece ' + (pc[3] === 'S' ? 'sq' : 'ci') + (s.sel && s.sel[0] === r && s.sel[1] === c ? ' sel' : ''), style: { background: `var(--p${pc[2]})` } }) : null,
          hw.has(k) ? h('span', { class: 'w-h' }) : null,
          vw.has(k) ? h('span', { class: 'w-v' }) : null,
          s.brk && s.brk[0] === r && s.brk[1] === c ? h('span', { class: 'w-brk w-brk-' + s.brk[2] }, '💥') : null));
      }
      stage.append(b);
    });
  });

  // ---------- 카드 장기 ----------
  add('rules-jang', (root) => {
    const ROWS = 6, COLS = 5;
    const base = () => {
      const m = {};
      m['5,2'] = ['me', '궁']; m['0,2'] = ['foe', '궁'];
      for (const c of [0, 1, 3, 4]) { m['4,' + c] = ['me', '졸']; m['1,' + c] = ['foe', '졸']; }
      return m;
    };
    const B0 = base();
    const B1 = Object.assign(base(), { '2,1': ['me', '졸'] }); delete B1['4,1'];
    const B2 = Object.assign({}, B1, { '2,1': ['foe', '졸'] }); delete B2['1,1'];
    const B3 = { '5,2': ['me', '궁'], '0,1': ['foe', '궁'], '0,2': ['me', '졸'], '2,4': ['foe', '졸'] };
    const cards = ['전진', '사선', '옆걸음', '돌진', '후퇴'];
    const steps = [
      { B: B0, cap: '5×6 판에서 각자 궁 1개와 졸 4개로 시작해요. 궁은 색칠된 궁성 밖으로 못 나가요.', ms: 3400 },
      { B: B0, cards: 'hidden', cap: '라운드마다 두 사람이 같은 이동 카드 5장을 받아, 쓸 순서를 몰래 정해요.', ms: 3400 },
      { B: B0, cards: 'open', first: 'me', cap: '1번 카드를 동시에 공개! 나는 ‘돌진’, 상대는 ‘전진’. 이번 카드는 내가 선(먼저)이에요.', ms: 3400 },
      { B: B1, cards: 'open', first: 'me', cap: '돌진: 앞으로 1~2칸. 내 졸이 두 칸 나아갔어요. (가운데 칸이 비어 있어야 해요)' },
      { B: B2, cards: 'open', first: 'me', cap: '상대는 전진: 내 졸이 있는 칸으로 들어오면 그 말을 잡아요! 다음 카드는 상대가 선이에요.', ms: 3600 },
      { B: B3, star: true, cap: '상대 궁을 잡거나, 내 졸이 상대 궁의 처음 자리(★)에 들어가면 바로 이겨요!', ms: 3600 },
      { B: B0, cap: '6라운드가 끝날 때까지 승부가 안 나면 남은 말이 많은 쪽이 이겨요.', ms: 3200 },
    ];
    player(root, '카드 장기 규칙', steps, (stage, s) => {
      const cells = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const pc = s.B[r + ',' + c];
        const palace = c >= 1 && c <= 3 && (r <= 1 || r >= 4);
        const star = r === 0 && c === 2;
        cells.push(h('div', { class: 'dm-cell jg' + (palace ? ' jg-pal' : '') + (s.star && star ? ' hl' : '') },
          pc ? h('span', { class: 'jg-piece demo-pc', style: { background: pc[0] === 'me' ? 'var(--p0)' : 'var(--p1)' } }, pc[1]) : star ? h('span', { class: 'demo-star' }, '★') : null));
      }
      const row = (name, first, c1) => h('div', { class: 'demo-cards' }, h('span', { class: 'demo-cname' }, name, first ? h('span', { class: 'chip-tag' }, '선') : null),
        [0, 1, 2, 3, 4].map((k) => h('span', { class: 'demo-card' + (k === 0 && s.cards === 'open' ? ' open' : '') }, k === 0 && s.cards === 'open' ? c1 : '?')));
      const parts = [grid(COLS, cells, 36)];
      if (s.cards) parts.push(h('div', { class: 'demo-col' }, row('나', s.first === 'me', '돌진'), row('상대', s.first === 'foe', '전진'), h('span', { class: 'note' }, '이번 라운드 카드: ' + cards.join(' · '))));
      stage.append(...parts);
    });
  });

  // ---------- 컬러 링크 ----------
  add('rules-link', (root) => {
    const N = 5, CL = { A: '#e6194b', B: '#4363d8', C: '#3cb44b', D: '#ffe119', X: '#161616' };
    const INK = { A: '#fff', B: '#fff', C: '#fff', D: '#141a2e', X: '#fff' };
    const p1 = { 0: 'A' }, p2 = Object.assign({}, p1, { 4: 'B', 24: 'A' }), p3 = Object.assign({}, p2, { 12: 'C', 7: 'D' }), p4 = Object.assign({}, p3, { 20: 'B', 2: 'C' });
    const steps = [
      { pcs: {}, cap: '라운드 첫 차례에는 선 플레이어가 말 1개만 놓아요. (실제 판은 7×7, A~N 14색 × 2개)', ms: 3400 },
      { pcs: p1, nw: [0], who: '나(선)', cap: '나: A를 하나 놓고…' },
      { pcs: p2, nw: [4, 24], who: '상대', cap: '그다음부터는 차례마다 서로 다른 색 말 2개! 상대: B와 A.', ms: 3200 },
      { pcs: p2, paths: [['A', [0, 5, 10, 15, 20, 21, 22, 23, 24]]], cap: '같은 색끼리는 겹치지 않는 길로 이어질 수 있어야 해요. 길은 말 칸을 포함해 6칸 이상!', ms: 3800 },
      { pcs: p3, nw: [12, 7], who: '나', cap: '나: C와 D. 아직 모두 이어질 수 있어요.' },
      { pcs: p4, nw: [20, 2], who: '상대', cap: '상대: B와 C. 그런데 A와 B가 엇갈려서 둘 다 이을 수 없어 보여요…', ms: 3600 },
      { pcs: p4, paths: [['A', [0, 5, 10, 15, 16, 21, 22, 23, 24]], ['B', [4, 9, 14, 19]]], x: 19, declare: true, cap: '내 차례 시작에 「불가능 선언!」 → 방금 놓은 상대가 5분 안에 모든 색을 이어 보여야 해요.', ms: 4200 },
      { pcs: p4, score: true, cap: '증명 실패 → 선언한 내가 승점 +1 (증명했다면 상대가 +1). 5라운드 중 먼저 3점이면 승리! 검은 X·흰 Y 말이 미리 놓인 판도 있어요.', ms: 4400 },
    ];
    player(root, '컬러 링크 규칙', steps, (stage, s) => {
      const wrap = h('div', { class: 'lk-board demo-lk', style: { '--n': N } });
      for (let i = 0; i < N * N; i++) {
        const p = s.pcs[i];
        wrap.append(h('div', { class: 'lk-cell' + (s.nw && s.nw.includes(i) ? ' last' : '') }, p ? h('span', { class: 'lk-piece', style: { background: CL[p], color: INK[p] } }, p) : null));
      }
      const svg = svgEl('svg', { viewBox: '0 0 ' + N + ' ' + N, class: 'lk-paths' });
      for (const [c, P] of s.paths || []) svg.append(svgEl('polyline', { points: P.map((x) => (x % N + 0.5) + ',' + (Math.floor(x / N) + 0.5)).join(' '), stroke: CL[c], class: 'lk-line' }));
      if (s.x != null) {
        const x = s.x % N + 0.5, y = Math.floor(s.x / N) + 0.5;
        svg.append(svgEl('path', { d: `M${x - 0.25},${y + 0.25} l0.5,0.5 M${x + 0.25},${y + 0.25} l-0.5,0.5`, stroke: '#ef5350', 'stroke-width': '0.12', 'stroke-linecap': 'round' }));
      }
      wrap.append(svg);
      stage.append(h('div', { class: 'demo-col' }, wrap,
        s.declare ? h('div', { class: 'demo-big over' }, '불가능 선언! ⏱ 5:00') : s.score ? h('div', { class: 'demo-big ok' }, '승점 나 1 : 0 상대') : s.who ? h('div', { class: 'note' }, s.who + ' 차례') : null));
    });
  });

})();
