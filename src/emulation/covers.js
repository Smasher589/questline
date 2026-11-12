'use strict';
// Jaquettes et fiches des jeux emules, recuperees automatiquement puis gardees en cache disque.
// Sources (dans l'ordre) : icone locale de l'emulateur, titledb + Nintendo Europe (Switch), GameTDB (Wii/GameCube),
// libretro-thumbnails (retro, PlayStation, Xbox 360...), SteamGridDB (cle API facultative, tous systemes).
const fs = require('fs');
const path = require('path');
const { readJson, writeJson, mtime, exists, httpGet, plainName } = require('../util');
const store = require('../state');
const switchData = require('./switch');

const dir = (...p) => store.file(path.join('covers', ...p));
// images acceptees seulement depuis les sources connues (jaquettes Switch, GameTDB, libretro, SteamGridDB)
const IMG_OK = /^https:\/\/([a-z0-9-]+\.)*(nintendo\.net|nintendo\.com|nintendo-europe\.com|gametdb\.com|githubusercontent\.com|libretro\.com|steamgriddb\.com)\/[^\s"'<>]{1,500}$/i;
const fail = new Map(); // echecs recents : pas de nouvel essai avant 1 h

// ------------------------------------------------------------ fiches Switch (titledb puis Nintendo Europe)
const TITLEDB = 'https://raw.githubusercontent.com/blawar/titledb/master/FR.fr.json';
const NINTENDO_IMG = /^https:\/\/(img-eshop\.cdn\.nintendo\.net|www\.nintendo\.com|fs-prod-cdn\.nintendo-europe\.com)\/[^\s"'<>]{1,400}$/;
let meta = null;
const metaFile = () => store.file('switch_meta.json');
function switchMeta() { if (!meta) meta = readJson(metaFile(), {}); return meta; }

async function fillSwitchMeta(items) { // items : [{ tid, name }]
  const m = switchMeta();
  const missing = items.filter(i => i.tid && !m[i.tid]);
  if (!missing.length) return m;
  let changed = false;
  const day = 864e5;
  if (!m._fetchedAt || Date.now() - Date.parse(m._fetchedAt) > day) {
    m._fetchedAt = new Date().toISOString(); changed = true;
    try {
      const db = await httpGet(TITLEDB, { timeout: 180000 });
      const want = new Set(missing.map(i => i.tid));
      for (const v of Object.values(db)) {
        const id = String(v.id || '').toUpperCase();
        if (!want.has(id) || m[id]) continue;
        m[id] = { name: v.name, publisher: v.publisher, desc: v.intro || String(v.description || '').replace(/\s+/g, ' ').slice(0, 600),
          icon: NINTENDO_IMG.test(v.iconUrl || '') ? v.iconUrl : null, banner: NINTENDO_IMG.test(v.bannerUrl || '') ? v.bannerUrl : null };
      }
    } catch { /* hors ligne : nouvel essai demain */ }
  }
  for (const it of missing) {
    if (m[it.tid] || !it.name) continue;
    const k = `_search_${it.tid}`;
    if (m[k] && Date.now() - Date.parse(m[k]) < day) continue;
    m[k] = new Date().toISOString(); changed = true;
    const found = await nintendoEu(it.name);
    if (found) m[it.tid] = found;
  }
  if (changed) writeJson(metaFile(), m);
  return m;
}
async function nintendoEu(name) {
  try {
    const q = encodeURIComponent(name);
    const r = await httpGet(`https://searching.nintendo-europe.com/fr/select?q=${q}&fq=type:GAME&rows=10&wt=json&fl=title,image_url,image_url_sq_s,image_url_h2x1_s,excerpt,publisher`);
    const want = plainName(name);
    for (const d of r.response.docs || []) {
      const t = plainName(d.title);
      if (!t || !(t === want || t.includes(want) || want.includes(t))) continue;
      const pick = (...u) => u.find(x => NINTENDO_IMG.test(x || '')) || null;
      return { name: d.title, publisher: d.publisher || null, desc: d.excerpt || '', icon: pick(d.image_url_sq_s, d.image_url), banner: pick(d.image_url_h2x1_s) };
    }
  } catch { /* hors ligne */ }
  return null;
}

// ------------------------------------------------------------ libretro-thumbnails
const libretroRepo = name => name.replace(/ /g, '_');
async function libretroIndex(system) {
  const f = dir('libretro', `${system.id}.json`);
  if (exists(f) && Date.now() - mtime(f) < 30 * 864e5) return readJson(f, []);
  const repo = libretroRepo(system.libretro);
  try {
    const root = await httpGet(`https://api.github.com/repos/libretro-thumbnails/${repo}/git/trees/master`);
    const node = (root.tree || []).find(t => t.path === 'Named_Boxarts');
    const sub = node ? await httpGet(`https://api.github.com/repos/libretro-thumbnails/${repo}/git/trees/${node.sha}`) : { tree: [] };
    const names = (sub.tree || []).map(t => t.path).filter(p => p.endsWith('.png')).map(p => p.slice(0, -4));
    writeJson(f, names);
    return names;
  } catch { return exists(f) ? readJson(f, []) : []; }
}
async function libretroCover(system, name) {
  if (!system.libretro) return null;
  const names = await libretroIndex(system);
  const want = plainName(name);
  if (!want) return null;
  const hit = names.find(n => plainName(n) === want) || names.find(n => plainName(n).startsWith(want)) || names.find(n => want.startsWith(plainName(n)) && plainName(n).length > 5);
  return hit ? `https://raw.githubusercontent.com/libretro-thumbnails/${libretroRepo(system.libretro)}/master/Named_Boxarts/${encodeURIComponent(hit)}.png` : null;
}

// ------------------------------------------------------------ GameTDB (Wii / GameCube, identifiant a 6 caracteres)
function gametdbCover(system, gameId) {
  if (!gameId || !['wii', 'gamecube'].includes(system.id)) return null;
  return `https://art.gametdb.com/wii/cover/${gameId[3] === 'P' ? 'EN' : 'US'}/${gameId}.png`;
}

// ------------------------------------------------------------ SteamGridDB (facultatif)
async function steamGrid(name, kind) {
  const key = store.secret(store.config.steamGridDbKey);
  if (!key || !name) return null;
  const h = { Authorization: `Bearer ${key}` };
  try {
    const s = await httpGet(`https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(name)}`, { headers: h });
    const game = (s.data || [])[0];
    if (!game) return null;
    const url = kind === 'hero' ? `https://www.steamgriddb.com/api/v2/heroes/game/${game.id}` : `https://www.steamgriddb.com/api/v2/grids/game/${game.id}?dimensions=600x900`;
    const g = await httpGet(url, { headers: h });
    return ((g.data || [])[0] || {}).url || null;
  } catch { return null; }
}

// ------------------------------------------------------------ image d'un jeu emule (fichier en cache)
async function image(game, system, kind) {
  const safe = game.appid.replace(/[^A-Za-z0-9_-]/g, '_');
  const cached = ['png', 'jpg'].map(e => dir(`${safe}-${kind}.${e}`)).find(exists);
  if (cached) return cached;
  const key = `${game.appid}|${kind}`;
  if (fail.has(key) && Date.now() - fail.get(key) < 3600e3) return null;
  if (kind === 'cover' && game.tid) { const ico = switchData.localIcon(game.tid); if (ico) return ico; }
  let url = null;
  if (game.tid) { const m = switchMeta()[game.tid]; if (m) url = kind === 'cover' ? m.icon : kind === 'hero' ? m.banner : null; }
  if (!url && kind === 'cover') url = gametdbCover(system, game.discId) || await libretroCover(system, game.name);
  if (!url && (kind === 'cover' || kind === 'hero')) url = await steamGrid(game.name, kind);
  if (!url || !IMG_OK.test(url)) { fail.set(key, Date.now()); return null; }
  try {
    const buf = await httpGet(url, { type: 'buffer', timeout: 30000, maxBytes: 10e6 });
    const ext = buf[0] === 0x89 ? 'png' : 'jpg';
    const f = dir(`${safe}-${kind}.${ext}`);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, buf);
    return f;
  } catch { fail.set(key, Date.now()); return null; }
}

module.exports = { fillSwitchMeta, switchMeta, image };
