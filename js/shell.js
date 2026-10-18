'use strict';
/* System shell: screen, desktop, app registry, launching, keyboard routing,
   colour schemes, desktop patterns/wallpaper, screen savers, Task List. */

const Sys = Object.assign(new Emitter(), {
  screen: null,
  desktop: null,
  scale: 1,
  mode: 'off',
  apps: {},
  env: { COMSPEC: 'C:\\COMMAND.COM', PROMPT: '$p$g', PATH: 'C:\\WINDOWS;C:\\DOS', TEMP: 'C:\\WINDOWS\\TEMP', windir: 'C:\\WINDOWS' },
  clipboard: null,
  tracking: false,
  vd: 0,
  /* Which shell is running: 'neo10' (Windows 10 experience) or 'win31' (Program Manager) */
  shellMode: 'win31',
  isNeo() { return this.shellMode === 'neo10'; },

  init() {
    installCursors();
    installPixelUI();
    this.screen = document.getElementById('screen');
    this.deskEl = h('div', { id: 'desktop', class: 'hidden' });
    this.wallEl = h('div', { class: 'wallpaper' });
    this.wmEl = h('div', { class: 'wmc' });
    this.deskEl.append(this.wallEl, this.wmEl);
    Menu.layer = h('div', { id: 'menus', class: 'layer' });
    this.screen.append(this.deskEl, Menu.layer);
    this.desktop = new WindowManager(this.wmEl);

    this.wmEl.addEventListener('dblclick', e => { if (e.target === this.wmEl) this.taskList(); });
    this.wmEl.addEventListener('pointerdown', e => { if (e.target === this.wmEl) Menu.closeAll(); });

    document.addEventListener('keydown', e => this.onKey(e), false);
    document.addEventListener('keyup', e => this.onKeyUp(e), false);
    document.addEventListener('copy', () => {
      const s = String(window.getSelection() || '');
      const t = document.activeElement;
      let txt = s;
      if (t && (t.nodeName === 'TEXTAREA' || t.nodeName === 'INPUT')) txt = t.value.slice(t.selectionStart, t.selectionEnd);
      if (txt) setTimeout(() => this.setClipboard({ type: 'text', data: txt }), 0);
    });
    document.addEventListener('cut', () => {
      const t = document.activeElement;
      if (t && (t.nodeName === 'TEXTAREA' || t.nodeName === 'INPUT')) { const txt = t.value.slice(t.selectionStart, t.selectionEnd); if (txt) this.setClipboard({ type: 'text', data: txt }); }
    });
    window.addEventListener('resize', () => this.layoutScreen());
    MouseLayer.init();
    Typematic.init();
    for (const t of ['keydown', 'keyup', 'pointerdown', 'pointerup']) document.addEventListener(t, e => { this.shiftDown = e.shiftKey; }, true);
    for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel']) document.addEventListener(ev, e => Saver.activity(e), true);
    document.addEventListener('pointermove', e => Trails.move(e), true);
    this.screen.addEventListener('contextmenu', e => { if (!isEditable(e.target)) e.preventDefault(); });
    this.layoutScreen();
    this.applyScheme();
    this.applyDesktop();
  },

  /* ---------- screen geometry ---------- */
  /* Largest whole number of *device* pixels per screen pixel, so bitmap
     fonts and icons map 1:1 onto the physical pixel grid. */
  sharpScale(W, H) {
    const dpr = window.devicePixelRatio || 1;
    let k = Math.floor(Math.min(window.innerWidth * dpr / W, window.innerHeight * dpr / H));
    const forced = parseInt(Store.get('pixelScale', 'auto'));
    if (forced && k >= 1) k = Math.min(k, Math.max(1, Math.round(forced * dpr)));
    return k >= 1 ? k / dpr : Math.min(window.innerWidth / W, window.innerHeight / H);
  },
  resolution() {
    const r = Store.get('display', 'auto');
    if (r === 'fit') return [window.innerWidth, window.innerHeight];
    if (r === 'auto') {
      let best = [800, 600], bestScore = -1;
      for (const [W, H] of [[640, 480], [800, 600], [1024, 768]]) {
        const s = this.sharpScale(W, H);
        const score = (W * s) * (H * s) / (window.innerWidth * window.innerHeight);
        if (s * (window.devicePixelRatio || 1) >= 1 && score >= bestScore - 0.02) { best = [W, H]; bestScore = Math.max(bestScore, score); }
      }
      return best;
    }
    return r.split('x').map(Number);
  },
  layoutScreen() {
    const [W, H] = this.resolution();
    const vw = window.innerWidth, vh = window.innerHeight, dpr = window.devicePixelRatio || 1;
    const s = Store.get('display') === 'fit' ? 1 : this.sharpScale(W, H);
    if (s !== this.scale) { this.scale = s; installCursors(); }
    const snap = v => Math.round(v * dpr) / dpr;
    Object.assign(this.screen.style, {
      width: W + 'px', height: H + 'px',
      transform: `translate(${snap((vw - W * s) / 2)}px, ${snap((vh - H * s) / 2)}px) scale(${s})`
    });
    if (this.desktop) this.desktop.relayout();
    this.emit('resolution');
  },
  rectOf(el) {
    const r = el.getBoundingClientRect(), s = this.screen.getBoundingClientRect();
    return { x: (r.left - s.left) / this.scale, y: (r.top - s.top) / this.scale, w: r.width / this.scale, h: r.height / this.scale };
  },
  pointer(e, el = this.screen) {
    const r = el.getBoundingClientRect();
    return { x: (e.clientX - r.left) / this.scale, y: (e.clientY - r.top) / this.scale };
  },
  dblTime() { return Store.get('dblClick', 452); },
  now() { return new Date(Date.now() + Store.get('clockOffset', 0) + Store.get('tzShift', 0) * 3600000); },

  busy(ms = 400) {
    this.screen.classList.add('busy');
    clearTimeout(this._busyT);
    this._busyT = setTimeout(() => this.screen.classList.remove('busy'), ms);
  },

  setClipboard(c) {
    this.clipboard = c;
    this.emit('clipboard', c);
    if (c && c.type === 'text' && navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(c.data).catch(() => {});
  },

  /* ---------- app registry & launching ---------- */
  registerApp(id, def) { this.apps[id] = Object.assign({ id, instances: [] }, def); },

  run(id, opts = {}) {
    const app = this.apps[id];
    if (!app) return null;
    if (this.mode !== 'windows' && id !== 'win') return null;
    if (app.single && app.instances.length) {
      const w = app.instances[0];
      if (w.isMin) w.restore(); else w.activate();
      if (app.reopen) app.reopen(w, opts);
      return w;
    }
    this.busy(opts.quiet ? 0 : 350);
    const w = app.run(opts);
    if (w && w instanceof Win) {
      w.app = app;
      app.instances.push(w);
      w.on('closed', () => { app.instances = app.instances.filter(x => x !== w); });
      if (opts.show === 'min') w.minimize();
      else if (opts.show === 'max') w.maximize();
      this.emit('windows');
    }
    return w;
  },

  splitCmd(cmd) {
    cmd = cmd.trim();
    let m = /^"([^"]+)"\s*(.*)$/.exec(cmd) || /^(\S+)\s*(.*)$/.exec(cmd);
    return m ? [m[1], m[2]] : ['', ''];
  },

  association(file) {
    const ext = FS.ext(file).toLowerCase();
    const assoc = readIni('C:\\WINDOWS\\WIN.INI', 'Extensions')[ext];
    return assoc ? assoc.split(/\s+/)[0].toUpperCase() : null;
  },

  launch(cmd, opts = {}) {
    const [tok, args] = this.splitCmd(cmd);
    if (!tok) return null;
    // web addresses open in Microsoft Edge
    if (this.apps.edge && /^(https?:\/\/|www\.|edge:\/\/|file:\/\/)/i.test(String(cmd).trim())) return this.run('edge', { ...opts, args: String(cmd).trim() });
    const pseudo = { CMD: 'dos', 'CMD.EXE': 'dos', EXPLORER: 'explorer', 'EXPLORER.EXE': 'explorer', SETTINGS: 'settings10', 'MS-SETTINGS:': 'settings10', TASKMGR: 'taskmgr', 'TASKMGR.EXE': 'taskmgr', WEATHER: 'weather', RUN: 'run10', EDGE: 'edge', 'MICROSOFT-EDGE:': 'edge' }[tok.toUpperCase()];
    if (pseudo && (this.isNeo() || pseudo === 'dos' || pseudo === 'edge')) return this.run(pseudo, { ...opts, args: args || opts.args });
    if (this.isNeo()) {
      const full = FS.full(tok, opts.cwd || 'C:\\WINDOWS');
      if (FS.isDir(full) && !args) return this.run('explorer', { ...opts, args: full });
    }
    const cwd = opts.cwd || 'C:\\WINDOWS';
    let file = FS.which(tok, cwd);
    if (!file && FS.get(tok, cwd)?.t === 'f') file = FS.full(tok, cwd);
    if (!file) {
      msgBox(`Cannot find file ${tok.toLowerCase()} (or one of its components). Check to ensure the path and filename are correct and that all required libraries are available.`, opts.caller || 'Program Manager', { icon: 'stop', owner: opts.owner });
      return null;
    }
    const node = FS.get(file);
    const ext = FS.ext(file);
    if (node.a) return this.run(node.a, { ...opts, args: args || opts.args, path: file });
    if (['EXE', 'COM', 'BAT', 'PIF'].includes(ext)) {
      return this.run('dos', { ...opts, args: file + (args ? ' ' + args : '') });
    }
    if (ext === 'SCR') { Saver.start(node.g || 'Blank Screen'); return null; }
    const exe = this.association(file);
    if (exe) return this.launch(`${exe} "${file}"`, opts);
    msgBox('No application is associated with this file.\n\nChoose Associate from the File menu to create an association.', opts.caller || 'File Manager', { icon: 'exclaim', owner: opts.owner });
    return null;
  },

  activeTop() {
    const a = this.desktop && this.desktop.active;
    if (!a || a.closed) return null;
    return a.focusTarget();
  },
  topWindows() { return this.desktop.wins.filter(w => !w.closed && !w.o.hideFromTasks); },

  /* ---------- keyboard ---------- */
  onKey(e) {
    if (this.textKey) { this.textKey(e); return; }
    if (this.mode !== 'windows') return;
    if (Saver.active) return;
    if (this.tracking) return;
    if (document.getElementById('cbov')) return;
    const name = keyName(e);
    if (FastSwitch.list) {
      e.preventDefault();
      if (name === 'Alt+Tab' || name === 'Alt+Shift+Tab') FastSwitch.next(e.shiftKey);
      else if (e.key === 'Escape') FastSwitch.cancel();
      return;
    }
    if (Menu.key(e)) { e.preventDefault(); this.altAlone = false; return; }
    if (e.key === 'Alt') { this.altAlone = true; e.preventDefault(); return; }
    this.altAlone = false;
    if (this.isNeo() && Shell10.key(e)) return;
    if (name === 'Ctrl+Esc') { e.preventDefault(); this.taskList(); return; }
    if (name === 'Alt+Tab' || name === 'Alt+Shift+Tab') { e.preventDefault(); Menu.closeAll(true); FastSwitch.start(e.shiftKey); return; }
    if (name === 'Alt+Esc' || name === 'Alt+Shift+Esc') { e.preventDefault(); this.cycle(e.shiftKey); return; }
    const top = this.activeTop();
    if (!top) return;
    if (name === 'Alt+F4') { e.preventDefault(); top.close(); return; }
    if (name === 'Alt+Space') { e.preventDefault(); top.showSysMenu(null, true); return; }
    if (top.handleKey(e)) return;
    if (e.altKey && !e.ctrlKey && top.menuBar) {
      const letter = (e.code && /^(Key[A-Z]|Digit\d)$/.test(e.code)) ? e.code.slice(-1).toLowerCase() : e.key.toLowerCase();
      const i = top.menuBar.defs.findIndex(d => mnemonicKey(d.label) === letter);
      if (i >= 0) { e.preventDefault(); Menu.openBar(top.menuBar, i, true); return; }
    }
    if (e.key === 'F1' && !e.altKey) { e.preventDefault(); this.launch('WINHELP.EXE ' + (top.app ? top.app.help || top.app.id : 'progman'), { quiet: true }); }
  },
  onKeyUp(e) {
    if (this.textKey || this.mode !== 'windows') return;
    if (e.key === 'Alt' && FastSwitch.list) { e.preventDefault(); this.altAlone = false; FastSwitch.commit(); return; }
    if (this.isNeo() && Shell10.keyUp(e)) { e.preventDefault(); return; }
    if (e.key === 'Alt' && this.altAlone) {
      this.altAlone = false;
      e.preventDefault();
      const top = this.activeTop();
      if (top && top.menuBar && !Menu.isOpen()) Menu.enterBarMode(top.menuBar);
    }
  },
  cycle(back) {
    const ws = this.desktop.ordered().filter(w => !w.closed && !w.hidden && !w.o.hideFromTasks);
    if (ws.length < 2) return;
    const w = back ? ws[ws.length - 2] : ws[0];
    w.isMin ? w.restore() : w.activate();
  },

  /* ---------- Task List ---------- */
  taskList() {
    if (this.mode !== 'windows') return;
    const ex = this.desktop.wins.find(w => w.o.isTaskList);
    if (ex) { ex.activate(); return; }
    let lb;
    const d = dialog({
      title: 'Task List', w: 300, h: 196,
      build(d) {
        d.win.o.isTaskList = true;
        d.win.o.hideFromTasks = true;
        const tasks = Sys.topWindows().filter(w => w !== d.win && !w.o.dialog);
        lb = UI.listbox({ items: tasks.map(w => w.title), sel: 0, onActivate: () => sw() });
        lb.el.dataset.autofocus = '1';
        const sw = () => { const w = tasks[lb.sel]; d.close(); if (w) w.isMin ? w.restore() : w.activate(); };
        d.add(lb, 8, 8, 284, 110);
        d.add(UI.button('&Switch To', { default: true, onClick: sw }), 8, 128, 88, 25);
        d.add(UI.button('&End Task', { onClick: () => { const w = tasks[lb.sel]; d.close(); if (w) w.close(); } }), 106, 128, 88, 25);
        d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 204, 128, 88, 25);
        d.add(UI.button('&Cascade', { onClick: () => { d.close(); Sys.desktop.cascade(); } }), 8, 162, 88, 25);
        d.add(UI.button('&Tile', { onClick: () => { d.close(); Sys.desktop.tile(); } }), 106, 162, 88, 25);
        d.add(UI.button('&Arrange Icons', { onClick: () => { d.close(); Sys.desktop.arrangeIcons(); } }), 204, 162, 88, 25);
      }
    });
    return d;
  },

  /* ---------- colour schemes ---------- */
  schemeKeys: ['desktop', 'app-workspace', 'window', 'window-text', 'menu', 'menu-text', 'active-title', 'inactive-title', 'active-title-text',
    'inactive-title-text', 'active-border', 'inactive-border', 'window-frame', 'scrollbar', 'btn-face', 'btn-shadow', 'btn-text', 'btn-highlight',
    'disabled-text', 'highlight', 'highlight-text'],
  schemeLabels: {
    desktop: 'Desktop', 'app-workspace': 'Application Workspace', window: 'Window Background', 'window-text': 'Window Text',
    menu: 'Menu Bar', 'menu-text': 'Menu Text', 'active-title': 'Active Title Bar', 'inactive-title': 'Inactive Title Bar',
    'active-title-text': 'Active Title Bar Text', 'inactive-title-text': 'Inactive Title Bar Text', 'active-border': 'Active Border',
    'inactive-border': 'Inactive Border', 'window-frame': 'Window Frame', scrollbar: 'Scroll Bars', 'btn-face': 'Button Face',
    'btn-shadow': 'Button Shadow', 'btn-text': 'Button Text', 'btn-highlight': 'Button Highlight', 'disabled-text': 'Disabled Text',
    highlight: 'Highlight', 'highlight-text': 'Highlighted Text'
  },
  schemes: (() => {
    const base = {
      desktop: '#c0c0c0', 'app-workspace': '#ffffff', window: '#ffffff', 'window-text': '#000000', menu: '#ffffff', 'menu-text': '#000000',
      'active-title': '#000080', 'inactive-title': '#ffffff', 'active-title-text': '#ffffff', 'inactive-title-text': '#000000',
      'active-border': '#c0c0c0', 'inactive-border': '#c0c0c0', 'window-frame': '#000000', scrollbar: '#c0c0c0', 'btn-face': '#c0c0c0',
      'btn-shadow': '#808080', 'btn-text': '#000000', 'btn-highlight': '#ffffff', 'disabled-text': '#808080', highlight: '#000080', 'highlight-text': '#ffffff'
    };
    const S = o => Object.assign({}, base, o);
    return {
      'Windows Default': S({}),
      'Arizona': S({ desktop: '#808040', 'app-workspace': '#ffffe0', 'active-title': '#008080', 'inactive-title': '#c0c0c0', 'active-border': '#c0a080', 'inactive-border': '#e0c0a0', menu: '#e0e0c0', highlight: '#008080' }),
      'Black Leather Jacket': S({ desktop: '#000000', 'app-workspace': '#808080', 'active-title': '#000000', 'inactive-title': '#808080', 'inactive-title-text': '#c0c0c0', menu: '#c0c0c0', 'active-border': '#808080', 'inactive-border': '#c0c0c0', highlight: '#808080' }),
      'Bordeaux': S({ desktop: '#800040', 'app-workspace': '#c0c0c0', 'active-title': '#800080', 'inactive-title': '#c0c0c0', 'active-border': '#808080', highlight: '#800080', menu: '#c0c0c0' }),
      'Cinnamon': S({ desktop: '#804000', 'app-workspace': '#ffffe0', 'active-title': '#800000', 'inactive-title': '#c0c0c0', 'active-border': '#c08040', 'inactive-border': '#c0c0c0', highlight: '#800000', menu: '#c0c0c0' }),
      'Designer': S({ desktop: '#008080', 'app-workspace': '#c0c0c0', 'active-title': '#808080', 'inactive-title': '#c0c0c0', menu: '#c0c0c0', highlight: '#008080', 'active-border': '#c0c0c0' }),
      'Emerald City': S({ desktop: '#004000', 'app-workspace': '#c0c0c0', 'active-title': '#008040', 'inactive-title': '#c0c0c0', 'active-border': '#008080', 'inactive-border': '#c0c0c0', menu: '#c0c0c0', highlight: '#008040' }),
      'Fluorescent': S({ desktop: '#000000', 'app-workspace': '#ffffff', 'active-title': '#ff00ff', 'inactive-title': '#00ff00', 'active-border': '#00ffff', 'inactive-border': '#ffff00', menu: '#00ff00', highlight: '#ff00ff' }),
      'Hotdog Stand': S({ desktop: '#ffff00', 'app-workspace': '#ff0000', window: '#ff0000', 'window-text': '#ffffff', menu: '#ffffff', 'menu-text': '#000000', 'active-title': '#000000', 'active-title-text': '#ffffff', 'inactive-title': '#ff0000', 'inactive-title-text': '#ffffff', 'active-border': '#ff0000', 'inactive-border': '#ff0000', highlight: '#000000', 'highlight-text': '#ffffff', scrollbar: '#ffff00' }),
      'LCD Default Screen Settings': S({ desktop: '#808080', 'app-workspace': '#c0c0c0', 'active-title': '#000000', 'inactive-title': '#c0c0c0', highlight: '#000000', menu: '#c0c0c0' }),
      'LCD Reversed - Dark': S({ desktop: '#000000', 'app-workspace': '#000080', window: '#000080', 'window-text': '#ffffff', menu: '#808080', 'menu-text': '#ffffff', 'active-title': '#008080', 'inactive-title': '#808080', 'active-border': '#808080', highlight: '#c0c0c0', 'highlight-text': '#000000' }),
      'LCD Reversed - Light': S({ desktop: '#808080', 'app-workspace': '#c0c0c0', window: '#c0c0c0', 'active-title': '#000000', 'inactive-title': '#ffffff', highlight: '#808080' }),
      'Ocean': S({ desktop: '#008080', 'app-workspace': '#c0e0ff', 'active-title': '#000080', 'inactive-title': '#80c0c0', 'active-border': '#0080c0', 'inactive-border': '#80c0c0', menu: '#c0e0ff', highlight: '#008080' }),
      'Pastel': S({ desktop: '#c0c0ff', 'app-workspace': '#ffffe0', 'active-title': '#ffc0e0', 'active-title-text': '#000000', 'inactive-title': '#e0ffe0', 'active-border': '#c0e0ff', 'inactive-border': '#e0e0e0', menu: '#ffffe0', highlight: '#8080ff' }),
      'Patchwork': S({ desktop: '#808000', 'app-workspace': '#c0c0c0', 'active-title': '#800000', 'inactive-title': '#008080', 'inactive-title-text': '#ffffff', 'active-border': '#ffff00', 'inactive-border': '#00ffff', menu: '#00ff00', highlight: '#800080' }),
      'Plasma Power Saver': S({ desktop: '#000000', 'app-workspace': '#000080', window: '#000000', 'window-text': '#ffff00', 'active-title': '#ff0000', 'inactive-title': '#808080', menu: '#c0c0c0', 'active-border': '#ff00ff', highlight: '#ff0000' }),
      'Rugby': S({ desktop: '#000080', 'app-workspace': '#ffffff', 'active-title': '#800000', 'inactive-title': '#c0c0c0', 'active-border': '#ffff00', 'inactive-border': '#c0c0c0', menu: '#c0c0c0', highlight: '#800000' }),
      'The Blues': S({ desktop: '#000080', 'app-workspace': '#c0c0c0', 'active-title': '#0000ff', 'inactive-title': '#8080c0', 'inactive-title-text': '#ffffff', 'active-border': '#8080ff', 'inactive-border': '#c0c0c0', menu: '#c0c0ff', highlight: '#0000ff' }),
      'Tweed': S({ desktop: '#808040', 'app-workspace': '#c0c0a0', 'active-title': '#404000', 'inactive-title': '#c0c0a0', 'active-border': '#808060', 'inactive-border': '#c0c0a0', menu: '#e0e0c0', highlight: '#404000' }),
      'Valentine': S({ desktop: '#ff80c0', 'app-workspace': '#ffe0f0', 'active-title': '#ff0080', 'inactive-title': '#ffc0e0', 'active-border': '#ff80c0', 'inactive-border': '#ffe0f0', menu: '#ffe0f0', highlight: '#ff0080' }),
      'Wingtips': S({ desktop: '#808080', 'app-workspace': '#c0c0c0', 'active-title': '#800000', 'inactive-title': '#808080', 'inactive-title-text': '#c0c0c0', 'active-border': '#c0c0c0', menu: '#c0c0c0', highlight: '#800000' }),
      'Neo10 Dark': S({ desktop: '#000000', 'app-workspace': '#808080', window: '#000000', 'window-text': '#ffffff', menu: '#808080', 'menu-text': '#ffffff', 'active-title': '#000080', 'inactive-title': '#808080', 'inactive-title-text': '#c0c0c0', 'active-border': '#808080', 'inactive-border': '#808080', scrollbar: '#808080', 'btn-face': '#c0c0c0', highlight: '#000080' }),
      'High Contrast Black': S({ desktop: '#000000', 'app-workspace': '#000000', window: '#000000', 'window-text': '#ffffff', menu: '#000000', 'menu-text': '#ffffff', 'active-title': '#800080', 'active-title-text': '#ffffff', 'inactive-title': '#008000', 'inactive-title-text': '#ffffff', 'active-border': '#ffff00', 'inactive-border': '#008000', 'window-frame': '#ffffff', scrollbar: '#000000', 'btn-face': '#000000', 'btn-text': '#ffffff', 'btn-shadow': '#808080', 'btn-highlight': '#ffffff', 'disabled-text': '#00ff00', highlight: '#800080', 'highlight-text': '#ffffff' }),
    };
  })(),
  currentColors() {
    const name = Store.get('scheme', 'Windows Default');
    return Object.assign({}, this.schemes['Windows Default'], this.schemes[name] || Store.get('customSchemes', {})[name] || {}, Store.get('colorsOverride', {}));
  },
  applyScheme(colors = this.currentColors()) {
    const st = document.documentElement.style;
    for (const k of this.schemeKeys) st.setProperty('--' + k, colors[k]);
    st.setProperty('--border-w', Store.get('borderWidth', 3) + 'px');
    st.setProperty('--blink', Settings.blinkMs() * 2 + 'ms');
    // icon titles are drawn in black or white, whichever contrasts with what's behind them
    const contrast = hx => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hx.slice(i, i + 2), 16)); return (r * 299 + g * 587 + b * 114) / 1000 < 128 ? '#ffffff' : '#000000'; };
    st.setProperty('--desktop-text', contrast(colors.desktop));
    st.setProperty('--workspace-text', contrast(colors['app-workspace']));
    this.applyPattern(colors.desktop);
  },

  /* ---------- desktop pattern & wallpaper ---------- */
  patterns: {
    '(None)': null,
    '50% Gray': [170, 85, 170, 85, 170, 85, 170, 85],
    'Boxes': [127, 65, 65, 65, 65, 65, 127, 0],
    'Critters': [0, 80, 114, 32, 0, 5, 39, 2],
    'Diamonds': [32, 80, 136, 80, 32, 0, 0, 0],
    'Paisley': [2, 7, 7, 2, 32, 80, 80, 32],
    'Quilt': [130, 68, 40, 17, 40, 68, 130, 1],
    'Scottie': [64, 192, 200, 120, 120, 72, 0, 0],
    'Spinner': [20, 12, 200, 121, 158, 19, 48, 40],
    'Thatches': [248, 116, 34, 71, 143, 23, 34, 113],
    'Tulip': [0, 0, 84, 124, 124, 56, 146, 124],
    'Waffle': [0, 0, 0, 0, 128, 128, 128, 240],
    'Weave': [136, 84, 34, 69, 136, 21, 34, 81]
  },
  patternURL(bits, bg, fg = '#000') {
    if (!bits) return null;
    const c = h('canvas', { width: 8, height: 8 }), x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, 8, 8); x.fillStyle = fg;
    bits.forEach((b, y) => { for (let i = 0; i < 8; i++) if (b & (128 >> i)) x.fillRect(i, y, 1, 1); });
    return c.toDataURL();
  },
  applyPattern(bg) {
    const name = Store.get('pattern', '(None)');
    const bits = Store.get('customPatterns', {})[name] || this.patterns[name];
    const url = this.patternURL(bits, bg || this.currentColors().desktop);
    this.deskEl.style.backgroundImage = url ? `url(${url})` : 'none';
  },
  applyDesktop() {
    this.applyPattern();
    const wp = Store.get('wallpaper', '(None)');
    if (Store.get('wallFit') === 'fill') Store.set('wallFit', 'tile');   // old stretch-to-fill setting
    const fit = Store.get('wallFit', Store.get('wallTile', true) ? 'tile' : 'center');
    Object.assign(this.wallEl.style, { backgroundImage: 'none', backgroundRepeat: '', backgroundPosition: '', backgroundColor: '' });
    this.wallEl.classList.toggle('center', fit !== 'tile');
    if (wp && wp !== '(None)') {
      const path = wp.includes('\\') ? wp : 'C:\\WINDOWS\\' + wp;
      const url = Wallpapers.urlFor(path);
      if (url) {
        // always 1:1 — tiled (or centred) like Windows 3.1, never stretched
        if (fit === 'tile') Object.assign(this.wallEl.style, Wallpapers.tileStyle(path));
        else this.wallEl.style.backgroundImage = `url(${url})`;
      }
    }
    Trails.enable(Store.get('trails', false));
    this.screen.classList.toggle('notitlewrap', !Store.get('iconWrap', true));
  },

  /* ---------- starting / leaving Windows ---------- */
  async startWindows() {
    this.mode = 'windows';
    this.textKey = null;
    this.shellMode = Store.get('shell', 'neo10');
    if (this.isNeo()) return Shell10.start();
    this.deskEl.classList.add('hidden');
    const splash = h('div', { class: 'splash' },
      h('div', { class: 'box' },
        flagImg(0, 3, 48, 42),
        h('div', {},
          h('div', { class: 't1', text: 'Microsoft®' }),
          h('div', { class: 't2', text: 'Windows™' }),
          h('div', { class: 't3', text: 'Version 3.1' }),
          h('div', { class: 't4', html: 'Copyright © 1985-1992 Microsoft Corp.<br>Neo31 re-creation — all simulated, nothing real was harmed.' }))));
    this.screen.appendChild(splash);
    this.screen.classList.add('busy');
    await sleep(Store.get('fastBoot') ? 400 : 2200);
    splash.remove();
    this.deskEl.classList.remove('hidden');
    IniSync.read();
    this.applyScheme();
    this.applyDesktop();
    IniSync.write();
    await sleep(250);
    this.screen.classList.remove('busy');
    this.run('progman', { quiet: true });
    Snd.event('SystemStart');
    Saver.reset();
    this.emit('started');
  },

  async exitWindows(opts = {}) {
    if (this.isNeo()) return Shell10.shutdown(false, opts);
    if (this.exiting) return;
    if (!opts.noPrompt) {
      const r = await new Promise(res => {
        const d = dialog({
          title: 'Exit Windows', w: 250, h: 80, owner: opts.owner,
          build(d) {
            d.add(UI.label('This will end your Windows session.'), 12, 14);
            d.add(UI.button('OK', { default: true, onClick: () => d.close('ok') }), 54, 44, 62, 26);
            d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close('cancel') }), 134, 44, 62, 26);
          }
        });
        d.promise.then(res);
      });
      if (r !== 'ok') return;
    }
    this.exiting = true;
    // close windows; any may veto
    const wins = this.desktop.ordered().reverse();
    for (const w of wins) {
      if (w.closed) continue;
      if (w.app && w.app.id === 'progman') continue;
      const ok = await w.close();
      if (!ok) { this.exiting = false; return; }
    }
    this.emit('exiting');
    for (const w of this.desktop.wins.slice()) await w.close(true);
    this.exiting = false;
    Store.flush(); FS.flush();
    Saver.stop();
    Snd.event('SystemExit');
    this.screen.classList.add('busy');
    await sleep(600);
    this.screen.classList.remove('busy');
    this.deskEl.classList.add('hidden');
    this.mode = 'dos';
    DOS.returnFromWindows();
  }
});

/* ======================= WALLPAPERS ======================= */
const Wallpapers = {
  cache: {},
  rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; },
  canvas(w, hh) { const c = h('canvas', { width: w, height: hh }); return [c, c.getContext('2d')]; },

  /* CSS for a picture tiled at 1:1. Most repeat both ways; a landscape repeats sideways along the bottom with a tile of its sky above. */
  tileStyle(path) {
    const n = FS.get(path), url = this.urlFor(path);
    const sky = { LOCK10: 'STARS' }[n && n.g];
    if (!sky) return { backgroundImage: `url(${url})`, backgroundRepeat: 'repeat', backgroundPosition: 'left top', backgroundColor: '' };
    return { backgroundImage: `url(${url}), url(${this.gen(sky).toDataURL()})`, backgroundRepeat: 'repeat-x, repeat', backgroundPosition: 'left bottom, left top', backgroundColor: '#000080' };
  },
  urlFor(path) {
    const n = FS.get(path);
    if (!n) return null;
    if (n.g) return this.gen(n.g)?.toDataURL();
    if (n.x && n.x.startsWith('data:image')) return n.x;
    return null;
  },
  gen(name) {
    if (this.cache[name]) return this.cache[name];
    const f = this.makers[name];
    if (!f) return null;
    return (this.cache[name] = f.call(this));
  },
  /* All wallpapers are rasterised on a pixel grid in the 16-colour palette */
  px(w, hh, bg, fn) { const g = new PixGrid(w, hh); if (bg) g.f(0, 0, w, hh, bg); fn(g, this.rng(w * 31 + hh)); return g.canvas(); },
  makers: {
    REDBRICK() {
      return this.px(32, 16, 'S', g => {
        const brick = (bx, by) => { g.f(bx, by, 15, 7, 'r'); g.l(bx, by, bx + 14, by, 'R'); g.l(bx, by, bx, by + 6, 'R'); g.l(bx, by + 6, bx + 14, by + 6, 'K'); };
        brick(0, 0); brick(16, 0); brick(-8, 8); brick(8, 8); brick(24, 8);
      });
    },
    SQUARES() {
      return this.px(16, 16, 'N', g => { g.f(1, 1, 13, 13, 'B'); g.l(1, 1, 13, 1, 'C'); g.l(1, 1, 1, 13, 'C'); g.l(14, 1, 14, 14, 'K'); g.l(1, 14, 14, 14, 'K'); g.f(6, 6, 4, 4, 'C'); });
    },
    RIVETS() {
      return this.px(24, 24, 'G', g => {
        for (const [x, y] of [[5, 5], [17, 17]]) { g.m(x - 3, y - 3, ['..KKK..', '.KSSWK.', 'KSWWSSK', 'KSWSSGK', 'KSSSGGK', '.KSGGK.', '..KKK..']); }
      });
    },
    HONEY() {
      return this.px(28, 48, 'y', g => {
        const hex = (cx, cy) => {
          for (let y = -12; y <= 12; y++) { const half = 12 - Math.abs(y) / 2; g.l(cx - half + 1, cy + y, cx + half - 1, cy + y, 'Y'); }
          for (const [a, b] of [[[-12, 0], [-6, -11]], [[-6, -11], [6, -11]], [[6, -11], [12, 0]], [[12, 0], [6, 11]], [[6, 11], [-6, 11]], [[-6, 11], [-12, 0]]]) g.l(cx + a[0], cy + a[1], cx + b[0], cy + b[1], 'K');
        };
        for (const [x, y] of [[0, 0], [28, 0], [14, 24], [0, 48], [28, 48]]) hex(x, y);
      });
    },
    THATCH() {
      return this.px(16, 16, 'y', g => {
        for (let i = -16; i < 32; i += 4) g.l(i, 0, i + 8, 16, 'Y');
        for (let i = -16; i < 32; i += 8) g.l(i + 16, 0, i + 8, 16, 'K');
      });
    },
    ARGYLE() {
      return this.px(32, 32, 'r', g => {
        for (let y = 0; y < 32; y++) { const half = 16 - Math.abs(y - 16); g.l(16 - half, y, 16 + half - 1, y, 'c'); }
        g.l(0, 0, 31, 31, 'Y'); g.l(31, 0, 0, 31, 'Y');
      });
    },
    ARCADE() {
      return this.px(32, 32, 'G', g => {
        for (let y = 5; y < 32; y++) for (let x = 5; x < 27; x++) if (y >= 16 || (x - 15.5) ** 2 + (y - 16) ** 2 <= 110) g.p(x, y, 'N');
        g.ring(15.5, 16, 12, 'S'); g.f(0, 30, 32, 2, 'S'); g.f(0, 16, 4, 14, 'S'); g.f(28, 16, 4, 14, 'S');
      });
    },
    CASTLE() {
      return this.px(64, 32, 'K', (g, r) => {
        const shades = ['G', 'S', 'G', 'S', 'G'];
        for (let row = 0; row < 4; row++) {
          let x = row % 2 ? -10 : 0;
          while (x < 64) { const w = 12 + Math.floor(r() * 12); g.f(x + 1, row * 8 + 1, w - 1, 7, shades[Math.floor(r() * 5)]); g.l(x + 1, row * 8 + 1, x + w - 1, row * 8 + 1, 'W'); x += w; }
        }
      });
    },
    MARBLE() {
      return this.px(64, 64, 'g', (g, r) => {
        const n = Array.from({ length: 16 }, () => r() * 6.28);
        const shades = ['g', 'c', 'S', 'W', 'S', 'c'];
        for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
          let t = 0; for (let k = 1; k <= 3; k++) t += Math.sin(x * k * 0.098 + n[k] + Math.sin(y * 0.196 * k + n[k + 4]) * 1.5) / k;
          const v = (Math.sin(y * 0.098 + t * 2) + 1) / 2;
          // ordered dither between two shades
          const lv = v * (shades.length - 1), i = Math.floor(lv), fr = lv - i;
          const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]][y % 4][x % 4] / 16;
          g.p(x, y, shades[Math.min(shades.length - 1, i + (fr > bayer ? 1 : 0))]);
        }
      });
    },
    TARTAN() {
      return this.px(48, 48, 'g', g => {
        for (const [o, w, c] of [[0, 12, 'N'], [20, 4, 'r'], [30, 8, 'N'], [42, 2, 'Y']]) {
          for (let y = 0; y < 48; y++) for (let x = o; x < o + w; x++) if ((x + y) % 2) g.p(x, y, c);
          for (let x = 0; x < 48; x++) for (let y = o; y < o + w; y++) if ((x + y) % 2 === 0) g.p(x, y, c);
        }
      });
    },
    ZIGZAG() {
      return this.px(16, 16, 'Y', g => {
        for (const oy of [4, 12]) for (let d = -1; d <= 1; d++) { g.l(0, oy + 3 + d, 4, oy - 1 + d, 'r'); g.l(4, oy - 1 + d, 8, oy + 3 + d, 'r'); g.l(8, oy + 3 + d, 12, oy - 1 + d, 'r'); g.l(12, oy - 1 + d, 16, oy + 3 + d, 'r'); }
      });
    },
    EGYPT() {
      return this.px(32, 32, 'N', g => {
        for (let y = 4; y < 28; y++) { const half = Math.round((y - 4) * 14 / 24); g.l(16 - half, y, 15, y, 'Y'); g.l(16, y, 16 + half, y, 'y'); }
        g.f(0, 28, 32, 4, 'S');
      });
    },
    CHITZ() {
      return this.px(96, 96, 'W', (g, r) => {
        const cols = ['R', 'L', 'B', 'M', 'Y', 'C', 'K', 'm'];
        for (let i = 0; i < 60; i++) {
          let x = r() * 96, y = r() * 96;
          const c = cols[i % cols.length];
          for (let k = 0; k < 3; k++) { const nx = x + r() * 16 - 8, ny = y + r() * 16 - 8; g.l(x, y, nx, ny, c); g.l(x + 1, y, nx + 1, ny, c); x = nx; y = ny; }
        }
      });
    },
    LEAVES() {
      return this.px(96, 96, 'g', (g, r) => {
        for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) if ((x + y) % 2 && r() < 0.3) g.p(x, y, 'K');
        for (let i = 0; i < 55; i++) {
          const x = Math.floor(r() * 90), y = Math.floor(r() * 90), c = ['L', 'y', 'g', 'Y', 'r'][Math.floor(r() * 5)];
          if (r() < 0.5) { g.ell(x, y, 13, 6, c, 'K'); g.l(x + 1, y + 3, x + 11, y + 3, 'K'); }
          else { g.ell(x, y, 6, 13, c, 'K'); g.l(x + 3, y + 1, x + 3, y + 11, 'K'); }
        }
      });
    },
    WINLOGO() {
      const g = new PixGrid(320, 160);
      g.f(0, 0, 320, 160, 'K');
      const f = flagGrid(96, 84);
      for (let y = 0; y < 84; y++) for (let x = 0; x < 96; x++) { const c = f.get(x, y); if (c) g.p(16 + x, 36 + y, c); }
      g.t(124, 48, 'MICROSOFT', 'W', 2);
      g.t(124, 70, 'WINDOWS', 'W', 4);
      g.t(124, 104, 'VERSION 3.1', 'S', 2);
      return g.canvas();
    }
  }
};

/* Draw the pixel flag scaled with nearest-neighbour (no smoothing) */
function drawFlag(x, ox, oy, size) {
  const c = flagCanvas(32, 28);
  x.imageSmoothingEnabled = false;
  const s = Math.max(1, Math.round(size / 32));
  x.drawImage(c, Math.round(ox), Math.round(oy), 32 * s, 28 * s);
}

function pixLine(x, [x0, y0], [x1, y1]) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) { x.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
}

/* ======================= SCREEN SAVERS ======================= */
const Saver = {
  active: null,
  last: Date.now(),
  list: ['(None)', 'Blank Screen', 'Flying Windows', 'Marquee', 'Mystify', 'Starfield Simulation'],
  reset() { this.last = Date.now(); this.schedule(); },
  schedule() {
    clearTimeout(this._t); clearTimeout(this._off);
    if (Sys.mode !== 'windows') return;
    const name = Store.get('saver', '(None)');
    const left = ms => Math.max(1000, ms - (Date.now() - this.last));
    if (name !== '(None)') this._t = setTimeout(() => this.start(name), left(Store.get('saverDelay', 2) * 60000));
    // Neo10 Power & sleep: blank the screen after N minutes
    const off = Store.get('screenOff', 0);
    if (Sys.isNeo() && off) this._off = setTimeout(() => { if (this.active) { this.stop(); } this.start('Blank Screen'); }, left(off * 60000));
  },
  activity(e) {
    if (this.active) {
      if (this.active.prompt) { if (!this.active.prompt.contains(e.target)) { e.stopPropagation(); } this.active.promptT = Date.now(); return; }
      if (e.type === 'pointermove') {
        if (this._mx == null) { this._mx = e.clientX; this._my = e.clientY; return; }
        if (Math.abs(e.clientX - this._mx) + Math.abs(e.clientY - this._my) < 8) return;
      }
      if (Date.now() - this.active.t0 < 500) return;
      e.preventDefault(); e.stopPropagation();
      if (Store.get('saverPwOn', false) && Store.get('saverPassword', '') && !this.active.test) this.askPassword();
      else this.stop();
      return;
    }
    if (Date.now() - this.last > 1000) { this.last = Date.now(); this.schedule(); }
  },
  /* Password-protected screen saver: a password box appears over the saver
     and it resumes if nothing is typed for a while (as in Windows 3.1). */
  askPassword() {
    const st = this.active;
    Sys.screen.classList.remove('nocursor');
    const t = h('input', { class: 'tx', type: 'password', style: { width: '170px' } });
    const ok = h('button', { class: 'btn default', style: { width: '70px', height: '25px' } }, h('span', { class: 'bl', text: 'OK' }));
    const cancel = h('button', { class: 'btn', style: { width: '70px', height: '25px' } }, h('span', { class: 'bl', text: 'Cancel' }));
    const msg = h('div', { class: 'txt' , text: 'Password:' });
    const box = h('div', { class: 'win dlg active', style: { position: 'absolute', zIndex: 2, width: '300px', left: 'calc(50% - 150px)', top: 'calc(50% - 50px)' } },
      h('div', { class: 'inner' },
        h('div', { class: 'tb' }, h('div', { class: 'cap', text: 'Screen Saver' })),
        h('div', { class: 'body', style: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' } },
          h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, msg, t),
          h('div', { style: { display: 'flex', gap: '10px', justifyContent: 'center' } }, ok, cancel))));
    st.el.appendChild(box);
    st.prompt = box; st.promptT = Date.now();
    const close = () => { box.remove(); st.prompt = null; clearInterval(iv); Sys.screen.classList.add('nocursor'); this._mx = null; st.t0 = Date.now(); };
    const check = () => {
      if (t.value === Store.get('saverPassword', '')) { close(); this.stop(); }
      else { Snd.beep(); msg.textContent = 'Incorrect password.'; t.value = ''; t.focus(); }
    };
    ok.addEventListener('click', check);
    cancel.addEventListener('click', close);
    t.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') check(); if (e.key === 'Escape') close(); });
    const iv = setInterval(() => { if (Date.now() - st.promptT > 20000) close(); }, 1000);
    setTimeout(() => t.focus(), 0);
  },
  stop() {
    if (!this.active) return;
    cancelAnimationFrame(this.active.raf);
    this.active.el.remove();
    this.active = null;
    Sys.screen.classList.remove('nocursor');
    this._mx = null;
    this.reset();
  },
  start(name, preview, test = false) {
    if (this.active) return;
    const el = h('div', { class: 'saver' });
    const W = Sys.screen.clientWidth, H = Sys.screen.clientHeight;
    const c = h('canvas', { width: W, height: H });
    el.appendChild(c);
    (preview || Sys.screen).appendChild(el);
    Sys.screen.classList.add('nocursor');
    Menu.closeAll(true);
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    const st = { el, t0: Date.now(), raf: 0, test };
    this.active = st;
    const fx = this.effects[name];
    if (!fx) return;
    const step = fx(x, W, H);
    let lt = performance.now();
    const loop = t => { const dt = Math.min(0.05, (t - lt) / 1000); lt = t; step(dt); st.raf = requestAnimationFrame(loop); };
    st.raf = requestAnimationFrame(loop);
  },
  effects: {
    'Blank Screen': () => () => {},
    'Flying Windows'(x, W, H) {
      const speed = Store.get('flySpeed', 50) / 50;
      const N = Store.get('flyCount', 40);
      const mk = (z) => ({ x: (Math.random() - .5) * 2, y: (Math.random() - .5) * 2, z: z ?? Math.random() * 4 + .2, ph: Math.random() * 6 });
      const ws = Array.from({ length: N }, () => mk());
      return dt => {
        x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
        ws.sort((a, b) => b.z - a.z);
        for (const w of ws) {
          w.z -= dt * 0.8 * speed; w.ph += dt * 8;
          if (w.z < 0.05) Object.assign(w, mk(4));
          const sx = W / 2 + w.x * W / 2 / w.z * 0.6, sy = H / 2 + w.y * H / 2 / w.z * 0.6;
          const sz = 18 / w.z;
          if (sx < -sz || sx > W + sz || sy < -sz || sy > H + sz) { Object.assign(w, mk(4)); continue; }
          drawFlag(x, sx - sz / 2, sy - sz / 2, sz);
        }
      };
    },
    'Starfield Simulation'(x, W, H) {
      const speed = Store.get('starSpeed', 50) / 50;
      const stars = Array.from({ length: Store.get('starCount', 200) }, () => ({ x: (Math.random() - .5) * 2, y: (Math.random() - .5) * 2, z: Math.random() * 3 + .1 }));
      return dt => {
        x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
        for (const s of stars) {
          s.z -= dt * speed;
          if (s.z < 0.05) { s.x = (Math.random() - .5) * 2; s.y = (Math.random() - .5) * 2; s.z = 3; }
          const sx = W / 2 + s.x * W / 2 / s.z, sy = H / 2 + s.y * H / 2 / s.z;
          const b = clamp(1 - s.z / 3, 0, 1), r = b * 2.5 + .5;
          x.fillStyle = `rgba(255,255,255,${b + .2})`;
          x.fillRect(sx, sy, r, r);
        }
      };
    },
    'Mystify'(x, W, H) {
      const nPolys = Store.get('mystPolys', 2), trail = Store.get('mystTrail', 5);
      const polys = Array.from({ length: nPolys }, (_, k) => ({
        pts: Array.from({ length: 4 }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() * 2 + 1) * (Math.random() < .5 ? -1 : 1) * 120, vy: (Math.random() * 2 + 1) * (Math.random() < .5 ? -1 : 1) * 120 })),
        hist: [], hue: k * 360 / nPolys
      }));
      return dt => {
        x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
        for (const p of polys) {
          for (const v of p.pts) {
            v.x += v.vx * dt; v.y += v.vy * dt;
            if (v.x < 0 || v.x > W) { v.vx *= -1; v.x = clamp(v.x, 0, W); }
            if (v.y < 0 || v.y > H) { v.vy *= -1; v.y = clamp(v.y, 0, H); }
          }
          p.hue = (p.hue + dt * 30) % 360;
          p.hist.unshift(p.pts.map(v => [v.x, v.y]));
          if (p.hist.length > trail * 8) p.hist.length = trail * 8;
          x.strokeStyle = `hsl(${p.hue},100%,50%)`;
          x.fillStyle = x.strokeStyle;
          p.hist.forEach((pts, i) => {
            if (i % 8) return;
            pts.forEach((a, j) => pixLine(x, a, pts[(j + 1) % pts.length]));
          });
        }
      };
    },
    'Marquee'(x, W, H) {
      const text = Store.get('marqueeText', 'Neo31 — Windows 3.1');
      const col = Store.get('marqueeColor', '#ffff00');
      const tg = new PixGrid(Math.max(8, text.length * 6), 6);
      tg.t(0, 0, text.toUpperCase(), 'W');
      const tc = tg.canvas(), sc = 5, tw = tc.width * sc;
      let px = W, py = H / 2;
      const speed = Store.get('marqueeSpeed', 120);
      return dt => {
        x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
        px -= speed * dt;
        if (px < -tw) { px = W; py = 50 + Math.random() * (H - 100); }
        x.imageSmoothingEnabled = false;
        x.drawImage(tc, Math.round(px), Math.round(py), tw, tc.height * sc);
        x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(Math.round(px), Math.round(py), tw, tc.height * sc); x.globalCompositeOperation = 'source-over';
      };
    }
  }
};

/* ======================= MOUSE TRAILS ======================= */
const Trails = {
  on: false, els: [], pts: [],
  enable(on) {
    this.on = on;
    if (!on) { this.els.forEach(e => e.remove()); this.els = []; return; }
    if (this.els.length) return;
    const url = getComputedStyle(document.documentElement).getPropertyValue('--cur-arrow').match(/url\("?(.*?)"?\)/);
    for (let i = 0; i < 6; i++) {
      const e = h('div', { class: 'trails' });
      e.style.background = url ? `url(${url[1]}) no-repeat` : '';
      e.style.opacity = String(0.85 - i * 0.12);
      Sys.screen.appendChild(e);
      this.els.push(e);
    }
  },
  move(e) {
    if (!this.on || Sys.mode !== 'windows') return;
    const p = Sys.pointer(e);
    this.pts.unshift(p);
    this.pts.length = Math.min(this.pts.length, 20);
    this.els.forEach((el, i) => {
      const q = this.pts[(i + 1) * 3] || p;
      el.style.left = q.x + 'px'; el.style.top = q.y + 'px';
    });
  }
};
