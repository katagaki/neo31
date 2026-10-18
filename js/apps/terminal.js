'use strict';
/* Terminal — with a simulated Hayes modem and a tiny dial-up BBS */
(() => {
  Sys.registerApp('terminal', {
    name: 'Terminal', icon: 'terminal', help: 'terminal',
    run(opts) {
      const st = Object.assign({ phone: '555-0131', baud: 2400, echo: true }, Store.get('term', {}));
      const pre = h('div', { style: { position: 'absolute', left: 0, top: 0 } });
      const scroller = h('div', { class: 'fill', style: { overflow: 'auto', background: 'var(--window)' } }, pre);
      const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
      const con = new TextConsole(pre, 80, 24, { colors: () => ({ bg: css('--window') || '#fff', fg: css('--window-text') || '#000' }) });
      let dialTimer = null;
      let online = false, dialing = false, line = '', q = [], bbs = null, path = null;

      // output queue at "baud rate"
      const remoteFiles = new Map([['SOLHINT.TXT', { t: 'f', x: 'Build down in alternating colors. Reveal face-down cards before moving to the foundations.\n', d: WIN_DATE }], ['CHIMES.WAV', JSON.parse(JSON.stringify(FS.get('C:\\WINDOWS\\CHIMES.WAV')))] ]);
      let received = '';
      const out = s => { received = (received + s).slice(-1024 * 1024); q.push(...s); pump(); };
      let pumping = false;
      const pump = () => {
        if (pumping) return;
        pumping = true;
        const step = () => {
          if (w.closed) { q.length = 0; pumping = false; return; }
          const n = Math.max(1, Math.round(st.baud / 10 / 60));
          for (let i = 0; i < n && q.length; i++) con.write(q.shift());
          if (q.length) requestAnimationFrame(step); else pumping = false;
        };
        requestAnimationFrame(step);
      };
      const outln = s => out(s + '\r\n');

      /* ---- modem ---- */
      const modem = cmd => {
        const c = cmd.trim().toUpperCase();
        if (!c) return;
        if (!c.startsWith('AT')) { outln('ERROR'); return; }
        if (/^ATD[TP]?/.test(c)) { dial(c.replace(/^ATD[TP]?/, '').trim() || st.phone); return; }
        if (c === 'ATI' || c === 'ATI0') { outln('Engineering Club 2400 Modem'); outln('OK'); return; }
        if (c === 'ATH' || c === 'ATH0') { outln('OK'); return; }
        outln('OK');
      };
      const dial = num => {
        if (online || dialing) return;
        dialing = true;
        dialStatus(num);
        const tones = num.replace(/\D/g, '');
        const ctx = Snd.ensure();
        if (ctx) {
          const DTMF = { 1: [697, 1209], 2: [697, 1336], 3: [697, 1477], 4: [770, 1209], 5: [770, 1336], 6: [770, 1477], 7: [852, 1209], 8: [852, 1336], 9: [852, 1477], 0: [941, 1336] };
          [...tones].forEach((d, i) => DTMF[d].forEach(f => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; g.gain.value = 0.03; o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + 0.3 + i * 0.12); o.stop(ctx.currentTime + 0.3 + i * 0.12 + 0.08); }));
          // handshake screech
          const t0 = ctx.currentTime + 1.6 + tones.length * 0.12;
          const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; g.gain.value = 0.02;
          o.frequency.setValueAtTime(2100, t0); o.frequency.setValueAtTime(1200, t0 + 0.6); o.frequency.linearRampToValueAtTime(2400, t0 + 1.4); o.frequency.setValueAtTime(980, t0 + 1.6);
          o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + 2.2);
        }
        dialTimer = setTimeout(() => {
          if (!dialing || w.closed) return;
          dialing = false;
          if (dlg) dlg.close();
          if (tones === '5550131' || tones === '0131' || tones.endsWith('0131')) { online = true; outln(`CONNECT ${st.baud}`); bbs = BBS(); }
          else { outln('NO CARRIER'); }
        }, 4200 + tones.length * 120);
      };
      let dlg = null;
      const dialStatus = num => {
        dlg = dialog({ title: 'Terminal', w: 260, h: 80, owner: w, modal: false, build(d) {
          d.add(h('div', { class: 'txt', text: `Dialing ${num}...\n\nTimeout:  30` }), 14, 10);
          d.add(UI.button('Cancel', { default: true, cancel: true, onClick: () => { dialing = false; clearTimeout(dialTimer); d.close(); outln('NO CARRIER'); } }), 168, 10, 80, 25);
        } });
        dlg.promise.then(() => { dlg = null; });
      };
      const hangup = () => { if (online) { online = false; bbs = null; outln(''); outln('NO CARRIER'); } };

      /* ---- the BBS ---- */
      const BBS = () => {
        const s = { stage: 'name', name: '', guess: null, tries: 0 };
        const banner = [
          '', '  ███╗   ██╗███████╗ ██████╗ ██████╗  ██╗', '  ████╗  ██║██╔════╝██╔═══██╗╚════██╗███║',
          '  ██╔██╗ ██║█████╗  ██║   ██║ █████╔╝╚██║', '  ██║╚██╗██║██╔══╝  ██║   ██║ ╚═══██╗ ██║',
          '  ██║ ╚████║███████╗╚██████╔╝██████╔╝ ██║', '  ╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═════╝  ╚═╝', '',
          '       The MomoTalk Bulletin Board System     -   Node 1 of 1', '       Running since 1992 on a 486DX2/66 with 2 phone lines', ''];
        banner.forEach(outln);
        out('What is your first name? ');
        const menu = () => { outln(''); outln('  [B]ulletins   [F]iles   [M]essages   [G]ame   [W]ho   [T]ime   [Q]uit'); out(`\r\n${s.name}, command? `); };
        return {
          upload(name, text) { remoteFiles.set(name, { t: 'f', x: text, d: VFS.now() }); outln(''); outln(`Received ${name}: ${text.length} characters. Thank you for your upload.`); menu(); },
          input(l) {
            const t = l.trim();
            if (s.stage === 'name') { s.name = t || 'GUEST'; s.stage = 'menu'; outln(''); outln(`Welcome, ${s.name}! You have 60 minutes left today.`); menu(); return; }
            if (s.stage === 'game') {
              const n = parseInt(t);
              if (isNaN(n)) { out('A number, please: '); return; }
              s.tries++;
              if (n === s.guess) { outln(`Correct! You got it in ${s.tries} tries.`); s.stage = 'menu'; menu(); }
              else { out(n < s.guess ? 'Higher! Guess: ' : 'Lower! Guess: '); }
              return;
            }
            switch (t.toUpperCase()[0]) {
              case 'B': ['', '=== BULLETINS ===', '1. Windows 3.1 has shipped! Upgrade from 3.0 today.', '2. New file area: TrueType fonts.', '3. SysOp vacation next week. Be nice to the modem.'].forEach(outln); break;
              case 'F': ['', '=== FILE AREA 1: WINDOWS UTILITIES ===', ...[...remoteFiles.keys()], '', 'Use Transfers > Receive Binary File to save a file.'].forEach(outln); break;
              case 'M': ['', '=== MESSAGES ===', 'From: SYSOP    To: ALL    Subj: Welcome', '  Thanks for calling! Leave a message after the tone.', '', 'From: BILL     To: ALL    Subj: Hotdog Stand', '  Who designed that colour scheme? I love it.'].forEach(outln); break;
              case 'G': s.guess = 1 + Math.floor(Math.random() * 100); s.tries = 0; s.stage = 'game'; outln(''); out('I am thinking of a number from 1 to 100. Guess: '); return;
              case 'W': ['', 'Node  User            Activity', '----  --------------  ---------------', `  1   ${s.name.padEnd(14)}  Browsing menus`].forEach(outln); break;
              case 'T': outln(''); outln(`The time is ${timeStr(Sys.now(), true)}.`); break;
              case 'Q': outln(''); outln(`Goodbye, ${s.name}! Call again soon.`); setTimeout(hangup, 600); return;
              default: outln(''); outln('Unknown command.');
            }
            menu();
          }
        };
      };

      const send = l => { if (online && bbs) bbs.input(l); else modem(l); };

      const viewText = async sendFile => {
        const p = await fileDialog({ owner: w, filters: [['Text files', '*.TXT'], ['All files', '*.*']] });
        if (!p) return;
        const text = FS.read(p);
        if (text == null || /^data:/.test(text)) { msgBox('Choose a text file.', 'Terminal', { owner: w, icon: 'exclaim' }); return; }
        if (!sendFile) { Sys.run('notepad', { args: p }); return; }
        if (!online) { msgBox('Dial the BBS before sending a text file.', 'Terminal', { owner: w }); return; }
        // The local BBS accepts uploads without interpreting them as menu commands.
        bbs.upload(FS.basename(p), text);
      };
      const sendBinary = async () => {
        const p = await fileDialog({ owner: w, filters: [['All files', '*.*']] });
        if (!p || !online) return;
        const node = FS.get(p);
        if (!node || node.t !== 'f') return;
        remoteFiles.set(FS.basename(p), JSON.parse(JSON.stringify(node)));
        outln(`Uploaded ${FS.basename(p)} (${FS.size(node)} bytes) to MomoTalk BBS.`);
      };
      const receiveBinary = () => dialog({ title: 'Receive Binary File', w: 300, h: 200, owner: w, build(d) {
        const names = [...remoteFiles.keys()];
        const lb = UI.listbox({ items: names, sel: 0 });
        d.add(UI.label('&BBS files:', lb), 10, 8); d.add(lb, 10, 28, 175, 160);
        d.add(UI.button('Receive', { default: true, onClick: async () => {
          const name = lb.value?.text; if (!name) return;
          const node = remoteFiles.get(name);
          const p = await fileDialog({ mode: 'save', owner: d.win, name, defExt: FS.ext(name), filters: [['All files', '*.*']] });
          if (!p) return;
          try { const extra = { ...node }; delete extra.t; delete extra.x; delete extra.n; FS.write(p, node.x || '', extra); FS.flush(); outln(`Received ${name} into ${p}.`); d.close(); }
          catch (e) { msgBox(e.message, 'Terminal', { owner: d.win, icon: 'stop' }); }
        } }), 204, 8, 85, 25);
        d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 204, 40, 85, 25);
      } });
      const receiveText = async () => {
        const p = await fileDialog({ mode: 'save', owner: w, name: 'CAPTURE.TXT', defExt: 'TXT', filters: [['Text files', '*.TXT']] });
        if (!p) return;
        try { FS.write(p, received.replace(/\r\n/g, '\n')); FS.flush(); }
        catch (e) { msgBox(e.message, 'Terminal', { owner: w, icon: 'stop' }); }
      };

      const w = new Win({
        title: 'Terminal - (Untitled)', icon: 'terminal', w: 560, h: 380,
        onKey: (e, name) => {
          if (e.ctrlKey || e.altKey || e.metaKey) return false;
          if (e.key === 'Enter') { con.write('\r\n'); const l = line; line = ''; send(l); return true; }
          if (e.key === 'Backspace') { if (line) { line = line.slice(0, -1); con.write('\b \b'); } return true; }
          if (e.key.length === 1) { line += e.key; if (st.echo || !online) con.write(e.key); return true; }
          return false;
        },
        onClose: async () => { if (online) { const r = await msgBox('Terminal is still connected.\n\nDo you want to hang up?', 'Terminal', { buttons: 'yesno', icon: 'question', owner: w }); if (r !== 'yes') return false; hangup(); } return true; },
        menu: [
          { label: '&File', items: [
            { label: '&New', action: () => { con.clear(); path = null; w.setTitle('Terminal - (Untitled)'); } },
            { label: '&Open...', action: async () => { const p = await fileDialog({ owner: w, filters: [['Settings Files (*.TRM)', '*.TRM']] }); if (p) { try { Object.assign(st, JSON.parse(FS.read(p))); path = p; w.setTitle('Terminal - ' + FS.basename(p)); } catch {} } } },
            { label: '&Save', action: async () => { const p = path || await fileDialog({ mode: 'save', owner: w, defExt: 'TRM', filters: [['Settings Files (*.TRM)', '*.TRM']] }); if (p) { FS.write(p, JSON.stringify(st)); path = p; w.setTitle('Terminal - ' + FS.basename(p)); } } },
            { label: 'Save &As...', action: async () => { const p = await fileDialog({ mode: 'save', owner: w, defExt: 'TRM', filters: [['Settings Files (*.TRM)', '*.TRM']] }); if (p) { FS.write(p, JSON.stringify(st)); path = p; w.setTitle('Terminal - ' + FS.basename(p)); } } }, '-',
            { label: 'Print Set&up...', action: () => Sys.launch('CONTROL.EXE printers') }, '-',
            { label: 'E&xit', action: () => w.close() }] },
          { label: '&Edit', items: [
            { label: '&Copy', key: 'Ctrl+Ins', action: () => Sys.setClipboard({ type: 'text', data: String(getSelection()) }) },
            { label: '&Paste', key: 'Shift+Ins', action: () => { const t = Sys.clipboard?.type === 'text' ? Sys.clipboard.data : ''; for (const ch of t) { if (ch === '\n') { con.write('\r\n'); send(line); line = ''; } else { line += ch; con.write(ch); } } } },
            { label: 'Se&lect All', action: () => { const r = document.createRange(); r.selectNodeContents(pre); getSelection().removeAllRanges(); getSelection().addRange(r); } },
            { label: 'Clear Bu&ffer', action: () => con.clear() }] },
          { label: '&Settings', items: [
            { label: '&Phone Number...', action: () => dialog({ title: 'Phone Number', w: 300, h: 110, owner: w, build(d) {
              const t = UI.text(st.phone);
              d.add(UI.label('&Dial:', t), 10, 14); d.add(t, 60, 10, 140);
              d.add(UI.label('Hint: try 555-0131'), 10, 50);
              d.add(UI.check('&Redial After Timing Out', false), 10, 80);
              d.add(UI.button('OK', { default: true, onClick: () => { st.phone = t.value; Store.set('term', st); d.close(); } }), 212, 8, 80, 25);
              d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 212, 38, 80, 25);
            } }) },
            { label: 'Terminal &Emulation...', action: () => dialog({ title: 'Terminal Emulation', w: 240, h: 90, owner: w, build(d) { ['&TTY (Generic)', 'DEC VT-100 (ANSI)', 'DEC VT-52'].forEach((l, i) => d.add(UI.radio('te', l, i === 1), 14, 12 + i * 24)); d.add(UI.button('OK', { default: true, onClick: () => d.close() }), 152, 8, 80, 25); d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 152, 38, 80, 25); } }) },
            { label: 'Terminal &Preferences...', action: () => dialog({ title: 'Terminal Preferences', w: 260, h: 80, owner: w, build(d) { const e = UI.check('&Local Echo', st.echo); d.add(e, 14, 14); d.add(UI.check('Line &Wrap', true), 14, 40); d.add(UI.button('OK', { default: true, onClick: () => { st.echo = e.input.checked; Store.set('term', st); d.close(); } }), 172, 8, 80, 25); d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 172, 38, 80, 25); } }) },
            { label: '&Communications...', action: () => dialog({ title: 'Communications', w: 280, h: 100, owner: w, build(d) {
              const bauds = [110, 300, 600, 1200, 2400, 4800, 9600, 19200];
              const cb = UI.combo({ items: bauds.map(String), index: bauds.indexOf(st.baud) });
              d.add(UI.label('&Baud Rate:', cb), 10, 14); d.add(cb, 90, 10, 90);
              d.add(UI.label('Connector: COM1'), 10, 50);
              d.add(UI.button('OK', { default: true, onClick: () => { st.baud = bauds[cb.index]; Store.set('term', st); d.close(); } }), 192, 8, 80, 25);
              d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 192, 38, 80, 25);
            } }) },
            { label: '&Modem Commands...', action: () => msgBox('Dial prefix: ATDT\nHangup: +++ATH\nOriginate: ATQ0V1E1S0=0', 'Modem Commands', { owner: w }) }] },
          { label: '&Phone', items: [
            { label: '&Dial...', disabled: () => online, action: () => { outln(`ATDT ${st.phone}`); dial(st.phone); } },
            { label: '&Hangup', disabled: () => !online, action: hangup }] },
          { label: '&Transfers', items: [{ label: '&Send Text File...', action: () => viewText(true), disabled: () => !online }, { label: '&Receive Text File (capture)...', action: receiveText }, { label: '&View Text File...', action: () => viewText(false) }, '-', { label: 'Send &Binary File...', disabled: () => !online, action: sendBinary }, { label: 'Receive Binary &File...', disabled: () => !online, action: receiveBinary }] },
          { label: '&Help', items: [{ label: '&Contents', action: () => Sys.launch('WINHELP.EXE terminal') }, '-', { label: '&About Terminal...', action: () => aboutBox('Terminal', 'terminal', w) }] }
        ]
      });
      w.body.appendChild(scroller);
      w.on('closed', () => { clearTimeout(dialTimer); dialing = false; online = false; dlg?.close(); con.dispose(); });
      requestAnimationFrame(() => w.sizeToClient(640 + 17, 384));
      con.render();
      setTimeout(() => {
        if (!Store.get('term.seen')) { Store.set('term.seen', true); }
        outln('Engineering Club 2400 Modem ready. Type ATDT 555-0131 or use Phone > Dial.');
        outln('OK');
      }, 100);
      return w;
    }
  });
})();
