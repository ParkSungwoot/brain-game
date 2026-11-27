const { chromium } = require('playwright');
const URL = 'file://' + __dirname + '/../dist/preview.html';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.on('pageerror', e => console.log('pageerror: ' + e.message + '\n' + e.stack));
  page.on('console', m => console.log('console.' + m.type() + ': ' + m.text()));
  await page.goto(URL + '#heavy'); await page.waitForSelector('.mode-card');
  await page.click('text=바로 시작');
  await page.waitForTimeout(500);
  console.log((await page.textContent('.mp')).slice(0, 300));
  await browser.close();
})();
