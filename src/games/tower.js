/* 수식의 탑: 양면 블록을 옮기고 뒤집어 목표 값의 식을 쌓는 퍼즐 */
(function () {
  const App = (globalThis.App = globalThis.App || {});
  const { h } = App;
  const C = App.towerCore;
  const E = App.eq;
  const ROUNDS = 5;
  const WANTS = [2, 3, 3, 4, 4];

  function mount(root, ctx) {
    const wrap = h('div', { class: 'tower-game' });
    root.append(wrap);
    let G; // 게임 전체 상태

    function newGame() {
      const tiles = C.makeTiles(6);
      G = { tiles, towers: C.randomTowers(6), round: 0, score: 0, log: [], used: new Set() };
      nextRound();
    }

    function nextRound() {
      G.round++;
      if (G.round > ROUNDS) { G.phase = 'over'; draw(); ctx.finished({ score: G.score }); return; }
      G.phase = 'thinking';
      draw();
      setTimeout(() => {
        let goal = C.pickGoal(G.tiles, G.towers, WANTS[G.round - 1], G.used);
        if (!goal) { G.towers = C.randomTowers(6); goal = C.pickGoal(G.tiles, G.towers, WANTS[G.round - 1], G.used); }
        G.goal = goal;
        G.used.add(goal.v + '@' + goal.h);
        G.declared = Math.min(8, goal.d + 1);
        G.startTowers = G.towers.map((t) => t.slice());
        G.history = [];
        G.sel = null;
        G.flip = false;
        G.phase = 'declare';
        G.t0 = Date.now();
        draw();
      }, 30);
    }

    function startAttempt() { G.phase = 'play'; G.history = []; G.sel = null; draw(); }

    function doMove(m) {
      G.history.push(G.towers);
      G.towers = C.apply(G.towers, m);
      G.sel = null;
      if (C.goalMet(G.tiles, G.towers, G.goal)) return endRound(true);
      if (G.history.length >= G.declared) return endRound(false);
      draw();
    }

    function endRound(ok, gaveUp) {
      const optimal = G.goal.d;
      let pts;
      if (ok) pts = G.declared === optimal ? 2 : 1;
      else pts = -1;
      G.score += pts;
      G.last = { ok, pts, used: G.history.length, optimal, gaveUp };
      if (!ok) G.towers = G.startTowers.map((t) => t.slice()); // 실패하면 라운드 시작 상태로
      G.log.push({ round: G.round, goal: G.goal.v + ' · ' + G.goal.h + '층', declared: G.declared, ok, pts });
      G.phase = 'result';
      draw();
      if (G.round === 1) ctx.finished({}); // 첫 라운드만 끝내도 공략이 열림
    }

    function tileEl(code, extraCls, onclick) {
      const t = G.tiles[code >> 1];
      const up = code & 1 ? E.show(t.o) : String(t.d);
      const back = code & 1 ? String(t.d) : E.show(t.o);
      return h('button', { class: 'tile ' + (code & 1 ? 'op' : 'num') + (extraCls || ''), type: 'button', onclick, 'aria-label': '앞면 ' + up + ', 뒷면 ' + back },
        h('span', { class: 'face' }, up), h('span', { class: 'back' }, back));
    }

    function towersEl(interactive) {
      const row = h('div', { class: 'towers' });
      G.towers.forEach((tw, ti) => {
        const col = h('div', { class: 'tw-col' + (interactive && G.sel && G.sel.t !== ti ? ' droppable' : '') + (G.sel && G.sel.t === ti ? ' source' : '') });
        const stack = h('div', { class: 'tw-stack' });
        for (let i = tw.length - 1; i >= 0; i--) {
          const selected = G.sel && G.sel.t === ti && i >= tw.length - G.sel.k;
          stack.append(tileEl(tw[i], selected ? ' sel' : '', interactive ? (e) => {
            e.stopPropagation();
            if (G.sel && G.sel.t !== ti) { doMove({ f: G.sel.t, k: G.sel.k, t: ti, flip: G.flip }); return; }
            const k = tw.length - i;
            if (G.sel && G.sel.t === ti && G.sel.k === k) G.sel = null; else G.sel = { t: ti, k };
            draw();
          } : null));
        }
        const r = C.readTower(G.tiles, tw);
        const hit = r && tw.length === G.goal.h && r.value === G.goal.v;
        col.append(
          h('div', { class: 'tw-label' }, C.TNAMES[ti] + ' · ' + tw.length + '층'),
          stack,
          h('div', { class: 'tw-base' }),
          h('div', { class: 'tw-read' + (hit ? ' hit' : '') }, r ? r.toks.map((x) => E.show(x)).join(' ') + ' = ' + r.value : (tw.length ? '식이 아님' : '비어 있음')));
        if (interactive) col.addEventListener('click', () => {
          if (!G.sel) return;
          if (G.sel.t === ti) { if (G.flip) doMove({ f: ti, k: G.sel.k, t: ti, flip: true }); else { G.sel = null; draw(); } return; }
          doMove({ f: G.sel.t, k: G.sel.k, t: ti, flip: G.flip });
        });
        row.append(col);
      });
      return row;
    }

    function draw() {
      App.clear(wrap);
      const head = h('div', { class: 'tw-head' },
        h('span', { class: 'pill' }, '라운드 ' + Math.min(G.round, ROUNDS) + ' / ' + ROUNDS),
        h('span', { class: 'pill strong' }, '점수 ' + G.score),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn tiny ghost', onclick: newGame }, '새 게임'));
      wrap.append(head);

      if (G.phase === 'thinking') { wrap.append(h('div', { class: 'center-msg' }, '목표를 고르는 중…')); return; }
      if (G.phase === 'over') {
        wrap.append(h('div', { class: 'result-box' },
          h('strong', { class: 'result-big' }, '최종 ' + G.score + '점'),
          h('p', null, '만점은 ' + ROUNDS * 2 + '점입니다. 선언한 횟수가 최단 수와 같으면 2점, 선언 안에 성공하면 1점, 실패하면 −1점이에요.'),
          logTable(),
          h('button', { class: 'btn primary', onclick: newGame }, '새 블록으로 다시')));
        return;
      }

      const goal = h('div', { class: 'goal-card' },
        h('span', { class: 'goal-k' }, '목표 값'), h('strong', { class: 'goal-v' }, String(G.goal.v)),
        h('span', { class: 'goal-k' }, '탑 높이'), h('strong', { class: 'goal-v' }, G.goal.h + '층'));
      wrap.append(goal);

      if (G.phase === 'declare') {
        wrap.append(towersEl(false));
        wrap.append(h('div', { class: 'declare' },
          h('p', null, '몇 번 만에 ', h('b', null, G.goal.h + '층짜리 ' + G.goal.v), ' 탑을 만들 수 있을까요? 블록을 머릿속으로 옮겨 보고 횟수를 선언하세요.'),
          h('div', { class: 'stepper' },
            h('button', { class: 'btn', 'aria-label': '하나 줄이기', onclick: () => { G.declared = Math.max(1, G.declared - 1); draw(); } }, '−'),
            h('strong', { class: 'step-v' }, G.declared + '번'),
            h('button', { class: 'btn', 'aria-label': '하나 늘리기', onclick: () => { G.declared = Math.min(8, G.declared + 1); draw(); } }, '+')),
          h('button', { class: 'btn primary big', onclick: startAttempt }, G.declared + '번 안에 도전')));
        return;
      }

      if (G.phase === 'play') {
        const used = G.history.length;
        wrap.append(h('div', { class: 'tw-bar' },
          h('span', { class: 'moves' + (used === G.declared - 1 ? ' last' : '') }, '이동 ', h('b', null, used), ' / ' + G.declared),
          h('button', { class: 'toggle' + (G.flip ? ' on' : ''), 'aria-pressed': G.flip ? 'true' : 'false', onclick: () => { G.flip = !G.flip; draw(); } }, G.flip ? '뒤집어서 옮기기 켜짐' : '뒤집어서 옮기기 꺼짐'),
          G.sel ? h('button', { class: 'btn tiny', onclick: () => doMove({ f: G.sel.t, k: G.sel.k, t: G.sel.t, flip: true }) }, '선택한 ' + G.sel.k + '개 제자리 뒤집기') : null));
        wrap.append(h('p', { class: 'hint' }, G.sel ? '옮길 탑을 누르세요. 같은 탑을 다시 누르면 선택이 풀려요.' : '블록을 누르면 그 블록과 위에 있는 블록이 함께 선택돼요.'));
        wrap.append(towersEl(true));
        wrap.append(h('div', { class: 'row wrap center' },
          h('button', { class: 'btn', disabled: !used, onclick: () => { G.towers = G.history.pop(); G.sel = null; draw(); } }, '한 수 되돌리기'),
          h('button', { class: 'btn ghost', disabled: !used, onclick: () => { G.towers = G.startTowers.map((t) => t.slice()); G.history = []; G.sel = null; draw(); } }, '처음 상태로'),
          h('button', { class: 'btn ghost', onclick: () => endRound(false, true) }, '포기')));
        return;
      }

      if (G.phase === 'result') {
        const L = G.last;
        wrap.append(towersEl(false));
        wrap.append(h('div', { class: 'result-box' + (L.ok ? ' ok' : ' bad') },
          h('strong', { class: 'result-big' }, L.ok ? '성공 +' + L.pts : (L.gaveUp ? '포기 ' : '실패 ') + L.pts),
          h('p', null, '선언 ' + G.declared + '번 · 실제 ' + L.used + '번 · 최단 ' + L.optimal + '번' + (L.ok && L.pts === 2 ? ' — 최단 수를 정확히 선언했어요!' : '')),
          h('details', { class: 'solution' }, h('summary', null, '최단 풀이 보기'),
            h('ol', null, G.goal.path.map((m) => h('li', null, C.describe(m))))),
          !L.ok ? h('p', { class: 'note' }, '실패한 라운드는 탑을 라운드 시작 상태로 되돌린 뒤 다음 목표로 넘어가요.') : h('p', { class: 'note' }, '다음 라운드는 지금 탑 모양 그대로 시작해요.'),
          h('button', { class: 'btn primary', onclick: nextRound }, G.round >= ROUNDS ? '최종 결과 보기' : '다음 라운드')));
      }
    }

    function logTable() {
      return h('table', { class: 'log' },
        h('thead', null, h('tr', null, ['라운드', '목표', '선언', '결과'].map((x) => h('th', null, x)))),
        h('tbody', null, G.log.map((r) => h('tr', null, h('td', null, r.round), h('td', null, r.goal), h('td', null, r.declared + '번'), h('td', null, (r.ok ? '성공 ' : '실패 ') + (r.pts > 0 ? '+' : '') + r.pts)))));
    }

    newGame();
    return () => {};
  }

  App.games.push({
    id: 'tower',
    name: '수식의 탑',
    kicker: '이동 퍼즐',
    players: '혼자',
    blurb: '앞뒤에 숫자와 기호가 적힌 블록을 옮기고 뒤집어, 목표 값이 나오는 식의 탑을 쌓습니다. 블록과 목표는 매판 새로 만들어져요.',
    accent: 'tower',
    mount,
    rules: `
<p>블록 6개가 탑 3곳에 나뉘어 쌓여 있습니다. 블록마다 한쪽 면에는 숫자(1~9), 다른 면에는 기호(+ − ×)가 있습니다. 보이는 면이 큰 글씨, 반대쪽 면이 작은 글씨입니다.</p>
<div class="demo" data-demo="rules-tower"></div>
<ul>
<li>탑은 <b>위에서 아래로</b> 읽습니다. 숫자·기호·숫자… 순서로 이어져야 식이 됩니다. 곱셈을 먼저 계산합니다.</li>
<li>매 라운드 <b>목표 값</b>과 <b>탑 높이</b>가 주어집니다. 정확히 그 높이의 탑 하나가 목표 값이 되면 성공입니다.</li>
<li><b>한 번의 이동</b>: 한 탑의 맨 위에서 원하는 개수만큼 블록을 집어 다른 탑 위에 올립니다. 이때 집은 묶음을 통째로 뒤집어서 올릴 수도 있습니다.</li>
<li>묶음을 뒤집으면 순서가 거꾸로 되고, 모든 블록의 보이는 면이 반대로 바뀝니다. 옮기지 않고 같은 탑에서 뒤집기만 해도 1번의 이동입니다.</li>
<li>시작 전에 몇 번 만에 만들지 <b>선언</b>합니다. 선언한 횟수 안에 만들면 성공입니다.</li>
</ul>
<h4>점수</h4>
<p>선언 횟수 안에 성공하면 +1점, 선언 횟수가 최단 수와 정확히 같으면 +2점, 실패하면 −1점입니다. 5라운드를 진행하며, 성공한 라운드의 탑 모양은 다음 라운드로 이어집니다.</p>`,
    guide: `
<h4>1. 목표 식부터 거꾸로 정하기</h4>
<p>먼저 “어떤 식이면 목표 값이 나오는가”를 정합니다. 5층이면 숫자 3개와 기호 2개가 필요합니다. 지금 보이는 면과 뒷면을 모두 보고, 필요한 숫자와 기호를 가진 블록을 고르세요. 곱셈이 먼저 계산된다는 점을 이용하면 후보가 크게 늘어납니다. 예: 목표 23 = 4 × 5 + 3 = 3 + 4 × 5.</p>
<h4>2. 뒤집기는 순서와 면을 동시에 바꾼다</h4>
<p>묶음을 뒤집으면 위아래 순서가 반대가 되고, 블록마다 보이는 면도 바뀝니다. 그래서 “숫자 면이 보이는 블록 두 개 사이에 기호 면 하나”처럼 면이 번갈아 있는 묶음은 뒤집어도 번갈아 있는 상태가 유지됩니다. 한 블록만 면을 바꾸고 싶다면 그 블록 하나만 집어서 뒤집으며 옮기는 것이 가장 쌉니다.</p>
<div class="demo" data-demo="tower"></div>
<h4>3. 여러 개를 한 번에 옮겨서 수를 아끼기</h4>
<p>이동 횟수는 블록 개수가 아니라 “집는 횟수”입니다. 이미 올바른 순서로 붙어 있는 2~3개는 한 번에 옮기세요. 반대로 거꾸로 붙어 있는 묶음이라면 뒤집어서 옮기면 순서까지 한 번에 바로잡힙니다(면도 바뀌니 확인 필요).</p>
<h4>4. 바닥부터 쌓는다고 생각하기</h4>
<p>탑은 위에서부터 읽지만, 만들 때는 아래 블록부터 놓입니다. 목표 식의 <b>마지막 숫자</b>가 맨 아래에 와야 합니다. 비어 있는 탑이 있으면 그 자리를 완성할 탑으로 쓰고, 나머지 한 곳을 임시 보관용으로 쓰면 계획이 단순해집니다.</p>
<h4>5. 선언은 확인한 만큼만</h4>
<p>선언 횟수가 최단 수와 같으면 2점이지만, 실패하면 −1점입니다. 머릿속으로 끝까지 따라가 본 경로가 있을 때만 그 횟수를 선언하고, 확신이 없으면 1번 여유를 두는 것이 기대 점수가 높습니다. 결과 화면의 “최단 풀이 보기”로 어떤 이동을 놓쳤는지 확인해 보세요.</p>`,
  });
})();
