const { chromium, devices } = require('playwright');
const SHOTS = require('os').tmpdir() + '/bgr-shots/';
const URL = 'file://' + __dirname + '/../dist/preview.html';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  await page.goto(URL); await page.waitForSelector('.prog-chip');
  await page.click('.prog-chip');
  await page.waitForSelector('.prog-panel');
  console.log('panel items', await page.$$eval('.prog-item', e => e.length), 'ready', await page.$$eval('.prog-item.ready', e => e.length));
  await page.screenshot({ path: SHOTS + 'prog.png', fullPage: false, clip: { x: 0, y: 0, width: 1100, height: 900 } });
  await page.click('.prog-item.ready a >> nth=0'); await page.waitForSelector('.gtitle');
  console.log('link ->', await page.textContent('.gtitle h1'));
  await page.goto(URL + '#dp3'); await page.waitForSelector('.prog-panel'); console.log('#dp3 opens panel ok');
  // cubes rotation
  await page.goto(URL + '#cubes'); await page.waitForSelector('.cube-canvas'); await page.waitForTimeout(400);
  const px1 = await page.$eval('.cube-canvas', c => c.toDataURL().length);
  const img1 = await page.$eval('.cube-canvas', c => c.toDataURL());
  await page.screenshot({ path: SHOTS + 'cube-rot1.png', clip: await page.$eval('.cube-wrap', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }) });
  await page.waitForTimeout(3000);
  const img2 = await page.$eval('.cube-canvas', c => c.toDataURL());
  console.log('rotating:', img1 !== img2);
  await page.screenshot({ path: SHOTS + 'cube-rot2.png', clip: await page.$eval('.cube-wrap', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }) });
  await page.click('.cube-ctl .btn'); const a = await page.$eval('.cube-canvas', c => c.toDataURL()); await page.waitForTimeout(800); const b = await page.$eval('.cube-canvas', c => c.toDataURL());
  console.log('paused stays still:', a === b);
  const ans = await page.evaluate(() => App.quick.lastPuzzle.answer);
  await page.fill('#cubes-ans', String(ans)); await page.keyboard.press('Enter'); await page.waitForSelector('.cube-explain');
  await page.screenshot({ path: SHOTS + 'cube-explain2.png', fullPage: true });
  // mobile overflow
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const m = await ctx.newPage(); m.on('pageerror', e => errs.push('m ' + e.message));
  for (const r of ['#dp3', '#cubes']) { await m.goto(URL + r); await m.waitForTimeout(800); const o = await m.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); console.log('mobile', r, o.sw > o.cw ? 'OVERFLOW' : 'ok'); }
  await m.screenshot({ path: SHOTS + 'm-cube.png' });
  console.log('ERRORS', errs.length ? errs : 'none');
  await browser.close();
})();
