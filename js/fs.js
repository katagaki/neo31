'use strict';
/* Virtual FAT-style filesystem for drive C:, persisted to localStorage.
   Node: { t:'d'|'f', c:{children}, x:content, s:sizeOverride, d:mtime, a:appId, g:generator } */

const WIN_DATE = new Date(1992, 2, 10, 3, 10).getTime();
const DOS_DATE = new Date(1993, 2, 10, 6, 0).getTime();

class VFS extends Emitter {
  constructor() {
    super();
    try { this.root = Store.state?.fs || JSON.parse(localStorage.getItem((Store.base || Store.key) + '.fs')); } catch { this.root = null; }
    if (!this.root || this.root.t !== 'd') this.root = VFS.defaultTree();
    this.totalBytes = 125 * 1024 * 1024;
    this.baseUsed = 78 * 1024 * 1024;
  }

  flush() {
    clearTimeout(this._t);
    if (Store.wiped) return;
    return Store.flush();
  }

  save() {
    clearTimeout(this._t);
    this._t = setTimeout(() => this.flush(), 250);
    this.emit('change');
  }

  resolve(path, cwd = 'C:\\') {
    path = String(path || '').trim().replace(/\//g, '\\').replace(/^"|"$/g, '');
    const cm = /^([a-z]):(.*)$/i.exec(cwd);
    const cwdDrive = cm ? cm[1].toUpperCase() : 'C';
    const cwdParts = cm ? cm[2].split('\\').filter(Boolean).map(s => s.toUpperCase()) : [];
    let drive = cwdDrive, rest = path, base;
    const m = /^([a-z]):(.*)$/i.exec(path);
    if (m) {
      drive = m[1].toUpperCase(); rest = m[2];
      base = rest.startsWith('\\') ? [] : (drive === cwdDrive ? cwdParts : []);
    } else base = rest.startsWith('\\') ? [] : cwdParts;
    const parts = base.slice();
    for (const seg of rest.split('\\')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') parts.pop();
      else if (seg === '...') { parts.pop(); parts.pop(); }
      else parts.push(seg.toUpperCase());
    }
    return { drive, parts };
  }
  str(r) { return r.drive + ':\\' + r.parts.join('\\'); }
  full(path, cwd) { return this.str(this.resolve(path, cwd)); }
  join(dir, name) { return dir.replace(/\\$/, '') + '\\' + name; }
  dirname(path) { const r = this.resolve(path); r.parts.pop(); return this.str(r); }
  basename(path) { const r = this.resolve(path); return r.parts[r.parts.length - 1] || ''; }
  ext(name) { const i = name.lastIndexOf('.'); return i > 0 ? name.slice(i + 1).toUpperCase() : ''; }

  get(path, cwd) {
    const r = this.resolve(path, cwd);
    if (r.drive !== 'C') return null;
    let n = this.root;
    for (const p of r.parts) {
      if (n.t !== 'd' || !n.c[p]) return null;
      n = n.c[p];
    }
    return n;
  }
  isDir(path, cwd) { const n = this.get(path, cwd); return !!n && n.t === 'd'; }
  exists(path, cwd) { return !!this.get(path, cwd); }

  parentOf(path, cwd) {
    const r = this.resolve(path, cwd);
    const name = r.parts.pop();
    if (!name) return [null, null];
    const p = this.get(this.str(r));
    return [p && p.t === 'd' ? p : null, name];
  }

  list(path, cwd) {
    const n = this.get(path, cwd);
    if (!n || n.t !== 'd') return null;
    return Object.keys(n.c).sort().map(name => ({ name, node: n.c[name] }));
  }

  read(path, cwd) {
    const n = this.get(path, cwd);
    if (!n || n.t !== 'f') return null;
    return n.x ?? '';
  }

  static now() { return typeof Sys !== 'undefined' && Sys.now ? Sys.now().getTime() : Date.now(); }

  static longNames() { return typeof Sys !== 'undefined' && Sys.isNeo && Sys.isNeo(); }
  /* Windows 10 long file names (case kept for display in node.n) */
  static validLong(name) { return /^[^\\/:*?"<>|]{1,255}$/.test(name) && !/[. ]$/.test(name); }
  static validName(name) { return VFS.longNames() ? VFS.validLong(name) : VFS.valid83(name); }
  /* name shown to the user: original case if known, else lower-case files / Title-case folders */
  displayName(key, node) {
    if (node && node.n) return node.n;
    if (node && node.t === 'd') return key.charAt(0) + key.slice(1).toLowerCase();
    return key.toLowerCase();
  }
  origName(path) { return String(path).replace(/[\\/]+$/, '').split(/[\\/]/).pop().replace(/^[a-z]:/i, ''); }
  static valid83(name) {
    return /^[A-Z0-9_$~!#%&\-{}()@'`^]{1,8}(\.[A-Z0-9_$~!#%&\-{}()@'`^]{0,3})?$/i.test(name);
  }

  write(path, content, extra = {}, cwd) {
    const [p, name] = this.parentOf(path, cwd);
    if (!p) throw new Error('Path not found');
    if (!VFS.validName(name)) throw new Error('Invalid file name');
    const orig = this.origName(path);
    const old = p.c[name];
    if (old && old.t === 'd') throw new Error('Access denied');
    const node = { t: 'f', x: content, d: VFS.now(), ...extra };
    if (old && old.n && !extra.n) node.n = old.n;
    else if (VFS.longNames() && orig !== orig.toUpperCase() && orig.toUpperCase() === name) node.n = orig;
    p.c[name] = node;
    this.save();
    return node;
  }

  mkdir(path, cwd) {
    const [p, name] = this.parentOf(path, cwd);
    if (!p) throw new Error('Path not found');
    if (!VFS.validName(name)) throw new Error('Invalid directory name');
    const orig = this.origName(path);
    if (p.c[name]) throw new Error('Unable to create directory');
    p.c[name] = { t: 'd', c: {}, d: VFS.now() };
    if (VFS.longNames() && orig !== orig.toUpperCase()) p.c[name].n = orig;
    this.save();
  }

  rmdir(path, cwd) {
    const [p, name] = this.parentOf(path, cwd);
    const n = p && p.c[name];
    if (!n || n.t !== 'd') throw new Error('Invalid path, not directory,\nor directory not empty');
    if (Object.keys(n.c).length) throw new Error('Invalid path, not directory,\nor directory not empty');
    delete p.c[name];
    this.save();
  }

  /* delete file or directory tree */
  remove(path, cwd) {
    const [p, name] = this.parentOf(path, cwd);
    if (!p || !p.c[name]) throw new Error('File not found');
    delete p.c[name];
    this.save();
  }

  rename(path, newName, cwd) {
    const [p, name] = this.parentOf(path, cwd);
    const shown = newName;
    newName = newName.toUpperCase();
    if (!p || !p.c[name]) throw new Error('File not found');
    if (!VFS.validName(newName)) throw new Error('Invalid file name');
    if (newName === name) { const n = p.c[name]; if (n) { if (shown !== shown.toUpperCase()) n.n = shown; else delete n.n; this.save(); } return; }
    if (p.c[newName]) throw new Error('Duplicate file name or file not found');
    p.c[newName] = p.c[name];
    if (VFS.longNames() && shown !== shown.toUpperCase()) p.c[newName].n = shown; else delete p.c[newName].n;
    delete p.c[name];
    this.save();
  }

  copy(src, dst, cwd, move = false) {
    const n = this.get(src, cwd);
    if (!n) throw new Error('File not found');
    let target = this.full(dst, cwd);
    if (this.isDir(target)) target = this.join(target, this.basename(this.full(src, cwd)));
    if (this.full(src, cwd) === target) throw new Error('File cannot be copied onto itself');
    const [p, name] = this.parentOf(target);
    if (!p) throw new Error('Path not found');
    p.c[name] = JSON.parse(JSON.stringify(n));
    if (n.t === 'f') p.c[name].d = n.d;
    if (move) { const [sp, sn] = this.parentOf(src, cwd); delete sp.c[sn]; }
    this.save();
    return target;
  }

  size(n) {
    if (!n) return 0;
    if (n.t === 'd') return Object.values(n.c).reduce((a, c) => a + this.size(c), 0);
    if (n.s != null) return n.s;
    return (n.x || '').length;
  }
  used() { return this.baseUsed + this.size(this.root); }
  free() { return Math.max(0, this.totalBytes - this.used()); }

  /* Find an executable by name using PATH */
  which(name, cwd = 'C:\\') {
    const exts = this.ext(name) ? [''] : ['.COM', '.EXE', '.BAT', '.PIF'];
    const pathVar = (Sys.env && Sys.env.PATH) || 'C:\\WINDOWS;C:\\DOS';
    const dirs = [cwd, 'C:\\WINDOWS', 'C:\\WINDOWS\\SYSTEM', ...pathVar.split(';')];
    if (/[\\:]/.test(name)) {
      for (const e of exts) if (this.get(name + e, cwd)?.t === 'f') return this.full(name + e, cwd);
      return null;
    }
    for (const d of dirs) for (const e of exts) {
      const p = this.join(this.full(d), name.toUpperCase() + e);
      if (this.get(p)?.t === 'f') return p;
    }
    return null;
  }

  static defaultTree() {
    const D = (c, d = WIN_DATE) => ({ t: 'd', c, d });
    const F = (x, extra = {}) => ({ t: 'f', x, d: WIN_DATE, ...extra });
    const S = (s, extra = {}) => ({ t: 'f', x: '', s, d: WIN_DATE, ...extra });
    const A = (s, a) => S(s, { a });

    const winIni = `[windows]
load=
run=
Beep=yes
Spooler=yes
NullPort=None
device=Generic / Text Only,TTY,LPT1:
BorderWidth=3
KeyboardSpeed=31
CursorBlinkRate=530
DoubleClickSpeed=452
Programs=com exe bat pif
Documents=
DeviceNotSelectedTimeout=15
TransmissionRetryTimeout=45
swapdisk=
NetWarn=1

[Desktop]
Pattern=(None)
GridGranularity=0
IconSpacing=75

[Extensions]
cal=calendar.exe ^.cal
crd=cardfile.exe ^.crd
trm=terminal.exe ^.trm
txt=notepad.exe ^.txt
ini=notepad.exe ^.ini
log=notepad.exe ^.log
bat=notepad.exe ^.bat
sys=notepad.exe ^.sys
pcx=photos.exe ^.pcx
bmp=photos.exe ^.bmp
png=photos.exe ^.png
jpg=photos.exe ^.jpg
jpeg=photos.exe ^.jpeg
gif=photos.exe ^.gif
webp=photos.exe ^.webp
wri=write.exe ^.wri
doc=winword.exe ^.doc
xls=excel.exe ^.xls
csv=excel.exe ^.csv
ppt=powerpoint.exe ^.ppt
hlp=winhelp.exe ^.hlp
wav=soundrec.exe ^.wav
mid=mplayer.exe ^.mid

[intl]
sCountry=United States
iCountry=1
iDate=0
iTime=0
iTLZero=0
iCurrency=0
iCurrDigits=2
iNegCurr=0
iLzero=1
iDigits=2
iMeasure=1
s1159=AM
s2359=PM
sCurrency=$
sThousand=,
sDecimal=.
sDate=/
sTime=:
sList=,
sShortDate=M/d/yy
sLongDate=dddd, MMMM dd, yyyy

[ports]
LPT1:=
LPT2:=
LPT3:=
COM1:=9600,n,8,1,x
COM2:=9600,n,8,1,x
COM3:=9600,n,8,1,x
COM4:=9600,n,8,1,x
EPT:=
FILE:=

[FontSubstitutes]
Helv=MS Sans Serif
Tms Rmn=MS Serif
Times=Times New Roman
Helvetica=Arial

[TrueType]

[mci extensions]
wav=waveaudio
mid=sequencer
rmi=sequencer

[sounds]
SystemAsterisk=chord.wav,Asterisk
SystemHand=chord.wav,Critical Stop
SystemDefault=ding.wav,Default Beep
SystemExclamation=chord.wav,Exclamation
SystemQuestion=chord.wav,Question
SystemExit=chimes.wav,Windows Exit
SystemStart=tada.wav,Windows Start

[Compatibility]
NOTSHELL=0x0001
WPWINFIL=0x0006

[fonts]
Arial (TrueType)=ARIAL.FOT
Courier New (TrueType)=COUR.FOT
Times New Roman (TrueType)=TIMES.FOT
Symbol (TrueType)=SYMBOL.FOT
Wingdings (TrueType)=WINGDING.FOT
MS Sans Serif 8,10,12,14,18,24 (VGA res)=SSERIFE.FON
Courier 10,12,15 (VGA res)=COURE.FON
MS Serif 8,10,12,14,18,24 (VGA res)=SERIFE.FON
Symbol 8,10,12,14,18,24 (VGA res)=SYMBOLE.FON
Small Fonts (VGA res)=SMALLE.FON

[PrinterPorts]
Generic / Text Only=TTY,LPT1:,15,45

[devices]
Generic / Text Only=TTY,LPT1:
`;

    const systemIni = `[boot]
shell=progman.exe
network.drv=
mouse.drv=mouse.drv
language.dll=
sound.drv=mmsound.drv
comm.drv=comm.drv
keyboard.drv=keyboard.drv
system.drv=system.drv
386grabber=vga.3gr
oemfonts.fon=vgaoem.fon
286grabber=vgacolor.gr2
fixedfon.fon=vgafix.fon
fonts.fon=vgasys.fon
display.drv=vga.drv
drivers=mmsystem.dll

[keyboard]
subtype=
type=4
keyboard.dll=
oemansi.bin=

[boot.description]
keyboard.typ=Enhanced 101 or 102 key US and Non US keyboards
mouse.drv=Microsoft, or IBM PS/2
network.drv=No Network Installed
language.dll=English (American)
system.drv=MS-DOS System
codepage=437
woafont.fon=English (437)
aspect=100,96,96
display.drv=VGA

[386Enh]
32BitDiskAccess=OFF
device=*int13
device=*wdctrl
mouse=*vmd
network=*dosnet,*vnetbios
ebios=*ebios
woafont=dosapp.fon
display=*vddvga
EGA80WOA.FON=EGA80WOA.FON
EGA40WOA.FON=EGA40WOA.FON
CGA80WOA.FON=CGA80WOA.FON
CGA40WOA.FON=CGA40WOA.FON
keyboard=*vkd
device=*vpicd
device=*vtd
device=*reboot
device=*vdmad
device=*vsd
device=*v86mmgr
device=*pageswap
device=*dosmgr
device=*vmpoll
device=*wshell
device=*BLOCKDEV
device=*PAGEFILE
device=*vfd
device=*parity
device=*biosxlat
device=*vcd
device=*vmcpd
device=*combuff
device=*cdpscsi
local=CON
FileSysChange=off
PagingFile=C:\\WINDOWS\\WIN386.SWP
MaxPagingFileSize=8192
MinTimeSlice=20
WinTimeSlice=100,50
WinExclusive=0
Com1AutoAssign=2

[standard]

[NonWindowsApp]
localtsrs=dosedit,ced

[mci]
WaveAudio=mciwave.drv
Sequencer=mciseq.drv
CDAudio=mcicda.drv

[drivers]
timer=timer.drv
midimapper=midimap.drv
`;

    const readme = `<h2 style="text-align:center">WINDOWS 31 README</h2>
<p style="text-align:center"><i>A re-creation of Microsoft Windows version 3.1</i></p>
<p>Welcome! This file explains what is installed in this simulated copy of Windows. Use the scroll bars to read it, or choose Exit from the File menu to close Write.</p>
<p><b>What's included</b></p>
<p>The <b>Main</b> group contains File Manager, Control Panel, Print Manager, Clipboard Viewer, MS-DOS Prompt, Windows Setup and this README.</p>
<p>The <b>Accessories</b> group contains Write, Paintbrush, Terminal, Notepad, Cardfile, Calendar, Calculator, Clock, Character Map, Media Player and Sound Recorder.</p>
<p>The <b>Games</b> group contains Solitaire and Minesweeper.</p>
<p><b>Tips</b></p>
<ul>
<li>Double-click an empty part of the desktop, or press CTRL+ESC, to open the Task List.</li>
<li>Press ALT to activate a menu bar, then use the arrow keys. ALT+F4 closes the active window.</li>
<li>Files you create are stored on drive C: in your browser. Use File Manager to organise them.</li>
<li>Choose Exit Windows from Program Manager's File menu to return to MS-DOS. Type <b>WIN</b> at the C:\\&gt; prompt to start Windows again.</li>
<li>Edit C:\\AUTOEXEC.BAT in Notepad to change what happens when the computer starts. Remove the WIN line to boot to the MS-DOS prompt.</li>
<li>Control Panel lets you change colour schemes (try <i>Hotdog Stand</i>), desktop patterns, wallpaper and the screen saver.</li>
<li>Windows Setup can change the display resolution.</li>
</ul>
<p><b>Resetting</b></p>
<p>To restore the factory configuration, type <b>FDISK</b> at the MS-DOS prompt (outside Windows) and follow the instructions.</p>`;

    const ex = (s) => S(s);
    const wallpapers = {};
    for (const [n, s] of Object.entries({ ARCADE: 630, ARGYLE: 630, CASTLE: 778, CHITZ: 19918, EGYPT: 630, HONEY: 854, LEAVES: 15118, MARBLE: 27646, REDBRICK: 630, RIVETS: 630, SQUARES: 630, TARTAN: 32886, THATCH: 598, WINLOGO: 38518, ZIGZAG: 630 }))
      wallpapers[n + '.BMP'] = S(s, { g: n });

    return D({
      'AUTOEXEC.BAT': F(`@ECHO OFF\r\nPROMPT $p$g\r\nPATH C:\\WINDOWS;C:\\DOS\r\nSET TEMP=C:\\WINDOWS\\TEMP\r\nC:\\DOS\\SMARTDRV.EXE\r\nC:\\DOS\\MOUSE.COM\r\nWIN\r\n`.replace(/\r/g, ''), { d: DOS_DATE }),
      'CONFIG.SYS': F(`DEVICE=C:\\DOS\\HIMEM.SYS\nDEVICE=C:\\DOS\\EMM386.EXE NOEMS\nBUFFERS=15,0\nFILES=30\nDOS=HIGH,UMB\nLASTDRIVE=E\nFCBS=4,0\nSHELL=C:\\COMMAND.COM C:\\ /P\nSTACKS=9,256\n`, { d: DOS_DATE }),
      'COMMAND.COM': S(52925, { d: DOS_DATE }),
      'WINA20.386': S(9349, { d: DOS_DATE }),
      DOS: D({
        'ANSI.SYS': ex(9065), 'APPEND.EXE': ex(10774), 'ATTRIB.EXE': ex(11165), 'CHKDSK.EXE': ex(12907),
        'CHOICE.COM': ex(1754), 'DEBUG.EXE': ex(15718), 'DEFRAG.EXE': ex(75033), 'DELTREE.EXE': ex(11113),
        'DISKCOPY.COM': ex(11879), 'DOSKEY.COM': ex(5883), 'EDIT.COM': ex(413), 'EMM386.EXE': ex(115294),
        'FDISK.EXE': ex(29333), 'FIND.EXE': ex(6770), 'FORMAT.COM': ex(22916), 'HELP.COM': ex(413),
        'HIMEM.SYS': ex(14160), 'KEYB.COM': ex(15750), 'LABEL.EXE': ex(9390), 'MEM.EXE': ex(32150),
        'MEMMAKER.EXE': ex(118660), 'MODE.COM': ex(23537), 'MORE.COM': ex(2618), 'MOUSE.COM': ex(56408),
        'MSD.EXE': ex(158470), 'QBASIC.EXE': ex(194309), 'SCANDISK.EXE': ex(124262), 'SMARTDRV.EXE': ex(45145),
        'SORT.EXE': ex(6922), 'SYS.COM': ex(9432), 'TREE.COM': ex(6898), 'UNDELETE.EXE': ex(26420), 'XCOPY.EXE': ex(15820)
      }, DOS_DATE),
      WINDOWS: D({
        'WIN.COM': A(50904, 'win'), 'WIN.INI': F(winIni), 'SYSTEM.INI': F(systemIni),
        'PROGMAN.INI': F('[Settings]\nWindow=60 28 565 388 1\nSaveSettings=1\nMinOnRun=0\nAutoArrange=1\n\n[Groups]\nGroup1=C:\\WINDOWS\\MAIN.GRP\nGroup2=C:\\WINDOWS\\ACCESSOR.GRP\nGroup3=C:\\WINDOWS\\GAMES.GRP\nGroup4=C:\\WINDOWS\\STARTUP.GRP\nGroup5=C:\\WINDOWS\\OFFICE.GRP\n'),
        'OFFICE.GRP': S(6144),
        'CONTROL.INI': F('[current]\ncolor schemes=Windows Default\n\n[Screen Saver.Marquee]\nText=Windows 31\n'),
        'MAIN.GRP': S(5215), 'ACCESSOR.GRP': S(9862), 'GAMES.GRP': S(1488), 'STARTUP.GRP': S(44),
        'PROGMAN.EXE': A(115312, 'progman'), 'WINFILE.EXE': A(146864, 'winfile'), 'CONTROL.EXE': A(13904, 'control'),
        'PRINTMAN.EXE': A(43968, 'printman'), 'CLIPBRD.EXE': A(18512, 'clipbrd'), 'SETUP.EXE': A(422080, 'setup'),
        'TASKMAN.EXE': A(3744, 'taskman'), 'WINHELP.EXE': A(256192, 'winhelp'), 'NOTEPAD.EXE': A(32800, 'notepad'),
        'WRITE.EXE': A(244976, 'write'), 'PBRUSH.EXE': A(183376, 'pbrush'), 'CALC.EXE': A(43072, 'calc'),
        'WINWORD.EXE': A(1300000, 'winword'), 'EXCEL.EXE': A(1600000, 'excel'), 'POWERPNT.EXE': A(1400000, 'powerpoint'), 'PHOTOS.EXE': A(1268736, 'photos'),
        'CLOCK.EXE': A(16416, 'clock'), 'CALENDAR.EXE': A(59824, 'calendar'), 'CARDFILE.EXE': A(93184, 'cardfile'),
        'CHARMAP.EXE': A(22016, 'charmap'), 'TERMINAL.EXE': A(148160, 'terminal'), 'SOUNDREC.EXE': A(51888, 'soundrec'),
        'MPLAYER.EXE': A(33312, 'mplayer'), 'SOL.EXE': A(180688, 'sol'), 'WINMINE.EXE': A(27776, 'winmine'),
        'DOSPRMPT.PIF': A(545, 'dos'), '_DEFAULT.PIF': S(545), 'README.WRI': F(readme, { s: 59904 }),
        'TADA.WAV': S(27804, { g: 'TADA' }), 'CHIMES.WAV': S(15920, { g: 'CHIMES' }), 'DING.WAV': S(11598, { g: 'DING' }),
        'CHORD.WAV': S(24982, { g: 'CHORD' }), 'CANYON.MID': S(33883, { g: 'CANYON' }),
        'SCRNSAVE.SCR': S(5328, { g: 'Blank Screen' }), 'SSFLYWIN.SCR': S(16160, { g: 'Flying Windows' }),
        'SSMARQUE.SCR': S(16896, { g: 'Marquee' }), 'SSMYST.SCR': S(19456, { g: 'Mystify' }), 'SSSTARS.SCR': S(17536, { g: 'Starfield Simulation' }),
        'PROGMAN.HLP': S(48828, { g: 'progman' }), 'WINFILE.HLP': S(76855, { g: 'winfile' }), 'CONTROL.HLP': S(122155, { g: 'control' }),
        'NOTEPAD.HLP': S(13894, { g: 'notepad' }), 'WRITE.HLP': S(36279, { g: 'write' }), 'PBRUSH.HLP': S(40269, { g: 'pbrush' }),
        'CALC.HLP': S(18076, { g: 'calc' }), 'CARDFILE.HLP': S(24152, { g: 'cardfile' }), 'CALENDAR.HLP': S(20010, { g: 'calendar' }),
        'SOL.HLP': S(13071, { g: 'sol' }), 'WINMINE.HLP': S(12149, { g: 'winmine' }), 'WINHELP.HLP': S(26960, { g: 'winhelp' }),
        'GLOSSARY.HLP': S(46570, { g: 'glossary' }), 'MPLAYER.HLP': S(12896, { g: 'mplayer' }), 'SOUNDREC.HLP': S(15210, { g: 'soundrec' }),
        'TERMINAL.HLP': S(36279, { g: 'terminal' }), 'CHARMAP.HLP': S(10264, { g: 'charmap' }), 'CLIPBRD.HLP': S(13071, { g: 'clipbrd' }),
        'PRINTMAN.HLP': S(24585, { g: 'printman' }), 'SETUP.HLP': S(16233, { g: 'setup' }), 'DOSPRMPT.HLP': S(9000, { g: 'dos' }),
        ...wallpapers,
        SYSTEM: D({
          'KRNL386.EXE': ex(75490), 'KRNL286.EXE': ex(71838), 'USER.EXE': ex(264016), 'GDI.EXE': ex(220800),
          'VGA.DRV': ex(73200), 'KEYBOARD.DRV': ex(7568), 'MOUSE.DRV': ex(10672), 'SYSTEM.DRV': ex(2304),
          'COMM.DRV': ex(9280), 'MMSOUND.DRV': ex(3440), 'TIMER.DRV': ex(4192), 'MIDIMAP.DRV': ex(20512),
          'MMSYSTEM.DLL': ex(61648), 'COMMDLG.DLL': ex(89248), 'SHELL.DLL': ex(41600), 'TOOLHELP.DLL': ex(14128),
          'DDEML.DLL': ex(36864), 'OLECLI.DLL': ex(83456), 'OLESVR.DLL': ex(24064), 'VER.DLL': ex(9008),
          'LZEXPAND.DLL': ex(9936), 'WIN87EM.DLL': ex(12800), 'WIN386.EXE': ex(544789), 'DOSX.EXE': ex(32682),
          'VGASYS.FON': ex(5360), 'VGAFIX.FON': ex(5360), 'VGAOEM.FON': ex(5168), 'SSERIFE.FON': ex(64544),
          'SERIFE.FON': ex(57936), 'COURE.FON': ex(23408), 'SMALLE.FON': ex(26112), 'SYMBOLE.FON': ex(55776),
          'ARIAL.TTF': ex(65692), 'ARIAL.FOT': ex(1306), 'COUR.TTF': ex(78588), 'COUR.FOT': ex(1310),
          'TIMES.TTF': ex(83260), 'TIMES.FOT': ex(1318), 'SYMBOL.TTF': ex(64516), 'WINGDING.TTF': ex(71158),
          'MCIWAVE.DRV': ex(28224), 'MCISEQ.DRV': ex(25264), 'MCICDA.DRV': ex(24464), 'VGA.3GR': ex(7024)
        }),
        TEMP: D({})
      })
    }, DOS_DATE);
  }
}

const FS = new VFS();
window.addEventListener('pagehide', () => FS.flush());

/* PCs saved by an older release keep their old C: drive, so programs and file
   types added since then are installed here at start-up (Windows Update style). */
FS.repairSystem = function () {
  const fresh = VFS.defaultTree().c.WINDOWS, win = this.get('C:\\WINDOWS');
  if (!win || win.t !== 'd') return [];
  const added = [];
  for (const [name, node] of Object.entries(fresh.c)) if (node.a && !win.c[name]) { win.c[name] = node; added.push(name); }
  const want = readIni({ x: fresh.c['WIN.INI'].x }, 'Extensions'), have = readIni('C:\\WINDOWS\\WIN.INI', 'Extensions');
  const missing = Object.entries(want).filter(([k]) => !have[k]);
  if (missing.length) editIni('C:\\WINDOWS\\WIN.INI', ini => missing.forEach(([k, v]) => ini.set('Extensions', k, v)));
  if (added.length || missing.length) this.save();
  return added;
};

/* Minimal INI file reader used for WIN.INI associations */
function readIni(path, section) {
  const txt = (typeof path === 'object' ? path.x : FS.read(path)) || '';
  const out = {};
  let cur = null;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim();
    const m = /^\[(.+)\]$/.exec(line);
    if (m) { cur = m[1].toLowerCase(); continue; }
    if (cur === section.toLowerCase()) {
      const i = line.indexOf('=');
      if (i > 0) out[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
    }
  }
  return out;
}

/* Batch INI editor: read once, change many keys, write once.
   Keeps comments, ordering and blank lines; new keys go at the end of their
   section (before trailing blank lines); new sections go at the end. */
function editIni(path, fn) {
  const text = FS.read(path) || '';
  const lines = text.split(/\r?\n/);
  const api = {
    get(section, key) {
      let sec = null;
      for (const ln of lines) {
        const m = /^\s*\[(.+)\]\s*$/.exec(ln);
        if (m) { sec = m[1].toLowerCase(); continue; }
        if (sec === section.toLowerCase()) { const i = ln.indexOf('='); if (i > 0 && ln.slice(0, i).trim().toLowerCase() === key.toLowerCase()) return ln.slice(i + 1).trim(); }
      }
      return null;
    },
    set(section, key, value) {
      let sec = null, start = -1, end = lines.length;
      for (let i = 0; i < lines.length; i++) {
        const m = /^\s*\[(.+)\]\s*$/.exec(lines[i]);
        if (m) {
          if (sec === section.toLowerCase()) { end = i; break; }
          sec = m[1].toLowerCase();
          if (sec === section.toLowerCase()) start = i;
          continue;
        }
        if (sec === section.toLowerCase()) {
          const j = lines[i].indexOf('=');
          if (j > 0 && lines[i].slice(0, j).trim().toLowerCase() === key.toLowerCase()) {
            if (value == null) lines.splice(i, 1); else lines[i] = `${lines[i].slice(0, j).trim()}=${value}`;
            return;
          }
        }
      }
      if (value == null) return;
      if (start < 0) {
        while (lines.length && lines[lines.length - 1] === '') lines.pop();
        lines.push('', `[${section}]`, `${key}=${value}`, '');
        return;
      }
      let at = end;
      while (at - 1 > start && lines[at - 1].trim() === '') at--;
      lines.splice(at, 0, `${key}=${value}`);
    }
  };
  const r = fn(api);
  const out = lines.join('\n');
  if (out !== text) FS.write(path, out);
  return r;
}
function writeIni(path, section, key, value) { editIni(path, ini => ini.set(section, key, value)); }
