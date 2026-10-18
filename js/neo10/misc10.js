'use strict';
/* Neo10 extras: Task Manager, Weather, Run */

/* ======================= TASK MANAGER ======================= */
(() => {
  const hash = s => { let x = 0; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) | 0; return Math.abs(x); };
  const BG = [['Windows Explorer', 'neologo', 2.4], ['Desktop Window Manager', 'app', 1.6], ['Windows Audio', 'cpSound', .3], ['Print Spooler', 'printman', .2],
    ['Service Host: Local System', 'cp386', .5], ['Program Manager Compatibility Host', 'progman', .2], ['COMMAND.COM', 'dos', .1], ['Typematic Service', 'cpKeyboard', .1]];

  Sys.registerApp('taskmgr', {
    name: 'Task Manager', icon: 'taskmgr', single: true,
    run() {
      const tabs = ['Processes', 'Performance', 'Startup'];
      let tab = 0, sel = null, lastDown = 0;
      const hist = { cpu: Array(60).fill(0), mem: Array(60).fill(0) };
      const tabbar = h('div', { class: 'neo-tabs' });
      const pane = h('div', { class: 'neo-tabpane sunken' });
      const foot = h('div', { class: 'neo-tmfoot' });
      const endBtn = UI.button('&End task', { onClick: async () => { const t = sel && sel.win; if (t && !t.closed && await t.close()) { sel = null; sample(); } } });
      const same = (a, b) => !!a && !!b && (a.win ? a.win === b.win : a.name === b.name);
      foot.appendChild(endBtn);
      const w = new Win({ title: 'Task Manager', icon: 'taskmgr', w: 520, h: 460, persist: 'taskmgr',
        menu: [
          { label: '&File', items: [{ label: '&Run new task', action: () => Sys.launch('RUN') }, '-', { label: 'E&xit', action: () => w.close() }] },
          { label: '&Options', items: [{ label: '&Always on top', checked: () => !!w.o.topmost, action: () => { w.o.topmost = !w.o.topmost; w.activate(); } }] },
          { label: '&View', items: [{ label: '&Refresh now', key: 'F5', action: () => sample() }, ...tabs.map((t, i) => ({ label: '&' + t, checked: () => tab === i, action: () => { tab = i; draw(); } }))] }
        ] });
      w.body.classList.add('neo-taskmgr');
      w.body.append(tabbar, pane, foot);
      const renderTabs = () => {
        tabbar.innerHTML = '';
        tabs.forEach((t, i) => { const b = h('div', { class: 'neo-tab' + (i === tab ? ' on' : ''), text: t }); b.addEventListener('pointerdown', () => { tab = i; draw(); }); tabbar.appendChild(b); });
      };
      let procs = [];
      const sample = () => {
        const t = Date.now() / 1000, apps = Sys.desktop.wins.filter(x => !x.closed && !x.o.dialog && !x.o.hideFromTasks);
        procs = [
          ...apps.map(x => { const k = hash(x.title); return { name: x.title, icon: x.o.icon || 'app', win: x, app: true, cpu: Math.max(0, (x === Sys.desktop.active ? 3 : .4) + Math.sin(t * (1 + k % 5) / 3) * 1.5 + (k % 7) / 10), mem: 0.12 + (k % 40) / 100 }; }),
          ...BG.map(([n, icon, base]) => { const k = hash(n); return { name: n, icon, cpu: Math.max(0, base + Math.sin(t * (1 + k % 3) / 2) * base * .6), mem: .05 + (k % 30) / 100 }; })
        ];
        const cpu = Math.min(100, procs.reduce((a, p) => a + p.cpu, 0));
        const mem = Math.min(8, 2.1 + procs.reduce((a, p) => a + p.mem, 0));
        hist.cpu.push(cpu); hist.cpu.shift(); hist.mem.push(mem / 8 * 100); hist.mem.shift();
        hist.cpuNow = cpu; hist.memNow = mem;
        if (Date.now() - lastDown > 700) draw();
      };
      const graph = (data, color) => {
        const c = h('canvas', { width: 300, height: 120, class: 'neo-graph' });
        const x = c.getContext('2d');
        x.fillStyle = '#000'; x.fillRect(0, 0, 300, 120);
        x.fillStyle = '#008000';
        for (let gx = 0; gx < 300; gx += 25) x.fillRect(gx, 0, 1, 120);
        for (let gy = 0; gy < 120; gy += 20) x.fillRect(0, gy, 300, 1);
        x.fillStyle = color;
        for (let i = 1; i < data.length; i++) Raster.line(x, (i - 1) * 300 / 59, 119 - data[i - 1] * 1.18, i * 300 / 59, 119 - data[i] * 1.18, 1);
        return c;
      };
      const draw = () => {
        if (w.closed) return;
        renderTabs();
        const keepScroll = pane.scrollTop;
        pane.innerHTML = '';
        foot.style.display = tab === 0 ? '' : 'none';
        if (tab === 0) {
          const head = h('div', { class: 'neo-xhead' }, ...[['Name', 250], [`${Math.round(hist.cpuNow || 0)}%\nCPU`, 70], [`${Math.round((hist.memNow || 0) / 8 * 100)}%\nMemory`, 80], ['0%\nDisk', 60]].map(([t, wd]) => h('div', { class: 'neo-xcol raised', style: { width: wd + 'px', whiteSpace: 'pre', lineHeight: '14px' }, text: t })));
          pane.appendChild(head);
          const section = (label, list) => {
            pane.appendChild(h('div', { class: 'neo-applabel', text: `${label} (${list.length})` }));
            for (const p of list) {
              if (same(sel, p)) sel = p;
              const r = h('div', { class: 'it neo-xrow' + (same(sel, p) ? ' sel' : ''), role: 'row', 'aria-selected': String(same(sel, p)) },
                h('span', { style: { width: '250px' } }, iconImg(p.icon, 16), h('span', { class: 'neo-xname', text: p.name })),
                h('span', { style: { width: '70px', textAlign: 'right' }, text: p.cpu.toFixed(1) + '%' }), h('span', { style: { width: '80px', textAlign: 'right' }, text: (p.mem * 1024).toFixed(0) + ' KB' }), h('span', { style: { width: '60px', textAlign: 'right' }, text: '0 MB/s' }));
              // select in place: rebuilding the rows mid-click would swallow the double-click
              r.addEventListener('pointerdown', () => { sel = p; lastDown = Date.now(); pane.querySelectorAll('.neo-xrow.sel').forEach(x => { x.classList.remove('sel'); x.setAttribute('aria-selected', 'false'); }); r.classList.add('sel'); r.setAttribute('aria-selected', 'true'); endBtn.disabled = !p.win; });
              r.addEventListener('dblclick', () => { if (p.win) { p.win.isMin ? p.win.restore() : p.win.activate(); } });
              pane.appendChild(r);
            }
          };
          section('Apps', procs.filter(p => p.app));
          section('Background processes', procs.filter(p => !p.app));
          endBtn.disabled = !(sel && sel.win && !sel.win.closed);
        } else if (tab === 1) {
          pane.append(h('div', { class: 'neo-h2', text: 'CPU' }), h('div', { class: 'neo-kind', text: 'Intel 80486DX2 @ 66 MHz' }), graph(hist.cpu, '#00ff00'),
            SP.info([['Utilization', Math.round(hist.cpuNow || 0) + '%'], ['Speed', '0.07 GHz'], ['Processes', String(procs.length)], ['Up time', (() => { const s = Math.floor(performance.now() / 1000); return `0:${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; })()]]),
            h('div', { class: 'neo-h2', text: 'Memory' }), h('div', { class: 'neo-kind', text: '8.0 MB' }), graph(hist.mem, '#ffff00'),
            SP.info([['In use', (hist.memNow || 0).toFixed(1) + ' MB'], ['Available', (8 - (hist.memNow || 0)).toFixed(1) + ' MB'], ['System resources', sysResources() + '% free']]));
        } else {
          const groups = Store.get('pm.groups') || PM.defaults();
          const su = (groups.find(g => g.name.toLowerCase() === 'startup') || { items: [] }).items;
          const off = Store.get('startup.off', []);
          if (!su.length) pane.appendChild(h('div', { class: 'neo-xempty', text: 'There are no startup items to display. Add some in Settings > Apps > Startup.' }));
          for (const it of su) {
            const dis = off.includes(it.name);
            const r = h('div', { class: 'it neo-xrow' }, h('span', { style: { width: '250px' }, text: it.name }), h('span', { style: { width: '100px' }, text: dis ? 'Disabled' : 'Enabled' }), h('span', { text: 'Low' }));
            r.addEventListener('dblclick', () => { Store.set('startup.off', dis ? off.filter(x => x !== it.name) : [...off, it.name]); draw(); });
            pane.appendChild(r);
          }
          if (su.length) pane.appendChild(SP.p('Double-click an item to enable or disable it.'));
        }
        pane.scrollTop = keepScroll;
      };
      const iv = setInterval(sample, 1000);
      w.on('closed', () => clearInterval(iv));
      sample();
      return w;
    }
  });
})();

/* ======================= WEATHER ======================= */
const Weather = {
  city: 'Tokyo',
  CONDS: [['Sunny', 'weather'], ['Partly cloudy', 'weather'], ['Cloudy', 'weather'], ['Rain showers', 'weather']],
  rng(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; },
  day(d) {
    const seed = d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate();
    const r = this.rng(seed); r(); r();
    // Tokyo: highs ~50°F in January, ~88°F in early August; tsuyu rains in June–July.
    const m = d.getMonth(), season = Math.cos((m + d.getDate() / 31 - 7.2) / 12 * Math.PI * 2);
    const hi = Math.round(66 + season * 19 + r() * 6), lo = hi - 8 - Math.round(r() * 6);
    const wet = [0.10, 0.15, 0.25, 0.25, 0.25, 0.50, 0.40, 0.20, 0.40, 0.30, 0.20, 0.10][m];
    const c = r() < wet ? this.CONDS[3] : this.CONDS[Math.floor(r() * 3)];
    return { hi, lo, cond: c[0], icon: c[1] };
  },
  unit(f) { return Intl31.get().iMeasure === 0 ? Math.round((f - 32) * 5 / 9) : f; },
  today() { const d = this.day(Sys.now()), hr = Sys.now().getHours(); const t = Math.round(d.lo + (d.hi - d.lo) * Math.max(0, Math.sin((hr - 6) / 12 * Math.PI))); return { temp: this.unit(t), cond: d.cond, icon: d.icon }; }
};
Sys.registerApp('weather', {
  name: 'Weather', icon: 'weather', single: true,
  run() {
    const w = new Win({ title: 'Weather', icon: 'weather', w: 520, h: 330, persist: 'weather' });
    w.body.classList.add('neo-weather');
    const draw = () => {
      w.body.innerHTML = '';
      const now = Weather.today(), unit = Intl31.get().iMeasure === 0 ? 'C' : 'F';
      const big = iconImg('weather'); big.style.width = big.style.height = '96px';
      w.body.append(
        h('div', { class: 'neo-h2', text: Weather.city }),
        h('div', { class: 'neo-wxnow' }, big, h('div', {}, h('div', { class: 'neo-wxtemp', text: `${now.temp}°${unit}` }), h('div', { class: 'neo-slabel', text: now.cond }), h('div', { class: 'neo-kind', text: `Updated ${Intl31.time(Sys.now())}` }))));
      const days = h('div', { class: 'neo-wxdays' });
      for (let i = 0; i < 5; i++) {
        const d = new Date(Sys.now()); d.setDate(d.getDate() + i);
        const f = Weather.day(d);
        days.appendChild(h('div', { class: 'neo-wxday raised' }, h('div', { class: 'neo-slabel', text: i ? Intl31.DAYS[d.getDay()].slice(0, 3) + ' ' + d.getDate() : 'Today' }), iconImg(f.icon), h('div', { text: `${Weather.unit(f.hi)}° / ${Weather.unit(f.lo)}°` }), h('div', { class: 'neo-kind', text: f.cond })));
      }
      w.body.appendChild(days);
      w.body.appendChild(h('div', { class: 'neo-kind', text: `Temperatures in °${unit} follow Settings > Time & Language > Region.` }));
    };
    draw();
    const off = Sys.on('settings', draw), iv = setInterval(draw, 60000);
    w.on('closed', () => { off(); clearInterval(iv); });
    return w;
  }
});

/* ======================= RUN ======================= */
Sys.registerApp('run10', {
  name: 'Run', icon: 'runbox',
  run() {
    const hist = Store.get('run.hist', []);
    const d = dialog({
      title: 'Run', w: 330, h: 110,
      build(d) {
        d.add(iconImg('runbox'), 10, 10);
        d.add(h('div', { class: 'txt', style: { width: '260px', whiteSpace: 'normal' }, text: 'Type the name of a program, folder, document, or Internet resource, and Windows will open it for you.' }), 56, 8);
        const t = UI.text(hist[0] || '');
        t.setAttribute('list', 'runhist');
        const dl = h('datalist', { id: 'runhist' }, ...hist.map(x => h('option', { value: x })));
        d.add(UI.label('&Open:', t), 10, 56); d.add(t, 56, 52, 266); d.body.appendChild(dl);
        const ok = () => {
          const v = t.value.trim(); if (!v) return;
          Store.set('run.hist', [v, ...hist.filter(x => x !== v)].slice(0, 10));
          d.close();
          Sys.launch(v, { caller: 'Run' });
        };
        d.add(UI.button('OK', { default: true, onClick: ok }), 70, 82, 76, 25);
        d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 154, 82, 76, 25);
        d.add(UI.button('&Browse...', { onClick: async () => { const p = await fileDialog({ title: 'Browse', owner: d.win, filters: [['Programs', '*.EXE;*.COM;*.BAT;*.PIF'], ['All Files (*.*)', '*.*']] }); if (p) t.value = p; } }), 238, 82, 84, 25);
      }
    });
    d.win.move(8, Sys.desktop.H - d.win.h - 8);
    return null;
  }
});
