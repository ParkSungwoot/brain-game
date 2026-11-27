const { chromium, devices } = require('playwright');
const URL = 'file://' + __dirname + '/../dist/preview.html';
(async () => { const b = await chromium.launch(); const c = await b.newContext({ ...devices['iPhone 13'] }); const p = await c.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  // 공개 링크·비로그인 화면 흉내: claude.use('room') 이 null
  await p.addInitScript(() => { window.claude = { use: async () => null }; });
  await p.goto(URL + '#nemo'); await p.waitForTimeout(400);
  await p.tap('button:text-is("온라인 경주")');
  await p.waitForSelector('.warn-note');
  const r = await p.evaluate(() => ({ note: document.querySelector('.warn-note').textContent, host: [...document.querySelectorAll('button')].find(b => b.textContent === '온라인 방 만들기').disabled, join: [...document.querySelectorAll('button')].find(b => b.textContent === '참가하기').disabled }));
  console.log('blocked → host disabled', r.host, '| join disabled', r.join, '|', r.note.slice(0, 40), '| errors', errs.length ? errs : 'none');
  await p.locator('.mp-choose').screenshot({ path: process.argv[2] });
  await b.close(); })();
