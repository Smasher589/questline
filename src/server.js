'use strict';
// Serveur local (127.0.0.1 uniquement) qui sert l'interface et son API.
const http = require('http');
const fs = require('fs');
const path = require('path');
const store = require('./state');
const steam = require('./platforms/steam');
const epic = require('./platforms/epic');
const library = require('./library');
const guard = require('./guard');
const launcher = require('./launcher');
const covers = require('./emulation/covers');
const systems = require('./emulation/systems');
const saves = require('./saves');
const sources = require('./sources');
const reviewsMod = require('./reviews');
const { readJson, writeJson, httpGet, exists } = require('./util');

const STATIC = path.join(__dirname, '..', 'static');
const VERSION = require('../package.json').version;
const ASSETS = path.join(__dirname, '..', 'assets');
const MIME = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.html': 'text/html; charset=utf-8' };
// Politique de securite : seuls les scripts de l'app s'executent ; images de l'app et des CDN Steam / Epic / Heroic.
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; " +
  "img-src 'self' data: https://*.steamstatic.com https://*.steampowered.com https://*.epicgames.com https://*.gog-statics.com https://*.gog.com; " +
  "connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
// Routes sans effet de bord, seules autorisees en GET. Tout le reste exige un POST avec l'en-tete X-Questline.
const READ_ONLY = /^\/(|logo\.png|avatar\.png|static\/.+|img\/[^/]+\/\w+|api\/(library|installed|tags|state|progress|profile|playlog|othergames|storesearch|sources|achievements\/[^/]+|reviews\/[^/]+|details\/\d{1,10}|jsonstamp\/\d{1,10}|saves\/\d{1,10}))$/;
const GAME_ID = /^(\d{1,10}|epic:[\w.-]{1,100}|gog:\d{1,20}|ubisoft:\d{1,10}|amazon:[\w.-]{1,100}|manual:[0-9a-f]{12}|switch:[0-9A-F]{16}|emu:[a-z0-9]{1,12}:[0-9a-f]{12})$/;
const short = (s, max = 300) => s == null || (typeof s === 'string' && s.length <= max);

let hooks = { openUI: () => {}, openWidget: () => {}, quit: () => {}, autostart: () => false, setAutostart: () => {}, openPath: () => {}, tray: false };
let port = 0;

function send(res, code, type, body) {
  const h = { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (type.startsWith('text/html')) { h['Content-Security-Policy'] = CSP; h['Referrer-Policy'] = 'no-referrer'; }
  res.writeHead(code, h); res.end(body);
}
const json = (res, obj, code = 200) => send(res, code, 'application/json; charset=utf-8', JSON.stringify(obj));
const sendFile = (res, f) => send(res, 200, MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', fs.readFileSync(f));
const body = req => new Promise(resolve => { let d = ''; req.on('data', c => { d += c; if (d.length > 1e6) { req.destroy(); resolve({}); } }); req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } }); });

function statePayload() {
  const s = store.state, cfg = steam.localConfig();
  return { current: s.current, finished: s.finished, abandoned: s.abandoned, blocked: s.blocked, cleaned: s.cleaned, autostart: hooks.autostart(),
    testMode: false, family: cfg.family, strict: s.strict, tray: hooks.tray, queue: s.queue, wishlist: s.wishlist, settings: s.settings,
    flags: s.flags, session: s.session, epicAch: epic.status, onboarded: !!store.config.onboarded, version: VERSION };
}

async function tagNames() {
  const f = store.file('tags_fr.json');
  if (!exists(f)) { try { writeJson(f, await httpGet('https://store.steampowered.com/tagdata/populartags/french')); } catch { return []; } }
  return readJson(f, []);
}
async function storeDetails(appid) {
  const f = store.file(path.join('store', `${appid}.json`));
  if (!exists(f)) { try { writeJson(f, await httpGet(`https://store.steampowered.com/api/appdetails?appids=${appid}&l=french`)); } catch { return {}; } }
  const d = ((readJson(f, {}) || {})[appid] || {}).data;
  if (!d) return {};
  return { desc: d.short_description, website: d.website, screenshots: (d.screenshots || []).slice(0, 4).map(x => x.path_thumbnail),
    publishers: d.publishers || [], genres: (d.genres || []).map(g => g.description), metacritic: d.metacritic ? d.metacritic.score : null, date: (d.release_date || {}).date };
}

async function sendImage(res, id, kind) {
  if (/^\d{1,10}$/.test(id)) { const f = steam.imageFile(id, kind); return f ? sendFile(res, f) : send(res, 404, 'text/plain', ''); }
  const g = GAME_ID.test(id) ? await library.findGame(id) : null;
  if (!g || !['emu', 'manual'].includes(g.platform)) return send(res, 404, 'text/plain', '');
  const sys = systems.byId(g.systemId) || { id: 'pc', libretro: null };
  const f = await covers.image(g, sys, kind);
  return f ? sendFile(res, f) : send(res, 404, 'text/plain', '');
}

const routes = [];
const route = (re, fn) => routes.push([re, fn]);

route(/^\/$/, (q, res) => sendFile(res, path.join(STATIC, 'index.html')));
route(/^\/logo\.png$/, (q, res) => sendFile(res, path.join(ASSETS, 'questline-256.png')));
route(/^\/avatar\.png$/, (q, res) => { const p = steam.profile(); const f = p.avatar && path.join(steam.steamRoot(), 'config', 'avatarcache', `${p.id64}.png`); return f ? sendFile(res, f) : send(res, 404, 'text/plain', ''); });
route(/^\/static\/([\w\-/]+\.\w+)$/, (q, res, m) => { const f = path.join(STATIC, m[1]); return !m[1].includes('..') && exists(f) ? sendFile(res, f) : send(res, 404, 'text/plain', ''); });
route(/^\/img\/([^/]+)\/(\w+)$/, (q, res, m) => sendImage(res, decodeURIComponent(m[1]), m[2]));
route(/^\/api\/library$/, (q, res) => json(res, steam.library(q.query.get('refresh') === '1')));
route(/^\/api\/installed$/, (q, res) => json(res, steam.installed()));
route(/^\/api\/tags$/, async (q, res) => json(res, await tagNames()));
route(/^\/api\/state$/, (q, res) => json(res, statePayload()));
route(/^\/api\/profile$/, (q, res) => json(res, steam.profile()));
route(/^\/api\/playlog$/, (q, res) => json(res, readJson(store.file('playlog.json'), {})));
route(/^\/api\/progress$/, async (q, res) => json(res, await library.allProgress(q.query.get('refresh') === '1')));
route(/^\/api\/othergames$/, async (q, res) => json(res, (await library.otherGames(q.query.get('refresh') === '1')).map(({ file, exe, args, installDir, ...g }) => g)));
route(/^\/api\/achievements\/([^/]+)$/, async (q, res, m) => {
  const id = decodeURIComponent(m[1]);
  if (!GAME_ID.test(id)) return json(res, { list: [], story: null });
  const list = await library.achievements(id); const s = library.findStory(list, id);
  return json(res, { list, story: s ? s.id : null });
});
route(/^\/api\/details\/(\d{1,10})$/, async (q, res, m) => {
  const p = (await library.allProgress())[m[1]] || null;
  return json(res, { store: await storeDetails(m[1]), progress: p });
});
// notes, avis et commandes conseillées d'un jeu (cache 7 jours)
route(/^\/api\/reviews\/([^/]+)$/, async (q, res, m) => {
  const id = decodeURIComponent(m[1]);
  if (!GAME_ID.test(id)) return json(res, { error: 'Jeu invalide.' }, 400);
  const g = await library.findGame(id);
  if (!g || !g.name || g.name === id) return json(res, { error: 'Jeu introuvable.' }, 404);
  try { return json(res, await reviewsMod.reviews(g)); } catch { return json(res, { error: 'Avis indisponibles pour le moment.' }, 502); }
});
route(/^\/api\/jsonstamp\/(\d{1,10})$/, (q, res, m) => json(res, { at: steam.achievementStamp(m[1]) }));
route(/^\/api\/storesearch$/, async (q, res) => {
  try {
    const r = await httpGet(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(q.query.get('q') || '')}&l=french&cc=FR`);
    return json(res, (r.items || []).map(i => ({ appid: String(i.id), name: i.name, image: i.tiny_image, price: i.price ? `${(i.price.final / 100).toFixed(2).replace('.', ',')} €` : null })));
  } catch { return json(res, []); }
});
route(/^\/api\/saves\/(\d{1,10})$/, (q, res, m) => json(res, saves.saveDirs(m[1])));
route(/^\/api\/sources$/, async (q, res) => json(res, await sources.overview()));

// ------------------------------------------------------------ actions (POST)
const PLATFORMS = new Set(['steam', 'epic', 'gog', 'ubisoft', 'amazon', 'heroic', 'manual', 'emu']);
const platformOf = p => (p && PLATFORMS.has(String(p)) ? String(p) : null);
// bornes des reglages numeriques (un 1e9 ne doit pas desactiver le bouclier)
const SETTING_RANGE = { maxInstalled: [1, 5], reminderDays: [1, 30], bedtime: [0, 24], buyRule: [1, 10] };
const clampSetting = (k, v) => { const r = SETTING_RANGE[k] || [-1e6, 1e6]; return Math.min(r[1], Math.max(r[0], Math.round(v))); };
const s = () => store.state;
route(/^\/api\/commit$/, async (q, res, m, b) => {
  if (s().current) return json(res, { error: 'Un jeu est déjà en cours.' }, 409);
  if (!GAME_ID.test(String(b.appid)) || !short(b.name)) return json(res, { error: 'Jeu invalide.' }, 400);
  const story = b.story ? { id: String(b.story.id).slice(0, 200), name: String(b.story.name).slice(0, 200), desc: String(b.story.desc || '').slice(0, 1000) } : null;
  const today = new Date().toISOString();
  s().current = { appid: String(b.appid), name: String(b.name), since: today, startPlaytime: +b.playtime || 0, story, platform: platformOf(b.platform), history: [{ d: today.slice(0, 10), pt: +b.playtime || 0 }] };
  s().queue = s().queue.filter(x => x && String(x.appid) !== String(b.appid));
  store.saveState(); guard.resetKnown();
  return json(res, statePayload());
});
route(/^\/api\/story$/, (q, res, m, b) => { const c = s().current; if (c && !c.story && b.id) { c.story = { id: String(b.id).slice(0, 200), name: String(b.name).slice(0, 200), desc: String(b.desc || '').slice(0, 1000) }; store.saveState(); } return json(res, statePayload()); });
// duree de l'histoire choisie par le joueur pour sa quete (0 = revenir a l'estimation)
route(/^\/api\/estimate$/, (q, res, m, b) => {
  const c = s().current, h = Math.round(Number(b.hours));
  if (!c) return json(res, { error: 'Aucune quête en cours.' }, 409);
  if (!(h === 0 || (h >= 1 && h <= 500))) return json(res, { error: 'Durée invalide (1 à 500 heures).' }, 400);
  if (h) c.estHours = h; else delete c.estHours;
  store.saveState(); return json(res, statePayload());
});
route(/^\/api\/sync$/, async (q, res) => { await guard.storyCheck(); return json(res, statePayload()); });
route(/^\/api\/finish$/, async (q, res) => {
  const c = s().current;
  if (c && c.story) { await guard.storyCheck(); if (s().current) return json(res, { error: `Le succès « ${c.story.name} » n'est pas encore débloqué.` }, 409); }
  else if (c) guard.completeCurrent(false);
  return json(res, statePayload());
});
route(/^\/api\/abandon\/cancel$/, (q, res) => { const c = s().current; if (c && c.abandonAt) { delete c.abandonAt; store.saveState(); } return json(res, statePayload()); });
route(/^\/api\/abandon$/, (q, res) => {
  const c = s().current;
  if (c && s().strict) {
    if (!c.abandonAt) { c.abandonAt = new Date(Date.now() + 864e5).toISOString(); store.saveState(); return json(res, statePayload()); }
    const left = Date.parse(c.abandonAt) - Date.now();
    if (left > 0) return json(res, { error: `Encore ${Math.floor(left / 36e5)} h ${Math.floor(left / 6e4) % 60} min de réflexion avant de pouvoir abandonner.` }, 409);
  }
  if (c) { s().abandoned.push({ appid: c.appid, name: c.name, since: c.since, at: new Date().toISOString() }); s().current = null; store.saveState(); }
  return json(res, statePayload());
});
route(/^\/api\/settings$/, (q, res, m, b) => {
  if (b.strict !== undefined && b.strict !== null) {
    if (!b.strict && s().current) return json(res, { error: "Le mode strict ne peut être désactivé qu'entre deux quêtes." }, 409);
    s().strict = !!b.strict;
  }
  for (const [k, def] of Object.entries(store.DEFAULT_SETTINGS)) {
    if (b[k] === undefined || b[k] === null) continue;
    s().settings[k] = typeof def === 'boolean' ? !!b[k] : typeof def === 'number' ? clampSetting(k, +b[k] || 0) : String(b[k]).slice(0, 40);
  }
  store.saveState(); return json(res, statePayload());
});
route(/^\/api\/flag$/, (q, res, m, b) => { if (/^[\w-]{1,40}$/.test(b.name || '')) { s().flags[b.name] = true; store.saveState(); } return json(res, statePayload()); });
route(/^\/api\/queue$/, (q, res, m, b) => {
  if (b.action === 'add' && (!GAME_ID.test(String(b.appid)) || !short(b.name))) return json(res, { error: 'Jeu invalide.' }, 400);
  const qu = s().queue.filter(Boolean); const i = qu.findIndex(x => String(x.appid) === String(b.appid));
  if (b.action === 'add' && i < 0 && qu.length < 5) qu.push({ appid: String(b.appid), name: String(b.name), platform: platformOf(b.platform) });
  if (b.action === 'remove' && i >= 0) qu.splice(i, 1);
  if (b.action === 'up' && i > 0) [qu[i - 1], qu[i]] = [qu[i], qu[i - 1]];
  if (b.action === 'down' && i >= 0 && i < qu.length - 1) [qu[i + 1], qu[i]] = [qu[i], qu[i + 1]];
  s().queue = qu; store.saveState(); return json(res, statePayload());
});
route(/^\/api\/wishlist$/, (q, res, m, b) => {
  if (!/^\d{1,10}$/.test(String(b.appid)) || (b.action === 'add' && (!short(b.name) || !short(b.price, 40) || (b.image && !/^https:\/\/[\w.-]+\.(steamstatic|steampowered)\.com\/[^\s"'<>]{1,300}$/.test(b.image))))) return json(res, { error: 'Jeu invalide.' }, 400);
  let w = s().wishlist.filter(Boolean); const item = w.find(x => String(x.appid) === String(b.appid));
  if (b.action === 'add' && !item) w.push({ appid: String(b.appid), name: String(b.name), image: b.image || null, price: b.price || null, addedAt: new Date().toISOString(), boughtAt: null });
  if (b.action === 'remove') w = w.filter(x => String(x.appid) !== String(b.appid));
  if (b.action === 'buy' && item) item.boughtAt = new Date().toISOString();
  s().wishlist = w; store.saveState(); return json(res, statePayload());
});
route(/^\/api\/session$/, async (q, res, m, b) => {
  const c = s().current;
  const min = Math.round(+b.minutes);
  if (!(min >= 5 && min <= 600)) return json(res, { error: 'Durée de session invalide (5 min à 10 h).' }, 400);
  if (c) {
    const now = Date.now();
    s().session = { appid: c.appid, name: c.name, minutes: min, start: new Date(now).toISOString(), until: new Date(now + min * 6e4).toISOString() };
    store.saveState(); launcher.launch(await library.findGame(c.appid));
  }
  return json(res, statePayload());
});
// prolonge la session en cours (sans relancer le jeu)
route(/^\/api\/session\/extend$/, (q, res, m, b) => {
  const se = s().session, add = Math.round(+b.minutes);
  if (!se || !(add >= 5 && add <= 120)) return json(res, { error: 'Aucune session à prolonger.' }, 400);
  se.minutes += add; se.until = new Date(Date.parse(se.until) + add * 6e4).toISOString(); delete se.warned;
  store.saveState(); return json(res, statePayload());
});
route(/^\/api\/session\/stop$/, (q, res) => { s().session = null; store.saveState(); return json(res, statePayload()); });
route(/^\/api\/saves\/(\d{1,10})\/open$/, (q, res, m, b) => { const d = saves.saveDirs(m[1]).find(x => x.path === b.path); if (d) hooks.openPath(d.path); return json(res, { ok: !!d }); });
route(/^\/api\/saves\/(\d{1,10})\/backup$/, (q, res, m, b) => { const r = saves.backup(m[1], b.name); if (r.files) hooks.openPath(r.path); return json(res, r); });
route(/^\/api\/widget$/, (q, res) => { hooks.openWidget(); return json(res, { ok: true }); });
route(/^\/api\/openui$/, (q, res) => { hooks.openUI(); return json(res, { ok: true }); });
route(/^\/api\/install\/(\d{1,10})$/, (q, res, m) => {
  const id = m[1], c = s().current;
  if (c && c.appid !== id) {
    const ids = new Set(steam.installed().map(i => i.appid));
    if (!ids.has(id) && !guard.slotFree(ids)) return json(res, { error: `Limite atteinte : ${guard.slots()} jeux installés au maximum pendant une quête. Désinstalle-en un ou finis ta quête.` }, 409);
  }
  launcher.launch({ appid: 'steam-install', launch: `steam://install/${id}` }); return json(res, { ok: true });
});
route(/^\/api\/uninstall\/(\d{1,10})$/, (q, res, m) => { if (steam.installed().some(i => i.appid === m[1])) launcher.launch({ appid: 'steam-uninstall', launch: `steam://uninstall/${m[1]}` }); return json(res, { ok: true }); });
route(/^\/api\/opendetails\/(\d{1,10})$/, (q, res, m) => { launcher.launch({ appid: 'steam-nav', launch: `steam://nav/games/details/${m[1]}` }); return json(res, { ok: true }); });
route(/^\/api\/store\/(\d{1,10})$/, (q, res, m) => { launcher.launch({ appid: 'steam-store', launch: `steam://store/${m[1]}` }); return json(res, { ok: true }); });
route(/^\/api\/cleaned$/, (q, res) => { s().cleaned = true; store.saveState(); return json(res, statePayload()); });
route(/^\/api\/play\/([^/]+)$/, async (q, res, m) => {
  const id = decodeURIComponent(m[1]);
  if (!GAME_ID.test(id)) return json(res, { error: 'Jeu invalide.' }, 400);
  const r = launcher.launch(await library.findGame(id));
  return json(res, r, r.ok ? 200 : 409);
});
route(/^\/api\/autostart$/, (q, res, m, b) => { hooks.setAutostart(!!b.enabled); return json(res, statePayload()); });
route(/^\/api\/quit$/, (q, res) => { json(res, { ok: true }); setTimeout(hooks.quit, 100); });
route(/^\/api\/sources\/(\w+)$/, async (q, res, m, b) => { const r = await sources.action(m[1], b); return json(res, r, r.error ? 400 : 200); });

// jeton secret de la session : depose par Electron dans un cookie HttpOnly de la seule fenetre de l'app,
// aucune autre application (ni page web) ne peut appeler l'API sans lui
function authorized(req) {
  if (!hooks.token) return false;   // pas de jeton : tout est refuse
  const m = String(req.headers.cookie || '').match(/(?:^|;\s*)ql_token=([0-9a-f]{64})/);
  if (!m) return false;
  const a = Buffer.from(m[1]), b = Buffer.from(hooks.token);
  return a.length === b.length && require('crypto').timingSafeEqual(a, b);
}

async function handle(req, res) {
  // Host attendu exactement : bloque le DNS rebinding (un domaine externe qui pointerait vers 127.0.0.1)
  if (req.headers.host !== `127.0.0.1:${port}`) return send(res, 421, 'text/plain', '');
  if (!authorized(req)) return send(res, 403, 'text/plain', '');
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  // requetes venues d'un autre site : refusees, meme en lecture
  const sfs = req.headers['sec-fetch-site'], origin = req.headers.origin;
  if ((sfs && !['same-origin', 'none'].includes(sfs)) || (origin && origin !== `http://127.0.0.1:${port}`)) return send(res, 403, 'text/plain', '');
  if (req.method === 'POST') { if (req.headers['x-questline'] !== '1') return json(res, { error: 'forbidden' }, 403); }
  else if (req.method !== 'GET' || !READ_ONLY.test(url.pathname)) return json(res, { error: 'method not allowed' }, 405);
  const b = req.method === 'POST' ? await body(req) : {};
  for (const [re, fn] of routes) {
    const m = url.pathname.match(re);
    if (m) return fn({ query: url.searchParams }, res, m, b);
  }
  return send(res, 404, 'text/plain', 'not found');
}

function start(h, wantedPort = 47822) {
  hooks = { ...hooks, ...h };
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => handle(req, res).catch(e => { try { console.error('[Questline] erreur serveur', e); json(res, { error: 'Erreur interne.' }, 500); } catch { /* deja envoye */ } }));
    srv.on('error', e => (e.code === 'EADDRINUSE' ? srv.listen(0, '127.0.0.1') : reject(e)));
    srv.on('listening', () => { port = srv.address().port; resolve(port); });
    srv.listen(wantedPort, '127.0.0.1');
  });
}

module.exports = { start, GAME_ID };
