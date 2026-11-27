// 대칭 퍼즐: 판 위 조각을 기다리지 않고 바로 끌어 옮기기 (마우스·터치), 짧게 탭하면 선택만
const { chromium, devices } = require('playwright');
const URL = 'file://' + __dirname + '/../dist/preview.html';
let bad = 0; const check = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const cells = (p) => p.evaluate(() => [...document.querySelectorAll('.sym-cell[style]')].map((e) => +e.dataset.i).join(','));
  const cc = (p, i) => p.$$eval('.sym-cell', (els, i) => { const q = els[i].getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 }; }, i);
  // 마우스
  const p = await b.newPage({ viewport: { width: 1000, height: 1000 } }); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL + '#sym'); await p.waitForSelector('.sym-board');
  const W = await p.evaluate(() => App.quick.lastPuzzle.board[0]);
  await p.click('.sym-piece >> nth=0'); const c0 = await cc(p, 1 * W + 1); await p.mouse.click(c0.x, c0.y);
  const before = await cells(p);
  const first = +before.split(',')[0];
  const s = await cc(p, first), t = await cc(p, first + W + 1);
  await p.mouse.move(s.x, s.y); await p.mouse.down(); // 기다리지 않고 바로 움직임
  await p.mouse.move(t.x, t.y, { steps: 5 }); await p.mouse.up();
  const after = await cells(p);
  check(after !== before && after.split(',').length === before.split(',').length, '마우스: 누르자마자 끌어도 이동 ' + before + ' → ' + after);
  // 짧게 탭하면 선택만 되고 그대로
  const s2 = await cc(p, +after.split(',')[0]);
  const selBefore = await p.$$eval('.sym-cell.selp', (e) => e.length);
  await p.mouse.click(s2.x, s2.y);
  const selAfter = await p.$$eval('.sym-cell.selp', (e) => e.length);
  check((await cells(p)) === after && (selBefore > 0) !== (selAfter > 0), '짧게 탭: 위치 그대로, 선택만 바뀜 (' + selBefore + '→' + selAfter + ')');
  // 0.15초 가만히 눌러도 끌기 시작
  await p.mouse.move(s2.x, s2.y); await p.mouse.down(); await p.waitForTimeout(220);
  check(/끌어서 옮길 곳/.test(await p.textContent('.sym .status')), '0.15초 누르고 있으면 끌기 상태');
  await p.mouse.up();
  // 0.15초 넘게 눌렀다가 그대로 떼면 탭 (선택만 바뀌고 위치 그대로)
  const pos1 = await cells(p); const selA = await p.$$eval('.sym-cell.selp', (e) => e.length);
  await p.mouse.move(s2.x, s2.y); await p.mouse.down(); await p.waitForTimeout(300); await p.mouse.up();
  const selB = await p.$$eval('.sym-cell.selp', (e) => e.length);
  check((await cells(p)) === pos1 && (selA > 0) !== (selB > 0), '0.3초 눌렀다 그대로 떼기 = 탭 (' + selA + '→' + selB + ')');
  // 살짝(8px) 흔들려도 탭: 조각이 옮겨지지 않음
  await p.mouse.move(s2.x, s2.y); await p.mouse.down(); await p.mouse.move(s2.x + 8, s2.y, { steps: 2 }); await p.mouse.up();
  check((await cells(p)) === pos1, '8px 흔들림: 조각이 옮겨지지 않음');
  // 빈칸 탭이 조금 흔들려도 놓기 됨 (선택된 조각을 빈칸으로)
  if (!(await p.$$eval('.sym-cell.selp', (e) => e.length))) await p.mouse.click(s2.x, s2.y);
  const emptyIdx = await p.evaluate(() => { const W = App.quick.lastPuzzle.board[0]; const occ = new Set([...document.querySelectorAll('.sym-cell[style]')].map((e) => +e.dataset.i)); for (let i = 0; i < document.querySelectorAll('.sym-cell').length; i++) { const x = i % W, y = Math.floor(i / W); if (x > 0 && y > 0 && x < W - 3 && y < W - 3 && ![0, 1, 2, 3].some((d) => occ.has(i + d) || occ.has(i + d * W))) return i; } return -1; });
  const e0 = await cc(p, emptyIdx);
  await p.mouse.move(e0.x, e0.y); await p.mouse.down(); await p.mouse.move(e0.x + 7, e0.y + 3, { steps: 2 }); await p.mouse.up();
  check((await cells(p)) !== pos1, '빈칸을 살짝 흔들며 눌러도 그 자리로 이동');
  // 터치 (휴대폰): CDP 로 손가락 끌기
  const ctx = await b.newContext({ ...devices['iPhone 13'] }); const m = await ctx.newPage(); m.on('pageerror', (e) => errs.push('m ' + e.message));
  await m.goto(URL + '#sym'); await m.waitForSelector('.sym-board');
  const W2 = await m.evaluate(() => App.quick.lastPuzzle.board[0]);
  await m.tap('.sym-piece >> nth=0'); const d0 = await cc(m, 1 * W2 + 1); await m.touchscreen.tap(d0.x, d0.y);
  const mb = await cells(m); const mf = +mb.split(',')[0];
  const a = await cc(m, mf), z = await cc(m, mf + W2 + 1);
  const cdp = await ctx.newCDPSession(m);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y }] });
  for (let k = 1; k <= 5; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (z.x - a.x) * k / 5, y: a.y + (z.y - a.y) * k / 5 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await m.waitForTimeout(150);
  const ma = await cells(m);
  check(ma !== mb, '터치: 누르자마자 끌어도 이동 ' + mb + ' → ' + ma);
  check(!(await m.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)), '휴대폰 가로 넘침 없음');
  console.log('errors', errs.length ? errs : 'none');
  console.log(bad ? 'FAILED ' + bad : 'all ok');
  await b.close();
})();
