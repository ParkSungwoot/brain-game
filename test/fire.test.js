// Firebase 에뮬레이터로 GitHub Pages 판 실시간 연결 점검 (두 기기 = 두 브라우저 컨텍스트)
const { chromium, devices } = require('playwright');
const URL = 'http://127.0.0.1:8791/index.html';
const EMU = () => { window.App = Object.assign(window.App || {}, { FIREBASE_EMU: { host: '127.0.0.1', authPort: 9099, dbPort: 9000 } }); };
(async () => {
  const b = await chromium.launch();
  const cA = await b.newContext({ viewport: { width: 1000, height: 900 } }); const cB = await b.newContext({ ...devices['iPhone 13'] });
  await cA.addInitScript(EMU); await cB.addInitScript(EMU);
  const A = await cA.newPage(), B = await cB.newPage();
  const errs = []; for (const [n, p] of [['A', A], ['B', B]]) { p.on('pageerror', (e) => errs.push(n + ' ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(n + ' console ' + m.text().slice(0, 160)); }); }
  // 1) 담장 영토전 1:1 온라인
  await A.goto(URL + '#wall'); await B.goto(URL + '#wall');
  await A.waitForSelector('#wall-nick'); await A.fill('#wall-nick', '현진');
  await A.waitForFunction(() => !document.querySelector('button.btn:not(.primary)') || [...document.querySelectorAll('button')].some((x) => x.textContent === '온라인 방 만들기' && !x.disabled));
  console.log('A note:', await A.textContent('.mp-choose .note'));
  const t0 = Date.now();
  await A.click('button:text-is("온라인 방 만들기")'); await A.waitForSelector('.lobby .code-tiles', { timeout: 15000 });
  const code = await A.getAttribute('.lobby .code-tiles', 'data-code');
  console.log('room made in', Date.now() - t0, 'ms code', code, '|', await A.textContent('.room-made-head'));
  await B.fill('#wall-nick', '친구'); await B.fill('#wall-code', code); await B.tap('button:text-is("참가하기")');
  await A.waitForFunction(() => document.querySelectorAll('.seats .seat:not(.empty)').length === 2, null, { timeout: 15000 });
  await B.waitForSelector('.lobby .room-made', { timeout: 15000 });
  console.log('A seats:', await A.$$eval('.seats .seat-name', (s) => s.map((x) => x.textContent)), '| B head:', await B.textContent('.room-made-head'));
  await A.click('button:text-is("게임 시작")');
  await B.waitForSelector('.wl-board', { timeout: 15000 });
  console.log('B in game:', (await B.textContent('.game-area')).slice(0, 60).replace(/\s+/g, ' '));
  // 방장이 나가면 참가자에게 알림
  await A.click('button:text-is("나가기")');
  const tl = Date.now(); await B.waitForSelector('.mp .center-msg', { timeout: 15000 }).catch(() => {}); console.log('host-left noticed in', Date.now() - tl, 'ms');
  console.log('B after host left:', ((await B.textContent('.mp')) || '').slice(0, 80).replace(/\s+/g, ' '));
  console.log('errors', errs.length ? errs : 'none');
  await b.close();
})();
