/* 첫 화면, 게임 화면(플레이·규칙·공략 탭), 주소(#) 이동 */
(function () {
  const App = globalThis.App;
  const { h } = App;

  const GLYPH = {
    signal: '<svg viewBox="0 0 64 40" aria-hidden="true"><rect x="2" y="8" width="18" height="24" rx="3" fill="var(--sig-g)"/><rect x="23" y="8" width="18" height="24" rx="3" fill="var(--sig-y)"/><rect x="44" y="8" width="18" height="24" rx="3" fill="var(--sig-r)"/><text x="11" y="25" font-size="13" text-anchor="middle" fill="#fff" font-family="IBM Plex Mono, monospace" font-weight="700">7</text><text x="32" y="25" font-size="13" text-anchor="middle" fill="#fff" font-family="IBM Plex Mono, monospace" font-weight="700">×</text><text x="53" y="25" font-size="13" text-anchor="middle" fill="#fff" font-family="IBM Plex Mono, monospace" font-weight="700">=</text></svg>',
    magic: '<svg viewBox="0 0 64 40" aria-hidden="true"><g font-family="IBM Plex Mono, monospace" font-size="9" font-weight="700" text-anchor="middle" fill="var(--ink)"><rect x="17" y="1" width="30" height="38" rx="2" fill="none" stroke="var(--line-strong)"/><text x="22" y="12">2</text><text x="32" y="12">7</text><text x="42" y="12">6</text><text x="22" y="24" fill="var(--accent)">9</text><text x="32" y="24" fill="var(--accent)">5</text><text x="42" y="24" fill="var(--accent)">1</text><text x="22" y="36">4</text><text x="32" y="36">3</text><text x="42" y="36">8</text><text x="56" y="24" font-size="8" fill="var(--muted)">15</text></g></svg>',
    tower: '<svg viewBox="0 0 64 40" aria-hidden="true"><g font-family="IBM Plex Mono, monospace" font-size="9" font-weight="700" text-anchor="middle"><rect x="6" y="26" width="16" height="11" rx="2" fill="var(--tile-num)"/><text x="14" y="35" fill="var(--tile-num-ink)">4</text><rect x="6" y="14" width="16" height="11" rx="2" fill="var(--tile-op)"/><text x="14" y="23" fill="var(--tile-op-ink)">×</text><rect x="6" y="2" width="16" height="11" rx="2" fill="var(--tile-num)"/><text x="14" y="11" fill="var(--tile-num-ink)">5</text><rect x="26" y="26" width="16" height="11" rx="2" fill="var(--tile-op)"/><text x="34" y="35" fill="var(--tile-op-ink)">+</text><rect x="46" y="26" width="16" height="11" rx="2" fill="var(--tile-num)"/><text x="54" y="35" fill="var(--tile-num-ink)">3</text></g><path d="M30 20 q6 -10 14 -2" fill="none" stroke="var(--accent)" stroke-width="1.6"/><path d="M42 15 l2 3 l-3.4 .6" fill="none" stroke="var(--accent)" stroke-width="1.6"/></svg>',
    heavy: '<svg viewBox="0 0 64 40" aria-hidden="true"><rect x="4" y="33" width="16" height="4" fill="var(--ped-red)"/><rect x="24" y="33" width="16" height="4" fill="var(--ped-green)"/><rect x="44" y="33" width="16" height="4" fill="var(--ped-blue)"/><g font-family="IBM Plex Mono, monospace" font-size="8" font-weight="700" text-anchor="middle" fill="var(--surface)"><circle cx="12" cy="27" r="5.5" fill="var(--ink)"/><text x="12" y="30">6</text><circle cx="12" cy="16" r="5.5" fill="var(--ink)"/><text x="12" y="19">4</text><circle cx="32" cy="27" r="5.5" fill="var(--ink)"/><text x="32" y="30">0</text><circle cx="52" cy="27" r="5.5" fill="var(--ink)"/><text x="52" y="30">2</text></g><text x="32" y="15" font-family="Black Han Sans, sans-serif" font-size="13" text-anchor="middle" fill="var(--sig-r)">13</text></svg>',
    wall: '<svg viewBox="0 0 64 40" aria-hidden="true"><g stroke="var(--line-strong)" stroke-width=".8"><path d="M14 2v36M24 2v36M34 2v36M44 2v36M4 12h46M4 22h46M4 32h46"/></g><rect x="4" y="2" width="46" height="36" fill="none" stroke="var(--ink)" stroke-width="1.2"/><path d="M24 2v20M24 22h26" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/><circle cx="9" cy="7" r="3.4" fill="var(--p0)"/><circle cx="39" cy="17" r="3.4" fill="var(--p1)"/><circle cx="29" cy="27" r="3.4" fill="var(--p0)"/></svg>',
    jang: '<svg viewBox="0 0 64 40" aria-hidden="true"><g stroke="var(--line-strong)" stroke-width=".7"><path d="M4 4 H40 V36 H4 Z M13 4 V36 M22 4 V36 M31 4 V36 M4 12 H40 M4 20 H40 M4 28 H40" fill="none"/></g><circle cx="22" cy="8" r="3.4" fill="var(--p1)"/><circle cx="13.5" cy="24" r="3.4" fill="var(--p0)"/><rect x="18.5" y="28.5" width="7" height="7" rx="2" fill="var(--p0)"/><g transform="translate(45 6)"><rect width="16" height="12" rx="2" fill="var(--surface)" stroke="var(--ink)" stroke-width="1"/><rect x="3" y="15" width="16" height="12" rx="2" fill="var(--surface)" stroke="var(--ink)" stroke-width="1"/><rect x="6.5" y="2" width="3" height="3" fill="var(--accent)"/><rect x="9.5" y="17" width="3" height="3" fill="var(--accent)"/><rect x="6.5" y="21" width="3" height="3" fill="var(--accent)"/></g></svg>',
    link: '<svg viewBox="0 0 64 40" aria-hidden="true"><path d="M10 9 H24 V18 H40 V9 H54" fill="none" stroke="#e6194b" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 31 H54" fill="none" stroke="#4363d8" stroke-width="3.2" stroke-linecap="round"/><g font-family="IBM Plex Mono, monospace" font-size="6" font-weight="700" text-anchor="middle"><circle cx="10" cy="9" r="5" fill="#e6194b"/><circle cx="54" cy="9" r="5" fill="#e6194b"/><circle cx="10" cy="31" r="5" fill="#4363d8"/><circle cx="54" cy="31" r="5" fill="#4363d8"/><text x="10" y="11" fill="#fff">A</text><text x="54" y="11" fill="#fff">A</text><text x="10" y="33" fill="#fff">D</text><text x="54" y="33" fill="#fff">D</text></g><circle cx="32" cy="27" r="4.6" fill="#ffe119"/><text x="32" y="29" font-family="IBM Plex Mono, monospace" font-size="6" font-weight="700" text-anchor="middle" fill="#141a2e">C</text></svg>',
    nemo: '<svg viewBox="0 0 64 40" aria-hidden="true"><g font-family="IBM Plex Mono, monospace" font-size="8" font-weight="700" text-anchor="middle" fill="var(--ink)"><g fill="var(--surface)" stroke="var(--line-strong)" stroke-width=".8"><rect x="8" y="2" width="12" height="12"/><rect x="20" y="2" width="12" height="12"/><rect x="32" y="2" width="12" height="12"/><rect x="8" y="14" width="12" height="12"/><rect x="20" y="14" width="12" height="12"/><rect x="32" y="14" width="12" height="12"/><rect x="44" y="14" width="12" height="12"/><rect x="20" y="26" width="12" height="12"/><rect x="32" y="26" width="12" height="12"/><rect x="44" y="26" width="12" height="12"/></g><text x="14" y="11">3</text><text x="38" y="11">5</text><text x="26" y="23">2</text><text x="50" y="23">4</text><text x="38" y="35">1</text></g><rect x="20" y="14" width="24" height="24" rx="2" fill="none" stroke="var(--accent)" stroke-width="2.2"/></svg>',
    cubes: '<svg viewBox="0 0 64 40" aria-hidden="true"><g stroke="var(--ink)" stroke-width=".9" stroke-linejoin="round"><path d="M24 8 l8 -4 l8 4 l-8 4z" fill="var(--cube-top)"/><path d="M24 8 v9 l8 4 v-9z" fill="var(--cube-left)"/><path d="M40 8 v9 l-8 4 v-9z" fill="var(--cube-right)"/><path d="M16 21 l8 -4 l8 4 l-8 4z" fill="var(--cube-top)"/><path d="M16 21 v9 l8 4 v-9z" fill="var(--cube-left)"/><path d="M32 21 v9 l-8 4 v-9z" fill="var(--cube-right)"/><path d="M32 21 l8 -4 l8 4 l-8 4z" fill="var(--cube-top)"/><path d="M32 21 v9 l8 4 v-9z" fill="var(--cube-left)"/><path d="M48 21 v9 l-8 4 v-9z" fill="var(--cube-right)"/></g><text x="56" y="12" font-family="Black Han Sans, sans-serif" font-size="11" fill="var(--accent)" text-anchor="middle">?</text></svg>',
    spot: '<svg viewBox="0 0 64 40" aria-hidden="true"><rect x="2" y="4" width="28" height="32" rx="2" fill="#a9d8ff" stroke="var(--ink)" stroke-width="1.2"/><rect x="34" y="4" width="28" height="32" rx="2" fill="#a9d8ff" stroke="var(--ink)" stroke-width="1.2"/><rect x="2" y="26" width="28" height="10" fill="#8fd17a"/><rect x="34" y="26" width="28" height="10" fill="#8fd17a"/><circle cx="10" cy="12" r="4" fill="#ffd23f"/><circle cx="42" cy="12" r="4" fill="#ffd23f"/><rect x="16" y="18" width="9" height="9" fill="#e94f37"/><rect x="48" y="18" width="9" height="9" fill="#3a86ff"/><circle cx="52.5" cy="22.5" r="8" fill="none" stroke="#18b85c" stroke-width="2"/></svg>',
    sym: '<svg viewBox="0 0 64 40" aria-hidden="true"><g stroke="var(--surface)" stroke-width=".8"><rect x="14" y="6" width="9" height="9" fill="var(--p0)"/><rect x="14" y="15" width="9" height="9" fill="var(--p0)"/><rect x="23" y="15" width="9" height="9" fill="var(--p1)"/><rect x="32" y="15" width="9" height="9" fill="var(--p1)"/><rect x="41" y="6" width="9" height="9" fill="var(--p2)"/><rect x="41" y="15" width="9" height="9" fill="var(--p2)"/><rect x="23" y="24" width="9" height="9" fill="var(--p1)"/><rect x="32" y="24" width="9" height="9" fill="var(--p2)"/></g><path d="M32 1 v38" stroke="var(--accent)" stroke-width="1.4" stroke-dasharray="3 2"/></svg>',
  };

  // 프로그램별 게임 목록 (나중에 다른 프로그램을 여기에 추가)
  const PROGRAMS = [
    {
      id: 'dp3', label: '데블스 플랜3', title: '데블스 플랜3에 나온 게임',
      note: '7일 동안 진행된 두뇌 서바이벌 시즌 3의 게임이에요. 초록 점이 있는 게임은 여기서 바로 해볼 수 있어요.',
      groups: [
        { title: '1일차', items: [
          { name: '양자택일', kind: '메인 매치' },
          { name: '큐브 세기', kind: '메인 매치 미니게임', game: 'cubes' },
          { name: '네모 세기', kind: '메인 매치 미니게임', game: 'nemo' },
          { name: '잔디 깔기', kind: '메인 매치 미니게임' },
          { name: '기억 포커', kind: '메인 매치 미니게임' },
          { name: '무거운 13', kind: '감옥 매치', game: 'heavy' }] },
        { title: '2일차', items: [{ name: '미스터리 거래소', kind: '메인 매치' }, { name: '러시안 룰렛', kind: '감옥 매치' }] },
        { title: '3일차', items: [{ name: '보석 암시장', kind: '메인 매치' }, { name: '돼지 저금통', kind: '감옥 매치' }] },
        { title: '4일차', items: [{ name: '경매 빙고', kind: '메인 매치' }, { name: '벽바둑 2', kind: '감옥 매치', game: 'wall' }] },
        { title: '5일차', items: [{ name: '히든 워드', kind: '메인 매치' }, { name: '수식의 탑', kind: '감옥 매치', game: 'tower' }] },
        { title: '유배지', items: [
          { name: '7×7 마방진', game: 'magic' }, { name: '달라진 그림 찾기' }, { name: '대칭 퍼즐', game: 'sym' },
          { name: '피스 퍼즐' }, { name: '비밀 코드' }, { name: '울타리 치기' }] },
        { title: '결승', items: [{ name: '카드 장기', kind: '결승 1국', game: 'jang' }, { name: '컬러 링크', kind: '결승 2국', game: 'link' }, { name: '수식 신호등', kind: '결승 3국', game: 'signal' }] },
      ],
    },
  ];
  App.programs = PROGRAMS;

  function programPanel(p) {
    const ready = p.groups.reduce((a, g) => a + g.items.filter((x) => x.game).length, 0);
    const total = p.groups.reduce((a, g) => a + g.items.length, 0);
    return h('section', { class: 'prog-panel', id: 'prog-' + p.id, 'aria-label': p.title },
      h('div', { class: 'prog-head' }, h('h2', null, p.title), h('span', { class: 'pill' }, '플레이 가능 ' + ready + ' / ' + total)),
      h('p', { class: 'note' }, p.note),
      h('div', { class: 'prog-days' }, p.groups.map((g) => h('div', { class: 'prog-day' },
        h('h3', null, g.title),
        h('ul', null, g.items.map((it) => {
          const game = it.game && App.games.find((x) => x.id === it.game);
          return h('li', { class: 'prog-item' + (game ? ' ready' : '') },
            h('span', null, h('span', { class: 'pg-name' }, it.name), it.kind ? h('span', { class: 'pg-kind' }, it.kind) : null),
            game ? h('a', { href: '#' + game.id }, game.name + '로 해보기') : h('span', { class: 'soon' }, '준비 중'));
        }))))),
      h('p', { class: 'note' }, '공개된 방송 정보를 바탕으로 정리한 목록이라 빠진 게임이 있을 수 있어요. 이 사이트는 팬이 만든 비공식 연습장이며 넷플릭스·제작사와 관계가 없습니다.'));
  }

  let current = null; // { id, cleanup }

  function homeView(openProg) {
    const main = h('main', { class: 'home' });
    let panelEl = null, openId = null;
    const chips = {};
    function toggle(id) {
      if (panelEl) { panelEl.remove(); panelEl = null; }
      for (const k in chips) chips[k].setAttribute('aria-expanded', 'false');
      if (openId === id) { openId = null; return; }
      openId = id;
      const p = PROGRAMS.find((x) => x.id === id);
      panelEl = programPanel(p);
      chips[id].setAttribute('aria-expanded', 'true');
      hero.after(panelEl);
    }
    const progRow = h('div', { class: 'progs' }, h('span', { class: 'progs-label' }, '프로그램별 게임'),
      PROGRAMS.map((p) => (chips[p.id] = h('button', { class: 'prog-chip', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'prog-' + p.id, onclick: () => toggle(p.id) }, p.label, h('span', { class: 'caret', 'aria-hidden': 'true' }, '▾')))));
    // 동시 접속자 (Firebase 판에서만): 무료 요금제는 동시에 100명까지 연결돼요
    const onlineEl = h('p', { class: 'online-count', hidden: true, 'aria-live': 'polite' });
    if (App.fire && App.fire.enabled()) {
      main._cleanup = App.fire.onCount((n) => {
        if (n == null) { onlineEl.hidden = true; return; }
        const lim = App.fire.limit;
        onlineEl.hidden = false;
        onlineEl.classList.toggle('full', n >= lim * 0.9);
        onlineEl.textContent = '';
        onlineEl.append(h('span', { class: 'dot', 'aria-hidden': 'true' }), '동시 접속자 ', h('b', null, String(n)), ' / ' + lim, n >= lim * 0.9 ? ' · 곧 가득 차요' : '');
      });
    }
    const hero = h('section', { class: 'hero' },
      h('h1', { class: 'title sr-only' }, '두뇌 서바이벌에 내가 참가한다면?'),
      h('div', { class: 'eyebrow-row' },
        h('p', { class: 'eyebrow' }, '두뇌 서바이벌 게임 ' + (['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열', '열한', '열두', '열세', '열네', '열다섯'][App.games.length] || App.games.length) + ' 가지'),
        h('a', { class: 'by-link by-top', href: 'https://www.instagram.com/parksungwoo_t', target: '_blank', rel: 'noopener' }, 'by @parksungwoo_t')),
      onlineEl,
      h('p', { class: 'lede' }, '서바이벌 예능에서 본 두뇌 게임의 규칙을 바탕으로 만든 웹 버전입니다. 퍼즐은 매번 새 문제가 만들어지고, 여러 명이 하는 게임은 방 코드로 친구와 동시에 접속해 즐길 수 있어요.'),
      h('ul', { class: 'how' },
        h('li', null, h('b', null, '혼자'), ' 퍼즐은 크기·숫자·배치가 매번 달라요'),
        h('li', null, h('b', null, '함께'), ' 방을 만들고 코드 4자리를 알려 주세요'),
        h('li', null, h('b', null, '공략'), ' 한 판을 끝까지 하면 잘하는 방법이 열려요')),
      progRow);
    main.append(hero);
    if (openProg) setTimeout(() => toggle(openProg), 0);
    function card(g) {
      const plays = App.progress.plays(g.id);
      return h('a', { class: 'gcard', href: '#' + g.id },
        h('div', { class: 'gcard-top' },
          h('span', { class: 'kicker' }, g.kicker),
          h('span', { class: 'glyph', html: GLYPH[g.id] || '' })),
        h('h2', { class: 'gname' }, g.name),
        h('p', { class: 'gblurb' }, g.blurb),
        h('div', { class: 'gmeta' },
          h('span', null, g.players),
          h('span', { class: 'spacer' }),
          h('span', { class: 'lock' + (plays ? ' open' : '') }, plays ? '공략 열림 · ' + plays + '판' : '공략 잠김')));
    }
    // 방송에서 진행된 순서대로 한 목록에 (결승이 맨 아래)
    const order = [];
    for (const p of PROGRAMS) for (const grp of p.groups) for (const it of grp.items) {
      if (it.game && !order.includes(it.game) && App.games.some((x) => x.id === it.game)) order.push(it.game);
    }
    for (const g of App.games) if (!order.includes(g.id)) order.push(g.id);
    main.append(h('section', { class: 'games', 'aria-label': '게임 목록' }, order.map((id) => card(App.games.find((x) => x.id === id)))));
    main.append(h('footer', { class: 'foot' },
      h('p', { class: 'by' }, h('a', { class: 'by-link', href: 'https://www.instagram.com/parksungwoo_t', target: '_blank', rel: 'noopener' }, 'by @parksungwoo_t')),
      h('p', null, '‘데블스 플랜’은 넷플릭스 프로그램이며, 이 사이트는 공식 서비스가 아닌 팬이 만든 연습장입니다. 게임 이름과 화면은 이 사이트에서 새로 만든 것이며, 일부 세부 규칙은 공개된 설명을 바탕으로 재구성했습니다. ' + (App.fire && App.fire.enabled() ? '공략 잠금 해제 정보는 이 브라우저에만 저장되고, 오늘의 문제·기록 대결 기록은 닉네임과 함께 순위 서버에 저장됩니다.' : '기록과 공략 잠금 해제 정보는 이 브라우저에만 저장됩니다.')),
      h('p', null, '픽셀 글꼴: 갈무리(Galmuri) © Lee Minseo · ', h('a', { href: 'https://openfontlicense.org', target: '_blank', rel: 'noopener' }, 'SIL Open Font License 1.1'))));
    return main;
  }

  function gameView(g) {
    const main = h('main', { class: 'gpage' });
    const unlocked = () => App.progress.plays(g.id) > 0;
    const tabs = [['play', '플레이'], ['rules', '규칙'], ['guide', '잘하는 방법']];
    const tabBtns = {};
    const panels = {};
    const tablist = h('div', { class: 'tabs', role: 'tablist' });
    function guideLabel() { return unlocked() ? '잘하는 방법' : '잘하는 방법 (잠김)'; }
    tabs.forEach(([id, label]) => {
      tabBtns[id] = h('button', { class: 'tab', role: 'tab', id: 'tab-' + id, 'aria-controls': 'panel-' + id, onclick: () => select(id) }, id === 'guide' ? guideLabel() : label);
      tablist.append(tabBtns[id]);
    });
    panels.play = h('section', { class: 'panel-play', id: 'panel-play', role: 'tabpanel' });
    panels.rules = h('section', { class: 'prose', id: 'panel-rules', role: 'tabpanel', html: g.rules });
    panels.guide = h('section', { class: 'prose', id: 'panel-guide', role: 'tabpanel' });
    function fillGuide() {
      App.clear(panels.guide);
      if (unlocked()) {
        panels.guide.innerHTML = g.guide;
        if (App.demos) App.demos.mountAll(panels.guide); // 움직이는 그림 설명
      } else {
        panels.guide.append(h('div', { class: 'locked' },
          h('strong', null, '한 판을 끝까지 하면 열려요'),
          h('p', null, '먼저 직접 부딪혀 보세요. 퍼즐을 풀거나, 성공·실패와 상관없이 게임 한 판을 마치면 이 탭에 공략이 나타납니다.'),
          h('button', { class: 'btn primary', onclick: () => select('play') }, '플레이하러 가기')));
      }
    }
    function select(id) {
      for (const [k] of tabs) {
        const on = k === id;
        tabBtns[k].classList.toggle('on', on);
        tabBtns[k].setAttribute('aria-selected', on ? 'true' : 'false');
        panels[k].hidden = !on;
      }
      if (id === 'guide') fillGuide();
    }
    main.append(
      h('div', { class: 'ghead' },
        h('a', { class: 'back', href: '#' }, '← 게임 목록'),
        h('div', { class: 'gtitle' }, h('span', { class: 'kicker' }, g.kicker + ' · ' + g.players), h('h1', null, g.name))),
      tablist, panels.play, panels.rules, panels.guide);
    const ctx = {
      finished(info) {
        const first = App.progress.plays(g.id) === 0;
        App.progress.finish(g.id, info);
        tabBtns.guide.textContent = guideLabel();
        if (first) App.toast('공략이 열렸어요! “잘하는 방법” 탭에서 확인하세요.');
        if (!panels.guide.hidden) fillGuide();
      },
    };
    const cleanup = g.mount(panels.play, ctx);
    select('play');
    return { el: main, cleanup };
  }

  // 첫 화면 맨 위, 화면 폭을 가득 채우는 배너 (링크 미리보기 그림도 이 첫 화면으로 만들어짐)
  function bannerEl() {
    return h('picture', { class: 'banner' },
      h('source', { media: '(max-width: 640px)', srcset: 'banner-m.jpg' }),
      h('img', { src: 'banner.jpg', width: '2000', height: '800', alt: '두뇌 서바이벌에 내가 참가한다면? 거대한 뇌가 빛나는 방 한가운데, 뒷모습의 주인공을 정장 차림의 참가자 일곱 명이 둘러싼 그림' }));
  }

  function route() {
    const id = (location.hash || '').replace('#', '');
    const g = App.games.find((x) => x.id === id);
    const prog = PROGRAMS.find((x) => x.id === id);
    const root = document.getElementById('app');
    const band = document.getElementById('topband');
    const want = g ? g.id : prog ? 'home:' + prog.id : 'home';
    if (current && current.id === want) return;
    if (current && current.cleanup) { try { current.cleanup(); } catch (e) { console.error(e); } }
    App.clear(root);
    if (band) { App.clear(band); if (!g) band.append(bannerEl()); }
    if (g) {
      const v = gameView(g);
      root.append(v.el);
      current = { id: g.id, cleanup: v.cleanup };
    } else {
      const hv = homeView(prog && prog.id);
      root.append(hv);
      current = { id: want, cleanup: hv._cleanup || null };
    }
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', route);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', route); else route();
  App.Net.init();
})();
