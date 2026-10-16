const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function pc(seed = {}) {
  const values = new Map(Object.entries(seed));
  let fail = false, limit = Infinity;
  const context = vm.createContext({
    console, setTimeout, clearTimeout, Date, JSON, Object, Intl,
    window: { addEventListener() {} },
    localStorage: {
      getItem: k => values.get(k) ?? null,
      setItem: (k, v) => { if (fail || [...values].reduce((sum, [key, value]) => sum + (key === k ? 0 : value.length), 0) + v.length > limit) throw new Error('Quota exceeded'); values.set(k, v); },
      removeItem: k => values.delete(k)
    },
    Sys: { isNeo: () => true, now: () => new Date(), apps: {}, env: {} },
    KNOWN: { recycle: 'C:\\RECYCLED', desktop: 'C:\\DESKTOP' },
    msgBox: async () => 'yes'
  });
  for (const path of ['js/util.js', 'js/fs.js', 'js/neo10/fileops.js', 'js/hostfiles.js']) vm.runInContext(fs.readFileSync(path, 'utf8'), context, { filename: path });
  return { run: code => vm.runInContext(code, context), values, limit: value => { limit = value; }, fail: value => { fail = value; }, close: () => vm.runInContext('clearTimeout(Store._t); clearTimeout(FS._t)', context) };
}

test('legacy files and settings migrate together and survive reload', () => {
  const first = pc(); const tree = first.run('JSON.stringify(FS.root)'); first.close();
  const old = pc({ 'neo31.v1.fs': tree, 'neo31.v1.cfg': JSON.stringify({ shell: 'win31', userName: 'Ada' }) });
  old.run("FS.write('C:\\\\TEST.TXT', 'Saved'); Store.set('shell', 'neo10'); FS.flush()");
  assert.equal(old.values.has('neo31.v1.cfg'), false);
  assert.equal(JSON.parse(old.values.get('neo31.v1.fs')).version, 1);
  const loaded = pc(Object.fromEntries(old.values));
  assert.equal(loaded.run("FS.read('C:\\\\TEST.TXT')"), 'Saved');
  assert.equal(loaded.run("Store.get('shell')"), 'neo10');
  assert.equal(loaded.run("Store.get('userName')"), 'Ada'); old.close(); loaded.close();
});

test('failed persistence keeps the saved snapshot and the current files recoverable', () => {
  const app = pc(); app.run('FS.flush()'); const before = app.values.get('neo31.v1.fs');
  app.fail(true); app.run("FS.write('C:\\\\UNSAVED.TXT', 'Recover me')");
  assert.equal(app.run('FS.flush()'), false);
  assert.equal(app.values.get('neo31.v1.fs'), before);
  assert.equal(app.run("HostFiles.snapshot().fs.c['UNSAVED.TXT'].x"), 'Recover me');
  assert.ok(app.run('Persistence.error'));
  app.fail(false); assert.equal(app.run('Store.flush()'), true);
  assert.equal(app.run('Persistence.error'), null); app.close();
});

test('backup restore replaces files and settings atomically; failure preserves both', () => {
  const app = pc();
  app.run("FS.write('C:\\\\OLD.TXT', 'old'); Store.set('userName', 'Old'); FS.flush(); var backup = JSON.parse(JSON.stringify(HostFiles.snapshot())); backup.cfg.userName = 'New'; backup.fs.c['OLD.TXT'].x = 'new'");
  const before = app.values.get('neo31.v1.fs'); app.fail(true);
  assert.throws(() => app.run('HostFiles.applyBackup(backup)'), /Quota/);
  assert.equal(app.values.get('neo31.v1.fs'), before);
  assert.equal(app.run("FS.read('C:\\\\OLD.TXT')"), 'old');
  assert.equal(app.run("Store.get('userName')"), 'Old');
  app.fail(false); app.run('HostFiles.applyBackup(backup)');
  const loaded = pc(Object.fromEntries(app.values));
  assert.equal(loaded.run("FS.read('C:\\\\OLD.TXT')"), 'new');
  assert.equal(loaded.run("Store.get('userName')"), 'New'); app.close(); loaded.close();
});

test('invalid and malicious backups cannot change current storage', () => {
  const app = pc(); app.run('FS.flush()'); const before = app.values.get('neo31.v1.fs');
  for (const mutation of ["b.version = 9", "b.fs.c.WINDOWS = {t: 'f', x: 'wrong'}", "b.fs.c.BAD = {t: 'd', c: null}", "b.fs.c['../BAD'] = {t:'f',x:''}", "b.cfg = JSON.parse('{\"__proto__\":{\"bad\":true}}')", "b.fs.c.BAD = {t:'f',x:42}"]) {
    assert.throws(() => app.run(`var b = JSON.parse(JSON.stringify(HostFiles.snapshot())); ${mutation}; HostFiles.applyBackup(b)`));
    assert.equal(app.values.get('neo31.v1.fs'), before);
  }
  app.close();
});

test('file move and Recycle Bin restore preserve content across reload', async () => {
  const app = pc();
  app.run("FS.mkdir('C:\\\\RECYCLED'); FS.mkdir('C:\\\\DESKTOP'); FS.mkdir('C:\\\\DOCS'); FS.write('C:\\\\TEST.TXT', 'Keep me'); FS.copy('C:\\\\TEST.TXT', 'C:\\\\DOCS\\\\TEST.TXT', null, true)");
  assert.equal(app.run("FS.exists('C:\\\\TEST.TXT')"), false);
  await app.run("FileOps.recycle(['C:\\\\DOCS\\\\TEST.TXT'], false)");
  assert.equal(app.run("FS.exists('C:\\\\DOCS\\\\TEST.TXT')"), false);
  app.run("FileOps.restore(FS.join(KNOWN.recycle, FS.list(KNOWN.recycle)[0].name)); FS.flush()");
  const loaded = pc(Object.fromEntries(app.values));
  assert.equal(loaded.run("FS.read('C:\\\\DOCS\\\\TEST.TXT')"), 'Keep me'); app.close(); loaded.close();
});


test('migration fits without allocating a second copy of the filesystem', () => {
  const seed = pc(); seed.run("FS.write('C:\\\\LARGE.TXT', 'x'.repeat(100000))"); const tree = seed.run('JSON.stringify(FS.root)'); seed.close();
  const app = pc({ 'neo31.v1.fs': tree, 'neo31.v1.cfg': '{"shell":"neo10"}' });
  app.limit(tree.length + 2048);
  assert.equal(app.run('Store.flush()'), true);
  assert.equal(JSON.parse(app.values.get('neo31.v1.fs')).fs.c['LARGE.TXT'].x.length, 100000); app.close();
});

test('sound export emits a valid mono PCM WAV header and samples', () => {
  const app = pc();
  const wav = app.run('HostFiles.wave({rate:8000, data: new Float32Array([-1,0,1])})');
  assert.equal(Buffer.from(wav).subarray(0,4).toString(), 'RIFF');
  assert.equal(Buffer.from(wav).readUInt32LE(24), 8000);
  assert.equal(Buffer.from(wav).readUInt32LE(40), 3);
  assert.deepEqual(Array.from(wav.slice(44)), [1,128,255]); app.close();
});


test('restored state does not mutate the backup object on subsequent edits', () => {
  const app = pc();
  app.run("var original = JSON.parse(JSON.stringify(HostFiles.snapshot())); var originalText = JSON.stringify(original); HostFiles.applyBackup(original); FS.write('C:\\\\NEW.TXT', 'new'); Store.set('userName', 'changed')");
  assert.equal(app.run('JSON.stringify(original)'), app.run('originalText')); app.close();
});
