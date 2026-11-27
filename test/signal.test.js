globalThis.document = undefined;
require('../src/core.js'); require('../src/eq.js'); require('../src/games/signal.js');
const S = App.signal, E = App.eq;
const ex = ['7*8-29=27','9^0+8=9','11*11=121','12+5=17','6*7-2=40','2^5=32','0^0=1','5/0=1','01+2=3','3+4*2=11','2^3^2=512','8/3*3=8','-1+2=1','1+1=1+1'];
for (const e of ex) console.log(e, JSON.stringify(E.checkEquation(e)));
for (const len of [7,8,9,10]) for (const pow of [0,1]) {
  const t0=Date.now(); const out=[]; let powc=0;
  for (let i=0;i<200;i++){ const q=S.genEquation(len,pow); if(q.length!==len||!E.checkEquation(q).ok) throw new Error('bad '+q); if(q.includes('^'))powc++; if(i<4) out.push(q);}
  console.log(len,pow,(Date.now()-t0)+'ms', 'pow%', powc/2, out.join('  '));
}
console.log(S.grade('7*8-29=27','9^0+8=9'));
// engine sim
const G = S.engine.start([{n:'a'},{n:'b'}],{len:9,pow:1});
S.engine.act(G,0,{t:'sec',eq:'7*8-29=27'}); S.engine.act(G,1,{t:'sec',eq:'9^0*5+4=9'});
S.engine.act(G,0,{t:'g',eq:'9^0*5+4=9'}); S.engine.act(G,1,{t:'g',eq:'7*8-28=28'});
console.log(JSON.stringify(S.engine.publicView(G)));
console.log(App.cleanNick('  hi\u200bthere\n  '));
