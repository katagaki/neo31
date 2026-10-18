'use strict';
/* Neo10 — the Windows 10 experience drawn with Windows 3.1's pixels:
   boot/lock/sign-in, taskbar, Start menu with live tiles, search, Action
   Center & toasts, flyouts, Task View with virtual desktops, desktop icons,
   Windows-key shortcuts, and shut down / restart / sign out. */

const USER_HOME = 'C:\\USERS\\USER';
const KNOWN = {
  desktop: USER_HOME + '\\DESKTOP', documents: USER_HOME + '\\DOCUMENTS', downloads: USER_HOME + '\\DOWNLOADS',
  pictures: USER_HOME + '\\PICTURES', music: USER_HOME + '\\MUSIC', recycle: 'C:\\RECYCLED'
};

/* Start-menu catalogue: Windows 10 names for the programs */
const NEO_APPS = [
  { name: 'Alarms & Clock', cmd: 'CLOCK.EXE', icon: 'clock' },
  { name: 'Calculator', cmd: 'CALC.EXE', icon: 'calc' },
  { name: 'Calendar', cmd: 'CALENDAR.EXE', icon: 'calendar' },
  { name: 'Command Prompt', cmd: 'CMD', icon: 'cmd', folder: 'Windows System' },
  { name: 'Control Panel', cmd: 'CONTROL.EXE', icon: 'control', folder: 'Windows System' },
  { name: 'File Explorer', cmd: 'EXPLORER', icon: 'explorer', folder: 'Windows System' },
  { name: 'Run', cmd: 'RUN', icon: 'runbox', folder: 'Windows System' },
  { name: 'Task Manager', cmd: 'TASKMGR', icon: 'taskmgr', folder: 'Windows System' },
  { name: 'This PC', cmd: 'EXPLORER thispc', icon: 'thispc', folder: 'Windows System' },
  { name: 'Character Map', cmd: 'CHARMAP.EXE', icon: 'charmap', folder: 'Windows Accessories' },
  { name: 'Notepad', cmd: 'NOTEPAD.EXE', icon: 'notepad', folder: 'Windows Accessories' },
  { name: 'Paint', cmd: 'PBRUSH.EXE', icon: 'pbrush', folder: 'Windows Accessories' },
  { name: 'WordPad', cmd: 'WRITE.EXE', icon: 'write', folder: 'Windows Accessories' },
  { name: 'Microsoft Word', cmd: 'WINWORD.EXE', icon: 'winword', folder: 'Office' },
  { name: 'Microsoft Excel', cmd: 'EXCEL.EXE', icon: 'excel', folder: 'Office' },
  { name: 'Microsoft PowerPoint', cmd: 'POWERPNT.EXE', icon: 'powerpoint', folder: 'Office' },
  { name: 'Print Manager', cmd: 'PRINTMAN.EXE', icon: 'printman', folder: 'Windows Accessories' },
  { name: 'Clipboard Viewer', cmd: 'CLIPBRD.EXE', icon: 'clipbrd', folder: 'Windows Accessories' },
  { name: 'Media Player', cmd: 'MPLAYER.EXE', icon: 'mplayer', folder: 'Windows Accessories' },
  { name: 'Voice Recorder', cmd: 'SOUNDREC.EXE', icon: 'soundrec' },
  { name: 'Microsoft Solitaire Collection', cmd: 'SOL.EXE', icon: 'sol' },
  { name: 'Microsoft Edge', cmd: 'MSEDGE.EXE', icon: 'edge' },
  { name: 'Minesweeper', cmd: 'WINMINE.EXE', icon: 'winmine' },
  { name: 'Settings', cmd: 'SETTINGS', icon: 'settings10' },
  { name: 'Weather', cmd: 'WEATHER', icon: 'weather' },
  { name: 'Cardfile', cmd: 'CARDFILE.EXE', icon: 'cardfile', folder: 'Windows 3.1 Classics' },
  { name: 'Program Manager', cmd: 'PROGMAN.EXE', icon: 'progman', folder: 'Windows 3.1 Classics' },
  { name: 'File Manager', cmd: 'WINFILE.EXE', icon: 'winfile', folder: 'Windows 3.1 Classics' },
  { name: 'Terminal', cmd: 'TERMINAL.EXE', icon: 'terminal', folder: 'Windows 3.1 Classics' },
  { name: 'Windows Setup', cmd: 'SETUP.EXE', icon: 'setup', folder: 'Windows 3.1 Classics' },
  { name: 'Read Me', cmd: 'WRITE.EXE C:\\WINDOWS\\README.WRI', icon: 'wri', folder: 'Windows 3.1 Classics' },
  { name: 'Help', cmd: 'WINHELP.EXE progman', icon: 'help', folder: 'Windows 3.1 Classics' }
];
const appByCmd = cmd => NEO_APPS.find(a => a.cmd.toUpperCase() === String(cmd).toUpperCase());
/* which app (by registry id) a catalogue entry starts — used to group taskbar buttons */
const appIdOf = a => {
  const map = { CMD: 'dos', EXPLORER: 'explorer', 'EXPLORER THISPC': 'explorer', SETTINGS: 'settings10', TASKMGR: 'taskmgr', WEATHER: 'weather', RUN: null };
  if (a.cmd.toUpperCase() in map) return map[a.cmd.toUpperCase()];
  const f = FS.which(Sys.splitCmd(a.cmd)[0]);
  const n = f && FS.get(f);
  return n && n.a;
};

const Shell10 = {
  TB: 41,
  notes: [],
  vds: ['Desktop 1'],
  started: false,

  /* ======================= START-UP ======================= */
  async start() {
    Sys.mode = 'windows';
    this.ensureProfile();
    Sys.deskEl.classList.add('hidden', 'neo');
    const boot = this.bootScreen();
    await sleep(Store.get('fastBoot') ? 600 : 2600);
    IniSync.read();
    if (!Store.get('neo.inited')) {
      Store.set('neo.inited', true);
      if (Store.get('wallpaper', '(None)') === '(None)') { Store.set('wallpaper', 'NEO10.BMP'); Store.set('wallFit', 'tile'); Store.set('wallTile', true); }
    }
    Sys.applyScheme();
    Sys.applyDesktop();
    IniSync.write();
    this.buildDesktop();
    Sys.deskEl.classList.remove('hidden');
    boot.remove();
    Sys.screen.classList.remove('busy');
    await this.lockAndSignIn(true);
  },

  ensureProfile() {
    FS.repairSystem();
    const mk = p => { if (!FS.exists(p)) { try { FS.mkdir(p); } catch {} } };
    mk('C:\\USERS'); mk(USER_HOME);
    const names = { DESKTOP: 'Desktop', DOCUMENTS: 'Documents', DOWNLOADS: 'Downloads', PICTURES: 'Pictures', MUSIC: 'Music' };
    for (const [k, v] of Object.entries(names)) { mk(USER_HOME + '\\' + k); const n = FS.get(USER_HOME + '\\' + k); if (n && !n.n) n.n = v; }
    const u = FS.get('C:\\USERS'); if (u) u.n = 'Users';
    const dos = FS.get('C:\\DOS'); if (dos) dos.n = 'DOS';
    const uh = FS.get(USER_HOME); if (uh) uh.n = 'User';
    mk(KNOWN.recycle); const r = FS.get(KNOWN.recycle); if (r) { r.h = true; r.n = '$Recycle.Bin'; }
    const W = 'C:\\WINDOWS\\';
    if (!FS.exists(W + 'NEO10.BMP')) FS.write(W + 'NEO10.BMP', '', { s: 64118, g: 'NEO10' });
    if (!FS.exists(W + 'LOCK10.BMP')) FS.write(W + 'LOCK10.BMP', '', { s: 64118, g: 'LOCK10' });
    if (!FS.exists(W + 'MSEDGE.EXE')) FS.write(W + 'MSEDGE.EXE', '', { s: 31744, a: 'edge' });
    const ext = readIni('C:\\WINDOWS\\WIN.INI', 'Extensions');
    if (!ext.htm) writeIni('C:\\WINDOWS\\WIN.INI', 'Extensions', 'htm', 'msedge.exe ^.htm');
    if (!ext.html) writeIni('C:\\WINDOWS\\WIN.INI', 'Extensions', 'html', 'msedge.exe ^.html');
    if (!FS.exists(KNOWN.documents + '\\WELCOME.TXT'))
      FS.write(KNOWN.documents + '\\Welcome.txt', 'Welcome to Neo10!\n\nThis is Windows 10, drawn with the pixels of Windows 3.1.\n\n- Click Start (or press Ctrl+Esc) for your apps and live tiles.\n- Type in the search box to find apps, settings and files.\n- Drag a window to the left or right edge of the screen to snap it.\n- Task View (next to search) shows your windows and virtual desktops.\n- Action Center (far right of the taskbar) holds notifications and quick actions.\n- Settings > System > Shell switches back to the classic Windows 3.1 Program Manager.\n');
    FS.save();
  },

  bootScreen() {
    const el = h('div', { class: 'neo-full', style: { background: '#000' } });
    const logo = neoLogoGrid(64).canvas();
    logo.className = 'neo-pix'; logo.style.width = '128px'; logo.style.height = '128px';
    const spin = this.spinner('#ffffff');
    el.append(h('div', { class: 'neo-center', style: { gap: '64px' } }, logo, spin.el));
    Sys.screen.appendChild(el);
    el._stop = spin.stop;
    const rm = el.remove.bind(el);
    el.remove = () => { spin.stop(); rm(); };
    return el;
  },
  /* Windows 10 "five dots" spinner, rasterised as 4x4 pixel squares */
  spinner(color) {
    const c = h('canvas', { width: 48, height: 48, class: 'neo-pix', style: { width: '48px', height: '48px' } });
    const x = c.getContext('2d');
    let t = 0, raf;
    const step = () => {
      t += 1 / 60;
      x.clearRect(0, 0, 48, 48); x.fillStyle = color;
      for (let i = 0; i < 5; i++) {
        const ph = (t * 0.8 - i * 0.09) % 1.6;
        if (ph < 0 || ph > 1) continue;
        const e = ph < .5 ? 2 * ph * ph : 1 - Math.pow(-2 * ph + 2, 2) / 2;
        const a = -Math.PI / 2 + e * Math.PI * 2;
        x.fillRect(Math.round(22 + Math.cos(a) * 18), Math.round(22 + Math.sin(a) * 18), 4, 4);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return { el: c, stop: () => cancelAnimationFrame(raf) };
  },

  /* ======================= LOCK / SIGN-IN ======================= */
  lockAndSignIn(first) {
    return new Promise(resolve => {
      Saver.stop && Saver.active && Saver.stop();
      this.closePanels();
      const ov = h('div', { class: 'neo-full neo-lock' });
      const lockPath = FS.exists('C:\\WINDOWS\\' + Store.get('lockImage', 'LOCK10.BMP')) ? 'C:\\WINDOWS\\' + Store.get('lockImage', 'LOCK10.BMP') : 'C:\\WINDOWS\\LOCK10.BMP';
      const bg = h('div', { class: 'neo-lockbg' }); this.tileBg(bg, lockPath);
      const time = h('div', { class: 'neo-locktime' }), date = h('div', { class: 'neo-lockdate' });
      const tick = () => { const n = Sys.now(); time.textContent = Intl31.time(n).replace(/ ?[AP]M$/i, ''); date.textContent = Intl31.longDate(n).replace(/, \d{4}$/, ''); };
      tick();
      const iv = setInterval(tick, 1000);
      const lock = h('div', { class: 'neo-lockface' }, h('div', { class: 'neo-lockclock' }, time, date));
      ov.append(bg, lock);
      Sys.screen.appendChild(ov);
      Sys.mode = 'locked';
      const toSignIn = () => {
        if (ov._signin) return;
        ov._signin = true;
        lock.remove(); clearInterval(iv);
        this.signInPanel(ov, first, () => {
          Sys.mode = 'windows';
          ov.remove();
          if (first) this.afterSignIn();
          else { const a = Sys.desktop.active; a && a.focus(); }
          resolve();
        });
      };
      ov.addEventListener('pointerdown', toSignIn);
      Sys.textKey = e => { if (!ov._signin) { e.preventDefault(); toSignIn(); } };
    });
  },

  signInPanel(ov, first, done) {
    const pw = Store.get('acctPassword', '');
    const av = iconImg('user'); av.style.width = av.style.height = '128px';
    const name = h('div', { class: 'neo-signname', text: Store.get('userName', 'User') });
    const box = h('div', { class: 'neo-center neo-signin' }, av, name);
    let input = null;
    const go = async () => {
      if (pw && input.value !== pw) {
        Snd.beep();
        msg.textContent = 'The password is incorrect. Try again.';
        input.value = ''; input.focus();
        return;
      }
      Sys.textKey = null;
      box.innerHTML = '';
      const sp = this.spinner('#ffffff');
      box.append(h('div', { class: 'neo-welcome' }, sp.el, h('span', { text: first ? 'Welcome' : 'Welcome' })));
      await sleep(Store.get('fastBoot') ? 300 : 1100);
      sp.stop();
      done();
    };
    const msg = h('div', { class: 'neo-signmsg' });
    if (pw) {
      input = h('input', { class: 'tx neo-pw', type: 'password', placeholder: 'Password' });
      const arrow = UI.button('→', { default: true, onClick: go });
      box.append(h('div', { class: 'neo-pwrow' }, input, arrow), msg);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      Sys.textKey = null;
      setTimeout(() => input.focus(), 0);
    } else {
      const b = UI.button('Sign in', { default: true, onClick: go }); b.style.minWidth = '120px';
      box.append(b);
      Sys.textKey = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
      setTimeout(() => b.focus(), 0);
    }
    // power options at the bottom-right of the sign-in screen
    const pwr = h('div', { class: 'neo-signpower' }, this.tbIcon('s_power', 'Power', e => {
      const r = Sys.rectOf(e.currentTarget);
      Menu.show(this.powerItems(true), r.x, r.y, { anchorH: 0 });
    }));
    ov.append(box, pwr);
  },

  afterSignIn() {
    this.started = true;
    Snd.event('SystemStart');
    Saver.reset();
    Sys.emit('started');
    // StartUp group programs run at sign-in, as in Windows 10
    const pmg = Store.get('pm.groups');
    const su = pmg && pmg.find(g => g.name.toLowerCase() === 'startup');
    const disabled = Store.get('startup.off', []);
    if (su) su.items.filter(it => !disabled.includes(it.name)).forEach((it, i) => setTimeout(() => Sys.launch(it.cmd, { quiet: true, show: it.runMin ? 'min' : undefined }), 500 + i * 300));
    if (!Store.get('neo.welcomed')) {
      Store.set('neo.welcomed', true);
      setTimeout(() => this.notify({ app: 'Neo10', icon: 'neologo', title: 'Welcome to Neo10', text: 'Windows 10, rebuilt with Windows 3.1 pixels. Click here to read the welcome note.', onClick: () => Sys.launch('NOTEPAD.EXE ' + KNOWN.documents + '\\WELCOME.TXT') }), 1200);
    }
  },

  lock() { if (Sys.mode === 'windows') this.lockAndSignIn(false); },

  async signOut() {
    if (!(await this.closeAllWindows())) return;
    await this.lockAndSignIn(true);
  },

  async closeAllWindows() {
    for (const w of Sys.desktop.ordered().reverse()) {
      if (w.closed) continue;
      if (!(await w.close())) return false;
    }
    return true;
  },

  async shutdown(restart, opts = {}) {
    this.closePanels();
    if (!(await this.closeAllWindows())) return;
    Saver.stop();
    Store.flush(); FS.flush();
    const el = h('div', { class: 'neo-full', style: { background: 'var(--active-title)' } });
    const sp = this.spinner('#ffffff');
    el.append(h('div', { class: 'neo-center', style: { gap: '24px' } }, sp.el, h('div', { class: 'neo-bigtext', text: restart ? 'Restarting' : 'Shutting down' })));
    Sys.screen.appendChild(el);
    Snd.event('SystemExit');
    await sleep(Store.get('fastBoot') ? 600 : 2200);
    sp.stop();
    this.teardown();
    el.remove();
    Sys.mode = 'off';
    if (!restart) await DOS.offScreen();
    DOS.boot();
  },

  teardown() {
    this.closePanels();
    if (this.tb) { this.tb.remove(); this.tb = null; }
    if (this.iconsEl) { this.iconsEl.remove(); this.iconsEl = null; }
    (this.offs || []).forEach(f => f());
    this.offs = [];
    clearInterval(this.clockIv);
    Sys.deskEl.classList.add('hidden');
    Sys.deskEl.classList.remove('neo');
    this.started = false;
  },

  /* sleep: black screen; any input wakes to the lock screen */
  sleep() {
    this.closePanels();
    const el = h('div', { class: 'neo-full', style: { background: '#000', zIndex: 450000 } });
    Sys.screen.appendChild(el);
    Sys.screen.classList.add('nocursor');
    Sys.mode = 'asleep';
    setTimeout(() => {
      const wake = () => {
        document.removeEventListener('pointerdown', wake, true); document.removeEventListener('keydown', wake, true);
        el.remove(); Sys.screen.classList.remove('nocursor'); Sys.mode = 'windows';
        if (Store.get('acctPassword', '') || Store.get('requireSignin', true)) this.lockAndSignIn(false);
      };
      document.addEventListener('pointerdown', wake, true); document.addEventListener('keydown', wake, true);
    }, 600);
  },

  powerItems(signin) {
    return [
      { label: '&Sleep', action: () => this.sleep() },
      { label: 'Sh&ut down', action: () => this.shutdown(false) },
      { label: '&Restart', action: () => this.shutdown(true) }
    ];
  },

  /* integer-scaled "fill" of a pixel image (keeps pixels square) */
  tileBg(el, path) {
    const url = Wallpapers.urlFor(path);
    if (!url) { el.style.background = 'var(--desktop)'; return; }
    Object.assign(el.style, Wallpapers.tileStyle(path));
  },

  /* ======================= DESKTOP ======================= */
  buildDesktop() {
    this.offs = [];
    Sys.vd = 0;
    this.vds = Store.get('neo.vds', ['Desktop 1']);
    this.buildTaskbar();
    this.buildIcons();
    const re = () => this.renderTaskbar();
    for (const ev of ['windows', 'titles', 'activate']) this.offs.push(Sys.on(ev, re));
    this.offs.push(Sys.on('settings', () => { this.applyTaskbarSettings(); this.renderTaskbar(); this.renderIcons(); }));
    this.offs.push(Sys.on('resolution', () => { this.renderIcons(); }));
    this.offs.push(FS.on('change', () => { clearTimeout(this._fsT); this._fsT = setTimeout(() => this.renderIcons(), 50); }));
    // desktop context menu
    Sys.wmEl.addEventListener('contextmenu', this._ctx = e => {
      if (e.target !== Sys.wmEl && e.target !== this.iconsEl) return;
      e.preventDefault();
      const p = Sys.pointer(e);
      Menu.show(this.desktopMenu(), p.x, p.y);
    });
    this.offs.push(() => Sys.wmEl.removeEventListener('contextmenu', this._ctx));
    this.renderTaskbar();
  },

  desktopMenu() {
    return [
      { label: '&View', items: [
        { label: '&Auto arrange icons', checked: () => Store.get('desk.auto', true), action: () => { Store.set('desk.auto', !Store.get('desk.auto', true)); if (Store.get('desk.auto', true)) Store.set('desk.pos', {}); this.renderIcons(); } },
        { label: '&Show desktop icons', checked: () => Store.get('desk.show', true), action: () => { Store.set('desk.show', !Store.get('desk.show', true)); this.renderIcons(); } }] },
      { label: 'S&ort by', items: [['&Name', 'name'], ['&Size', 'size'], ['Item &type', 'type'], ['&Date modified', 'date']].map(([l, k]) => ({ label: l, checked: () => Store.get('desk.sort', 'name') === k, action: () => { Store.set('desk.sort', k); Store.set('desk.pos', {}); this.renderIcons(); } })) },
      { label: 'R&efresh', action: () => this.renderIcons() },
      '-',
      { label: '&Paste', disabled: () => !FileClip.items.length, action: () => FileClip.paste(KNOWN.desktop) },
      '-',
      { label: 'Ne&w', items: [
        { label: '&Folder', action: () => this.newOnDesktop('New folder', true) },
        { label: '&Text Document', action: () => this.newOnDesktop('New Text Document.txt') },
        { label: '&Bitmap image', action: () => this.newOnDesktop('New Bitmap Image.bmp') }] },
      '-',
      { label: '&Display settings', action: () => Sys.launch('SETTINGS system/display') },
      { label: 'Pe&rsonalize', action: () => Sys.launch('SETTINGS personalization/background') }
    ];
  },
  newOnDesktop(base, folder) {
    const name = FileOps.uniqueName(KNOWN.desktop, base);
    try { folder ? FS.mkdir(FS.join(KNOWN.desktop, name)) : FS.write(FS.join(KNOWN.desktop, name), ''); } catch (e) { msgBox(e.message, 'Neo10', { icon: 'stop' }); }
    setTimeout(() => this.renameIcon(name), 80);
  },

  buildIcons() {
    this.iconsEl = h('div', { class: 'neo-deskicons' });
    Sys.wmEl.prepend(this.iconsEl);
    this.iconsEl.addEventListener('pointerdown', e => { if (e.target === this.iconsEl) this.selectIcons([]); });
    this.renderIcons();
  },

  deskItems() {
    const items = [
      { key: '::thispc', name: 'This PC', icon: 'thispc', open: () => Sys.launch('EXPLORER thispc') },
      { key: '::recycle', name: 'Recycle Bin', icon: (FS.list(KNOWN.recycle) || []).length ? 'recyclefull' : 'recycle', open: () => Sys.launch('EXPLORER recycle') }
    ];
    const sort = Store.get('desk.sort', 'name');
    const ls = (FS.list(KNOWN.desktop) || []).slice().sort((a, b) =>
      sort === 'size' ? FS.size(b.node) - FS.size(a.node) : sort === 'date' ? (b.node.d || 0) - (a.node.d || 0) : sort === 'type' ? FS.ext(a.name).localeCompare(FS.ext(b.name)) : a.name.localeCompare(b.name));
    for (const e of ls) {
      const path = FS.join(KNOWN.desktop, e.name);
      items.push({ key: e.name, path, name: FileOps.shownName(e.name, e.node), icon: FileOps.iconFor(e.name, e.node, 32), open: () => FileOps.open(path) });
    }
    return items;
  },

  renderIcons() {
    if (!this.iconsEl) return;
    this.iconsEl.innerHTML = '';
    if (!Store.get('desk.show', true)) return;
    const pos = Store.get('desk.pos', {});
    const H = Sys.wmEl.clientHeight || 500, sp = Store.get('iconSpacing', 75), rowH = 72;
    const perCol = Math.max(1, Math.floor((H - 4) / rowH));
    this.iconEls = [];
    this.deskItems().forEach((it, i) => {
      const el = h('div', { class: 'icon', tabindex: '-1' }, h('div', { class: 'img' }, iconImg(it.icon)), h('div', { class: 'lbl', text: it.name }));
      const p = !Store.get('desk.auto', true) && pos[it.key] ? pos[it.key] : { x: 4 + Math.floor(i / perCol) * sp, y: 6 + (i % perCol) * rowH };
      el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
      el.item = it;
      el.addEventListener('pointerdown', e => this.iconDown(e, el));
      el.addEventListener('dblclick', () => it.open());
      el.addEventListener('contextmenu', e => {
        e.preventDefault(); e.stopPropagation();
        if (!el.classList.contains('sel')) this.selectIcons([el]);
        const q = Sys.pointer(e);
        Menu.show(this.iconMenu(it), q.x, q.y);
      });
      this.iconsEl.appendChild(el);
      this.iconEls.push(el);
    });
  },
  iconMenu(it) {
    if (it.key === '::recycle') return [{ label: '&Open', action: it.open }, { label: '&Empty Recycle Bin', action: () => FileOps.emptyRecycle() }];
    if (it.key === '::thispc') return [{ label: '&Open', action: it.open }, '-', { label: 'P&roperties', action: () => Sys.launch('SETTINGS system/about') }];
    return [
      { label: '&Open', action: it.open },
      ...(FS.ext(it.key) && /^(TXT|INI|BAT|LOG)$/.test(FS.ext(it.key)) ? [{ label: '&Edit', action: () => Sys.launch(`NOTEPAD.EXE "${it.path}"`) }] : []),
      '-',
      { label: 'Cu&t', action: () => FileClip.set([it.path], true) },
      { label: '&Copy', action: () => FileClip.set([it.path], false) },
      '-',
      { label: '&Delete', action: () => FileOps.recycle(this.selectedPaths()) },
      { label: 'Rena&me', action: () => this.renameIcon(it.key) },
      '-',
      { label: 'P&roperties', action: () => FileOps.properties(it.path) }
    ];
  },
  selectedPaths() { return (this.iconEls || []).filter(e => e.classList.contains('sel') && e.item.path).map(e => e.item.path); },
  selectIcons(els) { (this.iconEls || []).forEach(e => e.classList.toggle('sel', els.includes(e))); },
  iconDown(e, el) {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (Sys.desktop.active) { Sys.desktop.active.setActive(false); Sys.desktop.active = null; Sys.emit('activate', null); }
    if (e.ctrlKey) el.classList.toggle('sel'); else if (!el.classList.contains('sel')) this.selectIcons([el]);
    el.focus({ preventScroll: true });
    const sx = e.clientX, sy = e.clientY, sel = this.iconEls.filter(x => x.classList.contains('sel'));
    const start = sel.map(x => ({ x: x.offsetLeft, y: x.offsetTop }));
    let moved = false;
    el.setPointerCapture(e.pointerId);
    const mv = ev => {
      const dx = (ev.clientX - sx) / Sys.scale, dy = (ev.clientY - sy) / Sys.scale;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      moved = true;
      sel.forEach((x, i) => { x.style.left = Settings.snap(start[i].x + dx) + 'px'; x.style.top = Settings.snap(start[i].y + dy) + 'px'; });
    };
    const up = ev => {
      el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up);
      if (!moved) return;
      // dropped onto the Recycle Bin?
      const bin = this.iconEls.find(x => x.item.key === '::recycle' && !sel.includes(x));
      const hit = bin && document.elementsFromPoint(ev.clientX, ev.clientY).includes(bin);
      if (hit) { FileOps.recycle(sel.filter(x => x.item.path).map(x => x.item.path), true); return; }
      const pos = Store.get('desk.pos', {});
      if (Store.get('desk.auto', true)) { Store.set('desk.auto', false); this.iconEls.forEach(x => { pos[x.item.key] = { x: x.offsetLeft, y: x.offsetTop }; }); }
      sel.forEach(x => { pos[x.item.key] = { x: x.offsetLeft, y: x.offsetTop }; });
      Store.set('desk.pos', { ...pos });
    };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
  },
  renameIcon(key) {
    const el = (this.iconEls || []).find(x => x.item.key === key);
    if (!el || !el.item.path) return;
    this.selectIcons([el]);
    const lbl = el.querySelector('.lbl');
    const inp = h('input', { class: 'tx neo-rename' });
    inp.value = el.item.name;
    lbl.replaceWith(inp);
    inp.focus();
    const dot = inp.value.lastIndexOf('.');
    inp.setSelectionRange(0, dot > 0 && !FS.isDir(el.item.path) ? dot : inp.value.length);
    let done = false;
    const finish = ok => {
      if (done) return; done = true;
      const v = inp.value.trim();
      if (ok && v && v !== el.item.name) FileOps.rename(el.item.path, v);
      this.renderIcons();
    };
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
    inp.addEventListener('blur', () => finish(true));
  },
  deskKey(e) {
    const sel = (this.iconEls || []).filter(x => x.classList.contains('sel'));
    if (!sel.length || Sys.desktop.active) return false;
    if (e.key === 'Enter') { sel.forEach(x => x.item.open()); return true; }
    if (e.key === 'Delete') { FileOps.recycle(this.selectedPaths(), e.shiftKey); return true; }
    if (e.key === 'F2') { this.renameIcon(sel[0].item.key); return true; }
    return false;
  },

  /* ======================= TASKBAR ======================= */
  tbIcon(icon, title, onClick, cls = '') {
    const b = h('div', { class: 'neo-tbtn ' + cls, title }, iconImg(icon));
    b.addEventListener('pointerdown', e => { if (e.button === 0) { e.preventDefault(); e.stopPropagation(); onClick(e); } });
    return b;
  },
  buildTaskbar() {
    const tb = this.tb = h('div', { class: 'neo-taskbar raised' });
    this.startBtn = h('div', { class: 'neo-tbtn neo-start' }, iconImg('s_neologo'), h('span', { text: 'Start' }));
    this.startBtn.addEventListener('pointerdown', e => { if (e.button === 0) { e.preventDefault(); e.stopPropagation(); this.toggle('start'); } });
    this.startBtn.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); this.winX(); });
    this.searchEl = h('div', { class: 'neo-search' }, iconImg('s_search'));
    this.searchInput = h('input', { class: 'tx', placeholder: 'Type here to search', spellcheck: false });
    this.searchEl.appendChild(this.searchInput);
    this.searchInput.addEventListener('focus', () => { if (this.open !== 'search') this.toggle('search'); });
    this.searchInput.addEventListener('input', () => { if (this.open !== 'search') this.toggle('search'); else this.renderSearch(); });
    this.searchInput.addEventListener('keydown', e => this.searchKey(e));
    this.searchIconBtn = this.tbIcon('s_search', 'Search', () => this.toggle('search'), 'neo-searchicon');
    this.tvBtn = this.tbIcon('s_taskview', 'Task View', () => this.taskView());
    this.apps = h('div', { class: 'neo-tbapps' });
    this.netBtn = this.tbIcon('s_network', 'Neo31 Network\nInternet access', () => this.toggle('network'));
    this.volBtn = this.tbIcon('s_volume', 'Speakers', () => this.toggle('volume'));
    this.clockBtn = h('div', { class: 'neo-tbtn neo-clock' }, h('div'), h('div'));
    this.clockBtn.addEventListener('pointerdown', e => { if (e.button === 0) { e.preventDefault(); e.stopPropagation(); this.toggle('clock'); } });
    this.acBtn = this.tbIcon('s_bell', 'Action Center', () => this.toggle('action'));
    this.showDesk = h('div', { class: 'neo-showdesk', title: 'Show desktop' });
    this.showDesk.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); this.toggleDesktop(); });
    const tray = h('div', { class: 'neo-tray' }, this.netBtn, this.volBtn, this.clockBtn, this.acBtn);
    tb.append(this.startBtn, this.searchEl, this.searchIconBtn, this.tvBtn, this.apps, tray, this.showDesk);
    tb.addEventListener('contextmenu', e => {
      if (e.target.closest('.neo-tbapp') || e.target.closest('.neo-start')) return;
      e.preventDefault();
      const p = Sys.pointer(e);
      Menu.show(this.taskbarMenu(), p.x, p.y);
    });
    Sys.deskEl.appendChild(tb);
    this.applyTaskbarSettings();
    this.tickClock();
    this.clockIv = setInterval(() => this.tickClock(), 1000);
    // auto-hide: reveal when the pointer touches the bottom edge
    tb.addEventListener('pointerenter', () => tb.classList.add('peek'));
    tb.addEventListener('pointerleave', () => { if (!this.open) tb.classList.remove('peek'); });
  },
  applyTaskbarSettings() {
    if (!this.tb) return;
    const auto = Store.get('tb.autohide', false);
    this.tb.classList.toggle('autohide', auto);
    Sys.deskEl.style.setProperty('--tbh', (auto ? 2 : this.TB) + 'px');
    const s = Store.get('tb.search', 'box');
    this.searchEl.style.display = s === 'box' && Sys.screen.clientWidth >= 760 ? '' : 'none';
    this.searchIconBtn.style.display = s === 'hidden' || (s === 'box' && Sys.screen.clientWidth >= 760) ? 'none' : '';
    this.tvBtn.style.display = Store.get('tb.taskview', true) ? '' : 'none';
    this.tb.classList.toggle('accent', Store.get('tb.accent', false));
    Sys.desktop.relayout();
  },
  tickClock() {
    if (!this.clockBtn) return;
    const n = Sys.now();
    this.clockBtn.children[0].textContent = Intl31.time(n, Store.get('tb.seconds', false));
    this.clockBtn.children[1].textContent = Intl31.date(n);
    this.clockBtn.title = Intl31.longDate(n);
    if (this.open === 'clock' && this.flyClock) this.flyClock();
    if (n.getSeconds() === 0) this.renderTiles && this.open === 'start' && this.renderTiles();
  },
  taskbarMenu() {
    return [
      { label: '&Toolbars', items: [{ label: '&Address', disabled: true }, { label: '&Desktop', disabled: true }] },
      { label: '&Search', items: [['&Hidden', 'hidden'], ['Show search &icon', 'icon'], ['Show search &box', 'box']].map(([l, k]) => ({ label: l, checked: () => Store.get('tb.search', 'box') === k, action: () => { Store.set('tb.search', k); this.applyTaskbarSettings(); } })) },
      { label: 'Show Task &View button', checked: () => Store.get('tb.taskview', true), action: () => { Store.set('tb.taskview', !Store.get('tb.taskview', true)); this.applyTaskbarSettings(); } },
      '-',
      { label: '&Cascade windows', action: () => Sys.desktop.cascade() },
      { label: 'Show windows stac&ked', action: () => this.stack(false) },
      { label: 'Show windows side by s&ide', action: () => this.stack(true) },
      { label: 'Show the &desktop', action: () => this.toggleDesktop() },
      '-',
      { label: 'Tas&k Manager', action: () => Sys.launch('TASKMGR') },
      '-',
      { label: 'Taskbar s&ettings', action: () => Sys.launch('SETTINGS personalization/taskbar') }
    ];
  },
  stack(sideBySide) {
    const ws = this.vdWindows().filter(w => !w.isMin && w.o.resizable !== false && !w.o.dialog);
    const W = Sys.desktop.W, H = Sys.desktop.H;
    ws.forEach((w, i) => {
      if (w.isMax) w.restore(true);
      if (sideBySide) w.setRect(Math.round(i * W / ws.length), 0, Math.round(W / ws.length), H);
      else w.setRect(0, Math.round(i * H / ws.length), W, Math.round(H / ws.length));
    });
  },

  vdWindows() { return Sys.desktop.wins.filter(w => !w.closed && !w.o.hideFromTasks && (w.vd || 0) === Sys.vd); },

  /* taskbar buttons: pinned apps, then running ones, grouped by application */
  renderTaskbar() {
    if (!this.tb || this._tbRaf) return;
    this._tbRaf = requestAnimationFrame(() => {
      this._tbRaf = 0;
      if (!this.tb) return;
      const pins = Store.get('tb.pins', ['MSEDGE.EXE', 'EXPLORER', 'NOTEPAD.EXE', 'SETTINGS']);
      const wins = (Store.get('vd.all', false) ? Sys.desktop.wins.filter(w => !w.closed && !w.o.hideFromTasks) : this.vdWindows()).filter(w => !w.o.dialog || !w.modalOwner);
      const groups = [];
      for (const cmd of pins) {
        const a = appByCmd(cmd) || { name: cmd, cmd, icon: 'app' };
        groups.push({ key: appIdOf(a) || cmd, app: a, wins: [], pinned: true });
      }
      for (const w of wins) {
        if (w.o.dialog && w.modalOwner) continue;
        const id = (w.app && w.app.id) || ('w' + Sys.desktop.wins.indexOf(w));
        let g = groups.find(x => x.key === id);
        if (!g) { const a = NEO_APPS.find(x => appIdOf(x) === id) || { name: w.title, cmd: null, icon: w.o.icon || 'app' }; g = { key: id, app: a, wins: [] }; groups.push(g); }
        g.wins.push(w);
      }
      this.apps.innerHTML = '';
      const labels = Store.get('tb.labels', false);
      for (const g of groups) {
        const active = g.wins.includes(Sys.desktop.active) && !Sys.desktop.active.isMin;
        const icon = g.wins[0] ? (g.wins[0].o.icon || g.app.icon) : g.app.icon;
        const b = h('div', { class: 'neo-tbapp' + (g.wins.length ? ' running' : '') + (g.wins.length > 1 ? ' multi' : '') + (active ? ' active' : '') + (labels ? ' labels' : ''), title: g.wins.length === 1 ? g.wins[0].title : g.app.name },
          g.wins[0] && g.wins[0].o.drawIcon && g.wins[0].isMin && g.wins[0].iconCanvas ? null : iconImg(icon),
          labels && g.wins.length ? h('span', { text: g.wins.length > 1 ? `${g.app.name} (${g.wins.length})` : g.wins[0].title }) : null);
        if (g.wins.some(w => w._flash)) b.classList.add('flash');
        b.addEventListener('pointerdown', e => {
          e.preventDefault(); e.stopPropagation();
          if (e.button === 1) { this.launchApp(g.app); return; }
          if (e.button !== 0) return;
          this.closePanels();
          if (!g.wins.length) { this.launchApp(g.app); return; }
          if (g.wins.length === 1) { const w = g.wins[0]; if ((w.vd || 0) !== Sys.vd) { this.switchVD(w.vd || 0); w.isMin ? w.restore() : w.activate(); return; } if (w.isMin) w.restore(); else if (w === Sys.desktop.active) w.minimize(); else w.activate(); return; }
          const r = Sys.rectOf(b);
          Menu.show(g.wins.map(w => ({ label: w.title.replace(/&/g, '&&'), checked: () => w === Sys.desktop.active, action: () => w.isMin ? w.restore() : w.activate() })), r.x, r.y, { anchorH: 0 });
        });
        b.addEventListener('contextmenu', e => {
          e.preventDefault(); e.stopPropagation();
          const r = Sys.rectOf(b);
          const pinned = pins.includes(g.app.cmd);
          Menu.show([
            { label: g.app.name.replace(/&/g, '&&'), disabled: !g.app.cmd, action: () => this.launchApp(g.app) },
            ...(g.app.cmd ? [{ label: pinned ? '&Unpin from taskbar' : '&Pin to taskbar', action: () => this.pin(g.app.cmd, !pinned) }] : []),
            ...(g.wins.length ? ['-', { label: g.wins.length > 1 ? 'Close all &windows' : '&Close window', action: () => g.wins.forEach(w => w.close()) }] : [])
          ], r.x, r.y, { anchorH: 0 });
        });
        this.apps.appendChild(b);
      }
      // tray state
      this.volBtn.firstChild.src = iconURL(Store.get('muted', false) ? 's_mute' : 's_volume');
      this.netBtn.firstChild.src = iconURL(Store.get('airplane', false) ? 's_netoff' : 's_network');
      this.acBtn.firstChild.src = iconURL(this.notes.some(n => !n.seen) ? 's_bellnew' : 's_bell');
    });
  },
  pin(cmd, on) {
    const pins = Store.get('tb.pins', ['MSEDGE.EXE', 'EXPLORER', 'NOTEPAD.EXE', 'SETTINGS']).filter(p => p !== cmd);
    if (on) pins.push(cmd);
    Store.set('tb.pins', pins);
    this.renderTaskbar();
  },
  launchApp(a) {
    this.closePanels();
    if (!a || !a.cmd) return;
    Sys.launch(a.cmd);
    const rec = Store.get('start.recent', []).filter(x => x !== a.cmd);
    rec.unshift(a.cmd);
    Store.set('start.recent', rec.slice(0, 6));
  },

  toggleDesktop() {
    const vis = this.vdWindows().filter(w => !w.isMin);
    if (vis.length) { this._peek = vis; vis.forEach(w => w.minimize()); }
    else if (this._peek) { this._peek.forEach(w => !w.closed && w.restore()); this._peek = null; }
  },

  /* ======================= PANELS ======================= */
  toggle(which) {
    const was = this.open;
    this.closePanels();
    if (was === which) return;
    this.open = which;
    this.tb && this.tb.classList.add('peek');
    const make = { start: () => this.startMenu(), search: () => this.searchPanel(), action: () => this.actionCenter(), clock: () => this.clockFlyout(), volume: () => this.volumeFlyout(), network: () => this.networkFlyout() }[which];
    this.panel = make();
    this.panel.classList.add('neo-panel');
    Sys.deskEl.appendChild(this.panel);
    if (which === 'start') this.startBtn.classList.add('pressed');
    // a click anywhere else closes the panel
    setTimeout(() => {
      this._outside = e => {
        if (!this.panel) return;
        if (this.panel.contains(e.target) || (which === 'search' && this.searchEl.contains(e.target)) || e.target.closest && e.target.closest('#menus, #cbov, .cb-drop')) return;
        this.closePanels();
      };
      document.addEventListener('pointerdown', this._outside, true);
    }, 0);
  },
  closePanels() {
    if (this.panel) { this.panel._close && this.panel._close(); this.panel.remove(); this.panel = null; }
    if (this._outside) { document.removeEventListener('pointerdown', this._outside, true); this._outside = null; }
    if (this.open === 'search' && this.searchInput) { this.searchInput.value = ''; this.searchInput.blur(); }
    this.open = null;
    this.startBtn && this.startBtn.classList.remove('pressed');
    this.tb && !this.tb.matches(':hover') && this.tb.classList.remove('peek');
    this.flyClock = null;
  },

  /* ---------------- Start menu ---------------- */
  startMenu() {
    const el = h('div', { class: 'neo-start-menu raised' });
    const rail = h('div', { class: 'neo-rail' });
    const railBtn = (icon, label, fn) => { const b = h('div', { class: 'neo-railbtn', title: label }, iconImg(icon), h('span', { text: label })); b.addEventListener('pointerup', e => { if (e.button === 0) fn(b); }); return b; };
    rail.append(
      railBtn('s_user', Store.get('userName', 'User'), b => { const r = Sys.rectOf(b); Menu.show([{ label: '&Change account settings', action: () => Sys.launch('SETTINGS accounts/info') }, { label: '&Lock', action: () => this.lock() }, { label: 'Sign &out', action: () => this.signOut() }], r.x + r.w, r.y, { anchorH: 0 }); }),
      h('div', { style: { flex: 1 } }),
      railBtn('s_docs', 'Documents', () => { this.closePanels(); Sys.launch('EXPLORER documents'); }),
      railBtn('s_pics', 'Pictures', () => { this.closePanels(); Sys.launch('EXPLORER pictures'); }),
      railBtn('s_gear', 'Settings', () => { this.closePanels(); Sys.launch('SETTINGS'); }),
      railBtn('s_power', 'Power', b => { const r = Sys.rectOf(b); Menu.show(this.powerItems(), r.x + r.w, r.y, { anchorH: 0 }); }));
    const list = h('div', { class: 'neo-applist' });
    const openFolders = new Set(this._openFolders || []);
    const renderList = () => {
      list.innerHTML = '';
      const item = (a, indent) => {
        const r = h('div', { class: 'neo-appitem' + (indent ? ' indent' : '') }, iconImg(a.icon, 16), h('span', { text: a.name }));
        r.addEventListener('pointerup', e => { if (e.button === 0) this.launchApp(a); });
        r.addEventListener('contextmenu', e => {
          e.preventDefault(); e.stopPropagation();
          const p = Sys.pointer(e);
          const pinsT = Store.get('start.tiles', null) || this.defaultTiles();
          const pinned = Store.get('tb.pins', ['MSEDGE.EXE', 'EXPLORER', 'NOTEPAD.EXE', 'SETTINGS']).includes(a.cmd);
          const tiled = pinsT.some(t => t.cmd === a.cmd);
          Menu.show([
            { label: tiled ? '&Unpin from Start' : '&Pin to Start', action: () => this.pinTile(a.cmd, !tiled) },
            { label: pinned ? 'Unpin from &taskbar' : 'Pin to &taskbar', action: () => this.pin(a.cmd, !pinned) }], p.x, p.y);
        });
        list.appendChild(r);
      };
      const recent = Store.get('start.recent', []).map(appByCmd).filter(Boolean).slice(0, 3);
      if (recent.length && Store.get('start.showRecent', true)) { list.appendChild(h('div', { class: 'neo-applabel', text: 'Recently used' })); recent.forEach(a => item(a)); }
      const tops = NEO_APPS.filter(a => !a.folder).map(a => ({ ...a, sort: a.name }));
      const folders = [...new Set(NEO_APPS.filter(a => a.folder).map(a => a.folder))].map(f => ({ folder: f, sort: f }));
      let letter = '';
      for (const it of [...tops, ...folders].sort((a, b) => a.sort.localeCompare(b.sort))) {
        const L = /^[a-z]/i.test(it.sort) ? it.sort[0].toUpperCase() : '#';
        if (L !== letter) { letter = L; list.appendChild(h('div', { class: 'neo-applabel', text: L })); }
        if (it.folder) {
          const open = openFolders.has(it.folder);
          const r = h('div', { class: 'neo-appitem' }, iconImg(open ? 's_folderOpen' : 's_folder', 16), h('span', { text: it.folder }), h('span', { class: 'neo-chev', text: open ? '▲' : '▼' }));
          r.addEventListener('pointerup', () => { open ? openFolders.delete(it.folder) : openFolders.add(it.folder); this._openFolders = [...openFolders]; const st = list.scrollTop; renderList(); list.scrollTop = st; });
          list.appendChild(r);
          if (open) NEO_APPS.filter(a => a.folder === it.folder).sort((a, b) => a.name.localeCompare(b.name)).forEach(a => item(a, true));
        } else item(it);
      }
    };
    renderList();
    const tiles = h('div', { class: 'neo-tiles' });
    this.renderTiles = () => this.tilesInto(tiles);
    this.renderTiles();
    el.append(rail, list);
    if (Store.get('start.showTiles', true)) el.appendChild(tiles); else el.classList.add('notiles');
    // typing while Start is open goes to search
    el._keys = e => {
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        this.toggle('search'); this.searchInput.value = e.key; this.searchInput.focus(); this.renderSearch(); return true;
      }
      return false;
    };
    return el;
  },
  defaultTiles() {
    return [
      { cmd: 'CALENDAR.EXE', size: 'wide', color: '#000080' }, { cmd: 'CLOCK.EXE', size: 'med', color: '#008080' },
      { cmd: 'WEATHER', size: 'wide', color: '#0000ff' }, { cmd: 'PBRUSH.EXE', size: 'med', color: '#800080', live: 'photos' },
      { cmd: 'SOL.EXE', size: 'med', color: '#008000' }, { cmd: 'WINMINE.EXE', size: 'med', color: '#808080' },
      { cmd: 'EXPLORER', size: 'med', color: '#808000' }, { cmd: 'SETTINGS', size: 'med', color: '#404040' },
      { cmd: 'MSEDGE.EXE', size: 'med', color: '#000080' }
    ];
  },
  pinTile(cmd, on) {
    let t = (Store.get('start.tiles', null) || this.defaultTiles()).filter(x => x.cmd !== cmd);
    if (on) t.push({ cmd, size: 'med', color: '#000080' });
    Store.set('start.tiles', t);
    this.renderTiles && this.renderTiles();
  },
  tilesInto(el) {
    el.innerHTML = '';
    el.appendChild(h('div', { class: 'neo-tilehead', text: 'Life at a glance' }));
    const grid = h('div', { class: 'neo-tilegrid' });
    const n = Sys.now();
    for (const t of (Store.get('start.tiles', null) || this.defaultTiles())) {
      const a = appByCmd(t.cmd);
      if (!a) continue;
      const tile = h('div', { class: 'neo-tile ' + t.size, style: { background: t.color } });
      const body = h('div', { class: 'neo-tilebody' });
      // live tiles
      if (t.cmd === 'CALENDAR.EXE') body.append(h('div', { class: 'neo-tilebig', text: String(n.getDate()) }), h('div', { text: Intl31.DAYS[n.getDay()] }));
      else if (t.cmd === 'CLOCK.EXE') body.append(h('div', { class: 'neo-tilebig', text: Intl31.time(n).replace(/ ?[AP]M$/i, '') }), h('div', { text: n.getHours() >= 12 ? 'PM' : 'AM' }));
      else if (t.cmd === 'WEATHER') { const wx = Weather.today(); body.append(h('div', { class: 'neo-tilerow' }, iconImg(wx.icon), h('div', { class: 'neo-tilebig', text: wx.temp + '°' })), h('div', { text: wx.cond + ' · ' + Weather.city })); }
      else if (t.live === 'photos') { const pics = ['REDBRICK', 'HONEY', 'ARGYLE', 'MARBLE', 'CHITZ', 'LEAVES']; const c = Wallpapers.gen(pics[Math.floor(Date.now() / 8000) % pics.length]); if (c) tile.style.backgroundImage = `url(${c.toDataURL()})`; body.appendChild(iconImg(a.icon)); }
      else body.appendChild(iconImg(a.icon));
      tile.append(body, h('div', { class: 'neo-tilename', text: t.live === 'photos' ? 'Photos' : a.name }));
      tile.addEventListener('pointerup', e => { if (e.button === 0) this.launchApp(a); });
      tile.addEventListener('contextmenu', e => {
        e.preventDefault(); e.stopPropagation();
        const p = Sys.pointer(e);
        Menu.show([
          { label: '&Unpin from Start', action: () => this.pinTile(t.cmd, false) },
          { label: 'Resi&ze', items: [['&Medium', 'med'], ['&Wide', 'wide']].map(([l, s]) => ({ label: l, checked: () => t.size === s, action: () => { const all = (Store.get('start.tiles', null) || this.defaultTiles()).map(x => x.cmd === t.cmd ? { ...x, size: s } : x); Store.set('start.tiles', all); this.renderTiles(); } })) },
          { label: '&Colour', items: ['#000080', '#008080', '#008000', '#800000', '#800080', '#808000', '#404040', '#0000ff'].map((c, i) => ({ label: '&' + ['Navy', 'Teal', 'Green', 'Maroon', 'Purple', 'Olive', 'Charcoal', 'Blue'][i], checked: () => t.color === c, action: () => { const all = (Store.get('start.tiles', null) || this.defaultTiles()).map(x => x.cmd === t.cmd ? { ...x, color: c } : x); Store.set('start.tiles', all); this.renderTiles(); } })) }
        ], p.x, p.y);
      });
      grid.appendChild(tile);
    }
    el.appendChild(grid);
  },

  /* ---------------- Search ---------------- */
  searchPanel() {
    const el = h('div', { class: 'neo-search-panel raised' });
    this.searchResults = h('div', { class: 'neo-results' });
    this.searchDetail = h('div', { class: 'neo-resdetail' });
    el.append(this.searchResults, this.searchDetail);
    setTimeout(() => { this.searchInput.focus(); this.renderSearch(); }, 0);
    if (this.searchEl.style.display === 'none') {
      // search icon mode: the box lives at the top of the panel
      const box = h('div', { class: 'neo-search inpanel' }, iconImg('s_search'), this.searchInput);
      el.prepend(box);
      el._close = () => this.searchEl.appendChild(this.searchInput);
    }
    return el;
  },
  searchIndex(q) {
    const ql = q.toLowerCase();
    const res = [];
    for (const a of NEO_APPS) if (a.name.toLowerCase().includes(ql)) res.push({ kind: 'App', name: a.name, icon: a.icon, run: () => this.launchApp(a), score: a.name.toLowerCase().startsWith(ql) ? 0 : 1 });
    for (const p of (typeof SETTINGS_PAGES !== 'undefined' ? SETTINGS_PAGES : [])) if ((p.title + ' ' + (p.keywords || '')).toLowerCase().includes(ql)) res.push({ kind: 'Setting', name: p.title, icon: 'settings10', run: () => { this.closePanels(); Sys.launch('SETTINGS ' + p.id); }, score: 2 });
    let files = 0;
    const walk = (dir, depth) => {
      if (files > 40 || depth > 6) return;
      for (const e of FS.list(dir) || []) {
        if (e.node.h) continue;
        const full = FS.join(dir, e.name), shown = FileOps.shownName(e.name, e.node);
        if (shown.toLowerCase().includes(ql)) { files++; res.push({ kind: e.node.t === 'd' ? 'Folder' : FileOps.typeName(e.name, e.node), name: shown, path: full, icon: FileOps.iconFor(e.name, e.node, 32), run: () => { this.closePanels(); FileOps.open(full); }, score: dir.startsWith(USER_HOME) ? 3 : 4 }); }
        if (e.node.t === 'd') walk(full, depth + 1);
      }
    };
    walk('C:\\', 0);
    res.sort((a, b) => a.score - b.score);
    const out = res.slice(0, 30);
    if (Sys.apps.edge) out.push({ kind: 'Web', name: `${q} - See web results`, icon: 'edge', run: () => { this.closePanels(); Sys.run('edge', { args: Edge.searchURL(q) }); }, score: 9 });
    return out;
  },
  renderSearch() {
    if (!this.searchResults) return;
    const q = this.searchInput.value.trim();
    this.searchResults.innerHTML = ''; this.searchDetail.innerHTML = '';
    if (!q) {
      this.searchResults.appendChild(h('div', { class: 'neo-applabel', text: 'Top apps' }));
      const top = Store.get('start.recent', []).map(appByCmd).filter(Boolean);
      for (const a of (top.length ? top : NEO_APPS.slice(0, 5))) {
        const r = h('div', { class: 'neo-appitem' }, iconImg(a.icon, 16), h('span', { text: a.name }));
        r.addEventListener('pointerup', () => this.launchApp(a));
        this.searchResults.appendChild(r);
      }
      this.searchList = [];
      return;
    }
    const res = this.searchIndex(q);
    this.searchList = res; this.searchSel = 0;
    if (!res.length) { this.searchResults.appendChild(h('div', { class: 'neo-noresult', text: `No results found for "${q}"` })); return; }
    let kind = null;
    res.forEach((r, i) => {
      const head = i === 0 ? 'Best match' : (r.kind === 'App' ? 'Apps' : r.kind === 'Setting' ? 'Settings' : r.kind === 'Web' ? 'Search the web' : 'Documents');
      if (head !== kind) { kind = head; this.searchResults.appendChild(h('div', { class: 'neo-applabel', text: head })); }
      const row = h('div', { class: 'neo-appitem' + (i === 0 ? ' best' : '') }, iconImg(i === 0 ? r.icon : (r.icon.startsWith('s_') ? r.icon : r.icon), i === 0 ? 32 : 16), h('span', {}, h('div', { text: r.name }), i === 0 ? h('div', { class: 'neo-kind', text: r.kind }) : null));
      row.addEventListener('pointerenter', () => { this.searchSel = i; this.searchDetailFor(r); this.markSel(); });
      row.addEventListener('pointerup', () => r.run());
      row._i = i;
      this.searchResults.appendChild(row);
    });
    this.searchDetailFor(res[0]);
    this.markSel();
  },
  markSel() { [...this.searchResults.querySelectorAll('.neo-appitem')].forEach(r => r.classList.toggle('hot', r._i === this.searchSel)); },
  searchDetailFor(r) {
    const d = this.searchDetail;
    d.innerHTML = '';
    const big = iconImg(r.icon.startsWith('s_') ? 'doc' : r.icon); big.style.width = big.style.height = '64px';
    d.append(big, h('div', { class: 'neo-detname', text: r.name }), h('div', { class: 'neo-kind', text: r.kind }), h('div', { class: 'neo-sep' }));
    const act = (label, fn) => { const b = h('div', { class: 'neo-appitem', text: label }); b.addEventListener('pointerup', fn); d.appendChild(b); };
    act('Open', () => r.run());
    if (r.path) act('Open file location', () => { this.closePanels(); Sys.launch(`EXPLORER "${FS.dirname(r.path)}"`); });
    if (r.kind === 'App') act('Run as administrator', () => r.run());
  },
  searchKey(e) {
    if (e.key === 'Escape') { this.closePanels(); return; }
    const L = this.searchList || [];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!L.length) return; this.searchSel = clamp(this.searchSel + (e.key === 'ArrowDown' ? 1 : -1), 0, L.length - 1); this.searchDetailFor(L[this.searchSel]); this.markSel(); }
    if (e.key === 'Enter') { e.preventDefault(); const r = L[this.searchSel || 0]; if (r) r.run(); else { const q = this.searchInput.value.trim(); if (q) { this.closePanels(); Sys.launch(q); } } }
  },

  /* ---------------- Action Center & notifications ---------------- */
  notify(n) {
    n = { time: Sys.now(), seen: false, icon: 'neologo', ...n };
    this.notes.unshift(n);
    this.renderTaskbar();
    if (Store.get('focusAssist', false) || !Store.get('notify.on', true) || !this.started) return;
    Snd.event('SystemAsterisk');
    const t = h('div', { class: 'neo-toast win dlg active' },
      h('div', { class: 'inner' },
        h('div', { class: 'tb' }, h('div', { class: 'cap', text: n.app })),
        h('div', { class: 'neo-toastbody' }, iconImg(n.icon), h('div', {}, h('div', { class: 'neo-ttitle', text: n.title }), h('div', { text: n.text })))));
    const close = () => { t.remove(); this.layoutToasts(); };
    t.addEventListener('pointerdown', e => { e.stopPropagation(); close(); n.seen = true; this.renderTaskbar(); n.onClick && n.onClick(); });
    Sys.deskEl.appendChild(t);
    this.layoutToasts();
    setTimeout(close, 7000);
  },
  layoutToasts() {
    let y = (Store.get('tb.autohide', false) ? 4 : this.TB) + 8;
    [...Sys.deskEl.querySelectorAll('.neo-toast')].reverse().forEach(t => { t.style.bottom = y + 'px'; y += t.offsetHeight + 8; });
  },
  actionCenter() {
    this.notes.forEach(n => n.seen = true);
    this.renderTaskbar();
    const el = h('div', { class: 'neo-action raised' });
    const list = h('div', { class: 'neo-notes' });
    const render = () => {
      list.innerHTML = '';
      if (!this.notes.length) { list.appendChild(h('div', { class: 'neo-nonotes', text: 'No new notifications' })); return; }
      for (const n of this.notes) {
        const c = h('div', { class: 'neo-note raised' }, iconImg(n.icon, 32), h('div', { style: { flex: 1 } }, h('div', { class: 'neo-kind', text: `${n.app}  ·  ${Intl31.time(n.time)}` }), h('div', { class: 'neo-ttitle', text: n.title }), h('div', { text: n.text })));
        const x = h('div', { class: 'neo-x', text: '×' });
        x.addEventListener('pointerdown', e => { e.stopPropagation(); this.notes.splice(this.notes.indexOf(n), 1); render(); this.renderTaskbar(); });
        c.appendChild(x);
        c.addEventListener('pointerup', () => { if (n.onClick) { this.closePanels(); n.onClick(); } });
        list.appendChild(c);
      }
    };
    render();
    const head = h('div', { class: 'neo-achead' }, h('span', { text: 'Notifications' }));
    const clear = h('span', { class: 'neo-link', text: 'Clear all notifications' });
    clear.addEventListener('pointerup', () => { this.notes = []; render(); this.renderTaskbar(); });
    head.appendChild(clear);
    const qa = h('div', { class: 'neo-quick' });
    const quick = [
      ['Tablet mode', 's_taskview', 'tablet', on => { if (on) this.vdWindows().forEach(w => w.maxEl && !w.isMin && w.maximize()); }],
      ['Network', 's_network', null, () => { this.closePanels(); this.toggle('network'); }],
      ['All settings', 's_gear', null, () => { this.closePanels(); Sys.launch('SETTINGS'); }],
      ['Airplane mode', 's_netoff', 'airplane', on => { this.renderTaskbar(); }],
      ['Night light', 's_sleep', 'nightlight', on => this.applyNightLight()],
      ['Focus assist', 's_bell', 'focusAssist', () => {}],
      ['Location', 's_star', 'location', () => {}],
      ['Show desktop', 's_thispc', null, () => { this.closePanels(); this.toggleDesktop(); }]
    ];
    for (const [label, icon, key, fn] of quick) {
      const b = h('div', { class: 'neo-qa' + (key && Store.get(key, false) ? ' on' : '') }, iconImg(icon), h('span', { text: label }));
      b.addEventListener('pointerup', () => {
        if (key) { Store.set(key, !Store.get(key, false)); b.classList.toggle('on', Store.get(key, false)); fn(Store.get(key, false)); }
        else fn();
      });
      qa.appendChild(b);
    }
    el.append(head, list, qa);
    return el;
  },
  applyNightLight() { Sys.screen.style.filter = Store.get('nightlight', false) ? 'sepia(.45) saturate(1.3) brightness(.95)' : ''; },

  /* ---------------- flyouts ---------------- */
  clockFlyout() {
    const el = h('div', { class: 'neo-fly neo-flyclock raised' });
    let month = Sys.now(); month.setDate(1);
    const big = h('div', { class: 'neo-flytime' }), date = h('div', { class: 'neo-link', text: '' });
    const cal = h('div', { class: 'neo-cal' });
    date.addEventListener('pointerup', () => { this.closePanels(); Sys.launch('CALENDAR.EXE'); });
    const draw = () => {
      const n = Sys.now();
      big.textContent = Intl31.time(n, true); date.textContent = Intl31.longDate(n);
      cal.innerHTML = '';
      const hd = h('div', { class: 'neo-calhead' });
      const prev = h('span', { class: 'neo-link', text: '◄' }), next = h('span', { class: 'neo-link', text: '►' });
      prev.addEventListener('pointerup', () => { month.setMonth(month.getMonth() - 1); draw(); });
      next.addEventListener('pointerup', () => { month.setMonth(month.getMonth() + 1); draw(); });
      hd.append(h('span', { text: `${Intl31.MONTHS[month.getMonth()]} ${month.getFullYear()}` }), h('span', {}, prev, ' ', next));
      cal.appendChild(hd);
      const g = h('div', { class: 'neo-calgrid' });
      ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach(d => g.appendChild(h('div', { class: 'neo-caldow', text: d })));
      const start = new Date(month); start.setDate(1 - month.getDay());
      for (let i = 0; i < 42; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i);
        const today = d.toDateString() === n.toDateString();
        g.appendChild(h('div', { class: 'neo-calday' + (today ? ' today' : '') + (d.getMonth() !== month.getMonth() ? ' other' : ''), text: String(d.getDate()) }));
      }
      cal.appendChild(g);
    };
    draw();
    this.flyClock = () => { big.textContent = Intl31.time(Sys.now(), true); };
    const link = h('div', { class: 'neo-link', text: 'Date and time settings' });
    link.addEventListener('pointerup', () => { this.closePanels(); Sys.launch('SETTINGS time/datetime'); });
    el.append(big, date, cal, link);
    return el;
  },
  volumeFlyout() {
    const el = h('div', { class: 'neo-fly neo-flyvol raised' });
    const pct = h('div', { class: 'neo-flypct' });
    const mute = this.tbIcon(Store.get('muted', false) ? 's_mute' : 's_volume', 'Mute', () => {
      Store.set('muted', !Store.get('muted', false)); mute.firstChild.src = iconURL(Store.get('muted', false) ? 's_mute' : 's_volume'); this.renderTaskbar();
    });
    const sl = UI.slider({ min: 0, max: 100, step: 2, value: Store.get('volume', 80), onChange: v => { Store.set('volume', v); pct.textContent = v; if (Store.get('muted', false)) { Store.set('muted', false); this.renderTaskbar(); } } });
    sl.el.style.position = 'relative'; sl.el.style.width = '190px';
    pct.textContent = Store.get('volume', 80);
    sl.el.addEventListener('pointerup', () => Snd.beep());
    el.append(h('div', { class: 'neo-kind', text: 'Speakers (Neo31 Sound Synthesizer)' }), h('div', { class: 'neo-volrow' }, mute, sl.el, pct));
    return el;
  },
  networkFlyout() {
    const el = h('div', { class: 'neo-fly neo-flynet raised' });
    const air = Store.get('airplane', false);
    const net = h('div', { class: 'neo-netitem' + (air ? '' : ' on') }, iconImg('s_network'), h('div', {}, h('div', { class: 'neo-ttitle', text: 'Neo31 Network' }), h('div', { text: air ? 'Airplane mode is on' : 'Connected, secured' })));
    const set = h('div', { class: 'neo-link', text: 'Network & Internet settings' });
    set.addEventListener('pointerup', () => { this.closePanels(); Sys.launch('SETTINGS network/status'); });
    const ab = h('div', { class: 'neo-qa' + (air ? ' on' : '') }, iconImg('s_netoff'), h('span', { text: 'Airplane mode' }));
    ab.addEventListener('pointerup', () => { Store.set('airplane', !Store.get('airplane', false)); this.closePanels(); this.renderTaskbar(); this.toggle('network'); });
    el.append(net, set, h('div', { class: 'neo-quick' }, ab));
    return el;
  },

  /* ---------------- Win+X ---------------- */
  winX() {
    const r = Sys.rectOf(this.startBtn);
    Menu.show([
      { label: 'Apps and &Features', action: () => Sys.launch('SETTINGS apps/features') },
      { label: 'Power &Options', action: () => Sys.launch('SETTINGS system/power') },
      { label: 'S&ystem', action: () => Sys.launch('SETTINGS system/about') },
      { label: 'Co&mmand Prompt', action: () => Sys.launch('CMD') },
      '-',
      { label: 'Task Manager', action: () => Sys.launch('TASKMGR') },
      { label: 'Setti&ngs', action: () => Sys.launch('SETTINGS') },
      { label: 'File &Explorer', action: () => Sys.launch('EXPLORER') },
      { label: '&Search', action: () => this.toggle('search') },
      { label: '&Run', action: () => Sys.launch('RUN') },
      '-',
      { label: 'Sh&ut down or sign out', items: [{ label: 'Sign &out', action: () => this.signOut() }, { label: '&Sleep', action: () => this.sleep() }, { label: 'Shut &down', action: () => this.shutdown(false) }, { label: '&Restart', action: () => this.shutdown(true) }] },
      { label: '&Desktop', action: () => this.toggleDesktop() }
    ], r.x, r.y, { anchorH: 0 });
  },

  /* ======================= TASK VIEW & VIRTUAL DESKTOPS ======================= */
  taskView() {
    this.closePanels();
    if (this.tv) { this.closeTaskView(); return; }
    const ov = this.tv = h('div', { class: 'neo-taskview' });
    const strip = h('div', { class: 'neo-vdstrip' });
    const cards = h('div', { class: 'neo-cards' });
    const render = () => {
      strip.innerHTML = ''; cards.innerHTML = '';
      this.vds.forEach((name, i) => {
        const d = h('div', { class: 'neo-vd raised' + (i === Sys.vd ? ' cur' : '') }, h('div', { class: 'neo-vdthumb' }), h('span', { text: name }));
        d.dataset.vd = i;
        d.addEventListener('pointerup', e => { if (e.button === 0 && !e.target.classList.contains('neo-x')) { this.switchVD(i); this.closeTaskView(); } });
        if (this.vds.length > 1) { const x = h('div', { class: 'neo-x', text: '×' }); x.addEventListener('pointerup', e => { e.stopPropagation(); this.removeVD(i); render(); }); d.appendChild(x); }
        strip.appendChild(d);
      });
      const add = h('div', { class: 'neo-vd neo-vdnew raised' }, iconImg('s_plus'), h('span', { text: 'New desktop' }));
      add.addEventListener('pointerup', () => { this.vds.push('Desktop ' + (this.vds.length + 1)); Store.set('neo.vds', this.vds); render(); });
      strip.appendChild(add);
      const ws = this.vdWindows().filter(w => !(w.o.dialog && w.modalOwner));
      if (!ws.length) cards.appendChild(h('div', { class: 'neo-bigtext', style: { color: 'var(--desktop-text)' }, text: 'No open windows' }));
      for (const w of ws) {
        const c = h('div', { class: 'neo-card win active' },
          h('div', { class: 'inner' }, h('div', { class: 'tb' }, h('div', { class: 'cap', text: w.title })), h('div', { class: 'body neo-cardbody' }, iconImg(w.o.icon || 'app'))));
        const x = h('div', { class: 'neo-x', text: '×' });
        x.addEventListener('pointerup', e => { e.stopPropagation(); w.close().then(render); });
        c.appendChild(x);
        // drag a card onto another desktop to move the window there
        c.addEventListener('pointerdown', e => {
          if (e.target === x) return;
          e.preventDefault();
          c.setPointerCapture(e.pointerId);
          const sx = e.clientX, sy = e.clientY; let moved = false;
          const mv = ev => { if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 6) { moved = true; c.style.transform = `translate(${(ev.clientX - sx) / Sys.scale}px, ${(ev.clientY - sy) / Sys.scale}px)`; c.style.zIndex = 5; } };
          const up = ev => {
            c.removeEventListener('pointermove', mv); c.removeEventListener('pointerup', up);
            if (!moved) { this.closeTaskView(); w.isMin ? w.restore() : w.activate(); return; }
            const vd = document.elementsFromPoint(ev.clientX, ev.clientY).find(el => el.dataset && el.dataset.vd != null);
            if (vd && +vd.dataset.vd !== Sys.vd) { w.vd = +vd.dataset.vd; w.hide(); this.renderTaskbar(); }
            render();
          };
          c.addEventListener('pointermove', mv); c.addEventListener('pointerup', up);
        });
        cards.appendChild(c);
      }
    };
    render();
    ov.append(strip, cards);
    ov.addEventListener('pointerdown', e => { if (e.target === ov || e.target === cards) this.closeTaskView(); });
    Sys.deskEl.appendChild(ov);
  },
  closeTaskView() { if (this.tv) { this.tv.remove(); this.tv = null; } },
  switchVD(i) {
    if (i < 0 || i >= this.vds.length || i === Sys.vd) return;
    Sys.vd = i;
    for (const w of Sys.desktop.wins) {
      if (w.closed || w.o.hideFromTasks) continue;
      if ((w.vd || 0) === i) w.show(); else w.hide();
    }
    const top = this.vdWindows().filter(w => !w.isMin).pop();
    if (top) top.activate(); else { if (Sys.desktop.active) Sys.desktop.active.setActive(false); Sys.desktop.active = null; }
    this.renderTaskbar();
  },
  removeVD(i) {
    const to = i === 0 ? 1 : i - 1;
    for (const w of Sys.desktop.wins) if ((w.vd || 0) === i) w.vd = to;
    for (const w of Sys.desktop.wins) if ((w.vd || 0) > i) w.vd--;
    this.vds.splice(i, 1);
    this.vds = this.vds.map((n, k) => /^Desktop \d+$/.test(n) ? 'Desktop ' + (k + 1) : n);
    Store.set('neo.vds', this.vds);
    const cur = Sys.vd > i || Sys.vd === i ? Math.max(0, Sys.vd - 1) : Sys.vd;
    Sys.vd = -1; this.switchVD(cur);
  },

  /* ======================= KEYBOARD ======================= */
  key(e) {
    const name = keyName(e);
    if (e.key === 'Meta') { this.metaAlone = true; e.preventDefault(); return true; }
    if (e.metaKey) this.metaAlone = false;
    if (this.panel && this.panel._keys && this.panel._keys(e)) { e.preventDefault(); return true; }
    if (e.key === 'Escape' && (this.panel || this.tv)) { e.preventDefault(); this.closePanels(); this.closeTaskView(); return true; }
    if (name === 'Ctrl+Esc') { e.preventDefault(); this.toggle('start'); return true; }
    if (name === 'Ctrl+Shift+Esc') { e.preventDefault(); Sys.launch('TASKMGR'); return true; }
    if (e.metaKey) {
      const k = e.code && e.code.startsWith('Key') ? e.code.slice(3) : e.key;
      const map = {
        E: () => Sys.launch('EXPLORER'), R: () => Sys.launch('RUN'), D: () => this.toggleDesktop(), L: () => this.lock(), I: () => Sys.launch('SETTINGS'),
        A: () => this.toggle('action'), S: () => this.toggle('search'), X: () => this.winX(), Tab: () => this.taskView(), M: () => this.vdWindows().forEach(w => w.minBox !== false && !w.isMin && w.minimize())
      };
      if (e.ctrlKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); this.switchVD(Sys.vd + (e.key === 'ArrowLeft' ? -1 : 1)); return true; }
      if (e.ctrlKey && k === 'D') { e.preventDefault(); this.vds.push('Desktop ' + (this.vds.length + 1)); Store.set('neo.vds', this.vds); this.switchVD(this.vds.length - 1); return true; }
      if (map[k]) { e.preventDefault(); map[k](); return true; }
      const w = Sys.desktop.active;
      if (w && /^Arrow/.test(e.key) && !w.o.dialog) {
        e.preventDefault();
        const W = Sys.desktop.W, H = Sys.desktop.H;
        if (e.key === 'ArrowUp') w.maximize();
        else if (e.key === 'ArrowDown') { if (w.isMax || w.snapRestore) { w.isMax ? w.restore() : (w.setRect(w.snapRestore.x, w.snapRestore.y, w.snapRestore.w, w.snapRestore.h), w.snapRestore = null); } else w.minimize(); }
        else if (w.o.resizable !== false) {
          const left = e.key === 'ArrowLeft';
          if (w.isMax) w.restore(true);
          if (!w.snapRestore) w.snapRestore = { x: w.x, y: w.y, w: w.w, h: w.h };
          w.setRect(left ? 0 : Math.round(W / 2), 0, left ? Math.round(W / 2) : W - Math.round(W / 2), H);
        }
        return true;
      }
    }
    if (!Sys.desktop.active && this.deskKey(e)) { e.preventDefault(); return true; }
    return false;
  },
  keyUp(e) {
    if (e.key === 'Meta' && this.metaAlone) { this.metaAlone = false; this.toggle('start'); return true; }
    return false;
  }
};

/* ======================= NEO10 WALLPAPERS (pixel art, 16 colours, dithered) ======================= */
(() => {
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const dith = (x, y, v) => v > (BAYER[y & 3][x & 3] + .5) / 16;
  Object.assign(Wallpapers.makers, {
    /* desktop: seamless 192×192 tile — Neo10 logos on a wide diamond lattice, each throwing faint rays */
    NEO10() {
      const S = 192, g = new PixGrid(S, S), L = neoLogoGrid(32), TAU = Math.PI * 2;
      const centres = [[0, 0], [S, 0], [0, S], [S, S], [S / 2, S / 2]];
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const swell = .5 + .5 * Math.cos(TAU * (x + y) / S);
        let c = dith(x, y, .35 + swell * .35) ? 'N' : 'K';
        const [cx, cy] = centres.reduce((m, q) => Math.hypot(x - q[0], y - q[1]) < Math.hypot(x - m[0], y - m[1]) ? q : m);
        const d = Math.hypot(x - cx, y - cy), a = Math.atan2(y - cy, x - cx);
        const ray = Math.max(0, Math.cos(a * 8)) ** 8 * Math.max(0, 1 - d / 52);
        if (dith(x, y, ray * .55 + Math.max(0, 1 - d / 32) * .4)) c = 'B';
        if (d > 18 && dith(x, y, (1 - d / 26) * .8)) c = 'C';
        g.p(x, y, c);
      }
      for (const [ox, oy] of [[S / 2 - 16, S / 2 - 16], [-16, -16]])
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const c = L.get(x, y); if (c) g.p((ox + x + S) % S, (oy + y + S) % S, c); }
      return g.canvas();
    },
    /* night sky that fills the screen above the lock-screen landscape */
    STARS() {
      const S = 160, g = new PixGrid(S, S).f(0, 0, S, S, 'N'), rnd = Wallpapers.rng(3110);
      for (let i = 0; i < 22; i++) g.p(Math.floor(rnd() * S), Math.floor(rnd() * S), rnd() < .3 ? 'W' : 'S');
      return g.canvas();
    },
    /* lock screen: sunset over a lake — repeats left-to-right; STARS tiles the sky above it */
    LOCK10() {
      const W = 320, H = 400, g = new PixGrid(W, H), horizon = 290, TAU = Math.PI * 2;
      const sky = [['N', 'N'], ['N', 'm'], ['m', 'r'], ['r', 'R'], ['R', 'Y']];
      const skyAt = (x, y) => { const t = Math.max(0, y) / horizon * (sky.length - .01); const [a, b] = sky[Math.floor(t)]; return dith(x, y, t % 1) ? b : a; };
      const rnd = Wallpapers.rng(3110);
      for (let y = 0; y < horizon; y++) for (let x = 0; x < W; x++) g.p(x, y, skyAt(x, y));
      for (let i = 0; i < 70; i++) { const x = Math.floor(rnd() * W), y = Math.floor(rnd() * 110); if (g.get(x, y) === 'N') g.p(x, y, rnd() < .3 ? 'W' : 'S'); }
      const wave = (x, k, ph) => Math.sin(TAU * k * x / W + ph);
      for (let x = 0; x < W; x++) {
        const r1 = Math.round(horizon - 22 - 34 * (wave(x, 1, 1) * .55 + wave(x, 3, 2) * .3 + wave(x, 11, 0) * .15));
        const r2 = Math.round(horizon - 2 - 16 * (wave(x, 2, 4) * .6 + wave(x, 7, 1) * .3 + wave(x, 17, 3) * .1));
        for (let y = r1; y < horizon; y++) g.p(x, y, dith(x, y, .5) ? 'm' : 'N');
        for (let y = r2; y < horizon + 3; y++) g.p(x, y, 'K');
      }
      for (let y = horizon + 3; y < H; y++) for (let x = 0; x < W; x++) {
        const my = horizon - (y - horizon) * 1.6, src = my > 0 ? skyAt(x, Math.floor(my)) : 'N';
        let c = dith(x, y, .55) ? src : 'N';
        if ((y + Math.round(wave(x, 15, 0) * 2)) % 9 === 0 && dith(x, y, .3)) c = 'B';
        g.p(x, y, c);
      }
      return g.canvas();
    }
  });
})();
