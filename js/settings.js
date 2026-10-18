'use strict';
/* System settings that affect the whole machine: mouse (double-click speed,
   swapped buttons), keyboard repeat, fast Alt+Tab switching, sizing grid,
   and two-way synchronisation with WIN.INI / SYSTEM.INI / CONTROL.INI. */

/* ======================= APPLY & PERSIST ======================= */
const Settings = {
  /* Call after any Control Panel change: apply, write the INI files, notify. */
  changed() {
    Sys.applyScheme();
    Sys.applyDesktop();
    Saver.reset();
    IniSync.write();
    Sys.emit('settings');
  },
  grid() { return Store.get('granularity', 0) * 8; },
  snap(v) { const g = this.grid(); return g ? Math.round(v / g) * g : v; },
  blinkMs() { return clamp(Store.get('blink', 530), 100, 1100); }
};

/* ======================= MOUSE ======================= */
/* Double-clicks are detected with the Control Panel speed rather than the
   host OS's, and Swap Left/Right Buttons remaps every mouse event. */
const MouseLayer = {
  last: null,
  init() {
    document.addEventListener('dblclick', e => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);
    document.addEventListener('click', e => this.onClick(e), true);
    for (const t of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'auxclick', 'contextmenu'])
      document.addEventListener(t, e => this.swapFilter(e), true);
  },
  swapped() { return Store.get('swapButtons', false) && Sys.mode === 'windows' && !Saver.active; },

  onClick(e) {
    if (e.isTrusted && this.swapped() && !isEditable(e.target)) return;   // swapFilter will synthesise
    if (!e.isTrusted && !e.neoSynth) return;
    if (e.button !== 0) return;
    const now = performance.now(), L = this.last;
    if (L && now - L.t <= Sys.dblTime() && Math.abs(e.clientX - L.x) <= 4 && Math.abs(e.clientY - L.y) <= 4) {
      this.last = null;
      const t = e.target, init = { bubbles: true, cancelable: true, composed: true, view: window, clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY, button: 0, buttons: 0, detail: 2, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey };
      setTimeout(() => { if (t.isConnected) t.dispatchEvent(new MouseEvent('dblclick', init)); }, 0);
    } else this.last = { t: now, x: e.clientX, y: e.clientY };
  },

  swapFilter(e) {
    if (!e.isTrusted || !this.swapped() || e.pointerType === 'touch' || isEditable(e.target)) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    if (e.type !== 'pointerdown' && e.type !== 'pointerup') return;   // click/contextmenu/mouse* are re-synthesised
    const map = b => b === 0 ? 2 : b === 2 ? 0 : b;
    const buttons = (e.buttons & ~3) | (e.buttons & 1 ? 2 : 0) | (e.buttons & 2 ? 1 : 0);
    const init = {
      bubbles: true, cancelable: true, composed: true, view: window, clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY,
      button: map(e.button), buttons, pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: e.isPrimary, width: e.width, height: e.height,
      pressure: e.pressure, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey, detail: e.detail
    };
    const target = e.target;
    if (e.type === 'pointerdown') {
      this.down = target;
      const f = target.closest && target.closest('input,textarea,button,select,[tabindex],[contenteditable="true"]');
      if (f) f.focus({ preventScroll: true });
    }
    target.dispatchEvent(new PointerEvent(e.type, init));
    if (e.type === 'pointerup') {
      const b = map(e.button);
      let tgt = document.elementFromPoint(e.clientX, e.clientY) || target;
      // a click goes to the nearest element containing both the press and the release
      let common = tgt;
      while (common && this.down && !common.contains(this.down)) common = common.parentNode;
      if (!common || common === document) common = tgt;
      const type = b === 0 ? 'click' : b === 2 ? 'contextmenu' : 'auxclick';
      const ev = new MouseEvent(type, { ...init, button: b, buttons: 0, detail: 1 });
      ev.neoSynth = true;
      common.dispatchEvent(ev);
    }
  }
};

/* ======================= KEYBOARD REPEAT ======================= */
/* The host's auto-repeat is replaced by one driven by Control Panel >
   Keyboard (Delay Before First Repeat / Repeat Rate). */
const Typematic = {
  REPEATABLE: /^(Backspace|Delete|Enter|ArrowLeft|ArrowRight|ArrowUp|ArrowDown|PageUp|PageDown|Home|End|Tab)$/,
  init() {
    document.addEventListener('keydown', e => this.down(e), true);
    document.addEventListener('keyup', e => { if (!this.cur || e.code === this.cur.code || e.key === 'Shift') this.stop(); }, true);
    window.addEventListener('blur', () => this.stop());
  },
  delayMs() { return [1000, 750, 500, 250][clamp(Store.get('kbDelay', 2), 0, 3)]; },
  rateMs() { return Math.round(1000 / (2 + clamp(Store.get('kbSpeed', 31), 0, 31) / 31 * 28)); },
  stop() { clearTimeout(this.t); clearInterval(this.iv); this.cur = null; },
  down(e) {
    if (!e.isTrusted) return;
    if (e.repeat) { if (Sys.mode !== 'off') { e.preventDefault(); e.stopImmediatePropagation(); } return; }
    this.stop();
    if (Sys.mode === 'off' || e.metaKey || e.key === 'Escape') return;
    const printable = e.key.length === 1 && !e.ctrlKey && !e.altKey;
    if (!printable && !this.REPEATABLE.test(e.key)) return;
    const target = document.activeElement || document.body;
    const k = { key: e.key, code: e.code, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, target };
    this.cur = k;
    this.t = setTimeout(() => {
      this.fire(k);
      this.iv = setInterval(() => this.fire(k), this.rateMs());
    }, this.delayMs());
  },
  fire(k) {
    if (this.cur !== k || (document.activeElement || document.body) !== k.target || !k.target.isConnected) { this.stop(); return; }
    const t = k.target;
    if (isEditable(t) && !k.ctrlKey && !k.altKey) {
      const ce = t.isContentEditable;
      if (k.key.length === 1) { document.execCommand('insertText', false, k.key); return; }
      if (k.key === 'Backspace') { document.execCommand('delete'); return; }
      if (k.key === 'Delete') { document.execCommand('forwardDelete'); return; }
      if (k.key === 'Enter') { if (t.nodeName === 'TEXTAREA' || ce) document.execCommand(ce ? 'insertParagraph' : 'insertText', false, '\n'); return; }
      if (/^Arrow|Home|End|Page/.test(k.key)) { this.moveCaret(t, k); return; }
    }
    t.dispatchEvent(new KeyboardEvent('keydown', { key: k.key, code: k.code, ctrlKey: k.ctrlKey, shiftKey: k.shiftKey, altKey: k.altKey, bubbles: true, cancelable: true }));
  },
  moveCaret(t, k) {
    const ext = k.shiftKey ? 'extend' : 'move';
    if (t.isContentEditable) {
      const map = { ArrowLeft: ['backward', 'character'], ArrowRight: ['forward', 'character'], ArrowUp: ['backward', 'line'], ArrowDown: ['forward', 'line'], Home: ['backward', 'lineboundary'], End: ['forward', 'lineboundary'] };
      const m = map[k.key]; if (m) getSelection().modify(ext, m[0], m[1]);
      return;
    }
    const v = t.value, a = t.selectionStart, b = t.selectionEnd;
    const focus = t.selectionDirection === 'backward' ? a : b;
    let p = focus;
    const lineStart = i => v.lastIndexOf('\n', i - 1) + 1;
    if (k.key === 'ArrowLeft') p = Math.max(0, p - 1);
    else if (k.key === 'ArrowRight') p = Math.min(v.length, p + 1);
    else if (k.key === 'ArrowUp' || k.key === 'ArrowDown' || /^Page/.test(k.key)) {
      const lines = /^Page/.test(k.key) ? Math.max(1, Math.floor(t.clientHeight / 16) - 1) : 1;
      for (let n = 0; n < lines; n++) {
        const ls = lineStart(p), col = p - ls;
        if (/Up$/.test(k.key)) { if (ls === 0) { p = 0; break; } const pls = lineStart(ls - 1); p = Math.min(pls + col, ls - 1); }
        else { const nl = v.indexOf('\n', p); if (nl < 0) { p = v.length; break; } const nle = v.indexOf('\n', nl + 1); p = Math.min(nl + 1 + col, nle < 0 ? v.length : nle); }
      }
    } else if (k.key === 'Home') p = lineStart(p);
    else if (k.key === 'End') { const e2 = v.indexOf('\n', p); p = e2 < 0 ? v.length : e2; }
    if (k.shiftKey) {
      const anchor = t.selectionDirection === 'backward' ? b : a;
      t.setSelectionRange(Math.min(anchor, p), Math.max(anchor, p), p < anchor ? 'backward' : 'forward');
    } else t.setSelectionRange(p, p);
  }
};

/* ======================= FAST ALT+TAB ======================= */
const FastSwitch = {
  start(back) {
    const ws = Sys.desktop.ordered().reverse().filter(w => !w.closed && !w.hidden && !w.o.hideFromTasks && !w.o.dialog);
    if (ws.length < 2) return;
    if (!Store.get('fastSwitch', true)) { Sys.cycle(back); return; }
    this.list = ws;
    this.i = back ? ws.length - 1 : 1;
    this.show();
  },
  next(back) { if (!this.list) return this.start(back); this.i = (this.i + (back ? -1 : 1) + this.list.length) % this.list.length; this.show(); },
  show() {
    const w = this.list[this.i];
    if (!this.el) {
      this.el = h('div', { class: 'win dlg active', style: { zIndex: 99997, width: '360px', height: '74px' } },
        h('div', { class: 'inner', style: { background: 'var(--btn-face)', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px', padding: '0 16px' } }));
      Sys.screen.appendChild(this.el);
    }
    const inner = this.el.firstChild;
    inner.innerHTML = '';
    inner.append(w.o.drawIcon && w.iconCanvas ? (() => { const c = h('canvas', { width: 32, height: 32 }); w.o.drawIcon(c); return c; })() : iconImg(w.o.minIcon || w.o.icon || 'app'),
      h('div', { style: { flex: 1, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden' }, text: w.title }));
    Object.assign(this.el.style, { left: Math.round((Sys.screen.clientWidth - 360) / 2) + 'px', top: Math.round((Sys.screen.clientHeight - 74) / 2) + 'px' });
  },
  commit() {
    if (!this.list) return;
    const w = this.list[this.i];
    this.cancel();
    if (w && !w.closed) w.isMin ? w.restore() : w.activate();
  },
  cancel() { this.list = null; if (this.el) { this.el.remove(); this.el = null; } }
};

/* ======================= INI SYNCHRONISATION ======================= */
const IniSync = {
  WIN: 'C:\\WINDOWS\\WIN.INI', SYS: 'C:\\WINDOWS\\SYSTEM.INI', CTL: 'C:\\WINDOWS\\CONTROL.INI',
  COLOR_KEYS: { desktop: 'Background', 'app-workspace': 'AppWorkspace', window: 'Window', 'window-text': 'WindowText', menu: 'Menu', 'menu-text': 'MenuText',
    'active-title': 'ActiveTitle', 'inactive-title': 'InactiveTitle', 'active-title-text': 'TitleText', 'active-border': 'ActiveBorder', 'inactive-border': 'InactiveBorder',
    'window-frame': 'WindowFrame', scrollbar: 'Scrollbar', 'btn-face': 'ButtonFace', 'btn-shadow': 'ButtonShadow', 'btn-text': 'ButtonText', 'disabled-text': 'GrayText',
    highlight: 'Hilight', 'highlight-text': 'HilightText', 'inactive-title-text': 'InactiveTitleText', 'btn-highlight': 'ButtonHilight' },
  SAVERS: { 'Blank Screen': 'SCRNSAVE.SCR', 'Flying Windows': 'SSFLYWIN.SCR', 'Marquee': 'SSMARQUE.SCR', 'Mystify': 'SSMYST.SCR', 'Starfield Simulation': 'SSSTARS.SCR' },
  rgb: hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(' '),
  hex: s => { const p = s.trim().split(/\s+/).map(Number); return p.length === 3 && p.every(n => n >= 0 && n <= 255) ? '#' + p.map(n => n.toString(16).padStart(2, '0')).join('') : null; },
  patternBits(name) { return Store.get('customPatterns', {})[name] || Sys.patterns[name]; },

  write() {
    if (this.reading) return;
    const colors = Sys.currentColors();
    const intl = Intl31.get();
    const map = Object.assign({}, Snd.defaultMap, Store.get('soundMap', {}));
    editIni(this.WIN, ini => {
      for (const [k, n] of Object.entries(this.COLOR_KEYS)) ini.set('colors', n, this.rgb(colors[k]));
      const bits = this.patternBits(Store.get('pattern', '(None)'));
      ini.set('Desktop', 'Pattern', bits ? bits.join(' ') : '(None)');
      const wp = Store.get('wallpaper') || '(None)';
      ini.set('Desktop', 'Wallpaper', wp === '(None)' ? '(None)' : wp.toLowerCase());
      ini.set('Desktop', 'TileWallpaper', Store.get('wallTile', true) ? '1' : '0');
      ini.set('Desktop', 'IconSpacing', String(Store.get('iconSpacing', 75)));
      ini.set('Desktop', 'GridGranularity', String(Store.get('granularity', 0)));
      ini.set('Desktop', 'IconTitleWrap', Store.get('iconWrap', true) ? '1' : '0');
      ini.set('windows', 'ScreenSaveActive', Store.get('saver', '(None)') === '(None)' ? '0' : '1');
      ini.set('windows', 'ScreenSaveTimeOut', String(Store.get('saverDelay', 2) * 60));
      ini.set('windows', 'BorderWidth', String(Store.get('borderWidth', 3)));
      ini.set('windows', 'CursorBlinkRate', String(Store.get('blink', 530)));
      ini.set('windows', 'DoubleClickSpeed', String(Store.get('dblClick', 452)));
      ini.set('windows', 'MouseSpeed', String(Store.get('mouseSpeed', 5)));
      ini.set('windows', 'MouseTrails', String(Store.get('trails', false) ? 7 : -7));
      ini.set('windows', 'SwapMouseButtons', Store.get('swapButtons', false) ? '1' : '0');
      ini.set('windows', 'KeyboardSpeed', String(Store.get('kbSpeed', 31)));
      ini.set('windows', 'KeyboardDelay', String(Store.get('kbDelay', 2)));
      ini.set('windows', 'CoolSwitch', Store.get('fastSwitch', true) ? '1' : '0');
      ini.set('windows', 'Beep', Store.get('sounds', true) ? 'yes' : 'no');
      ini.set('windows', 'device', `Generic / Text Only,TTY,${Store.get('printPort', 'LPT1')}:`);
      ini.set('intl', 'sCountry', intl.country);
      for (const k of ['iCountry', 'iDate', 'sDate', 'iTime', 'sTime', 'iTLZero', 's1159', 's2359', 'sList', 'iMeasure', 'sCurrency', 'sThousand', 'sDecimal']) ini.set('intl', k, String(intl[k]));
      ini.set('intl', 'sShortDate', [['M', 'd', 'yy'], ['d', 'M', 'yy'], ['yy', 'M', 'd']][intl.iDate].map(x => x === 'yy' && intl.iCentury ? 'yyyy' : (x.length === 1 && intl.iDayLZero ? x + x : x)).join(intl.sDate));
      for (const [ev, name] of Object.entries(Snd.events)) ini.set('sounds', ev, `${(map[ev] || '<none>').toLowerCase()},${name}`);
    });
    editIni(this.SYS, ini => {
      const sv = Store.get('saver', '(None)');
      ini.set('boot', 'SCRNSAVE.EXE', sv === '(None)' ? null : 'C:\\WINDOWS\\' + this.SAVERS[sv]);
    });
    editIni(this.CTL, ini => {
      ini.set('current', 'color schemes', Store.get('scheme', 'Windows Default'));
      ini.set('ScreenSaver', 'Password', Store.get('saverPwOn', false) ? '1' : '0');
      const cc = Store.get('customColors', []);
      cc.forEach((c, i) => ini.set('Custom Colors', 'Color' + 'ABCDEFGHIJKLMNOP'[i], c ? c.slice(1).toUpperCase() : 'FFFFFF'));
      if (Store.get('marqueeText')) ini.set('Screen Saver.Marquee', 'Text', Store.get('marqueeText'));
    });
  },

  /* At Windows start-up, pick up anything the user changed by editing the INI files. */
  read() {
    this.reading = true;
    try {
      const W = (s, k) => editIni(this.WIN, ini => ini.get(s, k));
      const num = (s, k, lo, hi) => { const v = parseInt(W(s, k)); return isNaN(v) ? null : clamp(v, lo, hi); };
      const bool = (s, k) => { const v = W(s, k); return v == null ? null : /^(1|yes|on|true)$/i.test(v); };
      const setIf = (key, v) => { if (v != null && v !== Store.get(key)) Store.set(key, v); };

      const scheme = editIni(this.CTL, ini => ini.get('current', 'color schemes'));
      if (scheme && (Sys.schemes[scheme] || Store.get('customSchemes', {})[scheme])) setIf('scheme', scheme);
      const base = Object.assign({}, Sys.schemes['Windows Default'], Sys.schemes[Store.get('scheme', 'Windows Default')] || Store.get('customSchemes', {})[Store.get('scheme')] || {});
      const over = {};
      for (const [k, n] of Object.entries(this.COLOR_KEYS)) {
        const v = W('colors', n), hx = v && this.hex(v);
        if (hx && hx !== base[k]) over[k] = hx;
      }
      if (W('colors', 'Background') != null) Store.set('colorsOverride', over);

      const pat = W('Desktop', 'Pattern');
      if (pat != null) {
        if (/none/i.test(pat)) setIf('pattern', '(None)');
        else {
          const bits = pat.trim().split(/\s+/).map(Number);
          if (bits.length === 8 && bits.every(b => b >= 0 && b < 256)) {
            const all = Object.assign({}, Sys.patterns, Store.get('customPatterns', {}));
            let name = Object.keys(all).find(n => all[n] && all[n].join() === bits.join());
            if (!name) { name = '(Custom)'; const cp = Store.get('customPatterns', {}); cp[name] = bits; Store.set('customPatterns', cp); }
            setIf('pattern', name);
          }
        }
      }
      const wp = W('Desktop', 'Wallpaper');
      if (wp != null) setIf('wallpaper', /none/i.test(wp) || !wp ? '(None)' : wp.toUpperCase());
      setIf('wallTile', bool('Desktop', 'TileWallpaper'));
      setIf('iconSpacing', num('Desktop', 'IconSpacing', 32, 512));
      setIf('granularity', num('Desktop', 'GridGranularity', 0, 49));
      setIf('iconWrap', bool('Desktop', 'IconTitleWrap'));
      setIf('borderWidth', num('windows', 'BorderWidth', 1, 49));
      setIf('blink', num('windows', 'CursorBlinkRate', 100, 1100));
      setIf('dblClick', num('windows', 'DoubleClickSpeed', 100, 900));
      setIf('mouseSpeed', num('windows', 'MouseSpeed', 1, 10));
      const tr = parseInt(W('windows', 'MouseTrails')); if (!isNaN(tr)) setIf('trails', tr > 1);
      setIf('swapButtons', bool('windows', 'SwapMouseButtons'));
      setIf('kbSpeed', num('windows', 'KeyboardSpeed', 0, 31));
      setIf('kbDelay', num('windows', 'KeyboardDelay', 0, 3));
      setIf('fastSwitch', bool('windows', 'CoolSwitch'));
      const beep = W('windows', 'Beep'); if (beep != null) setIf('sounds', /^(yes|1|on)$/i.test(beep));
      const sv = editIni(this.SYS, ini => ini.get('boot', 'SCRNSAVE.EXE'));
      const active = bool('windows', 'ScreenSaveActive');
      if (active === false) setIf('saver', '(None)');
      else if (sv) { const f = sv.split('\\').pop().toUpperCase(); const n = Object.keys(this.SAVERS).find(k => this.SAVERS[k] === f); if (n) setIf('saver', n); }
      const to = num('windows', 'ScreenSaveTimeOut', 60, 5940); if (to) setIf('saverDelay', Math.round(to / 60));
      const intl = Store.get('intl', {}), country = W('intl', 'sCountry');
      if (country && Intl31.COUNTRIES[country]) intl.country = country;
      for (const k of ['iDate', 'iTime', 'iTLZero', 'iMeasure']) { const v = parseInt(W('intl', k)); if (!isNaN(v)) intl[k] = v; }
      for (const k of ['sDate', 'sTime', 's1159', 's2359', 'sList', 'sCurrency', 'sThousand', 'sDecimal']) { const v = W('intl', k); if (v != null) intl[k] = v; }
      Store.set('intl', intl);
      const smap = {};
      for (const ev of Object.keys(Snd.events)) { const v = W('sounds', ev); if (v) smap[ev] = v.split(',')[0].trim().toUpperCase() || '<none>'; }
      if (Object.keys(smap).length) Store.set('soundMap', Object.fromEntries(Object.entries(smap).map(([k, v]) => [k, v === '<NONE>' ? '<none>' : v])));
    } finally { this.reading = false; }
  }
};
