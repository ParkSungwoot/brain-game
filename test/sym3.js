const { chromium } = require('playwright');
const URL = 'file://' + __dirname + '/../dist/preview.html';
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1000, height: 1000 } });
  await p.goto(URL + '#sym'); await p.waitForSelector('.sym-board');
  const W = await p.evaluate(() => App.quick.lastPuzzle.board[0]);
  // 정사각형이 아닌 조각 찾기
  const idx = await p.evaluate(() => App.quick.lastPuzzle.pieces.findIndex((c) => JSON.stringify(App.sym.norm(App.sym.rot(c))) !== JSON.stringify(App.sym.norm(c))));
  const cc = async (i) => p.$$eval('.sym-cell', (els, i) => { const q = els[i].getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 }; }, i);
  await p.click('.sym-piece >> nth=' + idx); const c = await cc(3 * W + 4); await p.mouse.click(c.x, c.y);
  const before = await p.evaluate(() => [...document.querySelectorAll('.sym-cell[style]')].map(e => +e.dataset.i));
  const s = await cc(before[0]); await p.mouse.click(s.x, s.y);
  await p.click('button:text-is("↻ 돌리기")');
  const after = await p.evaluate(() => [...document.querySelectorAll('.sym-cell[style]')].map(e => +e.dataset.i));
  console.log('non-square piece rotated on board:', JSON.stringify(before), '→', JSON.stringify(after), 'changed:', JSON.stringify(before) !== JSON.stringify(after), '| still selected:', await p.$$eval('.sym-cell.selp', e => e.length));
  await b.close(); })();
