'use strict';
/* Window manager: top-level & MDI windows, menus, minimised icons. */

/* ======================= MENUS ======================= */
const Menu = {
  layer: null,
  overlay: null,
  stack: [],
  bar: null,
  barIdx: -1,
  barMode: false,
  opts: {},

  isOpen() { return this.stack.length > 0 || this.barMode; },
  val(v, ...a) { return typeof v === 'function' ? v(...a) : v; },

  ensureOverlay() {
    if (this.overlay) return;
    const ov = h('div', { id: 'overlay' });
    ov.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      const hit = this.barItemAt(e);
      if (hit != null) {
        if (hit === this.barIdx && this.stack.length) this.closeAll();
        else this.openBar(this.bar, hit);
        return;
      }
      if (this.opts.anchorEl && document.elementsFromPoint(e.clientX, e.clientY).includes(this.opts.anchorEl)) {
        const f = this.opts.onAnchorClick; this.closeAll(); if (f) f(); return;
      }
      this.closeAll();
    });
    ov.addEventListener('pointermove', e => {
      const hit = this.barItemAt(e);
      if (hit != null && hit !== this.barIdx && this.stack.length) this.openBar(this.bar, hit);
    });
    ov.addEventListener('contextmenu', e => e.preventDefault());
    this.overlay = ov;
    Sys.screen.appendChild(ov);
  },

  barItemAt(e) {
    if (!this.bar) return null;
    for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
      if (el.classList.contains('mb-item') && el.parentNode === this.bar.el) return +el.dataset.i;
    }
    return null;
  },

  /* context / system menus */
  show(items, x, y, opts = {}) {
    this.closeAll(true);
    this.returnFocus = document.activeElement;
    this.opts = opts;
    this.ensureOverlay();
    this.push(items, x, y, opts.anchorH || 0);
    if (opts.keyboard) this.setHot(0, this.firstSel(this.stack[0]));
    Snd.ensure();
  },

  openBar(bar, idx, viaKey = false) {
    if (!this.isOpen()) this.returnFocus = document.activeElement;
    const items = bar.defs[idx] && this.val(bar.defs[idx].items, bar.win);
    this.closePopups();
    this.bar && this.bar.highlight(-1);
    this.bar = bar; this.barIdx = idx; this.barMode = false;
    this.opts = { ctx: bar.win };
    this.ensureOverlay();
    bar.highlight(idx);
    if (!items || !items.length) { this.barMode = true; return; }
    const r = Sys.rectOf(bar.items[idx]);
    this.push(items, r.x, r.y + r.h, r.h, r.y);
    if (viaKey) this.setHot(0, this.firstSel(this.stack[0]));
  },

  enterBarMode(bar) {
    this.closeAll(true);
    this.bar = bar; this.barIdx = 0; this.barMode = true; this.opts = { ctx: bar.win };
    bar.highlight(0);
  },

  firstSel(p) { return p.items.findIndex(it => it !== '-'); },

  push(items, x, y, anchorH = 0, anchorTop = null) {
    const level = this.stack.length;
    const el = h('div', { class: 'popup', role: 'menu', tabindex: '-1', 'aria-label': 'Commands' });
    const p = { el, items, hot: -1, level };
    items.forEach((it, i) => {
      if (it === '-') { el.appendChild(h('div', { class: 'sep', role: 'separator' })); return; }
      const dis = this.val(it.disabled, this.opts.ctx);
      const chk = this.val(it.checked, this.opts.ctx);
      const lab = this.val(it.label, this.opts.ctx);
      const row = h('div', { class: 'mi' + (dis ? ' dis' : ''), role: it.checked != null ? 'menuitemcheckbox' : 'menuitem', 'aria-label': stripAmp(lab), 'aria-disabled': String(!!dis), 'aria-checked': it.checked != null ? String(!!chk) : null, 'aria-haspopup': it.items ? 'menu' : null, id: 'menu-item-' + UI.nextId++, tabindex: '-1' },
        h('span', { class: 'chk' + (chk ? ' on' : '') }),
        h('span', { class: 'lab', html: mnemonicHTML(lab) }),
        it.items ? h('span', { class: 'sub', text: '▸' }) : h('span', { class: 'acc', text: it.key ? it.keyLabel || it.key : '' }));
      row.addEventListener('pointerenter', () => this.setHot(level, i, true));
      row.addEventListener('pointerup', e => { if (e.button === 0) this.choose(level, i); });
      row.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); if (it.items) this.choose(level, i); });
      p['row' + i] = row;
      el.appendChild(row);
    });
    this.layer.appendChild(el);
    const W = Sys.screen.clientWidth, H = Sys.screen.clientHeight;
    const w = el.offsetWidth, hh = el.offsetHeight;
    if (x + w > W - 2) x = Math.max(0, W - w - 2);
    if (y + hh > H - 2) y = Math.max(0, (anchorTop != null ? anchorTop : y - anchorH) - hh);
    el.style.left = x + 'px'; el.style.top = y + 'px';
    this.stack.push(p);
    return p;
  },

  setHot(level, i, fromMouse = false) {
    while (this.stack.length > level + 1) this.stack.pop().el.remove();
    const p = this.stack[level];
    if (!p) return;
    if (p.hot >= 0 && p['row' + p.hot]) p['row' + p.hot].classList.remove('hot');
    p.hot = i;
    const row = p['row' + i];
    if (row) { row.classList.add('hot'); p.el.setAttribute('aria-activedescendant', row.id); if (!fromMouse) p.el.focus({ preventScroll: true }); }
    const it = p.items[i];
    if (fromMouse && it && it.items && !this.val(it.disabled, this.opts.ctx)) this.openSub(level, i);
  },

  openSub(level, i) {
    const p = this.stack[level], it = p.items[i];
    const r = Sys.rectOf(p['row' + i]);
    this.push(this.val(it.items, this.opts.ctx), r.x + r.w - 4, r.y - 1, -r.h);
  },

  choose(level, i) {
    const p = this.stack[level];
    if (!p) return;
    const it = p.items[i];
    if (!it || it === '-' || this.val(it.disabled, this.opts.ctx)) return;
    if (it.items) {
      if (this.stack.length === level + 1) this.openSub(level, i);
      this.setHot(level + 1, this.firstSel(this.stack[level + 1]));
      return;
    }
    const ctx = this.opts.ctx;
    this.closeAll();
    if (it.action) setTimeout(() => it.action(ctx), 0);
  },

  closePopups() {
    while (this.stack.length) this.stack.pop().el.remove();
  },

  closeAll(silent) {
    this.closePopups();
    if (this.bar) this.bar.highlight(-1);
    this.bar = null; this.barIdx = -1; this.barMode = false;
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
    const oc = this.opts && this.opts.onClose;
    this.opts = {};
    if (!silent) {
      if (this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
      else Sys.activeTop()?.focus();
    }
    if (oc && !silent) oc();
  },

  key(e) {
    if (!this.isOpen()) return false;
    const k = e.key;
    if (k === 'Tab') { this.closeAll(); return false; }
    if (k === 'Alt' || k === 'Meta') { if (e.type === 'keydown') this.closeAll(); return true; }
    const p = this.stack[this.stack.length - 1];
    if (this.barMode && !p) {
      const n = this.bar.defs.length;
      if (k === 'ArrowLeft') { this.barIdx = (this.barIdx + n - 1) % n; this.bar.highlight(this.barIdx); }
      else if (k === 'ArrowRight') { this.barIdx = (this.barIdx + 1) % n; this.bar.highlight(this.barIdx); }
      else if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter') this.openBar(this.bar, this.barIdx, true);
      else if (k === 'Escape') this.closeAll();
      else if (k.length === 1) {
        const i = this.bar.defs.findIndex(d => mnemonicKey(d.label) === k.toLowerCase());
        if (i >= 0) this.openBar(this.bar, i, true);
      }
      return true;
    }
    if (!p) return false;
    const n = p.items.length;
    const step = d => {
      let i = p.hot;
      for (let c = 0; c < n; c++) {
        i = (i + d + n) % n;
        if (p.items[i] !== '-') break;
      }
      this.setHot(p.level, i);
    };
    if (k === 'ArrowDown') step(1);
    else if (k === 'ArrowUp') step(-1);
    else if (k === 'ArrowRight') {
      const it = p.items[p.hot];
      if (it && it.items) this.choose(p.level, p.hot);
      else if (this.bar) this.openBar(this.bar, (this.barIdx + 1) % this.bar.defs.length, true);
    } else if (k === 'ArrowLeft') {
      if (p.level > 0) { this.stack.pop().el.remove(); this.stack[this.stack.length - 1].el.focus({ preventScroll: true }); }
      else if (this.bar) this.openBar(this.bar, (this.barIdx + this.bar.defs.length - 1) % this.bar.defs.length, true);
    } else if (k === 'Enter') { if (p.hot >= 0) this.choose(p.level, p.hot); }
    else if (k === 'Escape') {
      if (p.level > 0) { this.stack.pop().el.remove(); this.stack[this.stack.length - 1].el.focus({ preventScroll: true }); }
      else if (this.bar) { const b = this.bar, i = this.barIdx; this.closePopups(); this.bar = b; this.barIdx = i; this.barMode = true; b.highlight(i); b.items[i].focus({ preventScroll: true }); }
      else this.closeAll();
    } else if (k.length === 1) {
      const code = e.code && /^(Key[A-Z]|Digit\d)$/.test(e.code) ? e.code.slice(-1).toLowerCase() : k.toLowerCase();
      const matches = p.items.map((it, i) => it !== '-' && mnemonicKey(this.val(it.label, this.opts.ctx)) === code ? i : -1).filter(i => i >= 0);
      if (matches.length === 1) { this.setHot(p.level, matches[0]); this.choose(p.level, matches[0]); }
      else if (matches.length > 1) this.setHot(p.level, matches.find(i => i > p.hot) ?? matches[0]);
    }
    return true;
  }
};

class MenuBar {
  constructor(win, defs, el) {
    el.setAttribute('role', 'menubar'); el.setAttribute('aria-label', 'Application menu');
    this.win = win; this.el = el; this.defs = defs; this.items = [];
    this.render();
  }
  render() {
    this.el.querySelectorAll('.mb-item').forEach(n => n.remove());
    const anchor = this.el.querySelector('.mdi-restore');
    this.items = this.defs.map((d, i) => {
      const it = h('div', { class: 'mb-item', role: 'menuitem', tabindex: '0', 'aria-haspopup': 'menu', 'aria-label': stripAmp(d.label), 'data-i': i, html: mnemonicHTML(d.label) });
      it.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        e.preventDefault();
        this.win.activate();
        Menu.openBar(this, i);
      });
      it.addEventListener('keydown', e => {
        if (['Enter', ' ', 'ArrowDown'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); Menu.openBar(this, i, true); }
        else if (['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); this.items[(i + (e.key === 'ArrowRight' ? 1 : this.items.length - 1)) % this.items.length].focus(); }
      });
      this.el.insertBefore(it, anchor);
      return it;
    });
  }
  highlight(i) { this.items.forEach((it, j) => { it.classList.toggle('open', i === j); it.setAttribute('aria-expanded', String(i === j)); }); }
  /* collect accelerators */
  accel(name) {
    const walk = items => {
      for (const it of items || []) {
        if (it === '-') continue;
        if (it.key && it.key.split('|').includes(name)) return it;
        if (it.items && typeof it.items !== 'function') { const r = walk(it.items); if (r) return r; }
      }
      return null;
    };
    for (const d of this.defs) {
      const r = walk(typeof d.items === 'function' ? d.items(this.win) : d.items);
      if (r) return r;
    }
    return null;
  }
}

/* ======================= XOR TRACKING RECT ======================= */
function xorRect(parent) {
  const el = h('div', { class: 'xor' }, h('div', { class: 't' }), h('div', { class: 'b' }), h('div', { class: 'l' }), h('div', { class: 'r' }));
  parent.appendChild(el);
  return {
    set(x, y, w, hh) { Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px' }); },
    remove() { el.remove(); }
  };
}

/* ======================= WINDOW MANAGER ======================= */
class WindowManager {
  constructor(el, opts = {}) {
    this.el = el;
    this.mdi = !!opts.mdi;
    this.frame = opts.frame || null;
    this.wins = [];
    this.z = 10;
    this.active = null;
    this.cascadeN = 0;
  }
  get W() { return this.el.clientWidth; }
  get H() { return this.el.clientHeight; }

  add(w) { this.wins.push(w); this.el.appendChild(w.el); }

  remove(w) {
    this.wins = this.wins.filter(x => x !== w);
    w.el.remove();
    if (w.iconEl) w.iconEl.remove();
    if (this.active === w) {
      this.active = null;
      const next = this.ordered().reverse().find(x => !x.isMin && !x.hidden) || this.ordered().reverse().find(x => !x.hidden);
      if (next) next.activate();
      else if (!this.mdi) Sys.emit('activate', null);
    }
    this.syncMdiMax();
  }

  ordered() { return this.wins.slice().sort((a, b) => (+a.el.style.zIndex || 0) - (+b.el.style.zIndex || 0)); }

  activate(w) {
    if (this.active && this.active !== w) {
      const prev = this.active;
      prev.setActive(false);
      if (this.mdi && prev.isMax && !w.isMin) { prev.restore(true); w.maximize(true); }
    }
    this.active = w;
    w.setActive(true);
    w.el.style.zIndex = (w.o.topmost ? 50000 : 0) + (++this.z);
    if (w.iconEl) w.iconEl.style.zIndex = 5;
    if (!this.mdi) Sys.emit('activate', w);
    else if (this.frame) this.frame.o.onMdiChange && this.frame.o.onMdiChange();
  }

  nextIconSlot(w) {
    const sp = Store.get('iconSpacing', 75), rowH = 70;
    const W = this.W, H = this.H;
    const per = Math.max(1, Math.floor((W - 4) / sp));
    const taken = new Set(this.wins.filter(x => x !== w && x.isMin && x.iconSlot != null).map(x => x.iconSlot));
    let i = 0;
    while (taken.has(i)) i++;
    return { slot: i, x: 4 + (i % per) * sp, y: H - rowH - Math.floor(i / per) * rowH + 4 };
  }

  arrangeIcons() {
    const sp = Store.get('iconSpacing', 75), rowH = 70;
    const per = Math.max(1, Math.floor((this.W - 4) / sp));
    this.wins.filter(w => w.isMin).forEach((w, i) => {
      w.iconSlot = i;
      w.iconPos = { x: 4 + (i % per) * sp, y: this.H - rowH - Math.floor(i / per) * rowH + 4 };
      w.placeIcon();
    });
  }

  iconAreaH() {
    const n = this.wins.filter(w => w.isMin).length;
    if (!n) return 0;
    const per = Math.max(1, Math.floor((this.W - 4) / Store.get('iconSpacing', 75)));
    return Math.ceil(n / per) * 70;
  }

  visible() { return this.wins.filter(w => !w.isMin && !w.hidden && !w.o.dialog && w.o.resizable !== false); }

  cascade() {
    const ws = this.visible().sort((a, b) => (+a.el.style.zIndex) - (+b.el.style.zIndex));
    const step = 22, W = this.W, H = this.H - this.iconAreaH();
    ws.forEach((w, i) => {
      if (w.isMax) w.restore(true);
      const off = (i % 10) * step;
      w.setRect(off, off, Math.max(200, W - (ws.length - 1) * step), Math.max(150, H - (ws.length - 1) * step));
    });
    if (ws.length) ws[ws.length - 1].activate();
  }

  tile() {
    const ws = this.visible();
    const n = ws.length;
    if (!n) return;
    const W = this.W, H = this.H - this.iconAreaH();
    const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
    ws.forEach((w, i) => {
      if (w.isMax) w.restore(true);
      const c = i % cols, r = Math.floor(i / cols);
      const lastRowCols = n - (rows - 1) * cols;
      const cw = r === rows - 1 ? W / lastRowCols : W / cols;
      w.setRect(Math.round(c * cw), Math.round(r * H / rows), Math.round(cw), Math.round(H / rows));
    });
  }

  relayout() {
    for (const w of this.wins) {
      if (w.isMax) w.applyMax();
      else if (!w.isMin) w.keepVisible();
    }
    this.arrangeIconsIfOff();
  }
  arrangeIconsIfOff() {
    for (const w of this.wins) if (w.isMin && w.iconPos && (w.iconPos.y > this.H - 40 || w.iconPos.x > this.W - 40)) { this.arrangeIcons(); break; }
  }

  defaultPos(w, hh) {
    const n = this.cascadeN++ % 8;
    return { x: 20 + n * 22, y: 16 + n * 22 };
  }

  syncMdiMax() {
    if (!this.mdi || !this.frame) return;
    const m = this.wins.find(w => w.isMax && !w.isMin && !w.hidden);
    this.frame.setMdiMax(m || null);
  }
}

/* ======================= WINDOW ======================= */
class Win extends Emitter {
  constructor(o) {
    super();
    this.o = Object.assign({ resizable: true, sysMenu: true }, o);
    o = this.o;
    this.wm = o.wm || Sys.desktop;
    this.isMdi = this.wm.mdi;
    this.dialog = !!o.dialog;
    this.state = 'normal';
    this.title = o.title || '';
    this.closed = false;
    this.modalChild = null;
    this.iconSlot = null;

    const minBox = o.minBox ?? (!this.dialog);
    const maxBox = o.maxBox ?? (!this.dialog && o.resizable);

    this.el = h('div', { class: 'win' + (this.dialog ? ' dlg' : '') + (o.resizable && !this.dialog ? ' sizable' : '') + (this.isMdi ? ' mdichild' : '') + (o.className ? ' ' + o.className : ''), tabindex: '-1' });
    this.el.setAttribute('role', this.dialog ? 'dialog' : 'region');
    this.el.setAttribute('aria-label', this.title);
    this.inner = h('div', { class: 'inner' });
    this.tb = h('div', { class: 'tb' });
    if (o.sysMenu !== false) {
      this.sysEl = h('div', { class: 'sys' + (this.isMdi ? ' child' : '') });
      this.tb.appendChild(this.sysEl);
      this._bindSys(this.sysEl);
    }
    this.capEl = h('div', { class: 'cap', text: this.title });
    this.tb.appendChild(this.capEl);
    if (minBox) {
      this.minEl = h('div', { class: 'tbtn min' });
      this._bindBtn(this.minEl, () => this.minimize());
      this.tb.appendChild(this.minEl);
    }
    if (maxBox) {
      this.maxEl = h('div', { class: 'tbtn max' });
      this._bindBtn(this.maxEl, () => this.isMax ? this.restore() : this.maximize());
      this.tb.appendChild(this.maxEl);
    }
    // Neo10: Windows 10 caption buttons gain a Close box
    if ((o.closeBox ?? Sys.isNeo()) && o.sysMenu !== false) {
      this.closeEl = h('div', { class: 'tbtn close' });
      this._bindBtn(this.closeEl, () => this.close());
      this.tb.appendChild(this.closeEl);
    }
    if (!this.isMdi) this.vd = Sys.vd || 0;
    this.tb.addEventListener('pointerdown', e => this._titleDown(e));
    this.tb.addEventListener('dblclick', e => {
      if (e.target === this.capEl || e.target === this.tb) {
        if (maxBox) this.isMax ? this.restore() : this.maximize();
      }
    });
    this.inner.appendChild(this.tb);

    this.mb = h('div', { class: 'mb' });
    this.inner.appendChild(this.mb);
    if (o.menu) this.setMenu(o.menu); else this.mb.style.display = 'none';

    this.body = h('div', { class: 'body' + (o.bodyClass ? ' ' + o.bodyClass : '') });
    this.inner.appendChild(this.body);
    this.el.appendChild(this.inner);

    if (o.resizable && !this.dialog) {
      for (const d of ['n', 's', 'e', 'w', 'nw', 'nw2', 'ne', 'ne2', 'sw', 'sw2', 'se', 'se2']) {
        const hd = h('div', { class: 'rs ' + d });
        hd.addEventListener('pointerdown', e => this._sizeDown(e, d.replace('2', '')));
        this.el.appendChild(hd);
      }
    }

    this.el.addEventListener('pointerdown', e => {
      if (this.modalChild && !this.modalChild.closed) {
        e.preventDefault(); e.stopPropagation();
        this.modalChild.activate(); this.modalChild.flash(); Snd.beep();
        return;
      }
      if (!this.isActive || (this.wm.active !== this)) this.activate(true);
    }, true);
    this.el.addEventListener('focusin', e => { this.lastFocus = e.target; });
    this.el.addEventListener('contextmenu', e => { if (!isEditable(e.target)) e.preventDefault(); });

    this.wm.add(this);
    let w = o.w || 300, hh = o.h || 200;
    if (o.x == null || o.y == null) {
      if (o.center) { o.x = 0; o.y = 0; }
      else { const p = this.wm.defaultPos(this, hh); o.x ??= p.x; o.y ??= p.y; }
    }
    this.setRect(o.x, o.y, w, hh, true);
    if (o.cw || o.ch) this.sizeToClient(o.cw, o.ch);
    if (o.center) this.center(o.owner);
    this.keepVisible();

    if (o.persist) {
      const p = Store.get('wpos.' + o.persist);
      if (p) {
        if (o.resizable !== false && p.w) this.setRect(p.x, p.y, p.w, p.h, true); else this.move(p.x, p.y);
        this.keepVisible();
      }
      const save = () => {
        if (this.closed && !this._savedOnClose) return;
        const r = this.isMin || this.isMax ? this.normalRect : { x: this.x, y: this.y, w: this.w, h: this.h };
        if (r) Store.set('wpos.' + o.persist, { ...r, state: this.state });
      };
      this.on('moved', save); this.on('resize', save);
      this.on('closed', () => { this._savedOnClose = true; save(); });
      if (p && p.state === 'max' && this.maxEl) setTimeout(() => this.maximize(true), 0);
    }
    if (o.owner && o.modal) {
      o.owner.modalChild = this;
      this.modalOwner = o.owner;
      this.el.setAttribute('aria-modal', 'true');
      o.owner.el.inert = true;
    }
    if (!o.noActivate) this.activate();
  }

  get isMax() { return this.state === 'max'; }
  get isMin() { return this.state === 'min'; }
  get x() { return this.el.offsetLeft; }
  get y() { return this.el.offsetTop; }
  get w() { return this.el.offsetWidth; }
  get h() { return this.el.offsetHeight; }

  /* the window that should receive keys: deepest active modal / MDI child */
  focusTarget() {
    if (this.modalChild && !this.modalChild.closed) return this.modalChild.focusTarget();
    return this;
  }

  setMenu(defs) {
    this.menuDefs = defs;
    this.mb.style.display = defs ? '' : 'none';
    if (defs) {
      if (this.menuBar) { this.menuBar.defs = defs; this.menuBar.render(); }
      else this.menuBar = new MenuBar(this, defs, this.mb);
    }
  }

  setTitle(t) {
    this.title = t;
    this.capEl.textContent = t;
    this.el.setAttribute('aria-label', t);
    if (this.iconLbl) this.iconLbl.textContent = this.iconTitle();
    if (this.isMdi && this.wm.frame) this.wm.syncMdiMax();
    Sys.emit('titles');
  }
  iconTitle() { return this.o.iconTitle ? this.o.iconTitle(this) : this.title; }

  setRect(x, y, w, hh, silent) {
    Object.assign(this.el.style, { left: Math.round(x) + 'px', top: Math.round(y) + 'px', width: Math.round(w) + 'px', height: Math.round(hh) + 'px' });
    if (!silent) this._resized();
  }
  move(x, y) { this.el.style.left = Math.round(x) + 'px'; this.el.style.top = Math.round(y) + 'px'; }
  sizeToClient(cw, ch) {
    const bw = this.body.clientWidth, bh = this.body.clientHeight;
    const w = this.el.offsetWidth + (cw != null ? cw - bw : 0);
    const hh = this.el.offsetHeight + (ch != null ? ch - bh : 0);
    this.setRect(this.x, this.y, w, hh);
  }
  center(rel) {
    let cx = this.wm.W / 2, cy = this.wm.H / 2;
    if (rel && rel.wm === this.wm && !rel.isMin) { cx = rel.x + rel.w / 2; cy = rel.y + rel.h / 2; }
    this.move(cx - this.w / 2, cy - this.h / 2);
    this.keepVisible();
  }
  keepVisible() {
    if (this.isMax) return;
    const W = this.wm.W, H = this.wm.H;
    let x = this.x, y = this.y;
    if (this.dialog || this.o.center) { x = clamp(x, 0, Math.max(0, W - this.w)); y = clamp(y, 0, Math.max(0, H - this.h)); }
    else { x = clamp(x, -this.w + 60, W - 60); y = clamp(y, -4, H - 24); }
    this.move(x, y);
  }

  _resized() {
    if (this.o.onResize) this.o.onResize(this);
    this.emit('resize');
  }

  setActive(on) {
    this.isActive = on;
    this.el.classList.toggle('active', on);
    if (this.iconEl) this.iconEl.classList.toggle('sel', on && this.isMin);
    if (this.o.onActivate) this.o.onActivate(on);
  }

  activate(fromPointer) {
    if (this.closed) return;
    if (this.modalChild && !this.modalChild.closed) { this.modalChild.activate(); return; }
    if (this.isMdi && this.wm.frame && this.wm.frame.wm.active !== this.wm.frame) this.wm.frame.activate();
    this.wm.activate(this);
    if (!fromPointer) this.focus();
    else setTimeout(() => { if (!this.el.contains(document.activeElement) && !(this.iconEl && this.iconEl.contains(document.activeElement))) this.focus(); }, 0);
  }

  focus() {
    if (this.isMin) { this.iconEl && this.iconEl.focus({ preventScroll: true }); return; }
    if (this.isMdi === false && this.mdiClient && this.mdiClient.active && !this.mdiClient.active.isMin && this.mdiClient.active.isActive) {
      this.mdiClient.active.focus(); return;
    }
    const t = (this.lastFocus && this.el.contains(this.lastFocus) && this.lastFocus.offsetParent) ? this.lastFocus
      : (this.o.focusEl ? (typeof this.o.focusEl === 'function' ? this.o.focusEl() : this.o.focusEl) : null)
      || this.body.querySelector('[data-autofocus]') || this.el;
    try { t.focus({ preventScroll: true }); } catch {}
  }

  flash() {
    let n = 0;
    clearInterval(this._fl);
    this._fl = setInterval(() => {
      this.el.classList.toggle('active');
      if (++n >= 6) { clearInterval(this._fl); this.el.classList.toggle('active', this.isActive); }
    }, 70);
  }

  show() { this.hidden = false; this.el.classList.remove('hidden'); }
  hide() { this.hidden = true; this.el.classList.add('hidden'); }

  async close(force) {
    if (this.closed) return true;
    if (this.modalChild && !this.modalChild.closed) {
      if (!force) { this.modalChild.activate(); Snd.beep(); return false; }
      await this.modalChild.close(true);
    }
    if (!force && this.o.onClose) {
      const r = await this.o.onClose(this);
      if (r === false) return false;
    }
    if (this.mdiClient) for (const c of this.mdiClient.wins.slice()) await c.close(true);
    this.closed = true;
    if (Menu.opts.ctx === this) Menu.closeAll(true);
    this.wm.remove(this);
    if (this.modalOwner) {
      this.modalOwner.modalChild = null;
      this.modalOwner.el.inert = false;
      if (!this.modalOwner.closed) this.modalOwner.activate();
    }
    if (this.o.onClosed) this.o.onClosed(this);
    this.emit('closed');
    Sys.emit('windows');
    return true;
  }

  /* ---------------- min / max ---------------- */
  minimize() {
    if (this.isMin || this.o.minBox === false && this.dialog) return;
    if (this.isMax) this.wasMax = true; else this.wasMax = false;
    if (this.state === 'normal') this.normalRect = { x: this.x, y: this.y, w: this.w, h: this.h };
    this.state = 'min';
    this.el.classList.add('min');
    this.el.classList.remove('max', 'mdimax');
    const toTaskbar = Sys.isNeo() && !this.isMdi;    // Neo10 minimises to the taskbar
    if (!toTaskbar) this.makeIcon();
    this.wm.syncMdiMax();
    if (this.o.onMinimize) this.o.onMinimize(true);
    // activate next window
    const next = this.wm.ordered().reverse().find(x => x !== this && !x.isMin && !x.hidden);
    if (next) next.activate();
    else if (toTaskbar) { this.setActive(false); this.wm.active = null; Sys.emit('activate', null); Sys.screen.focus(); }
    else { this.wm.activate(this); this.iconEl.focus(); }
    Sys.emit('windows');
  }

  maximize(silent) {
    if (this.state === 'normal') this.normalRect = { x: this.x, y: this.y, w: this.w, h: this.h };
    const wasMin = this.isMin;
    this.state = 'max';
    this.el.classList.remove('min');
    this.el.classList.add('max');
    if (this.isMdi) this.el.classList.add('mdimax');
    this.removeIcon();
    if (this.maxEl) this.maxEl.className = 'tbtn restore';
    this.applyMax();
    this.wm.syncMdiMax();
    if (wasMin && this.o.onMinimize) this.o.onMinimize(false);
    if (!silent) this.activate();
    Sys.emit('windows');
  }

  applyMax() {
    const W = this.wm.W, H = this.wm.H;
    const off = this.dialog ? 5 : (parseInt(getComputedStyle(this.el).paddingLeft) || 3) + 1;
    const inner = this.isMdi ? 1 : 0;
    this.setRect(-off - inner, -off - inner, W + 2 * (off + inner), H + 2 * (off + inner));
  }

  restore(silent) {
    const wasMin = this.isMin;
    if (wasMin && this.wasMax) { this.maximize(silent); return; }
    this.state = 'normal';
    this.el.classList.remove('min', 'max', 'mdimax');
    this.removeIcon();
    if (this.maxEl) this.maxEl.className = 'tbtn max';
    const r = this.normalRect;
    if (r) this.setRect(r.x, r.y, r.w, r.h);
    this.wm.syncMdiMax();
    if (wasMin && this.o.onMinimize) this.o.onMinimize(false);
    if (!silent) this.activate();
    Sys.emit('windows');
  }

  /* ---------------- MDI frame support ---------------- */
  createMdiClient(el) {
    this.mdiClient = new WindowManager(el, { mdi: true, frame: this });
    return this.mdiClient;
  }
  setMdiMax(child) {
    const base = this.o.baseTitle || this.title.replace(/ - \[.*\]$/, '');
    this.o.baseTitle = base;
    this.mb.querySelectorAll('.mdi-sys,.mdi-restore').forEach(n => n.remove());
    if (child) {
      this.capEl.textContent = base + ' - [' + child.title + ']';
      const s = h('div', { class: 'sys mdi-sys' });
      s.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); child.activate(); child.showSysMenu(s); });
      s.addEventListener('dblclick', () => child.close());
      const r = h('div', { class: 'tbtn restore mdi-restore' });
      this._bindBtn(r, () => child.restore());
      this.mb.insertBefore(s, this.mb.firstChild);
      this.mb.appendChild(r);
    } else this.capEl.textContent = base;
    this.title = this.capEl.textContent;
  }

  /* ---------------- icon ---------------- */
  makeIcon() {
    if (this.iconEl) { this.iconEl.style.display = ''; this.placeIcon(); return; }
    const img = h('div', { class: 'img' });
    const custom = this.o.drawIcon ? h('canvas', { width: 32, height: 32 }) : null;
    if (custom) { img.appendChild(custom); this.iconCanvas = custom; this.o.drawIcon(custom); }
    else img.appendChild(iconImg(this.o.minIcon || this.o.icon || 'app'));
    this.iconLbl = h('div', { class: 'lbl', text: this.iconTitle() });
    this.iconEl = h('div', { class: 'icon', tabindex: '-1' }, img, this.iconLbl);
    let clickT = 0, timer = null;
    this.iconEl.addEventListener('pointerdown', e => {
      if (this.modalChild && !this.modalChild.closed) return;
      e.stopPropagation();
      this.wm.activate(this);
      this.iconEl.focus({ preventScroll: true });
      const sx = e.clientX, sy = e.clientY, ox = this.iconPos.x, oy = this.iconPos.y;
      let moved = false;
      this.iconEl.setPointerCapture(e.pointerId);
      const mv = ev => {
        const dx = (ev.clientX - sx) / Sys.scale, dy = (ev.clientY - sy) / Sys.scale;
        if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
        moved = true;
        this.iconPos = { x: ox + dx, y: oy + dy };
        this.iconSlot = null;
        this.placeIcon();
      };
      const up = () => {
        this.iconEl.removeEventListener('pointermove', mv);
        this.iconEl.removeEventListener('pointerup', up);
        if (moved) return;
        const now = Date.now();
        if (now - clickT < Sys.dblTime()) {
          clearTimeout(timer); clickT = 0;
          this.restore();
        } else {
          clickT = now;
          timer = setTimeout(() => { if (this.isMin && !this.closed) this.showSysMenu(this.iconEl); }, Sys.dblTime());
        }
      };
      this.iconEl.addEventListener('pointermove', mv);
      this.iconEl.addEventListener('pointerup', up);
    });
    this.iconEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this.restore(); }
    });
    if (!this.iconPos) {
      const s = this.wm.nextIconSlot(this);
      this.iconSlot = s.slot;
      this.iconPos = { x: s.x, y: s.y };
    } else if (this.iconSlot != null) {
      const s = this.wm.nextIconSlot(this);
      if (s.slot < this.iconSlot) { this.iconSlot = s.slot; this.iconPos = { x: s.x, y: s.y }; }
    }
    this.wm.el.appendChild(this.iconEl);
    this.placeIcon();
  }
  placeIcon() {
    if (!this.iconEl) return;
    this.iconEl.style.left = this.iconPos.x + 'px';
    this.iconEl.style.top = this.iconPos.y + 'px';
  }
  removeIcon() {
    if (this.iconEl) { this.iconEl.remove(); this.iconEl = null; this.iconLbl = null; this.iconCanvas = null; }
  }

  /* ---------------- system menu ---------------- */
  sysItems() {
    const n = this.state;
    const items = [];
    if (this.dialog) {
      items.push({ label: '&Move', action: () => this.kbdTrack('move') });
      items.push({ label: '&Close', key: 'Alt+F4', action: () => this.close() });
      if (this.o.extraSys) items.push('-', ...this.o.extraSys);
      return items;
    }
    const res = this.o.resizable !== false;
    items.push(
      { label: '&Restore', disabled: n === 'normal', action: () => this.restore() },
      { label: '&Move', disabled: n !== 'normal', action: () => this.kbdTrack('move') },
      { label: '&Size', disabled: n !== 'normal' || !res, action: () => this.kbdTrack('size') },
      { label: 'Mi&nimize', disabled: n === 'min' || !this.minEl, action: () => this.minimize() },
      { label: 'Ma&ximize', disabled: n === 'max' || !this.maxEl, action: () => this.maximize() },
      '-',
      { label: '&Close', key: this.isMdi ? 'Ctrl+F4' : 'Alt+F4', action: () => this.close() }
    );
    if (this.isMdi) items.push('-', { label: 'Nex&t', key: 'Ctrl+F6', action: () => this.wm.frame.nextChild() });
    else items.push('-', { label: 'S&witch To...', key: 'Ctrl+Esc', action: () => Sys.taskList() });
    if (this.o.extraSys) items.push('-', ...this.o.extraSys);
    return items;
  }
  showSysMenu(anchor, keyboard) {
    anchor = anchor || (this.isMin ? this.iconEl : this.sysEl);
    if (!anchor) return;
    const r = Sys.rectOf(anchor);
    if (this.isMin) Menu.show(this.sysItems(), r.x, r.y, { ctx: this, keyboard, anchorH: 0 });
    else Menu.show(this.sysItems(), r.x, r.y + r.h, { ctx: this, keyboard, anchorH: r.h, anchorEl: anchor });
  }
  nextChild() {
    if (!this.mdiClient) return;
    const ws = this.mdiClient.ordered().filter(w => !w.hidden);
    if (ws.length > 1) ws[0].activate();
  }

  _bindSys(el) {
    el.setAttribute('role', 'button'); el.setAttribute('aria-label', 'Window menu'); el.tabIndex = 0;
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); this.showSysMenu(el, true); } });
    let last = 0;
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.stopPropagation(); e.preventDefault();
      if (this.modalChild && !this.modalChild.closed) { this.modalChild.activate(); Snd.beep(); return; }
      this.activate();
      const now = Date.now();
      if (now - last < Sys.dblTime()) { last = 0; this.close(); return; }
      last = now;
      this.showSysMenu(el);
      Menu.opts.onAnchorClick = () => {
        if (Date.now() - last < Sys.dblTime()) this.close();
      };
    });
  }
  _bindBtn(el, fn) {
    const label = el.classList.contains('min') ? 'Minimize' : el.classList.contains('max') ? 'Maximize or restore' : el.classList.contains('close') ? 'Close' : 'Restore';
    el.setAttribute('role', 'button'); el.setAttribute('aria-label', label); el.tabIndex = 0;
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (!this.modalChild) fn(); } });
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.stopPropagation(); e.preventDefault();
      if (this.modalChild && !this.modalChild.closed) { this.modalChild.activate(); Snd.beep(); return; }
      el.setPointerCapture(e.pointerId);
      el.classList.add('down');
      const up = ev => {
        el.classList.remove('down');
        el.removeEventListener('pointerup', up);
        const r = el.getBoundingClientRect();
        if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) fn();
      };
      el.addEventListener('pointerup', up);
    });
  }

  /* ---------------- move / size with XOR outline ---------------- */
  _titleDown(e) {
    if (e.button !== 0 || e.target !== this.capEl && e.target !== this.tb) return;
    const neo = Sys.isNeo() && !this.isMdi && !this.dialog;
    if ((this.isMax && !neo) || this.o.fixedPos) return;
    e.preventDefault();
    this.tb.setPointerCapture(e.pointerId);
    const sx = e.clientX, sy = e.clientY;
    let r0 = { x: this.x, y: this.y, w: this.w, h: this.h };
    let xr = null, nx = r0.x, ny = r0.y, zone = null, unsnapped = false;
    const mv = ev => {
      const dx = (ev.clientX - sx) / Sys.scale, dy = (ev.clientY - sy) / Sys.scale;
      if (!xr && Math.abs(dx) + Math.abs(dy) < 4) return;
      // Neo10: dragging a maximised or snapped window restores its size under the pointer
      if (neo && !unsnapped && (this.isMax || this.snapRestore)) {
        unsnapped = true;
        const rr = this.isMax ? this.normalRect : this.snapRestore;
        const p0 = Sys.pointer(e, this.wm.el), frac = (p0.x - r0.x) / r0.w;
        if (this.isMax) { this.state = 'normal'; this.el.classList.remove('max'); if (this.maxEl) this.maxEl.className = 'tbtn max'; }
        this.snapRestore = null;
        r0 = { x: p0.x - rr.w * frac, y: p0.y - 8, w: rr.w, h: rr.h };
        this.setRect(r0.x, r0.y, r0.w, r0.h);
      }
      if (!xr) xr = xorRect(this.wm.el);
      nx = Settings.snap(r0.x + dx); ny = clamp(Settings.snap(r0.y + dy), -4, this.wm.H - 20);
      zone = null;
      if (neo && this.o.resizable !== false && Store.get('snap', true)) {
        const p = Sys.pointer(ev, this.wm.el), W = this.wm.W, H = this.wm.H;
        if (p.x <= 1) zone = { x: 0, y: 0, w: Math.round(W / 2), h: H };
        else if (p.x >= W - 2) zone = { x: Math.round(W / 2), y: 0, w: W - Math.round(W / 2), h: H };
        else if (p.y <= 1) zone = 'max';
      }
      if (zone === 'max') xr.set(0, 0, this.wm.W, this.wm.H);
      else if (zone) xr.set(zone.x, zone.y, zone.w, zone.h);
      else xr.set(nx, ny, r0.w, r0.h);
    };
    const up = () => {
      this.tb.removeEventListener('pointermove', mv);
      this.tb.removeEventListener('pointerup', up);
      if (!xr) return;
      xr.remove();
      if (zone === 'max') { this.normalRect = { x: nx, y: ny, w: r0.w, h: r0.h }; this.maximize(); return; }
      if (zone) { this.snapRestore = { x: nx, y: ny, w: r0.w, h: r0.h }; this.setRect(zone.x, zone.y, zone.w, zone.h); this.emit('moved'); return; }
      this.move(nx, ny); this.keepVisible(); this.emit('moved');
    };
    this.tb.addEventListener('pointermove', mv);
    this.tb.addEventListener('pointerup', up);
  }

  _limits() {
    return { minW: this.o.minW || 112, minH: this.o.minH || 46, maxW: this.o.maxW || 1e5, maxH: this.o.maxH || 1e5 };
  }
  _applyDir(r0, dir, dx, dy) {
    const L = this._limits();
    let { x, y, w, h: hh } = r0;
    if (dir.includes('e')) w = clamp(r0.w + dx, L.minW, L.maxW);
    if (dir.includes('s')) hh = clamp(r0.h + dy, L.minH, L.maxH);
    if (dir.includes('w')) { w = clamp(r0.w - dx, L.minW, L.maxW); x = r0.x + r0.w - w; }
    if (dir.includes('n')) { hh = clamp(r0.h - dy, L.minH, L.maxH); y = r0.y + r0.h - hh; }
    if (Settings.grid()) {
      const g = Settings.snap;
      if (dir.includes('e')) w = clamp(g(x + w) - x, L.minW, L.maxW);
      if (dir.includes('s')) hh = clamp(g(y + hh) - y, L.minH, L.maxH);
      if (dir.includes('w')) { const nx = g(x); w = clamp(w + x - nx, L.minW, L.maxW); x = r0.x + r0.w - w; }
      if (dir.includes('n')) { const ny = g(y); hh = clamp(hh + y - ny, L.minH, L.maxH); y = r0.y + r0.h - hh; }
    }
    return { x, y, w, h: hh };
  }
  _sizeDown(e, dir) {
    if (e.button !== 0 || this.isMax) return;
    e.preventDefault(); e.stopPropagation();
    if (this.modalChild && !this.modalChild.closed) return;
    this.activate();
    const t = e.currentTarget;
    t.setPointerCapture(e.pointerId);
    const sx = e.clientX, sy = e.clientY, r0 = { x: this.x, y: this.y, w: this.w, h: this.h };
    const xr = xorRect(this.wm.el);
    let nr = r0;
    xr.set(r0.x, r0.y, r0.w, r0.h);
    const mv = ev => {
      nr = this._applyDir(r0, dir, (ev.clientX - sx) / Sys.scale, (ev.clientY - sy) / Sys.scale);
      xr.set(nr.x, nr.y, nr.w, nr.h);
    };
    const up = () => {
      t.removeEventListener('pointermove', mv);
      t.removeEventListener('pointerup', up);
      xr.remove();
      this.setRect(nr.x, nr.y, nr.w, nr.h);
    };
    t.addEventListener('pointermove', mv);
    t.addEventListener('pointerup', up);
  }

  /* System menu Move/Size: keyboard (arrows/Enter/Esc) or mouse */
  kbdTrack(mode) {
    const r0 = { x: this.x, y: this.y, w: this.w, h: this.h };
    let r = { ...r0 }, dir = mode === 'size' ? '' : null;
    const xr = xorRect(this.wm.el);
    xr.set(r.x, r.y, r.w, r.h);
    let lx = null, ly = null;
    const done = ok => {
      document.removeEventListener('keydown', kd, true);
      Sys.screen.removeEventListener('pointermove', pm, true);
      Sys.screen.removeEventListener('pointerdown', pd, true);
      xr.remove();
      Sys.tracking = false;
      if (ok) { this.setRect(mode === 'move' ? Settings.snap(r.x) : r.x, mode === 'move' ? Settings.snap(r.y) : r.y, r.w, r.h); this.keepVisible(); this.emit('moved'); }
    };
    const nudge = (dx, dy) => {
      if (mode === 'move') { r.x += dx; r.y += dy; }
      else {
        if (!dir) dir = (dx > 0 ? 'e' : dx < 0 ? 'w' : '') + (dy > 0 ? 's' : dy < 0 ? 'n' : '');
        const d2 = dir;
        const nr = this._applyDir(r, d2, d2.includes('w') ? dx : dx, dy);
        r = nr;
      }
      xr.set(r.x, r.y, r.w, r.h);
    };
    const kd = e => {
      e.preventDefault(); e.stopPropagation();
      const st = 8;
      if (e.key === 'ArrowLeft') nudge(-st, 0);
      else if (e.key === 'ArrowRight') nudge(st, 0);
      else if (e.key === 'ArrowUp') nudge(0, -st);
      else if (e.key === 'ArrowDown') nudge(0, st);
      else if (e.key === 'Enter') done(true);
      else if (e.key === 'Escape') done(false);
    };
    const pm = e => {
      if (lx != null) nudge((e.clientX - lx) / Sys.scale, (e.clientY - ly) / Sys.scale);
      lx = e.clientX; ly = e.clientY;
    };
    const pd = e => { e.preventDefault(); e.stopPropagation(); done(true); };
    Sys.tracking = true;
    document.addEventListener('keydown', kd, true);
    Sys.screen.addEventListener('pointermove', pm, true);
    Sys.screen.addEventListener('pointerdown', pd, true);
  }

  /* ---------------- keyboard ---------------- */
  handleKey(e) {
    const name = keyName(e);
    const editable = isEditable(e.target);
    if (this.mdiClient && this.mdiClient.active && !this.mdiClient.active.isMin && this.mdiClient.active.handleKey(e, true)) return true;
    if (this.menuBar) {
      const passthrough = editable && /^(Ctrl\+[CXVZA]|Del|Shift\+Del|Ctrl\+Ins|Shift\+Ins|Backspace|Alt\+Backspace)$/.test(name);
      const it = !passthrough && this.menuBar.accel(name);
      if (it && !Menu.val(it.disabled, this) && it.action) { e.preventDefault(); it.action(this); return true; }
    }
    if (this.o.onKey && this.o.onKey(e, name) === true) { e.preventDefault(); return true; }
    if (name === 'Ctrl+F4' && this.isMdi) { e.preventDefault(); this.close(); return true; }
    if (name === 'Ctrl+F6' && this.mdiClient) { e.preventDefault(); this.nextChild(); return true; }
    if (name === 'Alt+-' && this.mdiClient && this.mdiClient.active) {
      e.preventDefault(); const c = this.mdiClient.active;
      c.showSysMenu(c.isMax ? this.mb.querySelector('.mdi-sys') : null, true); return true;
    }
    return false;
  }
}
