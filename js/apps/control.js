'use strict';
/* Control Panel and its applets. Every applet stores its values in Store,
   applies them immediately (Settings.changed) and mirrors them into
   WIN.INI / SYSTEM.INI / CONTROL.INI, like the real thing. */
(() => {
  const BASIC = ['#ff8080', '#ffff80', '#80ff80', '#00ff80', '#80ffff', '#0080ff', '#ff80c0', '#ff80ff',
    '#ff0000', '#ffff00', '#80ff00', '#00ff40', '#00ffff', '#0080c0', '#8080c0', '#ff00ff',
    '#804040', '#ff8040', '#00ff00', '#008080', '#004080', '#8080ff', '#800040', '#ff0080',
    '#800000', '#ff8000', '#008000', '#008040', '#0000ff', '#0000a0', '#800080', '#8000ff',
    '#400000', '#804000', '#004000', '#004040', '#000080', '#000040', '#400040', '#400080',
    '#000000', '#808000', '#808040', '#808080', '#408080', '#c0c0c0', '#400040', '#ffffff'];

  const ok = (d, fn, x, y = 8) => d.add(UI.button('OK', { default: true, onClick: () => { if (fn() !== false) d.close(true); } }), x, y, 76, 25);
  const cancel = (d, x, y = 38, fn) => d.add(UI.button('Cancel', { cancel: true, onClick: () => { if (fn) fn(); d.close(false); } }), x, y, 76, 25);
  const helpBtn = (d, x, y) => d.add(UI.button('&Help', { onClick: () => Sys.launch('WINHELP.EXE control') }), x, y, 76, 25);
  const askText = (owner, title, label, init = '', password = false) => new Promise(res => dialog({
    title, w: 260, h: 70, owner, build(d) {
      const t = UI.text(init, { password });
      d.add(UI.label(label, t), 10, 8); d.add(t, 10, 26, 160);
      d.add(UI.button('OK', { default: true, onClick: () => d.close(t.value) }), 178, 6, 74, 25);
      d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close(null) }), 178, 36, 74, 25);
    }
  }).promise.then(res));

  /* ---------------- Windows HLS colour model (0..240) ---------------- */
  const hls2rgb = (H, L, S) => {
    const h = H / 240, l = L / 240, s = S / 240;
    if (!s) { const v = Math.round(l * 255); return [v, v, v]; }
    const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => Math.round(v * 255));
  };
  const rgb2hls = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    return [Math.round(h * 240) % 240, Math.round(l * 240), Math.round(s * 240)];
  };
  const toHex = ([r, g, b]) => '#' + [r, g, b].map(v => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('');
  const fromHex = hx => [1, 3, 5].map(i => parseInt(hx.slice(i, i + 2), 16));

  /* Custom Color Selector */
  function customColorDlg(owner, start, onAdd) {
    let [H, L, S] = rgb2hls(...fromHex(start || '#808080'));
    return dialog({
      title: 'Custom Color Selector', w: 300, h: 228, owner, modal: true,
      build(d) {
        const spec = h('canvas', { width: 140, height: 120, style: { border: '1px solid #000', imageRendering: 'pixelated' } });
        const lum = h('canvas', { width: 12, height: 120, style: { border: '1px solid #000', imageRendering: 'pixelated' } });
        const sample = h('div', { style: { border: '1px solid #000', display: 'flex' } }, h('div', { style: { flex: 1 } }), h('div', { style: { flex: 1 } }));
        const fields = {};
        const sx = spec.getContext('2d');
        const img = sx.createImageData(140, 120);
        for (let y = 0; y < 120; y++) for (let x = 0; x < 140; x++) {
          const [r, g, b] = hls2rgb(x / 140 * 240, 120, 240 - y / 120 * 240);
          img.data.set([r, g, b, 255], (y * 140 + x) * 4);
        }
        const paint = () => {
          sx.putImageData(img, 0, 0);
          const cx = Math.round(H / 240 * 140), cy = Math.round((240 - S) / 240 * 120);
          sx.fillStyle = '#000'; sx.fillRect(cx - 5, cy, 4, 1); sx.fillRect(cx + 2, cy, 4, 1); sx.fillRect(cx, cy - 5, 1, 4); sx.fillRect(cx, cy + 2, 1, 4);
          const lx = lum.getContext('2d');
          for (let y = 0; y < 120; y++) { lx.fillStyle = toHex(hls2rgb(H, 240 - y / 120 * 240, S)); lx.fillRect(0, y, 12, 1); }
          lx.fillStyle = '#000'; lx.fillRect(0, Math.round((240 - L) / 240 * 119), 12, 1);
          const rgb = hls2rgb(H, L, S), hex = toHex(rgb);
          sample.children[0].style.background = hex;
          sample.children[1].style.background = nearestSolid(hex);
          [['h', H], ['s', S], ['l', L], ['r', rgb[0]], ['g', rgb[1]], ['b', rgb[2]]].forEach(([k, v]) => { if (document.activeElement !== fields[k]) fields[k].value = v; });
        };
        const drag = (el, fn) => el.addEventListener('pointerdown', e => {
          el.setPointerCapture(e.pointerId); fn(e);
          const mv = ev => fn(ev), up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); };
          el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
        });
        drag(spec, e => { const p = Sys.pointer(e, spec); H = clamp(Math.round(p.x / 140 * 240), 0, 239); S = clamp(Math.round(240 - p.y / 120 * 240), 0, 240); paint(); });
        drag(lum, e => { const p = Sys.pointer(e, lum); L = clamp(Math.round(240 - p.y / 120 * 240), 0, 240); paint(); });
        d.add(spec, 10, 10); d.add(lum, 160, 10);
        d.add(sample, 10, 140, 70, 40); d.add(UI.label('Color|Sol&id'), 10, 184);
        const mk = (k, label, x, y, max) => {
          const t = UI.text(''); fields[k] = t;
          t.addEventListener('change', () => {
            const v = clamp(parseInt(t.value) || 0, 0, max);
            if ('hsl'.includes(k)) { if (k === 'h') H = Math.min(v, 239); if (k === 's') S = v; if (k === 'l') L = v; }
            else { const rgb = hls2rgb(H, L, S); rgb['rgb'.indexOf(k)] = v; [H, L, S] = rgb2hls(...rgb); }
            paint();
          });
          d.add(UI.label(label, t), x, y + 4); d.add(t, x + 44, y, 40, 20);
        };
        mk('h', '&Hue:', 92, 140, 239); mk('s', '&Sat:', 92, 164, 240); mk('l', '&Lum:', 92, 188, 240);
        mk('r', '&Red:', 192, 140, 255); mk('g', '&Green:', 192, 164, 255); mk('b', '&Blue:', 192, 188, 255);
        d.add(UI.button('Close', { cancel: true, onClick: () => d.close() }), 190, 10, 100, 25);
        d.add(UI.button('&Help', { onClick: () => Sys.launch('WINHELP.EXE control') }), 190, 40, 100, 25);
        d.add(UI.button('&Add Color', { default: true, onClick: () => onAdd(toHex(hls2rgb(H, L, S))) }), 190, 80, 100, 25);
        paint();
      }
    });
  }
  /* "Solid" half of the sample: the nearest pure VGA colour */
  function nearestSolid(hex) {
    const [r, g, b] = fromHex(hex);
    let best = '#000000', bd = 1e9;
    for (const v of Object.values(PAL)) { const d = (v[0] - r) ** 2 + (v[1] - g) ** 2 + (v[2] - b) ** 2; if (d < bd) { bd = d; best = toHex(v); } }
    return best;
  }

  /* ---------------- Color ---------------- */
  function colorApplet(owner) {
    let colors = Sys.currentColors();
    let scheme = Object.keys(Store.get('colorsOverride', {})).length ? '(Untitled)' : Store.get('scheme', 'Windows Default');
    let element = 'desktop';
    let expanded = false;
    const custom = () => Store.get('customSchemes', {});
    const allSchemes = () => [...Object.keys(Sys.schemes), ...Object.keys(custom()).sort()];
    return dialog({
      title: 'Color', w: 334, h: 318, owner,
      build(d) {
        const names = allSchemes();
        const cb = UI.combo({ items: names, index: Math.max(0, names.indexOf(scheme)), onChange: it => {
          scheme = it.text; colors = Object.assign({}, Sys.schemes['Windows Default'], Sys.schemes[scheme] || custom()[scheme]); paint();
        } });
        if (scheme === '(Untitled)') cb.set(-1, false);
        d.add(UI.label('Color &Schemes', cb), 10, 8); d.add(cb, 10, 26, 314);
        d.add(UI.button('Sa&ve Scheme', { onClick: async () => {
          const nm = (await askText(d.win, 'Save Scheme', 'Save this color scheme as:', scheme.startsWith('(') ? '' : scheme) || '').trim();
          if (!nm) return;
          if (Sys.schemes[nm]) { msgBox('You cannot replace a predefined scheme.', 'Color', { icon: 'exclaim', owner: d.win }); return; }
          const c = { ...custom() }; c[nm] = { ...colors }; Store.set('customSchemes', c);
          scheme = nm; cb.setItems(allSchemes(), allSchemes().indexOf(nm));
        } }), 10, 54, 150, 24);
        d.add(UI.button('&Remove Scheme', { onClick: async () => {
          if (scheme.startsWith('(')) { Snd.beep(); return; }
          if (Sys.schemes[scheme]) { msgBox('You cannot remove a predefined scheme.', 'Color', { icon: 'exclaim', owner: d.win }); return; }
          const r = await msgBox(`Are you sure you want to remove the scheme '${scheme}'?`, 'Color', { buttons: 'yesno', icon: 'question', owner: d.win });
          if (r !== 'yes') return;
          const c = { ...custom() }; delete c[scheme]; Store.set('customSchemes', c);
          scheme = 'Windows Default'; cb.setItems(allSchemes(), 0); colors = Object.assign({}, Sys.schemes[scheme]); paint();
        } }), 170, 54, 154, 24);

        // preview: click an element to select it (when the palette is open)
        const pv = h('div', { style: { border: '1px solid #000', overflow: 'hidden', position: 'absolute' } });
        pv.innerHTML = `
          <div data-e="desktop" style="position:absolute;inset:0;background:var(--desktop)"></div>
          <div data-e="inactive-border" style="position:absolute;left:8px;top:8px;width:210px;height:70px;border:1px solid var(--window-frame);background:var(--inactive-border);padding:3px">
            <div data-e="inactive-title" style="height:18px;background:var(--inactive-title);color:var(--inactive-title-text);text-align:center;border:1px solid var(--window-frame)">Inactive</div></div>
          <div data-e="active-border" style="position:absolute;left:24px;top:34px;width:270px;height:134px;border:1px solid var(--window-frame);background:var(--active-border);padding:3px;display:flex;flex-direction:column">
            <div data-e="active-title" style="height:18px;flex:none;background:var(--active-title);color:var(--active-title-text);text-align:center;border:1px solid var(--window-frame)">Active</div>
            <div data-e="menu" style="height:18px;flex:none;background:var(--menu);color:var(--menu-text);border:1px solid var(--window-frame);border-top:0;padding:0 4px;display:flex;gap:10px"><span data-e="menu-text">File</span><span data-e="disabled-text" style="color:var(--disabled-text)">Edit</span><span data-e="highlight" style="background:var(--highlight);color:var(--highlight-text);padding:0 3px">Help</span></div>
            <div data-e="app-workspace" style="flex:1;background:var(--app-workspace);border:1px solid var(--window-frame);border-top:0;position:relative">
              <div data-e="window" style="position:absolute;left:6px;top:6px;right:24px;bottom:6px;background:var(--window);color:var(--window-text);border:1px solid var(--window-frame);padding:3px"><span data-e="window-text">Window Text</span>
                <div data-e="btn-face" style="position:absolute;right:6px;bottom:6px;width:48px;height:20px;background:var(--btn-face);color:var(--btn-text);border:1px solid #000;text-align:center;box-shadow:inset 1px 1px 0 var(--btn-highlight),inset -1px -1px 0 var(--btn-shadow)">OK</div></div>
              <div data-e="scrollbar" style="position:absolute;right:6px;top:6px;bottom:6px;width:16px;background:var(--scrollbar);border:1px solid var(--window-frame)"></div>
            </div></div>`;
        d.add(pv, 10, 86, 314, 180);
        const paint = () => { for (const k of Sys.schemeKeys) pv.style.setProperty('--' + k, colors[k]); };
        pv.addEventListener('pointerdown', e => {
          if (!expanded) return;
          const t = e.target.closest('[data-e]');
          if (t) { element = t.dataset.e; elCb.set(Sys.schemeKeys.indexOf(element), false); }
        });

        // palette panel
        const setColor = c => { colors[element] = c; scheme = '(Untitled)'; cb.set(-1, false); paint(); };
        const elCb = UI.combo({ items: Sys.schemeKeys.map(k => Sys.schemeLabels[k]), index: 0, onChange: (_, i) => { element = Sys.schemeKeys[i]; } });
        const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(8, 22px)', gap: '4px' } });
        BASIC.forEach(c => {
          const sw = h('div', { style: { width: '22px', height: '18px', background: c, border: '1px solid #000' } });
          sw.addEventListener('pointerdown', () => setColor(c));
          grid.appendChild(sw);
        });
        const cust = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(8, 22px)', gap: '4px' } });
        const renderCustom = () => {
          cust.innerHTML = '';
          const cc = Store.get('customColors', []);
          for (let i = 0; i < 16; i++) {
            const c = cc[i] || '#ffffff';
            const sw = h('div', { style: { width: '22px', height: '18px', background: c, border: '1px solid #000' } });
            sw.addEventListener('pointerdown', () => setColor(c));
            cust.appendChild(sw);
          }
        };
        renderCustom();
        const panel = h('div', { style: { position: 'absolute', left: Math.round(338 * d.k) + 'px', top: '0', width: '276px', height: '318px', display: 'none' } });
        const pd = { add: (c, x, y, w, hh) => { UI.place(c, x, y, w, hh); panel.appendChild(c.el || c); } };
        pd.add(UI.label('Screen &Element:', elCb), 0, 8); pd.add(elCb, 0, 26, 220);
        pd.add(UI.label('&Basic Colors:'), 0, 56); pd.add(grid, 0, 74);
        pd.add(UI.label('&Custom Colors:'), 0, 220); pd.add(cust, 0, 238);
        pd.add(UI.button('&Define Custom Colors...', { onClick: () => customColorDlg(d.win, colors[element], c => {
          const cc = Store.get('customColors', []).slice();
          let i = cc.length < 16 ? cc.length : (Store.get('customNext', 0) % 16);
          cc[i] = c; Store.set('customColors', cc); Store.set('customNext', i + 1);
          renderCustom();
        }) }), 0, 286, 220, 24);
        d.body.appendChild(panel);

        d.add(UI.button('OK', { default: true, onClick: () => {
          if (scheme === '(Untitled)') {
            const base = Object.assign({}, Sys.schemes['Windows Default'], Sys.schemes[Store.get('scheme')] || custom()[Store.get('scheme')] || {});
            Store.set('colorsOverride', Object.fromEntries(Object.entries(colors).filter(([k, v]) => base[k] !== v)));
          } else { Store.set('scheme', scheme); Store.set('colorsOverride', {}); }
          d.close(true);
          Settings.changed();
        } }), 10, 280, 56, 25);
        d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 72, 280, 66, 25);
        d.add(UI.button('&Help', { onClick: () => Sys.launch('WINHELP.EXE control') }), 144, 280, 56, 25);
        const exp = UI.button('Color &Palette >>', { onClick: () => {
          expanded = true; exp.disabled = true; panel.style.display = '';
          d.resize(574, 318);
          d.win.keepVisible();
        } });
        d.add(exp, 206, 280, 118, 25);
        paint();
      }
    });
  }

  /* ---------------- Desktop ---------------- */
  function patternEditor(owner, start) {
    return dialog({
      title: 'Desktop - Edit Pattern', w: 330, h: 170, owner,
      build(d) {
        const allPats = () => Object.assign({}, Sys.patterns, Store.get('customPatterns', {}));
        const names = () => Object.keys(allPats()).filter(n => n !== '(None)');
        let name = start === '(None)' ? 'Boxes' : start;
        let bits = (allPats()[name] || [0, 0, 0, 0, 0, 0, 0, 0]).slice();
        const nm = UI.combo({ items: names(), onChange: it => { name = it.text; bits = allPats()[name].slice(); draw(); } });
        nm.setText(name);
        d.add(UI.label('&Name:', nm), 10, 10); d.add(nm, 60, 6, 150);
        const sample = h('div', { style: { border: '1px solid #000' } });
        d.add(UI.label('Sample'), 10, 38); d.add(sample, 10, 56, 90, 100);
        const ed = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(8, 12px)', border: '1px solid #000', width: '98px' } });
        const cells = [];
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
          const c = h('div', { style: { width: '12px', height: '12px' } });
          c.addEventListener('pointerdown', () => { bits[y] ^= (128 >> x); draw(); });
          cells.push(c); ed.appendChild(c);
        }
        d.add(ed, 112, 56);
        const draw = () => {
          const bg = Sys.currentColors().desktop;
          cells.forEach((c, i) => c.style.background = bits[i >> 3] & (128 >> (i & 7)) ? '#000' : bg);
          sample.style.background = `url(${Sys.patternURL(bits, bg)})`;
        };
        d.add(UI.button('OK', { default: true, onClick: () => d.close(name) }), 240, 8, 80, 25);
        d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close(null) }), 240, 38, 80, 25);
        d.add(UI.button('&Add', { onClick: async () => {
          const n = ((await askText(d.win, 'Add Pattern', 'Pattern &name:', '')) || '').trim();
          if (!n) return;
          if (Sys.patterns[n]) { msgBox(`The pattern '${n}' already exists.`, 'Desktop', { icon: 'exclaim', owner: d.win }); return; }
          const cp = { ...Store.get('customPatterns', {}) }; cp[n] = bits.slice(); Store.set('customPatterns', cp);
          name = n; nm.setItems(names()); nm.setText(n);
        } }), 240, 74, 80, 25);
        d.add(UI.button('&Change', { onClick: () => {
          if (Sys.patterns[name]) { msgBox('You cannot change a predefined pattern. Type a new name and choose Add.', 'Desktop', { icon: 'info', owner: d.win }); return; }
          const cp = { ...Store.get('customPatterns', {}) }; cp[name] = bits.slice(); Store.set('customPatterns', cp);
        } }), 240, 104, 80, 25);
        d.add(UI.button('&Remove', { onClick: async () => {
          const cp = { ...Store.get('customPatterns', {}) };
          if (!cp[name]) { msgBox('You cannot remove a predefined pattern.', 'Desktop', { icon: 'exclaim', owner: d.win }); return; }
          if (await msgBox(`Remove pattern '${name}'?`, 'Desktop', { buttons: 'yesno', icon: 'question', owner: d.win }) !== 'yes') return;
          delete cp[name]; Store.set('customPatterns', cp);
          if (Store.get('pattern') === name) Store.set('pattern', '(None)');
          name = 'Boxes'; nm.setItems(names()); nm.setText(name); bits = allPats()[name].slice(); draw();
        } }), 240, 134, 80, 25);
        draw();
      }
    }).promise;
  }

  function passwordDlg(owner) {
    const has = !!Store.get('saverPassword', '');
    return dialog({
      title: 'Change Password', w: 300, h: has ? 110 : 82, owner, build(d) {
        const old = UI.text('', { password: true }), nw = UI.text('', { password: true }), re = UI.text('', { password: true });
        let y = 10;
        if (has) { d.add(UI.label('&Old Password:', old), 10, y + 4); d.add(old, 130, y, 100); y += 28; }
        d.add(UI.label('&New Password:', nw), 10, y + 4); d.add(nw, 130, y, 100); y += 28;
        d.add(UI.label('&Retype New Password:', re), 10, y + 4); d.add(re, 150, y, 80);
        d.add(UI.button('OK', { default: true, onClick: async () => {
          if (has && old.value !== Store.get('saverPassword', '')) { await msgBox('Incorrect old password.', 'Change Password', { icon: 'stop', owner: d.win }); return; }
          if (nw.value !== re.value) { await msgBox('The new password and its confirmation do not match.', 'Change Password', { icon: 'stop', owner: d.win }); return; }
          Store.set('saverPassword', nw.value); d.close(true);
        } }), 242, 8, 50, 25);
        d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close(false) }), 242, 38, 50, 25);
      }
    }).promise;
  }

  function saverSetup(owner, name) {
    if (name === '(None)') return msgBox('No screen saver is selected.', 'Screen Saver', { icon: 'info', owner });
    const extras = {
      'Marquee': { h: 120, build(d) {
        const t = UI.text(Store.get('marqueeText', 'Neo31 - Windows 3.1'));
        const cols = { Yellow: '#ffff00', White: '#ffffff', Red: '#ff0000', Lime: '#00ff00', Aqua: '#00ffff', Fuchsia: '#ff00ff' };
        const col = UI.combo({ items: Object.keys(cols) });
        col.setText(Object.keys(cols).find(k => cols[k] === Store.get('marqueeColor', '#ffff00')) || 'Yellow');
        const sp = UI.slider({ min: 30, max: 400, value: Store.get('marqueeSpeed', 120) });
        d.add(UI.label('&Text:', t), 10, 12); d.add(t, 70, 8, 170);
        d.add(UI.label('&Color:', col), 10, 44); d.add(col, 70, 40, 120);
        d.add(UI.label('&Speed:', sp), 10, 80); d.add(sp, 70, 78, 170);
        return () => { Store.set('marqueeText', t.value); Store.set('marqueeColor', cols[col.value.text]); Store.set('marqueeSpeed', sp.value); };
      } },
      'Flying Windows': { h: 100, build(d) { return speedDensity(d, 'fly', 'Number of &Windows', 120, 40); } },
      'Starfield Simulation': { h: 100, build(d) { return speedDensity(d, 'star', '&Starfield Density', 600, 200); } },
      'Mystify': { h: 100, build(d) {
        const n = UI.slider({ min: 1, max: 4, step: 1, value: Store.get('mystPolys', 2) });
        const tr = UI.slider({ min: 2, max: 10, step: 1, value: Store.get('mystTrail', 5) });
        d.add(UI.label('&Polygons'), 10, 10); d.add(n, 10, 28, 210);
        d.add(UI.label('&Lines per Polygon'), 10, 54); d.add(tr, 10, 72, 210);
        return () => { Store.set('mystPolys', n.value); Store.set('mystTrail', tr.value); };
      } },
      'Blank Screen': { h: 0, build() { return () => {}; } }
    };
    function speedDensity(d, p, label, max, def) {
      const sp = UI.slider({ min: 5, max: 100, value: Store.get(p + 'Speed', 50) });
      const dn = UI.slider({ min: 10, max, value: Store.get(p + 'Count', def) });
      d.add(UI.label('&Warp Speed'), 10, 10); d.add(sp, 10, 28, 210);
      d.add(UI.label(label), 10, 54); d.add(dn, 10, 72, 210);
      return () => { Store.set(p + 'Speed', sp.value); Store.set(p + 'Count', dn.value); };
    }
    const ex = extras[name];
    return dialog({
      title: name + ' Setup', w: 340, h: ex.h + 74, owner, build(d) {
        const commit = ex.build(d);
        const y = ex.h + 4;
        d.add(UI.group('Password Options'), 8, y, 240, 62);
        const pw = UI.check('&Password Protected', Store.get('saverPwOn', false));
        const setBtn = UI.button('&Set Password...', { onClick: () => passwordDlg(d.win) });
        d.add(pw, 18, y + 22); d.add(setBtn, 18, y + 40, 130, 20);
        ok(d, () => {
          if (pw.input.checked && !Store.get('saverPassword', '')) { passwordDlg(d.win); return false; }
          commit(); Store.set('saverPwOn', pw.input.checked); IniSync.write();
        }, 256);
        cancel(d, 256);
      }
    });
  }

  function desktopApplet(owner) {
    return dialog({
      title: 'Desktop', w: 440, h: 330, owner,
      build(d) {
        const patNames = () => ['(None)', ...Object.keys(Sys.patterns).filter(n => n !== '(None)'), ...Object.keys(Store.get('customPatterns', {}))];
        d.add(UI.group('Pattern'), 8, 4, 220, 64);
        const pat = UI.combo({ items: patNames() }); pat.setText(Store.get('pattern', '(None)'));
        d.add(UI.label('&Name:', pat), 16, 26); d.add(pat, 60, 22, 160);
        d.add(UI.button('&Edit Pattern...', { onClick: async () => { const r = await patternEditor(d.win, pat.value ? pat.value.text : '(None)'); pat.setItems(patNames()); pat.setText(r || Store.get('pattern', '(None)')); } }), 60, 46, 120, 20);

        d.add(UI.group('Applications'), 228, 4, 204, 64);
        const fast = UI.check('&Fast "Alt+Tab" Switching', Store.get('fastSwitch', true)); d.add(fast, 236, 30);

        d.add(UI.group('Screen Saver'), 8, 72, 424, 64);
        const sv = UI.combo({ items: Saver.list }); sv.setText(Store.get('saver', '(None)'));
        const delay = UI.text(String(Store.get('saverDelay', 2)), { maxLength: 2 });
        d.add(UI.label('N&ame:', sv), 16, 94); d.add(sv, 60, 90, 160);
        d.add(UI.button('&Test', { onClick: () => {
          if (sv.value.text === '(None)') return;
          d.win.el.style.visibility = 'hidden';
          setTimeout(() => { Saver.start(sv.value.text, null, true); const iv = setInterval(() => { if (!Saver.active) { clearInterval(iv); d.win.el.style.visibility = ''; } }, 200); }, 300);
        } }), 232, 89, 70, 22);
        d.add(UI.button('Set&up...', { onClick: () => saverSetup(d.win, sv.value.text) }), 310, 89, 70, 22);
        d.add(UI.label('&Delay:', delay), 16, 116); d.add(delay, 60, 112, 40, 20); d.add(UI.label('Minutes'), 106, 116);

        d.add(UI.group('Wallpaper'), 8, 140, 200, 80);
        const wps = ['(None)', ...(FS.list('C:\\WINDOWS') || []).filter(e => FS.ext(e.name) === 'BMP').map(e => e.name.toLowerCase())];
        const cur = Store.get('wallpaper', '(None)');
        const wp = UI.combo({ items: wps.includes(cur.toLowerCase()) || cur === '(None)' ? wps : [...wps, cur.toLowerCase()] });
        wp.setText(cur === '(None)' ? '(None)' : cur.toLowerCase());
        d.add(UI.label('&File:', wp), 16, 162); d.add(wp, 50, 158, 150);
        const center = UI.radio('wpm', '&Center', !Store.get('wallTile', true)), tile = UI.radio('wpm', '&Tile', Store.get('wallTile', true));
        d.add(center, 50, 192); d.add(tile, 120, 192);

        d.add(UI.group('Icons'), 224, 140, 208, 80);
        const sp = UI.text(String(Store.get('iconSpacing', 75)), { maxLength: 3 });
        d.add(UI.label('&Spacing:', sp), 232, 166); d.add(sp, 292, 162, 40, 20); d.add(UI.label('Pixels'), 338, 166);
        const wrap = UI.check('&Wrap Title', Store.get('iconWrap', true)); d.add(wrap, 232, 194);

        d.add(UI.group('Sizing Grid'), 8, 224, 200, 70);
        const gran = UI.text(String(Store.get('granularity', 0)), { maxLength: 2 }), bw = UI.text(String(Store.get('borderWidth', 3)), { maxLength: 2 });
        d.add(UI.label('&Granularity:', gran), 16, 246); d.add(gran, 110, 242, 40, 20);
        d.add(UI.label('&Border Width:', bw), 16, 270); d.add(bw, 110, 266, 40, 20);

        d.add(UI.group('Cursor Blink Rate'), 224, 224, 208, 70);
        d.add(UI.label('Slow'), 232, 248); d.add(UI.label('Fast'), 396, 248);
        const blinkSample = h('div', { style: { width: '2px', height: '14px', background: '#000' } });
        d.add(blinkSample, 312, 248);
        const blink = UI.slider({ min: 100, max: 1000, value: 1100 - Store.get('blink', 530), onChange: () => {} }); d.add(blink, 232, 266, 192);
        const bl = () => { if (!blinkSample.isConnected) return; blinkSample.style.visibility = blinkSample.style.visibility === 'hidden' ? '' : 'hidden'; setTimeout(bl, 1100 - blink.value); };
        setTimeout(bl, 1100 - blink.value);

        const num = (t, lo, hi, label) => { const v = parseInt(t.value); if (isNaN(v) || v < lo || v > hi) { msgBox(`${label} must be between ${lo} and ${hi}.`, 'Desktop', { icon: 'exclaim', owner: d.win }).then(() => { t.focus(); t.select(); }); return null; } return v; };
        ok(d, () => {
          const dl = num(delay, 1, 99, 'Delay'), spc = num(sp, 32, 512, 'Icon spacing'), gr = num(gran, 0, 49, 'Granularity'), bwd = num(bw, 1, 49, 'Border width');
          if (dl == null || spc == null || gr == null || bwd == null) return false;
          Store.set('pattern', pat.value ? pat.value.text : '(None)');
          Store.set('fastSwitch', fast.input.checked);
          Store.set('saver', sv.value.text);
          Store.set('saverDelay', dl);
          Store.set('wallpaper', wp.value.text === '(None)' ? '(None)' : wp.value.text.toUpperCase());
          Store.set('wallTile', tile.input.checked);
          const spacingChanged = spc !== Store.get('iconSpacing', 75) || wrap.input.checked !== Store.get('iconWrap', true);
          Store.set('iconSpacing', spc);
          Store.set('iconWrap', wrap.input.checked);
          Store.set('granularity', gr);
          Store.set('borderWidth', bwd);
          Store.set('blink', 1100 - blink.value);
          Settings.changed();
          if (spacingChanged) Sys.desktop.arrangeIcons();
        }, 8, 302);
        cancel(d, 92, 302);
        helpBtn(d, 176, 302);
        d.resize(440, 334);
      }
    });
  }

  /* ---------------- Mouse ---------------- */
  function mouseApplet(owner) {
    const orig = { swapButtons: Store.get('swapButtons', false), dblClick: Store.get('dblClick', 452) };
    return dialog({
      title: 'Mouse', w: 380, h: 190, owner,
      build(d) {
        d.add(UI.group('Mouse Tracking Speed'), 8, 4, 270, 56);
        const tr = UI.slider({ min: 1, max: 10, step: 1, value: Store.get('mouseSpeed', 5) });
        d.add(UI.label('Slow'), 16, 22); d.add(UI.label('Fast'), 240, 22); d.add(tr, 16, 38, 250);
        d.add(UI.group('Double Click Speed'), 8, 64, 270, 56);
        // live: the TEST box and every double-click use the new speed while the dialog is open
        const dc = UI.slider({ min: 100, max: 900, value: 1000 - Store.get('dblClick', 452), onChange: v => Store.set('dblClick', 1000 - v) });
        d.add(UI.label('Slow'), 16, 82); d.add(UI.label('Fast'), 240, 82); d.add(dc, 16, 98, 250);
        const test = h('div', { style: { border: '1px solid #000', background: '#fff', color: '#000', textAlign: 'center', lineHeight: '38px' }, text: 'TEST' });
        test.addEventListener('dblclick', () => { const inv = test.style.background !== 'rgb(0, 0, 0)'; test.style.background = inv ? '#000' : '#fff'; test.style.color = inv ? '#fff' : '#000'; });
        d.add(test, 196, 128, 80, 40);
        // live, as in 3.1: the buttons swap the moment the box is checked
        const swap = UI.check('&Swap Left/Right Buttons', Store.get('swapButtons', false), v => { Store.set('swapButtons', v); lr(); });
        const lrEl = h('div', { style: { display: 'flex', border: '1px solid #000', width: '40px', height: '20px', background: '#fff' } }, h('div', { style: { flex: 1, borderRight: '1px solid #000', textAlign: 'center' } }), h('div', { style: { flex: 1, textAlign: 'center' } }));
        const lr = () => { const s = Store.get('swapButtons', false); lrEl.children[0].textContent = s ? 'R' : 'L'; lrEl.children[1].textContent = s ? 'L' : 'R'; };
        lr();
        const trails = UI.check('Mouse &Trails', Store.get('trails', false));
        d.add(swap, 10, 132); d.add(trails, 10, 156); d.add(lrEl, 300, 110);
        ok(d, () => {
          Store.set('mouseSpeed', tr.value); Store.set('dblClick', 1000 - dc.value);
          Store.set('swapButtons', swap.input.checked); Store.set('trails', trails.input.checked);
          Settings.changed();
        }, 292);
        cancel(d, 292, 38, () => { Store.set('swapButtons', orig.swapButtons); Store.set('dblClick', orig.dblClick); });
        helpBtn(d, 292, 68);
      }
    });
  }

  /* ---------------- Date/Time ---------------- */
  function dateTimeApplet(owner) {
    const o = Intl31.get();
    return dialog({
      title: 'Date & Time', w: 320, h: 84, owner,
      build(d) {
        let edited = false;
        const f = (w) => { const t = UI.text(''); t.style.textAlign = 'center'; t.maxLength = w; t.addEventListener('input', () => { edited = true; }); return t; };
        const mo = f(2), dd = f(2), yy = f(o.iCentury ? 4 : 2);
        const hh = f(2), mi = f(2), ss = f(2), ap = f(4);
        const order = o.iDate === 1 ? [dd, mo, yy] : o.iDate === 2 ? [yy, mo, dd] : [mo, dd, yy];
        const fill = () => {
          if (edited) return;
          const n = Sys.now();
          mo.value = o.iDayLZero ? pad(n.getMonth() + 1) : n.getMonth() + 1; dd.value = o.iDayLZero ? pad(n.getDate()) : n.getDate();
          yy.value = o.iCentury ? n.getFullYear() : pad(n.getFullYear() % 100);
          const H = n.getHours();
          hh.value = o.iTime === 1 ? (o.iTLZero ? pad(H) : H) : (H % 12 || 12); mi.value = pad(n.getMinutes()); ss.value = pad(n.getSeconds());
          ap.value = H >= 12 ? (o.s2359 || 'PM') : (o.s1159 || 'AM');
        };
        d.add(UI.label('&Date', order[0]), 10, 14);
        order.forEach((t, i) => { d.add(t, 60 + i * 42, 10, i === order.indexOf(yy) && o.iCentury ? 40 : 32); if (i < 2) d.add(h('div', { class: 'txt', text: o.sDate }), 94 + i * 42, 14); });
        d.add(UI.label('&Time', hh), 10, 48);
        const tf = o.iTime === 1 ? [hh, mi, ss] : [hh, mi, ss, ap];
        tf.forEach((t, i) => { d.add(t, 60 + i * 42, 44, i === 3 ? 38 : 32); if (i < 2) d.add(h('div', { class: 'txt', text: o.sTime }), 94 + i * 42, 48); });
        fill();
        const iv = setInterval(() => { if (!d.win.closed) fill(); else clearInterval(iv); }, 1000);
        ok(d, () => {
          if (!edited) return;
          let H = parseInt(hh.value) || 0;
          if (o.iTime !== 1) H = (H % 12) + (/p/i.test(ap.value) || ap.value === o.s2359 && o.s2359 ? 12 : 0);
          let yr = parseInt(yy.value); if (yr < 100) yr += yr < 80 ? 2000 : 1900;
          const target = new Date(yr, (parseInt(mo.value) || 1) - 1, parseInt(dd.value) || 1, H, parseInt(mi.value) || 0, parseInt(ss.value) || 0);
          if (isNaN(target) || target.getMonth() !== (parseInt(mo.value) || 1) - 1 || H > 23) { msgBox('Please enter a valid date and time.', 'Date & Time', { icon: 'exclaim', owner: d.win }); return false; }
          Store.set('clockOffset', target.getTime() - Date.now());
          Sys.emit('time');
        }, 232);
        cancel(d, 232, 40);
        d.add(UI.button('&Reset', { onClick: () => { Store.set('clockOffset', 0); Sys.emit('time'); edited = false; fill(); } }), 232, 72, 76, 20);
        d.resize(320, 96);
      }
    });
  }

  /* ---------------- Sound ---------------- */
  function soundApplet(owner) {
    const map = Object.assign({}, Snd.defaultMap, Store.get('soundMap', {}));
    return dialog({
      title: 'Sound', w: 420, h: 190, owner,
      build(d) {
        const evKeys = Object.keys(Snd.events);
        const wavs = ['<none>', ...(FS.list('C:\\WINDOWS') || []).filter(e => FS.ext(e.name) === 'WAV').map(e => e.name.toLowerCase())];
        const files = UI.listbox({ items: wavs, onSelect: it => { map[evKeys[evs.sel]] = it.text === '<none>' ? '<none>' : it.text.toUpperCase(); }, onActivate: () => test() });
        const evs = UI.listbox({ items: evKeys.map(k => Snd.events[k]), onSelect: (_, i) => files.selectText((map[evKeys[i]] || '<none>').toLowerCase()), onActivate: () => test() });
        d.add(UI.label('&Events:', evs), 8, 6); d.add(evs, 8, 24, 150, 130);
        d.add(UI.label('&Files:', files), 168, 6); d.add(files, 168, 24, 150, 130);
        const en = UI.check('E&nable System Sounds', Store.get('sounds', true), v => { files.el.style.opacity = v ? '' : '.6'; });
        d.add(en, 8, 164);
        const test = () => { const f = files.value && files.value.text; if (f && f !== '<none>') Snd.playFile('C:\\WINDOWS\\' + f); };
        ok(d, () => { Store.set('soundMap', map); Store.set('sounds', en.input.checked); Settings.changed(); }, 334, 24);
        cancel(d, 334, 54);
        d.add(UI.button('&Test', { onClick: test }), 334, 94, 76, 25);
        helpBtn(d, 334, 124);
        evs.select(0);
      }
    });
  }

  /* ---------------- Fonts ---------------- */
  function fontsApplet(owner) {
    const fonts = Object.keys(readIni('C:\\WINDOWS\\WIN.INI', 'fonts'));
    const face = n => Object.keys(WIN_FONTS).sort((a, b) => b.length - a.length).find(f => n.toLowerCase().startsWith(f.toLowerCase()));
    return dialog({
      title: 'Fonts', w: 420, h: 220, owner,
      build(d) {
        const sample = h('div', { style: { border: '1px solid #000', background: '#fff', overflow: 'hidden', padding: '4px' } });
        const lb = UI.listbox({ items: fonts.map(f => f.replace(/\btruetype\b/i, 'TrueType')), onSelect: it => {
          const f = face(it.text) || 'Arial', px = WIN_FONT_PX[f];
          sample.style.fontFamily = WIN_FONTS[f];
          sample.innerHTML = px ? `<div style="font-size:${px}px;line-height:${px}px">AaBbCcDdEeFfGgHhIiJjKkLlMm 0123456789</div><div style="font-size:${px * 2}px;line-height:${px * 2}px">AaBbCc 123</div>`
            : '<div style="font-size:12px">AaBbCcDdEeFfGgHhIiJjKkLlMm 0123456789</div><div style="font-size:18px">AaBbCcDdEeFfGg 12345</div><div style="font-size:28px">AaBbCcDd 123</div>';
        } });
        d.add(UI.label('Installed &Fonts:', lb), 8, 6); d.add(lb, 8, 24, 310, 100);
        d.add(UI.label('Sample'), 8, 130); d.add(sample, 8, 148, 404, 64);
        d.add(UI.button('Close', { default: true, cancel: true, onClick: () => d.close() }), 330, 24, 80, 25);
        d.add(UI.button('&Remove', { onClick: () => msgBox('Windows needs this font to display text on your screen. It cannot be removed.', 'Remove Font', { icon: 'exclaim', owner: d.win }) }), 330, 54, 80, 25);
        d.add(UI.button('&Add...', { onClick: () => fileDialog({ title: 'Add Fonts', owner: d.win, dir: 'C:\\WINDOWS\\SYSTEM', filters: [['Font Files (*.FON;*.TTF)', '*.FON;*.TTF']] }).then(p => { if (p) msgBox('This font is already installed.', 'Add Fonts', { icon: 'info', owner: d.win }); }) }), 330, 84, 80, 25);
        d.add(UI.button('&TrueType...', { onClick: () => dialog({ title: 'TrueType', w: 380, h: 80, owner: d.win, build(d2) {
          const en = UI.check('&Enable TrueType Fonts', Store.get('tt.enable', true), v => { only.input.disabled = !v; });
          const only = UI.check('&Show Only TrueType Fonts in Applications', Store.get('tt.only', false));
          only.input.disabled = !Store.get('tt.enable', true);
          d2.add(en, 10, 14); d2.add(only, 10, 40);
          ok(d2, () => {
            const changed = en.input.checked !== Store.get('tt.enable', true);
            Store.set('tt.enable', en.input.checked); Store.set('tt.only', only.input.checked && en.input.checked);
            if (changed) msgBox('The TrueType changes will apply to applications started from now on.', 'TrueType', { icon: 'info', owner: d.win });
          }, 296);
          cancel(d2, 296);
        } }) }), 330, 114, 80, 25);
        lb.select(0);
      }
    });
  }

  /* ---------------- Keyboard ---------------- */
  function keyboardApplet(owner) {
    const orig = { kbDelay: Store.get('kbDelay', 2), kbSpeed: Store.get('kbSpeed', 31) };
    return dialog({ title: 'Keyboard', w: 340, h: 170, owner, build(d) {
      d.add(UI.group('Delay Before First Repeat'), 8, 4, 240, 54);
      // live, so Test Typematic reflects the sliders immediately
      const dl = UI.slider({ min: 0, max: 3, step: 1, value: orig.kbDelay, onChange: v => Store.set('kbDelay', v) });
      d.add(UI.label('Long'), 16, 22); d.add(UI.label('Short'), 210, 22); d.add(dl, 16, 36, 224);
      d.add(UI.group('Repeat Rate'), 8, 62, 240, 54);
      const rt = UI.slider({ min: 0, max: 31, step: 1, value: orig.kbSpeed, onChange: v => Store.set('kbSpeed', v) });
      d.add(UI.label('Slow'), 16, 80); d.add(UI.label('Fast'), 214, 80); d.add(rt, 16, 94, 224);
      const t = UI.text(''); d.add(UI.label('&Test Typematic:', t), 8, 132); d.add(t, 116, 128, 132);
      ok(d, () => { Store.set('kbDelay', dl.value); Store.set('kbSpeed', rt.value); Settings.changed(); }, 256);
      cancel(d, 256, 38, () => { Store.set('kbDelay', orig.kbDelay); Store.set('kbSpeed', orig.kbSpeed); });
      helpBtn(d, 256, 68);
    } });
  }

  /* ---------------- International ---------------- */
  function intlApplet(owner) {
    const o = Intl31.get();
    return dialog({ title: 'International', w: 440, h: 300, owner, build(d) {
      const countries = Object.keys(Intl31.COUNTRIES);
      const ct = UI.combo({ items: countries, onChange: it => { Object.assign(o, Intl31.COUNTRIES[it.text], { country: it.text }); ls.value = o.sList; ms.set(o.iMeasure ? 0 : 1, false); samples(); } });
      ct.setText(o.country);
      const langs = ['English (American)', 'English (International)', 'Deutsch', 'Français', 'Japanese'];
      const lg = UI.combo({ items: langs }); lg.setText(o.language || 'English (American)');
      const kbs = ['US', 'US-International', 'British', 'German', 'French', 'Japanese'];
      const kb = UI.combo({ items: kbs }); kb.setText(o.kbLayout || 'US');
      const ms = UI.combo({ items: ['English', 'Metric'], index: o.iMeasure ? 0 : 1 });
      [['&Country:', ct], ['&Language:', lg], ['&Keyboard Layout:', kb], ['&Measurement:', ms]].forEach(([l, c], i) => { d.add(UI.label(l, c), 8, 12 + i * 28); d.add(c, 120, 8 + i * 28, 210); });
      const ls = UI.text(o.sList, { maxLength: 1 }); d.add(UI.label('List &Separator:', ls), 8, 128); d.add(ls, 120, 124, 30);
      const s = {};
      const box = (t, x, y, keys, fn) => {
        d.add(UI.group(t), x, y, 210, 66);
        keys.forEach((k, i) => { s[k] = h('div', { class: 'txt', style: { whiteSpace: 'nowrap' } }); d.add(s[k], x + 10, y + 20 + i * 18); });
        d.add(UI.button('Change...', { onClick: fn }), x + 136, y + 18, 66, 22);
      };
      const samples = () => {
        const n = Sys.now();
        s.sd.textContent = Intl31.date(n, o); s.ld.textContent = Intl31.longDate(n, o);
        s.tm.textContent = Intl31.time(n, true, o);
        s.cur.textContent = o.sCurrency + Intl31.number('1.22', o); s.ncur.textContent = '(' + o.sCurrency + Intl31.number('1.22', o) + ')';
        s.num.textContent = Intl31.number('1234.22', o);
      };
      box('Date Format', 8, 156, ['sd', 'ld'], () => dateFmt());
      box('Currency Format', 222, 156, ['cur', 'ncur'], () => numFmt(true));
      box('Time Format', 8, 228, ['tm'], () => timeFmt());
      box('Number Format', 222, 228, ['num'], () => numFmt(false));
      const dateFmt = () => dialog({ title: 'International - Date Format', w: 330, h: 170, owner: d.win, build(d2) {
        d2.add(UI.group('Short Date Format'), 8, 4, 220, 82);
        const ord = ['MDY', 'DMY', 'YMD'].map((l, i) => UI.radio('dfo', l, o.iDate === i));
        ord.forEach((r, i) => d2.add(r, 18 + i * 64, 24));
        const sep = UI.text(o.sDate, { maxLength: 1 }); d2.add(UI.label('&Separator:', sep), 18, 52); d2.add(sep, 96, 48, 24);
        const lz = UI.check('&Leading Zero', !!o.iDayLZero); d2.add(lz, 130, 52);
        const cen = UI.check('&Century (1992 vs. 92)', !!o.iCentury); d2.add(cen, 8, 96);
        d2.add(UI.group('Long Date Format'), 8, 118, 220, 44);
        const lord = ['MDY', 'DMY', 'YMD'].map((l, i) => UI.radio('dfl', l, (o.iLongDate || 0) === i));
        lord.forEach((r, i) => d2.add(r, 18 + i * 64, 136));
        ok(d2, () => {
          o.iDate = ord.findIndex(r => r.input.checked); o.sDate = sep.value || '/'; o.iDayLZero = lz.input.checked ? 1 : 0;
          o.iCentury = cen.input.checked ? 1 : 0; o.iLongDate = lord.findIndex(r => r.input.checked); samples();
        }, 242); cancel(d2, 242);
      } });
      const timeFmt = () => dialog({ title: 'International - Time Format', w: 330, h: 110, owner: d.win, build(d2) {
        const h12 = UI.radio('tf', '&12 hour', o.iTime !== 1), h24 = UI.radio('tf', '&24 hour', o.iTime === 1);
        const am = UI.text(o.s1159 || 'AM', { maxLength: 5 }), pm = UI.text(o.s2359 || 'PM', { maxLength: 5 });
        d2.add(h12, 10, 12); d2.add(am, 100, 8, 50); d2.add(UI.label('00:00-11:59'), 160, 12);
        d2.add(h24, 10, 40); d2.add(pm, 100, 36, 50); d2.add(UI.label('12:00-23:59'), 160, 40);
        const sep = UI.text(o.sTime, { maxLength: 1 }); d2.add(UI.label('&Separator:', sep), 10, 76); d2.add(sep, 90, 72, 24);
        const lz = UI.check('&Leading Zero (9:15 vs. 09:15)', !!o.iTLZero); d2.add(lz, 120, 76);
        ok(d2, () => { o.iTime = h24.input.checked ? 1 : 0; o.s1159 = am.value; o.s2359 = pm.value; o.sTime = sep.value || ':'; o.iTLZero = lz.input.checked ? 1 : 0; samples(); }, 248);
        cancel(d2, 248);
      } });
      const numFmt = cur => dialog({ title: cur ? 'International - Currency Format' : 'International - Number Format', w: 300, h: 90, owner: d.win, build(d2) {
        if (cur) { const sym = UI.text(o.sCurrency, { maxLength: 4 }); d2.add(UI.label('&Symbol:', sym), 10, 14); d2.add(sym, 120, 10, 50); ok(d2, () => { o.sCurrency = sym.value; samples(); }, 214); }
        else {
          const th = UI.text(o.sThousand, { maxLength: 1 }), de = UI.text(o.sDecimal, { maxLength: 1 });
          d2.add(UI.label('1000 &Separator:', th), 10, 14); d2.add(th, 130, 10, 24);
          d2.add(UI.label('&Decimal Separator:', de), 10, 44); d2.add(de, 130, 40, 24);
          ok(d2, () => { o.sThousand = th.value; o.sDecimal = de.value || '.'; samples(); }, 214);
        }
        cancel(d2, 214);
      } });
      samples();
      ok(d, () => {
        o.country = ct.value.text; o.language = lg.value.text; o.kbLayout = kb.value.text; o.iMeasure = ms.index === 0 ? 1 : 0; o.sList = ls.value || ',';
        Store.set('intl', { ...o });
        Settings.changed();
        Sys.emit('time');
      }, 350);
      cancel(d, 350); helpBtn(d, 350, 68);
    } });
  }

  /* ---------------- Ports ---------------- */
  function portsApplet(owner) {
    let port = 'COM1:';
    return dialog({ title: 'Ports', w: 360, h: 110, owner, build(d) {
      d.add(UI.label('Select a port:'), 10, 8);
      const els = ['COM1:', 'COM2:', 'COM3:', 'COM4:'].map((p, i) => {
        const el = h('div', { class: 'icon' + (i === 0 ? ' sel' : ''), style: { position: 'absolute', width: '60px' } }, h('div', { class: 'img' }, iconImg('cpPorts')), h('div', { class: 'lbl', text: p }));
        el.addEventListener('pointerdown', () => { port = p; els.forEach(x => x.classList.toggle('sel', x === el)); });
        el.addEventListener('dblclick', () => settings());
        d.add(el, 10 + i * 64, 30);
        return el;
      });
      const settings = () => dialog({ title: 'Ports - ' + port, w: 300, h: 160, owner: d.win, build(d2) {
        const all = Store.get('ports', {}), cfg = Object.assign({ baud: '9600', data: '8', parity: 'None', stop: '1', flow: 'Xon / Xoff' }, all[port]);
        const fields = [['baud', '&Baud Rate:', ['110', '300', '600', '1200', '2400', '4800', '9600', '19200']], ['data', '&Data Bits:', ['4', '5', '6', '7', '8']],
          ['parity', '&Parity:', ['Even', 'Odd', 'None', 'Mark', 'Space']], ['stop', '&Stop Bits:', ['1', '1.5', '2']], ['flow', '&Flow Control:', ['Xon / Xoff', 'Hardware', 'None']]];
        const cbs = {};
        fields.forEach(([k, l, it], i) => { const c = UI.combo({ items: it }); c.setText(cfg[k]); cbs[k] = c; d2.add(UI.label(l, c), 10, 12 + i * 28); d2.add(c, 100, 8 + i * 28, 100); });
        ok(d2, () => {
          const n = {}; for (const k in cbs) n[k] = cbs[k].value.text;
          Store.set('ports', { ...all, [port]: n });
          writeIni('C:\\WINDOWS\\WIN.INI', 'ports', port, `${n.baud},${n.parity[0].toLowerCase()},${n.data},${n.stop}${n.flow === 'Hardware' ? ',p' : n.flow === 'Xon / Xoff' ? ',x' : ''}`);
        }, 212);
        cancel(d2, 212);
      } });
      d.add(UI.button('Close', { default: true, cancel: true, onClick: () => d.close() }), 272, 8, 80, 25);
      d.add(UI.button('&Settings...', { onClick: settings }), 272, 38, 80, 25);
      helpBtn(d, 272, 68);
    } });
  }

  /* ---------------- Printers ---------------- */
  function printersApplet(owner) {
    return dialog({ title: 'Printers', w: 400, h: 150, owner, build(d) {
      const label = () => `Generic / Text Only on ${Store.get('printPort', 'LPT1')}:`;
      d.add(UI.label('Default Printer'), 10, 8);
      const def = h('div', { class: 'txt', text: label() }); d.add(def, 20, 26);
      const lb = UI.listbox({ items: [label()], sel: 0 });
      d.add(UI.label('&Installed Printers:', lb), 10, 50); d.add(lb, 10, 68, 280, 50);
      const use = UI.check('&Use Print Manager', Store.get('usePrintMan', true), v => Store.set('usePrintMan', v));
      d.add(use, 10, 126);
      d.add(UI.button('Close', { default: true, cancel: true, onClick: () => d.close() }), 306, 8, 86, 25);
      d.add(UI.button('&Connect...', { onClick: () => dialog({ title: 'Connect', w: 280, h: 110, owner: d.win, build(d2) {
        d2.add(UI.label('Generic / Text Only'), 10, 8);
        const ports = ['LPT1', 'LPT2', 'LPT3', 'COM1', 'COM2', 'COM3', 'COM4', 'FILE'];
        const desc = { FILE: 'Creates a file' };
        const lb2 = UI.listbox({ items: ports.map(p => `${p}: ${desc[p] || (p[0] === 'L' ? 'Local Port' : 'Not Present')}`) });
        lb2.select(Math.max(0, ports.indexOf(Store.get('printPort', 'LPT1'))), false);
        d2.add(UI.label('&Ports:', lb2), 10, 26); d2.add(lb2, 10, 42, 180, 64);
        ok(d2, () => { Store.set('printPort', ports[lb2.sel]); def.textContent = label(); lb.setItems([label()], 0); PrintQueue.emit('change'); IniSync.write(); }, 200);
        cancel(d2, 200);
      } }) }), 306, 38, 86, 25);
      d.add(UI.button('&Setup...', { onClick: () => dialog({ title: 'Generic / Text Only', w: 300, h: 110, owner: d.win, build(d2) {
        const paper = UI.combo({ items: ['Letter 8 1/2 x 11 in', 'Legal 8 1/2 x 14 in', 'A4 210 x 297 mm'] }); paper.setText(Store.get('printPaper', 'Letter 8 1/2 x 11 in'));
        const feed = UI.combo({ items: ['Continuous - No Page Break', 'Cut Sheet'] }); feed.setText(Store.get('printFeed', 'Continuous - No Page Break'));
        d2.add(UI.label('&Paper Size:', paper), 10, 14); d2.add(paper, 10, 30, 190);
        d2.add(UI.label('Paper &Feed:', feed), 10, 60); d2.add(feed, 10, 76, 190);
        ok(d2, () => { Store.set('printPaper', paper.value.text); Store.set('printFeed', feed.value.text); }, 214);
        cancel(d2, 214);
      } }) }), 306, 68, 86, 25);
      d.add(UI.button('&Remove', { onClick: () => msgBox('You cannot remove the only installed printer.', 'Printers', { icon: 'exclaim', owner: d.win }) }), 306, 98, 86, 25);
    } });
  }

  /* ---------------- 386 Enhanced ---------------- */
  function enh386Applet(owner) {
    const cfg = Object.assign({ fg: 100, bg: 50, slice: 20, exclusive: false, contention: {} }, Store.get('386', {}));
    return dialog({ title: '386 Enhanced', w: 400, h: 200, owner, build(d) {
      d.add(UI.group('Device Contention'), 8, 4, 270, 90);
      const dev = ['COM1', 'COM2', 'COM3', 'COM4', 'LPT1'];
      const radios = [UI.radio('dc', '&Always Warn'), UI.radio('dc', '&Never Warn'), UI.radio('dc', '&Idle (in sec.)')];
      const idle = UI.text('2', { maxLength: 3 });
      const show = name => { const c = cfg.contention[name] || { mode: 0, idle: 2 }; radios.forEach((r, i) => r.input.checked = i === c.mode); idle.value = c.idle; };
      const store = name => { cfg.contention[name] = { mode: radios.findIndex(r => r.input.checked), idle: parseInt(idle.value) || 2 }; };
      let cur = 'COM1';
      const lb = UI.listbox({ items: dev, sel: 0, onSelect: it => { store(cur); cur = it.text; show(cur); } });
      d.add(lb, 16, 24, 70, 62);
      radios.forEach((r, i) => d.add(r, 96, 26 + i * 20)); d.add(idle, 230, 64, 36, 20);
      show(cur);
      d.add(UI.group('Scheduling'), 8, 98, 270, 120);
      const fg = UI.text(String(cfg.fg), { maxLength: 5 }), bg = UI.text(String(cfg.bg), { maxLength: 5 }), sl = UI.text(String(cfg.slice), { maxLength: 4 });
      [['Windows in &Foreground:', fg], ['Windows in &Background:', bg], ['&Minimum Timeslice (in msec):', sl]].forEach(([l, t], i) => { d.add(UI.label(l, t), 16, 120 + i * 24); d.add(t, 210, 116 + i * 24, 50, 20); });
      const ex = UI.check('&Exclusive in Foreground', cfg.exclusive); d.add(ex, 16, 192);
      ok(d, () => {
        store(cur);
        const v = [fg, bg, sl].map(t => parseInt(t.value));
        if (v.some(x => isNaN(x) || x < 1 || x > 10000)) { msgBox('Values must be between 1 and 10000.', '386 Enhanced', { icon: 'exclaim', owner: d.win }); return false; }
        Store.set('386', { ...cfg, fg: v[0], bg: v[1], slice: v[2], exclusive: ex.input.checked });
        editIni('C:\\WINDOWS\\SYSTEM.INI', ini => { ini.set('386Enh', 'WinTimeSlice', `${v[0]},${v[1]}`); ini.set('386Enh', 'MinTimeSlice', String(v[2])); ini.set('386Enh', 'WinExclusive', ex.input.checked ? '1' : '0'); });
      }, 292);
      cancel(d, 292);
      d.add(UI.button('&Virtual Memory...', { onClick: () => msgBox('Current Settings\n\nDrive:  C:\nSize:  8,192 KB\nType:  Permanent (using 32-bit access)', 'Virtual Memory', { icon: 'info', owner: d.win }) }), 292, 68, 100, 25);
      helpBtn(d, 292, 98);
      d.resize(400, 222);
    } });
  }

  function driversApplet(owner) {
    return dialog({ title: 'Drivers', w: 380, h: 130, owner, build(d) {
      const lb = UI.listbox({ items: ['[MCI] CD Audio', '[MCI] MIDI Sequencer', '[MCI] Sound', 'MIDI Mapper', 'Neo31 Sound Synthesizer', 'Timer'], sel: 0 });
      d.add(UI.label('&Installed Drivers:', lb), 8, 6); d.add(lb, 8, 24, 270, 100);
      d.add(UI.button('Close', { default: true, cancel: true, onClick: () => d.close() }), 292, 8, 80, 25);
      d.add(UI.button('&Add...', { onClick: () => msgBox('No additional drivers are available.', 'Add', { icon: 'info', owner: d.win }) }), 292, 38, 80, 25);
      d.add(UI.button('&Remove', { onClick: () => msgBox('Windows needs this driver. It cannot be removed.', 'Remove', { icon: 'exclaim', owner: d.win }) }), 292, 68, 80, 25);
      d.add(UI.button('&Setup...', { onClick: () => msgBox(`${lb.value.text}\n\nNo configurable settings.`, 'Setup', { icon: 'info', owner: d.win }) }), 292, 98, 80, 25);
    } });
  }

  const APPLETS = [
    { id: 'color', name: 'Color', icon: 'cpColor', desc: 'Changes the Windows screen colors', run: colorApplet },
    { id: 'fonts', name: 'Fonts', icon: 'cpFonts', desc: 'Adds and removes fonts', run: fontsApplet },
    { id: 'ports', name: 'Ports', icon: 'cpPorts', desc: 'Specifies communications settings for serial ports', run: portsApplet },
    { id: 'mouse', name: 'Mouse', icon: 'cpMouse', desc: 'Changes the mouse settings', run: mouseApplet },
    { id: 'desktop', name: 'Desktop', icon: 'cpDesktop', desc: 'Changes the appearance of your desktop', run: desktopApplet },
    { id: 'keyboard', name: 'Keyboard', icon: 'cpKeyboard', desc: 'Changes the keyboard repeat rate', run: keyboardApplet },
    { id: 'printers', name: 'Printers', icon: 'cpPrinters', desc: 'Installs and configures printers', run: printersApplet },
    { id: 'intl', name: 'International', icon: 'cpIntl', desc: 'Specifies international settings', run: intlApplet },
    { id: 'datetime', name: 'Date/Time', icon: 'cpDateTime', desc: 'Changes the system date and time', run: dateTimeApplet },
    { id: '386', name: '386 Enhanced', icon: 'cp386', desc: 'Optimizes Windows for 386 enhanced mode', run: enh386Applet },
    { id: 'drivers', name: 'Drivers', icon: 'cpDrivers', desc: 'Installs, removes, and configures drivers', run: driversApplet },
    { id: 'sound', name: 'Sound', icon: 'cpSound', desc: 'Assigns sounds to system events', run: soundApplet }
  ];

  Sys.registerApp('control', {
    name: 'Control Panel', icon: 'control', single: true, help: 'control',
    reopen(w, opts) { if (opts.args) w.openApplet(opts.args); },
    run(opts) {
      let sel = 0;
      const status = h('div', { class: 'status' }, h('div', { style: { flex: 1 } }));
      const area = h('div', { style: { position: 'relative', flex: 1, overflow: 'auto', background: 'var(--window)' } });
      const w = new Win({
        title: 'Control Panel', icon: 'control', w: 400, h: 260, persist: 'control',
        menu: [
          { label: '&Settings', items: [...APPLETS.map(a => ({ label: '&' + a.name + '...', action: () => open(a) })), '-', { label: 'E&xit', action: () => w.close() }] },
          { label: '&Help', items: [{ label: '&Contents', action: () => Sys.launch('WINHELP.EXE control') }, { label: '&Search for Help on...', action: () => Sys.launch('WINHELP.EXE control') }, { label: '&How to Use Help', action: () => Sys.launch('WINHELP.EXE winhelp') }, '-', { label: '&About Control Panel...', action: () => aboutBox('Control Panel', 'control', w) }] }
        ],
        onKey: (e, name) => {
          const n = APPLETS.length, cols = Math.max(1, Math.floor((area.clientWidth - 4) / Store.get('iconSpacing', 75)));
          if (name === 'Enter') { open(APPLETS[sel]); return true; }
          let i = sel;
          if (name === 'Right') i++; else if (name === 'Left') i--; else if (name === 'Down') i += cols; else if (name === 'Up') i -= cols; else return false;
          select(clamp(i, 0, n - 1)); return true;
        },
        onResize: () => layout()
      });
      w.body.style.display = 'flex'; w.body.style.flexDirection = 'column';
      w.body.append(area, status);
      const els = APPLETS.map((a, i) => {
        const el = h('div', { class: 'icon' }, h('div', { class: 'img' }, iconImg(a.icon)), h('div', { class: 'lbl', text: a.name }));
        el.addEventListener('pointerdown', () => select(i));
        el.addEventListener('dblclick', () => open(a));
        area.appendChild(el);
        return el;
      });
      const layout = () => {
        const sp = Store.get('iconSpacing', 75), cols = Math.max(1, Math.floor((area.clientWidth - 4) / sp));
        els.forEach((el, i) => { el.style.left = (2 + (i % cols) * sp) + 'px'; el.style.top = (6 + Math.floor(i / cols) * 64) + 'px'; });
      };
      const select = i => { sel = i; els.forEach((el, j) => el.classList.toggle('sel', i === j)); status.firstChild.textContent = APPLETS[i].desc; };
      const open = a => { select(APPLETS.indexOf(a)); Sys.busy(200); a.run(w); };
      w.openApplet = id => { const a = APPLETS.find(x => x.id === id.trim().toLowerCase() || x.name.toLowerCase() === id.trim().toLowerCase()); if (a) open(a); };
      const off = Sys.on('settings', layout);
      w.on('closed', off);
      requestAnimationFrame(() => { layout(); if (!Store.get('wpos.control')) w.sizeToClient(w.body.clientWidth, 64 * 3 + 30); });
      select(0);
      if (opts.args) setTimeout(() => w.openApplet(opts.args), 50);
      return w;
    }
  });
})();
