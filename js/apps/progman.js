'use strict';
/* Program Manager: MDI frame with program groups and program items. */

const PM = {
  defaults() {
    const I = (name, cmd, icon, extra = {}) => ({ name, cmd, icon, ...extra });
    return [
      { name: 'Main', state: 'normal', rect: null, items: [
        I('File Manager', 'WINFILE.EXE', 'winfile'), I('Control Panel', 'CONTROL.EXE', 'control'),
        I('Print Manager', 'PRINTMAN.EXE', 'printman'), I('Clipboard Viewer', 'CLIPBRD.EXE', 'clipbrd'),
        I('MS-DOS Prompt', 'DOSPRMPT.PIF', 'dos'), I('Windows Setup', 'SETUP.EXE', 'setup'),
        I('Read Me', 'WRITE.EXE C:\\WINDOWS\\README.WRI', 'wri')] },
      { name: 'Accessories', state: 'min', items: [
        I('Write', 'WRITE.EXE', 'write'), I('Paintbrush', 'PBRUSH.EXE', 'pbrush'), I('Terminal', 'TERMINAL.EXE', 'terminal'),
        I('Notepad', 'NOTEPAD.EXE', 'notepad'), I('Cardfile', 'CARDFILE.EXE', 'cardfile'), I('Calendar', 'CALENDAR.EXE', 'calendar'),
        I('Calculator', 'CALC.EXE', 'calc'), I('Clock', 'CLOCK.EXE', 'clock'), I('Character Map', 'CHARMAP.EXE', 'charmap'),
        I('Media Player', 'MPLAYER.EXE', 'mplayer'), I('Sound Recorder', 'SOUNDREC.EXE', 'soundrec')] },
      { name: 'Games', state: 'min', items: [I('Solitaire', 'SOL.EXE', 'sol'), I('Minesweeper', 'WINMINE.EXE', 'winmine')] },
      { name: 'StartUp', state: 'min', items: [] }
    ];
  },
  load() { const g = Store.get('pm.groups'); return g ? JSON.parse(JSON.stringify(g)) : this.defaults(); },
  iconFor(cmd) {
    const [tok] = Sys.splitCmd(cmd);
    const f = FS.which(tok);
    const n = f && FS.get(f);
    if (n && n.a) return Sys.apps[n.a]?.icon || 'app';
    if (f && Sys.association(f)) {
      const ex = FS.which(Sys.association(f));
      const en = ex && FS.get(ex);
      if (en && en.a) return { WRI: 'wri', BMP: 'bmp', WAV: 'wav' }[FS.ext(f)] || Sys.apps[en.a]?.icon || 'doc';
    }
    return 'app';
  },
  allIcons: ['app', 'progman', 'winfile', 'control', 'printman', 'clipbrd', 'dos', 'setup', 'notepad', 'write', 'pbrush', 'calc', 'clock',
    'calendar', 'cardfile', 'charmap', 'terminal', 'soundrec', 'mplayer', 'sol', 'winmine', 'help', 'taskman', 'pifedit', 'doc', 'wri',
    'bmp', 'wav', 'floppy', 'group', 'cpColor', 'cpFonts', 'cpPorts', 'cpMouse', 'cpDesktop', 'cpKeyboard', 'cpPrinters', 'cpIntl',
    'cpDateTime', 'cp386', 'cpDrivers', 'cpSound', 'cpNetwork', 'mbStop', 'mbInfo', 'mbQuestion', 'mbExclaim', 'winlogo']
};

Sys.registerApp('progman', {
  name: 'Program Manager', icon: 'progman', single: true, help: 'progman',
  run() {
    let groups = PM.load();
    const opt = Object.assign({ autoArrange: true, minOnUse: false }, Store.get('pm.opts', {}));
    const W = Sys.desktop.W, H = Sys.desktop.H;
    const rect = Store.get('pm.rect') || { x: Math.round(W * 0.06), y: Math.round(H * 0.04), w: Math.round(W * 0.76), h: Math.round(H * 0.72) };
    const gwins = [];
    let pm;

    const saveStructure = () => Store.set('pm.groups', groups.map(g => ({ name: g.name, state: g.state, rect: g.rect, iconPos: g.iconPos, items: g.items })));
    const saveLayout = () => {
      for (const g of groups) {
        const gw = g.win;
        if (!gw) continue;
        g.state = gw.isMin ? 'min' : gw.isMax ? 'max' : 'normal';
        g.rect = gw.isMax || gw.isMin ? gw.normalRect || g.rect : { x: gw.x, y: gw.y, w: gw.w, h: gw.h };
        g.iconPos = gw.iconPos || null;
      }
      Store.set('pm.rect', pm.isMax || pm.isMin ? pm.normalRect || rect : { x: pm.x, y: pm.y, w: pm.w, h: pm.h });
      Store.set('pm.state', pm.isMax ? 'max' : 'normal');
      saveStructure();
    };

    const activeGroup = () => { const a = pm.mdiClient.active; return a && a.group; };
    const selItem = () => { const g = activeGroup(); if (!g || g.win.isMin) return null; return g.items[g.sel] || null; };

    const launchItem = (it) => {
      if (!it) return;
      const w = Sys.launch(it.cmd, { cwd: it.dir || 'C:\\WINDOWS', show: it.runMin ? 'min' : undefined, owner: pm });
      if (w && opt.minOnUse) pm.minimize();
    };

    /* ---------- group windows ---------- */
    const layoutGroup = g => {
      const body = g.win.body;
      const sp = Store.get('iconSpacing', 75);
      const cols = Math.max(1, Math.floor((body.clientWidth - 4) / sp));
      g.items.forEach((it, i) => {
        if (opt.autoArrange || !it.pos) it.pos = { x: 2 + (i % cols) * sp, y: 4 + Math.floor(i / cols) * 66 };
        const el = g.els[i];
        el.style.left = it.pos.x + 'px'; el.style.top = it.pos.y + 'px';
      });
    };
    const arrangeGroup = g => { g.items.forEach(it => it.pos = null); layoutGroup(g); };

    const renderGroup = g => {
      const body = g.win.body;
      body.querySelectorAll('.icon').forEach(n => n.remove());
      g.els = g.items.map((it, i) => {
        const el = h('div', { class: 'icon' + (i === g.sel ? ' sel' : '') }, h('div', { class: 'img' }, iconImg(it.icon || PM.iconFor(it.cmd))), h('div', { class: 'lbl', text: it.name }));
        el.addEventListener('pointerdown', e => itemDown(e, g, i));
        el.addEventListener('dblclick', () => launchItem(g.items[i]));
        body.appendChild(el);
        return el;
      });
      if (g.sel >= g.items.length) g.sel = g.items.length - 1;
      layoutGroup(g);
    };
    const select = (g, i) => {
      g.sel = i;
      g.els.forEach((el, j) => el.classList.toggle('sel', j === i));
      const el = g.els[i];
      if (el) {
        const b = g.win.body;
        if (el.offsetTop < b.scrollTop) b.scrollTop = el.offsetTop;
        else if (el.offsetTop + el.offsetHeight > b.scrollTop + b.clientHeight) b.scrollTop = el.offsetTop + el.offsetHeight - b.clientHeight;
      }
    };

    const itemDown = (e, g, i) => {
      if (e.button !== 0) return;
      e.preventDefault();
      g.win.activate();
      select(g, i);
      const el = g.els[i];
      const sx = e.clientX, sy = e.clientY;
      let ghost = null;
      el.setPointerCapture(e.pointerId);
      const mv = ev => {
        const dx = (ev.clientX - sx) / Sys.scale, dy = (ev.clientY - sy) / Sys.scale;
        if (!ghost && Math.abs(dx) + Math.abs(dy) < 5) return;
        if (!ghost) {
          ghost = h('div', { style: { position: 'absolute', zIndex: 99990, pointerEvents: 'none', opacity: .8 } }, iconImg(g.items[i].icon || PM.iconFor(g.items[i].cmd)));
          Sys.screen.appendChild(ghost);
        }
        const p = Sys.pointer(ev);
        ghost.style.left = (p.x - 16) + 'px'; ghost.style.top = (p.y - 16) + 'px';
      };
      const up = ev => {
        el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up);
        if (!ghost) return;
        ghost.remove();
        // find drop target group
        const hit = document.elementsFromPoint(ev.clientX, ev.clientY);
        const tg = groups.find(gg => gg.win && (hit.includes(gg.win.body) || (gg.win.iconEl && hit.includes(gg.win.iconEl))));
        if (!tg) { if (!hit.includes(pm.el)) Snd.beep(); return; }
        if (tg === g) {
          if (!opt.autoArrange) {
            const p = Sys.pointer(ev, g.win.body);
            g.items[i].pos = { x: Math.max(0, p.x - 36 + g.win.body.scrollLeft), y: Math.max(0, p.y - 16 + g.win.body.scrollTop) };
            layoutGroup(g); saveStructure();
          }
          return;
        }
        const it = g.items[i];
        const copy = ev.ctrlKey;
        if (!copy) { g.items.splice(i, 1); g.sel = Math.min(g.sel, g.items.length - 1); renderGroup(g); }
        tg.items.push({ ...it, pos: null });
        renderGroup(tg);
        saveStructure();
      };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
    };

    const makeGroupWin = (g, idx) => {
      const r = g.rect || { x: 10 + idx * 24, y: 10 + idx * 24, w: Math.round(rect.w * 0.82), h: Math.round(rect.h * 0.5) };
      g.sel = g.items.length ? 0 : -1;
      const gw = new Win({
        title: g.name, wm: pm.mdiClient, icon: 'group', x: r.x, y: r.y, w: r.w, h: r.h, noActivate: true,
        onClose: () => { gw.minimize(); return false; },
        onResize: () => g.els && layoutGroup(g),
        onKey: (e, name) => {
          const n = g.items.length; if (!n) return false;
          const sp = Store.get('iconSpacing', 75);
          const cols = Math.max(1, Math.floor((gw.body.clientWidth - 4) / sp));
          let i = Math.max(0, g.sel);
          if (name === 'Right') i = Math.min(n - 1, i + 1);
          else if (name === 'Left') i = Math.max(0, i - 1);
          else if (name === 'Down') i = Math.min(n - 1, i + cols);
          else if (name === 'Up') i = Math.max(0, i - cols);
          else if (name === 'Home') i = 0;
          else if (name === 'End') i = n - 1;
          else if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
            const c = e.key.toLowerCase();
            for (let k = 1; k <= n; k++) { const j = (i + k) % n; if (g.items[j].name.toLowerCase().startsWith(c)) { i = j; break; } }
          } else return false;
          select(g, i); return true;
        }
      });
      gw.group = g; g.win = gw;
      gw.body.style.overflow = 'auto';
      gw.body.classList.add('pm-group');
      gw.body.tabIndex = -1;
      gw.body.addEventListener('pointerdown', e => { if (e.target === gw.body) { /* keep selection */ } });
      renderGroup(g);
      if (g.iconPos) gw.iconPos = g.iconPos;
      gwins.push(gw);
      return gw;
    };

    const addGroup = (name) => {
      const g = { name, state: 'normal', items: [] };
      groups.push(g);
      const gw = makeGroupWin(g, groups.length - 1);
      gw.activate();
      saveStructure();
      pm.setMenu(menus());
    };

    /* ---------- dialogs ---------- */
    const itemProps = (g, it) => {
      const isNew = !it;
      it = it || { name: '', cmd: '', icon: null };
      let icon = it.icon;
      dialog({
        title: 'Program Item Properties', w: 380, h: 190, owner: pm,
        build(d) {
          const desc = UI.text(it.name), cmd = UI.text(it.cmd), dir = UI.text(it.dir || ''), key = UI.text(it.hotkey || 'None');
          const runMin = UI.check('&Run Minimized', it.runMin);
          const prev = h('div', { style: { width: '32px', height: '32px' } }, iconImg(icon || PM.iconFor(it.cmd || '')));
          const refreshIcon = () => { prev.innerHTML = ''; prev.appendChild(iconImg(icon || PM.iconFor(cmd.value))); };
          cmd.addEventListener('input', refreshIcon);
          d.add(UI.label('&Description:', desc), 10, 14); d.add(desc, 130, 10, 150);
          d.add(UI.label('&Command Line:', cmd), 10, 44); d.add(cmd, 130, 40, 150);
          d.add(UI.label('&Working Directory:', dir), 10, 74); d.add(dir, 130, 70, 150);
          d.add(UI.label('&Shortcut Key:', key), 10, 104); d.add(key, 130, 100, 150);
          d.add(prev, 30, 140);
          d.add(runMin, 130, 130);
          d.add(UI.button('OK', { default: true, onClick: () => {
            if (!cmd.value.trim()) { msgBox('You must enter a command line.', 'Program Manager', { icon: 'exclaim', owner: d.win }); return; }
            const [tok] = Sys.splitCmd(cmd.value);
            if (!FS.which(tok) && !FS.get(tok)) { msgBox(`The specified path is invalid.`, 'Program Manager', { icon: 'exclaim', owner: d.win }); return; }
            Object.assign(it, { name: desc.value.trim() || FS.basename(tok).replace(/\..*$/, '').toLowerCase(), cmd: cmd.value.trim(), dir: dir.value.trim(), runMin: runMin.input.checked, icon, hotkey: key.value });
            if (isNew) g.items.push(it);
            renderGroup(g); select(g, g.items.indexOf(it)); saveStructure();
            d.close();
          } }), 292, 10, 80, 25);
          d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 292, 40, 80, 25);
          d.add(UI.button('&Browse...', { onClick: async () => {
            const f = await fileDialog({ title: 'Browse', owner: d.win, filters: [['Programs', '*.EXE;*.PIF;*.COM;*.BAT'], ['All Files (*.*)', '*.*']] });
            if (f) { cmd.value = f.toLowerCase(); if (!desc.value) desc.value = FS.basename(f).replace(/\..*$/, '').toLowerCase(); refreshIcon(); }
          } }), 292, 80, 80, 25);
          d.add(UI.button('Change &Icon...', { onClick: async () => { const r = await changeIcon(d.win, icon || PM.iconFor(cmd.value)); if (r) { icon = r; refreshIcon(); } } }), 292, 110, 80, 25);
          d.add(UI.button('&Help', { onClick: () => Sys.launch('WINHELP.EXE progman') }), 292, 140, 80, 25);
        }
      });
    };

    const changeIcon = (owner, cur) => dialog({
      title: 'Change Icon', w: 330, h: 120, owner,
      build(d) {
        d.add(UI.label('File Name:'), 10, 12);
        d.add(h('div', { class: 'txt', text: 'progman.exe' }), 90, 12);
        d.add(UI.label('Current Icon:'), 10, 36);
        const strip = h('div', { class: 'lb', tabindex: '0', style: { display: 'flex', overflowX: 'auto', overflowY: 'hidden', gap: '2px', padding: '2px' } });
        let sel = cur;
        PM.allIcons.forEach(n => {
          const c = h('div', { style: { padding: '4px', flex: 'none', outline: n === sel ? '2px solid var(--highlight)' : 'none' } }, iconImg(n));
          c.addEventListener('pointerdown', () => { sel = n; strip.querySelectorAll('div').forEach(x => x.style.outline = 'none'); c.style.outline = '2px solid var(--highlight)'; });
          c.addEventListener('dblclick', () => d.close(sel));
          strip.appendChild(c);
        });
        d.add(strip, 10, 54, 222, 58);
        d.add(UI.button('OK', { default: true, onClick: () => d.close(sel) }), 242, 8, 80, 25);
        d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close(null) }), 242, 38, 80, 25);
        d.add(UI.button('&Browse...', { onClick: () => {} , disabled: true }), 242, 68, 80, 25);
      }
    }).promise;

    const groupProps = (g) => dialog({
      title: 'Program Group Properties', w: 340, h: 76, owner: pm,
      build(d) {
        const desc = UI.text(g ? g.name : ''), file = UI.text(g ? (g.name.replace(/\W/g, '').slice(0, 8).toLowerCase() + '.grp') : '');
        d.add(UI.label('&Description:', desc), 10, 14); d.add(desc, 100, 10, 140);
        d.add(UI.label('&Group File:', file), 10, 44); d.add(file, 100, 40, 140);
        d.add(UI.button('OK', { default: true, onClick: () => {
          const n = desc.value.trim();
          if (!n) { d.close(); return; }
          if (g) { g.name = n; g.win.setTitle(n); saveStructure(); pm.setMenu(menus()); }
          else addGroup(n);
          d.close();
        } }), 252, 8, 80, 25);
        d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 252, 38, 80, 25);
      }
    });

    const newObject = () => dialog({
      title: 'New Program Object', w: 300, h: 90, owner: pm,
      build(d) {
        const grp = UI.group('New');
        const r1 = UI.radio('npo', 'Program &Group', false), r2 = UI.radio('npo', 'Program &Item', true);
        const g = activeGroup();
        if (!g) { r1.input.checked = true; r2.input.disabled = true; }
        d.add(grp, 10, 4, 180, 78);
        d.add(r1, 24, 28); d.add(r2, 24, 52);
        d.add(UI.button('OK', { default: true, onClick: () => {
          d.close();
          if (r1.input.checked) groupProps(null);
          else itemProps(activeGroup(), null);
        } }), 210, 8, 80, 25);
        d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 210, 38, 80, 25);
      }
    });

    const moveCopy = (copy) => {
      const g = activeGroup(), it = selItem();
      if (!g || !it) return;
      dialog({
        title: copy ? 'Copy Program Item' : 'Move Program Item', w: 330, h: 100, owner: pm,
        build(d) {
          d.add(UI.label(`${copy ? 'Copy' : 'Move'} Program Item:   ${it.name}`), 10, 12);
          d.add(UI.label(`From Program Group:   ${g.name}`), 10, 32);
          const targets = groups.filter(x => copy || x !== g);
          const cb = UI.combo({ items: targets.map(x => x.name) });
          d.add(UI.label('&To Group:', cb), 10, 64); d.add(cb, 80, 60, 150);
          d.add(UI.button('OK', { default: true, onClick: () => {
            const tg = targets[cb.index];
            if (tg) {
              if (!copy) { g.items.splice(g.items.indexOf(it), 1); renderGroup(g); }
              tg.items.push({ ...it, pos: null }); renderGroup(tg); saveStructure();
            }
            d.close();
          } }), 242, 8, 80, 25);
          d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 242, 38, 80, 25);
        }
      });
    };

    const del = async () => {
      const a = pm.mdiClient.active;
      if (!a) return;
      const g = a.group;
      if (a.isMin) {
        const r = await msgBox(`Are you sure you want to delete the group '${g.name}'?`, 'Delete', { icon: 'question', buttons: 'yesno', owner: pm });
        if (r === 'yes') { groups = groups.filter(x => x !== g); a.close(true); saveStructure(); pm.setMenu(menus()); }
        return;
      }
      const it = selItem();
      if (!it) return;
      const r = await msgBox(`Are you sure you want to delete the item '${it.name}'?`, 'Delete', { icon: 'question', buttons: 'yesno', owner: pm });
      if (r === 'yes') { g.items.splice(g.items.indexOf(it), 1); renderGroup(g); saveStructure(); }
    };

    const props = () => {
      const a = pm.mdiClient.active;
      if (!a) return;
      if (a.isMin) groupProps(a.group);
      else itemProps(a.group, selItem());
    };

    const runDlg = () => dialog({
      title: 'Run', w: 330, h: 90, owner: pm,
      build(d) {
        const cmd = UI.text(Store.get('lastRun', ''));
        const min = UI.check('Run &Minimized', false);
        d.add(UI.label('&Command Line:', cmd), 10, 10); d.add(cmd, 10, 28, 220);
        d.add(min, 10, 60);
        d.add(UI.button('OK', { default: true, onClick: () => {
          const c = cmd.value.trim(); if (!c) return;
          Store.set('lastRun', c); d.close();
          Sys.launch(c, { show: min.input.checked ? 'min' : undefined, cwd: 'C:\\WINDOWS' });
        } }), 242, 6, 80, 25);
        d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 242, 36, 80, 25);
        d.add(UI.button('&Browse...', { onClick: async () => { const f = await fileDialog({ title: 'Browse', owner: d.win, filters: [['Programs', '*.EXE;*.PIF;*.COM;*.BAT'], ['All Files (*.*)', '*.*']] }); if (f) cmd.value = f.toLowerCase(); } }), 242, 66, 80, 25);
      }
    });

    /* Holding SHIFT while choosing Exit Windows saves the current arrangement
       without leaving Windows (a Windows 3.1 trick). */
    const exitOrSave = () => {
      if (Sys.shiftDown) { saveLayout(); Snd.event('SystemAsterisk'); return; }
      Sys.exitWindows({ owner: pm });
    };

    /* ---------- menus ---------- */
    const toggle = k => () => { opt[k] = !opt[k]; Store.set('pm.opts', opt); if (k === 'autoArrange' && opt[k]) groups.forEach(g => g.win && arrangeGroup(g)); };
    const menus = () => [
      { label: '&File', items: [
        { label: '&New...', action: newObject },
        { label: '&Open', key: 'Enter', keyLabel: 'Enter', action: () => { const a = pm.mdiClient.active; if (a && a.isMin) a.restore(); else launchItem(selItem()); } },
        { label: '&Move...', key: 'F7', disabled: () => !selItem(), action: () => moveCopy(false) },
        { label: '&Copy...', key: 'F8', disabled: () => !selItem(), action: () => moveCopy(true) },
        { label: '&Delete', key: 'Del', action: del },
        { label: 'P&roperties...', key: 'Alt+Enter', action: props },
        '-',
        { label: '&Run...', action: runDlg },
        '-',
        { label: 'E&xit Windows...', action: () => exitOrSave() }
      ] },
      { label: '&Options', items: [
        { label: '&Auto Arrange', checked: () => opt.autoArrange, action: toggle('autoArrange') },
        { label: '&Minimize on Use', checked: () => opt.minOnUse, action: toggle('minOnUse') },
        { label: '&Save Settings on Exit', checked: () => Store.get('pmSave', true), action: () => Store.set('pmSave', !Store.get('pmSave', true)) }
      ] },
      { label: '&Window', items: () => [
        { label: '&Cascade', key: 'Shift+F5', action: () => pm.mdiClient.cascade() },
        { label: '&Tile', key: 'Shift+F4', action: () => pm.mdiClient.tile() },
        { label: '&Arrange Icons', action: () => { pm.mdiClient.arrangeIcons(); const g = activeGroup(); if (g && !g.win.isMin) arrangeGroup(g); } },
        '-',
        ...groups.map((g, i) => ({ label: `&${i + 1} ${g.name}`, checked: () => pm.mdiClient.active === g.win, action: () => g.win.isMin ? g.win.restore() : g.win.activate() }))
      ] },
      { label: '&Help', items: [
        { label: '&Contents', action: () => Sys.launch('WINHELP.EXE progman') },
        { label: '&Search for Help on...', action: () => Sys.launch('WINHELP.EXE progman') },
        { label: '&How to Use Help', action: () => Sys.launch('WINHELP.EXE winhelp') },
        { label: '&Windows Tutorial', action: () => Sys.launch('WINHELP.EXE tutorial') },
        '-',
        { label: '&About Program Manager...', action: () => aboutBox('Program Manager', 'progman', pm) }
      ] }
    ];

    pm = new Win({
      title: 'Program Manager', icon: 'progman', x: rect.x, y: rect.y, w: rect.w, h: rect.h, menu: menus(),
      onClose: () => { if (Sys.isNeo()) return true; exitOrSave(); return false; },
      onMdiChange: () => {}
    });
    pm.body.style.background = 'var(--app-workspace)';
    const client = h('div', { class: 'wmc' });
    pm.body.appendChild(client);
    pm.createMdiClient(client);
    pm.on('resize', () => pm.mdiClient.relayout());

    groups.forEach((g, i) => makeGroupWin(g, i));
    // states: minimised groups become icons, in order
    groups.forEach(g => { if (g.state === 'min') g.win.minimize(); });
    groups.forEach(g => { if (g.state === 'max') g.win.maximize(true); });
    const firstOpen = groups.slice().reverse().find(g => g.state !== 'min');
    (firstOpen ? firstOpen.win : gwins[0])?.activate();
    if (Store.get('pm.state') === 'max') setTimeout(() => pm.maximize(), 0);

    const offExit = Sys.on('exiting', () => { PM.ranStartup = false; if (Store.get('pmSave', true)) saveLayout(); });
    const offSet = Sys.on('settings', () => { groups.forEach(g => g.win && !g.win.closed && layoutGroup(g)); pm.mdiClient.arrangeIcons(); });
    pm.on('closed', () => { offExit(); offSet(); });

    // StartUp group
    if (!PM.ranStartup && !Sys.isNeo()) {
      PM.ranStartup = true;
      const su = groups.find(g => g.name.toLowerCase() === 'startup');
      if (su) su.items.forEach((it, i) => setTimeout(() => Sys.launch(it.cmd, { show: it.runMin ? 'min' : undefined, quiet: true }), 600 + i * 300));
    }
    // first-run tip
    if (!Store.get('welcomed') && !Sys.isNeo()) {
      Store.set('welcomed', true);
      setTimeout(() => msgBox('Welcome to Neo31, a re-creation of Windows 3.1.\n\nDouble-click an icon to start a program. Program groups shown as icons at the bottom of Program Manager can be opened by double-clicking them.\n\nOpen Read Me in the Main group for tips.', 'Welcome', { icon: 'info', owner: pm }), 900);
    }
    return pm;
  }
});
