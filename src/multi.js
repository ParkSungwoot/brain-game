/* 멀티플레이: 방(room) 연결, 방장 권한 세션, 공통 로비 화면
 *
 * 연결 방식: 방 안의 각 화면은 presence(자기 상태) 하나만 씁니다.
 *  - 방장: presence.st 에 게임 전체 공개 상태를 싣습니다. (게임 규칙은 방장 화면에서만 계산)
 *  - 참가자: presence.act = {n: 순번, a: 행동} 으로 행동을 보냅니다.
 *  presence 는 보기 권한만 있는 사람도 쓸 수 있어서, 공유받은 누구나 참여할 수 있습니다.
 */
(function () {
  const App = (globalThis.App = globalThis.App || {});
  const { h } = App;

  // ---------------- 방 연결 계층 ----------------
  function rid() { return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6); }

  function deepFreeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const k in o) deepFreeze(o[k]); } return o; }

  // 같은 브라우저의 여러 탭끼리만 연결 (방 기능을 쓸 수 없는 환경에서 테스트용)
  class LocalRoom {
    constructor(name) {
      this.name = name;
      this.me = 'l' + rid();
      this.pres = {};
      this.others = new Map();
      this.subs = new Set();
      this.ch = new BroadcastChannel('bgr-room-' + name);
      this.ch.onmessage = (e) => this._recv(e.data);
      this.hb = setInterval(() => { this._send(); this._gc(); }, 900);
      this.ch.postMessage({ t: 'hello', from: this.me });
      this._send();
    }
    presence(patch) {
      const next = Object.assign({}, this.pres);
      for (const k in patch) { if (patch[k] === null) delete next[k]; else next[k] = patch[k]; }
      this.pres = JSON.parse(JSON.stringify(next));
      this._send();
      this._notify();
      return Promise.resolve();
    }
    _send() { try { this.ch.postMessage({ t: 'p', from: this.me, p: this.pres }); } catch (e) { /* 닫힘 */ } }
    _recv(m) {
      if (!m || m.from === this.me) return;
      if (m.t === 'hello') { this._send(); return; }
      if (m.t === 'bye') { this.others.delete(m.from); this._notify(); return; }
      if (m.t === 'p') {
        deepFreeze(m.p); // 실제 방 기능처럼 받은 상태는 읽기 전용
        const prev = this.others.get(m.from);
        const same = prev && JSON.stringify(prev.presence) === JSON.stringify(m.p);
        this.others.set(m.from, { presence: m.p, last: Date.now(), updatedAt: same ? prev.updatedAt : Date.now() });
        if (!same) this._notify();
      }
    }
    _gc() {
      const now = Date.now();
      let changed = false;
      for (const [k, v] of this.others) if (now - v.last > 3500) { this.others.delete(k); changed = true; }
      if (changed) this._notify();
    }
    peers() {
      const list = [{ peer: this.me, by: null, isMe: true, sameTab: true, kind: 'viewer', guest: false, presence: this.pres, updatedAt: Date.now() }];
      for (const [k, v] of this.others) list.push({ peer: k, by: null, isMe: false, sameTab: false, kind: 'viewer', guest: false, presence: v.presence, updatedAt: v.updatedAt });
      return list;
    }
    _notify() { const ps = this.peers(); for (const fn of this.subs) { try { fn({ peers: ps }); } catch (e) { console.error(e); } } }
    onPeers(fn) { this.subs.add(fn); setTimeout(() => fn({ peers: this.peers() }), 0); return () => this.subs.delete(fn); }
    connected() { return true; }
    async leave() {
      clearInterval(this.hb);
      try { this.ch.postMessage({ t: 'bye', from: this.me }); this.ch.close(); } catch (e) { /* 무시 */ }
      this.subs.clear();
    }
  }

  const Net = (App.Net = {
    kind: null, // 'fire' | 'claude' | 'blocked' | 'local' | 'none'
    _p: null,
    init() {
      if (this._p) return this._p;
      this._p = (async () => {
        // GitHub Pages 판: Firebase 로 누구나 연결 (로그인 없이)
        if (App.fire && App.fire.enabled()) { this.kind = 'fire'; return this.kind; }
        const inClaude = !!(globalThis.claude && typeof claude.use === 'function');
        try {
          if (inClaude) {
            const room = await claude.use('room');
            if (room) { this.room = room; this.kind = 'claude'; return this.kind; }
          }
        } catch (e) { console.warn('room 사용 불가', e); }
        // 공유된 페이지인데 방 기능이 안 열림: 로그인 안 했거나, 공개 링크로만 들어온 경우.
        // 같은 브라우저 탭끼리만 되는 대체 연결로 넘어가면 친구와 연결된 것처럼 보여서 헷갈리므로 막아 둠
        if (inClaude) { this.kind = 'blocked'; return this.kind; }
        if (typeof BroadcastChannel !== 'undefined') { this.kind = 'local'; return this.kind; }
        this.kind = 'none';
        return this.kind;
      })();
      return this._p;
    },
    // 여러 기기가 같은 시각을 쓰도록 (Firebase 는 서버 시각으로 보정)
    now() { return this.kind === 'fire' && App.fire ? App.fire.now() : Date.now(); },
    online() { return this.kind === 'fire' || this.kind === 'claude' || this.kind === 'local'; },
    async join(name) {
      await this.init();
      if (this.kind === 'fire') return App.fire.join(name);
      if (this.kind === 'claude') return this.room.join(name);
      if (this.kind === 'local') return new LocalRoom(name);
      throw new Error('온라인 연결을 쓸 수 없는 환경이에요.');
    },
  });
  // 온라인 방에 못 들어오는 화면에 보여 줄 안내
  // 남은 시간 글자: 1분 넘으면 3:05, 아니면 42초
  App.leftText = (ms) => {
    const t = Math.max(0, Math.ceil(ms / 1000));
    return t > 60 ? Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0') : t + '초';
  };
  App.ONLINE_BLOCKED = '이 화면에서는 온라인 방에 연결할 수 없어요. 로그인하지 않았거나, 공개 링크로만 들어온 경우예요. 친구와 같이 하려면 페이지 주인이 공유 메뉴에서 친구를 이메일로 초대하고, 친구가 초대받은 Claude 계정으로 로그인한 채 이 페이지를 열어야 해요.';

  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function newCode() { let s = ''; for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; return s; }
  function roomName(gameId, code) { return (gameId + '-' + code).toLowerCase().replace(/[^a-z0-9_.-]/g, ''); }
  function jsonBytes(o) { return new TextEncoder().encode(JSON.stringify(o)).length; }

  // ---------------- 세션 ----------------
  // mode: 'local'(이 기기에서 컴퓨터와) | 'host'(온라인 방장) | 'guest'(온라인 참가자)
  class Session {
    constructor({ gameId, engine, mode, nick, code, onUpdate }) {
      this.gameId = gameId;
      this.engine = engine;
      this.mode = mode;
      this.nick = App.cleanNick(nick);
      this.code = code || null;
      this.onUpdate = onUpdate || (() => {});
      this.local = {}; // 게임 화면이 기억하는 내 쪽 정보 (낸 카드, 내 비밀 수식 등)
      this.av = App.avatar ? App.avatar.mine() : null; // 내 픽셀 캐릭터 [모양, 색]
      this.status = 'connecting';
      this.error = null;
      this.seq = 0;
      this.acked = 0;
      this.closed = false;
      this.W = null; // 공개 상태 묶음
      this.G = null; // 방장만 가진 전체 게임 상태
      this.lastN = {};
      this.botDue = {};
      this.deadline = {};
      this.receivedAt = Date.now();
    }
    get isHost() { return this.mode !== 'guest'; }

    async start() {
      if (this.mode === 'local') {
        this.myPeer = 'me';
        this._initHostState();
        this.status = 'ready';
        this._startTicker();
        this._changed();
        return;
      }
      if (Net.kind === 'fire' && App.fire) {
        // 동시 접속자가 가득 차면 연결이 오류 없이 멈춰 있으므로, 잠깐만 기다리고 안내
        const ok = await App.fire.ready(10000);
        if (this.closed) return;
        if (!ok) {
          this.status = 'failed'; this.errKind = 'full';
          this.error = App.fire.problemText();
          this._changed();
          return;
        }
      }
      const p = Net.join(roomName(this.gameId, this.code));
      try {
        this.room = await (Net.kind === 'fire' && App.fire ? App.fire.wait(p, 15000) : p);
      } catch (e) {
        // 늦게라도 열리면 바로 닫아 유령 참가자·리스너가 남지 않게
        p.then((r) => { try { r.leave(); } catch (err) { /* 무시 */ } }, () => {});
        if (this.closed) return;
        this.status = 'failed';
        if (e && e.code === 'timeout' && App.fire) { this.errKind = 'full'; this.error = App.fire.problemText(); }
        else this.error = '방에 연결하지 못했어요. (' + (e && (e.code || e.message) || '알 수 없는 오류') + ')';
        this._changed();
        return;
      }
      if (this.closed) { try { this.room.leave(); } catch (e) { /* 무시 */ } return; }
      this.unsub = this.room.onPeers((ch) => this._onPeers(ch.peers || this.room.peers()), (err) => {
        this.status = 'failed';
        this.error = '연결이 끊겼어요. (' + err.code + ')';
        this._changed();
      });
      if (this.mode === 'host') {
        this.myPeer = null;
        this._initHostState();
        this.status = 'ready';
        this._startTicker();
        // 같은 코드의 방장이 이미 있는지 잠시 뒤 확인
        setTimeout(() => {
          if (this.closed) return;
          const other = this._peers().find((p) => !p.sameTab && p.presence && p.presence.h === 1 && p.presence.g === this.gameId);
          if (other) { this.status = 'failed'; this.error = '같은 코드의 방이 이미 있어요. 다시 만들어 주세요.'; this._changed(); }
        }, 1800);
      } else {
        await this.room.presence({ g: this.gameId, nick: this.nick, av: this.av, act: null });
        this.findTimer = setTimeout(() => {
          if (!this.W && !this.closed) { this.status = 'nohost'; this.error = '그 코드의 방을 찾지 못했어요. 코드를 다시 확인해 주세요. 코드가 맞다면, 방장과 내가 모두 로그인해 있고 페이지 주인에게 초대받은 계정인지 확인해 주세요.'; this._changed(); }
        }, 6000);
      }
      this._changed();
    }

    _peers() { try { return this.room ? this.room.peers() : []; } catch (e) { return []; } }

    _initHostState() {
      const e = this.engine;
      this.W = {
        g: this.gameId, ph: 'lobby', v: 0,
        pl: [{ p: this.myPeer || 'host', n: this.nick, b: 0, on: 1, tm: 0, a: this.av }],
        o: Object.assign({}, e.defaultOpts || {}),
        s: null, ak: [], er: null, dl: [], res: null,
      };
      if (this.mode === 'local' && e.allowBots) {
        const want = Math.max(e.minPlayers, Math.min(e.maxPlayers, e.defaultBots || e.minPlayers)) - 1;
        for (let i = 0; i < want; i++) this.addBot(true);
      }
    }

    // ---- 방장 쪽 처리 ----
    _onPeers(peers) {
      if (this.closed) return;
      const me = peers.find((p) => p.sameTab);
      if (me && !this.myPeer) {
        this.myPeer = me.peer;
        if (this.mode === 'host') this.W.pl[0].p = me.peer;
      }
      if (this.mode === 'host') this._hostPeers(peers);
      else this._guestPeers(peers);
    }

    _hostPeers(peers) {
      const W = this.W;
      let changed = false;
      const present = new Map();
      for (const p of peers) if (!p.sameTab && p.presence && p.presence.g === this.gameId && p.presence.h !== 1) present.set(p.peer, p);

      if (W.ph === 'lobby') {
        // 나간 사람 빼기
        const before = W.pl.length;
        W.pl = W.pl.filter((x, i) => i === 0 || x.b || present.has(x.p));
        if (W.pl.length !== before) changed = true;
        // 새로 온 사람 넣기
        for (const [peer, p] of present) {
          const av = App.avatar && App.avatar.valid(p.presence.av) ? p.presence.av.slice() : null;
          const x = W.pl.find((q) => q.p === peer);
          if (!x && W.pl.length < this.engine.maxPlayers) {
            W.pl.push({ p: peer, n: App.cleanNick(p.presence.nick), b: 0, on: 1, tm: this._nextTeam(), a: av || this._randomAv() });
            changed = true;
          } else if (x && av && (!x.a || x.a[0] !== av[0] || x.a[1] !== av[1])) { x.a = av; changed = true; } // 로비에서 캐릭터를 바꿈
        }
      } else {
        // 게임 중: 연결 상태 갱신 (끊기면 컴퓨터가 대신 둡니다)
        W.pl.forEach((x, i) => {
          if (i === 0 || x.b) return;
          const on = present.has(x.p) ? 1 : 0;
          if (x.on !== on) { x.on = on; changed = true; }
        });
        // 행동 처리
        for (const [peer, p] of present) {
          const seat = W.pl.findIndex((x) => x.p === peer);
          const act = p.presence.act;
          if (seat < 0 || !act || typeof act.n !== 'number') continue;
          if (act.n <= (this.lastN[peer] || 0)) continue;
          this.lastN[peer] = act.n;
          this._setAck(peer, act.n);
          if (W.ph === 'play') this._apply(seat, act.a, peer, act.n);
          changed = true;
        }
      }
      if (changed) this._publish();
    }

    _setAck(pid, n) {
      const W = this.W;
      const i = W.ak.findIndex((x) => x[0] === pid);
      if (i >= 0) W.ak[i][1] = n; else W.ak.push([pid, n]);
    }

    _apply(seat, a, pid, n) {
      try {
        this.engine.act(this.G, seat, a);
        this.W.er = null;
      } catch (e) {
        this.W.er = [pid || this.W.pl[seat].p, n || 0, String(e && e.message || e).slice(0, 120)];
        if (seat === 0) App.toast(this.W.er[2], 'warn');
        return false;
      }
      this._afterChange();
      return true;
    }

    _afterChange() {
      const e = this.engine, W = this.W;
      W.s = e.publicView(this.G);
      if (e.over(this.G)) {
        W.ph = 'end';
        W.res = e.results ? e.results(this.G) : null;
        // 유배지 한 명은 방장 화면에서 한 번만 정해서 모두에게 같은 결과를 보냄
        if (W.res && Array.isArray(W.res.scores) && W.res.exile === undefined && !W.res.places) {
          const [ex, how] = pickExile(W.res.scores, W.res.tb);
          W.res.exile = ex;
          W.res.exileHow = how;
        }
      }
    }

    _startTicker() {
      this.ticker = setInterval(() => this._tick(), 250);
    }

    _tick() {
      if (this.closed || !this.W || this.W.ph !== 'play') return;
      const e = this.engine, now = Date.now();
      let changed = false;
      if (e.tick && e.tick(this.G, now)) { this._afterChange(); changed = true; if (this.W.ph !== 'play') { this._publish(); return; } }
      // 단계가 바뀌면(새 라운드, 다음 차례 등) 제한 시간을 새로 잼
      const G = this.G;
      const dk = [G.ph, G.round, G.turn, G.cur, G.k, G.half, G.gstep, G.moves, G.pi].join('|');
      if (dk !== this.dlKey) { this.dlKey = dk; if (Object.keys(this.deadline).length) changed = true; this.deadline = {}; this.botDue = {}; }
      const pend = e.pending(this.G);
      for (const s of Object.keys(this.deadline)) if (!pend.includes(+s)) { delete this.deadline[s]; changed = true; }
      for (const s of Object.keys(this.botDue)) if (!pend.includes(+s)) delete this.botDue[s];
      for (const seat of pend) {
        const pl = this.W.pl[seat];
        const auto = pl.b || !pl.on;
        if (auto) {
          if (!this.botDue[seat]) this.botDue[seat] = now + (e.botDelay ? e.botDelay(this.G, seat) : 500 + Math.random() * 900);
          if (now >= this.botDue[seat]) {
            delete this.botDue[seat];
            const a = e.bot(this.G, seat);
            if (a) { this._apply(seat, a); changed = true; }
            break; // 한 번에 하나씩
          }
        } else {
          const lim = this.mode !== 'local' && e.timeLimit ? e.timeLimit(this.G, seat) : 0;
          if (!lim) continue;
          if (!this.deadline[seat]) { this.deadline[seat] = now + lim; changed = true; }
          if (now >= this.deadline[seat]) {
            delete this.deadline[seat];
            const a = (e.timeout || e.bot)(this.G, seat);
            if (a) { this._apply(seat, a); changed = true; }
            break;
          }
        }
      }
      if (changed) this._publish();
    }

    _publish() {
      const W = this.W;
      W.v++;
      const now = Date.now();
      W.dl = Object.keys(this.deadline).map((s) => [+s, Math.max(0, this.deadline[s] - now)]);
      this.receivedAt = now;
      if (this.mode === 'host' && this.room) {
        const msg = { h: 1, g: this.gameId, nick: this.nick, st: W };
        const size = jsonBytes(msg);
        if (size > 4000) console.warn('상태가 너무 큽니다', size);
        this.room.presence(msg).catch((err) => console.warn('presence 실패', err));
      }
      this._changed();
    }

    // ---- 참가자 쪽 처리 ----
    _guestPeers(peers) {
      const host = peers.find((p) => !p.sameTab && p.presence && p.presence.h === 1 && p.presence.g === this.gameId && p.presence.st);
      if (!host) {
        if (this.W && this.status === 'ready') { this.status = 'hostleft'; this.error = '방장이 방을 나갔어요.'; this._changed(); }
        return;
      }
      const W = host.presence.st;
      if (this.W && W.v === this.W.v && this.status === 'ready') return;
      clearTimeout(this.findTimer);
      this.W = W;
      this.receivedAt = Date.now();
      this.status = 'ready';
      this.error = null;
      const ak = (W.ak || []).find((x) => x[0] === this.myPeer);
      if (ak) this.acked = Math.max(this.acked, ak[1]);
      if (W.er && W.er[0] === this.myPeer && W.er[1] === this.seq && this._lastErr !== W.er[1]) {
        this._lastErr = W.er[1];
        App.toast(W.er[2], 'warn');
      }
      this._changed();
    }

    // ---- 공통 ----
    get mySeat() {
      if (!this.W) return -1;
      if (this.isHost) return 0;
      return this.W.pl.findIndex((x) => x.p === this.myPeer);
    }
    get waiting() { return this.mode === 'guest' && this.seq > this.acked; }

    send(a) {
      if (this.isHost) {
        if (this.W.ph !== 'play') return false;
        const ok = this._apply(0, a);
        this._publish();
        return ok;
      }
      this.seq++;
      this.room.presence({ act: { n: this.seq, a } }).catch((err) => App.toast('보내지 못했어요: ' + err.code, 'warn'));
      this._changed();
      return true;
    }

    remaining(seat) {
      if (!this.W || !this.W.dl) return null;
      const d = this.W.dl.find((x) => x[0] === seat);
      if (!d) return null;
      return Math.max(0, d[1] - (Date.now() - this.receivedAt));
    }

    // 방장 전용 조작
    addBot(silent) {
      const W = this.W, e = this.engine;
      if (!this.isHost || W.ph !== 'lobby' || !e.allowBots || W.pl.length >= e.maxPlayers) return;
      const names = e.botNames || ['컴퓨터 A', '컴퓨터 B', '컴퓨터 C', '컴퓨터 D', '컴퓨터 E', '컴퓨터 F', '컴퓨터 G'];
      const used = new Set(W.pl.map((x) => x.n));
      const n = names.find((x) => !used.has(x)) || '컴퓨터';
      W.pl.push({ p: 'bot' + rid().slice(0, 6), n, b: 1, on: 1, tm: this._nextTeam(), a: this._randomAv() });
      if (!silent) this._publish();
    }
    // 방 안의 다른 캐릭터와 겹치지 않게 무작위
    _randomAv() { return App.avatar ? App.avatar.random(this.W.pl.map((x) => x.a)) : null; }
    // 내 캐릭터 바꾸기 (로비에서): 방장·혼자면 바로 반영, 참가자면 방장에게 알림
    setMyAvatar(a) {
      if (!App.avatar || !App.avatar.valid(a)) return;
      this.av = a.slice();
      const W = this.W;
      if (this.isHost) {
        if (W && W.ph === 'lobby' && W.pl[0]) { W.pl[0].a = a.slice(); this._publish(); }
      } else if (this.room) {
        this.room.presence({ av: a.slice() }).catch(() => {});
      }
    }
    // 팀전: 인원이 적은 팀으로 넣음
    _nextTeam() { const c = [0, 0]; for (const x of this.W.pl) c[x.tm ? 1 : 0]++; return c[0] <= c[1] ? 0 : 1; }
    setSeatProp(i, k, v) {
      const W = this.W;
      if (!this.isHost || W.ph !== 'lobby' || !W.pl[i]) return;
      W.pl[i][k] = v;
      this._publish();
    }
    autoTeams() {
      const W = this.W;
      if (!this.isHost || W.ph !== 'lobby') return;
      const idx = W.pl.map((_, i) => i);
      for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
      idx.forEach((seat, k) => { W.pl[seat].tm = k % 2; });
      this._publish();
    }
    removeSeat(i) {
      const W = this.W;
      if (!this.isHost || W.ph !== 'lobby' || i === 0) return;
      W.pl.splice(i, 1);
      this._publish();
    }
    setOpt(k, v) {
      if (!this.isHost || this.W.ph !== 'lobby') return;
      this.W.o[k] = v;
      this._publish();
    }
    startGame() {
      const W = this.W, e = this.engine;
      if (!this.isHost) return;
      if (W.pl.length < e.minPlayers) { App.toast('최소 ' + e.minPlayers + '명이 필요해요.', 'warn'); return; }
      if (e.canStart) { const why = e.canStart(W); if (why) { App.toast(why, 'warn'); return; } }
      this.G = e.start(W.pl.map((x) => ({ n: x.n, b: !!x.b, tm: x.tm ? 1 : 0 })), W.o, { code: this.mode === 'local' ? null : this.code, gameId: this.gameId });
      W.ph = 'play';
      W.gn = (W.gn || 0) + 1;
      W.res = null;
      W.er = null;
      this.deadline = {};
      this.botDue = {};
      this._afterChange();
      this._publish();
    }
    backToLobby() {
      if (!this.isHost) return;
      this.W.ph = 'lobby';
      this.W.s = null;
      this.W.res = null;
      this.G = null;
      // 연결이 끊긴 사람은 정리
      this.W.pl = this.W.pl.filter((x, i) => i === 0 || x.b || x.on);
      this._publish();
    }

    _changed() { if (!this.closed) { try { this.onUpdate(this); } catch (e) { console.error(e); } } }

    close() {
      this.closed = true;
      clearInterval(this.ticker);
      clearTimeout(this.findTimer);
      try { this.unsub && this.unsub(); } catch (e) { /* 무시 */ }
      try { this.room && this.room.leave && this.room.leave(); } catch (e) { /* 무시 */ }
    }
  }
  App.Session = Session;

  // ---------------- 게임 후 숙소 배정 안내 ----------------
  // 꼴찌(동점이면 함께) → 유배지, 나머지 중 위쪽 절반(인원의 절반 내림, 같은 점수는 함께) → 생활동, 그 밖 → 감옥동
  // 모두 같은 점수(무승부)면 모두 생활동
  const PLACES = { live: ['생활동', '생활동으로'], prison: ['감옥동', '감옥동으로'], exile: ['유배지', '유배지로'] };
  // 유배지로 갈 꼴찌 한 명 고르기 (방장 화면에서 한 번만): 동점이면 보조 점수(tb, 높을수록 좋음)로, 그래도 같으면 추첨
  function pickExile(scores, tb) {
    const low = Math.min(...scores), high = Math.max(...scores);
    if (low === high) return [-1, ''];
    let cand = scores.map((v, i) => (v === low ? i : -1)).filter((i) => i >= 0);
    let how = '';
    if (cand.length > 1 && Array.isArray(tb)) {
      const m = Math.min(...cand.map((i) => tb[i]));
      const c2 = cand.filter((i) => tb[i] === m);
      if (c2.length < cand.length) how = 'tb';
      cand = c2;
    }
    if (cand.length > 1) { how = 'lot'; cand = [cand[Math.floor(Math.random() * cand.length)]]; }
    return [cand[0], how];
  }
  function assignPlaces(scores, exile) {
    const n = scores.length;
    const out = Array(n).fill('prison');
    const low = Math.min(...scores), high = Math.max(...scores);
    if (low === high) return out.fill('live');
    if (exile == null || exile < 0) exile = scores.indexOf(low);
    const order = [...Array(n).keys()].sort((a, b) => scores[b] - scores[a]);
    const liveCount = Math.max(1, Math.floor(n / 2));
    order.forEach((seat) => {
      if (seat === exile) out[seat] = 'exile';
      else if (scores[seat] === low) out[seat] = 'prison';
      else {
        // 같은 점수 묶음이 생활동 경계에 걸치면 묶음 전체를 생활동으로
        const firstIdx = order.findIndex((x) => scores[x] === scores[seat]);
        out[seat] = firstIdx < liveCount ? 'live' : 'prison';
      }
    });
    return out;
  }
  App.assignPlaces = assignPlaces;

  function announcement(W, mySeat) {
    const scores = W.res && Array.isArray(W.res.scores) ? W.res.scores : null;
    if (!scores || scores.length !== W.pl.length || W.pl.length < 2) return null;
    const places = Array.isArray(W.res.places) ? W.res.places : assignPlaces(scores, W.res.exile);
    const order = [...W.pl.keys()].sort((a, b) => ({ live: 0, prison: 1, exile: 2 })[places[a]] - ({ live: 0, prison: 1, exile: 2 })[places[b]]);
    return h('section', { class: 'announce', 'aria-label': '숙소 배정 안내' },
      h('p', { class: 'announce-head' }, '📢 안내 방송'),
      h('ul', { class: 'announce-list' }, order.map((i) => h('li', { class: 'ann ' + places[i] + (i === mySeat ? ' me' : '') },
        h('span', { class: 'ann-tag' }, PLACES[places[i]][0]),
        App.avatar ? App.avatar.seat(W, i) : null,
        h('span', null, h('b', null, W.pl[i].n), '님은 지금 바로 ', h('b', { class: 'ann-place' }, PLACES[places[i]][1]), ' 이동해주시기 바랍니다.')))),
      W.res.exileHow === 'lot' ? h('p', { class: 'note' }, '꼴찌가 동점이라 추첨으로 유배지 한 명을 정했어요.')
        : W.res.exileHow === 'tb' ? h('p', { class: 'note' }, '꼴찌가 동점이라 오답이 더 많은 사람이 유배지로 가요.') : null);
  }

  // ---------------- 공통 로비 화면 ----------------
  // cfg: { gameId, engine, renderGame(el, session), renderOptions(el, session, disabled), soloLabel }
  App.multi = {
    mount(root, ctx, cfg) {
      let session = null;
      let finishedFor = -1;
      const view = h('div', { class: 'mp' });
      root.append(view);
      const tune = 'multi:' + cfg.gameId + ':' + Math.random().toString(36).slice(2, 8); // 배경 음악을 붙잡는 이름
      const music = (play) => { if (App.music) { if (play) App.music.claim(tune); else { App.music.hurry(false); App.music.release(tune); } } };
      let offSt = null; // 고르기 화면의 연결 상태 구독
      const unsubStatus = () => { if (offSt) { offSt(); offSt = null; } };
      // 게임 화면이 따로 만든 것(문제 묶음, 늦게 온 사람 화면 등)을 정리
      function dispose(s) {
        if (!s || s._disposed) return;
        s._disposed = true;
        if (s._lateStop) { try { s._lateStop(); } catch (e) { console.error(e); } s._lateStop = null; }
        if (cfg.dispose) { try { cfg.dispose(s); } catch (e) { console.error(e); } }
      }

      function leave() {
        dispose(session);
        if (session) session.close();
        session = null;
        finishedFor = -1;
        music(false);
        renderChooser();
      }

      function startSession(mode, code) {
        unsubStatus();
        const nick = App.cleanNick(App.store.get('nick', ''));
        session = new Session({
          gameId: cfg.gameId, engine: cfg.engine, mode, nick, code,
          onUpdate: (s) => render(s),
        });
        session.start();
        render(session);
        // 새 화면(방)으로 바뀐 걸 바로 볼 수 있게 맨 위로
        try { view.scrollIntoView({ block: 'start' }); } catch (e) { /* 무시 */ }
      }

      function renderChooser() {
        unsubStatus();
        App.clear(view);
        const nickInput = h('input', { id: cfg.gameId + '-nick', class: 'input', maxlength: '12', placeholder: '닉네임', value: App.store.get('nick', '') });
        nickInput.addEventListener('input', () => App.store.set('nick', nickInput.value));
        const codeInput = h('input', { id: cfg.gameId + '-code', class: 'input code-input', maxlength: '4', placeholder: '코드 4자리', autocapitalize: 'characters', autocomplete: 'off' });
        codeInput.addEventListener('input', () => { codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
        const onlineNote = h('p', { class: 'note' }, '온라인 연결 상태를 확인하는 중…');
        const btnHost = h('button', { class: 'btn', disabled: true, onclick: () => { if (!nickInput.value.trim()) nickInput.value = App.cleanNick(''); App.store.set('nick', nickInput.value); startSession('host', newCode()); } }, '온라인 방 만들기');
        const btnJoin = h('button', { class: 'btn', disabled: true, onclick: () => {
          const c = codeInput.value.trim();
          if (c.length !== 4) { App.toast('방 코드 4자리를 입력해 주세요.', 'warn'); codeInput.focus(); return; }
          App.store.set('nick', nickInput.value);
          startSession('guest', c);
        } }, '참가하기');
        codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') btnJoin.click(); });

        const e = cfg.engine;
        const soloCard = e.allowBots ? h('div', { class: 'mode-card' },
          h('h4', null, cfg.soloLabel || '컴퓨터와 하기'),
          h('p', null, '이 기기에서 컴퓨터 플레이어와 바로 시작합니다.'),
          h('button', { class: 'btn primary', onclick: () => { App.store.set('nick', nickInput.value); startSession('local'); } }, '바로 시작')) : null;

        let avBox = null;
        if (App.avatar) {
          // 내 캐릭터: 평소엔 한 줄로, 「바꾸기」를 누르면 고르기 판 (판 안에 닫기)
          avBox = h('div', { class: 'av-mine' });
          let open = false;
          const paintAv = () => {
            App.clear(avBox);
            const a = App.avatar.mine();
            if (open) { avBox.append(App.avatar.picker(a, null, { compact: true, onClose: () => { open = false; paintAv(); } })); return; }
            avBox.append(h('div', { class: 'av-mine-row' },
              h('span', { class: 'av-chip big' }, App.avatar.svg(a, 32, '내 캐릭터: ' + App.avatar.nameOf(a))),
              h('span', { class: 'av-mine-text' }, h('span', { class: 'note' }, '내 캐릭터'), h('b', null, App.avatar.nameOf(a))),
              h('button', { class: 'btn tiny', type: 'button', onclick: () => { open = true; paintAv(); } }, '바꾸기')));
          };
          paintAv();
        }
        view.append(
          h('div', { class: 'mp-choose' },
            h('label', { class: 'field', for: cfg.gameId + '-nick' }, h('span', null, '내 닉네임'), nickInput),
            avBox,
            h('div', { class: 'mode-grid' },
              soloCard,
              h('div', { class: 'mode-card' },
                h('h4', null, '친구와 온라인'),
                h('p', null, '방을 만들고 코드를 알려주면, 같은 페이지를 연 친구가 들어올 수 있어요. 빈자리는 컴퓨터로 채울 수 있어요.'),
                btnHost,
                h('div', { class: 'join-row' }, codeInput, btnJoin)),
            ),
            onlineNote,
          ),
        );
        Net.init().then((kind) => {
          if (kind === 'fire') {
            btnHost.disabled = false; btnJoin.disabled = false;
            const paint = (st) => {
              const bad = st === 'full' || st === 'offline';
              onlineNote.textContent = bad ? App.fire.problemText(st, { bots: !!cfg.engine.allowBots }) : '방을 만들고 코드를 알려 주면, 이 페이지를 연 친구가 로그인 없이 들어올 수 있어요.';
              onlineNote.classList.toggle('warn-note', bad);
            };
            if (onlineNote.isConnected) { unsubStatus(); offSt = App.fire.onStatus(paint); }
          }
          else if (kind === 'claude') { btnHost.disabled = false; btnJoin.disabled = false; onlineNote.textContent = '온라인 방에 연결할 수 있어요. 친구는 공유 메뉴에서 이메일로 초대받은 Claude 계정으로 로그인해서 이 페이지를 열어야 같은 방 코드로 들어올 수 있어요.'; }
          else if (kind === 'blocked') { onlineNote.textContent = App.ONLINE_BLOCKED; onlineNote.classList.add('warn-note'); }
          else if (kind === 'local') { btnHost.disabled = false; btnJoin.disabled = false; onlineNote.textContent = '지금은 이 브라우저 안의 다른 탭끼리만 연결돼요. 공유된 페이지에서 열면 친구와 연결됩니다.'; }
          else { onlineNote.textContent = '이 환경에서는 온라인 연결을 쓸 수 없어요.'; }
        });
      }

      // 자리 칸: P1(방장)부터 최대 인원까지. 들어오면 칸이 채워지고, 새로 들어온 칸은 반짝
      function seatGrid(s) {
        const W = s.W, e = cfg.engine;
        const prev = s._seatSeen || null;
        const ids = W.pl.map((p) => p.p);
        const fresh = new Set(prev ? ids.filter((x, i) => i > 0 && !prev.ids.includes(x)) : []);
        if (prev && W.ph === 'lobby' && s.mode !== 'local') {
          // 알림은 화면을 다 그린 뒤에 (그리는 도중 띄우면 화면이 잠깐 비어 맨 위로 튀어 오름)
          const later = (t) => setTimeout(() => App.toast(t), 0);
          W.pl.forEach((p, i) => { if (fresh.has(p.p) && !p.b && i !== s.mySeat) later('🙋 ' + p.n + '님이 들어왔어요'); });
          prev.pl.forEach(([pid, n, b], i) => { if (i > 0 && !b && !ids.includes(pid)) later(n + '님이 나갔어요'); });
        }
        s._seatSeen = { ids, pl: W.pl.map((p) => [p.p, p.n, p.b]) };
        const tag = (t, c) => h('span', { class: 'chip-tag' + (c ? ' ' + c : '') }, t);
        const firstEmpty = W.pl.length;
        const cells = [];
        for (let i = 0; i < e.maxPlayers; i++) {
          const p = W.pl[i];
          if (p) {
            cells.push(h('li', { class: 'seat' + (i === s.mySeat ? ' me' : '') + (fresh.has(p.p) ? ' pop' : ''), style: { '--pc': `var(--p${i % 7})` } },
              h('span', { class: 'seat-no' }, 'P' + (i + 1)),
              h('span', { class: 'seat-face' + (App.avatar && App.avatar.valid(p.a) ? ' av' : ''), 'aria-hidden': 'true' }, App.avatar && App.avatar.valid(p.a) ? App.avatar.svg(p.a, 48) : (p.b ? '🤖' : (Array.from(p.n)[0] || '?'))),
              h('span', { class: 'seat-name' }, p.n),
              h('span', { class: 'seat-tags' },
                i === 0 && s.mode !== 'local' ? tag('방장') : null,
                i === s.mySeat ? tag('나') : null,
                p.b ? tag('컴퓨터') : null,
                !p.on ? tag('연결 끊김', 'warn') : null),
              cfg.seatExtra ? cfg.seatExtra(s, i, p) : null,
              i === s.mySeat && W.ph === 'lobby' && App.avatar ? h('button', { class: 'btn tiny ghost av-change', 'aria-expanded': s._avOpen ? 'true' : 'false', onclick: () => { s._avOpen = !s._avOpen; render(s); } }, s._avOpen ? '닫기' : '캐릭터 바꾸기') : null,
              s.isHost && i !== 0 && W.ph === 'lobby' ? h('button', { class: 'btn tiny ghost seat-x', onclick: () => s.removeSeat(i), 'aria-label': p.n + ' 빼기' }, '빼기') : null));
          } else {
            cells.push(h('li', { class: 'seat empty' },
              h('span', { class: 'seat-no' }, 'P' + (i + 1)),
              h('span', { class: 'seat-face', 'aria-hidden': 'true' }, '?'),
              h('span', { class: 'seat-wait' }, s.mode === 'local' ? '빈자리' : '기다리는 중', s.mode === 'local' ? null : h('span', { class: 'dots' }, '…')),
              s.isHost && e.allowBots && i === firstEmpty ? h('button', { class: 'btn tiny', onclick: () => s.addBot() }, '+ 컴퓨터') : null));
          }
        }
        return h('ol', { class: 'seats', 'aria-label': '자리' }, cells);
      }

      function render(s) {
        if (s !== session) return;
        music(!!(s.W && s.W.ph === 'play' && s.status !== 'failed' && s.status !== 'hostleft'));
        App.clear(view);
        if (s.status === 'connecting') { view.append(h('div', { class: 'center-msg' }, '방에 연결하는 중…')); return; }
        if (s.status === 'nohost' && cfg.lateJoin) {
          const box = h('div', { class: 'center-msg' }, h('p', null, '방을 찾는 중…'));
          view.append(box);
          if (!s._late) s._late = cfg.lateJoin(s.code);
          s._late.then((el) => {
            if (session !== s || !box.isConnected) return;
            App.clear(box);
            if (el) { const node = el(leave); s._lateStop = node._stop || null; box.replaceWith(node); }
            else box.append(h('p', null, s.error), h('button', { class: 'btn', onclick: leave }, '처음으로'));
          });
          return;
        }
        if (s.status === 'failed' || s.status === 'hostleft' || (s.status === 'nohost' && !cfg.lateJoin)) dispose(s);
        if (s.status === 'failed' && s.errKind === 'full') {
          const again = () => { const m = s.mode, c = s.mode === 'host' ? newCode() : s.code; leave(); startSession(m, c); };
          const local = () => { leave(); startSession('local'); };
          view.append(h('div', { class: 'center-msg full-msg' },
            h('p', { class: 'note warn-note' }, App.fire ? App.fire.problemText(null, { bots: !!cfg.engine.allowBots }) : s.error),
            h('div', { class: 'row wrap center' },
              cfg.engine.allowBots ? h('button', { class: 'btn primary', onclick: local }, cfg.soloLabel || '컴퓨터와 하기') : null,
              h('button', { class: 'btn', onclick: again }, '다시 시도'),
              h('button', { class: 'btn ghost', onclick: leave }, '처음으로'))));
          return;
        }
        if (s.status === 'failed' || s.status === 'nohost' || s.status === 'hostleft') {
          view.append(h('div', { class: 'center-msg' }, h('p', null, s.error || '연결에 문제가 생겼어요.'), h('button', { class: 'btn', onclick: leave }, '처음으로')));
          return;
        }
        const W = s.W, e = cfg.engine;
        const bar = h('div', { class: 'mp-bar' },
          s.mode === 'local' ? h('span', { class: 'bar-label' }, '컴퓨터와 대전') : h('span', { class: 'bar-label' }, '방 코드 ', h('b', { class: 'code' }, s.code)),
          h('span', { class: 'spacer' }),
          h('button', { class: 'btn tiny ghost', onclick: leave }, '나가기'));
        view.append(bar);

        if (W.ph === 'lobby') {
          const box = h('div', { class: 'lobby' });
          if (s.mode !== 'local') {
            const copy = () => {
              const t = s.code;
              try { navigator.clipboard.writeText(t).then(() => App.toast('방 코드를 복사했어요.'), () => App.toast('방 코드: ' + t)); } catch (err) { App.toast('방 코드: ' + t); }
            };
            const first = !s._madeShown;
            s._madeShown = true;
            box.append(h('section', { class: 'room-made' + (first ? ' pop' : '') },
              h('p', { class: 'room-made-head' }, s.isHost ? '✅ 방이 만들어졌어요!' : s.mySeat >= 0 ? '✅ 방에 들어왔어요!' : '👀 자리가 다 차서 관전 중이에요'),
              h('p', { class: 'room-made-sub' }, '방 코드'),
              h('div', { class: 'code-tiles big', 'aria-label': '방 코드 ' + s.code, 'data-code': s.code }, s.code.split('').map((c) => h('b', { 'aria-hidden': 'true' }, c))),
              h('button', { class: 'btn tiny', onclick: copy }, '코드 복사'),
              h('p', { class: 'note' }, s.isHost
                ? '친구가 같은 게임의 「참가하기」에 이 코드를 넣으면 아래 빈자리가 하나씩 채워져요.'
                : '방장이 「게임 시작」을 누르면 바로 시작돼요.')));
          }
          box.append(h('h4', { class: 'sub lobby-head' }, h('span', null, s.mode === 'local' ? '참가자' : '자리'), h('span', { class: 'mono' }, W.pl.length + ' / ' + e.maxPlayers)), seatGrid(s));
          if (s._avOpen && App.avatar && s.mySeat >= 0) {
            const cur = W.pl[s.mySeat] && W.pl[s.mySeat].a;
            box.append(h('div', { class: 'av-lobby' }, App.avatar.picker(cur || s.av, (a) => s.setMyAvatar(a), { compact: true, onClose: () => { s._avOpen = false; render(s); } })));
          }
          if (s.isHost) {
            if (cfg.renderOptions) { const o = h('div', { class: 'opts' }); cfg.renderOptions(o, s, false); box.append(o); }
            const ok = W.pl.length >= e.minPlayers;
            box.append(h('button', { class: 'btn primary big lobby-start', disabled: !ok, onclick: () => s.startGame() }, ok ? '게임 시작' : ('최소 ' + e.minPlayers + '명 필요')));
            if (s.mode === 'host' && e.allowBots) box.append(h('p', { class: 'note' }, '친구가 다 안 모이면 빈자리를 「+ 컴퓨터」로 채워도 돼요.'));
          } else {
            if (cfg.renderOptions) { const o = h('div', { class: 'opts' }); cfg.renderOptions(o, s, true); box.append(o); }
          }
          view.append(box);
          return;
        }

        // 게임 중 / 종료
        const gameEl = h('div', { class: 'game-area' });
        view.append(gameEl);
        cfg.renderGame(gameEl, s);
        if (W.ph === 'end') {
          const ann = announcement(W, s.mySeat);
          if (ann) view.append(ann);
          if (finishedFor !== W.gn && s.mySeat >= 0) {
            finishedFor = W.gn;
            ctx.finished(cfg.finishInfo ? cfg.finishInfo(s) : null);
          }
          const endCtl = h('div', { class: 'row wrap end-ctl' });
          if (s.isHost) {
            endCtl.append(h('button', { class: 'btn primary', onclick: () => s.startGame() }, '같은 멤버로 다시'), h('button', { class: 'btn', onclick: () => s.backToLobby() }, s.mode === 'local' ? '설정 바꾸기' : '로비로'));
          } else endCtl.append(h('span', { class: 'note' }, '방장이 다음 판을 시작할 때까지 기다려 주세요.'));
          view.append(endCtl);
        }
      }

      // 남은 시간 표시 갱신
      const clock = setInterval(() => {
        if (!session || !session.W || session.W.ph !== 'play') return;
        view.querySelectorAll('[data-until]').forEach((el) => {
          const r = +el.dataset.until - Date.now();
          el.textContent = App.leftText(r);
        });
        view.querySelectorAll('[data-timer-seat]').forEach((el) => {
          const r = session.remaining(+el.dataset.timerSeat);
          el.textContent = r == null ? '' : App.leftText(r);
        });
        if (App.music) {
          // 내 차례 제한 시간(또는 data-hurry 표시가 붙은 단계 시간)이 15초 안쪽이면 빨라지게
          const me = session.mySeat;
          let left = me >= 0 ? session.remaining(me) : null;
          view.querySelectorAll('[data-hurry][data-until]').forEach((el) => { const r = +el.dataset.until - Date.now(); if (left == null || r < left) left = r; });
          App.music.hurry(left != null && left > 0 && left < 15000);
        }
      }, 300);

      renderChooser();
      return () => { clearInterval(clock); unsubStatus(); music(false); dispose(session); if (session) session.close(); };
    },
  };
})();
