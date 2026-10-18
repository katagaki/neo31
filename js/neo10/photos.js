'use strict';
/* Photos (Windows 10 shell): a collection of every picture in the user's
   Pictures folder (and its subfolders) plus the C:\WINDOWS wallpapers, and a
   viewer with whole-step zoom, rotate, slideshow, file info, Set as desktop
   background, Delete (to the Recycle Bin) and Edit in Paint.
   Pictures are data-URL files (Paintbrush saves, imports) or generated
   wallpapers (node.g, drawn by Wallpapers.makers). Pixels are never smoothed. */
(() => {
  const TW = 112, TH = 84;                           // thumbnail box
  const STEPS = [1 / 8, 1 / 6, 1 / 5, 1 / 4, 1 / 3, 1 / 2, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16];
  const MAX_FIT = 8;                                 // largest whole-step upscale used by "fit"
  const SLIDE_MS = 4000;
  const WIN_DIR = 'C:\\WINDOWS';

  /* ---------- pictures on drive C: ---------- */
  const isImage = (path, n = FS.get(path)) => !!n && n.t === 'f' &&
    (n.g ? FS.ext(path) === 'BMP' && !!Wallpapers.makers[n.g] : typeof n.x === 'string' && /^data:image\//i.test(n.x));
  const stamp = n => `${n.d}|${n.g || ''}|${(n.x || '').length}`;
  const urls = new Map(), dims = new Map();
  const urlOf = path => {
    const n = FS.get(path);
    if (!n) return null;
    const k = stamp(n), c = urls.get(path);
    if (c && c.k === k) return c.url;
    const url = n.g ? Wallpapers.gen(n.g)?.toDataURL() : n.x;
    urls.set(path, { k, url });
    return url;
  };
  const dimsOf = path => { const n = FS.get(path), d = dims.get(path); return n && d && d.k === stamp(n) ? d : null; };
  const noteDims = (path, w, hh) => { const n = FS.get(path); if (n) dims.set(path, { k: stamp(n), w, h: hh }); };
  const load = path => new Promise(res => {
    const url = urlOf(path);
    if (!url) return res(null);
    const img = new Image();
    img.onload = () => { noteDims(path, img.naturalWidth, img.naturalHeight); res({ path, src: img, w: img.naturalWidth, h: img.naturalHeight }); };
    img.onerror = () => res(null);
    img.src = url;
  });

  const shown = p => FileOps.shownName(FS.basename(p), FS.get(p));
  const byName = (a, b) => shown(a).localeCompare(shown(b), undefined, { numeric: true, sensitivity: 'base' });
  const folderImages = (dir, withHidden) => (FS.list(dir) || [])
    .filter(e => e.node.t === 'f' && (withHidden || !e.node.h) && isImage(FS.join(dir, e.name), e.node))
    .map(e => FS.join(dir, e.name)).sort(byName);
  const folderLabel = dir => {
    if (dir === WIN_DIR) return 'Windows wallpapers';
    const pics = KNOWN.pictures;
    if (dir === pics || dir.startsWith(pics + '\\')) {
      let at = pics; const names = [shown(pics)];
      for (const part of dir.slice(pics.length).split('\\').filter(Boolean)) { at = FS.join(at, part); names.push(shown(at)); }
      return names.join(' > ');
    }
    return dir === 'C:\\' ? 'Local Disk (C:)' : shown(dir);
  };
  /* groups: [{ dir, label, items: [paths] }] */
  const collect = () => {
    const groups = [];
    const walk = (dir, depth) => {
      const items = folderImages(dir);
      if (items.length) groups.push({ dir, label: folderLabel(dir), items });
      if (depth < 24) for (const e of FS.list(dir) || []) if (e.node.t === 'd' && !e.node.h) walk(FS.join(dir, e.name), depth + 1);
    };
    if (FS.isDir(KNOWN.pictures)) walk(KNOWN.pictures, 0);
    const sys = folderImages(WIN_DIR).filter(p => FS.ext(p) === 'BMP');
    if (sys.length) groups.push({ dir: WIN_DIR, label: folderLabel(WIN_DIR), items: sys });
    return groups;
  };
  const fmtSize = b => b < 1024 ? `${fmtNum(b)} bytes` : `${b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(2) + ' MB'} (${fmtNum(b)} bytes)`;
  const fmtDate = t => { const d = new Date(t || WIN_DATE); return `${Intl31.date(d)} ${Intl31.time(d)}`; };
  /* largest whole step that fits iw x ih into aw x ah */
  const fitStep = (iw, ih, aw, ah) => {
    const r = Math.min(aw / iw, ah / ih);
    return r >= 1 ? clamp(Math.floor(r), 1, MAX_FIT) : 1 / Math.ceil(1 / r);
  };
  const rotated = (src, w, hh, rot) => {
    const c = h('canvas', { width: rot % 2 ? hh : w, height: rot % 2 ? w : hh }), x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.translate(c.width / 2, c.height / 2); x.rotate(rot * Math.PI / 2); x.drawImage(src, -w / 2, -hh / 2);
    return c;
  };

  Sys.registerApp('photos', {
    name: 'Photos', icon: 'photos', single: true,
    reopen(w, opts) { if (opts.args && w._photos) w._photos.openArg(opts.args, opts.cwd); },
    run(opts) {
      let mode = 'collection', filter = Store.get('photos.folder', '*'), cursor = -1, flat = [];
      let vlist = [], path = null, cur = null, zoom = 'fit', rot = 0, token = 0, rotT = null, slide = null;
      let info = Store.get('photos.info', false);
      const offs = [];

      const w = new Win({ title: 'Photos', icon: 'photos', w: 720, h: 500, persist: 'photos',
        onKey: (e, name) => onKey(e, name),
        onClose: () => { flushRot(); stopSlide(true); } });
      w.body.classList.add('ph');

      /* ---------- shared helpers ---------- */
      const btn = (label, title, fn, icon) => {
        const b = h('div', { class: 'ph-btn', title, role: 'button', 'aria-label': title }, icon ? iconImg(icon) : null, label ? h('span', { text: label }) : null);
        b.addEventListener('click', e => { if (!b.classList.contains('dis')) fn(e); });
        return b;
      };
      const ctx = (el, items) => el.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); const p = Sys.pointer(e); Menu.show(items(), p.x, p.y); });
      const inWindows = p => FS.dirname(p) === WIN_DIR;
      const canWrite = p => { const n = FS.get(p); return !!n && !n.g && !n.ro && !inWindows(p); };

      const edit = p => { flushRot(); Sys.launch(`PBRUSH.EXE "${p}"`, { caller: 'Photos' }); };
      const copy = p => { const url = cur && cur.path === p && rot ? rotated(cur.src, cur.w, cur.h, rot).toDataURL() : urlOf(p); if (url) Sys.setClipboard({ type: 'image', data: url }); };
      const openLocation = p => Sys.run('explorer', { args: FS.dirname(p) });
      const setBackground = p => {
        flushRot();
        Store.set('wallpaper', inWindows(p) ? FS.basename(p) : p);
        Store.set('pattern', '(None)');
        Settings.changed();
        if (typeof Shell10 !== 'undefined' && Shell10.notify) Shell10.notify({ app: 'Photos', icon: 'photos', title: 'Desktop background changed', text: `${shown(p)} is now your desktop background. Click here to choose a fit.`, onClick: () => Sys.run('settings10', { args: 'personalization/background' }) });
      };
      const del = async (p, permanent) => {
        if (!FS.exists(p)) return;
        if (inWindows(p)) { await msgBox(`You need permission to perform this action.\n\n${shown(p)} is used by Windows.`, 'Photos', { icon: 'stop', owner: w }); return; }
        flushRot();
        await FileOps.recycle([p], !!permanent, w);
        // the FS change listener moves on to the next picture (or back to the collection)
      };
      const picMenu = (p, inCollection) => [
        ...(inCollection ? [{ label: '&Open', action: () => openViewer(p) }, '-'] : []),
        { label: '&Edit in Paint', action: () => edit(p) },
        { label: 'Set as desktop &background', action: () => setBackground(p) },
        { label: '&Copy', action: () => copy(p) },
        '-',
        { label: 'Open file &location', action: () => openLocation(p) },
        { label: '&Delete', action: () => del(p) },
        '-',
        { label: 'P&roperties', action: () => FileOps.properties(p, w) }
      ];

      /* ======================= COLLECTION ======================= */
      let scroller = null;
      const renderCollection = (keepScroll) => {
        const top = keepScroll && scroller ? scroller.scrollTop : 0;
        mode = 'collection'; path = null; cur = null; ro && ro.disconnect();
        w.setTitle('Photos');
        w.body.innerHTML = '';
        const groups = collect();
        if (filter !== '*' && !groups.some(g => g.dir === filter)) filter = '*';
        const visible = filter === '*' ? groups : groups.filter(g => g.dir === filter);
        flat = visible.flatMap(g => g.items);
        if (cursor >= flat.length) cursor = flat.length - 1;

        const combo = UI.combo({ label: 'Folder', items: [{ text: 'All folders' }, ...groups.map(g => ({ text: `${g.label} (${g.items.length})` }))],
          index: filter === '*' ? 0 : groups.findIndex(g => g.dir === filter) + 1,
          onChange: (_, i) => { filter = i ? groups[i - 1].dir : '*'; Store.set('photos.folder', filter); cursor = -1; renderCollection(); } });
        combo.el.style.position = 'relative'; combo.el.style.width = '230px';
        const count = h('div', { class: 'neo-kind', text: flat.length === 1 ? '1 picture' : `${flat.length} pictures` });
        const slideBtn = btn('Slideshow', 'Slideshow (F5)', () => startSlide(flat, Math.max(0, cursor)));
        if (!flat.length) slideBtn.classList.add('dis');
        w.body.appendChild(h('div', { class: 'ph-bar' },
          h('div', { class: 'ph-title', text: 'Collection' }), combo.el, count, h('div', { class: 'ph-sp' }),
          btn('Import', 'Import pictures from your computer into Pictures', importPics), slideBtn,
          btn('Pictures folder', 'Open the Pictures folder in File Explorer', () => Sys.run('explorer', { args: KNOWN.pictures }))));

        if (!groups.length) {
          const big = iconImg('photos', 64); big.classList.add('neo-pix');
          w.body.appendChild(h('div', { class: 'ph-empty' }, big,
            h('div', { class: 'ph-emptyh', text: 'No pictures here yet' }),
            h('div', { class: 'neo-p', text: 'Pictures you save in Paint, or import into your Pictures folder, show up here.' }),
            h('div', { class: 'neo-btnrow' }, SP_btn('Import pictures', importPics), SP_btn('Open Paint', () => Sys.launch('PBRUSH.EXE', { caller: 'Photos' })))));
          scroller = null;
          return;
        }
        scroller = h('div', { class: 'ph-scroll', tabindex: '-1' });
        if (filter === '*' && !groups.some(g => g.dir !== WIN_DIR)) {
          scroller.appendChild(h('div', { class: 'ph-hint' }, iconImg('fpics'),
            h('div', { style: { flex: 1 } }, h('div', { class: 'neo-ttitle', text: 'Your Pictures folder is empty' }),
              h('div', { class: 'neo-kind', text: 'Save a picture in Paint, or import pictures from your computer, and it will appear here.' })),
            SP_btn('Import pictures', importPics)));
        }
        let i = 0;
        for (const g of visible) {
          scroller.appendChild(h('div', { class: 'ph-group' }, h('span', { text: g.label }), h('span', { class: 'neo-kind', text: String(g.items.length) })));
          const grid = h('div', { class: 'ph-grid' });
          for (const p of g.items) grid.appendChild(thumb(p, i++, g.items));
          scroller.appendChild(grid);
        }
        w.body.appendChild(scroller);
        scroller.scrollTop = top;
      };
      const SP_btn = (t, fn) => { const b = UI.button(t, { onClick: fn }); b.style.minWidth = '120px'; return b; };
      const importPics = () => { if (!FS.isDir(KNOWN.pictures)) { try { FS.mkdir(KNOWN.pictures); } catch {} } HostFiles.importFiles(KNOWN.pictures, w); };

      const thumb = (p, i, group) => {
        const name = shown(p);
        const img = h('img', { draggable: 'false', alt: name });
        const size = (iw, ih) => {
          let s = Math.min(TW / iw, TH / ih); s = s >= 1 ? Math.min(Math.floor(s), MAX_FIT) : s;
          img.style.width = Math.max(1, Math.round(iw * s)) + 'px'; img.style.height = Math.max(1, Math.round(ih * s)) + 'px';
        };
        const d = dimsOf(p); if (d) size(d.w, d.h);
        img.onload = () => { noteDims(p, img.naturalWidth, img.naturalHeight); size(img.naturalWidth, img.naturalHeight); };
        const box = h('div', { class: 'ph-thimg' }, img);
        img.src = urlOf(p) || '';
        const el = h('div', { class: 'ph-thumb' + (i === cursor ? ' cur' : ''), title: name, role: 'button', 'aria-label': name }, box, h('div', { class: 'ph-thname', text: name }));
        el.dataset.i = i;
        el.addEventListener('click', () => { cursor = i; openViewer(p, group); });
        el.addEventListener('pointerdown', () => setCursor(i, false));
        ctx(el, () => { setCursor(i, false); return picMenu(p, true); });
        return el;
      };
      const thumbs = () => scroller ? [...scroller.querySelectorAll('.ph-thumb')] : [];
      const setCursor = (i, scroll = true) => {
        cursor = clamp(i, 0, flat.length - 1);
        for (const t of thumbs()) t.classList.toggle('cur', +t.dataset.i === cursor);
        const el = thumbs()[cursor];
        if (el && scroll) el.scrollIntoView({ block: 'nearest' });
      };
      /* Up/Down: nearest thumbnail in the next row above/below */
      const vertical = dir => {
        const ts = thumbs(), c = ts[cursor];
        if (!c) return setCursor(0);
        const r = c.getBoundingClientRect(), cx = r.left + r.width / 2;
        const rows = ts.map(t => t.getBoundingClientRect()).map((b, i) => ({ i, top: b.top, cx: b.left + b.width / 2 }))
          .filter(b => dir > 0 ? b.top > r.top + 4 : b.top < r.top - 4);
        if (!rows.length) return;
        const rowTop = dir > 0 ? Math.min(...rows.map(b => b.top)) : Math.max(...rows.map(b => b.top));
        const best = rows.filter(b => Math.abs(b.top - rowTop) < 4).sort((a, b) => Math.abs(a.cx - cx) - Math.abs(b.cx - cx))[0];
        setCursor(best.i);
      };
      const groupOf = p => { const dir = FS.dirname(p); const g = collect().find(x => x.dir === dir); return g ? g.items : folderImages(dir, true); };

      /* ======================= VIEWER ======================= */
      let stage, pic, zoomLbl, nameLbl, prevBtn, nextBtn, infoPane, infoBtn, ro = null;
      const btns = {};
      const openViewer = (p, list) => {
        list = (list || folderImages(FS.dirname(p), true)).slice();
        if (!list.includes(p)) list.push(p);
        vlist = list; path = p; zoom = 'fit'; rot = 0;
        if (mode !== 'viewer') buildViewer();
        mode = 'viewer';
        show();
      };
      const buildViewer = () => {
        w.body.innerHTML = '';
        nameLbl = h('div', { class: 'ph-name' });
        zoomLbl = h('div', { class: 'ph-zoom', title: 'Zoom' });
        Object.assign(btns, {
          back: btn('', 'Back to Collection (Esc)', () => backToCollection(), 's_back'),
          out: btn('-', 'Zoom out (-)', () => zoomBy(-1)),
          in: btn('+', 'Zoom in (+)', () => zoomBy(1)),
          fit: btn('Fit', 'Fit to window (Ctrl+0)', () => setZoom('fit')),
          actual: btn('1:1', 'Actual size (Ctrl+1)', () => setZoom(1)),
          rotate: btn('Rotate', 'Rotate 90 degrees clockwise (R)', () => rotate()),
          slide: btn('Slideshow', 'Slideshow (F5)', () => startSlide(vlist, vlist.indexOf(path))),
          del: btn('Delete', 'Delete (Del)', () => path && del(path)),
          edit: btn('Edit in Paint', 'Edit in Paint (Ctrl+E)', () => path && edit(path)),
          more: btn('...', 'See more', e => { const r = Sys.rectOf(btns.more); Menu.show(moreMenu(), r.x, r.y + r.h, { anchorEl: btns.more }); })
        });
        infoBtn = btn('Info', 'File info (I)', () => toggleInfo());
        w.body.appendChild(h('div', { class: 'ph-bar' }, btns.back, nameLbl,
          btns.out, zoomLbl, btns.in, btns.fit, btns.actual, h('div', { class: 'ph-gap' }), btns.rotate, btns.slide, btns.del, btns.edit, infoBtn, btns.more));
        pic = h('div', { class: 'ph-pic' });
        stage = h('div', { class: 'ph-stage', tabindex: '-1' }, pic);
        prevBtn = h('div', { class: 'ph-nav prev', title: 'Previous (Left)' }, iconImg('s_back'));
        nextBtn = h('div', { class: 'ph-nav next', title: 'Next (Right)' }, iconImg('s_fwd'));
        prevBtn.addEventListener('click', () => step(-1)); nextBtn.addEventListener('click', () => step(1));
        infoPane = h('div', { class: 'ph-info' });
        w.body.appendChild(h('div', { class: 'ph-main' }, h('div', { class: 'ph-view' }, stage, prevBtn, nextBtn), infoPane));
        ctx(stage, () => path ? picMenu(path, false) : []);
        stage.addEventListener('dblclick', () => setZoom(zoom === 'fit' ? (curZoom() >= 2 ? 1 : 2) : 'fit'));
        stage.addEventListener('wheel', e => { if (!e.ctrlKey) return; e.preventDefault(); zoomBy(e.deltaY < 0 ? 1 : -1); }, { passive: false });
        // drag to pan a zoomed picture
        stage.addEventListener('pointerdown', e => {
          if (e.button !== 0 || (stage.scrollWidth <= stage.clientWidth && stage.scrollHeight <= stage.clientHeight)) return;
          e.preventDefault();
          const sx = e.clientX, sy = e.clientY, l = stage.scrollLeft, t = stage.scrollTop, sc = Sys.scale || 1;
          const mv = ev => { stage.scrollLeft = l - (ev.clientX - sx) / sc; stage.scrollTop = t - (ev.clientY - sy) / sc; };
          const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); };
          document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
        });
        ro = new ResizeObserver(() => { if (mode === 'viewer' && zoom === 'fit') draw(); });
        ro.observe(stage);
      };
      const moreMenu = () => !path ? [] : [
        { label: 'Set as desktop &background', action: () => setBackground(path) },
        { label: '&Copy', keyLabel: 'Ctrl+C', key: 'Ctrl+C', action: () => copy(path) },
        { label: 'File &info', checked: () => info, action: () => toggleInfo() },
        '-',
        { label: 'Open file &location', action: () => openLocation(path) },
        { label: 'P&roperties', action: () => FileOps.properties(path, w) }
      ];
      const show = async () => {
        const my = ++token, p = path;
        const idx = vlist.indexOf(p);
        nameLbl.textContent = shown(p);
        nameLbl.title = p;
        w.setTitle(`${shown(p)} - Photos`);
        prevBtn.classList.toggle('hidden', idx <= 0);
        nextBtn.classList.toggle('hidden', idx < 0 || idx >= vlist.length - 1);
        btns.del.classList.toggle('dis', inWindows(p));
        cur = null;
        pic.replaceChildren(h('div', { class: 'ph-msg', text: 'Loading...' }));
        renderInfo();
        const r = await load(p);
        if (my !== token || mode !== 'viewer') return;
        cur = r;
        draw(true);
        renderInfo();
      };
      const curZoom = () => {
        if (!cur) return 1;
        if (zoom !== 'fit') return zoom;
        const rw = rot % 2 ? cur.h : cur.w, rh = rot % 2 ? cur.w : cur.h;
        return fitStep(rw, rh, Math.max(16, stage.clientWidth - 16), Math.max(16, stage.clientHeight - 16));
      };
      const draw = (fresh) => {
        if (!pic) return;
        if (!cur) { pic.replaceChildren(h('div', { class: 'ph-msg', text: "Photos can't display this picture." })); zoomLbl.textContent = ''; return; }
        const cx = stage.scrollWidth ? (stage.scrollLeft + stage.clientWidth / 2) / stage.scrollWidth : .5;
        const cy = stage.scrollHeight ? (stage.scrollTop + stage.clientHeight / 2) / stage.scrollHeight : .5;
        const z = curZoom();
        if (!cur.view || cur.viewRot !== rot) { cur.view = rot ? rotated(cur.src, cur.w, cur.h, rot) : cur.src; cur.viewRot = rot; }
        const el = cur.view, rw = rot % 2 ? cur.h : cur.w, rh = rot % 2 ? cur.w : cur.h;
        el.style.width = Math.max(1, Math.round(rw * z)) + 'px';
        el.style.height = Math.max(1, Math.round(rh * z)) + 'px';
        if (pic.firstChild !== el || pic.childNodes.length !== 1) pic.replaceChildren(el);
        zoomLbl.textContent = Math.round(z * 100) + '%';
        btns.out.classList.toggle('dis', z <= STEPS[0] + 1e-9);
        btns.in.classList.toggle('dis', z >= STEPS[STEPS.length - 1] - 1e-9);
        btns.fit.classList.toggle('on', zoom === 'fit');
        btns.actual.classList.toggle('on', z === 1);
        if (fresh) { stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) / 2; stage.scrollTop = (stage.scrollHeight - stage.clientHeight) / 2; }
        else { stage.scrollLeft = cx * stage.scrollWidth - stage.clientWidth / 2; stage.scrollTop = cy * stage.scrollHeight - stage.clientHeight / 2; }
      };
      const setZoom = z => { if (!cur) return; zoom = z; draw(); };
      const zoomBy = dir => {
        if (!cur) return;
        const z = curZoom();
        const next = dir > 0 ? STEPS.find(s => s > z + 1e-9) : [...STEPS].reverse().find(s => s < z - 1e-9);
        if (next != null) setZoom(next);
      };
      const step = d => {
        const i = vlist.indexOf(path) + d;
        if (i < 0 || i >= vlist.length) return;
        flushRot();
        path = vlist[i]; zoom = 'fit'; rot = 0;
        show();
      };
      const toggleInfo = () => { info = !info; Store.set('photos.info', info); renderInfo(); if (zoom === 'fit') draw(); };
      const renderInfo = () => {
        if (!infoPane) return;
        infoPane.style.display = info ? '' : 'none';
        infoBtn.classList.toggle('on', info);
        if (!info || !path) return;
        const n = FS.get(path);
        if (!n) return;
        const d = cur && cur.path === path ? { w: rot % 2 ? cur.h : cur.w, h: rot % 2 ? cur.w : cur.h } : dimsOf(path);
        const row = (k, v) => [h('div', { class: 'neo-h2', text: k }), h('div', { class: 'ph-ival', text: v })];
        const where = btn('Open file location', 'Open file location', () => openLocation(path));
        infoPane.replaceChildren(h('div', { class: 'ph-ihead', text: 'File info' }),
          ...row('File name', shown(path)),
          ...row('Type', FileOps.typeName(FS.basename(path), n)),
          ...row('Dimensions', d ? `${d.w} x ${d.h} pixels` : '...'),
          ...row('Size', fmtSize(FS.size(n))),
          ...row('Date modified', fmtDate(n.d)),
          ...row('Folder', FS.dirname(path)),
          ...row('Position', `${vlist.indexOf(path) + 1} of ${vlist.length}`),
          h('div', { style: { marginTop: '12px', display: 'flex' } }, where));
      };
      const backToCollection = () => {
        flushRot();
        const was = path;
        token++;
        renderCollection();
        const i = flat.indexOf(was);
        if (i >= 0) setCursor(i);
      };

      /* ---------- rotation: shown at once, saved shortly after (like Windows Photos) ---------- */
      const rotate = () => {
        if (!cur) return;
        rot = (rot + 1) % 4;
        draw(); renderInfo();
        clearTimeout(rotT); rotT = null;
        if (canWrite(cur.path)) rotT = setTimeout(saveRotation, 900);
      };
      const saveRotation = () => {
        clearTimeout(rotT); rotT = null;
        if (!rot || !cur || !canWrite(cur.path)) return;
        const n = FS.get(cur.path);
        const mime = (/^data:(image\/(?:jpeg|webp))[;,]/i.exec(n.x) || [])[1] || 'image/png';
        const c = cur.viewRot === rot && cur.view instanceof HTMLCanvasElement ? cur.view : rotated(cur.src, cur.w, cur.h, rot);
        const url = c.toDataURL(mime, .92);
        const extra = { s: Math.round((url.length - url.indexOf(',') - 1) * 3 / 4) };
        if (n.encoding) extra.encoding = n.encoding;
        if (n.h) extra.h = n.h;
        try { FS.write(cur.path, url, extra); }
        catch (e) { msgBox(`Photos couldn't save the rotated picture.\n${e.message}`, 'Photos', { icon: 'exclaim', owner: w }); return; }
        noteDims(cur.path, c.width, c.height);
        urls.set(cur.path, { k: stamp(FS.get(cur.path)), url });
        // the rotated canvas becomes the picture; nothing visibly changes
        Object.assign(cur, { src: c, w: c.width, h: c.height, view: c, viewRot: 0 });
        rot = 0;
      };
      const flushRot = () => { if (rotT) saveRotation(); };

      /* ======================= SLIDESHOW ======================= */
      const startSlide = (list, start) => {
        list = list.filter(p => isImage(p));
        if (!list.length || slide) return;
        flushRot();
        const ov = h('div', { class: 'ph-slide' });
        Sys.screen.appendChild(ov);
        slide = { ov, list, i: clamp(start, 0, list.length - 1), t: null, n: 0 };
        ov.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); stopSlide(); });
        ov.addEventListener('contextmenu', e => e.preventDefault());
        showSlide();
      };
      const showSlide = async () => {
        const s = slide; if (!s) return;
        clearTimeout(s.t);
        const my = ++s.n, r = await load(s.list[s.i]);
        if (slide !== s || my !== s.n) return;
        if (r) {
          const z = fitStep(r.w, r.h, Sys.screen.clientWidth, Sys.screen.clientHeight);
          r.src.style.width = Math.max(1, Math.round(r.w * z)) + 'px'; r.src.style.height = Math.max(1, Math.round(r.h * z)) + 'px';
          s.ov.replaceChildren(r.src);
        }
        if (typeof Saver !== 'undefined' && Saver.reset) Saver.reset();
        s.t = setTimeout(() => slideBy(1), SLIDE_MS);
      };
      const slideBy = d => { if (!slide) return; slide.i = (slide.i + d + slide.list.length) % slide.list.length; showSlide(); };
      const stopSlide = (closing) => {
        const s = slide; if (!s) return;
        slide = null; clearTimeout(s.t); s.ov.remove();
        if (closing || w.closed) return;
        const p = s.list[s.i];
        if (FS.exists(p)) openViewer(p, mode === 'viewer' && vlist.includes(p) ? vlist : groupOf(p));
      };

      /* ======================= KEYBOARD ======================= */
      const onKey = (e, name) => {
        if (slide) {
          if (['Esc', 'F5', 'Space', 'Enter'].includes(name)) stopSlide();
          else if (['Left', 'Up', 'PageUp'].includes(name)) slideBy(-1);
          else if (['Right', 'Down', 'PageDown'].includes(name)) slideBy(1);
          return true;
        }
        if (isEditable(e.target) || Menu.isOpen()) return false;
        if (mode === 'viewer') {
          switch (name) {
            case 'Left': case 'PageUp': step(-1); return true;
            case 'Right': case 'PageDown': step(1); return true;
            case 'Home': step(-vlist.indexOf(path)); return true;
            case 'End': step(vlist.length - 1 - vlist.indexOf(path)); return true;
            case '+': case '=': case 'Ctrl++': case 'Ctrl+=': case 'Shift+=': zoomBy(1); return true;
            case '-': case 'Ctrl+-': zoomBy(-1); return true;
            case 'Ctrl+0': setZoom('fit'); return true;
            case 'Ctrl+1': setZoom(1); return true;
            case 'R': case 'Ctrl+R': rotate(); return true;
            case 'Del': if (path) del(path); return true;
            case 'Shift+Del': if (path) del(path, true); return true;
            case 'F5': startSlide(vlist, vlist.indexOf(path)); return true;
            case 'Esc': case 'Backspace': backToCollection(); return true;
            case 'Ctrl+E': if (path) edit(path); return true;
            case 'Ctrl+C': if (path) copy(path); return true;
            case 'I': case 'Alt+Enter': toggleInfo(); return true;
          }
          return false;
        }
        switch (name) {
          case 'Left': setCursor(cursor <= 0 ? 0 : cursor - 1); return true;
          case 'Right': setCursor(cursor < 0 ? 0 : cursor + 1); return true;
          case 'Up': vertical(-1); return true;
          case 'Down': if (cursor < 0) setCursor(0); else vertical(1); return true;
          case 'Home': setCursor(0); return true;
          case 'End': setCursor(flat.length - 1); return true;
          case 'Enter': case 'Space': if (flat[cursor]) openViewer(flat[cursor], groupOf(flat[cursor])); return true;
          case 'Del': if (flat[cursor]) del(flat[cursor]); return true;
          case 'Shift+Del': if (flat[cursor]) del(flat[cursor], true); return true;
          case 'F5': startSlide(flat, Math.max(0, cursor)); return true;
          case 'Ctrl+E': if (flat[cursor]) edit(flat[cursor]); return true;
        }
        return false;
      };

      /* ======================= FILE CHANGES ======================= */
      let changeT = null;
      offs.push(FS.on('change', () => {
        clearTimeout(changeT);
        changeT = setTimeout(() => {
          if (w.closed) return;
          if (slide) { slide.list = slide.list.filter(p => isImage(p)); if (!slide.list.length) stopSlide(); else if (slide.i >= slide.list.length) slide.i = 0; }
          if (mode === 'collection') { renderCollection(true); if (cursor >= 0) setCursor(cursor, false); return; }
          if (!path) return;
          const at = vlist.indexOf(path);
          // keep the folder in step with the drive (new pictures appear, deleted ones go)
          const dir = FS.dirname(path), fresh = folderImages(dir, true);
          const keep = vlist.filter(p => FS.dirname(p) !== dir ? isImage(p) : fresh.includes(p));
          for (const p of fresh) if (!keep.includes(p)) keep.push(p);
          keep.sort(byName);
          if (isImage(path)) {
            vlist = keep;
            const n = FS.get(path);
            // the picture itself changed elsewhere (e.g. saved in Paint): reload it
            if (n && cur && cur.path === path && urls.get(path)?.k !== stamp(n) && !rotT) { rot = 0; show(); return; }
            prevBtn.classList.toggle('hidden', vlist.indexOf(path) <= 0);
            nextBtn.classList.toggle('hidden', vlist.indexOf(path) >= vlist.length - 1);
            nameLbl.textContent = shown(path); w.setTitle(`${shown(path)} - Photos`);
            renderInfo();
            return;
          }
          vlist = keep;
          if (!vlist.length) { path = null; renderCollection(); return; }
          path = vlist[clamp(at, 0, vlist.length - 1)]; zoom = 'fit'; rot = 0;
          show();
        }, 120);
      }));
      offs.push(Sys.on('settings', () => { if (!w.closed && mode === 'viewer') renderInfo(); }));
      w.on('closed', () => { offs.forEach(f => f()); clearTimeout(changeT); clearTimeout(rotT); ro && ro.disconnect(); stopSlide(true); });

      /* ======================= OPENING ======================= */
      const openArg = (arg, cwd) => {
        const p = FS.full(String(arg).trim(), cwd || KNOWN.pictures);
        if (FS.isDir(p)) {
          const list = folderImages(p);
          if (list.length) return openViewer(list[0], list);
          if (collect().some(g => g.dir === p)) filter = p;
          return renderCollection();
        }
        if (isImage(p)) return openViewer(p);
        if (mode !== 'viewer') renderCollection();
        msgBox(FS.exists(p) ? `Photos can't open ${shown(p)}.\n\nThis file isn't a picture that Windows 31 can show.` : `Windows can't find '${p}'. Make sure you typed the name correctly, and then try again.`, 'Photos', { icon: 'exclaim', owner: w });
      };
      w._photos = { openArg };
      if (opts.args && String(opts.args).trim()) openArg(opts.args, opts.cwd);
      else renderCollection();
      return w;
    }
  });
})();
