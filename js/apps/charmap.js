'use strict';
/* Character Map */
(() => {
  const dec = new TextDecoder('windows-1252');
  const chr = c => dec.decode(new Uint8Array([c]));
  const FONTS = WIN_FONTS;

  Sys.registerApp('charmap', {
    name: 'Character Map', icon: 'charmap', help: 'charmap',
    run() {
      let font = winFontList().includes('Symbol') ? 'Symbol' : 'System', sel = 65;
      const CWID = 15, CHT = 18;
      const grid = h('div', { style: { position: 'absolute', left: '8px', top: '38px', width: (32 * CWID + 1) + 'px', height: (7 * CHT + 1) + 'px', border: '1px solid #000', background: '#fff', display: 'grid', gridTemplateColumns: `repeat(32, ${CWID}px)`, gridAutoRows: CHT + 'px' } });
      const cells = [];
      for (let c = 32; c < 256; c++) {
        const cell = h('div', { style: { borderRight: '1px solid #000', borderBottom: '1px solid #000', textAlign: 'center', lineHeight: CHT + 'px', fontSize: '12px', fontWeight: 'normal', overflow: 'hidden' }, text: chr(c) });
        cell.addEventListener('pointerdown', e => { select(c); magnify(cell, c); cell.setPointerCapture(e.pointerId); });
        cell.addEventListener('dblclick', () => addChar());
        cells.push(cell); grid.appendChild(cell);
      }
      let mag = null;
      const magnify = (cell, c) => {
        unmag();
        const r = Sys.rectOf(cell);
        mag = h('div', { style: { position: 'absolute', left: (r.x - 12) + 'px', top: (r.y - 12) + 'px', width: '40px', height: '42px', border: '2px solid #000', background: '#fff', textAlign: 'center', lineHeight: '40px', fontSize: '28px', fontFamily: FONTS[font], zIndex: 99990 }, text: chr(c) });
        Sys.screen.appendChild(mag);
        const up = () => { unmag(); document.removeEventListener('pointerup', up); };
        document.addEventListener('pointerup', up);
      };
      const unmag = () => { if (mag) { mag.remove(); mag = null; } };
      const select = c => {
        sel = c;
        cells.forEach((el, i) => { const on = i + 32 === c; el.style.background = on ? 'var(--highlight)' : ''; el.style.color = on ? 'var(--highlight-text)' : ''; });
        status.textContent = `Keystroke: ${c < 128 ? (chr(c) === ' ' ? 'Spacebar' : chr(c)) : 'Alt+0' + c}`;
      };
      const field = UI.text('');
      const addChar = () => { field.value += chr(sel); };
      const fontCb = UI.combo({ items: winFontList(), onChange: it => { font = it.text; grid.style.fontFamily = FONTS[font]; grid.querySelectorAll('div').forEach(c => c.style.fontSize = (WIN_FONT_PX[font] || 12) + 'px'); } });
      fontCb.setText(font); grid.style.fontFamily = FONTS[font];
      const status = h('div', { class: 'status', style: { position: 'absolute', left: 0, right: 0, bottom: 0 } });
      const w = new Win({
        title: 'Character Map', icon: 'charmap', resizable: false, maxBox: false, w: 520, h: 260, persist: 'charmap',
        onKey: (e, name) => {
          if (document.activeElement === field) return false;
          let c = sel;
          if (name === 'Right') c++; else if (name === 'Left') c--; else if (name === 'Down') c += 32; else if (name === 'Up') c -= 32;
          else if (name === 'Space' || name === 'Enter') { addChar(); return true; }
          else return false;
          select(clamp(c, 32, 255)); return true;
        }
      });
      const b = w.body;
      b.style.background = 'var(--btn-face)';
      b.appendChild(UI.place(UI.label('&Font:', fontCb), 8, 12));
      b.appendChild(UI.place(fontCb.el, 46, 8, 170));
      b.appendChild(UI.place(UI.label('Characters to Cop&y:', field), 232, 12));
      b.appendChild(UI.place(field, 392, 8, 96));
      b.appendChild(grid);
      const btnX = 8 + 32 * CWID + 12;
      b.appendChild(UI.place(UI.button('Close', { onClick: () => w.close() }), btnX, 8, 76, 25));
      b.appendChild(UI.place(UI.button('&Select', { default: true, onClick: addChar }), btnX, 40, 76, 25));
      b.appendChild(UI.place(UI.button('&Copy', { onClick: () => { if (field.value) Sys.setClipboard({ type: 'text', data: field.value }); } }), btnX, 72, 76, 25));
      b.appendChild(UI.place(UI.button('&Help', { onClick: () => Sys.launch('WINHELP.EXE charmap') }), btnX, 104, 76, 25));
      b.appendChild(status);
      select(sel);
      requestAnimationFrame(() => w.sizeToClient(btnX + 86, 38 + 7 * CHT + 8 + 26));
      return w;
    }
  });
})();
