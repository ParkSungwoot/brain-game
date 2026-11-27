const { chromium, devices } = require('playwright');
const SHOTS = require('os').tmpdir() + '/bgr-shots/';
const URL = 'file://' + __dirname + '/../dist/preview.html';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
  await p.goto(URL); await p.waitForSelector('.title-main');
  await p.screenshot({ path: SHOTS + 'title-desk.png' });
  const ctx = await b.newContext({ ...devices['iPhone 13'] }); const m = await ctx.newPage();
  await m.goto(URL); await m.waitForSelector('.title-main');
  const o = await m.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  console.log('mobile', o.sw > o.cw ? 'OVERFLOW' : 'ok');
  await m.screenshot({ path: SHOTS + 'title-mobile.png' });
  await b.close();
})();
