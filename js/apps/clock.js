'use strict';
/* Clock — analog face rasterised pixel by pixel; digital readout in the bitmap font */
(() => {
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#fff';

  function drawAnalog(x, W, H, d, opts) {
    x.fillStyle = opts.bg; x.fillRect(0, 0, W, H);
    const cx = Math.floor(W / 2), cy = Math.floor(H / 2), R = Math.max(4, Math.floor(Math.min(W, H) / 2) - 3);
    // minute & hour marks
    for (let i = 0; i < 60; i++) {
      const a = i * Math.PI / 30, px = Math.round(cx + Math.sin(a) * R * 0.92), py = Math.round(cy - Math.cos(a) * R * 0.92);
      if (i % 5 === 0) { const s = Math.max(2, Math.round(R / 18)); x.fillStyle = opts.mark; x.fillRect(px - (s >> 1), py - (s >> 1), s, s); }
      else if (R > 30) { x.fillStyle = opts.fg; x.fillRect(px, py, 1, 1); }
    }
    const hand = (frac, len, width, color) => {
      const a = frac * Math.PI * 2;
      x.fillStyle = color;
      Raster.line(x, cx, cy, Math.round(cx + Math.sin(a) * R * len), Math.round(cy - Math.cos(a) * R * len), width);
    };
    const hh = d.getHours() % 12, mm = d.getMinutes(), ss = d.getSeconds();
    hand((hh + mm / 60) / 12, 0.5, Math.max(2, Math.round(R / 14)), opts.fg);
    hand((mm + ss / 60) / 60, 0.78, Math.max(1, Math.round(R / 22)), opts.fg);
    if (opts.seconds) hand(ss / 60, 0.85, 1, opts.fg);
    x.fillRect(cx - 1, cy - 1, 3, 3);
  }

  function drawDigital(x, W, H, d, opts) {
    x.fillStyle = opts.bg; x.fillRect(0, 0, W, H);
    let hh = d.getHours(); const ap = hh >= 12 ? 'PM' : 'AM'; hh = hh % 12 || 12;
    const t = `${hh}:${pad(d.getMinutes())}${opts.seconds ? ':' + pad(d.getSeconds()) : ''}`;
    if (opts.font && opts.font !== 'Pixel') {
      const date = opts.date ? dateStr(d) : '';
      const size = clamp(+opts.fontSize || 20, 8, 48);
      const family = WIN_FONTS[opts.font] || WIN_FONTS['MS Sans Serif'];
      const tmp = h('canvas'), c = tmp.getContext('2d');
      c.font = `${size}px ${family}`;
      const line = `${t} ${ap}`, width = Math.ceil(c.measureText(line).width + 8), lineH = Math.ceil(size * 1.35);
      tmp.width = Math.max(1, Math.min(W - 8, width)); tmp.height = lineH * (date ? 2 : 1);
      c.font = `${size}px ${family}`; c.fillStyle = opts.fg; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(line, tmp.width / 2, lineH / 2, tmp.width - 4);
      if (date) { c.font = `${Math.max(8, Math.round(size * .65))}px ${family}`; c.fillText(date, tmp.width / 2, lineH * 1.5, tmp.width - 4); }
      x.imageSmoothingEnabled = false;
      x.drawImage(tmp, Math.floor((W - tmp.width) / 2), Math.floor((H - tmp.height) / 2));
      return;
    }
    const lines = [t];
    if (opts.date) lines.push(dateStr(d));
    const g0 = new PixGrid(1, 1);
    const tw = g0.textW(t), aw = g0.textW(ap);
    const scale = Math.max(1, Math.floor(Math.min((W - 10) / (tw + aw / 2 + 4), (H - 10) / (lines.length === 2 ? 11 : 7))));
    const sub = Math.max(1, Math.floor(scale / 2));
    const totalW = tw * scale + 4 * scale + aw * sub;
    const g = new PixGrid(Math.ceil(totalW) + 2, (lines.length === 2 ? 11 : 6) * scale + 2);
    g.t(0, 0, t, 'K', scale);
    g.t(tw * scale + 3 * scale, 6 * scale - 6 * sub, ap, 'K', sub);
    if (opts.date) { const dw = g.textW(lines[1], sub); g.t(Math.max(0, Math.floor((totalW - dw) / 2)), 8 * scale, lines[1], 'K', sub); }
    const c = g.canvas();
    // recolour black glyph pixels to the window-text colour
    const tmp = h('canvas', { width: c.width, height: c.height }), tx = tmp.getContext('2d');
    tx.drawImage(c, 0, 0); tx.globalCompositeOperation = 'source-in'; tx.fillStyle = opts.fg; tx.fillRect(0, 0, c.width, c.height);
    x.imageSmoothingEnabled = false;
    x.drawImage(tmp, Math.floor((W - c.width) / 2), Math.floor((H - c.height) / 2));
  }

  /* ======================= Alarms, Timer & Stopwatch engine =======================
     Lives at script load (not inside the window) so alarms ring even when the
     Clock window is closed. */
  const APP = 'Alarms & Clock';
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const SOUNDS = ['Alarm', 'Chimes', 'Xylophone', 'Ding', 'Chord', 'Ta-da'];
  const SNOOZES = [0, 5, 10, 15, 20, 30, 60];
  const snoozeText = m => m ? `${m} minutes` : 'Disabled';
  const repeatText = days => {
    const s = [...new Set(days || [])].sort();
    if (!s.length) return 'Once';
    if (s.length === 7) return 'Every day';
    if (s.join() === '1,2,3,4,5') return 'Weekdays';
    if (s.join() === '0,6') return 'Weekends';
    return s.map(d => DAYS[d].slice(0, 3)).join(', ');
  };
  const atTime = (hh, mm) => { const d = Sys.now(); d.setHours(hh, mm, 0, 0); return d; };
  const minuteKey = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${d.getMinutes()}`;
  const parseTime = s => {
    const m = /^\s*(\d{1,2})(?:\s*[:.h]\s*(\d{1,2}))?\s*(?:([ap])\.?\s*m?\.?)?\s*$/i.exec(String(s));
    if (!m) return null;
    let hh = +m[1]; const mm = +(m[2] || 0);
    if (m[3]) { if (hh < 1 || hh > 12) return null; hh = hh % 12 + (/p/i.test(m[3]) ? 12 : 0); }
    return hh > 23 || mm > 59 ? null : { h: hh, m: mm };
  };
  const fmtDur = (ms, cs = false) => {
    ms = Math.max(0, ms);
    const t = cs ? Math.floor(ms / 10) : Math.ceil(ms / 1000);
    const s = cs ? Math.floor(t / 100) : t, hh = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60, ss = s % 60;
    return `${hh ? hh + ':' + pad(mm) : pad(mm)}:${pad(ss)}${cs ? '.' + pad(t % 100) : ''}`;
  };

  /* alarm sounds: the stock WAVs plus two synthesised ringtones */
  const soundCache = {};
  const soundSamples = name => {
    const stock = { Chimes: 'CHIMES', Ding: 'DING', Chord: 'CHORD', 'Ta-da': 'TADA' }[name];
    if (stock) return Snd.samples(stock);
    if (soundCache[name]) return soundCache[name];
    const S = Snd, b = new Float32Array(Math.floor(S.rate * 1.6));
    if (name === 'Xylophone') [72, 76, 79, 84, 79, 76].forEach((n, i) => S.tone(b, i * 0.16, 0.6, S.hz(n), .3, { harm: [1, 0, .3, 0, .1], attack: .002, decay: 9 }));
    else for (let i = 0; i < 4; i++) S.tone(b, i * 0.2, 0.13, 1760, .4, { harm: [1, .3, .15], attack: .003, decay: 2 });
    return (soundCache[name] = S.norm(b, .7));
  };
  /* play a sound on repeat until stopped (gives up after two minutes) */
  const ringLoop = name => {
    let alive = true, src = null, timer = 0;
    const until = Date.now() + 120000;
    const once = () => {
      if (!alive || Date.now() > until) return;
      src = Snd.play(soundSamples(name), Snd.rate, { volume: .8, onended: () => { src = null; if (alive) timer = setTimeout(once, 600); } });
      if (!src) timer = setTimeout(once, 2000);
    };
    once();
    return () => { alive = false; clearTimeout(timer); try { src && src.stop(); } catch { } };
  };
  const toast = (title, text, onClick) => {
    if (Sys.isNeo() && typeof Shell10 !== 'undefined') Shell10.notify({ app: APP, icon: 'clock', title, text, onClick });
  };
  const openView = view => Sys.run('clock', { args: view });
  /* Away from the desktop (lock screen or sleep) the alarm dialog would be hidden, so a
     card with the same buttons is drawn above the lock screen; sleep wakes up for it. */
  const lockCard = (title, text, buttons) => {
    if (Sys.mode === 'asleep') document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
    if (Sys.mode !== 'locked') return null;
    const row = h('div', { class: 'clock-lockbtns' });
    const card = h('div', { class: 'clock-lockcard raised', role: 'alertdialog', 'aria-label': title },
      h('div', { class: 'clock-lockhead' }, iconImg('clock'), h('div', {}, h('b', { text: title }), h('div', { text })), ), row);
    for (const [label, fn] of buttons) row.appendChild(UI.button(label, { onClick: () => { card.remove(); fn(); } }));
    card.addEventListener('keydown', e => e.stopPropagation());   // keys work the buttons instead of opening sign-in
    Sys.screen.appendChild(card);
    row.lastChild.focus();
    return card;
  };

  const Alarms = {
    listeners: new Set(),
    snoozes: [],          // { id, at } (real-time ms)
    ringing: new Map(),   // id -> dialog
    list() { return (Store.get('clock.alarms', []) || []).map(a => ({ ...a, days: [...(a.days || [])] })); },
    save(list) { Store.set('clock.alarms', list); this.changed(); },
    changed() { for (const f of this.listeners) try { f(); } catch (e) { console.error(e); } },
    upsert(a) {
      const list = this.list(), i = list.findIndex(x => x.id === a.id);
      if (i >= 0) list[i] = a; else list.push(a);
      this.snoozes = this.snoozes.filter(s => s.id !== a.id);
      this.save(list);
    },
    remove(id) {
      this.snoozes = this.snoozes.filter(s => s.id !== id);
      const d = this.ringing.get(id); if (d) d.close('dismiss');
      this.save(this.list().filter(a => a.id !== id));
    },
    setOn(id, on) {
      const list = this.list(), a = list.find(x => x.id === id);
      if (!a) return;
      a.on = on;
      if (!on) this.snoozes = this.snoozes.filter(s => s.id !== id);
      this.save(list);
    },
    next(a, now = Sys.now()) {
      for (let i = 0; i < 8; i++) {
        const d = new Date(now); d.setDate(d.getDate() + i); d.setHours(a.h, a.m, 0, 0);
        if (d > now && (!a.days.length || a.days.includes(d.getDay()))) return d;
      }
      return null;
    },
    tick() {
      const now = Sys.now(), key = minuteKey(now), due = [];
      const list = this.list();
      let dirty = false;
      for (const a of list) {
        if (!a.on || a.h !== now.getHours() || a.m !== now.getMinutes() || a.last === key) continue;
        if (a.days.length && !a.days.includes(now.getDay())) continue;
        a.last = key; dirty = true;
        if (!a.days.length) a.on = false;     // "Once" alarms switch themselves off
        due.push(a);
      }
      if (dirty) this.save(list);
      const t = Date.now();
      for (const s of this.snoozes.filter(s => s.at <= t)) {
        this.snoozes.splice(this.snoozes.indexOf(s), 1);
        const a = list.find(x => x.id === s.id);
        if (a) due.push({ ...a, snoozed: true });
      }
      if (due.length) this.changed();
      due.forEach(a => this.ring(a));
    },
    snooze(a, mins) {
      this.snoozes = this.snoozes.filter(s => s.id !== a.id);
      this.snoozes.push({ id: a.id, at: Date.now() + mins * 60000 });
      this.changed();
    },
    ring(a) {
      const old = this.ringing.get(a.id); if (old) old.close('replaced');
      const stop = ringLoop(a.sound || 'Alarm');
      const when = Intl31.time(atTime(a.h, a.m));
      const title = a.name || 'Alarm';
      toast(title, `${when}${a.snoozed ? '  (snoozed)' : ''}  ·  ${repeatText(a.days)}`, () => openView('alarms'));
      let card = null;
      const d = dialog({
        title: APP, w: 250, h: a.snooze ? 150 : 112, modal: false, cancelValue: 'dismiss',
        onClose: () => { stop(); card?.remove(); if (this.ringing.get(a.id) === d) this.ringing.delete(a.id); },
        build: dd => {
          dd.add(iconImg('clock'), 12, 12);
          dd.add(h('div', { class: 'txt', style: { fontWeight: 'bold' }, text: title }), 54, 12, 180);
          dd.add(h('div', { class: 'txt', text: `${when}${a.snoozed ? ' (snoozed)' : ''}` }), 54, 32, 180);
          let snz = null;
          if (a.snooze) {
            snz = UI.combo({ items: SNOOZES.filter(Boolean).map(snoozeText), index: Math.max(0, SNOOZES.filter(Boolean).indexOf(a.snooze)) });
            dd.add(UI.label('S&nooze for:', snz), 12, 70); dd.add(snz, 84, 66, 150);
            dd.add(UI.button('&Snooze', { onClick: () => { this.snooze(a, SNOOZES.filter(Boolean)[snz.index] || a.snooze); dd.close('snooze'); } }), 64, 108, 80, 25);
          }
          dd.add(UI.button('&Dismiss', { default: true, cancel: true, onClick: () => dd.close('dismiss') }), 154, a.snooze ? 108 : 70, 80, 25);
        }
      });
      d.win.o.topmost = true; d.win.activate();
      this.ringing.set(a.id, d);
      card = lockCard(title, `${when}${a.snoozed ? '  (snoozed)' : ''}`, [
        ...(a.snooze ? [[`Snooze (${snoozeText(a.snooze)})`, () => { this.snooze(a, a.snooze); d.close('snooze'); }]] : []),
        ['Dismiss', () => d.close('dismiss')]]);
    }
  };

  const Timer = {
    dur: Store.get('clock.timer', 5 * 60000), left: Store.get('clock.timer', 5 * 60000), endAt: 0, running: false, dlg: null,
    remaining() { return this.running ? Math.max(0, this.endAt - Date.now()) : this.left; },
    set(ms) { this.dur = this.left = ms; this.running = false; Store.set('clock.timer', ms); },
    start() { if (this.running || this.left <= 0) return; this.endAt = Date.now() + this.left; this.running = true; },
    pause() { if (!this.running) return; this.left = this.remaining(); this.running = false; },
    reset() { this.running = false; this.left = this.dur; },
    tick() {
      if (!this.running || Date.now() < this.endAt) return;
      this.running = false; this.left = 0;
      Alarms.changed();
      if (this.dlg) this.dlg.close();
      const stop = ringLoop('Xylophone');
      toast('Timer', `Your ${fmtDur(this.dur)} timer is done.`, () => openView('timer'));
      let card = null;
      const d = this.dlg = dialog({
        title: 'Timer', w: 250, h: 100, modal: false,
        onClose: () => { stop(); card?.remove(); if (this.dlg === d) this.dlg = null; },
        build: dd => {
          dd.add(iconImg('clock'), 12, 12);
          dd.add(h('div', { class: 'txt', text: `Your ${fmtDur(this.dur)} timer is done.` }), 54, 20, 180);
          dd.add(UI.button('&Restart', { onClick: () => { this.reset(); this.start(); Alarms.changed(); dd.close(); } }), 64, 62, 80, 25);
          dd.add(UI.button('&Dismiss', { default: true, cancel: true, onClick: () => { this.reset(); Alarms.changed(); dd.close(); } }), 154, 62, 80, 25);
        }
      });
      d.win.o.topmost = true; d.win.activate();
      card = lockCard('Timer', `Your ${fmtDur(this.dur)} timer is done.`, [['Dismiss', () => { this.reset(); Alarms.changed(); d.close(); }]]);
    }
  };

  const Stopwatch = {
    acc: 0, since: 0, laps: [],
    get running() { return !!this.since; },
    elapsed() { return this.acc + (this.since ? Date.now() - this.since : 0); },
    toggle() { if (this.since) { this.acc += Date.now() - this.since; this.since = 0; } else this.since = Date.now(); },
    lap() { if (this.since) this.laps.unshift(this.elapsed()); },
    reset() { this.acc = 0; this.since = this.since ? Date.now() : 0; this.laps = []; }
  };

  setInterval(() => {
    if (typeof Sys === 'undefined' || !['windows', 'locked', 'asleep'].includes(Sys.mode)) return;
    try { Alarms.tick(); Timer.tick(); } catch (e) { console.error(e); }
  }, 1000);

  /* ----- alarm editor dialog ----- */
  function editAlarm(owner, alarm) {
    const isNew = !alarm;
    const a = alarm ? { ...alarm, days: [...alarm.days] } : { id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), h: 7, m: 0, name: 'Alarm', days: [], sound: 'Alarm', snooze: 10, on: true };
    return dialog({
      title: isNew ? 'New Alarm' : 'Edit Alarm', w: 300, h: 272, owner,
      build(d) {
        const time = UI.text(Intl31.time(atTime(a.h, a.m)), { maxLength: 12 });
        const name = UI.text(a.name || '', { maxLength: 40 });
        d.add(UI.label('&Time:', time), 12, 16); d.add(time, 80, 12, 100);
        d.add(h('div', { class: 'txt', text: 'e.g. 7:30 AM or 19:30' }), 188, 16);
        d.add(UI.label('N&ame:', name), 12, 46); d.add(name, 80, 42, 206);
        d.add(UI.label('Repeats:'), 12, 76);
        const days = DAYS.map((n, i) => d.add(UI.check(n.slice(0, 2), a.days.includes(i)), 12 + i * 39, 96, 38));
        d.add(h('div', { class: 'txt', text: 'Leave every day unchecked to ring only once.' }), 12, 118);
        const sound = UI.combo({ items: SOUNDS, index: Math.max(0, SOUNDS.indexOf(a.sound)) });
        d.add(UI.label('&Sound:', sound), 12, 148); d.add(sound, 80, 144, 140);
        let stopTest = null;
        d.add(UI.button('Te&st', { onClick: () => { stopTest && stopTest(); const s = Snd.play(soundSamples(SOUNDS[sound.index] || 'Alarm'), Snd.rate, { volume: .8 }); stopTest = () => { try { s && s.stop(); } catch { } }; } }), 226, 143, 60, 25);
        const snooze = UI.combo({ items: SNOOZES.map(snoozeText), index: Math.max(0, SNOOZES.indexOf(a.snooze)) });
        d.add(UI.label('S&nooze:', snooze), 12, 180); d.add(snooze, 80, 176, 140);
        const on = d.add(UI.check('Alarm is &on', a.on), 12, 208, 200);
        const ok = () => {
          const t = parseTime(time.value);
          if (!t) { msgBox('Type a time such as 7:30 AM or 19:30.', APP, { icon: 'exclaim', owner: d.win }).then(() => { time.focus(); time.select(); }); return; }
          Object.assign(a, { h: t.h, m: t.m, name: name.value.trim() || 'Alarm', days: days.map((c, i) => c.input.checked ? i : -1).filter(i => i >= 0), sound: SOUNDS[sound.index] || 'Alarm', snooze: SNOOZES[snooze.index] ?? 10, on: on.input.checked });
          if (!isNew && (alarm.h !== a.h || alarm.m !== a.m || alarm.days.join() !== a.days.join())) delete a.last;
          stopTest && stopTest();
          Alarms.upsert(a);
          d.close(a);
        };
        if (!isNew) d.add(UI.button('&Delete', { onClick: () => { stopTest && stopTest(); confirmDelete(d.win, a).then(r => r && d.close(null)); } }), 12, 236, 70, 25);
        d.add(UI.button('OK', { default: true, onClick: ok }), 126, 236, 75, 25);
        d.add(UI.button('Cancel', { cancel: true, onClick: () => { stopTest && stopTest(); d.close(null); } }), 211, 236, 75, 25);
      }
    }).promise;
  }
  const confirmDelete = (owner, a) => msgBox(`Delete the alarm "${a.name || 'Alarm'}" (${Intl31.time(atTime(a.h, a.m))})?`, APP, { buttons: 'yesno', icon: 'question', owner })
    .then(r => { if (r !== 'yes') return false; Alarms.remove(a.id); return true; });

  /* ======================= the Alarms & Clock window ======================= */
  const VIEWS = [['clock', '&Clock'], ['alarms', '&Alarms'], ['timer', '&Timer'], ['stopwatch', 'Sto&pwatch']];
  const flex = (dir, extra) => ({ display: 'flex', flexDirection: dir, ...extra });

  Sys.registerApp('clock', {
    name: 'Clock', icon: 'clock', help: 'clock', single: true,
    reopen(w, opts) { if (w.showView && VIEWS.some(v => v[0] === opts.args)) w.showView(opts.args); },
    run(opts = {}) {
      const st = Object.assign({ mode: 'analog', seconds: true, date: true, noTitle: false, top: false, font: 'Pixel', fontSize: 20, view: 'clock' }, Store.get('clock', {}));
      if (VIEWS.some(v => v[0] === opts.args)) st.view = opts.args;
      if (!VIEWS.some(v => v[0] === st.view)) st.view = 'clock';
      const save = () => Store.set('clock', st);

      /* layout: tab strip + one pane per view */
      const root = h('div', { style: { position: 'absolute', inset: 0, ...flex('column') } });
      const tabs = h('div', { class: 'raised', style: { ...flex('row', { gap: '2px', padding: '3px', flex: 'none' }) } });
      const panes = {}, tabBtns = {};
      for (const [id, label] of VIEWS) {
        tabBtns[id] = UI.button(label, { onClick: () => showView(id) });
        Object.assign(tabBtns[id].style, { minWidth: '0', padding: '0 8px', height: '22px' });
        tabs.appendChild(tabBtns[id]);
        panes[id] = h('div', { style: { flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0, display: 'none' } });
      }
      root.append(tabs, ...Object.values(panes));

      /* ---- clock face ---- */
      const cv = h('canvas', { style: { position: 'absolute', left: 0, top: 0, imageRendering: 'pixelated' } });
      const x = cv.getContext('2d');
      panes.clock.appendChild(cv);
      const paint = () => {
        const d = Sys.now();
        if (w.isMin) { if (w.iconCanvas) drawAnalog(w.iconCanvas.getContext('2d'), 32, 32, d, { bg: '#ffffff', fg: '#000000', mark: '#000080', seconds: false }); return; }
        if (st.view !== 'clock') { if (w.title !== APP) w.setTitle(APP); return; }
        const W = panes.clock.clientWidth, H = panes.clock.clientHeight;
        if (!W || !H) return;
        if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
        const o = { bg: css('--window'), fg: css('--window-text'), mark: css('--active-title'), seconds: st.seconds, date: st.date, font: st.font, fontSize: st.fontSize };
        (st.mode === 'analog' ? drawAnalog : drawDigital)(x, W, H, d, o);
        const title = st.mode === 'analog' && st.date ? `Clock - ${dateStr(d)}` : 'Clock';
        if (w.title !== title) w.setTitle(title);
      };

      /* ---- alarms list ---- */
      let selId = null;
      const list = h('div', { class: 'sunken', tabindex: '0', style: { flex: 1, overflow: 'auto', minHeight: 0, margin: '6px 6px 0', background: 'var(--window)', color: 'var(--window-text)' } });
      const btnAdd = UI.button('&New...', { onClick: () => editAlarm(w).then(a => { if (a) { selId = a.id; renderAlarms(); } }) });
      const btnEdit = UI.button('&Edit...', { onClick: () => { const a = Alarms.list().find(x => x.id === selId); if (a) editAlarm(w, a); } });
      const btnDel = UI.button('&Delete', { onClick: () => { const a = Alarms.list().find(x => x.id === selId); if (a) confirmDelete(w, a); } });
      for (const b of [btnAdd, btnEdit, btnDel]) Object.assign(b.style, { width: '76px', height: '25px' });
      panes.alarms.style.flexDirection = 'column';
      panes.alarms.append(list, h('div', { style: flex('row', { gap: '6px', padding: '6px', justifyContent: 'flex-end', flex: 'none' }) }, btnAdd, btnEdit, btnDel));
      const untilText = d => {
        const mins = Math.max(1, Math.ceil((d - Sys.now()) / 60000)), hh = Math.floor(mins / 60), mm = mins % 60;
        return 'Rings in ' + [hh >= 24 ? `${Math.floor(hh / 24)} day${hh >= 48 ? 's' : ''}` : '', hh % 24 ? `${hh % 24} hr` : '', mm ? `${mm} min` : ''].filter(Boolean).join(' ');
      };
      const renderAlarms = () => {
        const all = Alarms.list().sort((p, q) => p.h * 60 + p.m - (q.h * 60 + q.m));
        if (!all.some(a => a.id === selId)) selId = null;
        btnEdit.disabled = btnDel.disabled = !selId;
        const keep = list.scrollTop;
        list.innerHTML = '';
        if (!all.length) list.appendChild(h('div', { style: { padding: '16px 10px', textAlign: 'center', color: 'var(--disabled-text)' }, text: 'No alarms yet. Click New to add one.' }));
        for (const a of all) {
          const sel = a.id === selId, snoozed = Alarms.snoozes.find(s => s.id === a.id);
          const nx = a.on && Alarms.next(a);
          const sub = [repeatText(a.days), a.sound || 'Alarm', a.snooze ? `Snooze ${a.snooze} min` : 'No snooze'].join('  ·  ');
          const status = snoozed ? `Snoozed until ${Intl31.time(new Date(Sys.now().getTime() + snoozed.at - Date.now()))}` : nx ? untilText(nx) : 'Off';
          const tog = UI.check('On', a.on, v => Alarms.setOn(a.id, v));
          tog.addEventListener('dblclick', e => e.stopPropagation());
          tog.addEventListener('pointerdown', e => e.stopPropagation());
          const row = h('div', { style: { ...flex('row', { alignItems: 'center', gap: '10px', padding: '5px 8px', borderBottom: '1px solid var(--btn-shadow)', cursor: 'default' }),
            background: sel ? 'var(--highlight)' : '', color: sel ? 'var(--highlight-text)' : a.on ? '' : 'var(--disabled-text)' } },
            h('div', { style: { fontSize: '20px', minWidth: '92px', whiteSpace: 'nowrap' }, text: Intl31.time(atTime(a.h, a.m)) }),
            h('div', { style: { flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' } },
              h('div', { style: { fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis' }, text: a.name || 'Alarm' }),
              h('div', { style: { overflow: 'hidden', textOverflow: 'ellipsis' }, text: sub }),
              h('div', { style: { overflow: 'hidden', textOverflow: 'ellipsis' }, text: status })),
            tog);
          row.addEventListener('pointerdown', () => { list.focus(); if (selId !== a.id) { selId = a.id; markSel(); } });
          row.dataset.id = a.id; row.dataset.on = a.on ? '1' : '';
          row.addEventListener('dblclick', () => editAlarm(w, a));
          list.appendChild(row);
        }
        list.scrollTop = keep;
      };
      /* restyle the selection in place so a double-click lands on the same row */
      const markSel = () => {
        for (const r of list.children) {
          if (!r.dataset.id) continue;
          const sel = r.dataset.id === selId;
          r.style.background = sel ? 'var(--highlight)' : '';
          r.style.color = sel ? 'var(--highlight-text)' : r.dataset.on ? '' : 'var(--disabled-text)';
          if (sel) r.scrollIntoView({ block: 'nearest' });
        }
        btnEdit.disabled = btnDel.disabled = !selId;
      };
      list.addEventListener('keydown', e => {
        const all = Alarms.list().sort((p, q) => p.h * 60 + p.m - (q.h * 60 + q.m));
        const i = all.findIndex(a => a.id === selId);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { const n = all[clamp(i + (e.key === 'ArrowDown' ? 1 : -1), 0, all.length - 1)]; if (n) { selId = n.id; markSel(); } }
        else if (e.key === 'Enter' && i >= 0) editAlarm(w, all[i]);
        else if (e.key === 'Delete' && i >= 0) confirmDelete(w, all[i]);
        else if (e.key === ' ' && i >= 0) Alarms.setOn(all[i].id, !all[i].on);
        else return;
        e.preventDefault(); e.stopPropagation();
      });

      /* ---- timer ---- */
      const bigText = () => h('div', { style: { fontSize: '40px', textAlign: 'center', fontVariantNumeric: 'tabular-nums', padding: '14px 0 8px' } });
      const tDisp = bigText();
      const tStart = UI.button('&Start', { onClick: () => { Timer.running ? Timer.pause() : Timer.start(); renderTimer(); } });
      const tReset = UI.button('&Reset', { onClick: () => { Timer.reset(); renderTimer(); } });
      const tSet = UI.button('S&et...', { onClick: () => setTimer() });
      const presets = [1, 3, 5, 10, 15, 30].map(m => { const b = UI.button(`${m} min`, { onClick: () => { Timer.set(m * 60000); Timer.start(); renderTimer(); } }); Object.assign(b.style, { width: '56px', height: '22px', minWidth: 0 }); return b; });
      for (const b of [tStart, tReset, tSet]) Object.assign(b.style, { width: '76px', height: '25px' });
      panes.timer.style.flexDirection = 'column';
      panes.timer.append(tDisp,
        h('div', { style: flex('row', { gap: '6px', justifyContent: 'center' }) }, tStart, tReset, tSet),
        h('div', { style: flex('row', { gap: '4px', justifyContent: 'center', flexWrap: 'wrap', padding: '12px 6px' }) }, presets));
      const renderTimer = () => {
        tDisp.textContent = fmtDur(Timer.remaining());
        tStart.querySelector('.bl').innerHTML = mnemonicHTML(Timer.running ? '&Pause' : '&Start');
        tStart.disabled = !Timer.running && Timer.left <= 0;
      };
      const setTimer = () => dialog({ title: 'Set Timer', w: 240, h: 100, owner: w, build(d) {
        const cur = Math.round(Timer.dur / 1000);
        const fields = [['&Hours', Math.floor(cur / 3600), 0], ['&Minutes', Math.floor(cur / 60) % 60, 80], ['&Seconds', cur % 60, 160]].map(([l, v, xx]) => {
          const t = UI.text(String(v), { maxLength: 2 });
          d.add(UI.label(l + ':', t), 12 + xx, 12); d.add(t, 12 + xx, 30, 64);
          return t;
        });
        d.add(UI.button('OK', { default: true, onClick: () => {
          const [hh, mm, ss] = fields.map(f => Math.max(0, parseInt(f.value, 10) || 0));
          const ms = ((hh * 60 + mm) * 60 + ss) * 1000;
          if (!ms) { msgBox('Set a time longer than zero.', 'Timer', { icon: 'exclaim', owner: d.win }); return; }
          Timer.set(ms); renderTimer(); d.close();
        } }), 76, 66, 75, 25);
        d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 158, 66, 75, 25);
      } });

      /* ---- stopwatch ---- */
      const sDisp = bigText();
      const sStart = UI.button('&Start', { onClick: () => { Stopwatch.toggle(); renderStopwatch(true); } });
      const sLap = UI.button('&Lap', { onClick: () => { Stopwatch.lap(); renderStopwatch(true); } });
      const sReset = UI.button('&Reset', { onClick: () => { Stopwatch.reset(); renderStopwatch(true); } });
      for (const b of [sStart, sLap, sReset]) Object.assign(b.style, { width: '76px', height: '25px' });
      const laps = h('div', { class: 'sunken', style: { flex: 1, overflow: 'auto', minHeight: 0, margin: '10px 6px 6px', background: 'var(--window)', color: 'var(--window-text)' } });
      panes.stopwatch.style.flexDirection = 'column';
      panes.stopwatch.append(sDisp, h('div', { style: flex('row', { gap: '6px', justifyContent: 'center' }) }, sStart, sLap, sReset), laps);
      const renderStopwatch = full => {
        sDisp.textContent = fmtDur(Stopwatch.elapsed(), true);
        if (!full) return;
        sStart.querySelector('.bl').innerHTML = mnemonicHTML(Stopwatch.running ? 'S&top' : '&Start');
        sLap.disabled = !Stopwatch.running;
        laps.innerHTML = '';
        const L = Stopwatch.laps;
        L.forEach((t, i) => laps.appendChild(h('div', { style: flex('row', { justifyContent: 'space-between', padding: '2px 8px', borderBottom: '1px solid var(--btn-shadow)' }) },
          h('span', { text: `Lap ${L.length - i}` }), h('span', { text: '+' + fmtDur(t - (L[i + 1] || 0), true) }), h('span', { text: fmtDur(t, true) }))));
      };

      /* ---- view switching ---- */
      const applyTitle = () => {
        const bare = st.noTitle && st.view === 'clock';
        w.tb.style.display = bare ? 'none' : '';
        w.mb.style.display = bare ? 'none' : '';
        tabs.style.display = bare ? 'none' : '';
        requestAnimationFrame(paint);
      };
      const showView = id => {
        st.view = id; save();
        for (const [v] of VIEWS) {
          panes[v].style.display = v === id ? (v === 'clock' ? 'block' : 'flex') : 'none';
          tabBtns[v].style.fontWeight = v === id ? 'bold' : '';
          tabBtns[v].classList.toggle('default', v === id);
        }
        requestAnimationFrame(() => {   // the other views need more room than a tiny clock face
          const bw = w.body.clientWidth, bh = w.body.clientHeight;
          if (st.view !== 'clock' && !w.closed && !w.isMin && !w.isMax && bw && bh && (bw < 300 || bh < 250)) {
            w.sizeToClient(Math.max(300, bw), Math.max(250, bh)); w.keepVisible();
          }
        });
        if (id === 'alarms') renderAlarms();
        if (id === 'timer') renderTimer();
        if (id === 'stopwatch') renderStopwatch(true);
        applyTitle();
      };

      const setFont = () => dialog({ title: 'Clock Font', w: 300, h: 150, owner: w, build(d) {
        const fonts = ['Pixel', 'Fixedsys', 'MS Sans Serif', 'Small Fonts', 'System'];
        const font = UI.combo({ items: fonts, index: Math.max(0, fonts.indexOf(st.font)) });
        const size = UI.combo({ items: ['12', '14', '16', '18', '20', '24', '28', '32', '40', '48'], index: ['12', '14', '16', '18', '20', '24', '28', '32', '40', '48'].indexOf(String(st.fontSize)) });
        d.add(UI.label('&Font:', font), 12, 16); d.add(font, 92, 12, 190);
        d.add(UI.label('&Size:', size), 12, 48); d.add(size, 92, 44, 90);
        d.add(h('div', { class: 'txt', text: 'Font settings apply to the digital clock.' }), 12, 80);
        d.add(UI.button('OK', { default: true, onClick: () => { st.font = fonts[font.index] || 'Pixel'; st.fontSize = +(size.value?.text || '20'); save(); d.close(); paint(); } }), 112, 112, 80, 25);
        d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close() }), 202, 112, 80, 25);
      } });
      const clockSetting = fn => () => { fn(); save(); if (st.view !== 'clock') showView('clock'); else paint(); };
      const w = new Win({
        title: 'Clock', icon: 'clock', w: 320, h: 300, minW: 60, minH: 40, persist: 'clock',
        drawIcon: c => drawAnalog(c.getContext('2d'), 32, 32, Sys.now(), { bg: '#ffffff', fg: '#000000', mark: '#000080', seconds: false }),
        iconTitle: () => '',
        onResize: () => paint(),
        topmost: st.top,
        extraSys: [{ label: 'Always on &Top', checked: () => st.top, action: () => { st.top = !st.top; w.o.topmost = st.top; save(); w.activate(); } }],
        menu: [
          { label: '&View', items: [
            ...VIEWS.map(([id, label]) => ({ label, checked: () => st.view === id, action: () => showView(id) })), '-',
            { label: '&New Alarm...', action: () => { showView('alarms'); editAlarm(w).then(a => { if (a) { selId = a.id; renderAlarms(); } }); } }] },
          { label: '&Settings', items: [
            { label: '&Analog', checked: () => st.mode === 'analog', action: clockSetting(() => { st.mode = 'analog'; }) },
            { label: '&Digital', checked: () => st.mode === 'digital', action: clockSetting(() => { st.mode = 'digital'; }) }, '-',
            { label: 'Set &Font...', action: setFont }, '-',
            { label: '&No Title', checked: () => st.noTitle, action: () => { st.noTitle = !st.noTitle; save(); if (st.view !== 'clock') showView('clock'); else applyTitle(); } },
            { label: '&Seconds', checked: () => st.seconds, action: clockSetting(() => { st.seconds = !st.seconds; }) },
            { label: 'D&ate', checked: () => st.date, action: clockSetting(() => { st.date = !st.date; }) }, '-',
            { label: 'A&bout Clock...', action: () => aboutBox('Clock', 'clock', w) }] }]
      });
      w.showView = showView;
      w.body.appendChild(root);
      panes.clock.addEventListener('dblclick', () => { st.noTitle = !st.noTitle; save(); applyTitle(); });
      panes.clock.addEventListener('pointerdown', e => {
        if (!st.noTitle || e.button !== 0) return;
        const sx = e.clientX, sy = e.clientY, ox = w.x, oy = w.y;
        panes.clock.setPointerCapture(e.pointerId);
        const mv = ev => w.move(ox + (ev.clientX - sx) / Sys.scale, oy + (ev.clientY - sy) / Sys.scale);
        const up = () => { panes.clock.removeEventListener('pointermove', mv); panes.clock.removeEventListener('pointerup', up); };
        panes.clock.addEventListener('pointermove', mv); panes.clock.addEventListener('pointerup', up);
      });
      const onChange = () => {
        if (st.view === 'alarms') renderAlarms();
        if (st.view === 'timer') renderTimer();
      };
      Alarms.listeners.add(onChange);
      let shownMinute = '';
      const timer = setInterval(() => {
        paint();
        const k = minuteKey(Sys.now());
        if (k !== shownMinute) { shownMinute = k; if (st.view === 'alarms') renderAlarms(); }   // refresh "Rings in ..."
      }, 1000);
      const fast = setInterval(() => {
        if (w.isMin) return;
        if (st.view === 'timer') renderTimer();
        else if (st.view === 'stopwatch') renderStopwatch(false);
      }, 100);
      const off = Sys.on('time', paint);
      w.on('closed', () => { clearInterval(timer); clearInterval(fast); off(); Alarms.listeners.delete(onChange); });
      showView(st.view);
      return w;
    }
  });
})();
