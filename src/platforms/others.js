'use strict';
// Autres sources : Amazon Games (via Heroic) et jeux ajoutes a la main (n'importe quel executable).
const path = require('path');
const crypto = require('crypto');
const { readJson, exists } = require('../util');
const { HEROIC_DIRS } = require('./gog');
const store = require('../state');

function amazon() {
  if (!store.config.accounts.heroic.enabled) return [];
  const out = [];
  for (const d of HEROIC_DIRS) {
    const inst = readJson(path.join(d, 'nile_config', 'nile', 'installed.json'));
    const lib = readJson(path.join(d, 'store_cache', 'nile_library.json'));
    const names = {};
    for (const g of (lib && lib.library) || []) names[g.app_name] = { title: g.title, cover: g.art_square || g.art_cover };
    for (const g of Array.isArray(inst) ? inst : []) {
      if (!/^[A-Za-z0-9_.-]{1,100}$/.test(g.id || '')) continue;
      const n = names[g.id] || {};
      out.push({ appid: `amazon:${g.id}`, name: n.title || g.id, platform: 'amazon', installed: true, sizeGB: null, installDir: g.path,
        launch: `heroic://launch/nile/${g.id}`, cover: n.cover && /^https:\/\//.test(n.cover) ? n.cover : null, hero: null,
        tags: [], genres: [], cats: [2], review: 0, windows: true, playtime: 0, lastPlayed: 0, achievements: false });
    }
  }
  return out;
}

function manual(play) {
  return store.config.manualGames.filter(g => g && g.id && g.name).map(g => {
    const p = play[`manual:${g.id}`] || {};
    return { appid: `manual:${g.id}`, name: g.name, platform: 'manual', installed: exists(g.exe), sizeGB: null, installDir: g.exe ? path.dirname(g.exe) : null,
      exe: g.exe, args: g.args || '', cover: g.cover || null, hero: null,
      tags: [], genres: [], cats: [2], review: 0, windows: true, playtime: p.playtime || 0, lastPlayed: p.lastPlayed || 0, achievements: false };
  });
}
const newManualId = () => crypto.randomBytes(6).toString('hex');

module.exports = { amazon, manual, newManualId };
