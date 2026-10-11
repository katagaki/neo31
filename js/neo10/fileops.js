'use strict';
/* File operations shared by the Neo10 desktop and File Explorer:
   names, types, icons, open, Recycle Bin, rename, cut/copy/paste, properties. */

const FileOps = {
  TYPES: {
    TXT: 'Text Document', HTM: 'HTML Document', HTML: 'HTML Document', INI: 'Configuration settings', LOG: 'Text Document', BAT: 'Windows Batch File', SYS: 'System file',
    EXE: 'Application', COM: 'MS-DOS Application', PIF: 'Shortcut to MS-DOS Program', DLL: 'Application extension', DRV: 'Device driver',
    BMP: 'Bitmap image', PCX: 'PCX image', WRI: 'Write Document', WAV: 'Wave Sound', MID: 'MIDI Sequence', HLP: 'Help file',
    CRD: 'Cardfile Document', CAL: 'Calendar File', TRM: 'Terminal Settings', FON: 'Font file', TTF: 'TrueType font file', FOT: 'Font resource',
    GRP: 'Program Group', SCR: 'Screen saver', CLP: 'Clipboard File', '386': 'Virtual device driver', '3GR': 'Grabber'
  },
  shownName(key, node) { return FS.displayName(key, node); },
  typeName(name, node) {
    if (node && node.t === 'd') return 'File folder';
    const e = FS.ext(name);
    return this.TYPES[e] || (e ? e + ' File' : 'File');
  },
  iconFor(name, node, size = 16) {
    const big = size >= 32;
    if (node && node.t === 'd') {
      const special = { DESKTOP: 'fdesk', DOCUMENTS: 'fdocs', DOWNLOADS: 'fdown', PICTURES: 'fpics', MUSIC: 'fmusic' }[name];
      return big ? (special || 'folder') : 's_folder';
    }
    const e = FS.ext(name);
    if (node && node.a) { const app = Sys.apps[node.a]; return big ? (app && app.icon) || 'app' : 's_exe'; }
    if (['EXE', 'COM', 'BAT', 'PIF'].includes(e)) return big ? 'app' : 's_exe';
    const bigMap = { HTM: 'edge', HTML: 'edge', TXT: 'notepad', INI: 'notepad', LOG: 'notepad', WRI: 'wri', BMP: 'bmp', PCX: 'bmp', WAV: 'wav', MID: 'mplayer', HLP: 'help', CRD: 'cardfile', CAL: 'calendar', TRM: 'terminal' };
    if (big) return bigMap[e] || 'doc';
    return Sys.association(name) ? 's_doc' : 's_file';
  },

  open(path) {
    const n = FS.get(path);
    if (!n) { msgBox(`Windows can't find '${path}'. Make sure you typed the name correctly, and then try again.`, 'File Explorer', { icon: 'stop' }); return; }
    if (n.t === 'd') return Sys.run('explorer', { args: path });
    return Sys.launch(path, { cwd: FS.dirname(path), caller: 'File Explorer' });
  },

  uniqueName(dir, base) {
    const dot = base.lastIndexOf('.');
    const stem = dot > 0 ? base.slice(0, dot) : base, ext = dot > 0 ? base.slice(dot) : '';
    let name = base, i = 2;
    while (FS.exists(FS.join(dir, name))) name = `${stem} (${i++})${ext}`;
    return name;
  },

  rename(path, to) {
    try { FS.rename(path, to); return true; }
    catch (e) { msgBox(e.message === 'Invalid file name' ? 'A file name can\'t contain any of the following characters:\n\\ / : * ? " < > |' : e.message, 'Rename', { icon: 'stop' }); return false; }
  },

  /* Delete goes to the Recycle Bin (C:\RECYCLED); Shift+Delete deletes for good */
  async recycle(paths, permanent, owner) {
    paths = paths.filter(p => FS.exists(p) && !p.toUpperCase().startsWith(KNOWN.recycle));
    if (!paths.length) return false;
    const what = paths.length === 1 ? `this ${FS.isDir(paths[0]) ? 'folder' : 'file'}` : `these ${paths.length} items`;
    const sysPath = paths.find(p => /^C:\\(WINDOWS|DOS|USERS)(\\(SYSTEM|USER(\\[^\\]+)?))?$/i.test(p) || /^C:\\(COMMAND\.COM|AUTOEXEC\.BAT|CONFIG\.SYS)$/i.test(p));
    if (sysPath) { await msgBox(`You need permission to perform this action.\n\n${sysPath} is used by Windows.`, 'Access Denied', { icon: 'stop', owner }); return false; }
    const r = await msgBox(permanent ? `Are you sure you want to permanently delete ${what}?` : `Are you sure you want to move ${what} to the Recycle Bin?`,
      permanent ? 'Delete File' : 'Delete File', { buttons: 'yesno', icon: permanent ? 'exclaim' : 'question', owner });
    if (r !== 'yes') return false;
    for (const p of paths) {
      try {
        if (permanent) FS.remove(p);
        else {
          const node = FS.get(p), id = 'D' + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random() * 36).toString(36).toUpperCase();
          const target = FS.join(KNOWN.recycle, id + (FS.ext(p) ? '.' + FS.ext(p) : ''));
          node.orig = p; node.origName = FS.displayName(FS.basename(p), node); node.del = Date.now();
          FS.copy(p, target, null, true);
        }
      } catch (e) { await msgBox(e.message, 'Delete File', { icon: 'stop', owner }); }
    }
    return true;
  },
  restore(binPath) {
    const n = FS.get(binPath);
    if (!n || !n.orig) return;
    let target = n.orig;
    if (!FS.isDir(FS.dirname(target))) target = FS.join(KNOWN.desktop, FS.basename(target));
    if (FS.exists(target)) target = FS.join(FS.dirname(target), this.uniqueName(FS.dirname(target), n.origName || FS.basename(target)));
    const name = n.origName; delete n.orig; delete n.del; delete n.origName;
    FS.copy(binPath, target, null, true);
    const m = FS.get(target); if (m && name && name !== name.toUpperCase()) { m.n = FS.basename(target) === name.toUpperCase() ? name : m.n; FS.save(); }
  },
  async emptyRecycle(owner) {
    const ls = FS.list(KNOWN.recycle) || [];
    if (!ls.length) return;
    const r = await msgBox(`Are you sure you want to permanently delete ${ls.length === 1 ? 'this item' : `these ${ls.length} items`}?`, 'Delete Multiple Items', { buttons: 'yesno', icon: 'exclaim', owner });
    if (r !== 'yes') return;
    for (const e of ls) FS.remove(FS.join(KNOWN.recycle, e.name));
  },

  properties(path, owner) {
    const n = FS.get(path);
    if (!n) return;
    const name = this.shownName(FS.basename(path), n);
    const count = (node => { let f = 0, d = 0; const walk = x => { for (const c of Object.values(x.c || {})) { if (c.t === 'd') { d++; walk(c); } else f++; } }; walk(node); return { f, d }; })(n);
    const fmtSize = b => `${b < 1024 ? b + ' bytes' : (b / 1024).toFixed(1) + ' KB'} (${fmtNum(b)} bytes)`;
    dialog({
      title: name + ' Properties', w: 330, h: 260, owner,
      build(d) {
        const icon = iconImg(FileOps.iconFor(FS.basename(path), n, 32));
        d.add(icon, 14, 12);
        const t = UI.text(name); d.add(t, 70, 14, 240);
        d.add(h('div', { style: { borderTop: '1px solid #808080' } }), 10, 50, 310, 1);
        const rows = [['Type:', FileOps.typeName(FS.basename(path), n)], ['Location:', FS.dirname(path)],
          ['Size:', fmtSize(FS.size(n))], ...(n.t === 'd' ? [['Contains:', `${count.f} Files, ${count.d} Folders`]] : []),
          ['Modified:', `${Intl31.longDate(new Date(n.d || WIN_DATE))}, ${Intl31.time(new Date(n.d || WIN_DATE), true)}`]];
        rows.forEach(([a, b], i) => { d.add(UI.label(a), 14, 60 + i * 22); d.add(h('div', { class: 'txt', style: { whiteSpace: 'nowrap', overflow: 'hidden', width: '220px' }, text: b }), 96, 60 + i * 22); });
        d.add(h('div', { style: { borderTop: '1px solid #808080' } }), 10, 176, 310, 1);
        const ro = UI.check('&Read-only', !!n.ro), hid = UI.check('&Hidden', !!n.h);
        d.add(UI.label('Attributes:'), 14, 188); d.add(ro, 96, 188); d.add(hid, 200, 188);
        d.add(UI.button('OK', { default: true, onClick: () => {
          n.ro = ro.input.checked || undefined; n.h = hid.input.checked || undefined;
          const nn = t.value.trim();
          if (nn && nn !== name) FileOps.rename(path, nn); else FS.save();
          d.close();
        } }), 160, 226, 76, 25);
        d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 244, 226, 76, 25);
      }
    });
  }
};

/* The file clipboard (Cut/Copy/Paste in Explorer and on the desktop) */
const FileClip = {
  items: [], cut: false,
  set(paths, cut) { this.items = paths.slice(); this.cut = cut; Sys.setClipboard({ type: 'text', data: paths.join('\n') }); },
  async paste(dir) {
    if (!this.items.length) return;
    for (const p of this.items) {
      if (!FS.exists(p)) continue;
      if (FS.full(dir).startsWith(FS.full(p) + '\\') || FS.full(dir) === FS.full(p)) { await msgBox('The destination folder is a subfolder of the source folder.', 'Interrupted Action', { icon: 'stop' }); continue; }
      const node = FS.get(p), shown = FS.displayName(FS.basename(p), node);
      let name = shown;
      if (FS.exists(FS.join(dir, name))) {
        if (this.cut && FS.dirname(p) === FS.full(dir)) continue;
        name = FileOps.uniqueName(dir, shown.replace(/(\.[^.]*)?$/, m => ' - Copy' + m));
      }
      try {
        FS.copy(p, FS.join(dir, name), null, this.cut);
        const m = FS.get(FS.join(dir, name)); if (m && name !== name.toUpperCase()) { m.n = name; FS.save(); }
      } catch (e) { await msgBox(e.message, 'File Explorer', { icon: 'stop' }); }
    }
    if (this.cut) this.items = [];
  }
};
