'use strict';
/* Microsoft Edge (Windows 10) in Windows 3.1 clothing.
   Tabs, favourites, history, downloads, find, zoom; a small offline web at windows31.net;
   local files as file:///C:/...; and the live web shown in a frame. */

const EDGE_NEWTAB = 'edge://newtab';

/* ======================= WINDOWS 31 NETWORK — the offline web ======================= */
const OfflineWeb = {
  NEWS: [
    { slug: 'browser', title: 'Windows 31 gets a web browser', tags: 'edge browser internet web tabs favorites history',
      body: ['Microsoft Edge has arrived on Windows 31. It opens pages in tabs, remembers your favourites and history, finds text with Ctrl+F and zooms in whole steps so every pixel stays square.',
        'Pages on the Kronos Network live inside your computer and work without a connection. Other addresses open the live web inside the window. Some sites refuse to be shown inside another page; for those, choose Open in new window.',
        'Edge can also show your own files: type C:\\ in the address bar to browse the disk.'] },
    { slug: 'windows-31', title: 'Looking back: Windows 3.1', tags: 'windows 3.1 history 1992 truetype ole minesweeper file manager',
      body: ['Windows 3.1 was released in April 1992. It brought TrueType fonts, so text looked the same on screen as on paper, and OLE, which let one program\'s document live inside another\'s.',
        'File Manager learned drag and drop, and Minesweeper replaced Reversi in the Games group.',
        'The screen you are reading uses the same bitmap fonts and the same 16 colours.'] },
    { slug: 'minesweeper-121', title: 'Minesweeper tip: the 1-2-1 pattern', tags: 'minesweeper game tip strategy pattern mines',
      body: ['When three numbers read 1-2-1 along a straight edge of uncovered squares, the mines are next to the two 1s. The square next to the 2 is safe.',
        'Look for 1-2-2-1 too: there the mines sit next to the two 2s.',
        'Right-click to flag a mine. Click with both buttons on a number whose mines are all flagged to uncover its other neighbours at once.'] },
    { slug: 'kivotos-autumn', title: 'Autumn comes to Kivotos', tags: 'kivotos shiratori weather autumn october rain typhoon',
      body: ['October in the Shiratori District usually brings highs around 72°F (22°C) and cooler, drier air after the late-summer typhoons.',
        'The rainy season, tsuyu, runs from about early June to mid-July. September is often the wettest month of autumn.',
        'Windows 31\'s Weather app follows the same seasons. Its forecast is simulated, so take an umbrella anyway.'] },
    { slug: 'square-pixels', title: 'Why every pixel here is square', tags: 'pixels display scaling sharp fonts wallpaper tile',
      body: ['Windows 31 scales the whole screen by a whole number of device pixels, so each pixel of every icon, font and wallpaper lands on whole physical pixels. Nothing is smoothed or stretched.',
        'Wallpapers tile at their real size, the way Windows 3.1 drew them. Edge zooms in 100% steps for the same reason.'] }
  ],
  GAMES: [
    { name: 'Minesweeper', cmd: 'WINMINE.EXE', icon: 'winmine', text: 'Clear the minefield without setting one off. Beginner, Intermediate and Expert.' },
    { name: 'Microsoft Solitaire Collection', cmd: 'SOL.EXE', icon: 'sol', text: 'Klondike, with standard or Vegas scoring and the famous bouncing cards.' },
    { name: 'Paint', cmd: 'PBRUSH.EXE', icon: 'pbrush', text: 'Not a game, but just as fun. Draw in sixteen colours.' }
  ],
  FILES: [
    { name: 'STARS.BMP', title: 'Starfield wallpaper', size: 51318, g: 'STARS', text: 'A night sky that tiles across any screen.' },
    { name: 'SUNSET.BMP', title: 'Sunset over the lake', size: 128118, g: 'LOCK31', text: 'The lock-screen picture, for your desktop.' },
    { name: 'HONEY.BMP', title: 'Honeycomb tile', size: 854, g: 'HONEY', text: 'A classic from Windows 3.1.' },
    { name: 'SHORTCUTS.TXT', title: 'Edge keyboard shortcuts', text: 'A text file you can open in Notepad.' }
  ],
  shortcuts: [['Ctrl+T', 'New tab'], ['Ctrl+W', 'Close tab'], ['Ctrl+Shift+T', 'Reopen closed tab'], ['Ctrl+Tab', 'Next tab'], ['Ctrl+L or Alt+D', 'Go to the address bar'],
    ['Alt+Left / Alt+Right', 'Back / Forward'], ['F5 or Ctrl+R', 'Refresh'], ['Ctrl+D', 'Add to favourites'], ['Ctrl+H', 'History'], ['Ctrl+J', 'Downloads'],
    ['Ctrl+F', 'Find on page'], ['Ctrl+P', 'Print'], ['Ctrl++ / Ctrl+- / Ctrl+0', 'Zoom in / out / reset'], ['Ctrl+N', 'New window']],
  NAV: [['home', 'Home', 'https://windows31.net/'], ['news', 'News', 'https://windows31.net/news/'], ['weather', 'Weather', 'https://weather.windows31.net/'],
    ['games', 'Games', 'https://games.windows31.net/'], ['downloads', 'Downloads', 'https://downloads.windows31.net/'], ['help', 'Help', 'https://help.windows31.net/']],

  isOurs(host) { return host === 'windows31.net' || host.endsWith('.windows31.net'); },
  host(u) { return u.hostname.toLowerCase().replace(/^www\./, ''); },

  /* page chrome shared by every Kronos Network site */
  site(active, ...content) {
    return h('div', { class: 'nw' },
      h('div', { class: 'nw-head' },
        h('a', { href: 'https://windows31.net/', class: 'nw-brand' }, iconImg('winlogo'), h('span', { text: 'Kronos Network' })),
        h('div', { class: 'nw-nav' }, ...this.NAV.map(([k, label, url]) => h('a', { href: url, class: k === active ? 'on' : null, text: label })))),
      h('div', { class: 'nw-body' }, ...content),
      h('div', { class: 'nw-foot', text: '© 1992–2026 Kronos Network. Every page here lives inside your computer.' }));
  },
  searchForm(q = '') {
    const inp = h('input', { class: 'tx', name: 'q', value: q, spellcheck: false, style: { width: '320px' } });
    const go = UI.button('Search'); go.type = 'submit';
    return h('form', { class: 'nw-search', action: 'https://search.windows31.net/' }, inp, go);
  },
  newsDate(i) { const d = new Date(Sys.now()); d.setDate(d.getDate() - i * 3); return Intl31.longDate(d); },
  wxBox() {
    const now = Weather.today(), unit = Intl31.get().iMeasure === 0 ? 'C' : 'F';
    return h('div', { class: 'nw-box' }, h('div', { class: 'nw-boxhead', text: 'Weather' }),
      h('div', { class: 'nw-wx' }, iconImg(now.icon), h('span', { class: 'nw-wxt', text: `${now.temp}°${unit}` })),
      h('div', { text: `${now.cond} · ${Weather.city}` }), h('a', { href: 'https://weather.windows31.net/', text: '5-day forecast' }));
  },

  /* the downloadable files; /get/NAME starts a download instead of a page */
  download(url) {
    let u; try { u = new URL(url); } catch { return null; }
    if (this.host(u) !== 'downloads.windows31.net') return null;
    const m = u.pathname.match(/^\/get\/([^/]+)$/i);
    const f = m && this.FILES.find(x => x.name.toUpperCase() === decodeURIComponent(m[1]).toUpperCase());
    if (!f) return null;
    return f.g ? { name: f.name, extra: { g: f.g, s: f.size } } : { name: f.name, text: this.shortcuts.map(([k, v]) => k.padEnd(28) + v).join('\r\n') + '\r\n' };
  },

  /* every offline page with its text, for Arona Search */
  index() {
    const pages = [
      { url: 'https://windows31.net/', title: 'Kronos Network — Home', text: 'News, weather, games and downloads for Windows 31. Search the Kronos Network.' },
      { url: 'https://windows31.net/news/', title: 'News — Kronos Network', text: 'All the latest stories. ' + this.NEWS.map(n => n.title).join('. ') },
      { url: 'https://weather.windows31.net/', title: `Weather for ${Weather.city} — Kronos Network`, text: `Today and the next five days in ${Weather.city}. Temperature, forecast, rain, sunny, cloudy.` },
      { url: 'https://games.windows31.net/', title: 'Game Development Department — Kronos Network', text: this.GAMES.map(g => g.name + ' ' + g.text).join(' ') },
      { url: 'https://downloads.windows31.net/', title: 'Angel 24 Downloads — Kronos Network', text: 'Free wallpapers and files. ' + this.FILES.map(f => f.title + ' ' + f.name + ' ' + f.text).join(' ') },
      { url: 'https://help.windows31.net/', title: 'Microsoft Edge help — Kronos Network', text: 'How to use Microsoft Edge: tabs, favourites, history, downloads, keyboard shortcuts. ' + this.shortcuts.map(s => s.join(' ')).join(' ') }
    ];
    for (const n of this.NEWS) pages.push({ url: 'https://windows31.net/news/' + n.slug, title: n.title + ' — Kronos Press', text: n.body.join(' '), keys: n.tags });
    return pages;
  },
  search(q) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return this.index().map(p => {
      const t = p.title.toLowerCase(), x = (p.text + ' ' + (p.keys || '')).toLowerCase();
      let score = 0;
      for (const w of terms) { if (t.includes(w)) score += 3; if (x.includes(w)) score += 1; }
      return { ...p, score };
    }).filter(p => p.score > 0).sort((a, b) => b.score - a.score);
  },
  snippet(text, q) {
    const w = q.toLowerCase().split(/\s+/).find(t => text.toLowerCase().includes(t));
    let i = w ? Math.max(0, text.toLowerCase().indexOf(w) - 60) : 0;
    if (i) i = text.indexOf(' ', i) + 1;                      // start on a whole word
    let e = Math.min(text.length, i + 180);
    if (e < text.length) e = text.lastIndexOf(' ', e);
    return (i ? '...' : '') + text.slice(i, e) + (e < text.length ? '...' : '');
  },

  /* returns { title, icon, node } for a windows31.net address */
  page(u) {
    const host = this.host(u), path = u.pathname.replace(/\/+$/, '') || '/';
    const P = t => h('p', { text: t });
    if (host === 'windows31.net' && path === '/') {
      const hr = Sys.now().getHours(), greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
      return { title: 'Kronos Network', node: this.site('home',
        h('h1', { text: `${greet}, ${Store.get('userName', 'User')}` }), this.searchForm(),
        h('div', { class: 'nw-cols' },
          h('div', {}, h('h2', { text: 'Headlines' }), ...this.NEWS.map((n, i) => h('div', { class: 'nw-item' }, h('a', { href: 'https://windows31.net/news/' + n.slug, text: n.title }), h('div', { class: 'nw-date', text: this.newsDate(i) })))),
          h('div', {}, this.wxBox(),
            h('div', { class: 'nw-box' }, h('div', { class: 'nw-boxhead', text: 'Popular' }),
              h('div', {}, h('a', { href: 'https://games.windows31.net/', text: 'Play a game' })),
              h('div', {}, h('a', { href: 'https://downloads.windows31.net/', text: 'Free wallpapers' })),
              h('div', {}, h('a', { href: 'https://help.windows31.net/', text: 'Edge keyboard shortcuts' })),
              h('div', {}, h('a', { href: 'https://en.wikipedia.org/wiki/Windows_3.1x', text: 'Windows 3.1 on Wikipedia (live)' })))))) };
    }
    if (host === 'windows31.net' && path === '/news')
      return { title: 'News — Kronos Network', node: this.site('news', h('h1', { text: 'News' }), ...this.NEWS.map((n, i) => h('div', { class: 'nw-item' }, h('a', { href: 'https://windows31.net/news/' + n.slug, text: n.title }), h('div', { class: 'nw-date', text: this.newsDate(i) }), P(n.body[0])))) };
    const nm = host === 'windows31.net' && path.match(/^\/news\/([\w-]+)$/);
    const story = nm && this.NEWS.find(n => n.slug === nm[1]);
    if (story) {
      const i = this.NEWS.indexOf(story), next = this.NEWS[(i + 1) % this.NEWS.length];
      return { title: story.title + ' — Kronos Press', node: this.site('news', h('h1', { text: story.title }), h('div', { class: 'nw-date', text: this.newsDate(i) + ' · Kronos Press' }), h('br'), ...story.body.map(P),
        h('div', { class: 'nw-box' }, 'Next: ', h('a', { href: 'https://windows31.net/news/' + next.slug, text: next.title }))) };
    }
    if (host === 'weather.windows31.net' && path === '/') {
      const now = Weather.today(), unit = Intl31.get().iMeasure === 0 ? 'C' : 'F';
      const rows = [];
      for (let i = 0; i < 5; i++) {
        const d = new Date(Sys.now()); d.setDate(d.getDate() + i);
        const f = Weather.day(d);
        rows.push(h('tr', {}, h('td', { text: i ? Intl31.DAYS[d.getDay()] : 'Today' }), h('td', {}, iconImg(f.icon, 16)), h('td', { text: f.cond }), h('td', { text: `${Weather.unit(f.hi)}° / ${Weather.unit(f.lo)}°` })));
      }
      return { title: `${Weather.city} weather — Kronos Network`, node: this.site('weather', h('h1', { text: `Weather for ${Weather.city}` }),
        h('div', { class: 'nw-wx big' }, iconImg(now.icon), h('span', { class: 'nw-wxt', text: `${now.temp}°${unit}` }), h('span', { text: now.cond })),
        h('h2', { text: 'Five-day forecast' }), h('table', { class: 'nw-table' }, ...rows),
        P(`Temperatures in °${unit}; change units in Settings > Time & Language > Region. The forecast is simulated.`),
        h('a', { href: 'windows31-run:WEATHER', text: 'Open the Weather app' })) };
    }
    if (host === 'games.windows31.net' && path === '/')
      return { title: 'Game Development Department — Kronos Network', node: this.site('games', h('h1', { text: 'Game Development Department' }), P('Every game here is already installed. Click Play to start it.'),
        ...this.GAMES.map(g => h('div', { class: 'nw-card' }, iconImg(g.icon), h('div', { style: { flex: 1 } }, h('b', { text: g.name }), h('div', { text: g.text })), h('a', { href: 'windows31-run:' + g.cmd, text: 'Play' })))) };
    if (host === 'downloads.windows31.net' && path === '/')
      return { title: 'Angel 24 Downloads — Kronos Network', node: this.site('downloads', h('h1', { text: 'Angel 24 Downloads' }), P('Files are saved to your Downloads folder.'),
        ...this.FILES.map(f => h('div', { class: 'nw-card' }, f.g ? h('div', { class: 'nw-thumb', style: { backgroundImage: `url(${Wallpapers.gen(f.g).toDataURL()})`, backgroundPosition: f.g === 'LOCK10' ? 'left bottom' : 'left top' } }) : iconImg('notepad'),
          h('div', { style: { flex: 1 } }, h('b', { text: f.title }), h('div', { text: f.text }), h('div', { class: 'nw-date', text: `${f.name}${f.size ? ` · ${fmtNum(Math.ceil(f.size / 1024))} KB` : ''}` })),
          h('a', { href: 'https://downloads.windows31.net/get/' + f.name, text: 'Download' })))) };
    if (host === 'help.windows31.net' && path === '/')
      return { title: 'Microsoft Edge help — Kronos Network', node: this.site('help', h('h1', { text: 'Using Microsoft Edge' }),
        P('Type an address or a search in the address bar and press Enter. Press Alt+Enter to open it in a new tab. Click a link with Ctrl held, or with the middle button, to open it in a new tab.'),
        P('Click the star to add the page to your favourites. The Hub button lists favourites, history and downloads.'),
        h('h2', { text: 'Keyboard shortcuts' }), h('table', { class: 'nw-table' }, ...this.shortcuts.map(([k, v]) => h('tr', {}, h('td', {}, h('b', { text: k })), h('td', { text: v }))))) };
    if (host === 'search.windows31.net') {
      const q = (u.searchParams.get('q') || '').trim(), res = this.search(q), enc = encodeURIComponent(q);
      return { title: q ? `${q} - Arona Search` : 'Arona Search', node: this.site(null, h('h1', { text: 'Arona Search' }), this.searchForm(q),
        q ? h('div', { class: 'nw-date', text: res.length ? `${res.length} result${res.length === 1 ? '' : 's'} on the Kronos Network` : `No pages on the Kronos Network match "${q}".` }) : null,
        ...res.map(r => h('div', { class: 'nw-res' }, h('a', { href: r.url, text: r.title }), h('div', { class: 'nw-url', text: r.url.replace(/^https:\/\//, '') }), h('div', { text: this.snippet(r.text, q) }))),
        q ? h('div', { class: 'nw-box' }, h('div', { class: 'nw-boxhead', text: 'Search the live web' }),
          h('div', {}, h('a', { href: `https://en.wikipedia.org/w/index.php?search=${enc}`, text: `Wikipedia: ${q}` })),
          h('div', {}, h('a', { href: `https://www.google.com/search?igu=1&q=${enc}`, text: `Google: ${q}` })),
          h('div', {}, h('a', { href: `https://www.bing.com/search?q=${enc}`, 'data-external': '1', text: `Bing: ${q} (opens outside Windows 31)` })),
          h('div', {}, h('a', { href: `https://duckduckgo.com/?q=${enc}`, 'data-external': '1', text: `DuckDuckGo: ${q} (opens outside Windows 31)` }))) : null) };
    }
    return { title: 'Page not found', node: this.site(null, h('h1', { text: 'Page not found' }), P(`There's no page at ${u.href.replace(/^https:\/\//, '')}.`), h('a', { href: 'https://windows31.net/', text: 'Go to the Kronos Network home page' })) };
  }
};

/* ======================= EDGE ======================= */
const Edge = {
  browsers: new Set(),
  opt(k, d) { return Store.get('edge.' + k, d); },
  set(k, v) { Store.set('edge.' + k, v); this.browsers.forEach(b => b.chrome()); },
  favs() { return Store.get('edge.favs', [{ title: 'Kronos Network', url: 'https://windows31.net/' }, { title: 'Weather', url: 'https://weather.windows31.net/' }, { title: 'Games', url: 'https://games.windows31.net/' }, { title: 'Wikipedia', url: 'https://en.wikipedia.org/' }]); },
  setFavs(f) { this.set('favs', f); },
  history() { return Store.get('edge.hist', []); },
  downloads() { return Store.get('edge.dl', []); },
  homeURL() { return this.opt('home', 'newtab') === 'newtab' ? EDGE_NEWTAB : this.opt('homeURL', 'https://windows31.net/'); },
  searchURL(q) {
    const e = encodeURIComponent(q);
    return { wikipedia: `https://en.wikipedia.org/w/index.php?search=${e}`, google: `https://www.google.com/search?igu=1&q=${e}` }[this.opt('engine', 'offline')] || `https://search.windows31.net/?q=${e}`;
  },
  /* what the user typed -> an address */
  toURL(input) {
    const u = this.rawURL(input);
    try { return /^https?:/i.test(u) ? new URL(u).href : u; } catch { return u; }   // one spelling per address
  },
  rawURL(input) {
    const t = String(input || '').trim();
    if (!t) return EDGE_NEWTAB;
    if (/^(edge|about):/i.test(t)) return t.toLowerCase().replace(/^about:(?!blank)/, 'edge://');
    if (/^windows31-run:/i.test(t)) return t;
    if (/^[a-z]:\\/i.test(t) || /^[a-z]:$/i.test(t)) return 'file:///' + t.replace(/\\/g, '/').replace(/^([a-z]:)$/i, '$1/');
    if (/^(https?|file):/i.test(t)) return t;
    if (!/\s/.test(t) && (/^localhost(:\d+)?(\/|$)/i.test(t) || /^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(:\d+)?(\/.*)?$/i.test(t))) return 'https://' + t;
    return this.searchURL(t);
  },
  addHistory(url, title) {
    if (!this.opt('keepHistory', true) || url === EDGE_NEWTAB || url === 'about:blank' || url.startsWith('edge://')) return;
    const h0 = this.history().filter(x => x.url !== url);
    h0.unshift({ url, title, t: Sys.now().getTime() });
    Store.set('edge.hist', h0.slice(0, 300));
  },
  visited(url) { return this.history().some(x => x.url === url); },
  download(d, owner) {
    const dir = KNOWN.downloads;
    if (!FS.isDir(dir)) FS.mkdir(dir);
    const name = FileOps.uniqueName(dir, d.name), path = FS.join(dir, name);
    try { FS.write(path, d.text || '', d.extra || {}); }
    catch (e) { msgBox(`Couldn't download ${d.name}.\n${e.message}`, 'Microsoft Edge', { icon: 'stop', owner }); return null; }
    Store.set('edge.dl', [{ name, path, t: Sys.now().getTime() }, ...this.downloads()].slice(0, 100));
    Shell31.notify({ app: 'Microsoft Edge', icon: 'edge', title: 'Download complete', text: `${FileOps.shownName(name, FS.get(path))} finished downloading.`, onClick: () => FileOps.open(path) });
    return path;
  },
  clearData() { Store.set('edge.hist', []); Store.set('edge.dl', []); Store.set('edge.session', null); this.browsers.forEach(b => b.chrome()); }
};

/* ---------- edge:// pages ---------- */
const EdgePages = {
  newtab(b) {
    const inp = h('input', { class: 'tx', placeholder: 'Search or enter web address', spellcheck: false });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); b.go(inp.value, e.altKey); } });
    const seen = {};
    for (const x of Edge.history()) seen[x.url] = seen[x.url] || x;
    const top = [...Edge.favs(), ...Object.values(seen)].filter((x, i, a) => a.findIndex(y => y.url === x.url) === i).slice(0, 8);
    const sites = h('div', { class: 'edge-sites' }, ...top.map(s => {
      let host = s.url; try { host = OfflineWeb.host(new URL(s.url)) || s.url; } catch { }
      const ic = EdgeIcon(s.url);
      return h('a', { href: s.url, class: 'edge-site raised' }, iconImg({ s_winlogo: 'winlogo', s_globe: 'globe', s_docs: 'fdocs' }[ic] || ic), h('div', { text: s.title || host }));
    }));
    setTimeout(() => inp.focus(), 0);
    return { title: 'New tab', node: h('div', { class: 'edge-nt' },
      h('div', { class: 'edge-ntsearch sunken' }, iconImg('s_search'), inp),
      h('div', { class: 'edge-nthead', text: 'Top sites' }), sites,
      h('div', { class: 'edge-ntfeed' }, h('div', { class: 'edge-nthead', text: 'My news feed' }),
        h('div', { class: 'edge-ntcols' }, h('div', {}, ...OfflineWeb.NEWS.slice(0, 4).map((n, i) => h('div', { class: 'nw-item' }, h('a', { href: 'https://windows31.net/news/' + n.slug, text: n.title }), h('div', { class: 'nw-date', text: OfflineWeb.newsDate(i) })))), OfflineWeb.wxBox()))) };
  },
  history(b) {
    const filter = h('input', { class: 'tx', placeholder: 'Search history', spellcheck: false, style: { width: '260px' } });
    const list = h('div');
    const draw = () => {
      list.innerHTML = '';
      const q = filter.value.trim().toLowerCase();
      const items = Edge.history().filter(x => !q || (x.title + ' ' + x.url).toLowerCase().includes(q));
      if (!items.length) { list.appendChild(h('p', { text: q ? 'No history matches your search.' : 'Pages you visit will show up here.' })); return; }
      let day = null;
      for (const x of items) {
        const d = Intl31.longDate(new Date(x.t));
        if (d !== day) { day = d; list.appendChild(h('h2', { text: d })); }
        const del = h('span', { class: 'edge-rowx', title: 'Remove' }, iconImg('s_x'));
        del.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); Store.set('edge.hist', Edge.history().filter(y => !(y.url === x.url && y.t === x.t))); draw(); });
        list.appendChild(h('div', { class: 'edge-row' }, h('span', { class: 'nw-date', text: Intl31.time(new Date(x.t)) }), iconImg(EdgeIcon(x.url), 16), h('a', { href: x.url, text: x.title || x.url }), del));
      }
    };
    filter.addEventListener('input', draw);
    draw();
    const clear = UI.button('Clear all history', { onClick: () => { Store.set('edge.hist', []); draw(); } });
    return { title: 'History', node: h('div', { class: 'nw nw-body' }, h('h1', { text: 'History' }), h('div', { class: 'nw-search' }, filter, clear), list) };
  },
  favorites(b) {
    const list = h('div');
    const draw = () => {
      list.innerHTML = '';
      const favs = Edge.favs();
      if (!favs.length) list.appendChild(h('p', { text: 'Click the star in the address bar to add a favourite.' }));
      favs.forEach((f, i) => {
        const ren = h('span', { class: 'edge-rowx', title: 'Rename' }, iconImg('s_docs'));
        const del = h('span', { class: 'edge-rowx', title: 'Delete' }, iconImg('s_x'));
        const up = h('span', { class: 'edge-rowx', title: 'Move up' }, iconImg('s_upfolder'));
        ren.addEventListener('click', async e => { e.preventDefault(); const n = await Edge.askName(f.title, b.w); if (n) { const a = Edge.favs(); a[i] = { ...a[i], title: n }; Edge.setFavs(a); draw(); } });
        del.addEventListener('click', e => { e.preventDefault(); Edge.setFavs(Edge.favs().filter((_, j) => j !== i)); draw(); });
        up.addEventListener('click', e => { e.preventDefault(); if (!i) return; const a = Edge.favs(); [a[i - 1], a[i]] = [a[i], a[i - 1]]; Edge.setFavs(a); draw(); });
        list.appendChild(h('div', { class: 'edge-row' }, iconImg(EdgeIcon(f.url), 16), h('a', { href: f.url, text: f.title }), h('span', { class: 'nw-date', text: f.url }), up, ren, del));
      });
    };
    draw();
    return { title: 'Favourites', node: h('div', { class: 'nw nw-body' }, h('h1', { text: 'Favourites' }), list) };
  },
  downloads(b) {
    const list = h('div');
    const draw = () => {
      list.innerHTML = '';
      const dl = Edge.downloads();
      if (!dl.length) { list.appendChild(h('p', {}, 'Files you download will show up here. Try ', h('a', { href: 'https://downloads.windows31.net/', text: 'Angel 24 Downloads' }), '.')); return; }
      for (const d of dl) {
        const there = FS.exists(d.path);
        const open = h('a', { href: '#', text: 'Open', onclick: e => { e.preventDefault(); FileOps.open(d.path); } });
        const folder = h('a', { href: '#', text: 'Show in folder', onclick: e => { e.preventDefault(); Sys.launch(`EXPLORER "${FS.dirname(d.path)}"`); } });
        list.appendChild(h('div', { class: 'edge-row' }, iconImg(FileOps.iconFor(d.name, FS.get(d.path) || { t: 'f' }, 16), 16), h('b', { text: d.name }), h('span', { class: 'nw-date', text: there ? `${Intl31.date(new Date(d.t))} ${Intl31.time(new Date(d.t))}` : 'Deleted' }), there ? open : null, there ? folder : null));
      }
    };
    draw();
    return { title: 'Downloads', node: h('div', { class: 'nw nw-body' }, h('h1', { text: 'Angel 24 Downloads' }), h('div', { class: 'nw-search' }, UI.button('Open Downloads folder', { onClick: () => Sys.launch('EXPLORER ' + KNOWN.downloads) }), UI.button('Clear list', { onClick: () => { Store.set('edge.dl', []); draw(); } })), list) };
  },
  settings(b) {
    const el = h('div', { class: 'nw nw-body edge-set' });
    const homeURL = UI.text(Edge.opt('homeURL', 'https://windows31.net/')); homeURL.style.position = 'relative'; homeURL.style.width = '260px';
    homeURL.addEventListener('change', () => Edge.set('homeURL', Edge.toURL(homeURL.value)));
    const startURL = UI.text(Edge.opt('startURL', 'https://windows31.net/')); startURL.style.position = 'relative'; startURL.style.width = '260px';
    startURL.addEventListener('change', () => Edge.set('startURL', Edge.toURL(startURL.value)));
    el.append(h('h1', { text: 'Settings' }),
      SP.combo('Open Microsoft Edge with', [['newtab', 'A new tab page'], ['continue', 'Previous pages'], ['page', 'A specific page']], () => Edge.opt('startup', 'newtab'), v => Edge.set('startup', v)),
      h('div', { class: 'w31-sfield' }, h('div', { class: 'w31-slabel', text: 'Specific page' }), startURL),
      SP.toggle('Show the home button', () => Edge.opt('homeBtn', false), v => Edge.set('homeBtn', v)),
      SP.combo('Home button opens', [['newtab', 'New tab page'], ['url', 'A specific page']], () => Edge.opt('home', 'newtab'), v => Edge.set('home', v)),
      h('div', { class: 'w31-sfield' }, h('div', { class: 'w31-slabel', text: 'Home page' }), homeURL),
      SP.combo('Show the favourites bar', [['newtab', 'Only on new tabs'], ['always', 'Always'], ['never', 'Never']], () => Edge.opt('favbar', 'newtab'), v => Edge.set('favbar', v)),
      SP.combo('Search in the address bar with', [['offline', 'Arona Search (offline)'], ['wikipedia', 'Wikipedia (live)'], ['google', 'Google (live)']], () => Edge.opt('engine', 'offline'), v => Edge.set('engine', v)),
      SP.combo('Default zoom', [['1', '100%'], ['2', '200%'], ['3', '300%']], () => String(Edge.opt('zoom', 1)), v => Edge.set('zoom', +v)),
      SP.toggle('Save browsing history', () => Edge.opt('keepHistory', true), v => Edge.set('keepHistory', v)),
      h('div', { class: 'w31-sfield' }, h('div', { class: 'w31-slabel', text: 'Clear browsing data' }), SP.p('Deletes your history, the downloads list and saved tabs. Downloaded files stay in your Downloads folder.'),
        SP.button('Clear now', async () => { if (await msgBox('Clear your history, downloads list and saved tabs?', 'Microsoft Edge', { buttons: 'yesno', icon: 'question', owner: b.w }) === 'yes') Edge.clearData(); })),
      h('h2', { text: 'About Microsoft Edge' }), h('p', { text: 'Microsoft Edge 1.0.31 (16-bit) for Windows 31.' }),
      h('p', {}, 'Pages on ', h('a', { href: 'https://windows31.net/', text: 'windows31.net' }), ' work offline. Other sites load live from the internet; some don\'t allow themselves to be shown inside another page.'));
    return { title: 'Settings', node: el };
  },
  error(b, url) {
    return { title: 'Can\'t reach this page', node: h('div', { class: 'nw nw-body' }, h('h1', { text: 'Hmm, we can\'t reach this page.' }), h('p', { text: `Make sure you've got the right web address: ${url}` }), h('a', { href: Edge.searchURL(url), text: `Search for "${url}"` })) };
  }
};
EdgePages.about = EdgePages.settings;
EdgePages.help = EdgePages.settings;

/* favicon for an address */
function EdgeIcon(url) {
  if (/^edge:/.test(url)) return { 'edge://history': 's_restart', 'edge://favorites': 's_star', 'edge://downloads': 's_down', 'edge://settings': 's_gear' }[url.replace(/\/$/, '')] || 'edge';
  if (/^file:/.test(url)) return 's_docs';
  try { if (OfflineWeb.isOurs(OfflineWeb.host(new URL(url)))) return 's_winlogo'; } catch { }
  return 's_globe';
}

Edge.askName = (cur, owner) => new Promise(res => dialog({
  title: 'Favourite', w: 300, h: 74, owner,
  build(d) {
    const t = UI.text(cur);
    d.add(UI.label('&Name:', t), 10, 12); d.add(t, 60, 8, 150);
    d.add(UI.button('OK', { default: true, onClick: () => { d.close(); res(t.value.trim()); } }), 218, 6, 74, 25);
    d.add(UI.button('Cancel', { cancel: true, onClick: () => { d.close(); res(null); } }), 218, 36, 74, 25);
    setTimeout(() => { t.focus(); t.select(); }, 0);
  }
}));

/* local files: file:///C:/WINDOWS/... */
function edgeLocal(url) {
  let path = decodeURIComponent(url.replace(/^file:\/*/i, '')).replace(/\//g, '\\');
  if (/^[a-z]:$/i.test(path)) path += '\\';
  const n = FS.get(path);
  if (!n) return { title: 'File not found', node: h('div', { class: 'nw nw-body' }, h('h1', { text: 'Hmm, we can\'t find that file.' }), h('p', { text: `It may have been moved, edited or deleted: ${path}` })) };
  const full = FS.full(path), toURL = p => 'file:///' + p.replace(/\\/g, '/');
  const title = full === 'C:\\' ? 'C:\\' : FileOps.shownName(FS.basename(full), n);
  if (n.t === 'd') {
    const parent = FS.dirname(full);
    const rows = (FS.list(full) || []).filter(e => !e.node.h).sort((a, b) => (b.node.t === 'd') - (a.node.t === 'd') || a.name.localeCompare(b.name)).map(e => {
      const p = FS.join(full, e.name);
      return h('tr', {}, h('td', {}, iconImg(FileOps.iconFor(e.name, e.node, 16), 16)), h('td', {}, h('a', { href: toURL(p), text: FileOps.shownName(e.name, e.node) + (e.node.t === 'd' ? '\\' : '') })),
        h('td', { class: 'num', text: e.node.t === 'd' ? '' : fmtNum(FS.size(e.node)) }), h('td', { text: e.node.d ? `${Intl31.date(new Date(e.node.d))} ${Intl31.time(new Date(e.node.d))}` : '' }));
    });
    return { title: 'Index of ' + full, icon: 's_folder', node: h('div', { class: 'nw nw-body' }, h('h1', { text: 'Index of ' + full }),
      parent && parent !== full ? h('p', {}, h('a', { href: toURL(parent), text: '[parent directory]' })) : null,
      h('table', { class: 'nw-table' }, h('tr', {}, h('th'), h('th', { text: 'Name' }), h('th', { class: 'num', text: 'Size' }), h('th', { text: 'Date modified' })), ...rows)) };
  }
  const ext = FS.ext(full);
  const img = n.g ? Wallpapers.gen(n.g)?.toDataURL() : (typeof n.x === 'string' && n.x.startsWith('data:image') ? n.x : null);
  if (img) return { title, node: h('div', { class: 'edge-img' }, h('img', { src: img })) };
  if (ext === 'HTM' || ext === 'HTML') return { title, frameDoc: String(n.x || '') };
  if (['TXT', 'INI', 'BAT', 'LOG', 'SYS', 'CSV', 'MD', 'JSON', 'JS', 'CSS', 'XML'].includes(ext) || (typeof n.x === 'string' && !n.a && /^[\x09\x0a\x0d\x20-\x7e\xa0-\xff]*$/.test(n.x.slice(0, 400)) && n.x.length))
    return { title, node: h('pre', { class: 'edge-pre', text: String(n.x || '') }) };
  return { title, node: h('div', { class: 'nw nw-body' }, h('h1', { text: title }), h('p', { text: `Microsoft Edge can't show ${FileOps.typeName(full, n).replace(/^[A-Z]/, c => c.toLowerCase())} files.` }),
    h('a', { href: '#', text: 'Open it with Windows', onclick: e => { e.preventDefault(); FileOps.open(full); } })) };
}

/* ======================= THE BROWSER WINDOW ======================= */
Sys.registerApp('edge', {
  name: 'Microsoft Edge', icon: 'edge', help: 'progman',
  run(opts) {
    const tabs = [], closed = [];
    let cur = null, findHits = [], findIdx = 0;
    const btn = (icon, title, fn) => { const b = h('div', { class: 'w31-xbtn', title }, iconImg(icon)); b.addEventListener('click', e => { if (!b.classList.contains('dis')) fn(e); }); return b; };

    /* ---------- chrome ---------- */
    const strip = h('div', { class: 'edge-tabs' });
    const plus = h('div', { class: 'edge-plus', title: 'New tab (Ctrl+T)' }, iconImg('s_plus'));
    plus.addEventListener('click', () => newTab(EDGE_NEWTAB));
    const back = btn('s_back', 'Back (Alt+Left)', () => goBack());
    const fwd = btn('s_fwd', 'Forward (Alt+Right)', () => goFwd());
    const reload = btn('s_restart', 'Refresh (F5)', () => cur.loading ? stop() : load(cur));
    const home = btn('s_home', 'Home', () => go(Edge.homeURL()));
    const siteIco = h('span', { class: 'edge-siteico' });
    const addr = h('input', { class: 'edge-addrin', spellcheck: false, placeholder: 'Search or enter web address' });
    const star = h('span', { class: 'edge-star', title: 'Add to favourites (Ctrl+D)' });
    const addrBox = h('div', { class: 'edge-addr sunken' }, siteIco, addr, star);
    const hub = btn('s_hub', 'Favourites, history and downloads', e => hubMenu());
    const more = btn('s_more', 'Settings and more', e => moreMenu());
    const bar = h('div', { class: 'w31-xbar edge-bar' }, back, fwd, reload, home, addrBox, hub, more);
    const favbar = h('div', { class: 'edge-favbar' });
    const findIn = h('input', { class: 'tx', spellcheck: false, placeholder: 'Find on page' });
    const findCount = h('span', { class: 'edge-findn' });
    const findbar = h('div', { class: 'edge-find hidden' }, findIn, findCount, btn('s_back', 'Previous', () => findStep(-1)), btn('s_fwd', 'Next', () => findStep(1)), btn('s_x', 'Close (Esc)', () => closeFind()));
    const views = h('div', { class: 'edge-views' });
    const status = h('div', { class: 'edge-status hidden' });
    views.appendChild(status);
    const dlbar = h('div', { class: 'edge-dlbar hidden' });
    const sugg = h('div', { class: 'edge-sugg hidden' });

    const w = new Win({ title: 'Microsoft Edge', icon: 'edge', w: Math.min(900, Sys.desktop.W - 30), h: Math.min(600, Sys.desktop.H - 30), persist: 'edge', onKey: (e, name) => key(e, name) });
    w.body.classList.add('edge');
    w.body.append(strip, bar, favbar, findbar, views, dlbar, sugg);
    const B = { w, go: (u, newT) => go(u, newT), chrome: () => chrome() };
    Edge.browsers.add(B);

    /* ---------- tabs ---------- */
    const newTab = (url, activate = true, after = cur) => {
      if (cur && (/^windows31-run:/i.test(url) || OfflineWeb.download(url))) { navigate(cur, url); return cur; }
      const t = { url: null, title: 'New tab', icon: 'edge', back: [], fwd: [], zoom: Edge.opt('zoom', 1), view: h('div', { class: 'edge-view hidden' }), loading: false };
      tabs.splice(after ? tabs.indexOf(after) + 1 : tabs.length, 0, t);
      views.insertBefore(t.view, status);
      navigate(t, url, false);
      if (activate || !cur) select(t); else renderTabs();
      if (activate && url === EDGE_NEWTAB) setTimeout(() => t.view.querySelector('input')?.focus(), 0);
      return t;
    };
    const select = t => {
      cur = t;
      tabs.forEach(x => x.view.classList.toggle('hidden', x !== t));
      closeFind(); hideSugg();
      chrome();
    };
    const closeTab = t => {
      const i = tabs.indexOf(t);
      if (i < 0) return;
      if (t.url && t.url !== EDGE_NEWTAB) closed.push({ url: t.url, back: t.back, fwd: t.fwd });
      tabs.splice(i, 1); t.view.remove();
      if (!tabs.length) { w.close(); return; }
      if (t === cur) select(tabs[Math.min(i, tabs.length - 1)]); else renderTabs();
    };
    const renderTabs = () => {
      strip.innerHTML = '';
      for (const t of tabs) {
        const x = h('span', { class: 'edge-tx', title: 'Close tab (Ctrl+W)' }, iconImg('s_x'));
        const el = h('div', { class: 'edge-tab' + (t === cur ? ' on' : ''), title: t.title }, iconImg(t.loading ? 's_restart' : t.icon, 16), h('span', { class: 'edge-tt', text: t.title }), x);
        x.addEventListener('click', e => { e.stopPropagation(); closeTab(t); });
        el.addEventListener('pointerdown', e => { if (e.button === 0 && !e.target.closest('.edge-tx')) select(t); });
        el.addEventListener('auxclick', e => { if (e.button === 1) closeTab(t); });
        el.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); const p = Sys.pointer(e); Menu.show(tabMenu(t), p.x, p.y); });
        strip.appendChild(el);
      }
      strip.appendChild(plus);
    };
    const tabMenu = t => [
      { label: '&New tab', key: 'Ctrl+T', action: () => newTab(EDGE_NEWTAB, true, t) },
      { label: '&Refresh', action: () => load(t) },
      { label: '&Duplicate', action: () => newTab(t.url, true, t) },
      '-',
      { label: '&Close tab', key: 'Ctrl+W', action: () => closeTab(t) },
      { label: 'Close &other tabs', disabled: tabs.length < 2, action: () => tabs.filter(x => x !== t).forEach(closeTab) },
      { label: 'Close tabs to the righ&t', disabled: tabs.indexOf(t) === tabs.length - 1, action: () => tabs.slice(tabs.indexOf(t) + 1).forEach(closeTab) },
      '-',
      { label: 'R&eopen closed tab', key: 'Ctrl+Shift+T', disabled: !closed.length, action: reopen }];
    const reopen = () => { const c = closed.pop(); if (!c) return; const t = newTab(c.url); t.back = c.back; t.fwd = c.fwd; chrome(); };

    /* ---------- navigation ---------- */
    const go = (input, inNewTab) => {
      const url = Edge.toURL(input);
      if (inNewTab) newTab(url); else navigate(cur, url);
    };
    const navigate = (t, url, push = true) => {
      if (/^windows31-run:/i.test(url)) { Sys.launch(decodeURIComponent(url.replace(/^windows31-run:/i, '')), { caller: 'Microsoft Edge' }); return; }
      const dl = OfflineWeb.download(url);
      if (dl) { const p = Edge.download(dl, w); if (p) showDl(p); return; }
      if (push && t.url) { t.back.push(t.url); t.fwd = []; }
      t.url = url;
      load(t);
    };
    const goBack = () => { if (!cur.back.length) return; cur.fwd.push(cur.url); cur.url = cur.back.pop(); load(cur); };
    const goFwd = () => { if (!cur.fwd.length) return; cur.back.push(cur.url); cur.url = cur.fwd.pop(); load(cur); };
    const stop = () => { const f = cur.view.querySelector('iframe'); if (f) f.src = 'about:blank'; cur.loading = false; chrome(); };

    const load = t => {
      const url = t.url;
      t.view.innerHTML = ''; t.loading = false; t.doc = null;
      status.classList.add('hidden');
      let page, u = null;
      try { u = new URL(url); } catch { }
      if (url === 'about:blank') page = { title: 'Blank page', node: h('div') };
      else if (/^edge:/i.test(url)) { const name = url.replace(/^edge:\/*/i, '').replace(/\/.*$/, ''); page = (EdgePages[name] || EdgePages.newtab)(B); }
      else if (/^file:/i.test(url)) page = edgeLocal(url);
      else if (u && /^https?:$/.test(u.protocol) && OfflineWeb.isOurs(OfflineWeb.host(u))) page = OfflineWeb.page(u);
      else if (u && /^https?:$/.test(u.protocol)) page = null;
      else page = EdgePages.error(B, url);

      if (page && page.frameDoc != null) {
        // a local .HTM file: shown as written, scripts off
        const fr = h('iframe', { class: 'edge-frame', sandbox: '' });
        fr.srcdoc = page.frameDoc;
        t.view.appendChild(fr); fr.style.zoom = t.zoom;
        t.title = page.title; t.icon = 's_docs';
      } else if (page) {
        const doc = h('div', { class: 'edge-doc' }, page.node);
        doc.style.zoom = t.zoom;
        doc.querySelectorAll('a[href]').forEach(a => { if (Edge.visited(a.getAttribute('href'))) a.classList.add('vis'); });
        hookDoc(t, doc);
        t.view.appendChild(doc); t.doc = doc;
        t.title = page.title; t.icon = page.icon || EdgeIcon(url);
      } else {
        // the live web
        const host = u.hostname.replace(/^www\./, '');
        const fr = h('iframe', { title: `Live page from ${host}`, class: 'edge-frame', src: url, referrerpolicy: 'no-referrer', sandbox: 'allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-modals' });
        const ext = UI.button('Open in new window', { onClick: () => window.open(url, '_blank', 'noopener') });
        const info = h('div', { class: 'edge-info' }, iconImg('s_globe', 16), h('span', { text: `Live page from ${host}. If this page stays blank or refuses to connect, open it in a new window.` }), ext);
        fr.style.zoom = t.zoom;
        t.loading = true;
        fr.addEventListener('load', () => { t.loading = false; if (t === cur) chrome(); else renderTabs(); });
        t.view.append(info, fr);
        t.title = host; t.icon = 's_globe';
      }
      Edge.addHistory(url, t.title);
      if (t === cur) { chrome(); closeFind(); } else renderTabs();
    };

    /* links and forms inside our own pages */
    const hookDoc = (t, doc) => {
      const follow = (href, e) => {
        if (!href || href === '#') return;
        if (e && e.target.closest('a')?.dataset.external) { window.open(href, '_blank', 'noopener'); return; }
        let url = href;
        try { if (!/^[a-z][\w+.-]*:/i.test(href)) url = new URL(href, t.url).href; } catch { }
        if (e && (e.ctrlKey || e.button === 1)) newTab(url, e.shiftKey, t); else navigate(t, url);
      };
      doc.addEventListener('click', e => {
        const a = e.target.closest('a[href]');
        if (!a || e.defaultPrevented) return;
        e.preventDefault();
        follow(a.getAttribute('href'), e);
      });
      doc.addEventListener('auxclick', e => { const a = e.target.closest('a[href]'); if (a && e.button === 1) { e.preventDefault(); follow(a.getAttribute('href'), e); } });
      doc.addEventListener('submit', e => {
        e.preventDefault();
        const f = e.target, q = new URLSearchParams(new FormData(f)).toString();
        navigate(t, f.getAttribute('action').replace(/\?.*$/, '') + '?' + q);
      });
      doc.addEventListener('mouseover', e => { const a = e.target.closest('a[href]'); if (a && a.getAttribute('href') !== '#') { status.textContent = a.getAttribute('href'); status.classList.remove('hidden'); } });
      doc.addEventListener('mouseout', e => { if (e.target.closest('a[href]')) status.classList.add('hidden'); });
      doc.addEventListener('contextmenu', e => {
        e.preventDefault(); e.stopPropagation();
        const a = e.target.closest('a[href]'), p = Sys.pointer(e), sel = String(getSelection());
        const items = a ? [
          { label: 'Open in new &tab', action: () => newTab(new URL(a.getAttribute('href'), t.url.startsWith('http') ? t.url : undefined).href, false, t) },
          { label: 'Open in new &window', action: () => Sys.run('edge', { args: a.href }) },
          { label: 'Copy &link', action: () => Sys.setClipboard({ type: 'text', data: a.getAttribute('href') }) }]
          : [{ label: '&Back', disabled: !t.back.length, action: goBack }, { label: '&Forward', disabled: !t.fwd.length, action: goFwd }, { label: '&Refresh', action: () => load(t) }, '-',
            ...(sel ? [{ label: '&Copy', action: () => Sys.setClipboard({ type: 'text', data: sel }) }, { label: `&Search for "${sel.slice(0, 20)}"`, action: () => newTab(Edge.searchURL(sel), true, t) }, '-'] : []),
            { label: 'Select &all', action: () => { const r = document.createRange(); r.selectNodeContents(doc); getSelection().removeAllRanges(); getSelection().addRange(r); } },
            { label: '&Print...', action: print }];
        Menu.show(items, p.x, p.y);
      });
    };

    /* ---------- the toolbar, favourites bar, title ---------- */
    const isFav = () => Edge.favs().some(f => f.url === cur.url);
    const chrome = () => {
      if (!cur || w.closed) return;
      renderTabs();
      back.classList.toggle('dis', !cur.back.length);
      fwd.classList.toggle('dis', !cur.fwd.length);
      reload.replaceChildren(iconImg(cur.loading ? 's_x' : 's_restart')); reload.title = cur.loading ? 'Stop (Esc)' : 'Refresh (F5)';
      home.classList.toggle('hidden', !Edge.opt('homeBtn', false));
      if (document.activeElement !== addr) addr.value = cur.url === EDGE_NEWTAB ? '' : cur.url;
      siteIco.replaceChildren(iconImg(/^https:/.test(cur.url) && !OfflineWeb.isOurs(safeHost(cur.url)) ? 's_lock' : EdgeIcon(cur.url), 16));
      const canFav = !/^edge:|^about:/.test(cur.url);
      star.replaceChildren(iconImg(isFav() ? 's_star' : 's_staroff', 16));
      star.classList.toggle('hidden', !canFav);
      const fb = Edge.opt('favbar', 'newtab');
      favbar.classList.toggle('hidden', !(fb === 'always' || (fb === 'newtab' && cur.url === EDGE_NEWTAB)));
      favbar.innerHTML = '';
      for (const f of Edge.favs()) {
        const it = h('div', { class: 'edge-fav', title: f.url }, iconImg(EdgeIcon(f.url), 16), h('span', { text: f.title }));
        it.addEventListener('click', e => go(f.url, e.ctrlKey));
        it.addEventListener('auxclick', e => { if (e.button === 1) go(f.url, true); });
        favbar.appendChild(it);
      }
      w.setTitle(`${cur.title} - Microsoft Edge`);
    };
    const safeHost = url => { try { return OfflineWeb.host(new URL(url)); } catch { return ''; } };
    const toggleFav = () => {
      if (/^edge:|^about:/.test(cur.url)) return;
      Edge.setFavs(isFav() ? Edge.favs().filter(f => f.url !== cur.url) : [...Edge.favs(), { title: cur.title, url: cur.url }]);
    };
    const addFav = () => { if (!isFav()) toggleFav(); };
    star.addEventListener('click', toggleFav);

    /* ---------- address bar & suggestions ---------- */
    let suggList = [], suggSel = -1;
    const hideSugg = () => { sugg.classList.add('hidden'); suggList = []; suggSel = -1; };
    const showSugg = () => {
      const q = addr.value.trim().toLowerCase();
      if (!q) { hideSugg(); return; }
      const pool = [...Edge.favs(), ...Edge.history()].filter((x, i, a) => a.findIndex(y => y.url === x.url) === i);
      const hits = pool.filter(x => (x.title + ' ' + x.url).toLowerCase().includes(q)).slice(0, 6);
      suggList = [...hits.map(x => ({ icon: EdgeIcon(x.url), text: x.title, sub: x.url, url: x.url })), { icon: 's_search', text: addr.value.trim(), sub: 'Search', url: Edge.toURL(addr.value) }];
      suggSel = -1;
      sugg.innerHTML = '';
      suggList.forEach((s, i) => {
        const r = h('div', { class: 'edge-srow' }, iconImg(s.icon, 16), h('span', { text: s.text }), h('span', { class: 'nw-date', text: s.sub }));
        r.addEventListener('pointerdown', e => { e.preventDefault(); hideSugg(); addr.blur(); navigate(cur, s.url); });
        sugg.appendChild(r);
      });
      const a = addrBox.getBoundingClientRect(), b = w.body.getBoundingClientRect();
      Object.assign(sugg.style, { left: (a.left - b.left) / Sys.scale + 'px', top: (a.bottom - b.top) / Sys.scale + 'px', width: a.width / Sys.scale + 'px' });
      sugg.classList.remove('hidden');
    };
    const markSugg = () => [...sugg.children].forEach((r, i) => r.classList.toggle('hot', i === suggSel));
    addr.addEventListener('focus', () => setTimeout(() => addr.select(), 0));
    addr.addEventListener('blur', () => setTimeout(hideSugg, 100));
    addr.addEventListener('input', showSugg);
    addr.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!suggList.length) return;
        e.preventDefault();
        const n = suggList.length;   // -1 is the typed text itself
        suggSel = e.key === 'ArrowDown' ? (suggSel + 1 >= n ? -1 : suggSel + 1) : (suggSel - 1 < -1 ? n - 1 : suggSel - 1);
        markSugg();
        if (suggSel >= 0) addr.value = suggList[suggSel].url.startsWith('https://search.windows31.net') ? suggList[suggSel].text : suggList[suggSel].url;
      } else if (e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation();
        const s = suggSel >= 0 ? suggList[suggSel] : null;
        hideSugg(); addr.blur();
        if (s) navigate(cur, s.url); else go(addr.value, e.altKey);
      } else if (e.key === 'Escape') {
        e.stopPropagation(); hideSugg(); addr.value = cur.url === EDGE_NEWTAB ? '' : cur.url; addr.blur();
      }
    });

    /* ---------- menus ---------- */
    const anchor = (el, items) => { const r = Sys.rectOf(el); Menu.show(items, Math.max(0, r.x + r.w - 210), r.y + r.h, { anchorH: r.h }); };
    const hubMenu = () => anchor(hub, [
      { label: '&Favourites', items: Edge.favs().length ? Edge.favs().map(f => ({ label: f.title.replace(/&/g, '&&'), action: () => go(f.url) })) : [{ label: '(Empty)', disabled: true }] },
      { label: '&Manage favourites', key: 'Ctrl+I', action: () => go('edge://favorites') },
      '-',
      { label: '&History', key: 'Ctrl+H', action: () => go('edge://history') },
      { label: '&Downloads', key: 'Ctrl+J', action: () => go('edge://downloads') }]);
    const zoomTo = z => { cur.zoom = clamp(z, 1, 3); const d = cur.view.querySelector('.edge-doc, iframe'); if (d) d.style.zoom = cur.zoom; };
    const moreMenu = () => anchor(more, [
      { label: 'New &tab', key: 'Ctrl+T', action: () => newTab(EDGE_NEWTAB) },
      { label: 'New &window', key: 'Ctrl+N', action: () => Sys.run('edge', { args: EDGE_NEWTAB }) },
      '-',
      { label: `&Zoom (${cur.zoom * 100}%)`, items: [1, 2, 3].map(z => ({ label: z * 100 + '%', checked: () => cur.zoom === z, action: () => zoomTo(z) })) },
      { label: '&Find on page', key: 'Ctrl+F', action: openFind },
      { label: '&Print...', key: 'Ctrl+P', action: print },
      '-',
      { label: isFav() ? 'Remove from fa&vourites' : 'Add to fa&vourites', key: 'Ctrl+D', action: toggleFav, disabled: /^edge:|^about:/.test(cur.url) },
      { label: '&Favourites bar', items: [['newtab', 'Only on new tabs'], ['always', 'Always'], ['never', 'Never']].map(([k, l]) => ({ label: l, checked: () => Edge.opt('favbar', 'newtab') === k, action: () => Edge.set('favbar', k) })) },
      { label: '&History', key: 'Ctrl+H', action: () => go('edge://history') },
      { label: '&Downloads', key: 'Ctrl+J', action: () => go('edge://downloads') },
      '-',
      { label: 'Open in a &real browser', disabled: !/^https?:/.test(cur.url) || OfflineWeb.isOurs(safeHost(cur.url)), action: () => window.open(cur.url, '_blank', 'noopener') },
      { label: '&Settings', action: () => go('edge://settings') },
      { label: '&Help', action: () => go('https://help.windows31.net/') },
      '-',
      { label: '&Close Microsoft Edge', action: () => w.close() }]);

    /* ---------- find on page ---------- */
    const clearHits = () => { for (const m of findHits) { const p = m.parentNode; if (p) { p.replaceChild(document.createTextNode(m.textContent), m); p.normalize(); } } findHits = []; };
    const runFind = () => {
      clearHits();
      const q = findIn.value.toLowerCase(), doc = cur.doc;
      if (!q || !doc) { findCount.textContent = doc || !q ? '' : 'Not available on this page'; return; }
      const walker = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT), nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const n of nodes) {
        let s = n.nodeValue, i;
        let node = n;
        while ((i = s.toLowerCase().indexOf(q)) >= 0) {
          const mid = node.splitText(i), rest = mid.splitText(q.length);
          const m = h('mark', { class: 'edge-hit', text: mid.nodeValue }); mid.replaceWith(m); findHits.push(m);
          node = rest; s = rest.nodeValue;
        }
      }
      findIdx = 0; findStep(0);
    };
    const findStep = d => {
      if (!findHits.length) { findCount.textContent = findIn.value ? 'No results' : ''; return; }
      findIdx = (findIdx + d + findHits.length) % findHits.length;
      findHits.forEach((m, i) => m.classList.toggle('cur', i === findIdx));
      findHits[findIdx].scrollIntoView({ block: 'nearest' });
      findCount.textContent = `${findIdx + 1} of ${findHits.length}`;
    };
    function openFind() { findbar.classList.remove('hidden'); findIn.focus(); findIn.select(); if (findIn.value) runFind(); }
    function closeFind() { if (findbar.classList.contains('hidden')) return; clearHits(); findbar.classList.add('hidden'); findCount.textContent = ''; }
    findIn.addEventListener('input', runFind);
    findIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); findStep(e.shiftKey ? -1 : 1); } if (e.key === 'Escape') { e.stopPropagation(); closeFind(); } });

    function print() {
      if (!cur.doc) { msgBox('Pages from the live web can\'t be printed from Windows 31. Choose "Open in a real browser" and print from there.', 'Microsoft Edge', { icon: 'info', owner: w }); return; }
      printDoc('Microsoft Edge', cur.title, cur.url + '\n\n' + cur.doc.innerText, w);
    }

    /* ---------- downloads bar ---------- */
    const showDl = path => {
      const name = FS.basename(path);
      dlbar.innerHTML = '';
      dlbar.append(iconImg(FileOps.iconFor(name, FS.get(path), 16), 16), h('span', { style: { flex: 1 }, text: `${FileOps.shownName(name, FS.get(path))} finished downloading.` }),
        UI.button('Open', { onClick: () => FileOps.open(path) }), UI.button('Open folder', { onClick: () => Sys.launch('EXPLORER ' + KNOWN.downloads) }),
        UI.button('View downloads', { onClick: () => { dlbar.classList.add('hidden'); go('edge://downloads'); } }),
        btn('s_x', 'Close', () => dlbar.classList.add('hidden')));
      dlbar.classList.remove('hidden');
    };

    /* ---------- keyboard ---------- */
    const key = (e, name) => {
      const k = {
        'Ctrl+T': () => newTab(EDGE_NEWTAB), 'Ctrl+N': () => Sys.run('edge', { args: EDGE_NEWTAB }),
        'Ctrl+W': () => closeTab(cur), 'Ctrl+F4': () => closeTab(cur), 'Ctrl+Shift+T': reopen,
        'Ctrl+Tab': () => select(tabs[(tabs.indexOf(cur) + 1) % tabs.length]), 'Ctrl+Shift+Tab': () => select(tabs[(tabs.indexOf(cur) - 1 + tabs.length) % tabs.length]),
        'Ctrl+L': () => addr.focus(), 'Alt+D': () => addr.focus(), F6: () => addr.focus(),
        'Alt+Left': goBack, 'Alt+Right': goFwd, 'Alt+Home': () => go(Edge.homeURL()),
        F5: () => load(cur), 'Ctrl+R': () => load(cur),
        'Ctrl+D': addFav, 'Ctrl+H': () => go('edge://history'), 'Ctrl+J': () => go('edge://downloads'), 'Ctrl+I': () => go('edge://favorites'),
        'Ctrl+F': openFind, F3: () => findStep(1), 'Ctrl+P': print,
        'Ctrl+=': () => zoomTo(cur.zoom + 1), 'Ctrl++': () => zoomTo(cur.zoom + 1), 'Ctrl+-': () => zoomTo(cur.zoom - 1), 'Ctrl+0': () => zoomTo(1),
        Esc: () => { if (cur.loading) stop(); else closeFind(); }
      }[name];
      if (!k && /^Ctrl\+[1-9]$/.test(name)) { const n = +name.slice(5); select(n === 9 ? tabs[tabs.length - 1] : tabs[n - 1] || cur); return true; }
      if (!k) return false;
      k(); return true;
    };

    /* clicks inside a live page don't reach us; notice focus moving into a frame instead */
    const onBlur = () => setTimeout(() => { const a = document.activeElement; if (a && a.tagName === 'IFRAME' && w.el.contains(a) && Sys.desktop.active !== w) w.activate(); }, 0);
    window.addEventListener('blur', onBlur);
    const offSettings = Sys.on('settings', () => { if (cur && cur.doc && /windows31\.net/.test(cur.url)) load(cur); });
    w.on('closed', () => {
      Edge.browsers.delete(B); window.removeEventListener('blur', onBlur); offSettings();
      const keep = tabs.map(t => t.url).filter(u => u && u !== EDGE_NEWTAB);
      if (!Edge.browsers.size) Store.set('edge.session', keep.length ? keep : null);
    });

    /* ---------- first tabs ---------- */
    const arg = (opts.args || '').trim();
    if (arg) newTab(Edge.toURL(arg.replace(/^"(.*)"$/, '$1')));
    else {
      const mode = Edge.opt('startup', 'newtab'), sess = Store.get('edge.session', null);
      if (mode === 'continue' && sess && sess.length && Edge.browsers.size === 1) sess.forEach((u, i) => newTab(u, i === 0));
      else if (mode === 'page') newTab(Edge.opt('startURL', 'https://windows31.net/'));
      else newTab(EDGE_NEWTAB);
    }
    return w;
  }
});
