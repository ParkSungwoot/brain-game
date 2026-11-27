require('../src/core.js'); require('../src/eq.js');
globalThis.App.multi = {};
require('../src/quick.js'); require('../src/games/nemo.js'); require('../src/games/cubes.js'); require('../src/games/spot.js'); require('../src/games/sym.js');
const Q = App.quick;
function bench(name, fn, N=60) { const t0=Date.now(); let last; for (let i=0;i<N;i++) last = fn(i); console.log(name, ((Date.now()-t0)/N).toFixed(1)+'ms avg'); return last; }
for (const size of ['S','M','L']) for (const neg of [0,1]) {
  const ex = bench('nemo '+size+' neg'+neg, (i) => App.nemo.gen(1000+i, {size, neg}));
  // verify hits count vs brute force
  const all = App.nemo.allRects(ex.rows, ex.cols, ex.cells).filter(r=>r[4]===ex.target);
  console.log('  target', ex.target, 'answer', ex.hits.length, all.length===ex.hits.length?'ok':'MISMATCH');
}
// nemo brute-force cross-check with naive implementation
for (let s=0;s<200;s++){ const p=App.nemo.gen(5000+s,{size:'M',neg:1}); let cnt=0;
  for(let r1=0;r1<p.rows;r1++)for(let r2=r1;r2<p.rows;r2++)for(let c1=0;c1<p.cols;c1++)for(let c2=c1;c2<p.cols;c2++){let sum=0,bad=false;for(let r=r1;r<=r2;r++)for(let c=c1;c<=c2;c++){const v=p.cells[r*p.cols+c]; if(v==null)bad=true; else sum+=v;} if(!bad&&sum===p.target)cnt++;}
  if(cnt!==p.hits.length) { console.log('NEMO MISMATCH', s, cnt, p.hits.length); break; } }
console.log('nemo naive cross-check done');
for (const size of ['S','M','L']) { const c = bench('cubes '+size, (i)=>App.cubes.gen(2000+i,{size,q:'mix'}), 40); console.log('  ', c.nx+'x'+c.ny, 'ask', c.ask, 'answer', c.answer, 'hm', c.hm.join('')); }
for (const k of [5,7,9]) for (const level of ['easy','hard']) { const s = bench('spot k'+k+' '+level, (i)=>App.spot.gen(3000+i,{k,level}), 40); console.log('   diffs', s.diffs.length, s.diffs.map(d=>d.type).join(','), 'objs', s.L.length, s.R.length); }
// spot: count achieved diffs distribution
let short=0; for (let i=0;i<300;i++){ const s=App.spot.gen(9000+i,{k:9,level:'hard'}); if (s.diffs.length<9) short++; } console.log('spot k9 short count', short, '/300');
// spot determinism
console.log('spot deterministic', JSON.stringify(App.spot.gen(42,{k:7,level:'easy'}))===JSON.stringify(App.spot.gen(42,{k:7,level:'easy'})));
for (const pieces of [3,4]) for (const size of ['S','M']) { const p = bench('sym '+pieces+' '+size, (i)=>App.sym.gen(4000+i,{pieces,size,flip:0}), 40);
  // verify solution symmetric & connected
  const all=[]; p.sol.forEach(pc=>pc.forEach(c=>all.push(c))); console.log('   cells', all.length, 'axis', App.sym.symmetryAxis(all), 'conn', App.sym.connected(all), 'sizes', p.sol.map(x=>x.length).join('/')); }
// race engine sim with bots
const eng = Q.raceEngine(App.games.find(g=>g.id==='nemo') ? {id:'nemo', kind:'number', gen:App.nemo.gen, check:(pz,v)=>v===pz.hits.length, answer:pz=>pz.hits.length, botTime:()=>1, defaultOpts:{size:'S',neg:0}} : null);
const G = eng.start([{n:'a'},{n:'b',b:true}], {size:'S', neg:0, rounds:3});
const pz = Q.puzzleOf({id:'nemo', gen:App.nemo.gen}, G.seed, G.o);
try { eng.act(G,0,{t:'ans',v:pz.hits.length+1}); } catch(e){ console.log('err', e.message); }
console.log('after wrong lock>0', G.lock[0] > Date.now(), 'pending', eng.pending(G));
try { eng.act(G,0,{t:'ans',v:pz.hits.length}); } catch(e){ console.log('locked err ok:', e.message); }
eng.act(G,1,{t:'ans',v:pz.hits.length}); console.log('ph', G.ph, 'pts', G.pts, 'win', G.win);
console.log('pv bytes', JSON.stringify(eng.publicView(G)).length);
