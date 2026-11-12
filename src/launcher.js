'use strict';
// Lancement des jeux (toutes plateformes) et suivi du temps de jeu des jeux lances par Questline
// (emulateurs, jeux ajoutes a la main) : le temps est compte jusqu'a la fermeture du processus.
const path = require('path');
const { spawn } = require('child_process');
const { IS_WIN, IS_MAC, readJson, writeJson, exists, nowSec, walk } = require('./util');
const store = require('./state');
const systems = require('./emulation/systems');

let openExternal = url => { throw new Error(`openExternal non initialise (${url})`); };
let openPath = p => { throw new Error(`openPath non initialise (${p})`); };
const setOpener = (fn, pathFn) => { openExternal = fn; if (pathFn) openPath = pathFn; };

const URI_OK = /^(steam|com\.epicgames\.launcher|goggalaxy|heroic|uplay):\/\/[^\s"]+$/;
// ouvre un lien de launcher (steam://, com.epicgames.launcher://...) apres verification du schema
function openUri(url) { if (URI_OK.test(url)) { try { openExternal(url); } catch { /* launcher absent */ } return true; } return false; }
const running = new Map(); // appid -> { child, start }

// ------------------------------------------------------------ temps de jeu des sessions lancees ici
const playFile = () => store.file('sessions_playtime.json');
const sessionPlay = () => readJson(playFile(), {});
function addPlay(appid, minutes) {
  const p = sessionPlay();
  const cur = p[appid] || { playtime: 0, lastPlayed: 0 };
  p[appid] = { playtime: cur.playtime + minutes, lastPlayed: nowSec() };
  writeJson(playFile(), p);
}

function spawnTracked(appid, exe, args, cwd) {
  let child;
  try { child = spawn(exe, args, { cwd, detached: true, stdio: 'ignore', windowsHide: false }); } catch { return false; }
  const start = Date.now();
  running.set(appid, { child, start });
  child.on('exit', () => {
    running.delete(appid);
    const min = Math.round((Date.now() - start) / 60000);
    if (min > 0) addPlay(appid, min);
  });
  child.on('error', () => running.delete(appid));
  child.unref();
  return true;
}

// ------------------------------------------------------------ emulateurs
function retroarchPaths(exe) {
  const home = process.env.HOME || '';
  const cands = IS_WIN ? [path.join(path.dirname(exe), 'cores')]
    : IS_MAC ? [path.join(home, 'Library', 'Application Support', 'RetroArch', 'cores')]
      : [path.join(home, '.config', 'retroarch', 'cores'), path.join(home, '.var', 'app', 'org.libretro.RetroArch', 'config', 'retroarch', 'cores'),
        '/usr/lib/x86_64-linux-gnu/libretro', '/usr/lib64/libretro', '/usr/lib/libretro', path.join(path.dirname(exe), 'cores')];
  return { coresDir: cands.find(exists) || cands[0], coreExt: IS_WIN ? '.dll' : IS_MAC ? '.dylib' : '.so' };
}
function emulatorCommand(entry, rom) {
  const emu = systems.emulator(entry.system, entry.emulator);
  if (!emu || !entry.exe || !exists(entry.exe)) return null;
  const ra = retroarchPaths(entry.exe);
  const coresDir = entry.coresDir || ra.coresDir;
  // remplacements par fonction : un "$" dans un chemin ne doit pas etre lu comme motif de remplacement
  const args = emu.args.map(a => a.replace('{rom}', () => rom).replace('{coresDir}', () => coresDir).replace('{coreExt}', () => ra.coreExt));
  // macOS : un .app se lance par "open -a" (arguments passes avec --args)
  if (IS_MAC && entry.exe.endsWith('.app')) return { exe: 'open', args: ['-W', '-a', entry.exe, '--args', ...args] };
  return { exe: entry.exe, args };
}

// recherche automatique d'un emulateur dans les emplacements habituels
function detectEmulator(systemId, emuId, extraDirs = []) {
  const emu = systems.emulator(systemId, emuId);
  if (!emu) return null;
  const names = new Set(emu.exe.map(n => n.toLowerCase()));
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const dirs = [...extraDirs, ...(IS_WIN
    ? [process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs'), process.env.ProgramFiles, process.env['ProgramFiles(x86)'],
      path.join(home, 'Desktop'), path.join(home, 'Downloads'), 'C:\\Emulators', 'D:\\', 'D:\\Emulateurs']
    : IS_MAC ? ['/Applications', path.join(home, 'Applications')]
      : [path.join(home, 'Applications'), path.join(home, '.local', 'bin'), '/usr/bin', '/usr/local/bin', path.join(home, 'Emulators')])].filter(Boolean);
  for (const d of dirs) {
    if (!exists(d)) continue;
    if (IS_MAC) { for (const n of names) if (n.endsWith('.app') && exists(path.join(d, n))) return path.join(d, n); }
    const hit = walk(d, { depth: 3, filter: (f, n) => names.has(n.toLowerCase()) })[0];
    if (hit) return hit;
  }
  return null;
}

// ------------------------------------------------------------ lancement
function launch(game) {
  if (!game) return { ok: false, error: 'Jeu introuvable.' };
  if (/^\d{1,10}$/.test(game.appid)) { openUri(`steam://rungameid/${game.appid}`); return { ok: true }; }
  if (game.launch && openUri(game.launch)) return { ok: true };
  if (game.platform === 'emu') {
    const entry = store.config.emulators.find(e => e.id === game.emuEntry);
    const cmd = entry && emulatorCommand(entry, game.file);
    if (!cmd || !spawnTracked(game.appid, cmd.exe, cmd.args, path.dirname(entry.exe))) return { ok: false, error: 'Émulateur introuvable : vérifie son chemin dans Sources.' };
    return { ok: true };
  }
  if (game.platform === 'manual') {
    if (!exists(game.exe)) return { ok: false, error: 'Exécutable introuvable.' };
    // raccourcis, scripts et applications macOS : ouverts par le systeme (sans suivi du temps de jeu)
    if (/\.(lnk|url|bat|cmd|desktop|sh|app)$/i.test(game.exe)) { openPath(game.exe); return { ok: true }; }
    const args = (String(game.args || '').match(/"[^"]*"|\S+/g) || []).map(a => a.replace(/^"|"$/g, ''));
    if (!spawnTracked(game.appid, game.exe, args, path.dirname(game.exe))) return { ok: false, error: 'Impossible de lancer ce jeu.' };
    return { ok: true };
  }
  return { ok: false, error: 'Ce jeu ne peut pas être lancé depuis Questline.' };
}

const isRunning = () => running.size > 0;

module.exports = { setOpener, openUri, launch, sessionPlay, detectEmulator, emulatorCommand, isRunning };
