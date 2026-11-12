'use strict';
// Tests 2.16 : nouveaux badges (identifiants, objectifs, calculs) et embleme de rang en pixel art.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const STATIC = path.join(__dirname, '..', 'static');
function load(state = {}, prog = {}, library = []) {
  const ctx = { lib: library, st: { finished: [], abandoned: [], blocked: [], queue: [], wishlist: [], flags: {}, settings: {}, ...state }, progress: prog, playlog: {},
    byId: id => library.find(g => String(g.appid) === String(id)), esc: s => String(s), icon: () => '', ICONS: {}, document: { addEventListener() {} }, addEventListener() {} };
  vm.createContext(ctx);
  const code = ['engine.js', 'progress.js', 'rewards.js', 'emblem.js'].map(f => fs.readFileSync(path.join(STATIC, f), 'utf8')).join('\n;\n');
  vm.runInContext(code + '\n;this.api = { BADGES, TIERS, profileData, rankEmblem, embPixels, EMB_MAP };', ctx);
  return ctx.api;
}

test('au moins 80 badges, identifiants uniques et objectifs valides', () => {
  const { BADGES, TIERS } = load();
  assert.ok(BADGES.length >= 80, `seulement ${BADGES.length} badges`);
  const ids = BADGES.map(b => b.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'identifiant en double');
  for (const b of BADGES) {
    assert.ok(TIERS[b.tier], `rarete inconnue pour ${b.id}`);
    assert.ok(b.goal > 0 && Number.isFinite(b.goal), `objectif invalide pour ${b.id}`);
    assert.ok(b.n && b.d && b.u && b.i, `texte manquant pour ${b.id}`);
  }
  for (const t of ['bronze', 'silver', 'gold', 'platinum', 'legendary']) assert.ok(BADGES.filter(b => b.tier === t).length >= 5, `trop peu de badges ${t}`);
});

test('les nouveaux badges se calculent sur les vraies donnees', () => {
  const library = [
    { appid: '1', name: 'Court', playtime: 6 * 60, metacritic: 92 },
    { appid: '2', name: 'Long', playtime: 120 * 60, metacritic: 65 },
    { appid: '3', name: 'Moyen', playtime: 20 * 60 },
    { appid: '4', name: 'Presque', playtime: 30 * 60 },
  ];
  const now = new Date('2026-11-10T12:00:00Z');
  const finished = ['1', '2', '3'].map(id => ({ appid: id, since: new Date(now - 3 * 86400000).toISOString(), at: now.toISOString() }));
  const prog = { 4: { total: 20, unlocked: 19 }, 1: { total: 10, unlocked: 10, perfect: true, storyDone: true } };
  const api = load({ finished, wishlist: Array.from({ length: 10 }, (_, i) => ({ appid: 'w' + i })), queue: ['a', 'b'] }, prog, library);
  const b = Object.fromEntries(api.profileData().badges.map(x => [x.id, x]));
  assert.strictEqual(b.fin3.earned, true);          // 3 jeux termines
  assert.strictEqual(b.sprint3.earned, true);       // 3 quetes en moins de 7 jours
  assert.strictEqual(b.monthfin3.earned, true);     // 3 quetes le meme mois
  assert.strictEqual(b.mc90.earned, true);          // jeu note 92 termine
  assert.strictEqual(b.mclow.earned, true);         // jeu note 65 termine
  assert.strictEqual(b.top100.earned, true);        // 120 h sur un jeu
  assert.strictEqual(b.wish10.earned, true);        // 10 envies
  assert.strictEqual(b.near100.cur, 1);             // un jeu a 95 %
  assert.strictEqual(b.queue10.cur, 2);
  assert.strictEqual(b.fin50.earned, false);
});

test('embleme pixel art : forme, chiffres et couleur du rang', () => {
  const api = load();
  for (const lv of [1, 10, 99, 120]) {
    const svg = api.rankEmblem(lv, 120);
    assert.ok(svg.startsWith('<svg') && svg.includes('crispEdges'), 'svg pixel attendu');
    assert.ok((svg.match(/<rect /g) || []).length > 60, 'trop peu de pixels');
    assert.ok(svg.includes(`Niveau ${lv}`));
  }
  // la pointe de l'ecusson est en bas, le haut est plus large
  const rows = {};
  for (const [x, y] of api.EMB_MAP) rows[y] = (rows[y] || 0) + 1;
  assert.ok(rows[5] > rows[32], 'la pointe doit etre en bas');
  // le chiffre 1 du niveau 1 est dessine en blanc au centre
  const px = api.embPixels(1, '#9b7bff');
  assert.strictEqual(px.get('16,19'), '#ffffff');
});
