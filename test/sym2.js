const { chromium, devices } = require('playwright');
const URL = 'file://' + __dirname + '/../dist/preview.html';
(async () => { const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: 1000, height: 1000 } }); p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL + '#sym'); await p.waitForSelector('.sym-board');
  const W = await p.evaluate(() => App.quick.lastPuzzle.board[0]);
  const center = async (i) => p.$eval('.sym-cell >> nth=' + i, el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }).catch(async () => { const r = await p.$$eval('.sym-cell', (els, i) => { const q = els[i].getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 }; }, i); return r; });
  const cc = async (i) => p.$$eval('.sym-cell', (els, i) => { const q = els[i].getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 }; }, i);
  const tapAt = async (i) => { const c = await cc(i); await p.mouse.click(c.x, c.y); };
  // 조각 1 선택 후 판 (2,2)에 놓기
  await p.click('.sym-piece >> nth=0'); await tapAt(2 * W + 2);
  const placedBefore = await p.evaluate(() => [...document.querySelectorAll('.sym-cell[style]')].map(e => +e.dataset.i));
  // 놓인 조각을 눌러 선택 → 돌리기
  await tapAt(placedBefore[0]);
  console.log('selected placed piece cells:', await p.$$eval('.sym-cell.selp', e => e.length));
  await p.click('button:text-is("↻ 돌리기")');
  const afterRot = await p.evaluate(() => [...document.querySelectorAll('.sym-cell[style]')].map(e => +e.dataset.i));
  console.log('rotated on board:', JSON.stringify(placedBefore), '→', JSON.stringify(afterRot), 'still', afterRot.length, 'cells');
  // 꾹 눌러 끌기: 첫 칸을 누르고 450ms 기다린 뒤 오른쪽 아래 2칸으로
  const s = await cc(afterRot[0]); const tgt = await cc(afterRot[0] + 2 * W + 2);
  await p.mouse.move(s.x, s.y); await p.mouse.down(); await p.waitForTimeout(450);
  await p.mouse.move((s.x + tgt.x) / 2, (s.y + tgt.y) / 2, { steps: 4 }); await p.mouse.move(tgt.x, tgt.y, { steps: 4 });
  console.log('ghost during drag:', await p.$$eval('.sym-cell.ghost-ok, .sym-cell.ghost-bad', e => e.length), 'lifting:', await p.$$eval('.sym-cell.lifting', e => e.length));
  await p.mouse.up();
  const afterDrag = await p.evaluate(() => [...document.querySelectorAll('.sym-cell[style]')].map(e => +e.dataset.i));
  console.log('dragged:', JSON.stringify(afterRot), '→', JSON.stringify(afterDrag), '| status:', await p.textContent('.sym .status'));
  // 짧게 누르면 끌리지 않고 선택만
  const s2 = await cc(afterDrag[0]); await p.mouse.move(s2.x, s2.y); await p.mouse.down(); await p.waitForTimeout(100); await p.mouse.up();
  console.log('short press keeps position:', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.sym-cell[style]')].map(e => +e.dataset.i))) === JSON.stringify(afterDrag));
  // 휴대폰 터치로 꾹 눌러 끌기
  const ctx = await b.newContext({ ...devices['iPhone 13'] }); const m = await ctx.newPage(); m.on('pageerror', e => errs.push('m ' + e.message));
  await m.goto(URL + '#sym'); await m.waitForSelector('.sym-board');
  const W2 = await m.evaluate(() => App.quick.lastPuzzle.board[0]);
  await m.tap('.sym-piece >> nth=0');
  const c0 = await m.$$eval('.sym-cell', (els, i) => { const q = els[i].getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 }; }, 2 * W2 + 2);
  await m.touchscreen.tap(c0.x, c0.y);
  console.log('mobile placed:', await m.$$eval('.sym-cell[style]', e => e.length), 'overflow:', await m.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth));
  console.log('errors', errs.length ? errs : 'none'); await b.close(); })();
