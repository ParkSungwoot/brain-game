// 릴스용 화면 녹화 도구: 휴대폰 화면(360×640, 3배 → 1080×1920)을 그대로 녹화해 MP4 로
//
//   const { record } = require('./rec');
//   record('01-landing', async (r) => { await r.go('#'); await r.start(); await r.swipe(600, 1500); ... });
//
// 환경 변수
//   DRAFT=1   빠른 확인용 (1배 크기 360×640, 낮은 화질) + 1초마다 프레임 PNG (확인용)
//   REC_OUT   결과 폴더 (기본: 스크래치패드/rec)
//   SITE      사이트 주소 (기본 http://127.0.0.1:8795/  — site/ 폴더를 띄운 것)
// 사이트는 Firebase 에뮬레이터(127.0.0.1:9099/9000)에 붙어서 실제 사이트와 똑같이 온라인 기능이 동작
//
// r(녹화 도구) 기능
//   r.page / r.ctx / r.browser   Playwright 객체
//   r.go(hash)                  사이트 열기 (녹화 시작 전)
//   r.start()                   녹화 시작 (이 앞의 준비 과정은 영상에 안 들어감)
//   r.wait(ms)                  가만히 있기 (영상에 그대로)
//   r.tap(target, {hold})       손가락으로 누르기 (target: 선택자 문자열, 로케이터, {x,y})
//   r.type(text, delay)         글자 입력 (먼저 입력칸을 r.tap 으로 누르기)
//   r.swipe(dy, ms)             손가락으로 쓸어 화면 스크롤 (dy>0 아래로)
//   r.scrollTo(target, ms)      요소가 화면 가운데쯤 오게 부드럽게 스크롤
//   r.drag(points, stepMs)      손가락으로 누른 채 여러 점을 지나가기 [{x,y},...] (CSS 픽셀)
//   r.center(target)            요소 가운데 좌표 {x,y}
//   r.newFriend()               같은 사이트를 연 다른 사람(녹화 안 됨)의 페이지
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DRAFT = process.env.DRAFT === '1';
const W = 360, H = 640, DSF = DRAFT ? 1 : 3;
const SITE = process.env.SITE || 'http://127.0.0.1:8795/';
const OUT = process.env.REC_OUT || '/tmp/claude-0/-home-user-brain-game/c318d9bd-2f10-501a-9eed-8e86a668daae/scratchpad/rec';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

// 손가락 표시: 누르면 동그라미, 누른 채 움직이면 따라감, 떼면 퍼지며 사라짐
const OVERLAY = `(() => {
  window.App = Object.assign(window.App || {}, { FIREBASE_EMU: { host: '127.0.0.1', authPort: 9099, dbPort: 9000 } });
  const css = '.__f{position:fixed!important;left:0;top:0;width:46px!important;height:46px!important;margin:-23px 0 0 -23px!important;border-radius:50%!important;background:rgba(255,255,255,.38)!important;border:3px solid rgba(255,255,255,.95)!important;box-shadow:0 0 0 2px rgba(0,0,0,.35),0 2px 10px rgba(0,0,0,.35)!important;pointer-events:none!important;z-index:2147483647!important;transform:scale(.55);transition:transform .16s ease-out,opacity .4s ease-out!important;padding:0!important}.__f.on{transform:scale(1)}.__f.off{transform:scale(1.45);opacity:0}';
  let dot = null;
  function make(x, y) { const d = document.createElement('div'); d.className = '__f'; d.style.left = x + 'px'; d.style.top = y + 'px'; (document.body || document.documentElement).appendChild(d); requestAnimationFrame(() => d.classList.add('on')); return d; }
  function down(x, y) { if (dot) up(); dot = make(x, y); }
  function move(x, y) { if (dot) { dot.style.left = x + 'px'; dot.style.top = y + 'px'; } }
  function up() { const d = dot; dot = null; if (!d) return; d.classList.add('off'); setTimeout(() => d.remove(), 450); }
  window.__finger = { down, move, up };
  addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); });
  addEventListener('pointerdown', (e) => down(e.clientX, e.clientY), true);
  addEventListener('pointermove', (e) => move(e.clientX, e.clientY), true);
  addEventListener('pointerup', () => up(), true);
  addEventListener('pointercancel', () => up(), true);
})();`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function record(name, fn) {
  fs.mkdirSync(OUT, { recursive: true });
  const frameDir = fs.mkdtempSync(path.join(OUT, '.frames-' + name + '-'));
  const browser = await chromium.launch({ args: ['--hide-scrollbars', '--force-color-profile=srgb'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, isMobile: true, hasTouch: true, userAgent: UA, locale: 'ko-KR', colorScheme: 'dark' });
  await ctx.addInitScript(OVERLAY);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  let recording = false, t0 = 0, stopT = 0;
  cdp.on('Page.screencastFrame', async (f) => {
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (e) { /* 무시 */ }
    if (!recording) return;
    const file = path.join(frameDir, String(frames.length).padStart(6, '0') + '.jpg');
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, t: f.metadata.timestamp });
  });

  const center = async (target) => {
    if (target && typeof target.x === 'number') return target;
    const loc = typeof target === 'string' ? page.locator(target).first() : target;
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    const b = await loc.boundingBox();
    if (!b) throw new Error('보이지 않음: ' + target);
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })) });

  const r = {
    page, ctx, browser, DRAFT,
    async go(hash) {
      await page.goto(SITE + (hash || ''));
      await page.waitForLoadState('networkidle').catch(() => {});
    },
    async start() {
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: DRAFT ? 70 : 92, maxWidth: W * DSF, maxHeight: H * DSF, everyNthFrame: 1 });
      recording = true; t0 = Date.now() / 1000;
      // 첫 프레임이 바로 오도록 살짝 다시 그리기
      await page.evaluate(() => { document.body.style.outline = '0 solid transparent'; requestAnimationFrame(() => { document.body.style.outline = ''; }); });
      await sleep(120);
    },
    wait: (ms) => sleep(ms),
    center,
    async tap(target, o) {
      const p = await center(target);
      await touch('touchStart', [p]);
      await sleep((o && o.hold) || 110);
      await touch('touchEnd', []);
      await sleep((o && o.after) || 250);
    },
    async type(text, delay) { await page.keyboard.type(text, { delay: delay || 140 }); },
    // 손가락으로 쓸어 올리는 모습 + 부드러운 스크롤 (끝에서 천천히 멈춤)
    async swipe(dy, ms) {
      ms = ms || 900;
      await page.evaluate(([dy, ms, W, H]) => new Promise((res) => {
        const x = W * 0.62, y0 = dy > 0 ? H * 0.72 : H * 0.3, y1 = y0 - Math.sign(dy) * Math.min(H * 0.42, Math.abs(dy));
        const s0 = scrollY, t0 = performance.now();
        window.__finger.down(x, y0);
        const ease = (t) => 1 - Math.pow(1 - t, 3);
        (function step(now) {
          const t = Math.min(1, (now - t0) / ms);
          scrollTo(0, s0 + dy * ease(t));
          if (t < 0.5) window.__finger.move(x, y0 + (y1 - y0) * (t / 0.5));
          else if (t >= 0.5 && window.__finger) window.__finger.up();
          if (t < 1) requestAnimationFrame(step); else res();
        })(t0);
      }), [dy, ms, W, H]);
      await sleep(60);
    },
    async scrollTo(target, ms) {
      const loc = typeof target === 'string' ? page.locator(target).first() : target;
      const b = await loc.evaluate((el) => { const q = el.getBoundingClientRect(); return { top: q.top, h: q.height }; });
      const dy = b.top + b.h / 2 - H / 2;
      if (Math.abs(dy) > 4) await r.swipe(dy, ms);
    },
    async drag(points, stepMs) {
      stepMs = stepMs || 90;
      await touch('touchStart', [points[0]]);
      await sleep(stepMs);
      for (let i = 1; i < points.length; i++) {
        // 두 점 사이를 몇 단계로 나눠 부드럽게
        const a = points[i - 1], b = points[i];
        const n = 4;
        for (let k = 1; k <= n; k++) { await touch('touchMove', [{ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n }]); await sleep(stepMs / n); }
      }
      await sleep(stepMs);
      await touch('touchEnd', []);
      await sleep(200);
    },
    async newFriend() {
      const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ko-KR' });
      await c2.addInitScript(OVERLAY);
      return c2.newPage();
    },
  };

  let ok = true;
  try { await fn(r); } catch (e) { ok = false; console.error('[' + name + '] 실패:', e.message); }
  stopT = Date.now() / 1000;
  recording = false;
  try { await cdp.send('Page.stopScreencast'); } catch (e) { /* 무시 */ }
  await browser.close();
  if (errs.length) console.log('[' + name + '] 페이지 오류:', errs);
  if (!frames.length) { console.log('[' + name + '] 프레임 없음'); return null; }

  // 프레임마다 화면에 머문 시간 → 30fps MP4
  const list = [];
  for (let i = 0; i < frames.length; i++) {
    const end = i + 1 < frames.length ? frames[i + 1].t : stopT;
    list.push(`file '${frames[i].file}'`, `duration ${Math.max(0.001, end - frames[i].t).toFixed(4)}`);
  }
  list.push(`file '${frames[frames.length - 1].file}'`);
  const listFile = path.join(frameDir, 'list.txt');
  fs.writeFileSync(listFile, list.join('\n'));
  const mp4 = path.join(OUT, name + (DRAFT ? '-draft' : '') + '.mp4');
  const vf = `fps=30,scale=${W * DSF}:${H * DSF}:flags=lanczos,format=yuv420p`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-vf', vf, '-c:v', 'libx264', '-preset', DRAFT ? 'veryfast' : 'slow', '-crf', DRAFT ? '28' : '15', '-tune', 'animation', '-movflags', '+faststart', mp4]);
  const dur = stopT - frames[0].t;
  console.log(`[${name}] ${ok ? 'ok' : 'FAILED'} · ${dur.toFixed(1)}초 · 프레임 ${frames.length}개 (평균 ${(frames.length / dur).toFixed(1)}fps) → ${mp4}`);
  if (DRAFT) {
    // 확인용: 1초마다 한 장
    const pngDir = path.join(OUT, name + '-frames');
    fs.rmSync(pngDir, { recursive: true, force: true });
    fs.mkdirSync(pngDir, { recursive: true });
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp4, '-vf', 'fps=1', path.join(pngDir, '%02d.png')]);
    // 한눈에 보기: 1초 간격 프레임을 한 장에 (가로 6장씩)
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp4, '-vf', 'fps=1,scale=180:-1,tile=6x4:padding=4:color=gray', '-frames:v', '1', path.join(OUT, name + '-sheet.png')]);
    console.log(`[${name}] 확인용 프레임: ${pngDir}/ , 모아 보기: ${path.join(OUT, name + '-sheet.png')}`);
  }
  fs.rmSync(frameDir, { recursive: true, force: true });
  return ok ? mp4 : null;
}

module.exports = { record, sleep, W, H, SITE, OUT };
