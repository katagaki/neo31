'use strict';
/* Minesweeper — the whole board is blitted from pixel-art sprites */
(() => {
  const S = 16;
  const sprite = (w, hh, fn) => { const g = new PixGrid(w, hh); fn(g); return g.canvas(); };
  const raised = g => { g.f(0, 0, S, S, 'S'); g.f(0, 0, S - 1, 2, 'W'); g.f(0, 0, 2, S - 1, 'W'); g.f(1, S - 2, S - 1, 2, 'G'); g.f(S - 2, 1, 2, S - 1, 'G'); g.p(S - 1, 0, 'G'); g.p(0, S - 1, 'G'); };
  const flat = g => { g.f(0, 0, S, S, 'S'); g.l(0, 0, S - 1, 0, 'G'); g.l(0, 0, 0, S - 1, 'G'); };
  const MINE = ['.......K.......', '.......K.......', '...K.KKKKK.K...', '....KKKKKKK....', '...KKWWKKKKK...', '...KKWWKKKKK...', '.KKKKKKKKKKKKK.', '...KKKKKKKKK...', '...KKKKKKKKK...', '....KKKKKKK....', '...K.KKKKK.K...', '.......K.......', '.......K.......'];
  const FLAG = ['.....RR..', '...RRRR..', '..RRRRR..', '...RRRR..', '.....RR..', '......K..', '......K..', '....KKKK.', '..KKKKKKKK'];
  const NUMC = ['', 'B', 'g', 'R', 'N', 'r', 'c', 'K', 'G'];
  const SPR = {};
  const sprites = () => {
    if (SPR.closed) return SPR;
    SPR.closed = sprite(S, S, raised);
    SPR.open = [];
    for (let n = 0; n <= 8; n++) SPR.open[n] = sprite(S, S, g => { flat(g); if (n) g.t(4, 2, String(n), NUMC[n], 2); });
    SPR.mine = sprite(S, S, g => { flat(g); g.m(1, 1, MINE); });
    SPR.boom = sprite(S, S, g => { g.f(0, 0, S, S, 'R'); g.l(0, 0, S - 1, 0, 'G'); g.l(0, 0, 0, S - 1, 'G'); g.m(1, 1, MINE); });
    SPR.wrong = sprite(S, S, g => { flat(g); g.m(1, 1, MINE); for (let d = 0; d < 2; d++) { g.l(2 + d, 2, 13 + d, 13, 'R'); g.l(13 + d, 2, 2 + d, 13, 'R'); } });
    SPR.flag = sprite(S, S, g => { raised(g); g.m(3, 3, FLAG); });
    SPR.q = sprite(S, S, g => { raised(g); g.t(4, 2, '?', 'K', 2); });
    SPR.qOpen = sprite(S, S, g => { flat(g); g.t(4, 2, '?', 'K', 2); });
    // 7-segment digits 13x23
    // tapered segments: [x, y, length, horizontal]
    const SEG = { a: [2, 1, 9, 1], g: [2, 10, 9, 1], d: [2, 19, 9, 1], f: [1, 2, 8, 0], b: [10, 2, 8, 0], e: [1, 11, 8, 0], c: [10, 11, 8, 0] };
    const ON = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' };
    const seg = (g, [x, y, len, hz], on) => {
      for (let t = 0; t < 3; t++) {
        const inset = t === 1 ? 0 : 1;
        for (let k = inset; k < len - inset; k++) {
          const px = hz ? x + k : x + t, py = hz ? y + t : y + k;
          if (on) g.p(px, py, 'R'); else if ((px + py) % 2 === 0) g.p(px, py, 'r');
        }
      }
    };
    SPR.seg = {};
    for (const ch in ON) SPR.seg[ch] = sprite(13, 23, g => {
      g.f(0, 0, 13, 23, 'K');
      for (const [k, def] of Object.entries(SEG)) seg(g, def, ON[ch].includes(k));
    });
    // faces 26x26
    const face = mouth => sprite(26, 26, g => {
      g.f(0, 0, 26, 26, 'S'); g.o(0, 0, 26, 26, 'G'); g.l(1, 1, 23, 1, 'W'); g.l(1, 1, 1, 23, 'W'); g.l(2, 24, 24, 24, 'G'); g.l(24, 2, 24, 24, 'G');
      g.disc(12.5, 12.5, 8.5, 'Y'); g.ring(12.5, 12.5, 8.5, 'K');
      mouth(g);
    });
    SPR.smile = face(g => { g.f(9, 9, 2, 2, 'K'); g.f(15, 9, 2, 2, 'K'); g.p(8, 15, 'K'); g.l(9, 16, 16, 16, 'K'); g.p(17, 15, 'K'); });
    SPR.ooh = face(g => { g.f(9, 8, 2, 3, 'K'); g.f(15, 8, 2, 3, 'K'); g.o(11, 14, 4, 4, 'K'); });
    SPR.dead = face(g => { for (const x of [8, 14]) { g.l(x, 8, x + 3, 11, 'K'); g.l(x + 3, 8, x, 11, 'K'); } g.p(8, 17, 'K'); g.l(9, 16, 16, 16, 'K'); g.p(17, 17, 'K'); });
    SPR.cool = face(g => { g.l(5, 9, 20, 9, 'K'); g.f(7, 9, 5, 3, 'K'); g.f(14, 9, 5, 3, 'K'); g.p(8, 15, 'K'); g.l(9, 16, 16, 16, 'K'); g.p(17, 15, 'K'); });
    return SPR;
  };

  const LEVELS = { beginner: [8, 8, 10], intermediate: [16, 16, 40], expert: [30, 16, 99] };

  Sys.registerApp('winmine', {
    name: 'Minesweeper', icon: 'winmine', help: 'winmine',
    run() {
      const sp = sprites();
      const opt = Object.assign({ level: 'beginner', custom: [9, 9, 10], marks: true }, Store.get('mine.opts', {}));
      let W, H, M, grid, state, flags, time, timer, faceState = 'smile', pressed = null;
      const cv = h('canvas', { style: { imageRendering: 'pixelated', position: 'absolute' } });
      const ctx = cv.getContext('2d');
      const PAD = 12, TOPH = 44;

      const dims = () => opt.level === 'custom' ? opt.custom : LEVELS[opt.level];
      const newGame = () => {
        [W, H, M] = dims();
        grid = Array.from({ length: W * H }, () => ({ mine: false, open: false, mark: 0, n: 0 }));
        state = 'ready'; flags = 0; time = 0; faceState = 'smile';
        clearInterval(timer); timer = null;
        cv.width = W * S + PAD * 2 + 6; cv.height = H * S + TOPH + PAD + 12;
        cv.style.width = cv.width + 'px'; cv.style.height = cv.height + 'px';
        w.sizeToClient(cv.width, cv.height);
        draw();
      };
      const placeMines = (safe) => {
        let n = 0;
        while (n < M) {
          const i = Math.floor(Math.random() * W * H);
          if (grid[i].mine || i === safe) continue;
          grid[i].mine = true; n++;
        }
        for (let i = 0; i < W * H; i++) grid[i].n = nbrs(i).filter(j => grid[j].mine).length;
      };
      const nbrs = i => { const x = i % W, y = Math.floor(i / W), out = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H) out.push(ny * W + nx); } return out; };
      const start = () => { if (state === 'ready') { state = 'play'; time = 1; timer = setInterval(() => { if (time < 999) time++; draw(); }, 1000); } };

      const reveal = i => {
        const c = grid[i];
        if (c.open || c.mark === 1) return;
        if (state === 'ready') { placeMines(i); start(); }
        c.open = true;
        if (c.mine) { c.boom = true; lose(); return; }
        if (c.n === 0) { const stack = [i]; while (stack.length) { const k = stack.pop(); for (const j of nbrs(k)) { const d = grid[j]; if (!d.open && !d.mine && d.mark !== 1) { d.open = true; if (d.n === 0) stack.push(j); } } } }
        checkWin();
      };
      const chord = i => {
        const c = grid[i];
        if (!c.open || !c.n) return;
        const ns = nbrs(i);
        if (ns.filter(j => grid[j].mark === 1).length !== c.n) return;
        ns.forEach(j => { if (state === 'play') reveal(j); });
      };
      const lose = () => {
        state = 'lost'; faceState = 'dead'; clearInterval(timer);
        grid.forEach(c => { if (c.mine && c.mark !== 1) c.open = true; if (!c.mine && c.mark === 1) c.wrong = true; });
      };
      const checkWin = () => {
        if (state !== 'play') return;
        if (grid.every(c => c.mine || c.open)) {
          state = 'won'; faceState = 'cool'; clearInterval(timer);
          grid.forEach(c => { if (c.mine) c.mark = 1; }); flags = M;
          draw();
          if (opt.level !== 'custom') {
            const best = Store.get('mine.best', {});
            if (!best[opt.level] || time < best[opt.level].t) {
              setTimeout(() => dialog({ title: 'Minesweeper', w: 260, h: 110, owner: w, build(d) {
                d.add(h('div', { class: 'txt', style: { textAlign: 'center', width: '240px' }, text: `You have the fastest time\nfor ${opt.level} level.\nPlease enter your name.` }), 10, 8);
                const t = UI.text(Store.get('userName', 'Anonymous')); d.add(t, 50, 62, 160);
                d.add(UI.button('OK', { default: true, onClick: () => { best[opt.level] = { t: time, n: t.value || 'Anonymous' }; Store.set('mine.best', best); d.close(); bestDlg(); } }), 90, 88, 80, 22);
              } }), 100);
            }
          }
        }
      };

      /* ---- drawing ---- */
      const bevel = (x, y, w2, h2, depth, inset) => {
        const tl = inset ? '#808080' : '#ffffff', br = inset ? '#ffffff' : '#808080';
        for (let d = 0; d < depth; d++) {
          ctx.fillStyle = tl; ctx.fillRect(x + d, y + d, w2 - 2 * d, 1); ctx.fillRect(x + d, y + d, 1, h2 - 2 * d);
          ctx.fillStyle = br; ctx.fillRect(x + d, y + h2 - 1 - d, w2 - 2 * d, 1); ctx.fillRect(x + w2 - 1 - d, y + d, 1, h2 - 2 * d);
        }
      };
      const counter = (x, y, v) => {
        const s = v < 0 ? '-' + String(Math.min(99, -v)).padStart(2, '0') : String(Math.min(999, v)).padStart(3, '0');
        bevel(x - 1, y - 1, 41, 25, 1, true);
        [...s].forEach((ch, i) => ctx.drawImage(sp.seg[ch], x + i * 13, y));
      };
      const faceRect = () => ({ x: Math.floor(cv.width / 2 - 13), y: 15, w: 26, h: 26 });
      const draw = () => {
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#c0c0c0'; ctx.fillRect(0, 0, cv.width, cv.height);
        bevel(0, 0, cv.width, cv.height, 3, false);
        bevel(PAD - 3, 9, W * S + 6, TOPH - 6, 2, true);
        counter(PAD + 4, 16, M - flags);
        counter(cv.width - PAD - 43, 16, time);
        const fr = faceRect();
        const f = pressed === 'face' ? 'smile' : (pressed != null && state !== 'won' && state !== 'lost') ? 'ooh' : faceState;
        ctx.drawImage(sp[f], fr.x, fr.y);
        if (pressed === 'face') { ctx.fillStyle = '#808080'; ctx.fillRect(fr.x, fr.y, 26, 1); ctx.fillRect(fr.x, fr.y, 1, 26); }
        const gx = PAD, gy = TOPH + 6;
        bevel(gx - 3, gy - 3, W * S + 6, H * S + 6, 3, true);
        const press = typeof pressed === 'number' ? new Set(pressed >= 0 ? (pressed & 0x100000 ? [pressed & 0xfffff, ...nbrs(pressed & 0xfffff)] : [pressed]) : []) : new Set();
        grid.forEach((c, i) => {
          const x = gx + (i % W) * S, y = gy + Math.floor(i / W) * S;
          let s;
          if (c.wrong) s = sp.wrong;
          else if (c.open) s = c.mine ? (c.boom ? sp.boom : sp.mine) : sp.open[c.n];
          else if (c.mark === 1) s = sp.flag;
          else if (c.mark === 2) s = press.has(i) ? sp.qOpen : sp.q;
          else s = press.has(i) && state !== 'won' && state !== 'lost' ? sp.open[0] : sp.closed;
          ctx.drawImage(s, x, y);
        });
      };

      /* ---- input ---- */
      const cellAt = e => {
        const p = Sys.pointer(e, cv);
        const x = Math.floor((p.x - PAD) / S), y = Math.floor((p.y - TOPH - 6) / S);
        return x >= 0 && y >= 0 && x < W && y < H ? y * W + x : -1;
      };
      const inFace = e => { const p = Sys.pointer(e, cv), r = faceRect(); return p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h; };
      let buttons = 0;
      cv.addEventListener('contextmenu', e => e.preventDefault());
      cv.addEventListener('pointerdown', e => {
        e.preventDefault();
        cv.setPointerCapture(e.pointerId);
        buttons = e.buttons;
        if (inFace(e) && e.button === 0) { pressed = 'face'; draw(); return; }
        if (state === 'won' || state === 'lost') return;
        const i = cellAt(e);
        if (i < 0) return;
        if (e.button === 2 && !(e.buttons & 1)) {
          const c = grid[i];
          if (c.open) return;
          c.mark = c.mark === 0 ? 1 : c.mark === 1 ? (opt.marks ? 2 : 0) : 0;
          flags = grid.filter(x => x.mark === 1).length;
          draw(); return;
        }
        pressed = (e.buttons === 3 || e.button === 1) ? (i | 0x100000) : i;
        draw();
      });
      cv.addEventListener('pointermove', e => {
        if (pressed == null) return;
        if (pressed === 'face') return;
        const i = cellAt(e);
        pressed = i < 0 ? -1 : ((typeof pressed === 'number' && pressed & 0x100000) ? (i | 0x100000) : i);
        draw();
      });
      cv.addEventListener('pointerup', e => {
        if (pressed === 'face') { pressed = null; if (inFace(e)) newGame(); else draw(); return; }
        if (pressed == null) return;
        const p = pressed; pressed = null;
        if (p >= 0 && state !== 'won' && state !== 'lost') {
          if (p & 0x100000 || (buttons === 3)) chord(p & 0xfffff);
          else reveal(p);
        }
        buttons = 0;
        draw();
      });

      const bestDlg = () => dialog({
        title: 'Fastest Mine Sweepers', w: 300, h: 110, owner: w,
        build(d) {
          const best = Store.get('mine.best', {});
          ['beginner', 'intermediate', 'expert'].forEach((l, i) => {
            d.add(h('div', { class: 'txt', text: l[0].toUpperCase() + l.slice(1) + ':' }), 12, 12 + i * 22);
            d.add(h('div', { class: 'txt', text: `${best[l] ? best[l].t : 999} seconds` }), 110, 12 + i * 22);
            d.add(h('div', { class: 'txt', text: best[l] ? best[l].n : 'Anonymous' }), 200, 12 + i * 22);
          });
          d.add(UI.button('&Reset Scores', { onClick: () => { Store.set('mine.best', {}); d.close(); bestDlg(); } }), 40, 80, 100, 24);
          d.add(UI.button('OK', { default: true, onClick: () => d.close() }), 170, 80, 80, 24);
        }
      });
      const customDlg = () => dialog({
        title: 'Custom Field', w: 240, h: 100, owner: w,
        build(d) {
          const [cw, ch, cm] = opt.custom;
          const th = UI.text(String(ch)), tw = UI.text(String(cw)), tm = UI.text(String(cm));
          [['&Height:', th], ['&Width:', tw], ['&Mines:', tm]].forEach(([l, t], i) => { d.add(UI.label(l, t), 12, 12 + i * 28); d.add(t, 70, 8 + i * 28, 50); });
          d.add(UI.button('OK', { default: true, onClick: () => {
            const W2 = clamp(parseInt(tw.value) || 9, 8, 30), H2 = clamp(parseInt(th.value) || 9, 8, 24);
            opt.custom = [W2, H2, clamp(parseInt(tm.value) || 10, 10, (W2 - 1) * (H2 - 1))]; opt.level = 'custom';
            Store.set('mine.opts', opt); d.close(); newGame();
          } }), 150, 8, 80, 25);
          d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 150, 38, 80, 25);
        }
      });
      const setLevel = l => () => { opt.level = l; Store.set('mine.opts', opt); newGame(); };

      const w = new Win({
        title: 'Minesweeper', icon: 'winmine', resizable: false, maxBox: false, w: 200, h: 260, persist: 'winmine',
        onClosed: () => clearInterval(timer),
        onKey: (e, name) => { if (name === 'F2') { newGame(); return true; } return false; },
        menu: [
          { label: '&Game', items: [
            { label: '&New', key: 'F2', action: newGame }, '-',
            { label: '&Beginner', checked: () => opt.level === 'beginner', action: setLevel('beginner') },
            { label: '&Intermediate', checked: () => opt.level === 'intermediate', action: setLevel('intermediate') },
            { label: '&Expert', checked: () => opt.level === 'expert', action: setLevel('expert') },
            { label: '&Custom...', checked: () => opt.level === 'custom', action: customDlg }, '-',
            { label: '&Marks (?)', checked: () => opt.marks, action: () => { opt.marks = !opt.marks; Store.set('mine.opts', opt); } }, '-',
            { label: 'Best &Times...', action: bestDlg }, '-',
            { label: 'E&xit', action: () => w.close() }] },
          { label: '&Help', items: [{ label: '&Contents', key: 'F1', action: () => Sys.launch('WINHELP.EXE winmine') }, { label: '&Search for Help on...', action: () => Sys.launch('WINHELP.EXE winmine') }, { label: 'Using &Help', action: () => Sys.launch('WINHELP.EXE winhelp') }, '-', { label: '&About Minesweeper...', action: () => aboutBox('Minesweeper', 'winmine', w, 'by Robert Donner and Curt Johnson') }] }
        ]
      });
      w.body.style.background = 'var(--btn-face)';
      w.body.appendChild(cv);
      requestAnimationFrame(newGame);
      return w;
    }
  });
})();
