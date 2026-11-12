'use strict';
// Ubisoft Connect : jeux installes (registre Windows du launcher), lancement par uplay://.
// Ubisoft n'offre pas d'acces public aux succes : seuls la bibliotheque et le lancement sont pris en charge.
const path = require('path');
const { execFileSync } = require('child_process');
const { IS_WIN, sysBin } = require('../util');
const store = require('../state');

const INSTALLS = ['HKLM\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs', 'HKLM\\SOFTWARE\\Ubisoft\\Launcher\\Installs'];
const UNINSTALL = ['HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall', 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'];

const regQuery = key => {
  try { return execFileSync(sysBin('reg.exe'), ['query', key, '/s'], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024 }); } catch { return ''; }
};

// "reg query ...\Installs /s" -> [{ id, dir }]
function parseInstalls(txt) {
  const out = [];
  for (const block of String(txt).split(/\r?\n\r?\n/)) {
    const id = (block.match(/\\Installs\\(\d{1,10})\s*$/m) || [])[1];
    const dir = (block.match(/^\s*InstallDir\s+REG_SZ\s+(.+)$/m) || [])[1];
    if (id && dir) out.push({ id, dir: dir.trim().replace(/[\\/]+$/, '') });
  }
  return out;
}
// cles de desinstallation "Uplay Install <id>" -> { id: nom affiche }
function parseNames(txt) {
  const names = {};
  for (const block of String(txt).split(/\r?\n\r?\n/)) {
    const id = (block.match(/\\Uplay Install (\d{1,10})\s*$/m) || [])[1];
    const name = (block.match(/^\s*DisplayName\s+REG_SZ\s+(.+)$/m) || [])[1];
    if (id && name) names[id] = name.trim();
  }
  return names;
}

function games() {
  if (!IS_WIN || !store.config.accounts.ubisoft || !store.config.accounts.ubisoft.enabled) return [];
  const installs = INSTALLS.flatMap(k => parseInstalls(regQuery(k)));
  if (!installs.length) return [];
  const names = Object.assign({}, ...UNINSTALL.map(k => parseNames(regQuery(k))));
  const seen = new Set();
  return installs.filter(g => !seen.has(g.id) && seen.add(g.id)).map(g => ({
    appid: `ubisoft:${g.id}`, name: names[g.id] || path.basename(g.dir), platform: 'ubisoft', installed: true, sizeGB: null, installDir: g.dir,
    launch: `uplay://launch/${g.id}/0`, cover: null, hero: null,
    tags: [], genres: [], cats: [2], review: 0, windows: true, playtime: 0, lastPlayed: 0, achievements: false,
  }));
}

const launcherFound = () => IS_WIN && INSTALLS.some(k => regQuery(k.replace(/\\Installs$/, '')) !== '');

module.exports = { games, parseInstalls, parseNames, launcherFound };
