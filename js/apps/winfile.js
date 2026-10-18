'use strict';
/* File Manager */

(() => {
  const fileIcon = (name, node) => {
    if (node.t === 'd') return 's_folder';
    const e = FS.ext(name);
    if (['EXE', 'COM', 'BAT', 'PIF'].includes(e)) return 's_exe';
    if (Sys.association(name)) return 's_doc';
    return 's_file';
  };
  const fmtDate = d => dateStr(new Date(d || WIN_DATE));
  const fmtTime = d => timeStr(new Date(d || WIN_DATE), true);

  Sys.registerApp('winfile', {
    name: 'File Manager', icon: 'winfile', single: true, help: 'winfile',
    run() {
      const st = Object.assign({ view: 'name', sort: 'name', pane: 'both', partial: ['size', 'date'], status: true, minOnUse: false, confirmDel: true, saveOnExit: true, font: 'MS Sans Serif', lower: true }, Store.get('wf.opts', {}));
      const lc = n => st.lower ? n.toLowerCase() : n;
      const listFont = () => `${WIN_FONT_PX[st.font] || 13}px/${Math.max(16, WIN_FONT_PX[st.font] || 13)}px ${WIN_FONTS[st.font] || WIN_FONTS['MS Sans Serif']}`;
      const saveOpts = () => Store.set('wf.opts', st);
      const dws = [];
      let fm;
      const status = h('div', { class: 'status' }, h('div', { style: { flex: '0 0 45%' } }), h('div', { style: { flex: 1 } }));

      const active = () => { const a = fm.mdiClient.active; return a && a.dw; };

      const updateStatus = () => {
        status.style.display = st.status ? '' : 'none';
        const dw = active();
        status.children[0].textContent = `C: ${fmtNum(FS.free() / 1024)}KB free,  ${fmtNum(FS.totalBytes / 1024)}KB total`;
        if (!dw) { status.children[1].textContent = ''; return; }
        const sel = dw.selected();
        if (sel.length) status.children[1].textContent = `Selected ${sel.length} file(s) (${fmtNum(sel.reduce((a, s) => a + FS.size(s.node), 0))} bytes)`;
        else { const ls = dw.entries(); status.children[1].textContent = `Total ${ls.length} file(s) (${fmtNum(ls.reduce((a, e) => a + FS.size(e.node), 0))} bytes)`; }
      };

      /* ---------------- directory window ---------------- */
      const makeDirWin = (startDir, search) => {
        const dw = { dir: startDir, expanded: new Set(['C:\\']), sel: new Set(), cur: 0, search };
        let p = 'C:\\';
        for (const part of FS.resolve(startDir).parts) { p = FS.join(p, part); dw.expanded.add(FS.dirname(p)); }
        const win = new Win({
          title: '', wm: fm.mdiClient, icon: 'winfile', minIcon: 'group', w: Math.round(fm.mdiClient.W * 0.95), h: Math.round(fm.mdiClient.H * 0.92),
          x: dws.length * 20, y: dws.length * 20,
          onActivate: on => on && setTimeout(updateStatus),
          onKey: (e, name) => dw.key(e, name),
          onClosed: () => { dws.splice(dws.indexOf(dw), 1); updateStatus(); }
        });
        win.dw = dw; dw.win = win;
        const b = win.body;
        b.style.display = 'flex'; b.style.flexDirection = 'column';
        const drives = h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '3px 6px', borderBottom: '1px solid #000', flex: 'none', font: 'var(--icon-font)' } });
        const tree = h('div', { class: 'lb', tabindex: '0', style: { font: listFont(), border: 0, borderRight: '1px solid #000', flex: '0 0 38%', position: 'relative' } });
        const list = h('div', { class: 'lb', tabindex: '0', style: { font: listFont(), border: 0, flex: 1, position: 'relative' } });
        const split = h('div', { style: { display: 'flex', flex: 1, minHeight: 0 } }, tree, list);
        if (!search) b.append(drives);
        b.append(split);
        const applyPane = () => {
          tree.style.display = search || st.pane === 'directory' ? 'none' : '';
          list.style.display = st.pane === 'tree' && !search ? 'none' : '';
          tree.style.flex = st.pane === 'tree' && !search ? '1' : '0 0 38%';
          list.style.flex = st.pane === 'tree' && !search ? '1' : '1';
        };
        applyPane();

        const dl = (lbl, ico, onClick, sel) => {
          const d = h('div', { style: { display: 'flex', alignItems: 'center', gap: '2px', padding: '0 2px', outline: sel ? '1px solid #000' : '' } }, iconImg(ico, 16), lbl);
          d.addEventListener('pointerdown', onClick);
          return d;
        };
        drives.append(
          dl('a', 's_floppy', () => msgBox('There is no disk in drive A.\n\nInsert a disk, and then try again.', 'File Manager', { icon: 'exclaim', owner: fm, buttons: 'retrycancel' })),
          dl('c', 's_drive', () => {}, true),
          h('div', { style: { marginLeft: '20px' }, text: 'C: [MS-DOS_6]' }));

        dw.entries = () => {
          if (search) return search.results.map(r => ({ name: r, node: FS.get(r), full: r })).filter(e => e.node);
          const ls = (FS.list(dw.dir) || []).map(e => ({ ...e, full: FS.join(dw.dir, e.name) }));
          const key = { name: e => e.name, type: e => FS.ext(e.name) + e.name, size: e => -FS.size(e.node), date: e => -(e.node.d || 0) }[st.sort];
          ls.sort((a, c) => (a.node.t === 'd') !== (c.node.t === 'd') ? (a.node.t === 'd' ? -1 : 1) : (typeof key(a) === 'number' ? key(a) - key(c) : String(key(a)).localeCompare(String(key(c)))));
          return ls;
        };
        dw.selected = () => { const es = dw.entries(); return [...dw.sel].map(i => es[i]).filter(Boolean); };

        dw.renderTree = () => {
          tree.innerHTML = '';
          const rows = [];
          const walk = (path, depth) => {
            const n = FS.get(path);
            if (!n) return;
            const name = depth === 0 ? lc('C:\\') : lc(FS.basename(path));
            const subs = Object.keys(n.c).filter(k => n.c[k].t === 'd').sort();
            const open = dw.expanded.has(path);
            const isCur = path === dw.dir;
            const row = h('div', { class: 'it' + (isCur ? ' sel cur' : ''), style: { paddingLeft: (3 + depth * 16) + 'px' } },
              iconImg(depth === 0 ? 's_drive' : isCur || open ? 's_folderOpen' : 's_folder', 16), name, subs.length && !open ? h('span', { style: { marginLeft: '2px' }, text: '+' }) : null);
            row.dataset.path = path;
            row.addEventListener('pointerdown', () => { tree.focus(); dw.setDir(path); });
            row.addEventListener('dblclick', () => { if (dw.expanded.has(path) && path !== 'C:\\') dw.expanded.delete(path); else dw.expanded.add(path); dw.renderTree(); });
            tree.appendChild(row); rows.push(path);
            if (open) for (const s of subs) walk(FS.join(path, s), depth + 1);
          };
          walk('C:\\', 0);
          dw.treeRows = rows;
          const cur = tree.querySelector('.cur');
          if (cur && (cur.offsetTop < tree.scrollTop || cur.offsetTop > tree.scrollTop + tree.clientHeight - 16)) tree.scrollTop = cur.offsetTop - 40;
        };

        dw.renderList = () => {
          list.innerHTML = '';
          const es = dw.entries();
          const details = st.view !== 'name' || search;
          applyPane();
          let col;
          if (!details) { col = h('div', { style: { display: 'flex', flexDirection: 'column', flexWrap: 'wrap', height: '100%', alignContent: 'flex-start' } }); list.appendChild(col); list.style.overflowX = 'auto'; list.style.overflowY = 'hidden'; }
          else { list.style.overflowX = 'auto'; list.style.overflowY = 'auto'; }
          if (!es.length) list.appendChild(h('div', { class: 'it', text: search ? 'No matching files were found.' : 'No files found.' }));
          es.forEach((e, i) => {
            const shown = lc(search ? e.full : e.name);
            const row = h('div', { class: 'it' + (dw.sel.has(i) ? ' sel' : '') + (dw.cur === i ? ' cur' : ''), style: details ? {} : { width: '130px' } },
              iconImg(fileIcon(e.name, e.node), 16),
              details ? h('span', { style: { display: 'flex', gap: '10px' } },
                h('span', { style: { width: search ? '220px' : '120px', overflow: 'hidden' }, text: shown }),
                ...(st.view === 'all' || search || st.partial.includes('size') ? [h('span', { style: { width: '70px', textAlign: 'right' }, text: e.node.t === 'd' ? '' : fmtNum(FS.size(e.node)) })] : []),
                ...(st.view === 'all' || search || st.partial.includes('date') ? [h('span', { style: { width: '70px' }, text: fmtDate(e.node.d) })] : []),
                ...(st.view === 'all' || search || st.partial.includes('time') ? [h('span', { style: { width: '78px' }, text: fmtTime(e.node.d) })] : []),
                ...(st.view === 'all' || search ? [h('span', { text: e.node.t === 'd' ? '' : 'a' })] : [])) : shown);
            row.addEventListener('pointerdown', ev => dw.itemDown(ev, i));
            row.addEventListener('dblclick', () => dw.open());
            (col || list).appendChild(row);
          });
          dw.rows = [...list.querySelectorAll('.it')];
          updateStatus();
        };

        dw.select = (i, add) => {
          if (!add) dw.sel.clear();
          if (dw.sel.has(i) && add) dw.sel.delete(i); else dw.sel.add(i);
          dw.cur = i;
          dw.rows.forEach((r, j) => { r.classList.toggle('sel', dw.sel.has(j)); r.classList.toggle('cur', j === i); });
          const r = dw.rows[i]; if (r) r.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          updateStatus();
        };

        dw.itemDown = (ev, i) => {
          if (ev.button !== 0) return;
          list.focus();
          if (ev.shiftKey) { dw.sel.clear(); const a = Math.min(dw.cur, i), z = Math.max(dw.cur, i); for (let k = a; k <= z; k++) dw.sel.add(k); dw.select(i, true); dw.sel.add(i); dw.rows.forEach((r, j) => r.classList.toggle('sel', dw.sel.has(j))); return; }
          if (!(ev.ctrlKey || ev.metaKey) && dw.sel.has(i) && dw.sel.size > 1) { /* keep for drag */ } else dw.select(i, ev.ctrlKey || ev.metaKey);
          const sx = ev.clientX, sy = ev.clientY;
          let ghost = null;
          const el = ev.currentTarget;
          el.setPointerCapture(ev.pointerId);
          const mv = e2 => {
            if (!ghost && Math.abs(e2.clientX - sx) + Math.abs(e2.clientY - sy) < 6) return;
            if (!ghost) { ghost = h('div', { style: { position: 'absolute', zIndex: 99990, pointerEvents: 'none' } }, iconImg(dw.sel.size > 1 ? 'doc' : 's_file', dw.sel.size > 1 ? 32 : 16)); Sys.screen.appendChild(ghost); }
            const p = Sys.pointer(e2); ghost.style.left = p.x + 4 + 'px'; ghost.style.top = p.y + 4 + 'px';
          };
          const up = async e2 => {
            el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up);
            if (!ghost) return;
            ghost.remove();
            const hit = document.elementsFromPoint(e2.clientX, e2.clientY).find(x => x.dataset && x.dataset.path);
            if (!hit) return;
            const target = hit.dataset.path;
            const items = dw.selected();
            const copy = e2.ctrlKey;
            const r = await msgBox(`Are you sure you want to ${copy ? 'copy' : 'move'} the selected files or directories into ${target}?`, 'Confirm Mouse Operation', { buttons: 'yesno', icon: 'question', owner: fm });
            if (r !== 'yes') return;
            for (const it of items) { try { if (!target.startsWith(it.full)) FS.copy(it.full, target, null, !copy); } catch (er) { await msgBox(er.message, 'File Manager', { icon: 'exclaim', owner: fm }); } }
          };
          el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
        };

        dw.setDir = path => {
          dw.dir = path; dw.sel.clear(); dw.cur = 0;
          dw.expanded.add(path);
          win.setTitle(search ? `Search Results: ${search.spec}` : `${path.replace(/\\$/, '')}\\*.*`);
          dw.renderTree(); dw.renderList();
          if (dw.rows.length && dw.entries().length) dw.select(0);
        };

        dw.open = () => {
          const it = dw.selected()[0];
          if (!it) return;
          if (it.node.t === 'd') { dw.setDir(it.full); return; }
          const w = Sys.launch(it.full, { cwd: FS.dirname(it.full), caller: 'File Manager', owner: fm });
          if (w && st.minOnUse) fm.minimize();
        };

        dw.key = (e, name) => {
          const inTree = document.activeElement === tree;
          if (name === 'Tab') { (inTree ? list : tree).focus(); return true; }
          if (inTree) {
            const rows = dw.treeRows, i = rows.indexOf(dw.dir);
            if (name === 'Down' && i < rows.length - 1) dw.setDir(rows[i + 1]);
            else if (name === 'Up' && i > 0) dw.setDir(rows[i - 1]);
            else if (name === 'Left' && dw.dir !== 'C:\\') dw.setDir(FS.dirname(dw.dir));
            else if (name === 'Enter' || e.key === '+') { dw.expanded.has(dw.dir) && dw.dir !== 'C:\\' ? dw.expanded.delete(dw.dir) : dw.expanded.add(dw.dir); dw.renderTree(); }
            else if (e.key === '-') { if (dw.dir !== 'C:\\') dw.expanded.delete(dw.dir); dw.renderTree(); }
            else return false;
            return true;
          }
          const n = dw.rows.length;
          if (!n) return false;
          const perCol = st.view === 'name' && !search ? Math.max(1, Math.floor(list.clientHeight / 16)) : 1;
          let i = dw.cur;
          if (name === 'Down') i++; else if (name === 'Up') i--;
          else if (name === 'Right') i += perCol; else if (name === 'Left') i -= perCol;
          else if (name === 'Home') i = 0; else if (name === 'End') i = n - 1;
          else if (name === 'Backspace' && dw.dir !== 'C:\\') { dw.setDir(FS.dirname(dw.dir)); return true; }
          else return false;
          dw.select(clamp(i, 0, n - 1));
          return true;
        };

        dw.restyle = () => { tree.style.font = listFont(); list.style.font = listFont(); };
        dw.refresh = () => {
          if (!search && !FS.isDir(dw.dir)) dw.dir = 'C:\\';
          const keepSel = new Set(dw.sel);
          dw.renderTree(); dw.renderList();
          dw.sel = new Set([...keepSel].filter(i => i < dw.rows.length));
          dw.rows.forEach((r, j) => r.classList.toggle('sel', dw.sel.has(j)));
        };

        tree.addEventListener('focus', () => {});
        dws.push(dw);
        dw.setDir(startDir);
        win.activate();
        return dw;
      };

      /* ---------------- operations ---------------- */
      const need = () => { const dw = active(); const s = dw && dw.selected(); if (!s || !s.length) { Snd.beep(); return null; } return s; };

      const pathDlg = (title, label, init, extra) => new Promise(res => dialog({
        title, w: 350, h: extra ? 104 : 80, owner: fm,
        build(d) {
          const dw = active();
          d.add(h('div', { class: 'txt', text: 'Current Directory: ' + (dw ? dw.dir : 'C:\\') }), 10, 8);
          if (extra) d.add(h('div', { class: 'txt', text: extra }), 10, 30);
          const t = UI.text(init);
          d.add(UI.label(label, t), 10, extra ? 58 : 36); d.add(t, 70, extra ? 54 : 32, 180);
          d.add(UI.button('OK', { default: true, onClick: () => d.close(t.value.trim()) }), 262, 8, 80, 25);
          d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close(null) }), 262, 38, 80, 25);
        }
      }).promise.then(res));

      const moveCopy = async copy => {
        const s = need(); if (!s) return;
        const dw = active();
        const t = await pathDlg(copy ? 'Copy' : 'Move', '&To:', dw.dir, `From: ${s.map(x => x.name.toLowerCase()).join(' ')}`);
        if (!t) return;
        for (const it of s) {
          try { FS.copy(it.full, FS.full(t, dw.dir), null, !copy); }
          catch (e) { await msgBox(`Cannot ${copy ? 'copy' : 'move'} ${it.name}: ${e.message}`, copy ? 'Error Copying File' : 'Error Moving File', { icon: 'stop', owner: fm }); break; }
        }
      };
      const del = async () => {
        const s = need(); if (!s) return;
        for (const it of s) {
          if (st.confirmDel) {
            const r = await msgBox(`Delete ${it.node.t === 'd' ? 'directory' : 'file'} ${it.full}?`, 'Confirm ' + (it.node.t === 'd' ? 'Directory' : 'File') + ' Delete', { buttons: 'yesnocancel', icon: 'question', owner: fm });
            if (r === 'cancel') return;
            if (r === 'no') continue;
          }
          if (it.full.toUpperCase().startsWith('C:\\WINDOWS') && it.node.t === 'd' && it.full.split('\\').length <= 3) {
            await msgBox(`Cannot delete ${it.name}: Access denied.`, 'Error Deleting File', { icon: 'stop', owner: fm }); continue;
          }
          try { FS.remove(it.full); } catch (e) { await msgBox(e.message, 'Error Deleting File', { icon: 'stop', owner: fm }); }
        }
      };
      const rename = async () => {
        const s = need(); if (!s) return;
        const t = await pathDlg('Rename', '&To:', s[0].name.toLowerCase(), `From: ${s[0].name.toLowerCase()}`);
        if (!t || t.toUpperCase() === s[0].name) return;
        try { FS.rename(s[0].full, t); } catch (e) { msgBox(`Cannot rename ${s[0].name}: ${e.message}`, 'Error Renaming File', { icon: 'stop', owner: fm }); }
      };
      const mkdir = async () => {
        const dw = active(); if (!dw) return;
        const t = await pathDlg('Create Directory', '&Name:', '');
        if (!t) return;
        try { FS.mkdir(FS.full(t, dw.dir)); } catch (e) { msgBox(`Unable to create directory.\n${e.message}`, 'Create Directory', { icon: 'stop', owner: fm }); }
      };
      const props = () => {
        const s = need(); if (!s) return;
        const it = s[0];
        dialog({
          title: 'Properties for ' + it.name, w: 360, h: 150, owner: fm,
          build(d) {
            const rows = [['File Name:', it.name.toLowerCase()], ['Size:', fmtNum(FS.size(it.node)) + ' bytes'], ['Last Change:', `${fmtDate(it.node.d)}  ${fmtTime(it.node.d)}`], ['Path:', FS.dirname(it.full).toLowerCase()]];
            rows.forEach(([a, v], i) => { d.add(UI.label(a), 10, 10 + i * 20); d.add(h('div', { class: 'txt', text: v }), 100, 10 + i * 20); });
            const g = UI.group('Attributes'); d.add(g, 10, 92, 250, 50);
            ['&Read Only', '&Archive', '&Hidden', '&System'].forEach((a, i) => d.add(UI.check(a, i === 1 && it.node.t === 'f'), 20 + i * 60, 114));
            d.add(UI.button('OK', { default: true, onClick: () => d.close() }), 272, 8, 80, 25);
            d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 272, 38, 80, 25);
          }
        });
      };
      const runDlg = async () => {
        const dw = active();
        const s = dw && dw.selected()[0];
        const t = await pathDlg('Run', '&Command Line:', s && s.node.t === 'f' ? s.name.toLowerCase() : '');
        if (t) Sys.launch(t, { cwd: dw ? dw.dir : 'C:\\WINDOWS', caller: 'File Manager', owner: fm });
      };
      const associate = () => {
        const s = active() && active().selected()[0];
        const ext0 = s && s.node.t === 'f' ? FS.ext(s.name).toLowerCase() : '';
        dialog({
          title: 'Associate', w: 360, h: 180, owner: fm,
          build(d) {
            const ext = UI.text(ext0);
            const apps = Object.values(Sys.apps).filter(a => FS.which(a.id === 'dos' ? 'DOSPRMPT.PIF' : '') || true)
              .map(a => { const exe = Object.entries(FS.get('C:\\WINDOWS').c).find(([, n]) => n.a === a.id); return exe ? { text: `${a.name} (${exe[0].toLowerCase()})`, exe: exe[0].toLowerCase() } : null; })
              .filter(Boolean);
            const list = [{ text: '(None)', exe: '' }, ...apps];
            const lb = UI.listbox({ items: list });
            const sync = () => { const a = Sys.association('X.' + ext.value); const i = list.findIndex(x => a && x.exe.toUpperCase() === a); lb.select(i >= 0 ? i : 0, false); };
            ext.addEventListener('input', sync);
            d.add(UI.label('Files with E&xtension:', ext), 10, 12); d.add(ext, 140, 8, 60);
            d.add(UI.label('&Associate With:', lb), 10, 40); d.add(lb, 10, 58, 250, 112);
            d.add(UI.button('OK', { default: true, onClick: () => {
              const e = ext.value.trim().toLowerCase().replace(/^\./, '');
              if (!e) return d.close();
              const v = lb.value;
              writeIni('C:\\WINDOWS\\WIN.INI', 'Extensions', e, v && v.exe ? `${v.exe} ^.${e}` : '');
              d.close();
            } }), 272, 8, 80, 25);
            d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 272, 38, 80, 25);
            sync();
          }
        });
      };
      const search = () => dialog({
        title: 'Search', w: 360, h: 100, owner: fm,
        build(d) {
          const spec = UI.text('*.*'), from = UI.text(active() ? active().dir : 'C:\\');
          const sub = UI.check('&Search All Subdirectories', true);
          d.add(UI.label('Search &For:', spec), 10, 12); d.add(spec, 90, 8, 160);
          d.add(UI.label('S&tart From:', from), 10, 42); d.add(from, 90, 38, 160);
          d.add(sub, 90, 72);
          d.add(UI.button('OK', { default: true, onClick: () => {
            const sp = spec.value.trim() || '*.*';
            const root = FS.full(from.value.trim() || 'C:\\');
            const re = DosShell.prototype.patternRe(sp);
            const results = [];
            const walk = p => { for (const e of FS.list(p) || []) { const full = FS.join(p, e.name); if (re.test(e.name)) results.push(full); if (e.node.t === 'd' && sub.input.checked) walk(full); } };
            walk(root);
            d.close();
            makeDirWin(root, { spec: FS.join(root, sp), results });
          } }), 272, 8, 80, 25);
          d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 272, 38, 80, 25);
        }
      });
      const selectFiles = () => dialog({
        title: 'Select Files', w: 300, h: 70, owner: fm, modal: false,
        build(d) {
          const t = UI.text('*.*');
          d.add(UI.label('&File(s):', t), 10, 12); d.add(t, 60, 8, 130);
          d.add(UI.button('&Select', { default: true, onClick: () => { const dw = active(); if (!dw) return; const re = DosShell.prototype.patternRe(t.value); dw.entries().forEach((e, i) => { if (re.test(e.name)) dw.sel.add(i); }); dw.rows.forEach((r, j) => r.classList.toggle('sel', dw.sel.has(j))); updateStatus(); } }), 210, 6, 80, 25);
          d.add(UI.button('&Deselect', { onClick: () => { const dw = active(); if (!dw) return; dw.sel.clear(); dw.rows.forEach(r => r.classList.remove('sel')); updateStatus(); } }), 210, 36, 80, 25);
        }
      });
      const diskMsg = () => msgBox('There is no disk in drive A.\n\nInsert a disk, and then try again.', 'File Manager', { icon: 'exclaim', owner: fm });
      const setView = v => () => { st.view = v; saveOpts(); dws.forEach(d => d.renderList()); };
      const setSort = v => () => { st.sort = v; saveOpts(); dws.forEach(d => d.renderList()); };
      const setPane = v => () => { st.pane = v; saveOpts(); dws.forEach(d => d.renderList()); };

      const saved = st.saveOnExit ? Store.get('wf.layout') : null;
      fm = new Win({
        title: 'File Manager', icon: 'winfile', w: saved ? saved.w : Math.round(Sys.desktop.W * 0.8), h: saved ? saved.h : Math.round(Sys.desktop.H * 0.75), x: saved ? saved.x : undefined, y: saved ? saved.y : undefined,
        onClose: () => {
          if (st.saveOnExit) {
            const r = fm.isMax || fm.isMin ? fm.normalRect : { x: fm.x, y: fm.y, w: fm.w, h: fm.h };
            Store.set('wf.layout', { ...r, max: fm.isMax, dirs: dws.filter(d => !d.search).map(d => d.dir) });
          }
          return true;
        },
        menu: [
          { label: '&File', items: [
            { label: '&Open', key: 'Enter', action: () => active() && active().open() },
            { label: '&Move...', key: 'F7', action: () => moveCopy(false) },
            { label: '&Copy...', key: 'F8', action: () => moveCopy(true) },
            { label: '&Delete...', key: 'Del', action: del },
            { label: 'Re&name...', action: rename },
            { label: 'Proper&ties...', key: 'Alt+Enter', action: props }, '-',
            { label: '&Run...', action: runDlg },
            { label: '&Print...', action: () => { const s = need(); if (s) printDoc('File Manager', s[0].name, FS.read(s[0].full) || '', fm); } },
            { label: '&Associate...', action: associate }, '-',
            { label: 'Cr&eate Directory...', action: mkdir },
            { label: '&Import files from computer...', action: () => HostFiles.importFiles(active()?.dir || 'C:\\', fm) },
            { label: '&Export selected file...', action: () => { const s = need(); if (s) HostFiles.exportFile(s[0].full, fm); } },
            { label: 'Searc&h...', action: search },
            { label: '&Select Files...', action: selectFiles }, '-',
            { label: 'E&xit', action: () => fm.close() }] },
          { label: '&Disk', items: [{ label: '&Copy Disk...', action: diskMsg }, { label: '&Label Disk...', action: () => msgBox('Volume label: MS-DOS_6', 'Label Disk', { owner: fm }) }, { label: '&Format Disk...', action: diskMsg }, { label: '&Make System Disk...', action: diskMsg }, '-', { label: 'Select &Drive...', action: () => {} }] },
          { label: '&Tree', items: [
            { label: 'E&xpand One Level', key: '+', action: () => { const dw = active(); if (dw) { dw.expanded.add(dw.dir); dw.renderTree(); } } },
            { label: 'Expand &Branch', key: '*', action: () => { const dw = active(); if (!dw) return; const walk = p => { dw.expanded.add(p); for (const e of FS.list(p) || []) if (e.node.t === 'd') walk(FS.join(p, e.name)); }; walk(dw.dir); dw.renderTree(); } },
            { label: 'Expand &All', key: 'Ctrl+*', action: () => { const dw = active(); if (!dw) return; const walk = p => { dw.expanded.add(p); for (const e of FS.list(p) || []) if (e.node.t === 'd') walk(FS.join(p, e.name)); }; walk('C:\\'); dw.renderTree(); } },
            { label: '&Collapse Branch', key: '-', action: () => { const dw = active(); if (dw && dw.dir !== 'C:\\') { dw.expanded.delete(dw.dir); dw.renderTree(); } } }] },
          { label: '&View', items: [
            { label: 'T&ree and Directory', checked: () => st.pane === 'both', action: setPane('both') }, { label: 'Tr&ee Only', checked: () => st.pane === 'tree', action: setPane('tree') }, { label: 'Directory &Only', checked: () => st.pane === 'directory', action: setPane('directory') }, '-',
            { label: '&Name', checked: () => st.view === 'name', action: setView('name') },
            { label: '&All File Details', checked: () => st.view === 'all', action: setView('all') },
            { label: '&Partial Details...', action: () => dialog({ title: 'Partial Details', w: 210, h: 125, owner: fm, build(d) {
              const checks = ['size', 'date', 'time'].map((v, i) => UI.check(['&Size', '&Date', '&Time'][i], st.partial.includes(v)));
              checks.forEach((c, i) => d.add(c, 14, 12 + i * 22));
              d.add(UI.button('OK', { default: true, onClick: () => { st.partial = ['size', 'date', 'time'].filter((v, i) => checks[i].input.checked); st.view = 'partial'; saveOpts(); d.close(); dws.forEach(x => x.renderList()); } }), 120, 8, 78, 25);
              d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 120, 38, 78, 25);
            } }) }, '-',
            { label: '&Sort by Name', checked: () => st.sort === 'name', action: setSort('name') },
            { label: 'Sort &by Type', checked: () => st.sort === 'type', action: setSort('type') },
            { label: 'Sort by Si&ze', checked: () => st.sort === 'size', action: setSort('size') },
            { label: 'Sort by &Date', checked: () => st.sort === 'date', action: setSort('date') }] },
          { label: '&Options', items: [
            { label: '&Confirmation...', action: () => dialog({ title: 'Confirmation', w: 260, h: 110, owner: fm, build(d) {
              const c = UI.check('File &Delete', st.confirmDel); d.add(c, 14, 14);
              ['Di&rectory Delete', 'File &Replace', '&Mouse Action', 'Disk &Commands'].forEach((l, i) => d.add(UI.check(l, true), 14, 34 + i * 18));
              d.add(UI.button('OK', { default: true, onClick: () => { st.confirmDel = c.input.checked; saveOpts(); d.close(); } }), 170, 8, 80, 25);
              d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 170, 38, 80, 25);
            } }) },
            { label: '&Font...', action: () => dialog({ title: 'Font', w: 320, h: 160, owner: fm, build(d) {
              const faces = ['Courier', 'Fixedsys', 'MS Sans Serif', 'Small Fonts', 'System'];
              const fl = UI.listbox({ items: faces, onSelect: () => upd() }); fl.selectText(st.font);
              const low = UI.check('&Lowercase', st.lower, () => upd());
              const sample = h('div', { style: { border: '1px solid #000', background: '#fff', textAlign: 'center', lineHeight: '40px', overflow: 'hidden' } });
              const upd = () => { const f = fl.value ? fl.value.text : st.font; sample.style.font = `${WIN_FONT_PX[f]}px/40px ${WIN_FONTS[f]}`; sample.textContent = low.input.checked ? 'aabbyyzz' : 'AaBbYyZz'; };
              d.add(UI.label('&Font:', fl), 8, 6); d.add(fl, 8, 24, 150, 90); d.add(low, 8, 124);
              d.add(UI.label('Sample'), 168, 70); d.add(sample, 168, 88, 144, 44);
              d.add(UI.button('OK', { default: true, onClick: () => { st.font = fl.value ? fl.value.text : st.font; st.lower = low.input.checked; saveOpts(); d.close(); dws.forEach(x => { x.restyle(); x.refresh(); }); } }), 232, 8, 80, 25);
              d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 232, 38, 80, 25);
              upd();
            } }) }, '-',
            { label: '&Status Bar', checked: () => st.status, action: () => { st.status = !st.status; saveOpts(); updateStatus(); } },
            { label: '&Minimize on Use', checked: () => st.minOnUse, action: () => { st.minOnUse = !st.minOnUse; saveOpts(); } },
            { label: 'Save Settings on &Exit', checked: () => st.saveOnExit, action: () => { st.saveOnExit = !st.saveOnExit; saveOpts(); } }] },
          { label: '&Window', items: () => [
            { label: '&New Window', action: () => makeDirWin(active() ? active().dir : 'C:\\WINDOWS') },
            { label: '&Cascade', key: 'Shift+F5', action: () => fm.mdiClient.cascade() },
            { label: '&Tile', key: 'Shift+F4', action: () => fm.mdiClient.tile() },
            { label: '&Arrange Icons', action: () => fm.mdiClient.arrangeIcons() }, '-',
            { label: '&Refresh', key: 'F5', action: () => dws.forEach(d => d.refresh()) }, '-',
            ...dws.map((d, i) => ({ label: `&${i + 1} ${d.win.title}`, checked: () => active() === d, action: () => d.win.isMin ? d.win.restore() : d.win.activate() }))] },
          { label: '&Help', items: [{ label: '&Contents', action: () => Sys.launch('WINHELP.EXE winfile') }, { label: '&Search for Help on...', action: () => Sys.launch('WINHELP.EXE winfile') }, { label: '&How to Use Help', action: () => Sys.launch('WINHELP.EXE winhelp') }, '-', { label: '&About File Manager...', action: () => aboutBox('File Manager', 'winfile', fm) }] }
        ]
      });
      fm.body.style.display = 'flex'; fm.body.style.flexDirection = 'column';
      const client = h('div', { style: { position: 'relative', flex: 1, background: 'var(--app-workspace)' } });
      fm.body.append(client, status);
      fm.createMdiClient(client);
      fm.on('resize', () => fm.mdiClient.relayout());
      const dirs = saved && saved.dirs && saved.dirs.filter(p => FS.isDir(p));
      (dirs && dirs.length ? dirs : ['C:\\WINDOWS']).forEach(p => makeDirWin(p));
      if (saved && saved.max) setTimeout(() => fm.maximize(), 0);
      const off = FS.on('change', () => { clearTimeout(fm._rt); fm._rt = setTimeout(() => dws.forEach(d => d.refresh()), 30); });
      fm.on('closed', off);
      updateStatus();
      return fm;
    }
  });
})();
