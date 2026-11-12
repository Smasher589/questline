'use strict';
// Bouclier : limite les jeux Steam installes pendant une quete (telechargements en trop annules quand
// aucun jeu ne tourne), detection du succes de fin, journal de quete, rappels et objectif de session.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { IS_WIN, IS_MAC, exists, readJson, writeJson, sysBin } = require('./util');
const store = require('./state');
const steam = require('./platforms/steam');
const library = require('./library');
const launcher = require('./launcher');

let notify = () => {};
let openUI = () => {};
function setHooks(h) { notify = h.notify || notify; openUI = h.openUI || openUI; }

// Jeux deja connus : la liste ne fait que grandir pendant une quete. Un manifeste illisible un instant
// (Steam en train de l'ecrire, disque pas encore monte au demarrage) ne doit jamais faire passer un jeu
// installe pour un nouveau telechargement.
const known = new Set();
const knownDirs = new Set();
const pendingBlocks = new Set();
const seenTicks = new Map(); // appid -> nombre de releves consecutifs ou il ressemble a un nouveau telechargement
const lower = p => path.resolve(p).toLowerCase();
const isDownloading = m => (m.state & 4) === 0 || m.toDownload > m.downloaded;

function learn(m) {
  known.add(m.appid);
  if (m.installdir) knownDirs.add(lower(path.join(m.library, 'steamapps', 'common', m.installdir)));
}
// reset = true au demarrage et a chaque nouvelle quete : on repart de ce qui est installe maintenant
function resetKnown(reset = true) {
  if (reset) { known.clear(); knownDirs.clear(); seenTicks.clear(); }
  for (const m of steam.manifests()) if (!pendingBlocks.has(m.appid)) learn(m);
}

// $child est-il strictement a l'interieur de $parent (apres resolution des .. et des /) ?
function isChild(child, parent) {
  const c = path.resolve(child), p = path.resolve(parent) + path.sep;
  return c.toLowerCase().startsWith(p.toLowerCase()) && c.length > p.length;
}
// supprime seulement a l'interieur du dossier attendu, sans suivre les liens (jonctions / liens symboliques)
function removeInside(target, parent) {
  if (!isChild(target, parent) || !exists(target)) return;
  try {
    const st = fs.lstatSync(target);
    if (st.isSymbolicLink()) { fs.unlinkSync(target); return; }
    fs.rmSync(target, { recursive: true, force: true });
  } catch { /* fichier verrouille */ }
}

const slots = () => Math.max(1, +store.state.settings.maxInstalled || 2);
function slotFree(installedIds) {
  const cur = store.state.current;
  const reserve = cur && !cur.platform && !installedIds.has(String(cur.appid)) ? 1 : 0;
  return installedIds.size + reserve < slots();
}

// une partie est-elle en cours ? (jeu lance par Questline, processus d'un dossier de jeu Steam,
// ou processus lance par Steam sous Linux / Proton). En cas de doute : oui (on ne ferme jamais Steam a tort).
function gameRunning() {
  if (launcher.isRunning()) return true;
  const dirs = steam.manifests().filter(m => m.installdir && !steam.isTool(m.appid, m.name)).map(m => lower(path.join(m.library, 'steamapps', 'common', m.installdir)) + path.sep);
  try {
    if (IS_WIN) {
      if (!dirs.length) return false;
      const out = execFileSync(sysBin('WindowsPowerShell\\v1.0\\powershell.exe'), ['-NoProfile', '-Command', '(Get-Process | Where-Object Path).Path'], { encoding: 'utf8', windowsHide: true, timeout: 8000 });
      return out.split(/\r?\n/).some(p => p && dirs.some(d => p.toLowerCase().startsWith(d)));
    }
    if (IS_MAC) {
      if (!dirs.length) return false;
      const out = execFileSync('ps', ['-axo', 'comm='], { encoding: 'utf8', timeout: 8000 });
      return out.split('\n').some(p => p && dirs.some(d => p.trim().toLowerCase().startsWith(d)));
    }
    for (const pid of fs.readdirSync('/proc').filter(d => /^\d+$/.test(d))) {
      // les jeux lances par Steam (natifs ou Proton) portent SteamAppId dans leur environnement
      try { if (/(^|\0)SteamAppId=[1-9]\d*/.test(fs.readFileSync(`/proc/${pid}/environ`, 'latin1'))) return true; } catch { /* processus d'un autre utilisateur */ }
      for (const link of ['exe', 'cwd']) {
        try { const p = fs.readlinkSync(`/proc/${pid}/${link}`).toLowerCase() + path.sep; if (dirs.some(d => p.startsWith(d))) return true; } catch { /* processus termine */ }
      }
    }
    return false;
  } catch { return true; }
}

function steamProcessRunning() {
  try {
    if (IS_WIN) return /steam\.exe/i.test(execFileSync(sysBin('tasklist.exe'), ['/FI', 'IMAGENAME eq steam.exe'], { encoding: 'utf8', windowsHide: true }));
    if (IS_MAC) return /steam_osx/.test(execFileSync('ps', ['-axo', 'comm='], { encoding: 'utf8' }));
    return fs.readdirSync('/proc').some(d => { try { return /\/(steam|steamwebhelper)$/.test(fs.readlinkSync(`/proc/${d}/exe`)); } catch { return false; } });
  } catch { return true; }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function blockInstall(m) {
  const wasRunning = steamProcessRunning();
  if (wasRunning) {
    // steam://exit ferme Steam proprement sur Windows, Linux et macOS
    launcher.openUri('steam://exit');
    for (let i = 0; i < 30 && steamProcessRunning(); i++) await sleep(1000);
    if (steamProcessRunning()) return; // Steam toujours ouvert : on ne touche a rien, nouvel essai au prochain releve
    await sleep(2000);
  }
  const sa = path.join(m.library, 'steamapps');
  removeInside(m.path, sa);
  removeInside(path.join(sa, 'downloading', m.appid), path.join(sa, 'downloading'));
  removeInside(path.join(sa, 'temp', m.appid), path.join(sa, 'temp'));
  // installdir vient du manifeste : un simple nom de dossier, jamais un chemin
  if (m.installdir && !/[\\/:]/.test(m.installdir) && m.installdir.replace(/[. ]/g, '')) {
    const common = path.join(sa, 'common'), dir = path.join(common, m.installdir);
    if (!knownDirs.has(lower(dir))) removeInside(dir, common);
  }
  const s = store.state;
  const recent = s.blocked.filter(b => b.appid === m.appid && Date.now() - Date.parse(b.at) < 3 * 60e3);
  s.blocked.push({ appid: m.appid, name: m.name, at: new Date().toISOString() });
  store.saveState();
  notify('Téléchargement annulé', `${m.name} a été bloqué : limite de ${slots()} jeux installés atteinte. Finis d'abord l'histoire de ${s.current.name}.`);
  openUI('?blocked=1');
  // relance Steam une seule fois : si le meme jeu revient tout de suite, on le laisse ferme
  if (wasRunning && !recent.length) launcher.openUri('steam://open/main');
}

async function tick() {
  const mans = steam.manifests();
  const cur = store.state.current;
  if (!cur) { resetKnown(false); return; }
  const accepted = new Set(mans.filter(m => known.has(m.appid) && !steam.isTool(m.appid, m.name)).map(m => m.appid));
  const current = new Set();
  for (const m of mans) {
    if (known.has(m.appid) || pendingBlocks.has(m.appid) || steam.isTool(m.appid, m.name) || m.appid === String(cur.appid)) continue;
    // seul un vrai telechargement peut etre bloque, jamais un jeu entierement installe
    if (!isDownloading(m)) { learn(m); continue; }
    if (slotFree(accepted)) { accepted.add(m.appid); learn(m); continue; }
    current.add(m.appid);
    const n = (seenTicks.get(m.appid) || 0) + 1;
    seenTicks.set(m.appid, n);
    if (n < 2) continue; // confirme sur deux releves consecutifs
    pendingBlocks.add(m.appid);
    if (gameRunning()) notify('Téléchargement repéré', `${m.name} dépasse ta limite de ${slots()} jeux installés : il sera annulé dès que tu quitteras ton jeu.`);
  }
  for (const id of [...seenTicks.keys()]) if (!current.has(id)) seenTicks.delete(id);
  // les blocages attendent qu'aucun jeu ne tourne : fermer Steam fermerait aussi la partie en cours
  if (pendingBlocks.size && !gameRunning()) {
    for (const id of [...pendingBlocks]) {
      const m = mans.find(x => x.appid === id);
      if (!m || !exists(m.path) || !isDownloading(m) || !store.state.current) { pendingBlocks.delete(id); continue; }
      await blockInstall(m);
      if (!exists(m.path)) pendingBlocks.delete(id);
    }
  }
}

// ------------------------------------------------------------ fin de quete
async function storyCheck() {
  const cur = store.state.current;
  if (!cur) return;
  const list = await library.achievements(cur.appid);
  if (!cur.story && list.length) {
    const s = library.findStory(list, cur.appid);
    if (s) { cur.story = { id: s.id, name: s.name, desc: s.desc }; store.saveState(); }
  }
  if (cur.story) { const a = list.find(x => x.id === cur.story.id); if (a && a.unlocked) completeCurrent(true); }
}
function completeCurrent(auto) {
  const s = store.state, c = s.current;
  if (!c) return;
  s.finished.push({ appid: c.appid, name: c.name, since: c.since, at: new Date().toISOString(), auto, story: c.story, strict: !!s.strict, platform: c.platform, history: c.history });
  s.current = null;
  store.saveState();
  if (auto) { notify(`Quête accomplie : ${c.name}`, 'Succès de fin débloqué ! Le bouclier est levé, tu peux choisir ton prochain jeu.'); openUI('?done=1'); }
}

// ------------------------------------------------------------ journal, rappels, statistiques
async function journal() {
  const s = store.state, c = s.current;
  if (!c) return;
  const play = await library.playFor(c.appid);
  const pt = play ? play.playtime : 0;
  const today = new Date().toISOString().slice(0, 10);
  const hist = Array.isArray(c.history) && c.history.length ? c.history : [{ d: String(c.since).slice(0, 10), pt: +c.startPlaytime || 0 }];
  const last = hist[hist.length - 1];
  let changed = !c.history;
  if (pt > last.pt) { if (last.d === today && hist.length > 1) last.pt = pt; else hist.push({ d: today, pt }); changed = true; }
  if (changed) { c.history = hist; store.saveState(); }
  const lastPlayed = Math.max(play && play.lastPlayed ? play.lastPlayed * 1000 : 0, Date.parse(c.since));
  const days = Math.floor((Date.now() - lastPlayed) / 864e5);
  const st = s.settings;
  if (st.reminders && days >= +st.reminderDays && new Date().getHours() >= 18 && s.lastReminder !== today) {
    s.lastReminder = today; store.saveState();
    notify(`${c.name} t'attend`, `Ça fait ${days} jours que ta quête n'a pas avancé. Une petite session ce soir ?`);
  }
}
async function playlog() {
  const play = await library.allPlay();
  const snapF = store.file('snapshot.json'), logF = store.file('playlog.json');
  const snap = readJson(snapF, {}), log = readJson(logF, {});
  const first = !Object.keys(snap).length, today = new Date().toISOString().slice(0, 10);
  let changed = first;
  for (const [id, p] of Object.entries(play)) {
    const pt = +p.playtime || 0, old = snap[id];
    if (old !== undefined && pt > old && !first) { log[today] = log[today] || {}; log[today][id] = (log[today][id] || 0) + pt - old; changed = true; }
    if (old !== pt) { snap[id] = pt; changed = true; }
  }
  if (changed) { writeJson(snapF, snap); writeJson(logF, log); }
}
function sessionCheck() {
  const s = store.state.session;
  // rappel 10 minutes avant la fin (sessions de plus de 20 minutes)
  if (s && !s.warned && s.minutes > 20 && Date.parse(s.until) - Date.now() <= 10 * 60e3 && Date.now() < Date.parse(s.until)) {
    s.warned = true; store.saveState();
    notify('Plus que 10 minutes', `Ta session sur ${s.name} se termine bientôt : pense à sauvegarder.`);
  }
  if (s && Date.now() >= Date.parse(s.until)) {
    store.state.session = null; store.saveState();
    notify('Session terminée', `Tes ${s.minutes} minutes sur ${s.name} sont écoulées. Bien joué ! Une pause ?`);
  }
}

// ------------------------------------------------------------ boucle
function start() {
  resetKnown();
  const safe = fn => async () => { try { await fn(); } catch { /* prochain tour */ } };
  setInterval(safe(async () => { await tick(); sessionCheck(); }), 2000);
  setInterval(safe(storyCheck), 20000);
  setInterval(safe(async () => { await journal(); await playlog(); }), 60000);
  setTimeout(safe(async () => { await journal(); await playlog(); }), 5000);
}

module.exports = { setHooks, start, resetKnown, storyCheck, completeCurrent, slots, slotFree, isChild };
