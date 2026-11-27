const { chromium, devices } = require('playwright');
const S = require('os').tmpdir() + '/bgr-shots/';
const URL = 'file://' + __dirname + '/../dist/preview.html';
(async () => { const b = await chromium.launch(); const errs = [];
  for (const [w, hh, name] of [[1200, 630, 'og-1200'], [1600, 900, 'wide-1600'], [2200, 1000, 'xwide']]) {
    const p = await b.newPage({ viewport: { width: w, height: hh } }); p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL); await p.waitForTimeout(600);
    const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, title: document.title, bw: document.querySelector('.banner').getBoundingClientRect().width }));
    console.log(name, o.sw > o.cw ? 'OVERFLOW' : 'ok', 'banner width', o.bw, 'title', o.title);
    await p.screenshot({ path: S + name + '.png' }); await p.close();
  }
  const g = await b.newPage({ viewport: { width: 1100, height: 600 } }); await g.goto(URL + '#signal'); await g.waitForTimeout(400);
  console.log('game page has banner:', await g.$$eval('#topband .banner', e => e.length));
  await g.goto(URL); await g.waitForTimeout(300); console.log('back home banner:', await g.$$eval('#topband .banner', e => e.length));
  const m = await (await b.newContext({ ...devices['iPhone 13'] })).newPage(); await m.goto(URL); await m.waitForTimeout(600);
  const o = await m.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, pad: getComputedStyle(document.getElementById('app')).paddingLeft }));
  console.log('mobile', o.sw > o.cw ? 'OVERFLOW' : 'ok', 'app pad', o.pad);
  await m.screenshot({ path: S + 'band-m.png' });
  console.log('errors', errs.length ? errs : 'none'); await b.close(); })();
