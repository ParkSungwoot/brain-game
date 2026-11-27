const { chromium, devices } = require('playwright');
const S = require('os').tmpdir() + '/bgr-shots/';
(async () => { const b = await chromium.launch();
  const d = await b.newPage({ viewport: { width: 1100, height: 600 } }); await d.goto('file://' + __dirname + '/../dist/preview.html'); await d.waitForTimeout(500);
  console.log('tab title:', await d.title()); await d.screenshot({ path: S + 'title2-desk.png', clip: { x: 0, y: 0, width: 1100, height: 330 } });
  const m = await (await b.newContext({ ...devices['iPhone 13'] })).newPage(); await m.goto('file://' + __dirname + '/../dist/preview.html'); await m.waitForTimeout(500);
  const o = await m.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); console.log('mobile', o.sw > o.cw ? 'OVERFLOW' : 'ok');
  await m.screenshot({ path: S + 'title2-m.png', clip: { x: 0, y: 0, width: 390, height: 300 } }); await b.close(); })();
