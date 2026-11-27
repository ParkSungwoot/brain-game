require('../src/core.js'); globalThis.App.multi = {};
require('../src/games/jang.js');
const E = App.jang.engine;
const res = { 0: 0, 1: 0, '-1': 0 }; const whys = {};
for (const ai of ['easy', 'normal']) for (let gm = 0; gm < 40; gm++) {
  const G = E.start([{ n: 'a', b: true }, { n: 'b', b: true }], { ai });
  let steps = 0;
  while (!E.over(G) && steps < 500) { const p = E.pending(G); const seat = p[0]; const a = E.bot(G, seat); try { E.act(G, seat, a); } catch (e) { console.log('ERR', e.message, JSON.stringify(a)); process.exit(1); } steps++; }
  res[G.win]++; whys[G.why.split(' (')[0]] = (whys[G.why.split(' (')[0]] || 0) + 1;
  if (gm === 0) console.log(ai, 'sample: rounds', G.round, 'why', G.why, 'pv bytes', JSON.stringify(E.publicView(G)).length);
}
console.log('results', JSON.stringify(res), JSON.stringify(whys));
// validation checks
const G = E.start([{ n: 'a' }, { n: 'b' }], {});
try { E.act(G, 0, { t: 'order', o: [0, 1, 2, 3, 4] }); } catch (e) { console.log('order check:', e.message); }
E.act(G, 0, { t: 'order', o: G.deal.slice() }); E.act(G, 1, { t: 'order', o: G.deal.slice().reverse() });
console.log('ph', G.ph, 'cur', G.cur, 'k', G.k, 'card', App.jang.CARDS[G.order[G.cur][G.k]].name, 'legal', App.jang.legal(G.board, G.cur, G.order[G.cur][G.k]).length);
