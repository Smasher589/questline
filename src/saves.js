'use strict';
// Dossiers de sauvegarde d'un jeu Steam (Steam Cloud) et copie de secours.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exists, walk } = require('./util');
const steam = require('./platforms/steam');
const { isChild } = require('./guard');

function saveDirs(appid) {
  if (!/^\d{1,10}$/.test(String(appid))) return [];
  const ud = steam.userDir();
  if (!ud) return [];
  const dirs = new Map();
  const remote = path.join(ud, String(appid), 'remote');
  if (exists(remote)) dirs.set(remote, 'Steam Cloud');
  const rc = path.join(ud, String(appid), 'remotecache.vdf');
  if (exists(rc)) {
    const home = os.homedir();
    const bases = process.platform === 'win32' ? [
      [process.env.LOCALAPPDATA, 'AppData\\Local'], [process.env.APPDATA, 'AppData\\Roaming'], [path.join(home, 'Documents'), 'Documents'],
      [path.join(home, 'Saved Games'), 'Parties enregistrées'], [path.join(home, 'AppData', 'LocalLow'), 'AppData\\LocalLow'],
    ] : [[path.join(home, '.local', 'share'), '.local/share'], [path.join(home, '.config'), '.config'], [path.join(home, 'Library', 'Application Support'), 'Application Support']];
    const txt = fs.readFileSync(rc, 'utf8');
    for (const m of txt.matchAll(/^\s*"([^"]+[/\\][^"]+)"\s*$/gm)) {
      const rel = m[1];
      if (/:/.test(rel) || /^[/\\]/.test(rel) || rel.split(/[/\\]/).some(p => p === '.' || p === '..')) continue;
      for (const [base, label] of bases) {
        if (!base) continue;
        const full = path.join(base, rel);
        // une entree avec des .. ne doit pas sortir du dossier racine
        if (!isChild(full, base) || !exists(full)) continue;
        const d = path.dirname(full);
        if (path.resolve(d) === path.resolve(base) || !isChild(d, base)) continue;
        if (!dirs.has(d)) dirs.set(d, label);
        break;
      }
      if (dirs.size >= 6) break;
    }
  }
  return [...dirs].map(([p, kind]) => ({ path: p, kind }));
}

function backup(appid, name) {
  const dirs = saveDirs(appid);
  const clean = String(name || appid).replace(/[\\/:*?"<>|™®]/g, '').trim() || String(appid);
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', 'h');
  const dest = path.join(os.homedir(), 'Documents', 'Sauvegardes Questline', `${clean} ${stamp}`);
  let files = 0;
  for (const d of dirs) {
    const to = path.join(dest, d.kind.replace(/[\\/]/g, ' - '));
    fs.mkdirSync(to, { recursive: true });
    try { fs.cpSync(d.path, to, { recursive: true, force: true }); } catch { /* fichier verrouille */ }
    files += walk(to, { depth: 10 }).length;
  }
  return { files, path: dest };
}

module.exports = { saveDirs, backup };
