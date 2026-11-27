/* 공통 유틸: DOM 헬퍼, 난수, 저장소, 진행 기록 */
(function () {
  const App = (globalThis.App = globalThis.App || {});
  App.games = App.games || [];

  // ---------- 난수 ----------
  const R = (App.rng = {
    int(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); },
    pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    chance(p) { return Math.random() < p; },
  });

  // ---------- 저장소 (브라우저 저장소가 막혀도 동작) ----------
  const mem = {};
  App.store = {
    get(k, d) {
      try {
        const v = globalThis.localStorage && localStorage.getItem('bgr.' + k);
        if (v != null) return JSON.parse(v);
      } catch (e) { /* 무시 */ }
      return k in mem ? mem[k] : d;
    },
    set(k, v) {
      mem[k] = v;
      try { globalThis.localStorage && localStorage.setItem('bgr.' + k, JSON.stringify(v)); } catch (e) { /* 무시 */ }
    },
  };

  App.progress = {
    plays(id) { return App.store.get('plays.' + id, 0); },
    best(id) { return App.store.get('best.' + id, null); },
    finish(id, info) {
      const n = App.progress.plays(id) + 1;
      App.store.set('plays.' + id, n);
      if (info && typeof info.score === 'number') {
        const b = App.progress.best(id);
        const better = info.lowerIsBetter ? (b == null || info.score < b) : (b == null || info.score > b);
        if (better) App.store.set('best.' + id, info.score);
      }
      return n;
    },
  };

  // ---------- DOM ----------
  App.h = function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v; // 내부에서 작성한 정적 문자열에만 사용
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (sk.startsWith('--')) el.style.setProperty(sk, String(v[sk])); else el.style[sk] = v[sk]; } }
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  };

  App.clear = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  let toastTimer = null;
  App.toast = function (msg, kind) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.dataset.kind = kind || '';
    el.hidden = false;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.classList.remove('show'); el.hidden = true; }, 2600);
  };

  // 사람이 입력한 닉네임 정리 (제어문자 제거, 12자 제한)
  App.cleanNick = function (s) {
    return String(s || '')
      .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '')
      .trim()
      .slice(0, 12) || '플레이어';
  };

  App.fmtTime = function (ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
})();
