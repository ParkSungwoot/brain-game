// 배경 음악 곡 데이터 점검
//   node test/music-songs.check.js            → src/music-songs.js 의 모든 곡
//   node test/music-songs.check.js a.json ... → JSON 파일로 된 곡(하나 또는 배열)
// 형식이 틀리면 ERROR, 음악적으로 확인해 볼 점은 NOTE 로 알려 줌. ERROR 가 하나라도 있으면 종료 코드 1
const fs = require('fs');
const path = require('path');
let songs = [];
const files = process.argv.slice(2);
if (files.length) {
  for (const f of files) { const v = JSON.parse(fs.readFileSync(f, 'utf8')); songs.push(...(Array.isArray(v) ? v : [v])); }
} else {
  globalThis.App = {};
  require(path.join(__dirname, '../src/music-songs.js'));
  songs = App.musicSongs;
}
const WAVES = ['p12', 'p25', 'p50', 'tri'];
let errors = 0;
const ids = new Set(), titles = new Set();
const isInt = (x) => Number.isInteger(x);
const PC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
for (const sg of songs) {
  const E = [], N = [];
  const err = (m) => E.push(m), note = (m) => N.push(m);
  if (!/^[a-z][a-z0-9-]{1,20}$/.test(sg.id || '')) err('id 는 영어 소문자·숫자·- 로 2~21자');
  if (ids.has(sg.id)) err('id 중복: ' + sg.id); ids.add(sg.id);
  if (typeof sg.title !== 'string' || sg.title.length < 2 || sg.title.length > 8) err('title 은 2~8자 한국어');
  if (titles.has(sg.title)) err('title 중복: ' + sg.title); titles.add(sg.title);
  if (!(sg.bpm >= 90 && sg.bpm <= 180)) err('bpm 은 90~180');
  if (sg.hurryBpm != null && !(sg.hurryBpm > sg.bpm && sg.hurryBpm <= 200)) err('hurryBpm 은 bpm 보다 크고 200 이하');
  const S = sg.steps || 16;
  if (S !== 12 && S !== 16) err('steps 는 12 또는 16');
  const nb = Array.isArray(sg.bars) ? sg.bars.length : 0;
  if (nb < 4 || nb > 16) err('bars 는 4~16 마디');
  (sg.bars || []).forEach((b, i) => {
    if (!isInt(b.r) || b.r < 28 || b.r > 52) err(`bars[${i}].r 베이스 근음은 MIDI 28~52`);
    if (!Array.isArray(b.t) || b.t.length !== 3 || !b.t.every(isInt) || b.t.some((x) => x < 50 || x > 86) || !(b.t[0] < b.t[1] && b.t[1] < b.t[2])) err(`bars[${i}].t 는 오름차순 MIDI 50~86 세 음`);
  });
  const patCheck = (name, pat, lo, hi) => {
    if (!Array.isArray(pat) || pat.length !== S) { err(`${name} 길이는 steps(${S})`); return; }
    pat.forEach((v, k) => { if (v !== null && (!isInt(v) || v < lo || v > hi)) err(`${name}[${k}] 는 null 또는 ${lo}~${hi} 정수`); });
  };
  if (!sg.bass) err('bass 필요');
  else {
    if (!WAVES.includes(sg.bass.wave)) err('bass.wave');
    patCheck('bass.pat', sg.bass.pat, -12, 24); if (sg.bass.alt) patCheck('bass.alt', sg.bass.alt, -12, 24);
    if (!(sg.bass.len >= 1 && sg.bass.len <= 8)) err('bass.len 은 1~8');
    if (sg.bass.vol != null && !(sg.bass.vol > 0 && sg.bass.vol <= 1.5)) err('bass.vol 은 0~1.5');
    const hi = Math.max(...(sg.bars || []).map((b) => b.r)) + Math.max(...[...(sg.bass.pat || []), ...(sg.bass.alt || [])].filter((x) => x != null));
    if (hi > 64) note('베이스 최고음이 높아요 (MIDI ' + hi + ')');
  }
  if (sg.arp) {
    if (!WAVES.includes(sg.arp.wave)) err('arp.wave');
    patCheck('arp.pat', sg.arp.pat, 0, 5); if (sg.arp.alt) patCheck('arp.alt', sg.arp.alt, 0, 5);
    if (sg.arp.vol != null && !(sg.arp.vol > 0 && sg.arp.vol <= 2)) err('arp.vol 은 0~2');
  }
  if (!sg.lead) err('lead 필요');
  else {
    if (!WAVES.includes(sg.lead.wave)) err('lead.wave');
    if (sg.lead.vol != null && !(sg.lead.vol > 0 && sg.lead.vol <= 1.5)) err('lead.vol 은 0~1.5');
    if (sg.lead.echo != null && !(isInt(sg.lead.echo) && sg.lead.echo >= 1 && sg.lead.echo <= 6)) err('lead.echo 는 1~6');
    if (!Array.isArray(sg.lead.notes) || sg.lead.notes.length !== nb) err('lead.notes 는 마디 수만큼');
    let strong = 0, strongChord = 0, total = 0, lo = 999, hiN = 0, leaps = 0, prev = null;
    (sg.lead.notes || []).forEach((bar, i) => {
      let end = 0;
      const ch = sg.bars[i] ? sg.bars[i].t.map((x) => x % 12) : [];
      [...bar].sort((a, b) => a[0] - b[0]).forEach((n) => {
        const [st, m, len] = n;
        if (!isInt(st) || st < 0 || st >= S || !isInt(m) || m < 55 || m > 93 || !isInt(len) || len < 1 || st + len > S) { err(`lead.notes[${i}] 의 [${n}] 범위 (시작 0~${S - 1}, MIDI 55~93, 마디를 넘지 않게)`); return; }
        if (st < end) err(`lead.notes[${i}] 음이 겹침: [${n}]`);
        end = st + len; total++;
        lo = Math.min(lo, m); hiN = Math.max(hiN, m);
        if (prev != null && Math.abs(m - prev) > 12) leaps++;
        prev = m;
        if (st % 4 === 0) { strong++; if (ch.includes(m % 12)) strongChord++; }
      });
    });
    if (total < nb * 1.5) note('멜로디 음이 적어요 (' + total + '음)');
    if (strong && strongChord / strong < 0.5) note('센박 멜로디 음 중 화음 음 비율이 낮아요 ' + Math.round(strongChord / strong * 100) + '%');
    if (leaps) note('한 옥타브 넘게 뛰는 곳 ' + leaps + '군데');
    N.push(`멜로디 ${total}음, 음역 ${PC[lo % 12]}${Math.floor(lo / 12) - 1}~${PC[hiN % 12]}${Math.floor(hiN / 12) - 1}, 센박 화음음 ${strong ? Math.round(strongChord / strong * 100) : 0}%`);
  }
  const D = sg.drums || {};
  for (const k of ['k', 's', 'h', 'hk', 'hh']) {
    if (D[k] == null) { if (k === 'k' || k === 's' || k === 'h') err('drums.' + k + ' 필요'); continue; }
    if (typeof D[k] !== 'string' || D[k].length !== S || /[^.xog]/.test(D[k])) err(`drums.${k} 는 '.xog' 로 된 ${S}글자`);
  }
  if (sg.gain != null && !(sg.gain > 0.2 && sg.gain < 3)) err('gain 은 0.2~3');
  const secs = nb * S * 60 / sg.bpm / 4;
  N.push(`${nb}마디 × ${S}칸, ${sg.bpm}bpm → 한 바퀴 ${secs.toFixed(1)}초`);
  errors += E.length;
  console.log(`\n[${sg.id}] ${sg.title}`);
  for (const m of E) console.log('  ERROR ' + m);
  for (const m of N) console.log('  NOTE  ' + m);
}
console.log(errors ? `\n${errors} ERROR` : '\nall ok (' + songs.length + '곡)');
process.exitCode = errors ? 1 : 0;
