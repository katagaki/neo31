'use strict';
/* MS-DOS: 80x25 text console, COMMAND.COM interpreter, power-on/boot
   sequence, and the windowed "MS-DOS Prompt" application. */

const VGA_COLORS = { '': '#aaaaaa', 'c-hi': '#ffffff', 'c-cy': '#55ffff', 'c-ye': '#ffff55' };

/* 80x25 text mode drawn onto a canvas with the IBM VGA 8x16 bitmap font.
   The canvas is scaled with nearest-neighbour, so text stays pixel-exact
   even when stretched to fill the screen like a CRT. */
class TextConsole {
  constructor(el, cols = 80, rows = 25, opts = {}) {
    this.cols = cols; this.rows = rows; this.opts = opts;
    this.cls = '';
    this.cursor = true;
    this.blinkOn = true;
    this.scrolls = 0;
    this.canvas = h('canvas', { width: cols * 8, height: rows * 16, class: 'dosgrid' });
    this.ctx = this.canvas.getContext('2d');
    this.attach(el);
    const tick = () => {
      this.blinkOn = !this.blinkOn;
      if (this.cursor && this.canvas.isConnected) this.render();
      this._blink = setTimeout(tick, Settings.blinkMs());   // Control Panel > Desktop > Cursor Blink Rate
    };
    this._blink = setTimeout(tick, Settings.blinkMs());
    this.clear();
  }
  attach(el) { this.el = el; el.appendChild(this.canvas); this.dirty(); }
  dispose() { clearTimeout(this._blink); this.canvas.remove(); }
  blankRow() { return Array.from({ length: this.cols }, () => [' ', '']); }
  clear() {
    this.buf = Array.from({ length: this.rows }, () => this.blankRow());
    this.cx = 0; this.cy = 0;
    this.dirty();
  }
  scroll() {
    this.buf.shift(); this.buf.push(this.blankRow());
    this.cy = this.rows - 1; this.scrolls++;
  }
  newline() { this.cx = 0; this.cy++; if (this.cy >= this.rows) this.scroll(); }
  write(s, cls = this.cls) {
    for (const ch of String(s)) {
      if (ch === '\n') this.newline();
      else if (ch === '\r') this.cx = 0;
      else if (ch === '\b') { if (this.cx > 0) this.cx--; }
      else if (ch === '\t') { do this.putc(' ', cls); while (this.cx % 8); }
      else this.putc(ch, cls);
    }
    this.blinkOn = true;
    this.dirty();
  }
  putc(ch, cls) {
    if (this.cx >= this.cols) this.newline();
    this.buf[this.cy][this.cx] = [ch, cls];
    this.cx++;
  }
  writeln(s = '', cls) { this.write(s + '\n', cls); }
  setPos(x, y) { this.cx = x; this.cy = y; this.dirty(); }
  dirty() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = 0; this.render(); });
  }
  colors() { return this.opts.colors ? this.opts.colors() : { bg: '#000000', fg: VGA_COLORS[''] }; }
  render() {
    const x = this.ctx, { bg, fg } = this.colors();
    x.fillStyle = bg; x.fillRect(0, 0, this.canvas.width, this.canvas.height);
    x.font = '16px "W31 VGA"'; x.textBaseline = 'alphabetic';
    for (let y = 0; y < this.rows; y++) {
      let run = '', cur = '', start = 0;
      const flush = end => {
        if (run.trim()) { x.fillStyle = cur ? VGA_COLORS[cur] || fg : fg; x.fillText(run, start * 8, y * 16 + 12); }
        run = ''; start = end;
      };
      for (let c = 0; c < this.cols; c++) {
        const [ch, cls] = this.buf[y][c];
        if (cls !== cur) { flush(c); cur = cls; }
        run += ch;
      }
      flush(this.cols);
    }
    if (this.cursor && this.blinkOn) {
      x.fillStyle = fg;
      x.fillRect(Math.min(this.cx, this.cols - 1) * 8, this.cy * 16 + 13, 8, 2);
    }
  }
}

/* =================== COMMAND.COM =================== */
class DosShell {
  constructor(con, opts = {}) {
    this.con = con;
    this.inWin = !!opts.inWindows;
    this.onExit = opts.onExit;
    this.cwd = opts.cwd || 'C:\\';
    this.echo = true;
    this.line = ''; this.pos = 0;
    this.history = []; this.hidx = 0;
    this.busy = false;
    this.keyWaiter = null;
  }

  promptStr() {
    const d = Sys.now();
    // Neo10's Command Prompt shows paths with their Windows 10 capitalisation
    const pretty = () => {
      if (!(this.inWin && Sys.isNeo())) return this.cwd;
      const r = FS.resolve(this.cwd); let p = 'C:', node = FS.root;
      for (const part of r.parts) { node = node && node.c && node.c[part]; p += '\\' + FS.displayName(part, node || { t: 'd' }); }
      return r.parts.length ? p : 'C:\\';
    };
    return (Sys.env.PROMPT || '$n$g').replace(/\$(.)/gi, (_, c) => ({
      p: pretty(), g: '>', l: '<', b: '|', q: '=', n: this.cwd[0], $: '$', _: '\n', e: '\x1b',
      t: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(Math.floor(d.getMilliseconds() / 10))}`,
      d: `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${d.getFullYear()}`,
      v: 'MS-DOS Version 6.00', h: '\b'
    }[c.toLowerCase()] ?? ''));
  }
  showPrompt() {
    if (this.echo) this.con.write(this.promptStr());
    this.sx = this.con.cx; this.sy = this.con.cy; this.sc = this.con.scrolls;
    this.line = ''; this.pos = 0;
    this.con.dirty();
  }
  redrawLine(oldLen) {
    const c = this.con;
    const sy = this.sy - (c.scrolls - this.sc);
    c.cx = this.sx; c.cy = Math.max(0, sy);
    c.write(this.line + ' '.repeat(Math.max(0, oldLen - this.line.length)));
    const sy2 = this.sy - (c.scrolls - this.sc);
    const off = this.sx + this.pos;
    c.setPos(off % c.cols, Math.max(0, sy2) + Math.floor(off / c.cols));
  }

  readKey() { return new Promise(r => this.keyWaiter = r); }
  async readLine() {
    this.lineWaiter = true;
    this.sx = this.con.cx; this.sy = this.con.cy; this.sc = this.con.scrolls;
    this.line = ''; this.pos = 0;
    return new Promise(r => this.lineResolve = r);
  }

  key(e) {
    if (e.metaKey) return;
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'CapsLock') return;
    e.preventDefault();
    if (this.busy && !this.lineResolve) {
      if (e.ctrlKey && (e.key === 'c' || e.key === 'C' || e.key === 'Pause')) { this.cancel = true; if (this.keyWaiter) { const k = this.keyWaiter; this.keyWaiter = null; k({ key: 'Escape', ctrl: true }); } return; }
      if (this.keyWaiter) { const k = this.keyWaiter; this.keyWaiter = null; k(e); }
      return;
    }
    const old = this.line.length;
    if (e.key === 'Enter') {
      const l = this.line;
      this.con.newline(); this.con.dirty();
      if (this.lineResolve) { const r = this.lineResolve; this.lineResolve = null; r(l); return; }
      if (l.trim()) { this.history.push(l); this.hidx = this.history.length; }
      this.submit(l);
      return;
    }
    if (e.ctrlKey && (e.key === 'z' || e.key === 'Z') || e.key === 'F6') { this.line = this.line.slice(0, this.pos) + '^Z' + this.line.slice(this.pos); this.pos += 2; }
    else if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
      this.con.write('^C'); this.con.newline();
      if (this.lineResolve) { const r = this.lineResolve; this.lineResolve = null; r(null); return; }
      this.showPrompt(); return;
    }
    else if (e.key === 'Backspace') { if (this.pos > 0) { this.line = this.line.slice(0, this.pos - 1) + this.line.slice(this.pos); this.pos--; } }
    else if (e.key === 'Delete') { this.line = this.line.slice(0, this.pos) + this.line.slice(this.pos + 1); }
    else if (e.key === 'ArrowLeft') this.pos = Math.max(0, this.pos - 1);
    else if (e.key === 'ArrowRight') this.pos = Math.min(this.line.length, this.pos + 1);
    else if (e.key === 'Home') this.pos = 0;
    else if (e.key === 'End') this.pos = this.line.length;
    else if (e.key === 'Escape') { this.line = ''; this.pos = 0; }
    else if (e.key === 'ArrowUp' && !this.lineResolve) { if (this.hidx > 0) { this.line = this.history[--this.hidx]; this.pos = this.line.length; } }
    else if (e.key === 'ArrowDown' && !this.lineResolve) { if (this.hidx < this.history.length - 1) { this.line = this.history[++this.hidx]; } else { this.hidx = this.history.length; this.line = ''; } this.pos = this.line.length; }
    else if (e.key === 'F3' && this.history.length) { this.line = this.history[this.history.length - 1]; this.pos = this.line.length; }
    else if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
      if (this.line.length >= 127) { Snd.beep(); return; }
      this.line = this.line.slice(0, this.pos) + e.key + this.line.slice(this.pos); this.pos++;
    } else return;
    this.redrawLine(old);
  }

  async submit(l) {
    this.busy = true; this.cancel = false;
    try { await this.exec(l); }
    catch (err) { this.con.writeln(String(err.message || err)); }
    this.busy = false;
    if (this.exited) return;
    if (this.echo) this.con.newline();
    this.showPrompt();
  }

  out(s = '') { this.con.writeln(s); }

  async more(lines) {
    let n = 0;
    for (const l of lines) {
      if (this.cancel) { this.out('^C'); return; }
      this.out(l);
      if (this.paginate && ++n >= 23) {
        this.con.write('Press any key to continue . . .');
        await this.readKey(); this.con.newline(); n = 0;
      }
    }
  }

  expandVars(s, args = []) {
    return s.replace(/%(\d)/g, (_, d) => args[+d] ?? '').replace(/%([^%\s]+)%/g, (_, v) => Sys.env[v.toUpperCase()] ?? Sys.env[v] ?? '');
  }

  async exec(line, args) {
    line = line.trim();
    if (!line) return;
    if (args) line = this.expandVars(line, args); else line = this.expandVars(line);
    if (line.startsWith('@')) line = line.slice(1).trim();
    // redirection (">" only)
    let redirect = null;
    const rm = /^(.*?)\s*(>>?)\s*(\S+)\s*$/.exec(line);
    if (rm && !/^echo\s*$/i.test(rm[1]) && !/^(rem)\b/i.test(line)) { line = rm[1]; redirect = { append: rm[2] === '>>', file: rm[3] }; }
    let pipeMore = false;
    if (/\|\s*more\s*$/i.test(line)) { line = line.replace(/\|\s*more\s*$/i, '').trim(); pipeMore = true; }

    if (redirect) {
      const cap = [];
      const realCon = this.con;
      this.con = { writeln: s => cap.push(s), write: s => cap.push(s), newline: () => {}, dirty: () => {}, clear: () => {}, cx: 0, cy: 0, cols: 80 };
      try { await this.exec1(line); } finally { this.con = realCon; }
      if (redirect.file.toUpperCase() === 'NUL') return;
      if (/^(PRN|LPT\d)$/i.test(redirect.file)) { PrintQueue.add('MS-DOS Prompt', cap.join('\n')); return; }
      const full = FS.full(redirect.file, this.cwd);
      const prev = redirect.append ? (FS.read(full) || '') : '';
      try { FS.write(full, prev + cap.join('\n').replace(/\n?$/, '\n')); } catch (e) { this.out('File creation error'); }
      return;
    }
    this.paginate = pipeMore;
    await this.exec1(line);
    this.paginate = false;
  }

  async exec1(line) {
    const m = /^([^\s\\/.]*(?:[\\.][^\s\\/]*)*|[\\.]+)([\s\S]*)$/.exec(line);
    let cmd = line.split(/[\s/]/)[0];
    let rest = line.slice(cmd.length);
    // forms like "cd\" or "cd.."
    const cdm = /^(cd|chdir)([\\.].*)$/i.exec(cmd);
    if (cdm) { cmd = cdm[1]; rest = cdm[2] + rest; }
    const echom = /^echo([.:])(.*)$/i.exec(cmd);
    if (echom) { this.out(echom[2] + rest); return; }
    const up = cmd.toUpperCase();
    const argstr = rest.trim();
    const args = argstr ? argstr.split(/\s+/) : [];
    if (/^[A-Z]:$/.test(up)) return this.changeDrive(up[0]);
    const fn = DosShell.cmds[up];
    if (fn) return fn.call(this, args, argstr);
    return this.runProgram(cmd, argstr);
  }

  async changeDrive(d) {
    if (d === 'C') { this.cwd = this.cwd[0] === 'C' ? this.cwd : 'C:\\'; return; }
    if (d === 'A' || d === 'B') {
      for (;;) {
        this.con.write(`\nNot ready reading drive ${d}\nAbort, Retry, Fail?`);
        const k = await this.readKey();
        const c = (k.key || '').toLowerCase();
        this.con.write(c.length === 1 ? c : '');
        this.con.newline();
        if (c === 'r') continue;
        if (c === 'f') { this.out('Current drive is no longer valid'); return; }
        return;
      }
    }
    this.out('Invalid drive specification');
  }

  async runProgram(cmd, argstr) {
    const file = FS.which(cmd, this.cwd);
    if (!file) { this.out('Bad command or file name'); return; }
    const node = FS.get(file);
    const ext = FS.ext(file);
    const base = FS.basename(file).replace(/\..*$/, '');
    if (ext === 'BAT') return this.runBatch(file, argstr);
    if (node.a === 'win') return DosShell.cmds.WIN.call(this, argstr.split(/\s+/).filter(Boolean), argstr);
    if (node.a && node.a !== 'dos') {
      if (this.inWin) {
        this.out('This program requires Microsoft Windows.');
        return;
      }
      this.out('This program requires Microsoft Windows.');
      return;
    }
    if (node.a === 'dos') { DosShell.cmds.COMMAND.call(this); return; }
    const prog = DosShell.progs[base];
    if (prog) return prog.call(this, argstr.split(/\s+/).filter(Boolean), argstr);
    if (ext === 'COM' || ext === 'EXE') {
      this.out(node.s ? `Program too big to fit in memory` : 'Bad command or file name');
      return;
    }
    this.out('Bad command or file name');
  }

  async runBatch(path, argstr) {
    const text = FS.read(path) || '';
    const lines = text.split(/\r?\n/);
    const args = [path, ...argstr.split(/\s+/).filter(Boolean)];
    const savedEcho = this.echo;
    for (let i = 0; i < lines.length; i++) {
      if (this.cancel) {
        this.con.write('Terminate batch job (Y/N)?');
        const k = await this.readKey(); this.con.newline();
        if ((k.key || '').toLowerCase() !== 'n') break;
        this.cancel = false;
      }
      let l = lines[i];
      const t = l.trim();
      if (!t || t.startsWith(':')) continue;
      const silent = t.startsWith('@');
      if (this.echo && !silent) { this.out(this.promptStr() + t); }
      const g = /^goto\s+:?(\S+)/i.exec(t.replace(/^@/, ''));
      if (g) {
        const j = lines.findIndex(x => x.trim().toLowerCase() === ':' + g[1].toLowerCase());
        if (j < 0) { this.out('Label not found'); break; }
        i = j; continue;
      }
      const iff = /^@?if\s+(not\s+)?(exist\s+(\S+)|"?(.*?)"?==\s*"?(.*?)"?)\s+(.*)$/i.exec(this.expandVars(t, args));
      if (iff) {
        let cond = iff[3] ? FS.exists(iff[3], this.cwd) : iff[4] === iff[5];
        if (iff[1]) cond = !cond;
        if (cond) await this.exec(iff[6]);
        continue;
      }
      await this.exec(l, args);
      if (this.exited || this.startingWin) break;
    }
    if (!this.startingWin) this.echo = this.echo; // batch ECHO OFF persists only within batch
    if (this.inBatchRestore !== false) this.echo = savedEcho || this.echo;
  }

  dirLine(name, node) {
    const d = new Date(node.d || WIN_DATE);
    const date = `${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getFullYear() % 100)}`;
    let hh = d.getHours(); const ap = hh >= 12 ? 'p' : 'a'; hh = hh % 12 || 12;
    const time = `${String(hh).padStart(2)}:${pad(d.getMinutes())}${ap}`;
    const dot = name.indexOf('.');
    const nm = name === '.' || name === '..' ? name.padEnd(12) : (dot > 0 ? name.slice(0, dot).padEnd(8) + ' ' + name.slice(dot + 1).padEnd(3) : name.padEnd(12));
    const size = node.t === 'd' ? '<DIR>'.padEnd(13) : fmtNum(FS.size(node)).padStart(13);
    return `${nm} ${size} ${date}  ${time}`;
  }

  patternRe(pat) {
    if (!pat || pat === '*.*' || pat === '*') return /^.*$/;
    if (!pat.includes('.')) pat += '.*';
    const [n, e] = pat.split('.');
    const cv = s => s.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.?');
    return new RegExp('^' + cv(n) + (e === '*' ? '(\\..*)?' : e ? '\\.' + cv(e) : '') + '$', 'i');
  }

  /* resolve "dir\pattern" into [dirPath, pattern] */
  splitPattern(arg) {
    if (!arg) return [this.cwd, '*.*'];
    const full = FS.full(arg, this.cwd);
    if (FS.isDir(full)) return [full, '*.*'];
    return [FS.dirname(full), FS.basename(full)];
  }
}

DosShell.cmds = {
  CLS() { this.con.clear(); },
  VER() { this.out(''); this.out(this.inWin && Sys.isNeo() ? 'Microsoft Windows [Version 10.0.19045.3803]' : 'MS-DOS Version 6.00'); },
  START(a, s) {
    if (!this.inWin) { this.out('This program cannot be run in DOS mode.'); return; }
    Sys.launch(s || 'CMD', { cwd: this.cwd, caller: 'Command Prompt' });
  },
  EXPLORER(a, s) {
    if (!this.inWin || !Sys.isNeo()) { this.out('Bad command or file name'); return; }
    Sys.launch('EXPLORER ' + (s ? FS.full(s, this.cwd) : this.cwd));
  },
  VOL() { this.out(''); this.out(' Volume in drive C is MS-DOS_6'); this.out(' Volume Serial Number is 1A2B-3C4D'); },
  REM() {},
  EXIT() {
    if (this.inWin) { this.exited = true; this.onExit && this.onExit(); }
  },
  ECHO(a, s) {
    if (!s) { this.out('ECHO is ' + (this.echo ? 'on' : 'off')); return; }
    if (/^off$/i.test(s)) { this.echo = false; return; }
    if (/^on$/i.test(s)) { this.echo = true; return; }
    this.out(s);
  },
  async PAUSE() { this.con.write('Press any key to continue . . .'); await this.readKey(); this.con.newline(); },
  SET(a, s) {
    if (!s) { for (const [k, v] of Object.entries(Sys.env)) this.out(`${k.toUpperCase() === k ? k : k}=${v}`); return; }
    const i = s.indexOf('=');
    if (i < 0) { this.out('Syntax error'); return; }
    const k = s.slice(0, i).trim().toUpperCase(), v = s.slice(i + 1);
    if (v) Sys.env[k] = v; else delete Sys.env[k];
  },
  PATH(a, s) {
    if (!s) { this.out('PATH=' + (Sys.env.PATH || '')); return; }
    Sys.env.PATH = s.replace(/^=/, '').trim().toUpperCase();
  },
  PROMPT(a, s) { Sys.env.PROMPT = s || '$n$g'; },
  async DATE(a, str) {
    const setDate = t => {
      const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(t.trim());
      if (!m) return false;
      let y = +m[3]; if (y < 100) y += y < 80 ? 2000 : 1900;
      const now = Sys.now(), d = new Date(y, m[1] - 1, +m[2], now.getHours(), now.getMinutes(), now.getSeconds());
      if (d.getMonth() !== m[1] - 1 || y < 1980 || y > 2099) return false;
      Store.set('clockOffset', d.getTime() - Date.now()); Sys.emit('time');
      return true;
    };
    if (str) { if (!setDate(str)) this.out('Invalid date'); return; }
    const d = Sys.now();
    this.out(`Current date is ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${d.getFullYear()}`);
    for (;;) {
      this.con.write('Enter new date (mm-dd-yy): ');
      const l = await this.readLine();
      if (l == null || !l.trim() || setDate(l)) return;
      this.out('Invalid date');
    }
  },
  async TIME(a, str) {
    const setTime = t => {
      const m = /^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?(?:\.\d+)?\s*([ap])?m?$/i.exec(t.trim());
      if (!m) return false;
      let hh = +m[1]; const mm = +(m[2] || 0), ss = +(m[3] || 0);
      if (m[4]) { if (hh < 1 || hh > 12) return false; hh = hh % 12 + (/p/i.test(m[4]) ? 12 : 0); }
      if (hh > 23 || mm > 59 || ss > 59) return false;
      const now = Sys.now(), d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, ss);
      Store.set('clockOffset', d.getTime() - Date.now()); Sys.emit('time');
      return true;
    };
    if (str) { if (!setTime(str)) this.out('Invalid time'); return; }
    const d = Sys.now();
    let hh = d.getHours(); const ap = hh >= 12 ? 'p' : 'a'; hh = hh % 12 || 12;
    this.out(`Current time is ${String(hh).padStart(2)}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(Math.floor(d.getMilliseconds() / 10))}${ap}`);
    for (;;) {
      this.con.write('Enter new time: ');
      const l = await this.readLine();
      if (l == null || !l.trim() || setTime(l)) return;
      this.out('Invalid time');
    }
  },
  async DIR(a) {
    const flags = a.filter(x => x.startsWith('/')).map(x => x.toUpperCase());
    const target = a.find(x => !x.startsWith('/'));
    const wide = flags.includes('/W'), bare = flags.includes('/B');
    this.paginate = this.paginate || flags.includes('/P');
    const [dir, pat] = this.splitPattern(target);
    const ls = FS.list(dir);
    if (!ls) { this.out(''); this.out('Path not found'); return; }
    const re = this.patternRe(pat);
    const now = FS.get(dir);
    let entries = ls.filter(e => re.test(e.name));
    if (dir !== 'C:\\' && re.test('.')) entries = [{ name: '.', node: now }, { name: '..', node: now }, ...entries];
    const lines = [];
    if (!bare) { lines.push('', ' Volume in drive C is MS-DOS_6', ' Volume Serial Number is 1A2B-3C4D', ` Directory of ${dir}`, ''); }
    if (!entries.length) { if (!bare) lines.push('File not found'); await this.more(lines); return; }
    let files = 0, bytes = 0;
    if (wide) {
      let row = '';
      entries.forEach((e, i) => {
        const nm = e.node.t === 'd' ? `[${e.name}]` : e.name;
        row += nm.padEnd(16);
        if ((i + 1) % 5 === 0) { lines.push(row); row = ''; }
        if (e.node.t === 'f') { files++; bytes += FS.size(e.node); }
      });
      if (row) lines.push(row);
    } else {
      for (const e of entries) {
        lines.push(bare ? e.name : this.dirLine(e.name, e.node));
        if (e.node.t === 'f') { files++; bytes += FS.size(e.node); }
      }
    }
    if (!bare) {
      lines.push(`${String(files).padStart(9)} file(s)${fmtNum(bytes).padStart(15)} bytes`);
      lines.push(`${fmtNum(FS.free()).padStart(39)} bytes free`);
    }
    await this.more(lines);
  },
  CD(a, s) {
    if (!s) { this.out(this.cwd); return; }
    if (/^[a-z]:$/i.test(s)) { this.out(s.toUpperCase() === 'C:' ? this.cwd : 'Invalid drive specification'); return; }
    const full = FS.full(s, this.cwd);
    if (!FS.isDir(full)) { this.out('Invalid directory'); return; }
    this.cwd = full;
  },
  MD(a, s) {
    if (!s) { this.out('Required parameter missing'); return; }
    try { FS.mkdir(s, this.cwd); } catch { this.out('Unable to create directory'); }
  },
  RD(a, s) {
    if (!s) { this.out('Required parameter missing'); return; }
    if (FS.full(s, this.cwd) === this.cwd) { this.out('Attempt to remove current directory - ' + s); return; }
    try { FS.rmdir(s, this.cwd); } catch (e) { this.out(e.message); }
  },
  async DEL(a) {
    const target = a.find(x => !x.startsWith('/'));
    if (!target) { this.out('Required parameter missing'); return; }
    const [dir, pat] = this.splitPattern(target);
    const ls = FS.list(dir);
    if (!ls) { this.out('Path not found'); return; }
    const re = this.patternRe(pat);
    const victims = ls.filter(e => e.node.t === 'f' && re.test(e.name));
    if (pat === '*.*' || FS.isDir(FS.full(target, this.cwd))) {
      this.out('All files in directory will be deleted!');
      this.con.write('Are you sure (Y/N)?');
      const k = await this.readKey(); this.con.write(k.key && k.key.length === 1 ? k.key : ''); this.con.newline();
      if ((k.key || '').toLowerCase() !== 'y') return;
    }
    if (!victims.length) { this.out('File not found'); return; }
    for (const v of victims) FS.remove(FS.join(dir, v.name));
  },
  async COPY(a) {
    const files = a.filter(x => !x.startsWith('/'));
    if (!files.length) { this.out('Required parameter missing'); return; }
    if (files[0].toUpperCase() === 'CON') {
      if (!files[1]) { this.out('Required parameter missing'); return; }
      const lines = [];
      for (;;) {
        const l = await this.readLine();
        if (l == null) return;
        const zi = l.indexOf('^Z');
        if (zi >= 0) { if (zi > 0) lines.push(l.slice(0, zi)); break; }
        lines.push(l);
      }
      try { FS.write(FS.full(files[1], this.cwd), lines.join('\n') + '\n'); this.out('        1 file(s) copied'); }
      catch { this.out('File creation error'); }
      return;
    }
    const [dir, pat] = this.splitPattern(files[0]);
    const ls = FS.list(dir) || [];
    const re = this.patternRe(pat);
    const src = ls.filter(e => e.node.t === 'f' && re.test(e.name));
    if (!src.length) { this.out('File not found - ' + files[0]); this.out('        0 file(s) copied'); return; }
    const dst = files[1] || this.cwd;
    let n = 0;
    for (const s of src) {
      try {
        const target = src.length > 1 && !FS.isDir(FS.full(dst, this.cwd)) ? null : dst;
        if (!target) { this.out('Cannot do multiple copies to a single file'); break; }
        FS.copy(FS.join(dir, s.name), target, this.cwd);
        if (src.length > 1) this.out(FS.join(dir, s.name));
        n++;
      } catch (e) { this.out(e.message); }
    }
    this.out(`        ${n} file(s) copied`);
  },
  MOVE(a) {
    if (a.length < 2) { this.out('Required parameter missing'); return; }
    try { const t = FS.copy(a[0], a[1], this.cwd, true); this.out(`${FS.full(a[0], this.cwd).toLowerCase()} => ${t.toLowerCase()} [ok]`); }
    catch (e) { this.out(e.message); }
  },
  REN(a) {
    if (a.length < 2) { this.out('Required parameter missing'); return; }
    try { FS.rename(a[0], a[1], this.cwd); } catch (e) { this.out('Duplicate file name or file not found'); }
  },
  async TYPE(a, s) {
    if (!s) { this.out('Required parameter missing'); return; }
    const n = FS.get(s, this.cwd);
    if (!n) { this.out('File not found - ' + s.toUpperCase()); return; }
    if (n.t === 'd') { this.out('Access denied'); return; }
    let txt = n.x || '';
    if (txt.startsWith('<')) txt = txt.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    if (!txt && n.s) txt = Array.from({ length: Math.min(8, Math.ceil(n.s / 400)) }, (_, i) => 'MZ\u00ea\u0002\u0001\u0000\u00b8\u0000@\u0000\u00ff\u00ff\u00ba\u0010\u000e\u001f\u00b4\t\u00cd!\u00b8\u0001L\u00cd!This program requires Microsoft Windows.\r$'.slice(i % 3)).join('');
    await this.more(txt.replace(/\r/g, '').split('\n'));
  },
  MEM() {
    [
      '', 'Memory Type        Total  =   Used  +   Free', '----------------  -------   -------   -------',
      'Conventional         640K       52K      588K', 'Upper                155K       41K      114K',
      'Reserved             384K      384K        0K', 'Extended (XMS)     7,013K    2,112K    4,901K',
      '----------------  -------   -------   -------', 'Total memory       8,192K    2,589K    5,603K', '',
      'Total under 1 MB     795K       93K      702K', '',
      'Largest executable program size       588K (602,064 bytes)', 'Largest free upper memory block        79K  (80,560 bytes)',
      'MS-DOS is resident in the high memory area.'
    ].forEach(l => this.out(l));
  },
  async TREE(a, s) {
    const root = FS.full(a.find(x => !x.startsWith('/')) || this.cwd, this.cwd);
    if (!FS.isDir(root)) { this.out('Invalid path - ' + root); return; }
    const lines = ['Directory PATH listing for Volume MS-DOS_6', 'Volume Serial Number is 1A2B-3C4D', root];
    const walk = (p, prefix) => {
      const dirs = (FS.list(p) || []).filter(e => e.node.t === 'd');
      dirs.forEach((d, i) => {
        const last = i === dirs.length - 1;
        lines.push(prefix + (last ? '└───' : '├───') + d.name);
        walk(FS.join(p, d.name), prefix + (last ? '    ' : '│   '));
      });
    };
    walk(root, '');
    await this.more(lines);
  },
  async HELP() {
    const cmds = [
      ['CD', 'Displays the name of or changes the current directory.'], ['CLS', 'Clears the screen.'],
      ['COPY', 'Copies one or more files to another location.'], ['DATE', 'Displays or sets the date.'],
      ['DEL', 'Deletes one or more files.'], ['DIR', 'Displays a list of files and subdirectories in a directory.'],
      ['ECHO', 'Displays messages, or turns command echoing on or off.'], ['EDIT', 'Starts MS-DOS Editor (opens Notepad in Windows).'],
      ['EXIT', 'Quits the COMMAND.COM program (command interpreter).'], ['FDISK', 'Restores this computer to factory condition.'],
      ['MD', 'Creates a directory.'], ['MEM', 'Displays the amount of used and free memory in your system.'],
      ['MOVE', 'Moves one or more files.'], ['PATH', 'Displays or sets a search path for executable files.'],
      ['PAUSE', 'Suspends processing of a batch file.'], ['PROMPT', 'Changes the MS-DOS command prompt.'],
      ['RD', 'Removes (deletes) a directory.'], ['REN', 'Renames a file or files.'],
      ['SET', 'Displays, sets, or removes MS-DOS environment variables.'], ['TIME', 'Displays or sets the system time.'],
      ['TREE', 'Graphically displays the directory structure of a drive or path.'], ['TYPE', 'Displays the contents of a text file.'],
      ['VER', 'Displays the MS-DOS version.'], ['VOL', 'Displays a disk volume label and serial number.'],
      ['WIN', 'Starts Microsoft Windows.']
    ];
    await this.more(cmds.map(([c, d]) => c.padEnd(9) + d));
  },
  async WIN(a, s) {
    if (this.inWin) { this.out('You are already running Windows.'); return; }
    this.startingWin = true;
    this.exited = true;
    const app = a.find(x => !x.startsWith('/'));
    DOS.leave();
    await Sys.startWindows();
    if (app) setTimeout(() => Sys.launch(app), 400);
  },
  COMMAND() {
    this.out('');
    this.out('Microsoft(R) MS-DOS(R) Version 6');
    this.out('             (C)Copyright Microsoft Corp 1981-1993.');
  },
  EDIT(a, s) {
    if (this.inWin) { Sys.launch('NOTEPAD.EXE' + (s ? ' ' + FS.full(s, this.cwd) : '')); return; }
    this.out('MS-DOS Editor requires QBASIC.EXE, which is not available.');
    this.out('Type WIN and use Notepad to edit files.');
  },
  async FDISK() {
    if (this.inWin) { this.out('Cannot run FDISK while Windows is running.'); return; }
    this.out(''); this.out('MS-DOS Version 6 Fixed Disk Setup Program');
    this.out('(C)Copyright Microsoft Corp. 1983 - 1993'); this.out('');
    this.out('WARNING! This will restore drive C: and all Neo31 settings');
    this.out('to their factory state. All files you created will be lost.');
    this.con.write('Proceed with reset (Y/N)?');
    const k = await this.readKey(); this.con.write(k.key && k.key.length === 1 ? k.key : ''); this.con.newline();
    if ((k.key || '').toLowerCase() !== 'y') return;
    this.out('Resetting...');
    Store.wipe();
    localStorage.removeItem(Store.key + '.fs');
    await sleep(600);
    location.reload();
  },
  async FORMAT(a) {
    const d = (a[0] || '').toUpperCase();
    if (!d) { this.out('Required parameter missing'); return; }
    if (d.startsWith('C')) {
      this.out(''); this.out('WARNING, ALL DATA ON NON-REMOVABLE DISK');
      this.out('DRIVE C: WILL BE LOST!');
      this.con.write('Proceed with Format (Y/N)?');
      const k = await this.readKey(); this.con.write(k.key && k.key.length === 1 ? k.key : ''); this.con.newline();
      this.out(''); this.out('Format terminated. (Neo31 politely declines to erase itself.)');
      return;
    }
    this.out(`Insert new diskette for drive ${d[0]}:`);
    this.con.write('and press ENTER when ready...');
    await this.readKey(); this.con.newline();
    await this.changeDrive(d[0]);
  },
  CHKDSK() {
    const total = FS.totalBytes, used = FS.used(), free = FS.free();
    const nfiles = (function count(n) { return n.t === 'f' ? 1 : Object.values(n.c).reduce((a, c) => a + count(c), 0); })(FS.root);
    [``, `Volume MS-DOS_6     created 03-10-1993 6:00a`, `Volume Serial Number is 1A2B-3C4D`, ``,
      `${fmtNum(total).padStart(13)} bytes total disk space`, `${fmtNum(73728).padStart(13)} bytes in 3 hidden files`,
      `${fmtNum(used).padStart(13)} bytes in ${nfiles} user files`, `${fmtNum(free).padStart(13)} bytes available on disk`, ``,
      `${fmtNum(2048).padStart(13)} bytes in each allocation unit`, `${fmtNum(total / 2048).padStart(13)} total allocation units on disk`,
      `${fmtNum(free / 2048).padStart(13)} available allocation units on disk`, ``, `${fmtNum(655360).padStart(13)} total bytes memory`,
      `${fmtNum(602064).padStart(13)} bytes free`].forEach(l => this.out(l));
  },
  ATTRIB(a, s) {
    const [dir, pat] = this.splitPattern(a.find(x => !x.startsWith('/') && !/^[+-]/.test(x)));
    const re = this.patternRe(pat);
    for (const e of (FS.list(dir) || [])) if (e.node.t === 'f' && re.test(e.name)) this.out(`  A          ${FS.join(dir, e.name)}`);
  },
  async DELTREE(a) {
    const t = a.find(x => !x.startsWith('/'));
    if (!t) { this.out('Required parameter missing'); return; }
    const full = FS.full(t, this.cwd);
    if (!FS.exists(full)) { this.out('File not found'); return; }
    if (!a.some(x => x.toUpperCase() === '/Y')) {
      this.con.write(`Delete directory "${full}" and all its subdirectories? [yn] `);
      const k = await this.readKey(); this.con.write(k.key && k.key.length === 1 ? k.key : ''); this.con.newline();
      if ((k.key || '').toLowerCase() !== 'y') return;
    }
    if (this.cwd.startsWith(full)) { this.out('Cannot delete the current directory'); return; }
    FS.remove(full); this.out(`Deleting ${full}...`);
  },
  SMARTDRV() {
    this.out('Microsoft SMARTDrive Disk Cache version 5.0');
    this.out('Copyright 1991,1993 Microsoft Corp.'); this.out('');
    this.out('Cache size: 1,048,576 bytes'); this.out('Cache size while running Windows: 524,288 bytes'); this.out('');
    this.out('            Disk Caching Status'); this.out('drive   read cache   write cache   buffering');
    this.out('--------------------------------------------'); this.out('  A:       yes          no           no');
    this.out('  C:       yes          yes          no'); this.out(''); this.out('For help, type "Smartdrv /?".');
  },
  MOUSE() {
    this.out('Microsoft (R) Mouse Driver Version 8.20'); this.out('Copyright (C) Microsoft Corp. 1983-1992. All rights reserved.');
    this.out('Mouse driver installed');
  },
  async MSD() {
    await this.more(['Microsoft Diagnostics version 2.01', '', 'Computer:     Neo 486DX2/66', 'Memory:       640K, 7168K Ext, 0K EMS, 4901K XMS',
      'Video:        VGA, Generic', 'Network:      No Network', 'OS Version:   MS-DOS Version 6.00, Windows 3.10', 'Mouse:        Serial Mouse 8.20',
      'Other Adapters: Game Adapter', 'Disk Drives:  A: C:', 'LPT Ports:    1', 'COM Ports:    2', 'IRQ Status:   ...', 'TSR Programs: ...', 'Device Drivers: ...']);
  },
  QBASIC() { this.out('QBASIC is not available in this simulation.'); },
  DOSKEY() { this.out('DOSKey installed.'); },
  DEFRAG() { this.out('Optimization complete. (Drive C: is already 0% fragmented.)'); },
  SCANDISK() { this.out('ScanDisk did not find any problems on drive C.'); },
  MORE() { this.out('Use: TYPE filename | MORE'); }
};
Object.assign(DosShell.cmds, {
  CHDIR: DosShell.cmds.CD, MKDIR: DosShell.cmds.MD, RMDIR: DosShell.cmds.RD, ERASE: DosShell.cmds.DEL,
  RENAME: DosShell.cmds.REN, XCOPY: DosShell.cmds.COPY
});
/* External programs in C:\DOS that resolve via PATH */
DosShell.progs = {
  MEM: DosShell.cmds.MEM, TREE: DosShell.cmds.TREE, CHKDSK: DosShell.cmds.CHKDSK, EDIT: DosShell.cmds.EDIT, FDISK: DosShell.cmds.FDISK,
  FORMAT: DosShell.cmds.FORMAT, ATTRIB: DosShell.cmds.ATTRIB, DELTREE: DosShell.cmds.DELTREE, SMARTDRV: DosShell.cmds.SMARTDRV,
  MOUSE: DosShell.cmds.MOUSE, MSD: DosShell.cmds.MSD, QBASIC: DosShell.cmds.QBASIC, DOSKEY: DosShell.cmds.DOSKEY, DEFRAG: DosShell.cmds.DEFRAG,
  SCANDISK: DosShell.cmds.SCANDISK, MORE: DosShell.cmds.MORE, XCOPY: DosShell.cmds.COPY, MOVE: DosShell.cmds.MOVE, HELP: DosShell.cmds.HELP,
  COMMAND: DosShell.cmds.COMMAND
};
for (const k of ['MEM', 'TREE', 'CHKDSK', 'EDIT', 'FDISK', 'FORMAT', 'ATTRIB', 'DELTREE', 'SMARTDRV', 'MOUSE', 'MSD', 'QBASIC', 'DOSKEY', 'DEFRAG', 'SCANDISK', 'MORE', 'XCOPY', 'MOVE', 'HELP'])
  delete DosShell.cmds[k];
DosShell.cmds.HELP = DosShell.progs.HELP;

/* =================== POWER-ON & BOOT =================== */
const DOS = {
  el: null, con: null, shell: null,

  showText() {
    if (!this.el) {
      this.el = h('div', { class: 'textmode' });
      Sys.screen.appendChild(this.el);
    }
    this.el.classList.remove('hidden');
    if (!this.con) this.con = new TextConsole(this.el);
    Sys.textKey = e => this.shell && this.shell.key(e);
    return this.con;
  },
  leave() {
    if (this.el) this.el.classList.add('hidden');
    Sys.textKey = null;
  },

  powerScreen() {
    return new Promise(res => {
      const el = h('div', { class: 'power' },
        h('div', { class: 'pbtn', text: '⏻' }),
        h('div', { html: 'NEO31<br><span>Click the power button or press any key to switch on.<br>Hold <b>Shift</b> while starting to skip the BIOS checks.</span>' }));
      const go = e => {
        Store.set('fastBoot', !!(e && e.shiftKey));
        document.removeEventListener('keydown', go);
        Snd.ensure();
        el.remove();
        res();
      };
      el.querySelector('.pbtn').addEventListener('click', go);
      document.addEventListener('keydown', go);
      Sys.screen.appendChild(el);
    });
  },

  beep(freq = 1000, dur = 0.12) {
    const ctx = Snd.ensure(); if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = freq; g.gain.value = 0.05;
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur);
  },

  async boot() {
    Sys.mode = 'boot';
    const con = this.showText();
    con.clear(); con.cursor = false;
    const fast = Store.get('fastBoot');
    let skip = fast;
    Sys.textKey = e => { if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') skip = true; };
    const w = async ms => { if (!skip) await sleep(ms); };

    con.writeln('');
    con.writeln('  Neo Modular BIOS v4.51PG, An Energy Star Ally', 'c-hi');
    con.writeln('  Copyright (C) 1984-92, Neo Software, Inc.');
    con.writeln('');
    con.writeln('  486DX2 CPU at 66MHz');
    const memY = con.cy;
    for (let k = 0; k <= 8192; k += 128) {
      con.setPos(0, memY); con.write(`  Memory Test :  ${String(k).padStart(5)}K${k === 8192 ? ' OK' : ''}`);
      await w(12);
    }
    con.writeln('');
    con.writeln('');
    await w(300);
    con.writeln('  Detecting HDD Primary Master  ... NEO-AT125 125MB');
    await w(300);
    con.writeln('  Detecting HDD Primary Slave   ... None');
    await w(200);
    con.writeln('  Floppy Drive A:                ... 1.44M, 3.5 in.');
    con.writeln('');
    con.writeln('');
    con.writeln('  Press DEL to enter SETUP, ESC to skip memory test');
    con.writeln('  03/10/92-NEO-486-W31-00', 'c-hi');
    this.beep();
    await w(1200);
    con.clear();
    // Neo10 boots straight into Windows; MS-DOS lives on as the Command Prompt
    if (Store.get('shell', 'neo10') === 'neo10') { this.leave(); await Sys.startWindows(); return; }
    con.cursor = true;
    await w(400);
    con.writeln('Starting MS-DOS...');
    con.writeln('');
    await w(900);

    // CONFIG.SYS
    const cfg = FS.read('C:\\CONFIG.SYS') || '';
    for (const line of cfg.split(/\r?\n/)) {
      const u = line.toUpperCase();
      if (/HIMEM\.SYS/.test(u)) {
        ['HIMEM: DOS XMS Driver, Version 3.10 - 03/10/93', 'Extended Memory Specification (XMS) Version 3.0', 'Copyright 1988-1993 Microsoft Corp.', '',
          'Installed A20 handler number 1.', '64K High Memory Area is available.', ''].forEach(l => con.writeln(l));
        await w(350);
      } else if (/EMM386/.test(u)) {
        ['MICROSOFT Expanded Memory Manager 386  Version 4.45', 'Copyright Microsoft Corporation 1986, 1993', '',
          '        Available expanded memory . . . . . . . . 0 KB', '', '        LIM/EMS version . . . . . . . . . . . . . 4.0',
          '        Total expanded memory pages . . . . . . . 0', '        Available expanded memory pages . . . . . 0',
          '        Total handles . . . . . . . . . . . . . . 64', '        Upper memory blocks . . . . . . . . . . . 152 KB', '',
          '        EMM386 Active.', ''].forEach(l => con.writeln(l));
        await w(350);
      }
    }
    // AUTOEXEC.BAT
    this.newShell('C:\\');
    const sh = this.shell;
    sh.busy = true;
    Sys.textKey = e => sh.key(e);
    Sys.mode = 'dos';
    if (FS.exists('C:\\AUTOEXEC.BAT')) await sh.runBatch('C:\\AUTOEXEC.BAT', '');
    else { await DosShell.cmds.DATE.call(sh, []); await DosShell.cmds.TIME.call(sh, []); }
    sh.busy = false;
    if (sh.startingWin) return;
    sh.echo = true;
    con.newline();
    sh.showPrompt();
  },

  newShell(cwd) {
    this.shell = new DosShell(this.con, { inWindows: false, cwd });
  },

  returnFromWindows() {
    const con = this.showText();
    con.clear(); con.cursor = true;
    this.newShell('C:\\');
    Sys.mode = 'dos';
    this.shell.showPrompt();
  }
};

/* =================== MS-DOS PROMPT (windowed) =================== */
Sys.registerApp('dos', {
  name: 'MS-DOS Prompt', icon: 'dos', help: 'dos',
  run(opts) {
    const pre = h('div', { style: { position: 'absolute', left: '0', top: '0' } });
    const fsHolder = { full: false };
    let shell;
    const w = new Win({
      title: Sys.isNeo() ? 'Command Prompt' : 'MS-DOS Prompt', icon: Sys.isNeo() ? 'cmd' : 'dos', resizable: false, maxBox: true,
      onKey: (e, name) => {
        if (name === 'Alt+Enter') { toggleFull(); return true; }
        if (e.altKey && !e.ctrlKey) return false;
        shell.key(e);
        return true;
      },
      onClose: async () => {
        if (shell.exited) return true;
        await msgBox('Application still active.\n\nChoose the OK button to quit the application, or type EXIT at the prompt.', 'MS-DOS Prompt', { icon: 'exclaim', buttons: 'okcancel', owner: w }).then(r => { if (r === 'ok') shell.exited = true; });
        return !!shell.exited;
      },
      extraSys: [{ label: 'Full Screen', key: 'Alt+Enter', action: () => toggleFull() }]
    });
    w.body.style.background = '#000';
    w.body.appendChild(pre);
    const con = new TextConsole(pre);
    shell = new DosShell(con, { inWindows: true, cwd: opts.cwd || (Sys.isNeo() ? USER_HOME : 'C:\\WINDOWS'), onExit: () => { if (fsHolder.full) toggleFull(); w.close(true); } });
    con.render();
    requestAnimationFrame(() => {
      w.sizeToClient(640, 400);
      w.o.maxW = w.w; w.o.maxH = w.h;
      w.keepVisible();
    });
    const toggleFull = () => {
      fsHolder.full = !fsHolder.full;
      if (fsHolder.full) {
        const tm = h('div', { class: 'textmode' });
        tm.addEventListener('pointerdown', e => e.stopPropagation());
        Sys.screen.appendChild(tm);
        con.attach(tm); fsHolder.tm = tm;
      } else {
        con.attach(pre); fsHolder.tm.remove();
      }
      con.render();
    };
    w.maximize = () => toggleFull();
    if (Sys.isNeo()) { con.writeln('Microsoft Windows [Version 10.0.19045.3803]'); con.writeln('(c) Microsoft Corporation. All rights reserved.'); }
    else {
      [' \u25A0 Type EXIT and press ENTER to quit this MS-DOS prompt and', '   return to Windows.',
        ' \u25A0 Press ALT+TAB to switch to Windows or another application.',
        ' \u25A0 Press ALT+ENTER to switch this MS-DOS Prompt between a', '   window and full screen.'].forEach(l => con.writeln(l, 'c-hi'));
      DosShell.cmds.COMMAND.call(shell);
    }
    con.writeln('');
    if (opts.args) {
      shell.busy = true;
      shell.exec(opts.args).finally(() => { shell.busy = false; con.newline(); shell.showPrompt(); });
    } else shell.showPrompt();
    w.on('closed', () => { con.dispose(); if (fsHolder.tm) fsHolder.tm.remove(); });
    return w;
  }
});
