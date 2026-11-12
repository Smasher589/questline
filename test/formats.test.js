'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseVdf, readBinaryKV, get } = require('../src/vdf');
const { findStory, progressOf } = require('../src/story');
const { crc32 } = require('../src/emulation/switch');
const { cleanName } = require('../src/emulation/scan');
const { plainName } = require('../src/util');
const { isChild } = require('../src/guard');

test('VDF texte : imbrication, chemins Windows echappes, casse', () => {
  const v = parseVdf('"libraryfolders"\n{\n "0"\n {\n  "path"  "D:\\\\Steam"\n }\n}\n');
  assert.strictEqual(get(v, 'LibraryFolders', '0', 'path'), 'D:\\Steam');
});

test('KeyValues binaire : chaines, entiers, sous-noeuds', () => {
  const parts = [];
  const str = s => Buffer.concat([Buffer.from(s, 'utf8'), Buffer.from([0])]);
  const i32 = n => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b; };
  parts.push(Buffer.from([0x00]), str('app'), Buffer.from([0x01]), str('name'), str('Jeu'), Buffer.from([0x02]), str('n'), i32(42), Buffer.from([0x08]), Buffer.from([0x08]));
  const kv = readBinaryKV(Buffer.concat(parts));
  assert.deepStrictEqual(kv, { app: { name: 'Jeu', n: 42 } });
});

test('succes de fin : detection par texte, exclusions, succes connus', () => {
  const list = [
    { id: 'A', name: 'Chapitre 1', desc: 'Terminer le chapitre 1' },
    { id: 'B', name: 'Héros', desc: "Terminer l'histoire principale" },
    { id: 'C', name: 'Expert', desc: "Terminer l'histoire principale en difficile" },
  ];
  assert.strictEqual(findStory(list, '1').id, 'B');
  assert.strictEqual(findStory([{ id: 'BOTW_GANON', name: 'x', desc: '' }], 'switch:01007EF00011E000').id, 'BOTW_GANON');
  const p = progressOf([{ id: 'B', name: 'Héros', desc: "Terminer l'histoire principale", unlocked: true }, { id: 'D', name: 'x', desc: '', unlocked: false }], '1');
  assert.deepStrictEqual([p.total, p.unlocked, p.storyDone, p.perfect], [2, 1, true, false]);
});

test('CRC32 standard (drapeaux de sauvegarde BotW)', () => {
  assert.strictEqual(crc32('123456789'), 0xcbf43926);
});

test('noms de jeux emules nettoyes', () => {
  assert.strictEqual(cleanName('/j/Super Mario Odyssey [0100000000010000][v0] (EU).nsp'), 'Super Mario Odyssey');
  assert.strictEqual(cleanName('/j/Pokemon Pokopia.nup'), 'Pokemon Pokopia');
  assert.strictEqual(plainName('Pokémon Pokopia'), plainName('Pokemon Pokopia'));
});

test('suppressions limitees au dossier attendu', () => {
  const path = require('path');
  const base = path.resolve('/steam/steamapps/common');
  assert.ok(isChild(path.join(base, 'Jeu'), base));
  assert.ok(!isChild(path.join(base, '..', '..', 'Users'), base));
  assert.ok(!isChild(base, base));
});
