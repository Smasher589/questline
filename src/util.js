'use strict';
// Outils communs : chemins par systeme, JSON sur disque, requetes HTTP avec delai.
const fs = require('fs');
const path = require('path');
const os = require('os');

const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';
const HOME = os.homedir();

// Dossiers de donnees des autres applications, selon le systeme
const appData = () => process.env.APPDATA || (IS_MAC ? path.join(HOME, 'Library', 'Application Support') : process.env.XDG_CONFIG_HOME || path.join(HOME, '.config'));
const localAppData = () => process.env.LOCALAPPDATA || (IS_MAC ? path.join(HOME, 'Library', 'Application Support') : process.env.XDG_DATA_HOME || path.join(HOME, '.local', 'share'));

const exists = p => { try { return !!p && fs.existsSync(p); } catch { return false; } };
const isDir = p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const mtime = p => { try { return fs.statSync(p).mtimeMs; } catch { return 0; } };

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch { return fallback; }
}
// ecriture atomique : un fichier a moitie ecrit ne remplace jamais le precedent
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, file);
}

async function httpGet(url, { timeout = 20000, type = 'json', headers = {}, method = 'GET', body, maxBytes = 100e6 } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(url, { method, body, headers: { 'User-Agent': 'Questline', ...headers }, signal: ctl.signal, redirect: 'follow' });
    if (!res.ok) { const e = new Error(`HTTP ${res.status}`); e.status = res.status; throw e; }
    if (res.url && !res.url.startsWith('https://') && url.startsWith('https://')) throw new Error('Redirection non sécurisée refusée');
    if (+res.headers.get('content-length') > maxBytes) throw new Error('Réponse trop volumineuse');
    // lecture plafonnée : on s'arrête dès que la limite est dépassée
    const chunks = []; let total = 0;
    for await (const c of res.body) { total += c.length; if (total > maxBytes) { ctl.abort(); throw new Error('Réponse trop volumineuse'); } chunks.push(c); }
    const buf = Buffer.concat(chunks);
    if (type === 'json') return JSON.parse(buf.toString('utf8'));
    if (type === 'buffer') return buf;
    return buf.toString('utf8');
  } finally { clearTimeout(timer); }
}

// liste recursive de fichiers (profondeur limitee, liens symboliques ignores)
function walk(dir, { depth = 6, filter = () => true } = {}) {
  const out = [];
  const go = (d, lvl) => {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) { if (lvl < depth) go(full, lvl + 1); }
      else if (filter(full, e.name)) out.push(full);
    }
  };
  go(dir, 0);
  return out;
}

// nom simplifie pour comparer deux titres (accents, ponctuation, casse et articles ignores)
function plainName(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
}

const nowSec = () => Math.floor(Date.now() / 1000);

// binaire systeme Windows par chemin absolu (jamais un exe du meme nom dans le dossier courant)
const sysBin = name => (IS_WIN ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', name) : name);

module.exports = { sysBin, IS_WIN, IS_MAC, HOME, appData, localAppData, exists, isDir, mtime, readJson, writeJson, httpGet, walk, plainName, nowSec };
