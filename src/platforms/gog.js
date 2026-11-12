'use strict';
// GOG : jeux installes via GOG Galaxy (registre Windows) ou Heroic (Linux/macOS/Windows).
const path = require('path');
const { execFileSync } = require('child_process');
const { IS_WIN, HOME, readJson, sysBin } = require('../util');
const store = require('../state');

const HEROIC_DIRS = [
  path.join(HOME, '.config', 'heroic'),
  path.join(HOME, '.var', 'app', 'com.heroicgameslauncher.hgl', 'config', 'heroic'),
  path.join(HOME, 'Library', 'Application Support', 'heroic'),
  process.env.APPDATA ? path.join(process.env.APPDATA, 'heroic') : null,
].filter(Boolean);

function fromRegistry() {
  if (!IS_WIN) return [];
  const out = [];
  for (const root of ['HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\Games', 'HKLM\\SOFTWARE\\GOG.com\\Games']) {
    let txt;
    try { txt = execFileSync(sysBin('reg.exe'), ['query', root, '/s'], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { continue; }
    for (const block of txt.split(/\r?\n\r?\n/)) {
      const id = (block.match(/gameID\s+REG_SZ\s+(\d+)/) || [])[1];
      const name = (block.match(/gameName\s+REG_SZ\s+(.+)/) || [])[1];
      const dir = (block.match(/path\s+REG_SZ\s+(.+)/) || [])[1];
      if (id && name) out.push({ id, name: name.trim(), dir: dir ? dir.trim() : null, via: 'galaxy' });
    }
  }
  return out;
}

function fromHeroic() {
  const out = [];
  for (const d of HEROIC_DIRS) {
    const inst = readJson(path.join(d, 'gog_store', 'installed.json'));
    const lib = readJson(path.join(d, 'store_cache', 'gog_library.json')) || readJson(path.join(d, 'gog_store', 'library.json'));
    const names = {}, covers = {};
    for (const g of (lib && (lib.games || lib.library)) || []) { names[g.app_name] = g.title; covers[g.app_name] = g.art_square || g.art_cover || null; }
    for (const g of (inst && inst.installed) || []) {
      if (!/^\d{1,20}$/.test(String(g.appName))) continue;
      out.push({ id: String(g.appName), name: names[g.appName] || g.title || `GOG ${g.appName}`, dir: g.install_path, via: 'heroic', cover: covers[g.appName] });
    }
  }
  return out;
}

function games() {
  if (!store.config.accounts.gog.enabled) return [];
  const seen = new Set();
  return [...fromRegistry(), ...fromHeroic()].filter(g => !seen.has(g.id) && seen.add(g.id)).map(g => ({
    appid: `gog:${g.id}`, name: g.name, platform: 'gog', installed: true, sizeGB: null, installDir: g.dir,
    launch: g.via === 'heroic' ? `heroic://launch/gog/${g.id}` : `goggalaxy://openGameView/${g.id}`,
    cover: g.cover && /^https:\/\//.test(g.cover) ? g.cover : null, hero: null,
    tags: [], genres: [], cats: [2], review: 0, windows: true, playtime: 0, lastPlayed: 0, achievements: false,
  }));
}

module.exports = { games, HEROIC_DIRS };
