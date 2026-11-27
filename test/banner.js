const { chromium, devices } = require('playwright');
const S = require('os').tmpdir() + '/bgr-shots/';
(async () => { const b = await chromium.launch(); const errs = [];
  const d = await b.newPage({ viewport: { width: 1100, height: 900 } }); d.on('pageerror', e => errs.push(e.message));
  await d.goto('file://' + __dirname + '/../dist/preview.html'); await d.waitForTimeout(700);
  console.log('img loaded:', await d.$eval('.banner img', i => i.complete && i.naturalWidth), '| h1 text:', await d.textContent('h1'));
  await d.screenshot({ path: S + 'banner-desk.png' });
  for (const scheme of ['light', 'dark']) {
    const m = await (await b.newContext({ ...devices['iPhone 13'], colorScheme: scheme })).newPage(); await m.goto('file://' + __dirname + '/../dist/preview.html'); await m.waitForTimeout(700);
    const o = await m.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, src: document.querySelector('.banner img').currentSrc.split('/').pop() }));
    console.log('mobile', scheme, o.sw > o.cw ? 'OVERFLOW' : 'ok', o.src);
    if (scheme === 'dark') await m.screenshot({ path: S + 'banner-m.png' });
  }
  console.log('errors', errs.length ? errs : 'none'); await b.close(); })();
