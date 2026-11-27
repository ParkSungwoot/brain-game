globalThis.App = { games: [], h(){}, multi:{} };
require('../src/core.js'); require('../src/games/heavy.js'); require('../src/games/wall.js');
function sim(engine, players, opts, maxSteps=5000) {
  const G = engine.start(players, opts||{});
  let steps=0;
  while (!engine.over(G) && steps < maxSteps) {
    const p = engine.pending(G); if (!p.length) throw new Error('stuck');
    const seat = p[0]; const a = engine.bot(G, seat);
    engine.act(G, seat, a); steps++;
  }
  return {G, steps};
}
for (let n=3;n<=7;n++){ const t0=Date.now(); const {G,steps}=sim(App.heavy.engine, Array.from({length:n},(_, i)=>({n:'p'+i,b:true})));
  const pv = App.heavy.engine.publicView(G);
  console.log('heavy n',n,'steps',steps,'pen',G.pen.join(','),'rank',pv.rank.join(','),'bytes',JSON.stringify(pv).length, (Date.now()-t0)+'ms'); }
for (const ai of ['easy','normal','hard']) { const t0=Date.now(); const {G,steps}=sim(App.wall.engine,[{n:'a',b:true},{n:'b',b:true}],{ai});
  console.log('wall',ai,'steps',steps,'res',G.res,'bytes',JSON.stringify(App.wall.engine.publicView(G)).length,(Date.now()-t0)+'ms'); }
// heavy invalid action checks
const E=App.heavy.engine; const G=E.start([{n:'a'},{n:'b'},{n:'c'}]);
try{E.act(G,0,{t:'sub',card:9,chip:0})}catch(e){console.log('ok err:',e.message)}
E.act(G,0,{t:'sub',card:6,chip:3}); try{E.act(G,0,{t:'sub',card:5,chip:0})}catch(e){console.log('ok err:',e.message)}
E.act(G,1,{t:'sub',card:6,chip:0}); E.act(G,2,{t:'sub',card:6,chip:0});
console.log('queue',G.queue,'cur',G.cur, 'first', G.first);
E.act(G,0,{t:'place',ped:1}); E.act(G,1,{t:'pass'}); E.act(G,2,{t:'place',ped:0});
console.log('after', JSON.stringify(G.ped), 'cur', G.cur, 'queue', G.queue);
E.act(G,1,{t:'place'}); console.log('round', G.round, 'ped', JSON.stringify(G.ped), 'pen', G.pen, 'first', G.first);
