// 픽셀 캐릭터 미리 보기 PNG (브라우저 없이)
//   node test/avatar-preview.js out.png [모양.json ...]
//   JSON 이 없으면 src/avatar-shapes.js 의 모든 모양. JSON 은 {id,name,grid} 하나 또는 배열
// 위쪽: 모양마다 8배 크기로 색 4가지 / 아래쪽: 실제 크기에 가까운 2배(32px)로 색 10가지
// 형식 점검도 함 (16줄 × 16글자, 쓸 수 있는 글자, 색 바뀌는 C 칸 있음, 테두리 K 있음)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
globalThis.App = {};
require(path.join(__dirname, '../src/avatar-shapes.js'));
require(path.join(__dirname, '../src/avatar.js'));
const A = App.avatar;
const args = process.argv.slice(2);
const out = args[0] || 'avatars.png';
let shapes = App.avatarShapes || [];
if (args.length > 1) shapes = args.slice(1).flatMap((f) => { const v = JSON.parse(fs.readFileSync(f, 'utf8')); return Array.isArray(v) ? v : [v]; });

let bad = 0;
for (const sh of shapes) {
  const errs = A.validate(sh);
  if (errs.length) { bad++; console.log('ERROR [' + sh.id + '] ' + errs.join(' / ')); }
  else console.log('ok    [' + sh.id + '] ' + sh.name);
}

const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const BIG = 8, SMALL = 2, PAD = 8;
const bigColors = [0, 4, 6, 9];
const W = PAD + shapes.length * (16 * BIG + PAD);
const rowBig = 16 * BIG, rowSmall = 16 * SMALL;
const H = PAD + bigColors.length * (rowBig + PAD) + PAD + A.COLORS.length * (rowSmall + 4) + PAD;
const img = Buffer.alloc(W * H * 3);
const bgA = hex('#1c1a17'), bgB = hex('#f4efe6');
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  // 위 절반 어두운 배경, 아래 절반 밝은 배경 (두 화면 색에서 다 보이는지)
  const c = y < H / 2 ? bgA : bgB;
  img.set(c, (y * W + x) * 3);
}
function draw(sh, colorIdx, ox, oy, scale) {
  const pal = A.palette(colorIdx);
  sh.grid.forEach((row, y) => [...row].forEach((ch, x) => {
    const col = pal[ch];
    if (!col) return;
    const rgb = hex(col);
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const px = ox + x * scale + dx, py = oy + y * scale + dy;
      if (px < W && py < H) img.set(rgb, (py * W + px) * 3);
    }
  }));
}
shapes.forEach((sh, i) => {
  if (A.validate(sh).length) return;
  const ox = PAD + i * (16 * BIG + PAD);
  bigColors.forEach((c, k) => draw(sh, c, ox, PAD + k * (rowBig + PAD), BIG));
  A.COLORS.forEach((_, c) => draw(sh, c, ox + (c % 2) * (rowSmall + 4), PAD + bigColors.length * (rowBig + PAD) + PAD + Math.floor(c / 2) * (rowSmall + 4) * 1, SMALL));
});

// PNG 쓰기
function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; img.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('PNG:', out, W + '×' + H, bad ? bad + ' ERROR' : 'all ok');
process.exitCode = bad ? 1 : 0;
