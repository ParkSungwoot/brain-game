// 컬러 링크 방송 규칙 점검 (노드): 첫 1개 → 서로 다른 색 2개, 선언·증명 승점, 패자 선후공, 3점 선승
require('../src/core.js'); require('../src/games/link.js');
const L = App.link, E = L.engine;
const assert = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } };
const G = E.start([{ n: 'a' }, { n: 'b' }], { size: 7, xy: 0 });
const f = G.turn;
E.act(G, f, { t: 'put', c: 0, i: 0 });
assert(G.turn === 1 - f && G.need === 2, 'first turn 1 piece, then need 2');
try { E.act(G, 1 - f, { t: 'put', c: 1, i: 10 }); E.act(G, 1 - f, { t: 'put', c: 1, i: 30 }); assert(false, 'same color twice allowed'); } catch (e) { console.log('같은 색 두 번 거부:', e.message); }
E.act(G, 1 - f, { t: 'put', c: 2, i: 40 });
assert(G.turn === f, 'turn passes after 2 pieces');
try { E.act(G, f, { t: 'put', c: 3, i: 3 }); E.act(G, f, { t: 'call' }); assert(false, 'call after starting'); } catch (e) { console.log('놓기 시작한 뒤 선언 거부:', e.message); }
E.act(G, f, { t: 'put', c: 4, i: 20 });
// 상대가 선언 → 증명 실패 → 선언자 +1
E.act(G, 1 - f, { t: 'call' });
assert(G.ph === 'proof' && G.prover === f, 'prover is last placer');
E.act(G, f, { t: 'fail' });
assert(G.pts[1 - f] === 1 && G.ph === 'order' && G.loser === f, 'declarer +1, loser chooses');
E.act(G, f, { t: 'order', first: 0 });
assert(G.round === 2 && G.rfirst === 1 - f && G.moves === 0, 'round 2 starts with chosen order');
console.log('2라운드 선:', G.rfirst === 1 - f ? '이긴 사람(패자가 후공 선택)' : '?', '| 승점', G.pts.join(':'));
// 시간 초과 → 라운드 패배
E.act(G, G.turn, E.timeout(G, G.turn));
console.log('시간 초과 후 승점', G.pts.join(':'), G.why);
// 컴퓨터끼리 끝까지
function sim(ai, xy) {
  const g = E.start([{ n: 'a', b: true }, { n: 'b', b: true }], { size: 6, ai, xy });
  let steps = 0;
  while (!E.over(g) && steps < 2000) { steps++; const s = E.pending(g)[0]; E.act(g, s, E.bot(g, s)); }
  return { g, steps };
}
for (const [ai, xy] of [['easy', 1], ['normal', 1], ['normal', 0]]) {
  const t0 = Date.now(); const r = sim(ai, xy);
  console.log(ai, 'xy', xy, '| rounds', r.g.round, '| 승점', r.g.pts.join(':'), '| 승자', r.g.win, '| 기록', JSON.stringify(r.g.hist), '|', Date.now() - t0, 'ms');
  assert(Math.max(...r.g.pts) === 3 && r.g.round <= 5, 'ends at 3 points within 5 rounds');
}
// X·Y 미리 놓기
let withXY = 0; for (let t = 0; t < 20; t++) { const g = E.start([{ n: 'a' }, { n: 'b' }], { size: 7, xy: 1 }); if (g.board.some((c) => c >= 14)) withXY++; }
console.log('X/Y 미리 놓인 판:', withXY, '/ 20');
console.log(process.exitCode ? 'SOME FAILED' : 'all ok');
