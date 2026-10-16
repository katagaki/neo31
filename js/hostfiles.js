'use strict';
/* The host browser is only accessed through explicit file-picker/download actions. */
const HostFiles = {
  maxBytes: 16 * 1024 * 1024,
  maxBackupBytes: 128 * 1024 * 1024,
  download(name, content, type = 'application/octet-stream') {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  },
  pick(accept = '', multiple = false) {
    return new Promise(resolve => {
      const input = h('input', { type: 'file', accept, multiple, style: { display: 'none' } });
      const finish = files => { input.remove(); resolve(files); };
      input.addEventListener('change', () => finish([...input.files]), { once: true });
      input.addEventListener('cancel', () => finish([]), { once: true });
      document.body.appendChild(input); input.click();
    });
  },
  async importFiles(dir, owner) {
    const files = await this.pick('', true);
    if (!files.length) return;
    let count = 0;
    for (const file of files) {
      try {
        if (file.size > this.maxBytes) throw new Error('This file is too large. Choose a file smaller than 16 MB.');
        let name = file.name;
        if (!VFS.validName(name)) {
          const ext = FS.ext(name).replace(/[^A-Z0-9]/g, '').slice(0, 3);
          name = name.replace(/\.[^.]*$/, '').replace(/[^A-Z0-9_-]/gi, '_').slice(0, 8) || 'IMPORT';
          if (ext) name += '.' + ext;
        }
        name = FileOps.uniqueName(dir, name);
        // In the classic shell, keep collision suffixes within DOS 8.3 limits.
        if (!VFS.validName(name)) {
          const ext = FS.ext(name).slice(0, 3), stem = FS.basename(name).split('.')[0].slice(0, 5);
          let i = 1; do { name = stem + '~' + i++ + (ext ? '.' + ext : ''); } while (FS.exists(FS.join(dir, name)));
        }
        const text = /^(TXT|INI|LOG|BAT|SYS|HTM|HTML|WRI|CRD|CAL|TRM|JSON|CSV|MD)$/i.test(FS.ext(file.name));
        let content, extra = {};
        if (text) content = await file.text();
        else {
          const bytes = new Uint8Array(await file.arrayBuffer());
          let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
          const imageType = { PNG: 'image/png', JPG: 'image/jpeg', JPEG: 'image/jpeg', GIF: 'image/gif', BMP: 'image/bmp', WEBP: 'image/webp' }[FS.ext(file.name)];
          const type = imageType || 'application/octet-stream';
          content = `data:${type};base64,${btoa(binary)}`;
          extra = { encoding: 'data-url', s: file.size };
        }
        FS.write(FS.join(dir, name), content, extra); count++;
      } catch (e) { await msgBox(`Could not import ${file.name}.\n${e.message}`, 'Import files', { owner, icon: 'stop' }); }
    }
    if (count) { FS.flush(); await msgBox(`${count} file${count === 1 ? '' : 's'} imported into ${dir}.`, 'Import files', { owner }); }
  },
  exportFile(path, owner) {
    try {
      const n = FS.get(path);
      if (!n || n.t !== 'f') throw new Error('Select a file to export. Use a PC backup to export folders.');
      let name = FS.displayName(FS.basename(path), n), content = n.x ?? '';
      if (n.g && FS.ext(path) === 'BMP') content = Wallpapers.gen(n.g)?.toDataURL() || content;
      if (content.startsWith('PCM8:') || (n.g && Snd.gen[n.g])) {
        const sound = content.startsWith('PCM8:') ? Snd.decode(content) : { rate: Snd.rate, data: Snd.samples(n.g) };
        this.download(name.replace(/\.[^.]*$/, '') + '.wav', this.wave(sound), 'audio/wav');
      } else if (n.s && !content) {
        throw new Error('This is a simulated system file with no exportable contents. Download a PC backup to preserve it.');
      } else if (/^data:[^,]*;base64,/.test(content)) {
        const [head, body] = content.split(',');
        const bytes = Uint8Array.from(atob(body), c => c.charCodeAt(0));
        const type = head.slice(5).split(';')[0];
        if (type === 'image/png' && !/\.png$/i.test(name)) name = name.replace(/\.[^.]*$/, '') + '.png';
        this.download(name, bytes, type);
      } else this.download(name, content, 'text/plain;charset=utf-8');
    } catch (e) { msgBox(e.message, 'Export file', { owner, icon: 'stop' }); }
  },
  wave({ rate, data }) {
    const bytes = new Uint8Array(44 + data.length), view = new DataView(bytes.buffer);
    const text = (offset, value) => { [...value].forEach((c, i) => bytes[offset + i] = c.charCodeAt(0)); };
    text(0, 'RIFF'); view.setUint32(4, 36 + data.length, true); text(8, 'WAVE'); text(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, rate, true); view.setUint32(28, rate, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
    text(36, 'data'); view.setUint32(40, data.length, true);
    data.forEach((value, i) => bytes[44 + i] = clamp(Math.round(value * 127) + 128, 0, 255));
    return bytes;
  },
  snapshot() { return { format: 'Neo31 Backup', version: 1, created: new Date().toISOString(), cfg: Store.data, fs: FS.root }; },
  backup() { this.download(`Neo31-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(this.snapshot(), null, 2), 'application/json'); },
  validate(backup) {
    const object = x => x && typeof x === 'object' && !Array.isArray(x);
    if (!object(backup) || backup.format !== 'Neo31 Backup' || backup.version !== 1 || !object(backup.cfg)) throw new Error('This is not a supported Neo31 backup.');
    let nodes = 0, files = 0;
    const safe = (value, depth = 0) => {
      if (depth > 64) throw new Error('The backup is too deeply nested.');
      if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('The backup contains an invalid property.');
        safe(item, depth + 1);
      }
    };
    safe(backup);
    const walk = (node, depth) => {
      if (++nodes > 50000 || depth > 32 || !object(node) || !['d', 'f'].includes(node.t)) throw new Error('The backup contains an invalid file tree.');
      if (node.x != null && typeof node.x !== 'string') throw new Error('The backup contains invalid file contents.');
      if (node.t === 'f') { files++; return; }
      if (!object(node.c)) throw new Error('The backup contains an invalid folder.');
      for (const [name, child] of Object.entries(node.c)) {
        if (!VFS.validLong(name) || name !== name.toUpperCase()) throw new Error('The backup contains an invalid file name.');
        walk(child, depth + 1);
      }
    };
    if (backup.fs?.t !== 'd') throw new Error('The backup has no C: drive.');
    walk(backup.fs, 0);
    if (backup.fs.c.WINDOWS?.t !== 'd' || backup.fs.c.DOS?.t !== 'd') throw new Error('The backup is missing the system folders.');
    return { files, nodes };
  },
  async restore(owner) {
    const [file] = await this.pick('.json,application/json');
    if (!file) return;
    try {
      if (file.size > this.maxBackupBytes) throw new Error('The backup is too large (maximum 128 MB).');
      const backup = JSON.parse(await file.text()), summary = this.validate(backup);
      if (await msgBox(`Restore ${summary.files} files and all settings from ${file.name}?\n\nThis replaces your current PC and restarts Neo31. Download a backup first if you want to keep your current files.`, 'Restore PC', { buttons: 'yesno', icon: 'exclaim', owner }) !== 'yes') return;
      this.applyBackup(backup);
      location.hash = '#win'; location.reload();
    } catch (e) { await msgBox(`Could not restore the backup. Your current PC is still active.\n\n${e.message}`, 'Restore PC', { owner, icon: 'stop' }); }
  },
  applyBackup(backup) {
    this.validate(backup);
    // One atomic write: quota or permission errors leave the old snapshot intact.
    const state = JSON.parse(JSON.stringify({ version: 1, cfg: backup.cfg, fs: backup.fs }));
    localStorage.setItem(Store.key + '.fs', JSON.stringify(state));
    clearTimeout(Store._t); clearTimeout(FS._t);
    Store.data = state.cfg; FS.root = state.fs;
    Persistence.clear();
  }
};
