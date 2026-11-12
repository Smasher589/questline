'use strict';
// Scan des dossiers de jeux configures pour chaque emulateur -> liste de jeux Questline.
const path = require('path');
const crypto = require('crypto');
const { walk, exists } = require('../util');
const store = require('../state');
const systems = require('./systems');
const switchData = require('./switch');
const covers = require('./covers');

const SKIP_DIR = /[\\/](dlc|updates?|mises? a jour|mises? à jour|patch(es)?)([\\/]|$)/i;
const hash = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);

// "Super Mario Odyssey [0100000000010000][v0] (EU).nsp" -> "Super Mario Odyssey"
function cleanName(file) {
  const base = path.basename(file).replace(/\.[^.]+$/, '');
  return base.replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim() || base;
}

// un jeu "dossier" (PS3, PS4, Wii U extrait) : le fichier a lancer est dans le dossier du jeu
function folderGames(root, pattern) {
  const last = pattern.split('/').pop().toLowerCase();
  const files = walk(root, { depth: 6, filter: (f, n) => n.toLowerCase() === last || (last.startsWith('*') && n.toLowerCase().endsWith(last.slice(1))) });
  return files.map(f => {
    let gameDir = f;
    for (let i = 0; i < pattern.split('/').length; i++) gameDir = path.dirname(gameDir);
    return { launch: f, name: path.basename(gameDir), size: 0 };
  });
}

function scanEntry(entry) {
  const sys = systems.byId(entry.system);
  if (!sys) return [];
  const extRe = new RegExp(`\\.(${sys.exts.join('|')})$`, 'i');
  const found = [];
  for (const root of entry.romDirs || []) {
    if (!exists(root)) continue;
    if (sys.folderGame) for (const g of folderGames(root, sys.folderGame)) found.push({ file: g.launch, name: g.name });
    for (const f of walk(root, { depth: 6, filter: (p, n) => extRe.test(n) })) {
      if (SKIP_DIR.test(path.dirname(f))) continue;
      if (sys.folderGame && sys.exts.length === 1 && sys.exts[0] === 'bin') continue; // PS4 : seulement les dossiers de jeux
      found.push({ file: f, name: cleanName(f) });
    }
  }
  // PS1 multi-disques : un .m3u remplace ses disques
  if (sys.multiDisc) {
    const m3u = found.filter(g => /\.m3u$/i.test(g.file)).map(g => path.dirname(g.file));
    for (let i = found.length - 1; i >= 0; i--) if (!/\.m3u$/i.test(found[i].file) && m3u.includes(path.dirname(found[i].file))) found.splice(i, 1);
  }
  return found.map(g => {
    const tidM = sys.titleIds ? path.basename(g.file).match(/\[([0-9A-Fa-f]{16})\]/) : null;
    const discM = path.basename(g.file).match(/\[([A-Z0-9]{6})\]/);
    return { ...g, system: sys.id, entryId: entry.id, tid: tidM ? tidM[1].toUpperCase() : null, discId: discM ? discM[1] : null };
  });
}

async function games(sessionPlay) {
  const all = store.config.emulators.flatMap(scanEntry);
  // Switch : mises a jour et DLC ignorees (identifiant qui ne finit pas par 000)
  const list = all.filter(g => !g.tid || g.tid.endsWith('000'));
  // Switch : un fichier sans identifiant (.nup) seul -> le jeu de la liste de l'emulateur qui n'a aucun fichier
  const noId = list.filter(g => (g.system === 'switch' || g.system === 'switch2') && !g.tid);
  if (noId.length === 1) {
    const known = new Set(list.map(g => g.tid).filter(Boolean));
    const cands = [...switchData.knownTitleIds()].filter(t => !known.has(t));
    if (cands.length === 1) noId[0].tid = cands[0];
  }
  const sw = switchData.playtimes();
  const meta = await covers.fillSwitchMeta(list.filter(g => g.tid).map(g => ({ tid: g.tid, name: g.name })));
  const seen = new Set();
  const out = [];
  for (const g of list) {
    const appid = g.tid ? `switch:${g.tid}` : `emu:${g.system}:${hash(g.file)}`;
    if (seen.has(appid)) continue;
    seen.add(appid);
    const m = g.tid ? meta[g.tid] : null;
    const p1 = g.tid ? sw[g.tid] : null, p2 = sessionPlay[appid];
    const sys = systems.byId(g.system);
    out.push({
      appid, name: (m && m.name) || g.name, platform: 'emu', system: sys.name, systemId: sys.id, emuEntry: g.entryId,
      tid: g.tid, discId: g.discId, file: g.file, installed: true, sizeGB: null, dev: m ? m.publisher : null, desc: m ? m.desc : null,
      cover: `/img/${encodeURIComponent(appid)}/cover`, hero: m && m.banner ? `/img/${encodeURIComponent(appid)}/hero` : null,
      tags: [], genres: [], cats: [2], review: 0, windows: true,
      playtime: Math.max((p1 && p1.playtime) || 0, (p2 && p2.playtime) || 0),
      lastPlayed: Math.max((p1 && p1.lastPlayed) || 0, (p2 && p2.lastPlayed) || 0),
      achievements: !!(g.tid && switchData.hasAchievements(g.tid)),
    });
  }
  return out;
}

module.exports = { games, cleanName, scanEntry };
