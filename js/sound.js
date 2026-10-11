'use strict';
/* Synthesised system sounds. Every "WAV" is generated as raw 22 kHz mono
   samples so the Sound Recorder can display, edit and replay them. */

const Snd = {
  rate: 22050,
  ctx: null,
  cache: {},

  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  /* additive tone into buffer */
  tone(buf, t0, dur, freq, amp, { harm = [1], attack = 0.005, decay = 3, vib = 0 } = {}) {
    const r = this.rate, s0 = Math.floor(t0 * r), n = Math.floor(dur * r);
    for (let i = 0; i < n && s0 + i < buf.length; i++) {
      const t = i / r;
      const env = Math.min(1, t / attack) * Math.exp(-decay * t);
      const f = freq * (1 + vib * Math.sin(2 * Math.PI * 5.5 * t));
      let v = 0;
      for (let k = 0; k < harm.length; k++) v += harm[k] * Math.sin(2 * Math.PI * f * (k + 1) * t);
      buf[s0 + i] += v * env * amp;
    }
  },

  noise(buf, t0, dur, amp, decay = 20) {
    const r = this.rate, s0 = Math.floor(t0 * r), n = Math.floor(dur * r);
    let lp = 0;
    for (let i = 0; i < n && s0 + i < buf.length; i++) {
      lp = lp * 0.7 + (Math.random() * 2 - 1) * 0.3;
      buf[s0 + i] += lp * amp * Math.exp(-decay * i / r);
    }
  },

  norm(buf, peak = 0.8) {
    let m = 0;
    for (const v of buf) m = Math.max(m, Math.abs(v));
    if (m > 0) for (let i = 0; i < buf.length; i++) buf[i] *= peak / m;
    return buf;
  },

  hz: n => 440 * Math.pow(2, (n - 69) / 12),

  gen: {
    TADA() {
      const S = Snd, b = new Float32Array(S.rate * 1.9);
      const brass = { harm: [1, .7, .5, .35, .25, .15, .1], attack: 0.03, decay: 1.6, vib: 0.004 };
      for (const n of [58, 62, 65, 70]) S.tone(b, 0, .2, S.hz(n), .2, { ...brass, decay: 8 });
      for (const n of [48, 60, 64, 67, 72, 76]) S.tone(b, .16, 1.7, S.hz(n), .2, brass);
      S.tone(b, .16, 1.2, S.hz(36), .5, { harm: [1, .3], decay: 4 });
      S.noise(b, .16, .4, .5, 12);
      return S.norm(b);
    },
    CHIMES() {
      const S = Snd, b = new Float32Array(S.rate * 2.2);
      const bell = { harm: [1, 0, .4, 0, .2, 0, .1], attack: 0.002, decay: 2.2 };
      [88, 84, 86, 79].forEach((n, i) => S.tone(b, i * 0.28, 1.4, S.hz(n), .3, bell));
      return S.norm(b);
    },
    DING() {
      const S = Snd, b = new Float32Array(S.rate * 0.7);
      S.tone(b, 0, .7, 1318, .5, { harm: [1, .2, .35, .05, .1], attack: .001, decay: 6 });
      S.tone(b, 0, .7, 1318 * 2.76, .08, { decay: 12 });
      return S.norm(b, .6);
    },
    CHORD() {
      const S = Snd, b = new Float32Array(S.rate * 0.9);
      for (const n of [72, 76, 79, 84]) S.tone(b, 0, .9, S.hz(n), .25, { harm: [1, .5, .25, .12], attack: .004, decay: 4.5 });
      return S.norm(b, .6);
    },
    CLICK() {
      const S = Snd, b = new Float32Array(S.rate * 0.03);
      S.noise(b, 0, .03, 1, 200);
      return S.norm(b, .3);
    }
  },

  samples(name) {
    name = name.replace(/\.WAV$/i, '').toUpperCase();
    if (!this.cache[name] && this.gen[name]) this.cache[name] = this.gen[name]();
    return this.cache[name] || null;
  },

  play(samples, rate = this.rate, opts = {}) {
    const ctx = this.ensure();
    if (!ctx || !samples || !samples.length) return null;
    const ab = ctx.createBuffer(1, samples.length, rate);
    ab.copyToChannel(samples instanceof Float32Array ? samples : Float32Array.from(samples), 0);
    const src = ctx.createBufferSource();
    src.buffer = ab;
    const g = ctx.createGain();
    g.gain.value = (opts.volume ?? 0.6) * (Store.get('muted', false) ? 0 : Store.get('volume', 80) / 100);
    src.connect(g).connect(ctx.destination);
    if (opts.onended) src.onended = opts.onended;
    src.start(0, opts.offset || 0);
    return src;
  },

  playFile(path) {
    const node = FS.get(path);
    if (!node) return null;
    if (node.g) return this.play(this.samples(node.g));
    if (node.x) {
      const smp = Snd.decode(node.x);
      return this.play(smp.data, smp.rate);
    }
    return null;
  },

  /* Sound events are mapped to WAV files in Control Panel > Sound. */
  events: {
    SystemAsterisk: 'Asterisk', SystemHand: 'Critical Stop', SystemDefault: 'Default Beep',
    SystemExclamation: 'Exclamation', SystemQuestion: 'Question', SystemExit: 'Windows Exit', SystemStart: 'Windows Start'
  },
  defaultMap: {
    SystemAsterisk: 'CHORD.WAV', SystemHand: 'CHORD.WAV', SystemDefault: 'DING.WAV',
    SystemExclamation: 'CHORD.WAV', SystemQuestion: 'CHORD.WAV', SystemExit: 'CHIMES.WAV', SystemStart: 'TADA.WAV'
  },
  event(ev) {
    if (!Store.get('sounds', true)) return;
    const map = Object.assign({}, this.defaultMap, Store.get('soundMap', {}));
    const f = map[ev];
    if (!f || f === '<none>') return;
    this.playFile('C:\\WINDOWS\\' + f);
  },
  beep() { this.event('SystemDefault'); },

  /* 8-bit PCM <-> base64 so recordings fit in localStorage */
  encode(data, rate) {
    let s = '';
    for (let i = 0; i < data.length; i++) s += String.fromCharCode(clamp(Math.round(data[i] * 127) + 128, 0, 255));
    return 'PCM8:' + rate + ':' + btoa(s);
  },
  decode(str) {
    const m = /^PCM8:(\d+):(.*)$/s.exec(str || '');
    if (!m) return { rate: this.rate, data: new Float32Array(0) };
    const bin = atob(m[2]), d = new Float32Array(bin.length);
    for (let i = 0; i < bin.length; i++) d[i] = (bin.charCodeAt(i) - 128) / 127;
    return { rate: +m[1], data: d };
  }
};
