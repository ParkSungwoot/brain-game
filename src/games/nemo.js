/* 네모 세기: 숫자판에서 합이 목표 값인 직사각형 개수 세기 */
(function () {
  const App = (globalThis.App = globalThis.App || {});
  const { h } = App;

  const SIZES = { S: [4, 4], M: [5, 5], L: [5, 6] };

  function allRects(rows, cols, cells) {
    const out = [];
    for (let r1 = 0; r1 < rows; r1++) for (let c1 = 0; c1 < cols; c1++) {
      for (let r2 = r1; r2 < rows; r2++) {
        // r1..r2 줄에서 c2를 늘려 가며 (빈 공간을 만나면 중단)
        let sum = 0;
        for (let c2 = c1; c2 < cols; c2++) {
          let colSum = 0, voidHit = false;
          for (let r = r1; r <= r2; r++) { const v = cells[r * cols + c2]; if (v == null) { voidHit = true; break; } colSum += v; }
          if (voidHit) break;
          sum += colSum;
          out.push([r1, c1, r2, c2, sum]);
        }
      }
    }
    return out;
  }

  function gen(seed, o) {
    const R = App.srng(seed);
    const [rows, cols] = SIZES[o.size] || SIZES.M;
    for (let tries = 0; tries < 500; tries++) {
      const cells = Array(rows * cols).fill(0);
      // 판 모양 변형: 가장자리 몇 칸을 빈 공간으로
      const voids = R.int(0, Math.floor(rows / 2) + 1);
      for (let k = 0; k < voids; k++) {
        const edge = R.int(0, 3);
        const r = edge === 0 ? 0 : edge === 1 ? rows - 1 : R.int(0, rows - 1);
        const c = edge === 2 ? 0 : edge === 3 ? cols - 1 : R.int(0, cols - 1);
        cells[r * cols + c] = null;
      }
      const density = R.float(0.45, 0.7);
      for (let i = 0; i < cells.length; i++) {
        if (cells[i] === null) continue;
        if (!R.chance(density)) continue;
        cells[i] = o.neg && R.chance(0.28) ? -R.int(1, 5) : R.int(1, 9);
      }
      const rects = allRects(rows, cols, cells);
      const bySum = new Map();
      for (const r of rects) bySum.set(r[4], (bySum.get(r[4]) || 0) + 1);
      const lo = o.size === 'S' ? 3 : 4, hi = o.size === 'S' ? 8 : 11;
      const cands = [...bySum.entries()].filter(([s, c]) => c >= lo && c <= hi && (o.neg ? true : s > 0));
      if (!cands.length) continue;
      // 음수 판에서는 0이 목표가 되는 경우도 섞음
      let pick = R.pick(cands);
      const zero = cands.find(([s]) => s === 0);
      if (o.neg && zero && R.chance(0.3)) pick = zero;
      const target = pick[0];
      const hits = rects.filter((r) => r[4] === target).map((r) => r.slice(0, 4));
      return { rows, cols, cells, target, hits };
    }
    throw new Error('네모 세기 문제 생성 실패');
  }

  function boardEl(pz, highlight) {
    const grid = h('div', { class: 'nm-grid', style: { '--rows': pz.rows, '--cols': pz.cols } });
    pz.cells.forEach((v, i) => {
      const r = Math.floor(i / pz.cols), c = i % pz.cols;
      grid.append(h('div', { class: 'nm-cell' + (v === null ? ' void' : v === 0 ? ' blank' : v < 0 ? ' neg' : ''), style: { gridRow: String(r + 1), gridColumn: String(c + 1) } }, v ? String(v) : ''));
    });
    if (highlight) {
      const [r1, c1, r2, c2] = highlight;
      grid.append(h('div', { class: 'nm-hl', style: { gridRow: (r1 + 1) + ' / ' + (r2 + 2), gridColumn: (c1 + 1) + ' / ' + (c2 + 2) } }));
    }
    return grid;
  }

  function mount(pz) {
    const el = h('div', { class: 'nm' }, boardEl(pz));
    return { el };
  }

  function prompt(pz) {
    return h('div', { class: 'q-prompt' }, h('span', null, '합이'), h('strong', { class: 'q-big' }, String(pz.target)), h('span', null, '인 네모는 몇 개?'));
  }

  function explain(pz) {
    const box = h('div', { class: 'nm-explain' });
    let idx = 0;
    const holder = h('div');
    const list = h('div', { class: 'row wrap center' });
    function show(i) {
      idx = i;
      App.clear(holder);
      holder.append(boardEl(pz, pz.hits[i]));
      list.querySelectorAll('button').forEach((b, j) => b.classList.toggle('on', j === i));
    }
    pz.hits.forEach((r, i) => list.append(h('button', { class: 'btn tiny', onclick: () => show(i) }, (i + 1) + '번 ' + (r[2] - r[0] + 1) + '×' + (r[3] - r[1] + 1))));
    box.append(h('p', null, '정답 ', h('b', null, pz.hits.length + '개'), '. 번호를 눌러 하나씩 확인하세요.'), holder, list);
    show(0);
    void idx;
    return box;
  }

  App.quick.register({
    id: 'nemo',
    name: '네모 세기',
    kicker: '스피드 퍼즐',
    blurb: '숫자판에서 안의 수를 더하면 목표 값이 되는 직사각형을 빠짐없이 셉니다. 판 모양과 숫자, 목표가 매번 바뀌어요.',
    kind: 'number',
    explainHasBoard: true,
    defaultOpts: { size: 'M', neg: 0 },
    randomOpts: () => ({ size: App.rng.pick(['S', 'M', 'L']), neg: App.rng.chance(0.4) ? 1 : 0 }),
    optionsUI(bar, o, set, disabled) {
      bar.append(
        h('div', { class: 'seg small' }, [['S', '4×4'], ['M', '5×5'], ['L', '5×6']].map(([v, l]) => h('button', { class: 'seg-btn' + (o.size === v ? ' on' : ''), disabled, onclick: () => set('size', v) }, l))),
        h('div', { class: 'seg small' }, [[0, '양수만'], [1, '음수 섞기']].map(([v, l]) => h('button', { class: 'seg-btn' + ((o.neg ? 1 : 0) === v ? ' on' : ''), disabled, onclick: () => set('neg', v) }, l))));
    },
    gen, mount, prompt, explain,
    check: (pz, v) => v === pz.hits.length,
    answer: (pz) => pz.hits.length,
    botTime: (pz) => 18 + pz.hits.length * 3 + pz.rows * pz.cols * 0.6,
    rules: `
<p>숫자판 위에서 <b>안에 있는 수를 모두 더하면 목표 값이 되는 직사각형</b>이 몇 개인지 맞히는 게임입니다.</p>
<div class="demo" data-demo="rules-nemo"></div>
<ul>
<li>네모는 칸으로 이루어진 직사각형입니다. 정사각형과 1칸짜리도 네모입니다.</li>
<li>숫자가 없는 칸은 0으로 셉니다.</li>
<li>판 모양 밖이나 비어 있는 공간(칸이 없는 곳)을 지나는 네모는 셀 수 없습니다.</li>
<li><b>음수 섞기</b> 변형에서는 −1~−5가 섞여 나오고, 목표 값이 0일 수도 있습니다.</li>
</ul>
<h4>혼자 연습</h4>
<p>5문제를 풉니다. 틀리면 5초 동안 답할 수 없습니다. 문제마다 걸린 시간이 기록되고, 끝나면 정답 네모를 하나씩 확인할 수 있습니다.</p>
<h4>오늘의 문제</h4>
<p>날마다 모든 사람에게 같은 5문제가 나옵니다. 다 풀면 오늘 푼 사람 중 몇 위인지(상위 몇 %인지)와 평균 시간을 보여 줍니다. 하루에 첫 기록만 순위에 들어가고, 날짜가 바뀌면 새 문제가 나옵니다. 여러 사람과 겨루는 모드라서 틀리면 <b>20초</b> 동안 답할 수 없습니다.</p>
<h4>온라인 대결</h4>
<p>방을 만들 때 방식을 고릅니다. 친구는 같은 게임의 「참가하기」에 방 코드 4자리를 넣으면 들어옵니다. 빈자리는 컴퓨터로 채울 수 있어요.</p>
<ul>
<li><b>빨리 맞히기</b>: 모두 같은 판을 동시에 봅니다. 가장 먼저 맞힌 사람이 1점을 얻고, 틀리면 그 라운드에서 20초 동안 답할 수 없습니다. 정한 라운드가 끝나면 점수가 가장 높은 사람이 이깁니다. <b>팀전</b>으로 하면 같은 팀 누가 맞혀도 팀 점수가 됩니다.</li>
<li><b>기록 대결</b>: 같은 문제 묶음을 5초 카운트다운 뒤 다 같이 시작해서 각자 끝까지 풉니다. 맞힌 문제가 많은 순, 같으면 총 시간이 짧은 순으로 순위를 정합니다. 틀리면 20초 동안 답할 수 없습니다. 푸는 동안 다른 사람이 몇 번 문제를 풀고 있는지 보이고, 나중에 같은 방 코드로 들어온 사람도 같은 문제를 풀고 순위에 합쳐집니다.</li>
</ul>`,
    guide: `
<h4>1. 왼쪽 위 꼭짓점을 기준으로 빠짐없이 세기</h4>
<p>가장 흔한 실수는 같은 네모를 두 번 세거나 하나를 빠뜨리는 것입니다. 칸을 왼쪽 위부터 차례로 짚으며 “이 칸을 <b>왼쪽 위 꼭짓점</b>으로 하는 네모”만 셉니다. 그 칸에서 오른쪽으로 한 칸씩, 아래로 한 줄씩 넓혀 가며 합을 확인하면 모든 네모를 정확히 한 번씩 보게 됩니다.</p>
<div class="demo" data-demo="nemo"></div>
<h4>2. 합이 넘으면 그 방향은 멈추기 (양수 판)</h4>
<p>숫자가 모두 양수라면, 네모를 넓힐수록 합이 커지기만 합니다. 목표를 넘는 순간 그 방향으로 더 넓힐 필요가 없습니다. 이것만으로 확인할 네모가 크게 줄어듭니다.</p>
<h4>3. 빈칸이 가장 큰 함정</h4>
<p>빈칸은 0이라서 합을 바꾸지 않습니다. 목표에 딱 맞는 네모 옆에 빈칸이 이어져 있다면, 빈칸까지 넓힌 네모도 정답입니다. 빈칸 줄이 붙어 있을 때마다 “여기까지 넓혀도 되나?”를 꼭 확인하세요. 방송에서도 이런 확장을 하나 빠뜨려 답이 하나 모자랐다는 논란이 있었습니다.</p>
<h4>4. 음수가 있으면 넓혀도 합이 줄 수 있다</h4>
<p>음수가 섞인 판에서는 목표를 넘었다고 멈추면 안 됩니다. 다음 칸에 음수가 있으면 다시 목표로 돌아올 수 있습니다. 목표가 0이라면 “양수와 음수가 서로 지워지는 네모”와 “빈칸으로만 된 네모”를 따로 세면 빠뜨리지 않습니다.</p>
<h4>5. 줄 합을 미리 적어 두기</h4>
<p>세로로 긴 네모는 같은 열의 숫자 몇 개를 반복해서 더하게 됩니다. 머릿속으로 각 줄(또는 열)의 일부 합을 기억해 두면 넓힐 때마다 한 번만 더하면 됩니다. 경주에서는 확신이 없으면 바로 답하지 말고 한 번 더 확인하세요. 오답은 20초 손해입니다.</p>`,
  });

  App.nemo = { gen, allRects };
})();
