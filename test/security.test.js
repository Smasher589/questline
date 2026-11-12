'use strict';
// Tests 2.20 : corrections de l'audit de securite.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ql-sec-'));
fs.writeFileSync(path.join(tmp, 'state.json'), '{"flags":{"__proto__":{"polluted":true},"ok":true},"settings":{"__proto__":{"bad":1},"sounds":false}}');
const store = require('../src/state');
store.init(tmp);

test('state.json : une cle __proto__ ne pollue pas les objets', () => {
  assert.strictEqual(({}).polluted, undefined);
  assert.strictEqual(({}).bad, undefined);
  assert.strictEqual(store.state.flags.ok, true);
  assert.strictEqual(store.state.settings.sounds, false);
});

test('comptes : une plateforme « __proto__ » est refusee sans polluer', async () => {
  const sources = require('../src/sources');
  const r = await sources.action('account', { platform: '__proto__', enabled: true });
  assert.ok(r.error);
  assert.strictEqual(({}).enabled, undefined);
});

test('cles d\'API : chiffrees quand un coffre est disponible, relues en clair', () => {
  store.config.steamGridDbKey = 'cle-en-clair';
  store.setProtector({ enc: s => Buffer.from(s).toString('base64'), dec: b => Buffer.from(b, 'base64').toString() });
  assert.ok(store.config.steamGridDbKey.startsWith('enc:'), 'la cle existante est migree');
  assert.strictEqual(store.secret(store.config.steamGridDbKey), 'cle-en-clair');
  assert.ok(store.seal('abc').startsWith('enc:'));
  assert.strictEqual(store.secret(''), '');
});

test('binaires systeme : chemin absolu sous Windows', () => {
  const { sysBin } = require('../src/util');
  if (process.platform === 'win32') {
    assert.ok(path.isAbsolute(sysBin('reg.exe')));
    assert.match(sysBin('reg.exe'), /System32[\\/]reg\.exe$/i);
  } else assert.strictEqual(sysBin('ps'), 'ps');
});

test('telechargements : une reponse trop volumineuse est interrompue', async () => {
  const { httpGet } = require('../src/util');
  const srv = http.createServer((req, res) => { res.writeHead(200); res.end(Buffer.alloc(2e6, 97)); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${srv.address().port}/`;
  try {
    await assert.rejects(httpGet(url, { type: 'text', maxBytes: 1e6 }), /volumineuse/);
    assert.strictEqual((await httpGet(url, { type: 'text', maxBytes: 3e6 })).length, 2e6);
  } finally { srv.close(); }
});

test('serveur local : sans jeton, tout est refuse', async () => {
  const server = require('../src/server');
  const port = await server.start({}, 0);
  const status = await new Promise(resolve => http.get({ host: '127.0.0.1', port, path: '/api/state', headers: { host: `127.0.0.1:${port}` } }, r => { r.resume(); resolve(r.statusCode); }));
  assert.strictEqual(status, 403);
});

test.after(() => { fs.rmSync(tmp, { recursive: true, force: true }); setTimeout(() => process.exit(0), 50).unref(); });
