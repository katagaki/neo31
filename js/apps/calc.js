'use strict';
/* Calculator — Standard (immediate execution) and Scientific (precedence) views */
(() => {
  const PREC = { '|': 1, '^': 2, '&': 3, '<<': 4, '+': 5, '-': 5, '*': 6, '/': 6, mod: 6, 'pow': 7, 'root': 7 };

  Sys.registerApp('calc', {
    name: 'Calculator', icon: 'calc', help: 'calc',
    run() {
      let sci = Store.get('calc.sci', false);
      let cur = '0', fresh = true, stack = [], mem = 0, err = false, base = 10, angle = 'deg', inv = false, hyp = false, lastOp = null;
      const disp = h('div', { style: { position: 'absolute', background: '#fff', border: '1px solid #000', textAlign: 'right', padding: '2px 6px', font: '16px/20px "W31 System"', overflow: 'hidden', whiteSpace: 'nowrap' } });
      const memInd = h('div', { style: { position: 'absolute', border: '1px solid', borderColor: '#808080 #fff #fff #808080', textAlign: 'center', lineHeight: '22px' } });

      const fmt = v => {
        if (!isFinite(v)) { err = true; return 'Error'; }
        if (base !== 10) {
          let n = Math.trunc(v);
          if (n < 0) n = (n >>> 0);
          return n.toString(base).toUpperCase() + '.';
        }
        let s = Math.abs(v) >= 1e15 || (Math.abs(v) < 1e-12 && v !== 0) ? v.toExponential(10).replace(/\.?0+e/, 'e') : String(parseFloat(v.toPrecision(13)));
        if (!s.includes('.') && !s.includes('e')) s += '.';
        return s;
      };
      const val = () => base === 10 ? parseFloat(cur) || 0 : parseInt(cur.replace('.', ''), base) || 0;
      const show = v => { cur = fmt(v); render(); };
      const render = () => { disp.textContent = cur; memInd.textContent = mem ? 'M' : ''; };
      const apply = (a, op, b) => {
        switch (op) {
          case '+': return a + b; case '-': return a - b; case '*': return a * b;
          case '/': if (b === 0) { err = true; return NaN; } return a / b;
          case 'mod': return a % b; case 'pow': return Math.pow(a, b); case 'root': return Math.pow(a, 1 / b);
          case '&': return a & b; case '|': return a | b; case '^': return a ^ b; case '<<': return inv ? a >> b : a << b;
        }
        return b;
      };
      const pushOp = op => {
        if (err) return;
        let v = val();
        if (!fresh || !stack.length || stack[stack.length - 1].op === '(') {
          if (sci) { while (stack.length && stack[stack.length - 1].op !== '(' && PREC[stack[stack.length - 1].op] >= PREC[op]) { const t = stack.pop(); v = apply(t.v, t.op, v); } }
          else if (stack.length) { const t = stack.pop(); v = apply(t.v, t.op, v); }
          stack.push({ v, op });
        } else stack[stack.length - 1].op = op;   // operator changed
        show(v); fresh = true; inv = false; syncChecks();
      };
      const equals = () => {
        if (err) return;
        let v = val();
        if (!stack.length && lastOp) { v = apply(v, lastOp.op, lastOp.b); }
        else {
          if (stack.length) lastOp = { op: stack[stack.length - 1].op, b: v };
          while (stack.length) { const t = stack.pop(); if (t.op !== '(') v = apply(t.v, t.op, v); }
        }
        show(v); fresh = true;
      };
      let decimalMode = false;
      // digit entry with decimal handling
      const enter = d => {
        if (err) return;
        if (fresh) { cur = '0.'; fresh = false; decimalMode = false; }
        if (d === '.') { if (base !== 10) return; decimalMode = true; render(); return; }
        if (base === 10 && !/[0-9]/.test(d) || base === 8 && !/[0-7]/.test(d) || base === 2 && !/[01]/.test(d) || base === 16 && !/[0-9A-F]/.test(d)) { Snd.beep(); return; }
        let [ip, fp] = cur.split('.');
        if ((ip + fp).replace('-', '').length >= (base === 2 ? 32 : 13)) { Snd.beep(); return; }
        if (decimalMode && base === 10) fp += d;
        else ip = (ip === '0' ? '' : ip === '-0' ? '-' : ip) + d;
        cur = ip + '.' + fp;
        render();
      };
      const unary = fn => { if (err) return; const v = fn(val()); show(v); fresh = true; inv = false; hyp = false; syncChecks(); };
      const toRad = v => angle === 'deg' ? v * Math.PI / 180 : angle === 'grad' ? v * Math.PI / 200 : v;
      const fromRad = v => angle === 'deg' ? v * 180 / Math.PI : angle === 'grad' ? v * 200 / Math.PI : v;
      const fact = n => { if (n < 0 || n > 170 || n !== Math.floor(n)) { err = true; return NaN; } let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
      const clearAll = () => { cur = '0.'; fresh = true; stack = []; err = false; decimalMode = false; lastOp = null; render(); };
      const ce = () => { cur = '0.'; fresh = true; err = false; decimalMode = false; render(); };
      const back = () => {
        if (fresh || err) return;
        let [ip, fp] = cur.split('.');
        if (decimalMode && fp) fp = fp.slice(0, -1);
        else if (decimalMode) decimalMode = false;
        else ip = ip.length > 1 && ip !== '-' ? ip.slice(0, -1) : '0';
        if (ip === '-') ip = '0';
        cur = ip + '.' + fp; render();
      };
      const setBase = b => { const v = val(); base = b; fresh = true; decimalMode = false; show(Math.trunc(v)); };

      const BTN = (label, fn, color = 'N', key) => ({ label, fn, color, key });
      const std = [
        [BTN('C', clearAll, 'R'), BTN('CE', ce, 'R'), BTN('Back', back, 'R')],
        [BTN('MC', () => { mem = 0; render(); }, 'R'), BTN('7', () => enter('7'), 'B'), BTN('8', () => enter('8'), 'B'), BTN('9', () => enter('9'), 'B'), BTN('/', () => pushOp('/'), 'R'), BTN('sqrt', () => unary(Math.sqrt), 'N')],
        [BTN('MR', () => { show(mem); fresh = true; }, 'R'), BTN('4', () => enter('4'), 'B'), BTN('5', () => enter('5'), 'B'), BTN('6', () => enter('6'), 'B'), BTN('*', () => pushOp('*'), 'R'), BTN('%', () => { const b = stack.length ? stack[stack.length - 1].v : 0; show(b * val() / 100); }, 'N')],
        [BTN('MS', () => { mem = val(); fresh = true; render(); }, 'R'), BTN('1', () => enter('1'), 'B'), BTN('2', () => enter('2'), 'B'), BTN('3', () => enter('3'), 'B'), BTN('-', () => pushOp('-'), 'R'), BTN('1/x', () => unary(v => v === 0 ? (err = true, NaN) : 1 / v), 'N')],
        [BTN('M+', () => { mem += val(); fresh = true; render(); }, 'R'), BTN('0', () => enter('0'), 'B'), BTN('+/-', () => { if (fresh) unary(v => -v); else { cur = cur.startsWith('-') ? cur.slice(1) : '-' + cur; render(); } }, 'B'), BTN('.', () => enter('.'), 'B'), BTN('+', () => pushOp('+'), 'R'), BTN('=', equals, 'R')]
      ];
      const trig = (f, af, hf, ahf) => () => unary(v => hyp ? (inv ? ahf(v) : hf(v)) : inv ? fromRad(af(v)) : f(toRad(v)));
      const samples = [];
      const statistic = kind => {
        if (!samples.length || (kind === 'deviation' && !inv && samples.length < 2)) {
          msgBox('Add data with Dat first. Sample standard deviation needs at least two values.', 'Calculator', { owner: w }); return;
        }
        const total = samples.reduce((a, b) => a + (inv && kind === 'sum' ? b * b : b), 0);
        const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
        const result = kind === 'sum' ? total : kind === 'mean' ? (inv ? Math.sqrt(samples.reduce((a, b) => a + b * b, 0) / samples.length) : mean)
          : Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / (samples.length - (inv ? 0 : 1)));
        show(result); fresh = true;
      };
      const statsDialog = () => dialog({ title: 'Statistics', w: 310, h: 210, owner: w, build(d) {
        const lb = UI.listbox({ items: samples.map(String), sel: samples.length - 1 });
        d.add(UI.label('&Data:', lb), 10, 8); d.add(lb, 10, 28, 190, 165);
        d.add(UI.button('&Delete', { onClick: () => { if (lb.sel >= 0) { samples.splice(lb.sel, 1); lb.setItems(samples.map(String), Math.max(0, samples.length - 1)); } } }), 214, 8, 85, 25);
        d.add(UI.button('Delete &all', { onClick: () => { samples.length = 0; lb.setItems([]); } }), 214, 40, 85, 25);
        d.add(UI.button('&Add current', { onClick: () => { if (!err && Number.isFinite(val())) { samples.push(val()); lb.setItems(samples.map(String), samples.length - 1); fresh = true; } } }), 214, 72, 85, 25);
        d.add(UI.button('Close', { cancel: true, onClick: () => d.close() }), 214, 168, 85, 25);
      } });
      const sciBtns = [
        [BTN('Sta', statsDialog, 'N'), BTN('F-E', () => { cur = val().toExponential(); render(); }, 'm'), BTN('(', () => { stack.push({ op: '(' }); fresh = true; }, 'm'), BTN(')', () => { let v = val(); while (stack.length && stack[stack.length - 1].op !== '(') { const t = stack.pop(); v = apply(t.v, t.op, v); } stack.pop(); show(v); fresh = true; }, 'm')],
        [BTN('Ave', () => statistic('mean'), 'N'), BTN('dms', () => unary(v => inv ? Math.trunc(v) + (Math.trunc(v * 100) % 100) / 60 + ((v * 10000) % 100) / 3600 : Math.trunc(v) + Math.trunc((v % 1) * 60) / 100 + ((v * 3600) % 60) / 10000), 'm'), BTN('Exp', () => { cur = val() + 'e+0'; render(); }, 'm'), BTN('ln', () => unary(v => inv ? Math.exp(v) : Math.log(v)), 'm')],
        [BTN('Sum', () => statistic('sum'), 'N'), BTN('sin', trig(Math.sin, Math.asin, Math.sinh, Math.asinh), 'm'), BTN('x^y', () => pushOp(inv ? 'root' : 'pow'), 'm'), BTN('log', () => unary(v => inv ? Math.pow(10, v) : Math.log10(v)), 'm')],
        [BTN('s', () => statistic('deviation'), 'N'), BTN('cos', trig(Math.cos, Math.acos, Math.cosh, Math.acosh), 'm'), BTN('x^3', () => unary(v => inv ? Math.cbrt(v) : v * v * v), 'm'), BTN('n!', () => unary(fact), 'm')],
        [BTN('Dat', () => { if (!err && Number.isFinite(val())) { samples.push(val()); fresh = true; } }, 'N'), BTN('tan', trig(Math.tan, Math.atan, Math.tanh, Math.atanh), 'm'), BTN('x^2', () => unary(v => inv ? Math.sqrt(v) : v * v), 'm'), BTN('1/x', () => unary(v => 1 / v), 'm')]
      ];
      const sciRight = [
        [BTN('Mod', () => pushOp('mod'), 'R'), BTN('And', () => pushOp('&'), 'R'), BTN('Or', () => pushOp('|'), 'R'), BTN('Xor', () => pushOp('^'), 'R')],
        [BTN('Lsh', () => pushOp('<<'), 'R'), BTN('Not', () => unary(v => ~Math.trunc(v)), 'R'), BTN('Int', () => unary(v => inv ? v % 1 : Math.trunc(v)), 'R'), BTN('PI', () => { show(inv ? 2 * Math.PI : Math.PI); fresh = true; }, 'B')],
        ['A', 'B', 'C', 'D', 'E', 'F'].map(c => BTN(c, () => enter(c), 'B'))
      ];

      const COLORS = { R: '#ff0000', B: '#0000ff', N: '#000080', m: '#800080' };
      const mkBtn = (b, x, y, wd, ht) => {
        const el = UI.button(b.label, { onClick: () => { b.fn(); w.focus(); } });
        el.style.color = COLORS[b.color]; el.style.padding = '0'; el.style.minHeight = '0'; el.tabIndex = 0;
        return UI.place(el, x, y, wd, ht);
      };
      const area = h('div', { class: 'fill', style: { background: 'var(--btn-face)' } });
      let inv_cb, hyp_cb, syncChecks = () => { if (inv_cb) inv_cb.input.checked = inv; if (hyp_cb) hyp_cb.input.checked = hyp; };

      const build = () => {
        area.innerHTML = '';
        if (!sci) {
          if (base !== 10) setBase(10);
          UI.place(disp, 10, 8, 232, 26); area.appendChild(disp);
          UI.place(memInd, 10, 42, 34, 26); area.appendChild(memInd);
          std[0].forEach((b, i) => area.appendChild(mkBtn(b, 58 + i * 62, 42, 56, 26)));
          for (let r = 1; r < 5; r++) std[r].forEach((b, c) => area.appendChild(mkBtn(b, 10 + c * 39 + (c > 0 ? 8 : 0), 42 + r * 32, 34, 27)));
          w.sizeToClient(252, 202);
        } else {
          UI.place(disp, 10, 8, 440, 26); area.appendChild(disp);
          const bg = h('div', { style: { position: 'absolute', left: '10px', top: '40px', width: '210px', height: '26px', border: '1px solid #808080', display: 'flex', gap: '6px', alignItems: 'center', padding: '0 4px' } });
          [['&Hex', 16], ['&Dec', 10], ['&Oct', 8], ['&Bin', 2]].forEach(([l, b]) => bg.appendChild(UI.radio('cb', l, base === b, () => setBase(b))));
          area.appendChild(bg);
          const ag = h('div', { style: { position: 'absolute', left: '226px', top: '40px', width: '224px', height: '26px', border: '1px solid #808080', display: 'flex', gap: '6px', alignItems: 'center', padding: '0 4px' } });
          [['De&g', 'deg'], ['&Rad', 'rad'], ['&Grad', 'grad']].forEach(([l, a]) => ag.appendChild(UI.radio('ca', l, angle === a, () => { angle = a; })));
          area.appendChild(ag);
          inv_cb = UI.check('&Inv', inv, v => inv = v); hyp_cb = UI.check('H&yp', hyp, v => hyp = v);
          UI.place(inv_cb, 12, 76); UI.place(hyp_cb, 62, 76); area.append(inv_cb, hyp_cb);
          ['C', 'CE', 'Back'].forEach((l, i) => area.appendChild(mkBtn(std[0][i], 300 + i * 52, 72, 48, 24)));
          UI.place(memInd, 120, 72, 30, 24); area.appendChild(memInd);
          sciBtns.forEach((row, r) => row.forEach((b, c) => area.appendChild(mkBtn(b, 10 + c * 38 + (c > 0 ? 6 : 0), 104 + r * 30, 34, 26))));
          const nums = [[std[1][0], std[1][1], std[1][2], std[1][3], std[1][4]], [std[2][0], std[2][1], std[2][2], std[2][3], std[2][4]], [std[3][0], std[3][1], std[3][2], std[3][3], std[3][4]], [std[4][0], std[4][1], std[4][2], std[4][3], std[4][4]]];
          nums.forEach((row, r) => row.forEach((b, c) => area.appendChild(mkBtn(b, 168 + c * 36 + (c > 0 ? 6 : 0), 104 + r * 30, 32, 26))));
          area.appendChild(mkBtn(std[4][5], 168 + 5 * 36 + 6, 104 + 3 * 30, 32, 26));
          sciRight.slice(0, 2).forEach((row, r) => row.forEach((b, c) => area.appendChild(mkBtn(b, 358 + (c % 2) * 46, 104 + r * 60 + Math.floor(c / 2) * 30, 42, 26))));
          sciRight[2].forEach((b, c) => area.appendChild(mkBtn(b, 168 + c * 36 + (c > 0 ? 6 : 0) - 6 + 6, 228, 32, 22)));
          w.sizeToClient(460, 258);
        }
        render();
      };

      const w = new Win({
        title: 'Calculator', icon: 'calc', resizable: false, maxBox: false, w: 270, h: 260, persist: 'calc',
        menu: [
          { label: '&Edit', items: [
            { label: '&Copy', key: 'Ctrl+C', action: () => Sys.setClipboard({ type: 'text', data: cur.replace(/\.$/, '') }) },
            { label: '&Paste', key: 'Ctrl+V', action: () => { const t = Sys.clipboard?.type === 'text' ? Sys.clipboard.data : ''; for (const ch of t) handleChar(ch); } }] },
          { label: '&View', items: [
            { label: '&Scientific', checked: () => sci, action: () => { sci = true; Store.set('calc.sci', true); build(); } },
            { label: 'S&tandard', checked: () => !sci, action: () => { sci = false; Store.set('calc.sci', false); build(); } }] },
          { label: '&Help', items: [{ label: '&Contents', action: () => Sys.launch('WINHELP.EXE calc') }, { label: '&Search for Help on...', action: () => Sys.launch('WINHELP.EXE calc') }, { label: '&How to Use Help', action: () => Sys.launch('WINHELP.EXE winhelp') }, '-', { label: '&About Calculator...', action: () => aboutBox('Calculator', 'calc', w) }] }
        ],
        onKey: (e, name) => {
          if (e.target?.nodeName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return false;
          if (e.ctrlKey || e.altKey) {
            if (name === 'Ctrl+M') { mem = val(); fresh = true; render(); return true; }
            if (name === 'Ctrl+R') { show(mem); fresh = true; return true; }
            if (name === 'Ctrl+P') { mem += val(); fresh = true; render(); return true; }
            if (name === 'Ctrl+L') { mem = 0; render(); return true; }
            return false;
          }
          if (e.key === 'Enter' || e.key === '=') { equals(); return true; }
          if (e.key === 'Escape') { clearAll(); return true; }
          if (e.key === 'Delete') { ce(); return true; }
          if (e.key === 'Backspace') { back(); return true; }
          if (e.key === 'F9') { std[4][2].fn(); return true; }
          return e.key.length === 1 ? handleChar(e.key) : false;
        }
      });
      const handleChar = ch => {
        const u = ch.toUpperCase();
        if (/[0-9]/.test(ch) || (base === 16 && /[A-F]/.test(u) && ch.length === 1)) { enter(u); return true; }
        if (ch === '.' || ch === ',') { enter('.'); return true; }
        if ('+-*/'.includes(ch)) { pushOp(ch); return true; }
        if (ch === '%') { std[2][5].fn(); return true; }
        if (ch === 'r' || ch === 'R') { std[3][5].fn(); return true; }
        if (ch === '@') { std[1][5].fn(); return true; }
        if (ch === '(' && sci) { sciBtns[0][2].fn(); return true; }
        if (ch === ')' && sci) { sciBtns[0][3].fn(); return true; }
        if (ch === '^' && sci) { pushOp('pow'); return true; }
        if (ch === '!' && sci) { unary(fact); return true; }
        return false;
      };
      w.body.appendChild(area);
      w.el.tabIndex = 0;
      clearAll();
      requestAnimationFrame(build);
      return w;
    }
  });
})();
