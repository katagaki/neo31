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
    Sys: { now: () => new Date(), apps: {}, env: {} },
    KNOWN: { recycle: 'C:\\RECYCLED', desktop: 'C:\\DESKTOP' },
    msgBox: async () => 'yes'
  });
  for (const path of ['js/util.js', 'js/fs.js', 'js/windows31/fileops.js', 'js/hostfiles.js']) vm.runInContext(fs.readFileSync(path, 'utf8'), context, { filename: path });
  return { run: code => vm.runInContext(code, context), values, limit: value => { limit = value; }, fail: value => { fail = value; }, close: () => vm.runInContext('clearTimeout(Store._t); clearTimeout(FS._t)', context) };
}

test('legacy files and settings migrate together and survive reload', () => {
  const first = pc(); const tree = first.run('JSON.stringify(FS.root)'); first.close();
  const old = pc({ 'neo31.v1.fs': tree, 'neo31.v1.cfg': JSON.stringify({ shell: 'win31', userName: 'Ada' }) });
  old.run("FS.write('C:\\\\TEST.TXT', 'Saved'); Store.set('theme', 'dark'); FS.flush()");
  assert.equal(old.values.has('neo31.v1.cfg'), false);
  assert.equal(old.values.has('neo31.v1.fs'), false);
  assert.equal(JSON.parse(old.values.get('windows31.v1.fs')).version, 1);
  const loaded = pc(Object.fromEntries(old.values));
  assert.equal(loaded.run("FS.read('C:\\\\TEST.TXT')"), 'Saved');
  assert.equal(loaded.run("Store.get('theme')"), 'dark');
  assert.equal(loaded.run("Store.get('userName')"), 'Ada'); old.close(); loaded.close();
});

test('failed persistence keeps the saved snapshot and the current files recoverable', () => {
  const app = pc(); app.run('FS.flush()'); const before = app.values.get('windows31.v1.fs');
  app.fail(true); app.run("FS.write('C:\\\\UNSAVED.TXT', 'Recover me')");
  assert.equal(app.run('FS.flush()'), false);
  assert.equal(app.values.get('windows31.v1.fs'), before);
  assert.equal(app.run("FS.read('C:\\\\UNSAVED.TXT')"), 'Recover me');
  assert.ok(app.run('Persistence.error'));
  app.fail(false); assert.equal(app.run('Store.flush()'), true);
  assert.equal(app.run('Persistence.error'), null); app.close();
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


test('saved addresses from before the Windows 31 name point at the new offline web', () => {
  const app = pc({ 'neo31.v1.cfg': JSON.stringify({ 'edge.favs': [{ title: 'Home', url: 'https://neo31.net/' }] }) });
  assert.equal(app.run("Store.get('edge.favs')[0].url"), 'https://windows31.net/');
  app.close();
});

test('migration fits without allocating a second copy of the filesystem', () => {
  const seed = pc(); seed.run("FS.write('C:\\\\LARGE.TXT', 'x'.repeat(100000))"); const tree = seed.run('JSON.stringify(FS.root)'); seed.close();
  const app = pc({ 'neo31.v1.fs': tree, 'neo31.v1.cfg': '{"shell":"neo10"}' });
  app.limit(tree.length + 2048);
  assert.equal(app.run('Store.flush()'), true);
  assert.equal(JSON.parse(app.values.get('windows31.v1.fs')).fs.c['LARGE.TXT'].x.length, 100000);
  assert.equal(app.values.has('neo31.v1.fs'), false); app.close();
});

test('sound export emits a valid mono PCM WAV header and samples', () => {
  const app = pc();
  const wav = app.run('HostFiles.wave({rate:8000, data: new Float32Array([-1,0,1])})');
  assert.equal(Buffer.from(wav).subarray(0,4).toString(), 'RIFF');
  assert.equal(Buffer.from(wav).readUInt32LE(24), 8000);
  assert.equal(Buffer.from(wav).readUInt32LE(40), 3);
  assert.deepEqual(Array.from(wav.slice(44)), [1,128,255]); app.close();
});
