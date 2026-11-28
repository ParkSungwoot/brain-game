// 배경 음악: 게임마다 시작/멈춤, 켜기/끄기 버튼 기억
const { chromium, devices } = require('playwright');
const URL = 'file://' + __dirname + '/../dist/preview.html';
const OUT = process.argv[2] || require('os').tmpdir();
const playing = (p) => p.evaluate(() => App.music.playing());
const ctxState = (p) => p.evaluate(() => { try { return App.music.playing() ? 'playing' : 'idle'; } catch (e) { return 'err'; } });
let bad = 0;
const check = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) bad++; };
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=user-gesture-required'] });
  const errs = [];
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  // 1) 링크로 바로 들어와 아직 누른 적이 없으면 소리 없음 → 한 번 누르면 재생
  await p.goto(URL + '#cubes'); await p.waitForTimeout(800);
  check(!(await playing(p)), '누르기 전에는 재생 안 함 (자동 재생 막기)');
  await p.tap('.q-head'); await p.waitForTimeout(600);
  check(await playing(p), '혼자 연습(큐브 세기): 화면을 누르면 재생');
  const btn = await p.textContent('.music-btn');
  check(/음악 켜짐/.test(btn), '머리 버튼: ' + btn);
  await p.screenshot({ path: OUT + '/music-head.png' });
  await p.tap('.music-btn'); await p.waitForTimeout(300);
  check(!(await playing(p)) && /꺼짐/.test(await p.textContent('.music-btn')), '버튼으로 끄기');
  await p.reload(); await p.waitForTimeout(600); await p.tap('.q-head'); await p.waitForTimeout(400);
  check(!(await playing(p)) && /꺼짐/.test(await p.textContent('.music-btn')), '끈 설정 기억 (새로고침 뒤)');
  await p.tap('.music-btn'); await p.waitForTimeout(500);
  check(await playing(p), '다시 켜면 바로 재생');
  // 1-2) 곡 8개, 들어갈 때마다 무작위 (바로 전 곡은 안 나옴), 곡마다 오류 없이 재생
  check((await p.evaluate(() => App.music.count())) === 8, '곡 수 8');
  const seq = [];
  for (let k = 0; k < 8; k++) {
    await p.tap('a.back'); await p.waitForTimeout(250);
    await p.goto(URL + '#cubes'); await p.waitForTimeout(350); await p.tap('.q-head'); await p.waitForTimeout(250);
    seq.push(await p.evaluate(() => App.music.current()));
  }
  check(seq.every((x, i) => x >= 0 && (i === 0 || x !== seq[i - 1])) && new Set(seq).size >= 3, '들어갈 때마다 다른 곡: ' + seq.join(','));
  for (let i = 0; i < 8; i++) {
    await p.evaluate((i) => App.music._restartWith(i), i); await p.waitForTimeout(350);
    const st = await p.evaluate(() => [App.music.playing(), App.music.current(), App.musicSongs[App.music.current()].title]);
    check(st[0] && st[1] === i, '곡 ' + (i + 1) + ' 재생: ' + st[2]);
  }
  await p.evaluate(() => App.music.hurry(true)); await p.waitForTimeout(400);
  check(await playing(p), '서두르기 상태에서도 계속 재생');
  // 2) 목록으로 나가면 멈춤
  await p.tap('a.back'); await p.waitForTimeout(500);
  check(!(await playing(p)), '게임 목록으로 나가면 멈춤');
  // 3) 컴퓨터와 하기 (무거운 13): 로비에서는 조용, 시작하면 재생, 나가면 멈춤
  await p.goto(URL + '#heavy'); await p.waitForTimeout(500);
  await p.tap('button:has-text("바로 시작")'); await p.waitForTimeout(300);
  check(!(await playing(p)), '로비(시작 전)에는 조용');
  await p.tap('button:has-text("게임 시작")'); await p.waitForTimeout(600);
  check(await playing(p), '컴퓨터와 대결 시작하면 재생');
  await p.tap('.mp-bar button:has-text("나가기")'); await p.waitForTimeout(400);
  check(!(await playing(p)), '나가기 누르면 멈춤');
  // 3-2) 기록 대결(컴퓨터와): 푸는 중에 나가면 음악도 멈춤
  await p.goto(URL + '#cubes'); await p.waitForTimeout(400);
  await p.tap('.seg-btn:has-text("온라인 대결")'); await p.waitForTimeout(300);
  await p.tap('button:has-text("바로 시작")'); await p.waitForTimeout(300);
  await p.tap('.seg-btn:has-text("기록 대결")'); await p.waitForTimeout(200);
  await p.tap('button:has-text("게임 시작")'); await p.waitForTimeout(6500);
  check(await playing(p) && !!(await p.$('.mp .quick .q-head')), '기록 대결: 카운트다운 뒤 푸는 중 재생');
  await p.tap('.mp-bar button:has-text("나가기")'); await p.waitForTimeout(500);
  check(!(await playing(p)), '기록 대결 푸는 중 나가기 → 멈춤');
  // 4) 수식의 탑: 혼자 연습 탭 ↔ 대결 탭
  await p.goto(URL + '#tower'); await p.waitForTimeout(500);
  await p.tap('.seg-btn:has-text("혼자 연습")'); await p.waitForTimeout(500);
  check(await playing(p), '수식의 탑 혼자 연습: 재생');
  await p.tap('.seg-btn:has-text("대결")'); await p.waitForTimeout(400);
  check(!(await playing(p)), '대결 탭(로비)으로 바꾸면 멈춤');
  // 5) 수식 신호등 혼자 풀기, 마법 격자
  await p.goto(URL + '#signal'); await p.waitForTimeout(600);
  check(await playing(p), '수식 신호등 혼자 풀기: 재생');
  await p.goto(URL + '#magic'); await p.waitForTimeout(600);
  check(await playing(p), '마법 격자: 재생');
  // 6) 시간이 얼마 안 남으면 빨라짐 표시 (hurry) 는 게임이 없으면 꺼짐
  await p.goto(URL + '#'); await p.waitForTimeout(400);
  check(!(await playing(p)), '첫 화면: 조용');
  // 7) 오디오가 없는 브라우저에서도 오류 없이
  const p2 = await (await b.newContext()).newPage(); p2.on('pageerror', (e) => errs.push('noaudio: ' + e.message));
  await p2.addInitScript(() => { delete window.AudioContext; delete window.webkitAudioContext; });
  await p2.goto(URL + '#cubes'); await p2.mouse.click(10, 10); await p2.waitForTimeout(500);
  check(!(await playing(p2)) && !!(await p2.$('.music-btn')), 'AudioContext 없는 브라우저: 조용히 넘어감');
  // 8) 폭: 휴대폰 머리 줄
  const w = await p.evaluate(() => document.documentElement.scrollWidth);
  check(w <= 390, '휴대폰 가로 넘침 없음 ' + w);
  console.log('errors', errs.length ? errs : 'none');
  console.log(bad ? 'FAILED ' + bad : 'all ok');
  await b.close();
})();
