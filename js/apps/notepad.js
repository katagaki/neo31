'use strict';
/* Notepad */

/* "Save changes?" prompt shared by document apps. Resolves 'yes'|'no'|'cancel'. */
function askSave(appName, text, owner) {
  return msgBox(text, appName, { buttons: 'yesnocancel', icon: 'exclaim', owner });
}

(() => {
  Sys.registerApp('notepad', {
    name: 'Notepad', icon: 'notepad', help: 'notepad',
    run(opts) {
      let path = null, dirty = false, wrap = Store.get('np.wrap', false);
      let find = { text: '', caseSens: false, up: false };
      const ta = h('textarea', { class: 'edit', spellcheck: false, wrap: wrap ? 'soft' : 'off' });
      const name = () => path ? FS.basename(path) : '(Untitled)';
      const title = () => w.setTitle('Notepad - ' + name());

      const confirmLose = async () => {
        if (!dirty) return true;
        const r = await askSave('Notepad', `The text in the ${path ? path : '[Untitled]'} file has changed.\n\nDo you want to save the changes?`, w);
        if (r === 'cancel') return false;
        if (r === 'yes') return save();
        return true;
      };
      const load = p => {
        const n = FS.get(p);
        if (!n || n.t !== 'f') { msgBox(`Cannot find the ${p} file.\n\nDo you want to create a new file?`, 'Notepad', { icon: 'question', buttons: 'yesnocancel', owner: w }).then(r => { if (r === 'yes') { path = FS.full(p); ta.value = ''; dirty = false; title(); } }); return; }
        let txt = n.x || '';
        if (!txt && n.s) txt = '\u00ffMZ\u0090\u0000\u0003\u0000\u0000\u0000\u0004\u0000\u0000\u0000\u00ff\u00ff\u0000\u0000\u00b8This program requires Microsoft Windows.';
        if (txt.startsWith('data:') || txt.startsWith('PCM8:')) txt = txt.slice(0, 2000);
        ta.value = txt.replace(/\r/g, '');
        path = FS.full(p); dirty = false; title();
        if (/^\.LOG/.test(ta.value)) {
          ta.value += (ta.value.endsWith('\n') ? '' : '\n') + `${timeStr()} ${dateStr()}\n`;
          dirty = true;
          requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = ta.value.length; ta.scrollTop = ta.scrollHeight; });
        } else ta.setSelectionRange(0, 0);
      };
      const writeTo = p => {
        try { FS.write(p, ta.value); path = FS.full(p); dirty = false; title(); return true; }
        catch (e) { msgBox(`Cannot write to ${p}.\n${e.message}`, 'Notepad', { icon: 'exclaim', owner: w }); return false; }
      };
      const saveAs = async () => {
        const p = await fileDialog({ mode: 'save', owner: w, name: path ? FS.basename(path) : '*.txt', dir: path ? FS.dirname(path) : null, defExt: 'TXT', filters: [['Text Files (*.TXT)', '*.TXT'], ['All Files (*.*)', '*.*']] });
        return p ? writeTo(p) : false;
      };
      const save = async () => path ? writeTo(path) : saveAs();
      const insert = s => {
        ta.focus();
        const a = ta.selectionStart, b = ta.selectionEnd;
        if (!document.execCommand('insertText', false, s)) { ta.setRangeText(s, a, b, 'end'); }
        dirty = true;
      };
      const selText = () => ta.value.slice(ta.selectionStart, ta.selectionEnd);
      const findNext = () => {
        if (!find.text) return findDlg();
        const hay = find.caseSens ? ta.value : ta.value.toLowerCase();
        const nd = find.caseSens ? find.text : find.text.toLowerCase();
        const i = find.up ? hay.lastIndexOf(nd, ta.selectionStart - 1) : hay.indexOf(nd, ta.selectionEnd);
        if (i < 0) { msgBox(`Cannot find "${find.text}"`, 'Notepad', { icon: 'info', owner: w }); return; }
        ta.focus(); ta.setSelectionRange(i, i + find.text.length);
        const lines = ta.value.slice(0, i).split('\n').length;
        ta.scrollTop = Math.max(0, (lines - 3) * 16);
      };
      const findDlg = () => dialog({
        title: 'Find', w: 350, h: 90, owner: w, modal: false,
        build(d) {
          const t = UI.text(find.text || selText());
          const mc = UI.check('Match &Case', find.caseSens);
          const grp = UI.group('Direction');
          const up = UI.radio('npdir', '&Up', find.up), dn = UI.radio('npdir', '&Down', !find.up);
          d.add(UI.label('Fi&nd What:', t), 8, 12); d.add(t, 80, 8, 170);
          d.add(mc, 8, 62); d.add(grp, 150, 38, 100, 46); d.add(up, 160, 58); d.add(dn, 200, 58);
          d.add(UI.button('&Find Next', { default: true, onClick: () => { find = { text: t.value, caseSens: mc.input.checked, up: up.input.checked }; findNext(); } }), 262, 6, 80, 25);
          d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 262, 36, 80, 25);
        }
      });
      const doPrint = () => printDoc('Notepad', name(), ta.value, w);

      const w = new Win({
        title: 'Notepad - (Untitled)', icon: 'notepad', w: 480, h: 330, focusEl: ta,
        onClose: confirmLose,
        menu: [
          { label: '&File', items: [
            { label: '&New', action: async () => { if (await confirmLose()) { ta.value = ''; path = null; dirty = false; title(); } } },
            { label: '&Open...', action: async () => {
              if (!(await confirmLose())) return;
              const p = await fileDialog({ owner: w, dir: path ? FS.dirname(path) : null, filters: [['Text Files (*.TXT)', '*.TXT'], ['All Files (*.*)', '*.*']] });
              if (p) load(p);
            } },
            { label: '&Save', action: save }, { label: 'Save &As...', action: saveAs }, '-',
            { label: '&Print', action: doPrint },
            { label: 'Page Se&tup...', action: () => pageSetup() },
            { label: 'P&rint Setup...', action: () => Sys.launch('CONTROL.EXE printers') }, '-',
            { label: 'E&xit', action: () => w.close() }] },
          { label: '&Edit', items: [
            { label: '&Undo', key: 'Ctrl+Z', action: () => { ta.focus(); document.execCommand('undo'); } }, '-',
            { label: 'Cu&t', key: 'Ctrl+X', action: () => { ta.focus(); Sys.setClipboard({ type: 'text', data: selText() }); insert(''); } },
            { label: '&Copy', key: 'Ctrl+C', action: () => { ta.focus(); Sys.setClipboard({ type: 'text', data: selText() }); } },
            { label: '&Paste', key: 'Ctrl+V', action: async () => {
              let t = Sys.clipboard && Sys.clipboard.type === 'text' ? Sys.clipboard.data : '';
              if (!t && navigator.clipboard?.readText) try { t = await navigator.clipboard.readText(); } catch {}
              if (t) insert(t);
            } },
            { label: 'De&lete', key: 'Del', action: () => insert('') }, '-',
            { label: 'Select &All', action: () => { ta.focus(); ta.select(); } },
            { label: 'Time/&Date', key: 'F5', action: () => insert(`${timeStr()} ${dateStr()}`) }, '-',
            { label: '&Word Wrap', checked: () => wrap, action: () => { wrap = !wrap; Store.set('np.wrap', wrap); ta.wrap = wrap ? 'soft' : 'off'; ta.style.overflowX = wrap ? 'hidden' : 'scroll'; } }] },
          { label: '&Search', items: [{ label: '&Find...', action: findDlg }, { label: 'Find &Next', key: 'F3', action: findNext }] },
          { label: '&Help', items: [
            { label: '&Contents', action: () => Sys.launch('WINHELP.EXE notepad') },
            { label: '&Search for Help On...', action: () => Sys.launch('WINHELP.EXE notepad') },
            { label: '&How to Use Help', action: () => Sys.launch('WINHELP.EXE winhelp') }, '-',
            { label: '&About Notepad...', action: () => aboutBox('Notepad', 'notepad', w) }] }
        ]
      });
      const pageSetup = () => dialog({
        title: 'Page Setup', w: 330, h: 150, owner: w,
        build(d) {
          const hd = UI.text(Store.get('np.header', '&f')), ft = UI.text(Store.get('np.footer', 'Page &p'));
          d.add(UI.label('&Header:', hd), 10, 14); d.add(hd, 70, 10, 160);
          d.add(UI.label('&Footer:', ft), 10, 44); d.add(ft, 70, 40, 160);
          const g = UI.group('Margins'); d.add(g, 10, 72, 220, 70);
          [['&Left:', '.75'], ['&Right:', '.75'], ['&Top:', '1'], ['&Bottom:', '1']].forEach(([l, v], i) => {
            const t = UI.text(v); d.add(UI.label(l, t), 20 + (i % 2) * 106, 94 + Math.floor(i / 2) * 26); d.add(t, 70 + (i % 2) * 106, 90 + Math.floor(i / 2) * 26, 46);
          });
          d.add(UI.button('OK', { default: true, onClick: () => { Store.set('np.header', hd.value); Store.set('np.footer', ft.value); d.close(); } }), 242, 8, 80, 25);
          d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 242, 38, 80, 25);
        }
      });
      ta.style.overflowX = wrap ? 'hidden' : 'scroll';
      ta.addEventListener('input', () => { dirty = true; });
      w.body.appendChild(ta);
      if (opts.args) load(FS.full(opts.args.trim(), 'C:\\WINDOWS'));
      setTimeout(() => ta.focus(), 0);
      return w;
    }
  });
})();
