const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch(); const m = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  await m.goto('file://' + __dirname + '/../dist/preview.html'); await m.waitForTimeout(600);
  await m.screenshot({ path: require('os').tmpdir() + '/bgr-shots/m-title.png', clip: { x: 0, y: 0, width: 390, height: 300 } }); await b.close(); })();
