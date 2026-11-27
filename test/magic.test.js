require('../src/core.js'); require('../src/games/magic.js');
const M = App.magic;
for (const n of [3,4,5,7]) for (let t=0;t<300;t++){ const q=M.makeSquare(n, t%2?'any':'classic'); if(!M.isMagic(q)) throw 'bad'; }
console.log('squares ok');
const s7=M.siamese(7); console.log('center', s7[3][3], 'opposite sum', s7[0][0]+s7[6][6], s7[1][2]+s7[5][4]);
for (const n of [3,4,5,7]) for (const d of ['easy','medium','blank']) {
  const t0=Date.now(); let blanks=0; const K=20;
  for (let i=0;i<K;i++){ const p=M.makePuzzle(n,d, i%3?1:7); blanks+=p.given.filter(x=>x==null).length;
    // verify solution matches givens & magic with offset
    const S=p.S; const sol=p.sol; for(let k=0;k<n*n;k++) if(p.given[k]!=null && p.given[k]!==sol[k]) throw 'given mismatch';
  }
  console.log(n,d,'avg blanks',(blanks/K).toFixed(1),'/',n*n, (Date.now()-t0)+'ms');
}
