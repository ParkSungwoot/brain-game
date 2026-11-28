// 배경 음악 곡마다 소리 없이 만들어 보고(브라우저 OfflineAudioContext) 크기·최고값을 잼 + 미리 듣기 WAV
//   node test/music-render.js [--out 폴더] [--sec 초] [곡.json ...]
//   JSON 을 주면 그 곡들을 src 곡 목록 뒤에 붙여서 같이 잼
// 출력: 곡별 RMS(dBFS)·최고값, 맞춤 gain 제안, --out 이 있으면 곡별 WAV 와 전체 이어 듣기 WAV
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const args = process.argv.slice(2);
let out = null, sec = 14;
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') out = args[++i];
  else if (args[i] === '--sec') sec = +args[++i];
  else files.push(args[i]);
}
const extra = files.flatMap((f) => { const v = JSON.parse(fs.readFileSync(f, 'utf8')); return Array.isArray(v) ? v : [v]; });
const RATE = 22050;

function wav(int16, rate) {
  const b = Buffer.alloc(44 + int16.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + int16.length * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(int16.length * 2, 40);
  for (let i = 0; i < int16.length; i++) b.writeInt16LE(int16[i], 44 + i * 2);
  return b;
}

(async () => {
  const br = await chromium.launch();
  const p = await br.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '../dist/preview.html'));
  await p.evaluate((x) => { App.musicSongs.push(...x); }, extra);
  const n = await p.evaluate(() => App.musicSongs.length);
  const rows = [];
  const all = [];
  for (let i = 0; i < n; i++) {
    const r = await p.evaluate(async ([i, sec, rate]) => {
      const sg = App.musicSongs[i];
      const stat = (d) => { let s = 0, pk = 0; for (let k = 0; k < d.length; k++) { s += d[k] * d[k]; pk = Math.max(pk, Math.abs(d[k])); } return { rms: Math.sqrt(s / d.length), peak: pk }; };
      const d = await App.music._render(i, sec, false, rate);
      const f = await App.music._render(i, 6, true, rate);
      const a = stat(d.subarray(Math.floor(rate * 1))), b = stat(f.subarray(Math.floor(rate * 1)));
      // WAV 용 16비트 (base64)
      const i16 = new Int16Array(d.length);
      for (let k = 0; k < d.length; k++) i16[k] = Math.max(-32768, Math.min(32767, Math.round(d[k] * 32767)));
      let bin = ''; const u8 = new Uint8Array(i16.buffer);
      for (let k = 0; k < u8.length; k += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(k, k + 0x8000));
      return { id: sg.id, title: sg.title, gain: sg.gain || 1, rms: a.rms, peak: a.peak, hrms: b.rms, hpeak: b.peak, b64: btoa(bin) };
    }, [i, sec, RATE]);
    rows.push(r);
    const i16 = new Int16Array(new Uint8Array(Buffer.from(r.b64, 'base64')).buffer);
    all.push(i16);
    if (out) fs.writeFileSync(path.join(out, `${String(i + 1).padStart(2, '0')}-${r.id}.wav`), wav(i16, RATE));
  }
  const ref = rows[0].rms;
  const db = (x) => (20 * Math.log10(x)).toFixed(1);
  console.log('곡            RMS(dB)  최고   서두를때RMS  최고   지금gain  맞춤gain');
  for (const r of rows) {
    const g = (r.gain * ref / r.rms);
    console.log(`${(r.id + ' ' + r.title).padEnd(16)} ${db(r.rms).padStart(6)}  ${r.peak.toFixed(2)}  ${db(r.hrms).padStart(8)}   ${r.hpeak.toFixed(2)}   ${r.gain.toFixed(2)}     ${g.toFixed(2)}`);
  }
  if (out) {
    // 전체 이어 듣기: 곡마다 앞 10초 + 0.6초 쉼
    const gap = new Int16Array(Math.floor(RATE * 0.6));
    const parts = [];
    for (const a of all) { parts.push(a.subarray(0, Math.min(a.length, RATE * 10)), gap); }
    const len = parts.reduce((s, a) => s + a.length, 0);
    const cat = new Int16Array(len); let o = 0;
    for (const a of parts) { cat.set(a, o); o += a.length; }
    fs.writeFileSync(path.join(out, 'all-songs.wav'), wav(cat, RATE));
    console.log('WAV 저장:', out);
  }
  console.log('errors', errs.length ? errs : 'none');
  await br.close();
})();
