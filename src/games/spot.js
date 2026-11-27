/* 숨은 차이 찾기: 같은 시드로 그린 두 풍경에서 달라진 곳 찾기 */
(function () {
  const App = (globalThis.App = globalThis.App || {});
  const { h } = App;
  const NS = 'http://www.w3.org/2000/svg';

  const PAL = ['#e94f37', '#f6c445', '#3a86ff', '#8338ec', '#ff7aa2', '#2ec4b6', '#ff9f1c', '#ffffff', '#43aa8b', '#6d597a'];
  const NEAR = { '#e94f37': '#f07a52', '#f6c445': '#f2d77a', '#3a86ff': '#5e9cff', '#8338ec': '#9a5cf0', '#ff7aa2': '#ff9bb8', '#2ec4b6': '#4fd3c6', '#ff9f1c': '#ffb54d', '#ffffff': '#e6e6e6', '#43aa8b': '#62bfa1', '#6d597a': '#85728f' };
  const GREENS = ['#2e8b57', '#3fa34d', '#5bb55a', '#1f7a4d', '#e0892b'];
  const THEMES = {
    day: { sky: ['#a9d8ff', '#e6f5ff'], ground: ['#8fd17a', '#6fbf5c'], sun: 'sun', cloud: '#ffffff' },
    dusk: { sky: ['#ff9e7a', '#ffe2b8'], ground: ['#9cc77a', '#7fb35f'], sun: 'sun', cloud: '#fff4ea' },
    night: { sky: ['#1b2452', '#3d4d8a'], ground: ['#2f5d3a', '#244a2e'], sun: 'moon', cloud: '#c9d1e8' },
  };
  const SKY_T = ['cloud', 'balloon', 'bird', 'kite'];
  const BACK_T = ['house', 'house', 'tree', 'tree'];
  const FRONT_T = ['flower', 'flower', 'car', 'tree', 'bush'];

  // 물체 그리기 (원점 = 바닥 가운데)
  function shape(o) {
    const c = o.c, v = o.v;
    switch (o.t) {
      case 'house': {
        const wins = [[[-2, -26]], [[-15, -26], [9, -26]], [[-15, -26], [-3, -26], [9, -26]]][v - 1] || [];
        return `<rect x="-22" y="-34" width="44" height="34" fill="${c}" stroke="#2b2b2b" stroke-width="1.5"/>` +
          `<polygon points="-27,-34 0,-58 27,-34" fill="${o.c2}" stroke="#2b2b2b" stroke-width="1.5"/>` +
          `<rect x="-5" y="-15" width="10" height="15" fill="#6d4c41"/>` +
          wins.map(([x, y]) => `<rect x="${x}" y="${y}" width="7" height="7" fill="#fff7c2" stroke="#2b2b2b" stroke-width="1"/>`).join('');
      }
      case 'tree': {
        const crowns = [[[0, -32, 16]], [[-8, -30, 13], [8, -30, 13]], [[-9, -27, 11], [9, -27, 11], [0, -41, 12]]][v - 1] || [];
        return `<rect x="-4" y="-18" width="8" height="18" fill="#7a5230"/>` + crowns.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="#1d3b26" stroke-width="1.2"/>`).join('');
      }
      case 'bush': return `<circle cx="-8" cy="-8" r="9" fill="${c}"/><circle cx="8" cy="-8" r="9" fill="${c}"/><circle cx="0" cy="-14" r="10" fill="${c}" stroke="#1d3b26" stroke-width="1"/>`;
      case 'flower': {
        let p = '';
        for (let i = 0; i < v; i++) { const a = (i / v) * Math.PI * 2; p += `<circle cx="${(Math.cos(a) * 6).toFixed(2)}" cy="${(-24 + Math.sin(a) * 6).toFixed(2)}" r="4.2" fill="${c}"/>`; }
        return `<line x1="0" y1="0" x2="0" y2="-22" stroke="#2e7d32" stroke-width="2.5"/><ellipse cx="5" cy="-9" rx="5" ry="2.4" fill="#2e7d32"/>` + p + `<circle cx="0" cy="-24" r="3.2" fill="#ffd23f" stroke="#a06d00" stroke-width=".8"/>`;
      }
      case 'car': return `<rect x="-22" y="-16" width="44" height="12" rx="3" fill="${c}" stroke="#2b2b2b" stroke-width="1.3"/>` +
        `<path d="M-12,-16 L-7,-26 L9,-26 L14,-16 Z" fill="${c}" stroke="#2b2b2b" stroke-width="1.3"/><path d="M-6,-17 L-3,-23 L8,-23 L11,-17 Z" fill="#d8f0ff"/>` +
        `<circle cx="-12" cy="-4" r="5" fill="#222"/><circle cx="12" cy="-4" r="5" fill="#222"/><rect x="18" y="-14" width="4" height="3" fill="#ffe066"/>`;
      case 'sun': {
        let r = '';
        for (let i = 0; i < v; i++) { const a = (i / v) * Math.PI * 2; r += `<line x1="${(Math.cos(a) * 18).toFixed(2)}" y1="${(Math.sin(a) * 18).toFixed(2)}" x2="${(Math.cos(a) * 25).toFixed(2)}" y2="${(Math.sin(a) * 25).toFixed(2)}" stroke="#ffb000" stroke-width="3" stroke-linecap="round"/>`; }
        return r + `<circle r="14" fill="#ffd23f" stroke="#e09a00" stroke-width="1.5"/>`;
      }
      case 'moon': return `<circle r="15" fill="#fff3b0"/><circle cx="7" cy="-5" r="13" fill="${o.bg}"/>`;
      case 'cloud': {
        const puffs = v === 3 ? [[-12, 0, 10], [0, -6, 13], [13, 0, 10]] : [[-16, 1, 9], [-5, -6, 12], [8, -5, 11], [18, 1, 8]];
        return puffs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join('') + `<rect x="-22" y="0" width="44" height="8" rx="4" fill="${c}"/>`;
      }
      case 'balloon': return `<path d="M0,13 q4,8 -2,16 q-5,8 2,14" fill="none" stroke="#555" stroke-width="1"/><ellipse cx="0" cy="0" rx="10" ry="13" fill="${c}" stroke="#2b2b2b" stroke-width="1.2"/><path d="M-3,12 L3,12 L0,15 Z" fill="${c}"/>`;
      case 'bird': return `<path d="M-11,0 Q-5,-7 0,0 Q5,-7 11,0" fill="none" stroke="${c === '#ffffff' ? '#2b2b2b' : c}" stroke-width="2.6" stroke-linecap="round"/><path d="M11,0 l5,-1" stroke="#ff9f1c" stroke-width="2"/>`;
      case 'kite': return `<polygon points="0,-16 11,0 0,16 -8,0" fill="${c}" stroke="#2b2b2b" stroke-width="1.2"/><line x1="0" y1="-16" x2="0" y2="16" stroke="#2b2b2b" stroke-width=".8"/><path d="M0,16 q6,8 0,14 q-6,8 2,14" fill="none" stroke="#555" stroke-width="1"/><rect x="4" y="26" width="5" height="3" fill="#e94f37"/>`;
      case 'star': return `<polygon points="0,-7 2,-2 7,-2 3,1 5,7 0,3.5 -5,7 -3,1 -7,-2 -2,-2" fill="#fff3a0"/>`;
      default: return '';
    }
  }
  const HEIGHT = { house: 58, tree: 48, bush: 24, flower: 30, car: 26, sun: 50, moon: 30, cloud: 26, balloon: 40, bird: 12, kite: 44, star: 14 };
  const ANCHOR_BOTTOM = { house: 1, tree: 1, bush: 1, flower: 1, car: 1 };
  function center(o) { return ANCHOR_BOTTOM[o.t] ? [o.x, o.y - HEIGHT[o.t] * o.s / 2] : [o.x, o.y]; }

  function objSvg(o) { return `<g transform="translate(${o.x.toFixed(1)},${o.y.toFixed(1)}) scale(${(o.s * (o.f || 1)).toFixed(3)},${o.s.toFixed(3)})">${shape(o)}</g>`; }

  function sceneSvg(pz, objs) {
    const th = THEMES[pz.theme];
    return `<defs><linearGradient id="${pz.gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${th.sky[0]}"/><stop offset="1" stop-color="${th.sky[1]}"/></linearGradient></defs>` +
      `<rect width="400" height="300" fill="url(#${pz.gid})"/><rect y="188" width="400" height="112" fill="${th.ground[0]}"/><rect y="244" width="400" height="56" fill="${th.ground[1]}"/>` +
      objs.map(objSvg).join('');
  }

  function gen(seed, o) {
    const R = App.srng(seed);
    const k = o.k || 7;
    const hard = o.level === 'hard';
    const theme = R.pick(['day', 'day', 'dusk', 'night']);
    const th = THEMES[theme];
    const slots = [];
    [[40, 34], [118, 52], [196, 30], [272, 58], [352, 36], [70, 112], [160, 118], [250, 108], [336, 120]].forEach(([x, y]) => slots.push({ x, y, band: 'sky' }));
    [30, 98, 166, 234, 302, 370].forEach((x) => slots.push({ x, y: 228, band: 'back' }));
    [52, 124, 196, 268, 340].forEach((x) => slots.push({ x, y: 290, band: 'front' }));
    const fill = hard ? 0.92 : 0.8;
    const base = [];
    const empty = [];
    // 해나 달은 하늘 첫 칸 중 하나에
    const sunSlot = R.int(0, 4);
    slots.forEach((sl, i) => {
      if (i === sunSlot) { base.push(mk(th.sun, sl)); return; }
      if (!R.chance(fill)) { empty.push(sl); return; }
      const t = sl.band === 'sky' ? (theme === 'night' && R.chance(0.35) ? 'star' : R.pick(SKY_T)) : sl.band === 'back' ? R.pick(BACK_T) : R.pick(FRONT_T);
      base.push(mk(t, sl));
    });
    function mk(t, sl) {
      const ob = { t, x: sl.x + R.int(-9, 9), y: sl.y + R.int(-5, 5), s: 1, c: R.pick(PAL), f: 1, v: 1 };
      if (t === 'house') { ob.c2 = R.pick(PAL.filter((x) => x !== ob.c)); ob.v = R.int(1, 3); ob.s = R.float(0.95, 1.15); }
      if (t === 'tree') { ob.c = R.pick(GREENS.slice(0, 4)); ob.v = R.int(1, 3); ob.s = sl.band === 'front' ? 0.75 : R.float(0.95, 1.2); }
      if (t === 'bush') { ob.c = R.pick(GREENS.slice(0, 4)); }
      if (t === 'flower') { ob.v = R.int(4, 6); ob.s = R.float(0.9, 1.15); ob.c = R.pick(PAL.filter((x) => x !== '#ffffff')); }
      if (t === 'car') { ob.f = R.chance(0.5) ? 1 : -1; ob.s = R.float(0.95, 1.1); }
      if (t === 'sun') { ob.v = R.pick([6, 8, 10]); }
      if (t === 'moon') { ob.bg = th.sky[0]; }
      if (t === 'cloud') { ob.c = th.cloud; ob.v = R.int(3, 4); ob.s = R.float(0.9, 1.2); }
      if (t === 'bird') { ob.f = R.chance(0.5) ? 1 : -1; ob.c = theme === 'night' ? '#ffffff' : R.pick(['#2b2b2b', '#3a86ff', '#6d597a']); }
      if (t === 'kite') { ob.f = R.chance(0.5) ? 1 : -1; }
      if (t === 'balloon') { ob.s = R.float(0.9, 1.1); }
      if (hard) ob.s *= 0.88;
      return ob;
    }
    // 차이 만들기
    const diffs = [];
    const L = base.map((x) => Object.assign({}, x)), Rr = base.map((x) => Object.assign({}, x));
    const order = R.shuffle([...base.keys()]);
    let extras = Math.min(empty.length, k >= 7 ? R.int(1, 2) : R.int(0, 1));
    for (const i of order) {
      if (diffs.length >= k - extras) break;
      const ob = base[i];
      const types = ['gone', 'size'];
      if (!['cloud', 'sun', 'moon', 'star'].includes(ob.t)) types.push('color', 'color');
      if (['car', 'bird', 'kite'].includes(ob.t)) types.push('flip', 'flip');
      if (['house', 'flower', 'sun', 'tree', 'cloud'].includes(ob.t)) types.push('variant', 'variant');
      if (ob.band !== 'x') types.push('shift');
      const type = R.pick(types);
      const side = R.chance(0.5) ? L : Rr;
      const tgt = side[i];
      const [cx, cy] = center(ob);
      let r = Math.max(22, HEIGHT[ob.t] * ob.s * 0.62);
      if (type === 'gone') tgt.gone = true;
      else if (type === 'size') tgt.s = ob.s * (HEIGHT[ob.t] > 40 ? (hard ? 0.78 : 0.68) : (hard ? 1.3 : 1.45));
      else if (type === 'color') {
        if (ob.t === 'house' && R.chance(0.5)) tgt.c2 = hard ? NEAR[ob.c2] || R.pick(PAL) : R.pick(PAL.filter((x) => x !== ob.c2 && x !== ob.c));
        else if (ob.t === 'tree' || ob.t === 'bush') tgt.c = hard ? GREENS[(GREENS.indexOf(ob.c) + 1) % 4] : '#e0892b';
        else tgt.c = hard ? NEAR[ob.c] || R.pick(PAL) : R.pick(PAL.filter((x) => x !== ob.c));
      } else if (type === 'flip') tgt.f = -ob.f;
      else if (type === 'variant') {
        if (ob.t === 'house') tgt.v = ob.v === 1 ? 2 : ob.v - 1;
        else if (ob.t === 'flower') tgt.v = ob.v === 4 ? 5 : ob.v - 1;
        else if (ob.t === 'sun') tgt.v = ob.v === 6 ? 8 : ob.v - 2;
        else if (ob.t === 'tree') tgt.v = ob.v === 1 ? 3 : ob.v - 1;
        else if (ob.t === 'cloud') tgt.v = ob.v === 3 ? 4 : 3;
      } else if (type === 'shift') {
        const dx = (R.chance(0.5) ? 1 : -1) * (hard ? 16 : 24);
        tgt.x = ob.x + dx;
        r = Math.max(r, 14 + Math.abs(dx) / 2 + HEIGHT[ob.t] * ob.s * 0.45);
        diffs.push({ type, x: ob.x + dx / 2, y: cy, r: Math.min(r, 48) });
        continue;
      }
      diffs.push({ type, x: cx, y: cy, r: Math.min(r, 44) });
    }
    const emptyOrder = R.shuffle(empty);
    for (let e = 0; e < extras && e < emptyOrder.length && diffs.length < k; e++) {
      const sl = emptyOrder[e];
      const t = sl.band === 'sky' ? R.pick(['balloon', 'bird', 'kite']) : sl.band === 'back' ? 'tree' : R.pick(['flower', 'bush']);
      const ob = mk(t, sl);
      (R.chance(0.5) ? L : Rr).push(Object.assign({ extra: true }, ob));
      const [cx, cy] = center(ob);
      diffs.push({ type: 'extra', x: cx, y: cy, r: Math.max(22, HEIGHT[t] * ob.s * 0.62) });
    }
    return { theme, gid: 'sky' + (seed >>> 0).toString(36), L: L.filter((x) => !x.gone), R: Rr.filter((x) => !x.gone), diffs, k: diffs.length };
  }

  const LABEL = { gone: '한쪽에만 있음', size: '크기가 다름', color: '색이 다름', flip: '방향이 반대', variant: '모양·개수가 다름', shift: '위치가 다름', extra: '한쪽에만 있음' };

  function mount(pz, api) {
    const found = new Set();
    let mistakes = 0, penalty = 0, lockUntil = 0, hintUsed = 0;
    const counter = h('span', { class: 'pill strong' });
    const hintBtn = api.solo ? h('button', { class: 'btn tiny', onclick: hint }, '힌트 (+10초)') : null;
    const bar = h('div', { class: 'sp-bar' }, counter, h('span', { class: 'spacer' }), hintBtn);
    const svgs = [pz.L, pz.R].map((objs, side) => {
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 400 300');
      svg.setAttribute('class', 'sp-svg');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', side ? '오른쪽 그림' : '왼쪽 그림');
      svg.innerHTML = sceneSvg(Object.assign({}, pz, { gid: pz.gid + side }), objs) + '<g class="marks"></g>';
      svg.addEventListener('click', (e) => onClick(e, svg));
      return svg;
    });
    const el = h('div', { class: 'sp' }, bar, h('div', { class: 'sp-pair' }, h('div', { class: 'sp-frame' }, svgs[0]), h('div', { class: 'sp-frame' }, svgs[1])));
    function update() { counter.textContent = '찾은 차이 ' + found.size + ' / ' + pz.diffs.length; }
    function mark(i, cls) {
      const d = pz.diffs[i];
      for (const svg of svgs) {
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', d.x); c.setAttribute('cy', d.y); c.setAttribute('r', d.r);
        c.setAttribute('class', cls);
        svg.querySelector('.marks').append(c);
      }
    }
    function onClick(e, svg) {
      if (found.size === pz.diffs.length) return;
      if (Date.now() < lockUntil) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const m = svg.getScreenCTM();
      if (!m) return;
      const p = pt.matrixTransform(m.inverse());
      let best = -1, bd = Infinity;
      pz.diffs.forEach((d, i) => {
        if (found.has(i)) return;
        const dist = Math.hypot(d.x - p.x, d.y - p.y);
        if (dist <= d.r && dist < bd) { bd = dist; best = i; }
      });
      if (best >= 0) {
        found.add(best);
        mark(best, 'hit');
        update();
        if (found.size === pz.diffs.length) api.done();
      } else {
        mistakes++;
        penalty += 5000;
        lockUntil = Date.now() + 1200;
        for (const s of svgs) {
          const g = document.createElementNS(NS, 'g');
          g.setAttribute('class', 'miss');
          g.innerHTML = `<path d="M${p.x - 8},${p.y - 8} L${p.x + 8},${p.y + 8} M${p.x + 8},${p.y - 8} L${p.x - 8},${p.y + 8}"/>`;
          s.querySelector('.marks').append(g);
          setTimeout(() => g.remove(), 900);
        }
      }
    }
    function hint() {
      const left = pz.diffs.map((_, i) => i).filter((i) => !found.has(i));
      if (!left.length) return;
      const i = left[0];
      hintUsed++;
      penalty += 10000;
      found.add(i);
      mark(i, 'hit hinted');
      update();
      if (found.size === pz.diffs.length) api.done();
    }
    update();
    return {
      el,
      penalty: () => penalty,
      mistakes: () => mistakes,
      reveal() { pz.diffs.forEach((d, i) => { if (!found.has(i)) { found.add(i); mark(i, 'missed'); } }); update(); if (hintBtn) hintBtn.disabled = true; },
    };
  }

  function prompt(pz) { return h('div', { class: 'q-prompt' }, h('span', null, '두 그림에서 다른 곳 '), h('strong', { class: 'q-big' }, String(pz.diffs.length)), h('span', null, '군데를 찾으세요')); }

  function explain(pz) {
    const counts = {};
    pz.diffs.forEach((d) => { counts[LABEL[d.type]] = (counts[LABEL[d.type]] || 0) + 1; });
    return h('div', { class: 'sp-explain' },
      h('p', null, '이번 그림의 차이: ' + Object.entries(counts).map(([k, v]) => k + ' ' + v).join(' · ')),
      h('p', { class: 'note' }, '초록 원은 찾은 곳, 빨간 점선 원은 놓친 곳이에요.'));
  }

  App.quick.register({
    id: 'spot',
    name: '숨은 차이 찾기',
    kicker: '스피드 퍼즐',
    blurb: '똑같아 보이는 두 풍경에서 달라진 곳을 찾습니다. 그림과 차이가 매번 새로 그려져요.',
    kind: 'task',
    defaultOpts: { k: 7, level: 'easy' },
    randomOpts: () => ({ k: App.rng.pick([5, 7, 9]), level: App.rng.pick(['easy', 'hard']) }),
    optionsUI(bar, o, set, disabled) {
      bar.append(
        h('div', { class: 'seg small' }, [5, 7, 9].map((n) => h('button', { class: 'seg-btn' + (o.k === n ? ' on' : ''), disabled, onclick: () => set('k', n) }, n + '곳'))),
        h('div', { class: 'seg small' }, [['easy', '또렷하게'], ['hard', '미묘하게']].map(([v, l]) => h('button', { class: 'seg-btn' + (o.level === v ? ' on' : ''), disabled, onclick: () => set('level', v) }, l))));
    },
    gen, mount, prompt, explain,
    check: () => true,
    answer: (pz) => pz.diffs.length,
    botTime: (pz, o) => 14 + pz.diffs.length * (o.level === 'hard' ? 9 : 6),
    rules: `
<p>똑같아 보이는 두 그림에서 <b>달라진 곳</b>을 모두 찾는 게임입니다.</p>
<ul>
<li>달라진 곳을 찾으면 왼쪽이든 오른쪽이든 그 위치를 누르세요. 두 그림 모두에 초록 원이 표시됩니다.</li>
<li>차이는 색, 크기, 방향, 모양이나 개수(창문·꽃잎·햇살 등), 위치, 한쪽에만 있는 물체 가운데에서 나옵니다.</li>
<li>엉뚱한 곳을 누르면 벌칙 시간 5초가 붙고 잠깐 누를 수 없습니다. 혼자 연습의 힌트는 10초 벌칙입니다.</li>
<li>차이 개수(5·7·9곳)와 난이도(또렷하게·미묘하게)를 고를 수 있습니다.</li>
</ul>
<h4>온라인 경주</h4>
<p>모두 같은 그림을 받습니다. 모든 차이를 가장 먼저 찾은 사람이 1점을 얻습니다.</p>`,
    guide: `
<h4>1. 구역을 나눠서 훑기</h4>
<p>그림 전체를 한 번에 보면 눈이 같은 곳만 맴돕니다. 하늘 / 뒤쪽 줄 / 앞쪽 줄처럼 띠를 나누고, 각 띠를 왼쪽에서 오른쪽으로 물체 하나씩 비교하세요. 이미 본 구역은 다시 보지 않습니다.</p>
<h4>2. 물체마다 확인할 목록을 정해 두기</h4>
<p>차이는 정해진 종류 안에서 나옵니다. 물체 하나를 볼 때 “있다/없다 → 색 → 크기 → 방향 → 세부 개수” 순서로 짧게 확인하세요. 자동차·새·연은 방향, 집은 창문 수, 꽃은 꽃잎 수, 해는 햇살 수가 자주 바뀝니다.</p>
<h4>3. 같은 자리를 번갈아 보기</h4>
<p>두 그림의 같은 위치를 빠르게 번갈아 보면 달라진 부분이 깜빡이는 것처럼 느껴집니다. 눈을 그림 사이 가운데에 두고 시선만 좌우로 옮기면 더 잘 보입니다.</p>
<h4>4. 빈 공간도 비교하기</h4>
<p>한쪽에만 있는 물체는 다른 쪽에서는 “아무것도 없는 하늘이나 풀밭”으로 보입니다. 물체만 보지 말고 물체 사이의 빈자리도 비교하세요.</p>
<h4>5. 확실할 때만 누르기</h4>
<p>오답은 5초 벌칙이라 짐작으로 누르면 손해입니다. 미묘하게 난이도에서는 색 차이가 작으니, 비슷한 색의 물체가 나란히 있을 때 특히 천천히 비교하세요.</p>`,
  });

  App.spot = { gen };
})();
