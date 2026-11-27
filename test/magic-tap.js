const { chromium, devices } = require('playwright');
const URL = 'file://' + __dirname + '/../dist/preview.html';
async function run(label, ctxOpts) {
  const b = await chromium.launch(); const c = await b.newContext(ctxOpts); const p = await c.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL + '#magic'); await p.waitForSelector('.mg');
  // 3×3 쉬움으로
  await p.click('.seg-btn:text-is("3×3")'); await p.click('.seg-btn:text-is("쉬움")');
  const info = await p.evaluate(() => { const pz = App.magic.lastPuzzle; const i = document.querySelector('input.mg-cell'); return { sol: pz.sol, given: pz.given, ro: i.readOnly, im: i.getAttribute('inputmode') }; });
  const open = info.given.map((g, k) => g == null ? k : -1).filter((k) => k >= 0);
  const tap = label === 'mobile' ? (sel) => p.tap(sel) : (sel) => p.click(sel);
  const val = (k) => p.$eval('#mg-' + k, (e) => e.value);
  // 1) 칸 → 숫자
  const k0 = open[0], v0 = info.sol[k0];
  await tap('#mg-' + k0); await tap('.tray-n:text-is("' + v0 + '")');
  const a1 = await val(k0);
  const sel1 = await p.$eval('#mg-' + k0, (e) => e.classList.contains('sel'));
  // 2) 같은 숫자를 다른 칸으로 → 옮겨짐
  const k1 = open[1];
  await tap('#mg-' + k1); await tap('.tray-n:text-is("' + v0 + '")');
  const moved = [await val(k0), await val(k1)];
  const msg = await p.textContent('.magic .status');
  // 3) 지우기
  await tap('.tray-n.erase'); const er = await val(k1);
  // 4) 숫자 먼저 → 칸 (선택 해제 상태에서)
  await p.evaluate(() => 0);
  // 선택 해제: 모바일은 같은 칸 다시 탭, 데스크톱은 새 문제 대신 그대로 진행(선택된 칸에 바로 들어감)
  if (label === 'mobile') await tap('#mg-' + k1);
  const selAfter = await p.$$eval('input.mg-cell.sel', (e) => e.length);
  // 나머지 모두 채우기: 숫자 먼저 → 칸 순서 (모바일), 칸 → 숫자 (데스크톱)
  for (const k of open) {
    if (label === 'mobile') { await tap('.tray-n:text-is("' + info.sol[k] + '")'); await tap('#mg-' + k); }
    else { await tap('#mg-' + k); await tap('.tray-n:text-is("' + info.sol[k] + '")'); }
  }
  const used = await p.$$eval('.tray-n[data-state="used"]', (e) => e.length);
  await tap('button:text-is("정답 확인")');
  const st = await p.textContent('.magic .status');
  const kb = label === 'desktop' ? await (async () => { await p.click('button:text-is("새 문제")'); const pz = await p.evaluate(() => App.magic.lastPuzzle); const k = pz.given.findIndex((g) => g == null); await p.click('#mg-' + k); await p.keyboard.type(String(pz.sol[k])); return (await val(k)) === String(pz.sol[k]); })() : 'n/a';
  console.log(label, '| readOnly', info.ro, 'inputmode', info.im, '| cell→num', a1 === String(v0), 'sel', sel1, '| move', JSON.stringify(moved), msg.trim(), '| erase', er === '', '| sel after untap', selAfter, '| used', used, '/9 | ', st.trim().slice(0, 20), '| keyboard', kb, '| errors', errs.length ? errs : 'none');
  if (label === 'mobile') await p.screenshot({ path: process.env.SHOT || '/tmp/mg.png', fullPage: true });
  await b.close();
}
(async () => {
  await run('desktop', { viewport: { width: 1100, height: 900 } });
  await run('mobile', { ...devices['iPhone 13'] });
})();
