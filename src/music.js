/* 배경 음악: 음악 파일 없이 Web Audio로 그때그때 만드는 8비트 긴장감 반복곡 (이 사이트에서 새로 만든 곡)
 *
 * - 게임이 시작되면 App.music.claim(이름), 끝나면 App.music.release(이름). 붙잡은 곳이 하나라도 있으면 재생
 * - 켜기/끄기는 App.music.button() 버튼으로. 설정은 이 브라우저에 기억
 * - 브라우저는 사용자가 한 번 누르기 전에는 소리를 막으므로, 첫 터치·클릭·키 입력 때 오디오를 깨움
 * - 남은 시간이 얼마 안 남으면 App.music.hurry(true) → 빨라지고 하이햇이 촘촘해짐
 */
(function () {
  const App = (globalThis.App = globalThis.App || {});
  const KEY = 'music.on';
  const VOL = 0.17;

  let on = true;
  try { on = App.store ? App.store.get(KEY, true) !== false : true; } catch (e) { on = true; }
  let ctx = null, master = null;
  let gestured = false, playing = false, timer = null, step = 0, nextT = 0, hurry = false, idleT = null, forceSong = null;
  // 'running'·'closed' 가 아니면 깨워야 함 (iOS 사파리는 전화·다른 앱 소리 뒤 'interrupted' 상태가 됨)
  const asleep = () => ctx && ctx.state !== 'running' && ctx.state !== 'closed';
  const wake = () => { if (asleep()) ctx.resume().catch(() => {}); };
  const holders = new Set();
  const buttons = new Set();

  // ---------- 곡 연주 (곡 데이터는 music-songs.js) ----------
  const SONGS = () => App.musicSongs || [];
  let song = null, songIdx = -1;
  const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const stepDurOf = (sg, fast) => 60 / (fast ? sg.hurryBpm || sg.bpm : sg.bpm) / 4;
  const stepDur = () => stepDurOf(song, hurry);

  function pulseWave(c, duty) {
    const n = 48, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) {
      re[k] = Math.sin(2 * Math.PI * k * duty) / (k * Math.PI);
      im[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (k * Math.PI);
    }
    return c.createPeriodicWave(re, im);
  }
  // 오디오 장치 하나에 필요한 것들 (실제 재생용, 미리 만들어 보기용 각각)
  function makeKit(c, out) {
    const len = Math.floor(c.sampleRate * 0.5);
    const noise = c.createBuffer(1, len, c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return { c, out, noise, w: { p12: pulseWave(c, 0.125), p25: pulseWave(c, 0.25), p50: pulseWave(c, 0.5), tri: 'triangle' } };
  }
  let kit = null;

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; return null; }
    master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    kit = makeKit(ctx, master);
    ctx.onstatechange = () => update();
    return ctx;
  }

  function tone(K, wave, midi, t, dur, vol) {
    const c = K.c, o = c.createOscillator(), g = c.createGain();
    const w = K.w[wave] || K.w.p25;
    if (typeof w === 'string') o.type = w; else o.setPeriodicWave(w);
    o.frequency.setValueAtTime(freq(midi), t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.setValueAtTime(vol, t + dur * 0.65);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(K.out);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function kick(K, t, vol) {
    const c = K.c, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g); g.connect(K.out);
    o.start(t); o.stop(t + 0.18);
  }
  function hiss(K, t, dur, vol, hp) {
    const c = K.c, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = K.noise;
    f.type = 'highpass'; f.frequency.value = hp;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(K.out);
    s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.02);
  }

  // i 번째 칸을 t 초에 연주
  function playStep(K, sg, i, t, fast) {
    const S = sg.steps || 16, nb = sg.bars.length;
    const bar = Math.floor(i / S) % nb, s = i % S, sd = stepDurOf(sg, fast);
    const ch = sg.bars[bar];
    const B = sg.bass;
    if (B) {
      const pat = B.alt && bar % 2 ? B.alt : B.pat;
      const o = pat[s];
      if (o != null) tone(K, B.wave || 'tri', ch.r + o, t, sd * (B.len || 2) * 0.9, 0.55 * (B.vol == null ? 1 : B.vol));
    }
    const A = sg.arp;
    if (A) {
      const pat = A.alt && bar % 2 ? A.alt : A.pat;
      const a = pat[s];
      if (a != null) tone(K, A.wave || 'p12', ch.t[a % 3] + (a >= 3 ? 12 : 0), t, sd * 0.9, 0.07 * (A.vol == null ? 1 : A.vol));
    }
    const Ld = sg.lead;
    if (Ld) {
      const v = 0.16 * (Ld.vol == null ? 1 : Ld.vol);
      for (const [st, m, len] of Ld.notes[bar] || []) {
        if (st !== s) continue;
        tone(K, Ld.wave || 'p25', m, t, sd * len * 0.95, v);
        if (Ld.echo) tone(K, Ld.wave || 'p25', m, t + sd * Ld.echo, sd * len * 0.8, v * 0.3);
      }
    }
    const D = sg.drums || {};
    const kp = (fast && D.hk) || D.k, hp = (fast && D.hh) || D.h;
    const kc = kp && kp[s];
    if (kc === 'x' || kc === 'o') kick(K, t, kc === 'o' ? 1 : 0.85);
    const sc = D.s && D.s[s];
    if (sc === 'x' || sc === 'o' || sc === 'g') hiss(K, t, 0.13, sc === 'o' ? 0.45 : sc === 'g' ? 0.12 : 0.35, 1400);
    const hc = hp && hp[s];
    if (hc === 'x' || hc === 'o') hiss(K, t, hc === 'o' ? 0.06 : 0.035, hc === 'o' ? 0.16 : 0.09, 7000);
    if (sg.fill && bar === nb - 1 && s >= S - 4) hiss(K, t, 0.08, 0.22, 2200);
  }

  // 들어갈 때마다 무작위 곡 (바로 전 곡은 빼고)
  function pickSong() {
    const list = SONGS();
    if (!list.length) return null;
    let last = -1;
    try { last = App.store.get('music.last', -1); } catch (e) { /* 무시 */ }
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === last) i = (i + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
    try { App.store.set('music.last', i); } catch (e) { /* 무시 */ }
    songIdx = i;
    return list[i];
  }

  function schedule() {
    if (!playing || !ctx) return;
    const now = ctx.currentTime;
    if (nextT < now - 0.05) nextT = now + 0.03; // 탭이 잠깐 멈췄다 돌아오면 한꺼번에 몰아 치지 않게
    while (nextT < now + 0.12) {
      playStep(kit, song, step, nextT, hurry);
      nextT += stepDur();
      step = (step + 1) % ((song.steps || 16) * song.bars.length);
    }
  }

  function startLoop() {
    clearTimeout(idleT);
    if (playing) return;
    if (!forceSong) song = pickSong(); else { song = forceSong; forceSong = null; }
    if (!song) return;
    playing = true;
    step = 0;
    nextT = ctx.currentTime + 0.06;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(VOL * (song.gain || 1), ctx.currentTime + 0.8);
    schedule();
    timer = setInterval(schedule, 25);
  }
  function stopLoop() {
    if (!playing) return;
    playing = false;
    clearInterval(timer); timer = null;
    if (ctx) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
    }
    sleepSoon();
  }
  // 소리가 다 줄어든 뒤 오디오를 재워 둠 (휴대폰 배터리). 다시 필요하면 update()/다음 터치에서 깨움
  function sleepSoon() {
    clearTimeout(idleT);
    idleT = setTimeout(() => { if (!playing && ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); }, 700);
  }

  function hidden() { try { return document.hidden; } catch (e) { return false; } }

  function update() {
    const want = on && holders.size > 0 && !hidden();
    if (want && gestured && ensureCtx()) {
      if (asleep()) { wake(); return; } // 깨어나면 onstatechange 로 다시 옴
      if (ctx.state === 'running') startLoop();
    } else {
      stopLoop();
      if (ctx && ctx.state === 'running' && !playing) sleepSoon();
    }
    if (!holders.size) hurry = false;
  }

  // 첫 터치·클릭·키 입력에서 오디오를 깨움 (브라우저 자동 재생 막기 때문)
  function unlock() {
    gestured = true;
    // 터치 안에서 깨워야 iOS 가 허락함. 지금 틀 게 없으면 update() 가 곧 다시 재움
    if (on && ensureCtx()) wake();
    update();
  }
  if (typeof document !== 'undefined') {
    for (const ev of ['pointerdown', 'touchend', 'keydown']) document.addEventListener(ev, unlock, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (hidden()) { stopLoop(); ctx.suspend().catch(() => {}); } else update();
    });
  }

  function refreshButtons() {
    for (const b of [...buttons]) {
      if (!b.isConnected) { buttons.delete(b); continue; }
      paint(b);
    }
  }
  function paint(b) {
    b.textContent = on ? '🔊 음악 켜짐' : '🔇 음악 꺼짐';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.classList.toggle('off', !on);
  }

  App.music = {
    claim(id) { holders.add(id); update(); },
    release(id) { if (holders.delete(id)) update(); },
    hurry(v) { hurry = !!v && holders.size > 0; },
    enabled: () => on,
    playing: () => playing,
    setEnabled(v) {
      on = !!v;
      try { App.store.set(KEY, on); } catch (e) { /* 무시 */ }
      if (on) { gestured = true; if (ensureCtx()) wake(); }
      update();
      refreshButtons();
    },
    toggle() { App.music.setEnabled(!on); },
    // 점검용: 지금 곡 번호, 곡 수, 특정 곡으로 다시 시작
    current: () => (playing ? songIdx : -1),
    count: () => SONGS().length,
    _restartWith(i) { const sg = SONGS()[i]; if (!sg) return; stopLoop(); forceSong = sg; songIdx = i; update(); },
    // 점검·미리 듣기용: 곡 i 를 sec 초 동안 소리 없이 만들어 Float32Array 로 (서두르기 여부 fast)
    async _render(i, sec, fast, rate) {
      const sg = SONGS()[i];
      const OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
      if (!sg || !OAC) return null;
      rate = rate || 22050;
      const c = new OAC(1, Math.ceil(rate * sec), rate);
      const g = c.createGain(); g.gain.value = VOL * (sg.gain || 1);
      const comp = c.createDynamicsCompressor();
      g.connect(comp); comp.connect(c.destination);
      const K = makeKit(c, g);
      const sd = stepDurOf(sg, fast);
      for (let k = 0, t = 0.02; t < sec; k++, t += sd) playStep(K, sg, k, t, fast);
      const buf = await c.startRendering();
      return buf.getChannelData(0);
    },
    // 켜기/끄기 버튼 (여러 화면에 있어도 모두 같이 바뀜)
    button(cls) {
      const b = App.h('button', { class: 'music-btn' + (cls ? ' ' + cls : ''), type: 'button', title: '게임 중 배경 음악 켜기/끄기', onclick: () => App.music.toggle() });
      paint(b);
      for (const x of [...buttons]) if (!x.isConnected) buttons.delete(x); // 떠난 화면의 버튼은 잡아 두지 않음
      buttons.add(b);
      return b;
    },
  };
})();
