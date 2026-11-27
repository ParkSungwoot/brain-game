# 두뇌 서바이벌에 내가 참가한다면?

방송 「데블스 플랜3」에 나온 두뇌 게임 열 가지를 웹에서 직접 해 볼 수 있게 만든 팬 메이드 사이트입니다. 방송사와는 관계가 없습니다.

- 사이트: https://parksungwoot.github.io/brain-game/
- 혼자 연습, 오늘의 문제(날마다 같은 문제로 전체 순위·상위 %·평균 시간), 컴퓨터와 대결
- 친구와 온라인 대결(방 코드 4자리): 빨리 맞히기(개인전·팀전) / 기록 대결(같이 시작, 진행 상황 공유, 나중에 같은 코드로 푼 사람도 순위에 합쳐짐)
- 첫 화면에 동시 접속자 수 (무료 요금제는 동시 100명까지)
- 온라인 연결은 Firebase Realtime Database + 익명 로그인 (무료 요금제, 플레이어 로그인 없음)

## 브랜치

| 브랜치 | 내용 |
| --- | --- |
| `main` | 원본 코드 (이 문서) |
| `gh-pages` | 실제로 열리는 사이트 파일 (`node build.js` 로 만든 `site/` 폴더 내용) |

## 폴더

```
src/               게임 코드 (core, 연결 계층 fire.js·multi.js, 빨리 풀기 틀 quick.js, games/*, app.js, style.css)
assets/            배너·미리보기 이미지, 픽셀 글꼴(Galmuri, SIL OFL 1.1 — assets/fonts/ofl.md)
build.js           한 장짜리 HTML 만들기
site.config.json   사이트 주소, Firebase 웹 설정(공개용 값)
database.rules.json  Firebase 보안 규칙 (콘솔의 Realtime Database → 규칙 에 붙여 넣음)
firebase.json      로컬 에뮬레이터 설정
fbkit/             Firebase SDK 묶음(fb.js) 만들기, 로컬 에뮬레이터 실행, 규칙 시험
test/              Playwright·Node 점검 스크립트
```

## 만들기

```bash
node build.js
```

- `site/` : GitHub Pages 판 (Firebase 로 누구나 연결). `index.html`, `fb.js`, 이미지들
- `dist/` : Claude 아티팩트 판 (Claude 의 방 기능으로 연결)

`fbkit/fb.js` 가 없거나 Firebase 버전을 바꿀 때:

```bash
cd fbkit && npm install && npm run bundle
```

## 사이트에 올리기 (gh-pages)

```bash
node build.js
git worktree add ../pages gh-pages
cp -a site/. ../pages/
cd ../pages && git add -A && git commit -m "사이트 업데이트" && git push origin gh-pages
```

## 로컬 시험

```bash
cd fbkit && npm run emulators        # Firebase 에뮬레이터 (Java 필요)
cd fbkit && npm run rules-test       # 보안 규칙 30가지 경우 점검
(cd site && python3 -m http.server 8791)
node test/fire.test.js               # 두 기기로 온라인 방 점검
node test/fire-v2.test.js            # 오늘의 문제·기록 대결·팀전·동시 접속자 점검 (세 기기)
```

## 출처

- 글꼴: [Galmuri](https://github.com/quiple/galmuri) — SIL Open Font License 1.1 (쓰는 글자만 남긴 부분 파일)
- Firebase JavaScript SDK — Apache License 2.0 (`fb.js` 끝에 원문 고지 포함)
