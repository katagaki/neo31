'use strict';
/* Sound Recorder and Media Player */
(() => {
  /* ---- pixel glyphs for transport buttons ---- */
  const GL = {
    rew: ['K....K....', 'KK...KK...', 'KKK..KKK..', 'KKKK.KKKK.', 'KKK..KKK..', 'KK...KK...', 'K....K....'].map(r => r.split('').reverse().join('')),
    ff: ['K....K....', 'KK...KK...', 'KKK..KKK..', 'KKKK.KKKK.', 'KKK..KKK..', 'KK...KK...', 'K....K....'],
    play: ['K.....', 'KK....', 'KKK...', 'KKKK..', 'KKKKK.', 'KKKK..', 'KKK...', 'KK....', 'K.....'],
    stop: ['KKKKKKK', 'KKKKKKK', 'KKKKKKK', 'KKKKKKK', 'KKKKKKK', 'KKKKKKK', 'KKKKKKK'],
    pause: ['KK..KK', 'KK..KK', 'KK..KK', 'KK..KK', 'KK..KK', 'KK..KK', 'KK..KK'],
    eject: ['...K...', '..KKK..', '.KKKKK.', 'KKKKKKK', '.......', 'KKKKKKK', 'KKKKKKK'],
    rec: ['..KKK..', '.KKKKK.', 'KKKKKKK', 'KKKKKKK', 'KKKKKKK', '.KKKKK.', '..KKK..']
  };
  const glyph = (n, color = 'K') => { const r = GL[n]; const g = new PixGrid(Math.max(...r.map(x => x.length)), r.length); g.m(0, 0, r, { K: color }); return g.canvas().toDataURL(); };
  const tbtn = (n, fn, color) => { const b = UI.button('', { onClick: fn }); b.innerHTML = ''; b.appendChild(h('img', { src: glyph(n, color), class: 'ico' })); b.style.padding = '0'; b.tabIndex = -1; return b; };

  /* ---- an original multi-voice tune rendered to samples ("CANYON.MID") ---- */
  function renderTune() {
    const S = Snd, bpm = 112, beat = 60 / bpm;
    const lead = [[62, 1], [65, .5], [69, .5], [67, 1], [65, .5], [64, .5], [62, 1.5], [57, .5], [60, 1], [62, 1], [65, 1], [67, .5], [69, .5], [70, 1.5], [69, .5],
      [67, 1], [65, 1], [64, 1], [60, 1], [62, 3], [0, 1], [69, 1], [72, .5], [74, .5], [72, 1], [70, .5], [69, .5], [67, 1.5], [65, .5], [64, 1], [65, 1], [67, 1], [69, 1],
      [70, 1], [69, .5], [67, .5], [65, 1], [64, 1], [62, 4]];
    const bass = [[38, 4], [41, 4], [36, 4], [38, 4], [41, 4], [43, 4], [45, 4], [38, 4], [38, 4]];
    const total = lead.reduce((a, n) => a + n[1], 0) * beat + 1;
    const b = new Float32Array(Math.ceil(S.rate * total));
    let t = 0;
    for (const [n, d] of lead) { if (n) S.tone(b, t, d * beat * 1.2, S.hz(n), .22, { harm: [1, .5, .3, .15], attack: .01, decay: 2.2, vib: .003 }); t += d * beat; }
    t = 0;
    for (const [n, d] of bass) { S.tone(b, t, d * beat, S.hz(n), .25, { harm: [1, .6, .2], attack: .02, decay: 1.2 }); S.tone(b, t, d * beat, S.hz(n + 7), .08, { harm: [1], attack: .05, decay: .8 }); t += d * beat; }
    for (let k = 0; k * beat < total - 1; k++) S.noise(b, k * beat, .06, k % 2 ? .12 : .2, 60);
    return S.norm(b, .7);
  }
  Snd.gen.CANYON = renderTune;

  const loadSound = path => {
    const n = FS.get(path);
    if (!n) return null;
    if (n.g && Snd.gen[n.g]) return { rate: Snd.rate, data: Snd.samples(n.g) };
    if ((n.x || '').startsWith('PCM8:')) return Snd.decode(n.x);
    return null;
  };

  /* ======================= SOUND RECORDER ======================= */
  Sys.registerApp('soundrec', {
    name: 'Sound Recorder', icon: 'soundrec', help: 'soundrec',
    run(opts) {
      let snd = { rate: Snd.rate, data: new Float32Array(0) }, pos = 0, src = null, playStart = 0, playFrom = 0, path = null, dirty = false, rec = null, timer = null;
      const len = () => snd.data.length / snd.rate;
      const posLbl = h('div', { class: 'txt' }), lenLbl = h('div', { class: 'txt', style: { textAlign: 'right' } }), stat = h('div', { class: 'txt', style: { textAlign: 'center' } });
      const wave = h('canvas', { width: 128, height: 48, style: { border: '1px solid #000', imageRendering: 'pixelated', background: '#000' } });
      const wx = wave.getContext('2d');
      const slider = UI.slider({ min: 0, max: 1000, value: 0, onChange: v => { if (!src) { pos = v / 1000 * len(); draw(); } } });

      const draw = () => {
        posLbl.textContent = `Position:\n${pos.toFixed(2)} sec.`;
        lenLbl.textContent = `Length:\n${len().toFixed(2)} sec.`;
        stat.textContent = rec ? 'Recording' : src ? 'Playing' : 'Stopped';
        wx.fillStyle = '#000'; wx.fillRect(0, 0, 128, 48);
        wx.fillStyle = '#00ff00';
        const center = Math.floor(pos * snd.rate), span = Math.floor(snd.rate * 0.05);
        let last = null;
        for (let x = 0; x < 128; x++) {
          const i = center - span / 2 + Math.floor(x / 128 * span);
          const v = i >= 0 && i < snd.data.length ? snd.data[i] : 0;
          const y = Math.round(24 - v * 22);
          if (last != null) Raster.line(wx, x - 1, last, x, y, 1); else wx.fillRect(x, y, 1, 1);
          last = y;
        }
        slider.set(len() ? pos / len() * 1000 : 0, false);
      };
      const stop = () => {
        if (src) { try { src.stop(); } catch {} src = null; }
        if (rec) finishRec();
        clearInterval(timer); timer = null; draw();
      };
      const play = () => {
        stop();
        if (!snd.data.length) return;
        if (pos >= len() - 0.01) pos = 0;
        playFrom = pos; playStart = Snd.ensure().currentTime;
        src = Snd.play(snd.data, snd.rate, { offset: pos, onended: () => { if (src) { src = null; pos = len(); clearInterval(timer); draw(); } } });
        timer = setInterval(() => { pos = Math.min(len(), playFrom + Snd.ctx.currentTime - playStart); draw(); }, 50);
        draw();
      };
      const record = async () => {
        stop();
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const ctx = Snd.ensure();
          const node = ctx.createMediaStreamSource(stream);
          const proc = ctx.createScriptProcessor(4096, 1, 1);
          const chunks = [], ratio = ctx.sampleRate / snd.rate;
          proc.onaudioprocess = e => {
            const inp = e.inputBuffer.getChannelData(0);
            const out = new Float32Array(Math.floor(inp.length / ratio));
            for (let i = 0; i < out.length; i++) out[i] = inp[Math.floor(i * ratio)];
            chunks.push(out);
            pos += out.length / snd.rate; stat.textContent = 'Recording'; posLbl.textContent = `Position:\n${pos.toFixed(2)} sec.`;
            if (pos > 60) stop();
          };
          node.connect(proc); proc.connect(ctx.destination);
          rec = { stream, proc, node, chunks, at: Math.floor(pos * snd.rate) };
          draw();
        } catch {
          msgBox('Sound Recorder cannot record because no recording device is available, or access to the microphone was denied.', 'Sound Recorder', { icon: 'exclaim', owner: w });
        }
      };
      const finishRec = () => {
        const r = rec; rec = null;
        r.proc.disconnect(); r.node.disconnect(); r.stream.getTracks().forEach(t => t.stop());
        const n = r.chunks.reduce((a, c) => a + c.length, 0);
        const ins = new Float32Array(n); let o = 0; for (const c of r.chunks) { ins.set(c, o); o += c.length; }
        const before = snd.data.slice(0, r.at), after = snd.data.slice(Math.min(snd.data.length, r.at + n));
        const out = new Float32Array(before.length + ins.length + after.length);
        out.set(before); out.set(ins, before.length); out.set(after, before.length + ins.length);
        snd.data = out; dirty = true;
      };
      const effect = fn => { stop(); snd = fn(snd); pos = Math.min(pos, len()); dirty = true; draw(); };
      const resample = (s, f) => { const out = new Float32Array(Math.floor(s.data.length / f)); for (let i = 0; i < out.length; i++) out[i] = s.data[Math.floor(i * f)]; return { rate: s.rate, data: out }; };

      const name = () => path ? FS.basename(path) : '(Untitled)';
      const title = () => w.setTitle('Sound Recorder - ' + name());
      const confirmLose = async () => {
        stop();
        if (!dirty) return true;
        const r = await askSave('Sound Recorder', `Do you want to save the current sound?`, w);
        if (r === 'cancel') return false;
        if (r === 'yes') return save();
        return true;
      };
      const load = p => { const s = loadSound(p); if (!s) { msgBox(`${FS.basename(p)}\nThis is not a valid wave file.`, 'Sound Recorder', { icon: 'exclaim', owner: w }); return; } snd = { rate: s.rate, data: s.data.slice() }; path = FS.full(p); pos = 0; dirty = false; title(); draw(); };
      const writeTo = p => { try { FS.write(p, Snd.encode(snd.data, snd.rate), { s: snd.data.length + 44 }); path = FS.full(p); dirty = false; title(); return true; } catch (e) { msgBox(e.message, 'Sound Recorder', { icon: 'exclaim', owner: w }); return false; } };
      const saveAs = async () => { const p = await fileDialog({ mode: 'save', owner: w, defExt: 'WAV', filters: [['Sounds (*.WAV)', '*.WAV']] }); return p ? writeTo(p) : false; };
      const save = () => path && !FS.get(path)?.g ? writeTo(path) : saveAs();

      const w = new Win({
        title: 'Sound Recorder - (Untitled)', icon: 'soundrec', resizable: false, maxBox: false, w: 320, h: 200,
        onClose: confirmLose, onClosed: () => stop(),
        menu: [
          { label: '&File', items: [
            { label: '&New', action: async () => { if (await confirmLose()) { snd = { rate: Snd.rate, data: new Float32Array(0) }; path = null; pos = 0; dirty = false; title(); draw(); } } },
            { label: '&Open...', action: async () => { if (!(await confirmLose())) return; const p = await fileDialog({ owner: w, filters: [['Sounds (*.WAV)', '*.WAV']] }); if (p) load(p); } },
            { label: '&Save', action: save }, { label: 'Save &As...', action: saveAs },
            { label: '&Revert...', disabled: () => !path || !dirty, action: () => load(path) }, '-',
            { label: 'E&xit', action: () => w.close() }] },
          { label: '&Edit', items: [
            { label: '&Copy', action: () => Sys.setClipboard({ type: 'sound', data: Snd.encode(snd.data, snd.rate) }) },
            { label: '&Paste Insert', disabled: () => Sys.clipboard?.type !== 'sound', action: () => effect(s => { const c = Snd.decode(Sys.clipboard.data).data, at = Math.floor(pos * s.rate); const o = new Float32Array(s.data.length + c.length); o.set(s.data.slice(0, at)); o.set(c, at); o.set(s.data.slice(at), at + c.length); return { rate: s.rate, data: o }; }) },
            { label: 'Paste Mi&x', disabled: () => Sys.clipboard?.type !== 'sound', action: () => effect(s => { const c = Snd.decode(Sys.clipboard.data).data, at = Math.floor(pos * s.rate); const o = new Float32Array(Math.max(s.data.length, at + c.length)); o.set(s.data); for (let i = 0; i < c.length; i++) o[at + i] = clamp(o[at + i] + c[i], -1, 1); return { rate: s.rate, data: o }; }) }, '-',
            { label: '&Insert File...', action: async () => { const p = await fileDialog({ owner: w, filters: [['Sounds (*.WAV)', '*.WAV']] }); const s2 = p && loadSound(p); if (s2) effect(s => { const at = Math.floor(pos * s.rate); const o = new Float32Array(s.data.length + s2.data.length); o.set(s.data.slice(0, at)); o.set(s2.data, at); o.set(s.data.slice(at), at + s2.data.length); return { rate: s.rate, data: o }; }); } },
            { label: '&Mix with File...', action: async () => { const p = await fileDialog({ owner: w, filters: [['Sounds (*.WAV)', '*.WAV']] }); const s2 = p && loadSound(p); if (s2) effect(s => { const at = Math.floor(pos * s.rate); const o = new Float32Array(Math.max(s.data.length, at + s2.data.length)); o.set(s.data); for (let i = 0; i < s2.data.length; i++) o[at + i] = clamp(o[at + i] + s2.data[i], -1, 1); return { rate: s.rate, data: o }; }); } }, '-',
            { label: 'Delete &Before Current Position', action: () => effect(s => ({ rate: s.rate, data: s.data.slice(Math.floor(pos * s.rate)) })) },
            { label: 'Delete &After Current Position', action: () => effect(s => ({ rate: s.rate, data: s.data.slice(0, Math.floor(pos * s.rate)) })) }] },
          { label: 'Effect&s', items: [
            { label: '&Increase Volume (by 25%)', action: () => effect(s => ({ rate: s.rate, data: s.data.map(v => clamp(v * 1.25, -1, 1)) })) },
            { label: '&Decrease Volume', action: () => effect(s => ({ rate: s.rate, data: s.data.map(v => v * 0.75) })) },
            { label: 'I&ncrease Speed (by 100%)', action: () => effect(s => resample(s, 2)) },
            { label: 'D&ecrease Speed', action: () => effect(s => resample(s, 0.5)) },
            { label: '&Add Echo', action: () => effect(s => { const d = Math.floor(s.rate * 0.12), o = new Float32Array(s.data.length + d * 3); o.set(s.data); for (let k = 1; k <= 3; k++) for (let i = 0; i < s.data.length; i++) o[i + d * k] += s.data[i] * Math.pow(0.45, k); return { rate: s.rate, data: o.map(v => clamp(v, -1, 1)) }; }) },
            { label: '&Reverse', action: () => effect(s => ({ rate: s.rate, data: s.data.slice().reverse() })) }] },
          { label: '&Help', items: [{ label: '&Contents', action: () => Sys.launch('WINHELP.EXE soundrec') }, '-', { label: '&About Sound Recorder...', action: () => aboutBox('Sound Recorder', 'soundrec', w) }] }
        ]
      });
      const b = w.body;
      b.style.background = 'var(--btn-face)';
      b.classList.add('dlgc');
      b.append(UI.place(stat, 8, 6, 290), UI.place(posLbl, 8, 26, 80), UI.place(wave, 92, 24), UI.place(lenLbl, 226, 26, 80), UI.place(slider.el, 8, 80, 296));
      const btns = [['rew', () => { stop(); pos = 0; draw(); }], ['ff', () => { stop(); pos = len(); draw(); }], ['play', play], ['stop', stop], ['rec', record, 'R']];
      btns.forEach(([n, fn, c], i) => b.appendChild(UI.place(tbtn(n, fn, c), 16 + i * 58, 106, 52, 30)));
      requestAnimationFrame(() => w.sizeToClient(312, 144));
      if (opts.args) load(FS.full(opts.args.trim(), 'C:\\WINDOWS'));
      draw();
      return w;
    }
  });

  /* ======================= MEDIA PLAYER ======================= */
  Sys.registerApp('mplayer', {
    name: 'Media Player', icon: 'mplayer', help: 'mplayer',
    run(opts) {
      let snd = null, path = null, device = null, src = null, pos = 0, playStart = 0, playFrom = 0, timer = null, paused = false;
      const len = () => snd ? snd.data.length / snd.rate : 0;
      const track = h('div', { style: { position: 'absolute', left: '8px', right: '8px', top: '10px', height: '30px' } });
      const rail = h('div', { style: { position: 'absolute', left: '6px', right: '6px', top: '6px', height: '4px', border: '1px solid', borderColor: '#808080 #fff #fff #808080', background: '#fff' } });
      const thumb = h('div', { class: 'raised', style: { position: 'absolute', top: 0, width: '10px', height: '18px', border: '1px solid #000' } });
      const ticks = h('div', { style: { position: 'absolute', left: '6px', right: '6px', top: '20px', height: '6px' } });
      track.append(rail, ticks, thumb);
      const status = h('div', { class: 'txt', style: { position: 'absolute', left: '200px', top: '48px' } });
      const fmtT = s => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;
      const draw = () => {
        const W = track.clientWidth - 22;
        thumb.style.left = (len() ? pos / len() * W : 0) + 'px';
        ticks.innerHTML = '';
        const n = Math.max(1, Math.floor(len() / 2));
        for (let i = 0; i <= n && len(); i++) ticks.appendChild(h('div', { style: { position: 'absolute', left: (i / n * (track.clientWidth - 22) + 4) + 'px', width: '1px', height: i % 5 ? '3px' : '6px', background: '#000' } }));
        status.textContent = snd ? `${src ? 'Playing' : paused ? 'Paused' : 'Stopped'}   ${fmtT(pos)} / ${fmtT(len())}` : 'No device open';
        bPlay.innerHTML = ''; bPlay.appendChild(h('img', { src: glyph(src ? 'pause' : 'play'), class: 'ico' }));
        w.setTitle(snd ? `Media Player - ${FS.basename(path).toLowerCase()} (${src ? 'playing' : paused ? 'paused' : 'stopped'})` : 'Media Player');
      };
      const stop = (keepPos) => { if (src) { const s = src; src = null; try { s.stop(); } catch {} } clearInterval(timer); if (!keepPos) { pos = 0; paused = false; } draw(); };
      const play = () => {
        if (!snd) { openDev('sound'); return; }
        if (src) { stop(true); paused = true; draw(); return; }
        if (pos >= len() - 0.05) pos = 0;
        paused = false;
        playFrom = pos; playStart = Snd.ensure().currentTime;
        src = Snd.play(snd.data, snd.rate, { offset: pos, onended: () => { if (src) { src = null; clearInterval(timer); pos = 0; draw(); } } });
        timer = setInterval(() => { pos = Math.min(len(), playFrom + Snd.ctx.currentTime - playStart); draw(); }, 200);
        draw();
      };
      const open = p => {
        const s = loadSound(p);
        if (!s) { msgBox('The file is not a valid MIDI or wave file.', 'Media Player', { icon: 'exclaim', owner: w }); return; }
        stop(); snd = s; path = p; pos = 0; draw();
      };
      const openDev = async dev => {
        device = dev;
        const p = await fileDialog({ owner: w, title: 'Open', filters: dev === 'midi' ? [['MIDI Sequencer (*.MID;*.RMI)', '*.MID;*.RMI']] : [['Sound (*.WAV)', '*.WAV']] });
        if (p) open(p);
      };
      track.addEventListener('pointerdown', e => {
        if (!snd) return;
        const r = track.getBoundingClientRect();
        const f = clamp(((e.clientX - r.left) / Sys.scale - 6) / (track.clientWidth - 22), 0, 1);
        const was = !!src; stop(true); pos = f * len(); if (was) play(); else draw();
      });
      const w = new Win({
        title: 'Media Player', icon: 'mplayer', w: 400, h: 140, minH: 120, maxBox: false,
        onClosed: () => stop(),
        onResize: () => draw(),
        menu: [
          { label: '&File', items: [{ label: '&Open...', action: () => openDev(device || 'sound') }, { label: '&Close', disabled: () => !snd, action: () => { stop(); snd = null; draw(); } }, '-', { label: 'E&xit', action: () => w.close() }] },
          { label: '&Device', items: [
            { label: '&Sound...', checked: () => device === 'sound', action: () => openDev('sound') },
            { label: '&MIDI Sequencer...', checked: () => device === 'midi', action: () => openDev('midi') },
            { label: '&CD Audio', action: () => msgBox('The CD audio device is not ready.\n\nMake sure there is a compact disc in the drive.', 'Media Player', { icon: 'exclaim', owner: w }) }, '-',
            { label: 'C&onfigure...', disabled: true }] },
          { label: '&Scale', items: [{ label: '&Time', checked: true }, { label: 'T&racks', disabled: true }] },
          { label: '&Help', items: [{ label: '&Contents', action: () => Sys.launch('WINHELP.EXE mplayer') }, '-', { label: '&About Media Player...', action: () => aboutBox('Media Player', 'mplayer', w) }] }
        ]
      });
      w.body.style.background = 'var(--btn-face)';
      const bPlay = tbtn('play', play);
      w.body.append(track, UI.place(bPlay, 8, 46, 40, 26), UI.place(tbtn('stop', () => stop()), 52, 46, 40, 26), UI.place(tbtn('eject', () => { stop(); snd = null; draw(); }), 96, 46, 40, 26), status);
      if (opts.args) { device = FS.ext(opts.args.trim()) === 'MID' ? 'midi' : 'sound'; open(FS.full(opts.args.trim(), 'C:\\WINDOWS')); setTimeout(play, 300); }
      requestAnimationFrame(() => { w.sizeToClient(400, 80); draw(); });
      return w;
    }
  });
})();
