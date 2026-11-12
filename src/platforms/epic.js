'use strict';
// Epic Games : jeux installes (manifestes du launcher, ou Heroic/Legendary sous Linux/macOS),
// bibliotheque du compte (cache catalogue du launcher) et succes via l'API publique d'Epic.
const fs = require('fs');
const path = require('path');
const { IS_WIN, IS_MAC, HOME, exists, readJson, writeJson, mtime, httpGet, localAppData } = require('../util');
const store = require('../state');

const PROGRAM_DATA = process.env.ProgramData || 'C:\\ProgramData';
const EGL_DATA = IS_WIN ? path.join(PROGRAM_DATA, 'Epic', 'EpicGamesLauncher', 'Data')
  : path.join(HOME, 'Library', 'Application Support', 'Epic', 'EpicGamesLauncher', 'Data');
const LEGENDARY_DIRS = [
  path.join(HOME, '.config', 'heroic', 'legendaryConfig', 'legendary'),
  path.join(HOME, '.var', 'app', 'com.heroicgameslauncher.hgl', 'config', 'heroic', 'legendaryConfig', 'legendary'),
  path.join(HOME, 'Library', 'Application Support', 'heroic', 'legendaryConfig', 'legendary'),
  path.join(HOME, '.config', 'legendary'),
];
const APP_RE = /^[A-Za-z0-9_.-]{1,100}$/;
const NS_RE = /^[A-Za-z0-9_-]{1,64}$/;
const IMG_RE = /^https:\/\/[A-Za-z0-9.-]+\.epicgames\.com\/[^\s"'<>()]{1,400}$/;
const GQL = 'https://graphql.epicgames.com/ue/graphql';

// ------------------------------------------------------------ jeux installes
function installedMap() {
  const res = {};
  const dir = path.join(EGL_DATA, 'Manifests');
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => f.endsWith('.item')); } catch { /* launcher absent */ }
  for (const f of files) {
    const j = readJson(path.join(dir, f));
    if (!j || j.bIsApplication === false || !APP_RE.test(j.AppName || '')) continue;
    res[j.AppName] = { name: j.DisplayName, size: +j.InstallSize || 0, dir: j.InstallLocation, ns: j.CatalogNamespace, cid: j.CatalogItemId, via: 'egl' };
  }
  // Heroic / Legendary
  for (const d of LEGENDARY_DIRS) {
    const j = readJson(path.join(d, 'installed.json'));
    if (!j) continue;
    for (const [app, g] of Object.entries(j)) {
      if (!APP_RE.test(app) || res[app]) continue;
      res[app] = { name: g.title, size: +g.install_size || 0, dir: g.install_path, ns: null, cid: null, via: 'heroic' };
    }
  }
  return res;
}

function launchUri(app, ns, cid, installed, via) {
  if (via === 'heroic') return `heroic://launch/legendary/${app}`;
  const target = NS_RE.test(ns || '') && NS_RE.test(cid || '') ? `${ns}%3A${cid}%3A${app}` : app;
  return `com.epicgames.launcher://apps/${target}?action=${installed ? 'launch&silent=true' : 'install'}`;
}

// ------------------------------------------------------------ bibliotheque (cache catalogue)
function catalogItems() {
  const items = [];
  const raw = (() => { try { return fs.readFileSync(path.join(EGL_DATA, 'Catalog', 'catcache.bin'), 'utf8').trim(); } catch { return null; } })();
  if (raw) { try { items.push(...JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))); } catch { /* format inattendu */ } }
  // Heroic garde aussi la bibliotheque du compte
  for (const d of LEGENDARY_DIRS) {
    const lib = readJson(path.join(path.dirname(path.dirname(d)), 'store_cache', 'legendary_library.json'));
    for (const g of (lib && lib.library) || []) {
      items.push({ title: g.title, namespace: g.namespace, id: g.catalog_id, developer: g.developer, categories: [{ path: 'games' }],
        releaseInfo: [{ appId: g.app_name }], keyImages: (g.art_square || g.art_cover) ? [{ type: 'DieselGameBoxTall', url: g.art_square || g.art_cover }] : [] });
    }
  }
  return items;
}

async function games() {
  if (!store.config.accounts.epic.enabled) return [];
  const inst = installedMap();
  const list = [], seen = new Set();
  for (const it of catalogItems()) {
    const cats = (it.categories || []).map(c => c.path);
    if (!cats.includes('games') || cats.includes('addons') || !it.title) continue;
    const app = (it.releaseInfo || []).map(r => r.appId).find(a => APP_RE.test(a || ''));
    if (!app || seen.has(app)) continue;
    seen.add(app);
    const img = {};
    for (const k of it.keyImages || []) if (!img[k.type] && IMG_RE.test(k.url || '')) img[k.type] = k.url;
    const i = inst[app];
    const ns = NS_RE.test(it.namespace || '') ? it.namespace : null;
    list.push(base(app, it.title, i, { dev: it.developer || null, ns, cid: it.id,
      cover: img.DieselGameBoxTall || img.DieselGameBox || null, hero: img.DieselGameBox || null }));
  }
  for (const [app, i] of Object.entries(inst)) if (!seen.has(app) && i.name) list.push(base(app, i.name, i, { ns: i.ns, cid: i.cid }));
  await Promise.all(list.map(async g => { g.achievements = !!(g.sandbox && await hasAchievements(g.sandbox)); }));
  return list;
}
function base(app, name, i, extra) {
  return { appid: `epic:${app}`, name, platform: 'epic', installed: !!i, sizeGB: i ? Math.round(i.size / 1e8) / 10 : null,
    dev: extra.dev || null, cover: extra.cover || null, hero: extra.hero || null, sandbox: extra.ns || (i && NS_RE.test(i.ns || '') ? i.ns : null),
    launch: launchUri(app, extra.ns || (i && i.ns), extra.cid || (i && i.cid), !!i, i && i.via),
    installDir: i ? i.dir : null, tags: [], genres: [], cats: [2], review: 0, windows: true, playtime: 0, lastPlayed: 0, achievements: false };
}

// ------------------------------------------------------------ compte Epic
let accountCache = null;
// compte relie par l'utilisateur ; "auto" (anciennes configurations) = compte trouve sur ce PC
function accountId() {
  const conf = store.config.accounts.epic.accountId;
  if (conf && conf !== 'auto' && /^[0-9a-f]{32}$/i.test(conf)) return conf.toLowerCase();
  return conf === 'auto' ? detectedAccountId() : null;
}
// pseudo public d'un compte Epic, pour que l'utilisateur confirme que c'est bien le sien
async function displayName(id) {
  if (!/^[0-9a-f]{32}$/i.test(id || '')) return null;
  try {
    const r = await gql('query($e:String!){PlayerProfile{playerProfile(epicAccountId:$e){displayName}}}', { e: id.toLowerCase() });
    return r.data.PlayerProfile.playerProfile.displayName || null;
  } catch { return null; }
}
// verifie que les succes du compte sont visibles (profil public) sur un jeu Epic qui en a
async function checkPrivacy(gamesList) {
  for (const g of gamesList) {
    if (!g.sandbox) continue;
    const d = await definitions(g.sandbox);
    if (d && d.productId) { playerCache.delete(d.productId); await unlocks(d.productId); return status; }
  }
  return status;
}
// compte du launcher Epic (ou Heroic) connecte sur ce PC : seulement propose, jamais relie sans accord
function detectedAccountId() {
  if (accountCache) return accountCache;
  // Heroic / Legendary
  for (const d of LEGENDARY_DIRS) {
    const u = readJson(path.join(d, 'user.json'));
    if (u && /^[0-9a-f]{32}$/i.test(u.account_id || '')) return (accountCache = u.account_id.toLowerCase());
  }
  // journal du launcher Epic
  const logs = IS_WIN ? path.join(localAppData(), 'EpicGamesLauncher', 'Saved', 'Logs') : path.join(HOME, 'Library', 'Logs', 'Unreal Engine', 'EpicGamesLauncher');
  let files = [];
  try { files = fs.readdirSync(logs).filter(f => /^EpicGamesLauncher.*\.log$/.test(f)).map(f => path.join(logs, f)).sort((a, b) => mtime(b) - mtime(a)); } catch { /* rien */ }
  for (const f of files) {
    let txt; try { txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const m = txt.match(/account[^0-9a-f\r\n]{0,25}([0-9a-f]{32})/i);
    if (m) return (accountCache = m[1].toLowerCase());
  }
  return null;
}

// ------------------------------------------------------------ succes
let status = 'unknown'; // unknown | ok | private | noaccount | error
const gql = (query, variables) => httpGet(GQL, { method: 'POST', body: JSON.stringify({ query, variables }), headers: { 'Content-Type': 'application/json' } });

async function definitions(sandbox) {
  if (!NS_RE.test(sandbox || '')) return null;
  const f = store.file(path.join('epic', `def_${sandbox}.json`));
  const age = (Date.now() - mtime(f)) / 864e5;
  if (exists(f) && age < 30) return readJson(f);
  try {
    const r = await gql('query($s:String!,$l:String!){Achievement{productAchievementsRecordBySandbox(sandboxId:$s,locale:$l){productId achievements{achievement{name hidden unlockedDisplayName unlockedDescription lockedDisplayName lockedDescription}}}}}', { s: sandbox, l: 'fr' });
    const rec = r.data.Achievement.productAchievementsRecordBySandbox || {};
    const d = { productId: rec.productId || null, list: (rec.achievements || []).map(x => x.achievement).filter(x => x && x.name).map(x => ({
      id: x.name, name: x.unlockedDisplayName || x.lockedDisplayName || x.name, desc: x.unlockedDescription || x.lockedDescription || '', hidden: !!x.hidden })) };
    writeJson(f, d);
    return d;
  } catch { return exists(f) ? readJson(f) : null; }
}
async function hasAchievements(sandbox) { const d = await definitions(sandbox); return !!(d && d.productId && d.list.length); }

const playerCache = new Map();
async function unlocks(productId) {
  const c = playerCache.get(productId);
  if (c && Date.now() - c.at < 5 * 60e3) return c.data;
  const acc = accountId();
  if (!acc) { status = 'noaccount'; return null; }
  let data = null;
  try {
    const r = await gql('query($e:String!,$p:String!){PlayerProfile{playerProfile(epicAccountId:$e){productAchievements(productId:$p){__typename ... on PlayerProductAchievementsResponseSuccess{data{playerAchievements{playerAchievement{achievementName unlocked unlockDate}}}} ... on ServiceError{message}}}}}', { e: acc, p: productId });
    const pa = r.data.PlayerProfile.playerProfile.productAchievements;
    if (pa.__typename === 'PlayerProductAchievementsResponseSuccess') {
      data = {};
      for (const x of pa.data.playerAchievements || []) {
        const a = x.playerAchievement;
        if (a && a.unlocked && a.achievementName) data[a.achievementName] = Math.floor(Date.parse(a.unlockDate) / 1000) || 0;
      }
      status = 'ok';
    } else status = /403/.test(pa.message || '') ? 'private' : 'error';
  } catch { status = 'error'; }
  playerCache.set(productId, { at: Date.now(), data });
  return data;
}
async function achievements(game) {
  if (!game || !game.sandbox) return [];
  const d = await definitions(game.sandbox);
  if (!d || !d.productId) return [];
  const un = await unlocks(d.productId);
  return d.list.map(a => ({ ...a, unlocked: !!(un && un[a.id] !== undefined), unlockedAt: un && un[a.id] ? un[a.id] : 0 }));
}

module.exports = { games, installedMap, accountId, detectedAccountId, displayName, checkPrivacy, achievements, get status() { return status; } };
