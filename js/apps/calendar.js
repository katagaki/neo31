'use strict';
/* Calendar — Day and Month views, appointments, scratch pad, marks, alarms */
(() => {
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const sameDay = (a, b) => key(a) === key(b);
  const longDate = d => Intl31.longDate(d);
  const MARKS = ['', '[ ]', '( )', '•', 'x', '_'];

  Sys.registerApp('calendar', {
    name: 'Calendar', icon: 'calendar', help: 'calendar',
    run(opts) {
      let data = { appts: {}, notes: {}, marks: {}, alarms: {} };
      let path = null, dirty = false, view = 'day', cur = Sys.now();
      const settings = Object.assign({ interval: 60, start: 7 }, Store.get('cal.settings', {}));
      cur.setHours(0, 0, 0, 0);

      const header = h('div', { style: { flex: 'none', display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 6px', borderBottom: '1px solid #000', background: 'var(--window)', height: '22px' } });
      const main = h('div', { style: { flex: 1, position: 'relative', overflow: 'hidden' } });
      const pad_ = h('textarea', { class: 'tx', spellcheck: false, style: { flex: 'none', height: '52px', border: 0, borderTop: '1px solid #000', resize: 'none', width: '100%', fontWeight: 'normal' } });
      const arrow = (dir) => { const b = h('div', { class: 'raised', style: { width: '18px', height: '16px', border: '1px solid #000', position: 'relative' } }, h('img', { src: glyphURL(dir), class: 'ico', style: { position: 'absolute', left: '6px', top: '4px' } })); b.addEventListener('pointerdown', e => { e.preventDefault(); step(dir === 'left' ? -1 : 1); }); return b; };
      const clockLbl = h('span', { style: { minWidth: '70px' } });
      const dateLbl = h('span', { style: { flex: 1 } });
      header.append(clockLbl, arrow('left'), arrow('right'), dateLbl);

      const step = n => {
        if (view === 'day') cur.setDate(cur.getDate() + n);
        else cur.setMonth(cur.getMonth() + n);
        render();
      };
      const touch = () => { dirty = true; };
      pad_.addEventListener('input', () => { const k = key(cur); if (pad_.value) data.notes[k] = pad_.value; else delete data.notes[k]; touch(); });

      const renderDay = () => {
        main.innerHTML = '';
        const list = h('div', { class: 'fill', style: { overflowY: 'scroll', background: 'var(--window)' } });
        const k = key(cur), appts = data.appts[k] || {};
        const times = [];
        for (let m = 0; m < 24 * 60; m += settings.interval) times.push(m);
        Object.keys(appts).forEach(t => { const [hh, mm] = t.split(':').map(Number); const mins = hh * 60 + mm; if (!times.includes(mins)) times.push(mins); });
        times.sort((a, b) => a - b);
        let startRow = null;
        times.forEach(mins => {
          const t = `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
          const hh = Math.floor(mins / 60), lbl = `${hh % 12 || 12}:${pad(mins % 60)} ${hh >= 12 ? 'PM' : 'AM'}`;
          const inp = h('input', { class: 'tx', spellcheck: false, style: { border: 0, flex: 1, height: '18px', padding: '0 4px', background: 'transparent', color: 'inherit' } });
          inp.value = appts[t] || '';
          inp.addEventListener('input', () => { data.appts[k] ||= {}; if (inp.value) data.appts[k][t] = inp.value; else delete data.appts[k][t]; touch(); });
          const bell = h('span', { style: { width: '14px', textAlign: 'center' } }, data.alarms[k + ' ' + t] ? glyphImg('note', 'Alarm') : '');
          const row = h('div', { style: { display: 'flex', alignItems: 'center', borderBottom: '1px dotted #808080', height: '20px', fontWeight: 'normal' } },
            bell, h('span', { style: { width: '74px', textAlign: 'right', paddingRight: '6px' }, text: lbl }), inp);
          row.dataset.t = t;
          inp.addEventListener('focus', () => { focusedTime = t; });
          list.appendChild(row);
          if (hh === settings.start && startRow == null) startRow = row;
        });
        main.appendChild(list);
        requestAnimationFrame(() => { if (startRow) list.scrollTop = startRow.offsetTop; });
      };
      let focusedTime = null;

      const renderMonth = () => {
        main.innerHTML = '';
        const today = Sys.now();
        const first = new Date(cur.getFullYear(), cur.getMonth(), 1);
        const grid = h('div', { class: 'fill', style: { background: 'var(--window)', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: `24px 28px repeat(6, 1fr)`, fontWeight: 'normal' } });
        grid.appendChild(h('div', { style: { gridColumn: '1 / 8', textAlign: 'center', fontWeight: 'bold', lineHeight: '24px' }, text: `${MONTHS[cur.getMonth()]} ${cur.getFullYear()}` }));
        'SMTWTFS'.split('').forEach(c => grid.appendChild(h('div', { style: { textAlign: 'center', borderBottom: '1px solid #000', fontWeight: 'bold', lineHeight: '26px' }, text: c })));
        for (let i = 0; i < 42; i++) {
          const d = new Date(first); d.setDate(1 - first.getDay() + i);
          const inMonth = d.getMonth() === cur.getMonth();
          const k = key(d);
          const isSel = sameDay(d, cur), isToday = sameDay(d, today);
          const mark = data.marks[k];
          const has = data.appts[k] && Object.keys(data.appts[k]).length;
          const cell = h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', color: inMonth ? '' : 'transparent', background: isSel && inMonth ? 'var(--highlight)' : '', } },
            h('span', { style: { color: isSel && inMonth ? 'var(--highlight-text)' : '', textDecoration: has ? 'underline' : '' }, text: (isToday ? '>' : '') + (mark ? MARKS[mark][0] : '') + d.getDate() + (mark ? MARKS[mark].slice(-1) : '') + (isToday ? '<' : '') }));
          if (!inMonth) cell.style.visibility = 'hidden';
          cell.addEventListener('pointerdown', () => { cur = new Date(d); render(); });
          cell.addEventListener('dblclick', () => { cur = new Date(d); view = 'day'; render(); });
          grid.appendChild(cell);
        }
        main.appendChild(grid);
      };

      const render = () => {
        const now = Sys.now();
        clockLbl.textContent = timeStr(now);
        dateLbl.textContent = longDate(cur);
        pad_.value = data.notes[key(cur)] || '';
        view === 'day' ? renderDay() : renderMonth();
      };

      /* ---- file ---- */
      const name = () => path ? FS.basename(path) : '(Untitled)';
      const title = () => w.setTitle('Calendar - ' + name());
      const confirmLose = async () => {
        if (!dirty) return true;
        const r = await askSave('Calendar', 'Do you want to save the changes?', w);
        if (r === 'cancel') return false;
        if (r === 'yes') return save();
        return true;
      };
      const load = p => {
        try { const d = JSON.parse(FS.read(p)); data = Object.assign({ appts: {}, notes: {}, marks: {}, alarms: {} }, d); path = FS.full(p); dirty = false; title(); render(); }
        catch { msgBox('This is not a valid calendar file.', 'Calendar', { icon: 'exclaim', owner: w }); }
      };
      const writeTo = p => { try { FS.write(p, JSON.stringify(data)); path = FS.full(p); dirty = false; title(); return true; } catch (e) { msgBox(e.message, 'Calendar', { icon: 'exclaim', owner: w }); return false; } };
      const saveAs = async () => { const p = await fileDialog({ mode: 'save', owner: w, defExt: 'CAL', name: path ? FS.basename(path) : '*.cal', filters: [['Calendar Files (*.CAL)', '*.CAL']] }); return p ? writeTo(p) : false; };
      const save = () => path ? writeTo(path) : saveAs();

      const gotoDate = () => dialog({
        title: 'Show Date', w: 260, h: 70, owner: w,
        build(d) {
          const t = UI.text(dateStr(cur));
          d.add(UI.label('Show &Date:', t), 10, 14); d.add(t, 80, 10, 80);
          d.add(UI.button('OK', { default: true, onClick: () => {
            const nd = Intl31.parseDate(t.value);
            if (!nd) { msgBox('Invalid date.', 'Calendar', { icon: 'exclaim', owner: d.win }); return; }
            cur = nd; d.close(); render();
          } }), 172, 6, 80, 25);
          d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 172, 36, 80, 25);
        }
      });
      const markDlg = () => dialog({
        title: 'Day Markings', w: 200, h: 140, owner: w,
        build(d) {
          const k = key(cur), cur_ = data.marks[k] || 0;
          const g = UI.group('Mark'); d.add(g, 8, 4, 100, 128);
          const radios = MARKS.map((m, i) => UI.radio('mk', i ? `Symbol &${i}  ${m}` : '&None', cur_ === i));
          radios.forEach((r, i) => d.add(r, 16, 22 + i * 18));
          d.add(UI.button('OK', { default: true, onClick: () => { const i = radios.findIndex(r => r.input.checked); if (i > 0) data.marks[k] = i; else delete data.marks[k]; touch(); d.close(); render(); } }), 114, 8, 78, 25);
          d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 114, 38, 78, 25);
        }
      });
      const daySettings = () => dialog({
        title: 'Day Settings', w: 280, h: 100, owner: w,
        build(d) {
          const g = UI.group('Interval');
          d.add(g, 8, 4, 180, 40);
          const ivs = [15, 30, 60].map(v => UI.radio('iv', `&${v}`, settings.interval === v));
          ivs.forEach((r, i) => d.add(r, 18 + i * 50, 20));
          const st = UI.text(`${settings.start % 12 || 12}:00`);
          d.add(UI.label('&Starting Time:', st), 8, 64); d.add(st, 100, 60, 60);
          d.add(UI.button('OK', { default: true, onClick: () => {
            settings.interval = [15, 30, 60][ivs.findIndex(r => r.input.checked)] || 60;
            settings.start = clamp(parseInt(st.value) || 7, 0, 23);
            Store.set('cal.settings', settings); d.close(); render();
          } }), 194, 8, 78, 25);
          d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 194, 38, 78, 25);
        }
      });
      const toggleAlarm = () => {
        if (view !== 'day' || !focusedTime) { Snd.beep(); return; }
        const k = key(cur) + ' ' + focusedTime;
        if (data.alarms[k]) delete data.alarms[k]; else data.alarms[k] = 1;
        touch(); render();
      };

      const w = new Win({
        title: 'Calendar - (Untitled)', icon: 'calendar', w: 400, h: 380,
        onClose: confirmLose,
        menu: [
          { label: '&File', items: [
            { label: '&New', action: async () => { if (await confirmLose()) { data = { appts: {}, notes: {}, marks: {}, alarms: {} }; path = null; dirty = false; title(); render(); } } },
            { label: '&Open...', action: async () => { if (!(await confirmLose())) return; const p = await fileDialog({ owner: w, filters: [['Calendar Files (*.CAL)', '*.CAL']] }); if (p) load(p); } },
            { label: '&Save', action: save }, { label: 'Save &As...', action: saveAs }, '-',
            { label: '&Print...', action: () => printDoc('Calendar', name(), JSON.stringify(data.appts), w) },
            { label: 'Page Se&tup...', disabled: true }, { label: 'P&rint Setup...', action: () => Sys.launch('CONTROL.EXE printers') }, '-',
            { label: 'R&emove...', action: async () => { const r = await msgBox(`Remove all appointments for ${longDate(cur)}?`, 'Calendar', { buttons: 'okcancel', icon: 'question', owner: w }); if (r === 'ok') { delete data.appts[key(cur)]; delete data.notes[key(cur)]; touch(); render(); } } }, '-',
            { label: 'E&xit', action: () => w.close() }] },
          { label: '&Edit', items: [
            { label: 'Cu&t', key: 'Ctrl+X', action: () => document.execCommand('cut') },
            { label: '&Copy', key: 'Ctrl+C', action: () => document.execCommand('copy') },
            { label: '&Paste', key: 'Ctrl+V', action: () => { const t = Sys.clipboard?.type === 'text' ? Sys.clipboard.data : ''; if (t) document.execCommand('insertText', false, t); } },
            { label: '&Remove', key: 'Del', action: () => document.execCommand('delete') }] },
          { label: '&View', items: [
            { label: '&Day', key: 'F8', checked: () => view === 'day', action: () => { view = 'day'; render(); } },
            { label: '&Month', key: 'F9', checked: () => view === 'month', action: () => { view = 'month'; render(); } }] },
          { label: '&Show', items: [
            { label: '&Today', action: () => { cur = Sys.now(); cur.setHours(0, 0, 0, 0); render(); } },
            { label: '&Previous', key: 'Ctrl+PageUp', keyLabel: 'Ctrl+PgUp', action: () => step(-1) },
            { label: '&Next', key: 'Ctrl+PageDown', keyLabel: 'Ctrl+PgDn', action: () => step(1) },
            { label: '&Date...', key: 'F4', action: gotoDate }] },
          { label: '&Alarm', items: [
            { label: '&Set', key: 'F5', action: toggleAlarm },
            { label: '&Controls...', action: () => msgBox('Alarms ring at the appointment time while Calendar is running.', 'Alarm Controls', { icon: 'info', owner: w }) }] },
          { label: '&Options', items: [
            { label: '&Mark...', key: 'F6', action: markDlg },
            { label: '&Special Time...', key: 'F7', action: () => dialog({ title: 'Special Time', w: 240, h: 70, owner: w, build(d) {
              const t = UI.text('12:00 PM');
              d.add(UI.label('&Special Time:', t), 10, 14); d.add(t, 90, 10, 60);
              d.add(UI.button('&Insert', { default: true, onClick: () => {
                const m = /^(\d{1,2}):(\d{2})\s*([ap])?/i.exec(t.value.trim()); if (!m) return;
                let hh = +m[1] % 12 + (/p/i.test(m[3] || '') ? 12 : 0);
                const k = key(cur); data.appts[k] ||= {}; data.appts[k][`${pad(hh)}:${m[2]}`] ||= ' '; touch(); d.close(); render();
              } }), 160, 6, 72, 25);
              d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 160, 36, 72, 25);
            } }) },
            { label: '&Day Settings...', action: daySettings }] },
          { label: '&Help', items: [{ label: '&Contents', action: () => Sys.launch('WINHELP.EXE calendar') }, { label: '&Search for Help on...', action: () => Sys.launch('WINHELP.EXE calendar') }, { label: '&How to Use Help', action: () => Sys.launch('WINHELP.EXE winhelp') }, '-', { label: '&About Calendar...', action: () => aboutBox('Calendar', 'calendar', w) }] }
        ]
      });
      w.body.style.display = 'flex'; w.body.style.flexDirection = 'column';
      w.body.append(header, main, pad_);
      const tick = setInterval(() => {
        const now = Sys.now();
        clockLbl.textContent = timeStr(now);
        const k = key(now) + ' ' + `${pad(now.getHours())}:${pad(now.getMinutes())}`;
        if (data.alarms[k] && now.getSeconds() < 2 && !tick.rang?.[k]) {
          (tick.rang ||= {})[k] = 1;
          Snd.beep(); setTimeout(() => Snd.beep(), 400); setTimeout(() => Snd.beep(), 800);
          const t = (data.appts[key(now)] || {})[`${pad(now.getHours())}:${pad(now.getMinutes())}`] || '';
          msgBox(`${timeStr(now)}\n${t}`, 'Please remember...', { icon: 'info', owner: w });
        }
      }, 1000);
      w.on('closed', () => clearInterval(tick));
      if (opts.args) load(FS.full(opts.args.trim(), 'C:\\WINDOWS'));
      render();
      return w;
    }
  });
})();
