/* Firebase 실시간 방: 로그인 없이(익명) 방 코드만으로 연결 (GitHub Pages 판에서 사용)
 *
 * 데이터 모양: rooms/{방이름}/peers/{접속 id} = { u: 익명 uid, p: presence(JSON 글자), t: 서버 시각 }
 *  - 각 화면은 자기 칸 하나만 씀. 창을 닫거나 연결이 끊기면 서버가 그 칸을 지움(onDisconnect)
 *  - 방 목록은 읽을 수 없고, 코드를 알아야 그 방을 읽을 수 있음 (database.rules.json)
 */
(function () {
  const App = (globalThis.App = globalThis.App || {});

  function rid() { return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 8); }
  function deepFreeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const k in o) deepFreeze(o[k]); } return o; }
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = () => resolve(); s.onerror = () => reject(new Error('스크립트를 불러오지 못했어요'));
      document.head.append(s);
    });
  }

  let kitP = null;   // 연결 준비 (한 번만)
  let live = 0, offTimer = null;
  let offset = 0;

  async function boot() {
    if (!globalThis.FB) await loadScript(App.FB_SRC || 'fb.js');
    const F = globalThis.FB;
    const app = F.initializeApp(App.FIREBASE);
    let auth;
    try { auth = F.initializeAuth(app, { persistence: [F.browserLocalPersistence, F.inMemoryPersistence] }); } catch (e) { auth = F.initializeAuth(app, { persistence: F.inMemoryPersistence }); }
    const db = F.getDatabase(app);
    const emu = App.FIREBASE_EMU;
    if (emu) {
      F.connectAuthEmulator(auth, 'http://' + emu.host + ':' + emu.authPort, { disableWarnings: true });
      F.connectDatabaseEmulator(db, emu.host, emu.dbPort);
    }
    const cred = await F.signInAnonymously(auth);
    F.onValue(F.ref(db, '.info/serverTimeOffset'), (s) => { offset = Number(s.val()) || 0; });
    return { F, db, uid: cred.user.uid, connRef: F.ref(db, '.info/connected') };
  }
  function kit() {
    if (!kitP) { kitP = boot(); kitP.catch(() => { kitP = null; }); }
    return kitP;
  }
  function online(K) { live++; clearTimeout(offTimer); try { K.F.goOnline(K.db); } catch (e) { /* 무시 */ } }
  function offline(K) {
    live = Math.max(0, live - 1);
    if (live === 0) { clearTimeout(offTimer); offTimer = setTimeout(() => { if (live === 0) { try { K.F.goOffline(K.db); } catch (e) { /* 무시 */ } } }, 4000); }
  }

  class FireRoom {
    constructor(K, name) {
      this.K = K; this.F = K.F;
      this.name = String(name).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40);
      this.me = rid();
      this.pres = {};
      this.others = [];
      this.subs = new Set(); this.errs = new Set();
      this.base = this.F.ref(K.db, 'rooms/' + this.name + '/peers');
      this.mine = this.F.ref(K.db, 'rooms/' + this.name + '/peers/' + this.me);
      this.closed = false; this.wasOff = false;
    }
    _node() { return { u: this.K.uid, p: JSON.stringify(this.pres), t: this.F.serverTimestamp() }; }
    async open() {
      const F = this.F;
      online(this.K);
      await F.set(this.mine, this._node());
      await F.onDisconnect(this.mine).remove();
      this.offPeers = F.onValue(this.base, (snap) => {
        const v = snap.val() || {};
        const list = [];
        for (const k of Object.keys(v)) {
          if (k === this.me) continue;
          let p = {};
          try { p = JSON.parse(v[k].p || '{}'); } catch (e) { /* 무시 */ }
          list.push({ peer: k, by: null, isMe: false, sameTab: false, kind: 'viewer', guest: false, presence: deepFreeze(p), updatedAt: v[k].t || 0 });
        }
        this.others = list;
        this._notify();
      }, (err) => { for (const fn of this.errs) { try { fn({ code: err.code || 'error', message: err.message }); } catch (e) { /* 무시 */ } } });
      // 잠깐 끊겼다 다시 붙으면 서버가 지운 내 칸을 다시 씀
      this.offConn = F.onValue(this.K.connRef, (s) => {
        if (this.closed) return;
        if (s.val() === true) {
          if (this.wasOff) { this.wasOff = false; F.set(this.mine, this._node()).then(() => F.onDisconnect(this.mine).remove()).catch(() => {}); }
        } else this.wasOff = true;
      });
      return this;
    }
    presence(patch) {
      const next = Object.assign({}, this.pres);
      for (const k in patch) { if (patch[k] === null) delete next[k]; else next[k] = patch[k]; }
      this.pres = JSON.parse(JSON.stringify(next));
      this._notify();
      if (this.closed) return Promise.resolve();
      return this.F.set(this.mine, this._node()).catch((e) => { throw { code: e.code || 'write_failed', message: e.message }; });
    }
    peers() {
      return [{ peer: this.me, by: null, isMe: true, sameTab: true, kind: 'viewer', guest: false, presence: this.pres, updatedAt: Date.now() }].concat(this.others);
    }
    _notify() { const ps = this.peers(); for (const fn of this.subs) { try { fn({ peers: ps }); } catch (e) { console.error(e); } } }
    onPeers(fn, errFn) {
      this.subs.add(fn); if (errFn) this.errs.add(errFn);
      setTimeout(() => { if (this.subs.has(fn)) fn({ peers: this.peers() }); }, 0);
      return () => { this.subs.delete(fn); if (errFn) this.errs.delete(errFn); };
    }
    connected() { return true; }
    async leave() {
      if (this.closed) return;
      this.closed = true;
      try { this.offPeers && this.offPeers(); this.offConn && this.offConn(); } catch (e) { /* 무시 */ }
      this.subs.clear(); this.errs.clear();
      try { await this.F.onDisconnect(this.mine).cancel(); } catch (e) { /* 무시 */ }
      try { await this.F.remove(this.mine); } catch (e) { /* 무시 */ }
      offline(this.K);
    }
  }

  App.fire = {
    enabled: () => !!App.FIREBASE,
    async join(name) {
      const K = await kit();
      const r = new FireRoom(K, name);
      return r.open();
    },
    now: () => Date.now() + offset,
  };
})();
