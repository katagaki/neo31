'use strict';
/* Write — a small rich-text word processor using contentEditable */
(() => {
  const FONTS = winFontList();
  const cssFont = f => WIN_FONTS[f] || `"${f}"`;

  Sys.registerApp('write', {
    name: 'Write', icon: 'write', help: 'write',
    run(opts) {
      let path = null, dirty = false, ruler = false;
      let layout = { margin: 14, width: 560, tab: 4 }, picture = null, movingPicture = null;
      const applyLayout = () => { doc.style.padding = `8px ${layout.margin}px 40px`; doc.style.width = layout.width + 'px'; doc.style.boxSizing = 'border-box'; doc.style.tabSize = String(layout.tab); };
      let find = { text: '', whole: false, caseSens: false };
      const doc = h('div', { contenteditable: 'true', spellcheck: false, style: {
        minHeight: '100%', padding: '8px 14px 40px', outline: 'none', font: '13px/1.35 Arial, Helvetica, sans-serif', color: '#000',
        userSelect: 'text', webkitUserSelect: 'text', background: '#fff', fontWeight: 'normal'
      } });
      const scroller = h('div', { class: 'fill', style: { overflow: 'scroll', background: '#fff' } }, doc);
      const rulerEl = h('div', { style: { flex: 'none', height: '42px', borderBottom: '1px solid #000', background: '#fff', position: 'relative', display: 'none' } });
      const status = h('div', { class: 'status' }, h('div', { text: 'Page 1' }), h('div', { style: { flex: 1, border: 0 } }));
      const wrap = h('div', { style: { position: 'relative', flex: 1 } }, scroller);
      const name = () => path ? FS.basename(path) : '(Untitled)';
      const title = () => w.setTitle('Write - ' + name());

      const exec = (cmd, val) => { doc.focus(); document.execCommand('styleWithCSS', false, true); document.execCommand(cmd, false, val); dirty = true; };
      const setFontSizePx = px => {
        doc.focus();
        document.execCommand('styleWithCSS', false, false);
        document.execCommand('fontSize', false, '7');
        doc.querySelectorAll('font[size="7"]').forEach(f => { const s = h('span', { style: { fontSize: px + 'px' } }); s.innerHTML = f.innerHTML; f.replaceWith(s); });
        dirty = true;
      };
      const curSize = () => { const s = getSelection(); const n = s.anchorNode && (s.anchorNode.nodeType === 3 ? s.anchorNode.parentElement : s.anchorNode); return n && doc.contains(n) ? parseFloat(getComputedStyle(n).fontSize) : 13; };
      const block = style => {
        doc.focus();
        const s = getSelection();
        if (!s.rangeCount) return;
        let n = s.anchorNode;
        if (!doc.contains(n)) return;
        // ensure paragraphs
        if (!doc.querySelector('p,div')) { document.execCommand('formatBlock', false, 'p'); }
        n = s.anchorNode.nodeType === 3 ? s.anchorNode.parentElement : s.anchorNode;
        const p = n.closest('p,div,h1,h2,h3,li') || n;
        if (p !== doc) Object.assign(p.style, style);
        dirty = true;
      };

      const confirmLose = async () => {
        if (!dirty) return true;
        const r = await askSave('Write', `Save current changes?`, w);
        if (r === 'cancel') return false;
        if (r === 'yes') return save();
        return true;
      };
      const load = p => {
        const n = FS.get(p);
        if (!n || n.t !== 'f') { msgBox(`Cannot find ${p}.`, 'Write', { icon: 'exclaim', owner: w }); return; }
        const x = n.x || '';
        if (x.trim().startsWith('<')) doc.innerHTML = safeDocumentHTML(x);
        else doc.innerText = x;
        layout = { margin: clamp(Number(n.writeLayout?.margin) || 14, 0, 192), width: clamp(Number(n.writeLayout?.width) || 560, 240, 1600), tab: clamp(Number(n.writeLayout?.tab) || 4, 1, 32) };
        picture = null; stopMoving(); applyLayout();
        path = FS.full(p); dirty = false; title();
        scroller.scrollTop = 0;
      };
      const writeTo = p => {
        try { FS.write(p, safeDocumentHTML(doc.innerHTML), { writeLayout: { ...layout } }); path = FS.full(p); dirty = false; title(); return true; }
        catch (e) { msgBox(`Cannot save ${p}.\n${e.message}`, 'Write', { icon: 'exclaim', owner: w }); return false; }
      };
      const saveAs = async () => {
        const p = await fileDialog({ mode: 'save', owner: w, name: path ? FS.basename(path) : '*.wri', dir: path ? FS.dirname(path) : null, defExt: 'WRI', filters: [['Write Files (*.WRI)', '*.WRI'], ['Text Files (*.TXT)', '*.TXT'], ['All Files (*.*)', '*.*']] });
        if (!p) return false;
        if (FS.ext(p) === 'TXT') { try { FS.write(p, doc.innerText); path = FS.full(p); dirty = false; title(); return true; } catch { return false; } }
        return writeTo(p);
      };
      const save = () => path && FS.ext(path) !== 'TXT' ? writeTo(path) : saveAs();

      const layoutDialog = tabs => dialog({ title: tabs ? 'Tabs' : 'Page Layout', w: 300, h: tabs ? 100 : 125, owner: w, build(d) {
        const width = UI.text(String(tabs ? layout.tab : layout.width)), margin = UI.text(String(layout.margin));
        d.add(UI.label(tabs ? '&Tab width (spaces):' : '&Page width (pixels):', width), 10, 12); d.add(width, 150, 8, 60);
        if (!tabs) { d.add(UI.label('&Margins (pixels):', margin), 10, 46); d.add(margin, 150, 42, 60); }
        d.add(UI.button('OK', { default: true, onClick: () => {
          const v = Number(width.value), m = Number(margin.value);
          if (!Number.isFinite(v) || v < (tabs ? 1 : 240) || v > (tabs ? 32 : 1600) || (!tabs && (!Number.isFinite(m) || m < 0 || m > 192))) {
            msgBox(tabs ? 'Enter a tab width from 1 to 32.' : 'Enter a page width from 240 to 1600 pixels and margins from 0 to 192 pixels.', 'Write', { owner: d.win, icon: 'exclaim' }); return;
          }
          if (tabs) layout.tab = v; else { layout.width = v; layout.margin = m; }
          applyLayout(); dirty = true; d.close();
        } }), 218, 8, 72, 25);
        d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 218, 40, 72, 25);
      } });
      const insertPicture = async () => {
        const p = await fileDialog({ owner: w, filters: [['Pictures', '*.BMP;*.PNG;*.JPG;*.GIF'], ['All Files', '*.*']] });
        if (!p) return;
        const n = FS.get(p), src = n?.g ? Wallpapers.gen(n.g)?.toDataURL() : n?.x;
        if (!/^data:image\/(png|jpeg|gif|bmp|webp);base64,/i.test(src || '')) { msgBox('Choose an imported image or a Paintbrush picture.', 'Write', { owner: w, icon: 'exclaim' }); return; }
        exec('insertImage', src);
      };
      const movePicture = () => {
        if (!picture || !doc.contains(picture)) { msgBox('Click a picture in the document first.', 'Write', { owner: w }); return; }
        movingPicture = picture; doc.style.cursor = 'var(--cur-cross)';
        status.firstChild.textContent = 'Click a destination for the picture. Esc cancels.';
        doc.focus();
      };
      const stopMoving = () => { movingPicture = null; doc.style.cursor = ''; status.firstChild.textContent = 'Page 1'; };
      const pictureDialog = () => {
        if (!picture || !doc.contains(picture)) { msgBox('Click a picture in the document first.', 'Write', { owner: w }); return; }
        const image = picture;
        dialog({ title: 'Size Picture', w: 300, h: 100, owner: w, build(d) {
          const width = UI.text(String(image.width)), height = UI.text(String(image.height));
          d.add(UI.label('&Width (pixels):', width), 10, 12); d.add(width, 120, 8, 70);
          d.add(UI.label('&Height (pixels):', height), 10, 46); d.add(height, 120, 42, 70);
          d.add(UI.button('OK', { default: true, onClick: () => {
            const x = Number(width.value), y = Number(height.value);
            if (![x, y].every(v => Number.isFinite(v) && v >= 1 && v <= 2048)) { msgBox('Enter dimensions from 1 to 2048 pixels.', 'Write', { owner: d.win, icon: 'exclaim' }); return; }
            image.style.width = x + 'px'; image.style.height = y + 'px'; dirty = true; d.close();
          } }), 210, 8, 80, 25);
          d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 210, 42, 80, 25);
        } });
      };

      const findIn = (text, back) => {
        // Use window.find when available (Chromium/Safari), scoped by focusing the doc
        doc.focus();
        if (window.find) {
          const ok = window.find(text, find.caseSens, back, false, find.whole, false, false);
          const s = getSelection();
          if (ok && s.anchorNode && doc.contains(s.anchorNode)) return true;
          const r = document.createRange(); r.setStart(doc, 0); r.collapse(true); s.removeAllRanges(); s.addRange(r);
          const ok2 = window.find(text, find.caseSens, back, false, find.whole, false, false);
          return ok2 && doc.contains(getSelection().anchorNode);
        }
        return false;
      };
      const findNext = () => {
        if (!find.text) return findDlg();
        if (!findIn(find.text)) msgBox('Search text not found.', 'Write', { icon: 'info', owner: w });
      };
      const findDlg = (replace) => dialog({
        title: replace ? 'Replace' : 'Find', w: 360, h: replace ? 120 : 90, owner: w, modal: false,
        build(d) {
          const t = UI.text(find.text || String(getSelection()));
          const rp = UI.text('');
          const ww = UI.check('Match &Whole Word Only', find.whole), mc = UI.check('Match &Case', find.caseSens);
          d.add(UI.label('Fi&nd What:', t), 8, 12); d.add(t, 90, 8, 170);
          if (replace) { d.add(UI.label('Re&place With:', rp), 8, 42); d.add(rp, 90, 38, 170); }
          d.add(ww, 8, replace ? 72 : 44); d.add(mc, 8, replace ? 94 : 66);
          const sync = () => { find = { text: t.value, whole: ww.input.checked, caseSens: mc.input.checked }; };
          d.add(UI.button('&Find Next', { default: true, onClick: () => { sync(); findNext(); } }), 272, 6, 80, 24);
          if (replace) {
            d.add(UI.button('&Replace', { onClick: () => { sync(); const s = getSelection(); if (String(s) && doc.contains(s.anchorNode)) { document.execCommand('insertText', false, rp.value); dirty = true; } findNext(); } }), 272, 34, 80, 24);
            d.add(UI.button('Replace &All', { onClick: () => {
              sync(); let n = 0;
              const r = document.createRange(); r.setStart(doc, 0); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r);
              while (findIn(find.text) && n < 1000) { document.execCommand('insertText', false, rp.value); n++; }
              dirty = true;
              msgBox(`${n} replacement(s) made.`, 'Write', { icon: 'info', owner: d.win });
            } }), 272, 62, 80, 24);
          }
          d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 272, replace ? 90 : 34, 80, 24);
        }
      });
      const fontsDlg = () => {
        const sel = getSelection();
        const saved = sel.rangeCount && doc.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
        return dialog({
          title: 'Font', w: 420, h: 220, owner: w,
          build(d) {
            const sample = h('div', { style: { border: '1px solid #000', background: '#fff', textAlign: 'center', lineHeight: '58px', overflow: 'hidden', fontWeight: 'normal' }, text: 'AaBbYyZz' });
            const fl = UI.listbox({ items: FONTS, onSelect: () => upd() });
            const styles = ['Regular', 'Italic', 'Bold', 'Bold Italic'];
            const sl = UI.listbox({ items: styles, sel: 0, onSelect: () => upd() });
            const sizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
            const zl = UI.listbox({ items: sizes.map(String), onSelect: () => upd() });
            fl.selectText('Arial'); zl.selectText(String(Math.round(curSize() * 0.75)) || '10');
            if (zl.sel < 0) zl.select(2, false);
            const upd = () => {
              const st = sl.value?.text || 'Regular';
              Object.assign(sample.style, { fontFamily: cssFont(fl.value?.text || 'Arial'), fontSize: Math.round((+(zl.value?.text || 10)) / 0.75) + 'px', fontWeight: /Bold/.test(st) ? 'bold' : 'normal', fontStyle: /Italic/.test(st) ? 'italic' : 'normal' });
            };
            d.add(UI.label('&Font:', fl), 8, 6); d.add(fl, 8, 24, 150, 110);
            d.add(UI.label('Font St&yle:', sl), 166, 6); d.add(sl, 166, 24, 100, 110);
            d.add(UI.label('&Size:', zl), 274, 6); d.add(zl, 274, 24, 50, 110);
            d.add(UI.label('Sample'), 166, 142); d.add(sample, 166, 158, 246, 58);
            d.add(UI.button('OK', { default: true, onClick: () => {
              d.close();
              if (saved) { const s = getSelection(); s.removeAllRanges(); s.addRange(saved); }
              exec('fontName', cssFont(fl.value?.text || 'Arial').replace(/"/g, ''));
              const st = sl.value?.text || 'Regular';
              if (document.queryCommandState('bold') !== /Bold/.test(st)) exec('bold');
              if (document.queryCommandState('italic') !== /Italic/.test(st)) exec('italic');
              setFontSizePx(Math.round((+(zl.value?.text || 10)) / 0.75));
            } }), 332, 6, 80, 25);
            d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 332, 36, 80, 25);
            upd();
          }
        });
      };

      const w = new Win({
        title: 'Write - (Untitled)', icon: 'write', w: 540, h: 400, focusEl: doc,
        onClose: confirmLose,
        menu: [
          { label: '&File', items: [
            { label: '&New', action: async () => { if (await confirmLose()) { doc.innerHTML = ''; path = null; picture = null; stopMoving(); layout = { margin: 14, width: 560, tab: 4 }; applyLayout(); dirty = false; title(); } } },
            { label: '&Open...', action: async () => { if (!(await confirmLose())) return; const p = await fileDialog({ owner: w, dir: path ? FS.dirname(path) : null, filters: [['Write Files (*.WRI)', '*.WRI'], ['Text Files (*.TXT)', '*.TXT'], ['All Files (*.*)', '*.*']] }); if (p) load(p); } },
            { label: '&Save', action: save }, { label: 'Save &As...', action: saveAs }, '-',
            { label: '&Print...', action: () => printDoc('Write', name(), doc.innerText, w) },
            { label: 'Print Set&up...', action: () => Sys.launch('CONTROL.EXE printers') },
            { label: 'Repa&ginate...', action: () => msgBox('Repagination complete.', 'Write', { owner: w }) }, '-',
            { label: 'E&xit', action: () => w.close() }] },
          { label: '&Edit', items: [
            { label: '&Undo', key: 'Ctrl+Z', action: () => exec('undo') }, '-',
            { label: 'Cu&t', key: 'Ctrl+X', action: () => { Sys.setClipboard({ type: 'text', data: String(getSelection()) }); exec('delete'); } },
            { label: '&Copy', key: 'Ctrl+C', action: () => Sys.setClipboard({ type: 'text', data: String(getSelection()) }) },
            { label: '&Paste', key: 'Ctrl+V', action: async () => { let t = Sys.clipboard?.type === 'text' ? Sys.clipboard.data : ''; if (!t && navigator.clipboard?.readText) try { t = await navigator.clipboard.readText(); } catch {} if (t) exec('insertText', t); } },
            { label: 'Paste &Special...', disabled: true }, { label: 'Paste &Link', disabled: true }, '-',
            { label: 'Lin&ks...', disabled: true }, { label: '&Object', disabled: true }, { label: '&Insert Picture...', action: insertPicture }, '-',
            { label: '&Move Picture', action: movePicture }, { label: 'Picture &Alignment', items: ['left', 'right', 'none'].map(value => ({ label: value === 'none' ? 'Inline' : value === 'left' ? 'Align left' : 'Align right', action: () => { if (picture && doc.contains(picture)) { picture.style.float = value; dirty = true; } else msgBox('Click a picture first.', 'Write', { owner: w }); } })) }, { label: '&Size Picture...', action: pictureDialog }] },
          { label: 'Fi&nd', items: [
            { label: '&Find...', action: () => findDlg(false) }, { label: '&Repeat Last Find', key: 'F3', action: findNext },
            { label: 'R&eplace...', action: () => findDlg(true) }, '-', { label: '&Go To Page...', key: 'F4', action: () => msgBox('This document has only one page.', 'Write', { owner: w }) }] },
          { label: '&Character', items: [
            { label: '&Regular', key: 'F5', action: () => exec('removeFormat') },
            { label: '&Bold', key: 'Ctrl+B', checked: () => document.queryCommandState('bold'), action: () => exec('bold') },
            { label: '&Italic', key: 'Ctrl+I', checked: () => document.queryCommandState('italic'), action: () => exec('italic') },
            { label: '&Underline', key: 'Ctrl+U', checked: () => document.queryCommandState('underline'), action: () => exec('underline') }, '-',
            { label: 'Su&perscript', checked: () => document.queryCommandState('superscript'), action: () => exec('superscript') },
            { label: 'Subs&cript', checked: () => document.queryCommandState('subscript'), action: () => exec('subscript') }, '-',
            { label: 'Re&duce Font', action: () => setFontSizePx(Math.max(8, Math.round(curSize() - 2))) },
            { label: '&Enlarge Font', action: () => setFontSizePx(Math.round(curSize() + 2)) }, '-',
            { label: '&Fonts...', action: fontsDlg }] },
          { label: '&Paragraph', items: [
            { label: '&Normal', action: () => { exec('justifyLeft'); block({ lineHeight: '', marginLeft: '' }); } }, '-',
            { label: '&Left', action: () => exec('justifyLeft') }, { label: '&Centered', action: () => exec('justifyCenter') },
            { label: '&Right', action: () => exec('justifyRight') }, { label: '&Justified', action: () => exec('justifyFull') }, '-',
            { label: '&Single Space', action: () => block({ lineHeight: '1.35' }) }, { label: '1 1/&2 Space', action: () => block({ lineHeight: '2' }) },
            { label: '&Double Space', action: () => block({ lineHeight: '2.7' }) }, '-',
            { label: '&Indents...', action: () => dialog({ title: 'Indents', w: 260, h: 100, owner: w, build(d) {
              const l = UI.text('0"'), f = UI.text('0"'), r = UI.text('0"');
              [['&Left Indent:', l], ['&First Line:', f], ['&Right Indent:', r]].forEach(([lb, t], i) => { d.add(UI.label(lb, t), 10, 12 + i * 28); d.add(t, 100, 8 + i * 28, 60); });
              d.add(UI.button('OK', { default: true, onClick: () => { block({ marginLeft: (parseFloat(l.value) || 0) * 96 + 'px', textIndent: (parseFloat(f.value) || 0) * 96 + 'px', marginRight: (parseFloat(r.value) || 0) * 96 + 'px' }); d.close(); } }), 172, 8, 80, 25);
              d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 172, 38, 80, 25);
            } }) }] },
          { label: '&Document', items: [
            { label: '&Header...', action: () => msgBox('Headers appear only when printing.', 'Write', { owner: w }) },
            { label: '&Footer...', action: () => msgBox('Footers appear only when printing.', 'Write', { owner: w }) },
            { label: '&Ruler On', label2: 'Ruler', checked: () => ruler, action: () => { ruler = !ruler; rulerEl.style.display = ruler ? '' : 'none'; } },
            { label: '&Tabs...', action: () => layoutDialog(true) }, { label: '&Page Layout...', action: () => layoutDialog(false) }] },
          { label: '&Help', items: [{ label: '&Contents', action: () => Sys.launch('WINHELP.EXE write') }, { label: '&Search for Help On...', action: () => Sys.launch('WINHELP.EXE write') }, { label: '&How to Use Help', action: () => Sys.launch('WINHELP.EXE winhelp') }, '-', { label: '&About Write...', action: () => aboutBox('Write', 'write', w) }] }
        ]
      });
      // ruler
      const tick = h('div', { style: { position: 'absolute', left: '14px', right: '4px', top: '2px', height: '16px', borderBottom: '1px solid #000', background: 'repeating-linear-gradient(90deg, #000 0 1px, transparent 1px 12px)', backgroundSize: '12px 5px', backgroundRepeat: 'repeat-x', backgroundPosition: 'bottom' } });
      rulerEl.appendChild(tick);
      const rb = (txt, fn, x) => { const b = h('div', { class: 'raised', style: { position: 'absolute', left: x + 'px', top: '20px', width: '22px', height: '18px', border: '1px solid #000', textAlign: 'center', fontSize: '10px', lineHeight: '16px' }, text: txt }); b.addEventListener('pointerdown', e => { e.preventDefault(); fn(); }); rulerEl.appendChild(b); };
      rb('1', () => block({ lineHeight: '1.35' }), 14); rb('1½', () => block({ lineHeight: '2' }), 38); rb('2', () => block({ lineHeight: '2.7' }), 62);
      rb('⇤', () => exec('justifyLeft'), 110); rb('≡', () => exec('justifyCenter'), 134); rb('⇥', () => exec('justifyRight'), 158); rb('▤', () => exec('justifyFull'), 182);

      w.body.style.display = 'flex'; w.body.style.flexDirection = 'column';
      w.body.append(rulerEl, wrap, status);
      applyLayout();
      doc.style.whiteSpace = 'pre-wrap';
      doc.setAttribute('role', 'textbox'); doc.setAttribute('aria-multiline', 'true'); doc.setAttribute('aria-label', 'Write document');
      doc.addEventListener('click', e => {
        if (movingPicture && e.target !== movingPicture) {
          const image = movingPicture, selection = getSelection();
          if (selection.rangeCount && doc.contains(selection.anchorNode) && !image.contains(selection.anchorNode)) {
            const range = selection.getRangeAt(0).cloneRange(); range.collapse(true); range.insertNode(image);
          } else { const target = e.target.closest('p,div,li'); (target && doc.contains(target) ? target : doc).appendChild(image); }
          picture = image; dirty = true; stopMoving(); return;
        }
        picture = e.target.tagName === 'IMG' ? e.target : null;
      });
      doc.addEventListener('keydown', e => { if (e.key === 'Escape' && movingPicture) { e.preventDefault(); e.stopPropagation(); stopMoving(); return; } if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); exec('insertText', '\t'); } });
      doc.addEventListener('input', () => { dirty = true; });
      doc.addEventListener('paste', e => { e.preventDefault(); const t = e.clipboardData.getData('text/plain'); document.execCommand('insertText', false, t); });
      if (opts.args) load(FS.full(opts.args.trim(), 'C:\\WINDOWS'));
      setTimeout(() => doc.focus(), 0);
      return w;
    }
  });
})();
