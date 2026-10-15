'use strict';
/* Clock — analog face rasterised pixel by pixel; digital readout in the bitmap font */
(() => {
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#fff';

  function drawAnalog(x, W, H, d, opts) {
    x.fillStyle = opts.bg; x.fillRect(0, 0, W, H);
    const cx = Math.floor(W / 2), cy = Math.floor(H / 2), R = Math.max(4, Math.floor(Math.min(W, H) / 2) - 3);
    // minute & hour marks
    for (let i = 0; i < 60; i++) {
      const a = i * Math.PI / 30, px = Math.round(cx + Math.sin(a) * R * 0.92), py = Math.round(cy - Math.cos(a) * R * 0.92);
      if (i % 5 === 0) { const s = Math.max(2, Math.round(R / 18)); x.fillStyle = opts.mark; x.fillRect(px - (s >> 1), py - (s >> 1), s, s); }
      else if (R > 30) { x.fillStyle = opts.fg; x.fillRect(px, py, 1, 1); }
    }
    const hand = (frac, len, width, color) => {
      const a = frac * Math.PI * 2;
      x.fillStyle = color;
      Raster.line(x, cx, cy, Math.round(cx + Math.sin(a) * R * len), Math.round(cy - Math.cos(a) * R * len), width);
    };
    const hh = d.getHours() % 12, mm = d.getMinutes(), ss = d.getSeconds();
    hand((hh + mm / 60) / 12, 0.5, Math.max(2, Math.round(R / 14)), opts.fg);
    hand((mm + ss / 60) / 60, 0.78, Math.max(1, Math.round(R / 22)), opts.fg);
    if (opts.seconds) hand(ss / 60, 0.85, 1, opts.fg);
    x.fillRect(cx - 1, cy - 1, 3, 3);
  }

  function drawDigital(x, W, H, d, opts) {
    x.fillStyle = opts.bg; x.fillRect(0, 0, W, H);
    let hh = d.getHours(); const ap = hh >= 12 ? 'PM' : 'AM'; hh = hh % 12 || 12;
    const t = `${hh}:${pad(d.getMinutes())}${opts.seconds ? ':' + pad(d.getSeconds()) : ''}`;
    if (opts.font && opts.font !== 'Pixel') {
      const date = opts.date ? dateStr(d) : '';
      const size = clamp(+opts.fontSize || 20, 8, 48);
      const family = WIN_FONTS[opts.font] || WIN_FONTS['MS Sans Serif'];
      const tmp = h('canvas'), c = tmp.getContext('2d');
      c.font = `${size}px ${family}`;
      const line = `${t} ${ap}`, width = Math.ceil(c.measureText(line).width + 8), lineH = Math.ceil(size * 1.35);
      tmp.width = Math.max(1, Math.min(W - 8, width)); tmp.height = lineH * (date ? 2 : 1);
      c.font = `${size}px ${family}`; c.fillStyle = opts.fg; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(line, tmp.width / 2, lineH / 2, tmp.width - 4);
      if (date) { c.font = `${Math.max(8, Math.round(size * .65))}px ${family}`; c.fillText(date, tmp.width / 2, lineH * 1.5, tmp.width - 4); }
      x.imageSmoothingEnabled = false;
      x.drawImage(tmp, Math.floor((W - tmp.width) / 2), Math.floor((H - tmp.height) / 2));
      return;
    }
    const lines = [t];
    if (opts.date) lines.push(dateStr(d));
    const g0 = new PixGrid(1, 1);
    const tw = g0.textW(t), aw = g0.textW(ap);
    const scale = Math.max(1, Math.floor(Math.min((W - 10) / (tw + aw / 2 + 4), (H - 10) / (lines.length === 2 ? 11 : 7))));
    const sub = Math.max(1, Math.floor(scale / 2));
    const totalW = tw * scale + 4 * scale + aw * sub;
    const g = new PixGrid(Math.ceil(totalW) + 2, (lines.length === 2 ? 11 : 6) * scale + 2);
    g.t(0, 0, t, 'K', scale);
    g.t(tw * scale + 3 * scale, 6 * scale - 6 * sub, ap, 'K', sub);
    if (opts.date) { const dw = g.textW(lines[1], sub); g.t(Math.max(0, Math.floor((totalW - dw) / 2)), 8 * scale, lines[1], 'K', sub); }
    const c = g.canvas();
    // recolour black glyph pixels to the window-text colour
    const tmp = h('canvas', { width: c.width, height: c.height }), tx = tmp.getContext('2d');
    tx.drawImage(c, 0, 0); tx.globalCompositeOperation = 'source-in'; tx.fillStyle = opts.fg; tx.fillRect(0, 0, c.width, c.height);
    x.imageSmoothingEnabled = false;
    x.drawImage(tmp, Math.floor((W - c.width) / 2), Math.floor((H - c.height) / 2));
  }

  Sys.registerApp('clock', {
    name: 'Clock', icon: 'clock', help: 'clock',
    run() {
      const st = Object.assign({ mode: 'analog', seconds: true, date: true, noTitle: false, top: false, font: 'Pixel', fontSize: 20 }, Store.get('clock', {}));
      const save = () => Store.set('clock', st);
      const cv = h('canvas', { style: { position: 'absolute', left: 0, top: 0, imageRendering: 'pixelated' } });
      const x = cv.getContext('2d');
      const paint = () => {
        const d = Sys.now();
        if (w.isMin) { if (w.iconCanvas) drawAnalog(w.iconCanvas.getContext('2d'), 32, 32, d, { bg: '#ffffff', fg: '#000000', mark: '#000080', seconds: false }); return; }
        const W = w.body.clientWidth, H = w.body.clientHeight;
        if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
        const opts = { bg: css('--window'), fg: css('--window-text'), mark: css('--active-title'), seconds: st.seconds, date: st.date, font: st.font, fontSize: st.fontSize };
        (st.mode === 'analog' ? drawAnalog : drawDigital)(x, W, H, d, opts);
        const title = st.mode === 'analog' && st.date ? `Clock - ${dateStr(d)}` : 'Clock';
        if (w.title !== title) w.setTitle(title);
      };
      const applyTitle = () => {
        w.tb.style.display = st.noTitle ? 'none' : '';
        w.mb.style.display = st.noTitle ? 'none' : '';
        requestAnimationFrame(paint);
      };
      const setFont = () => dialog({ title: 'Clock Font', w: 300, h: 150, owner: w, build(d) {
        const fonts = ['Pixel', 'Fixedsys', 'MS Sans Serif', 'Small Fonts', 'System'];
        const font = UI.combo({ items: fonts, index: Math.max(0, fonts.indexOf(st.font)) });
        const size = UI.combo({ items: ['12', '14', '16', '18', '20', '24', '28', '32', '40', '48'], index: ['12', '14', '16', '18', '20', '24', '28', '32', '40', '48'].indexOf(String(st.fontSize)) });
        d.add(UI.label('&Font:', font), 12, 16); d.add(font, 92, 12, 190);
        d.add(UI.label('&Size:', size), 12, 48); d.add(size, 92, 44, 90);
        d.add(h('div', { class: 'txt', text: 'Font settings apply to the digital clock.' }), 12, 80);
        d.add(UI.button('OK', { default: true, onClick: () => { st.font = fonts[font.index] || 'Pixel'; st.fontSize = +(size.value || '20'); save(); d.close(); paint(); } }), 112, 112, 80, 25);
        d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 202, 112, 80, 25);
      } });
      const w = new Win({
        title: 'Clock', icon: 'clock', w: 200, h: 220, minW: 60, minH: 40, persist: 'clock',
        drawIcon: c => drawAnalog(c.getContext('2d'), 32, 32, Sys.now(), { bg: '#ffffff', fg: '#000000', mark: '#000080', seconds: false }),
        iconTitle: () => '',
        onResize: () => paint(),
        topmost: st.top,
        extraSys: [{ label: 'Always on &Top', checked: () => st.top, action: () => { st.top = !st.top; w.o.topmost = st.top; save(); w.activate(); } }],
        menu: [{ label: '&Settings', items: [
          { label: '&Analog', checked: () => st.mode === 'analog', action: () => { st.mode = 'analog'; save(); paint(); } },
          { label: '&Digital', checked: () => st.mode === 'digital', action: () => { st.mode = 'digital'; save(); paint(); } }, '-',
          { label: 'Set &Font...', action: setFont }, '-',
          { label: '&No Title', checked: () => st.noTitle, action: () => { st.noTitle = !st.noTitle; save(); applyTitle(); } },
          { label: '&Seconds', checked: () => st.seconds, action: () => { st.seconds = !st.seconds; save(); paint(); } },
          { label: 'D&ate', checked: () => st.date, action: () => { st.date = !st.date; save(); paint(); } }, '-',
          { label: 'A&bout Clock...', action: () => aboutBox('Clock', 'clock', w) }] }]
      });
      w.body.appendChild(cv);
      w.body.addEventListener('dblclick', () => { st.noTitle = !st.noTitle; save(); applyTitle(); });
      w.body.addEventListener('pointerdown', e => {
        if (!st.noTitle || e.button !== 0) return;
        const sx = e.clientX, sy = e.clientY, ox = w.x, oy = w.y;
        w.body.setPointerCapture(e.pointerId);
        const mv = ev => w.move(ox + (ev.clientX - sx) / Sys.scale, oy + (ev.clientY - sy) / Sys.scale);
        const up = () => { w.body.removeEventListener('pointermove', mv); w.body.removeEventListener('pointerup', up); };
        w.body.addEventListener('pointermove', mv); w.body.addEventListener('pointerup', up);
      });
      const timer = setInterval(paint, 1000);
      const off = Sys.on('time', paint);
      w.on('closed', () => { clearInterval(timer); off(); });
      applyTitle();
      return w;
    }
  });
})();
