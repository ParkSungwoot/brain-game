/* 수식 계산기: 유리수로 정확하게 계산 (부동소수점 오차 없음)
 * 문자: 0-9 + - * / ^ =   (화면에는 × ÷ − 로 표시)
 * 우선순위: ^ (오른쪽 결합) > × ÷ > + −, 음수 부호(단항 −)와 01 같은 앞자리 0은 허용하지 않음
 */
(function () {
  const App = (globalThis.App = globalThis.App || {});
  const LIMIT = 1e12;

  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
  function norm(n, d) {
    if (d === 0) throw new Error('0으로 나눌 수 없어요');
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d);
    n /= g; d /= g;
    if (Math.abs(n) > LIMIT || d > LIMIT) throw new Error('수가 너무 커요');
    return [n, d];
  }
  const add = (a, b) => norm(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
  const sub = (a, b) => norm(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
  const mul = (a, b) => norm(a[0] * b[0], a[1] * b[1]);
  const div = (a, b) => { if (b[0] === 0) throw new Error('0으로 나눌 수 없어요'); return norm(a[0] * b[1], a[1] * b[0]); };
  function pow(a, b) {
    if (b[1] !== 1) throw new Error('지수는 정수여야 해요');
    const e = b[0];
    if (e < 0) throw new Error('지수는 0 이상이어야 해요');
    if (e > 40) throw new Error('지수가 너무 커요');
    if (e === 0) { if (a[0] === 0) throw new Error('0의 0제곱은 정할 수 없어요'); return [1, 1]; }
    let r = [1, 1];
    for (let i = 0; i < e; i++) r = mul(r, a);
    return r;
  }

  // 문자열을 토큰(숫자/연산자)으로
  function tokenize(s) {
    const out = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c >= '0' && c <= '9') {
        let j = i;
        while (j < s.length && s[j] >= '0' && s[j] <= '9') j++;
        const num = s.slice(i, j);
        if (num.length > 1 && num[0] === '0') throw new Error('여러 자리 수는 0으로 시작할 수 없어요');
        out.push({ k: 'n', v: [parseInt(num, 10), 1] });
        i = j;
      } else if ('+-*/^'.includes(c)) { out.push({ k: 'o', v: c }); i++; }
      else throw new Error('쓸 수 없는 문자: ' + c);
    }
    return out;
  }

  function evalTokens(t) {
    let i = 0;
    function primary() {
      const x = t[i];
      if (!x || x.k !== 'n') throw new Error('연산자 자리가 맞지 않아요');
      i++;
      return x.v;
    }
    function power() {
      const base = primary();
      if (t[i] && t[i].k === 'o' && t[i].v === '^') { i++; return pow(base, power()); }
      return base;
    }
    function term() {
      let v = power();
      while (t[i] && t[i].k === 'o' && (t[i].v === '*' || t[i].v === '/')) {
        const op = t[i++].v;
        const r = power();
        v = op === '*' ? mul(v, r) : div(v, r);
      }
      return v;
    }
    function expr() {
      let v = term();
      while (t[i] && t[i].k === 'o' && (t[i].v === '+' || t[i].v === '-')) {
        const op = t[i++].v;
        const r = term();
        v = op === '+' ? add(v, r) : sub(v, r);
      }
      return v;
    }
    if (!t.length) throw new Error('빈 식이에요');
    const v = expr();
    if (i !== t.length) throw new Error('연산자 자리가 맞지 않아요');
    return v;
  }

  function evalExpr(s) { return evalTokens(tokenize(s)); }

  // 등식 검사: {ok, msg}
  function checkEquation(s) {
    const parts = s.split('=');
    if (parts.length !== 2) return { ok: false, msg: '= 는 정확히 한 개 있어야 해요' };
    if (!parts[0] || !parts[1]) return { ok: false, msg: '= 양쪽에 식이 있어야 해요' };
    try {
      const a = evalExpr(parts[0]);
      const b = evalExpr(parts[1]);
      if (a[0] !== b[0] || a[1] !== b[1]) return { ok: false, msg: '양쪽 값이 같지 않아요' };
      return { ok: true };
    } catch (e) { return { ok: false, msg: e.message }; }
  }

  const SHOW = { '*': '×', '/': '÷', '-': '−', '+': '+', '^': '^', '=': '=' };
  function show(s) { return String(s).split('').map((c) => SHOW[c] || c).join(''); }
  function fracStr(v) { return v[1] === 1 ? String(v[0]) : v[0] + '/' + v[1]; }

  App.eq = { tokenize, evalTokens, evalExpr, checkEquation, show, fracStr, SHOW };
})();
