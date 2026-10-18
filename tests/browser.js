/* Run in a disposable browser profile after opening index.html#win.
   await runWindows31Regression() returns checks; temporary files/settings are restored. */
window.runWindows31Regression = async function () {
  const results = [], original = JSON.parse(JSON.stringify(HostFiles.snapshot()));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const check = async (name, fn) => { try { await fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false, error: e.message }); await cleanWindows(); } };
  const button = (root, label) => [...root.querySelectorAll('button')].find(b => stripAmp(b.textContent).trim() === label);
  const action = (w, menu, label) => w.menuBar.defs.find(d => stripAmp(d.label) === menu).items.find(i => i !== '-' && stripAmp(i.label) === label).action();
  const cleanWindows = async () => { Menu.closeAll(true); for (const w of Sys.topWindows().slice().reverse()) await w.close(true); };
  try {
    if (Sys.mode === 'locked') {
      document.querySelector('.neo-lock')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      button(document, 'Sign in')?.click(); await wait(400);
    }
    await cleanWindows();
    await check('backup round trip, persisted settings and files', () => {
      FS.write('C:\\REGRESS.TXT', 'Round trip'); Store.set('regressMarker', 'set'); FS.flush();
      const saved = JSON.parse(localStorage.getItem(Store.key + '.fs'));
      assert(saved.fs.c['REGRESS.TXT'].x === 'Round trip' && saved.cfg.regressMarker === 'set', 'Snapshot lost files or settings');
      HostFiles.applyBackup(original);
      assert(Store.get('regressMarker') === original.cfg.regressMarker, 'Settings were not restored');
    });
    await check('text and binary host import/export with name collisions', async () => {
      const dir = FS.join('C:\\', FileOps.uniqueName('C:\\', 'NEOTEST')); FS.mkdir(dir);
      const pick = HostFiles.pick, download = HostFiles.download, message = window.msgBox;
      const exports = [];
      try {
        HostFiles.pick = async () => [new File(['hello'], 'host.txt'), new File(['again'], 'host.txt'), new File([new Uint8Array([0, 255, 42])], 'host.bin')];
        window.msgBox = async () => 'ok';
        HostFiles.download = (name, data, type) => exports.push({ name, data, type });
        await HostFiles.importFiles(dir, null);
        assert(FS.read(FS.join(dir, 'HOST.TXT')) === 'hello' && FS.read(FS.join(dir, 'HOST (2).TXT')) === 'again', 'Import overwrote a collision');
        HostFiles.exportFile(FS.join(dir, 'HOST.TXT')); HostFiles.exportFile(FS.join(dir, 'HOST.BIN'));
        assert(exports[0].data === 'hello' && exports[1].data.join(',') === '0,255,42', 'Export changed file contents');
      } finally { HostFiles.pick = pick; HostFiles.download = download; window.msgBox = message; }
    });
    await check('failed writes show one alert and retry clears it', () => {
      const set = Storage.prototype.setItem;
      try {
        Storage.prototype.setItem = () => { throw new DOMException('Storage full', 'QuotaExceededError'); };
        assert(Store.flush() === false, 'Failure was not reported'); Store.flush();
        assert(document.querySelectorAll('.save-warning[role="alert"]').length === 1, 'Save warning absent or duplicated');
      } finally { Storage.prototype.setItem = set; }
      button(document.querySelector('.save-warning'), 'Retry saving').click();
      assert(!document.querySelector('.save-warning'), 'Successful retry did not clear warning');
    });
    await check('Write sanitization, page layout, tabs and picture sizing survive save', async () => {
      FS.write('C:\\REGRESS.WRI', '<p onclick="bad()" style="color:red">Hello</p><script>window.bad=true</script><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=">');
      const w = Sys.run('write', { args: 'C:\\REGRESS.WRI' }); await wait(30);
      const doc = w.body.querySelector('[contenteditable]');
      assert(!doc.querySelector('script,[onclick]'), 'Active imported HTML survived');
      action(w, 'Document', 'Page Layout...'); await wait(10);
      let d = Sys.activeTop();
      assert(w.el.inert && d.el.getAttribute('aria-modal') === 'true', 'Owner is not disabled for modal dialog');
      d.body.querySelector('[aria-label="Page width (pixels)"]').value = '640';
      d.body.querySelector('[aria-label="Margins (pixels)"]').value = '24'; button(d.body, 'OK').click(); await wait(10);
      assert(!w.el.inert, 'Owner stayed disabled after dialog');
      action(w, 'Document', 'Tabs...'); d = Sys.activeTop(); d.body.querySelector('input').value = '8'; button(d.body, 'OK').click(); await wait(10);
      const img = doc.querySelector('img'); img.click(); action(w, 'Edit', 'Size Picture...'); d = Sys.activeTop();
      d.body.querySelector('[aria-label="Width (pixels)"]').value = '32'; d.body.querySelector('[aria-label="Height (pixels)"]').value = '48'; button(d.body, 'OK').click();
      action(w, 'Edit', 'Move Picture');
      const paragraph = doc.querySelector('p'), range = document.createRange(); range.selectNodeContents(paragraph); range.collapse(false);
      getSelection().removeAllRanges(); getSelection().addRange(range); paragraph.click();
      assert(img.parentNode === paragraph, 'Picture was not moved to the destination');
      await action(w, 'File', 'Save');
      const node = FS.get('C:\\REGRESS.WRI');
      assert(node.writeLayout.width === 640 && node.writeLayout.margin === 24 && node.writeLayout.tab === 8, 'Layout was not saved');
      assert(node.x.includes('width:32px') && node.x.includes('height:48px'), 'Picture sizing was not saved');
      await w.close(true); const reopened = Sys.run('write', { args: 'C:\\REGRESS.WRI' });
      assert(reopened.body.querySelector('[contenteditable]').style.width === '640px', 'Layout was not restored');
      await reopened.close(true);
    });
    await check('Calculator mean, sum, standard deviation and dataset deletion', async () => {
      Store.set('calc.sci', true); const w = Sys.run('calc', {}); await wait(50);
      for (const label of ['2', 'Dat', '4', 'Dat', 'Ave']) button(w.body, label).click();
      assert(w.body.innerText.includes('3.'), 'Mean is incorrect');
      button(w.body, 'Sum').click(); assert(w.body.innerText.includes('6.'), 'Sum is incorrect');
      button(w.body, 's').click(); assert(w.body.innerText.includes('1.414213'), 'Sample deviation is incorrect');
      button(w.body, 'Sta').click(); const d = Sys.activeTop();
      assert(d.body.querySelectorAll('[role="option"]').length === 2, 'Dataset is absent');
      button(d.body, 'Delete all').click(); assert(d.body.querySelectorAll('[role="option"]').length === 0, 'Dataset was not cleared');
      await cleanWindows();
    });
    await check('Paintbrush palette edit and palette-file save', async () => {
      const w = Sys.run('pbrush', {}); action(w, 'Options', 'Edit Colors...');
      const d = Sys.activeTop(); d.body.querySelector('input').value = '#123456'; button(d.body, 'OK').click();
      assert(w.body.querySelector('[aria-label="Color 1 #123456"]'), 'Edited palette is absent');
      const file = window.fileDialog;
      try { window.fileDialog = async () => 'C:\\REGRESS.PAL'; await action(w, 'Options', 'Save Colors...'); }
      finally { window.fileDialog = file; }
      assert(JSON.parse(FS.read('C:\\REGRESS.PAL'))[0] === '#123456', 'Palette did not save'); await w.close(true);
    });
    await check('unsaved document cancel preserves the document', async () => {
      const w = Sys.run('notepad', {}); await wait(10);
      const textarea = w.body.querySelector('textarea'); textarea.value = 'Keep my draft'; textarea.dispatchEvent(new Event('input', { bubbles: true }));
      const closing = w.close(); await wait(10); const d = Sys.activeTop();
      button(d.body, 'Cancel').click(); assert(await closing === false && !w.closed && textarea.value === 'Keep my draft', 'Cancel discarded the draft');
      await w.close(true);
    });
    await check('shared keyboard menus, listbox selection and modal Tab cycle', async () => {
      const w = Sys.run('write', {}); Menu.openBar(w.menuBar, 0, true);
      assert(document.activeElement.getAttribute('role') === 'menu', 'Keyboard menu is not focused');
      Menu.key(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      assert(document.activeElement.getAttribute('aria-activedescendant'), 'Menu does not announce selection'); Menu.closeAll();
      const d = dialog({ title: 'Keyboard regression', owner: w, build(d) {
        const lb = UI.listbox({ items: ['One', 'Two'], sel: 0 }); d.add(UI.label('Choices', lb), 10, 8); d.add(lb, 10, 25, 100, 60);
        d.add(UI.button('Close', { cancel: true, onClick: () => d.close() }), 130, 25, 75, 25);
      } }); await wait(10);
      const list = d.body.querySelector('[role="listbox"]'); list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      assert(list.querySelector('[aria-selected="true"]').textContent === 'Two', 'List selection ARIA is stale');
      const close = button(d.body, 'Close'); close.focus(); close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
      assert(document.activeElement === list, 'Tab escaped the modal'); d.close(); await w.close(true);
    });
    await check('Terminal text upload, binary transfer and transcript capture', async () => {
      const w = Sys.run('terminal', {}); action(w, 'Phone', 'Dial...'); await wait(5300);
      FS.write('C:\\SEND.TXT', 'Hello BBS'); FS.write('C:\\SEND.BIN', 'data:application/octet-stream;base64,AP8q', { encoding: 'data-url', s: 3 });
      const file = window.fileDialog;
      try {
        window.fileDialog = async () => 'C:\\SEND.TXT'; await action(w, 'Transfers', 'Send Text File...');
        window.fileDialog = async () => 'C:\\SEND.BIN'; await action(w, 'Transfers', 'Send Binary File...');
        action(w, 'Transfers', 'Receive Binary File...'); const d = Sys.activeTop();
        const row = [...d.body.querySelectorAll('[role="option"]')].find(r => r.textContent === 'SEND.BIN');
        row.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        window.fileDialog = async () => 'C:\\RECV.BIN'; button(d.body, 'Receive').click(); await wait(30);
        assert(FS.read('C:\\RECV.BIN') === FS.read('C:\\SEND.BIN') && FS.get('C:\\RECV.BIN').s === 3, 'BBS transfer changed binary data');
        window.fileDialog = async () => 'C:\\CAPTURE.TXT'; await action(w, 'Transfers', 'Receive Text File (capture)...');
        assert(FS.read('C:\\CAPTURE.TXT').includes('Received SEND.TXT: 9 characters'), 'Transcript lost uploaded text receipt');
      } finally { window.fileDialog = file; }
      await w.close(true);
    });
    await check('restore cancellation preserves the PC', async () => {
      const pick = HostFiles.pick;
      try {
        const backup = JSON.parse(JSON.stringify(HostFiles.snapshot())); backup.cfg.userName = 'Replacement';
        HostFiles.pick = async () => [new File([JSON.stringify(backup)], 'restore.json')];
        const restoring = HostFiles.restore(); await wait(30); const d = Sys.activeTop(); button(d.body, 'No').click(); await restoring;
        assert(Store.get('userName') !== 'Replacement', 'Cancelled restore changed settings');
      } finally { HostFiles.pick = pick; }
    });
    await check('Edge live-page escape route and recovery controls' , async () => {
      const edge = Sys.run('edge', { args: 'https://example.com/' });
      assert(button(edge.body, 'Open in new window') && edge.body.innerText.includes('refuses to connect'), 'Live-page guidance is absent');
      assert(edge.body.querySelector('iframe[title="Live page from example.com"]'), 'Live frame has no accessible name');
      await edge.close(true); const settings = Sys.run('settings10', { args: 'update/recovery' });
      assert(button(settings.body, 'Download backup') && button(settings.body, 'Restore backup...'), 'Recovery controls are absent'); await settings.close(true);
    });
  } finally { await cleanWindows(); HostFiles.applyBackup(original); }
  return results;
};
