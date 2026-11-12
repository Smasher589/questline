'use strict';
// Lecture des formats de Steam : VDF texte, KeyValues binaire, appinfo.vdf (v28/v29),
// schemas et statistiques de succes. Aucun acces reseau.
const fs = require('fs');

// ------------------------------------------------------------ VDF texte
function parseVdf(text) {
  const root = {};
  const stack = [];
  let cur = root;
  let pending = null;
  for (const raw of text.split(/\r?\n/)) {
    const t = raw.trim();
    if (t === '{') { const n = {}; cur[pending] = n; stack.push(cur); cur = n; continue; }
    if (t === '}') { if (stack.length) cur = stack.pop(); continue; }
    const m = [...t.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(x => x[1]);
    if (m.length >= 2) cur[m[0]] = m[1].replace(/\\\\/g, '\\');
    else if (m.length === 1) pending = m[0];
  }
  return root;
}
function readVdf(path) {
  try { return parseVdf(fs.readFileSync(path, 'utf8')); } catch { return null; }
}
// acces insensible a la casse (Steam melange "UserLocalConfigStore" / "userlocalconfigstore")
function get(obj, ...keys) {
  let cur = obj;
  for (const k of keys) {
    if (!cur || typeof cur !== 'object') return undefined;
    const hit = Object.keys(cur).find(x => x.toLowerCase() === k.toLowerCase());
    cur = hit === undefined ? undefined : cur[hit];
  }
  return cur;
}

// ------------------------------------------------------------ KeyValues binaire
class Reader {
  constructor(buf, pos = 0) { this.b = buf; this.p = pos; }
  u8() { return this.b[this.p++]; }
  i32() { const v = this.b.readInt32LE(this.p); this.p += 4; return v; }
  u32() { const v = this.b.readUInt32LE(this.p); this.p += 4; return v; }
  f32() { const v = this.b.readFloatLE(this.p); this.p += 4; return v; }
  u64() { const v = this.b.readBigUInt64LE(this.p); this.p += 8; return v; }
  i64() { const v = this.b.readBigInt64LE(this.p); this.p += 8; return v; }
  cstr() { const end = this.b.indexOf(0, this.p); const s = this.b.toString('utf8', this.p, end); this.p = end + 1; return s; }
  wstr() { let s = ''; for (;;) { const c = this.b.readUInt16LE(this.p); this.p += 2; if (!c) return s; s += String.fromCharCode(c); } }
}

function readKV(r, table) {
  const kv = {};
  for (;;) {
    const type = r.u8();
    if (type === 0x08 || type === 0x0b) return kv;
    const key = table ? table[r.i32()] : r.cstr();
    switch (type) {
      case 0x00: kv[key] = readKV(r, table); break;
      case 0x01: kv[key] = r.cstr(); break;
      case 0x02: case 0x04: case 0x06: kv[key] = r.i32(); break;
      case 0x03: kv[key] = r.f32(); break;
      case 0x05: kv[key] = r.wstr(); break;
      case 0x07: kv[key] = r.u64().toString(); break;
      case 0x0a: kv[key] = r.i64().toString(); break;
      default: throw new Error(`type KV inconnu ${type}`);
    }
  }
}
function readBinaryKV(buf) { return readKV(new Reader(buf), null); }

const values = o => (o && typeof o === 'object') ? Object.values(o).filter(v => typeof v !== 'object') : [];

// ------------------------------------------------------------ appinfo.vdf
// only : Set d'appids (nombres) a decoder, les autres sont sautes (fichier de plusieurs centaines de Mo)
function loadAppInfo(path, only) {
  const buf = fs.readFileSync(path);
  const r = new Reader(buf);
  const magic = r.u32();
  r.u32(); // univers
  let table = null;
  if (magic === 0x07564429) {
    const tableOffset = Number(r.i64());
    const t = new Reader(buf, tableOffset);
    const count = t.u32();
    table = new Array(count);
    for (let i = 0; i < count; i++) table[i] = t.cstr();
  } else if (magic !== 0x07564428) {
    throw new Error('appinfo.vdf : format inconnu');
  }
  const list = [];
  for (;;) {
    const appid = r.u32();
    if (appid === 0) break;
    const size = r.u32();
    const end = r.p + size;
    if (only && !only.has(appid)) { r.p = end; continue; }
    r.p += 60; // infoState, lastUpdated, picsToken, sha1, changeNumber, binarySha1
    let root;
    try { root = readKV(r, table); } catch { r.p = end; continue; }
    r.p = end;
    const common = get(root, 'appinfo', 'common');
    if (!common) continue;
    const num = k => { const n = parseInt(get(common, k), 10); return Number.isFinite(n) ? n : 0; };
    const assoc = get(common, 'associations') || {};
    const dev = Object.values(assoc).find(a => a && a.type === 'developer');
    list.push({
      appid,
      name: get(common, 'name') || '',
      type: String(get(common, 'type') || '').toLowerCase(),
      tags: values(get(common, 'store_tags')).map(Number),
      genres: values(get(common, 'genres')).map(Number),
      categories: Object.keys(get(common, 'category') || {}).map(k => Number(k.replace('category_', ''))),
      review: num('review_percentage'),
      metacritic: num('metacritic_score'),
      releaseDate: num('steam_release_date') || num('original_release_date'),
      developer: dev ? dev.name : null,
      windows: String(get(common, 'oslist') || 'windows').includes('windows'),
    });
  }
  return list;
}

// ------------------------------------------------------------ succes Steam
function localized(node, lang) {
  if (!node || typeof node !== 'object') return typeof node === 'string' ? node : null;
  return get(node, lang) || get(node, 'english') || get(node, 'token') || null;
}
function loadAchievements(schemaPath, userStatsPath, lang = 'french') {
  if (!fs.existsSync(schemaPath)) return [];
  const schema = readBinaryKV(fs.readFileSync(schemaPath));
  const appNode = Object.values(schema).find(v => v && typeof v === 'object');
  const stats = get(appNode, 'stats');
  if (!stats) return [];
  let cache = null;
  if (userStatsPath && fs.existsSync(userStatsPath)) {
    const us = readBinaryKV(fs.readFileSync(userStatsPath));
    cache = get(us, 'cache') || us;
  }
  const res = [];
  for (const statId of Object.keys(stats)) {
    const st = stats[statId];
    if (!st || typeof st !== 'object') continue;
    const type = String(get(st, 'type'));
    if (type !== '4' && type !== '5' && type.toUpperCase() !== 'ACHIEVEMENTS') continue;
    const bits = get(st, 'bits');
    if (!bits) continue;
    const cs = cache ? get(cache, statId) : null;
    const data = cs ? BigInt(parseInt(get(cs, 'data'), 10) >>> 0) : 0n;
    const times = cs ? get(cs, 'AchievementTimes') : null;
    for (const bitKey of Object.keys(bits)) {
      const b = bits[bitKey];
      if (!b || typeof b !== 'object') continue;
      const bit = BigInt(parseInt(bitKey, 10) || 0);
      const disp = get(b, 'display');
      const id = get(b, 'name');
      res.push({
        id,
        name: localized(get(disp, 'name'), lang) || id,
        desc: localized(get(disp, 'desc'), lang) || '',
        hidden: String(get(disp, 'hidden')) === '1',
        unlocked: ((data >> bit) & 1n) === 1n,
        unlockedAt: times ? Number(get(times, bitKey)) || 0 : 0,
        icon: iconHash(get(disp, 'icon')),
        iconGray: iconHash(get(disp, 'icon_gray')),
      });
    }
  }
  return res;
}

// icone d'un succes Steam : empreinte hexadecimale du fichier sur le CDN (rien d'autre n'est accepte)
function iconHash(v) {
  const m = /^([0-9a-f]{40})(\.jpg)?$/i.exec(String(v || ''));
  return m ? m[1].toLowerCase() : null;
}

module.exports = { parseVdf, readVdf, get, readBinaryKV, loadAppInfo, loadAchievements, Reader };
