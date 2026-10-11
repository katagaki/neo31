'use strict';
/* Cardfile — stacked index cards */
(() => {
  const CW = 300, CH = 196, STEP_X = 14, STEP_Y = 22;

  Sys.registerApp('cardfile', {
    name: 'Cardfile', icon: 'cardfile', help: 'cardfile',
    run(opts) {
      let cards = [{ index: '', text: '' }], front = 0, view = 'card', path = null, dirty = false, findText = '';
      const sortCards = () => { const f = cards[front]; cards.sort((a, b) => a.index.toLowerCase().localeCompare(b.index.toLowerCase())); front = cards.indexOf(f); };
      const area = h('div', { style: { position: 'relative', flex: 1, overflow: 'hidden', background: 'var(--app-workspace)' } });
      const status = h('div', { class: 'status' });
      const statView = h('div', { style: { width: '80px' } }), statN = h('div', { style: { flex: 1 } });
      const nav = d => { const b = h('div', { class: 'raised', style: { width: '20px', border: '1px solid #000', position: 'relative', padding: 0 } }, h('img', { src: glyphURL(d), class: 'ico', style: { position: 'absolute', left: '7px', top: '4px' } })); b.addEventListener('pointerdown', e => { e.preventDefault(); go(d === 'left' ? -1 : 1); }); return b; };
      status.append(statView, nav('left'), nav('right'), statN);
      let ta = null;

      const go = n => { save1(); front = (front + n + cards.length) % cards.length; render(); };
      const save1 = () => { if (ta && cards[front]) { if (cards[front].text !== ta.value) dirty = true; cards[front].text = ta.value; } };

      const render = () => {
        area.innerHTML = '';
        statView.textContent = view === 'card' ? 'Card View' : 'List View';
        statN.textContent = `${cards.length} Card${cards.length === 1 ? '' : 's'}`;
        if (view === 'list') {
          const lb = UI.listbox({ items: cards.map(c => c.index || ' '), sel: front, onSelect: (_, i) => { front = i; }, onActivate: () => { view = 'card'; render(); } });
          UI.place(lb, 0, 0); lb.el.style.width = '100%'; lb.el.style.height = '100%'; lb.el.style.border = '0';
          area.appendChild(lb.el); ta = null; lb.el.focus(); return;
        }
        const W = area.clientWidth || 400, H = area.clientHeight || 300;
        const maxBehind = Math.max(0, Math.min(cards.length - 1, Math.floor((H - CH - 8) / STEP_Y), Math.floor((W - CW - 8) / STEP_X)));
        const x0 = 8, y0 = 8 + maxBehind * STEP_Y;
        for (let k = maxBehind; k >= 0; k--) {
          const ci = (front + k) % cards.length, c = cards[ci];
          const card = h('div', { style: { position: 'absolute', left: (x0 + k * STEP_X) + 'px', top: (y0 - k * STEP_Y) + 'px', width: CW + 'px', height: CH + 'px', background: 'var(--window)', border: '1px solid #000', fontWeight: 'normal' } });
          const idx = h('div', { style: { height: '20px', lineHeight: '19px', padding: '0 4px', borderBottom: '3px double #ff0000', whiteSpace: 'nowrap', overflow: 'hidden', fontWeight: 'bold' }, text: c.index });
          card.appendChild(idx);
          if (k === 0) {
            ta = h('textarea', { class: 'edit', spellcheck: false, style: { position: 'absolute', top: '23px', height: (CH - 25) + 'px', overflow: 'hidden', font: 'var(--sys-font)' } });
            ta.value = c.text;
            ta.addEventListener('input', () => { dirty = true; });
            card.appendChild(ta);
            idx.addEventListener('dblclick', editIndex);
          } else card.addEventListener('pointerdown', e => { e.preventDefault(); save1(); front = ci; render(); });
          area.appendChild(card);
        }
        setTimeout(() => ta && ta.focus(), 0);
      };

      const editIndex = () => {
        save1();
        dialog({
          title: 'Index', w: 330, h: 70, owner: w,
          build(d) {
            const t = UI.text(cards[front].index, { maxLength: 39 });
            d.add(UI.label('&Index Line:', t), 10, 8); d.add(t, 10, 26, 220);
            d.add(UI.button('OK', { default: true, onClick: () => { cards[front].index = t.value; sortCards(); dirty = true; d.close(); render(); } }), 242, 6, 80, 25);
            d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 242, 36, 80, 25);
          }
        });
      };
      const addCard = () => {
        save1();
        dialog({
          title: 'Add', w: 330, h: 70, owner: w,
          build(d) {
            const t = UI.text('', { maxLength: 39 });
            d.add(UI.label('&Add:', t), 10, 8); d.add(t, 10, 26, 220);
            d.add(UI.button('OK', { default: true, onClick: () => { const c = { index: t.value, text: '' }; cards.push(c); sortCards(); front = cards.indexOf(c); dirty = true; d.close(); render(); } }), 242, 6, 80, 25);
            d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 242, 36, 80, 25);
          }
        });
      };
      const delCard = async () => {
        save1();
        const r = await msgBox(`Delete "${cards[front].index}"?`, 'Cardfile', { buttons: 'okcancel', icon: 'question', owner: w });
        if (r !== 'ok') return;
        cards.splice(front, 1);
        if (!cards.length) cards.push({ index: '', text: '' });
        front = Math.min(front, cards.length - 1); dirty = true; render();
      };
      const goTo = () => dialog({
        title: 'Go To', w: 330, h: 70, owner: w,
        build(d) {
          const t = UI.text('');
          d.add(UI.label('&Go To:', t), 10, 8); d.add(t, 10, 26, 220);
          d.add(UI.button('OK', { default: true, onClick: () => {
            const i = cards.findIndex(c => c.index.toLowerCase().includes(t.value.toLowerCase()));
            if (i < 0) { msgBox(`Cannot find "${t.value}"`, 'Cardfile', { icon: 'info', owner: d.win }); return; }
            save1(); front = i; d.close(); render();
          } }), 242, 6, 80, 25);
          d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 242, 36, 80, 25);
        }
      });
      const findNext = () => {
        if (!findText) return find();
        save1();
        for (let k = 1; k <= cards.length; k++) {
          const i = (front + k) % cards.length;
          if (cards[i].text.toLowerCase().includes(findText.toLowerCase())) { front = i; render(); const p = ta.value.toLowerCase().indexOf(findText.toLowerCase()); ta.setSelectionRange(p, p + findText.length); return; }
        }
        msgBox(`Cannot find "${findText}"`, 'Cardfile', { icon: 'info', owner: w });
      };
      const find = () => dialog({
        title: 'Find', w: 330, h: 70, owner: w, modal: false,
        build(d) {
          const t = UI.text(findText);
          d.add(UI.label('Fi&nd What:', t), 10, 8); d.add(t, 10, 26, 220);
          d.add(UI.button('&Find Next', { default: true, onClick: () => { findText = t.value; findNext(); } }), 242, 6, 80, 25);
          d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 242, 36, 80, 25);
        }
      });

      const name = () => path ? FS.basename(path) : '(Untitled)';
      const title = () => w.setTitle('Cardfile - ' + name());
      const confirmLose = async () => {
        save1();
        if (!dirty) return true;
        const r = await askSave('Cardfile', `Do you want to save the changes to ${name()}?`, w);
        if (r === 'cancel') return false;
        if (r === 'yes') return save();
        return true;
      };
      const load = (p, merge) => {
        try {
          const d = JSON.parse(FS.read(p));
          if (!Array.isArray(d)) throw 0;
          cards = merge ? cards.concat(d) : d; if (!cards.length) cards = [{ index: '', text: '' }];
          sortCards(); front = 0;
          if (!merge) { path = FS.full(p); dirty = false; title(); } else dirty = true;
          render();
        } catch { msgBox('This is not a valid Cardfile file.', 'Cardfile', { icon: 'exclaim', owner: w }); }
      };
      const writeTo = p => { save1(); try { FS.write(p, JSON.stringify(cards)); path = FS.full(p); dirty = false; title(); return true; } catch (e) { msgBox(e.message, 'Cardfile', { icon: 'exclaim', owner: w }); return false; } };
      const saveAs = async () => { const p = await fileDialog({ mode: 'save', owner: w, defExt: 'CRD', name: path ? FS.basename(path) : '*.crd', filters: [['Card Files (*.CRD)', '*.CRD']] }); return p ? writeTo(p) : false; };
      const save = () => path ? writeTo(path) : saveAs();

      const w = new Win({
        title: 'Cardfile - (Untitled)', icon: 'cardfile', w: 420, h: 360,
        onClose: confirmLose,
        onResize: () => { save1(); render(); },
        onKey: (e, name) => {
          if (name === 'PageDown') { go(1); return true; }
          if (name === 'PageUp') { go(-1); return true; }
          return false;
        },
        menu: [
          { label: '&File', items: [
            { label: '&New', action: async () => { if (await confirmLose()) { cards = [{ index: '', text: '' }]; front = 0; path = null; dirty = false; title(); render(); } } },
            { label: '&Open...', action: async () => { if (!(await confirmLose())) return; const p = await fileDialog({ owner: w, filters: [['Card Files (*.CRD)', '*.CRD']] }); if (p) load(p); } },
            { label: '&Save', action: save }, { label: 'Save &As...', action: saveAs }, '-',
            { label: '&Print', action: () => { save1(); printDoc('Cardfile', name(), cards[front].text, w); } },
            { label: 'Print A&ll', action: () => { save1(); printDoc('Cardfile', name(), cards.map(c => c.index + '\n' + c.text).join('\n\n'), w); } },
            { label: 'Page Se&tup...', disabled: true }, { label: 'P&rint Setup...', action: () => Sys.launch('CONTROL.EXE printers') }, '-',
            { label: '&Merge...', action: async () => { const p = await fileDialog({ title: 'File Merge', owner: w, filters: [['Card Files (*.CRD)', '*.CRD']] }); if (p) load(p, true); } }, '-',
            { label: 'E&xit', action: () => w.close() }] },
          { label: '&Edit', items: [
            { label: '&Undo', key: 'Ctrl+Z', action: () => { ta && ta.focus(); document.execCommand('undo'); } }, '-',
            { label: 'Cu&t', key: 'Ctrl+X', action: () => { ta && ta.focus(); document.execCommand('cut'); } },
            { label: '&Copy', key: 'Ctrl+C', action: () => { ta && ta.focus(); document.execCommand('copy'); } },
            { label: '&Paste', key: 'Ctrl+V', action: () => { const t = Sys.clipboard?.type === 'text' ? Sys.clipboard.data : ''; if (ta && t) { ta.focus(); document.execCommand('insertText', false, t); } } },
            { label: 'Paste Lin&k', disabled: true }, { label: 'Paste &Special...', disabled: true }, '-',
            { label: '&Index...', key: 'F6', action: editIndex },
            { label: '&Restore', action: () => render() }, '-',
            { label: 'Te&xt', checked: true }, { label: 'P&icture', disabled: true }] },
          { label: '&View', items: [
            { label: '&Card', checked: () => view === 'card', action: () => { save1(); view = 'card'; render(); } },
            { label: '&List', checked: () => view === 'list', action: () => { save1(); view = 'list'; render(); } }] },
          { label: '&Card', items: [
            { label: '&Add...', key: 'F7', action: addCard },
            { label: '&Delete...', action: delCard },
            { label: 'D&uplicate', action: () => { save1(); const c = { ...cards[front] }; cards.splice(front + 1, 0, c); front++; dirty = true; render(); } },
            { label: 'A&utodial...', key: 'F5', action: () => { const m = /\d[\d\- ()]{5,}/.exec(cards[front].text); msgBox(m ? `Dialing ${m[0]}...\n\nNo modem was detected on COM1.` : 'No phone number found on this card.', 'Autodial', { icon: 'info', owner: w }); } }] },
          { label: '&Search', items: [
            { label: '&Go To...', key: 'F4', action: goTo },
            { label: '&Find...', action: find },
            { label: 'Find &Next', key: 'F3', action: findNext }] },
          { label: '&Help', items: [{ label: '&Contents', action: () => Sys.launch('WINHELP.EXE cardfile') }, { label: '&Search for Help on...', action: () => Sys.launch('WINHELP.EXE cardfile') }, { label: '&How to Use Help', action: () => Sys.launch('WINHELP.EXE winhelp') }, '-', { label: '&About Cardfile...', action: () => aboutBox('Cardfile', 'cardfile', w) }] }
        ]
      });
      w.body.style.display = 'flex'; w.body.style.flexDirection = 'column';
      w.body.append(area, status);
      if (opts.args) load(FS.full(opts.args.trim(), 'C:\\WINDOWS'));
      requestAnimationFrame(render);
      return w;
    }
  });
})();
