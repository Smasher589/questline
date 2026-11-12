'use strict';
// Steam : dossier d'installation, bibliotheques, jeux installes, temps de jeu, bibliotheque complete
// (compte + famille, via le cache local), succes. Windows, Linux et macOS.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { IS_WIN, IS_MAC, HOME, exists, mtime, readJson, writeJson, httpGet, sysBin } = require('../util');
const { readVdf, get, loadAppInfo, loadAchievements } = require('../vdf');
const store = require('../state');

const STEAM64_BASE = 76561197960265728n;
// Outils Steam qui ne sont pas des jeux : jamais bloques, jamais proposes
const TOOL_IDS = new Set(['228980', '1493710', '2180100', '1628350', '4183110', '1070560', '1391110', '1826330', '250820', '231350', '431960', '1887720', '2348590', '2805730']);
const TOOL_RE = /Proton|Steam Linux Runtime|Steamworks|Redistributable|SteamVR|Wallpaper Engine|3DMark|Soundtrack|Dedicated Server|SDK/;
const isTool = (id, name) => TOOL_IDS.has(String(id)) || TOOL_RE.test(name || '');

let rootCache = null;
function steamRoot() {
  if (rootCache && exists(rootCache)) return rootCache;
  const cands = [];
  if (IS_WIN) {
    try {
      const out = execFileSync(sysBin('reg.exe'), ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
      const m = out.match(/SteamPath\s+REG_SZ\s+(.+)/);
      if (m) cands.push(m[1].trim().replace(/\//g, '\\'));
    } catch { /* Steam absent */ }
    cands.push('C:\\Program Files (x86)\\Steam');
  } else if (IS_MAC) {
    cands.push(path.join(HOME, 'Library', 'Application Support', 'Steam'));
  } else {
    cands.push(path.join(HOME, '.steam', 'steam'), path.join(HOME, '.local', 'share', 'Steam'),
      path.join(HOME, '.var', 'app', 'com.valvesoftware.Steam', '.local', 'share', 'Steam'));
  }
  rootCache = cands.find(p => exists(path.join(p, 'steamapps'))) || null;
  return rootCache;
}

// ------------------------------------------------------------ comptes connus sur ce PC
function users() {
  const root = steamRoot();
  const lu = root && readVdf(path.join(root, 'config', 'loginusers.vdf'));
  const list = [];
  for (const [id64, u] of Object.entries(get(lu, 'users') || {})) {
    let accountId; try { accountId = String(BigInt(id64) - STEAM64_BASE); } catch { continue; }
    list.push({ id64, accountId, name: u.PersonaName || u.AccountName || accountId, mostRecent: u.MostRecent === '1' });
  }
  return list;
}
// compte relie par l'utilisateur ; "auto" (anciennes configurations) = dernier compte connecte sur ce PC
function accountId() {
  const conf = store.config.accounts.steam;
  if (!conf.accountId) return null;
  if (conf.accountId !== 'auto') return String(conf.accountId);
  const us = users();
  const recent = us.find(u => u.mostRecent) || us[0];
  if (recent) return recent.accountId;
  const root = steamRoot();
  try {
    const dirs = fs.readdirSync(path.join(root, 'userdata')).map(d => ({ d, t: mtime(path.join(root, 'userdata', d)) }));
    dirs.sort((a, b) => b.t - a.t);
    return dirs[0] ? dirs[0].d : null;
  } catch { return null; }
}
const userDir = () => { const r = steamRoot(), a = accountId(); return r && a ? path.join(r, 'userdata', a) : null; };

// ------------------------------------------------------------ bibliotheques et manifestes
function libraries() {
  const root = steamRoot();
  if (!root) return [];
  const libs = [root];
  const v = readVdf(path.join(root, 'steamapps', 'libraryfolders.vdf'));
  for (const f of Object.values(get(v, 'libraryfolders') || {})) if (f && f.path) libs.push(f.path);
  return [...new Set(libs)].filter(l => exists(path.join(l, 'steamapps')));
}
function manifests() {
  const out = [];
  for (const lib of libraries()) {
    let files = [];
    try { files = fs.readdirSync(path.join(lib, 'steamapps')).filter(f => /^appmanifest_\d+\.acf$/.test(f)); } catch { continue; }
    for (const f of files) {
      const p = path.join(lib, 'steamapps', f);
      let c; try { c = fs.readFileSync(p, 'utf8'); } catch { continue; }
      const g = k => (c.match(new RegExp(`"${k}"\\s+"([^"]*)"`, 'i')) || [])[1] || '';
      const id = g('appid') || f.replace(/\D/g, '');
      if (!/^\d{1,10}$/.test(id)) continue; // un appid non numerique servirait a construire des chemins
      out.push({ appid: id, name: g('name'), installdir: g('installdir'), size: +g('SizeOnDisk') || 0, state: +g('StateFlags') || 0,
        toDownload: +g('BytesToDownload') || 0, downloaded: +g('BytesDownloaded') || 0, library: lib, path: p });
    }
  }
  return out;
}
function installed() {
  const seen = new Set();
  return manifests().sort((a, b) => b.size - a.size).filter(m => {
    if (isTool(m.appid, m.name) || seen.has(m.appid)) return false;
    seen.add(m.appid); return true;
  }).map(m => ({ appid: m.appid, name: m.name, sizeGB: Math.round(m.size / 1e8) / 10,
    ready: (m.state & 4) === 4 && m.toDownload <= m.downloaded,
    progress: m.toDownload > 0 ? Math.round(m.downloaded / m.toDownload * 1000) / 10 : null }));
}

// ------------------------------------------------------------ temps de jeu + famille
let cfgCache = { stamp: -1, val: null };
function localConfig() {
  const ud = userDir();
  const f = ud && path.join(ud, 'config', 'localconfig.vdf');
  const stamp = f ? mtime(f) : 0;
  if (cfgCache.val && cfgCache.stamp === stamp) return cfgCache.val;
  const res = { play: {}, family: null };
  const v = f && readVdf(f);
  const apps = get(v, 'UserLocalConfigStore', 'Software', 'Valve', 'Steam', 'apps') || {};
  for (const [id, a] of Object.entries(apps)) {
    if (a && typeof a === 'object') res.play[id] = { playtime: +a.Playtime || 0, lastPlayed: +a.LastPlayed || 0 };
  }
  const fg = get(v, 'UserLocalConfigStore', 'FamilyGroup');
  if (fg) res.family = { name: fg.name, members: Object.keys(fg.members || {}).length };
  cfgCache = { stamp, val: res };
  return res;
}

// ------------------------------------------------------------ bibliotheque complete
let libCache = null;
function library(refresh) {
  if (libCache && !refresh) return libCache;
  const root = steamRoot();
  if (!root || !store.config.accounts.steam.enabled || !accountId()) return (libCache = []);
  const cfg = localConfig();
  const inst = new Map(installed().map(i => [i.appid, i]));
  const ids = new Set();
  try { for (const d of fs.readdirSync(path.join(root, 'appcache', 'librarycache'))) if (/^\d+$/.test(d)) ids.add(+d); } catch { /* cache absent */ }
  for (const k of inst.keys()) ids.add(+k);
  for (const k of Object.keys(cfg.play)) if (/^\d+$/.test(k)) ids.add(+k);
  let apps = [];
  try { apps = loadAppInfo(path.join(root, 'appcache', 'appinfo.vdf'), ids); } catch { apps = []; }
  libCache = apps.filter(a => a.type === 'game' && a.name && !isTool(a.appid, a.name)).map(a => {
    const id = String(a.appid), p = cfg.play[id], i = inst.get(id);
    return { appid: id, name: a.name, tags: a.tags, genres: a.genres, cats: a.categories, review: a.review, metacritic: a.metacritic,
      release: a.releaseDate, dev: a.developer, windows: a.windows, playtime: p ? p.playtime : 0, lastPlayed: p ? p.lastPlayed : 0,
      installed: !!i, sizeGB: i ? i.sizeGB : null };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return libCache;
}

// ------------------------------------------------------------ succes
function jsonAchievements(appid) {
  const ud = userDir();
  const jf = ud && path.join(ud, 'config', 'librarycache', `${appid}.json`);
  if (!jf || !exists(jf)) return null;
  try {
    for (const entry of JSON.parse(fs.readFileSync(jf, 'utf8'))) {
      if (entry[0] !== 'achievements') continue;
      const d = entry[1].data || {};
      const got = {};
      for (const vec of ['vecHighlight', 'vecUnachieved', 'vecAchievedHidden']) for (const a of d[vec] || []) if (a && a.bAchieved) got[a.strID] = a.rtUnlocked || 0;
      return { total: d.nTotal || 0, unlocked: d.nAchieved || 0, got };
    }
  } catch { /* fichier en cours d'ecriture */ }
  return null;
}
function achievements(appid) {
  if (!/^\d{1,10}$/.test(String(appid))) return [];
  const root = steamRoot();
  if (!root || !accountId()) return [];
  let list = [];
  try {
    list = loadAchievements(path.join(root, 'appcache', 'stats', `UserGameStatsSchema_${appid}.bin`),
      path.join(root, 'appcache', 'stats', `UserGameStats_${accountId()}_${appid}.bin`), 'french');
  } catch { list = []; }
  const js = jsonAchievements(appid);
  if (js) for (const a of list) if (js.got[a.id] !== undefined) { a.unlocked = true; a.unlockedAt = a.unlockedAt || js.got[a.id]; }
  return list;
}
// ids des jeux qui ont des donnees de succes sur ce PC
function achievementIds() {
  const root = steamRoot(), ud = userDir(), ids = new Set();
  try { for (const f of fs.readdirSync(path.join(root, 'appcache', 'stats'))) { const m = f.match(/^UserGameStatsSchema_(\d+)\.bin$/); if (m) ids.add(m[1]); } } catch { /* rien */ }
  try { for (const f of fs.readdirSync(path.join(ud, 'config', 'librarycache'))) { const m = f.match(/^(\d+)\.json$/); if (m) ids.add(m[1]); } } catch { /* rien */ }
  return [...ids];
}
function achievementStamp(appid) {
  const root = steamRoot(), ud = userDir();
  return [path.join(root, 'appcache', 'stats', `UserGameStats_${accountId()}_${appid}.bin`),
    path.join(root, 'appcache', 'stats', `UserGameStatsSchema_${appid}.bin`),
    ud ? path.join(ud, 'config', 'librarycache', `${appid}.json`) : null].map(mtime).join(':');
}
// le cache JSON peut avoir un total plus juste que le schema (jeux jamais lances sur ce PC)
function jsonTotals(appid) { const j = jsonAchievements(appid); return j ? { total: j.total, unlocked: j.unlocked } : null; }

// ------------------------------------------------------------ profil + images
function profile() {
  const us = users(), id = accountId(), u = us.find(x => x.accountId === id);
  const root = steamRoot();
  return { name: u ? u.name : null, id64: u ? u.id64 : id64Of(id), avatar: !!(u && root && exists(path.join(root, 'config', 'avatarcache', `${u.id64}.png`))) };
}
const id64Of = id => { try { return id ? String(BigInt(id) + STEAM64_BASE) : null; } catch { return null; } };
// SteamID64, numero de compte ou adresse steamcommunity.com/profiles/<id> -> numero de compte
function parseAccount(input) {
  const v = String(input || '').trim();
  const m = v.match(/^(?:https?:\/\/steamcommunity\.com\/profiles\/)?(\d{17})\/?$/) || v.match(/^(\d{1,12})$/);
  if (!m) return null;
  try { const n = BigInt(m[1]); return String(n >= STEAM64_BASE ? n - STEAM64_BASE : n); } catch { return null; }
}

// ------------------------------------------------------------ profil public (en ligne, sans cle API)
const xmlText = (block, tag) => {
  const m = String(block).match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`));
  return m ? m[1].trim() : '';
};
const iconHash = url => { const m = /\/([0-9a-f]{40})\.jpg$/i.exec(url || ''); return m ? m[1].toLowerCase() : null; };
// page XML des succes d'un profil public -> meme format que les succes lus sur le PC
function parseAchievementXml(xml) {
  const list = [];
  for (const m of String(xml).matchAll(/<achievement closed="([01])">([\s\S]*?)<\/achievement>/g)) {
    const b = m[2], id = xmlText(b, 'apiname');
    if (!id) continue;
    list.push({ id, name: xmlText(b, 'name') || id, desc: xmlText(b, 'description'), hidden: false, unlocked: m[1] === '1',
      unlockedAt: Number(xmlText(b, 'unlockTimestamp')) || 0, icon: iconHash(xmlText(b, 'iconClosed')), iconGray: iconHash(xmlText(b, 'iconOpen')) });
  }
  return { privacy: xmlText(xml, 'privacyState') || null, list };
}
let privacyState = 'unknown'; // unknown | public | private | friendsonly | error
async function privacy(refresh) {
  const id64 = profile().id64;
  if (!id64) return (privacyState = 'unknown');
  if (privacyState !== 'unknown' && !refresh) return privacyState;
  try { privacyState = xmlText(await httpGet(`https://steamcommunity.com/profiles/${id64}/?xml=1`, { type: 'text', timeout: 10000 }), 'privacyState') || 'error'; }
  catch { privacyState = 'error'; }
  return privacyState;
}
// succes depuis le profil public : jeux jamais lances sur ce PC ou donnees locales absentes
async function onlineAchievements(appid) {
  const id64 = profile().id64;
  if (!id64 || !/^\d{1,10}$/.test(String(appid))) return [];
  const f = store.file(path.join('steam', `ach_${appid}.json`));
  if (Date.now() - mtime(f) < 10 * 60e3) return readJson(f, []);
  try {
    const r = parseAchievementXml(await httpGet(`https://steamcommunity.com/profiles/${id64}/stats/${appid}/achievements/?xml=1`, { type: 'text', timeout: 15000 }));
    if (r.privacy) privacyState = r.privacy;
    writeJson(f, r.list);
    return r.list;
  } catch { return readJson(f, []); }
}
const IMG_NAMES = { hero: ['library_hero.jpg'], cover: ['library_600x900.jpg', 'library_capsule.jpg'], logo: ['logo.png'], header: ['library_header.jpg', 'header.jpg'] };
const imgIndex = new Map();
function imageFile(appid, kind) {
  if (!/^\d{1,10}$/.test(String(appid))) return null;
  if (!imgIndex.has(appid)) {
    const files = {};
    const dir = path.join(steamRoot() || '', 'appcache', 'librarycache', String(appid));
    const go = d => { let es = []; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of es) { const f = path.join(d, e.name); if (e.isDirectory()) go(f); else if (!files[e.name.toLowerCase()]) files[e.name.toLowerCase()] = f; } };
    go(dir);
    imgIndex.set(appid, files);
  }
  const files = imgIndex.get(appid);
  for (const n of IMG_NAMES[kind] || []) if (files[n]) return files[n];
  return null;
}

module.exports = { parseAccount, parseAchievementXml, privacy, onlineAchievements, get privacyState() { return privacyState; }, steamRoot, users, accountId, userDir, libraries, manifests, installed, localConfig, library, achievements,
  achievementIds, achievementStamp, jsonTotals, profile, imageFile, isTool };
