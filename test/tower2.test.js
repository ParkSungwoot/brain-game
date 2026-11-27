// 수식의 탑 방송 규칙 엔진 점검 (가상 시계)
globalThis.App = { games: [], h(){}, multi:{}, store:{get:(k,d)=>d,set(){}} };
require('../src/core.js'); require('../src/eq.js'); require('../src/games/tower-core.js'); require('../src/games/tower.js');
const T = App.towerCore, E = App.tower.engine;
let now = 1e9; App.towerClock = () => now;
const assert = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } };

// 1) 읽기 규칙
const B=[{d:5,o:''},{d:4,o:'*'},{d:3,o:'+'},{d:2,o:''},{d:6,o:'-'}];
const rd=(tw)=>{const r=T.readTower(B,tw);return r?r.value:null;};
assert(rd([2,1,0])===23,'5×4+3'); assert(rd([0,1])===null,'top symbol'); assert(rd([3,0])===52,'concat 52');
assert(rd([4,2,0])===2,'5+3−6=2'); assert(rd([1,2,0])===17,'5+3×4=17');
assert(!T.validMove([[0,1],[2],[]],{f:0,k:1,t:0,flip:true}),'1개 제자리 뒤집기 불가');
assert(T.validMove([[0,1],[2],[]],{f:0,k:2,t:0,flip:true}),'2개 제자리 뒤집기');
console.log('읽기 규칙 ok');

// 2) 컴퓨터만으로 끝까지
function sim(n, ai, lvl, maxMs) {
  const G = E.start(Array.from({length:n},(_, i)=>({n:'c'+i,b:true})), {ai, lvl});
  let due = {}, key = '', steps = 0; const t0 = now;
  while (!E.over(G) && now - t0 < maxMs) {
    now += 250;
    if (E.tick(G, now)) {}
    const k = G.ph + G.round; if (k !== key) { key = k; due = {}; }
    const pend = E.pending(G);
    for (const s of Object.keys(due)) if (!pend.includes(+s)) delete due[s];
    for (const s of pend) {
      if (due[s] == null) due[s] = now + E.botDelay(G, s);
      if (now >= due[s]) { delete due[s]; const a = E.bot(G, s); if (a) { E.act(G, s, a); steps++; } break; }
    }
  }
  return { G, steps, mins: ((now - t0) / 60000).toFixed(1) };
}
for (const [n, ai, lvl] of [[2,'normal','normal'],[4,'normal','normal'],[3,'easy','easy'],[6,'hard','normal']]) {
  const w = Date.now();
  const { G, steps, mins } = sim(n, ai, lvl, 6 * 3600e3);
  const pv = E.publicView(G); const res = E.results(G);
  const kinds = G.hist.reduce((m, h) => { const k = h[1] < 0 ? 'void' : (h[3] === 1 ? 'first' : 'under') + (h[4] ? '+' : '-'); m[k] = (m[k] || 0) + 1; return m; }, {});
  assert(E.over(G), 'game over n=' + n);
  assert(Math.max(...G.pts) >= 7 || G.round >= 40, 'someone 7');
  assert(res.places.filter((p) => p === 'exile').length === 1, 'one exile');
  console.log('n', n, ai, lvl, '| rounds', G.round, '| pts', G.pts.join(','), '| exile', res.exile, res.exileHow || '', '| ot', G.ot, '|', JSON.stringify(kinds), '| game', mins, 'min |', 'bytes', JSON.stringify(pv).length, '|', Date.now() - w, 'ms');
}

// 3) 사람 행동 규칙
{
  const G = E.start([{n:'a'},{n:'b'},{n:'c'}], {});
  const d = G.sol.d;
  let err = ''; try { E.act(G, 0, {t:'under', n: 2}); } catch (e) { err = e.message; } assert(err, 'buzz 전 under 불가'); 
  E.act(G, 0, {t:'buzz', n: 5});
  assert(G.ph === 'under' && G.low.n === 5, 'under 시작');
  err = ''; try { E.act(G, 0, {t:'under', n: 3}); } catch (e) { err = e.message; } console.log('처음 제시자 재제시:', err);
  err = ''; try { E.act(G, 1, {t:'under', n: 5}); } catch (e) { err = e.message; } console.log('같은 횟수:', err);
  E.act(G, 1, {t:'under', n: 4});
  err = ''; try { E.act(G, 1, {t:'under', n: 3}); } catch (e) { err = e.message; } console.log('두 번째 제시:', err);
  E.act(G, 2, {t:'pass'});
  assert(G.ph === 'try' && G.att.s === 1 && G.att.bid === 4 && G.att.w === 'under', '모두 끝나면 바로 도전');
  // 최단 풀이 그대로 두면 성공 (+2)
  for (const m of G.sol.path) E.act(G, 1, {t:'mv', f:m.f, k:m.k, to:m.t, flip:m.flip});
  assert(G.ph === 'between' && G.res.ok && G.pts[1] === 2, '추가 제시 성공 +2 (d=' + d + ')');
  now += 10000; E.tick(G, now); assert(G.ph === 'buzz' && G.round === 2, '다음 라운드');
  // 탑 유지 확인
  const k1 = T.key(G.T); assert(G.ph === 'buzz', 'buzz'); 
  // 아무도 안 누르면 무효
  now += 300001; E.tick(G, now); assert(G.ph === 'between' && G.res.void, '5분 무효');
  now += 10000; E.tick(G, now); assert(T.key(G.T) === k1, '무효 뒤 탑 그대로');
  // 처음 제시자 실패 −1 (시간 초과)
  E.act(G, 2, {t:'buzz', n: 9}); now += 120001; E.tick(G, now); assert(G.ph === 'try' && G.att.s === 2, '2분 지나면 도전');
  now += 120001; E.tick(G, now); assert(G.res && !G.res.ok && G.res.why === 'time' && G.pts[2] === -1, '시간 초과 −1');
  now += 10000; E.tick(G, now);
  // 1번 제시는 더 줄일 수 없어 바로 도전, 횟수 다 쓰면 실패
  E.act(G, 0, {t:'buzz', n: 1}); assert(G.ph === 'try', '1번 제시 → 바로 도전');
  const bad = T.moves(G.T).find((m) => { const N = T.apply(G.T, m); return !T.goalMet(G.B, N, G.goal); });
  E.act(G, 0, {t:'mv', f:bad.f, k:bad.k, to:bad.t, flip:bad.flip}); assert(G.res && G.res.why === 'moves' && G.pts[0] === -1, '횟수 다 써서 실패 −1');
  console.log('사람 행동 규칙 ok | 점수', G.pts.join(','));
}
// 4) 연장: 7점 도달했지만 꼴찌 동점
{
  const G = E.start([{n:'a'},{n:'b'},{n:'c'}], {});
  G.pts = [7, 1, 1]; G.ph = 'between'; G.until = now; E.tick(G, now);
  assert(G.ph === 'buzz' && G.ot, '꼴찌 동점이면 연장');
  G.pts = [8, 2, 1]; G.ph = 'between'; G.until = now; E.tick(G, now);
  assert(G.ph === 'end' && G.places[2] === 'exile' && G.places[0] === 'live', '가려지면 종료');
  console.log('연장 ok', G.places.join(','));
}
console.log(process.exitCode ? 'FAILED' : 'all ok');
