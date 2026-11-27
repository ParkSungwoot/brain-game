// 벽바둑 2 화면 점검: 2명 온라인(같은 브라우저 탭 연결), 3인전(컴퓨터 2명) 배치·이동·벽 부수기 버튼
const { chromium, devices } = require('playwright');
const URL = 'file://' + __dirname + '/../dist/preview.html';
const OUT = process.argv[2] || require('os').tmpdir();
const myTurnPage = async (pages) => { for (const p of pages) { const m = await p.textContent('.wl-msg').catch(() => ''); if (/^내 차례|움직일 내 말/.test(m)) return p; } return null; };
async function myMove(p, seat) {
  // 내 말 중 하나 고르기 → 갈 칸 → 벽
  const cells = await p.$$('.wl-cell');
  for (let k = 0; k < cells.length; k++) {
    const mine = await cells[k].$eval('.piece', (e, s) => e.style.background.includes('--p' + s), seat).catch(() => false);
    if (!mine) continue;
    await cells[k].click();
    const reach = await p.$$('.wl-cell.reach');
    if (!reach.length) { await cells[k].click(); continue; }
    await reach[0].click();
    await p.click('.wl-cell.dest .wall-pick');
    return true;
  }
  return false;
}
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 900, height: 1000 } });
  const A = await ctx.newPage(), B = await ctx.newPage();
  for (const p of [A, B]) p.on('pageerror', (e) => errs.push(e.message));
  await A.goto(URL + '#wall'); await B.goto(URL + '#wall');
  await A.fill('#wall-nick', '현진'); await A.click('button:has-text("온라인 방 만들기")'); await A.waitForSelector('.lobby .code-tiles');
  const code = await A.getAttribute('.lobby .code-tiles', 'data-code');
  await B.fill('#wall-nick', '친구'); await B.fill('#wall-code', code); await B.click('button:has-text("참가하기")');
  await A.waitForFunction(() => document.querySelectorAll('.seats .seat:not(.empty)').length === 2, null, { timeout: 8000 });
  console.log('2인 안내:', await A.textContent('.opts .note'));
  await A.click('button:has-text("게임 시작")'); await B.waitForSelector('.wl-board');
  console.log('round label:', await A.textContent('.wl-round'), '| 원형 말 미리 놓임:', await A.$$eval('.piece.ci', (e) => e.length));
  // 사각 말 4개 놓기 (1→2→2→1)
  const spots = [24, 10, 38, 22];
  for (const k of spots) { const p = await myTurnPage([A, B]); await p.click('.wl-cell >> nth=' + k); await p.waitForTimeout(350); }
  console.log('놓인 말: 사각', await A.$$eval('.piece.sq', (e) => e.length), '원형', await A.$$eval('.piece.ci', (e) => e.length), '| msg A:', await A.textContent('.wl-msg'), '| B:', await B.textContent('.wl-msg'));
  // 이동 몇 번
  for (let t = 0; t < 4; t++) {
    const p = await myTurnPage([A, B]); if (!p) break;
    const seat = p === A ? 0 : 1;
    const ok = await myMove(p, seat); await p.waitForTimeout(400);
    if (!ok) { console.log('no move?'); break; }
  }
  console.log('벽 수 A:', await A.$$eval('.w-h, .w-v', (e) => e.length), 'B:', await B.$$eval('.w-h, .w-v', (e) => e.length), '| 벽 부수기 버튼(2인엔 없어야):', await A.$$eval('button', (e) => e.filter((x) => /벽 부수기/.test(x.textContent)).length));
  await A.screenshot({ path: OUT + '/wall-2p.png', fullPage: true });
  // 3인전: 컴퓨터 2명
  const C = await (await b.newContext({ ...devices['iPhone 13'] })).newPage(); C.on('pageerror', (e) => errs.push('C ' + e.message));
  await C.goto(URL + '#wall'); await C.click('button:has-text("바로 시작")');
  console.log('3인 기본 자리:', await C.$$eval('.seats .seat:not(.empty)', (e) => e.length), '|', await C.textContent('.opts .note'));
  await C.click('button:has-text("게임 시작")'); await C.waitForSelector('.wl-board');
  console.log('3인 라운드:', await C.textContent('.wl-round'));
  // 내 차례 될 때까지 기다렸다가 사각/원형 하나씩 놓기
  for (let n = 0; n < 2; n++) {
    await C.waitForFunction(() => /^내 차례/.test(document.querySelector('.wl-msg')?.textContent || ''), null, { timeout: 20000 });
    const kinds = await C.$$eval('.seg-btn', (e) => e.map((x) => x.textContent).filter((t) => /사각 말|원형 말/.test(t)));
    if (n === 0) console.log('종류 고르기 버튼:', kinds.join(' / '));
    const empty = await C.$$eval('.wl-cell', (e) => e.map((x, i) => (x.querySelector('.piece') ? -1 : i)).filter((i) => i >= 0));
    await C.tap('.wl-cell >> nth=' + empty[Math.floor(empty.length / 2) + n]);
    await C.waitForTimeout(400);
  }
  await C.waitForFunction(() => /움직일 내 말/.test(document.querySelector('.wl-msg')?.textContent || ''), null, { timeout: 30000 });
  console.log('3인 배치 끝: 사각', await C.$$eval('.piece.sq', (e) => e.length), '원형', await C.$$eval('.piece.ci', (e) => e.length), '| 💥 표시:', await C.$$eval('.wl-player .chip-tag', (e) => e.map((x) => x.textContent).join(',')));
  // 내 말 고르면 벽 부수기 버튼 보이기
  const cells = await C.$$('.wl-cell');
  for (const cel of cells) { const mine = await cel.$eval('.piece', (e) => e.style.background.includes('--p0')).catch(() => false); if (mine) { await cel.tap(); break; } }
  const brkBtn = await C.$$eval('button', (e) => e.filter((x) => /벽 부수기/.test(x.textContent)).map((x) => x.textContent));
  console.log('벽 부수기 버튼:', brkBtn.join(' | '), '| 갈 수 있는 칸', await C.$$eval('.wl-cell.reach', (e) => e.length));
  await C.screenshot({ path: OUT + '/wall-3p.png', fullPage: true });
  console.log('overflow', await C.evaluate(() => document.documentElement.scrollWidth));
  console.log('errors', errs.length ? errs : 'none');
  await b.close();
})();
