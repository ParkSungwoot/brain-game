/* 큐브 세기: 입체로 쌓인 큐브의 개수를 빨리 맞히기 */
(function () {
  const App = (globalThis.App = globalThis.App || {});
  const { h } = App;

  // 화면 투영: x는 오른쪽 앞, y는 왼쪽 앞, z는 위. 일부러 등각이 아닌 각도로 그려서 겹쳐 보이는 착시를 줄임
  const AX = 30, AY = 22, BX = 11, BY = 17, CZ = 31;
  const VIEW = (() => { const d = [AY, AX, (AY * BX + AX * BY) / CZ]; const L = Math.hypot(...d); return d.map((x) => x / L); })();
  const proj = (x, y, z) => [x * AX - y * AY, x * BX + y * BY - z * CZ];

  const SIZES = { S: [3, 3, 3], M: [4, 4, 4], L: [5, 4, 4] }; // [가로, 세로, 최대 높이]

  // 윗면의 한 점에서 보는 사람 쪽으로 가는 선이 다른 큐브에 막히는지
  function blocked(hm, nx, ny, px, py, pz) {
    const d = VIEW;
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const H = hm[y * nx + x];
      if (!H || x + 1 <= px || y + 1 <= py) continue;
      // 상자 [x,x+1]×[y,y+1]×[0,H] 와 광선의 교차 (슬랩 방식)
      let t0 = 1e-6, t1 = 1e9;
      const lo = [x, y, 0], hi = [x + 1, y + 1, H], p = [px, py, pz];
      let ok = true;
      for (let k = 0; k < 3; k++) {
        const a = (lo[k] - p[k]) / d[k], b = (hi[k] - p[k]) / d[k];
        t0 = Math.max(t0, Math.min(a, b));
        t1 = Math.min(t1, Math.max(a, b));
        if (t0 > t1) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  }

  function allTopsVisible(hm, nx, ny) {
    const S = [[0.5, 0.5], [0.22, 0.22], [0.78, 0.22], [0.22, 0.78], [0.78, 0.78]];
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const H = hm[y * nx + x];
      if (!H) continue;
      let seen = 0;
      for (const [u, v] of S) if (!blocked(hm, nx, ny, x + u, y + v, H + 1e-4)) seen++;
      if (seen < 2) return false;
    }
    return true;
  }

  function gen(seed, o) {
    const R = App.srng(seed);
    const [nx, ny, H] = SIZES[o.size] || SIZES.M;
    for (let tries = 0; tries < 600; tries++) {
      const hm = Array(nx * ny).fill(0);
      const style = R.pick(['slope', 'slope', 'stair', 'random']);
      for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
        let v;
        if (style === 'random') v = R.int(1, H);
        else {
          // 뒤쪽(왼쪽 위)이 높고 앞쪽이 낮은 경향 + 흔들림
          const t = (x + y) / Math.max(1, nx + ny - 2);
          v = Math.round(H * (1 - t * R.float(0.5, 1.1)) + R.int(-1, 1));
        }
        hm[y * nx + x] = Math.max(1, Math.min(H, v)); // 바닥이 보이는 빈칸은 만들지 않음
      }
      if (style === 'stair') {
        for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
          const back = Math.min(x > 0 ? hm[y * nx + x - 1] : H, y > 0 ? hm[(y - 1) * nx + x] : H);
          hm[y * nx + x] = Math.min(hm[y * nx + x], back);
        }
      }
      const total = hm.reduce((a, b) => a + b, 0);
      const distinct = new Set(hm).size;
      if (distinct < 3 || total < nx * ny * 0.9 || total > nx * ny * H * 0.85) continue;
      if (!allTopsVisible(hm, nx, ny)) continue;
      const ask = o.q === 'fill' ? 'fill' : o.q === 'mix' && R.chance(0.4) ? 'fill' : 'count';
      return { nx, ny, H, hm, ask, total, answer: ask === 'fill' ? nx * ny * H - total : total };
    }
    throw new Error('큐브 문제 생성 실패');
  }

  function css(name, fallback) {
    try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback; } catch (e) { return fallback; }
  }
  function hexRgb(c, fb) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(c).trim());
    if (!m) return fb;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const mix = (a, b, t) => 'rgb(' + a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(',') + ')';

  // 천천히 도는 3D 그림: 정투영 카메라가 바닥 가운데를 중심으로 수평 회전
  const ELEV = 32 * Math.PI / 180;
  const FACES = [
    // [법선, 네 꼭짓점(큐브 기준 0~1)]
    [[0, 0, 1], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]],
    [[1, 0, 0], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]],
    [[-1, 0, 0], [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]]],
    [[0, 1, 0], [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]]],
    [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
  ];

  function makeView(pz, canvas) {
    const { nx, ny, hm } = pz;
    const H = Math.max(pz.H, ...hm);
    const cx = nx / 2, cy = ny / 2, cz = H / 2;
    const Rr = Math.hypot(nx / 2, ny / 2);
    const halfW = Rr + 0.3;
    const halfH = (H / 2) * Math.cos(ELEV) + Rr * Math.sin(ELEV) + 0.3;
    const filled = (x, y, z) => x >= 0 && y >= 0 && x < nx && y < ny && z >= 0 && z < hm[y * nx + x];
    const cubes = [];
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) for (let z = 0; z < hm[y * nx + x]; z++) cubes.push([x, y, z]);
    let colors = null;
    function readColors() {
      colors = {
        ink: '#10122a', floor: css('--line-strong', '#4b5288'),
        top: hexRgb(css('--cube-top', '#f4f6fc'), [244, 246, 252]),
        a: hexRgb(css('--cube-left', '#a9b8ee'), [169, 184, 238]),
        b: hexRgb(css('--cube-right', '#5d72c8'), [93, 114, 200]),
      };
    }
    function size() {
      const dpr = Math.min(3, globalThis.devicePixelRatio || 1);
      const cssW = Math.min(440, Math.max(240, (canvas.parentElement ? canvas.parentElement.clientWidth : 440) - 16));
      const unit = cssW / (halfW * 2);
      const cssH = halfH * 2 * unit;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      return { dpr, unit, cssW, cssH };
    }
    let dims = null;
    function render(theta) {
      if (!colors) readColors();
      if (!dims) dims = size();
      const g = canvas.getContext('2d');
      const { dpr, unit, cssW, cssH } = dims;
      const ce = Math.cos(ELEV), se = Math.sin(ELEV), ct = Math.cos(theta), st = Math.sin(theta);
      const d = [ce * ct, ce * st, se];            // 보는 사람 쪽
      const r = [-st, ct, 0];                       // 화면 오른쪽
      const u = [-se * ct, -se * st, ce];           // 화면 위쪽
      const P = (x, y, z) => {
        const px = x - cx, py = y - cy, pz2 = z - cz;
        return [cssW / 2 + (px * r[0] + py * r[1]) * unit, cssH / 2 - (px * u[0] + py * u[1] + pz2 * u[2]) * unit];
      };
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, cssW, cssH);
      const path = (pts) => { g.beginPath(); pts.forEach(([x, y, z], i) => { const q = P(x, y, z); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath(); };
      // 바닥 격자
      g.strokeStyle = colors.floor; g.lineWidth = 1;
      for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) { path([[x, y, 0], [x + 1, y, 0], [x + 1, y + 1, 0], [x, y + 1, 0]]); g.stroke(); }
      // 먼 큐브부터
      const order = cubes.slice().sort((A, B) => ((A[0] + .5 - cx) * d[0] + (A[1] + .5 - cy) * d[1] + A[2] * d[2]) - ((B[0] + .5 - cx) * d[0] + (B[1] + .5 - cy) * d[1] + B[2] * d[2]));
      const lightH = [Math.cos(0.7), Math.sin(0.7), 0];
      g.lineJoin = 'round';
      g.lineWidth = Math.max(1, unit * 0.035);
      g.strokeStyle = colors.ink;
      for (const [x, y, z] of order) {
        for (const [n, vs] of FACES) {
          if (n[0] * d[0] + n[1] * d[1] + n[2] * d[2] <= 0.0001) continue;
          if (filled(x + n[0], y + n[1], z + n[2])) continue;
          path(vs.map(([a, b, c]) => [x + a, y + b, z + c]));
          if (n[2] === 1) g.fillStyle = 'rgb(' + colors.top.join(',') + ')';
          else g.fillStyle = mix(colors.b, colors.a, (n[0] * lightH[0] + n[1] * lightH[1] + 1) / 2);
          g.fill();
          g.stroke();
        }
      }
    }
    return { render, refresh() { colors = null; dims = null; } };
  }

  function mount(pz) {
    const canvas = h('canvas', { class: 'cube-canvas', role: 'img', 'aria-label': '천천히 돌아가는 쌓인 큐브 그림' });
    const reduce = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
    let theta = Math.PI * 0.25 + 0.35; // 처음엔 앞오른쪽 위에서 내려다본 모습
    let spinning = !reduce;
    let dragging = null, raf = 0, last = 0, gone = 0, stopped = false;
    const SPEED = (2 * Math.PI) / 30000; // 30초에 한 바퀴
    const btn = h('button', { class: 'btn tiny', type: 'button', onclick: () => { spinning = !spinning; btn.textContent = spinning ? '회전 멈춤' : '회전 시작'; } }, spinning ? '회전 멈춤' : '회전 시작');
    const el = h('div', { class: 'cube-wrap' }, canvas, h('div', { class: 'cube-ctl' }, btn, h('span', { class: 'note' }, '그림을 좌우로 끌어서 직접 돌려 볼 수도 있어요.')));
    const view = makeView(pz, canvas);
    function frame(t) {
      if (stopped) return;
      if (!canvas.isConnected) { if (++gone > 600) return; raf = requestAnimationFrame(frame); return; }
      gone = 0;
      if (last && spinning && !dragging) theta += (t - last) * SPEED;
      last = t;
      view.render(theta);
      raf = requestAnimationFrame(frame);
    }
    canvas.addEventListener('pointerdown', (e) => { dragging = { x: e.clientX, th: theta }; try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ } });
    canvas.addEventListener('pointermove', (e) => { if (dragging) theta = dragging.th - (e.clientX - dragging.x) * 0.012; });
    const end = () => { dragging = null; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    const onResize = () => view.refresh();
    window.addEventListener('resize', onResize);
    let mq = null;
    try { mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change', onResize); } catch (e) { /* 무시 */ }
    raf = requestAnimationFrame(frame);
    return {
      el,
      destroy() { stopped = true; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); try { mq && mq.removeEventListener('change', onResize); } catch (e) { /* 무시 */ } },
    };
  }

  function prompt(pz) {
    if (pz.ask === 'fill') return h('div', { class: 'q-prompt' }, h('span', null, '가로 ' + pz.nx + ' × 세로 ' + pz.ny + ' × 높이 ' + pz.H + ' 상자를 꽉 채우려면 큐브가 몇 개 더 필요할까?'));
    return h('div', { class: 'q-prompt' }, h('span', null, '큐브는 모두 몇 개일까?'));
  }

  function explain(pz) {
    const { nx, ny, hm } = pz;
    const grid = h('div', { class: 'hm-grid', style: { '--cols': nx } });
    // 위에서 내려다본 높이 지도 (앞쪽이 아래)
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) grid.append(h('div', { class: 'hm-cell' + (hm[y * nx + x] ? '' : ' zero') }, String(hm[y * nx + x])));
    const layers = [];
    for (let z = 1; z <= pz.H; z++) layers.push(hm.filter((v) => v >= z).length);
    return h('div', { class: 'cube-explain' },
      h('p', null, '위에서 내려다본 기둥 높이예요(숫자 = 그 칸에 쌓인 큐브 수). 모두 더하면 ', h('b', null, pz.total + '개'), pz.ask === 'fill' ? ', 상자 ' + (nx * ny * pz.H) + '칸에서 빼면 ' : '', pz.ask === 'fill' ? h('b', null, pz.answer + '개') : '', '.'),
      grid,
      h('p', { class: 'note' }, '층별로 세면: ' + layers.map((c, i) => (i + 1) + '층 ' + c).join(' + ') + ' = ' + pz.total));
  }

  App.quick.register({
    id: 'cubes',
    name: '큐브 세기',
    kicker: '스피드 퍼즐',
    blurb: '입체로 쌓인 큐브가 모두 몇 개인지 빨리 맞힙니다. 보이지 않는 아래쪽 큐브까지 세야 해요.',
    kind: 'number',
    defaultOpts: { size: 'M', q: 'count' },
    randomOpts: () => ({ size: App.rng.pick(['S', 'M', 'L']), q: App.rng.pick(['count', 'mix', 'fill']) }),
    optionsUI(bar, o, set, disabled) {
      bar.append(
        h('div', { class: 'seg small' }, [['S', '3×3'], ['M', '4×4'], ['L', '5×4']].map(([v, l]) => h('button', { class: 'seg-btn' + (o.size === v ? ' on' : ''), disabled, onclick: () => set('size', v) }, l))),
        h('div', { class: 'seg small' }, [['count', '개수 세기'], ['mix', '섞어서'], ['fill', '빈 곳 세기']].map(([v, l]) => h('button', { class: 'seg-btn' + (o.q === v ? ' on' : ''), disabled, onclick: () => set('q', v) }, l))));
    },
    gen, mount, prompt, explain,
    check: (pz, v) => v === pz.answer,
    answer: (pz) => pz.answer,
    botTime: (pz) => 10 + pz.nx * pz.ny * 0.9 + (pz.ask === 'fill' ? 6 : 0),
    rules: `
<p>바닥 격자 위에 쌓인 큐브 더미를 보고 개수를 맞히는 게임입니다.</p>
<div class="demo" data-demo="rules-cubes"></div>
<ul>
<li>큐브는 바닥이나 다른 큐브 위에만 놓입니다. 공중에 뜬 큐브는 없습니다.</li>
<li>그래서 윗면이 보이는 기둥은 그 아래가 바닥까지 모두 큐브로 차 있습니다. 가려서 안 보이는 큐브도 셉니다.</li>
<li>그림은 30초에 한 바퀴씩 천천히 돌아갑니다. 좌우로 끌어서 직접 돌리거나 회전을 멈출 수도 있어요.</li>
<li>모든 기둥의 맨 윗면은 처음 보이는 각도에서도 보이도록 만들어집니다.</li>
<li><b>빈 곳 세기</b> 문제는 정해진 크기의 상자를 꽉 채우려면 몇 개가 더 필요한지 묻습니다.</li>
</ul>
<h4>혼자 연습</h4>
<p>5문제의 시간을 잽니다. 틀리면 5초 동안 답할 수 없습니다.</p>
<h4>오늘의 문제</h4>
<p>날마다 모든 사람에게 같은 5문제가 나옵니다. 다 풀면 오늘 푼 사람 중 몇 위인지(상위 몇 %인지)와 평균 시간을 보여 줍니다. 하루에 첫 기록만 순위에 들어가고, 날짜가 바뀌면 새 문제가 나옵니다.</p>
<h4>온라인 대결</h4>
<p>방을 만들 때 방식을 고릅니다. 친구는 같은 게임의 「참가하기」에 방 코드 4자리를 넣으면 들어옵니다. 빈자리는 컴퓨터로 채울 수 있어요.</p>
<ul>
<li><b>빨리 맞히기</b>: 같은 그림을 보고 가장 먼저 맞힌 사람이 1점을 얻고, 틀리면 20초 동안 답할 수 없습니다. 정한 라운드가 끝나면 점수가 가장 높은 사람이 이깁니다. <b>팀전</b>으로 하면 같은 팀 누가 맞혀도 팀 점수가 됩니다.</li>
<li><b>기록 대결</b>: 같은 문제 묶음을 5초 카운트다운 뒤 다 같이 시작해서 각자 끝까지 풉니다. 맞힌 문제가 많은 순, 같으면 총 시간이 짧은 순으로 순위를 정합니다. 푸는 동안 다른 사람이 몇 번 문제를 풀고 있는지 보이고, 나중에 같은 방 코드로 들어온 사람도 같은 문제를 풀고 순위에 합쳐집니다.</li>
</ul>`,
    guide: `
<h4>1. 큐브가 아니라 “기둥”을 센다</h4>
<p>공중에 뜬 큐브가 없으므로, 윗면 하나는 곧 바닥까지 이어진 기둥 하나입니다. 그림을 위에서 내려다본다고 생각하고 칸마다 기둥 높이를 읽은 뒤 더하면 됩니다. 해설 화면의 높이 지도가 바로 이 방법입니다.</p>
<div class="demo" data-demo="cubes"></div>
<h4>2. 높이는 옆면의 줄 수로 읽기 (돌아갈 때 확인)</h4>
<p>기둥의 높이는 그 기둥 앞쪽 옆면에 보이는 가로줄 수로 확인합니다. 옆면이 앞 기둥에 가려졌다면 그림이 돌아서 그쪽 옆면이 보일 때 확인하세요. 반 바퀴만 기다리면 뒤쪽 기둥이 앞으로 옵니다. 급하면 끌어서 직접 돌리세요. 같은 높이의 윗면들은 화면에서 같은 줄에 나란히 놓입니다.</p>
<h4>3. 줄 단위로 더하기</h4>
<p>맨 뒷줄부터 한 줄씩 기둥 높이를 더해 줄 합계를 만든 뒤 마지막에 합칩니다. 한 번에 25개 숫자를 더하는 것보다 실수가 훨씬 적습니다.</p>
<h4>4. 층별로 세서 검산</h4>
<p>“1층에 있는 큐브 수 = 비어 있지 않은 칸 수”, “2층 = 높이 2 이상인 칸 수”처럼 층마다 세어 더해도 같은 답이 나옵니다. 두 방법의 답이 같으면 확신을 갖고 답하세요.</p>
<h4>5. 빈 곳 세기는 뺄셈으로</h4>
<p>상자 전체 칸 수(가로 × 세로 × 높이)에서 큐브 수를 빼거나, 칸마다 (상자 높이 − 기둥 높이)를 더합니다. 높은 기둥이 많으면 뒤쪽 방법이, 낮은 기둥이 많으면 앞쪽 방법이 빠릅니다.</p>`,
  });

  App.cubes = { gen, allTopsVisible, makeView };
})();
