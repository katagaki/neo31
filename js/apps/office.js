'use strict';
/* A compact, editable Office suite for Neo31. Files use documented simulator
   formats and never masquerade as native Microsoft Office binaries. */
(() => {
  const wordHTML = html => safeDocumentHTML(html || '<p><br></p>');
  const officeSave = async (owner, ext, path, data, title) => {
    let target = path;
    if (!target) target = await fileDialog({ mode: 'save', owner, defExt: ext, name: '*.' + ext.toLowerCase(), filters: [[`${title} (*.${ext})`, `*.${ext}`], ['All Files (*.*)', '*.*']] });
    if (!target) return null;
    try { FS.write(target, JSON.stringify(data)); return FS.full(target); }
    catch (e) { await msgBox(`Unable to save ${target}.\n${e.message}`, title, { icon: 'stop', owner }); return null; }
  };
  const officeOpen = async (owner, ext, title) => fileDialog({ owner, filters: [[`${title} (*.${ext})`, `*.${ext}`], ['All Files (*.*)', '*.*']] });

  Sys.registerApp('winword', {
    name: 'Microsoft Word', icon: 'winword', help: 'write',
    run(opts = {}) {
      let path = null, dirty = false, font = 'Arial', size = 12;
      const editor = h('div', { contenteditable: 'true', spellcheck: false, role: 'textbox', 'aria-label': 'Document', 'aria-multiline': 'true', style: { minHeight: '100%', width: '720px', maxWidth: '100%', margin: '18px auto', padding: '34px 44px', boxSizing: 'border-box', background: '#fff', color: '#111', font: '16px/1.45 Arial', outline: 'none', boxShadow: '0 1px 5px #777' } });
      const scroll = h('div', { style: { flex: 1, minHeight: 0, overflow: 'auto', background: '#b8b8b8', padding: '1px 0' } }, editor);
      const status = h('div', { class: 'status', style: { justifyContent: 'space-between' } });
      const name = () => path ? FS.basename(path) : 'Document1.DOC';
      const stats = () => { const words = (editor.innerText.trim().match(/\S+/g) || []).length; status.innerHTML = ''; status.append(h('span', { text: `Page 1  ·  ${words} words` }), h('span', { text: dirty ? 'Modified' : 'Ready' })); };
      const title = () => { w.setTitle('Microsoft Word - ' + name() + (dirty ? ' *' : '')); stats(); };
      const setDirty = () => { if (!dirty) { dirty = true; title(); } };
      const confirm = async () => {
        if (!dirty) return true;
        const r = await msgBox(`Save changes to ${name()}?`, 'Microsoft Word', { buttons: 'yesnocancel', icon: 'question', owner: w });
        if (r === 'cancel') return false;
        if (r === 'no') return true;
        return !!(await save());
      };
      const payload = () => ({ neoOffice: 'word-1', html: wordHTML(editor.innerHTML), font, size });
      const save = async (as = false) => {
        const p = await officeSave(w, 'DOC', as ? null : path, payload(), 'Word document');
        if (!p) return false; path = p; dirty = false; title(); return true;
      };
      const load = p => {
        try {
          const raw = FS.read(p); let data;
          try { data = JSON.parse(raw); } catch { data = { html: raw }; }
          editor.innerHTML = wordHTML(data.html || data.content || (typeof data === 'string' ? data : ''));
          font = data.font || 'Arial'; size = Number(data.size) || 12; editor.style.fontFamily = font; editor.style.fontSize = `${size + 4}px`;
          path = FS.full(p); dirty = false; title(); scroll.scrollTop = 0;
        } catch { msgBox(`Cannot open ${p}.`, 'Microsoft Word', { icon: 'stop', owner: w }); }
      };
      const format = (cmd, value) => { editor.focus(); document.execCommand('styleWithCSS', false, true); document.execCommand(cmd, false, value); setDirty(); };
      const insertTable = () => dialog({ title: 'Insert Table', w: 250, h: 110, owner: w, build(d) {
        const rows = UI.text('3'), cols = UI.text('3');
        d.add(UI.label('&Rows:', rows), 12, 14); d.add(rows, 72, 10, 50);
        d.add(UI.label('&Columns:', cols), 12, 44); d.add(cols, 72, 40, 50);
        d.add(UI.button('Insert', { default: true, onClick: () => {
          const r = clamp(parseInt(rows.value, 10) || 0, 1, 20), c = clamp(parseInt(cols.value, 10) || 0, 1, 10);
          if (!r || !c) return;
          const table = h('table', { style: { borderCollapse: 'collapse', width: '100%' } });
          for (let y = 0; y < r; y++) { const tr = h('tr'); for (let x = 0; x < c; x++) tr.appendChild(h('td', { contenteditable: 'true', style: { border: '1px solid #555', minWidth: '70px', height: '22px', padding: '3px' }, html: '&nbsp;' })); table.appendChild(tr); }
          editor.focus(); const sel = getSelection(); if (sel.rangeCount) sel.getRangeAt(0).insertNode(table); else editor.appendChild(table); setDirty(); d.close();
        } }), 150, 8, 82, 25);
        d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 150, 40, 82, 25);
      } });
      const w = new Win({
        title: 'Microsoft Word - Document1.DOC', icon: 'winword', w: 760, h: 560, minW: 420, minH: 300,
        onClose: confirm,
        menu: [
          { label: '&File', items: [
            { label: '&New', key: 'Ctrl+N', action: async () => { if (await confirm()) { editor.innerHTML = '<p><br></p>'; path = null; dirty = false; title(); } } },
            { label: '&Open...', key: 'Ctrl+O', action: async () => { if (!(await confirm())) return; const p = await officeOpen(w, 'DOC', 'Word documents'); if (p) load(p); } },
            { label: '&Save', key: 'Ctrl+S', action: () => save() }, { label: 'Save &As...', action: () => save(true) }, '-',
            { label: '&Print...', key: 'Ctrl+P', action: () => printDoc('Microsoft Word', name(), editor.innerText, w) }, '-',
            { label: 'E&xit', action: () => w.close() }] },
          { label: '&Edit', items: [
            { label: '&Undo', key: 'Ctrl+Z', action: () => { editor.focus(); document.execCommand('undo'); setDirty(); } }, { label: '&Cut', key: 'Ctrl+X', action: () => { editor.focus(); document.execCommand('cut'); setDirty(); } },
            { label: 'C&opy', key: 'Ctrl+C', action: () => { editor.focus(); document.execCommand('copy'); } }, { label: '&Paste', key: 'Ctrl+V', action: () => { editor.focus(); document.execCommand('paste'); setDirty(); } }, '-',
            { label: '&Select All', key: 'Ctrl+A', action: () => { editor.focus(); document.execCommand('selectAll'); } }, { label: '&Insert Table...', action: insertTable }] },
          { label: '&Format', items: [
            { label: '&Bold', key: 'Ctrl+B', action: () => format('bold') }, { label: '&Italic', key: 'Ctrl+I', action: () => format('italic') }, { label: '&Underline', key: 'Ctrl+U', action: () => format('underline') }, '-',
            { label: '&Align Left', action: () => format('justifyLeft') }, { label: 'Align &Center', action: () => format('justifyCenter') }, { label: 'Align &Right', action: () => format('justifyRight') }, '-',
            { label: '&Bullets', action: () => format('insertUnorderedList') }, { label: '&Numbering', action: () => format('insertOrderedList') },
            { label: '&Font...', action: () => dialog({ title: 'Font', w: 300, h: 140, owner: w, build(d) {
              const f = UI.combo({ items: ['Arial', 'Times New Roman', 'Courier New', 'Fixedsys', 'MS Sans Serif'] }); f.setText(font);
              const z = UI.combo({ items: ['8', '9', '10', '11', '12', '14', '16', '18', '24', '36'] }); z.setText(String(size));
              d.add(UI.label('&Font:', f), 12, 14); d.add(f, 82, 10, 200); d.add(UI.label('&Size:', z), 12, 46); d.add(z, 82, 42, 80);
              d.add(UI.button('OK', { default: true, onClick: () => { font = f.value?.text || font; size = +(z.value?.text || size); format('fontName', font); format('fontSize', '4'); editor.style.fontFamily = font; setDirty(); d.close(); } }), 112, 82, 80, 25);
              d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 202, 82, 80, 25);
            } }) }] },
          { label: '&Help', items: [{ label: '&About Microsoft Word...', action: () => aboutBox('Microsoft Word', 'winword', w) }] }
        ]
      });
      w.body.style.display = 'flex'; w.body.style.flexDirection = 'column';
      const bar = h('div', { style: { display: 'flex', gap: '3px', padding: '3px', background: 'var(--btn-face)', borderBottom: '1px solid #000' } });
      [['B', 'bold'], ['I', 'italic'], ['U', 'underline'], ['•', 'insertUnorderedList']].forEach(([label, cmd]) => bar.appendChild(UI.button(label, { onClick: () => format(cmd), title: cmd })));
      bar.appendChild(UI.button('Center', { onClick: () => format('justifyCenter') }));
      w.body.append(bar, scroll, status);
      editor.addEventListener('input', () => { setDirty(); stats(); });
      editor.addEventListener('paste', () => setTimeout(() => { editor.querySelectorAll('script,iframe,object,embed').forEach(n => n.remove()); setDirty(); }, 0));
      editor.innerHTML = '<h1>Document1</h1><p>Start typing here.</p>'; stats();
      if (opts.args) load(FS.full(opts.args.trim(), 'C:\\WINDOWS'));
      return w;
    }
  });

  const colName = n => { let s = ''; for (n++; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
  const cellAddress = (r, c) => colName(c) + (r + 1);
  const decodeAddress = a => { const m = /^([A-Z]+)([1-9]\d*)$/i.exec(a); if (!m) return null; let c = 0; for (const x of m[1].toUpperCase()) c = c * 26 + x.charCodeAt(0) - 64; return { r: +m[2] - 1, c: c - 1 }; };

  Sys.registerApp('excel', {
    name: 'Microsoft Excel', icon: 'excel', help: 'calc',
    run(opts = {}) {
      let path = null, dirty = false, cells = {}, active = { r: 0, c: 0 }, cols = 12, rows = 60;
      const name = () => path ? FS.basename(path) : 'Book1.XLS';
      const title = () => w.setTitle('Microsoft Excel - ' + name() + (dirty ? ' *' : ''));
      const key = (r, c) => cellAddress(r, c);
      const getRaw = (r, c) => cells[key(r, c)] || '';
      const resolve = (r, c, trail = new Set()) => {
        const addr = key(r, c), raw = getRaw(r, c);
        if (!raw.startsWith('=')) return raw === '' ? 0 : (Number.isFinite(+raw) && raw.trim() !== '' ? +raw : raw);
        if (trail.has(addr)) throw new Error('Circular reference');
        trail.add(addr);
        const src = raw.slice(1).toUpperCase();
        const tokens = src.match(/\s*(?:\d+(?:\.\d+)?|[A-Z]+[1-9]\d*|[A-Z]+|[()+\-*/^,:])\s*/g)?.map(x => x.trim()) || [];
        let i = 0;
        const atom = () => {
          const t = tokens[i++];
          if (t === '(') { const v = expr(); if (tokens[i++] !== ')') throw 0; return v; }
          if (t === '+' || t === '-') { const v = atom(); return t === '-' ? -v : v; }
          if (/^\d/.test(t || '')) return +t;
          if (/^[A-Z]+[1-9]\d*$/.test(t || '')) {
            const p = decodeAddress(t); if (!p) throw 0;
            if (tokens[i] === ':') { i++; const end = decodeAddress(tokens[i++]); if (!end) throw 0; const list = []; for (let y = Math.min(p.r, end.r); y <= Math.max(p.r, end.r); y++) for (let x = Math.min(p.c, end.c); x <= Math.max(p.c, end.c); x++) list.push(resolve(y, x, new Set(trail))); return list; }
            return resolve(p.r, p.c, new Set(trail));
          }
          if (/^[A-Z]+$/.test(t || '') && tokens[i] === '(') {
            i++; const args = []; if (tokens[i] !== ')') { do { args.push(expr()); if (tokens[i] !== ',') break; i++; } while (true); }
            if (tokens[i++] !== ')') throw 0;
            const a = args.flat(Infinity).map(Number).filter(Number.isFinite);
            if (t === 'SUM') return a.reduce((x, y) => x + y, 0);
            if (t === 'AVERAGE') return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
            if (t === 'MIN') return a.length ? Math.min(...a) : 0;
            if (t === 'MAX') return a.length ? Math.max(...a) : 0;
            if (t === 'COUNT') return a.length;
            throw new Error('Unknown function ' + t);
          }
          throw 0;
        };
        const power = () => { let v = atom(); while (tokens[i] === '^') { i++; v = v ** atom(); } return v; };
        const product = () => { let v = power(); while (['*', '/'].includes(tokens[i])) { const op = tokens[i++], b = power(); v = op === '*' ? v * b : v / b; } return v; };
        const expr = () => { let v = product(); while (['+', '-'].includes(tokens[i])) { const op = tokens[i++], b = product(); v = op === '+' ? v + b : v - b; } return v; };
        try { const v = expr(); if (i !== tokens.length || !Number.isFinite(v)) return '#VALUE!'; return v; } catch (e) { return e.message === 'Circular reference' ? '#CIRC!' : '#VALUE!'; }
      };
      const display = (r, c) => { const v = resolve(r, c); return typeof v === 'number' ? String(+v.toPrecision(10)) : String(v); };
      const grid = h('div', { tabindex: '0', role: 'grid', 'aria-label': 'Spreadsheet', style: { flex: 1, minHeight: 0, outline: 'none', overflow: 'auto', background: '#fff', font: '13px Arial' } });
      const formula = UI.text(''); formula.setAttribute('aria-label', 'Formula bar');
      const address = h('div', { class: 'tx', style: { width: '72px', flex: 'none', padding: '3px' } });
      const formulaRow = h('div', { style: { display: 'flex', alignItems: 'center', gap: '4px', padding: '4px', background: 'var(--btn-face)', borderBottom: '1px solid #000' } }, address, h('span', { class: 'txt', text: 'fx' }), formula);
      formula.style.flex = '1';
      const status = h('div', { class: 'status', text: 'Ready' });
      const updateSelection = () => { address.textContent = key(active.r, active.c); formula.value = getRaw(active.r, active.c); grid.querySelectorAll('[data-cell]').forEach(e => e.classList.toggle('sel', e.dataset.cell === key(active.r, active.c))); };
      const render = () => {
        grid.innerHTML = '';
        const table = h('div', { style: { display: 'grid', gridTemplateColumns: `38px repeat(${cols}, minmax(82px, 1fr))`, gridAutoRows: '22px', minWidth: `${38 + cols * 82}px` } });
        table.appendChild(h('div', { class: 'xl-head' }));
        for (let c = 0; c < cols; c++) table.appendChild(h('div', { class: 'xl-head', text: colName(c) }));
        for (let r = 0; r < rows; r++) {
          table.appendChild(h('div', { class: 'xl-rowhead', text: String(r + 1) }));
          for (let c = 0; c < cols; c++) {
            const addr = key(r, c), cell = h('div', { class: 'xl-cell' + (active.r === r && active.c === c ? ' sel' : ''), text: display(r, c) });
            cell.dataset.cell = addr; cell.setAttribute('role', 'gridcell'); cell.tabIndex = active.r === r && active.c === c ? 0 : -1;
            cell.addEventListener('pointerdown', () => { active = { r, c }; updateSelection(); });
            cell.addEventListener('dblclick', () => { active = { r, c }; updateSelection(); formula.focus(); formula.select(); });
            table.appendChild(cell);
          }
        }
        grid.appendChild(table); updateSelection();
      };
      const commit = () => {
        const a = key(active.r, active.c), v = formula.value;
        if (v) cells[a] = v; else delete cells[a];
        dirty = true; title(); render();
      };
      const save = async as => {
        let target = path;
        if (as || !target) target = await fileDialog({ mode: 'save', owner: w, defExt: 'XLS', name: '*.' + 'xls', filters: [['Excel Workbook (*.XLS)', '*.XLS'], ['CSV (*.CSV)', '*.CSV']] });
        if (!target) return false;
        try {
          if (FS.ext(target) === 'CSV') {
            const maxR = Math.max(0, ...Object.keys(cells).map(a => decodeAddress(a).r)), maxC = Math.max(0, ...Object.keys(cells).map(a => decodeAddress(a).c));
            const csv = Array.from({ length: maxR + 1 }, (_, r) => Array.from({ length: maxC + 1 }, (_, c) => {
              const raw = getRaw(r, c); return /[",\n]/.test(raw) ? '"' + raw.replace(/"/g, '""') + '"' : raw;
            }).join(',')).join('\r\n'); FS.write(target, csv);
          } else FS.write(target, JSON.stringify({ neoOffice: 'excel-1', cells }));
          path = FS.full(target); dirty = false; title(); status.textContent = 'Saved'; return true;
        } catch (e) { await msgBox(e.message, 'Microsoft Excel', { icon: 'stop', owner: w }); return false; }
      };
      const parseCSV = text => {
        const out = []; let row = [], field = '', q = false;
        for (let i = 0; i < text.length; i++) { const ch = text[i]; if (q) { if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (ch === '"') q = false; else field += ch; }
          else if (ch === '"') q = true; else if (ch === ',') { row.push(field); field = ''; } else if (ch === '\n') { row.push(field.replace(/\r$/, '')); out.push(row); row = []; field = ''; } else field += ch; }
        row.push(field); out.push(row); return out;
      };
      const load = p => {
        try {
          const raw = FS.read(p); let d;
          if (FS.ext(p) === 'CSV') {
            cells = {}; parseCSV(raw).forEach((row, r) => row.forEach((v, c) => { if (v !== '') cells[key(r, c)] = v; }));
          } else { d = JSON.parse(raw); if (d.neoOffice !== 'excel-1' || !d.cells || typeof d.cells !== 'object') throw 0; cells = d.cells; }
          path = FS.full(p); dirty = false; active = { r: 0, c: 0 }; title(); render();
        } catch { msgBox('This is not a valid Neo31 workbook or CSV file.', 'Microsoft Excel', { icon: 'stop', owner: w }); }
      };
      const move = (dr, dc) => { active = { r: clamp(active.r + dr, 0, 999), c: clamp(active.c + dc, 0, 99) }; if (active.r >= rows) rows = active.r + 20; if (active.c >= cols) cols = active.c + 4; render(); grid.focus(); };
      const confirm = async () => { if (!dirty) return true; const r = await msgBox(`Save changes to ${name()}?`, 'Microsoft Excel', { buttons: 'yesnocancel', icon: 'question', owner: w }); return r === 'no' || (r === 'yes' && await save(false)); };
      const w = new Win({
        title: 'Microsoft Excel - Book1.XLS', icon: 'excel', w: 820, h: 570, minW: 500, minH: 320, onClose: confirm,
        menu: [
          { label: '&File', items: [
            { label: '&New', key: 'Ctrl+N', action: async () => { if (await confirm()) { cells = {}; path = null; dirty = false; render(); title(); } } },
            { label: '&Open...', key: 'Ctrl+O', action: async () => { if (!(await confirm())) return; const p = await officeOpen(w, 'XLS', 'Excel workbooks'); if (p) load(p); } },
            { label: '&Save', key: 'Ctrl+S', action: () => save(false) }, { label: 'Save &As...', action: () => save(true) }, { label: '&Import CSV...', action: async () => { const p = await officeOpen(w, 'CSV', 'CSV files'); if (p) load(p); } }, { label: '&Export CSV...', action: () => save(true) }, '-',
            { label: '&Print...', key: 'Ctrl+P', action: () => printDoc('Microsoft Excel', name(), Array.from({ length: Math.min(rows, 60) }, (_, r) => Array.from({ length: cols }, (_, c) => display(r, c)).join('\t')).join('\n'), w) }, { label: 'E&xit', action: () => w.close() }] },
          { label: '&Edit', items: [{ label: '&Clear Cell', key: 'Del', action: () => { delete cells[key(active.r, active.c)]; dirty = true; render(); title(); } }, { label: '&Fill Down', action: () => { const v = getRaw(active.r, active.c); for (let r = active.r + 1; r < rows; r++) if (v) cells[key(r, active.c)] = v; dirty = true; render(); title(); } }] },
          { label: '&Insert', items: [{ label: '&Function...', action: () => { const f = UI.combo({ items: ['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT'] }); dialog({ title: 'Insert Function', w: 280, h: 100, owner: w, build(d) { d.add(UI.label('&Function:', f), 12, 14); d.add(f, 92, 10, 170); d.add(UI.button('Insert', { default: true, onClick: () => { formula.value = '=' + (f.value?.text || 'SUM') + '('; formula.focus(); d.close(); } }), 92, 52, 80, 25); d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 182, 52, 80, 25); } }); } }] },
          { label: '&Help', items: [{ label: '&About Microsoft Excel...', action: () => aboutBox('Microsoft Excel', 'excel', w) }] }
        ]
      });
      w.body.style.display = 'flex'; w.body.style.flexDirection = 'column'; w.body.append(formulaRow, grid, status);
      formula.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); commit(); move(1, 0); } else if (e.key === 'Escape') { formula.value = getRaw(active.r, active.c); grid.focus(); } });
      grid.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); move(1, 0); } else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1, 0); } else if (e.key === 'ArrowLeft') { e.preventDefault(); move(0, -1); } else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); move(e.key === 'Enter' ? 1 : 0, e.key === 'ArrowRight' ? 1 : 0); } else if (e.key === 'F2') { formula.focus(); formula.select(); } else if (e.key === 'Delete') { delete cells[key(active.r, active.c)]; dirty = true; render(); title(); } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); formula.value = e.key; formula.focus(); } });
      render();
      if (opts.args) load(FS.full(opts.args.trim(), 'C:\\WINDOWS'));
      return w;
    }
  });

  Sys.registerApp('powerpoint', {
    name: 'Microsoft PowerPoint', icon: 'powerpoint', help: 'write',
    run(opts = {}) {
      let slides = [{ title: 'Presentation', body: 'Click to add notes and content.' }], index = 0, path = null, dirty = false, theme = 'Office';
      const name = () => path ? FS.basename(path) : 'Presentation.PPT';
      const title = () => w.setTitle('Microsoft PowerPoint - ' + name() + (dirty ? ' *' : ''));
      const touch = () => { dirty = true; title(); };
      const stage = h('div', { style: { position: 'relative', flex: 1, margin: '14px auto', width: 'min(720px, calc(100% - 30px))', aspectRatio: '4 / 3', maxHeight: 'calc(100% - 28px)', boxSizing: 'border-box', background: '#fff', border: '1px solid #444', boxShadow: '0 1px 5px #777', padding: '9% 8%' } });
      const head = h('div', { contenteditable: 'true', spellcheck: false, role: 'textbox', 'aria-label': 'Slide title', style: { font: 'bold 28px Arial', color: '#17365d', minHeight: '48px', outline: 'none', borderBottom: '2px solid #4472c4', paddingBottom: '8px' } });
      const body = h('div', { contenteditable: 'true', spellcheck: false, role: 'textbox', 'aria-label': 'Slide body', style: { font: '20px/1.5 Arial', whiteSpace: 'pre-wrap', marginTop: '24px', minHeight: '150px', outline: 'none' } });
      stage.append(head, body);
      const list = h('div', { style: { width: '150px', flex: 'none', overflow: 'auto', borderRight: '1px solid #000', background: '#ddd', padding: '4px' }, role: 'listbox', 'aria-label': 'Slides' });
      const center = h('div', { style: { display: 'flex', flex: 1, minHeight: 0, background: '#aaa' } }, list, stage);
      const status = h('div', { class: 'status', text: 'Slide 1 of 1' });
      const sync = () => { head.textContent = slides[index]?.title || ''; body.textContent = slides[index]?.body || ''; stage.style.background = theme === 'Dark Blue' ? '#e8edf7' : theme === 'Green' ? '#edf5ec' : '#fff'; renderList(); status.textContent = `Slide ${index + 1} of ${slides.length}${dirty ? '  ·  Modified' : ''}`; };
      const renderList = () => { list.innerHTML = ''; slides.forEach((s, i) => { const b = h('div', { class: 'it' + (i === index ? ' sel' : ''), style: { whiteSpace: 'normal', minHeight: '50px', margin: '3px 0', border: '1px solid #666', background: '#fff', padding: '5px' } }, h('strong', { text: String(i + 1) + '. ' }), s.title || '(Untitled)'); b.addEventListener('pointerdown', () => { capture(); index = i; sync(); }); list.appendChild(b); }); };
      const capture = () => { if (!slides[index]) return; slides[index].title = head.textContent; slides[index].body = body.textContent; };
      const save = async as => { capture(); const p = await officeSave(w, 'PPT', as ? null : path, { neoOffice: 'powerpoint-1', theme, slides }, 'PowerPoint presentation'); if (!p) return false; path = p; dirty = false; title(); sync(); return true; };
      const load = p => { try { const d = JSON.parse(FS.read(p)); if (d.neoOffice !== 'powerpoint-1' || !Array.isArray(d.slides)) throw 0; slides = d.slides.map(s => ({ title: String(s.title || ''), body: String(s.body || '') })); if (!slides.length) slides = [{ title: '', body: '' }]; theme = d.theme || 'Office'; index = 0; path = FS.full(p); dirty = false; title(); sync(); } catch { msgBox('This is not a valid Neo31 presentation.', 'Microsoft PowerPoint', { icon: 'stop', owner: w }); } };
      const confirm = async () => { if (!dirty) return true; const r = await msgBox(`Save changes to ${name()}?`, 'Microsoft PowerPoint', { buttons: 'yesnocancel', icon: 'question', owner: w }); return r === 'no' || (r === 'yes' && await save(false)); };
      const slideshow = () => {
        capture(); let i = index;
        const overlay = h('div', { style: { position: 'absolute', inset: 0, zIndex: 300000, background: '#101e38', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8vw', fontFamily: 'Arial', boxSizing: 'border-box' } });
        const draw = () => { overlay.innerHTML = ''; const s = slides[i]; overlay.append(h('h1', { style: { fontSize: 'min(7vw, 56px)', borderBottom: '4px solid #70a4ff', paddingBottom: '16px' }, text: s.title }), h('div', { style: { fontSize: 'min(4vw, 30px)', whiteSpace: 'pre-wrap', marginTop: '30px' }, text: s.body }), h('div', { style: { position: 'absolute', bottom: '24px', right: '30px', fontSize: '16px' }, text: `${i + 1} / ${slides.length}   ·   ← →  Esc` })); };
        const keydown = e => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', keydown, true); } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); i = (i + 1) % slides.length; draw(); } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { i = (i + slides.length - 1) % slides.length; draw(); } };
        overlay.addEventListener('pointerup', e => { if (e.clientX > innerWidth / 2) i = (i + 1) % slides.length; else i = (i + slides.length - 1) % slides.length; draw(); });
        document.addEventListener('keydown', keydown, true); draw(); Sys.screen.appendChild(overlay); overlay.focus();
      };
      const w = new Win({
        title: 'Microsoft PowerPoint - Presentation.PPT', icon: 'powerpoint', w: 800, h: 570, minW: 520, minH: 350, onClose: confirm,
        menu: [
          { label: '&File', items: [{ label: '&New', key: 'Ctrl+N', action: async () => { if (await confirm()) { slides = [{ title: 'Presentation', body: '' }]; path = null; index = 0; dirty = false; sync(); title(); } } }, { label: '&Open...', key: 'Ctrl+O', action: async () => { if (!(await confirm())) return; const p = await officeOpen(w, 'PPT', 'PowerPoint presentations'); if (p) load(p); } }, { label: '&Save', key: 'Ctrl+S', action: () => save(false) }, { label: 'Save &As...', action: () => save(true) }, '-', { label: '&Start Slide Show', key: 'F5', action: slideshow }, { label: '&Print...', action: () => { capture(); printDoc('Microsoft PowerPoint', name(), slides.map((s, i) => `${i + 1}. ${s.title}\n\n${s.body}`).join('\n\n'), w); } }, '-', { label: 'E&xit', action: () => w.close() }] },
          { label: '&Insert', items: [{ label: '&New Slide', key: 'Ctrl+M', action: () => { capture(); slides.splice(index + 1, 0, { title: 'New Slide', body: '' }); index++; dirty = true; sync(); title(); } }, { label: '&Duplicate Slide', action: () => { capture(); slides.splice(index + 1, 0, { ...slides[index] }); index++; touch(); sync(); } }] },
          { label: '&Slide', items: [{ label: '&Delete Slide', action: async () => { if (slides.length < 2) return msgBox('A presentation must contain at least one slide.', 'Microsoft PowerPoint', { owner: w }); const r = await msgBox('Delete this slide?', 'Microsoft PowerPoint', { buttons: 'okcancel', icon: 'question', owner: w }); if (r === 'ok') { slides.splice(index, 1); index = Math.min(index, slides.length - 1); touch(); sync(); } } }, { label: 'Move &Up', action: () => { if (index > 0) { capture(); [slides[index - 1], slides[index]] = [slides[index], slides[index - 1]]; index--; touch(); sync(); } } }, { label: 'Move &Down', action: () => { if (index < slides.length - 1) { capture(); [slides[index + 1], slides[index]] = [slides[index], slides[index + 1]]; index++; touch(); sync(); } } }, { label: '&Design...', action: () => dialog({ title: 'Slide Design', w: 260, h: 110, owner: w, build(d) { const cb = UI.combo({ items: ['Office', 'Dark Blue', 'Green'] }); cb.setText(theme); d.add(UI.label('&Theme:', cb), 12, 16); d.add(cb, 82, 12, 160); d.add(UI.button('Apply', { default: true, onClick: () => { theme = cb.value?.text || 'Office'; touch(); d.close(); sync(); } }), 72, 58, 78, 25); d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 162, 58, 78, 25); } }) }] },
          { label: '&Help', items: [{ label: '&About Microsoft PowerPoint...', action: () => aboutBox('Microsoft PowerPoint', 'powerpoint', w) }] }
        ]
      });
      w.body.style.display = 'flex'; w.body.style.flexDirection = 'column'; w.body.append(center, status);
      head.addEventListener('input', () => { slides[index].title = head.textContent; touch(); renderList(); }); body.addEventListener('input', () => { slides[index].body = body.textContent; touch(); });
      sync(); if (opts.args) load(FS.full(opts.args.trim(), 'C:\\WINDOWS'));
      return w;
    }
  });
})();
