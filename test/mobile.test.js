const { chromium, devices } = require('playwright');
const URL = 'file://' + __dirname + '/../dist/preview.html';
const SHOTS = require('os').tmpdir() + '/bgr-shots/';
(async () => {
  const browser = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], colorScheme: scheme });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('pageerror', e.message));
    for (const r of ['', '#signal', '#magic', '#tower', '#nemo', '#cubes', '#spot', '#sym', '#heavy', '#wall']) {
      await page.goto(URL + r); await page.waitForTimeout(700);
      if (r === '#magic') { await page.click('.seg-btn:text("7×7")'); await page.waitForTimeout(200); }
      if (r === '#heavy' || r === '#wall') { await page.click('button:has-text("바로 시작")'); await page.click('button:has-text("게임 시작")'); await page.waitForTimeout(800); }
      if (r === '#tower') { await page.click('.seg-btn:has-text("혼자 연습")'); await page.waitForSelector('.declare .btn.primary'); await page.click('.declare .btn.primary'); }
      const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      console.log(scheme, r || 'home', o.sw > o.cw ? 'OVERFLOW ' + o.sw + '>' + o.cw : 'ok');
      if (scheme === 'dark' && (r === '#spot' || r === '#cubes' || r === '#sym')) await page.screenshot({ path: SHOTS + 'm-dark' + r.slice(1) + '.png', fullPage: true });
    }
    await ctx.close();
  }
  await browser.close();
})();
