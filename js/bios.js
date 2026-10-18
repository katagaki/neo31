'use strict';
/* BIOS: the CMOS settings the power-on self test uses, and the full-screen
   CMOS Setup Utility reached with DEL (or F2) while the PC starts. Settings are
   kept in the store as "CMOS" and take effect at the next start. */

const BIOS = {
  DEFAULTS: {
    driveA: '1.44M, 3.5 in.', driveB: 'None', video: 'EGA/VGA', haltOn: 'All Errors',
    quickPost: 'Disabled', bootSeq: 'A, C', numLock: 'On', typematic: 'Disabled', security: 'Setup', virusWarn: 'Disabled',
    cache: 'Enabled', shadow: 'Enabled', serial1: '3F8/IRQ4', serial2: '2F8/IRQ3', parallel: '378/IRQ7', ide: 'Enabled', audio: 'Enabled', lan: 'Enabled',
    apm: 'Enabled', standby: '15 Min', suspend: '1 Hour', hddOff: '15 Min', wakeKbd: 'Enabled'
  },
  FAILSAFE: { quickPost: 'Disabled', cache: 'Disabled', shadow: 'Disabled', apm: 'Disabled', typematic: 'Disabled' },
  get(k) { return { ...this.DEFAULTS, ...Store.get('cmos', {}) }[k]; },
  all() { return { ...this.DEFAULTS, ...Store.get('cmos', {}) }; },
  password() { return Store.get('cmos.password', ''); },

  /* colour attributes for TextConsole: "foreground|background" */
  A: { body: '#aaaaaa|#0000aa', hi: '#ffffff|#0000aa', yel: '#ffff55|#0000aa', sel: '#ffffff|#aa0000', head: '#ffff55|#0000aa', dim: '#55ffff|#0000aa', box: '#000000|#aaaaaa', boxhi: '#ffffff|#aa0000' },

  /* ask for the supervisor password; resolves true when it's right (or none is set) */
  async askPassword(con, read) {
    if (!this.password()) return true;
    for (let tries = 0; tries < 3; tries++) {
      const v = await this.prompt(con, read, 'Enter Password: ', { secret: true });
      if (v === this.password()) return true;
    }
    return false;
  },

  /* a one-line prompt box in the middle of the screen */
  async prompt(con, read, label, { secret = false, max = 8 } = {}) {
    let v = '';
    const draw = () => {
      const w = Math.max(30, label.length + max + 4), x = Math.floor((80 - w) / 2);
      this.box(con, x, 11, w, 3, '');
      this.put(con, x + 2, 12, (label + (secret ? '*'.repeat(v.length) : v)).padEnd(w - 4), this.A.box);
      con.setPos(x + 2 + label.length + v.length, 12);
    };
    con.cursor = true; draw();
    for (;;) {
      const e = await read();
      if (e.key === 'Enter') { con.cursor = false; return v; }
      if (e.key === 'Escape') { con.cursor = false; return null; }
      if (e.key === 'Backspace') v = v.slice(0, -1);
      else if (e.key.length === 1 && v.length < max) v += e.key;
      draw();
    }
  },
  async confirm(con, read, text) {
    const v = await this.prompt(con, read, text + ' (Y/N)? ', { max: 1 });
    return (v || '').toUpperCase() === 'Y';
  },

  put(con, x, y, text, attr) { con.setPos(x, y); con.write(String(text).slice(0, 80 - x), attr); },
  fill(con, y0, y1, attr) { for (let y = y0; y <= y1; y++) this.put(con, 0, y, ' '.repeat(80), attr); },
  box(con, x, y, w, hh, title) {
    const a = this.A.box;
    this.put(con, x, y, '╔' + '═'.repeat(w - 2) + '╗', a);
    for (let j = 1; j < hh - 1; j++) this.put(con, x, y + j, '║' + ' '.repeat(w - 2) + '║', a);
    this.put(con, x, y + hh - 1, '╚' + '═'.repeat(w - 2) + '╝', a);
    if (title) this.put(con, x + Math.floor((w - title.length - 2) / 2), y, ` ${title} `, a);
  },
  frame(con, title, help) {
    this.fill(con, 0, 24, this.A.body);
    this.put(con, 0, 0, ('  ROM PCI/ISA BIOS (2A69KN4B)').padEnd(80), this.A.hi);
    this.put(con, 0, 1, (' '.repeat(Math.floor((80 - title.length) / 2)) + title).padEnd(80), this.A.hi);
    this.put(con, 0, 2, ('                     VERITAS SOFTWARE, INC.').padEnd(80), this.A.hi);
    this.put(con, 0, 3, '═'.repeat(80), this.A.body);
    this.put(con, 0, 21, '═'.repeat(80), this.A.body);
    help.forEach((l, i) => this.put(con, 1, 22 + i, l.padEnd(78), this.A.body));
  },

  /* page definitions: [label, key, options] — options null = read-only text from a function */
  pages() {
    const now = () => Sys.now();
    return {
      'STANDARD CMOS SETUP': [
        ['Date (mm:dd:yy)', 'date', null, () => `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now().getDay()]}, ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][now().getMonth()]} ${now().getDate()} ${now().getFullYear()}`],
        ['Time (hh:mm:ss)', 'time', null, () => `${pad(now().getHours())} : ${pad(now().getMinutes())} : ${pad(now().getSeconds())}`],
        ['Primary Master', 'hdd', null, () => 'SHITTIM-AT125 125MB  CYLS 1001 HEAD 15 SECT 17'],
        ['Primary Slave', 'hdd2', null, () => 'None'],
        ['Drive A', 'driveA', ['None', '360K, 5.25 in.', '1.2M, 5.25 in.', '720K, 3.5 in.', '1.44M, 3.5 in.']],
        ['Drive B', 'driveB', ['None', '360K, 5.25 in.', '1.2M, 5.25 in.', '720K, 3.5 in.', '1.44M, 3.5 in.']],
        ['Video', 'video', ['EGA/VGA', 'CGA 40', 'CGA 80', 'MONO']],
        ['Halt On', 'haltOn', ['All Errors', 'No Errors', 'All, But Keyboard', 'All, But Diskette']],
        ['Base Memory', 'mem0', null, () => '640K'],
        ['Extended Memory', 'mem1', null, () => '7552K'],
        ['Total Memory', 'mem2', null, () => '8192K']],
      'BIOS FEATURES SETUP': [
        ['Virus Warning', 'virusWarn', ['Disabled', 'Enabled']],
        ['External Cache', 'cache', ['Enabled', 'Disabled']],
        ['Quick Power On Self Test', 'quickPost', ['Disabled', 'Enabled']],
        ['Boot Sequence', 'bootSeq', ['A, C', 'C, A', 'C Only']],
        ['Boot Up NumLock Status', 'numLock', ['On', 'Off']],
        ['Typematic Rate Setting', 'typematic', ['Disabled', 'Enabled']],
        ['Security Option', 'security', ['Setup', 'System']],
        ['Video BIOS Shadow', 'shadow', ['Enabled', 'Disabled']]],
      'INTEGRATED PERIPHERALS': [
        ['Onboard IDE Controller', 'ide', ['Enabled', 'Disabled']],
        ['Onboard Serial Port 1', 'serial1', ['3F8/IRQ4', '2F8/IRQ3', '3E8/IRQ4', 'Disabled']],
        ['Onboard Serial Port 2', 'serial2', ['2F8/IRQ3', '3F8/IRQ4', '2E8/IRQ3', 'Disabled']],
        ['Onboard Parallel Port', 'parallel', ['378/IRQ7', '278/IRQ5', '3BC/IRQ7', 'Disabled']],
        ['Onboard Sound', 'audio', ['Enabled', 'Disabled']],
        ['Onboard LAN', 'lan', ['Enabled', 'Disabled']]],
      'POWER MANAGEMENT SETUP': [
        ['Power Management (APM)', 'apm', ['Enabled', 'Disabled']],
        ['Standby Mode', 'standby', ['Disabled', '1 Min', '5 Min', '15 Min', '30 Min']],
        ['Suspend Mode', 'suspend', ['Disabled', '15 Min', '30 Min', '1 Hour']],
        ['HDD Power Down', 'hddOff', ['Disabled', '5 Min', '15 Min']],
        ['Wake Up on Keyboard', 'wakeKbd', ['Enabled', 'Disabled']]],
      'PC HEALTH STATUS': [
        ['CPU Temperature', 't1', null, () => `${38 + Math.round(Math.sin(Date.now() / 7000) * 2 + Math.random())}°C/${Math.round((38 + Math.sin(Date.now() / 7000) * 2) * 9 / 5 + 32)}°F`],
        ['CPU Fan Speed', 'f1', null, () => `${4600 + Math.round(Math.sin(Date.now() / 5000) * 60 + Math.random() * 20)} RPM`],
        ['Vcore', 'v1', null, () => `${(5.0 + Math.sin(Date.now() / 3000) * 0.02).toFixed(2)} V`],
        ['+12 V', 'v2', null, () => `${(12.1 + Math.sin(Date.now() / 4000) * 0.05).toFixed(2)} V`]]
    };
  },

  /* the utility itself; resolves when the user leaves (the PC then restarts) */
  async setup(con) {
    const queue = [];
    let waiter = null;
    Sys.textKey = e => { e.preventDefault(); if (waiter) { const w = waiter; waiter = null; w(e); } else queue.push(e); };
    const read = () => queue.length ? Promise.resolve(queue.shift()) : new Promise(r => waiter = r);
    con.cursor = false;
    if (!(await this.askPassword(con, read))) { this.fill(con, 0, 24, this.A.body); this.put(con, 30, 12, 'Password incorrect.', this.A.hi); await sleep(1500); return; }
    let cmos = this.all();
    const main = [
      ['STANDARD CMOS SETUP', 'Time, Date, Hard Disk Type...'], ['BIOS FEATURES SETUP', 'Boot sequence, quick self test, security'],
      ['INTEGRATED PERIPHERALS', 'Onboard ports, sound and network'], ['POWER MANAGEMENT SETUP', 'Standby, suspend and wake-up'],
      ['PC HEALTH STATUS', 'Temperature, fan and voltages'], ['LOAD BIOS DEFAULTS', 'Load the fail-safe settings'],
      ['LOAD SETUP DEFAULTS', 'Load the optimised settings'], ['SUPERVISOR PASSWORD', 'Set, change or clear the password'],
      ['SAVE & EXIT SETUP', 'Save CMOS value changes and exit'], ['EXIT WITHOUT SAVING', 'Abandon all changes and exit']];
    let sel = 0;
    const drawMain = () => {
      this.frame(con, 'CMOS SETUP UTILITY', ['Esc : Quit                          ↑ ↓ → ←   : Select Item', 'F10 : Save & Exit Setup', '']);
      main.forEach(([t], i) => { const x = i < 5 ? 3 : 42, y = 6 + (i % 5) * 2; this.put(con, x, y, ` ${t.padEnd(30)} `, i === sel ? this.A.sel : this.A.yel); });
      this.put(con, 1, 24, main[sel][1].padEnd(78), this.A.hi);
    };
    const page = async title => {
      const rows = this.pages()[title];
      let r = 0;
      const ticker = setInterval(() => draw(), 1000);
      const draw = () => {
        this.frame(con, title, ['Esc : Quit    ↑↓→← : Select Item    PU/PD/+/- : Modify', 'F5  : Old Values    F6 : Load BIOS Defaults    F7 : Load Setup Defaults', '']);
        rows.forEach(([label, key, opts, fn], i) => {
          const v = opts ? cmos[key] : fn();
          this.put(con, 3, 5 + i, `${label.padEnd(28)}: `, this.A.body);
          this.put(con, 33, 5 + i, opts ? `${v}` : v, opts ? (i === r ? this.A.sel : this.A.yel) : this.A.dim);
        });
        const [, key, opts] = rows[r];
        this.put(con, 1, 24, (opts ? `Options: ${opts.join(' / ')}` : key === 'date' || key === 'time' ? 'Use + and - to change, as in MS-DOS DATE and TIME' : 'Detected automatically').slice(0, 78).padEnd(78), this.A.hi);
      };
      const move = d => { r = (r + d + rows.length) % rows.length; };
      draw();
      for (;;) {
        const e = await read();
        const [, key, opts] = rows[r];
        if (e.key === 'Escape') break;
        if (e.key === 'ArrowDown') move(1);
        else if (e.key === 'ArrowUp') move(-1);
        else if (['PageDown', 'PageUp', '+', '-', '=', 'ArrowRight', 'ArrowLeft', 'Enter'].includes(e.key)) {
          const d = ['PageUp', '-', 'ArrowLeft'].includes(e.key) ? -1 : 1;
          if (opts) { cmos[key] = opts[(opts.indexOf(cmos[key]) + d + opts.length) % opts.length]; }
          else if (key === 'date' || key === 'time') { Store.set('clockOffset', (Store.get('clockOffset', 0) || 0) + d * (key === 'date' ? 864e5 : 36e5)); Sys.emit('time'); }
        } else if (e.key === 'F5') { cmos = this.all(); }
        else if (e.key === 'F6') { cmos = { ...this.DEFAULTS, ...this.FAILSAFE }; }
        else if (e.key === 'F7') { cmos = { ...this.DEFAULTS }; }
        draw();
      }
      clearInterval(ticker);
    };
    const save = () => { Store.set('cmos', cmos); Store.flush(); };
    drawMain();
    for (;;) {
      const e = await read();
      if (e.key === 'ArrowDown') sel = (sel + 1) % 10;
      else if (e.key === 'ArrowUp') sel = (sel + 9) % 10;
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') sel = (sel + 5) % 10;
      else if (e.key === 'F10') { if (await this.confirm(con, read, 'SAVE to CMOS and EXIT')) { save(); return; } }
      else if (e.key === 'Escape') { if (await this.confirm(con, read, 'Quit Without Saving')) return; }
      else if (e.key === 'Enter') {
        const t = main[sel][0];
        if (sel < 5) await page(t);
        else if (t === 'LOAD BIOS DEFAULTS') { if (await this.confirm(con, read, 'Load BIOS Defaults')) { cmos = { ...this.DEFAULTS, ...this.FAILSAFE }; } }
        else if (t === 'LOAD SETUP DEFAULTS') { if (await this.confirm(con, read, 'Load SETUP Defaults')) { cmos = { ...this.DEFAULTS }; } }
        else if (t === 'SUPERVISOR PASSWORD') {
          const p1 = await this.prompt(con, read, 'Enter Password: ', { secret: true });
          if (p1 !== null) {
            if (!p1) { Store.set('cmos.password', ''); drawMain(); this.box(con, 22, 11, 36, 3, ''); this.put(con, 24, 12, 'PASSWORD DISABLED !!!'.padEnd(32), this.A.box); await read(); }
            else if (await this.prompt(con, read, 'Confirm Password: ', { secret: true }) === p1) Store.set('cmos.password', p1);
          }
        } else if (t === 'SAVE & EXIT SETUP') { if (await this.confirm(con, read, 'SAVE to CMOS and EXIT')) { save(); return; } }
        else if (t === 'EXIT WITHOUT SAVING') { if (await this.confirm(con, read, 'Quit Without Saving')) return; }
      }
      drawMain();
    }
  }
};
