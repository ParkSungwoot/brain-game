require('../src/core.js'); require('../src/eq.js'); globalThis.App.multi = {};
require('../src/games/link.js');
const { solve, checkProof, solutionToProof, engine, LET } = App.link;
const B = (N, rows) => rows.join('').split('').map((ch) => (ch === '.' ? -1 : LET.indexOf(ch)));
// 1) 바로 옆 짝: 6칸 이상 돌아가야 함 (가능)
let b = B(4, ['AA..', '....', '....', '....']); let r = solve(4, b, 200000);
console.log('adjacent pair on 4x4:', r.ok, r.ok && JSON.stringify(r.paths), r.ok && checkProof(4, b, solutionToProof(4, b, r)));
// 2) 2칸 증명은 거부
console.log('2-cell proof rejected:', checkProof(4, b, [[0, [0, 1]]]));
// 3) 1x? 좁은 판에서 불가능: 3x3 에 짝 2개 + 다른 쌍
b = B(3, ['A.A', 'BBC', '..C']); r = solve(3, b, 200000); console.log('cramped 3x3:', r.ok);
// 4) 한 개만 놓인 색: 6칸 길 + 짝
b = B(4, ['A...', '....', '....', '....']); r = solve(4, b, 200000); console.log('single:', r.ok, JSON.stringify(r.paths), checkProof(4, b, solutionToProof(4, b, r)));
// 5) 7x7 무작위 판 속도
let cnt = { true: 0, false: 0, null: 0 }, maxMs = 0; const t0 = Date.now();
for (let t = 0; t < 150; t++) { const bb = Array(49).fill(-1); const n = 4 + (t % 12); const left = Array(14).fill(2);
  for (let k = 0; k < n; k++) { let i; do { i = Math.floor(Math.random() * 49); } while (bb[i] !== -1); let c; do { c = Math.floor(Math.random() * 14); } while (!left[c]); left[c]--; bb[i] = c; }
  const s0 = Date.now(); const rr = solve(7, bb, 60000); maxMs = Math.max(maxMs, Date.now() - s0); cnt[rr.ok]++;
  if (rr.ok) { const e = checkProof(7, bb, solutionToProof(7, bb, rr)); if (e) { console.log('BAD', e); break; } } }
console.log('random 7x7:', JSON.stringify(cnt), 'max', maxMs + 'ms', 'total', (Date.now() - t0) + 'ms');
// 6) 컴퓨터끼리 대국
for (const ai of ['easy', 'normal']) for (let g = 0; g < 4; g++) {
  const G = engine.start([{ n: 'a', b: true }, { n: 'b', b: true }], { size: 7, ai }); let st = 0; const t1 = Date.now();
  while (!engine.over(G) && st < 200) { const s = engine.pending(G)[0]; const a = engine.bot(G, s); engine.act(G, s, a); st++; }
  console.log(ai, 'moves', G.moves, 'win', G.win, G.why, (Date.now() - t1) + 'ms');
}
