// 픽셀 캐릭터: 처음 무작위·기억, 고르기 화면·로비에서 바꾸기, 컴퓨터도 서로 다르게, 게임 중 이름표, 온라인 전달
const { chromium, devices } = require('playwright');
const URL = 'file://' + __dirname + '/../dist/preview.html';
const OUT = process.argv[2] || require('os').tmpdir();
let bad = 0; const check = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const m = await (await b.newContext({ ...devices['iPhone 13'] })).newPage(); m.on('pageerror', (e) => errs.push(e.message));
  await m.goto(URL + '#heavy'); await m.waitForSelector('.av-mine');
  const first = await m.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /avatar$/.test(k)) || 'null')));
  check(Array.isArray(first) && first.length === 2, '처음 들어오면 무작위 캐릭터가 정해져 기억됨: ' + JSON.stringify(first));
  const nShapes = await m.evaluate(() => App.avatar.shapes().length);
  await m.tap('.av-mine button:has-text("바꾸기")');
  await m.tap('.av-picker .av-swatch >> nth=6');
  if (nShapes > 1) await m.tap('.av-picker .av-opt >> nth=1');
  const after = await m.evaluate(() => App.avatar.mine());
  check(after[1] === 6 && (nShapes < 2 || after[0] === 1), '고르기 화면에서 모양·색 바꾸기: ' + JSON.stringify(after) + ' · ' + await m.textContent('.av-picker .av-name'));
  await m.screenshot({ path: OUT + '/av-choose.png', fullPage: true });
  await m.tap('.av-picker button:has-text("닫기")');
  check((await m.textContent('.av-mine-text b')) === (await m.evaluate(() => App.avatar.nameOf(App.avatar.mine()))), '닫으면 한 줄 요약에 바뀐 캐릭터');
  await m.tap('button:has-text("바로 시작")'); await m.waitForSelector('.seats');
  const seats = await m.$$eval('.seat .seat-face.av', (e) => e.length);
  const combos = await m.evaluate(() => [...document.querySelectorAll('.seat .seat-face.av svg')].map((s) => s.innerHTML.length + ':' + [...s.querySelectorAll('rect')].map((r) => r.getAttribute('fill')).join('').length));
  const filled = await m.$$eval('.seat:not(.empty)', (e) => e.length);
  check(seats === filled && filled >= 5, '로비 채워진 자리 ' + filled + '칸 모두 캐릭터: ' + seats);
  const keys = await m.evaluate(() => [...document.querySelectorAll('.seat:not(.empty) .seat-face svg')].map((s) => [...s.querySelectorAll('rect')].map((r) => r.getAttribute('fill') + r.getAttribute('x') + r.getAttribute('y')).join('|')));
  check(new Set(keys).size === keys.length, '컴퓨터 캐릭터가 서로 다름 (모양 또는 색)');
  const myA = await m.evaluate(() => App.avatar.mine());
  check(JSON.stringify(myA) === JSON.stringify(after), '로비 내 자리 = 고른 캐릭터');
  await m.tap('.seat.me .av-change'); await m.waitForSelector('.av-lobby .av-picker');
  await m.tap('.av-lobby .av-swatch >> nth=2');
  await m.waitForTimeout(200);
  const myFill = await m.$eval('.seat.me .seat-face svg', (s) => [...s.querySelectorAll('rect')].map((r) => r.getAttribute('fill')));
  check(myFill.includes('#f2c230'), '로비에서 색 바꾸면 내 자리 캐릭터가 바로 바뀜 (노랑)');
  await m.screenshot({ path: OUT + '/av-lobby.png', fullPage: true });
  await m.tap('button:has-text("게임 시작")'); await m.waitForTimeout(800);
  const chips = await m.$$eval('.game-area .av-chip', (e) => e.length);
  check(chips >= filled, '게임 중 이름표 캐릭터: ' + chips);
  check(!(await m.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)), '휴대폰 가로 넘침 없음');
  await m.screenshot({ path: OUT + '/av-game.png', fullPage: true });
  // 다른 게임 이름표 (카드 장기, 수식의 탑)
  for (const g of ['jang', 'link', 'wall', 'tower']) {
    await m.goto(URL + '#' + g); await m.waitForTimeout(300);
    await m.tap('button:has-text("바로 시작")'); await m.tap('button:has-text("게임 시작")'); await m.waitForTimeout(700);
    check((await m.$$eval('.game-area .av-chip', (e) => e.length)) >= 2, g + ' 게임 이름표 캐릭터');
  }
  // 온라인 2명 (같은 브라우저 탭): B 캐릭터가 A 로비에 보이고, B가 바꾸면 A에도 바뀜
  const ctx = await b.newContext({ viewport: { width: 1000, height: 900 } });
  const A = await ctx.newPage(), B = await ctx.newPage();
  for (const p of [A, B]) p.on('pageerror', (e) => errs.push(e.message));
  await A.goto(URL + '#heavy'); await B.goto(URL + '#heavy');
  await B.evaluate(() => App.avatar.setMine([0, 8]));
  await A.click('button:has-text("온라인 방 만들기")'); await A.waitForSelector('.lobby .code-tiles');
  const code = await A.getAttribute('.lobby .code-tiles', 'data-code');
  await B.reload(); await B.fill('#heavy-code', code); await B.click('button:has-text("참가하기")');
  await A.waitForFunction(() => document.querySelectorAll('.seat:not(.empty)').length >= 2, null, { timeout: 10000 });
  const pink = await A.$eval('.seat:not(.empty) >> nth=1', (el) => [...el.querySelectorAll('rect')].some((r) => r.getAttribute('fill') === '#ec6aa8')).catch(() => false);
  check(pink, 'A 로비에 B 캐릭터(분홍)가 보임');
  await B.click('.seat.me .av-change'); await B.click('.av-lobby .av-swatch >> nth=5');
  await A.waitForFunction(() => [...document.querySelectorAll('.seat:not(.empty)')][1]?.querySelector('rect[fill="#4cc3e6"]'), null, { timeout: 8000 }).catch(() => {});
  const sky = await A.$eval('.seat:not(.empty) >> nth=1', (el) => [...el.querySelectorAll('rect')].some((r) => r.getAttribute('fill') === '#4cc3e6')).catch(() => false);
  check(sky, 'B가 로비에서 하늘색으로 바꾸면 A 화면에도 바뀜');
  console.log('errors', errs.length ? errs : 'none');
  console.log(bad ? 'FAILED ' + bad : 'all ok');
  await b.close();
})();
