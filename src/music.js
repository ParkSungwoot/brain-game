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
  let ctx = null, master = null, pulse12 = null, pulse25 = null, noise = null;
  let gestured = false, playing = false, timer = null, step = 0, nextT = 0, hurry = false, idleT = null;
  // 'running'·'closed' 가 아니면 깨워야 함 (iOS 사파리는 전화·다른 앱 소리 뒤 'interrupted' 상태가 됨)
  const asleep = () => ctx && ctx.state !== 'running' && ctx.state !== 'closed';
  const wake = () => { if (asleep()) ctx.resume().catch(() => {}); };
  const holders = new Set();
  const buttons = new Set();

  // ---------- 곡 (A단조, 16분음표 단위, 8마디 반복) ----------
  const BARS = 8, SPB = 16;
  // 마디별 화음: 근음(베이스)과 아르페지오 음
  const CH = {
    Am: { r: 45, a: [69, 72, 76] }, F: { r: 41, a: [65, 69, 72] }, Dm: { r: 38, a: [62, 65, 69] },
    E: { r: 40, a: [64, 68, 71] }, G: { r: 43, a: [67, 71, 74] },
  };
  const PROG = ['Am', 'F', 'Dm', 'E', 'Am', 'F', 'G', 'E'];
  // 멜로디: [시작 칸, 음, 길이(칸)]
  const LEAD = [
    [[0, 76, 3], [4, 77, 1], [5, 76, 3], [8, 72, 2], [10, 74, 2], [12, 76, 4]],
    [[0, 77, 3], [4, 76, 1], [5, 74, 3], [8, 72, 4], [12, 69, 4]],
    [[0, 74, 2], [2, 72, 2], [4, 74, 2], [6, 77, 2], [8, 76, 6], [14, 74, 2]],
    [[0, 71, 4], [4, 68, 2], [6, 71, 2], [8, 76, 8]],
    [[0, 81, 3], [4, 79, 1], [5, 77, 3], [8, 76, 4], [12, 72, 4]],
    [[0, 77, 2], [2, 76, 2], [4, 74, 4], [8, 72, 2], [10, 74, 2], [12, 77, 4]],
    [[0, 79, 3], [4, 77, 1], [5, 74, 3], [8, 71, 4], [12, 74, 4]],
    [[0, 76, 2], [2, 75, 2], [4, 76, 2], [6, 80, 2], [8, 83, 8]],
  ];
  const BASS = [0, 0, 12, 0, 0, 12, 0, 7]; // 8분음표마다 근음에서 몇 반음 위

  const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const stepDur = () => 60 / (hurry ? 162 : 138) / 4;

  function pulseWave(c, duty) {
    const n = 48, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) {
      re[k] = Math.sin(2 * Math.PI * k * duty) / (k * Math.PI);
      im[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (k * Math.PI);
    }
    return c.createPeriodicWave(re, im);
  }

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; return null; }
    master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    pulse12 = pulseWave(ctx, 0.125);
    pulse25 = pulseWave(ctx, 0.25);
    const len = Math.floor(ctx.sampleRate * 0.5);
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    ctx.onstatechange = () => update();
    return ctx;
  }

  function tone(wave, midi, t, dur, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    if (typeof wave === 'string') o.type = wave; else o.setPeriodicWave(wave);
    o.frequency.setValueAtTime(freq(midi), t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.setValueAtTime(vol, t + dur * 0.65);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.18);
  }
  function hiss(t, dur, vol, hp) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise;
    f.type = 'highpass'; f.frequency.value = hp;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.02);
  }

  function playStep(i, t) {
    const bar = Math.floor(i / SPB) % BARS, s = i % SPB, sd = stepDur();
    const ch = CH[PROG[bar]];
    // 베이스: 8분음표
    if (s % 2 === 0) tone('triangle', ch.r + BASS[s / 2], t, sd * 1.8, 0.55);
    // 아르페지오: 16분음표, 작게
    tone(pulse12, ch.a[[0, 1, 2, 1][s % 4]] + (bar % 2 && s >= 8 ? 12 : 0), t, sd * 0.9, 0.07);
    // 멜로디
    for (const [st, m, len] of LEAD[bar]) if (st === s) tone(pulse25, m, t, sd * len * 0.95, 0.16);
    // 북
    if (s === 0 || s === 8 || (hurry && (s === 10 || s === 14))) kick(t);
    if (s === 4 || s === 12) hiss(t, 0.13, 0.35, 1400);
    if (hurry ? true : s % 2 === 0) hiss(t, 0.035, s % 4 === 2 ? 0.16 : 0.09, 7000);
    // 마지막 마디 끝: 다음 바퀴로 넘어가는 북 채우기
    if (bar === BARS - 1 && s >= 12) hiss(t, 0.08, 0.22, 2200);
  }

  function schedule() {
    if (!playing || !ctx) return;
    const now = ctx.currentTime;
    if (nextT < now - 0.05) nextT = now + 0.03; // 탭이 잠깐 멈췄다 돌아오면 한꺼번에 몰아 치지 않게
    while (nextT < now + 0.12) {
      playStep(step, nextT);
      nextT += stepDur();
      step = (step + 1) % (BARS * SPB);
    }
  }

  function startLoop() {
    clearTimeout(idleT);
    if (playing) return;
    playing = true;
    step = 0;
    nextT = ctx.currentTime + 0.06;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(VOL, ctx.currentTime + 0.8);
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
