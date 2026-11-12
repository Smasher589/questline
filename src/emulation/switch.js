'use strict';
// Specifique Switch / Switch 2 : temps de jeu et sauvegardes des emulateurs (Eden, Eglantine, yuzu,
// Citron, Sudachi), fiches titledb, et succes lus dans les sauvegardes (BotW).
const fs = require('fs');
const path = require('path');
const { appData, exists, mtime, readJson, writeJson, walk, nowSec } = require('../util');
const store = require('../state');

const EMU_DATA_NAMES = ['eglantine', 'eden', 'citron', 'sudachi', 'yuzu'];
const emuDataDirs = () => EMU_DATA_NAMES.map(n => path.join(appData(), n)).filter(exists);

// ------------------------------------------------------------ temps de jeu (play_time/playtime.bin + cache/launched.json)
function playtimes() {
  const res = {};
  for (const d of emuDataDirs()) {
    try {
      const b = fs.readFileSync(path.join(d, 'play_time', 'playtime.bin'));
      for (let i = 0; i + 16 <= b.length; i += 16) {
        const tid = b.readBigUInt64LE(i).toString(16).toUpperCase().padStart(16, '0');
        const min = Math.floor(Number(b.readBigUInt64LE(i + 8)) / 60);
        res[tid] = { playtime: Math.max(min, (res[tid] || {}).playtime || 0), lastPlayed: (res[tid] || {}).lastPlayed || 0 };
      }
    } catch { /* pas de temps de jeu */ }
    const lj = readJson(path.join(d, 'cache', 'launched.json'));
    for (const [k, v] of Object.entries(lj || {})) {
      const tid = k.toUpperCase();
      res[tid] = res[tid] || { playtime: 0, lastPlayed: 0 };
      res[tid].lastPlayed = Math.max(res[tid].lastPlayed, +v.timestamp || 0);
    }
  }
  return res;
}
// jeux affiches par l'emulateur (cache\game_list\<TID>.pv.txt) : sert a relier un .nup sans identifiant
function knownTitleIds() {
  const ids = new Set();
  for (const d of emuDataDirs()) {
    try { for (const f of fs.readdirSync(path.join(d, 'cache', 'game_list'))) { const m = f.match(/^([0-9A-Fa-f]{16})\.pv\.txt$/); if (m) ids.add(m[1].toUpperCase()); } } catch { /* rien */ }
  }
  return ids;
}
function localIcon(tid) {
  for (const d of emuDataDirs()) {
    try { const f = fs.readdirSync(path.join(d, 'icons')).find(x => x.toUpperCase().endsWith(`-${tid}.ICO`)); if (f) return path.join(d, 'icons', f); } catch { /* rien */ }
  }
  return null;
}

// ------------------------------------------------------------ succes lus dans la sauvegarde
// Pas de succes officiels sur Switch : definis a partir des drapeaux de progression de la sauvegarde.
// BotW : game_data.sav = en-tete de 12 octets puis paires (CRC32 du nom du drapeau, valeur) en u32.
const DEFS = {
  '01007EF00011E000': { file: 'game_data.sav', list: [
    { id: 'BOTW_PARAGLIDER', name: 'Le Plateau du Prélude', desc: 'Obtenir la paravoile du vieil homme et quitter le plateau.', flag: 'IsGet_PlayerStole2' },
    { id: 'BOTW_SHRINE_1', name: 'Premier sanctuaire', desc: 'Terminer un sanctuaire.', shrines: 1 },
    { id: 'BOTW_SHRINE_10', name: 'Pèlerin', desc: 'Terminer 10 sanctuaires.', shrines: 10 },
    { id: 'BOTW_SHRINE_50', name: 'Moine des sanctuaires', desc: 'Terminer 50 sanctuaires.', shrines: 50 },
    { id: 'BOTW_RUTA', name: 'Vah Ruta', desc: 'Libérer la Créature divine du Domaine Zora.', flag: 'Clear_RemainsWater' },
    { id: 'BOTW_RUDANIA', name: 'Vah Rudania', desc: 'Libérer la Créature divine du Mont de la Mort.', flag: 'Clear_RemainsFire' },
    { id: 'BOTW_MEDOH', name: 'Vah Medoh', desc: 'Libérer la Créature divine du village Piaf.', flag: 'Clear_RemainsWind' },
    { id: 'BOTW_NABORIS', name: 'Vah Naboris', desc: 'Libérer la Créature divine du désert Gerudo.', flag: 'Clear_RemainsElectric' },
    { id: 'BOTW_BEASTS', name: 'Les quatre Prodiges', desc: 'Libérer les quatre Créatures divines.', flags: ['Clear_RemainsWater', 'Clear_RemainsFire', 'Clear_RemainsWind', 'Clear_RemainsElectric'] },
    { id: 'BOTW_GANON', name: 'Vaincre Ganon', desc: "Terminer l'histoire principale : vaincre Ganon et sauver Hyrule.", flag: 'GanonQuest_Finished' },
    { id: 'BOTW_SHRINE_120', name: 'Tous les sanctuaires', desc: "Terminer les 120 sanctuaires d'Hyrule.", shrines: 120 },
    { id: 'BOTW_BALLAD', name: 'La Ballade des Prodiges', desc: 'Terminer les 16 sanctuaires de la Ballade des Prodiges (DLC 2).', dlcShrines: 16 },
  ] },
};
const hasAchievements = tid => !!DEFS[tid];

const CRC = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
function crc32(s) { let c = 0xffffffff; for (const b of Buffer.from(s, 'ascii')) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

function saveDirs(tid) {
  const out = [];
  for (const d of emuDataDirs()) {
    const root = path.join(d, 'nand', 'user', 'save', '0000000000000000');
    try { for (const u of fs.readdirSync(root)) { const p = path.join(root, u, tid); if (exists(p)) out.push(p); } } catch { /* rien */ }
  }
  return out;
}
const cache = new Map();
function achievements(tid) {
  const def = DEFS[tid];
  if (!def) return [];
  const saves = saveDirs(tid).flatMap(d => walk(d, { depth: 2, filter: (f, n) => n === def.file })).sort((a, b) => mtime(b) - mtime(a));
  const save = saves[0];
  const stamp = save ? `${save}|${mtime(save)}` : '';
  const c = cache.get(tid);
  if (c && c.stamp === stamp) return c.list;

  const want = new Map();
  for (const a of def.list) for (const f of [a.flag, ...(a.flags || [])]) if (f) want.set(crc32(f), f);
  for (let n = 0; n < 136; n++) want.set(crc32(`Clear_Dungeon${String(n).padStart(3, '0')}`), `D${n}`);
  const vals = new Map();
  if (save) {
    try {
      const b = fs.readFileSync(save);
      for (let o = 12; o + 8 <= b.length; o += 8) { const h = b.readUInt32LE(o); const k = want.get(h); if (k && !vals.has(k)) vals.set(k, b.readUInt32LE(o + 4)); }
    } catch { /* sauvegarde en cours d'ecriture */ }
  }
  let shrines = 0, dlc = 0;
  for (const [k, v] of vals) { const m = k.match(/^D(\d+)$/); if (m && v > 0) { if (+m[1] < 120) shrines++; else dlc++; } }

  const seenFile = store.file('switch_achievements.json');
  const seen = readJson(seenFile, {}); seen[tid] = seen[tid] || {};
  let dirty = false;
  const list = [];
  for (const a of def.list) {
    const need = [a.flag, ...(a.flags || [])].filter(Boolean);
    // drapeau absent de la sauvegarde = nom non verifie pour ce jeu : succes masque plutot que bloque a vie
    if (save && vals.size && need.some(f => !vals.has(f))) continue;
    const ok = a.flag ? vals.get(a.flag) > 0 : a.flags ? a.flags.every(f => vals.get(f) > 0)
      : a.shrines ? shrines >= a.shrines : a.dlcShrines ? dlc >= a.dlcShrines : false;
    if (ok && !seen[tid][a.id]) { seen[tid][a.id] = nowSec(); dirty = true; }
    list.push({ id: a.id, name: a.name, desc: a.desc, hidden: false, unlocked: !!ok, unlockedAt: ok ? seen[tid][a.id] : 0 });
  }
  if (dirty) writeJson(seenFile, seen);
  cache.set(tid, { stamp, list });
  return list;
}

module.exports = { emuDataDirs, playtimes, knownTitleIds, localIcon, hasAchievements, achievements, crc32 };
