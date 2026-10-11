'use strict';
/* Small DOM + misc helpers shared by every module. */

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtNum = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const pad = (n, w = 2, c = '0') => String(n).padStart(w, c);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* "&File" -> "<u>F</u>ile"; "&&" is a literal ampersand. */
function mnemonicHTML(label) {
  return esc(label).replace(/&amp;&amp;/g, '\u0001').replace(/&amp;(.)/, '<u>$1</u>').replace(/\u0001/g, '&amp;');
}
function mnemonicKey(label) {
  const m = /&([^&])/.exec(label.replace(/&&/g, ''));
  return m ? m[1].toLowerCase() : null;
}
const stripAmp = l => l.replace(/&&/g, '\u0001').replace(/&/g, '').replace(/\u0001/g, '&');

/* Normalise a KeyboardEvent to e.g. "Ctrl+Shift+S", "F3", "Alt+F4", "Del". */
function keyName(e) {
  let k = e.key;
  const map = { ' ': 'Space', Delete: 'Del', Insert: 'Ins', Escape: 'Esc', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right' };
  if (map[k]) k = map[k];
  else if (k.length === 1) k = k.toUpperCase();
  if (e.code && /^Key[A-Z]$/.test(e.code)) k = e.code.slice(3);
  if (e.code && /^Digit\d$/.test(e.code)) k = e.code.slice(5);
  const p = [];
  if (e.ctrlKey) p.push('Ctrl');
  if (e.altKey) p.push('Alt');
  if (e.shiftKey && k.length > 1) p.push('Shift');
  else if (e.shiftKey && /^[A-Z0-9]$/.test(k)) p.push('Shift');
  p.push(k);
  return p.join('+');
}

function isEditable(t) {
  if (!t) return false;
  if (t.isContentEditable) return true;
  const n = t.nodeName;
  if (n === 'TEXTAREA') return !t.readOnly;
  if (n === 'INPUT') return /^(text|password|number|search|)$/i.test(t.type) && !t.readOnly;
  return false;
}

/* International settings (Control Panel > International). Every date and
   time shown anywhere in the system is formatted through these. */
const Intl31 = {
  MONTHS: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  DAYS: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  COUNTRIES: {
    'United States': { iDate: 0, sDate: '/', iTime: 0, sTime: ':', iTLZero: 0, iDayLZero: 0, iCentury: 0, s1159: 'AM', s2359: 'PM', sList: ',', iMeasure: 1, sCurrency: '$', sThousand: ',', sDecimal: '.', iLongDate: 0, iCountry: 1 },
    'United Kingdom': { iDate: 1, sDate: '/', iTime: 1, sTime: ':', iTLZero: 1, iDayLZero: 1, iCentury: 0, s1159: '', s2359: '', sList: ',', iMeasure: 0, sCurrency: '£', sThousand: ',', sDecimal: '.', iLongDate: 1, iCountry: 44 },
    'Canada': { iDate: 1, sDate: '/', iTime: 1, sTime: ':', iTLZero: 1, iDayLZero: 1, iCentury: 0, s1159: '', s2359: '', sList: ',', iMeasure: 0, sCurrency: '$', sThousand: ',', sDecimal: '.', iLongDate: 1, iCountry: 2 },
    'Australia': { iDate: 1, sDate: '/', iTime: 0, sTime: ':', iTLZero: 0, iDayLZero: 1, iCentury: 0, s1159: 'AM', s2359: 'PM', sList: ',', iMeasure: 0, sCurrency: '$', sThousand: ',', sDecimal: '.', iLongDate: 1, iCountry: 61 },
    'Germany': { iDate: 1, sDate: '.', iTime: 1, sTime: ':', iTLZero: 1, iDayLZero: 1, iCentury: 0, s1159: '', s2359: '', sList: ';', iMeasure: 0, sCurrency: 'DM', sThousand: '.', sDecimal: ',', iLongDate: 1, iCountry: 49 },
    'France': { iDate: 1, sDate: '/', iTime: 1, sTime: ':', iTLZero: 1, iDayLZero: 1, iCentury: 0, s1159: '', s2359: '', sList: ';', iMeasure: 0, sCurrency: 'F', sThousand: ' ', sDecimal: ',', iLongDate: 1, iCountry: 33 },
    'Japan': { iDate: 2, sDate: '/', iTime: 1, sTime: ':', iTLZero: 1, iDayLZero: 1, iCentury: 0, s1159: '', s2359: '', sList: ',', iMeasure: 0, sCurrency: '¥', sThousand: ',', sDecimal: '.', iLongDate: 2, iCountry: 81 }
  },
  get() { return Object.assign({ country: 'United States' }, this.COUNTRIES['United States'], Store.get('intl', {})); },
  date(d, o = this.get()) {
    const z = (n, on) => on ? pad(n) : String(n);
    const m = z(d.getMonth() + 1, o.iDayLZero), dd = z(d.getDate(), o.iDayLZero);
    const y = o.iCentury ? String(d.getFullYear()) : pad(d.getFullYear() % 100);
    const parts = o.iDate === 1 ? [dd, m, y] : o.iDate === 2 ? [y, m, dd] : [m, dd, y];
    return parts.join(o.sDate);
  },
  longDate(d, o = this.get()) {
    const D = this.DAYS[d.getDay()], M = this.MONTHS[d.getMonth()], n = d.getDate(), y = d.getFullYear();
    return o.iLongDate === 1 ? `${D}, ${n} ${M} ${y}` : o.iLongDate === 2 ? `${y}/${M}/${n}, ${D}` : `${D}, ${M} ${pad(n)}, ${y}`;
  },
  time(d, secs = false, o = this.get()) {
    let hh = d.getHours();
    const s = o.sTime, mm = pad(d.getMinutes()) + (secs ? s + pad(d.getSeconds()) : '');
    if (o.iTime === 1) return `${o.iTLZero ? pad(hh) : hh}${s}${mm}${o.s2359 && o.s2359.trim() ? ' ' + o.s2359 : ''}`;
    const ap = hh >= 12 ? o.s2359 : o.s1159;
    hh = hh % 12 || 12;
    return `${o.iTLZero ? pad(hh) : hh}${s}${mm}${ap ? ' ' + ap : ''}`;
  },
  /* parse a short date typed by the user, honouring the date order */
  parseDate(t, o = this.get()) {
    const p = String(t).trim().split(/[^0-9]+/).filter(Boolean).map(Number);
    if (p.length !== 3) return null;
    let [m, d, y] = o.iDate === 1 ? [p[1], p[0], p[2]] : o.iDate === 2 ? [p[1], p[2], p[0]] : p;
    if (y < 100) y += y < 80 ? 2000 : 1900;
    const r = new Date(y, m - 1, d);
    return r.getMonth() === m - 1 && r.getDate() === d ? r : null;
  },
  number(n, o = this.get()) {
    const [i, f] = String(n).split('.');
    return i.replace(/\B(?=(\d{3})+(?!\d))/g, o.sThousand) + (f ? o.sDecimal + f : '');
  }
};
function dateStr(d = Sys.now()) { return Intl31.date(d); }
function timeStr(d = Sys.now(), secs = false) { return Intl31.time(d, secs); }

/* Simple pub/sub mixin. */
class Emitter {
  constructor() { this._ev = {}; }
  on(n, f) { (this._ev[n] ||= []).push(f); return () => this.off(n, f); }
  off(n, f) { this._ev[n] = (this._ev[n] || []).filter(x => x !== f); }
  emit(n, ...a) { for (const f of (this._ev[n] || []).slice()) f(...a); }
}

/* Persisted settings blob. */
const Store = {
  key: 'neo31.v1',
  data: null,
  load() {
    try { this.data = JSON.parse(localStorage.getItem(this.key + '.cfg')) || {}; }
    catch { this.data = {}; }
    return this.data;
  },
  get(k, d) { return k in this.data ? this.data[k] : d; },
  set(k, v) { this.data[k] = v; this.save(); },
  save() {
    clearTimeout(this._t);
    this._t = setTimeout(() => {
      try { localStorage.setItem(this.key + '.cfg', JSON.stringify(this.data)); } catch (e) { console.warn('Settings save failed', e); }
    }, 200);
  },
  flush() {
    clearTimeout(this._t);
    try { localStorage.setItem(this.key + '.cfg', JSON.stringify(this.data)); } catch (e) { console.warn('Settings save failed', e); }
  },
  wipe() {
    this.wiped = true;
    localStorage.removeItem(this.key + '.cfg');
    localStorage.removeItem(this.key + '.fs');
  }
};
Store.load();
window.addEventListener('pagehide', () => { if (!Store.wiped) Store.flush(); });
