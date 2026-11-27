/* 잘하는 방법 탭의 움직이는 그림 설명: 장면이 자동으로 넘어가는 짧은 애니메이션 */
(function () {
  const App = globalThis.App;
  const { h } = App;
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

  // 공용 재생기: steps = [{cap, ms, ...}], draw(stage, step, index)
  function player(root, title, steps, draw, ms) {
    const stage = h('div', { class: 'demo-stage' });
    const cap = h('p', { class: 'demo-cap' });
    const prog = h('span', { class: 'demo-prog' });
    let i = 0, playing = !reduced(), t = null;
    const bPlay = h('button', { class: 'btn tiny', type: 'button', onclick: () => { playing = !playing; bPlay.textContent = playing ? '❚❚ 멈춤' : '▶ 재생'; schedule(); } }, playing ? '❚❚ 멈춤' : '▶ 재생');
    const bPrev = h('button', { class: 'btn tiny ghost', type: 'button', 'aria-label': '이전 장면', onclick: () => { show(i - 1); schedule(); } }, '◀ 이전');
    const bNext = h('button', { class: 'btn tiny ghost', type: 'button', 'aria-label': '다음 장면', onclick: () => { show(i + 1); schedule(); } }, '다음 ▶');
    root.append(h('div', { class: 'demo-box' },
      h('p', { class: 'demo-title' }, '🎬 ' + title), stage, cap,
      h('div', { class: 'demo-ctl' }, bPrev, bPlay, bNext, prog)));
    function show(k) {
      i = (k + steps.length) % steps.length;
      App.clear(stage);
      draw(stage, steps[i], i);
      cap.textContent = steps[i].cap || '';
      prog.textContent = (i + 1) + ' / ' + steps.length;
    }
    function schedule() {
      clearTimeout(t);
      if (!playing) return;
      t = setTimeout(() => { if (!root.isConnected) return; show(i + 1); schedule(); }, steps[i].ms || ms || 2200);
    }
    show(0);
    schedule();
  }

  const cell = (txt, cls, style) => h('div', { class: 'dm-cell' + (cls ? ' ' + cls : ''), style }, txt == null ? '' : String(txt));
  function grid(cols, cells, size) {
    const g = h('div', { class: 'dm-grid', style: { gridTemplateColumns: `repeat(${cols}, ${size || 34}px)`, gridAutoRows: (size || 34) + 'px' } });
    cells.forEach((c) => g.append(c));
    return g;
  }

  const D = {};

  // ---------- 삼색 수식: 신호 읽는 법 ----------
  D.signal = (root) => {
    const ans = '7*8-29=27';
    const G = ['123456789', '=0+-*/=-*', '8*7-29=27', '7*8-29=27'];
    const F = G.map((g) => App.signal.grade(g, ans));
    const steps = [
      { rows: 0, color: 0, cap: '숨은 수식은 9칸이에요. 내는 줄은 등식이 아니어도 돼요. 아무 숫자·기호나 어느 자리에든 넣어 정보를 모아요.' },
      { rows: 1, color: 0, cap: '첫 줄은 숫자만 123456789 로 내 보면…' },
      { rows: 1, color: 1, cap: '초록 = 그 자리에 있음, 노랑 = 어딘가에 있음, 빨강 = 아예 없음. 쓰이는 숫자는 2·7·8·9뿐이네요.', ms: 3400 },
      { rows: 2, color: 2, cap: '둘째 줄은 기호만 모아 =0+−×÷=−×: = 는 7번째, − 는 4번째 자리! + ÷ 0 은 없어요.', ms: 3600 },
      { rows: 3, color: 3, cap: '이제 등식으로 8×7−29=27: 7을 두 번 넣었더니 하나는 초록, 하나는 노랑. 노랑은 “몇 개 있는지”는 알려주지 않아요.', ms: 4400 },
      { rows: 4, color: 4, cap: '8과 7 자리를 바꾸면 모두 초록! 정답은 7×8−29=27', ms: 2600 },
    ];
    player(root, '신호 색 읽는 법', steps, (stage, s) => {
      const board = h('div', { class: 'sq-board demo-sq', style: { '--len': 9 } });
      for (let r = 0; r < 4; r++) {
        const row = h('div', { class: 'sq-row' });
        for (let k = 0; k < 9; k++) {
          const ch = r < s.rows ? G[r][k] : '';
          const f = r < s.color ? F[r][k] : '';
          row.append(h('span', { class: 'sq' + (f ? ' f-' + f : '') + (ch && !f ? ' filled' : '') }, ch ? App.eq.show(ch) : ''));
        }
        board.append(row);
      }
      stage.append(board);
    });
  };

  // ---------- 마법 격자: 계단식(시암) 배치법 ----------
  D.magic = (root) => {
    const N = 5, M = App.magic.siamese(N);
    const pos = {};
    M.forEach((row, r) => row.forEach((v, c) => { pos[v] = [r, c]; }));
    const steps = [];
    for (let k = 1; k <= N * N; k++) {
      let cap;
      if (k === 1) cap = '맨 윗줄 가운데 칸에 1을 놓아요.';
      else {
        const [pr, pc] = pos[k - 1], [r, c] = pos[k];
        const tr = (pr - 1 + N) % N, tc = (pc + 1) % N;
        if (r === tr && c === tc) cap = (pr - 1 < 0 || pc + 1 >= N) ? k + ': 오른쪽 위로 가다 판 밖으로 나가면 반대편 끝으로 이어 붙여요.' : k + ': 오른쪽 위 대각선으로 한 칸.';
        else cap = k + ': 오른쪽 위 칸이 이미 차 있으면 바로 아래 칸으로!';
      }
      steps.push({ k, cap, ms: k <= 7 ? 1900 : 950 });
    }
    steps.push({ k: N * N, done: true, cap: '완성! 가로·세로·대각선 모두 합이 65예요. 7×7도 같은 규칙이에요.', ms: 3800 });
    player(root, '홀수 크기 마방진 만들기 (5×5)', steps, (stage, s) => {
      const cells = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const v = M[r][c];
        cells.push(cell(v <= s.k ? v : '', v === s.k && !s.done ? 'cur' : s.done && (r === c || r + c === N - 1) ? 'hl' : ''));
      }
      stage.append(grid(N, cells, 36));
    });
  };

  // ---------- 뒤집기 탑: 묶음 뒤집기 ----------
  D.tower = (root) => {
    const T = { a: { d: 3, o: '*' }, b: { d: 5, o: '+' }, c: { d: 4, o: '-' }, e: { d: 2, o: '-' } };
    const tile = (id, face, sel) => {
      const t = T[id];
      const up = face ? App.eq.show(t.o) : String(t.d), back = face ? String(t.d) : App.eq.show(t.o);
      return h('div', { class: 'tile ' + (face ? 'op' : 'num') + (sel ? ' sel' : '') }, h('span', { class: 'face' }, up), h('span', { class: 'back' }, back));
    };
    // 탑: 위에서 아래 순서로 [id, 면(0 숫자/1 기호)]
    const steps = [
      { A: [['a', 0], ['b', 1], ['c', 0]], B: [['e', 0]], sel: 0, cap: '탑은 위에서 아래로 읽어요. 왼쪽 탑 = 3 + 4 = 7' },
      { A: [['a', 0], ['b', 1], ['c', 0]], B: [['e', 0]], sel: 2, cap: '왼쪽 탑 위의 2개(3과 +)를 한 번에 집어요.' },
      { A: [['c', 0]], B: [['b', 0], ['a', 1], ['e', 0]], sel: 0, cap: '뒤집어서 오른쪽 탑에 올리면 순서가 거꾸로 되고, 모든 블록의 면이 바뀌어요.', ms: 3400 },
      { A: [['c', 0]], B: [['b', 0], ['a', 1], ['e', 0]], sel: 0, read: true, cap: '이동 1번으로 오른쪽 탑 = 5 × 2 = 10. 작은 글씨(뒷면)를 보고 미리 계산해 두세요.', ms: 3600 },
    ];
    player(root, '묶음을 뒤집어 옮기면?', steps, (stage, s) => {
      const col = (list, name, selN) => {
        const st = h('div', { class: 'tw-stack' });
        list.forEach(([id, f], i) => st.append(tile(id, f, i < selN)));
        const toks = list.map(([id, f]) => (f ? App.eq.show(T[id].o) : String(T[id].d)));
        let read = '';
        try { if (toks.length % 2 === 1) { const v = App.eq.evalExpr(list.map(([id, f]) => (f ? T[id].o : String(T[id].d))).join('')); read = toks.join(' ') + ' = ' + App.eq.fracStr(v); } } catch (e) { read = ''; }
        return h('div', { class: 'tw-col demo-tw' }, h('div', { class: 'tw-label' }, name), st, h('div', { class: 'tw-base' }), h('div', { class: 'tw-read' + (s.read && name === '오른쪽' ? ' hit' : '') }, read || '식이 아님'));
      };
      stage.append(h('div', { class: 'demo-towers' }, col(s.A, '왼쪽', s.sel), col(s.B, '오른쪽', 0)));
    });
  };

  // ---------- 네모 사냥: 왼쪽 위 꼭짓점부터 ----------
  D.nemo = (root) => {
    const R = 3, C = 4, cells = [2, 0, 3, 1, 1, 4, 0, 2, 0, 3, 2, 0], target = 5;
    const steps = [{ rect: null, cap: '목표 합은 5. 왼쪽 위 칸을 “왼쪽 위 꼭짓점”으로 하는 네모부터 차례로 넓혀 봐요.' }];
    let found = 0;
    for (let r2 = 0; r2 < R; r2++) {
      for (let c2 = 0; c2 < C; c2++) {
        let sum = 0, onlyBlankAdded = true;
        for (let r = 0; r <= r2; r++) for (let c = 0; c <= c2; c++) sum += cells[r * C + c];
        if (r2 > 0 || c2 > 0) { for (let r = 0; r <= r2; r++) if (c2 > 0 && cells[r * C + c2]) onlyBlankAdded = false; for (let c = 0; c <= c2; c++) if (r2 > 0 && c2 === 0 && cells[r2 * C + c]) onlyBlankAdded = false; }
        let cap;
        if (sum === target) { found++; cap = '합 ' + sum + ' = 목표! ✓ ' + found + '개째'; }
        else if (sum > target) cap = '합 ' + sum + ' > 5 → 이 방향으로 더 넓혀도 커지기만 하니 멈춰요.';
        else cap = '합 ' + sum + (onlyBlankAdded && (r2 > 0 || c2 > 0) ? ' (빈칸은 0이라 합이 그대로예요)' : '');
        steps.push({ rect: [0, 0, r2, c2], sum, cap, ok: sum === target, over: sum > target, ms: sum === target ? 2600 : 2000 });
        if (sum > target) break;
      }
    }
    const total = App.nemo.allRects(R, C, cells).filter((x) => x[4] === target).length;
    steps.push({ rect: null, cap: '이제 꼭짓점을 한 칸씩 옮기며 같은 방법으로 → 이 판의 정답은 ' + total + '개예요.', ms: 3400 });
    player(root, '빠짐없이 세는 순서', steps, (stage, s) => {
      const g = h('div', { class: 'nm-grid demo-nm', style: { '--rows': R, '--cols': C } });
      cells.forEach((v, i) => g.append(h('div', { class: 'nm-cell' + (v === 0 ? ' blank' : ''), style: { gridRow: String(Math.floor(i / C) + 1), gridColumn: String(i % C + 1) } }, v ? String(v) : '')));
      if (s.rect) {
        const [r1, c1, r2, c2] = s.rect;
        g.append(h('div', { class: 'nm-hl' + (s.ok ? ' ok' : s.over ? ' over' : ''), style: { gridRow: (r1 + 1) + ' / ' + (r2 + 2), gridColumn: (c1 + 1) + ' / ' + (c2 + 2) } }));
      }
      stage.append(h('div', { class: 'demo-col' }, g, h('div', { class: 'demo-big' + (s.ok ? ' ok' : s.over ? ' over' : '') }, s.rect ? '합 ' + s.sum : '목표 5')));
    });
  };

  // ---------- 큐브 더미: 기둥으로 세기 ----------
  D.cubes = (root) => {
    const pz = { nx: 3, ny: 3, H: 3, hm: [3, 2, 1, 2, 2, 1, 1, 1, 1] };
    const canvas = h('canvas', { class: 'cube-canvas demo-cube', role: 'img', 'aria-label': '천천히 도는 큐브 더미' });
    const view = App.cubes.makeView(pz, canvas);
    let theta = Math.PI * 0.25 + 0.35, last = 0, gone = 0;
    (function frame(t) {
      if (!canvas.isConnected) { if (++gone > 900) return; }
      else { gone = 0; if (last && !reduced()) theta += (t - last) * (2 * Math.PI / 24000); view.render(theta); }
      last = t;
      requestAnimationFrame(frame);
    })(0);
    const steps = [{ k: 0, cap: '윗면 하나 = 바닥까지 이어진 기둥 하나. 위에서 내려다보며 칸마다 높이를 적어요.' }];
    let sum = 0;
    pz.hm.forEach((v, i) => { sum += v; steps.push({ k: i + 1, sum, cap: (i + 1) + '번째 기둥 높이 ' + v + ' → 지금까지 ' + sum + '개', ms: 1500 }); });
    const layers = [1, 2, 3].map((z) => pz.hm.filter((v) => v >= z).length);
    steps.push({ k: 9, sum, layers: true, cap: '검산: 층별로 세면 1층 ' + layers[0] + ' + 2층 ' + layers[1] + ' + 3층 ' + layers[2] + ' = ' + sum + '개. 같으면 확신을 갖고 답해요!', ms: 4200 });
    const wrap = h('div', { class: 'demo-cube-wrap' }, canvas);
    player(root, '큐브 대신 기둥을 세기', steps, (stage, s) => {
      const cells = pz.hm.map((v, i) => cell(i < s.k ? v : '', i === s.k - 1 ? 'cur' : ''));
      stage.append(wrap, h('div', { class: 'demo-col' }, grid(3, cells, 38), h('div', { class: 'demo-big' }, '합 ' + (s.sum || 0))));
    });
  };

  // ---------- 대칭 조각: 거울 짝 찾기 ----------
  D.sym = (root) => {
    const W = 7, H = 5;
    const tray = { A: [[0, 0], [1, 0], [1, 1]], B: [[0, 5], [0, 6], [1, 6]], C: [[3, 0], [3, 1], [3, 2], [3, 3]] };
    const fin = { A: [[1, 2], [2, 1], [2, 2]], B: [[1, 3], [2, 3], [2, 4]], C: [[3, 1], [3, 2], [3, 3], [3, 4]] };
    const color = { A: 'var(--p0)', B: 'var(--p1)', C: 'var(--p2)' };
    const steps = [
      { put: '', cap: '조각 3개: L자(빨강), 거울 모양 L자(파랑), 一자(초록). 뒤집을 수 없으니 거울 짝은 따로 주어진 조각이어야 해요.', ms: 3600 },
      { put: 'C', cap: '혼자서도 대칭인 一자는 축 위(가운데)에 놓기 좋아요.' },
      { put: 'CA', cap: '빨강 L자를 왼쪽에 붙이고…' },
      { put: 'CAB', cap: '거울 모양인 파랑 L자를 축 반대편에!' },
      { put: 'CAB', axis: true, cap: '가운데 세로줄로 접으면 딱 겹쳐요 → 선대칭 완성!', ms: 3400 },
    ];
    player(root, '거울 짝을 축 양쪽에', steps, (stage, s) => {
      const g = h('div', { class: 'dm-grid demo-sym', style: { gridTemplateColumns: `repeat(${W}, 30px)`, gridAutoRows: '30px' } });
      const at = {};
      for (const p of ['A', 'B', 'C']) for (const [r, c] of (s.put.includes(p) ? fin[p] : tray[p])) at[r * W + c] = p;
      for (let i = 0; i < W * H; i++) g.append(h('div', { class: 'dm-cell sym' + (at[i] ? ' on' : ''), style: at[i] ? { background: color[at[i]] } : null }));
      if (s.axis) g.append(h('div', { class: 'demo-axis', style: { left: (3 * 32 - 1) + 'px' } }));
      stage.append(g);
    });
  };

  // ---------- 열셋 짐꾼: 벌점은 바위 개수 ----------
  D.heavy = (root) => {
    const steps = [
      { L: [3, 0, 2, 1, 0, 1], R: [6, 5], cap: '왼쪽은 합 7에 바위 6개, 오른쪽은 합 11에 바위 2개. 어느 쪽이 더 위험할까요?', ms: 3400 },
      { L: [3, 0, 2, 1, 0, 1], R: [6, 5], addL: 6, cap: '왼쪽에 6을 놓으면 7 + 6 = 13!' },
      { L: [6], R: [6, 5], penL: 6, cap: '원래 있던 바위 6개를 치우고 벌점 +6 (방금 놓은 6은 남아요).', ms: 3000 },
      { L: [6], R: [6, 5], addR: 2, cap: '오른쪽에 2를 놓으면 11 + 2 = 13!' },
      { L: [6], R: [2], penR: 2, cap: '벌점은 치운 바위 개수만큼 → +2뿐. 위험한 건 합이 아니라 바위가 많은 받침대예요!', ms: 3800 },
    ];
    const ped = (name, cls, rocks, add, pen) => {
      const sum = rocks.reduce((a, b) => a + b, 0) + (add || 0);
      return h('div', { class: 'ped ' + cls + ' demo-ped' },
        h('div', { class: 'ped-top' }, h('span', { class: 'ped-name' }, name), h('span', { class: 'ped-sum' + (sum >= 13 ? ' hot' : '') }, sum + ' / 13')),
        h('div', { class: 'rocks' }, rocks.map((v) => h('span', { class: 'rock' }, String(v))), add != null ? h('span', { class: 'rock incoming' }, String(add)) : null),
        h('div', { class: 'ped-foot' }, pen ? h('b', { class: 'demo-pen' }, '벌점 +' + pen) : '쌓인 바위 ' + rocks.length + '개'));
    };
    player(root, '벌점은 “쌓인 바위 수”', steps, (stage, s) => {
      stage.append(h('div', { class: 'peds demo-peds' }, ped('빨강', 'red', s.L, s.addL, s.penL), ped('파랑', 'blue', s.R, s.addR, s.penR)));
    });
  };

  // ---------- 담장 영토전: 경계 먼저 닫기 ----------
  D.wall = (root) => {
    const N = 5;
    const seq = [
      { red: [1, 1], walls: [], cap: '빨강 말로 왼쪽 위 3×3을 차지해 볼게요. (상대 차례는 생략)' },
      { red: [0, 2], walls: [['v', 0, 2]], cap: '2칸 움직인 뒤, 말이 선 칸의 오른쪽 면에 담장.' },
      { red: [1, 2], walls: [['v', 1, 2]], cap: '한 칸 내려와 또 오른쪽 면에 담장.' },
      { red: [2, 2], walls: [['v', 2, 2]], cap: '경계를 따라 내려가며 한 줄씩 막아요.' },
      { red: [2, 2], walls: [['h', 2, 2]], cap: '제자리에 머물며 담장만 세우는 것도 한 수예요.' },
      { red: [2, 1], walls: [['h', 2, 1]], cap: '아래쪽 경계도 차례로…' },
      { red: [2, 0], walls: [['h', 2, 0]], cap: '마지막 틈까지 닫으면…' },
      { red: [2, 0], walls: [], terr: true, cap: '닫힌 구역에 내 말만 있으면 그 칸 수가 내 점수: 9칸 확보!', ms: 3600 },
    ];
    // 담장 누적
    let acc = [];
    const steps = seq.map((s) => { acc = acc.concat(s.walls); return Object.assign({}, s, { all: acc.slice(), last: s.walls[0] }); });
    player(root, '상대가 오기 전에 경계를 닫기', steps, (stage, s) => {
      const b = h('div', { class: 'wl-board demo-wl', style: { '--n': N } });
      const hw = new Set(s.all.filter((w) => w[0] === 'h').map((w) => w[1] * N + w[2]));
      const vw = new Set(s.all.filter((w) => w[0] === 'v').map((w) => w[1] * N + w[2]));
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const k = r * N + c;
        const red = s.red[0] === r && s.red[1] === c, blue = r === 3 && c === 3;
        const cls = 'wl-cell' + (s.terr && r < 3 && c < 3 ? ' terr0' : '');
        b.append(h('div', { class: cls },
          red ? h('span', { class: 'piece', style: { background: 'var(--p0)' } }) : blue ? h('span', { class: 'piece', style: { background: 'var(--p1)' } }) : null,
          hw.has(k) ? h('span', { class: 'w-h' + (s.last && s.last[0] === 'h' && s.last[1] * N + s.last[2] === k ? ' new' : '') }) : null,
          vw.has(k) ? h('span', { class: 'w-v' + (s.last && s.last[0] === 'v' && s.last[1] * N + s.last[2] === k ? ' new' : '') }) : null));
      }
      stage.append(b);
    });
  };

  // ---------- 수순 장기: 먼저 움직이는 카드 ----------
  D.jang = (root) => {
    const steps = [
      { me: [2, 1], foe: [1, 2], rev: false, cap: '두 사람 모두 같은 카드 5장을 몰래 순서대로 놓았어요. 내 졸(빨강) 대각선 앞에 상대 졸(파랑)이 있어요.', ms: 3600 },
      { me: [2, 1], foe: [1, 2], rev: true, cap: '1번 카드 공개! 나는 “사선”, 상대는 “후퇴”. 이번 카드는 내가 먼저(선)예요.', ms: 3000 },
      { me: [1, 2], foe: null, rev: true, cap: '사선으로 바로 잡기! 상대가 후퇴로 피하기 전에 먼저 움직였기 때문이에요.', ms: 3000 },
      { me: [2, 1], foe: [0, 2], rev: true, alt: true, cap: '만약 상대가 먼저였다면? 후퇴로 도망쳐서 사선은 헛걸음이 돼요. 공격 카드는 내가 “선”인 순서에 두세요.', ms: 4200 },
    ];
    player(root, '공격 카드는 내가 먼저인 순서에', steps, (stage, s) => {
      const cells = [];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
        const me = s.me && s.me[0] === r && s.me[1] === c, foe = s.foe && s.foe[0] === r && s.foe[1] === c;
        cells.push(h('div', { class: 'dm-cell jg' }, me ? h('span', { class: 'jg-piece demo-pc', style: { background: 'var(--p0)' } }, '졸') : foe ? h('span', { class: 'jg-piece demo-pc', style: { background: 'var(--p1)' } }, '졸') : null));
      }
      const cardRow = (name, first, c1) => h('div', { class: 'demo-cards' }, h('span', { class: 'demo-cname' }, name, first ? h('span', { class: 'chip-tag' }, '선') : null),
        [0, 1, 2, 3, 4].map((k) => h('span', { class: 'demo-card' + (k === 0 && s.rev ? ' open' : '') }, k === 0 && s.rev ? c1 : '?')));
      stage.append(grid(5, cells, 40), h('div', { class: 'demo-col' }, cardRow('나', !s.alt, '사선'), cardRow('상대', !!s.alt, '후퇴')));
    });
  };

  // ---------- 색실 잇기: 엇갈림 = 불가능 ----------
  D.link = (root) => {
    const N = 4;
    const A = '#e6194b', B = '#4363d8';
    const steps = [
      { pcs: { 0: 'A', 15: 'A', 3: 'B', 12: 'B' }, paths: [], cap: 'A와 B가 테두리를 따라 A·B·A·B 순서로 엇갈려 있어요.', ms: 3000 },
      { pcs: { 0: 'A', 15: 'A', 3: 'B', 12: 'B' }, paths: [['A', [0, 4, 5, 9, 10, 14, 15]]], cap: 'A를 먼저 이으면…' },
      { pcs: { 0: 'A', 15: 'A', 3: 'B', 12: 'B' }, paths: [['A', [0, 4, 5, 9, 10, 14, 15]], ['B', [3, 7, 11]]], x: 11, cap: 'B는 A의 길을 넘을 수 없어요 → 이을 수 없는 판! 상대가 이렇게 놓았다면 바로 불가능 선언.', ms: 4200 },
      { pcs: { 0: 'A', 15: 'A', 3: 'B', 2: 'B' }, paths: [['A', [0, 4, 8, 12, 13, 14, 15]]], cap: '다른 판: B 짝이 바로 옆에 있어요. 하지만 붙여서 끝낼 수는 없어요. 길은 양 끝 포함 6칸 이상!', ms: 3800 },
      { pcs: { 0: 'A', 15: 'A', 3: 'B', 2: 'B' }, paths: [['A', [0, 4, 8, 12, 13, 14, 15]], ['B', [3, 7, 6, 5, 1, 2]]], cap: 'B는 6칸을 돌아서 이어요: 3·7·6·5·1·2. 남은 빈칸으로 6칸 길이 나오는지가 늘 관건이에요.', ms: 4200 },
    ];
    player(root, '엇갈리면 이을 수 없다', steps, (stage, s) => {
      const wrap = h('div', { class: 'lk-board demo-lk', style: { '--n': N } });
      for (let i = 0; i < N * N; i++) {
        const p = s.pcs[i];
        wrap.append(h('div', { class: 'lk-cell' }, p ? h('span', { class: 'lk-piece', style: { background: p === 'A' ? A : B, color: '#fff' } }, p) : null));
      }
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 ' + N + ' ' + N);
      svg.setAttribute('class', 'lk-paths');
      for (const [c, P] of s.paths) {
        const pl = document.createElementNS(NS, 'polyline');
        pl.setAttribute('points', P.map((x) => (x % N + 0.5) + ',' + (Math.floor(x / N) + 0.5)).join(' '));
        pl.setAttribute('stroke', c === 'A' ? A : B);
        pl.setAttribute('class', 'lk-line');
        svg.append(pl);
      }
      if (s.x != null) {
        const x = s.x % N + 0.5, y = Math.floor(s.x / N) + 0.5;
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', `M${x - 0.25},${y + 0.25} l0.5,0.5 M${x + 0.25},${y + 0.25} l-0.5,0.5`);
        p.setAttribute('stroke', '#ef5350'); p.setAttribute('stroke-width', '0.12'); p.setAttribute('stroke-linecap', 'round');
        svg.append(p);
      }
      wrap.append(svg);
      stage.append(wrap);
    });
  };

  App.demos = {
    mountAll(el) {
      el.querySelectorAll('.demo[data-demo]').forEach((box) => {
        const fn = D[box.dataset.demo];
        if (!fn) return;
        App.clear(box);
        try { fn(box); } catch (e) { console.error('demo', box.dataset.demo, e); }
      });
    },
  };
})();
