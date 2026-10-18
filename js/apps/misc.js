'use strict';
/* About boxes, Print Manager & spooler, Clipboard Viewer, Windows Setup,
   Task Manager, and the Windows Help engine. */

function sysResources() { return Math.max(12, 92 - Sys.topWindows().length * 4); }
function freeMemKB() { return 14336 - Sys.topWindows().length * 312; }

function aboutBox(appName, iconName, owner, extraLine) {
  return dialog({
    title: 'About ' + appName, w: 380, h: 214, owner,
    build(d) {
      d.add(iconName && iconName !== 'winlogo' ? iconImg(iconName) : flagImg(0, 1, 48, 42), 14, 14);
      d.add(h('div', { class: 'txt', html: `Microsoft Windows ${esc(appName)}<br>Version 3.1${extraLine ? '<br>' + esc(extraLine) : ''}<br>Copyright © 1985-1992 Microsoft Corp.` }), 76, 14, 290);
      d.add(h('div', { style: { borderTop: '1px solid #000' } }), 76, 82, 290, 1);
      d.add(h('div', { class: 'txt', html: `This product is licensed to:<br>&nbsp;&nbsp;${esc(Store.get('userName', 'Windows 31 User'))}<br>&nbsp;&nbsp;${esc(Store.get('userOrg', 'Windows 31 Simulation'))}` }), 76, 90, 290);
      d.add(h('div', { style: { borderTop: '1px solid #000' } }), 76, 146, 290, 1);
      d.add(h('div', { class: 'txt', html: `386 Enhanced Mode<br>Memory:&nbsp;&nbsp;&nbsp;${fmtNum(freeMemKB())} KB Free<br>System Resources:&nbsp;&nbsp;&nbsp;${sysResources()}% Free` }), 76, 154, 290);
      d.add(UI.button('OK', { default: true, onClick: () => d.close() }), 300, 14, 66, 25);
    }
  });
}

/* ======================= PRINT SPOOLER ======================= */
const PrintQueue = Object.assign(new Emitter(), {
  jobs: [], paused: false, n: 0,
  port() { return Store.get('printPort', 'LPT1'); },
  printer() { return `Generic / Text Only on ${this.port()}`; },
  add(title, text) {
    const job = { id: ++this.n, title, size: Math.max(1, Math.round((text || '').length / 1024)), pct: 0, t: Sys.now(), port: this.port() };
    this.jobs.push(job);
    this.emit('change');
    if (!this._timer) this._timer = setInterval(() => this.tick(), 400);
    return job;
  },
  tick() {
    if (this.paused || !this.jobs.length) {
      if (!this.jobs.length) { clearInterval(this._timer); this._timer = null; }
      return;
    }
    const j = this.jobs[0];
    if (/^COM[2-4]$/.test(j.port)) { this.fail(j); return; }
    const speed = { low: 5, medium: 12, high: 25 }[Store.get('pm.prio', 'medium')];
    j.pct = Math.min(100, j.pct + speed + Math.random() * speed);
    if (j.pct >= 100) this.jobs.shift();
    this.emit('change');
  },
  /* the port has nothing attached: Print Manager alerts according to its Options */
  fail(j) {
    this.paused = true; this.emit('change');
    const alert = Store.get('pm.alert', 'flash');
    const show = () => msgBox(`Cannot write to ${j.port}:\n\nThe printer is not connected. Check the printer cable, or choose another port with Control Panel > Printers > Connect.`, 'Print Manager', { icon: 'stop', buttons: 'retrycancel' })
      .then(r => { if (r === 'cancel') this.remove(j.id); this.paused = false; this.emit('change'); });
    const pm = Sys.apps.printman && Sys.apps.printman.instances[0];
    if (alert === 'always' || (alert === 'flash' && pm && pm.isActive)) show();
    else if (alert === 'flash') {
      if (pm) pm.flash();
      const iv = setInterval(() => { const p = Sys.apps.printman && Sys.apps.printman.instances[0]; if (p && p.isActive) { clearInterval(iv); show(); } else if (p) p.flash(); }, 1500);
    }
    // 'ignore': the job just sits paused until Print Manager is opened and Resume is chosen
  },
  remove(id) { this.jobs = this.jobs.filter(j => j.id !== id); this.emit('change'); }
});

/* App-side print: shows "Printing" dialog, then spools */
async function printDoc(appName, docName, text, owner) {
  // FILE: port asks for an output file and writes the text there
  if (PrintQueue.port() === 'FILE') {
    const name = await new Promise(res => dialog({ title: 'Print To File', w: 260, h: 70, owner, build(d) {
      const t = UI.text('');
      d.add(UI.label('&Output File Name:', t), 10, 8); d.add(t, 10, 26, 160);
      d.add(UI.button('OK', { default: true, onClick: () => d.close(t.value.trim()) }), 178, 6, 74, 25);
      d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close(null) }), 178, 36, 74, 25);
    } }).promise.then(res));
    if (!name) return;
    try { FS.write(FS.full(name, 'C:\\WINDOWS'), text); }
    catch (e) { msgBox(`Cannot print to ${name}.\n${e.message}`, appName, { icon: 'stop', owner }); return; }
  }
  return dialog({
    title: appName, w: 280, h: 96, owner,
    build(d) {
      d.add(h('div', { class: 'txt', style: { textAlign: 'center', width: '260px' }, text: `Now Printing\n${appName} - ${docName}\non the ${PrintQueue.printer()}:` }), 10, 10);
      d.add(UI.button('Cancel', { default: true, cancel: true, onClick: () => { clearTimeout(t); d.close(); } }), 100, 64, 80, 25);
      const direct = !Store.get('usePrintMan', true) || PrintQueue.port() === 'FILE';
      // without Print Manager the application prints directly and takes longer
      const t = setTimeout(() => {
        d.close();
        if (direct) { if (/^COM[2-4]$/.test(PrintQueue.port())) msgBox(`Cannot write to ${PrintQueue.port()}:\n\nThe printer is not connected.`, appName, { icon: 'stop', owner }); }
        else PrintQueue.add(`${appName} - ${docName}`, text);
      }, direct ? 1200 + Math.min(4000, (text || '').length / 4) : 1200);
    }
  });
}

Sys.registerApp('printman', {
  name: 'Print Manager', icon: 'printman', single: true, help: 'printman',
  run() {
    let sel = 0;
    const opt = (k, d) => Store.get(k, d);
    const radio = (k, v, d) => ({ checked: () => opt(k, d) === v, radio: true, action: () => { Store.set(k, v); render(); } });
    const toggle = k => ({ checked: () => opt(k, true), action: () => { Store.set(k, !opt(k, true)); render(); } });
    const w = new Win({
      title: 'Print Manager', icon: 'printman', w: 470, h: 230, persist: 'printman',
      menu: [
        { label: '&View', items: [{ label: '&Time/Date Sent', ...toggle('pm.viewTime') }, { label: '&Print File Size', ...toggle('pm.viewSize') }, '-', { label: '&Refresh', key: 'F5', action: () => render() }, '-', { label: '&Selected Net Queue...', disabled: true }, { label: '&Other Net Queue...', disabled: true }, '-', { label: 'E&xit', action: () => w.close() }] },
        { label: '&Options', items: [{ label: '&Low Priority', ...radio('pm.prio', 'low', 'medium') }, { label: '&Medium Priority', ...radio('pm.prio', 'medium', 'medium') }, { label: '&High Priority', ...radio('pm.prio', 'high', 'medium') }, '-',
          { label: '&Alert Always', ...radio('pm.alert', 'always', 'flash') }, { label: '&Flash if Inactive', ...radio('pm.alert', 'flash', 'flash') }, { label: '&Ignore if Inactive', ...radio('pm.alert', 'ignore', 'flash') }, '-',
          { label: '&Network Settings...', disabled: true }, { label: '&Printer Setup...', action: () => Sys.launch('CONTROL.EXE printers') }] },
        { label: '&Help', items: [{ label: '&Contents', action: () => Sys.launch('WINHELP.EXE printman') }, '-', { label: '&About Print Manager...', action: () => aboutBox('Print Manager', 'printman', w) }] }
      ]
    });
    w.body.style.background = 'var(--btn-face)';
    const pause = UI.button('&Pause', { onClick: () => { PrintQueue.paused = true; render(); } });
    const resume = UI.button('&Resume', { onClick: () => { PrintQueue.paused = false; render(); } });
    const delb = UI.button('&Delete', { onClick: async () => {
      const j = PrintQueue.jobs[sel - 1];
      if (!j) return;
      const r = await msgBox(`Do you want to cancel printing of ${j.title}?`, 'Print Manager', { buttons: 'okcancel', icon: 'question', owner: w });
      if (r === 'ok') PrintQueue.remove(j.id);
    } });
    const msg = h('div', { class: 'txt', style: { position: 'absolute', left: '230px', top: '12px', right: '6px' } });
    const list = h('div', { class: 'lb', style: { position: 'absolute', left: '0', right: '0', top: '44px', bottom: '0', borderWidth: '1px 0 0' } });
    [pause, resume, delb].forEach((b, i) => { UI.place(b, 6 + i * 74, 8, 68, 26); w.body.appendChild(b); });
    w.body.append(msg, list);
    const render = () => {
      const status = PrintQueue.paused ? 'Paused' : PrintQueue.jobs.length ? 'Printing' : 'Idle';
      msg.textContent = `The ${PrintQueue.printer()} is ${status}.`;
      list.innerHTML = '';
      const rows = [{ text: `${PrintQueue.printer()} [${status}]`, icon: 'printman' }];
      PrintQueue.jobs.forEach((j, i) => rows.push({ text: `${i + 1}  ${j.title}` + (opt('pm.viewSize', true) ? `     ${Math.round(j.pct)}% of ${j.size}K` : '') + (opt('pm.viewTime', true) ? `    ${timeStr(j.t)} ${dateStr(j.t)}` : '') }));
      rows.forEach((r, i) => {
        const row = h('div', { class: 'it' + (i === sel ? ' sel' : ''), style: { paddingLeft: i ? '28px' : '4px' } }, i ? null : iconImg('s_exe', 16), r.text);
        row.addEventListener('pointerdown', () => { sel = i; render(); });
        list.appendChild(row);
      });
      delb.disabled = sel === 0 || !PrintQueue.jobs[sel - 1];
    };
    const off = PrintQueue.on('change', render);
    w.on('closed', off);
    render();
    return w;
  }
});

/* ======================= CLIPBOARD VIEWER ======================= */
Sys.registerApp('clipbrd', {
  name: 'Clipboard Viewer', icon: 'clipbrd', single: true, help: 'clipbrd',
  run() {
    const view = h('div', { class: 'fill', style: { overflow: 'auto', padding: '2px 4px' } });
    const w = new Win({
      title: 'Clipboard Viewer', icon: 'clipbrd', w: 420, h: 280, persist: 'clipbrd',
      menu: [
        { label: '&File', items: [
          { label: '&Open...', action: async () => {
            const f = await fileDialog({ owner: w, filters: [['Clipboard (*.CLP)', '*.CLP']] });
            if (f) { try { Sys.setClipboard(JSON.parse(FS.read(f))); } catch { msgBox('This is not a valid Clipboard file.', 'Clipboard Viewer', { icon: 'exclaim', owner: w }); } }
          } },
          { label: 'Save &As...', disabled: () => !Sys.clipboard, action: async () => {
            const f = await fileDialog({ mode: 'save', owner: w, defExt: 'CLP', filters: [['Clipboard (*.CLP)', '*.CLP']] });
            if (f) FS.write(f, JSON.stringify(Sys.clipboard));
          } },
          '-', { label: 'E&xit', action: () => w.close() }] },
        { label: '&Edit', items: [{ label: '&Delete', key: 'Del', action: async () => {
          const r = await msgBox('Clear contents of the Clipboard?', 'Clipboard Viewer', { buttons: 'yesno', icon: 'question', owner: w });
          if (r === 'yes') Sys.setClipboard(null);
        } }] },
        { label: '&Display', items: [{ label: '&Auto', checked: true }, '-', { label: '&Text', disabled: () => Sys.clipboard?.type !== 'text' }, { label: '&OEM Text', disabled: () => Sys.clipboard?.type !== 'text' }, { label: '&Bitmap', disabled: () => Sys.clipboard?.type !== 'image' }] },
        { label: '&Help', items: [{ label: '&Contents', action: () => Sys.launch('WINHELP.EXE clipbrd') }, '-', { label: '&About Clipboard Viewer...', action: () => aboutBox('Clipboard Viewer', 'clipbrd', w) }] }
      ]
    });
    w.body.appendChild(view);
    const render = () => {
      view.innerHTML = '';
      const c = Sys.clipboard;
      if (!c) return;
      if (c.type === 'text') view.appendChild(h('div', { style: { whiteSpace: 'pre-wrap', font: 'var(--sys-font)', userSelect: 'text' }, text: c.data }));
      else if (c.type === 'image') view.appendChild(h('img', { src: c.data, style: { imageRendering: 'pixelated' } }));
    };
    const off = Sys.on('clipboard', render);
    w.on('closed', off);
    render();
    return w;
  }
});

/* ======================= TASK MANAGER ======================= */
Sys.registerApp('taskman', { name: 'Task List', icon: 'taskman', run() { Sys.taskList(); return null; } });

/* ======================= WINDOWS SETUP ======================= */
Sys.registerApp('setup', {
  name: 'Windows Setup', icon: 'setup', single: true, help: 'setup',
  displays: [
    ['auto', 'Windows 31 Best Sharp Fit'],
    ['640x480', 'VGA'], ['800x600', 'Super VGA (800x600, 16 colors)'], ['1024x768', '8514/a (1024x768, Small fonts)'],
    ['1280x1024', 'XGA (1280x1024)'], ['fit', 'Windows 31 Fit to Browser Window']
  ],
  run() {
    const app = this;
    const dispName = () => (app.displays.find(d => d[0] === Store.get('display', 'auto')) || app.displays[0])[1];
    const info = h('div', { class: 'dlgc' });
    const w = new Win({
      title: 'Windows Setup', icon: 'setup', resizable: false, maxBox: false, w: 420, h: 150,
      menu: [
        { label: '&Options', items: [
          { label: '&Change System Settings...', action: () => change() },
          { label: '&Set Up Applications...', action: () => setupApps() },
          { label: '&Add/Remove Windows Components...', action: () => components() },
          '-', { label: 'E&xit', action: () => w.close() }] },
        { label: '&Help', items: [{ label: '&Contents', action: () => Sys.launch('WINHELP.EXE setup') }, '-', { label: '&About Windows Setup...', action: () => aboutBox('Setup', 'setup', w) }] }
      ]
    });
    w.body.style.background = 'var(--btn-face)';
    w.body.appendChild(info);
    const render = () => {
      info.innerHTML = '';
      const rows = [['Display:', dispName()], ['Keyboard:', 'Enhanced 101 or 102 key US and Non US keyboards'], ['Mouse:', 'Microsoft, or IBM PS/2'], ['Network:', 'No Network Installed']];
      rows.forEach(([a, b], i) => {
        info.appendChild(UI.place(h('div', { class: 'txt', text: a }), 12, 12 + i * 20));
        info.appendChild(UI.place(h('div', { class: 'txt', style: { whiteSpace: 'nowrap' }, text: b }), 100, 12 + i * 20));
      });
    };
    render();
    requestAnimationFrame(() => w.sizeToClient(Math.max(...[...info.querySelectorAll('.txt')].map(t => t.offsetLeft + t.offsetWidth)) + 16, 98));

    const change = () => dialog({
      title: 'Change System Settings', w: 400, h: 178, owner: w,
      build(d) {
        const disp = UI.combo({ items: app.displays.map(x => x[1]), index: Math.max(0, app.displays.findIndex(x => x[0] === Store.get('display', 'auto'))) });
        const kb = UI.combo({ items: ['Enhanced 101 or 102 key US and Non US keyboards', 'AT-type keyboard (84 - 86 keys)'] });
        const ms = UI.combo({ items: ['Microsoft, or IBM PS/2', 'Logitech serial mouse', 'No mouse or other pointing device'] });
        const net = UI.combo({ items: ['No Network Installed'] });
        [['&Display:', disp], ['&Keyboard:', kb], ['&Mouse:', ms], ['&Network:', net]].forEach(([l, c], i) => {
          d.add(UI.label(l, c), 10, 14 + i * 28); d.add(c, 80, 10 + i * 28, 310);
        });
        d.add(UI.button('OK', { default: true, onClick: async () => {
          const nd = app.displays[disp.index][0];
          d.close();
          if (nd === Store.get('display', 'auto')) return;
          const r = await new Promise(res => dialog({
            title: 'Exit Windows', w: 330, h: 90, owner: w,
            build(d2) {
              d2.add(h('div', { class: 'txt', style: { width: '310px' }, text: 'You need to exit Windows so that the changes you made will take effect.\n\nDo not press any keys until the MS-DOS prompt appears.' }), 10, 10);
              d2.add(UI.button('&Restart Windows', { default: true, onClick: () => d2.close('r') }), 40, 62, 120, 25);
              d2.add(UI.button('&Continue', { cancel: true, onClick: () => d2.close('c') }), 170, 62, 120, 25);
            }
          }).promise.then(res));
          Store.set('display', nd);
          if (r === 'r') Shell31.shutdown(true);
          else { Sys.layoutScreen(); render(); }
        } }), 120, 122, 80, 25);
        d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 210, 122, 80, 25);
      }
    });

    const setupApps = () => msgBox('Setup searched drive C: and found no new applications to set up.', 'Setup Applications', { icon: 'info', owner: w });

    const components = () => dialog({
      title: 'Windows Setup', w: 380, h: 170, owner: w,
      build(d) {
        d.add(UI.label('The following optional groups of files (components) may be installed:'), 10, 8);
        const comps = [['Readme Files', '237 K'], ['Accessories', '1,622 K'], ['Games', '348 K'], ['Screen Savers', '74 K'], ['Wallpapers, Misc.', '269 K']];
        comps.forEach(([n, s], i) => {
          d.add(UI.check(n, true), 16, 32 + i * 22);
          d.add(h('div', { class: 'txt', text: s }), 200, 32 + i * 22);
          d.add(UI.button('&Files...', { disabled: true }), 280, 30 + i * 22, 60, 20);
        });
        d.add(UI.button('OK', { default: true, onClick: () => d.close() }), 100, 142, 80, 24);
        d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 190, 142, 80, 24);
      }
    });
    return w;
  }
});

/* ======================= WINDOWS HELP ======================= */
const _hL = (id, text) => `<a class="hl" data-t="${id}">${text}</a>`;
const _hG = (word, def) => `<a class="hd" data-d="${esc(def)}">${word}</a>`;
const HELP = {
  progman: {
    title: 'Program Manager Help',
    topics: {
      contents: ['Contents for Program Manager Help', `<p>Program Manager is a tool you can use to easily start applications, and to organize your applications and files into logical groups.</p>
<p><b>How To...</b></p><p>${_hL('start', 'Start an Application')}<br>${_hL('groups', 'Organize Applications and Documents')}<br>${_hL('quit', 'Quit Windows')}</p>
<p><b>Commands</b></p><p>${_hL('filemenu', 'File Menu Commands')}<br>${_hL('optmenu', 'Options Menu Commands')}<br>${_hL('winmenu', 'Window Menu Commands')}</p>
<p><b>Keyboard</b></p><p>${_hL('keys', 'Program Manager Keys')}</p>`],
      start: ['Starting an Application', `<p>To start an application from a ${_hG('group', 'A collection of applications and documents within Program Manager.')}, double-click its ${_hG('program-item icon', 'A graphical representation of an application or document in a group window.')}.</p>
<p>You can also choose Run from the File menu and type the command line for the application, or start applications from File Manager.</p><p>See also: ${_hL('groups', 'Organizing Applications')}</p>`],
      groups: ['Organizing Applications and Documents', `<p>To create a new group, choose New from the File menu, select Program Group, and type a description.</p>
<p>To add a program item, select the group, choose New from the File menu, select Program Item, and type the command line (for example, <b>NOTEPAD.EXE</b>).</p>
<p>You can move a program item to another group by dragging it. Hold down CTRL while dragging to copy it instead.</p>`],
      quit: ['Quitting Windows', `<p>To end your Windows session, choose Exit Windows from the File menu, or double-click the Control-menu box of Program Manager.</p><p>If the Save Settings on Exit command is checked, the arrangement of your groups is saved for the next session.</p><p>At the MS-DOS prompt, type <b>WIN</b> to start Windows again.</p>`],
      filemenu: ['File Menu Commands', `<p><b>New</b> creates a new group or program item.<br><b>Open</b> starts the selected application or opens the selected group.<br><b>Move</b> and <b>Copy</b> transfer a program item to another group.<br><b>Delete</b> removes a program item or group.<br><b>Properties</b> changes the description, command line or icon of an item.<br><b>Run</b> starts an application by typing its command line.<br><b>Exit Windows</b> ends your Windows session.</p>`],
      optmenu: ['Options Menu Commands', `<p><b>Auto Arrange</b> arranges icons in each group whenever you resize the group window.<br><b>Minimize on Use</b> reduces Program Manager to an icon when you start an application.<br><b>Save Settings on Exit</b> saves the arrangement of windows and icons when you quit Windows.</p>`],
      winmenu: ['Window Menu Commands', `<p><b>Cascade</b> arranges group windows so that they overlap and each title bar is visible.<br><b>Tile</b> arranges group windows side by side.<br><b>Arrange Icons</b> arranges icons in the active group, or group icons at the bottom of Program Manager.</p>`],
      keys: ['Program Manager Keys', `<p>ENTER — Starts the selected application.<br>ARROW KEYS — Move between items in a group.<br>CTRL+F6 or CTRL+TAB — Moves between group windows.<br>CTRL+F4 — Closes (minimizes) the active group.<br>SHIFT+F5 — Cascade.<br>SHIFT+F4 — Tile.<br>CTRL+ESC — Opens the Task List.<br>ALT+F4 — Exits Windows.</p>`]
    }
  },
  winfile: { title: 'File Manager Help', topics: { contents: ['Contents for File Manager Help', `<p>File Manager helps you organize your files and directories.</p><p>The <b>directory tree</b> on the left shows the directories on drive C:. Click a directory to view its contents on the right. Double-click a directory in the tree to expand or collapse it.</p><p>Double-click a file to open it. Programs start; documents open in their associated application (see the [Extensions] section of WIN.INI, or choose Associate from the File menu).</p><p>Use the File menu to Move, Copy, Delete, Rename and Create Directory. Drag a file onto a directory in the tree to move it; hold CTRL to copy it.</p>`] } },
  control: { title: 'Control Panel Help', topics: { contents: ['Contents for Control Panel Help', `<p>Control Panel provides a visual way of modifying your system.</p><p><b>Color</b> — change the colors of Windows screen elements.<br><b>Desktop</b> — patterns, wallpaper, screen savers, icon spacing and border width.<br><b>Mouse</b> — double-click speed, swap buttons, mouse trails.<br><b>Date/Time</b> — set the system date and time.<br><b>Sound</b> — assign sounds to system events.<br><b>Fonts</b>, <b>Keyboard</b>, <b>International</b>, <b>Ports</b>, <b>Printers</b>, <b>Drivers</b> and <b>386 Enhanced</b> configure other aspects of your system.</p>`] } },
  notepad: { title: 'Notepad Help', topics: { contents: ['Contents for Notepad Help', `<p>Notepad is a text editor you can use to create, view, and edit unformatted text files such as AUTOEXEC.BAT and WIN.INI.</p><p><b>Word Wrap</b> (Edit menu) wraps lines to fit the window.<br><b>Time/Date</b> (F5) inserts the current time and date.<br><b>Find</b> searches for text; F3 finds the next occurrence.</p><p><b>Creating a time-log file:</b> type <b>.LOG</b> on the first line of a document and save it. Each time you open the file, Notepad adds the current time and date to the end.</p>`] } },
  write: { title: 'Write Help', topics: { contents: ['Contents for Write Help', `<p>Write is a word processor for creating formatted documents.</p><p>Use the <b>Character</b> menu for bold, italic, underline, superscript and fonts; the <b>Paragraph</b> menu for alignment and spacing; and the <b>Find</b> menu to search and replace text.</p><p>Documents are saved as Write (.WRI) files.</p>`] } },
  pbrush: { title: 'Paintbrush Help', topics: { contents: ['Contents for Paintbrush Help', `<p>Paintbrush is a drawing tool for creating and editing bitmap (.BMP) pictures.</p><p>Choose a tool from the Toolbox on the left, a line width from the Linesize box, and colors from the Palette: click with the left mouse button for the foreground color and the right mouse button for the background color.</p><p><b>Tools:</b> Scissors and Pick select areas; Airbrush sprays; Text types; Color Eraser and Eraser remove; Paint Roller fills; Brush paints freehand; Curve, Line, Box, Rounded Box, Circle/Ellipse and Polygon draw shapes (filled versions on the right).</p><p>Backspace undoes the last change.</p>`] } },
  calc: { title: 'Calculator Help', topics: { contents: ['Contents for Calculator Help', `<p>Calculator has a Standard view and a Scientific view (View menu).</p><p>Use the number keys and + - * / = on your keyboard, or click the buttons. ESC clears (C), DEL clears the entry (CE), BACKSPACE removes the last digit. MC, MR, MS and M+ work with the memory; ALT+C copies and ALT+V pastes via the Edit menu.</p>`] } },
  clock: { title: 'Clock Help', topics: { contents: ['Contents for Clock Help', `<p>Clock displays the current time in Analog or Digital form. Use the Settings menu to show seconds and the date, choose a font for the digital clock, or remove the title bar (double-click the clock to restore it). When Clock is minimized, its icon still shows the time.</p>`] } },
  calendar: { title: 'Calendar Help', topics: { contents: ['Contents for Calendar Help', `<p>Calendar keeps track of appointments. The Day view lists times; type an appointment next to a time. The Month view (F9) shows a month; double-click a date to go to that day. Mark special days with Options > Mark (F6). The scratch pad at the bottom holds notes for each day.</p>`] } },
  cardfile: { title: 'Cardfile Help', topics: { contents: ['Contents for Cardfile Help', `<p>Cardfile stores information on index cards. Each card has an index line (shown at the top, used for sorting) and an information area.</p><p>Choose Add from the Card menu (F7) to create a card, Index from the Edit menu (F6) to change the index line, and use Search > Go To (F4) to find a card by its index. The View menu switches between Card and List views.</p>`] } },
  sol: { title: 'Solitaire Help', topics: { contents: ['Contents for Solitaire Help', `<p><b>Object of the game:</b> move all the cards to the four suit stacks in the upper right, in order from Ace to King.</p><p><b>Rules:</b> On the seven row stacks, build down in alternating colors (red on black). Only a King can be moved to an empty row stack. Click the deck to deal cards. Double-click a card to send it to a suit stack.</p><p><b>Scoring (Standard):</b> +10 for moving a card to a suit stack, +5 for moving from the deck to a row stack, +5 for turning over a card. -15 for moving a card off a suit stack, -100 for each pass through the deck (Draw One).</p>`] } },
  winmine: { title: 'Minesweeper Help', topics: { contents: ['Contents for Minesweeper Help', `<p><b>Object:</b> find all the mines as quickly as possible without uncovering one.</p><p>Click a square to uncover it. A number tells you how many mines touch that square. Right-click a square to mark it with a flag; right-click again for a question mark. Click both buttons (or the middle button) on a number to uncover its neighbors when all its mines are flagged.</p><p>Choose Beginner, Intermediate, Expert or Custom from the Game menu.</p>`] } },
  winhelp: { title: 'How to Use Help', topics: { contents: ['How to Use Help', `<p>Help topics contain words in <a class="hl" data-t="contents">green underlined text</a> that jump to related topics. Words with a <a class="hd" data-d="A definition popup.">dotted underline</a> show a definition when clicked.</p><p>Use the buttons below the menu bar: <b>Contents</b> returns to the main topic list, <b>Search</b> lists all topics, <b>Back</b> returns to the previous topic, <b>History</b> lists topics you have viewed, and <b>&lt;&lt;</b> / <b>&gt;&gt;</b> browse through topics in order.</p>`] } },
  dos: { title: 'MS-DOS Prompt Help', topics: { contents: ['MS-DOS Prompt', `<p>MS-DOS Prompt runs COMMAND.COM in a window. Type <b>HELP</b> for a list of commands and <b>EXIT</b> to close it. Press ALT+ENTER to switch between a window and full screen.</p><p>Useful commands: DIR, CD, TYPE, COPY, DEL, MD, RD, REN, MOVE, MEM, TREE, VER, SET, PATH, PROMPT, ECHO, EDIT.</p>`] } },
  tutorial: { title: 'Windows Tutorial', topics: {
    contents: ['Windows Tutorial', `<p>Welcome to Microsoft Windows! This short tutorial shows you the basics.</p><p>${_hL('mouse', '1. Using the Mouse')}<br>${_hL('windows', '2. Working with Windows')}<br>${_hL('menus', '3. Using Menus')}</p>`],
    mouse: ['Using the Mouse', `<p><b>Pointing</b> means moving the mouse until the pointer is over an object. <b>Clicking</b> means pressing and releasing the left mouse button. <b>Double-clicking</b> means clicking twice in rapid succession. <b>Dragging</b> means holding down the button while you move the mouse.</p><p>Try double-clicking the Clock icon in the Accessories group now.</p><p>${_hL('windows', 'Next: Working with Windows »')}</p>`],
    windows: ['Working with Windows', `<p>Every window has a <b>title bar</b>; drag it to move the window. Drag a <b>border</b> to resize it. The <b>Minimize</b> button (down arrow) reduces the window to an icon; the <b>Maximize</b> button (up arrow) enlarges it to fill the screen. The <b>Control-menu box</b> in the upper-left corner opens a menu with Restore, Move, Size and Close commands.</p><p>${_hL('menus', 'Next: Using Menus »')}</p>`],
    menus: ['Using Menus', `<p>Click a menu name on the menu bar to open it, then click a command. With the keyboard, press ALT and the underlined letter of the menu, then the underlined letter of the command. Commands followed by an ellipsis (...) open a dialog box. Dimmed commands are not currently available.</p><p>${_hL('contents', '« Back to the start')}</p>`]
  } },
  glossary: { title: 'Windows Glossary', topics: { contents: ['Glossary', `<p><b>Application workspace</b> — the area inside an application window that contains document windows.<br><b>Control-menu box</b> — the icon in the upper-left corner of a window.<br><b>Dialog box</b> — a window that appears temporarily to request information.<br><b>Group</b> — a collection of program items in Program Manager.<br><b>Icon</b> — a graphical representation of an element in Windows.<br><b>Task List</b> — a window that shows running applications and lets you switch between them.<br><b>Wallpaper</b> — a picture or pattern displayed on the desktop.</p>`] } }
};
for (const [k, n] of Object.entries({ charmap: 'Character Map', terminal: 'Terminal', mplayer: 'Media Player', soundrec: 'Sound Recorder', clipbrd: 'Clipboard Viewer', printman: 'Print Manager', setup: 'Windows Setup', commdlg: 'Common Dialogs' }))
  if (!HELP[k]) HELP[k] = { title: n + ' Help', topics: { contents: ['Contents for ' + n + ' Help', `<p>${n} is one of the applications included with Windows.</p><p>Use the menus at the top of the ${n} window to access its commands. Commands followed by an ellipsis (...) open a dialog box. Press F1 at any time to get help.</p><p>See also: <a class="hl" data-f="winhelp" data-t="contents">How to Use Help</a></p>`] } };

Sys.registerApp('winhelp', {
  name: 'Windows Help', icon: 'help',
  run(opts) {
    let file = (opts.args || 'progman').trim();
    const n = FS.get(file, 'C:\\WINDOWS') || FS.get(file + '.HLP', 'C:\\WINDOWS');
    let id = (n && n.g) || file.toLowerCase().replace(/^.*\\/, '').replace(/\.hlp$/, '');
    if (!HELP[id]) id = 'progman';
    let book = HELP[id], topic = 'contents';
    const hist = [], back = [];
    const view = h('div', { class: 'fill', style: { overflow: 'auto', padding: '6px 10px', background: '#fff', top: '30px', font: 'var(--help-font)', userSelect: 'text' } });
    const bar = h('div', { style: { position: 'absolute', left: 0, right: 0, top: 0, height: '30px', background: 'var(--btn-face)', borderBottom: '1px solid #000', display: 'flex', gap: '4px', padding: '3px 4px' } });
    const btn = (l, fn) => { const b = UI.button(l, { onClick: fn }); b.style.minWidth = '0'; b.style.padding = '0 6px'; b.style.minHeight = '22px'; bar.appendChild(b); return b; };
    const order = () => Object.keys(book.topics);
    const show = (t, noBack) => {
      if (!book.topics[t]) t = 'contents';
      if (!noBack && topic !== t) back.push([id, topic]);
      topic = t;
      const [title, html] = book.topics[t];
      if (!hist.length || hist[hist.length - 1] !== title) hist.push(title);
      view.innerHTML = `<div style="font-weight:bold;margin:4px 0 8px">${esc(title)}</div>${html}`;
      view.querySelectorAll('a.hl').forEach(a => { a.style.cssText = 'color:#008000;text-decoration:underline;cursor:var(--cur-hand)'; a.onclick = () => { if (a.dataset.f) { id = a.dataset.f; book = HELP[id]; w.setTitle(book.title); } show(a.dataset.t); }; });
      view.querySelectorAll('a.hd').forEach(a => { a.style.cssText = 'color:#008000;text-decoration:underline dotted;cursor:var(--cur-hand)'; a.onclick = e => popup(a, a.dataset.d); });
      view.scrollTop = 0;
      bBack.disabled = !back.length;
      const o = order(), i = o.indexOf(t);
      bPrev.disabled = i <= 0; bNext.disabled = i >= o.length - 1;
    };
    const popup = (a, text) => {
      const r = Sys.rectOf(a);
      const p = h('div', { class: 'popup', style: { left: r.x + 'px', top: (r.y + r.h + 2) + 'px', padding: '6px 8px', maxWidth: '260px', font: 'var(--help-font)', whiteSpace: 'normal' }, text });
      Menu.layer.appendChild(p);
      const close = () => { p.remove(); document.removeEventListener('pointerdown', close, true); };
      setTimeout(() => document.addEventListener('pointerdown', close, true), 0);
    };
    const w = new Win({
      title: book.title, icon: 'help', w: 600, h: 420,
      menu: [
        { label: '&File', items: [
          { label: '&Open...', action: async () => { const f = await fileDialog({ owner: w, filters: [['Help Files (*.HLP)', '*.HLP']] }); if (f) { const nn = FS.get(f); if (nn && nn.g && HELP[nn.g]) { id = nn.g; book = HELP[id]; w.setTitle(book.title); show('contents', true); } } } },
          { label: '&Print Topic', action: () => printDoc('Help', book.title, view.innerText, w) },
          { label: 'P&rint Setup...', action: () => Sys.launch('CONTROL.EXE printers') }, '-',
          { label: 'E&xit', action: () => w.close() }] },
        { label: '&Edit', items: [{ label: '&Copy...', key: 'Ctrl+Ins', action: () => Sys.setClipboard({ type: 'text', data: view.innerText }) }, { label: '&Annotate...', disabled: true }] },
        { label: 'Book&mark', items: [{ label: '&Define...', disabled: true }] },
        { label: '&Help', items: [{ label: '&How to Use Help', key: 'F1', action: () => { id = 'winhelp'; book = HELP[id]; w.setTitle(book.title); show('contents'); } },
          { label: 'Always on &Top', checked: () => !!w.o.topmost, action: () => { w.o.topmost = !w.o.topmost; w.activate(); } }, '-',
          { label: '&About Help...', action: () => aboutBox('Help', 'help', w) }] }
      ]
    });
    btn('&Contents', () => show('contents'));
    btn('&Search', () => search());
    const bBack = btn('&Back', () => { const b = back.pop(); if (b) { if (b[0] !== id) { id = b[0]; book = HELP[id]; w.setTitle(book.title); } show(b[1], true); } });
    btn('His&tory', () => msgBox(hist.slice(-12).reverse().join('\n') || '(empty)', 'Windows Help History', { owner: w }));
    const bPrev = btn('<<', () => { const o = order(); show(o[Math.max(0, o.indexOf(topic) - 1)]); });
    const bNext = btn('>>', () => { const o = order(); show(o[Math.min(o.length - 1, o.indexOf(topic) + 1)]); });
    btn('&Glossary', () => Sys.launch('WINHELP.EXE glossary'));
    w.body.append(bar, view);
    const search = () => dialog({
      title: 'Search', w: 340, h: 200, owner: w,
      build(d) {
        const all = [];
        for (const [bid, b] of Object.entries(HELP)) for (const [tid, t] of Object.entries(b.topics)) all.push({ text: t[0], bid, tid });
        all.sort((a, b) => a.text.localeCompare(b.text));
        const txt = UI.text('');
        const go = () => { const it = lb.value; if (!it) return; d.close(); id = it.bid; book = HELP[id]; w.setTitle(book.title); show(it.tid); };
        const lb = UI.listbox({ items: all, sel: 0, onActivate: go });
        txt.addEventListener('input', () => { const i = all.findIndex(a => a.text.toLowerCase().startsWith(txt.value.toLowerCase())); if (i >= 0) lb.select(i, false); });
        d.add(UI.label('Type a &word, or select one from the list.', txt), 10, 8);
        d.add(txt, 10, 26, 230); d.add(lb, 10, 54, 230, 136);
        d.add(UI.button('&Show Topics', { default: true, onClick: go }), 250, 24, 82, 25);
        d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 250, 56, 82, 25);
      }
    });
    w.on('resize', () => {});
    show('contents', true);
    return w;
  }
});
