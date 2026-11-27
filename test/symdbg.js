const { chromium } = require('playwright');
const URL = 'file://' + __dirname + '/../dist/preview.html';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.goto(URL + '#sym'); await page.waitForSelector('.sym-board');
  await page.click('.sym-piece >> nth=0');
  console.log('selected?', await page.$$eval('.sym-piece.on', e => e.length), 'hint:', await page.textContent('.sym .hint'));
  const cell = await page.$('.sym-cell >> nth=23');
  const b = await cell.boundingBox();
  await page.mouse.move(b.x + b.width/2, b.y + b.height/2);
  await page.waitForTimeout(100);
  console.log('ghost cells', await page.$$eval('.sym-cell[class*=ghost]', e => e.length));
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(100);
  console.log('placed colored cells', await page.$$eval('.sym-cell[style]', e => e.length), 'status', await page.textContent('.sym .status'));
  await browser.close();
})();
