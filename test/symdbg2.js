const { chromium } = require('playwright');
const URL = 'file://' + __dirname + '/../dist/preview.html';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.goto(URL + '#sym'); await page.waitForSelector('.sym-board');
  const info = await page.evaluate(() => { const pz = App.quick.lastPuzzle; return { pieces: pz.pieces, sol: pz.sol, board: pz.board }; });
  console.log(JSON.stringify(info));
  await page.click('.sym-piece >> nth=0');
  console.log('sel', await page.$$eval('.sym-piece.on', e => e.length));
  await page.click('button:has-text("돌리기")');
  console.log('sel after rotate', await page.$$eval('.sym-piece.on', e => e.length));
  await page.click('.sym-cell >> nth=22');
  console.log('colored', await page.$$eval('.sym-cell[style]', e => e.length), 'status', await page.textContent('.sym .status'));
  await browser.close();
})();
