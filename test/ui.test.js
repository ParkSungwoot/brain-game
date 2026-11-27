const { chromium } = require('playwright');
const SHOTS = require('os').tmpdir() + '/bgr-shots/';
const URL = 'file://' + __dirname + '/../dist/preview.html';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.goto(URL);
  await page.waitForSelector('.gcard');
  await page.screenshot({ path: SHOTS + 'home.png', fullPage: true });

  // signal solo
  await page.goto(URL + '#signal'); await page.waitForSelector('.sq-board');
  await page.click('text=9칸');
  for (const k of '7*8-29=27') await page.keyboard.press(k === '*' ? 'x' : k);
  await page.keyboard.press('Enter');
  const filled = await page.$$eval('.sq.f-g, .sq.f-y, .sq.f-r', els => els.length);
  console.log('signal graded cells', filled);
  await page.screenshot({ path: SHOTS + 'signal.png', fullPage: true });

  // magic
  await page.goto(URL + '#magic'); await page.waitForSelector('.mg');
  await page.click('.seg-btn:text("5×5")');
  await page.click('text=한 칸 알려주기');
  console.log('magic status:', await page.textContent('.magic .status'));
  await page.screenshot({ path: SHOTS + 'magic.png', fullPage: true });

  // tower
  await page.goto(URL + '#tower'); await page.click('.seg-btn:has-text("혼자 연습")'); await page.waitForSelector('.declare', { timeout: 10000 });
  await page.click('.declare .btn.primary');
  await page.click('.tw-col:nth-child(1) .tile >> nth=0').catch(()=>{});
  await page.screenshot({ path: SHOTS + 'tower.png', fullPage: true });

  // heavy local
  await page.goto(URL + '#heavy'); await page.waitForSelector('.mode-card');
  await page.click('button:has-text("바로 시작")');
  await page.click('button:has-text("게임 시작")');
  await page.waitForSelector('.cards-row');
  await page.click('.card:text("6")'); await page.click('.chip.c0');
  await page.click('.hand .btn.primary');
  await page.waitForTimeout(4500);
  // if my turn to place, place
  const turn = await page.$('.hand.turn');
  if (turn) { await page.click('.hand.turn .btn >> nth=0'); }
  await page.waitForTimeout(3000);
  console.log('heavy head:', await page.textContent('.hv-head'));
  await page.screenshot({ path: SHOTS + 'heavy.png', fullPage: true });

  // wall local
  await page.goto(URL + '#wall'); await page.waitForSelector('.mode-card');
  await page.click('button:has-text("바로 시작")'); await page.click('button:has-text("게임 시작")');
  await page.waitForSelector('.wl-board');
  await page.click('.wl-cell >> nth=24'); // place (3,3)
  await page.waitForTimeout(3500); // bot places 2
  await page.click('.wl-cell >> nth=10').catch(()=>{});
  await page.waitForTimeout(2500);
  console.log('wall msg:', await page.textContent('.wl-msg'));
  await page.screenshot({ path: SHOTS + 'wall.png', fullPage: true });

  // guide unlock check via finishing signal quickly is hard; check locked text
  await page.goto(URL + '#signal'); await page.waitForSelector('.tabs');
  await page.click('#tab-guide'); console.log('guide:', (await page.textContent('#panel-guide')).slice(0, 40));

  console.log('ERRORS:', errs.length ? errs : 'none');
  await browser.close();
})();
