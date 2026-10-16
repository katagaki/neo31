'use strict';
/* Pixel-art icons. Every icon is a 32x32 (or 16x16) bitmap in the standard
   16-colour VGA palette, plotted pixel by pixel (no anti-aliasing, no vectors)
   and rendered to PNG. Displayed with image-rendering: pixelated. */

const PAL = {
  K: [0, 0, 0], W: [255, 255, 255], S: [192, 192, 192], G: [128, 128, 128],
  R: [255, 0, 0], r: [128, 0, 0], Y: [255, 255, 0], y: [128, 128, 0],
  L: [0, 255, 0], g: [0, 128, 0], C: [0, 255, 255], c: [0, 128, 128],
  B: [0, 0, 255], N: [0, 0, 128], M: [255, 0, 255], m: [128, 0, 128]
};

/* Tiny bitmap font for lettering inside icons */
const PIXFONT = {
  A: ['.KK.', 'K..K', 'K..K', 'KKKK', 'K..K', 'K..K'],
  B: ['KKK.', 'K..K', 'KKK.', 'K..K', 'K..K', 'KKK.'],
  C: ['.KKK', 'K...', 'K...', 'K...', 'K...', '.KKK'],
  D: ['KKK.', 'K..K', 'K..K', 'K..K', 'K..K', 'KKK.'],
  E: ['KKKK', 'K...', 'KKK.', 'K...', 'K...', 'KKKK'],
  F: ['KKKK', 'K...', 'KKK.', 'K...', 'K...', 'K...'],
  I: ['KKK', '.K.', '.K.', '.K.', '.K.', 'KKK'],
  J: ['...K', '...K', '...K', '...K', 'K..K', '.KK.'],
  M: ['K...K', 'KK.KK', 'K.K.K', 'K...K', 'K...K', 'K...K'],
  N: ['K..K', 'KK.K', 'K.KK', 'K..K', 'K..K', 'K..K'],
  O: ['.KK.', 'K..K', 'K..K', 'K..K', 'K..K', '.KK.'],
  P: ['KKK.', 'K..K', 'K..K', 'KKK.', 'K...', 'K...'],
  R: ['KKK.', 'K..K', 'K..K', 'KKK.', 'K.K.', 'K..K'],
  S: ['.KKK', 'K...', '.KK.', '...K', '...K', 'KKK.'],
  T: ['KKKKK', '..K..', '..K..', '..K..', '..K..', '..K..'],
  V: ['K...K', 'K...K', 'K...K', '.K.K.', '.K.K.', '..K..'],
  a: ['....', '.KK.', '...K', '.KKK', 'K..K', '.KKK'],
  b: ['K...', 'K...', 'KKK.', 'K..K', 'K..K', 'KKK.'],
  c: ['....', '....', '.KKK', 'K...', 'K...', '.KKK'],
  '0': ['.KK.', 'K..K', 'K..K', 'K..K', 'K..K', '.KK.'],
  '3': ['KKK.', '...K', '.KK.', '...K', '...K', 'KKK.'],
  '6': ['.KK.', 'K...', 'KKK.', 'K..K', 'K..K', '.KK.'],
  '8': ['.KK.', 'K..K', '.KK.', 'K..K', 'K..K', '.KK.'],
  '.': ['.', '.', '.', '.', '.', 'K'],
  W: ['K...K', 'K...K', 'K...K', 'K.K.K', 'KK.KK', 'K...K'],
  '1': ['.K.', 'KK.', '.K.', '.K.', '.K.', 'KKK'],
  '-': ['...', '...', 'KKK', '...', '...', '...'],
  ' ': ['..', '..', '..', '..', '..', '..'],
  L: ['K...', 'K...', 'K...', 'K...', 'K...', 'KKKK'],
  U: ['K..K', 'K..K', 'K..K', 'K..K', 'K..K', '.KK.'],
  G: ['.KKK', 'K...', 'K.KK', 'K..K', 'K..K', '.KKK'],
  H: ['K..K', 'K..K', 'KKKK', 'K..K', 'K..K', 'K..K'],
  K: ['K..K', 'K.K.', 'KK..', 'K.K.', 'K..K', 'K..K'],
  Q: ['.KK.', 'K..K', 'K..K', 'K..K', 'K.KK', '.KKK'],
  X: ['K...K', '.K.K.', '..K..', '..K..', '.K.K.', 'K...K'],
  Y: ['K...K', '.K.K.', '..K..', '..K..', '..K..', '..K..'],
  Z: ['KKKK', '...K', '..K.', '.K..', 'K...', 'KKKK'],
  '2': ['KKK.', '...K', '.KK.', 'K...', 'K...', 'KKKK'],
  '4': ['K..K', 'K..K', 'KKKK', '...K', '...K', '...K'],
  '5': ['KKKK', 'K...', 'KKK.', '...K', '...K', 'KKK.'],
  '7': ['KKKK', '...K', '..K.', '.K..', '.K..', '.K..'],
  '9': ['.KK.', 'K..K', '.KKK', '...K', '...K', '.KK.'],
  '!': ['K', 'K', 'K', 'K', '.', 'K'],
  '?': ['KKK.', '...K', '.KK.', '.K..', '....', '.K..'],
  ',': ['.', '.', '.', '.', 'K', 'K'],
  "'": ['K', 'K', '.', '.', '.', '.'],
  ':': ['.', 'K', '.', '.', 'K', '.'],
  '§': ['.KK', 'K..', 'KK.', 'K.K', '.KK', '..K'],
  'Ω': ['.KKK.', 'K...K', 'K...K', 'K...K', '.K.K.', 'KK.KK'],
  'ß': ['.KK.', 'K..K', 'KKK.', 'K..K', 'K..K', 'KKK.'],
  'Æ': ['.KKKK', 'K.K..', 'K.KKK', 'KKK..', 'K.K..', 'K.KKK'],
  '©': ['.KKK.', 'K...K', 'K.KKK', 'K.K.K', 'K...K', '.KKK.']
};

class PixGrid {
  constructor(w = 32, hh = 32) { this.w = w; this.h = hh; this.d = new Array(w * hh).fill(null); }
  p(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c; return this; }
  get(x, y) { return this.d[y * this.w + x]; }
  f(x, y, w, hh, c) { for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) this.p(x + i, y + j, c); return this; }
  o(x, y, w, hh, c = 'K') {
    for (let i = 0; i < w; i++) { this.p(x + i, y, c); this.p(x + i, y + hh - 1, c); }
    for (let j = 0; j < hh; j++) { this.p(x, y + j, c); this.p(x + w - 1, y + j, c); }
    return this;
  }
  b(x, y, w, hh, fill, c = 'K') { this.f(x, y, w, hh, fill); return this.o(x, y, w, hh, c); }
  /* raised 3D box with black outline */
  bev(x, y, w, hh, face = 'S') {
    this.b(x, y, w, hh, face);
    this.l(x + 1, y + 1, x + w - 3, y + 1, 'W'); this.l(x + 1, y + 1, x + 1, y + hh - 3, 'W');
    this.l(x + w - 2, y + 1, x + w - 2, y + hh - 2, 'G'); this.l(x + 1, y + hh - 2, x + w - 2, y + hh - 2, 'G');
    return this;
  }
  l(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.p(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }
  inDisc(i, j, cx, cy, r) { return (i - cx) ** 2 + (j - cy) ** 2 <= r * r; }
  disc(cx, cy, r, c) {
    for (let j = Math.floor(cy - r); j <= cy + r; j++) for (let i = Math.floor(cx - r); i <= cx + r; i++) if (this.inDisc(i, j, cx, cy, r)) this.p(i, j, c);
    return this;
  }
  ring(cx, cy, r, c) {
    for (let j = Math.floor(cy - r); j <= cy + r; j++) for (let i = Math.floor(cx - r); i <= cx + r; i++)
      if (this.inDisc(i, j, cx, cy, r) && !(this.inDisc(i - 1, j, cx, cy, r) && this.inDisc(i + 1, j, cx, cy, r) && this.inDisc(i, j - 1, cx, cy, r) && this.inDisc(i, j + 1, cx, cy, r))) this.p(i, j, c);
    return this;
  }
  /* filled ellipse inside box, with optional outline colour */
  ell(x, y, w, hh, c, oc) {
    const cx = x + (w - 1) / 2, cy = y + (hh - 1) / 2, rx = w / 2, ry = hh / 2;
    const inn = (i, j) => ((i - cx) / rx) ** 2 + ((j - cy) / ry) ** 2 <= 1;
    for (let j = y; j < y + hh; j++) for (let i = x; i < x + w; i++) if (inn(i, j)) {
      const edge = !(inn(i - 1, j) && inn(i + 1, j) && inn(i, j - 1) && inn(i, j + 1));
      this.p(i, j, edge && oc ? oc : c);
    }
    return this;
  }
  /* paste an ASCII map; '.' and ' ' are transparent */
  m(x, y, rows, map) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '.' || ch === ' ') return;
      this.p(x + i, y + j, map && map[ch] ? map[ch] : ch);
    }));
    return this;
  }
  t(x, y, str, c = 'K', s = 1) {
    for (const ch of str) {
      const gl = PIXFONT[ch];
      if (!gl) { x += 3 * s; continue; }
      gl.forEach((row, j) => [...row].forEach((k, i) => { if (k === 'K') this.f(x + i * s, y + j * s, s, s, c); }));
      x += (gl[0].length + 1) * s;
    }
    return this;
  }
  textW(str, s = 1) { let w = 0; for (const ch of str) w += ((PIXFONT[ch]?.[0].length ?? 2) + 1) * s; return w - s; }
  canvas() {
    const cv = document.createElement('canvas');
    cv.width = this.w; cv.height = this.h;
    const x = cv.getContext('2d'), img = x.createImageData(this.w, this.h);
    this.d.forEach((c, i) => {
      if (!c) return;
      const rgb = PAL[c] || [255, 0, 255];
      img.data.set([...rgb, 255], i * 4);
    });
    x.putImageData(img, 0, 0);
    return cv;
  }
}

const FOLDER32 = [
  '.KKKKK........',
  'KYYYYYK.......',
  'KYYYYYYKKKKKK.',
  'KYWWWWWWWWWWYK',
  'KYWYYYYYYYYYyK',
  'KYWYYYYYYYYYyK',
  'KYWYYYYYYYYYyK',
  'KYWYYYYYYYYYyK',
  'KYWYYYYYYYYYyK',
  'KYWYYYYYYYYYyK',
  'KYyyyyyyyyyyyK',
  'KKKKKKKKKKKKKK'];

/* page with folded corner */
function pageIcon(g, x, y, w, hh, lines = 'K') {
  for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) {
    const inCorner = i > w - 7 && j < 6 - (w - 1 - i);
    if (!inCorner) g.p(x + i, y + j, 'W');
  }
  g.l(x, y, x + w - 7, y, 'K'); g.l(x, y, x, y + hh - 1, 'K'); g.l(x, y + hh - 1, x + w - 1, y + hh - 1, 'K');
  g.l(x + w - 1, y + 6, x + w - 1, y + hh - 1, 'K'); g.l(x + w - 7, y, x + w - 1, y + 6, 'K');
  g.l(x + w - 7, y, x + w - 7, y + 6, 'K'); g.l(x + w - 7, y + 6, x + w - 1, y + 6, 'K');
  /* A recessed grey edge gives document icons a little depth at 32px. */
  g.l(x + w - 2, y + 7, x + w - 2, y + hh - 2, 'S');
  g.l(x + 1, y + hh - 2, x + w - 2, y + hh - 2, 'S');
  for (let j = 1; j < 6; j++) for (let i = 1; i < j + 1; i++) g.p(x + w - 7 + i, y + j, 'S');
  if (lines) for (let j = y + 9; j < y + hh - 3; j += 3) g.l(x + 3, j, x + w - 4 - ((j / 3) % 2 ? 3 : 0), j, lines);
}

/* Rasterised waving Windows flag (no anti-aliasing) */
function flagGrid(W, H) {
  const g = new PixGrid(W, H);
  const panes = [[0, 0, 'R'], [1, 0, 'L'], [0, 1, 'B'], [1, 1, 'Y']];
  const fx0 = W * 0.30, fw = W * 0.66, fy0 = H * 0.12, fh = H * 0.74, gap = Math.max(1, Math.round(W / 40));
  const wave = x => Math.round(Math.sin((x - fx0) / fw * Math.PI * 2) * H * 0.045);
  for (let x = Math.floor(fx0); x < fx0 + fw; x++) {
    const col = (x - fx0) < fw / 2 ? 0 : 1;
    const local = (x - fx0) - col * fw / 2;
    if (local < gap / 2 && col === 1 || local > fw / 2 - gap / 2 && col === 0) continue;
    const top = Math.round(fy0 + wave(x) - (x - fx0) * 0.06);
    for (let y = top; y < top + fh; y++) {
      const row = (y - top) < fh / 2 ? 0 : 1;
      const ly = (y - top) - row * fh / 2;
      if (ly < gap / 2 && row === 1 || ly > fh / 2 - gap / 2 && row === 0) continue;
      g.p(x, y, panes.find(p => p[0] === col && p[1] === row)[2]);
    }
  }
  // black outline around coloured cells
  const src = g.d.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (src[y * W + x]) continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const xx = x + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < W && yy < H && src[yy * W + xx]; });
    if (n) g.p(x, y, 'K');
  }
  // trailing squares (the "motion" blocks to the left of the flag)
  const sq = Math.max(1, Math.round(W / 16));
  const trail = [[0.22, 0.20, 'R'], [0.14, 0.24, 'R'], [0.07, 0.30, 'R'], [0.22, 0.58, 'B'], [0.13, 0.62, 'B'], [0.05, 0.66, 'B']];
  trail.forEach(([fx, fy, c], i) => { const s = Math.max(1, sq - (i % 3)); g.b(Math.round(W * fx), Math.round(H * fy), s + 1, s + 1, c); });
  return g;
}

const ICON_DEFS = {
  progman: g => {
    g.b(1, 3, 30, 26, 'W'); g.f(2, 4, 28, 4, 'N'); g.f(2, 4, 4, 4, 'S'); g.l(3, 6, 4, 6, 'W'); g.l(6, 4, 6, 7, 'K');
    g.f(25, 4, 5, 4, 'S'); g.l(24, 4, 24, 7, 'K'); g.l(26, 5, 28, 5, 'K'); g.p(27, 6, 'K'); g.l(2, 8, 29, 8, 'K');
    [[5, 'B'], [13, 'R'], [21, 'g']].forEach(([x, c]) => { g.b(x, 11, 7, 6, c); g.p(x + 1, 12, 'W'); g.l(x + 1, 18, x + 5, 18, 'G'); });
    [[5, 'Y'], [13, 'c'], [21, 'M']].forEach(([x, c]) => { g.b(x, 20, 7, 5, c); g.p(x + 1, 21, 'W'); g.l(x + 1, 26, x + 5, 26, 'G'); });
  },
  group: g => {
    g.b(1, 5, 30, 23, 'W'); g.f(2, 6, 28, 3, 'N'); g.f(2, 6, 3, 3, 'S'); g.l(2, 9, 29, 9, 'K');
    [[4, 12, 'B'], [13, 12, 'R'], [22, 12, 'Y'], [4, 20, 'g'], [13, 20, 'c'], [22, 20, 'G']].forEach(([x, y, c]) => { g.b(x, y, 6, 5, c); g.l(x, y + 6, x + 5, y + 6, 'G'); });
  },
  app: g => {
    g.b(2, 4, 28, 24, 'W'); g.f(3, 5, 26, 4, 'N'); g.f(3, 5, 4, 4, 'S'); g.l(4, 7, 5, 7, 'W'); g.l(7, 5, 7, 8, 'K');
    g.l(3, 9, 28, 9, 'K'); g.f(3, 10, 26, 3, 'W'); g.p(5, 11, 'K'); g.p(10, 11, 'K'); g.p(15, 11, 'K'); g.l(3, 13, 28, 13, 'K');
  },
  winfile: g => {
    g.bev(9, 1, 21, 30, 'S');
    for (const y of [4, 17]) { g.bev(12, y, 15, 11, 'S'); g.b(16, y + 3, 7, 3, 'W'); g.f(17, y + 7, 5, 2, 'K'); }
    g.m(1, 13, FOLDER32);
  },
  control: g => {
    g.bev(5, 1, 21, 17, 'S'); g.b(8, 4, 15, 11, 'c'); g.f(10, 6, 7, 4, 'W'); g.f(10, 6, 7, 1, 'N'); g.l(9, 5, 13, 5, 'C');
    g.b(11, 17, 9, 3, 'G');
    g.bev(1, 21, 24, 8, 'S'); for (let r = 0; r < 2; r++) for (let c = 0; c < 9; c++) g.f(4 + c * 2, 23 + r * 2, 1, 1, 'K'); g.l(7, 26 + 0, 16, 26, 'K');
    g.b(26, 20, 5, 9, 'W'); g.l(26, 23, 30, 23, 'K'); g.l(28, 20, 28, 23, 'K'); g.l(28, 19, 28, 15, 'K'); g.l(28, 15, 26, 13, 'K');
  },
  printman: g => {
    g.b(9, 1, 14, 11, 'W'); for (let y = 3; y < 10; y += 2) g.l(11, y, 20, y, 'K');
    g.bev(2, 10, 28, 13, 'S'); g.f(6, 12, 20, 2, 'K'); g.l(3, 20, 28, 20, 'G'); g.f(24, 16, 3, 2, 'L');
    g.b(7, 21, 18, 10, 'W'); for (let y = 24; y < 30; y += 2) g.l(9, y, 20, y, 'K');
  },
  clipbrd: g => {
    g.b(5, 3, 22, 28, 'y'); g.l(6, 4, 25, 4, 'Y'); g.l(6, 4, 6, 29, 'Y');
    g.b(8, 7, 16, 21, 'W'); for (let y = 11; y < 26; y += 3) g.l(10, y, 21, y, 'K');
    g.bev(11, 1, 10, 6, 'S'); g.f(13, 3, 6, 2, 'G');
  },
  dos: g => {
    g.b(0, 3, 32, 26, 'W'); g.f(1, 4, 30, 4, 'N'); g.f(1, 4, 4, 4, 'S'); g.l(2, 6, 3, 6, 'W'); g.l(1, 8, 30, 8, 'K');
    g.f(1, 9, 30, 19, 'K');
    g.t(16 - Math.round(g.textW('MS') / 2), 11, 'MS', 'W'); g.t(16 - Math.round(g.textW('DOS') / 2), 19, 'DOS', 'Y');
  },
  setup: g => {
    g.b(4, 2, 24, 28, 'N'); g.p(5, 28, 'K'); g.p(26, 28, 'K');
    g.bev(9, 2, 14, 10, 'S'); g.f(17, 4, 3, 6, 'N');
    g.b(7, 16, 18, 14, 'W'); for (let y = 19; y < 28; y += 3) g.l(9, y, 22, y, 'N');
    g.f(5, 3, 2, 2, 'W');
  },
  notepad: g => {
    g.b(6, 4, 21, 27, 'W'); g.f(7, 5, 19, 3, 'C'); g.l(7, 8, 25, 8, 'K');
    for (let x = 9; x <= 24; x += 4) g.m(x, 1, ['.K.', 'K.K', 'K.K', 'KWK', '.K.']);
    g.l(10, 9, 10, 29, 'R');
    for (let y = 12; y < 30; y += 3) g.l(7, y, 25, y, 'B');
    g.l(27, 5, 27, 31, 'G'); g.l(7, 31, 27, 31, 'G');
  },
  write: g => {
    pageIcon(g, 3, 2, 21, 28);
    g.m(13, 2, [
      '...............KK.',
      '..............KNNK',
      '.............KNNNK',
      '............KNNNK.',
      '...........KNNNK..',
      '..........KNNNK...',
      '.........KNNNK....',
      '........KNNNK.....',
      '.......KNNNK......',
      '......KNNNK.......',
      '.....KSSSK........',
      '....KSWSK.........',
      '....KWSK..........',
      '...KSSK...........',
      '...KSK............',
      '..KKK.............',
      '..K...............']);
  },
  winword: g => {
    pageIcon(g, 3, 2, 25, 28); g.f(3, 2, 25, 5, 'N'); g.l(4, 2, 26, 2, 'B'); g.t(7, 3, 'W', 'W', 2);
    g.l(8, 12, 23, 12, 'K'); g.l(8, 17, 23, 17, 'K'); g.l(8, 22, 20, 22, 'K');
  },
  excel: g => {
    pageIcon(g, 3, 2, 25, 28); g.f(3, 2, 25, 5, 'g'); g.l(4, 2, 26, 2, 'L'); g.t(6, 3, 'X', 'W', 2);
    g.o(8, 11, 16, 15, 'K'); g.l(16, 12, 16, 24, 'K'); g.l(9, 16, 22, 16, 'K'); g.l(9, 20, 22, 20, 'K');
  },
  powerpoint: g => {
    pageIcon(g, 3, 2, 25, 28); g.f(3, 2, 25, 5, 'r'); g.l(4, 2, 26, 2, 'R'); g.t(6, 3, 'P', 'W', 2);
    g.o(7, 12, 17, 13, 'K'); g.f(15, 15, 3, 8, 'R'); g.l(18, 19, 24, 19, 'K');
  },
  pbrush: g => {
    g.ell(1, 9, 25, 21, 'S', 'K');
    g.ell(13, 21, 6, 5, 'W', 'K');
    g.disc(7, 16, 2.3, 'R'); g.disc(13, 13, 2.3, 'g'); g.disc(19, 15, 2.3, 'B'); g.disc(6, 23, 2.3, 'Y'); g.disc(21, 22, 2.3, 'M');
    g.m(16, 1, [
      '.............KK',
      '............KrrK',
      '...........KrrK.',
      '..........KrrK..',
      '.........KrrK...',
      '........KrrK....',
      '.......KrrK.....',
      '......KrrK......',
      '.....KrrK.......',
      '....KSSK........',
      '...KSWSK........',
      '..KKSSK.........',
      '.KKKKK..........',
      'KKKK............',
      'KK..............']);
  },
  calc: g => {
    g.bev(6, 1, 20, 30, 'S'); g.b(8, 3, 16, 7, 'W'); g.t(15, 4, '0.', 'K');
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const x = 8 + c * 4, y = 12 + r * 4;
      g.f(x, y, 3, 3, c === 3 ? 'R' : 'W'); g.l(x + 3, y, x + 3, y + 3, 'K'); g.l(x, y + 3, x + 3, y + 3, 'K');
    }
  },
  clock: g => {
    g.disc(15.5, 15.5, 15, 'K'); g.disc(15.5, 15.5, 14, 'S'); g.disc(15.5, 15.5, 12, 'K'); g.disc(15.5, 15.5, 11, 'W');
    g.ring(15.5, 15.5, 14, 'K');
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6, x = Math.round(15.5 + 9 * Math.sin(a) - 0.5), y = Math.round(15.5 - 9 * Math.cos(a) - 0.5);
      if (i % 3 === 0) g.f(x, y, 2, 2, 'N'); else g.p(x, y, 'N');
    }
    g.l(15, 15, 15, 8, 'K'); g.l(16, 15, 16, 8, 'K'); g.l(15, 15, 21, 15, 'K'); g.l(15, 16, 21, 16, 'K');
  },
  calendar: g => {
    g.b(3, 5, 26, 25, 'W'); g.f(4, 6, 24, 7, 'R'); g.t(16 - Math.round(g.textW('JAN') / 2), 7, 'JAN', 'W');
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) g.f(5 + c * 4, 15 + r * 4, 2, 2, r === 1 && c === 3 ? 'R' : 'K');
    g.bev(4, 2, 4, 7, 'S'); g.bev(24, 2, 4, 7, 'S');
    g.l(29, 6, 29, 30, 'G'); g.l(4, 30, 29, 30, 'G');
  },
  cardfile: g => {
    const card = (x, y, w, hh) => { g.b(x, y, w, hh, 'W'); g.l(x + 1, y + 4, x + w - 2, y + 4, 'R'); for (let j = y + 7; j < y + hh - 1; j += 3) g.l(x + 2, j, x + w - 3, j, 'B'); g.l(x + 2, y + 2, x + 8, y + 2, 'K'); };
    card(11, 1, 20, 14); card(6, 6, 20, 14); card(1, 12, 22, 19);
  },
  charmap: g => {
    g.b(1, 1, 31, 31, 'W');
    for (const v of [11, 21]) { g.l(v, 1, v, 31, 'K'); g.l(1, v, 31, v, 'K'); }
    g.f(12, 12, 9, 9, 'N');
    [['§', 4, 3], ['Ω', 14, 3], ['ß', 24, 3], ['©', 3, 13], ['A', 15, 13], ['Æ', 23, 13], ['a', 4, 23], ['8', 15, 23], ['?', 24, 23]]
      .forEach(([ch, x, y]) => g.t(x, y, ch, ch === 'A' ? 'W' : 'K'));
  },
  terminal: g => {
    g.bev(1, 1, 22, 18, 'S'); g.f(3, 3, 17, 12, 'K');
    for (let y = 5; y < 14; y += 2) g.l(5, y, 5 + ((y * 7) % 9) + 4, y, 'L');
    g.f(8, 19, 8, 2, 'G'); g.o(8, 19, 8, 2, 'K');
    g.bev(16, 21, 15, 10, 'S');
    g.m(14, 17, ['.KKKKKKKKKKKKKK.', 'KKKKKKKKKKKKKKKK', 'KKK.........KKKK', 'KK...........KK.']);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) g.f(19 + c * 3, 24 + r * 3, 2, 1, 'W');
  },
  soundrec: g => {
    g.m(10, 1, [
      '...KKKKKK...',
      '..KGSGSGSK..',
      '.KSGSGSGSGK.',
      '.KGSGSGSGSK.',
      '.KSGSGSGSGK.',
      '.KGSGSGSGSK.',
      '.KSGSGSGSGK.',
      '.KGSGSGSGSK.',
      '.KSGSGSGSGK.',
      '.KGSGSGSGSK.',
      '.KSGSGSGSGK.',
      '..KGSGSGSK..',
      '...KKKKKK...']);
    g.m(6, 8, [
      'K..................K',
      'K..................K',
      'K..................K',
      'K..................K',
      '.K................K.',
      '..K..............K..',
      '...KK..........KK...',
      '.....KKKKKKKKKK.....']);
    g.f(15, 16, 2, 10, 'K'); g.bev(9, 26, 14, 5, 'S');
  },
  mplayer: g => {
    g.b(2, 5, 28, 22, 'K');
    for (let i = 0; i < 6; i++) { g.f(4 + i * 4 + 1, 7, 2, 2, 'W'); g.f(4 + i * 4 + 1, 23, 2, 2, 'W'); }
    g.f(4, 11, 24, 10, 'c');
    g.m(11, 11, [
      '....KKKKKKKK',
      '....KYYYYYYK',
      '....KYKKKKYK',
      '....KYK..KYK',
      '....KYK..KYK',
      '.KKKKYK.KKYK',
      'KYYYYYKKYYYK',
      'KYYYYYKKYYYK',
      '.KKKKK..KKK.']);
  },
  sol: g => {
    g.b(2, 6, 16, 23, 'B'); g.o(3, 7, 14, 21, 'W');
    for (let y = 8; y < 27; y++) for (let x = 4; x < 16; x++) if ((x + y) % 2) g.p(x, y, 'N');
    g.b(13, 2, 18, 25, 'W'); g.l(31, 4, 31, 27, 'K'); g.l(15, 27, 31, 27, 'K');
    g.t(15, 4, 'A', 'R');
    g.m(17, 11, [
      '.RR...RR.',
      'RRRR.RRRR',
      'RRRRRRRRR',
      'RRRRRRRRR',
      '.RRRRRRR.',
      '..RRRRR..',
      '...RRR...',
      '....R....']);
  },
  winmine: g => {
    g.l(15, 3, 15, 28, 'K'); g.l(16, 3, 16, 28, 'K'); g.l(3, 15, 28, 15, 'K'); g.l(3, 16, 28, 16, 'K');
    g.l(7, 7, 24, 24, 'K'); g.l(8, 7, 25, 24, 'K'); g.l(24, 7, 7, 24, 'K'); g.l(25, 7, 8, 24, 'K');
    g.disc(15.5, 15.5, 8.5, 'K');
    g.f(11, 11, 3, 3, 'W');
  },
  help: g => {
    g.b(5, 2, 23, 27, 'Y'); g.f(6, 3, 3, 25, 'y'); g.l(9, 3, 9, 27, 'K');
    g.f(6, 29, 22, 2, 'W'); g.o(5, 28, 23, 4, 'K'); g.l(9, 29, 26, 29, 'G');
    g.m(12, 6, [
      '..KKKKK..',
      '.KKKKKKK.',
      'KKK...KKK',
      'KK.....KK',
      '.......KK',
      '......KKK',
      '....KKKK.',
      '...KKK...',
      '...KK....',
      '...KK....',
      '.........',
      '...KK....',
      '...KK....']);
  },
  taskman: g => {
    g.b(1, 2, 22, 18, 'W'); g.f(2, 3, 20, 3, 'G'); g.l(2, 6, 21, 6, 'K');
    g.b(8, 11, 23, 19, 'W'); g.f(9, 12, 21, 3, 'N'); g.l(9, 15, 29, 15, 'K');
    for (let y = 18; y < 28; y += 3) g.l(11, y, 26, y, 'G');
  },
  pifedit: g => { pageIcon(g, 5, 1, 22, 30, null); g.f(6, 8, 20, 3, 'N'); g.t(16 - Math.round(g.textW('PIF', 2) / 2), 14, 'PIF', 'K', 2); },
  doc: g => pageIcon(g, 5, 1, 22, 30),
  wri: g => {
    pageIcon(g, 4, 1, 22, 30);
    g.m(14, 12, ['........KK', '.......KNK', '......KNK.', '.....KNK..', '....KNK...', '...KNK....', '..KSK.....', '.KSK......', '.KK.......', 'K.........']);
  },
  bmp: g => {
    g.b(1, 4, 30, 25, 'S'); g.b(3, 6, 26, 21, 'C');
    g.disc(22, 11, 3, 'Y');
    g.m(4, 13, [
      '.......K..............',
      '......KgK.............',
      '.....KgggK.......K....',
      '....KgggggK.....KgK...',
      '...KgggggggK...KgggK..',
      '..KgggggggggK.KgggggK.',
      '.KgggggggggggKgggggggK',
      'Kggggggggggggggggggggg']);
    g.f(4, 21, 24, 5, 'g');
  },
  wav: g => {
    g.b(2, 5, 28, 22, 'K');
    const pts = [[3, 16], [6, 10], [8, 22], [11, 7], [13, 24], [16, 11], [18, 20], [21, 13], [24, 18], [26, 15], [28, 16]];
    for (let i = 1; i < pts.length; i++) g.l(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 'L');
  },
  floppy: g => {
    g.b(4, 2, 24, 28, 'G'); g.bev(9, 2, 14, 10, 'S'); g.f(17, 4, 3, 6, 'K');
    g.b(7, 15, 18, 15, 'W'); for (let y = 18; y < 28; y += 3) g.l(9, y, 22, y, 'K');
    g.f(5, 27, 2, 2, 'K');
  },

  /* ---- Control Panel applets ---- */
  cpColor: g => {
    g.bev(2, 2, 28, 28, 'S');
    [[6, 6, 'R'], [17, 6, 'L'], [6, 17, 'B'], [17, 17, 'Y']].forEach(([x, y, c]) => { g.b(x, y, 9, 9, c); g.l(x + 1, y + 9, x + 9, y + 9, 'G'); g.l(x + 9, y + 1, x + 9, y + 9, 'G'); });
  },
  cpFonts: g => {
    g.m(1, 4, [
      '......KK......',
      '......KK......',
      '.....KKKK.....',
      '.....K.KK.....',
      '....KK.KKK....',
      '....K...KK....',
      '...KK...KKK...',
      '...KKKKKKKK...',
      '..KK.....KKK..',
      '..K.......KK..',
      '.KK.......KKK.',
      'KKKK.....KKKKK']);
    g.t(17, 9, 'a', 'N', 2);
    g.l(1, 22, 30, 22, 'G');
    g.t(4, 25, 'ABC', 'K');
  },
  cpPorts: g => {
    g.m(1, 8, [
      'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
      'KWWWWWWWWWWWWWWWWWWWWWWWWWWWGK',
      '.KWSSSSSSSSSSSSSSSSSSSSSSSSGK.',
      '.KWSKSSKSSKSSKSSKSSKSSKSSSSGK.',
      '..KWSSSSSSSSSSSSSSSSSSSSSSGK..',
      '..KWSSKSSKSSKSSKSSKSSKSSSSGK..',
      '...KWSSSSSSSSSSSSSSSSSSSSGK...',
      '...KGGGGGGGGGGGGGGGGGGGGGGK...',
      '....KKKKKKKKKKKKKKKKKKKKKK....']);
    g.f(13, 17, 6, 10, 'G'); g.o(13, 17, 6, 10, 'K');
  },
  cpMouse: g => {
    g.ell(7, 6, 18, 25, 'W', 'K');
    g.l(8, 15, 23, 15, 'K'); g.l(15, 7, 15, 15, 'K'); g.l(16, 7, 16, 15, 'K');
    g.l(15, 6, 15, 3, 'K'); g.l(15, 3, 18, 1, 'K'); g.l(18, 1, 24, 1, 'K');
  },
  cpDesktop: g => {
    g.bev(2, 2, 28, 21, 'S'); g.b(4, 4, 24, 16, 'c');
    for (let y = 5; y < 19; y++) for (let x = 5; x < 27; x++) if ((x + y) % 4 === 0) g.p(x, y, 'C');
    g.b(8, 7, 13, 9, 'W'); g.f(9, 8, 11, 2, 'N');
    g.b(11, 23, 10, 3, 'G'); g.bev(6, 26, 20, 4, 'S');
  },
  cpKeyboard: g => {
    g.bev(0, 9, 32, 16, 'S');
    for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) g.b(2 + c * 3 + (r % 2), 11 + r * 3, 3, 3, 'W');
    g.b(8, 20, 15, 3, 'W');
  },
  cpPrinters: g => {
    g.b(9, 1, 14, 11, 'W'); for (let y = 3; y < 10; y += 2) g.l(11, y, 20, y, 'K');
    g.bev(2, 10, 28, 13, 'S'); g.f(6, 12, 20, 2, 'K'); g.f(24, 16, 3, 2, 'L');
    g.b(7, 21, 18, 9, 'W'); g.l(9, 24, 20, 24, 'K'); g.l(9, 26, 18, 26, 'K');
  },
  cpIntl: g => {
    g.disc(15.5, 15.5, 13.5, 'B');
    g.m(4, 4, [
      '......gggg..............',
      '....gggggggg......gg....',
      '...ggggggggg....gggggg..',
      '..gggggggg......gggggggg',
      '..ggggggg.......ggggggg.',
      '...ggggg.........ggggg..',
      '....gggg.........gggg...',
      '.....ggg.........ggg....',
      '......ggg.......ggg.....',
      '.......gggg....gggg.....',
      '........ggg....ggg......',
      '........gg......g.......',
      '.........g..............']);
    g.ring(15.5, 15.5, 13.5, 'K');
    g.l(2, 15, 29, 15, 'C');
  },
  cpDateTime: g => {
    g.b(1, 7, 19, 21, 'W'); g.f(2, 8, 17, 5, 'R');
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) g.f(3 + c * 4, 15 + r * 4, 2, 2, 'K');
    g.disc(22, 11, 9, 'K'); g.disc(22, 11, 8, 'W');
    g.l(22, 11, 22, 5, 'K'); g.l(22, 11, 26, 13, 'K'); g.p(22, 4, 'N'); g.p(29, 11, 'N'); g.p(15, 11, 'N'); g.p(22, 18, 'N');
  },
  cp386: g => {
    g.b(6, 6, 20, 20, 'K');
    for (let i = 0; i < 6; i++) { const v = 8 + i * 3; g.f(v, 2, 1, 4, 'S'); g.f(v, 26, 1, 4, 'S'); g.f(2, v, 4, 1, 'S'); g.f(26, v, 4, 1, 'S'); }
    g.t(16 - Math.round(g.textW('386') / 2), 13, '386', 'W');
    g.p(8, 8, 'W');
  },
  cpDrivers: g => {
    g.b(2, 8, 28, 18, 'g'); g.b(6, 11, 8, 8, 'K'); g.b(17, 11, 9, 5, 'K'); g.b(17, 18, 5, 4, 'K');
    for (let i = 0; i < 12; i++) g.f(4 + i * 2, 26, 1, 3, 'Y');
    for (let i = 0; i < 4; i++) { g.p(7 + i * 2, 10, 'S'); g.p(7 + i * 2, 19, 'S'); }
  },
  cpSound: g => {
    g.m(2, 8, [
      '..........KK',
      '.........KSK',
      '........KSSK',
      'KKKKKKKKSSSK',
      'KWWWWWKSSSSK',
      'KWSSSSKSSSSK',
      'KWSSSSKSSSSK',
      'KWSSSSKSSSSK',
      'KWGGGGKSSSSK',
      'KKKKKKKKSSSK',
      '........KSSK',
      '.........KSK',
      '..........KK']);
    for (const [r, x0] of [[5, 16], [9, 16], [13, 16]]) for (let a = -60; a <= 60; a += 4) {
      const rad = a * Math.PI / 180; g.p(x0 + r * Math.cos(rad), 14 + r * Math.sin(rad), 'K');
    }
  },
  cpNetwork: g => {
    g.bev(1, 2, 13, 11, 'S'); g.f(3, 4, 9, 6, 'c'); g.bev(18, 2, 13, 11, 'S'); g.f(20, 4, 9, 6, 'c');
    g.l(7, 13, 7, 22, 'K'); g.l(24, 13, 24, 22, 'K'); g.l(7, 22, 24, 22, 'K');
    g.bev(11, 19, 10, 10, 'G');
  },

  /* ---- Message box symbols ---- */
  mbStop: g => {
    const W = 32, oct = new Set();
    for (let y = 0; y < W; y++) { const f = Math.max(0, 9 - y, y - 22); for (let x = f; x <= 31 - f; x++) oct.add(y * W + x); }
    const erode = set => new Set([...set].filter(i => [1, -1, W, -W].every(d => set.has(i + d)) && i % W !== 0 && i % W !== W - 1));
    const m1 = erode(oct), m2 = erode(m1), m3 = erode(m2);
    oct.forEach(i => g.p(i % W, Math.floor(i / W), 'K'));
    m1.forEach(i => g.p(i % W, Math.floor(i / W), 'R'));
    m2.forEach(i => { if (!m3.has(i)) g.p(i % W, Math.floor(i / W), 'W'); });
    g.t(16 - Math.round(g.textW('STOP') / 2), 13, 'STOP', 'W');
  },
  mbInfo: g => { balloon(g); g.m(14, 6, ['.BB.', '.BB.', '....', 'BBB.', '.BB.', '.BB.', '.BB.', '.BB.', '.BB.', 'BBBB']); },
  mbQuestion: g => { balloon(g); g.m(12, 5, ['.BBBBB.', 'BB...BB', 'BB...BB', '.....BB', '....BB.', '...BB..', '...BB..', '.......', '...BB..', '...BB..']); },
  mbExclaim: g => {
    for (let y = 2; y < 30; y++) { const half = Math.round((y - 2) * 15 / 28); g.f(16 - half, y, half * 2, 1, 'Y'); }
    for (let y = 2; y < 30; y++) { const half = Math.round((y - 2) * 15 / 28); g.p(16 - half - 1, y, 'K'); g.p(16 + half, y, 'K'); }
    g.l(1, 30, 31, 30, 'K');
    g.f(15, 10, 2, 11, 'K'); g.f(15, 24, 2, 3, 'K');
  },

  winlogo: g => { const f = flagGrid(32, 32); g.d = f.d; },

  /* ---- 16x16 glyphs ---- */
  s_folder: g => g.m(0, 2, [
    '.KKKKK..........',
    'KYYYYYK.........',
    'KYYYYYYKKKKKKK..',
    'KYWWWWWWWWWWWYK.',
    'KYWYYYYYYYYYYyK.',
    'KYWYYYYYYYYYYyK.',
    'KYWYYYYYYYYYYyK.',
    'KYWYYYYYYYYYYyK.',
    'KYWYYYYYYYYYYyK.',
    'KYyyyyyyyyyyyyK.',
    'KKKKKKKKKKKKKKK.']),
  s_folderOpen: g => g.m(0, 2, [
    '.KKKKK..........',
    'KYYYYYK.........',
    'KYYYYYYKKKKKK...',
    'KYyyyyyyyyyyYK..',
    'KYyKKKKKKKKKKKKK',
    'KYKYYYYYYYYYYYYK',
    'KYKYYYYYYYYYYYK.',
    'KKYYYYYYYYYYYYK.',
    'KKYYYYYYYYYYYK..',
    'KYYYYYYYYYYYYK..',
    'KKKKKKKKKKKKKK..']),
  s_file: g => smallPage(g, false),
  s_doc: g => smallPage(g, true),
  s_exe: g => g.m(0, 2, [
    '.KKKKKKKKKKKKKK.',
    '.KSSKNNNNNNNNNK.',
    '.KKKKKKKKKKKKKK.',
    '.KWWWWWWWWWWWWK.',
    '.KWWWWWWWWWWWWK.',
    '.KWWWWWWWWWWWWK.',
    '.KWWWWWWWWWWWWK.',
    '.KWWWWWWWWWWWWK.',
    '.KWWWWWWWWWWWWK.',
    '.KKKKKKKKKKKKKK.']),
  s_drive: g => g.m(0, 4, [
    '..KKKKKKKKKKKK..',
    '.KWWWWWWWWWWWGK.',
    '.KWSSSSSSSSSSGK.',
    '.KWSSSSSSSSSSGK.',
    '.KWLLSSSSSKKSGK.',
    '.KGGGGGGGGGGGGK.',
    '.KKKKKKKKKKKKKK.']),
  s_floppy: g => g.m(1, 1, [
    'KKKKKKKKKKKKK',
    'KGKSSSSSSKGGK',
    'KGKSSSKKSKGGK',
    'KGKSSSKKSKGGK',
    'KGKSSSSSSKGGK',
    'KGGKKKKKKGGGK',
    'KGGGGGGGGGGGK',
    'KGKKKKKKKKKGK',
    'KGKWWWWWWWKGK',
    'KGKWKKKKKWKGK',
    'KGKWWWWWWWKGK',
    'KGKWKKKKKWKGK',
    'KKKKKKKKKKKKK']),
  s_up: g => { ICON_DEFS.s_folder(g); g.m(5, 6, ['..K..', '.KKK.', 'KKKKK', '..K..', '..K..']); }
};
const SMALL = { has: k => typeof k === 'string' && k.startsWith('s_') };

function balloon(g) {
  g.ell(2, 1, 28, 24, 'W', 'K');
  g.m(4, 19, ['....KW..', '...KWW..', '..KWWK..', '.KWK....', 'KK......', 'K.......']);
  g.l(5, 23, 9, 21, 'K');
}
function smallPage(g, lines) {
  g.m(2, 0, [
    'KKKKKKKK....',
    'KWWWWWWKK...',
    'KWWWWWWKWK..',
    'KWWWWWWKKKK.',
    'KWWWWWWWWWK.',
    'KWWWWWWWWWK.',
    'KWWWWWWWWWK.',
    'KWWWWWWWWWK.',
    'KWWWWWWWWWK.',
    'KWWWWWWWWWK.',
    'KWWWWWWWWWK.',
    'KWWWWWWWWWK.',
    'KWWWWWWWWWK.',
    'KWWWWWWWWWK.',
    'KKKKKKKKKKK.']);
  if (lines) for (let y = 6; y < 13; y += 2) g.l(4, y, 9, y, 'K');
}

/* ---- rendering & caching ---- */
const _iconCache = {};
function iconCanvas(name) {
  const def = ICON_DEFS[name] || ICON_DEFS.app;
  const g = new PixGrid(SMALL.has(name) ? 16 : 32, SMALL.has(name) ? 16 : 32);
  def(g);
  return g.canvas();
}
function iconURL(name) {
  if (!_iconCache[name]) _iconCache[name] = iconCanvas(ICON_DEFS[name] ? name : 'app').toDataURL();
  return _iconCache[name];
}
/* 16x16 version of a 32x32 icon: each 2x2 block becomes its majority colour.
   Keep single-pixel marks too: they carry thin strokes and highlights in the
   original pixel art, and dropping them made small toolbar icons look broken. */
const _smallCache = {};
function iconURLSmall(name) {
  if (_smallCache[name]) return _smallCache[name];
  const def = ICON_DEFS[name] || ICON_DEFS.app;
  const g = new PixGrid(32, 32); def(g);
  const o = new PixGrid(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const b = [g.get(2 * x, 2 * y), g.get(2 * x + 1, 2 * y), g.get(2 * x, 2 * y + 1), g.get(2 * x + 1, 2 * y + 1)];
    const solid = b.filter(Boolean);
    if (!solid.length) continue;
    const cnt = {};
    solid.forEach(c => cnt[c] = (cnt[c] || 0) + 1);
    const best = Object.entries(cnt).sort((p, q) => q[1] - p[1] || (q[0] === 'K') - (p[0] === 'K'))[0][0];
    o.p(x, y, best);
  }
  return (_smallCache[name] = o.canvas().toDataURL());
}
function iconImg(name, size) {
  const n = SMALL.has(name) ? 16 : 32;
  size = size || n;
  const src = size === 16 && n === 32 ? iconURLSmall(name) : iconURL(name);
  return h('img', { src, width: size, height: size, draggable: 'false', class: 'ico' });
}
/* Kept for compatibility: list of names */


/* The Windows flag as a pixel bitmap, scaled up with nearest-neighbour */
const _flagCache = {};
function flagCanvas(w = 64, hh = 56) {
  const k = w + 'x' + hh;
  if (!_flagCache[k]) _flagCache[k] = flagGrid(w, hh).canvas();
  return _flagCache[k];
}
function flagImg(px, scale = 1, bw = 64, bh = 56) {
  return h('img', { src: flagCanvas(bw, bh).toDataURL(), width: bw * scale, height: bh * scale, class: 'ico', draggable: 'false' });
}

/* Pixel-art mouse cursors */
const CURSORS = {
  arrow: [
    'K...........',
    'KK..........',
    'KWK.........',
    'KWWK........',
    'KWWWK.......',
    'KWWWWK......',
    'KWWWWWK.....',
    'KWWWWWWK....',
    'KWWWWWWWK...',
    'KWWWWWWWWK..',
    'KWWWWWKKKKK.',
    'KWWKWWK.....',
    'KWK.KWWK....',
    'KK..KWWK....',
    'K....KWWK...',
    '.....KWWK...',
    '......KWWK..',
    '......KWWK..',
    '.......KK...'],
  wait: [
    'KKKKKKKKKKKK',
    'KSSSSSSSSSSK',
    'KKKKKKKKKKKK',
    '.KWWWWWWWWK.',
    '.KWKKKKKKWK.',
    '.KWWKKKKWWK.',
    '..KWWKKWWK..',
    '...KWKKWK...',
    '....KWWK....',
    '....KWWK....',
    '...KWWWWK...',
    '..KWWWKWWK..',
    '.KWWWWKWWWK.',
    '.KWWWKKKWWK.',
    '.KWWKKKKKWK.',
    'KKKKKKKKKKKK',
    'KSSSSSSSSSSK',
    'KKKKKKKKKKKK']
};
/* cursors can be drawn at 1x, 2x or 3x (Settings > Ease of Access > pointer size) */
function cursorURL(name, k = 1) {
  const rows = CURSORS[name];
  const g = new PixGrid(rows[0].length * k, rows.length * k);
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') g.f(x * k, y * k, k, k, c); }));
  return g.canvas().toDataURL();
}
function installCursors() {
  const k = clamp(Store.get('cursorScale', 1), 1, 3);
  const st = document.documentElement.style;
  st.setProperty('--cur-arrow', `url(${cursorURL('arrow', k)}) 0 0, default`);
  st.setProperty('--cur-wait', `url(${cursorURL('wait', k)}) ${6 * k} ${9 * k}, wait`);
}

/* Bitmap glyphs for UI controls (check marks, check/radio boxes, arrows),
   injected as PNG data URLs so nothing is drawn with vectors. */
const UI_GLYPHS = {
  check: ['......K', '.....KK', 'K...KKK', 'KK.KKK.', 'KKKKK..', '.KKK...', '..K....'],
  boxOff: ['KKKKKKKKKKKKK', ...Array(11).fill('KWWWWWWWWWWWK'), 'KKKKKKKKKKKKK'],
  boxOn: ['KKKKKKKKKKKKK', 'KWWWWWWWWWWWK', 'KWKWWWWWWWKWK', 'KWWKWWWWWKWWK', 'KWWWKWWWKWWWK', 'KWWWWKWKWWWWK', 'KWWWWWKWWWWWK', 'KWWWWKWKWWWWK', 'KWWWKWWWKWWWK', 'KWWKWWWWWKWWK', 'KWKWWWWWWWKWK', 'KWWWWWWWWWWWK', 'KKKKKKKKKKKKK'],
  radioOff: ['....KKKK....', '..KKWWWWKK..', '.KWWWWWWWWK.', '.KWWWWWWWWK.', 'KWWWWWWWWWWK', 'KWWWWWWWWWWK', 'KWWWWWWWWWWK', 'KWWWWWWWWWWK', '.KWWWWWWWWK.', '.KWWWWWWWWK.', '..KKWWWWKK..', '....KKKK....'],
  radioOn: ['....KKKK....', '..KKWWWWKK..', '.KWWWWWWWWK.', '.KWWWKKWWWK.', 'KWWWKKKKWWWK', 'KWWKKKKKKWWK', 'KWWKKKKKKWWK', 'KWWWKKKKWWWK', '.KWWWKKWWWK.', '.KWWWWWWWWK.', '..KKWWWWKK..', '....KKKK....'],
  down: ['KKKKKKK', '.KKKKK.', '..KKK..', '...K...'],
  up: ['...K...', '..KKK..', '.KKKKK.', 'KKKKKKK'],
  left: ['...K', '..KK', '.KKK', 'KKKK', '.KKK', '..KK', '...K'],
  right: ['K...', 'KK..', 'KKK.', 'KKKK', 'KKK.', 'KK..', 'K...'],
  close: ['KK....KK', '.KK..KK.', '..KKKK..', '...KK...', '..KKKK..', '.KK..KK.', 'KK....KK'],
  restore: ['...K...', '..KKK..', '.KKKKK.', 'KKKKKKK', '.......', 'KKKKKKK', '.KKKKK.', '..KKK..', '...K...'],
  comboDown: ['KKKKKKK', '.KKKKK.', '..KKK..', '...K...', '.......', 'KKKKKKK'],
  sysbar: ['KKKKKKKKKKKKK', 'KWWWWWWWWWWWKG', 'KKKKKKKKKKKKKG', '.GGGGGGGGGGGGG'],
  sysbarS: ['KKKKKKKKKK', 'KWWWWWWWWKG', 'KKKKKKKKKKG', '.GGGGGGGGGG']
};
function glyphURL(name) {
  const rows = UI_GLYPHS[name];
  const g = new PixGrid(Math.max(...rows.map(r => r.length)), rows.length);
  g.m(0, 0, rows);
  return g.canvas().toDataURL();
}
function installPixelUI() {
  const u = n => `url(${glyphURL(n)})`;
  const css = `
  .popup .mi .chk.on { background: ${u('check')} no-repeat center; }
  .popup .mi.hot .chk.on { filter: invert(1); }
  input.chk { border: 0 !important; background: ${u('boxOff')} no-repeat !important; }
  input.chk:checked { background-image: ${u('boxOn')} !important; }
  input.chk:checked::before, input.chk:checked::after { display: none !important; }
  input.rad { border: 0 !important; border-radius: 0 !important; width: 12px !important; height: 12px !important; background: ${u('radioOff')} no-repeat !important; }
  input.rad:checked { background-image: ${u('radioOn')} !important; }
  input.rad:checked::after { display: none !important; }
  .tbtn::after, .tbtn::before { border: 0 !important; width: 7px; height: 4px; left: 5px !important; background-repeat: no-repeat; }
  .tbtn.min::after { top: 7px !important; background-image: ${u('down')}; }
  .tbtn.max::after { top: 6px !important; background-image: ${u('up')}; }
  .tbtn.restore::after { top: 4px !important; height: 9px; background-image: ${u('restore')}; }
  .tbtn.restore::before { display: none; }
  .tbtn.close::after { top: 5px !important; left: 5px !important; width: 8px; height: 7px; background-image: ${u('close')}; }
  .sys::after { border: 0 !important; box-shadow: none !important; background: ${u('sysbar')} no-repeat !important; width: 14px !important; height: 4px !important; left: 3px !important; top: 7px !important; }
  .sys.child::after, .mb .mdi-sys::after { background-image: ${u('sysbarS')} !important; width: 11px !important; left: 4px !important; }
  .cb .cbb::after { border: 0 !important; width: 7px; height: 6px; left: 5px !important; top: 7px !important; background: ${u('comboDown')} no-repeat; }
  .cb .cbb::before { display: none; }
  .slider .ar::after { border: 0 !important; width: 4px; height: 7px; top: 4px !important; left: 6px !important; background-repeat: no-repeat; }
  .slider .ar.l::after { background-image: ${u('left')}; }
  .slider .ar.r::after { background-image: ${u('right')}; }
  .body *::-webkit-scrollbar-button:vertical:decrement, .lb::-webkit-scrollbar-button:vertical:decrement { background-image: ${u('up')}; }
  .body *::-webkit-scrollbar-button:vertical:increment, .lb::-webkit-scrollbar-button:vertical:increment { background-image: ${u('down')}; }
  .body *::-webkit-scrollbar-button:horizontal:decrement { background-image: ${u('left')}; }
  .body *::-webkit-scrollbar-button:horizontal:increment { background-image: ${u('right')}; }
  `;
  document.head.appendChild(h('style', { text: css }));
}

/* Windows 3.1 font names -> CSS font-family. Bitmap faces map to the
   pixel webfonts in /fonts; TrueType faces map to their modern equivalents. */
const WIN_FONTS = {
  'System': '"W31 System"', 'MS Sans Serif': '"W31 MS Sans Serif"', 'Fixedsys': '"W31 Fixedsys"', 'Courier': '"W31 Courier"',
  'Small Fonts': '"W31 Small Fonts"', 'Terminal': '"W31 VGA"',
  'Arial': 'Arial', 'Courier New': '"Courier New"', 'MS Serif': '"Times New Roman"', 'Symbol': 'Symbol', 'Times New Roman': '"Times New Roman"', 'Wingdings': 'Wingdings'
};
const TRUETYPE_FACES = ['Arial', 'Courier New', 'Symbol', 'Times New Roman', 'Wingdings'];
/* Fonts offered to applications (Control Panel > Fonts > TrueType options) */
function winFontList() {
  const tt = Store.get('tt.enable', true), only = tt && Store.get('tt.only', false);
  return Object.keys(WIN_FONTS).filter(f => TRUETYPE_FACES.includes(f) ? tt : !only).sort();
}
/* Bitmap faces only exist at their native pixel size */
const WIN_FONT_PX = { 'System': 16, 'MS Sans Serif': 13, 'Fixedsys': 15, 'Courier': 13, 'Small Fonts': 11, 'Terminal': 16 };

/* Pixel-exact drawing on a 2D canvas context: everything is integer fillRects,
   so shapes never get anti-aliased. Used by Paintbrush, Clock and games. */
const Raster = {
  dot(x, c, px, py, size = 1, round = false) {
    const o = Math.floor(size / 2);
    if (!round || size < 3) { x.fillRect(px - o, py - o, size, size); return; }
    const r = size / 2;
    for (let j = 0; j < size; j++) { const dy = j - o + 0.5 - 0.5; const half = Math.floor(Math.sqrt(Math.max(0, r * r - (j - r + 0.5) ** 2))); x.fillRect(px - half, py - o + j, half * 2 || 1, 1); }
  },
  line(x, x0, y0, x1, y1, size = 1, round = false) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.dot(x, null, x0, y0, size, round);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  },
  /* spans of an ellipse inscribed in box -> array of [y, xLeft, xRight] */
  ellSpans(x0, y0, x1, y1) {
    const l = Math.min(x0, x1), r = Math.max(x0, x1), t = Math.min(y0, y1), b = Math.max(y0, y1);
    const cx = (l + r) / 2, cy = (t + b) / 2, rx = (r - l) / 2 + 0.5, ry = (b - t) / 2 + 0.5;
    const out = [];
    for (let y = t; y <= b; y++) {
      const dy = (y - cy) / ry;
      const half = rx * Math.sqrt(Math.max(0, 1 - dy * dy));
      out.push([y, Math.round(cx - half + 0.0001), Math.round(cx + half - 0.0001)]);
    }
    return out;
  },
  ellipse(x, x0, y0, x1, y1, size = 1, fillStyle = null, lineStyle = null) {
    const l = Math.min(x0, x1), r = Math.max(x0, x1), t = Math.min(y0, y1), b = Math.max(y0, y1);
    const outer = this.ellSpans(l, t, r, b);
    const inner = new Map((r - l > 2 * size && b - t > 2 * size) ? this.ellSpans(l + size, t + size, r - size, b - size).map(s => [s[0], s]) : []);
    if (fillStyle) {
      x.fillStyle = fillStyle;
      (lineStyle ? [...inner.values()] : outer).forEach(([y, a, c]) => x.fillRect(a, y, c - a + 1, 1));
    }
    if (lineStyle) {
      x.fillStyle = lineStyle;
      for (const [y, a, c] of outer) {
        const i = inner.get(y);
        if (!i) x.fillRect(a, y, c - a + 1, 1);
        else { x.fillRect(a, y, Math.max(1, i[1] - a), 1); x.fillRect(Math.min(c, i[2] + 1), y, Math.max(1, c - i[2]), 1); }
      }
    }
  },
  rect(x, x0, y0, x1, y1, size = 1) {
    const l = Math.min(x0, x1), t = Math.min(y0, y1), w = Math.abs(x1 - x0) + 1, hh = Math.abs(y1 - y0) + 1;
    x.fillRect(l, t, w, size); x.fillRect(l, t + hh - size, w, size); x.fillRect(l, t, size, hh); x.fillRect(l + w - size, t, size, hh);
  }
};

/* ======================= NEO10 ICONS ======================= */
/* The Neo10 emblem: the Windows 10 four-pane window in perspective, in the
   Windows 3.1 flag colours. Works at any size. */
function neoLogoGrid(S = 32) {
  const g = new PixGrid(S, S);
  const m = Math.round(S * 0.47), gap = Math.max(1, Math.round(S / 24));
  for (let x = 1; x < S - 1; x++) {
    const f = x / (S - 1), top = Math.round(S * 0.04 + f * S * 0.16), bot = Math.round(S * 0.96 - f * S * 0.16);
    const midY = Math.round((top + bot) / 2);
    if (Math.abs(x - m) < gap) continue;
    for (let y = top; y <= bot; y++) {
      if (Math.abs(y - midY) < gap) continue;
      g.p(x, y, x < m ? (y < midY ? 'R' : 'B') : (y < midY ? 'L' : 'Y'));
    }
  }
  return g;
}
const FOLDER_BIG = g => {
  g.m(1, 6, ['.KKKKKKKK.....................',
    'KYYYYYYYYK....................',
    'KYYYYYYYYYKKKKKKKKKKKKKKKKKKK.',
    'KYWWWWWWWWWWWWWWWWWWWWWWWWWWYK']);
  g.b(1, 10, 30, 18, 'Y'); g.l(2, 11, 29, 11, 'W'); g.l(2, 11, 2, 26, 'W'); g.l(29, 12, 29, 26, 'y'); g.l(3, 26, 29, 26, 'y');
};
Object.assign(ICON_DEFS, {
  neologo: g => { g.d = neoLogoGrid(32).d; },
  thispc: g => { g.bev(3, 3, 26, 19, 'S'); g.b(5, 5, 22, 14, 'c'); g.f(7, 7, 8, 2, 'C'); g.b(11, 22, 10, 3, 'G'); g.bev(6, 25, 20, 4, 'S'); },
  recycle: g => {
    g.b(6, 5, 20, 4, 'S'); g.b(12, 3, 8, 3, 'S');
    for (let y = 9; y < 29; y++) { const i = Math.round((y - 9) / 6); g.p(7 + i, y, 'K'); g.p(24 - i, y, 'K'); for (let x = 8 + i; x < 24 - i; x++) g.p(x, y, (x + y) % 3 ? 'S' : 'G'); }
    g.l(10, 29, 21, 29, 'K');
  },
  recyclefull: g => {
    ICON_DEFS.recycle(g);
    g.m(9, 0, ['..WWWWW..', '.WKKKKKW.', 'WKWWWWWKW', '.KWYYYWK.', '..KKKKK..']);
    g.f(10, 6, 12, 2, 'W'); g.l(10, 6, 21, 6, 'K');
  },
  folder: g => FOLDER_BIG(g),
  fdocs: g => { FOLDER_BIG(g); pageIcon(g, 12, 13, 13, 15); },
  fpics: g => { FOLDER_BIG(g); g.b(10, 13, 16, 13, 'C'); g.m(11, 18, ['....K.....K...', '...KgK...KgK..', '..KgggK.KgggK.', '.Kggggggggggg.', 'gggggggggggggg', 'gggggggggggggg']); g.disc(22, 16, 1.5, 'Y'); },
  fdown: g => { FOLDER_BIG(g); g.m(11, 12, ['...KKKK...', '...KBBK...', '...KBBK...', '...KBBK...', 'KKKKBBKKKK', '.KBBBBBBK.', '..KBBBBK..', '...KBBK...', '....KK....']); g.l(9, 23, 22, 23, 'N'); },
  fmusic: g => { FOLDER_BIG(g); g.m(11, 12, ['....KKKKKKK', '....KNNNNNK', '....KNKKKNK', '....KNK.KNK', '....KNK.KNK', '.KKKKNK.KNK', 'KNNNNNKKKNK', 'KNNNNNKKNNK', '.KKKKK..KK.']); },
  fdesk: g => { FOLDER_BIG(g); g.b(10, 13, 15, 11, 'N'); g.f(11, 14, 13, 6, 'c'); g.f(11, 21, 13, 2, 'S'); },
  explorer: g => { FOLDER_BIG(g); g.f(2, 16, 28, 4, 'B'); g.l(2, 16, 29, 16, 'N'); g.l(2, 19, 29, 19, 'N'); },
  settings10: g => {
    // gear: body + 8 teeth filled grey, then a 1px black outline traced around the shape
    const sh = new PixGrid(32, 32);
    sh.disc(15.5, 15.5, 10, 'S');
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, cx = 15.5 + Math.cos(a) * 11.5, cy = 15.5 + Math.sin(a) * 11.5;
      for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
        const rx = x * Math.cos(a) + y * Math.sin(a), ry = -x * Math.sin(a) + y * Math.cos(a);
        if (Math.abs(rx) <= 2.6 && Math.abs(ry) <= 2.2) sh.p(cx + x, cy + y, 'S');
      }
    }
    sh.disc(15.5, 15.5, 4, null);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      if (sh.get(x, y)) { g.p(x, y, 'S'); continue; }
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => sh.get(x + dx, y + dy))) g.p(x, y, 'K');
    }
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (g.get(x, y) === 'S' && (!sh.get(x - 1, y - 1) || !sh.get(x - 2, y - 2)) && x + y < 31) g.p(x, y, 'W');
  },
  taskmgr: g => { g.b(1, 3, 30, 26, 'W'); g.f(2, 4, 28, 4, 'N'); g.f(2, 4, 4, 4, 'S'); g.l(2, 8, 29, 8, 'K'); g.f(3, 10, 26, 17, 'K');
    for (let x = 3; x < 29; x += 5) g.l(x, 10, x, 26, 'g'); for (let y = 10; y < 27; y += 4) g.l(3, y, 28, y, 'g');
    const pts = [[3, 22], [7, 20], [10, 23], [13, 15], [16, 18], [19, 12], [22, 16], [25, 13], [28, 17]];
    for (let i = 1; i < pts.length; i++) g.l(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 'L'); },
  cmd: g => { g.b(1, 3, 30, 26, 'W'); g.f(2, 4, 28, 4, 'N'); g.f(2, 4, 4, 4, 'S'); g.l(2, 8, 29, 8, 'K'); g.f(2, 9, 28, 19, 'K'); g.t(4, 12, 'C:', 'S'); g.f(13, 17, 5, 1, 'S'); g.l(10, 12, 12, 17, 'S'); },
  user: g => { g.b(1, 1, 30, 30, 'S'); g.disc(15.5, 11.5, 5.5, 'G'); g.f(8, 20, 16, 10, 'G'); g.disc(15.5, 22.5, 7.5, 'G'); g.f(2, 30, 28, 1, 'S'); g.o(1, 1, 30, 30, 'K'); },
  weather: g => { g.disc(11.5, 11.5, 7, 'Y'); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.l(11.5 + Math.cos(a) * 8.5, 11.5 + Math.sin(a) * 8.5, 11.5 + Math.cos(a) * 10.5, 11.5 + Math.sin(a) * 10.5, 'Y'); }
    g.disc(17, 21, 5, 'W'); g.disc(23, 19, 6, 'W'); g.disc(11, 23, 4, 'W'); g.f(11, 23, 18, 5, 'W');
    g.ring(17, 21, 5, 'S'); },
  store10: g => { g.b(4, 9, 24, 20, 'W'); g.l(10, 9, 12, 3, 'K'); g.l(22, 9, 20, 3, 'K'); g.l(12, 3, 20, 3, 'K'); const n = neoLogoGrid(16); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = n.get(x, y); if (c) g.p(8 + x, 11 + y, c); } },
  lock: g => { g.ring(15.5, 11, 6, 'K'); g.ring(15.5, 11, 5, 'K'); g.bev(7, 13, 18, 15, 'Y'); g.f(15, 18, 2, 5, 'K'); },
  globe: g => {
    g.disc(15.5, 15.5, 13, 'B');
    g.disc(11, 10, 5, 'g'); g.disc(8.5, 15.5, 3.5, 'g'); g.disc(20.5, 19.5, 5, 'g'); g.disc(22.5, 11.5, 2.5, 'g'); g.disc(14.5, 25, 2.5, 'g');
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (Math.hypot(x - 15.5, y - 15.5) > 13) g.p(x, y, null);
    g.ring(15.5, 15.5, 13, 'K'); g.l(8, 6, 11, 4, 'C'); g.l(6, 9, 7, 8, 'C');
  },
  /* the Edge "e": a thick blue ring with a crossbar, open at the lower right */
  edge: g => {
    const cx = 15.5, cy = 16, on = (x, y) => {
      const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy);
      if (r > 13.5) return false;
      if (dx > 0 && dy > 2 && Math.atan2(dy, dx) < .75) return false;
      return r >= 7 || (dy >= -3 && dy <= 0);
    };
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      if (on(x, y)) g.p(x, y, x + y < 20 && !on(x - 1, y - 1) ? 'C' : 'B');
      else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) g.p(x, y, 'K');
    }
  },
  runbox: g => { g.b(2, 6, 28, 20, 'S'); g.f(3, 7, 26, 3, 'N'); g.b(5, 14, 22, 6, 'W'); g.f(7, 16, 1, 2, 'K'); },

  /* 16x16 glyphs */
  s_neologo: g => { g.d = neoLogoGrid(16).d; },
  s_search: g => g.m(1, 1, ['...KKKK.....', '..K....K....', '.K......K...', '.K......K...', '.K......K...', '.K......K...', '..K....K....', '...KKKKK....', '.......KK...', '........KK..', '.........KK.', '..........KK']),
  s_taskview: g => { g.o(1, 3, 10, 8, 'K'); g.f(1, 3, 10, 2, 'K'); g.b(5, 6, 10, 8, 'W'); g.f(5, 6, 10, 2, 'K'); },
  s_bell: g => g.m(1, 2, ['KKKKKKKKKKKKK.', 'KWWWWWWWWWWWK.', 'KWKKKKKKKKKWK.', 'KWWWWWWWWWWWK.', 'KWKKKKKKKWWWK.', 'KWWWWWWWWWWWK.', 'KKKKKKWKKKKKK.', '.....KWK......', '.....KK.......', '.....K........']),
  s_bellnew: g => { ICON_DEFS.s_bell(g); g.f(11, 0, 5, 5, 'R'); g.o(11, 0, 5, 5, 'K'); },
  s_network: g => { g.b(3, 1, 11, 9, 'S'); g.f(4, 2, 9, 6, 'c'); g.f(7, 10, 3, 2, 'K'); g.f(4, 12, 9, 2, 'K'); g.l(1, 14, 15, 14, 'K'); },
  s_netoff: g => { ICON_DEFS.s_network(g); g.l(1, 1, 14, 14, 'R'); g.l(2, 1, 15, 14, 'R'); },
  s_volume: g => { g.m(1, 3, ['....K...', '...KK...', 'KKKSK...', 'KWWSK...', 'KWWSK...', 'KKKSK...', '...KK...', '....K...']); g.m(9, 3, ['.K....', '..K...', 'K..K..', '.K.K..', '.K.K..', 'K..K..', '..K...', '.K....']); },
  s_mute: g => { ICON_DEFS.s_volume(g); g.f(9, 3, 7, 9, null); g.l(10, 5, 14, 9, 'R'); g.l(14, 5, 10, 9, 'R'); },
  s_power: g => g.m(2, 1, ['.....K.....', '..K..K..K..', '.K...K...K.', 'K....K....K', 'K.........K', 'K.........K', 'K.........K', '.K.......K.', '..K.....K..', '...KKKKK...']),
  s_gear: g => g.m(1, 1, ['.....KKK......', '.KK..KSK..KK..', '.KSKKKSKKKSK..', '..KSSSSSSSK...', 'KKKSSKKKSSKKK.', 'KSSSK...KSSSK.', 'KSSSK...KSSSK.', 'KKKSSKKKSSKKK.', '..KSSSSSSSK...', '.KSKKKSKKKSK..', '.KK..KSK..KK..', '.....KKK......']),
  s_user: g => { g.disc(7.5, 5, 3, 'G'); g.ring(7.5, 5, 3, 'K'); g.m(2, 9, ['...KKKKK...', '.KKGGGGGKK.', 'KGGGGGGGGGK', 'KGGGGGGGGGK', 'KKKKKKKKKKK']); },
  s_docs: g => { g.m(2, 0, ['KKKKKKKK....', 'KWWWWWWKK...', 'KWKKKKWKWK..', 'KWWWWWWKKKK.', 'KWKKKKKKKWK.', 'KWWWWWWWWWK.', 'KWKKKKKKKWK.', 'KWWWWWWWWWK.', 'KWKKKKKKKWK.', 'KWWWWWWWWWK.', 'KWKKKKKKKWK.', 'KWWWWWWWWWK.', 'KKKKKKKKKKK.']); },
  s_pics: g => { g.b(1, 2, 14, 12, 'C'); g.m(2, 7, ['...K....K...', '..KgK..KgK..', '.KgggKKgggK.', 'gggggggggggg', 'gggggggggggg', 'gggggggggggg']); g.f(11, 4, 2, 2, 'Y'); },
  s_lock: g => { g.o(5, 1, 6, 7, 'K'); g.bev(3, 7, 10, 8, 'Y'); g.f(7, 10, 2, 3, 'K'); },
  s_signout: g => { g.o(2, 1, 8, 14, 'K'); g.f(3, 2, 6, 12, 'S'); g.l(7, 8, 14, 8, 'K'); g.l(12, 6, 14, 8, 'K'); g.l(12, 10, 14, 8, 'K'); },
  s_restart: g => g.m(2, 1, ['....KKKK.K.', '..KK....KK.', '.K.....KKK.', '.K.........', 'K..........', 'K..........', 'K..........', '.K........K', '.K.......K.', '..KK...KK..', '....KKK....']),
  s_sleep: g => g.m(3, 2, ['...KKK....', '.KK.......', 'K.........', 'K.........', 'K.........', 'K.........', 'K.........', '.KK....K..', '...KKKK...']),
  s_plus: g => { g.f(7, 2, 2, 12, 'K'); g.f(2, 7, 12, 2, 'K'); },
  s_back: g => g.m(2, 3, ['....K.....', '...KK.....', '..KKKKKKKK', '.KKKKKKKKK', '..KKKKKKKK', '...KK.....', '....K.....']),
  s_fwd: g => g.m(4, 3, ['.....K....', '.....KK...', 'KKKKKKKK..', 'KKKKKKKKK.', 'KKKKKKKK..', '.....KK...', '.....K....']),
  s_upfolder: g => { ICON_DEFS.s_folder(g); g.m(5, 4, ['..K..', '.KKK.', 'KKKKK', '..K..', '..K..', '..K..']); },
  s_recycle: g => { g.b(3, 2, 10, 3, 'S'); g.b(6, 0, 4, 3, 'S'); for (let y = 5; y < 15; y++) { const i = Math.round((y - 5) / 5); g.p(3 + i, y, 'K'); g.p(12 - i, y, 'K'); for (let x = 4 + i; x < 12 - i; x++) g.p(x, y, (x + y) % 3 ? 'S' : 'G'); } g.l(5, 15, 10, 15, 'K'); },
  s_thispc: g => { g.bev(1, 1, 14, 10, 'S'); g.f(3, 3, 10, 6, 'c'); g.f(5, 11, 6, 2, 'G'); g.f(3, 13, 10, 2, 'K'); },
  s_star: g => g.m(1, 1, ['......K......', '.....KYK.....', '.....KYK.....', 'KKKKKYYYKKKKK', '.KYYYYYYYYYK.', '..KYYYYYYYK..', '...KYYYYYK...', '..KYYKKKYYK..', '..KYK...KYK..', '.KK.......KK.']),
  s_down: g => g.m(4, 1, ['..KKKK..', '..KBBK..', '..KBBK..', '..KBBK..', 'KKKBBKKK', '.KBBBBK.', '..KBBK..', '...KK...', '........', 'KKKKKKKK']),
  s_home: g => g.m(1, 1, ['.......K......', '......KWK.....', '.....KWWWK....', '....KWWWWWK...', '...KWWWWWWWK..', '..KWWWWWWWWWK.', '.KKKWWWWWWWKKK', '...KWWKKKWWK..', '...KWWKSKWWK..', '...KWWKSKWWK..', '...KWWKSKWWK..', '...KKKKKKKKK..']),
  s_x: g => g.m(4, 4, ['KK....KK', '.KK..KK.', '..KKKK..', '...KK...', '..KKKK..', '.KK..KK.', 'KK....KK']),
  s_more: g => { g.f(2, 7, 2, 2, 'K'); g.f(7, 7, 2, 2, 'K'); g.f(12, 7, 2, 2, 'K'); },
  s_hub: g => { g.m(1, 1, ['..K..', '.KYK.', 'KYYYK', '.KYK.', 'K.K.K']); for (const y of [3, 8, 13]) g.f(7, y, 8, 2, 'K'); g.f(1, 8, 3, 2, 'K'); g.f(1, 13, 3, 2, 'K'); },
  s_staroff: g => g.m(1, 1, ['......K......', '.....K.K.....', '.....K.K.....', 'KKKKK...KKKKK', '.K.........K.', '..K.......K..', '...K.....K...', '..K..KKK..K..', '..K.K...K.K..', '.KK.......KK.']),
  s_globe: g => { g.disc(7.5, 7.5, 6.6, 'B'); g.m(3, 3, ['..gg.....', '.gggg..g.', '.ggg..gg.', '..g..ggg.', '.....gg..', '......g..', '...g.....', '..ggg....', '...g.....']); g.ring(7.5, 7.5, 6.6, 'K'); },
  s_music: g => g.m(3, 1, ['....KKKKKK', '....KNNNNK', '....KK..KK', '....K....K', '....K....K', '.KKKK..KKK', 'KNNNK.KNNK', 'KNNNK.KNNK', '.KKK...KK.'])
});
