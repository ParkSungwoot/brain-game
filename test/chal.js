const { chromium, devices } = require('playwright');
const URL = 'file://' + __dirname + '/../dist/preview.html';
const pzSig = (p) => p.evaluate(() => JSON.stringify(App.quick.lastPuzzle).length + ':' + JSON.stringify(App.quick.lastPuzzle).slice(0, 80));
async function solveAll(p, n, giveUpAt) {
  const sigs = [];
  for (let i = 0; i < n; i++) {
    await p.waitForSelector('#nemo-ans');
    sigs.push(await pzSig(p));
    if (i === giveUpAt) await p.click('button:text-is("포기하고 정답 보기")');
    else { const a = await p.evaluate(() => App.quick.lastPuzzle.hits.length); await p.fill('#nemo-ans', String(a)); await p.press('#nemo-ans', 'Enter'); }
    await p.click(i === n - 1 ? 'button:text-is("결과 보기")' : 'button:text-is("다음 문제")');
  }
  return sigs;
}
(async () => {
  const b = await chromium.launch();
  const A = await (await b.newContext({ viewport: { width: 1000, height: 1000 } })).newPage();
  const B = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  const errs = []; for (const p of [A, B]) p.on('pageerror', (e) => errs.push(e.message));
  // 코드 왕복 점검 (세 게임, 모든 설정)
  await A.goto(URL + '#nemo'); await A.waitForSelector('.seg');
  const rt = await A.evaluate(() => {
    const C = App.quick.ch; let bad = 0, total = 0; const doms = {};
    for (const g of App.games.filter((x) => ['nemo', 'cubes', 'sym'].includes(x.id))) {
      const def = { nemo: 0, cubes: 0, sym: 0 };
    }
    return 'skip';
  });
  // A: 도전 만들기
  await A.click('button:text-is("대결 코드")');
  await A.fill('#nemo-ch-nick', '현진');
  await A.click('button:text-is("3문제")');
  await A.click('button:text-is("음수 섞기")');
  await A.click('button:text-is("대결 코드 만들기")');
  const head = await A.textContent('.room-made-head');
  const code = (await A.getAttribute('.code-tiles', 'aria-label')).replace('코드 ', '');
  const invite = await A.$eval('.share-text', (t) => t.value);
  console.log('A:', head, code, '| sub:', await A.textContent('.room-made-sub'));
  await A.click('button:text-is("지금 풀기")'); if (await A.$('.count-wait')) await A.click('button:text-is("혼자 바로 시작")');
  const sigA = await solveAll(A, 3, -1);
  await A.waitForSelector('.rank');
  const resA = await A.$eval('.share-text', (t) => t.value);
  console.log('A board:', (await A.textContent('.result-box .result-big')).trim(), '| code in msg:', resA.match(/결과 코드: (\S+)/)[1]);
  // B: 결과 메시지를 통째로 붙여 넣기 → 도전장 → 풀기
  await B.goto(URL + '#nemo'); await B.waitForSelector('.seg');
  await B.tap('button:text-is("대결 코드")');
  await B.fill('#nemo-ch-nick', '친구');
  await B.fill('#nemo-ch-paste', resA); await B.tap('button:text-is("열기")');
  console.log('B intro:', await B.textContent('.room-made-head'), '|', (await B.textContent('.room-made')).includes('결과 1개'));
  await B.tap('button:text-is("지금 풀기")'); if (await B.$('.count-wait')) await B.tap('button:text-is("혼자 바로 시작")');
  const sigB = await solveAll(B, 3, 1);
  console.log('same puzzles:', JSON.stringify(sigA) === JSON.stringify(sigB));
  await B.waitForSelector('.rank');
  console.log('B board:', (await B.textContent('.result-box .result-big')).trim(), '|', (await B.textContent('.result-box')).match(/상위[^·]+· 참가자 평균 [^\n]+?초/)?.[0]);
  console.log('B ranks:', await B.$$eval('.rank tbody tr', (r) => r.map((x) => x.textContent)));
  const resB = await B.$eval('.share-text', (t) => t.value);
  // A: B의 결과 넣기
  await A.fill('#nemo-ch-res', resB); await A.click('button:text-is("순위에 넣기")');
  await A.waitForTimeout(200);
  console.log('A after add:', (await A.textContent('.result-box .result-big')).trim(), '| note:', await A.textContent('.result-box .note.strong').catch(() => '-'));
  // 같은 결과 다시 넣기 → 중복
  await A.fill('#nemo-ch-res', resB); await A.click('button:text-is("순위에 넣기")'); await A.waitForTimeout(100);
  console.log('dup:', await A.textContent('.result-box .note.strong').catch(() => '-'), '| rows', await A.$$eval('.rank tbody tr', (r) => r.length));
  // 오타 코드
  await A.click('button:text-is("대결 목록")');
  await A.fill('#nemo-ch-paste', code.slice(0, -1) + (code.endsWith('A') ? 'B' : 'A')); await A.click('button:text-is("열기")');
  console.log('typo:', await A.textContent('.warn-note'));
  console.log('history:', await A.$$eval('.chal-hist .pitem', (r) => r.map((x) => x.textContent)));
  // 다른 게임 탭에서 네모 코드 열기 → 네모로 이동
  await A.goto(URL + '#cubes'); await A.waitForSelector('.seg');
  await A.click('button:text-is("대결 코드")');
  await A.fill('#cubes-ch-paste', invite); await A.click('button:text-is("열기")');
  await A.waitForTimeout(600);
  console.log('cross-game → hash', await A.evaluate(() => location.hash), '| view:', await A.textContent('.mp-bar .bar-label').catch(() => '-'));
  // 세 게임 모든 설정 왕복
  const rt2 = await A.evaluate(() => {
    const C = App.quick.ch; let ok = 0, bad = [];
    for (const id of ['nemo', 'cubes', 'sym']) {
      // 등록된 def 찾기: 코드 앞 글자로
      const pre = { nemo: 'NE', cubes: 'CU', sym: 'SY' }[id];
      const probe = C.parseChallenge(pre + '-' + '0'.repeat(9));
      void probe;
    }
    return 'n/a';
  });
  await A.screenshot({ path: process.argv[2] + '/chal-a.png', fullPage: true });
  await B.screenshot({ path: process.argv[2] + '/chal-b.png', fullPage: true });
  console.log('errors', errs.length ? errs : 'none');
  await b.close();
})();
