/* 빨리 풀기 게임 공용 틀: 시드 난수, 혼자 연습(5문제), 오늘의 문제(전체 순위), 온라인 대결(빨리 맞히기·팀전 / 기록 대결) */
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

  // ---------- 온라인 대결 규칙: 빨리 맞히기(개인전·팀전) / 기록 대결 ----------
  const TEAMS = ['A팀', 'B팀'];
  const netNow = () => (App.Net && App.Net.now ? App.Net.now() : Date.now());
  function seedsFrom(seed, n) { const r = srng((seed ^ 0x5bd1e995) >>> 0); return Array.from({ length: n }, () => Math.floor(r.f() * 2147483647)); }
  const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(Number(v) || 0)));

  function duelEngine(def) {
    const e = {
      id: def.id,
      minPlayers: 2, maxPlayers: 6, allowBots: true, defaultBots: 2,
      defaultOpts: Object.assign({ mode: 'fast', rounds: 5, count: 5, team: 0 }, def.defaultOpts),
      botNames: ['컴퓨터 A', '컴퓨터 B', '컴퓨터 C', '컴퓨터 D', '컴퓨터 E'],
      canStart(W) {
        if (W.o.mode !== 'rec' && W.o.team) {
          const c = [0, 0];
          W.pl.forEach((x) => { c[x.tm ? 1 : 0]++; });
          if (!c[0] || !c[1]) return '두 팀에 한 명 이상씩 있어야 해요. 「팀 자동 나누기」를 눌러 보세요.';
        }
        return null;
      },
      start(players, o, info) {
        if (o.mode === 'rec') return recStart(players, o, info);
        const n = players.length;
        const G = { mode: 'fast', n, o: Object.assign({}, o), team: o.team ? 1 : 0, tm: players.map((p) => (p.tm ? 1 : 0)), rounds: o.rounds || 5, round: 0, pts: Array(n).fill(0), wrong: Array(n).fill(0), lock: Array(n).fill(0), ph: 'play', win: -1, seed: 0, until: 0, last: null };
        nextRound(G);
        return G;
      },
      act(G, seat, a) {
        if (G.mode === 'rec') return recAct(G, seat, a);
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
        if (G.mode === 'rec') return false;
        if (G.ph === 'play' && now >= G.until) { G.win = -1; G.ph = 'reveal'; G.until = now + REVEAL_MS; return true; }
        if (G.ph === 'reveal' && now >= G.until) {
          if (G.round >= G.rounds) { G.ph = 'end'; return true; }
          nextRound(G);
          return true;
        }
        return false;
      },
      pending(G) {
        if (G.mode === 'rec') return G.st.map((x, i) => (x.d ? -1 : i)).filter((i) => i >= 0);
        if (G.ph !== 'play') return [];
        const now = Date.now();
        return [...Array(G.n).keys()].filter((s) => G.lock[s] <= now);
      },
      timeLimit() { return 0; },
      botDelay(G, seat) {
        if (G.mode === 'rec') {
          if (!G.bots[seat]) return 30000; // 연결이 끊긴 사람: 30초 기다렸다가 그만둔 것으로
          const pz = puzzleOf(def, G.seeds[G.st[seat].k - 1], G.o);
          return Math.max(0, G.go - netNow()) + def.botTime(pz, G.o) * 1000 * (0.65 + Math.random() * 0.9);
        }
        const pz = puzzleOf(def, G.seed, G.o);
        return def.botTime(pz, G.o) * 1000 * (0.65 + Math.random() * 0.9);
      },
      bot(G, seat) {
        if (G.mode === 'rec') return G.bots[seat] ? { t: 'bot' } : { t: 'quit' };
        const pz = puzzleOf(def, G.seed, G.o);
        if (def.kind === 'task') return { t: 'done' };
        const ans = def.answer(pz);
        if (Math.random() < 0.82) return { t: 'ans', v: ans };
        return { t: 'ans', v: Math.max(0, ans + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 2))) };
      },
      timeout() { return null; },
      publicView(G) {
        if (G.mode === 'rec') return { mode: 'rec', n: G.cnt, o: G.o, seed: G.seed, go: G.go, key: G.key, ph: G.ph, st: G.st.map((x) => ({ k: x.k, s: x.s, d: x.d, r: x.r, q: x.q })) };
        const now = Date.now();
        return {
          mode: 'fast', team: G.team, tm: G.tm,
          o: G.o, rounds: G.rounds, round: G.round, seed: G.seed, ph: G.ph, pts: G.pts, wrong: G.wrong, win: G.win, last: G.last,
          lockRem: G.lock.map((t) => Math.max(0, t - now)), rem: Math.max(0, G.until - now),
        };
      },
      over(G) { return G.ph === 'end'; },
      results(G) {
        if (G.mode === 'rec') {
          const sums = G.st.map((x) => summarize(decodeEntries(x.r, G.cnt) || []));
          return { rec: true, scores: sums.map((m) => m.solved * 1e7 - Math.round(m.total / 100)) };
        }
        if (G.team) {
          const tp = [0, 0];
          G.pts.forEach((p, i) => { tp[G.tm[i]] += p; });
          const win = tp[0] === tp[1] ? -1 : tp[0] > tp[1] ? 0 : 1;
          return { pts: G.pts, team: tp, scores: G.tm.map((t) => tp[t]), places: G.tm.map((t) => (win < 0 || t === win ? 'live' : 'prison')) };
        }
        return { pts: G.pts, scores: G.pts.slice(), tb: G.wrong.map((w) => -w) };
      },
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
    // 기록 대결: 같은 문제 묶음을 각자 끝까지. 5초 뒤(서버 시각 기준) 같이 시작
    function recStart(players, o, info) {
      const cnt = o.count || 5, seed = newSeed() >>> 0;
      const key = info && info.code ? ('rec-' + info.gameId + '-' + info.code + '-' + seed.toString(36)).toLowerCase().replace(/[^a-z0-9-]/g, '') : null;
      const go = netNow() + 5000;
      return {
        mode: 'rec', cnt, o: Object.assign({}, o), seed, seeds: seedsFrom(seed, cnt), key, go, ph: 'play',
        bots: players.map((p) => !!p.b), st: players.map(() => ({ k: 1, s: 0, d: 0, r: '', q: 0 })), la: players.map(() => go), bt: players.map(() => []),
      };
    }
    function recAct(G, seat, a) {
      const x = G.st[seat];
      if (!x || x.d) throw new Error('이미 다 풀었어요');
      if (a && a.t === 'prog') { x.k = clampInt(a.k, 1, G.cnt); x.s = clampInt(a.s, 0, G.cnt); }
      else if (a && a.t === 'fin') {
        const res = decodeEntries(String(a.r || ''), G.cnt);
        if (!res) throw new Error('기록을 읽지 못했어요');
        x.d = 1; x.r = String(a.r); x.k = G.cnt; x.s = res.filter((r) => r.ok).length;
      } else if (a && a.t === 'bot') {
        const now = netNow();
        const ok = Math.random() < 0.85;
        G.bt[seat].push({ ok, time: Math.max(1500, now - G.la[seat]), wrong: ok ? 0 : 1 });
        G.la[seat] = now;
        if (ok) x.s++;
        if (x.k >= G.cnt) { x.d = 1; x.r = encodeEntries(G.bt[seat]); } else x.k++;
      } else if (a && a.t === 'quit') {
        x.d = 1; x.q = 1; x.r = encodeEntries(Array.from({ length: G.cnt }, () => ({ ok: false, time: 0, wrong: 0 })));
      } else throw new Error('잘못된 행동');
      if (G.st.every((y) => y.d)) G.ph = 'end';
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

  // ---------- 문제 묶음 풀기 (혼자 연습·오늘의 문제·기록 대결 공용) ----------
  // cfg: { seeds, opts, toolbar(): el|null, label, onEnd(results) }
  let tuneNo = 0;
  function problemSet(wrap, ctx, def, cfg) {
    const seeds = cfg.seeds, N = seeds.length, opts = cfg.opts;
    let round = 0, cur = null, dead = false;
    const results = [];
    const tune = 'set:' + def.id + ':' + (++tuneNo); // 배경 음악: 문제를 푸는 동안
    const music = (play) => { if (App.music) { if (play) App.music.claim(tune); else App.music.release(tune); } };

    function next() {
      if (dead) return;
      if (cur && cur.comp && cur.comp.destroy) cur.comp.destroy();
      round++;
      if (round > N) { cur = null; stop(); music(false); cfg.onEnd(results.slice()); return; }
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
        const lockMs = cfg.lockMs || SOLO_LOCK;
        cur.lockUntil = Date.now() + lockMs;
        cur.msg = v + '개는 아니에요. ' + Math.round(lockMs / 1000) + '초 뒤에 다시 답할 수 있어요.';
        draw();
        const me = cur;
        setTimeout(() => { if (!dead && cur === me && !me.done) { me.msg = '다시 답해 보세요.'; draw(); } }, lockMs + 50);
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
    music(true);
    next();
    return {
      destroy() { dead = true; stop(); music(false); if (cur && cur.comp && cur.comp.destroy) cur.comp.destroy(); },
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
        h('p', { class: 'note' }, '다른 사람과 순위를 겨뤄 보고 싶다면 위의 「오늘의 문제」나 「온라인 대결」을 해 보세요.')));
    }

    restart();
    return () => { if (set) set.destroy(); };
  }

  // ---------- 기록·순위 공용 도구 ----------
  const SHARE_URL = App.SHARE_URL || 'https://claude.ai/artifact/7PS8wBkQySgG8HmrkLpRRG';
  const hasServer = () => !!(App.fire && App.fire.enabled && App.fire.enabled());
  // 서버에 붙을 수 있으면 요청, 아니면 {code:'full'} 로 실패 (가득 찬 동안 요청이 끝없이 멈춰 있는 것을 막음)
  async function serverCall(fn, ms) {
    if (!(await App.fire.ready(9000))) throw { code: 'full' };
    return App.fire.wait(fn(), ms || 10000);
  }
  const downNote = (e) => (e && (e.code === 'full' || e.code === 'timeout') ? App.fire.problemText() : '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.');
  const myNick = () => App.cleanNick(App.store.get('nick', ''));
  const pad2 = (x) => String(x).padStart(2, '0');
  function optLabel(def, opts) {
    const tmp = h('div');
    def.optionsUI(tmp, opts, () => {}, true);
    return [...tmp.querySelectorAll('.seg-btn.on')].map((b) => b.textContent).join(' · ');
  }
  // 문제별 기록을 짧은 글자로: 정답이면 시간(0.1초, 36진수), 포기면 앞에 !, 오답 수는 ~숫자
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
  function summarize(res) {
    return { solved: res.filter((r) => r.ok).length, total: res.reduce((a, r) => a + r.time, 0), wrong: res.reduce((a, r) => a + (r.wrong || 0), 0) };
  }
  function fmtLong(ms) { const s = Math.round(ms / 1000); return (s >= 60 ? Math.floor(s / 60) + '분 ' : '') + (s % 60) + '초'; }
  // 순위: 맞힌 문제가 많을수록, 같으면 총 시간이 짧을수록 위
  function rankRows(rows, n) {
    const all = rows.map((x) => { const res = decodeEntries(x.r, n); return res ? { name: App.cleanNick(x.name), me: !!x.me, s: summarize(res) } : null; }).filter(Boolean);
    all.sort((a, b) => b.s.solved - a.s.solved || a.s.total - b.s.total);
    all.forEach((r, i) => { const p = all[i - 1]; r.rank = p && p.s.solved === r.s.solved && p.s.total === r.s.total ? p.rank : i + 1; });
    return all;
  }
  const topPct = (rank, N) => Math.max(1, Math.round(rank / N * 100));
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
    const ta = h('textarea', { class: 'input share-text', rows: '4', readonly: true, 'aria-label': '보낼 글' });
    ta.value = text;
    const det = h('details', { class: 'share-det' }, h('summary', null, '보낼 글 미리 보기'), ta);
    const btn = h('button', { class: 'btn primary big', onclick: async () => {
      const ok = await copyText(text);
      if (ok) App.toast('복사했어요. 카톡 대화창에 붙여 넣어 보내세요.');
      else { App.toast('자동 복사가 막혀 있어요. 아래 글을 길게 눌러 복사해 주세요.', 'warn'); det.open = true; ta.focus(); ta.select(); }
    } }, '📋 ' + label);
    return h('div', { class: 'share-block' }, btn, det);
  }
  function nickField(id) {
    const inp = h('input', { id, class: 'input', maxlength: '12', placeholder: '닉네임', value: App.store.get('nick', '') });
    inp.addEventListener('input', () => App.store.set('nick', inp.value));
    return h('label', { class: 'field', for: id }, h('span', null, '내 닉네임 (순위에 표시돼요)'), inp);
  }

  // 서버에 모인 기록으로 순위 상자 (N명 중 N위, 상위 %, 평균 시간)
  function rankBox(key, n, o) {
    const box = h('section', { class: 'rank-box', 'aria-live': 'polite' }, h('p', { class: 'note center-text' }, '순위를 불러오는 중…'));
    let offOk = null, started = false;
    const stopWatch = () => { if (offOk) { offOk(); offOk = null; } };
    function retry() { stopWatch(); App.clear(box); box.append(h('p', { class: 'note center-text' }, '순위를 불러오는 중…')); load(); }
    function load() {
      started = true;
      serverCall(async () => {
        let rows = await App.fire.results(key);
        // 서버가 가득 찼을 때 끝낸 기록은 이 기기에만 있음 → 연결되면 그때 올림
        const local = o.localKey ? App.store.get(o.localKey, null) : null;
        if (local && local.r && !rows.some((x) => x.me) && (await App.fire.saveResult(key, myNick(), local.r))) rows = await App.fire.results(key);
        return rows;
      }, 15000).then((rows) => {
        App.clear(box);
        const all = rankRows(rows, n);
        const me = all.find((r) => r.me);
        const N = all.length;
        const avg = N ? all.reduce((a, r) => a + r.s.total, 0) / N : 0;
        const top = all.slice(0, 10);
        if (me && !top.includes(me)) top.push(me);
        box.append(
          h('div', { class: 'result-box ok' },
            h('p', { class: 'note' }, o.title),
            h('strong', { class: 'result-big' }, me ? N + '명 중 ' + me.rank + '위' : N + '명 참가'),
            me ? h('p', null, '상위 ' + topPct(me.rank, N) + '% · 내 기록 ' + me.s.solved + '/' + n + ' 정답 · ' + fmtLong(me.s.total)) : null,
            h('p', { class: 'note' }, N ? '참가자 평균 ' + fmtLong(avg) + ' · 1위 ' + all[0].name + ' ' + fmtLong(all[0].s.total) : '아직 기록이 없어요.')),
          N ? h('table', { class: 'log rank' },
            h('thead', null, h('tr', null, ['순위', '이름', '정답', '총 시간'].map((x) => h('th', null, x)))),
            h('tbody', null, top.map((r) => h('tr', { class: r.me ? 'me' : '' }, h('td', null, r.rank), h('td', null, r.name, r.me ? ' (나)' : ''), h('td', null, r.s.solved + '/' + n), h('td', { class: 'mono' }, App.fmtTime(r.s.total)))))) : null,
          h('div', { class: 'row center' }, h('button', { class: 'btn tiny ghost', onclick: () => { App.clear(box); box.append(h('p', { class: 'note center-text' }, '순위를 불러오는 중…')); load(); } }, '↻ 순위 새로고침')),
          me && o.share ? shareBlock('결과 공유하기', o.share(me, N)) : null);
      }).catch((e) => {
        if (!box.isConnected && started) return;
        App.clear(box);
        const mine = o.localKey && App.store.get(o.localKey, null);
        const m = mine && mine.r ? summarize(decodeEntries(mine.r, n) || []) : null;
        box.append(
          m ? h('div', { class: 'result-box ok' }, h('p', { class: 'note' }, o.title), h('strong', { class: 'result-big' }, m.solved + ' / ' + n + ' 정답 · ' + fmtLong(m.total))) : null,
          h('p', { class: 'note warn-note' }, downNote(e)),
          m ? h('p', { class: 'note center-text' }, '내 기록은 이 기기에 저장해 두었어요. 이 화면을 열어 둔 채 서버에 연결되면 순위에 자동으로 올라가요.') : null,
          h('div', { class: 'row center' }, h('button', { class: 'btn tiny', onclick: retry }, '다시 시도')));
        // 서버에 다시 연결되면 저절로 다시 불러오고(이 기기 기록도 올림)
        if (!offOk) offOk = App.fire.onStatus((st) => {
          if (!box.isConnected) { stopWatch(); return; }
          if (st === 'ok') { stopWatch(); retry(); }
        });
      });
    }
    load();
    return box;
  }

  // 같은 문제 묶음을 풀고 서버 순위에 넣는 화면 (오늘의 문제, 기록 대결을 나중에 풀기)
  // cfg: { key, seeds, opts, n, localKey, head, sub, lead, barLabel, title, share(me,N), leave }
  function setFlow(box, ctx, def, cfg) {
    let ps = null;
    const stop = () => { if (ps) { ps.destroy(); ps = null; } };
    const put = (...els) => box.append(...els.filter(Boolean));
    const top = () => { try { box.scrollIntoView({ block: 'start' }); } catch (e) { /* 무시 */ } };
    const leaveBtn = cfg.leave ? h('button', { class: 'btn ghost', onclick: () => { stop(); cfg.leave(); } }, '나가기') : null;
    function intro() {
      stop(); App.clear(box);
      if (App.store.get(cfg.localKey, null)) { result(); return; }
      const stats = h('p', { class: 'note' }, hasServer() ? '참가 현황을 불러오는 중…' : '');
      put(
        cfg.lead ? h('p', { class: 'chal-lead' }, cfg.lead) : null,
        h('section', { class: 'room-made' }, h('p', { class: 'room-made-head' }, cfg.head), h('p', { class: 'room-made-sub' }, cfg.sub), stats),
        nickField(def.id + '-set-nick'),
        h('div', { class: 'row center wrap' }, h('button', { class: 'btn primary big', onclick: () => { play(false); top(); } }, '시작하기'), leaveBtn));
      if (hasServer()) {
        serverCall(() => App.fire.results(cfg.key)).then((rows) => {
          const all = rankRows(rows, cfg.n);
          if (all.some((r) => r.me)) { App.store.set(cfg.localKey, { at: Date.now() }); if (stats.isConnected) result(); return; }
          const avg = all.length ? all.reduce((a, r) => a + r.s.total, 0) / all.length : 0;
          stats.textContent = all.length ? '지금까지 ' + all.length + '명 참가 · 평균 ' + fmtLong(avg) : '아직 아무도 안 풀었어요. 첫 번째로 풀어 보세요!';
        }).catch((e) => { stats.textContent = downNote(e) + ' 문제는 지금 풀 수 있고, 기록은 연결되면 올라가요.'; stats.classList.add('warn-note'); });
      }
    }
    function play(practice) {
      stop(); App.clear(box);
      const body = h('div', { class: 'quick' });
      put(
        h('div', { class: 'mp-bar' }, h('span', { class: 'bar-label' }, practice ? '다시 풀기 (순위에 안 들어가요)' : cfg.barLabel), h('span', { class: 'spacer' }),
          h('button', { class: 'btn tiny ghost', onclick: () => (practice ? result() : intro()) }, '그만두기')),
        body);
      ps = problemSet(body, ctx, def, { seeds: cfg.seeds, opts: cfg.opts, label: '문제', lockMs: practice ? SOLO_LOCK : RACE_LOCK, onEnd: async (results) => {
        ps = null;
        if (practice) { const m = summarize(results); result('다시 푼 기록: ' + m.solved + '/' + cfg.n + ' 정답 · ' + fmtLong(m.total) + ' (순위에는 처음 기록만 들어가요)'); top(); return; }
        const r = encodeEntries(results);
        App.store.set(cfg.localKey, { r, at: Date.now() });
        App.clear(box); put(h('p', { class: 'note center-text' }, '기록을 저장하는 중…'));
        if (hasServer()) { try { await serverCall(() => App.fire.saveResult(cfg.key, myNick(), r)); } catch (e) { /* 순위 상자에서 연결되면 다시 올림 */ } }
        if (!box.isConnected) return;
        result(); top();
      } });
    }
    function result(note) {
      stop(); App.clear(box);
      const local = App.store.get(cfg.localKey, null);
      const mine = local && local.r ? summarize(decodeEntries(local.r, cfg.n) || []) : null;
      put(
        note ? h('p', { class: 'note strong center-text' }, note) : null,
        hasServer() ? rankBox(cfg.key, cfg.n, { title: cfg.title, share: cfg.share, localKey: cfg.localKey })
          : h('div', { class: 'result-box ok' }, h('p', { class: 'note' }, cfg.title), mine ? h('strong', { class: 'result-big' }, mine.solved + ' / ' + cfg.n + ' 정답 · ' + fmtLong(mine.total)) : null, h('p', { class: 'note' }, '전체 순위는 온라인에 연결된 사이트에서 볼 수 있어요.')),
        h('div', { class: 'row center wrap' }, h('button', { class: 'btn ghost', onclick: () => { play(true); top(); } }, '같은 문제 다시 풀기'), leaveBtn));
    }
    intro();
    return stop;
  }

  // ---------- 오늘의 문제: 날마다 모두에게 같은 문제, 전체 순위 ----------
  function kstDay(ms) { const d = new Date(ms + 9 * 3600e3); return { ymd: d.toISOString().slice(0, 10).replace(/-/g, ''), label: (d.getUTCMonth() + 1) + '월 ' + d.getUTCDate() + '일' }; }
  function hashStr(s) { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
  function daily(root, ctx, def) {
    const wrap = h('div', { class: 'chal' });
    root.append(wrap);
    const day = kstDay(netNow());
    const n = def.dailyCount || 5;
    const opts = Object.assign({}, def.defaultOpts, def.dailyOpts);
    const key = 'day-' + def.id + '-' + day.ymd;
    return setFlow(wrap, ctx, def, {
      key, seeds: seedsFrom(hashStr(key), n), opts, n, localKey: 'daily.' + key,
      head: '📅 ' + day.label + ' 오늘의 문제', sub: def.name + ' · ' + optLabel(def, opts) + ' · ' + n + '문제',
      lead: '오늘 이 문제를 푼 모든 사람과 순위를 겨뤄요. 하루에 첫 기록만 순위에 들어가고, 내일은 새 문제가 나와요.',
      barLabel: '📅 오늘의 문제', title: day.label + ' 오늘의 문제 · ' + def.name,
      share: (me, N) => '🧠 [' + def.name + '] ' + day.label + ' 오늘의 문제\n' + N + '명 중 ' + me.rank + '위 (상위 ' + topPct(me.rank, N) + '%) · ' + me.s.solved + '/' + n + ' 정답 · ' + fmtLong(me.s.total) + '\n나도 도전 → ' + SHARE_URL,
    });
  }

  // ---------- 온라인 대결 화면 ----------
  function race(root, ctx, def) {
    const engine = duelEngine(def);
    const tagEl = (t, c) => h('span', { class: 'chip-tag' + (c ? ' ' + c : '') }, t);
    const segRow = (label, key, list, W, s, disabled) => [label ? h('span', { class: 'opt-label' }, label) : null,
      h('div', { class: 'seg small' }, list.map(([v, l]) => h('button', { class: 'seg-btn' + (W.o[key] === v ? ' on' : ''), disabled, onclick: () => s.setOpt(key, v) }, l)))].filter(Boolean);

    // 늦게 온 사람: 방장이 떠난 기록 대결은 서버에 남은 문제 묶음으로 풀기
    async function lateJoin(code) {
      if (!hasServer()) return null;
      const set = await App.fire.getSet((def.id + '-' + code).toLowerCase());
      if (!set || !set.key || !set.n || set.seed == null) return null;
      return (leave) => {
        const box = h('div', { class: 'chal' });
        const opts = Object.assign({}, def.defaultOpts, set.o);
        const when = set.at ? new Date(set.at) : null;
        box._stop = setFlow(box, ctx, def, {
          key: set.key, seeds: seedsFrom(set.seed, set.n), opts, n: set.n, localKey: 'rec.' + set.key,
          head: '📨 방 코드 ' + code + ' 기록 대결', sub: def.name + ' · ' + optLabel(def, opts) + ' · ' + set.n + '문제' + (when ? ' · ' + (when.getMonth() + 1) + '/' + when.getDate() + ' ' + pad2(when.getHours()) + ':' + pad2(when.getMinutes()) + ' 시작' : ''),
          lead: '방장은 이미 나갔지만, 같은 문제를 풀면 이 대결의 순위에 합쳐져요.',
          barLabel: '기록 대결 ' + code, title: '방 코드 ' + code + ' 기록 대결 · ' + def.name, leave,
          share: (me, N) => '🧠 [' + def.name + '] 기록 대결 ' + code + '\n' + N + '명 중 ' + me.rank + '위 · ' + me.s.solved + '/' + set.n + ' 정답 · ' + fmtLong(me.s.total) + '\n같은 문제 풀기: 「' + def.name + '」 → 「온라인 대결」 → 방 코드 ' + code + '\n' + SHARE_URL,
        });
        return box;
      };
    }

    // 기록 대결 화면이 만든 문제 묶음·카운트다운·늦게 푸는 화면 정리 (나가기, 다음 판, 화면 닫기)
    function disposeRec(s) {
      const L = s.local;
      if (L.set && L.set.destroy) L.set.destroy();
      L.set = null;
      clearInterval(L.cd); L.cd = null;
      if (L.lateStop) { L.lateStop(); L.lateStop = null; }
    }

    function progressPills(W, st, me) {
      const els = W.pl.map((p, i) => {
        if (i === me) return null;
        const x = st.st[i];
        return h('span', { class: 'pill' + (x.d ? ' win' : '') }, h('b', null, p.n), ' ', x.d ? (x.q ? '그만뒀어요' : '다 풀었어요 · ' + x.s + '개 정답') : x.k + '/' + st.n + '번 · ' + x.s + '개 정답');
      }).filter(Boolean);
      return els.length ? h('div', { class: 'live-strip', 'aria-live': 'polite' }, els) : null;
    }

    function renderRec(g, s) {
      const W = s.W, st = W.s, me = s.mySeat, L = s.local;
      const gk = W.gn + ':rec';
      if (L.key !== gk) {
        disposeRec(s);
        Object.assign(L, { key: gk, set: null, fin: null, cd: null, seeds: seedsFrom(st.seed, st.n), wrap: h('div', { class: 'quick' }), setSaved: false, lateBox: null, lateStop: null, allBox: null });
      }
      // 방장: 나중에 같은 방 코드로 오는 사람을 위해 문제 묶음을 서버에 남김
      if (s.isHost && st.key && !L.setSaved && hasServer()) { L.setSaved = true; App.fire.putSet((def.id + '-' + s.code).toLowerCase(), st.key, { g: def.id, o: st.o, n: st.n, seed: st.seed }); }
      g.append(h('div', { class: 'q-head' }, h('span', { class: 'pill strong' }, '기록 대결 · ' + st.n + '문제'), h('span', { class: 'pill' }, optLabel(def, st.o))));
      // 시작 전 카운트다운
      if (W.ph !== 'end' && me >= 0 && netNow() < st.go) {
        const big = h('div', { class: 'count-big', 'aria-live': 'assertive' });
        g.append(h('section', { class: 'room-made count-wait' }, h('p', { class: 'room-made-head' }, '곧 다 같이 시작해요!'), big));
        const paint = () => {
          const rem = st.go - netNow();
          if (rem <= 0) { clearInterval(L.cd); L.cd = null; s.onUpdate(s); return; }
          const t = String(Math.min(5, Math.ceil(rem / 1000)));
          if (big.textContent !== t) { big.textContent = t; big.classList.remove('tick'); void big.offsetWidth; big.classList.add('tick'); }
        };
        clearInterval(L.cd); L.cd = setInterval(paint, 100); paint();
        return;
      }
      clearInterval(L.cd); L.cd = null;
      // 푸는 중
      if (me >= 0 && !L.fin && !st.st[me].d && W.ph !== 'end') {
        if (!L.set) {
          L.set = 'starting';
          setTimeout(() => {
            if (s.closed || s._disposed || s.local !== L || L.key !== gk || L.set !== 'starting') return;
            L.set = problemSet(L.wrap, ctx, def, { seeds: L.seeds, opts: st.o, label: '문제', lockMs: RACE_LOCK,
              onProgress: (round, results) => { const ok = results.filter((r) => r.ok).length; setTimeout(() => s.send({ t: 'prog', k: Math.min(round, st.n), s: ok }), 0); },
              onEnd: (results) => {
                L.set = null; L.fin = results;
                const r = encodeEntries(results);
                s.send({ t: 'fin', r });
                if (st.key && hasServer()) App.fire.saveResult(st.key, myNick(), r);
                s.onUpdate(s);
              } });
          }, 0);
        }
        g.append(progressPills(W, st, me) || '', L.wrap);
        return;
      }
      // 다 풀었거나 끝남: 방 순위
      const rows = W.pl.map((p, i) => {
        const x = st.st[i];
        const res = x.d ? decodeEntries(x.r, st.n) : null;
        return { i, name: p.n, me: i === me, x, m: res ? summarize(res) : null };
      });
      const done = rows.filter((r) => r.m && !r.x.q).sort((a, b) => b.m.solved - a.m.solved || a.m.total - b.m.total);
      const myRank = done.findIndex((r) => r.me) + 1;
      if (W.ph !== 'end') g.append(h('p', { class: 'status' }, me >= 0 ? '다 풀었어요! 다른 사람이 끝나기를 기다리는 중…' : '기록 대결이 진행 중이에요.'), progressPills(W, st, me) || '');
      else g.append(h('div', { class: 'result-box ok' }, h('strong', { class: 'result-big' }, myRank ? done.length + '명 중 ' + myRank + '위' : '기록 대결 끝'), myRank ? h('p', null, '상위 ' + topPct(myRank, done.length) + '% · 내 기록 ' + done[myRank - 1].m.solved + '/' + st.n + ' 정답 · ' + fmtLong(done[myRank - 1].m.total)) : null,
        done.length ? h('p', { class: 'note' }, '평균 ' + fmtLong(done.reduce((a, r) => a + r.m.total, 0) / done.length)) : null));
      g.append(h('table', { class: 'log rank' },
        h('thead', null, h('tr', null, ['순위', '이름', '정답', '총 시간'].map((x) => h('th', null, x)))),
        h('tbody', null, done.map((r, k) => h('tr', { class: r.me ? 'me' : '' }, h('td', null, k + 1), h('td', null, r.name, r.me ? ' (나)' : ''), h('td', null, r.m.solved + '/' + st.n), h('td', { class: 'mono' }, App.fmtTime(r.m.total)))),
          rows.filter((r) => !r.m || r.x.q).map((r) => h('tr', null, h('td', null, '-'), h('td', null, r.name), h('td', { colspan: '2' }, r.x.q ? '그만뒀어요' : '푸는 중 ' + r.x.k + '/' + st.n + '번'))))));
      // 나중에 푼 사람까지 합친 순위
      if (W.ph === 'end' && st.key && hasServer() && me >= 0) {
        if (!L.allBox) {
          L.allBox = h('div', { class: 'all-rank' });
          L.allBox.append(h('button', { class: 'btn ghost', onclick: () => { App.clear(L.allBox); L.allBox.append(rankBox(st.key, st.n, { title: '방 코드 ' + s.code + ' 기록 대결 · 나중에 푼 사람 포함 (컴퓨터 제외)' })); } }, '나중에 푼 사람까지 합친 순위 보기'),
            h('p', { class: 'note center-text' }, '친구에게 방 코드 ' + s.code + '를 알려 주면, 나중에 「참가하기」로 같은 문제를 풀고 이 순위에 들어올 수 있어요.'));
        }
        g.append(L.allBox);
      }
      // 자리가 없어 보기만 하는 사람: 같은 문제를 따로 풀고 순위에 합치기
      if (me < 0 && st.key && hasServer()) {
        if (!L.lateBox) {
          L.lateBox = h('div', { class: 'chal' });
          L.lateStop = setFlow(L.lateBox, ctx, def, { key: st.key, seeds: L.seeds, opts: st.o, n: st.n, localKey: 'rec.' + st.key,
            head: '나도 같은 문제 풀기', sub: optLabel(def, st.o) + ' · ' + st.n + '문제', barLabel: '기록 대결 ' + s.code, title: '방 코드 ' + s.code + ' 기록 대결 · ' + def.name });
        }
        g.append(L.lateBox);
      }
    }

    function renderFast(g, s) {
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
      const team = st.team;
      const tp = [0, 0];
      if (team) st.pts.forEach((p, i) => { tp[st.tm[i]] += p; });
      const lockRem = me >= 0 ? st.lockRem[me] - (Date.now() - s.receivedAt) : 0;
      g.append(h('div', { class: 'q-head' },
        h('span', { class: 'pill strong' }, st.ph === 'end' ? '대결 끝' : '라운드 ' + st.round + ' / ' + st.rounds),
        team ? [0, 1].map((t) => h('span', { class: 'pill team-pill t' + t }, TEAMS[t] + ' ', h('b', { class: 'mono' }, String(tp[t])))) : null,
        W.pl.map((p, i) => h('span', { class: 'pill' + (i === me ? ' me' : '') + (st.win === i && st.ph !== 'play' ? ' win' : '') },
          App.avatar.seat(W, i, 32, team ? 't' + st.tm[i] : ''), p.n, ' ', h('b', { class: 'mono' }, String(st.pts[i])),
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
            } else g.append(h('p', { class: 'status' }, s.waiting ? '확인하는 중…' : team ? '우리 팀 누구든 먼저 맞히면 팀에 1점! 틀리면 나만 20초 동안 답할 수 없어요.' : '먼저 맞히는 사람이 1점! 틀리면 20초 동안 답할 수 없어요.'));
          } else {
            g.append(h('p', { class: 'status' }, L.sentDone ? '완성! 확인하는 중…' : team ? '우리 팀 누구든 먼저 완성하면 팀에 1점!' : '가장 먼저 완성하는 사람이 1점!'));
          }
        }
        if (st.last && st.last[0] !== me) g.append(h('p', { class: 'note' }, names[st.last[0]] + '이(가) ' + st.last[1] + '(으)로 답했다가 틀렸어요.'));
      } else {
        if (!L.revealed && L.comp.reveal) { L.comp.reveal(); L.revealed = true; }
        const winTeam = st.win >= 0 && team ? st.tm[st.win] : -1;
        const title = st.win >= 0 ? (st.win === me ? '내가 먼저 맞혔어요!' : names[st.win] + ' 득점') + (team ? ' (' + TEAMS[winTeam] + ' +1)' : '') : '아무도 못 맞혔어요';
        g.append(h('div', { class: 'result-box' + (st.win === me || (team && me >= 0 && winTeam === st.tm[me]) ? ' ok' : '') },
          h('strong', { class: 'result-big' }, st.ph === 'end' ? rankText(st, names, me) : title),
          st.ph === 'end' ? h('p', null, (team ? TEAMS[0] + ' ' + tp[0] + '점 · ' + TEAMS[1] + ' ' + tp[1] + '점 — ' : '') + W.pl.map((p, i) => p.n + ' ' + st.pts[i] + '점').join(' · ')) : h('p', { class: 'note' }, '다음 라운드가 곧 시작돼요.'),
          def.explainHasBoard ? null : L.comp.el,
          def.explain(L.pz)));
      }
    }

    return App.multi.mount(root, ctx, {
      gameId: def.id,
      engine,
      soloLabel: '컴퓨터와 대결',
      dispose(s) { disposeRec(s); if (s.local.comp && s.local.comp.destroy) s.local.comp.destroy(); },
      renderOptions(o, s, disabled) {
        const W = s.W, mode = W.o.mode === 'rec' ? 'rec' : 'fast';
        o.append(h('div', { class: 'toolbar' }, segRow('방식', 'mode', [['fast', '⚡ 빨리 맞히기'], ['rec', '⏱ 기록 대결']], W, s, disabled)),
          h('p', { class: 'note mode-note' }, mode === 'fast'
            ? '모두 같은 문제를 동시에 보고, 먼저 맞힌 사람이 1점을 얻어요. 팀전으로 하면 같은 팀 누가 맞혀도 팀 점수예요. 틀리면 20초 동안 답할 수 없어요.'
            : '같은 문제 묶음을 각자 끝까지 풀어요. 5초 카운트다운 뒤 다 같이 시작하고, 맞힌 문제 수와 총 시간으로 순위를 정해요. 나중에 같은 방 코드로 들어온 사람도 같은 문제를 풀고 순위에 합쳐져요.'));
        const bar = h('div', { class: 'toolbar' });
        def.optionsUI(bar, W.o, (k, v) => s.setOpt(k, v), disabled);
        if (mode === 'fast') bar.append(...segRow('라운드', 'rounds', [[3, '3판'], [5, '5판'], [7, '7판']], W, s, disabled), ...segRow('', 'team', [[0, '개인전'], [1, '팀전']], W, s, disabled));
        else bar.append(...segRow('문제 수', 'count', [[3, '3문제'], [5, '5문제'], [7, '7문제']], W, s, disabled));
        o.append(bar);
        if (mode === 'fast' && W.o.team && !disabled) o.append(h('div', { class: 'row wrap' }, h('button', { class: 'btn tiny', onclick: () => s.autoTeams() }, '🎲 팀 자동 나누기'), h('span', { class: 'note' }, '자리 칸의 팀 이름을 누르면 팀을 바꿀 수 있어요.')));
      },
      seatExtra(s, i, p) {
        const W = s.W;
        if (W.o.mode === 'rec' || !W.o.team) return null;
        const t = p.tm ? 1 : 0;
        if (s.isHost && W.ph === 'lobby') return h('button', { class: 'btn tiny team-btn t' + t, onclick: () => s.setSeatProp(i, 'tm', 1 - t), 'aria-label': p.n + ' 팀 바꾸기 (지금 ' + TEAMS[t] + ')' }, TEAMS[t] + ' ⇄');
        return tagEl(TEAMS[t], 'team-tag t' + t);
      },
      lateJoin,
      renderGame(g, s) { if (s.W.s && s.W.s.mode === 'rec') renderRec(g, s); else renderFast(g, s); },
    });
  }

  function rankText(st, names, me) {
    if (st.team) {
      const tp = [0, 0];
      st.pts.forEach((p, i) => { tp[st.tm[i]] += p; });
      if (tp[0] === tp[1]) return '무승부!';
      const w = tp[0] > tp[1] ? 0 : 1;
      return TEAMS[w] + ' 승리' + (me >= 0 && st.tm[me] === w ? '! 🎉' : '');
    }
    const best = Math.max(...st.pts);
    const winners = st.pts.map((p, i) => (p === best ? i : -1)).filter((i) => i >= 0);
    if (winners.length > 1) return '공동 1위: ' + winners.map((i) => names[i]).join(', ');
    return winners[0] === me ? '우승!' : names[winners[0]] + ' 우승';
  }

  // ---------- 등록 ----------
  App.quick = {
    register(def) {
      App.games.push({
        id: def.id, name: def.name, kicker: def.kicker, players: '혼자 · 오늘의 문제 · 온라인 대결', blurb: def.blurb, rules: def.rules, guide: def.guide,
        mount(root, ctx) {
          const tabs = h('div', { class: 'seg', role: 'tablist' });
          const body = h('div');
          root.append(tabs, body);
          let cleanup = null;
          function setMode(m) {
            if (cleanup) cleanup();
            App.clear(body); App.clear(tabs);
            [['solo', '혼자 연습'], ['daily', '오늘의 문제'], ['race', '온라인 대결']].forEach(([id, label]) => tabs.append(h('button', { class: 'seg-btn' + (m === id ? ' on' : ''), role: 'tab', 'aria-selected': m === id ? 'true' : 'false', onclick: () => setMode(id) }, label)));
            cleanup = m === 'solo' ? solo(body, ctx, def) : m === 'daily' ? daily(body, ctx, def) : race(body, ctx, def);
          }
          setMode('solo');
          return () => { if (cleanup) cleanup(); };
        },
      });
    },
    srng, newSeed, puzzleOf, duelEngine, raceEngine: duelEngine,
    tools: { encodeEntries, decodeEntries, summarize, rankRows, kstDay, seedsFrom, hashStr, optLabel },
  };
})();
