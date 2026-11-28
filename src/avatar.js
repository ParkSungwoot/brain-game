/* 픽셀 캐릭터: 모양(App.avatarShapes, 16×16 글자 그림) × 색 10가지
 *
 * - 캐릭터 값은 [모양 번호, 색 번호]. 처음 오면 무작위로 정해 이 브라우저에 기억 (App.avatar.mine)
 * - 그림 글자: '.' 투명, K 테두리, S/s 피부·피부 그늘, H/h 머리카락·밝은 머리,
 *   W/w 흰색·밝은 회색, E 눈·짙은 색, R 볼·입(빨강), Y 노랑(불빛), G/g 금속·짙은 금속, O 주황(부리·코),
 *   U/u 중간 피부·그늘, T/t 짙은 피부·그늘,
 *   C/c 고른 색·그 그늘  ← 색을 바꾸면 C/c 만 바뀜
 * - 그리기는 SVG 사각형 (선명한 픽셀). 자리 색 테두리를 두른 작은 표시는 App.avatar.seat(W, i)
 */
(function () {
  const App = (globalThis.App = globalThis.App || {});
  const N = 16;
  const FIXED = {
    K: '#1d1b22', S: '#f3c9a1', s: '#d79f76', H: '#3b2a22', h: '#6a4c3b', W: '#f7f6f2', w: '#c8ccd4',
    E: '#16141a', R: '#e2575b', Y: '#f6cf45', G: '#a8b0ba', g: '#6c7480', O: '#f0913a',
    U: '#c98d5f', u: '#a2693f', T: '#8a5a3c', t: '#6a4128', // 중간·짙은 피부와 그늘
  };
  const COLORS = [
    { id: 'red', name: '빨강', C: '#e5484d', c: '#a52a2f' },
    { id: 'orange', name: '주황', C: '#f7832a', c: '#b3561a' },
    { id: 'yellow', name: '노랑', C: '#f2c230', c: '#b1861a' },
    { id: 'lime', name: '연두', C: '#8cc63f', c: '#5c8a25' },
    { id: 'green', name: '초록', C: '#2f9e62', c: '#1d6b41' },
    { id: 'sky', name: '하늘', C: '#4cc3e6', c: '#2a87a6' },
    { id: 'blue', name: '파랑', C: '#3b6fe0', c: '#2447a0' },
    { id: 'purple', name: '보라', C: '#8e5cd9', c: '#5e3a99' },
    { id: 'pink', name: '분홍', C: '#ec6aa8', c: '#ac3f74' },
    { id: 'black', name: '검정', C: '#5e5e6a', c: '#3a3a44' }, // 테두리(K)·눈과 구분되게 조금 밝은 검정
  ];
  const LETTERS = new Set(['.', 'C', 'c', ...Object.keys(FIXED)]);
  const shapes = () => App.avatarShapes || [];

  function palette(ci) { const col = COLORS[ci] || COLORS[0]; return Object.assign({ C: col.C, c: col.c }, FIXED); }

  function validate(sh) {
    const e = [];
    if (!sh || !/^[a-z][a-z0-9-]{1,15}$/.test(sh.id || '')) e.push('id');
    if (typeof sh.name !== 'string' || sh.name.length < 1 || sh.name.length > 6) e.push('name 1~6자');
    if (!Array.isArray(sh.grid) || sh.grid.length !== N) { e.push('grid 는 16줄'); return e; }
    sh.grid.forEach((r, y) => {
      if (typeof r !== 'string' || [...r].length !== N) e.push(y + '번째 줄은 16글자');
      else [...r].forEach((ch, x) => { if (!LETTERS.has(ch)) e.push(`(${x},${y}) '${ch}' 못 쓰는 글자`); });
    });
    const all = sh.grid.join('');
    if (!/[C]/.test(all)) e.push('색이 바뀌는 C 칸이 없음');
    if (!/K/.test(all)) e.push('테두리 K 가 없음');
    return e;
  }

  // 같은 줄에서 같은 색이 이어지면 사각형 하나로
  function rects(sh, ci) {
    const pal = palette(ci), out = [];
    sh.grid.forEach((row, y) => {
      const cs = [...row];
      for (let x = 0; x < N;) {
        const ch = cs[x];
        if (ch === '.' || !pal[ch]) { x++; continue; }
        let w = 1;
        while (x + w < N && cs[x + w] === ch) w++;
        out.push([x, y, w, pal[ch]]);
        x += w;
      }
    });
    return out;
  }

  const NS = 'http://www.w3.org/2000/svg';
  function svg(a, size, label) {
    const list = shapes();
    a = norm(a);
    const sh = list[a[0]] || list[0];
    const el = document.createElementNS(NS, 'svg');
    el.setAttribute('viewBox', '0 0 16 16');
    el.setAttribute('width', String(size || 32));
    el.setAttribute('height', String(size || 32));
    el.setAttribute('shape-rendering', 'crispEdges');
    el.setAttribute('class', 'av-svg');
    if (label) { el.setAttribute('role', 'img'); el.setAttribute('aria-label', label); } else el.setAttribute('aria-hidden', 'true');
    if (!sh) return el;
    for (const [x, y, w, fill] of rects(sh, a[1])) {
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', w); r.setAttribute('height', 1); r.setAttribute('fill', fill);
      el.appendChild(r);
    }
    return el;
  }

  function norm(a) {
    const ns = shapes().length || 1;
    if (!Array.isArray(a) || a.length !== 2) return [0, 0];
    const s = a[0] | 0, c = a[1] | 0;
    return [((s % ns) + ns) % ns, ((c % COLORS.length) + COLORS.length) % COLORS.length];
  }
  const valid = (a) => Array.isArray(a) && a.length === 2 && Number.isInteger(a[0]) && Number.isInteger(a[1]) && a[0] >= 0 && a[0] < shapes().length && a[1] >= 0 && a[1] < COLORS.length;

  // 무작위: 이미 쓰인 것(taken)과 모양·색이 겹치지 않게 최대한
  function random(taken) {
    const ns = shapes().length || 1, nc = COLORS.length;
    taken = (taken || []).filter(valid);
    let best = null, bestScore = -1;
    for (let t = 0; t < 40; t++) {
      const a = [Math.floor(Math.random() * ns), Math.floor(Math.random() * nc)];
      const score = (taken.some((x) => x[0] === a[0]) ? 0 : 2) + (taken.some((x) => x[1] === a[1]) ? 0 : 1);
      if (score > bestScore) { best = a; bestScore = score; }
      if (score === 3) break;
    }
    return best;
  }

  function mine() {
    let a = null;
    try { a = App.store.get('avatar', null); } catch (e) { /* 무시 */ }
    if (!valid(a)) { a = random(); try { App.store.set('avatar', a); } catch (e) { /* 무시 */ } }
    return a;
  }
  function setMine(a) { if (valid(a)) { try { App.store.set('avatar', a); } catch (e) { /* 무시 */ } } }

  const nameOf = (a) => { a = norm(a); const sh = shapes()[a[0]]; return (COLORS[a[1]] || COLORS[0]).name + ' ' + (sh ? sh.name : ''); };

  // 자리 색 테두리를 두른 작은 캐릭터 (게임 중 이름표 등). 캐릭터가 없으면 예전 색 점
  function seat(W, i, size, extraCls) {
    const p = W && W.pl && W.pl[i];
    if (!p || !valid(p.a)) return App.h('span', { class: 'seat-dot' + (extraCls ? ' ' + extraCls : ''), style: extraCls ? null : { background: `var(--p${i})` } });
    const box = App.h('span', { class: 'av-chip' + (extraCls ? ' ' + extraCls : ''), style: extraCls ? null : { '--pc': `var(--p${i})` } });
    box.append(svg(p.a, size || 32));
    return box;
  }

  // 모양·색 고르기 (onChange(a) 로 알림). 미리 보기 + 모양 줄 + 색 줄 + 무작위
  function picker(cur, onChange, o) {
    o = o || {};
    let a = valid(cur) ? cur.slice() : mine();
    const root = App.h('div', { class: 'av-picker' + (o.compact ? ' compact' : '') });
    function paint() {
      App.clear(root);
      const big = App.h('div', { class: 'av-big' }, svg(a, o.compact ? 48 : 64, '내 캐릭터: ' + nameOf(a)));
      const shapesRow = App.h('div', { class: 'av-row', role: 'radiogroup', 'aria-label': '캐릭터 모양' },
        shapes().map((sh, i) => App.h('button', {
          class: 'av-opt' + (i === a[0] ? ' on' : ''), type: 'button', role: 'radio', 'aria-checked': i === a[0] ? 'true' : 'false', title: sh.name, 'aria-label': '모양 ' + sh.name,
          onclick: () => set([i, a[1]]),
        }, svg([i, a[1]], 32))));
      const colorRow = App.h('div', { class: 'av-row colors', role: 'radiogroup', 'aria-label': '캐릭터 색' },
        COLORS.map((col, i) => App.h('button', {
          class: 'av-swatch' + (i === a[1] ? ' on' : ''), type: 'button', role: 'radio', 'aria-checked': i === a[1] ? 'true' : 'false', title: col.name, 'aria-label': '색 ' + col.name,
          style: { background: col.C }, onclick: () => set([a[0], i]),
        })));
      root.append(
        App.h('div', { class: 'av-head' }, big,
          App.h('div', { class: 'av-meta' }, App.h('span', { class: 'av-title' }, o.title || '내 캐릭터'), App.h('b', { class: 'av-name' }, nameOf(a)),
            App.h('div', { class: 'row wrap' },
              App.h('button', { class: 'btn tiny', type: 'button', onclick: () => set(random([a])) }, '🎲 무작위'),
              o.onClose ? App.h('button', { class: 'btn tiny ghost', type: 'button', onclick: o.onClose }, '닫기') : null))),
        App.h('p', { class: 'av-label' }, '모양'), shapesRow,
        App.h('p', { class: 'av-label' }, '색'), colorRow);
    }
    function set(n) { a = n; setMine(a); paint(); if (onChange) onChange(a.slice()); }
    paint();
    return root;
  }

  App.avatar = { N, COLORS, FIXED, palette, validate, rects, svg, norm, valid, random, mine, setMine, nameOf, seat, picker, shapes };
})();
