'use strict';
/* The host browser is only accessed through explicit file-picker/download actions. */
const HostFiles = {
  maxBytes: 16 * 1024 * 1024,
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
      if (!n || n.t !== 'f') throw new Error('Select a file to export. Folders can\'t be exported.');
      let name = FS.displayName(FS.basename(path), n), content = n.x ?? '';
      if (n.g && FS.ext(path) === 'BMP') content = Wallpapers.gen(n.g)?.toDataURL() || content;
      if (content.startsWith('PCM8:') || (n.g && Snd.gen[n.g])) {
        const sound = content.startsWith('PCM8:') ? Snd.decode(content) : { rate: Snd.rate, data: Snd.samples(n.g) };
        this.download(name.replace(/\.[^.]*$/, '') + '.wav', this.wave(sound), 'audio/wav');
      } else if (n.s && !content) {
        throw new Error('This is a simulated system file with no exportable contents.');
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
  }
};
