'use strict';
/* Windows 31 Setup and servicing: the first-run install and out-of-box experience,
   Windows Update, Reset this PC and the recovery environment. Each runs full-screen
   over everything else, and anything that spans a restart is remembered in the
   settings so the next start-up picks it up where it left off. */

/* ======================= THIS PC'S IDENTITY ======================= */
/* Generated once per PC (and again after "Remove everything"), like a real install. */
const PC = {
  get() {
    let id = Store.get('pc.identity');
    if (!id) { id = this.generate(); Store.set('pc.identity', id); }
    return id;
  },
  generate() {
    const pick = (set, n) => Array.from({ length: n }, () => set[Math.floor(Math.random() * set.length)]).join('');
    const AZ09 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', HEX = '0123456789ABCDEF', DIG = '0123456789';
    return {
      name: 'DESKTOP-' + pick(AZ09, 7),
      deviceId: [8, 4, 4, 4, 12].map(n => pick(HEX, n)).join('-'),
      productId: `${pick(DIG, 5)}-${pick(DIG, 5)}-${pick(DIG, 5)}-AAOEM`,
      // 00-A0-C9 is an Intel Ethernet prefix, as a 486's network card would have
      mac: ['00', 'A0', 'C9', pick(HEX, 2), pick(HEX, 2), pick(HEX, 2)].join('-'),
      ip: `192.168.${1 + Math.floor(Math.random() * 254)}.${2 + Math.floor(Math.random() * 250)}`,
      serial: pick(AZ09, 10)
    };
  },
  name() { return Store.get('deviceName') || this.get().name; }
};

/* ======================= SHARED FULL-SCREEN PIECES ======================= */
const SetupUI = {
  speed() { return Store.get('fastBoot') ? 0.2 : 1; },
  wait(ms) { return sleep(ms * this.speed()); },
  /* a full-screen layer above the desktop, lock screen and menus */
  layer(bg = '#000080') {
    const el = h('div', { class: 'neo-full w31-setup', style: { background: bg } });
    Sys.screen.appendChild(el);
    return el;
  },
  /* spinner + big line + small line, as on the update and reset screens */
  status(bg = '#000080') {
    const el = this.layer(bg), sp = Shell10.spinner('#ffffff');
    const big = h('div', { class: 'w31-big' }), small = h('div', { class: 'w31-small' });
    el.appendChild(h('div', { class: 'neo-center', style: { gap: '28px' } }, sp.el, h('div', { class: 'w31-stack' }, big, small)));
    return { el, set(b, s = '') { big.textContent = b; small.textContent = s; }, close() { sp.stop(); el.remove(); } };
  },
  /* count a percentage up with uneven steps, like real progress */
  async ramp(from, to, ms, fn) {
    let p = from;
    fn(p);
    while (p < to) {
      p = Math.min(to, p + 1 + (Math.random() < 0.15 ? Math.floor(Math.random() * 4) : 0));
      await this.wait(ms / Math.max(1, to - from) * (Math.random() < 0.08 ? 6 : 1));
      fn(p);
    }
  },
  toggle(label, desc, on) {
    const st = { on };
    const sw = h('div', { class: 'neo-toggle sunken' + (on ? ' on' : ''), tabindex: '0', role: 'switch', 'aria-label': label, 'aria-checked': String(on) }, h('div', { class: 'neo-knob raised' }));
    const txt = h('span', { text: on ? 'Yes' : 'No' });
    const flip = () => { st.on = !st.on; sw.classList.toggle('on', st.on); sw.setAttribute('aria-checked', String(st.on)); txt.textContent = st.on ? 'Yes' : 'No'; };
    sw.addEventListener('pointerup', flip);
    sw.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });
    st.el = h('div', { class: 'w31-privacy' }, h('div', { class: 'w31-togrow' }, sw, txt), h('div', {}, h('b', { text: label }), h('div', { class: 'w31-small', text: desc })));
    return st;
  },
  /* large flat tiles, as on the recovery environment's "Choose an option" screen */
  tile(icon, title, desc, fn) {
    const t = h('div', { class: 'w31-tile', tabindex: '0', role: 'button' }, iconImg(icon), h('div', {}, h('div', { class: 'w31-tiletitle', text: title }), desc ? h('div', { class: 'w31-small', text: desc }) : null));
    t.addEventListener('click', fn);
    t.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
    return t;
  },
  /* a message box drawn over the Setup screens (the desktop, where msgBox draws, is hidden) */
  message(text, title = 'Windows Setup', buttons = ['OK']) {
    return new Promise(resolve => {
      const veil = h('div', { class: 'neo-full', style: { zIndex: 410000, background: 'transparent' } });
      const foot = h('div', { class: 'w31-setupfoot' });
      const box = h('div', { class: 'w31-setupbox w31-msg raised', role: 'alertdialog', 'aria-label': title },
        h('div', { class: 'w31-setuptitle' }, h('span', { text: title })), h('div', { class: 'w31-setupbody', text: text }), foot);
      buttons.forEach((b, i) => { const btn = UI.button(b, { default: i === 0, onClick: () => { veil.remove(); resolve(b); } }); btn.style.minWidth = '80px'; foot.appendChild(btn); });
      veil.appendChild(h('div', { class: 'neo-center' }, box));
      Sys.screen.appendChild(veil);
      foot.querySelector('button').focus();
    });
  },
  logo(px = 64) { const c = neoLogoGrid(32).canvas(); c.className = 'neo-pix'; c.style.width = c.style.height = px + 'px'; return c; }
};

/* ======================= WINDOWS UPDATE ======================= */
const Updates = Object.assign(new Emitter(), {
  state: { phase: 'idle', items: [] },
  stamp(d = Sys.now()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; },
  /* this month's updates: KB numbers are derived from the date so they stay put */
  catalog() {
    const d = Sys.now(), m = d.getFullYear() * 12 + d.getMonth(), wk = Math.floor(d.getTime() / 6048e5);
    return [
      { id: 'cu' + m, title: `${this.stamp(d)} Cumulative Update for Windows 31 Version 22H2 for x86-based Systems (KB50${String(30000 + (m * 37) % 9000).padStart(5, '0')})`, size: 3.4, restart: true },
      { id: 'net' + m, title: `${this.stamp(d)} Cumulative Update for .NET Framework 3.5 for Windows 31 (KB50${String(31000 + (m * 53) % 8000).padStart(5, '0')})`, size: 1.1, restart: true },
      { id: 'mrt' + m, title: `Windows Malicious Software Removal Tool x86 - v5.${100 + m % 100} (KB890830)`, size: 0.6 },
      { id: 'def' + wk, title: `Security Intelligence Update for Microsoft Defender Antivirus - KB2267602 (Version 1.${400 + wk % 100}.${wk % 1000}.0)`, size: 0.4 },
      { id: 'off' + m, title: `Security Update for Microsoft Office 31 (KB${5002000 + (m * 11) % 900})`, size: 0.9, restart: true }
    ];
  },
  history() {
    return Store.get('wu.history', [
      { title: 'Feature update to Windows 31, version 22H2', date: WIN_DATE },
      { title: 'Windows 31 Feature Experience Pack 120.2212.4190.0', date: WIN_DATE },
      { title: 'Servicing Stack Update for Windows 31 (KB5005413)', date: DOS_DATE }
    ]);
  },
  pending() { return Store.get('wu.pending', []); },
  available() { const done = new Set([...this.history(), ...this.pending()].map(u => u.id).filter(Boolean)); return this.catalog().filter(u => !done.has(u.id)); },
  needsRestart() { return this.pending().length > 0; },
  set(phase, items) { this.state = { phase, items: items || this.state.items }; this.emit('change', this.state); },
  /* check, download and install in the background; the Settings page just watches */
  async run({ quiet = false } = {}) {
    if (this.state.phase === 'checking' || this.state.phase === 'working') return;
    this.set('checking', []);
    await SetupUI.wait(1800);
    const list = this.available();
    Store.set('wu.last', Date.now());
    if (!list.length) { this.set('idle', []); if (!quiet) Shell10.notify({ app: 'Windows Update', icon: 'neologo', title: 'You\'re up to date', text: 'Windows 31, version 22H2 is the latest version.' }); return; }
    const items = list.map(u => ({ ...u, status: 'Pending download', pct: 0 }));
    this.set('working', items);
    for (const it of items) {
      for (const [verb, ms] of [['Downloading', 900 + it.size * 900], ['Installing', 1200 + it.size * 700]]) {
        await SetupUI.ramp(0, 100, ms, p => { it.status = `${verb} - ${p}%`; it.pct = p; this.emit('change', this.state); });
      }
      if (it.restart) { it.status = 'Pending restart'; Store.set('wu.pending', [...this.pending(), { id: it.id, title: it.title }]); }
      else { it.status = 'Installed'; this.record([it]); }
      this.emit('change', this.state);
    }
    this.set(this.needsRestart() ? 'restart' : 'idle');
    if (this.needsRestart() && !quiet) Shell10.notify({ app: 'Windows Update', icon: 'neologo', title: 'Restart required', text: 'Restart your PC to finish installing updates. Choose Update and restart from Power.', onClick: () => Sys.launch('SETTINGS update/windowsupdate') });
  },
  record(list) { Store.set('wu.history', [...list.map(u => ({ id: u.id, title: u.title, date: Date.now() })), ...this.history()].slice(0, 40)); },
  /* the two halves of installing at restart: before shutting down and after starting */
  async beforeRestart() {
    const s = SetupUI.status();
    await SetupUI.ramp(0, 30, 4500, p => s.set(`Working on updates  ${p}%`, 'Don\'t turn off your computer'));
    Store.set('wu.stage2', true); Store.flush();
    s.close();
  },
  async afterRestart() {
    if (!Store.get('wu.stage2')) return;
    const s = SetupUI.status();
    await SetupUI.ramp(30, 100, 6000, p => s.set(`Working on updates  ${p}%`, 'Don\'t turn off your computer'));
    this.record(this.pending());
    Store.set('wu.pending', []); Store.set('wu.stage2', false);
    this.set('idle', []);
    s.close();
  }
});

/* ======================= SETUP AND OUT-OF-BOX EXPERIENCE ======================= */
const Setup = {
  /* PCs saved before Setup existed have already been set up */
  needed() { return !Store.get('oobe.done') && !Store.get('neo.inited'); },

  /* Runs before the desktop appears. Returns 'oobe' when the user has just been
     created, so the shell signs straight in, or 'off' if the PC was turned off. */
  async beforeDesktop() {
    const mode = Sys.mode;
    Sys.mode = 'setup';
    try {
      if (Store.get('winre.pending')) { Store.set('winre.pending', false); if (await Recovery.environment() === 'off') return 'off'; }
      if (Store.get('reset.pending')) await Recovery.performReset(Store.get('reset.pending'));
      await Updates.afterRestart();
      if (!this.needed()) return null;
      const afterReset = sessionStorage.getItem('w31.afterReset');
      sessionStorage.removeItem('w31.afterReset');
      if (afterReset) await this.reinstall();
      else if (await this.install() === 'off') return 'off';
      await this.oobe();
      return 'oobe';
    } finally { if (Sys.mode === 'setup') Sys.mode = mode; }
  },

  /* ---------- Windows Setup: the install wizard ---------- */
  install() {
    return new Promise(resolve => {
      const el = SetupUI.layer('#008080');
      const box = h('div', { class: 'w31-setupbox raised' });
      const title = h('div', { class: 'w31-setuptitle' }, iconImg('setup', 16), h('span', { text: 'Windows Setup' }));
      const body = h('div', { class: 'w31-setupbody' }), foot = h('div', { class: 'w31-setupfoot' });
      box.append(title, body, foot);
      el.appendChild(h('div', { class: 'neo-center' }, box));
      const btn = (label, fn, opts = {}) => { const b = UI.button(label, { default: opts.default, onClick: fn }); b.style.minWidth = '80px'; if (opts.disabled) b.disabled = true; return b; };
      const step = (kids, buttons) => { body.innerHTML = ''; foot.innerHTML = ''; body.append(...kids.filter(Boolean)); foot.append(...buttons); (foot.querySelector('button[data-default]') || body.querySelector('input, .lb, button'))?.focus(); };
      const field = (label, ctl) => { ctl.el.style.position = 'relative'; ctl.el.style.width = '260px'; return h('div', { class: 'w31-field' }, h('span', { text: label }), ctl.el); };

      const language = () => {
        const lang = UI.combo({ label: 'Language to install', items: ['English (United States)', 'English (United Kingdom)', 'Japanese', 'German', 'French'] }); lang.set(0, false);
        const fmt = UI.combo({ label: 'Time and currency format', items: ['English (United States)', 'English (United Kingdom)', 'Japanese (Japan)', 'German (Germany)', 'French (France)'] }); fmt.set(0, false);
        const kb = UI.combo({ label: 'Keyboard or input method', items: ['US', 'United Kingdom', 'Japanese', 'German', 'French'] }); kb.set(0, false);
        step([h('div', { class: 'w31-setuplogo' }, SetupUI.logo(48), h('span', { text: 'Windows 31' })),
          field('Language to install:', lang), field('Time and currency format:', fmt), field('Keyboard or input method:', kb),
          h('div', { class: 'w31-note', text: 'Enter your language and other preferences and click "Next" to continue.' })],
        [btn('&Next', () => { Store.set('oobe.language', lang.value.text); Store.set('oobe.keyboard', kb.value.text); installNow(); }, { default: true })]);
      };
      const installNow = () => {
        const go = btn('&Install now', productKey, { default: true }); go.style.minWidth = '140px'; go.style.height = '36px';
        const repair = SP.link('Repair your computer', async () => { el.remove(); const r = await Recovery.environment(); if (r === 'off') return resolve('off'); document.body.focus(); resolve(this.install()); });
        step([h('div', { class: 'w31-setuplogo' }, SetupUI.logo(48), h('span', { text: 'Windows 31' })), h('div', { class: 'neo-center w31-mid' }, go), repair], []);
      };
      const productKey = () => {
        const key = UI.text('', { maxLength: 29 }); key.style.width = '300px'; key.setAttribute('aria-label', 'Product key');
        const msg = h('div', { class: 'w31-err' });
        const next = () => {
          const v = key.value.trim().toUpperCase();
          if (!/^([A-Z0-9]{5}-){4}[A-Z0-9]{5}$/.test(v)) { msg.textContent = 'This product key didn\'t work. Check it and try again, or try a different key.'; Snd.beep(); return; }
          Store.set('oobe.productKey', v.slice(-5)); license();
        };
        key.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); next(); } });
        step([h('div', { class: 'w31-h', text: 'Activate Windows' }),
          h('div', { class: 'w31-note', text: 'If this is the first time you\'re installing Windows on this PC, you need to enter a valid product key. It looks like this: XXXXX-XXXXX-XXXXX-XXXXX-XXXXX' }),
          key, msg, SP.link('I don\'t have a product key', license)],
        [btn('&Next', next, { default: true })]);
      };
      const license = () => {
        const accept = UI.check('I &accept the license terms', false, v => { nb.disabled = !v; });
        const nb = btn('&Next', type, { default: true, disabled: true });
        step([h('div', { class: 'w31-h', text: 'Applicable notices and license terms' }),
          h('div', { class: 'w31-license sunken', text: LICENSE_TEXT }), accept],
        [btn('&Back', productKey), nb]);
      };
      const type = () => step([h('div', { class: 'w31-h', text: 'Which type of installation do you want?' }),
        SetupUI.tile('setup', 'Upgrade: Install Windows and keep files, settings, and applications', 'The upgrade option isn\'t available because there\'s no copy of Windows on this PC.', () => SetupUI.message('The upgrade option isn\'t available if you start your computer using Windows installation media.\n\nChoose Custom to continue.')),
        SetupUI.tile('thispc', 'Custom: Install Windows only (advanced)', 'The files, settings, and applications aren\'t moved to Windows with this option.', where)],
      [btn('&Back', license)]);
      const where = () => {
        const lb = UI.listbox({ label: 'Drives', items: [{ icon: 'thispc', text: 'Drive 0 Unallocated Space          125.0 MB          125.0 MB free' }], sel: 0 });
        lb.el.style.height = '110px';
        step([h('div', { class: 'w31-h', text: 'Where do you want to install Windows?' }), lb.el,
          h('div', { class: 'w31-note', text: 'Windows will create the partitions it needs on Drive 0.' })],
        [btn('&Back', type), btn('&Next', installing, { default: true })]);
      };
      const installing = async () => {
        const tasks = ['Copying Windows files', 'Getting files ready for installation', 'Installing features', 'Installing updates', 'Finishing up'];
        const rows = tasks.map(t => h('div', { class: 'w31-task' }, h('span', { class: 'w31-tick' }), h('span', { text: t })));
        step([h('div', { class: 'w31-h', text: 'Installing Windows' }), h('div', { class: 'w31-note', text: 'Status' }), ...rows,
          h('div', { class: 'w31-note', text: 'Your computer will restart several times. This might take a while.' })], []);
        for (let i = 0; i < tasks.length; i++) {
          rows[i].classList.add('on');
          const label = rows[i].lastChild;
          if (i === 1) await SetupUI.ramp(0, 100, 7000, p => { label.textContent = `${tasks[i]} (${p}%)`; });
          else await SetupUI.wait([1500, 0, 1800, 1400, 1200][i]);
          rows[i].classList.remove('on'); rows[i].classList.add('done');
        }
        restart();
      };
      const restart = async () => {
        const bar = h('div', { class: 'w31-bar sunken' }, h('div'));
        let left = 10, timer;
        const now = () => { clearInterval(timer); el.remove(); this.firstBoot().then(resolve); };
        step([h('div', { class: 'w31-h', text: 'Windows needs to restart to continue' }), h('div', { class: 'w31-note', text: 'Restarting in 10 seconds' }), bar],
          [btn('&Restart now', now, { default: true })]);
        timer = setInterval(() => {
          left--; bar.firstChild.style.width = ((10 - left) * 10) + '%';
          body.querySelector('.w31-note').textContent = `Restarting in ${left} second${left === 1 ? '' : 's'}`;
          if (left <= 0) now();
        }, 1000 * SetupUI.speed());
      };
      language();
    });
  },

  /* the reboots between install and first sign-in */
  async firstBoot() {
    const black = SetupUI.layer('#000');
    await SetupUI.wait(1200);
    black.remove();
    const el = SetupUI.layer('#000'), sp = Shell10.spinner('#ffffff'), line = h('div', { class: 'w31-small' });
    el.appendChild(h('div', { class: 'neo-center', style: { gap: '48px' } }, SetupUI.logo(128), h('div', { class: 'w31-stack' }, sp.el, line)));
    await SetupUI.ramp(0, 100, 5000, p => { line.textContent = `Getting devices ready ${p}%`; });
    line.textContent = 'Getting ready'; await SetupUI.wait(2500);
    sp.stop(); el.remove();
  },

  /* after Reset this PC: Windows reinstalls itself without the wizard */
  async reinstall() {
    const s = SetupUI.status();
    await SetupUI.ramp(0, 100, 9000, p => s.set(`Installing Windows ${p}%`, 'Your PC will restart several times. Sit back and relax.'));
    s.close();
    await this.firstBoot();
  },

  /* ---------- out-of-box experience ---------- */
  oobe() {
    return new Promise(resolve => {
      const el = SetupUI.layer('#000080');
      const head = h('div', { class: 'w31-oobehead' }), sub = h('div', { class: 'w31-oobesub' });
      const main = h('div', { class: 'w31-oobemain' }), foot = h('div', { class: 'w31-oobefoot' });
      const steps = h('div', { class: 'w31-oobesteps' });
      el.append(steps, h('div', { class: 'w31-oobe' }, head, sub, main), foot);
      const section = n => { steps.innerHTML = ''; ['Basics', 'Network', 'Account', 'Services'].forEach((t, i) => steps.appendChild(h('span', { class: i === n ? 'on' : '', text: t }))); };
      const page = (sec, title, text, kids, buttons, back) => {
        section(sec); head.textContent = title; sub.textContent = text || '';
        main.innerHTML = ''; main.append(...kids.filter(Boolean));
        foot.innerHTML = '';
        if (back) { const b = UI.button('&Back', { onClick: back }); b.style.minWidth = '90px'; foot.appendChild(b); }
        foot.appendChild(h('div', { style: { flex: 1 } }));
        buttons.forEach(([label, fn, opts = {}]) => { const b = UI.button(label, { default: opts.default, onClick: fn }); b.style.minWidth = '90px'; if (opts.disabled) b.disabled = true; foot.appendChild(b); });
        setTimeout(() => (main.querySelector('input, .lb') || foot.querySelector('button[data-default]'))?.focus(), 0);
        return foot;
      };
      const pickList = (items, cur) => { const lb = UI.listbox({ label: 'Choices', items, sel: Math.max(0, items.indexOf(cur)) }); lb.el.classList.add('w31-list'); return lb; };
      const busy = async (text, ms) => { section(-1); head.textContent = text; sub.textContent = ''; main.innerHTML = ''; foot.innerHTML = ''; const sp = Shell10.spinner('#ffffff'); main.appendChild(h('div', { class: 'w31-busy' }, sp.el)); await SetupUI.wait(ms); sp.stop(); };

      const region = () => {
        const lb = pickList(OOBE_REGIONS, Store.get('oobe.region', 'United States'));
        page(0, 'Let\'s start with region. Is this right?', '', [lb.el], [['&Yes', () => { Store.set('oobe.region', lb.value.text); keyboard(); }, { default: true }]]);
      };
      const keyboard = () => {
        const lb = pickList(OOBE_KEYBOARDS, Store.get('oobe.keyboard', 'US'));
        page(0, 'Is this the right keyboard layout?', 'If you also use another keyboard layout, you can add that in Settings after setup.', [lb.el],
          [['&Yes', async () => { Store.set('oobe.keyboard', lb.value.text); await busy('Just a moment...', 1500); network(); }, { default: true }]], region);
      };
      const network = async () => {
        await busy('Let\'s connect you to a network', 1200);
        const lb = UI.listbox({ label: 'Networks', items: [{ icon: 'cpNetwork', text: 'Ethernet  -  Windows 31 Network  -  Connected' }], sel: 0 }); lb.el.classList.add('w31-list'); lb.el.style.height = '60px';
        page(1, 'You\'re connected', 'Windows 31 found a wired network. Setup will use it to get the latest updates.', [lb.el],
          [['&Next', async () => { await busy('Checking for updates.', 1200); await updates(); }, { default: true }]], keyboard);
      };
      const updates = async () => {
        const items = Updates.available();
        section(1); head.textContent = 'Checking for updates.'; sub.textContent = 'This might take a few minutes.';
        main.innerHTML = ''; foot.innerHTML = '';
        const sp = Shell10.spinner('#ffffff'), pct = h('div', { class: 'w31-small' });
        main.appendChild(h('div', { class: 'w31-busy' }, sp.el, pct));
        await SetupUI.ramp(0, 100, 3500 + items.length * 900, p => { pct.textContent = `Downloading updates ${p}%`; });
        await SetupUI.ramp(0, 100, 2500, p => { pct.textContent = `Installing updates ${p}%`; });
        Updates.record(items);
        sp.stop();
        who();
      };
      const who = () => {
        const name = UI.text(Store.get('userName', ''), { maxLength: 20 }); name.placeholder = 'User name'; name.classList.add('w31-input');
        const go = () => { if (!name.value.trim()) return; Store.set('userName', name.value.trim()); password(); };
        const f = page(2, 'Who\'s going to use this PC?', 'What name do you want to use?', [name], [['&Next', go, { default: true, disabled: !name.value.trim() }]]);
        name.addEventListener('input', () => { f.querySelector('button[data-default]').disabled = !name.value.trim(); });
        name.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      };
      const password = () => {
        const pw = UI.text('', { password: true, maxLength: 64 }); pw.placeholder = 'Password'; pw.classList.add('w31-input');
        const go = () => { if (pw.value) confirmPw(pw.value); else { Store.set('acctPassword', ''); privacy(); } };
        pw.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
        page(2, 'Create a super memorable password', 'Make sure to pick something you\'ll absolutely remember. Leave it blank to sign in without a password.', [pw], [['&Next', go, { default: true }]], who);
      };
      const confirmPw = first => {
        const pw = UI.text('', { password: true, maxLength: 64 }); pw.placeholder = 'Confirm your password'; pw.classList.add('w31-input');
        const msg = h('div', { class: 'w31-err' });
        const go = () => { if (pw.value !== first) { msg.textContent = 'The passwords don\'t match. Try again.'; pw.value = ''; Snd.beep(); return; } Store.set('acctPassword', first); privacy(); };
        pw.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
        page(2, 'Confirm your password', '', [pw, msg], [['&Next', go, { default: true }]], password);
      };
      const privacy = () => {
        const opts = [['location', 'Location', 'Get location-based experiences like directions and weather.'], ['findmy', 'Find my device', 'Turn on Find my device and use your device\'s location data to help you find your device if you lose it.'],
          ['diag', 'Send optional diagnostic data', 'Help improve Windows 31 by sending info about the websites you browse and how you use apps.'], ['inking', 'Improve inking & typing', 'Send optional inking and typing diagnostic data to Microsoft.'],
          ['tailored', 'Get tailored experiences', 'Let Microsoft use your diagnostic data to offer you tips and recommendations.'], ['adid', 'Let apps use advertising ID', 'Apps can use advertising ID to provide more personalised advertising.']];
        const ts = opts.map(([k, l, d]) => [k, SetupUI.toggle(l, d, Store.get('privacy.' + k, true))]);
        page(3, 'Choose privacy settings for your device', 'Microsoft puts you in control of your privacy. Choose your settings, then select Accept to save them. You can change these settings at any time.',
          [h('div', { class: 'w31-privgrid' }, ...ts.map(([, t]) => t.el))], [['&Accept', () => { ts.forEach(([k, t]) => Store.set('privacy.' + k, t.on)); finish(); }, { default: true }]]);
      };
      const finish = async () => {
        foot.remove(); steps.remove();
        Sys.screen.classList.add('nocursor');
        const colors = ['#000080', '#800080', '#008080', '#0000ff', '#008000', '#000080'];
        const lines = [`Hi${Store.get('userName') ? ' ' + Store.get('userName') : ''}.`, 'We\'re getting everything ready for you', 'This might take several minutes', 'Don\'t turn off your PC', 'Leave everything to us', 'Let\'s start'];
        main.innerHTML = ''; sub.textContent = '';
        for (let i = 0; i < lines.length; i++) {
          el.style.background = colors[i]; head.textContent = lines[i];
          await SetupUI.wait(i === lines.length - 1 ? 1500 : 2600);
        }
        Sys.screen.classList.remove('nocursor');
        Store.set('oobe.done', true); Store.flush();
        el.remove();
        resolve();
      };
      region();
    });
  }
};

const OOBE_REGIONS = ['Australia', 'Canada', 'France', 'Germany', 'Ireland', 'Italy', 'Japan', 'Netherlands', 'New Zealand', 'Spain', 'Sweden', 'United Kingdom', 'United States'];
const OOBE_KEYBOARDS = ['Canadian French', 'French', 'German', 'Italian', 'Japanese', 'Spanish', 'Swedish', 'United Kingdom', 'US', 'US-International'];
const LICENSE_TEXT = `WINDOWS 31 SOFTWARE LICENSE TERMS

These license terms are an agreement between you and the Windows 31 simulation. Please read them. They apply to the software in your browser, including any updates, supplements, internet-based services and support services for this software.

1. INSTALLATION AND USE RIGHTS. You may install and use one copy of the software in each browser profile you own.

2. SCOPE OF LICENSE. Windows 31 is a fan-made simulation. It contains no Microsoft code and cannot run real programs. The files you create stay in your browser's storage on this device.

3. UPDATES. The software checks for simulated updates from time to time. They change nothing but this PC's update history.

4. NO WARRANTY. The software is provided "as is". It may lose your files if your browser clears its storage.

Microsoft and Windows are trademarks of Microsoft Corporation.`;

/* ======================= RESET AND RECOVERY ======================= */
const Recovery = {
  /* Settings > Recovery > Reset this PC */
  resetWizard() {
    let mode = null;
    return dialog({
      title: 'Reset this PC', w: 420, h: 230, build(d) {
        const area = h('div', { style: { position: 'absolute', inset: '0', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', font: '16px/18px "W31 MS Sans Serif 10", sans-serif' } });
        d.body.appendChild(area);
        const buttons = (...bs) => h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: 'auto' } }, ...bs.map(([l, fn, def]) => { const b = UI.button(l, { onClick: fn, default: def, cancel: l === 'Cancel' }); b.style.minWidth = '80px'; return b; }));
        const choose = () => {
          area.innerHTML = '';
          area.append(h('b', { text: 'Choose an option' }),
            SetupUI.tile('doc', 'Keep my files', 'Removes apps and settings, but keeps your personal files.', () => { mode = 'keep'; ready(); }),
            SetupUI.tile('recycle', 'Remove everything', 'Removes all of your personal files, apps, and settings.', () => { mode = 'remove'; ready(); }),
            buttons(['Cancel', () => d.close()]));
        };
        const ready = () => {
          area.innerHTML = '';
          area.append(h('b', { text: 'Ready to reset this PC' }), h('div', { text: 'Resetting will:' }),
            ...(mode === 'keep'
              ? ['Remove all apps and programs that didn\'t come with this PC', 'Change settings back to their defaults', 'Reinstall Windows without removing your personal files']
              : ['Remove all the personal files and user accounts on this PC', 'Remove any apps and programs that didn\'t come with this PC', 'Change settings back to their defaults', 'Give this PC a new name and device ID']).map(t => h('div', { text: '• ' + t })),
            h('div', { class: 'w31-small', style: { color: 'inherit' }, text: 'This will take a few minutes and your PC will restart.' }),
            buttons(['Back', choose], ['Reset', async () => { d.close(); Store.set('reset.pending', mode); Store.flush(); await Shell10.shutdown(true, { skipUpdates: true }); }, true], ['Cancel', () => d.close()]));
        };
        choose();
      }
    });
  },

  /* after the restart: show progress, then actually wipe and reboot into Setup */
  async performReset(mode) {
    const s = SetupUI.status();
    await SetupUI.ramp(0, 100, 9000, p => s.set(`Resetting this PC ${p}%`, ''));
    const users = FS.root.c.USERS, identity = Store.get('pc.identity');
    sessionStorage.setItem('w31.afterReset', '1');
    if (mode === 'keep') {
      FS.root = VFS.defaultTree();
      if (users) FS.root.c.USERS = users;
      Store.data = identity ? { 'pc.identity': identity } : {};
      Store.flush();
    } else Store.wipe();
    location.hash = '';
    location.reload();
    await new Promise(() => {});
  },

  /* Settings > Recovery > Advanced startup */
  async advancedStartup() {
    if (await msgBox('Your PC will restart to the Windows Recovery Environment, where you can repair or reset it.\n\nSave your work first.', 'Advanced startup', { buttons: 'okcancel', icon: 'info' }) !== 'ok') return;
    Store.set('winre.pending', true); Store.flush();
    Shell10.shutdown(true, { skipUpdates: true });
  },

  /* the blue "Choose an option" screens. Resolves 'continue' or 'off'. */
  environment() {
    return new Promise(resolve => {
      const el = SetupUI.layer('#000080');
      const head = h('div', { class: 'w31-reh' }), list = h('div', { class: 'w31-retiles' }), back = h('div', { class: 'w31-reback' });
      el.appendChild(h('div', { class: 'w31-re' }, back, head, list));
      const screen = (title, tiles, onBack) => {
        head.textContent = title; list.innerHTML = ''; list.append(...tiles);
        back.innerHTML = '';
        if (onBack) { const b = UI.button('←', { onClick: onBack }); b.setAttribute('aria-label', 'Back'); back.appendChild(b); }
        list.querySelector('.w31-tile')?.focus();
      };
      const leave = r => { el.remove(); resolve(r); };
      const working = async (text, ms) => { const s = SetupUI.status(); s.set(text, ''); await SetupUI.wait(ms); s.close(); };
      const home = () => screen('Choose an option', [
        SetupUI.tile('neologo', 'Continue', 'Exit and continue to Windows 31', () => leave('continue')),
        SetupUI.tile('control', 'Troubleshoot', 'Reset your PC or see advanced options', troubleshoot),
        SetupUI.tile('s_power', 'Turn off your PC', '', () => leave('off'))]);
      const troubleshoot = () => screen('Troubleshoot', [
        SetupUI.tile('setup', 'Reset this PC', 'Lets you choose to keep or remove your personal files, and then reinstalls Windows.', reset),
        SetupUI.tile('control', 'Advanced options', '', advanced)], home);
      const reset = () => screen('Reset this PC', [
        SetupUI.tile('doc', 'Keep my files', 'Removes apps and settings, but keeps your personal files.', () => doReset('keep')),
        SetupUI.tile('recycle', 'Remove everything', 'Removes all of your personal files, apps, and settings.', () => doReset('remove'))], troubleshoot);
      const doReset = async m => { el.remove(); await this.performReset(m); };
      const advanced = () => screen('Advanced options', [
        SetupUI.tile('setup', 'Startup Repair', 'Fix problems that keep Windows from loading', async () => {
          await working('Diagnosing your PC', 3500); await working('Attempting repairs', 3000);
          await SetupUI.message('Startup Repair didn\'t find any problems with this PC.\n\nLog file: C:\\WINDOWS\\SYSTEM\\SRTTRAIL.TXT', 'Startup Repair');
          FS.write('C:\\WINDOWS\\SYSTEM\\SRTTRAIL.TXT', `Startup Repair diagnosis and repair log\n---------------------------\nLast successful boot time: ${new Date().toString()}\nNumber of repair attempts: 1\n\nRoot cause found:\n---------------------------\nNo problems found.\n`);
          advanced();
        }),
        SetupUI.tile('dos', 'Command Prompt', 'Use the Command Prompt for advanced troubleshooting', () => SetupUI.message('Command Prompt is available once Windows 31 starts.\n\nChoose Continue, then open Command Prompt from Start.', 'Command Prompt')),
        SetupUI.tile('clock', 'System Restore', 'Use a restore point recorded on your PC to restore Windows', () => SetupUI.message('No restore points have been created on your computer\'s system drive.', 'System Restore')),
        SetupUI.tile('neologo', 'Uninstall Updates', 'Remove recently installed quality updates from Windows', async () => {
          const hist = Updates.history(), last = hist.findIndex(u => u.id);
          if (last < 0) { await SetupUI.message('There are no updates to uninstall.', 'Uninstall Updates'); return; }
          if (await SetupUI.message(`Uninstall ${hist[last].title}?`, 'Uninstall Updates', ['Yes', 'No']) !== 'Yes') return;
          await working('Uninstalling the latest quality update', 3000);
          Store.set('wu.history', hist.filter((_, i) => i !== last));
          await SetupUI.message('You\'ve successfully uninstalled the update.', 'Uninstall Updates');
        })], troubleshoot);
      home();
    });
  }
};
