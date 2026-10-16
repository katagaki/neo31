'use strict';
/* Dialog controls, dialog builder, message boxes & common file dialogs. */

const UI = {
  nextId: 1,
  button(label, opts = {}) {
    const b = h('button', { class: 'btn' + (opts.default ? ' default' : ''), type: 'button' }, h('span', { class: 'bl', html: mnemonicHTML(label) }));
    const mk = mnemonicKey(label);
    if (mk) b.dataset.mn = mk;
    if (opts.default) b.dataset.default = '1';
    if (opts.cancel) b.dataset.cancel = '1';
    if (opts.onClick) b.addEventListener('click', opts.onClick);
    if (opts.disabled) b.disabled = true;
    return b;
  },

  label(text, forEl) {
    const l = h('div', { class: 'txt', html: mnemonicHTML(text) });
    if (forEl) (forEl.el || forEl).setAttribute('aria-label', stripAmp(text).replace(/:$/, ''));
    const mk = mnemonicKey(text);
    if (mk && forEl) { l.dataset.mn = mk; l._for = forEl; }
    return l;
  },

  text(value = '', opts = {}) {
    const i = h('input', { class: 'tx', type: opts.password ? 'password' : 'text', spellcheck: false, autocomplete: 'off' });
    i.value = value;
    if (opts.maxLength) i.maxLength = opts.maxLength;
    if (opts.onInput) i.addEventListener('input', opts.onInput);
    return i;
  },

  check(label, checked, onChange) {
    const i = h('input', { type: 'checkbox', class: 'chk' });
    i.checked = !!checked;
    if (onChange) i.addEventListener('change', () => onChange(i.checked));
    const l = h('label', { class: 'lbl-ctl' }, i, h('span', { html: mnemonicHTML(label) }));
    const mk = mnemonicKey(label);
    if (mk) l.dataset.mn = mk;
    l.input = i;
    return l;
  },

  radio(name, label, checked, onChange) {
    const i = h('input', { type: 'radio', class: 'rad', name });
    i.checked = !!checked;
    if (onChange) i.addEventListener('change', () => i.checked && onChange());
    const l = h('label', { class: 'lbl-ctl' }, i, h('span', { html: mnemonicHTML(label) }));
    const mk = mnemonicKey(label);
    if (mk) l.dataset.mn = mk;
    l.input = i;
    return l;
  },

  group(label) {
    return h('fieldset', { class: 'grp' }, h('legend', { html: mnemonicHTML(label) }));
  },

  /* list box. items: array of strings or {text, icon, value, indent, disabled} */
  listbox(opts = {}) {
    const el = h('div', { class: 'lb', tabindex: '0', role: 'listbox', 'aria-label': opts.label || 'Items', 'aria-multiselectable': String(!!opts.multi) });
    const lb = {
      el, items: [], sel: -1, multi: !!opts.multi, selected: new Set(),
      setItems(items, sel = -1) {
        this.items = items.map(it => typeof it === 'object' ? it : { text: String(it) });
        el.innerHTML = ''; el.removeAttribute('aria-activedescendant');
        this.rows = this.items.map((it, i) => {
          const r = h('div', { class: 'it' + (it.disabled ? ' dis' : ''), role: 'option', id: 'option-' + UI.nextId++, 'aria-selected': 'false', 'aria-disabled': String(!!it.disabled) });
          if (it.indent) r.style.paddingLeft = (3 + it.indent * 8) + 'px';
          if (it.icon) r.appendChild(iconImg(it.icon, 16));
          if (it.html) r.appendChild(h('span', { html: it.html })); else r.appendChild(h('span', { text: it.text }));
          if (it.style) Object.assign(r.style, it.style);
          r.addEventListener('pointerdown', e => {
            el.focus();
            if (this.multi && (e.ctrlKey || e.metaKey)) this.toggle(i);
            else this.select(i, true);
          });
          r.addEventListener('dblclick', () => !it.disabled && opts.onActivate && opts.onActivate(this.items[i], i));
          el.appendChild(r);
          return r;
        });
        this.sel = -1; this.selected.clear();
        if (sel >= 0) this.select(sel, false);
      },
      select(i, notify = true) {
        if (i < 0 || i >= this.items.length || this.items[i].disabled) return;
        if (!this.multi || true) { this.selected.clear(); this.rows.forEach(r => { r.classList.remove('sel', 'cur'); r.setAttribute('aria-selected', 'false'); }); }
        this.sel = i; this.selected.add(i);
        this.rows[i].classList.add('sel', 'cur');
        this.rows[i].setAttribute('aria-selected', 'true'); el.setAttribute('aria-activedescendant', this.rows[i].id);
        const r = this.rows[i];
        if (r.offsetTop < el.scrollTop) el.scrollTop = r.offsetTop;
        else if (r.offsetTop + r.offsetHeight > el.scrollTop + el.clientHeight) el.scrollTop = r.offsetTop + r.offsetHeight - el.clientHeight;
        if (notify && opts.onSelect) opts.onSelect(this.items[i], i);
      },
      toggle(i) {
        if (!this.items[i] || this.items[i].disabled) return;
        if (this.selected.has(i)) { this.selected.delete(i); this.rows[i].classList.remove('sel'); }
        else { this.selected.add(i); this.rows[i].classList.add('sel'); }
        this.rows[i].setAttribute('aria-selected', String(this.selected.has(i)));
        el.setAttribute('aria-activedescendant', this.rows[i].id);
        this.sel = i;
        if (opts.onSelect) opts.onSelect(this.items[i], i);
      },
      get value() { return this.sel >= 0 ? this.items[this.sel] : null; },
      selectText(t) {
        const i = this.items.findIndex(it => it.text.toLowerCase() === String(t).toLowerCase());
        if (i >= 0) this.select(i, false);
        return i;
      }
    };
    el.addEventListener('keydown', e => {
      const n = lb.items.length;
      if (!n) return;
      const page = Math.max(1, Math.floor(el.clientHeight / 16) - 1);
      let i = lb.sel;
      if (e.key === 'ArrowDown') i = Math.min(n - 1, i + 1);
      else if (e.key === 'ArrowUp') i = Math.max(0, i - 1);
      else if (e.key === 'Home') i = 0;
      else if (e.key === 'End') i = n - 1;
      else if (e.key === 'PageDown') i = Math.min(n - 1, i + page);
      else if (e.key === 'PageUp') i = Math.max(0, i - page);
      else if (e.key === 'Enter' && opts.onActivate && lb.sel >= 0 && !lb.items[lb.sel].disabled) { e.preventDefault(); e.stopPropagation(); opts.onActivate(lb.items[lb.sel], lb.sel); return; }
      else if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
        const c = e.key.toLowerCase();
        for (let k = 1; k <= n; k++) {
          const j = (Math.max(0, i) + k) % n;
          if ((lb.items[j].text || '').replace(/^[\[\s-]+/, '').toLowerCase().startsWith(c)) { i = j; break; }
        }
      } else return;
      e.preventDefault(); e.stopPropagation();
      lb.select(i, true);
    });
    if (opts.items) lb.setItems(opts.items, opts.sel ?? -1);
    return lb;
  },

  /* drop-down combo box */
  combo(opts = {}) {
    const el = h('div', { class: 'cb', tabindex: '0', role: 'combobox', 'aria-label': opts.label || 'Selection', 'aria-haspopup': 'listbox', 'aria-expanded': 'false' });
    const v = h('div', { class: 'cbv' }, h('span', { id: 'combo-value-' + UI.nextId++ }));
    el.setAttribute('aria-describedby', v.firstChild.id);
    const b = h('div', { class: 'cbb' });
    el.append(v, b);
    const cb = {
      el, items: [], index: -1,
      setItems(items, index = 0) { this.items = items.map(it => typeof it === 'object' ? it : { text: String(it) }); this.set(index, false); },
      set(i, notify = true) {
        if (i < 0 || i >= this.items.length) { this.index = -1; v.firstChild.textContent = ''; return; }
        this.index = i;
        v.firstChild.textContent = this.items[i].text;
        if (notify && opts.onChange) opts.onChange(this.items[i], i);
      },
      setText(t) { const i = this.items.findIndex(it => it.text === t); this.set(i >= 0 ? i : 0, false); },
      get value() { return this.items[this.index]; },
      open() {
        if (cb.drop) return cb.close();
        const r = Sys.rectOf(el);
        const lb = UI.listbox({
          items: this.items, sel: this.index,
          onActivate: (_, i) => { cb.close(); cb.set(i); el.focus(); }
        });
        lb.el.classList.add('cb-drop');
        Object.assign(lb.el.style, { left: r.x + 'px', top: (r.y + r.h - 1) + 'px', width: r.w + 'px', height: Math.min(150, this.items.length * 16 + 2) + 'px' });
        lb.rows.forEach((row, i) => row.addEventListener('pointerup', () => { cb.close(); cb.set(i); el.focus(); }));
        const ov = h('div', { id: 'cbov', style: { position: 'absolute', inset: 0, zIndex: 349998 } });   // just below the menu layer that holds the list
        ov.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); cb.close(); });
        Sys.screen.append(ov);
        Menu.layer.appendChild(lb.el);
        lb.el.style.zIndex = 100003;
        cb.drop = { lb, ov };
        lb.el.id = 'combo-list-' + UI.nextId++; el.setAttribute('aria-controls', lb.el.id); el.setAttribute('aria-expanded', 'true');
        const r2 = Sys.rectOf(lb.el);
        if (r2.y + r2.h > Sys.screen.clientHeight) lb.el.style.top = (r.y - r2.h + 1) + 'px';
        lb.el.focus();
        lb.el.addEventListener('keydown', e => { if (e.key === 'Escape' || (e.key === 'ArrowUp' && e.altKey)) { e.stopPropagation(); cb.close(); el.focus(); } });
      },
      close() { el.setAttribute('aria-expanded', 'false'); el.removeAttribute('aria-controls'); if (cb.drop) { cb.drop.lb.el.remove(); cb.drop.ov.remove(); cb.drop = null; } }
    };
    el.addEventListener('pointerdown', e => { e.preventDefault(); el.focus(); cb.open(); });
    el.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' && e.altKey || e.key === 'F4') { e.preventDefault(); cb.open(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); cb.set(Math.min(cb.items.length - 1, cb.index + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); cb.set(Math.max(0, cb.index - 1)); }
      else if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
        const c = e.key.toLowerCase();
        const n = cb.items.length;
        for (let k = 1; k <= n; k++) { const j = (cb.index + k) % n; if (cb.items[j].text.toLowerCase().startsWith(c)) { cb.set(j); break; } }
      }
    });
    if (opts.items) cb.setItems(opts.items, opts.index ?? 0);
    return cb;
  },

  /* Scroll-bar style slider */
  slider(opts = {}) {
    const min = opts.min ?? 0, max = opts.max ?? 100;
    let value = opts.value ?? min;
    const th = h('div', { class: 'th' });
    const tr = h('div', { class: 'tr' }, th);
    const l = h('div', { class: 'ar l' }), r = h('div', { class: 'ar r' });
    const el = h('div', { class: 'slider', tabindex: '0', role: 'slider', 'aria-label': opts.label || 'Value', 'aria-valuemin': min, 'aria-valuemax': max, 'aria-valuenow': value }, l, tr, r);
    const s = {
      el,
      get value() { return value; },
      set(v, notify = true) {
        value = clamp(Math.round(v), min, max);
        el.setAttribute('aria-valuenow', value);
        const w = tr.clientWidth || (parseInt(el.style.width) - 34) || 100;
        th.style.left = ((value - min) / (max - min || 1)) * Math.max(0, w - 16) + 'px';
        if (notify && opts.onChange) opts.onChange(value);
      }
    };
    const step = opts.step || Math.max(1, Math.round((max - min) / 20));
    l.addEventListener('pointerdown', e => { e.preventDefault(); s.set(value - step); });
    r.addEventListener('pointerdown', e => { e.preventDefault(); s.set(value + step); });
    tr.addEventListener('pointerdown', e => {
      e.preventDefault(); el.focus();
      const rr = tr.getBoundingClientRect();
      const toVal = cx => min + clamp((cx - rr.left) / Sys.scale - 8, 0, tr.clientWidth - 16) / Math.max(1, tr.clientWidth - 16) * (max - min);
      if (e.target === th) {
        tr.setPointerCapture(e.pointerId);
        const mv = ev => s.set(toVal(ev.clientX));
        const up = () => { tr.removeEventListener('pointermove', mv); tr.removeEventListener('pointerup', up); };
        tr.addEventListener('pointermove', mv); tr.addEventListener('pointerup', up);
      } else s.set(value + (toVal(e.clientX) > value ? step * 3 : -step * 3));
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); s.set(value - step); }
      if (e.key === 'Home') { e.preventDefault(); s.set(min); }
      if (e.key === 'End') { e.preventDefault(); s.set(max); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); s.set(value + step); }
    });
    requestAnimationFrame(() => s.set(value, false));
    return s;
  },

  place(el, x, y, w, hh) {
    const t = el.el || el;
    t.style.position = 'absolute';
    t.style.left = x + 'px'; t.style.top = y + 'px';
    if (w != null) t.style.width = w + 'px';
    if (hh != null) t.style.height = hh + 'px';
    return el;
  }
};

/* ======================= DIALOG BUILDER ======================= */
const DLU_X = 1.2;
/* Creates a modal dialog. build(d) adds controls via d.add(ctrl, x, y, w, h).
   Resolves with whatever is passed to d.close(). */
function dialog(opts) {
  let resolve;
  const promise = new Promise(r => resolve = r);
  const owner = opts.owner && !opts.owner.closed ? opts.owner : null;
  const win = new Win({
    title: opts.title, dialog: true, resizable: false, w: 200, h: 100, wm: Sys.desktop,
    owner, modal: opts.modal !== false && !!owner, center: true,
    onClose: () => { if (!d.done) { d.done = true; resolve(opts.cancelValue ?? null); } if (opts.onClose) opts.onClose(); },
    onKey: (e, name) => {
      if (opts.onKey && opts.onKey(e, name)) return true;
      const t = e.target;
      if (e.key === 'Enter' && !(t && t.nodeName === 'TEXTAREA') && !(t && t.classList && t.classList.contains('lb') && t._activate)) {
        if (t && t.nodeName === 'BUTTON') { t.click(); return true; }
        const def = win.body.querySelector('button[data-default]:not(:disabled)');
        if (def) { def.click(); return true; }
      }
      if (e.key === 'Escape') {
        const c = win.body.querySelector('button[data-cancel]');
        if (c) c.click(); else d.close(opts.cancelValue ?? null);
        return true;
      }
      if (e.altKey && e.key.length === 1 || (!isEditable(t) && e.key.length === 1 && /[a-z0-9]/i.test(e.key) && !e.ctrlKey && t?.nodeName !== 'DIV')) {
        const k = (e.code && /^(Key[A-Z]|Digit\d)$/.test(e.code)) ? e.code.slice(-1).toLowerCase() : e.key.toLowerCase();
        const target = win.body.querySelector(`[data-mn="${CSS.escape(k)}"]`);
        if (target) {
          if (target.nodeName === 'BUTTON') { if (!target.disabled) target.click(); }
          else if (target.input) { target.input.focus(); if (target.input.type === 'checkbox') { target.input.click(); } else if (target.input.type === 'radio') target.input.click(); }
          else if (target._for) { const f = target._for.el || target._for; f.focus(); if (f.select) f.select(); }
          return true;
        }
      }
      return false;
    }
  });
  win.el.addEventListener('keydown', e => {
    if (e.key !== 'Tab' || Menu.isOpen()) return;
    const controls = [...win.body.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(el => el.getClientRects().length);
    if (!controls.length) { e.preventDefault(); win.el.focus(); return; }
    const index = controls.indexOf(document.activeElement);
    if (index < 0 || (e.shiftKey && index === 0) || (!e.shiftKey && index === controls.length - 1)) { e.preventDefault(); e.stopPropagation(); controls[e.shiftKey ? controls.length - 1 : 0].focus(); }
  });
  win.body.classList.add('dlgc');
  const d = {
    win, body: win.body, promise, done: false,
    /* Layout coordinates are in "dialog units": horizontal values are scaled
       by the System font's average character width, as Windows does. */
    k: opts.dlu ?? DLU_X,
    add(ctrl, x, y, w, hh) { const k = d.k; UI.place(ctrl, Math.round(x * k), y, w == null ? w : Math.round(w * k), hh); win.body.appendChild(ctrl.el || ctrl); return ctrl; },
    resize(w, hh) { win.sizeToClient(Math.round(w * d.k), hh); },
    close(v) {
      if (d.done) return;
      d.done = true; resolve(v);
      win.close(true);
      if (opts.onClose) opts.onClose();
    }
  };
  win.sizeToClient(Math.round((opts.w || 300) * d.k), opts.h || 120);
  win.center(owner);
  if (opts.build) opts.build(d);
  const f = win.body.querySelector('[data-autofocus]') || win.body.querySelector('input:not([type=hidden]):not(:disabled),.lb,button[data-default]');
  if (f) setTimeout(() => { f.focus(); if (f.select) f.select(); }, 0);
  return d;
}

/* ======================= MESSAGE BOX ======================= */
function msgBox(text, title = 'Windows', opts = {}) {
  const sets = {
    ok: ['OK'], okcancel: ['OK', 'Cancel'], yesno: ['&Yes', '&No'], yesnocancel: ['&Yes', '&No', 'Cancel'],
    retrycancel: ['&Retry', 'Cancel'], abortretryignore: ['&Abort', '&Retry', '&Ignore']
  };
  const btns = sets[opts.buttons || 'ok'];
  const icons = { stop: 'mbStop', info: 'mbInfo', question: 'mbQuestion', exclaim: 'mbExclaim' };
  const sounds = { stop: 'SystemHand', info: 'SystemAsterisk', question: 'SystemQuestion', exclaim: 'SystemExclamation' };
  if (opts.icon) Snd.event(sounds[opts.icon]); else Snd.beep();
  let resolve;
  const p = new Promise(r => resolve = r);
  const owner = opts.owner && !opts.owner.closed ? opts.owner : (opts.owner === null ? null : Sys.activeTop());
  const win = new Win({
    title, dialog: true, resizable: false, owner, modal: !!owner, center: true, w: 200, h: 100,
    onClose: () => { if (!done) { done = true; resolve(btns.includes('Cancel') ? 'cancel' : btns.length === 1 ? 'ok' : stripAmp(btns[btns.length - 1]).toLowerCase()); } },
    onKey: (e) => {
      if (e.key === 'Escape' && (btns.includes('Cancel') || btns.length === 1)) { finish(btns.includes('Cancel') ? 'Cancel' : btns[0]); return true; }
      if (e.key === 'Enter') { const b = e.target.nodeName === 'BUTTON' ? e.target : win.body.querySelector('button'); b.click(); return true; }
      if (e.key.length === 1 || e.altKey) {
        const kk = (e.code && /^Key[A-Z]$/.test(e.code)) ? e.code.slice(3).toLowerCase() : e.key.toLowerCase();
        const bb = btns.find(b => mnemonicKey(b) === kk);
        if (bb) { finish(bb); return true; }
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const all = [...win.body.querySelectorAll('button')];
        const i = all.indexOf(document.activeElement);
        all[(i + (e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length].focus();
        return true;
      }
      return false;
    }
  });
  let done = false;
  const finish = b => { if (done) return; done = true; resolve(stripAmp(b).toLowerCase()); win.close(true); };
  const box = h('div', { class: 'mbox' },
    h('div', { class: 'row' }, opts.icon ? iconImg(icons[opts.icon]) : null, h('div', { class: 'msg', text })),
    h('div', { class: 'btns' }, btns.map((b, i) => UI.button(b, { default: i === (opts.defaultButton || 0), onClick: () => finish(b) }))));
  win.body.appendChild(box);
  win.body.style.position = 'relative';
  requestAnimationFrame(() => {
    win.sizeToClient(Math.max(box.scrollWidth, 200), box.scrollHeight);
    win.center(owner);
    win.body.querySelectorAll('button')[opts.defaultButton || 0].focus();
  });
  win.el.style.width = '420px';
  return p;
}

/* ======================= COMMON FILE DIALOG ======================= */
function fileDialog(opts = {}) {
  const save = opts.mode === 'save';
  const filters = opts.filters || [['All Files (*.*)', '*.*']];
  let dir = opts.dir && FS.isDir(opts.dir) ? FS.full(opts.dir) : (fileDialog.lastDir || 'C:\\WINDOWS');
  if (!FS.isDir(dir)) dir = 'C:\\';
  let pattern = filters[0][1];
  const toRe = pat => new RegExp('^' + pat.split(';').map(p => p.trim().replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.').replace(/^(.*)\\\.\.\*$/, '$1(\\..*)?')).join('|') + '$', 'i');

  return dialog({
    title: opts.title || (save ? 'Save As' : 'Open'), w: 410, h: 222, owner: opts.owner,
    build(d) {
      const name = UI.text(opts.name ? opts.name.toLowerCase() : pattern.toLowerCase());
      name.dataset.autofocus = '1';
      const files = UI.listbox({
        onSelect: it => { name.value = it.text; },
        onActivate: () => ok()
      });
      const dirLbl = h('div', { class: 'txt' });
      const dirs = UI.listbox({
        onActivate: it => { dir = it.path; refresh(); }
      });
      const types = UI.combo({ items: filters.map(f => f[0]), onChange: (_, i) => { pattern = filters[i][1]; name.value = pattern.toLowerCase(); refresh(); } });
      const drives = UI.combo({ items: [{ text: 'c: [ms-dos_6]', icon: 's_drive' }, { text: 'a:', icon: 's_floppy' }], onChange: (it, i) => {
        if (i === 1) {
          msgBox('Cannot read from drive A.', opts.title || 'Open', { icon: 'exclaim', owner: d.win, buttons: 'retrycancel' }).then(() => drives.set(0, false));
        }
      } });
      const refresh = () => {
        fileDialog.lastDir = dir;
        const re = toRe(pattern);
        const ls = FS.list(dir) || [];
        files.setItems(ls.filter(e => e.node.t === 'f' && re.test(e.name)).map(e => ({ text: e.name.toLowerCase() })));
        const r = FS.resolve(dir);
        const items = [{ text: 'c:\\', icon: 's_folderOpen', path: 'C:\\', indent: 0 }];
        r.parts.forEach((p, i) => items.push({ text: p.toLowerCase(), icon: 's_folderOpen', path: 'C:\\' + r.parts.slice(0, i + 1).join('\\'), indent: i + 1 }));
        const curIdx = items.length - 1;
        ls.filter(e => e.node.t === 'd').forEach(e => items.push({ text: e.name.toLowerCase(), icon: 's_folder', path: FS.join(dir, e.name), indent: r.parts.length + 1 }));
        dirs.setItems(items, curIdx);
        dirLbl.textContent = dir.toLowerCase();
      };
      const ok = async () => {
        let v = name.value.trim();
        if (!v) return;
        if (/[*?]/.test(v)) {
          const full = FS.full(v, dir);
          if (FS.isDir(FS.dirname(full))) dir = FS.dirname(full);
          pattern = FS.basename(full);
          refresh(); name.value = pattern.toLowerCase(); return;
        }
        const full = FS.full(v, dir);
        if (FS.isDir(full)) { dir = full; refresh(); name.value = pattern.toLowerCase(); return; }
        let target = full;
        if (!FS.ext(FS.basename(target)) && opts.defExt && !v.endsWith('.')) target += '.' + opts.defExt;
        if (!FS.isDir(FS.dirname(target))) {
          await msgBox(`${target.toLowerCase()}\nPath does not exist.\nPlease verify that the correct path was given.`, d.win.title, { icon: 'exclaim', owner: d.win });
          return;
        }
        if (!VFS.valid83(FS.basename(target))) {
          await msgBox(`${FS.basename(target).toLowerCase()}\nThe above file name is invalid.`, d.win.title, { icon: 'exclaim', owner: d.win });
          return;
        }
        const ex = FS.get(target);
        if (save) {
          if (ex && ex.t === 'f') {
            const r = await msgBox(`${target.toLowerCase()} already exists.\nDo you want to replace it?`, d.win.title, { icon: 'exclaim', buttons: 'yesno', owner: d.win });
            if (r !== 'yes') return;
          }
        } else if (!ex) {
          await msgBox(`${target.toLowerCase()}\nFile not found.\nPlease verify the correct filename was given.`, d.win.title, { icon: 'exclaim', owner: d.win });
          return;
        }
        fileDialog.lastDir = FS.dirname(target);
        d.close(target);
      };
      d.add(UI.label('File &Name:', name), 8, 6);
      d.add(name, 8, 22, 150);
      d.add(files, 8, 48, 150, 100);
      d.add(UI.label('&Directories:', dirs), 172, 6);
      d.add(dirLbl, 172, 24, 130);
      d.add(dirs, 172, 48, 130, 100);
      d.add(UI.label(save ? 'Save File as &Type:' : 'List Files of &Type:', types), 8, 158);
      d.add(types, 8, 174, 150);
      d.add(UI.label('Dri&ves:', drives), 172, 158);
      d.add(drives, 172, 174, 130);
      d.add(UI.button('OK', { default: true, onClick: ok }), 320, 6, 80, 26);
      d.add(UI.button('Cancel', { cancel: true, onClick: () => d.close(null) }), 320, 38, 80, 26);
      d.add(UI.button('&Help', { onClick: () => Sys.launch('WINHELP.EXE', { args: 'COMMDLG' }) }), 320, 80, 80, 26);
      if (!save) d.add(UI.check('&Read Only', false), 320, 120);
      refresh();
      if (opts.name) name.value = opts.name.toLowerCase();
    }
  }).promise;
}
