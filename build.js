const fs = require('fs'), path = require('path');
const src = (p) => fs.readFileSync(path.join(__dirname, 'src', p), 'utf8');
const order = ['core.js','eq.js','fire.js','music.js','multi.js','quick.js','games/signal.js','games/jang.js','games/link.js','games/magic.js','games/tower-core.js','games/tower.js','games/nemo.js','games/cubes.js','games/sym.js','games/heavy.js','games/wall.js','demos.js','demos-rules.js','app.js'];
let js = order.map(f => `/* ---- ${f} ---- */\n` + src(f)).join('\n');
if (/<\/script/i.test(js)) throw new Error('</script in JS');
const fontB64 = (f) => fs.readFileSync(path.join(__dirname, 'assets', 'fonts', f)).toString('base64');
const fonts = `/* 픽셀 글꼴: Galmuri(갈무리) Copyright (c) 2019-2025 Lee Minseo (quiple@quiple.dev), SIL Open Font License 1.1 — https://openfontlicense.org (사용하는 글자만 남긴 부분 파일) */
@font-face { font-family: "Galmuri11"; src: url(data:font/woff2;base64,${fontB64('Galmuri11-sub.woff2')}) format("woff2"); font-weight: 400; font-display: swap; }
@font-face { font-family: "Galmuri11"; src: url(data:font/woff2;base64,${fontB64('Galmuri11-Bold-sub.woff2')}) format("woff2"); font-weight: 700; font-display: swap; }
@font-face { font-family: "GalmuriMono11"; src: url(data:font/woff2;base64,${fontB64('GalmuriMono11-sub.woff2')}) format("woff2"); font-weight: 400 700; font-display: swap; }`;
const css = src('style.css').replace('/*FONTS*/', () => fonts);
const page = src('page.html').replace('/*CSS*/', () => css).replace('/*JS*/', () => js);
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'brain-game-room.html'), page);
// 로컬 미리보기용 (게시 때 씌워지는 뼈대를 흉내)
const skel = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${page}</body></html>`;
fs.writeFileSync(path.join(__dirname, 'dist', 'preview.html'), skel);
for (const f of ['banner.jpg', 'banner-m.jpg']) fs.copyFileSync(path.join(__dirname, 'assets', f), path.join(__dirname, 'dist', f));
console.log('built', (page.length/1024).toFixed(1)+'KB');

// ---------- GitHub Pages 판 (site/): Firebase 로 누구나 실시간 연결 ----------
const conf = JSON.parse(fs.readFileSync(path.join(__dirname, 'site.config.json'), 'utf8'));
const siteUrl = (process.env.SITE_URL || conf.url || '').replace(/\/?$/, '/');
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const TITLE = '두뇌 서바이벌에 내가 참가한다면?';
const DESC = '두뇌 서바이벌 게임 열 가지를 직접 해 보세요. 친구와 방 코드나 대결 코드로 함께할 수 있어요.';
const body = src('page.html').replace(/^<title>.*<\/title>\n/, '').replace('/*CSS*/', () => css).replace('/*JS*/', () => js);
const cfgJs = 'window.App = Object.assign(window.App || {}, ' + JSON.stringify({ FIREBASE: conf.firebase, FB_SRC: 'fb.js', SHARE_URL: siteUrl !== '/' ? siteUrl : '' }) + ');';
const site = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${TITLE}</title>
<meta name="description" content="${esc(DESC)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(TITLE)}">
<meta property="og:description" content="${esc(DESC)}">
${siteUrl !== '/' ? `<meta property="og:url" content="${esc(siteUrl)}">\n<meta property="og:image" content="${esc(siteUrl)}og.jpg">\n` : ''}<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="600">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#120f0c">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%A7%A0%3C/text%3E%3C/svg%3E">
<style>:root{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui;background:#120f0c}img{max-width:100%}[hidden]{display:none!important}</style>
<script>${cfgJs}</script>
</head>
<body>
${body}
</body>
</html>
`;
const siteDir = path.join(__dirname, 'site');
fs.mkdirSync(siteDir, { recursive: true });
fs.writeFileSync(path.join(siteDir, 'index.html'), site);
for (const f of ['banner.jpg', 'og.jpg']) fs.copyFileSync(path.join(__dirname, 'assets', f), path.join(siteDir, f));
const fbBundle = path.join(__dirname, 'fbkit', 'fb.js');
if (fs.existsSync(fbBundle)) fs.copyFileSync(fbBundle, path.join(siteDir, 'fb.js'));
fs.writeFileSync(path.join(siteDir, '.nojekyll'), '');
console.log('site', (site.length/1024).toFixed(1)+'KB', siteUrl !== '/' ? siteUrl : '(주소 미정: site.config.json 의 url)');
