// 벽바둑 2 규칙 점검 (노드): 말 이동 규칙, 벽 부수기, 3인전 → 1:1, 결과
require('../src/core.js'); require('../src/games/wall.js');
const W = App.wall, E = W.engine;
const assert = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } };
// 1) 이동 규칙
const G = { rnd: 1, brk: [1, 1, 1], seats: [0, 1, 2], pc: [[[3, 3, 'S'], [5, 5, 'C']], [], []], hw: '0'.repeat(49), vw: '0'.repeat(49) };
const dests = (seat, i, b) => [...new Set(W.PATHS[G.pc[seat][i][2]].map((p) => W.walk(G, seat, i, p, b)).filter(Boolean).map((m) => m.to.join(',')))].sort();
console.log('사각 말 (3,3):', dests(0, 0, false).join(' '));
console.log('원형 말 (5,5):', dests(0, 1, false).join(' '));
assert(dests(0, 0, false).length === 8 && !dests(0, 0, false).includes('3,3'), 'square 8 dests, no stay');
assert(dests(0, 1, false).length === 8 && !dests(0, 1, false).includes('5,3'), 'circle 8 dests (no straight 2)');
// 벽이 있으면 막히고, 부수기면 지나감
G.vw = G.vw.slice(0, 3 * 7 + 3) + '1' + G.vw.slice(3 * 7 + 4); // (3,3) 오른쪽 벽
const noR = dests(0, 0, false), brkR = dests(0, 0, true);
console.log('벽 있을 때 오른쪽:', noR.filter((x) => x.startsWith('3,')).join(' '), '| 부수기로:', brkR.join(' '));
assert(!noR.includes('3,4') && brkR.includes('3,4') && brkR.includes('3,5') && brkR.length === 2, 'break passes exactly one wall');
// 2) 3인전 → 2라운드 → 끝 (컴퓨터끼리)
function sim(n, ai) {
  const g = E.start(Array.from({ length: n }, (_, i) => ({ n: 'p' + i, b: true })), { ai });
  let steps = 0, brkUsed = 0, rounds = new Set();
  while (!E.over(g) && steps < 3000) {
    steps++;
    rounds.add(g.rnd);
    if (g.ph === 'between') { E.tick(g, Date.now() + 10000); continue; }
    const s = E.pending(g)[0];
    const a = E.bot(g, s);
    if (!a) throw new Error('bot has no move');
    if (a.b) brkUsed++;
    E.act(g, s, a);
  }
  return { g, steps, brkUsed, rounds: [...rounds], res: E.results(g) };
}
for (const ai of ['easy', 'normal', 'hard']) {
  const t0 = Date.now(); const r = sim(3, ai);
  console.log('3인', ai, '| steps', r.steps, '| 라운드', r.rounds.join('→'), '| 1R 순위', r.g.r1.rank.join(','), '면적', r.g.r1.area.join('/'), '| 2R', r.g.r2.rank.join(' > '), r.g.r2.area.join('/'), '| places', r.res.places.join(','), '| 부수기', r.brkUsed, '|', Date.now() - t0, 'ms');
  assert(r.res.places.filter((x) => x === 'exile').length === 1, 'one eliminated');
}
for (const ai of ['normal', 'hard']) { const t0 = Date.now(); const r = sim(2, ai); console.log('2인', ai, '| steps', r.steps, '| 면적', r.g.r2.area.join('/'), '| places', r.res.places.join(','), r.res.draw ? '무승부' : '', '|', Date.now() - t0, 'ms'); }
// 3) 잘못된 수 거부
const g = E.start([{ n: 'a' }, { n: 'b' }], {});
const t = g.turn;
try { E.act(g, t, { t: 'put', r: 1, c: 1, k: 'S' }); console.log('FAIL put on circle'); } catch (e) { console.log('원형 말 자리에 놓기 거부:', e.message); }
try { E.act(g, t, { t: 'put', r: 0, c: 0, k: 'C' }); console.log('FAIL place circle in R2'); } catch (e) { console.log('2라운드 원형 말 추가 거부:', e.message); }
console.log(process.exitCode ? 'SOME FAILED' : 'all ok');
