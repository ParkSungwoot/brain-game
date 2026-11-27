// 규칙 탭의 움직이는 그림: 10개 게임 모든 장면을 휴대폰 크기에서 넘겨 보며 오류·넘침 확인
const { chromium, devices } = require('playwright');
const URL = 'file://' + __dirname + '/../dist/preview.html';
const OUT = process.argv[2] || require('os').tmpdir();
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 150)); });
  for (const id of ['cubes', 'nemo', 'heavy', 'wall', 'tower', 'magic', 'sym', 'jang', 'link', 'signal']) {
    await p.goto(URL + '#' + id); await p.waitForSelector('#tab-rules'); await p.click('#tab-rules');
    await p.waitForSelector('#panel-rules .demo-box');
    await p.click('#panel-rules .demo-ctl button:nth-child(2)'); // 멈춤
    const n = +(await p.textContent('#panel-rules .demo-prog')).split('/')[1];
    let maxW = 0;
    for (let k = 0; k < n; k++) {
      const w = await p.evaluate(() => { const st = document.querySelector('#panel-rules .demo-stage'); return Math.max(document.documentElement.scrollWidth, st.scrollWidth); });
      maxW = Math.max(maxW, w);
      if (k === n - 2 || k === 1) await p.locator('#panel-rules .demo-box').screenshot({ path: OUT + '/rd-' + id + '-' + k + '.png' });
      await p.click('#panel-rules .demo-ctl button:nth-child(3)');
    }
    console.log(id.padEnd(7), 'scenes', n, '| widest', maxW, maxW > 390 ? 'OVERFLOW' : 'ok', '|', (await p.textContent('#panel-rules .demo-title')).trim());
  }
  console.log('errors', errs.length ? errs : 'none');
  await b.close();
})();
