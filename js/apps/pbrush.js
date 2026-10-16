'use strict';
/* Paintbrush — every tool rasterises its own pixels (no anti-aliasing) */
(() => {
  const PALETTE = [
    '#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080', '#808040', '#004040', '#0080ff', '#004080', '#4000ff', '#804000',
    '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ffff80', '#00ff80', '#80ffff', '#8080ff', '#ff0080', '#ff8040'];
  const SIZES = [1, 2, 3, 5, 7, 9, 12, 15];

  /* 16x16 pixel glyphs for the toolbox */
  const TOOL_ICONS = {
    scissors: g => g.m(1, 1, ['...K......K...', '...K......K...', '....K....K....', '....K....K....', '.....K..K.....', '.....K..K.....', '......KK......', '......KK......', '.....K..K.....', '..KKK....KKK..', '.K..K....K..K.', '.K..K....K..K.', '..KK......KK..']),
    pick: g => { for (let i = 1; i < 15; i += 2) { g.p(i, 2, 'K'); g.p(i, 13, 'K'); } for (let j = 2; j < 14; j += 2) { g.p(1, j, 'K'); g.p(14, j, 'K'); } },
    airbrush: g => { g.b(7, 6, 6, 9, 'G'); g.f(9, 3, 2, 3, 'K'); g.l(11, 4, 14, 4, 'K'); [[3, 2], [1, 4], [4, 5], [2, 7], [5, 3], [1, 1], [3, 9]].forEach(([x, y]) => g.p(x, y, 'K')); },
    text: g => g.t(2, 5, 'abc', 'K'),
    colorEraser: g => { g.b(3, 4, 10, 8, 'W'); g.f(4, 5, 4, 6, 'R'); g.l(1, 14, 14, 14, 'K'); },
    eraser: g => { g.b(3, 4, 10, 8, 'W'); g.l(4, 12, 13, 12, 'G'); g.l(13, 5, 13, 12, 'G'); },
    roller: g => { g.b(2, 2, 11, 5, 'W'); g.l(13, 4, 14, 4, 'K'); g.l(14, 4, 14, 8, 'K'); g.l(14, 8, 8, 8, 'K'); g.f(7, 8, 2, 7, 'K'); },
    brush: g => { g.l(13, 1, 7, 7, 'K'); g.l(14, 2, 8, 8, 'K'); g.f(4, 8, 4, 4, 'K'); g.p(3, 12, 'K'); g.p(2, 13, 'K'); g.p(4, 12, 'K'); },
    curve: g => { [[1, 12], [2, 11], [3, 9], [4, 7], [5, 6], [6, 5], [7, 5], [8, 6], [9, 7], [10, 9], [11, 10], [12, 11], [13, 11], [14, 10]].forEach(([x, y], i, a) => i && g.l(a[i - 1][0], a[i - 1][1], x, y, 'K')); },
    line: g => g.l(2, 13, 13, 2, 'K'),
    box: g => g.o(2, 3, 12, 10, 'K'),
    fbox: g => g.b(2, 3, 12, 10, 'G'),
    rbox: g => { g.o(2, 3, 12, 10, 'K'); [[2, 3], [13, 3], [2, 12], [13, 12]].forEach(([x, y]) => g.p(x, y, null)); },
    frbox: g => { g.b(2, 3, 12, 10, 'G'); [[2, 3], [13, 3], [2, 12], [13, 12]].forEach(([x, y]) => g.p(x, y, null)); },
    ellipse: g => g.ell(1, 3, 14, 10, null, 'K'),
    fellipse: g => g.ell(1, 3, 14, 10, 'G', 'K'),
    polygon: g => { g.l(2, 12, 6, 2, 'K'); g.l(6, 2, 13, 6, 'K'); g.l(13, 6, 10, 13, 'K'); g.l(10, 13, 2, 12, 'K'); },
    fpolygon: g => { for (let y = 3; y < 13; y++) g.l(Math.max(3, 7 - (y - 2) / 2), y, Math.min(12, 6 + y), y, 'G'); g.l(2, 12, 6, 2, 'K'); g.l(6, 2, 13, 6, 'K'); g.l(13, 6, 10, 13, 'K'); g.l(10, 13, 2, 12, 'K'); }
  };
  const TOOLS = ['scissors', 'pick', 'airbrush', 'text', 'colorEraser', 'eraser', 'roller', 'brush', 'curve', 'line', 'box', 'fbox', 'rbox', 'frbox', 'ellipse', 'fellipse', 'polygon', 'fpolygon'];
  const TOOL_NAMES = { scissors: 'Scissors', pick: 'Pick', airbrush: 'Airbrush', text: 'Text', colorEraser: 'Color Eraser', eraser: 'Eraser', roller: 'Paint Roller', brush: 'Brush', curve: 'Curve', line: 'Line', box: 'Box', fbox: 'Filled Box', rbox: 'Rounded Box', frbox: 'Filled Rounded Box', ellipse: 'Circle/Ellipse', fellipse: 'Filled Circle/Ellipse', polygon: 'Polygon', fpolygon: 'Filled Polygon' };
  const toolURL = n => { const g = new PixGrid(16, 16); TOOL_ICONS[n](g); return g.canvas().toDataURL(); };

  const hex2rgb = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

  Sys.registerApp('pbrush', {
    name: 'Paintbrush', icon: 'pbrush', help: 'pbrush',
    run(opts) {
      const colors = [...PALETTE]; let colorIndex = 0;
      let path = null, dirty = false, tool = 'brush', size = 2, fg = '#000000', bg = '#ffffff', zoom = 1;
      let undoBuf = null, sel = null, poly = null, curve = null, textPos = null, textStr = '';
      let textStyle = { bold: false, italic: false, underline: false, font: 'Arial', px: 16 };
      const W0 = 560, H0 = 360;
      const cv = h('canvas', { width: W0, height: H0, style: { display: 'block', imageRendering: 'pixelated', background: '#fff' } });
      const ov = h('canvas', { width: W0, height: H0, style: { position: 'absolute', left: 0, top: 0, imageRendering: 'pixelated', pointerEvents: 'none' } });
      const ctx = cv.getContext('2d', { willReadFrequently: true }), octx = ov.getContext('2d');
      const clear = () => { ctx.fillStyle = bg; ctx.fillRect(0, 0, cv.width, cv.height); };
      clear();

      const stage = h('div', { style: { position: 'relative', display: 'inline-block', margin: '0', cursor: 'crosshair' } }, cv, ov);
      const scroller = h('div', { style: { position: 'absolute', left: '56px', top: 0, right: 0, bottom: '42px', overflow: 'scroll', background: 'var(--app-workspace)' } }, stage);
      const toolbox = h('div', { style: { position: 'absolute', left: 0, top: 0, width: '56px', bottom: '42px', background: 'var(--btn-face)', borderRight: '1px solid #000' } });
      const palette = h('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '42px', background: 'var(--btn-face)', borderTop: '1px solid #000' } });

      // toolbox
      const toolEls = {};
      TOOLS.forEach((t, i) => {
        const b = h('div', { role: 'button', tabindex: '0', 'aria-label': TOOL_NAMES[t], title: TOOL_NAMES[t], style: { position: 'absolute', left: (2 + (i % 2) * 26) + 'px', top: (2 + Math.floor(i / 2) * 22) + 'px', width: '25px', height: '21px', border: '1px solid #000', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
          h('img', { src: toolURL(t), width: 16, height: 16, class: 'ico' }));
        b.addEventListener('pointerdown', () => setTool(t));
        b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setTool(t); } });
        toolEls[t] = b; toolbox.appendChild(b);
      });
      const sizeBox = h('div', { style: { position: 'absolute', left: '2px', top: (2 + 9 * 22 + 4) + 'px', width: '51px', border: '1px solid #000', background: '#fff' } });
      SIZES.forEach((s) => {
        const row = h('div', { style: { height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, h('div', { style: { width: '36px', height: Math.min(12, s) + 'px', background: '#000' } }));
        row.addEventListener('pointerdown', () => { size = s; renderSizes(); });
        row.dataset.s = s; sizeBox.appendChild(row);
      });
      toolbox.appendChild(sizeBox);
      const renderSizes = () => sizeBox.childNodes.forEach(r => r.style.outline = +r.dataset.s === size ? '1px dotted #000' : '', r => r);
      const setTool = t => {
        commitText(); finishPoly(); dropSelection();
        tool = t;
        for (const k in toolEls) { toolEls[k].setAttribute('aria-pressed', String(k === t)); toolEls[k].style.background = k === t ? '#000' : '#fff'; toolEls[k].firstChild.style.filter = k === t ? 'invert(1)' : ''; }
      };

      // palette
      const ind = h('div', { style: { position: 'absolute', left: '4px', top: '4px', width: '34px', height: '34px', border: '1px solid #000' } });
      const indFg = h('div', { style: { position: 'absolute', left: '8px', top: '8px', width: '16px', height: '16px', border: '1px solid #000' } });
      ind.appendChild(indFg); palette.appendChild(ind);
      const swatches = [];
      colors.forEach((c, i) => {
        const sw = h('div', { role: 'button', tabindex: '0', 'aria-label': 'Color ' + (i + 1) + ' ' + c, style: { position: 'absolute', left: (44 + (i % 14) * 18) + 'px', top: (3 + Math.floor(i / 14) * 18) + 'px', width: '17px', height: '17px', border: '1px solid #000', background: c } });
        sw.addEventListener('pointerdown', e => { colorIndex = i; if (e.button === 2) bg = colors[i]; else fg = colors[i]; renderInd(); });
        sw.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); colorIndex = i; if (e.shiftKey) bg = colors[i]; else fg = colors[i]; renderInd(); } });
        swatches.push(sw); palette.appendChild(sw);
      });
      const renderInd = () => { ind.style.background = bg; indFg.style.background = fg; };

      const refreshPalette = () => { swatches.forEach((sw, i) => { sw.style.background = colors[i]; sw.setAttribute('aria-label', 'Color ' + (i + 1) + ' ' + colors[i]); }); fg = colors[colorIndex]; renderInd(); };
      const editColor = () => dialog({ title: 'Edit Colors', w: 280, h: 100, owner: w, build(d) {
        const value = UI.text(colors[colorIndex]);
        d.add(UI.label('&Color (#RRGGBB):', value), 10, 12); d.add(value, 10, 34, 150);
        d.add(UI.button('OK', { default: true, onClick: () => {
          if (!/^#[a-f0-9]{6}$/i.test(value.value.trim())) { msgBox('Enter a color such as #008080.', 'Paintbrush', { owner: d.win, icon: 'exclaim' }); return; }
          colors[colorIndex] = value.value.trim(); refreshPalette(); d.close();
        } }), 185, 8, 85, 25);
        d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 185, 40, 85, 25);
      } });
      const paletteFile = async save => {
        const p = await fileDialog({ mode: save ? 'save' : 'open', owner: w, name: 'COLORS.PAL', defExt: 'PAL', filters: [['Color Palettes', '*.PAL']] });
        if (!p) return;
        try {
          if (save) FS.write(p, JSON.stringify(colors));
          else { const values = JSON.parse(FS.read(p)); if (!Array.isArray(values) || values.length !== colors.length || !values.every(c => typeof c === 'string' && /^#[a-f0-9]{6}$/i.test(c))) throw new Error('Choose a valid 28-color palette.'); colors.splice(0, colors.length, ...values); refreshPalette(); }
        } catch (e) { msgBox(e.message, 'Paintbrush', { owner: w, icon: 'exclaim' }); }
      };
      swatches.forEach(sw => sw.addEventListener('dblclick', editColor));

      /* ---------- helpers ---------- */
      const snapshot = () => { undoBuf = ctx.getImageData(0, 0, cv.width, cv.height); dirty = true; };
      const undo = () => { if (!undoBuf) return; const cur = ctx.getImageData(0, 0, cv.width, cv.height); ctx.putImageData(undoBuf, 0, 0); undoBuf = cur; };
      const pos = e => {
        const r = cv.getBoundingClientRect();
        return { x: Math.floor((e.clientX - r.left) / r.width * cv.width), y: Math.floor((e.clientY - r.top) / r.height * cv.height) };
      };
      const clearOv = () => octx.clearRect(0, 0, ov.width, ov.height);
      const setZoom = z => {
        zoom = z;
        for (const c of [cv, ov]) { c.style.width = cv.width * z + 'px'; c.style.height = cv.height * z + 'px'; }
        stage.style.backgroundImage = z >= 4 ? '' : '';
      };
      const resize = (w, hh) => {
        const old = ctx.getImageData(0, 0, cv.width, cv.height);
        cv.width = ov.width = w; cv.height = ov.height = hh;
        clear(); ctx.putImageData(old, 0, 0); setZoom(zoom);
      };

      const floodFill = (sx, sy, color) => {
        const img = ctx.getImageData(0, 0, cv.width, cv.height), d = img.data, Wd = cv.width, Hd = cv.height;
        const i0 = (sy * Wd + sx) * 4, t = [d[i0], d[i0 + 1], d[i0 + 2]];
        const [r, g, b] = hex2rgb(color);
        if (t[0] === r && t[1] === g && t[2] === b) return;
        const match = i => d[i] === t[0] && d[i + 1] === t[1] && d[i + 2] === t[2];
        const stack = [[sx, sy]];
        while (stack.length) {
          let [x, y] = stack.pop();
          let i = (y * Wd + x) * 4;
          while (x >= 0 && match(i)) { x--; i -= 4; }
          x++; i += 4;
          let up = false, dn = false;
          while (x < Wd && match(i)) {
            d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
            if (y > 0) { const m = match(i - Wd * 4); if (m && !up) { stack.push([x, y - 1]); up = true; } else if (!m) up = false; }
            if (y < Hd - 1) { const m = match(i + Wd * 4); if (m && !dn) { stack.push([x, y + 1]); dn = true; } else if (!m) dn = false; }
            x++; i += 4;
          }
        }
        ctx.putImageData(img, 0, 0);
      };

      const colorErase = (x0, y0) => {
        const s = size * 2 + 4, o = Math.floor(s / 2);
        const sx = clamp(x0 - o, 0, cv.width - 1), sy = clamp(y0 - o, 0, cv.height - 1);
        const w = Math.min(s, cv.width - sx), hh = Math.min(s, cv.height - sy);
        if (w <= 0 || hh <= 0) return;
        const img = ctx.getImageData(sx, sy, w, hh), d = img.data;
        const [fr, fgc, fb] = hex2rgb(fg), [br, bgc, bb] = hex2rgb(bg);
        for (let i = 0; i < d.length; i += 4) if (d[i] === fr && d[i + 1] === fgc && d[i + 2] === fb) { d[i] = br; d[i + 1] = bgc; d[i + 2] = bb; }
        ctx.putImageData(img, sx, sy);
      };

      const roundRect = (c, x0, y0, x1, y1, style, fill) => {
        const l = Math.min(x0, x1), t = Math.min(y0, y1), r = Math.max(x0, x1), b = Math.max(y0, y1);
        const rad = Math.min(8, Math.floor((r - l) / 3), Math.floor((b - t) / 3));
        const spans = [];
        for (let y = t; y <= b; y++) {
          const dy = y < t + rad ? t + rad - y : y > b - rad ? y - (b - rad) : 0;
          const inset = rad ? Math.round(rad - Math.sqrt(Math.max(0, rad * rad - dy * dy))) : 0;
          spans.push([y, l + inset, r - inset]);
        }
        if (fill) { c.fillStyle = fill; spans.forEach(([y, a, z]) => c.fillRect(a, y, z - a + 1, 1)); }
        if (style) {
          c.fillStyle = style;
          spans.forEach(([y, a, z], i) => {
            if (i < size || i >= spans.length - size) { c.fillRect(a, y, z - a + 1, 1); return; }
            const p = spans[i - 1], n = spans[i + 1];
            const wl = Math.max(size, Math.max(p[1], n[1]) - a, 1), wr = Math.max(size, z - Math.min(p[2], n[2]), 1);
            c.fillRect(a, y, wl, 1); c.fillRect(z - wr + 1, y, wr, 1);
          });
        }
      };

      const drawShape = (c, t, a, b, e) => {
        let { x: x0, y: y0 } = a, { x: x1, y: y1 } = b;
        if (e && e.shiftKey && t !== 'line') { const d = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); x1 = x0 + Math.sign(x1 - x0 || 1) * d; y1 = y0 + Math.sign(y1 - y0 || 1) * d; }
        if (t === 'line') { c.fillStyle = fg; Raster.line(c, x0, y0, x1, y1, size); }
        else if (t === 'box' || t === 'fbox') {
          if (t === 'fbox') { c.fillStyle = fg; c.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0) + 1, Math.abs(y1 - y0) + 1); }
          c.fillStyle = t === 'fbox' ? bg : fg; Raster.rect(c, x0, y0, x1, y1, size);
        } else if (t === 'rbox' || t === 'frbox') roundRect(c, x0, y0, x1, y1, t === 'frbox' ? bg : fg, t === 'frbox' ? fg : null);
        else if (t === 'ellipse' || t === 'fellipse') Raster.ellipse(c, x0, y0, x1, y1, size, t === 'fellipse' ? fg : null, t === 'fellipse' ? bg : fg);
      };

      const bezierPts = (a, ctrl1, ctrl2, b) => {
        const pts = [];
        for (let i = 0; i <= 40; i++) {
          const t = i / 40, u = 1 - t;
          pts.push({ x: u * u * u * a.x + 3 * u * u * t * ctrl1.x + 3 * u * t * t * ctrl2.x + t * t * t * b.x, y: u * u * u * a.y + 3 * u * u * t * ctrl1.y + 3 * u * t * t * ctrl2.y + t * t * t * b.y });
        }
        return pts;
      };
      const drawCurve = (c, cu) => {
        c.fillStyle = fg;
        const pts = bezierPts(cu.a, cu.c1 || cu.a, cu.c2 || cu.c1 || cu.b, cu.b);
        for (let i = 1; i < pts.length; i++) Raster.line(c, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, size);
      };

      const fillPoly = (c, pts, color) => {
        const ys = pts.map(p => p.y), minY = Math.min(...ys), maxY = Math.max(...ys);
        c.fillStyle = color;
        for (let y = minY; y <= maxY; y++) {
          const xs = [];
          for (let i = 0; i < pts.length; i++) {
            const p = pts[i], q = pts[(i + 1) % pts.length];
            if ((p.y <= y && q.y > y) || (q.y <= y && p.y > y)) xs.push(p.x + (y - p.y) / (q.y - p.y) * (q.x - p.x));
          }
          xs.sort((a, b) => a - b);
          for (let k = 0; k + 1 < xs.length; k += 2) c.fillRect(Math.round(xs[k]), y, Math.round(xs[k + 1]) - Math.round(xs[k]) + 1, 1);
        }
      };
      const finishPoly = () => {
        if (!poly || poly.pts.length < 2) { poly = null; clearOv(); return; }
        snapshot();
        if (poly.filled) fillPoly(ctx, poly.pts, fg);
        ctx.fillStyle = poly.filled ? bg : fg;
        const p = poly.pts;
        for (let i = 0; i < p.length; i++) Raster.line(ctx, p[i].x, p[i].y, p[(i + 1) % p.length].x, p[(i + 1) % p.length].y, size);
        poly = null; clearOv();
      };

      /* ---------- text tool (rendered then binarised -> crisp pixels) ---------- */
      const renderText = (c, preview) => {
        if (!textPos) return;
        const lines = textStr.split('\n');
        const font = `${textStyle.italic ? 'italic ' : ''}${textStyle.bold ? 'bold ' : ''}${WIN_FONT_PX[textStyle.font] || textStyle.px}px ${WIN_FONTS[textStyle.font] || '"' + textStyle.font + '"'}`;
        const tmp = h('canvas', { width: cv.width, height: cv.height });
        const t = tmp.getContext('2d');
        t.font = font; t.textBaseline = 'top'; t.fillStyle = '#000';
        lines.forEach((l, i) => {
          t.fillText(l, textPos.x, textPos.y + i * Math.round(textStyle.px * 1.2));
          if (textStyle.underline) t.fillRect(textPos.x, textPos.y + i * Math.round(textStyle.px * 1.2) + textStyle.px, Math.ceil(t.measureText(l).width), 1);
        });
        const img = t.getImageData(0, 0, tmp.width, tmp.height), d = img.data;
        const [r, g, b] = hex2rgb(fg);
        const target = c.getImageData(0, 0, cv.width, cv.height), td = target.data;
        let any = false;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 110) { td[i - 3] = r; td[i - 2] = g; td[i - 1] = b; td[i] = 255; any = true; }
        if (any) c.putImageData(target, 0, 0);
        if (preview) {
          const lastW = Math.ceil(t.measureText(lines[lines.length - 1]).width);
          c.fillStyle = '#000'; c.fillRect(textPos.x + lastW, textPos.y + (lines.length - 1) * Math.round(textStyle.px * 1.2), 1, textStyle.px);
        }
      };
      const commitText = () => {
        if (textPos && textStr) { snapshot(); renderText(ctx); }
        textPos = null; textStr = ''; clearOv();
      };

      /* ---------- selection (Pick / Scissors) ---------- */
      const drawSel = () => {
        clearOv();
        if (!sel) return;
        if (sel.img) octx.putImageData(sel.img, sel.x, sel.y);
        octx.fillStyle = '#000';
        for (let x = 0; x < sel.w; x += 2) { octx.fillRect(sel.x + x, sel.y, 1, 1); octx.fillRect(sel.x + x, sel.y + sel.h - 1, 1, 1); }
        for (let y = 0; y < sel.h; y += 2) { octx.fillRect(sel.x, sel.y + y, 1, 1); octx.fillRect(sel.x + sel.w - 1, sel.y + y, 1, 1); }
      };
      const dropSelection = () => {
        if (sel && sel.img && sel.lifted) ctx.putImageData(sel.img, sel.x, sel.y);
        sel = null; clearOv();
      };
      const liftSelection = () => {
        if (!sel || sel.lifted) return;
        snapshot();
        sel.img = ctx.getImageData(sel.x, sel.y, sel.w, sel.h);
        ctx.fillStyle = bg; ctx.fillRect(sel.x, sel.y, sel.w, sel.h);
        sel.lifted = true;
      };
      const selImage = () => sel ? (sel.img || ctx.getImageData(sel.x, sel.y, sel.w, sel.h)) : null;
      const imgToURL = img => { const c = h('canvas', { width: img.width, height: img.height }); c.getContext('2d').putImageData(img, 0, 0); return c.toDataURL(); };
      const copySel = () => { const img = selImage(); if (img) Sys.setClipboard({ type: 'image', data: imgToURL(img) }); };
      const paste = () => {
        const c = Sys.clipboard;
        if (!c) return;
        dropSelection();
        if (c.type === 'image') {
          const im = new Image();
          im.onload = () => {
            const t = h('canvas', { width: im.width, height: im.height }); const tx = t.getContext('2d'); tx.drawImage(im, 0, 0);
            snapshot();
            sel = { x: 0, y: 0, w: im.width, h: im.height, img: tx.getImageData(0, 0, im.width, im.height), lifted: true };
            setTool('pick'); sel = { x: 0, y: 0, w: im.width, h: im.height, img: tx.getImageData(0, 0, im.width, im.height), lifted: true };
            drawSel();
          };
          im.src = c.data;
        } else if (c.type === 'text') { setTool('text'); textPos = { x: 10, y: 10 }; textStr = c.data; clearOv(); renderText(octx, true); }
      };
      const xformSel = fn => {
        if (!sel) return;
        liftSelection();
        const src = sel.img, out = new ImageData(src.width, src.height);
        for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
          const [sx, sy, inv] = fn(x, y, src.width, src.height);
          const si = (sy * src.width + sx) * 4, di = (y * src.width + x) * 4;
          for (let k = 0; k < 3; k++) out.data[di + k] = inv ? 255 - src.data[si + k] : src.data[si + k];
          out.data[di + 3] = 255;
        }
        sel.img = out; drawSel();
      };

      /* ---------- pointer handling ---------- */
      let drag = null, sprayT = null;
      stage.addEventListener('contextmenu', e => e.preventDefault());
      stage.addEventListener('pointerdown', e => {
        e.preventDefault();
        stage.setPointerCapture(e.pointerId);
        w.activate(true);
        const p = pos(e), right = e.button === 2;
        const col = right ? bg : fg;
        if (zoom >= 4) { snapshot(); ctx.fillStyle = col; ctx.fillRect(p.x, p.y, 1, 1); drag = { t: 'pencil', col }; return; }
        if (tool !== 'text') commitText();
        if (tool !== 'pick' && tool !== 'scissors') dropSelection();
        switch (tool) {
          case 'brush': snapshot(); ctx.fillStyle = col; Raster.dot(ctx, null, p.x, p.y, size, Store.get('pb.round', false)); drag = { t: 'brush', last: p, col }; break;
          case 'eraser': snapshot(); ctx.fillStyle = bg; Raster.dot(ctx, null, p.x, p.y, size * 2 + 6); drag = { t: 'eraser', last: p }; break;
          case 'colorEraser': snapshot(); colorErase(p.x, p.y); drag = { t: 'colorEraser', last: p }; break;
          case 'airbrush': {
            snapshot(); drag = { t: 'airbrush', p, col };
            const spray = () => { const r = size * 2 + 6; ctx.fillStyle = col; for (let i = 0; i < 12; i++) { const a = Math.random() * 6.283, d = Math.random() * r; ctx.fillRect(Math.round(drag.p.x + Math.cos(a) * d), Math.round(drag.p.y + Math.sin(a) * d), 1, 1); } };
            spray(); sprayT = setInterval(spray, 30); break;
          }
          case 'roller': snapshot(); floodFill(p.x, p.y, col); break;
          case 'text': commitText(); textPos = p; textStr = ''; renderText(octx, true); clearOv(); octx.fillStyle = '#000'; octx.fillRect(p.x, p.y, 1, textStyle.px); break;
          case 'pick': case 'scissors':
            if (sel && p.x >= sel.x && p.y >= sel.y && p.x < sel.x + sel.w && p.y < sel.y + sel.h) {
              liftSelection();
              if (e.ctrlKey) ctx.putImageData(sel.img, sel.x, sel.y);
              drag = { t: 'move', ox: p.x - sel.x, oy: p.y - sel.y };
            } else { dropSelection(); drag = { t: 'sel', a: p }; }
            break;
          case 'polygon': case 'fpolygon':
            if (!poly) poly = { pts: [p], filled: tool === 'fpolygon' };
            drag = { t: 'poly', a: poly.pts[poly.pts.length - 1] };
            break;
          case 'curve':
            if (!curve) { drag = { t: 'curve0', a: p }; }
            else drag = { t: curve.c1 ? 'curve2' : 'curve1' };
            break;
          default: drag = { t: 'shape', a: p, right };
        }
      });
      stage.addEventListener('pointermove', e => {
        const p = pos(e);
        coords.textContent = `${p.x}, ${p.y}`;
        if (!drag) return;
        switch (drag.t) {
          case 'pencil': ctx.fillStyle = drag.col; ctx.fillRect(p.x, p.y, 1, 1); break;
          case 'brush': ctx.fillStyle = drag.col; Raster.line(ctx, drag.last.x, drag.last.y, p.x, p.y, size, Store.get('pb.round', false)); drag.last = p; break;
          case 'eraser': ctx.fillStyle = bg; Raster.line(ctx, drag.last.x, drag.last.y, p.x, p.y, size * 2 + 6); drag.last = p; break;
          case 'colorEraser': { const L = drag.last; const n = Math.max(Math.abs(p.x - L.x), Math.abs(p.y - L.y), 1); for (let i = 0; i <= n; i += 2) colorErase(Math.round(L.x + (p.x - L.x) * i / n), Math.round(L.y + (p.y - L.y) * i / n)); drag.last = p; break; }
          case 'airbrush': drag.p = p; break;
          case 'shape': clearOv(); drawShape(octx, tool, drag.a, p, e); break;
          case 'sel': clearOv(); sel = { x: Math.min(drag.a.x, p.x), y: Math.min(drag.a.y, p.y), w: Math.abs(p.x - drag.a.x) + 1, h: Math.abs(p.y - drag.a.y) + 1 }; drawSel(); break;
          case 'move': if (e.shiftKey) ctx.putImageData(sel.img, sel.x, sel.y); sel.x = p.x - drag.ox; sel.y = p.y - drag.oy; drawSel(); break;
          case 'poly': clearOv(); octx.fillStyle = fg; poly.pts.forEach((q, i) => i && Raster.line(octx, poly.pts[i - 1].x, poly.pts[i - 1].y, q.x, q.y, size)); Raster.line(octx, drag.a.x, drag.a.y, p.x, p.y, size); break;
          case 'curve0': clearOv(); octx.fillStyle = fg; Raster.line(octx, drag.a.x, drag.a.y, p.x, p.y, size); break;
          case 'curve1': clearOv(); curve.c1 = p; curve.c2 = null; drawCurve(octx, curve); curve.c1 = null; curve.tmp = p; break;
          case 'curve2': clearOv(); curve.c2 = p; drawCurve(octx, curve); curve.c2 = null; curve.tmp2 = p; break;
        }
      });
      stage.addEventListener('pointerup', e => {
        if (!drag) return;
        const p = pos(e);
        clearInterval(sprayT);
        switch (drag.t) {
          case 'shape': clearOv(); snapshot(); drawShape(ctx, tool, drag.a, p, e); break;
          case 'sel': if (sel && (sel.w < 2 || sel.h < 2)) { sel = null; clearOv(); } break;
          case 'poly': {
            const st = poly.pts[0];
            if (poly.pts.length > 2 && Math.abs(p.x - st.x) < 4 && Math.abs(p.y - st.y) < 4) finishPoly();
            else { poly.pts.push(p); clearOv(); octx.fillStyle = fg; poly.pts.forEach((q, i) => i && Raster.line(octx, poly.pts[i - 1].x, poly.pts[i - 1].y, q.x, q.y, size)); }
            break;
          }
          case 'curve0': if (p.x === drag.a.x && p.y === drag.a.y) { clearOv(); break; } curve = { a: drag.a, b: p }; break;
          case 'curve1': curve.c1 = curve.tmp || curve.a; drawCurve((clearOv(), octx), curve); break;
          case 'curve2': curve.c2 = curve.tmp2 || curve.c1; clearOv(); snapshot(); drawCurve(ctx, curve); curve = null; break;
        }
        drag = null;
      });
      stage.addEventListener('dblclick', () => { if (poly) { poly.pts.pop(); finishPoly(); } });

      /* ---------- file ---------- */
      const name = () => path ? FS.basename(path) : '(Untitled)';
      const title = () => w.setTitle('Paintbrush - ' + name());
      const confirmLose = async () => {
        commitText(); dropSelection();
        if (!dirty) return true;
        const r = await askSave('Paintbrush', `Save current changes?`, w);
        if (r === 'cancel') return false;
        if (r === 'yes') return save();
        return true;
      };
      const loadImg = (src, done) => { const im = new Image(); im.onload = () => { cv.width = ov.width = im.width; cv.height = ov.height = im.height; ctx.drawImage(im, 0, 0); setZoom(zoom); done && done(); }; im.src = src; };
      const load = p => {
        const n = FS.get(p);
        if (!n) return;
        if (n.g) { const c = Wallpapers.gen(n.g); if (c) { cv.width = ov.width = c.width; cv.height = ov.height = c.height; ctx.drawImage(c, 0, 0); setZoom(zoom); } }
        else if ((n.x || '').startsWith('data:image')) loadImg(n.x);
        else { msgBox(`${FS.basename(p)}\nThis is not a valid Paintbrush file.`, 'Paintbrush', { icon: 'exclaim', owner: w }); return; }
        path = FS.full(p); dirty = false; undoBuf = null; title();
      };
      const writeTo = p => {
        commitText(); dropSelection();
        try { const url = cv.toDataURL(); FS.write(p, url, { s: cv.width * cv.height / 2 + 118 }); path = FS.full(p); dirty = false; title(); return true; }
        catch (e) { msgBox(`Cannot save ${p}.\n${e.message}`, 'Paintbrush', { icon: 'exclaim', owner: w }); return false; }
      };
      const saveAs = async () => {
        const p = await fileDialog({ mode: 'save', owner: w, name: path ? FS.basename(path) : '*.bmp', dir: path ? FS.dirname(path) : null, defExt: 'BMP', filters: [['Bitmap Files (*.BMP)', '*.BMP'], ['PCX Files (*.PCX)', '*.PCX']] });
        return p ? writeTo(p) : false;
      };
      const save = () => path ? writeTo(path) : saveAs();

      const attrsDlg = () => dialog({
        title: 'Image Attributes', w: 300, h: 110, owner: w,
        build(d) {
          const wt = UI.text(String(cv.width)), ht = UI.text(String(cv.height));
          d.add(UI.label('&Width:', wt), 10, 14); d.add(wt, 70, 10, 60);
          d.add(UI.label('&Height:', ht), 10, 44); d.add(ht, 70, 40, 60);
          d.add(UI.label('Units: pels'), 10, 80);
          d.add(UI.button('OK', { default: true, onClick: () => { snapshot(); resize(clamp(parseInt(wt.value) || 1, 1, 2048), clamp(parseInt(ht.value) || 1, 1, 2048)); d.close(); } }), 210, 8, 80, 25);
          d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 210, 38, 80, 25);
          d.add(UI.button('&Default', { onClick: () => { wt.value = W0; ht.value = H0; } }), 210, 68, 80, 25);
        }
      });
      const fontsDlg = () => dialog({
        title: 'Font', w: 330, h: 170, owner: w,
        build(d) {
          const fl = UI.listbox({ items: winFontList() }); fl.selectText(textStyle.font);
          const zl = UI.listbox({ items: ['8', '10', '12', '14', '18', '24', '36', '48', '72'] }); zl.selectText(String(Math.round(textStyle.px * 0.75)));
          d.add(UI.label('&Font:', fl), 8, 6); d.add(fl, 8, 24, 160, 120);
          d.add(UI.label('&Size:', zl), 176, 6); d.add(zl, 176, 24, 50, 120);
          d.add(UI.button('OK', { default: true, onClick: () => { textStyle.font = fl.value?.text || 'Arial'; textStyle.px = Math.round((+(zl.value?.text || 12)) / 0.75); d.close(); } }), 240, 8, 80, 25);
          d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 240, 38, 80, 25);
        }
      });
      const ts = k => () => { textStyle[k] = !textStyle[k]; if (textPos) { clearOv(); renderText(octx, true); } };

      const coords = h('div', { style: { position: 'absolute', right: '6px', top: '12px', fontWeight: 'normal', display: 'none' } });
      palette.appendChild(coords);

      const w = new Win({
        title: 'Paintbrush - (Untitled)', icon: 'pbrush', w: 640, h: 470,
        onClose: confirmLose,
        onKey: (e, name) => {
          if (tool === 'text' && textPos && !e.ctrlKey && !e.altKey) {
            if (e.key === 'Enter') textStr += '\n';
            else if (e.key === 'Backspace') textStr = textStr.slice(0, -1);
            else if (e.key === 'Escape') { textPos = null; textStr = ''; clearOv(); return true; }
            else if (e.key.length === 1) textStr += e.key;
            else return false;
            clearOv(); renderText(octx, true); return true;
          }
          if (name === 'Backspace') { undo(); return true; }
          if (name === 'Enter' && poly) { finishPoly(); return true; }
          if (name === 'Esc') { dropSelection(); poly = null; curve = null; clearOv(); return true; }
          return false;
        },
        menu: [
          { label: '&File', items: [
            { label: '&New', action: async () => { if (await confirmLose()) { cv.width = ov.width = W0; cv.height = ov.height = H0; clear(); path = null; dirty = false; undoBuf = null; setZoom(1); title(); } } },
            { label: '&Open...', action: async () => { if (!(await confirmLose())) return; const p = await fileDialog({ owner: w, dir: path ? FS.dirname(path) : null, filters: [['Bitmap Files (*.BMP)', '*.BMP'], ['All Files (*.*)', '*.*']] }); if (p) load(p); } },
            { label: '&Save', key: 'Ctrl+S', action: save }, { label: 'Save &As...', action: saveAs }, '-',
            { label: 'Page Se&tup...', disabled: true },
            { label: '&Print...', action: () => printDoc('Paintbrush', name(), 'x'.repeat(cv.width * cv.height / 8), w) },
            { label: 'P&rint Setup...', action: () => Sys.launch('CONTROL.EXE printers') }, '-',
            { label: 'E&xit', action: () => w.close() }] },
          { label: '&Edit', items: [
            { label: '&Undo', key: 'Ctrl+Z', action: undo }, '-',
            { label: 'Cu&t', key: 'Ctrl+X', disabled: () => !sel, action: () => { copySel(); liftSelection(); sel = null; clearOv(); } },
            { label: '&Copy', key: 'Ctrl+C', disabled: () => !sel, action: copySel },
            { label: '&Paste', key: 'Ctrl+V', disabled: () => !Sys.clipboard, action: paste }, '-',
            { label: 'C&opy To...', disabled: () => !sel, action: async () => { const img = selImage(); const p = await fileDialog({ mode: 'save', owner: w, defExt: 'BMP', filters: [['Bitmap Files (*.BMP)', '*.BMP']] }); if (p) FS.write(p, imgToURL(img)); } },
            { label: 'Paste &From...', action: async () => { const p = await fileDialog({ owner: w, filters: [['Bitmap Files (*.BMP)', '*.BMP']] }); if (!p) return; const n = FS.get(p); const url = n.g ? Wallpapers.gen(n.g)?.toDataURL() : n.x; if (url) { Sys.setClipboard({ type: 'image', data: url }); paste(); } } }] },
          { label: '&View', items: [
            { label: 'Zoom &In', key: 'Ctrl+N', disabled: () => zoom >= 8, action: () => { commitText(); dropSelection(); setZoom(8); } },
            { label: 'Zoom &Out', key: 'Ctrl+O', disabled: () => zoom === 1, action: () => setZoom(1) },
            { label: '&View Picture', key: 'Ctrl+P', action: () => {
              const v = h('div', { style: { position: 'absolute', inset: 0, background: '#000', zIndex: 300000, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, h('img', { src: cv.toDataURL(), style: { imageRendering: 'pixelated' } }));
              const close = () => { v.remove(); document.removeEventListener('keydown', close, true); };
              v.addEventListener('pointerdown', close); document.addEventListener('keydown', close, true);
              Sys.screen.appendChild(v);
            } }, '-',
            { label: '&Tools and Linesize', checked: () => toolbox.style.display !== 'none', action: () => { const on = toolbox.style.display === 'none'; toolbox.style.display = on ? '' : 'none'; scroller.style.left = on ? '56px' : '0'; } },
            { label: '&Palette', checked: () => palette.style.display !== 'none', action: () => { const on = palette.style.display === 'none'; palette.style.display = on ? '' : 'none'; scroller.style.bottom = toolbox.style.bottom = on ? '42px' : '0'; } },
            { label: '&Cursor Position', checked: () => coords.style.display !== 'none', action: () => { coords.style.display = coords.style.display === 'none' ? '' : 'none'; } }] },
          { label: '&Text', items: [
            { label: '&Regular', action: () => { textStyle.bold = textStyle.italic = textStyle.underline = false; } },
            { label: '&Bold', key: 'Ctrl+B', checked: () => textStyle.bold, action: ts('bold') },
            { label: '&Italic', key: 'Ctrl+I', checked: () => textStyle.italic, action: ts('italic') },
            { label: '&Underline', key: 'Ctrl+U', checked: () => textStyle.underline, action: ts('underline') }, '-',
            { label: '&Fonts...', action: fontsDlg }] },
          { label: '&Pick', items: [
            { label: 'Flip &Horizontal', disabled: () => !sel, action: () => xformSel((x, y, W) => [W - 1 - x, y]) },
            { label: 'Flip &Vertical', disabled: () => !sel, action: () => xformSel((x, y, W, H) => [x, H - 1 - y]) },
            { label: '&Inverse', disabled: () => !sel, action: () => xformSel((x, y) => [x, y, true]) },
            { label: '&Clear', disabled: () => !sel, action: () => { if (!sel) return; snapshot(); ctx.fillStyle = bg; ctx.fillRect(sel.x, sel.y, sel.w, sel.h); sel = null; clearOv(); } }] },
          { label: '&Options', items: [
            { label: '&Image Attributes...', action: attrsDlg },
            { label: '&Brush Shapes...', action: () => dialog({ title: 'Brush Shapes', w: 220, h: 70, owner: w, build(d) {
              const sq = UI.radio('bs', '&Square', !Store.get('pb.round', false)), rd = UI.radio('bs', '&Circle', Store.get('pb.round', false));
              d.add(sq, 10, 14); d.add(rd, 10, 40);
              d.add(UI.button('OK', { default: true, onClick: () => { Store.set('pb.round', rd.input.checked); d.close(); } }), 130, 8, 80, 25);
              d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 130, 38, 80, 25);
            } }) },
            { label: '&Edit Colors...', action: editColor }, { label: '&Get Colors...', action: () => paletteFile(false) }, { label: '&Save Colors...', action: () => paletteFile(true) }, '-',
            { label: '&Omit Picture Format', checked: false }] },
          { label: '&Help', items: [{ label: '&Contents', action: () => Sys.launch('WINHELP.EXE pbrush') }, { label: '&Search for Help on...', action: () => Sys.launch('WINHELP.EXE pbrush') }, { label: '&How to Use Help', action: () => Sys.launch('WINHELP.EXE winhelp') }, '-', { label: '&About Paintbrush...', action: () => aboutBox('Paintbrush', 'pbrush', w) }] }
        ]
      });
      w.body.append(toolbox, scroller, palette);
      setTool('brush'); renderSizes(); renderInd(); setZoom(1);
      if (opts.args) load(FS.full(opts.args.trim(), 'C:\\WINDOWS'));
      return w;
    }
  });
})();
