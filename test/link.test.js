require('../src/core.js'); require('../src/eq.js'); globalThis.App.multi = {};
require('../src/games/link.js');
const { solve, checkProof, solutionToProof, engine, LET } = App.link;
const N = 5;
function B(rows) { const b = []; for (const r of rows) for (const ch of r) b.push(ch === '.' ? -1 : LET.indexOf(ch)); return b; }
// 1) 간단히 이어짐
let b = B(['A...A', '.....', 'B...B', '.....', '.....']);
let r = solve(N, b, 100000); console.log('simple', r.ok, JSON.stringify(r.paths));
console.log(' proof check', checkProof(N, b, solutionToProof(N, b, r)));
// 2) 테두리 엇갈림 (불가능): A B on top row corners interleaved around a wall-less board is possible... use classic crossing in 2-wide corridor
b = B(['A.B..', 'CCDD.', 'B.A..', 'EEFF.', '.....']);
// row1 pieces C,C,D,D block; A(0,0)-A(2,2), B(0,2)-B(2,0) -> need to cross through row 1? row1 col4 free, row1 col... 
r = solve(N, b, 200000); console.log('cross-ish', r.ok);
// 3) 완전히 막힘: A 가 갇힘
b = B(['AB...', 'B....', '.....', '.....', '....A']);
r = solve(N, b, 200000); console.log('trapped A (B single? no B pair at (0,1),(1,0))', r.ok);
// 4) single with no free neighbor
b = B(['AB...', 'BC...', 'C....', '.....', '.....']);
r = solve(N, b, 200000); console.log('single A boxed', r.ok);
// 5) random positions timing on 7x7
const N7 = 7; let tot = 0, cnt = { true: 0, false: 0, null: 0 }; const t0 = Date.now();
for (let t = 0; t < 200; t++) { const bb = Array(49).fill(-1); const n = 6 + (t % 20); const left = Array(14).fill(2);
  for (let k = 0; k < n; k++) { let i; do { i = Math.floor(Math.random() * 49); } while (bb[i] !== -1); let c; do { c = Math.floor(Math.random() * 14); } while (!left[c]); left[c]--; bb[i] = c; }
  const s0 = Date.now(); const rr = solve(N7, bb, 60000); tot = Math.max(tot, Date.now() - s0); cnt[rr.ok]++;
  if (rr.ok) { const e = checkProof(N7, bb, solutionToProof(N7, bb, rr)); if (e) { console.log('BAD PROOF', e); break; } } }
console.log('random 7x7:', JSON.stringify(cnt), 'max ms', tot, 'total ms', Date.now() - t0);
// 6) full bot game sims
for (const ai of ['easy', 'normal']) for (let gm = 0; gm < 3; gm++) {
  const G = engine.start([{ n: 'a', b: true }, { n: 'b', b: true }], { size: 7, ai });
  let steps = 0; const t1 = Date.now();
  while (!engine.over(G) && steps < 200) { const seat = engine.pending(G)[0]; const a = engine.bot(G, seat); try { engine.act(G, seat, a); } catch (e) { console.log('act err', e.message, JSON.stringify(a).slice(0, 80)); break; } steps++; }
  console.log(ai, 'game', gm, 'moves', G.moves, 'win', G.win, G.why, (Date.now() - t1) + 'ms', 'pv bytes', JSON.stringify(engine.publicView(G)).length);
}
