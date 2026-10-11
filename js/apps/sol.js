'use strict';
/* Solitaire (Klondike) with pixel-art cards */
const Cards = (() => {
  const CW = 71, CH = 96;
  const PIPS = {
    H: ['.KK.KK.', 'KKKKKKK', 'KKKKKKK', 'KKKKKKK', '.KKKKK.', '..KKK..', '...K...'],
    D: ['...K...', '..KKK..', '.KKKKK.', 'KKKKKKK', '.KKKKK.', '..KKK..', '...K...'],
    S: ['...K...', '..KKK..', '.KKKKK.', 'KKKKKKK', 'KKKKKKK', '.K.K.K.', '..KKK..'],
    C: ['..KKK..', '..KKK..', 'KK.K.KK', 'KKKKKKK', 'KK.K.KK', '...K...', '..KKK..']
  };
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const red = s => s === 'H' || s === 'D';
  const cache = {};

  const frame = (g, fill) => {
    g.f(1, 0, CW - 2, CH, fill); g.f(0, 1, CW, CH - 2, fill);
    g.l(2, 0, CW - 3, 0, 'K'); g.l(2, CH - 1, CW - 3, CH - 1, 'K'); g.l(0, 2, 0, CH - 3, 'K'); g.l(CW - 1, 2, CW - 1, CH - 3, 'K');
    g.p(1, 1, 'K'); g.p(CW - 2, 1, 'K'); g.p(1, CH - 2, 'K'); g.p(CW - 2, CH - 2, 'K');
    g.p(0, 0, null); g.p(CW - 1, 0, null); g.p(0, CH - 1, null); g.p(CW - 1, CH - 1, null);
    g.p(1, 0, null); g.p(0, 1, null); g.p(CW - 2, 0, null); g.p(CW - 1, 1, null); g.p(0, CH - 2, null); g.p(1, CH - 1, null); g.p(CW - 1, CH - 2, null); g.p(CW - 2, CH - 1, null);
  };
  const pip = (g, s, x, y, scale = 1, flip = false) => {
    const rows = flip ? PIPS[s].slice().reverse() : PIPS[s];
    const c = red(s) ? 'R' : 'K';
    rows.forEach((r, j) => [...r].forEach((k, i) => { if (k === 'K') g.f(x + i * scale, y + j * scale, scale, scale, c); }));
  };
  const LAYOUT = {
    2: [[.5, .12], [.5, .88]], 3: [[.5, .12], [.5, .5], [.5, .88]], 4: [[.25, .12], [.75, .12], [.25, .88], [.75, .88]],
    5: [[.25, .12], [.75, .12], [.5, .5], [.25, .88], [.75, .88]], 6: [[.25, .12], [.75, .12], [.25, .5], [.75, .5], [.25, .88], [.75, .88]],
    7: [[.25, .12], [.75, .12], [.5, .31], [.25, .5], [.75, .5], [.25, .88], [.75, .88]],
    8: [[.25, .12], [.75, .12], [.5, .31], [.25, .5], [.75, .5], [.5, .69], [.25, .88], [.75, .88]],
    9: [[.25, .12], [.75, .12], [.25, .37], [.75, .37], [.5, .5], [.25, .63], [.75, .63], [.25, .88], [.75, .88]],
    10: [[.25, .12], [.75, .12], [.5, .25], [.25, .37], [.75, .37], [.25, .63], [.75, .63], [.5, .75], [.25, .88], [.75, .88]]
  };
  function face(rank, suit) {
    const k = rank + suit;
    if (cache[k]) return cache[k];
    const g = new PixGrid(CW, CH);
    frame(g, 'W');
    const col = red(suit) ? 'R' : 'K';
    const r = RANKS[rank - 1];
    g.t(3, 4, r, col); pip(g, suit, 3, 12);
    // bottom-right corner, rotated 180
    const tmp = new PixGrid(14, 20); tmp.t(0, 0, r, col); pip(tmp, suit, 0, 8);
    for (let y = 0; y < 20; y++) for (let x = 0; x < 14; x++) { const c = tmp.get(x, y); if (c) g.p(CW - 4 - x, CH - 5 - y, c); }
    if (rank === 1) pip(g, suit, 21, 34, 4);
    else if (rank <= 10) {
      const ax = 15, aw = CW - 30, ay = 6, ah = CH - 26;
      LAYOUT[rank].forEach(([fx, fy]) => pip(g, suit, Math.round(ax + fx * aw - 7 + 7) - 7 + 0, Math.round(ay + fy * ah), 2, fy > .55));
    } else {
      // court card: framed panel with a big letter and pips, in the classic red/blue/yellow palette
      g.o(12, 9, CW - 24, CH - 18, 'K');
      for (let y = 10; y < CH - 10; y++) for (let x = 13; x < CW - 12; x++) if ((x + y) % 2 === 0) g.p(x, y, 'Y');
      g.f(17, 14, CW - 34, CH - 28, 'W'); g.o(17, 14, CW - 34, CH - 28, red(suit) ? 'B' : 'R');
      g.t(Math.round(CW / 2 - g.textW(r, 3) / 2), 22, r, col, 3);
      pip(g, suit, Math.round(CW / 2) - 7, 48, 2);
      g.f(19, 66, CW - 38, 3, red(suit) ? 'B' : 'R'); g.f(19, 71, CW - 38, 2, 'Y');
      pip(g, suit, 14, CH - 20, 1);
    }
    return (cache[k] = g.canvas().toDataURL());
  }
  const BACKS = {
    'Crosshatch': g => { for (let y = 4; y < CH - 4; y++) for (let x = 4; x < CW - 4; x++) g.p(x, y, (x + y) % 4 === 0 || (x - y + 400) % 4 === 0 ? 'C' : 'B'); },
    'Weave': g => { for (let y = 4; y < CH - 4; y++) for (let x = 4; x < CW - 4; x++) { const a = Math.floor(x / 4) % 2, b = Math.floor(y / 4) % 2; g.p(x, y, a ^ b ? ((x % 4 === 0) ? 'r' : 'R') : ((y % 4 === 0) ? 'r' : 'R')); } },
    'Dots': g => { g.f(4, 4, CW - 8, CH - 8, 'g'); for (let y = 6; y < CH - 5; y += 4) for (let x = 6 + (y % 8 ? 2 : 0); x < CW - 5; x += 4) g.p(x, y, 'L'); },
    'Flag': g => { g.f(4, 4, CW - 8, CH - 8, 'N'); const f = flagGrid(48, 42); for (let y = 0; y < 42; y++) for (let x = 0; x < 48; x++) { const c = f.get(x, y); if (c && c !== 'K') g.p(12 + x, 27 + y, c); } },
    'Bricks': g => { g.f(4, 4, CW - 8, CH - 8, 'S'); for (let y = 4; y < CH - 4; y++) for (let x = 4; x < CW - 4; x++) if (y % 6 === 4 || (x + (Math.floor((y - 4) / 6) % 2) * 5) % 10 === 4) g.p(x, y, 'r'); },
    'Fish': g => { g.f(4, 4, CW - 8, CH - 8, 'c'); for (let j = 0; j < 6; j++) for (let i = 0; i < 3; i++) g.m(8 + i * 20 + (j % 2) * 8, 8 + j * 14, ['..YYY...Y', '.YYYYY.YY', 'YKYYYYYYY', '.YYYYY.YY', '..YYY...Y']); }
  };
  function back(name) {
    const k = 'back:' + name;
    if (cache[k]) return cache[k];
    const g = new PixGrid(CW, CH);
    frame(g, 'W');
    (BACKS[name] || BACKS.Crosshatch)(g);
    g.o(3, 3, CW - 6, CH - 6, 'K');
    return (cache[k] = g.canvas().toDataURL());
  }
  return { CW, CH, face, back, BACKS, red, RANKS };
})();

(() => {
  Sys.registerApp('sol', {
    name: 'Solitaire', icon: 'sol', help: 'sol',
    run() {
      const CW = Cards.CW, CH = Cards.CH, GAP = 10, TOP = 8, FD = 3, FU = 14;
      const opt = Object.assign({ draw: 1, scoring: 'standard', timed: true, status: true, outline: false, back: 'Crosshatch' }, Store.get('sol.opts', {}));
      let piles, score, time, timerId, history, won, vegasPass;
      const board = h('div', { class: 'fill', style: { background: '#008000', overflow: 'hidden', bottom: '21px' } });
      const status = h('div', { class: 'status', style: { position: 'absolute', left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' } });
      const stScore = h('div', { style: { minWidth: '90px' } }), stTime = h('div', { style: { minWidth: '80px' } });
      status.append(stScore, stTime);

      const x0 = i => GAP + i * (CW + GAP);
      const newGame = () => {
        const deck = [];
        for (const s of 'CDHS') for (let r = 1; r <= 13; r++) deck.push({ r, s, up: false });
        for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
        piles = { stock: [], waste: [], f: [[], [], [], []], t: [[], [], [], [], [], [], []] };
        for (let i = 0; i < 7; i++) for (let j = i; j < 7; j++) piles.t[j].push(deck.pop());
        piles.t.forEach(p => p[p.length - 1].up = true);
        piles.stock = deck;
        score = opt.scoring === 'vegas' ? (Store.get('sol.vegas', 0) - 52) : 0;
        if (opt.scoring === 'vegas') Store.set('sol.vegas', score);
        time = 0; history = []; won = false; vegasPass = 0;
        clearInterval(timerId); timerId = null;
        if (anim) { anim.stop(); anim = null; }
        render();
      };
      const addScore = n => { if (opt.scoring === 'none') return; score += n; if (opt.scoring === 'vegas') Store.set('sol.vegas', score); else score = Math.max(0, score); };
      const startTimer = () => {
        if (timerId || !opt.timed || won) return;
        timerId = setInterval(() => { time++; if (opt.scoring === 'standard' && time % 10 === 0) addScore(-2); renderStatus(); }, 1000);
      };
      const snap = () => { history = [JSON.stringify({ piles, score, vegasPass })]; };
      const undo = () => { if (!history.length) return; const s = JSON.parse(history.pop()); piles = s.piles; score = s.score; vegasPass = s.vegasPass; render(); };

      const renderStatus = () => {
        status.style.display = opt.status ? '' : 'none';
        stScore.textContent = opt.scoring === 'none' ? '' : `Score: ${opt.scoring === 'vegas' ? (score < 0 ? '-$' : '$') + Math.abs(score) : score}`;
        stTime.textContent = opt.timed ? `Time: ${time}` : '';
      };

      /* ---- rendering ---- */
      const cardEl = (c, x, y, z) => {
        const el = h('div', { style: { position: 'absolute', left: x + 'px', top: y + 'px', width: CW + 'px', height: CH + 'px', zIndex: z, backgroundImage: `url(${c.up ? Cards.face(c.r, c.s) : Cards.back(opt.back)})`, imageRendering: 'pixelated' } });
        board.appendChild(el);
        return el;
      };
      const slot = (x, y, kind) => {
        const el = h('div', { style: { position: 'absolute', left: x + 'px', top: y + 'px', width: CW + 'px', height: CH + 'px', border: '1px solid #000', zIndex: 0 } });
        if (kind === 'stock') {
          const g = new PixGrid(CW - 2, CH - 2);
          // green "recycle" circle (O) or red X, drawn as pixels
          if (vegasPass >= (opt.draw === 3 ? 3 : 1) && opt.scoring === 'vegas') { g.l(20, 30, 48, 62, 'R'); g.l(21, 30, 49, 62, 'R'); g.l(48, 30, 20, 62, 'R'); g.l(49, 30, 21, 62, 'R'); }
          else { g.ring(34, 46, 14, 'L'); g.ring(34, 46, 13, 'L'); }
          el.style.backgroundImage = `url(${g.canvas().toDataURL()})`;
        }
        board.appendChild(el);
        return el;
      };
      let pileRects = [];
      const render = () => {
        board.innerHTML = '';
        pileRects = [];
        renderStatus();
        // stock
        const sx = x0(0);
        const ss = slot(sx, TOP, 'stock');
        ss.addEventListener('pointerdown', () => clickStock());
        if (piles.stock.length) { const el = cardEl(piles.stock[piles.stock.length - 1], sx, TOP, 1); el.addEventListener('pointerdown', () => clickStock()); }
        // waste: show up to 3 fanned when draw-3
        const wx = x0(1);
        const wshow = opt.draw === 3 ? piles.waste.slice(-3) : piles.waste.slice(-2);
        if (!piles.waste.length) slot(wx, TOP);
        wshow.forEach((c, i) => {
          const off = opt.draw === 3 ? i * 12 : 0;
          const el = cardEl(c, wx + off, TOP, 10 + i);
          if (i === wshow.length - 1) bindDrag(el, 'waste', piles.waste.length - 1);
        });
        pileRects.push({ kind: 'waste', x: wx, y: TOP });
        // foundations
        for (let i = 0; i < 4; i++) {
          const fx = x0(3 + i), p = piles.f[i];
          slot(fx, TOP);
          if (p.length > 1) cardEl(p[p.length - 2], fx, TOP, 1);
          if (p.length) bindDrag(cardEl(p[p.length - 1], fx, TOP, 2), 'f' + i, p.length - 1);
          pileRects.push({ kind: 'f', i, x: fx, y: TOP, h: CH });
        }
        // tableau
        const ty = TOP + CH + 12;
        for (let i = 0; i < 7; i++) {
          const tx = x0(i), p = piles.t[i];
          const s = slot(tx, ty);
          s.style.border = '1px solid transparent';
          let y = ty;
          p.forEach((c, j) => {
            const el = cardEl(c, tx, y, 10 + j);
            if (c.up) bindDrag(el, 't' + i, j);
            else if (j === p.length - 1) el.addEventListener('pointerdown', () => { snap(); c.up = true; addScore(5); startTimer(); render(); });
            y += c.up ? FU : FD;
          });
          pileRects.push({ kind: 't', i, x: tx, y: ty, h: Math.max(CH, y - ty - (p.length ? (p[p.length - 1].up ? FU : FD) : 0) + CH) });
        }
        if (!won && piles.f.every(f => f.length === 13)) win();
      };

      const clickStock = () => {
        startTimer();
        snap();
        if (piles.stock.length) {
          for (let k = 0; k < opt.draw && piles.stock.length; k++) { const c = piles.stock.pop(); c.up = true; piles.waste.push(c); }
        } else {
          if (opt.scoring === 'vegas' && vegasPass >= (opt.draw === 3 ? 3 : 1)) { history.pop(); return; }
          piles.stock = piles.waste.reverse().map(c => ({ ...c, up: false })); piles.waste = [];
          vegasPass++;
          if (opt.scoring === 'standard') addScore(opt.draw === 1 ? -100 : -20);
        }
        render();
      };

      const canFound = (c, f) => f.length ? f[f.length - 1].s === c.s && f[f.length - 1].r === c.r - 1 : c.r === 1;
      const canTab = (c, t) => t.length ? (t[t.length - 1].up && Cards.red(t[t.length - 1].s) !== Cards.red(c.s) && t[t.length - 1].r === c.r + 1) : c.r === 13;
      const pileOf = id => id === 'waste' ? piles.waste : id[0] === 'f' ? piles.f[+id[1]] : piles.t[+id[1]];
      const afterMove = (from, to) => {
        if (to[0] === 'f' && from[0] !== 'f') addScore(opt.scoring === 'vegas' ? 5 : 10);
        if (from === 'waste' && to[0] === 't') addScore(5);
        if (from[0] === 'f' && to[0] === 't') addScore(opt.scoring === 'vegas' ? -5 : -15);
        const fp = pileOf(from);
        if (from[0] === 't' && fp.length && !fp[fp.length - 1].up && opt.autoFlip) { fp[fp.length - 1].up = true; addScore(5); }
      };
      const autoFound = (id, j) => {
        const p = pileOf(id), c = p[j];
        if (j !== p.length - 1) return false;
        for (let i = 0; i < 4; i++) if (canFound(c, piles.f[i])) { snap(); piles.f[i].push(p.pop()); afterMove(id, 'f' + i); render(); return true; }
        return false;
      };

      /* ---- drag & drop ---- */
      let lastClick = { t: 0, id: null };
      const bindDrag = (el, id, j) => {
        el.addEventListener('pointerdown', e => {
          if (e.button !== 0 || won) return;
          e.preventDefault();
          startTimer();
          const now = Date.now();
          if (lastClick.id === id + ':' + j && now - lastClick.t < Sys.dblTime()) { lastClick = { t: 0 }; autoFound(id, j); return; }
          lastClick = { t: now, id: id + ':' + j };
          const p = pileOf(id);
          const moving = p.slice(j);
          const els = [...board.children].filter(x => +x.style.zIndex >= +el.style.zIndex && x.style.left === el.style.left && (id[0] === 't' || x === el));
          const sx = e.clientX, sy = e.clientY;
          let moved = false;
          el.setPointerCapture(e.pointerId);
          const mv = ev => {
            const dx = (ev.clientX - sx) / Sys.scale, dy = (ev.clientY - sy) / Sys.scale;
            if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
            moved = true;
            els.forEach(x => { x.style.transform = `translate(${dx}px, ${dy}px)`; x.style.zIndex = 1000 + (+x.style.zIndex); });
          };
          const up = ev => {
            el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up);
            if (!moved) return;
            const dx = (ev.clientX - sx) / Sys.scale, dy = (ev.clientY - sy) / Sys.scale;
            const r0 = el.getBoundingClientRect(), br = board.getBoundingClientRect();
            const cx = (r0.left - br.left) / Sys.scale, cy = (r0.top - br.top) / Sys.scale;
            void dx; void dy;
            // choose target with max overlap
            let best = null, bestA = 0;
            for (const pr of pileRects) {
              if (pr.kind === 'waste') continue;
              const ox = Math.max(0, Math.min(cx + CW, pr.x + CW) - Math.max(cx, pr.x));
              const oy = Math.max(0, Math.min(cy + CH, pr.y + pr.h) - Math.max(cy, pr.y));
              if (ox * oy > bestA) { bestA = ox * oy; best = pr; }
            }
            const c = moving[0];
            if (best) {
              const tid = best.kind === 'f' ? 'f' + best.i : 't' + best.i;
              const target = pileOf(tid);
              if (tid !== id && ((best.kind === 'f' && moving.length === 1 && canFound(c, target)) || (best.kind === 't' && canTab(c, target)))) {
                snap();
                p.splice(j);
                target.push(...moving);
                afterMove(id, tid);
              }
            }
            render();
          };
          el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
        });
        el.addEventListener('contextmenu', e => { e.preventDefault(); });
      };
      // right-click anywhere: auto-play all possible cards to foundations
      board.addEventListener('contextmenu', e => {
        e.preventDefault();
        let movedAny = true; snap();
        while (movedAny) {
          movedAny = false;
          for (const id of ['waste', 't0', 't1', 't2', 't3', 't4', 't5', 't6']) {
            const p = pileOf(id); if (!p.length || !p[p.length - 1].up) continue;
            for (let i = 0; i < 4; i++) if (canFound(p[p.length - 1], piles.f[i])) { piles.f[i].push(p.pop()); afterMove(id, 'f' + i); movedAny = true; break; }
          }
        }
        render();
      });

      /* ---- the famous win cascade ---- */
      let anim = null;
      const win = () => {
        won = true; clearInterval(timerId); timerId = null;
        if (opt.timed && opt.scoring === 'standard' && time >= 30) { score += Math.round(700000 / time); renderStatus(); }
        const cv = h('canvas', { width: board.clientWidth, height: board.clientHeight, style: { position: 'absolute', left: 0, top: 0, zIndex: 5000, imageRendering: 'pixelated' } });
        board.appendChild(cv);
        const x = cv.getContext('2d');
        const imgs = {};
        let fi = 0, cardIdx = 12, cur = null, stopped = false;
        const next = () => {
          if (cardIdx < 0) return null;
          const f = piles.f[fi], c = f[cardIdx];
          const im = imgs[c.r + c.s] || (imgs[c.r + c.s] = Object.assign(new Image(), { src: Cards.face(c.r, c.s) }));
          const o = { im, x: x0(3 + fi), y: TOP, vx: (Math.random() < .5 ? -1 : 1) * (2 + Math.random() * 4), vy: -Math.random() * 6 };
          fi = (fi + 1) % 4; if (fi === 0) cardIdx--;
          return o;
        };
        const step = () => {
          if (stopped) return;
          for (let k = 0; k < 3; k++) {
            if (!cur) { cur = next(); if (!cur) { finish(); return; } }
            cur.vy += 0.6; cur.x += cur.vx; cur.y += cur.vy;
            if (cur.y + CH > cv.height) { cur.y = cv.height - CH; cur.vy = -cur.vy * 0.75; if (Math.abs(cur.vy) < 2) cur.vy = 0; }
            x.drawImage(cur.im, Math.round(cur.x), Math.round(cur.y));
            if (cur.x < -CW || cur.x > cv.width) cur = null;
          }
          anim.raf = requestAnimationFrame(step);
        };
        const finish = () => { anim = null; msgBox('Congratulations, you won!\n\nDeal again?', 'Solitaire', { buttons: 'yesno', icon: 'question', owner: w }).then(r => { if (r === 'yes') newGame(); }); };
        anim = { raf: requestAnimationFrame(step), stop() { stopped = true; cancelAnimationFrame(this.raf); } };
        cv.addEventListener('pointerdown', () => { if (anim) { anim.stop(); finish(); } });
      };

      /* ---- dialogs ---- */
      const deckDlg = () => dialog({
        title: 'Select Card Back', w: 420, h: 250, owner: w,
        build(d) {
          let sel = opt.back;
          const names = Object.keys(Cards.BACKS);
          names.forEach((n, i) => {
            const el = h('div', { style: { width: CW + 'px', height: CH + 'px', backgroundImage: `url(${Cards.back(n)})`, outline: n === sel ? '3px solid var(--highlight)' : '', outlineOffset: '2px' } });
            el.addEventListener('pointerdown', () => { sel = n; d.body.querySelectorAll('[data-back]').forEach(x => x.style.outline = x.dataset.back === n ? '3px solid var(--highlight)' : ''); });
            el.addEventListener('dblclick', () => { opt.back = sel; Store.set('sol.opts', opt); d.close(); render(); });
            el.dataset.back = n;
            d.add(el, 14 + (i % 4) * 82, 12 + Math.floor(i / 4) * 112);
          });
          d.add(UI.button('OK', { default: true, onClick: () => { opt.back = sel; Store.set('sol.opts', opt); d.close(); render(); } }), 340, 140, 72, 25);
          d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 340, 172, 72, 25);
        }
      });
      const optionsDlg = () => dialog({
        title: 'Options', w: 320, h: 170, owner: w,
        build(d) {
          d.add(UI.group('Draw'), 8, 4, 140, 64);
          const d1 = UI.radio('sd', 'Draw &One', opt.draw === 1), d3 = UI.radio('sd', 'Draw &Three', opt.draw === 3);
          d.add(d1, 18, 22); d.add(d3, 18, 44);
          d.add(UI.group('Scoring'), 160, 4, 152, 84);
          const sS = UI.radio('ss', '&Standard', opt.scoring === 'standard'), sV = UI.radio('ss', '&Vegas', opt.scoring === 'vegas'), sN = UI.radio('ss', '&None', opt.scoring === 'none');
          d.add(sS, 170, 22); d.add(sV, 170, 42); d.add(sN, 170, 62);
          const tg = UI.check('Timed &game', opt.timed), sb = UI.check('Status &bar', opt.status), af = UI.check('&Auto-turn cards', !!opt.autoFlip);
          d.add(tg, 10, 80); d.add(sb, 10, 100); d.add(af, 10, 120);
          d.add(UI.button('OK', { default: true, onClick: () => {
            const nd = d3.input.checked ? 3 : 1, ns = sV.input.checked ? 'vegas' : sN.input.checked ? 'none' : 'standard';
            const restart = nd !== opt.draw || ns !== opt.scoring;
            Object.assign(opt, { draw: nd, scoring: ns, timed: tg.input.checked, status: sb.input.checked, autoFlip: af.input.checked });
            Store.set('sol.opts', opt); d.close();
            if (restart) newGame(); else render();
          } }), 80, 140, 72, 25);
          d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 164, 140, 72, 25);
        }
      });

      const w = new Win({
        title: 'Solitaire', icon: 'sol', w: 600, h: 440, minW: 300, minH: 200, persist: 'sol',
        onClosed: () => { clearInterval(timerId); if (anim) anim.stop(); },
        menu: [
          { label: '&Game', items: [
            { label: '&Deal', action: newGame }, '-',
            { label: '&Undo', disabled: () => !history.length, action: undo },
            { label: 'De&ck...', action: deckDlg },
            { label: '&Options...', action: optionsDlg }, '-',
            { label: 'E&xit', action: () => w.close() }] },
          { label: '&Help', items: [{ label: '&Contents', action: () => Sys.launch('WINHELP.EXE sol') }, { label: '&Search for Help on...', action: () => Sys.launch('WINHELP.EXE sol') }, { label: '&How to Use Help', action: () => Sys.launch('WINHELP.EXE winhelp') }, '-', { label: '&About Solitaire...', action: () => aboutBox('Solitaire', 'sol', w, 'by Wes Cherry') }] }
        ]
      });
      w.body.append(board, status);
      requestAnimationFrame(() => { if (!Store.get('wpos.sol')) w.sizeToClient(7 * (CW + GAP) + GAP, 430); newGame(); });
      return w;
    }
  });
})();
