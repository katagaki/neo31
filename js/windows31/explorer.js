'use strict';
/* File Explorer (Windows 10) in Windows 3.1 clothing */
(() => {
  const VIRTUAL = { thispc: 'This PC', recycle: 'Recycle Bin', quick: 'Quick access' };
  const resolveTarget = a => {
    const t = (a || '').trim();
    if (!t || /^quick$/i.test(t)) return 'quick';
    if (/^thispc$/i.test(t)) return 'thispc';
    if (/^recycle$/i.test(t)) return 'recycle';
    if (KNOWN[t.toLowerCase()]) return KNOWN[t.toLowerCase()];
    return FS.full(t, USER_HOME);
  };

  Sys.registerApp('explorer', {
    name: 'File Explorer', icon: 'explorer', help: 'winfile',
    run(opts) {
      const st = Object.assign({ view: 'details', sort: 'name', desc: false, nav: true, status: true, ext: true, hidden: false }, Store.get('ex.opts', {}));
      const save = () => Store.set('ex.opts', st);
      let loc = resolveTarget(opts.args), hist = [], fwd = [], items = [], sel = new Set(), cur = -1, query = '';

      const back = h('div', { class: 'w31-xbtn', title: 'Back' }, iconImg('s_back'));
      const forward = h('div', { class: 'w31-xbtn', title: 'Forward' }, iconImg('s_fwd'));
      const up = h('div', { class: 'w31-xbtn', title: 'Up' }, iconImg('s_upfolder'));
      const addr = h('input', { class: 'tx w31-addr', spellcheck: false });
      const search = h('input', { class: 'tx w31-xsearch', placeholder: 'Search', spellcheck: false });
      const bar = h('div', { class: 'w31-xbar' }, back, forward, up, addr, search);
      const nav = h('div', { class: 'w31-xnav lb', tabindex: '0' });
      const main = h('div', { class: 'w31-xmain lb', tabindex: '0' });
      const status = h('div', { class: 'status' }, h('div', { style: { flex: '0 0 auto', minWidth: '120px' } }), h('div', { style: { flex: 1 } }));
      const split = h('div', { class: 'w31-xsplit' }, nav, main);

      const title = () => loc in VIRTUAL ? VIRTUAL[loc] : (loc === 'C:\\' ? 'Local Disk (C:)' : FileOps.shownName(FS.basename(loc), FS.get(loc)));
      const pathLabel = () => loc in VIRTUAL ? VIRTUAL[loc] : 'This PC > ' + FS.resolve(loc).parts.reduce((acc, p, i, a) => {
        const full = 'C:\\' + a.slice(0, i + 1).join('\\');
        return acc + ' > ' + FileOps.shownName(p, FS.get(full));
      }, 'Local Disk (C:)');

      const go = (to, push = true) => {
        to = resolveTarget(to);
        if (!(to in VIRTUAL) && !FS.isDir(to)) {
          if (FS.get(to)) { FileOps.open(to); return; }
          msgBox(`Windows can't find '${addr.value}'. Check the spelling and try again.`, 'File Explorer', { icon: 'stop', owner: w });
          return;
        }
        if (push && to !== loc) { hist.push(loc); fwd = []; }
        loc = to; query = ''; search.value = ''; sel.clear(); cur = -1;
        render();
      };

      /* ---------- listing ---------- */
      const list = () => {
        if (loc === 'thispc') return [];
        if (loc === 'quick') return Object.entries({ desktop: 'Desktop', downloads: 'Downloads', documents: 'Documents', pictures: 'Pictures', music: 'Music' })
          .map(([k]) => ({ name: FS.basename(KNOWN[k]), node: FS.get(KNOWN[k]), full: KNOWN[k] })).filter(e => e.node);
        const dir = loc === 'recycle' ? KNOWN.recycle : loc;
        let es = (FS.list(dir) || []).map(e => ({ ...e, full: FS.join(dir, e.name) }));
        if (!st.hidden) es = es.filter(e => !e.node.h || loc === 'recycle');
        if (query) {
          const q = query.toLowerCase(), out = [];
          const walk = (d, depth) => { for (const e of FS.list(d) || []) { if (e.node.h && !st.hidden) continue; const full = FS.join(d, e.name); if (FileOps.shownName(e.name, e.node).toLowerCase().includes(q)) out.push({ ...e, full }); if (e.node.t === 'd' && depth < 8) walk(full, depth + 1); } };
          walk(dir, 0);
          es = out;
        }
        const key = { name: e => shown(e).toLowerCase(), date: e => e.node.d || 0, type: e => FileOps.typeName(e.name, e.node), size: e => FS.size(e.node) }[st.sort];
        es.sort((a, b) => {
          if ((a.node.t === 'd') !== (b.node.t === 'd')) return a.node.t === 'd' ? -1 : 1;
          const x = key(a), y = key(b);
          return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * (st.desc ? -1 : 1);
        });
        return es;
      };
      const shown = e => {
        if (loc === 'recycle' && e.node.origName) return e.node.origName;
        let n = FileOps.shownName(e.name, e.node);
        if (!st.ext && e.node.t !== 'd') n = n.replace(/\.[^.]+$/, '');
        return n;
      };
      const sizeStr = b => b < 1024 ? `${b} bytes` : `${fmtNum(Math.ceil(b / 1024))} KB`;

      /* ---------- render ---------- */
      const render = () => {
        w.setTitle(title());
        addr.value = pathLabel();
        back.classList.toggle('dis', !hist.length); forward.classList.toggle('dis', !fwd.length);
        up.classList.toggle('dis', loc === 'thispc' || loc === 'quick' || loc === 'recycle');
        search.placeholder = 'Search ' + title();
        renderNav();
        main.innerHTML = '';
        main.className = 'w31-xmain lb view-' + st.view;
        if (loc === 'thispc') return renderThisPC();
        items = list();
        if (loc === 'recycle') {
          const tools = h('div', { class: 'w31-xtools' }, UI.button('&Empty Recycle Bin', { onClick: async () => { await FileOps.emptyRecycle(w); } }), UI.button('&Restore all items', { onClick: () => { items.forEach(e => FileOps.restore(e.full)); } }));
          main.appendChild(tools);
        }
        if (st.view === 'details') {
          const cols = loc === 'recycle' ? [['name', 'Name', 200], ['orig', 'Original Location', 170], ['date', 'Date Deleted', 150], ['size', 'Size', 80]]
            : [['name', 'Name', 210], ['date', 'Date modified', 150], ['type', 'Type', 140], ['size', 'Size', 80]];
          const head = h('div', { class: 'w31-xhead' });
          for (const [k, label, wd] of cols) {
            const c = h('div', { class: 'w31-xcol raised', style: { width: wd + 'px' } }, label, st.sort === k ? ' ' : '', st.sort === k ? glyphImg(st.desc ? 'down' : 'up') : '');
            c.addEventListener('pointerup', () => { if (k === 'orig') return; if (st.sort === k) st.desc = !st.desc; else { st.sort = k; st.desc = false; } save(); render(); });
            head.appendChild(c);
          }
          main.appendChild(head);
          items.forEach((e, i) => {
            const row = h('div', { class: 'it w31-xrow' }, h('span', { style: { width: cols[0][2] + 'px' } }, iconImg(FileOps.iconFor(e.name, e.node, 16), 16), h('span', { class: 'w31-xname', text: shown(e) })));
            if (loc === 'recycle') row.append(h('span', { style: { width: '170px' }, text: e.node.orig ? FS.dirname(e.node.orig) : '' }), h('span', { style: { width: '150px' }, text: e.node.del ? `${Intl31.date(new Date(e.node.del))} ${Intl31.time(new Date(e.node.del))}` : '' }));
            else row.append(h('span', { style: { width: '150px' }, text: `${Intl31.date(new Date(e.node.d || WIN_DATE))} ${Intl31.time(new Date(e.node.d || WIN_DATE))}` }), h('span', { style: { width: '140px' }, text: FileOps.typeName(e.name, e.node) }));
            row.append(h('span', { style: { width: '80px', textAlign: 'right' }, text: e.node.t === 'd' ? '' : sizeStr(FS.size(e.node)) }));
            bindItem(row, i); main.appendChild(row);
          });
        } else {
          const grid = h('div', { class: 'w31-xgrid' });
          items.forEach((e, i) => {
            const big = st.view === 'icons';
            const it = h('div', { class: big ? 'icon w31-xicon' : 'it w31-xlist' }, big ? h('div', { class: 'img' }, iconImg(FileOps.iconFor(e.name, e.node, 32))) : iconImg(FileOps.iconFor(e.name, e.node, 16), 16), h('div', { class: big ? 'lbl' : 'w31-xname', text: shown(e) }));
            bindItem(it, i); grid.appendChild(it);
          });
          main.appendChild(grid);
        }
        if (!items.length) main.appendChild(h('div', { class: 'w31-xempty', text: query ? 'No items match your search.' : 'This folder is empty.' }));
        paintSel();
      };

      const renderThisPC = () => {
        items = [];
        main.appendChild(h('div', { class: 'w31-applabel', text: 'Folders (5)' }));
        const g1 = h('div', { class: 'w31-pcgrid' });
        for (const k of ['desktop', 'documents', 'downloads', 'music', 'pictures']) {
          const n = FS.get(KNOWN[k]); if (!n) continue;
          const el = h('div', { class: 'icon w31-xicon' }, h('div', { class: 'img' }, iconImg(FileOps.iconFor(FS.basename(KNOWN[k]), n, 32))), h('div', { class: 'lbl', text: FileOps.shownName(FS.basename(KNOWN[k]), n) }));
          el.addEventListener('dblclick', () => go(KNOWN[k]));
          g1.appendChild(el);
        }
        main.appendChild(g1);
        main.appendChild(h('div', { class: 'w31-applabel', text: 'Devices and drives (2)' }));
        const drive = (label, icon, free, total, fn) => {
          const pct = total ? (total - free) / total : 0;
          const d = h('div', { class: 'w31-drive' }, iconImg(icon), h('div', {}, h('div', { text: label }),
            h('div', { class: 'w31-usage sunken' }, h('div', { style: { width: Math.round(pct * 100) + '%', background: pct > .9 ? '#ff0000' : 'var(--highlight)' } })),
            h('div', { class: 'w31-kind', text: total ? `${(free / 1048576).toFixed(1)} MB free of ${(total / 1048576).toFixed(0)} MB` : '' })));
          d.addEventListener('dblclick', fn);
          return d;
        };
        main.appendChild(h('div', { class: 'w31-pcdrives' }, drive('Local Disk (C:)', 'thispc', FS.free(), FS.totalBytes, () => go('C:\\')),
          drive('3½ Floppy (A:)', 'floppy', 0, 0, () => msgBox('A:\\ is not accessible.\n\nThe device is not ready.', 'Location is not available', { icon: 'stop', owner: w }))));
        status.children[0].textContent = '7 items'; status.children[1].textContent = '';
      };

      const navItems = () => [
        { label: 'Quick access', icon: 's_star', to: 'quick', depth: 0 },
        ...['desktop', 'downloads', 'documents', 'pictures', 'music'].map(k => ({ label: FileOps.shownName(FS.basename(KNOWN[k]), FS.get(KNOWN[k])), icon: { desktop: 's_thispc', downloads: 's_down', documents: 's_docs', pictures: 's_pics', music: 's_music' }[k], to: KNOWN[k], depth: 1 })),
        { label: 'This PC', icon: 's_thispc', to: 'thispc', depth: 0 },
        { label: 'Local Disk (C:)', icon: 's_drive', to: 'C:\\', depth: 1 },
        ...(FS.list('C:\\') || []).filter(e => e.node.t === 'd' && (!e.node.h || st.hidden)).map(e => ({ label: FileOps.shownName(e.name, e.node), icon: 's_folder', to: FS.join('C:\\', e.name), depth: 2 })),
        { label: 'Recycle Bin', icon: 's_recycle', to: 'recycle', depth: 0 }
      ];
      const renderNav = () => {
        nav.style.display = st.nav ? '' : 'none';
        nav.innerHTML = '';
        for (const n of navItems()) {
          const r = h('div', { class: 'it' + (loc === n.to ? ' sel' : ''), style: { paddingLeft: (4 + n.depth * 14) + 'px' } }, iconImg(n.icon, 16), h('span', { text: n.label }));
          r.dataset.drop = n.to;
          r.addEventListener('pointerdown', e => { if (e.button === 0) go(n.to); });
          nav.appendChild(r);
        }
      };

      /* ---------- selection & item behaviour ---------- */
      const rows = () => [...main.querySelectorAll('.w31-xrow, .w31-xicon, .w31-xlist')];
      const paintSel = () => {
        rows().forEach((r, i) => { r.classList.toggle('sel', sel.has(i)); r.classList.toggle('cur', i === cur); });
        const s = [...sel].map(i => items[i]).filter(Boolean);
        status.style.display = st.status ? '' : 'none';
        status.children[0].textContent = `${items.length} item${items.length === 1 ? '' : 's'}`;
        status.children[1].textContent = s.length ? `${s.length} item${s.length > 1 ? 's' : ''} selected  ${s.some(e => e.node.t === 'd') ? '' : sizeStr(s.reduce((a, e) => a + FS.size(e.node), 0))}` : '';
      };
      const selected = () => [...sel].map(i => items[i]).filter(Boolean);
      const openItem = e => {
        if (loc === 'recycle') { FileOps.properties(e.full, w); return; }
        if (e.node.t === 'd') go(e.full); else FileOps.open(e.full);
      };
      const bindItem = (el, i) => {
        el.addEventListener('pointerdown', ev => {
          if (ev.button === 2) { if (!sel.has(i)) { sel = new Set([i]); cur = i; paintSel(); } return; }
          if (ev.button !== 0) return;
          main.focus();
          if (ev.shiftKey && cur >= 0) { sel = new Set(); for (let k = Math.min(cur, i); k <= Math.max(cur, i); k++) sel.add(k); }
          else if (ev.ctrlKey || ev.metaKey) { sel.has(i) ? sel.delete(i) : sel.add(i); cur = i; }
          else if (!sel.has(i)) { sel = new Set([i]); cur = i; }
          paintSel();
          dragFrom(ev, el, i);
        });
        el.addEventListener('dblclick', () => openItem(items[i]));
        el.addEventListener('contextmenu', ev => { ev.preventDefault(); ev.stopPropagation(); const p = Sys.pointer(ev); Menu.show(itemMenu(), p.x, p.y); });
        el.dataset.drop = items[i].node.t === 'd' ? items[i].full : '';
      };
      // drag selected items onto a folder (list or navigation pane) to move them; Ctrl copies
      const dragFrom = (ev, el, i) => {
        if (loc === 'recycle') return;
        const sx = ev.clientX, sy = ev.clientY; let ghost = null;
        el.setPointerCapture(ev.pointerId);
        const mv = e2 => {
          if (!ghost && Math.abs(e2.clientX - sx) + Math.abs(e2.clientY - sy) < 6) return;
          if (!ghost) { ghost = h('div', { style: { position: 'absolute', zIndex: 99990, pointerEvents: 'none' } }, iconImg(sel.size > 1 ? 'doc' : FileOps.iconFor(items[i].name, items[i].node, 32))); Sys.screen.appendChild(ghost); }
          const p = Sys.pointer(e2); ghost.style.left = p.x + 6 + 'px'; ghost.style.top = p.y + 6 + 'px';
        };
        const up = async e2 => {
          el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up);
          if (!ghost) return;
          ghost.remove();
          const hit = document.elementsFromPoint(e2.clientX, e2.clientY).find(x => x.dataset && x.dataset.drop);
          if (!hit) return;
          const to = hit.dataset.drop;
          if (to === 'recycle') { await FileOps.recycle(selected().map(e => e.full), e2.shiftKey, w); return; }
          if (to in VIRTUAL) return;
          const paths = selected().map(e => e.full).filter(p => p !== to && FS.dirname(p) !== FS.full(to));
          if (!paths.length) return;
          FileClip.set(paths, !e2.ctrlKey); await FileClip.paste(to);
        };
        el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
      };

      const curDir = () => loc in VIRTUAL ? (loc === 'recycle' ? null : null) : loc;
      const newItem = (base, folder) => {
        const dir = curDir(); if (!dir) return;
        const name = FileOps.uniqueName(dir, base);
        try { folder ? FS.mkdir(FS.join(dir, name)) : FS.write(FS.join(dir, name), ''); } catch (e) { msgBox(e.message, 'File Explorer', { icon: 'stop', owner: w }); return; }
        setTimeout(() => { const i = items.findIndex(e => e.full.toUpperCase() === FS.join(dir, name).toUpperCase()); if (i >= 0) { sel = new Set([i]); cur = i; paintSel(); renameInline(i); } }, 60);
      };
      const renameInline = i => {
        const e = items[i]; if (!e || loc === 'recycle') return;
        const row = rows()[i]; if (!row) return;
        const lbl = row.querySelector('.w31-xname, .lbl');
        const inp = h('input', { class: 'tx w31-rename' });
        inp.value = FileOps.shownName(e.name, e.node);
        lbl.replaceWith(inp); inp.focus();
        const dot = inp.value.lastIndexOf('.');
        inp.setSelectionRange(0, dot > 0 && e.node.t !== 'd' ? dot : inp.value.length);
        let done = false;
        const fin = ok => { if (done) return; done = true; const v = inp.value.trim(); if (ok && v && v !== FileOps.shownName(e.name, e.node)) FileOps.rename(e.full, v); render(); };
        inp.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') fin(true); if (ev.key === 'Escape') fin(false); });
        inp.addEventListener('blur', () => fin(true));
        inp.addEventListener('pointerdown', ev => ev.stopPropagation());
      };
      const del = async (perm) => {
        const s = selected(); if (!s.length) return;
        if (loc === 'recycle') { const r = await msgBox(`Are you sure you want to permanently delete ${s.length === 1 ? 'this file' : `these ${s.length} items`}?`, 'Delete File', { buttons: 'yesno', icon: 'exclaim', owner: w }); if (r === 'yes') s.forEach(e => FS.remove(e.full)); return; }
        await FileOps.recycle(s.map(e => e.full), perm, w);
      };

      const itemMenu = () => {
        const s = selected(), one = s[0];
        if (loc === 'recycle') return [{ label: '&Restore', action: () => s.forEach(e => FileOps.restore(e.full)) }, '-', { label: '&Delete', action: () => del(true) }, '-', { label: 'P&roperties', action: () => one && FileOps.properties(one.full, w) }];
        return [
          { label: '&Open', action: () => s.forEach(openItem) },
          ...(one && one.node.t !== 'd' && /^(TXT|INI|BAT|LOG|SYS)$/.test(FS.ext(one.name)) ? [{ label: '&Edit', action: () => Sys.launch('NOTEPAD.EXE ' + one.full) }] : []),
          ...(one && one.node.t === 'd' ? [{ label: 'Open in new &window', action: () => Sys.run('explorer', { args: one.full }) }, { label: 'Open &command window here', action: () => Sys.run('dos', { cwd: one.full }) }] : []),
          '-',
          { label: 'Cu&t', key: 'Ctrl+X', action: () => FileClip.set(s.map(e => e.full), true) },
          { label: '&Copy', key: 'Ctrl+C', action: () => FileClip.set(s.map(e => e.full), false) },
          '-',
          { label: '&Delete', key: 'Del', action: () => del(false) },
          { label: 'Rena&me', key: 'F2', disabled: s.length !== 1, action: () => renameInline(cur) },
          '-',
          { label: 'P&roperties', action: () => one && FileOps.properties(one.full, w) }
        ];
      };
      const bgMenu = () => [
        { label: '&View', items: viewItems() },
        { label: 'S&ort by', items: sortItems() },
        { label: 'R&efresh', key: 'F5', action: render },
        '-',
        { label: '&Paste', key: 'Ctrl+V', disabled: () => !FileClip.items.length || !curDir(), action: () => FileClip.paste(curDir()) },
        ...(curDir() ? ['-', { label: 'Ne&w', items: newItems() }, { label: 'Open command &window here', action: () => Sys.run('dos', { cwd: curDir() }) }] : []),
        '-',
        { label: 'P&roperties', disabled: !curDir(), action: () => FileOps.properties(curDir(), w) }
      ];
      const viewItems = () => [['&Large icons', 'icons'], ['&List', 'list'], ['&Details', 'details']].map(([l, v]) => ({ label: l, radio: true, checked: () => st.view === v, action: () => { st.view = v; save(); render(); } }));
      const sortItems = () => [...[['&Name', 'name'], ['&Date modified', 'date'], ['&Type', 'type'], ['&Size', 'size']].map(([l, k]) => ({ label: l, checked: () => st.sort === k, action: () => { st.sort = k; save(); render(); } })), '-',
        { label: '&Ascending', checked: () => !st.desc, action: () => { st.desc = false; save(); render(); } }, { label: 'D&escending', checked: () => st.desc, action: () => { st.desc = true; save(); render(); } }];
      const newItems = () => [
        { label: '&Folder', action: () => newItem('New folder', true) }, '-',
        { label: '&Text Document', action: () => newItem('New Text Document.txt') },
        { label: '&Bitmap image', action: () => newItem('New Bitmap Image.bmp') },
        { label: '&Write Document', action: () => newItem('New Write Document.wri') }];

      const w = new Win({
        title: 'File Explorer', icon: 'explorer', w: Math.min(860, Sys.desktop.W - 40), h: Math.min(480, Sys.desktop.H - 40), persist: 'explorer',
        menu: [
          { label: '&File', items: () => [
            { label: 'Open new &window', key: 'Ctrl+N', action: () => Sys.run('explorer', { args: loc in VIRTUAL ? loc : loc }) },
            { label: 'Open command &prompt', action: () => Sys.run('dos', { cwd: curDir() || USER_HOME }) },
            '-', { label: 'Ne&w', items: newItems(), disabled: !curDir() },
            { label: '&Import files from computer...', disabled: !curDir(), action: () => HostFiles.importFiles(curDir(), w) },
            { label: '&Export selected file...', disabled: selected().length !== 1 || selected()[0]?.node.t !== 'f', action: () => HostFiles.exportFile(selected()[0].full, w) },
            { label: '&Delete', action: () => del(false), disabled: !sel.size },
            { label: 'Rena&me', action: () => renameInline(cur), disabled: sel.size !== 1 },
            { label: 'P&roperties', key: 'Alt+Enter', action: () => { const s = selected()[0]; s ? FileOps.properties(s.full, w) : curDir() && FileOps.properties(curDir(), w); } },
            '-', { label: '&Close', action: () => w.close() }] },
          { label: '&Edit', items: () => [
            { label: 'Cu&t', key: 'Ctrl+X', disabled: !sel.size || loc === 'recycle', action: () => FileClip.set(selected().map(e => e.full), true) },
            { label: '&Copy', key: 'Ctrl+C', disabled: !sel.size || loc === 'recycle', action: () => FileClip.set(selected().map(e => e.full), false) },
            { label: '&Paste', key: 'Ctrl+V', disabled: !FileClip.items.length || !curDir(), action: () => FileClip.paste(curDir()) },
            '-',
            { label: 'Select &all', key: 'Ctrl+A', action: () => { sel = new Set(items.map((_, i) => i)); paintSel(); } },
            { label: '&Invert selection', action: () => { sel = new Set(items.map((_, i) => i).filter(i => !sel.has(i))); paintSel(); } }] },
          { label: '&View', items: () => [...viewItems(), '-',
            { label: '&Navigation pane', checked: () => st.nav, action: () => { st.nav = !st.nav; save(); render(); } },
            { label: '&Status bar', checked: () => st.status, action: () => { st.status = !st.status; save(); paintSel(); } },
            '-',
            { label: 'File name e&xtensions', checked: () => st.ext, action: () => { st.ext = !st.ext; save(); render(); } },
            { label: '&Hidden items', checked: () => st.hidden, action: () => { st.hidden = !st.hidden; save(); render(); } },
            '-', { label: 'S&ort by', items: sortItems() }, { label: '&Refresh', key: 'F5', action: render }] },
          { label: '&Help', items: [{ label: '&About Windows 31', action: () => Sys.launch('SETTINGS system/about') }] }
        ],
        onKey: (e, name) => {
          if (document.activeElement === addr || document.activeElement === search) return false;
          const n = items.length;
          if (name === 'Backspace' || name === 'Alt+Left') { goBack(); return true; }
          if (name === 'Alt+Right') { goFwd(); return true; }
          if (name === 'Alt+Up') { goUp(); return true; }
          if (name === 'F2') { renameInline(cur); return true; }
          if (name === 'Del') { del(false); return true; }
          if (name === 'Shift+Del') { del(true); return true; }
          if (name === 'Enter') { selected().forEach(openItem); return true; }
          if (name === 'Ctrl+F' || name === 'F3') { search.focus(); return true; }
          if (!n) return false;
          const cols = st.view === 'icons' ? Math.max(1, Math.floor(main.clientWidth / 80)) : 1;
          let i = cur < 0 ? 0 : cur;
          if (/Down$/.test(name)) i += cols; else if (/Up$/.test(name)) i -= cols; else if (/Right$/.test(name) && cols > 1) i++; else if (/Left$/.test(name) && cols > 1) i--;
          else if (name === 'Home') i = 0; else if (name === 'End') i = n - 1;
          else return false;
          cur = clamp(i, 0, n - 1); sel = new Set([cur]); paintSel();
          const r = rows()[cur]; r && r.scrollIntoView({ block: 'nearest' });
          return true;
        }
      });
      const goBack = () => { if (!hist.length) return; fwd.push(loc); go(hist.pop(), false); };
      const goFwd = () => { if (!fwd.length) return; hist.push(loc); go(fwd.pop(), false); };
      const goUp = () => { if (loc in VIRTUAL) return; if (loc === 'C:\\') go('thispc'); else go(FS.dirname(loc)); };
      back.addEventListener('pointerdown', e => { e.preventDefault(); goBack(); });
      forward.addEventListener('pointerdown', e => { e.preventDefault(); goFwd(); });
      up.addEventListener('pointerdown', e => { e.preventDefault(); goUp(); });
      addr.addEventListener('focus', () => { addr.value = loc in VIRTUAL ? VIRTUAL[loc] : loc; addr.select(); });
      addr.addEventListener('blur', () => { addr.value = pathLabel(); });
      addr.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); const v = addr.value.trim(); const virt = Object.keys(VIRTUAL).find(k => VIRTUAL[k].toLowerCase() === v.toLowerCase()); addr.blur(); go(virt || v); }
        if (e.key === 'Escape') { addr.blur(); main.focus(); }
      });
      search.addEventListener('input', () => { query = search.value.trim(); sel.clear(); cur = -1; render(); search.focus(); });
      search.addEventListener('keydown', e => { if (e.key === 'Escape') { search.value = ''; query = ''; render(); main.focus(); } });
      main.addEventListener('pointerdown', e => { if (e.target === main || e.target.classList.contains('w31-xgrid')) { sel.clear(); cur = -1; paintSel(); main.focus(); } });
      main.addEventListener('contextmenu', e => { if (e.target.closest('.w31-xrow, .w31-xicon, .w31-xlist')) return; e.preventDefault(); const p = Sys.pointer(e); Menu.show(bgMenu(), p.x, p.y); });

      w.body.classList.add('w31-explorer');
      w.body.append(bar, split, status);
      const off = FS.on('change', () => { clearTimeout(w._rt); w._rt = setTimeout(() => { if (!(loc in VIRTUAL) && !FS.isDir(loc)) loc = 'thispc'; const keep = [...sel]; render(); sel = new Set(keep.filter(i => i < items.length)); paintSel(); }, 30); });
      w.on('closed', off);
      render();
      setTimeout(() => main.focus(), 0);
      return w;
    }
  });
})();
