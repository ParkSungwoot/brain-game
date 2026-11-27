// 카드 장기 방송 규칙 점검 (노드)
require('../src/core.js'); require('../src/games/jang.js');
const J = App.jang, E = J.engine;
const assert = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } };
const G = E.start([{ n: 'a' }, { n: 'b' }], {});
const f = G.first, sF = 1 - f;
assert(G.need[f] === 5 && G.need[sF] === 4, 'first arranges 5, second 4');
try { E.act(G, sF, { t: 'arr', o: [0, 1, 2, 3, 4] }); assert(false, '후공 5장 허용'); } catch (e) { console.log('후공 5장 거부:', e.message); }
E.act(G, f, { t: 'arr', o: [4, 0, 1, 2, 3] }); E.act(G, sF, { t: 'arr', o: [0, 2, 3, 1] });
assert(G.ph === 'move' && G.turn === f && G.front[f] === 4 && G.front[sF] === 0, 'both first cards revealed, first moves');
console.log('공개 카드:', J.CARDS[G.front[f]].name, '/', J.CARDS[G.front[sF]].name, '| 남은 장 수', G.q.map((q) => q.length).join(','));
// 기린으로 작은 말 2칸 전진해 잡기 (선이 0번 자리라면 위로, 아니면 아래로)
const mv = J.legal(G.board, f, G.front[f]).find(([a, b]) => G.board[b] && G.board[b].s === sF);
console.log('기린으로 잡을 수 있는 수:', JSON.stringify(mv));
// 시간 초과 → 상대가 대신
E.act(G, G.turn, { t: 'timeout' });
assert(G.ph === 'force' && G.forcer === sF, 'force by opponent');
const fm = J.legal(G.board, f, G.front[f])[0];
E.act(G, sF, { t: 'force', from: fm[0], to: fm[1] });
assert(G.ph === 'move' && G.turn === sF, 'after forced move, opponent turn');
console.log('강제 이동 후 차례 넘어감 ✓ | 로그', JSON.stringify(G.log.slice(-2)));
// 컴퓨터끼리 끝까지
function sim(ai) {
  const g = E.start([{ n: 'a', b: true }, { n: 'b', b: true }], { ai });
  let steps = 0, rearr = 0, passes = 0;
  while (!E.over(g) && steps < 5000) {
    steps++;
    if (g.ph === 'between') { E.tick(g, Date.now() + 10000); continue; }
    if (g.ph === 'rearr') rearr++;
    const s = E.pending(g)[0];
    const a = E.bot(g, s);
    E.act(g, s, a);
  }
  passes = 0;
  return { g, steps, rearr };
}
for (const ai of ['easy', 'normal']) {
  const t0 = Date.now(); const r = sim(ai);
  console.log(ai, '| steps', r.steps, '| 라운드', r.g.round, '| 승수', r.g.wins.join(':'), '| 승자', r.g.win, '| 재배치', r.rearr, '| 기록', JSON.stringify(r.g.hist), '|', r.g.why, '|', Date.now() - t0, 'ms');
  assert(r.g.ph === 'end', 'match ends');
}
console.log(process.exitCode ? 'SOME FAILED' : 'all ok');
