'use strict';
// Bibliotheque unifiee : Steam + Epic + GOG + Amazon + jeux manuels + emulateurs,
// succes et progression par plateforme.
const steam = require('./platforms/steam');
const epic = require('./platforms/epic');
const gog = require('./platforms/gog');
const ubisoft = require('./platforms/ubisoft');
const others = require('./platforms/others');
const emuScan = require('./emulation/scan');
const switchData = require('./emulation/switch');
const launcher = require('./launcher');
const { findStory, progressOf } = require('./story');
const { ratings } = require('./reviews');

let othersCache = { at: 0, list: [] };
let pending = null;

// jeux hors Steam (cache 60 s ; un seul calcul a la fois)
async function otherGames(refresh = false) {
  if (!refresh && Date.now() - othersCache.at < 60e3) return othersCache.list;
  if (pending) return pending;
  pending = (async () => {
    const play = launcher.sessionPlay();
    const parts = await Promise.all([
      epic.games().catch(() => []),
      Promise.resolve().then(() => gog.games()).catch(() => []),
      Promise.resolve().then(() => ubisoft.games()).catch(() => []),
      Promise.resolve().then(() => others.amazon()).catch(() => []),
      Promise.resolve().then(() => others.manual(play)).catch(() => []),
      emuScan.games(play).catch(() => []),
    ]);
    // notes déjà connues (Metacritic, presse) pour les tuiles des jeux hors Steam
    const rt = ratings();
    othersCache = { at: Date.now(), list: parts.flat().map(g => rt[g.appid] ? { ...g, metacritic: g.metacritic || rt[g.appid].mc || null, press: rt[g.appid].press || null } : g) };
    return othersCache.list;
  })();
  try { return await pending; } finally { pending = null; }
}

async function findGame(appid) {
  const id = String(appid);
  if (/^\d{1,10}$/.test(id)) return steam.library().find(g => g.appid === id) || { appid: id, name: id };
  return (await otherGames()).find(g => g.appid === id) || null;
}

async function achievements(appid) {
  const id = String(appid);
  // Steam : donnees du PC, sinon profil public en ligne (jeu jamais lance ici)
  if (/^\d{1,10}$/.test(id)) { const local = steam.achievements(id); return local.length ? local : steam.onlineAchievements(id); }
  const m = id.match(/^switch:([0-9A-F]{16})$/);
  if (m) return switchData.achievements(m[1]);
  if (id.startsWith('epic:')) return epic.achievements(await findGame(id));
  return [];
}

// temps de jeu d'un jeu, en minutes (pour le journal de quete)
async function playFor(appid) {
  const id = String(appid);
  if (/^\d{1,10}$/.test(id)) return steam.localConfig().play[id] || null;
  const g = await findGame(id);
  return g ? { playtime: g.playtime || 0, lastPlayed: g.lastPlayed || 0 } : null;
}
// temps de jeu de tous les jeux (statistiques par jour)
async function allPlay() {
  const res = { ...steam.localConfig().play };
  for (const g of await otherGames()) if (g.playtime) res[g.appid] = { playtime: g.playtime, lastPlayed: g.lastPlayed };
  return res;
}

// ------------------------------------------------------------ progression (palmares, tuiles)
const progressFiles = new Map();
let progressCache = { at: 0, val: null };
async function allProgress(refresh) {
  if (progressCache.val && !refresh && Date.now() - progressCache.at < 60e3) return progressCache.val;
  const res = {};
  for (const id of steam.achievementIds()) {
    const stamp = steam.achievementStamp(id);
    const c = progressFiles.get(id);
    let p;
    if (c && c.stamp === stamp) p = c.p;
    else {
      const list = steam.achievements(id);
      p = progressOf(list, id);
      const js = steam.jsonTotals(id);
      if (js && js.total) {
        p = p || { total: 0, unlocked: 0, perfect: false, story: null, storyDone: false, complete: false };
        p.total = Math.max(p.total, js.total); p.unlocked = Math.max(p.unlocked, js.unlocked);
        p.perfect = p.unlocked >= p.total; if (p.perfect) p.storyDone = true;
      }
      progressFiles.set(id, { stamp, p });
    }
    if (p) res[id] = p;
  }
  for (const g of await otherGames()) {
    if (!g.achievements) continue;
    try { const p = progressOf(await achievements(g.appid), g.appid); if (p && (g.platform !== 'epic' || epic.status === 'ok')) res[g.appid] = p; } catch { /* plateforme indisponible */ }
  }
  progressCache = { at: Date.now(), val: res };
  return res;
}

module.exports = { otherGames, findGame, achievements, findStory, playFor, allPlay, allProgress };
