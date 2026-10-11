'use strict';
/* Settings (Windows 10) — every page edits the same settings Control Panel
   uses, so both stay in sync, and changes go through Settings.changed(). */

const SETTINGS_CATS = [
  { id: 'system', name: 'System', icon: 'thispc', desc: 'Display, sound, notifications, power' },
  { id: 'devices', name: 'Devices', icon: 'cpMouse', desc: 'Printers, mouse, typing' },
  { id: 'network', name: 'Network & Internet', icon: 'cpNetwork', desc: 'Status, airplane mode' },
  { id: 'personalization', name: 'Personalization', icon: 'cpDesktop', desc: 'Background, lock screen, colors' },
  { id: 'apps', name: 'Apps', icon: 'app', desc: 'Defaults, startup, installed apps' },
  { id: 'accounts', name: 'Accounts', icon: 'user', desc: 'Your info, sign-in options' },
  { id: 'time', name: 'Time & Language', icon: 'cpDateTime', desc: 'Date & time, region' },
  { id: 'ease', name: 'Ease of Access', icon: 'cpKeyboard', desc: 'Display, mouse pointer, contrast' },
  { id: 'update', name: 'Update & Security', icon: 'neologo', desc: 'Windows Update, recovery' }
];

const SETTINGS_PAGES = [];
const page = (id, title, keywords, render) => SETTINGS_PAGES.push({ id, title, keywords, render, cat: id.split('/')[0] });

/* ---------- page building blocks ---------- */
const SP = {
  h1: t => h('div', { class: 'neo-h1', text: t }),
  h2: t => h('div', { class: 'neo-h2', text: t }),
  p: t => h('div', { class: 'neo-p', text: t }),
  row: (...kids) => h('div', { class: 'neo-srow' }, ...kids),
  toggle(label, get, set, desc) {
    const sw = h('div', { class: 'neo-toggle sunken' + (get() ? ' on' : ''), tabindex: '0' }, h('div', { class: 'neo-knob raised' }));
    const txt = h('span', { text: get() ? 'On' : 'Off' });
    const flip = () => { set(!get()); sw.classList.toggle('on', get()); txt.textContent = get() ? 'On' : 'Off'; };
    sw.addEventListener('pointerup', flip);
    sw.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });
    return h('div', { class: 'neo-sfield' }, h('div', { class: 'neo-slabel', text: label }), desc ? SP.p(desc) : null, h('div', { class: 'neo-togrow' }, sw, txt));
  },
  combo(label, items, get, set) {
    const cb = UI.combo({ items: items.map(i => typeof i === 'string' ? i : i[1]), onChange: (_, idx) => set(typeof items[idx] === 'string' ? items[idx] : items[idx][0]) });
    const cur = get(); const idx = items.findIndex(i => (typeof i === 'string' ? i : i[0]) === cur);
    cb.set(Math.max(0, idx), false);
    cb.el.style.position = 'relative'; cb.el.style.width = '260px';
    return h('div', { class: 'neo-sfield' }, h('div', { class: 'neo-slabel', text: label }), cb.el);
  },
  slider(label, min, max, get, set, step) {
    const s = UI.slider({ min, max, step, value: get(), onChange: set });
    s.el.style.position = 'relative'; s.el.style.width = '260px';
    return h('div', { class: 'neo-sfield' }, h('div', { class: 'neo-slabel', text: label }), s.el);
  },
  button(t, fn) { const b = UI.button(t, { onClick: fn }); b.style.minWidth = '120px'; return b; },
  link(t, fn) { const a = h('div', { class: 'neo-link', text: t }); a.addEventListener('pointerup', fn); return a; },
  radios(label, items, get, set) {
    const name = 'r' + Math.random().toString(36).slice(2);
    return h('div', { class: 'neo-sfield' }, h('div', { class: 'neo-slabel', text: label }),
      ...items.map(([v, l]) => h('div', {}, UI.radio(name, l, get() === v, () => set(v)))));
  },
  swatches(colors, get, set) {
    const g = h('div', { class: 'neo-swatches' });
    const draw = () => {
      g.innerHTML = '';
      colors.forEach(c => { const s = h('div', { class: 'neo-swatch' + (get() === c ? ' on' : ''), style: { background: c } }); s.addEventListener('pointerup', () => { set(c); draw(); }); g.appendChild(s); });
    };
    draw();
    return g;
  },
  info: rows => h('div', { class: 'neo-info' }, ...rows.map(([a, b]) => h('div', { class: 'neo-inforow' }, h('span', { text: a }), h('span', { text: b }))))
};
const PALETTE16 = ['#000080', '#0000ff', '#008080', '#00ffff', '#008000', '#00ff00', '#808000', '#ffff00', '#800000', '#ff0000', '#800080', '#ff00ff', '#808080', '#c0c0c0', '#000000', '#ffffff'];
const setOverride = (k, v) => { const o = { ...Store.get('colorsOverride', {}) }; if (v == null) delete o[k]; else o[k] = v; Store.set('colorsOverride', o); Settings.changed(); };

/* Display changes ask to be kept, and revert after 15 seconds otherwise */
function keepDisplay(owner, revert) {
  let n = 15, t;
  const d = dialog({ title: 'Display Settings', w: 300, h: 92, owner, build(d) {
    const m = h('div', { class: 'txt', style: { width: '280px' } }); d.add(m, 10, 10);
    const upd = () => { m.textContent = `Keep these display settings?\n\nReverting to previous display settings in ${n} seconds.`; };
    upd();
    t = setInterval(() => { n--; upd(); if (n <= 0) { clearInterval(t); d.close('revert'); } }, 1000);
    d.add(UI.button('&Keep changes', { default: true, onClick: () => d.close('keep') }), 40, 62, 100, 25);
    d.add(UI.button('&Revert', { cancel: true, onClick: () => d.close('revert') }), 150, 62, 100, 25);
  } });
  d.promise.then(r => { clearInterval(t); if (r !== 'keep') revert(); });
}

/* ======================= SYSTEM ======================= */
page('system/display', 'Display', 'resolution screen night light scale size', el => {
  el.append(SP.h1('Display'), SP.h2('Scale and layout'),
    SP.combo('Display resolution', [['auto', 'Best Sharp Fit (recommended)'], ['640x480', '640 × 480'], ['800x600', '800 × 600'], ['1024x768', '1024 × 768'], ['1280x1024', '1280 × 1024'], ['fit', 'Fit to browser window']],
      () => Store.get('display', 'auto'), v => { const old = Store.get('display', 'auto'); Store.set('display', v); Sys.layoutScreen(); keepDisplay(Sys.activeTop(), () => { Store.set('display', old); Sys.layoutScreen(); }); }),
    SP.combo('Pixel size', [['auto', 'Largest that fits (recommended)'], ['1', '1 × (smallest)'], ['2', '2 ×'], ['3', '3 ×']], () => String(Store.get('pixelScale', 'auto')), v => { Store.set('pixelScale', v); Sys.layoutScreen(); }),
    SP.h2('Color'),
    SP.toggle('Night light', () => Store.get('nightlight', false), v => { Store.set('nightlight', v); Shell10.applyNightLight(); }, 'Warmer colors to help you sleep.'),
    SP.link('Classic Windows Setup', () => Sys.launch('SETUP.EXE')));
});
page('system/sound', 'Sound', 'volume speakers mute audio system sounds', el => {
  el.append(SP.h1('Sound'), SP.h2('Output'), SP.p('Choose your output device: Speakers (Neo31 Sound Synthesizer)'),
    SP.slider('Master volume', 0, 100, () => Store.get('volume', 80), v => { Store.set('volume', v); Shell10.renderTaskbar(); }, 2),
    SP.toggle('Mute', () => Store.get('muted', false), v => { Store.set('muted', v); Shell10.renderTaskbar(); }),
    SP.toggle('Play system sounds', () => Store.get('sounds', true), v => { Store.set('sounds', v); Settings.changed(); }),
    h('div', { class: 'neo-sfield' }, SP.button('Test', () => Snd.event('SystemStart'))),
    SP.link('Sound Control Panel', () => Sys.launch('CONTROL.EXE sound')));
});
page('system/notifications', 'Notifications & actions', 'notifications toast focus assist', el => {
  el.append(SP.h1('Notifications & actions'),
    SP.toggle('Get notifications from apps and other senders', () => Store.get('notify.on', true), v => Store.set('notify.on', v)),
    SP.toggle('Focus assist (hide notifications)', () => Store.get('focusAssist', false), v => Store.set('focusAssist', v)),
    h('div', { class: 'neo-sfield' }, SP.button('Send a test notification', () => Shell10.notify({ app: 'Settings', icon: 'settings10', title: 'Test notification', text: 'Notifications are working.' }))));
});
page('system/power', 'Power & sleep', 'screen saver sleep timeout power', el => {
  el.append(SP.h1('Power & sleep'), SP.h2('Screen'),
    SP.combo('When plugged in, turn off after', [['0', 'Never'], ['1', '1 minute'], ['2', '2 minutes'], ['5', '5 minutes'], ['10', '10 minutes'], ['15', '15 minutes'], ['30', '30 minutes']],
      () => String(Store.get('screenOff', 0)), v => { Store.set('screenOff', +v); Saver.reset(); }),
    SP.h2('Screen saver'),
    SP.combo('Screen saver', Saver.list, () => Store.get('saver', '(None)'), v => { Store.set('saver', v); Settings.changed(); }),
    SP.combo('Wait', ['1', '2', '3', '5', '10', '15', '30'].map(m => [m, m + ' minutes']), () => String(Store.get('saverDelay', 2)), v => { Store.set('saverDelay', +v); Settings.changed(); }),
    h('div', { class: 'neo-sfield' }, SP.button('Preview', () => { const s = Store.get('saver', '(None)'); if (s !== '(None)') Saver.start(s, null, true); })),
    SP.link('Screen saver settings', () => Sys.launch('CONTROL.EXE desktop')));
});
page('system/storage', 'Storage', 'disk space free recycle temporary files', el => {
  const used = FS.used(), total = FS.totalBytes;
  const size = p => FS.size(FS.get(p) || { t: 'd', c: {} });
  const mb = b => (b / 1048576).toFixed(1) + ' MB';
  const bar = (frac, color = 'var(--highlight)') => h('div', { class: 'neo-usage sunken', style: { width: '320px' } }, h('div', { style: { width: Math.round(frac * 100) + '%', background: color } }));
  const temp = 'C:\\WINDOWS\\TEMP';
  el.append(SP.h1('Storage'), SP.h2('Local Disk (C:)'), bar(used / total), SP.p(`${mb(used)} used out of ${mb(total)}`),
    SP.info([['Windows', mb(size('C:\\WINDOWS'))], ['MS-DOS', mb(size('C:\\DOS'))], ['Users', mb(size('C:\\USERS'))], ['Recycle Bin', mb(size(KNOWN.recycle))], ['Temporary files', mb(size(temp))], ['System & reserved', mb(FS.baseUsed)]]),
    h('div', { class: 'neo-sfield neo-btnrow' },
      SP.button('Empty Recycle Bin', async () => { await FileOps.emptyRecycle(Sys.activeTop()); Sys.run('settings10', { args: 'system/storage' }); }),
      SP.button('Remove temporary files', () => { for (const e of FS.list(temp) || []) FS.remove(FS.join(temp, e.name)); Sys.run('settings10', { args: 'system/storage' }); })));
});
page('system/multitasking', 'Multitasking', 'snap windows virtual desktops', el => {
  el.append(SP.h1('Multitasking'),
    SP.toggle('Snap windows', () => Store.get('snap', true), v => Store.set('snap', v), 'Drag windows to the sides or corners of the screen to arrange them.'),
    SP.h2('Virtual desktops'),
    SP.combo('On the taskbar, show windows that are open on', [['cur', 'Only the desktop I\'m using'], ['all', 'All desktops']], () => Store.get('vd.all', false) ? 'all' : 'cur', v => { Store.set('vd.all', v === 'all'); Shell10.renderTaskbar(); }));
});
page('system/shell', 'Shell', 'windows 3.1 program manager classic shell neo10', el => {
  el.append(SP.h1('Shell'), SP.p('Choose which Windows experience starts when you sign in. Your files, settings and programs are shared by both.'),
    SP.radios('Start Windows with', [['neo10', 'Neo10 (Windows 10 experience)'], ['win31', 'Windows 3.1 Program Manager (classic)']], () => Store.get('shell', 'neo10'), async v => {
      if (v === Store.get('shell', 'neo10')) return;
      const r = await msgBox('You need to restart your PC to switch shells.\n\nRestart now?', 'Settings', { buttons: 'yesno', icon: 'question' });
      if (r === 'yes') { Store.set('shell', v); Shell10.shutdown(true); }
    }));
});
page('system/about', 'About', 'pc name specifications version processor ram', el => {
  const spec = [['Device name', Store.get('deviceName', 'NEO31-PC')], ['Processor', 'Intel 80486DX2 @ 66 MHz'], ['Installed RAM', '8.00 MB'], ['Device ID', '1A2B3C4D-0310-1992-0031-NEO31NEO10'], ['System type', '16-bit operating system, x86-based processor'], ['Pen and touch', 'No pen or touch input is available for this display']];
  const win = [['Edition', 'Neo10 Home'], ['Version', '22H2'], ['Installed on', Intl31.date(new Date(WIN_DATE))], ['OS build', '19045.3803 (on Windows 3.1)'], ['Experience', 'Windows 3.1 Feature Experience Pack 1992.3.10']];
  el.append(SP.h1('About'), h('div', { class: 'neo-sfield' }, iconImg('neologo'), SP.p('Your PC is monitored and protected.')),
    SP.h2('Device specifications'), SP.info(spec),
    h('div', { class: 'neo-sfield neo-btnrow' },
      SP.button('Copy', () => Sys.setClipboard({ type: 'text', data: spec.concat(win).map(r => r.join('\t')).join('\n') })),
      SP.button('Rename this PC', async () => {
        const v = await new Promise(res => dialog({ title: 'Rename your PC', w: 280, h: 70, build(d) { const t = UI.text(Store.get('deviceName', 'NEO31-PC'), { maxLength: 15 }); d.add(UI.label('&Name:', t), 10, 8); d.add(t, 10, 26, 180); d.add(UI.button('Next', { default: true, onClick: () => d.close(t.value.trim()) }), 200, 6, 70, 25); d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close(null) }), 200, 36, 70, 25); } }).promise.then(res));
        if (v) { Store.set('deviceName', v.toUpperCase()); Sys.run('settings10', { args: 'system/about' }); }
      })),
    SP.h2('Windows specifications'), SP.info(win), SP.p('Copyright © 1985-1992 Microsoft Corp. Neo10 is a fan re-creation running inside a simulated Windows 3.1 PC.'));
});

/* ======================= DEVICES ======================= */
page('devices/printers', 'Printers & scanners', 'printer print manager port', el => {
  el.append(SP.h1('Printers & scanners'), h('div', { class: 'neo-sfield' }, h('div', { class: 'neo-srow' }, iconImg('printman'), h('div', {}, h('div', { class: 'neo-slabel', text: 'Generic / Text Only' }), SP.p(`Default · ${Store.get('printPort', 'LPT1')}:`)))),
    SP.combo('Port', ['LPT1', 'LPT2', 'LPT3', 'COM1', 'COM2', 'FILE'].map(p => [p, p + ':' + (p === 'FILE' ? ' (print to file)' : '')]), () => Store.get('printPort', 'LPT1'), v => { Store.set('printPort', v); IniSync.write(); }),
    SP.toggle('Use Print Manager', () => Store.get('usePrintMan', true), v => Store.set('usePrintMan', v)),
    h('div', { class: 'neo-sfield neo-btnrow' }, SP.button('Print a test page', () => printDoc('Settings', 'Test Page', 'Neo10 test page\n\nIf you can read this, printing works.')), SP.button('Open queue', () => Sys.launch('PRINTMAN.EXE'))));
});
page('devices/mouse', 'Mouse', 'primary button double click speed pointer trails cursor', el => {
  el.append(SP.h1('Mouse'),
    SP.combo('Select your primary button', [['left', 'Left'], ['right', 'Right']], () => Store.get('swapButtons', false) ? 'right' : 'left', v => { Store.set('swapButtons', v === 'right'); Settings.changed(); }),
    SP.slider('Cursor speed', 1, 10, () => Store.get('mouseSpeed', 5), v => Store.set('mouseSpeed', v), 1),
    SP.slider('Double-click speed', 100, 900, () => 1000 - Store.get('dblClick', 452), v => Store.set('dblClick', 1000 - v)),
    SP.toggle('Display pointer trails', () => Store.get('trails', false), v => { Store.set('trails', v); Settings.changed(); }),
    SP.combo('Pointer size', [['1', 'Normal'], ['2', 'Large (2 ×)'], ['3', 'Extra large (3 ×)']], () => String(Store.get('cursorScale', 1)), v => { Store.set('cursorScale', +v); installCursors(); }),
    SP.link('Additional mouse options', () => Sys.launch('CONTROL.EXE mouse')));
});
page('devices/typing', 'Typing', 'keyboard repeat delay rate', el => {
  const t = UI.text(''); t.style.position = 'relative'; t.style.width = '260px';
  el.append(SP.h1('Typing'), SP.h2('Keyboard'),
    SP.slider('Repeat delay', 0, 3, () => Store.get('kbDelay', 2), v => { Store.set('kbDelay', v); IniSync.write(); }, 1),
    SP.slider('Repeat rate', 0, 31, () => Store.get('kbSpeed', 31), v => { Store.set('kbSpeed', v); IniSync.write(); }, 1),
    h('div', { class: 'neo-sfield' }, h('div', { class: 'neo-slabel', text: 'Click here and hold down a key to test the repeat rate' }), t));
});

/* ======================= NETWORK ======================= */
page('network/status', 'Status', 'network internet airplane ip connected', el => {
  const air = Store.get('airplane', false);
  el.append(SP.h1('Status'), h('div', { class: 'neo-sfield neo-srow' }, iconImg('cpNetwork'), SP.p(air ? 'Airplane mode is on.' : 'You\'re connected to the Internet. (Neo31 Network)')),
    SP.toggle('Airplane mode', () => Store.get('airplane', false), v => { Store.set('airplane', v); Shell10.renderTaskbar(); }),
    SP.h2('Properties'), SP.info([['Name', 'Neo31 Network'], ['Type', 'Ethernet (10BASE-T)'], ['IPv4 address', '192.168.31.10'], ['Physical address', '00-03-10-19-92-31'], ['Speed', '10 Mbps']]),
    SP.link('Open Terminal (dial-up)', () => Sys.launch('TERMINAL.EXE')));
});

/* ======================= PERSONALIZATION ======================= */
page('personalization/background', 'Background', 'wallpaper picture desktop pattern solid color fit', el => {
  const mode = () => Store.get('wallpaper', '(None)') !== '(None)' ? 'picture' : Store.get('pattern', '(None)') !== '(None)' ? 'pattern' : 'solid';
  const preview = h('div', { class: 'neo-preview sunken' });
  const paintPrev = () => {
    preview.style.background = getComputedStyle(document.documentElement).getPropertyValue('--desktop');
    preview.style.backgroundImage = Sys.deskEl.style.backgroundImage;
    const wpu = Sys.wallEl.style.backgroundImage;
    preview.innerHTML = ''; if (wpu && wpu !== 'none') preview.appendChild(h('div', { class: 'fill', style: { backgroundImage: wpu, backgroundRepeat: Sys.wallEl.style.backgroundRepeat || (Store.get('wallFit', 'tile') === 'tile' ? 'repeat' : 'no-repeat'), backgroundPosition: Sys.wallEl.style.backgroundPosition || (Store.get('wallFit', 'tile') === 'tile' ? 'left top' : 'center'), backgroundColor: Sys.wallEl.style.backgroundColor, imageRendering: 'pixelated' } }));
  };
  const body = h('div');
  const draw = () => {
    body.innerHTML = '';
    const m = mode();
    body.appendChild(SP.combo('Background', [['picture', 'Picture'], ['solid', 'Solid color'], ['pattern', 'Pattern']], () => m, v => {
      if (v === 'picture') { Store.set('wallpaper', 'NEO10.BMP'); Store.set('pattern', '(None)'); }
      if (v === 'solid') { Store.set('wallpaper', '(None)'); Store.set('pattern', '(None)'); }
      if (v === 'pattern') { Store.set('wallpaper', '(None)'); Store.set('pattern', 'Boxes'); }
      Settings.changed(); draw();
    }));
    if (m === 'picture') {
      const pics = [...(FS.list('C:\\WINDOWS') || []).filter(e => FS.ext(e.name) === 'BMP').map(e => 'C:\\WINDOWS\\' + e.name), ...(FS.list(KNOWN.pictures) || []).filter(e => FS.ext(e.name) === 'BMP').map(e => FS.join(KNOWN.pictures, e.name))];
      const grid = h('div', { class: 'neo-picgrid' });
      for (const p of pics) {
        const url = Wallpapers.urlFor(p);
        const cur = Store.get('wallpaper') === p.replace(/^C:\\WINDOWS\\/, '') || Store.get('wallpaper') === p;
        const t = h('div', { class: 'neo-pic' + (cur ? ' on' : ''), title: FileOps.shownName(FS.basename(p), FS.get(p)), style: { backgroundImage: url ? `url(${url})` : '' } });
        t.addEventListener('pointerup', () => { Store.set('wallpaper', p.startsWith('C:\\WINDOWS\\') && FS.dirname(p) === 'C:\\WINDOWS' ? FS.basename(p) : p); Settings.changed(); draw(); });
        grid.appendChild(t);
      }
      body.append(h('div', { class: 'neo-slabel', text: 'Choose your picture' }), grid,
        h('div', { class: 'neo-sfield' }, SP.button('Browse', async () => { const p = await fileDialog({ filters: [['Bitmap Files (*.BMP)', '*.BMP']] }); if (p) { Store.set('wallpaper', p); Settings.changed(); draw(); } })),
        SP.combo('Choose a fit', [['tile', 'Tile'], ['center', 'Center']], () => Store.get('wallFit', 'tile'), v => { Store.set('wallFit', v); Store.set('wallTile', v === 'tile'); Settings.changed(); paintPrev(); }));
    } else if (m === 'solid') {
      body.append(h('div', { class: 'neo-slabel', text: 'Choose your background color' }), SP.swatches(PALETTE16, () => Sys.currentColors().desktop, c => { setOverride('desktop', c); paintPrev(); }));
    } else {
      body.appendChild(SP.combo('Pattern', Object.keys(Sys.patterns).filter(p => p !== '(None)').concat(Object.keys(Store.get('customPatterns', {}))), () => Store.get('pattern', 'Boxes'), v => { Store.set('pattern', v); Settings.changed(); paintPrev(); }));
      body.appendChild(SP.link('Edit patterns (classic)', () => Sys.launch('CONTROL.EXE desktop')));
    }
    setTimeout(paintPrev, 30);
  };
  el.append(SP.h1('Background'), preview, body);
  draw();
});
page('personalization/colors', 'Colors', 'accent dark mode light mode theme color', el => {
  const dark = () => Store.get('scheme', 'Windows Default') === 'Neo10 Dark';
  el.append(SP.h1('Colors'),
    SP.combo('Choose your color', [['light', 'Light'], ['dark', 'Dark']], () => dark() ? 'dark' : 'light', v => { Store.set('scheme', v === 'dark' ? 'Neo10 Dark' : 'Windows Default'); const o = { ...Store.get('colorsOverride', {}) }; delete o.desktop; Store.set('colorsOverride', o); Settings.changed(); }),
    h('div', { class: 'neo-slabel', text: 'Choose your accent color' }),
    SP.swatches(['#000080', '#0000ff', '#008080', '#008000', '#808000', '#800000', '#ff0000', '#800080', '#ff00ff', '#808080', '#000000'], () => Sys.currentColors()['active-title'], c => {
      const o = { ...Store.get('colorsOverride', {}), 'active-title': c, highlight: c };
      const lum = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)).reduce((a, v, i) => a + v * [.299, .587, .114][i], 0);
      o['active-title-text'] = o['highlight-text'] = lum < 140 ? '#ffffff' : '#000000';
      Store.set('colorsOverride', o); Settings.changed();
    }),
    SP.toggle('Show accent color on the taskbar', () => Store.get('tb.accent', false), v => { Store.set('tb.accent', v); Shell10.applyTaskbarSettings(); }),
    SP.link('Classic Color settings', () => Sys.launch('CONTROL.EXE color')));
});
page('personalization/lockscreen', 'Lock screen', 'lock screen picture screen saver', el => {
  const grid = h('div', { class: 'neo-picgrid' });
  const draw = () => {
    grid.innerHTML = '';
    for (const e of (FS.list('C:\\WINDOWS') || []).filter(e => FS.ext(e.name) === 'BMP')) {
      const url = Wallpapers.urlFor('C:\\WINDOWS\\' + e.name);
      const t = h('div', { class: 'neo-pic' + (Store.get('lockImage', 'LOCK10.BMP') === e.name ? ' on' : ''), style: { backgroundImage: url ? `url(${url})` : '' } });
      t.addEventListener('pointerup', () => { Store.set('lockImage', e.name); draw(); });
      grid.appendChild(t);
    }
  };
  draw();
  el.append(SP.h1('Lock screen'), h('div', { class: 'neo-slabel', text: 'Choose your picture' }), grid,
    h('div', { class: 'neo-sfield neo-btnrow' }, SP.button('Preview (lock now)', () => Shell10.lock())),
    SP.link('Screen timeout settings', () => Sys.run('settings10', { args: 'system/power' })), SP.link('Screen saver settings', () => Sys.launch('CONTROL.EXE desktop')));
});
page('personalization/themes', 'Themes', 'theme scheme hotdog stand colors', el => {
  const grid = h('div', { class: 'neo-themes' });
  const names = [...Object.keys(Sys.schemes), ...Object.keys(Store.get('customSchemes', {}))];
  for (const n of names) {
    const c = Object.assign({}, Sys.schemes['Windows Default'], Sys.schemes[n] || Store.get('customSchemes', {})[n]);
    const t = h('div', { class: 'neo-theme raised' + (Store.get('scheme', 'Windows Default') === n ? ' on' : '') },
      h('div', { class: 'neo-thprev', style: { background: c.desktop } }, h('div', { style: { background: c.window, border: '1px solid #000' } }, h('div', { style: { background: c['active-title'], height: '6px' } }))), h('span', { text: n }));
    t.addEventListener('pointerup', () => { Store.set('scheme', n); Store.set('colorsOverride', {}); Settings.changed(); [...grid.children].forEach(x => x.classList.toggle('on', x === t)); });
    grid.appendChild(t);
  }
  el.append(SP.h1('Themes'), SP.p('Every colour scheme from Windows 3.1 is a theme here.'), grid);
});
page('personalization/start', 'Start', 'start menu tiles recently used', el => {
  el.append(SP.h1('Start'),
    SP.toggle('Show live tiles on Start', () => Store.get('start.showTiles', true), v => Store.set('start.showTiles', v)),
    SP.toggle('Show recently used apps', () => Store.get('start.showRecent', true), v => Store.set('start.showRecent', v)),
    h('div', { class: 'neo-sfield' }, SP.button('Reset tiles', () => Store.set('start.tiles', null))));
});
page('personalization/taskbar', 'Taskbar', 'taskbar auto hide search task view labels clock seconds', el => {
  const ch = () => { Settings.changed(); Shell10.applyTaskbarSettings(); Shell10.renderTaskbar(); };
  el.append(SP.h1('Taskbar'),
    SP.toggle('Automatically hide the taskbar', () => Store.get('tb.autohide', false), v => { Store.set('tb.autohide', v); ch(); }),
    SP.combo('Combine taskbar buttons', [['always', 'Always, hide labels'], ['never', 'Never']], () => Store.get('tb.labels', false) ? 'never' : 'always', v => { Store.set('tb.labels', v === 'never'); ch(); }),
    SP.combo('Search', [['box', 'Show search box'], ['icon', 'Show search icon'], ['hidden', 'Hidden']], () => Store.get('tb.search', 'box'), v => { Store.set('tb.search', v); ch(); }),
    SP.toggle('Show Task View button', () => Store.get('tb.taskview', true), v => { Store.set('tb.taskview', v); ch(); }),
    SP.toggle('Show seconds in the clock', () => Store.get('tb.seconds', false), v => { Store.set('tb.seconds', v); Shell10.tickClock(); }));
});

/* ======================= APPS ======================= */
page('apps/features', 'Apps & features', 'uninstall installed programs size', el => {
  el.append(SP.h1('Apps & features'));
  const list = h('div', { class: 'neo-applist2' });
  for (const a of NEO_APPS.slice().sort((x, y) => x.name.localeCompare(y.name))) {
    const f = FS.which(Sys.splitCmd(a.cmd)[0]); const n = f && FS.get(f);
    const r = h('div', { class: 'neo-approw' }, iconImg(a.icon), h('div', { style: { flex: 1 } }, h('div', { class: 'neo-slabel', text: a.name }), h('div', { class: 'neo-kind', text: 'Microsoft Corporation' })), h('div', { text: n ? (FS.size(n) / 1024).toFixed(0) + ' KB' : 'System' }));
    r.addEventListener('pointerup', () => msgBox(`${a.name} is part of Windows and can't be uninstalled.`, 'Apps & features', { icon: 'info' }));
    list.appendChild(r);
  }
  el.appendChild(list);
});
page('apps/defaults', 'Default apps', 'default app file association open with extension', el => {
  el.append(SP.h1('Default apps'), SP.p('Choose which app opens each type of file. (Stored in the [Extensions] section of WIN.INI.)'));
  const apps = Object.entries(FS.get('C:\\WINDOWS').c).filter(([, n]) => n.a && n.a !== 'win').map(([k, n]) => [k.toLowerCase(), `${(Sys.apps[n.a] || {}).name || k} (${k.toLowerCase()})`]);
  for (const ext of ['txt', 'ini', 'log', 'bat', 'wri', 'bmp', 'wav', 'mid', 'crd', 'cal', 'trm', 'hlp', 'htm', 'html']) {
    const cur = (readIni('C:\\WINDOWS\\WIN.INI', 'Extensions')[ext] || '').split(/\s+/)[0].toLowerCase();
    el.appendChild(SP.combo('.' + ext + ' — ' + FileOps.typeName('X.' + ext, { t: 'f' }), [['', '(None)'], ...apps], () => cur, v => writeIni('C:\\WINDOWS\\WIN.INI', 'Extensions', ext, v ? `${v} ^.${ext}` : null)));
  }
});
page('apps/startup', 'Startup', 'startup apps run at sign in', el => {
  el.append(SP.h1('Startup'), SP.p('Apps can be set to start when you sign in. (Shared with Program Manager\'s StartUp group.)'));
  const cands = NEO_APPS.filter(a => /\.EXE$/i.test(a.cmd));
  const groups = () => Store.get('pm.groups') || PM.defaults();
  const startup = () => (groups().find(g => g.name.toLowerCase() === 'startup') || { items: [] }).items;
  for (const a of cands) {
    el.appendChild(SP.toggle(a.name, () => startup().some(i => i.cmd.toUpperCase() === a.cmd.toUpperCase()), on => {
      const gs = JSON.parse(JSON.stringify(groups()));
      let su = gs.find(g => g.name.toLowerCase() === 'startup');
      if (!su) { su = { name: 'StartUp', state: 'min', items: [] }; gs.push(su); }
      su.items = su.items.filter(i => i.cmd.toUpperCase() !== a.cmd.toUpperCase());
      if (on) su.items.push({ name: a.name, cmd: a.cmd, icon: a.icon });
      Store.set('pm.groups', gs);
    }));
  }
});

/* ======================= ACCOUNTS ======================= */
page('accounts/info', 'Your info', 'name account user organisation', el => {
  const nm = UI.text(Store.get('userName', 'User')), org = UI.text(Store.get('userOrg', 'Neo31 Simulation'));
  [nm, org].forEach(t => { t.style.position = 'relative'; t.style.width = '260px'; });
  const av = iconImg('user'); av.style.width = av.style.height = '96px';
  el.append(SP.h1('Your info'), h('div', { class: 'neo-sfield' }, av), SP.p('Local account'),
    h('div', { class: 'neo-sfield' }, h('div', { class: 'neo-slabel', text: 'Name' }), nm), h('div', { class: 'neo-sfield' }, h('div', { class: 'neo-slabel', text: 'Organization' }), org),
    h('div', { class: 'neo-sfield' }, SP.button('Save', () => { Store.set('userName', nm.value.trim() || 'User'); Store.set('userOrg', org.value.trim()); Shell10.notify({ app: 'Settings', icon: 'user', title: 'Account updated', text: 'Your name will appear on the sign-in screen.' }); })));
});
page('accounts/signin', 'Sign-in options', 'password lock sign in require', el => {
  const has = !!Store.get('acctPassword', '');
  el.append(SP.h1('Sign-in options'), SP.h2('Password'), SP.p(has ? 'Your account has a password.' : 'Your account doesn\'t have a password. You must add a password before you can use the other sign-in options.'),
    h('div', { class: 'neo-sfield neo-btnrow' },
      SP.button(has ? 'Change' : 'Add', () => dialog({ title: has ? 'Change your password' : 'Create a password', w: 300, h: has ? 120 : 92, build(d) {
        const o = UI.text('', { password: true }), n = UI.text('', { password: true }), r = UI.text('', { password: true });
        let y = 10;
        if (has) { d.add(UI.label('&Current password', o), 10, y + 4); d.add(o, 140, y, 150); y += 28; }
        d.add(UI.label('&New password', n), 10, y + 4); d.add(n, 140, y, 150); y += 28;
        d.add(UI.label('&Reenter password', r), 10, y + 4); d.add(r, 140, y, 150); y += 32;
        d.add(UI.button('OK', { default: true, onClick: async () => {
          if (has && o.value !== Store.get('acctPassword', '')) { await msgBox('The current password is incorrect.', 'Password', { icon: 'stop', owner: d.win }); return; }
          if (n.value !== r.value) { await msgBox('The passwords don\'t match.', 'Password', { icon: 'stop', owner: d.win }); return; }
          Store.set('acctPassword', n.value); d.close(); Sys.run('settings10', { args: 'accounts/signin' });
        } }), 130, y, 76, 25);
        d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 214, y, 76, 25);
      } })),
      has ? SP.button('Remove', async () => { if (await msgBox('Remove your password? Anyone will be able to sign in.', 'Password', { buttons: 'yesno', icon: 'question' }) === 'yes') { Store.set('acctPassword', ''); Sys.run('settings10', { args: 'accounts/signin' }); } }) : null),
    SP.toggle('Require sign-in when the PC wakes up from sleep', () => Store.get('requireSignin', true), v => Store.set('requireSignin', v)),
    h('div', { class: 'neo-sfield' }, SP.button('Lock now', () => Shell10.lock())));
});

/* ======================= TIME & LANGUAGE ======================= */
const ZONES = [[-8, '(UTC-08:00) Pacific Time (US & Canada)'], [-7, '(UTC-07:00) Mountain Time (US & Canada)'], [-6, '(UTC-06:00) Central Time (US & Canada)'], [-5, '(UTC-05:00) Eastern Time (US & Canada)'],
  [0, '(UTC+00:00) Dublin, Edinburgh, Lisbon, London'], [1, '(UTC+01:00) Amsterdam, Berlin, Paris, Rome'], [2, '(UTC+02:00) Athens, Helsinki'], [3, '(UTC+03:00) Moscow'],
  [5.5, '(UTC+05:30) Chennai, Kolkata, Mumbai, New Delhi'], [8, '(UTC+08:00) Beijing, Singapore, Taipei'], [9, '(UTC+09:00) Osaka, Sapporo, Tokyo'], [10, '(UTC+10:00) Canberra, Melbourne, Sydney']];
const hostUTC = () => -new Date().getTimezoneOffset() / 60;
page('time/datetime', 'Date & time', 'date time clock time zone automatically', el => {
  const now = h('div', { class: 'neo-h2' });
  const tick = () => { now.textContent = `${Intl31.time(Sys.now(), true)}  ${Intl31.longDate(Sys.now())}`; };
  tick(); const iv = setInterval(() => { if (!now.isConnected) clearInterval(iv); else tick(); }, 1000);
  const auto = () => Store.get('clockOffset', 0) === 0;
  el.append(SP.h1('Date & time'), now,
    SP.toggle('Set time automatically', auto, v => { if (v) { Store.set('clockOffset', 0); Sys.emit('time'); } else Sys.launch('CONTROL.EXE datetime'); }),
    h('div', { class: 'neo-sfield' }, h('div', { class: 'neo-slabel', text: 'Set the date and time manually' }), SP.button('Change', () => Sys.launch('CONTROL.EXE datetime'))),
    SP.combo('Time zone', [['auto', 'Same as this computer (UTC' + (hostUTC() >= 0 ? '+' : '') + hostUTC() + ')'], ...ZONES.map(([o, n]) => [String(o), n])],
      () => Store.get('tz', 'auto'), v => { Store.set('tz', v); Store.set('tzShift', v === 'auto' ? 0 : +v - hostUTC()); Sys.emit('time'); Shell10.tickClock(); }));
});
page('time/region', 'Region', 'country region format date format language', el => {
  const o = Intl31.get();
  el.append(SP.h1('Region'),
    SP.combo('Country or region', Object.keys(Intl31.COUNTRIES), () => o.country, v => { Store.set('intl', { ...Intl31.COUNTRIES[v], country: v }); Settings.changed(); Sys.emit('time'); Sys.run('settings10', { args: 'time/region' }); }),
    SP.h2('Regional format data'),
    SP.info([['Short date', Intl31.date(Sys.now())], ['Long date', Intl31.longDate(Sys.now())], ['Time', Intl31.time(Sys.now(), true)], ['Numbers', Intl31.number('1234.56')], ['Currency', o.sCurrency + Intl31.number('1.22')]]),
    SP.link('Change data formats', () => Sys.launch('CONTROL.EXE intl')));
});

/* ======================= EASE OF ACCESS ======================= */
page('ease/display', 'Display', 'make everything bigger high contrast scale', el => {
  el.append(SP.h1('Display'),
    SP.combo('Make everything bigger (pixel size)', [['auto', 'Automatic'], ['1', '1 ×'], ['2', '2 ×'], ['3', '3 ×']], () => String(Store.get('pixelScale', 'auto')), v => { Store.set('pixelScale', v); Sys.layoutScreen(); }),
    SP.toggle('High contrast', () => Store.get('scheme', 'Windows Default') === 'High Contrast Black', v => { Store.set('scheme', v ? 'High Contrast Black' : 'Windows Default'); Store.set('colorsOverride', {}); Settings.changed(); }));
});
page('ease/mouse', 'Mouse pointer', 'cursor pointer size large', el => {
  el.append(SP.h1('Mouse pointer'),
    SP.combo('Change pointer size', [['1', 'Normal'], ['2', 'Large (2 ×)'], ['3', 'Extra large (3 ×)']], () => String(Store.get('cursorScale', 1)), v => { Store.set('cursorScale', +v); installCursors(); }),
    SP.toggle('Display pointer trails', () => Store.get('trails', false), v => { Store.set('trails', v); Settings.changed(); }));
});

/* ======================= UPDATE & SECURITY ======================= */
page('update/windowsupdate', 'Windows Update', 'update check updates history', el => {
  const st = h('div', { class: 'neo-sfield neo-srow' }, iconImg('neologo'), h('div', {}, h('div', { class: 'neo-h2', text: 'You\'re up to date' }), SP.p('Last checked: ' + (Store.get('wu.last') ? `${Intl31.date(new Date(Store.get('wu.last')))}, ${Intl31.time(new Date(Store.get('wu.last')))}` : 'never'))));
  const btn = SP.button('Check for updates', async () => {
    btn.disabled = true;
    st.innerHTML = '';
    const sp = Shell10.spinner('#000000');
    const msg = h('div', { class: 'neo-h2', text: 'Checking for updates...' });
    st.append(sp.el, msg);
    await sleep(1800); msg.textContent = 'Downloading definitions for 16-colour displays...';
    await sleep(1600);
    sp.stop();
    Store.set('wu.last', Date.now());
    Shell10.notify({ app: 'Windows Update', icon: 'neologo', title: 'You\'re up to date', text: 'Neo10 22H2 on Windows 3.1 is the latest version.' });
    Sys.run('settings10', { args: 'update/windowsupdate' });
  });
  el.append(SP.h1('Windows Update'), st, h('div', { class: 'neo-sfield' }, btn), SP.h2('Update history'),
    SP.info([['Feature update to Neo10, version 22H2', 'Successfully installed on ' + Intl31.date(new Date(WIN_DATE))], ['Windows 3.1 Feature Experience Pack', 'Successfully installed on ' + Intl31.date(new Date(WIN_DATE))], ['Definition Update for Program Manager', 'Successfully installed on ' + Intl31.date(new Date(DOS_DATE))]]));
});
page('update/recovery', 'Recovery', 'reset this pc factory go back windows 3.1', el => {
  el.append(SP.h1('Recovery'),
    SP.h2('Reset this PC'), SP.p('Restores drive C: and every setting to factory condition. Your files will be removed.'),
    h('div', { class: 'neo-sfield' }, SP.button('Get started', async () => {
      if (await msgBox('Reset this PC?\n\nThis removes all files you created and returns every setting to its factory default.', 'Reset this PC', { buttons: 'okcancel', icon: 'exclaim' }) !== 'ok') return;
      Store.wipe(); location.hash = ''; location.reload();
    })),
    SP.h2('Go back to Windows 3.1'), SP.p('Restart into the classic Program Manager shell. You can come back from Windows Setup or by choosing Neo10 under Settings > System > Shell.'),
    h('div', { class: 'neo-sfield' }, SP.button('Get started', async () => {
      if (await msgBox('Restart into Windows 3.1?', 'Recovery', { buttons: 'yesno', icon: 'question' }) === 'yes') { Store.set('shell', 'win31'); Shell10.shutdown(true); }
    })));
});

/* ======================= THE APP ======================= */
Sys.registerApp('settings10', {
  name: 'Settings', icon: 'settings10', single: true,
  reopen(w, opts) { if (opts.args) w.go(opts.args.trim()); },
  run(opts) {
    const side = h('div', { class: 'neo-sside' });
    const content = h('div', { class: 'neo-scontent' });
    let current = null;
    const w = new Win({ title: 'Settings', icon: 'settings10', w: Math.min(760, Sys.desktop.W - 30), h: Math.min(520, Sys.desktop.H - 30), persist: 'settings10' });
    w.body.classList.add('neo-settings');
    w.body.append(side, content);

    const home = () => {
      current = null; side.style.display = 'none';
      w.setTitle('Settings');
      content.innerHTML = '';
      const find = UI.text(''); find.placeholder = 'Find a setting'; find.classList.add('neo-find');
      const res = h('div', { class: 'neo-findres' });
      find.addEventListener('input', () => {
        res.innerHTML = '';
        const q = find.value.trim().toLowerCase(); if (!q) return;
        SETTINGS_PAGES.filter(p => (p.title + ' ' + p.keywords).toLowerCase().includes(q)).slice(0, 8).forEach(p => {
          const r = h('div', { class: 'neo-appitem' }, iconImg('s_gear', 16), h('span', { text: `${p.title}  (${SETTINGS_CATS.find(c => c.id === p.cat).name})` }));
          r.addEventListener('pointerup', () => go(p.id)); res.appendChild(r);
        });
      });
      find.addEventListener('keydown', e => { if (e.key === 'Enter') { const f = res.querySelector('.neo-appitem'); f && f.dispatchEvent(new PointerEvent('pointerup')); } });
      const grid = h('div', { class: 'neo-catgrid' });
      for (const c of SETTINGS_CATS) {
        const t = h('div', { class: 'neo-cat' }, iconImg(c.icon), h('div', {}, h('div', { class: 'neo-slabel', text: c.name }), h('div', { class: 'neo-kind', text: c.desc })));
        t.addEventListener('pointerup', () => go(SETTINGS_PAGES.find(p => p.cat === c.id).id));
        grid.appendChild(t);
      }
      content.append(h('div', { class: 'neo-h1', style: { textAlign: 'center' }, text: 'Windows Settings' }), h('div', { class: 'neo-findwrap' }, find, res), grid);
      setTimeout(() => find.focus(), 0);
    };
    const go = id => {
      const p = SETTINGS_PAGES.find(x => x.id === id) || SETTINGS_PAGES.find(x => x.cat === id);
      if (!p) return home();
      current = p.id;
      side.style.display = '';
      side.innerHTML = '';
      const hm = h('div', { class: 'neo-appitem neo-home' }, iconImg('s_gear', 16), h('span', { text: 'Home' }));
      hm.addEventListener('pointerup', home);
      side.append(hm, h('div', { class: 'neo-applabel', text: SETTINGS_CATS.find(c => c.id === p.cat).name }));
      for (const q of SETTINGS_PAGES.filter(x => x.cat === p.cat)) {
        const r = h('div', { class: 'neo-appitem' + (q.id === p.id ? ' cur' : ''), text: q.title });
        r.addEventListener('pointerup', () => go(q.id));
        side.appendChild(r);
      }
      content.innerHTML = '';
      content.scrollTop = 0;
      w.setTitle('Settings');
      p.render(content);
    };
    w.go = go;
    if (opts.args) go(opts.args.trim()); else home();
    return w;
  }
});
