require('../src/core.js'); require('../src/eq.js'); require('../src/games/tower-core.js');
const T = App.towerCore;
for (let trial=0; trial<4; trial++) {
  const tiles = T.makeTiles(6); let tw = T.randomTowers(6);
  for (const want of [2,3,4,5]) {
    const t0=Date.now(); const ex = T.explore(tiles, tw, Math.min(5,want+1), 600000);
    const ms=Date.now()-t0;
    const g = T.pickGoal(tiles, tw, want);
    // verify path
    let s = tw; for (const m of g.path) s = T.apply(s, m);
    if (!T.goalMet(tiles, s, g) ) throw 'path fail';
    console.log('trial',trial,'want',want,'states',ex.parent.size,'goals',ex.goals.size, ms+'ms', 'picked', g.v+'@'+g.h, 'd', g.d, 'len', g.path.length);
  }
}
