/* 빨리 풀기 게임 공용 틀: 시드 난수, 혼자 연습(5문제), 온라인 경주(먼저 맞힌 사람 득점) */
(function () {
  const App = (globalThis.App = globalThis.App || {});
  const { h } = App;

  // ---------- 시드 난수 (같은 시드 = 모든 화면에 같은 문제) ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function srng(seed) {
    const f = mulberry32(seed >>> 0);
    return {
      f,
      int(a, b) { return a + Math.floor(f() * (b - a + 1)); },
      float(a, b) { return a + f() * (b - a); },
      pick(arr) { return arr[Math.floor(f() * arr.length)]; },
      chance(p) { return f() < p; },
      shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    };
  }
  App.srng = srng;
  const newSeed = () => (Math.random() * 2147483647) | 0;

  const RACE_LOCK = 20000;   // 온라인: 틀리면 20초 잠금
  const SOLO_LOCK = 5000;    // 혼자: 틀리면 5초 잠금
  const REVEAL_MS = 7000;    // 라운드 결과를 보여주는 시간
  const ROUND_MS = 240000;   // 한 라운드 최대 시간

  // 문제 만들기 결과 기억 (방장·참가자가 같은 시드로 같은 문제를 만듦)
  const cache = new Map();
  function puzzleOf(def, seed, opts) {
    const key = def.id + ':' + seed + ':' + JSON.stringify(opts || {});
    if (!cache.has(key)) {
      if (cache.size > 40) cache.clear();
      cache.set(key, def.gen(seed, opts || {}));
    }
    return cache.get(key);
  }

  // ---------- 온라인 경주 규칙 ----------
  function raceEngine(def) {
    const e = {
      id: def.id,
      minPlayers: 2, maxPlayers: 6, allowBots: true, defaultBots: 2,
      defaultOpts: Object.assign({ rounds: 5 }, def.defaultOpts),
      botNames: ['컴퓨터 A', '컴퓨터 B', '컴퓨터 C', '컴퓨터 D', '컴퓨터 E'],
      start(players, o) {
        const n = players.length;
        const G = { n, o: Object.assign({}, o), rounds: o.rounds || 5, round: 0, pts: Array(n).fill(0), wrong: Array(n).fill(0), lock: Array(n).fill(0), ph: 'play', win: -1, seed: 0, until: 0, last: null };
        nextRound(G);
        return G;
      },
      act(G, seat, a) {
        if (G.ph !== 'play') throw new Error('지금은 답할 수 없어요');
        const now = Date.now();
        if (G.lock[seat] > now) throw new Error('잠겨 있어요. ' + Math.ceil((G.lock[seat] - now) / 1000) + '초 뒤에 다시 답할 수 있어요');
        const pz = puzzleOf(def, G.seed, G.o);
        let ok;
        if (a && a.t === 'ans' && def.kind === 'number') ok = def.check(pz, Number(a.v));
        else if (a && a.t === 'done' && def.kind === 'task') ok = true;
        else throw new Error('잘못된 답이에요');
        if (ok) {
          G.pts[seat]++;
          G.win = seat;
          G.ph = 'reveal';
          G.until = now + REVEAL_MS;
        } else {
          G.wrong[seat]++;
          G.lock[seat] = now + RACE_LOCK;
          G.last = [seat, String(a.v).slice(0, 6)];
        }
      },
      tick(G, now) {
        if (G.ph === 'play' && now >= G.until) { G.win = -1; G.ph = 'reveal'; G.until = now + REVEAL_MS; return true; }
        if (G.ph === 'reveal' && now >= G.until) {
          if (G.round >= G.rounds) { G.ph = 'end'; return true; }
          nextRound(G);
          return true;
        }
        return false;
      },
      pending(G) {
        if (G.ph !== 'play') return [];
        const now = Date.now();
        return [...Array(G.n).keys()].filter((s) => G.lock[s] <= now);
      },
      timeLimit() { return 0; },
      botDelay(G) {
        const pz = puzzleOf(def, G.seed, G.o);
        return def.botTime(pz, G.o) * 1000 * (0.65 + Math.random() * 0.9);
      },
      bot(G) {
        const pz = puzzleOf(def, G.seed, G.o);
        if (def.kind === 'task') return { t: 'done' };
        const ans = def.answer(pz);
        if (Math.random() < 0.82) return { t: 'ans', v: ans };
        return { t: 'ans', v: Math.max(0, ans + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 2))) };
      },
      timeout() { return null; },
      publicView(G) {
        const now = Date.now();
        return {
          o: G.o, rounds: G.rounds, round: G.round, seed: G.seed, ph: G.ph, pts: G.pts, wrong: G.wrong, win: G.win, last: G.last,
          lockRem: G.lock.map((t) => Math.max(0, t - now)), rem: Math.max(0, G.until - now),
        };
      },
      over(G) { return G.ph === 'end'; },
      results(G) { return { pts: G.pts, scores: G.pts.slice(), tb: G.wrong.map((w) => -w) }; },
    };
    function nextRound(G) {
      G.round++;
      G.seed = newSeed();
      puzzleOf(def, G.seed, G.o); // 미리 만들어 둠
      G.ph = 'play';
      G.win = -1;
      G.last = null;
      G.lock = Array(G.n).fill(0);
      G.until = Date.now() + ROUND_MS;
    }
    return e;
  }

  function finePointer() { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) { return false; } }

  // ---------- 숫자 답 입력 줄 ----------
  function answerRow(id, onSubmit, disabled) {
    const inp = h('input', { id, class: 'input ans-input', inputmode: 'numeric', autocomplete: 'off', placeholder: '답', 'aria-label': '답 입력', disabled });
    const btn = h('button', { class: 'btn primary', disabled, onclick: () => go() }, '답하기');
    function go() {
      const t = inp.value.trim().replace(/[^0-9-]/g, '');
      if (t === '' || t === '-') { inp.focus(); return; }
      onSubmit(parseInt(t, 10));
      inp.value = '';
    }
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    return { el: h('div', { class: 'ans-row' }, inp, btn), inp, btn };
  }

  // ---------- 문제 묶음 풀기 (혼자 연습·대결 코드 공용) ----------
  // cfg: { seeds, opts, toolbar(): el|null, label, onEnd(results) }
  function problemSet(wrap, ctx, def, cfg) {
    const seeds = cfg.seeds, N = seeds.length, opts = cfg.opts;
    let round = 0, cur = null, dead = false;
    const results = [];

    function next() {
      if (dead) return;
      if (cur && cur.comp && cur.comp.destroy) cur.comp.destroy();
      round++;
      if (round > N) { cur = null; stop(); cfg.onEnd(results.slice()); return; }
      const pz = puzzleOf(def, seeds[round - 1], opts);
      App.quick.lastPuzzle = pz; // 점검용
      cur = { pz, t0: Date.now(), wrong: 0, lockUntil: 0, done: false, ok: false };
      if (cfg.onProgress) cfg.onProgress(round, results);
      const me = cur;
      cur.comp = def.mount(pz, { done: () => { if (cur === me) finish(true); }, locked: () => Date.now() < me.lockUntil, solo: true });
      draw();
    }

    function submit(v) {
      if (!cur || cur.done || Date.now() < cur.lockUntil) return;
      if (def.check(cur.pz, v)) finish(true);
      else {
        cur.wrong++;
        cur.lockUntil = Date.now() + SOLO_LOCK;
        cur.msg = v + '개는 아니에요. 5초 뒤에 다시 답할 수 있어요.';
        draw();
        const me = cur;
        setTimeout(() => { if (!dead && cur === me && !me.done) { me.msg = '다시 답해 보세요.'; draw(); } }, SOLO_LOCK + 50);
      }
    }

    function finish(ok) {
      if (!cur || cur.done) return;
      cur.done = true;
      cur.ok = ok;
      const pen = (cur.comp.penalty ? cur.comp.penalty() : 0);
      cur.time = Date.now() - cur.t0 + pen;
      results.push({ ok, time: cur.time, wrong: cur.wrong + (cur.comp.mistakes ? cur.comp.mistakes() : 0), pen });
      if (cfg.onProgress) cfg.onProgress(round, results);
      draw();
      ctx.finished({}); // 한 문제만 끝내도 공략이 열림
    }

    function draw() {
      if (dead || !cur) return;
      App.clear(wrap);
      const tb = cfg.toolbar ? cfg.toolbar() : null;
      if (tb) wrap.append(tb);
      const head = h('div', { class: 'q-head' },
        h('span', { class: 'pill strong' }, (cfg.label || '문제') + ' ' + round + ' / ' + N),
        h('span', { class: 'pill', id: def.id + '-clock' }, App.fmtTime(cur.done ? cur.time : Date.now() - cur.t0)),
        cur.wrong ? h('span', { class: 'pill warn' }, '오답 ' + cur.wrong) : null);
      wrap.append(head);
      if (def.prompt) wrap.append(def.prompt(cur.pz));
      if (!(cur.done && def.explainHasBoard)) wrap.append(cur.comp.el);
      if (!cur.done) {
        if (def.kind === 'number') {
          const locked = Date.now() < cur.lockUntil;
          const row = answerRow(def.id + '-ans', submit, locked);
          wrap.append(row.el);
          // 마우스를 쓰는 컴퓨터에서만 입력칸에 바로 커서를 둠 (휴대폰은 입력칸을 눌러야 키보드가 뜸)
          if (!locked && finePointer()) setTimeout(() => { try { row.inp.focus({ preventScroll: true }); } catch (e) { /* 무시 */ } }, 0);
        }
        wrap.append(h('p', { class: 'status', 'aria-live': 'polite' }, cur.msg || ' '));
        wrap.append(h('div', { class: 'row center' }, h('button', { class: 'btn ghost tiny', onclick: () => finish(false) }, '포기하고 정답 보기')));
      } else {
        const last = results[results.length - 1];
        wrap.append(h('div', { class: 'result-box' + (cur.ok ? ' ok' : ' bad') },
          h('strong', { class: 'result-big' }, cur.ok ? App.fmtTime(cur.time) + ' 만에 정답' : '정답 공개'),
          cur.ok && (cur.wrong || last.pen) ? h('p', { class: 'note' }, '오답 ' + last.wrong + '번' + (last.pen ? ' · 벌칙 시간 ' + Math.round(last.pen / 1000) + '초 포함' : '')) : null,
          def.explain(cur.pz),
          h('button', { class: 'btn primary', onclick: next }, round >= N ? '결과 보기' : '다음 문제')));
        if (cur.comp.reveal) cur.comp.reveal();
      }
    }

    const clock = setInterval(() => {
      const el = document.getElementById(def.id + '-clock');
      if (el && cur && !cur.done) el.textContent = App.fmtTime(Date.now() - cur.t0);
    }, 500);
    function stop() { clearInterval(clock); }
    next();
    return {
      destroy() { dead = true; stop(); if (cur && cur.comp && cur.comp.destroy) cur.comp.destroy(); },
    };
  }

  function resultTable(results) {
    return h('table', { class: 'log' },
      h('thead', null, h('tr', null, ['문제', '결과', '시간', '오답'].map((x) => h('th', null, x)))),
      h('tbody', null, results.map((r, i) => h('tr', null, h('td', null, i + 1), h('td', null, r.ok ? '정답' : '포기'), h('td', { class: 'mono' }, App.fmtTime(r.time)), h('td', null, r.wrong || 0)))));
  }

  // ---------- 혼자 연습 ----------
  function solo(root, ctx, def) {
    const ROUNDS = def.soloRounds || 5;
    let opts = Object.assign({}, def.defaultOpts, App.store.get(def.id + '.opts', {}));
    let set = null;
    const wrap = h('div', { class: 'quick' });
    root.append(wrap);

    function saveOpts() { App.store.set(def.id + '.opts', opts); }
    function setOpt(k, v) { opts[k] = v; saveOpts(); restart(); }
    function restart() {
      if (set) set.destroy();
      set = problemSet(wrap, ctx, def, { seeds: Array.from({ length: ROUNDS }, newSeed), opts: Object.assign({}, opts), toolbar, onEnd: summary });
    }

    function toolbar() {
      const bar = h('div', { class: 'toolbar' });
      def.optionsUI(bar, opts, setOpt, false);
      bar.append(
        h('button', { class: 'btn tiny', onclick: () => { opts = Object.assign({}, opts, def.randomOpts()); saveOpts(); restart(); } }, '랜덤 변형'),
        h('button', { class: 'btn tiny ghost', onclick: restart }, '처음부터'));
      return bar;
    }

    function summary(results) {
      App.clear(wrap);
      wrap.append(toolbar());
      const solved = results.filter((r) => r.ok);
      const total = results.reduce((a, r) => a + r.time, 0);
      wrap.append(h('div', { class: 'result-box' },
        h('strong', { class: 'result-big' }, solved.length + ' / ' + ROUNDS + ' 정답'),
        h('p', null, '총 ' + App.fmtTime(total) + (solved.length ? ' · 맞힌 문제 평균 ' + App.fmtTime(solved.reduce((a, r) => a + r.time, 0) / solved.length) : '')),
        resultTable(results),
        h('button', { class: 'btn primary', onclick: restart }, '한 번 더'),
        h('p', { class: 'note' }, '친구와 같은 문제로 겨뤄 보고 싶다면 위의 「대결 코드」 탭을 써 보세요.')));
    }

    restart();
    return () => { if (set) set.destroy(); };
  }

  // ---------- 대결 코드: 같은 문제를 각자 풀고 결과 코드를 주고받아 순위 비교 ----------
  // 서버·로그인 없이 동작. 대결 코드 = 게임 + 설정 + 문제 수 + 시드 + 확인 글자
  const SHARE_URL = App.SHARE_URL || 'https://claude.ai/artifact/7PS8wBkQySgG8HmrkLpRRG';
  const C32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const byPrefix = {};
  function prefixOf(def) { return String(def.codePrefix || def.id.slice(0, 2)).toUpperCase(); }
  function b32(n, len) { let s = ''; for (let i = 0; i < len; i++) { s = C32[n % 32] + s; n = Math.floor(n / 32); } return s; }
  function unb32(s) { let n = 0; for (const c of s) n = n * 32 + C32.indexOf(c); return n; }
  function chk(s) { let a = 7; for (let i = 0; i < s.length; i++) a = (a * 31 + s.charCodeAt(i)) % 1000003; return C32[a % 32]; }
  // 설정 값 목록: 게임의 설정 버튼을 한 번씩 눌러 보며 모음 (게임마다 따로 적지 않아도 됨)
  function domainsOf(def) {
    if (def._dom) return def._dom;
    const dom = {};
    const tmp = h('div');
    def.optionsUI(tmp, Object.assign({}, def.defaultOpts), (k, v) => {
      dom[k] = dom[k] || [];
      if (!dom[k].some((x) => String(x) === String(v))) dom[k].push(v);
    }, false);
    tmp.querySelectorAll('button').forEach((b) => b.click());
    def._dom = dom;
    return dom;
  }
  function optLabel(def, opts) {
    const tmp = h('div');
    def.optionsUI(tmp, opts, () => {}, true);
    return [...tmp.querySelectorAll('.seg-btn.on')].map((b) => b.textContent).join(' · ');
  }
  function makeCode(def, opts, n, seed) {
    const dom = domainsOf(def);
    const digits = Object.keys(dom).map((k) => Math.max(0, dom[k].findIndex((x) => String(x) === String(opts[k])))).join('') + n;
    const seedS = b32(seed, 6);
    return prefixOf(def) + '-' + digits + '-' + seedS + chk(prefixOf(def) + digits + seedS);
  }
  function parseChallenge(text) {
    const m = String(text).toUpperCase().match(/([A-Z]{2})-?(\d{2,9})-?([A-Z2-9]{7})/);
    if (!m) return { err: '대결 코드를 찾지 못했어요. 받은 코드나 메시지를 그대로 붙여 넣어 주세요.' };
    const def = byPrefix[m[1]];
    if (!def) return { err: '이 코드에 맞는 게임을 찾지 못했어요.' };
    const dom = domainsOf(def), keys = Object.keys(dom);
    const digits = m[2], seedS = m[3].slice(0, 6), c = m[3][6];
    if (digits.length !== keys.length + 1 || [...seedS].some((x) => !C32.includes(x))) return { err: '코드 모양이 맞지 않아요. 다시 확인해 주세요.' };
    if (chk(m[1] + digits + seedS) !== c) return { err: '코드에 오타가 있는 것 같아요. 다시 확인해 주세요.' };
    const opts = Object.assign({}, def.defaultOpts);
    keys.forEach((k, i) => { const v = dom[k][+digits[i]]; if (v !== undefined) opts[k] = v; });
    const n = +digits[keys.length];
    if (n < 1) return { err: '코드 모양이 맞지 않아요.' };
    return { def, opts, n, seed: unb32(seedS), code: m[1] + '-' + digits + '-' + seedS + c };
  }
  function seedsOf(ch) { const r = srng(ch.seed ^ 0x5bd1e995); return Array.from({ length: ch.n }, () => Math.floor(r.f() * 2147483647)); }
  function toB64(s) {
    const b = new TextEncoder().encode(s); let bin = '';
    b.forEach((x) => { bin += String.fromCharCode(x); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromB64(s) {
    try {
      const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
      return App.cleanNick(new TextDecoder().decode(Uint8Array.from(bin, (x) => x.charCodeAt(0)))) || '이름 없음';
    } catch (e) { return '이름 없음'; }
  }
  function encodeEntries(res) { return res.map((r) => (r.ok ? '' : '!') + Math.round(r.time / 100).toString(36) + (r.wrong ? '~' + Math.min(99, r.wrong) : '')).join(','); }
  function decodeEntries(s, n) {
    const parts = String(s).split(',');
    if (parts.length !== n) return null;
    const out = [];
    for (const p of parts) {
      const m = p.match(/^(!?)([0-9a-z]{1,6})(?:~(\d{1,2}))?$/);
      if (!m) return null;
      out.push({ ok: !m[1], time: parseInt(m[2], 36) * 100, wrong: m[3] ? +m[3] : 0 });
    }
    return out;
  }
  function resultCode(ch, mine) {
    const body = ch.code + '.' + toB64(mine.name) + '.' + encodeEntries(mine.res);
    return body + '.' + chk(body);
  }
  // 붙여 넣은 글에서 결과 코드 또는 대결 코드 찾기
  function parseAny(text) {
    const t = String(text || '');
    const rm = t.match(/([A-Za-z]{2}-?\d{2,9}-?[A-Za-z2-9]{7})\.([A-Za-z0-9_-]{0,90})\.([0-9a-z!~,]{1,300})\.([A-Za-z2-9])/);
    if (rm) {
      const ch = parseChallenge(rm[1]);
      if (ch.err) return ch;
      const body = ch.code + '.' + rm[2] + '.' + rm[3];
      if (chk(body) !== rm[4].toUpperCase()) return { ch, err: '결과 코드가 중간에 잘린 것 같아요. 받은 메시지를 통째로 다시 붙여 넣어 주세요.' };
      const res = decodeEntries(rm[3], ch.n);
      if (!res) return { ch, err: '결과 코드를 읽지 못했어요.' };
      return { ch, result: { name: fromB64(rm[2]), res } };
    }
    const re = /[A-Za-z]{2}-?\d{2,9}-?[A-Za-z2-9]{7}/g;
    let m, firstErr = null;
    while ((m = re.exec(t))) {
      const ch = parseChallenge(m[0]);
      if (!ch.err) return { ch };
      firstErr = firstErr || ch.err;
    }
    return { err: firstErr || '대결 코드를 찾지 못했어요. 받은 코드나 메시지를 그대로 붙여 넣어 주세요.' };
  }
  function summarize(res) {
    return { solved: res.filter((r) => r.ok).length, total: res.reduce((a, r) => a + r.time, 0), wrong: res.reduce((a, r) => a + (r.wrong || 0), 0) };
  }
  function fmtLong(ms) { const s = Math.round(ms / 1000); return (s >= 60 ? Math.floor(s / 60) + '분 ' : '') + (s % 60) + '초'; }
  function loadRec(ch) { return App.store.get('ch.' + ch.code, null) || { code: ch.code, g: ch.def.id, at: Date.now(), mine: null, others: [] }; }
  function saveRec(rec) {
    App.store.set('ch.' + rec.code, rec);
    const list = App.store.get('ch.list', []).filter((c) => c !== rec.code);
    list.unshift(rec.code);
    App.store.set('ch.list', list.slice(0, 40));
  }
  function addResult(rec, r) {
    const key = r.name + '|' + encodeEntries(r.res);
    if (rec.mine && rec.mine.name + '|' + encodeEntries(rec.mine.res) === key) return 'mine';
    if (rec.others.some((o) => o.name + '|' + encodeEntries(o.res) === key)) return 'dup';
    rec.others.push({ name: r.name, res: r.res, at: Date.now() });
    return 'added';
  }
  function ranked(rec) {
    const all = [];
    if (rec.mine) all.push({ name: rec.mine.name, res: rec.mine.res, me: true });
    rec.others.forEach((o, i) => all.push({ name: o.name, res: o.res, idx: i }));
    all.forEach((r) => { r.s = summarize(r.res); });
    all.sort((a, b) => b.s.solved - a.s.solved || a.s.total - b.s.total);
    all.forEach((r, i) => { const p = all[i - 1]; r.rank = p && p.s.solved === r.s.solved && p.s.total === r.s.total ? p.rank : i + 1; });
    return all;
  }
  function copyText(text) {
    return new Promise((resolve) => {
      const fallback = () => {
        try {
          const ta = h('textarea', { style: { position: 'fixed', top: '0', left: '0', opacity: '0' } });
          ta.value = text; document.body.append(ta); ta.select();
          const ok = document.execCommand('copy'); ta.remove(); resolve(!!ok);
        } catch (e) { resolve(false); }
      };
      try { navigator.clipboard.writeText(text).then(() => resolve(true), fallback); } catch (e) { fallback(); }
    });
  }
  function shareBlock(label, text) {
    const ta = h('textarea', { class: 'input share-text', rows: '6', readonly: true, 'aria-label': '보낼 글' });
    ta.value = text;
    const det = h('details', { class: 'share-det' }, h('summary', null, '보낼 글 미리 보기'), ta);
    const btn = h('button', { class: 'btn primary big', onclick: async () => {
      const ok = await copyText(text);
      if (ok) App.toast('복사했어요. 카톡 대화창에 붙여 넣어 보내세요.');
      else { App.toast('자동 복사가 막혀 있어요. 아래 글을 길게 눌러 복사해 주세요.', 'warn'); det.open = true; ta.focus(); ta.select(); }
    } }, '📋 ' + label);
    return h('div', { class: 'share-block' }, btn, det);
  }
  function codeTiles(code) {
    return h('div', { class: 'code-tiles', 'aria-label': '코드 ' + code }, code.split('').map((c) => (c === '-' ? h('i', { 'aria-hidden': 'true' }, '-') : h('b', null, c))));
  }

  function challenge(root, ctx, def) {
    const wrap = h('div', { class: 'chal' });
    root.append(wrap);
    const put = (...els) => wrap.append(...els.filter(Boolean));
    let set = null;
    const cOpts = Object.assign({}, def.defaultOpts, App.store.get(def.id + '.opts', {}), App.store.get(def.id + '.chopts', {}));
    let cN = App.store.get('ch.n', 5);
    let waitTimer = null, liveHook = null;
    const stopSet = () => { if (set) { set.destroy(); set = null; } clearInterval(waitTimer); waitTimer = null; liveHook = null; };

    // ----- 실시간 대결 방: 같은 대결 코드를 연 사람끼리 준비·카운트다운·진행 상황·결과를 주고받음 -----
    // presence: { g:'ch', nick, st:'idle'|'ready'|'play'|'done', rt:준비 시각, go:시작 시각, k:푸는 문제, s:맞힌 수, n, res:결과 코드 }
    let live = null;
    const liveOn = () => !!(App.Net && App.Net.online && App.Net.online());
    const nowS = () => (App.Net && App.Net.now ? App.Net.now() : Date.now());
    function connect(ch) {
      if (!liveOn()) return;
      if (live && live.code === ch.code) return;
      disconnect();
      const L = live = { code: ch.code, ch, room: null, others: [], pres: { g: 'ch', nick: myName() } };
      App.Net.join('ch-' + ch.code.toLowerCase()).then((room) => {
        if (live !== L) { try { room.leave(); } catch (e) { /* 무시 */ } return; }
        L.room = room;
        L.unsub = room.onPeers((c) => {
          L.others = (c.peers || room.peers()).filter((p) => !p.sameTab && p.presence && p.presence.g === 'ch');
          takeResults(L);
          if (liveHook) liveHook();
        }, () => {});
        room.presence(L.pres).catch(() => {});
      }).catch(() => { if (live === L) live = null; if (liveHook) liveHook(); });
    }
    function setLive(patch) {
      if (!live) return;
      patch = Object.assign({ nick: myName() }, patch);
      for (const k in patch) { if (patch[k] === null || patch[k] === undefined) delete live.pres[k]; else live.pres[k] = patch[k]; }
      if (live.room) live.room.presence(patch).catch(() => {});
    }
    function disconnect() {
      if (!live) return;
      const L = live; live = null;
      try { L.unsub && L.unsub(); } catch (e) { /* 무시 */ }
      try { L.room && L.room.leave(); } catch (e) { /* 무시 */ }
    }
    // 다른 사람이 다 푼 결과를 저절로 순위에 넣기
    function takeResults(L) {
      let added = [];
      for (const p of L.others) {
        if (typeof p.presence.res !== 'string') continue;
        const r = parseAny(p.presence.res);
        if (!r.result || r.ch.code !== L.code) continue;
        const rec = loadRec(r.ch);
        if (addResult(rec, r.result) === 'added') { saveRec(rec); added.push(r.result.name); }
      }
      if (added.length) { L.fresh = (L.fresh || []).concat(added); if (L.onResult) L.onResult(added); }
    }
    const others = () => (live ? live.others : []);
    function statusText(p) {
      const x = p.presence;
      if (x.st === 'ready') return '준비 완료';
      if (x.st === 'play') return '푸는 중 · ' + (x.k || 1) + '/' + (x.n || '?') + '번 · ' + (x.s || 0) + '개 정답';
      if (x.st === 'done') return '다 풀었어요';
      return '들어와 있어요';
    }
    function livePanel(title, emptyText) {
      const el = h('section', { class: 'live-panel', 'aria-live': 'polite' });
      const paint = () => {
        App.clear(el);
        if (!liveOn()) return;
        const os = others();
        el.append(h('h4', { class: 'sub' }, title), os.length
          ? h('ul', { class: 'live-list' }, os.map((p) => h('li', { class: 'live-row st-' + (p.presence.st || 'idle') }, h('b', null, App.cleanNick(p.presence.nick)), h('span', null, statusText(p)))))
          : h('p', { class: 'note' }, emptyText));
      };
      paint();
      return { el, paint };
    }
    const myName = () => App.cleanNick(App.store.get('nick', ''));
    const top = () => { try { wrap.scrollIntoView({ block: 'start' }); } catch (e) { /* 무시 */ } };

    function inviteText(ch) {
      return '🧠 두뇌 서바이벌 도전장!\n[' + def.name + '] ' + optLabel(def, ch.opts) + ' · ' + ch.n + '문제\n대결 코드: ' + ch.code +
        '\n\n① 아래 링크를 열고 「' + def.name + '」 → 「대결 코드」 탭\n② 이 메시지를 통째로 붙여 넣고 「열기」\n' + SHARE_URL;
    }
    function resultText(ch, mine) {
      const s = summarize(mine.res);
      return '🧠 [' + def.name + '] 대결 결과\n' + mine.name + ': ' + s.solved + '/' + ch.n + ' 정답 · 총 ' + fmtLong(s.total) +
        '\n결과 코드: ' + resultCode(ch, mine) +
        '\n\n이 메시지를 「' + def.name + '」 → 「대결 코드」 탭에 붙여 넣으면 순위에 들어가요. 아직 안 풀었다면 같은 문제에 바로 도전할 수 있어요.\n' + SHARE_URL;
    }
    function nickField() {
      const inp = h('input', { id: def.id + '-ch-nick', class: 'input', maxlength: '12', placeholder: '닉네임', value: App.store.get('nick', '') });
      inp.addEventListener('input', () => App.store.set('nick', inp.value));
      return h('label', { class: 'field', for: def.id + '-ch-nick' }, h('span', null, '내 닉네임 (결과에 표시돼요)'), inp);
    }
    function backBar(label) {
      return h('div', { class: 'mp-bar' }, h('span', { class: 'bar-label' }, label || '대결 코드'), h('span', { class: 'spacer' }), h('button', { class: 'btn tiny ghost', onclick: () => home() }, '대결 목록'));
    }

    // 붙여 넣은 글 열기
    function open(text) {
      const r = parseAny(text);
      if (!r.ch) { home(r.err); return; }
      const ch = r.ch;
      if (ch.def !== def) {
        App.store.set('ch.pending', { g: ch.def.id, text: String(text) });
        App.toast('「' + ch.def.name + '」 대결 코드예요. 그 게임으로 옮겨 갈게요.');
        location.hash = '#' + ch.def.id;
        return;
      }
      const rec = loadRec(ch);
      let note = r.err || '';
      if (r.result) {
        const st = addResult(rec, r.result);
        note = st === 'added' ? r.result.name + '님의 결과를 넣었어요.' : st === 'mine' ? '내 결과 코드예요.' : '이미 넣은 결과예요.';
      }
      saveRec(rec);
      if (rec.mine) board(ch, note || (r.result ? '' : '이미 푼 대결이에요. 친구가 보낸 결과 메시지를 붙여 넣으면 순위에 들어가요.'));
      else intro(ch, { from: r.result ? r.result.name : null, note });
    }

    function home(msg) {
      stopSet(); disconnect(); App.clear(wrap);
      const paste = h('textarea', { id: def.id + '-ch-paste', class: 'input paste', rows: '3', placeholder: '받은 대결 코드나 결과 메시지를 통째로 붙여 넣으세요', 'aria-label': '받은 대결 코드나 결과 메시지' });
      const openBtn = h('button', { class: 'btn primary', onclick: () => { if (!paste.value.trim()) { paste.focus(); return; } open(paste.value); } }, '열기');
      const bar = h('div', { class: 'toolbar' });
      def.optionsUI(bar, cOpts, (k, v) => { cOpts[k] = v; App.store.set(def.id + '.chopts', cOpts); home(); }, false);
      bar.append(h('div', { class: 'seg small' }, [3, 5, 7].map((n) => h('button', { class: 'seg-btn' + (cN === n ? ' on' : ''), onclick: () => { cN = n; App.store.set('ch.n', n); home(); } }, n + '문제'))));
      const mk = h('button', { class: 'btn primary', onclick: () => {
        const ch = parseChallenge(makeCode(def, cOpts, cN, Math.floor(Math.random() * 1073741824)));
        saveRec(loadRec(ch));
        intro(ch, { created: true });
        top();
      } }, '대결 코드 만들기');
      put(
        h('p', { class: 'chal-lead' }, '친구와 ', h('b', null, '똑같은 문제'), '를 각자 풀고, 결과를 주고받아 순위를 겨뤄요. 동시에 접속하지 않아도 되고 로그인도 필요 없어요.'),
        nickField(),
        h('div', { class: 'mode-grid' },
          h('div', { class: 'mode-card' }, h('h4', null, '도전장 만들기'), h('p', null, '설정과 문제 수를 고르고 코드를 만들어 친구에게 보내세요.'), bar, mk),
          h('div', { class: 'mode-card' }, h('h4', null, '받은 코드 열기'), h('p', null, '카톡으로 받은 도전장이나 결과 메시지를 그대로 붙여 넣으세요.'), paste, openBtn)),
        msg ? h('p', { class: 'warn-note note' }, msg) : null,
        historyList());
    }

    function historyList() {
      const recs = App.store.get('ch.list', []).map((c) => App.store.get('ch.' + c, null)).filter((r) => r && r.g === def.id).slice(0, 8);
      if (!recs.length) return null;
      return h('section', { class: 'chal-hist' }, h('h4', { class: 'sub' }, '이 기기의 대결 기록'),
        h('ul', { class: 'plist' }, recs.map((rec) => {
          const ch = parseChallenge(rec.code);
          if (ch.err) return null;
          const rows = ranked(rec);
          const me = rows.find((r) => r.me);
          return h('li', { class: 'pitem' },
            h('span', { class: 'mono' }, rec.code),
            h('span', { class: 'note' }, me ? me.s.solved + '/' + ch.n + ' · ' + App.fmtTime(me.s.total) + (rows.length > 1 ? ' · ' + rows.length + '명 중 ' + me.rank + '등' : '') : '아직 안 풂'),
            h('button', { class: 'btn tiny', onclick: () => { if (rec.mine) board(ch); else intro(ch, {}); top(); } }, '열기'));
        })));
    }

    function intro(ch, o) {
      stopSet(); App.clear(wrap);
      const rec = loadRec(ch);
      connect(ch);
      setLive(rec.mine ? { st: 'done', res: resultCode(ch, rec.mine), rt: null, go: null } : { st: 'idle', rt: null, go: null, k: null, s: null });
      const lp = livePanel('지금 이 대결에 들어와 있는 사람', '친구가 이 대결 코드를 열면 여기에 나타나요.');
      liveHook = lp.paint;
      const startNow = () => { if (liveOn() && !rec.mine) wait(ch); else play(ch); top(); };
      const head = o.created ? '✅ 대결 코드가 만들어졌어요!' : o.from ? '📨 ' + o.from + '님의 도전장이 도착했어요!' : '📨 도전장';
      const waiting = rec.others.length;
      put(
        backBar(),
        h('section', { class: 'room-made' + (o.created || o.from ? ' pop' : '') },
          h('p', { class: 'room-made-head' }, head),
          codeTiles(ch.code),
          h('p', { class: 'room-made-sub' }, def.name + ' · ' + optLabel(def, ch.opts) + ' · ' + ch.n + '문제'),
          o.note ? h('p', { class: 'note' }, o.note) : null,
          waiting ? h('p', { class: 'note' }, '친구 결과 ' + waiting + '개가 들어와 있어요. 내가 풀고 나면 순위를 볼 수 있어요.') : null),
        o.from ? null : shareBlock('도전장 복사하기', inviteText(ch)),
        lp.el,
        h('ol', { class: 'chal-steps' }, (liveOn()
          ? (o.from
            ? ['둘 다 이 화면에서 「지금 풀기」를 누르면 5초 카운트다운 뒤 같이 시작해요.', '푸는 동안 친구가 몇 번 문제를 풀고 있는지 보여요.', '다 풀면 결과가 서로에게 저절로 전해져요.']
            : ['「도전장 복사하기」를 눌러 카톡으로 친구에게 보내요.', '둘 다 「지금 풀기」를 누르면 5초 카운트다운 뒤 같이 시작해요.', '다 풀면 결과가 저절로 전해져서 바로 순위가 나와요. 친구가 나중에 풀어도 괜찮아요.'])
          : (o.from
            ? ['「지금 풀기」로 같은 문제를 풀어요.', '다 풀면 「내 결과 복사하기」로 친구에게 결과를 보내요.', '서로 결과 메시지를 붙여 넣으면 순위가 나와요.']
            : ['「도전장 복사하기」를 눌러 카톡으로 친구에게 보내요.', '나도 「지금 풀기」로 풀어요. 친구가 먼저 풀어도 괜찮아요.', '서로 결과 메시지를 주고받아 붙여 넣으면 순위가 나와요.'])).map((t) => h('li', null, t))),
        h('div', { class: 'row center' }, h('button', { class: 'btn primary big', onclick: startNow }, '지금 풀기')));
    }

    // 대기실: 들어와 있는 사람이 모두 준비하면 5초 카운트다운 뒤 같이 시작
    function wait(ch) {
      stopSet(); App.clear(wrap);
      connect(ch);
      setLive({ st: 'ready', rt: nowS(), go: null });
      let T = null;
      const big = h('div', { class: 'count-big', 'aria-live': 'assertive' });
      const msg = h('p', { class: 'room-made-sub' });
      const lp = livePanel('함께 시작할 사람', '아직 아무도 없어요. 친구가 대결 코드를 열고 「지금 풀기」를 누르면 같이 시작해요.');
      put(
        backBar('대결 대기실'),
        h('section', { class: 'room-made count-wait' }, h('p', { class: 'room-made-head' }, '⏳ 준비 완료!'), msg, big),
        lp.el,
        h('div', { class: 'row center wrap' },
          h('button', { class: 'btn', onclick: () => { play(ch); top(); } }, '혼자 바로 시작'),
          h('button', { class: 'btn ghost', onclick: () => intro(ch, {}) }, '준비 취소')));
      let lastN = null;
      function step() {
        const now = nowS();
        const os = others();
        // 다른 사람이 이미 정한 시작 시각이 있으면 그걸 따름
        const gos = os.map((p) => p.presence).filter((x) => (x.st === 'ready') && typeof x.go === 'number' && x.go > now - 3000).map((x) => x.go);
        if (T == null && gos.length) T = Math.min(...gos);
        const waiting = os.filter((p) => p.presence.st === 'ready' || p.presence.st === 'idle' || !p.presence.st);
        if (T == null && waiting.length >= 1 && waiting.every((p) => p.presence.st === 'ready')) {
          T = Math.max(live && live.pres.rt || now, ...waiting.map((p) => Number(p.presence.rt) || now)) + 5000;
        }
        if (T != null && live && live.pres.go !== T) setLive({ go: T });
        if (T == null) {
          msg.textContent = waiting.length ? '들어와 있는 사람이 모두 「지금 풀기」를 누르면 5초 뒤에 같이 시작해요.' : '친구를 기다리는 중이에요.';
          big.textContent = '';
          return;
        }
        const rem = T - now;
        if (rem <= 0) { play(ch, { synced: true }); top(); return; }
        const n = Math.ceil(rem / 1000);
        msg.textContent = '모두 준비됐어요! 곧 시작해요.';
        if (n !== lastN) { lastN = n; big.textContent = String(Math.min(n, 5)); big.classList.remove('tick'); void big.offsetWidth; big.classList.add('tick'); }
      }
      liveHook = () => { lp.paint(); step(); };
      waitTimer = setInterval(step, 100);
      step();
    }

    function play(ch, po) {
      stopSet(); App.clear(wrap);
      const practice = !!loadRec(ch).mine;
      connect(ch);
      if (!practice) setLive({ st: 'play', k: 1, s: 0, n: ch.n, rt: null, go: null });
      const strip = h('div', { class: 'live-strip', 'aria-live': 'polite' });
      const paintStrip = () => {
        App.clear(strip);
        const os = others().filter((p) => p.presence.st === 'play' || p.presence.st === 'done');
        os.forEach((p) => strip.append(h('span', { class: 'pill' + (p.presence.st === 'done' ? ' win' : '') }, h('b', null, App.cleanNick(p.presence.nick)), ' ', p.presence.st === 'done' ? '다 풀었어요' : (p.presence.k || 1) + '/' + (p.presence.n || ch.n) + '번 · ' + (p.presence.s || 0) + '개 정답')));
        strip.hidden = !os.length;
      };
      liveHook = paintStrip;
      paintStrip();
      const body = h('div', { class: 'quick' });
      put(
        h('div', { class: 'mp-bar' }, h('span', { class: 'bar-label' }, practice ? '다시 풀기 ' : '대결 ', h('b', { class: 'code' }, ch.code)), h('span', { class: 'spacer' }),
          h('button', { class: 'btn tiny ghost', onclick: () => { if (practice) board(ch); else intro(ch, {}); } }, '그만두기')),
        practice ? h('p', { class: 'note' }, '이미 푼 대결이라 이번 기록은 순위에 들어가지 않아요.') : null,
        po && po.synced ? h('p', { class: 'note center-text' }, '🚩 다 같이 시작했어요!') : null,
        strip,
        body);
      set = problemSet(body, ctx, def, { seeds: seedsOf(ch), opts: ch.opts, label: '문제', onProgress: (round, results) => {
        if (!practice) setLive({ st: 'play', k: Math.min(round, ch.n), s: results.filter((r) => r.ok).length, n: ch.n });
      }, onEnd: (results) => {
        set = null;
        if (!practice) {
          const rec = loadRec(ch);
          rec.mine = { name: myName(), res: decodeEntries(encodeEntries(results), ch.n), at: Date.now() };
          saveRec(rec);
          setLive({ st: 'done', res: resultCode(ch, rec.mine), k: null, s: null });
        }
        board(ch, practice ? '다시 푼 기록은 저장하지 않았어요.' : '');
        top();
      } });
    }

    function board(ch, note) {
      stopSet(); App.clear(wrap);
      const rec = loadRec(ch);
      if (!rec.mine) { intro(ch, {}); return; }
      connect(ch);
      setLive({ st: 'done', res: resultCode(ch, rec.mine), k: null, s: null, rt: null, go: null });
      const lp = livePanel('이 대결에 들어와 있는 친구', '');
      liveHook = lp.paint;
      if (live) live.onResult = (names) => { if (liveHook === lp.paint) { App.toast('🏁 ' + names.join(', ') + '님 결과가 들어왔어요'); board(ch); } };
      const rows = ranked(rec);
      const me = rows.find((r) => r.me);
      const n = rows.length;
      const avg = rows.reduce((a, r) => a + r.s.total, 0) / n;
      const paste = h('textarea', { id: def.id + '-ch-res', class: 'input paste', rows: '2', placeholder: '친구가 보낸 결과 메시지를 통째로 붙여 넣으세요', 'aria-label': '친구 결과 메시지' });
      const addBtn = h('button', { class: 'btn', onclick: () => {
        const r = parseAny(paste.value);
        if (r.ch && r.ch.code === ch.code && !r.result && !r.err) { App.toast('대결 코드예요. 친구가 「내 결과 복사하기」로 보낸 메시지를 붙여 넣어 주세요.', 'warn'); return; }
        if (!r.ch) { App.toast(r.err, 'warn'); return; }
        open(paste.value);
      } }, '순위에 넣기');
      put(
        backBar('대결 결과'),
        h('div', { class: 'result-box ok' },
          h('p', { class: 'note' }, def.name + ' · ' + optLabel(def, ch.opts) + ' · ' + ch.n + '문제 · ' + ch.code),
          h('strong', { class: 'result-big' }, n > 1 ? n + '명 중 ' + me.rank + '등' : me.s.solved + ' / ' + ch.n + ' 정답'),
          h('p', null, '내 기록 ' + me.s.solved + '/' + ch.n + ' 정답 · 총 ' + fmtLong(me.s.total)),
          n > 1 ? h('p', { class: 'note' }, (n >= 3 ? '상위 ' + Math.round(me.rank / n * 100) + '% · ' : '') + '참가자 평균 ' + fmtLong(avg))
            : h('p', { class: 'note' }, '아직 나 혼자예요. 친구가 보낸 결과 메시지를 아래에 붙여 넣으면 순위가 나와요.'),
          note ? h('p', { class: 'note strong' }, note) : null),
        lp.el,
        shareBlock('내 결과 복사하기', resultText(ch, rec.mine)),
        h('table', { class: 'log rank' },
          h('thead', null, h('tr', null, ['등수', '이름', '정답', '총 시간', ''].map((x) => h('th', null, x)))),
          h('tbody', null, rows.map((r) => h('tr', { class: r.me ? 'me' : '' },
            h('td', null, r.rank), h('td', null, r.name, r.me ? ' (나)' : ''), h('td', null, r.s.solved + '/' + ch.n), h('td', { class: 'mono' }, App.fmtTime(r.s.total)),
            h('td', null, r.me ? null : h('button', { class: 'btn tiny ghost', 'aria-label': r.name + ' 결과 빼기', onclick: () => { const rc = loadRec(ch); rc.others.splice(r.idx, 1); saveRec(rc); board(ch); } }, '빼기')))))),
        h('div', { class: 'mode-card' }, h('h4', null, '친구 결과 넣기'), paste, addBtn),
        h('details', { class: 'chal-detail' }, h('summary', null, '내 문제별 기록'), resultTable(rec.mine.res)),
        h('div', { class: 'row center wrap' },
          h('button', { class: 'btn ghost', onclick: () => { intro(ch, {}); top(); } }, '도전장 다시 보내기'),
          h('button', { class: 'btn ghost', onclick: () => { play(ch); top(); } }, '같은 문제 다시 풀기')));
    }

    const pend = App.store.get('ch.pending', null);
    if (pend && pend.g === def.id) { App.store.set('ch.pending', null); open(pend.text); } else home();
    return () => { stopSet(); disconnect(); };
  }

  // ---------- 온라인 경주 화면 ----------
  function race(root, ctx, def) {
    const engine = raceEngine(def);
    return App.multi.mount(root, ctx, {
      gameId: def.id,
      engine,
      soloLabel: '컴퓨터와 경주',
      renderOptions(o, s, disabled) {
        const bar = h('div', { class: 'toolbar' });
        def.optionsUI(bar, s.W.o, (k, v) => s.setOpt(k, v), disabled);
        bar.append(h('span', { class: 'opt-label' }, '라운드'),
          h('div', { class: 'seg small' }, [3, 5, 7].map((n) => h('button', { class: 'seg-btn' + (s.W.o.rounds === n ? ' on' : ''), disabled, onclick: () => s.setOpt('rounds', n) }, n + '판'))));
        o.append(bar);
      },
      renderGame(g, s) {
        const W = s.W, st = W.s, me = s.mySeat;
        const names = W.pl.map((p) => p.n);
        const L = s.local;
        const key = W.gn + ':' + st.round;
        if (L.key !== key) {
          if (L.comp && L.comp.destroy) L.comp.destroy();
          L.key = key;
          L.pz = puzzleOf(def, st.seed, st.o);
          App.quick.lastPuzzle = L.pz; // 점검용
          L.sentDone = false;
          L.comp = def.mount(L.pz, { done: () => { if (!L.sentDone && me >= 0) { L.sentDone = true; s.send({ t: 'done' }); } }, locked: () => false, solo: false });
          L.revealed = false;
        }
        const lockRem = me >= 0 ? st.lockRem[me] - (Date.now() - s.receivedAt) : 0;
        g.append(h('div', { class: 'q-head' },
          h('span', { class: 'pill strong' }, st.ph === 'end' ? '경주 종료' : '라운드 ' + st.round + ' / ' + st.rounds),
          W.pl.map((p, i) => h('span', { class: 'pill' + (i === me ? ' me' : '') + (st.win === i && st.ph !== 'play' ? ' win' : '') },
            h('span', { class: 'seat-dot', style: { background: `var(--p${i})` } }), p.n, ' ', h('b', { class: 'mono' }, String(st.pts[i])),
            st.lockRem[i] > 0 && st.ph === 'play' ? h('span', { class: 'chip-tag warn' }, '잠김') : null))));
        if (st.ph === 'play') {
          if (def.prompt) g.append(def.prompt(L.pz));
          g.append(L.comp.el);
          if (me >= 0) {
            if (def.kind === 'number') {
              const locked = lockRem > 0;
              if (!L.row || L.rowKey !== key) {
                L.rowKey = key;
                L.row = answerRow(def.id + '-race-ans', (v) => s.send({ t: 'ans', v }), false);
                L.focused = false;
                L.row.inp.addEventListener('focus', () => { L.focused = true; });
                L.row.inp.addEventListener('blur', () => { if (L.row.inp.isConnected) L.focused = false; });
              }
              const row = L.row;
              row.inp.disabled = locked || s.waiting;
              row.btn.disabled = locked || s.waiting;
              g.append(row.el);
              if (L.focused && !row.inp.disabled) setTimeout(() => { try { row.inp.focus({ preventScroll: true }); } catch (e) { /* 무시 */ } }, 0);
              if (locked) {
                g.append(h('p', { class: 'status' }, '틀렸어요. ', h('b', { 'data-until': String(Date.now() + lockRem) }, Math.ceil(lockRem / 1000) + '초'), ' 동안 답할 수 없어요.'));
                clearTimeout(L.unlockT);
                L.unlockT = setTimeout(() => s.onUpdate(s), lockRem + 80);
              } else g.append(h('p', { class: 'status' }, s.waiting ? '확인하는 중…' : '먼저 맞히는 사람이 1점! 틀리면 20초 동안 답할 수 없어요.'));
            } else {
              g.append(h('p', { class: 'status' }, L.sentDone ? '완성! 확인하는 중…' : '가장 먼저 완성하는 사람이 1점!'));
            }
          }
          if (st.last && st.last[0] !== me) g.append(h('p', { class: 'note' }, names[st.last[0]] + '이(가) ' + st.last[1] + '(으)로 답했다가 틀렸어요.'));
        } else {
          if (!L.revealed && L.comp.reveal) { L.comp.reveal(); L.revealed = true; }
          const title = st.win >= 0 ? (st.win === me ? '내가 먼저 맞혔어요!' : names[st.win] + ' 득점') : '아무도 못 맞혔어요';
          g.append(h('div', { class: 'result-box' + (st.win === me ? ' ok' : '') },
            h('strong', { class: 'result-big' }, st.ph === 'end' ? rankText(st, names, me) : title),
            st.ph === 'end' ? h('p', null, W.pl.map((p, i) => p.n + ' ' + st.pts[i] + '점').join(' · ')) : h('p', { class: 'note' }, '다음 라운드가 곧 시작돼요.'),
            def.explainHasBoard ? null : L.comp.el,
            def.explain(L.pz)));
        }
      },
    });
  }

  function rankText(st, names, me) {
    const best = Math.max(...st.pts);
    const winners = st.pts.map((p, i) => (p === best ? i : -1)).filter((i) => i >= 0);
    if (winners.length > 1) return '공동 1위: ' + winners.map((i) => names[i]).join(', ');
    return winners[0] === me ? '우승!' : names[winners[0]] + ' 우승';
  }

  // ---------- 등록 ----------
  App.quick = {
    register(def) {
      byPrefix[prefixOf(def)] = def;
      App.games.push({
        id: def.id, name: def.name, kicker: def.kicker, players: '혼자 · 대결 코드 · 온라인 경주', blurb: def.blurb, rules: def.rules, guide: def.guide,
        mount(root, ctx) {
          const tabs = h('div', { class: 'seg', role: 'tablist' });
          const body = h('div');
          root.append(tabs, body);
          let cleanup = null;
          function setMode(m) {
            if (cleanup) cleanup();
            App.clear(body); App.clear(tabs);
            [['solo', '혼자 연습'], ['chal', '대결 코드'], ['race', '온라인 경주']].forEach(([id, label]) => tabs.append(h('button', { class: 'seg-btn' + (m === id ? ' on' : ''), role: 'tab', 'aria-selected': m === id ? 'true' : 'false', onclick: () => setMode(id) }, label)));
            cleanup = m === 'solo' ? solo(body, ctx, def) : m === 'chal' ? challenge(body, ctx, def) : race(body, ctx, def);
          }
          const pend = App.store.get('ch.pending', null);
          setMode(pend && pend.g === def.id ? 'chal' : 'solo');
          return () => { if (cleanup) cleanup(); };
        },
      });
    },
    srng, newSeed, puzzleOf, raceEngine,
    ch: { makeCode, parseChallenge, parseAny, seedsOf, resultCode, encodeEntries, decodeEntries, domainsOf, optLabel, ranked, defs: byPrefix },
  };
})();
