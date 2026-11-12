'use strict';
// Tests 2.2 : succes a paliers, decors a debloquer, presence des images integrees.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const STATIC = path.join(__dirname, '..', 'static');
function load(state = {}, prog = {}, library = []) {
  const ctx = { lib: library, st: { finished: [], abandoned: [], blocked: [], queue: [], wishlist: [], flags: {}, settings: {}, ...state }, progress: prog, playlog: {},
    byId: id => library.find(g => g.appid === id), esc: s => String(s), icon: () => '', document: { addEventListener() {} }, addEventListener() {} };
  vm.createContext(ctx);
  const code = ['engine.js', 'progress.js', 'rewards.js'].map(f => fs.readFileSync(path.join(STATIC, f), 'utf8')).join('\n;\n');
  vm.runInContext(code + '\n;this.api = { tierData, tierIds, tierXpTotal, SCENES, PALETTE_LV, unlocksAt, TIER_FAMILIES, profileData };', ctx);
  return ctx.api;
}

test('paliers : niveau, prochain objectif, progression et XP', () => {
  const api = load({ finished: [{ appid: '1' }, { appid: '2' }, { appid: '3' }], blocked: Array(12).fill({}) }, { 1: { storyDone: true, unlocked: 30 }, 2: { storyDone: true, unlocked: 30 } });
  const extra = { fin: 7, total: 130 * 60, best: 8, days: new Set(Array.from({ length: 22 }, (_, i) => `d${i}`)), perfect: 0 };
  const t = Object.fromEntries(api.tierData(extra).map(f => [f.id, f]));
  assert.strictEqual(t.finisher.level, 4);          // 1, 2, 3, 5 atteints ; 8 pas encore
  assert.strictEqual(t.finisher.next, 8);
  assert.ok(Math.abs(t.finisher.p - 2 / 3) < 1e-9); // de 5 a 8 : 7 -> 2/3
  assert.strictEqual(t.hours.level, 4);             // 10, 25, 50, 100
  assert.strictEqual(t.willpower.level, 4);         // 1, 3, 5, 10
  assert.strictEqual(t.hunter.level, 3);            // 60 succes : 10, 25, 50
  assert.strictEqual(t.perfect.level, 0);
  const others = Object.values(t).filter(f => f.id !== 'legend').reduce((a, f) => a + f.level, 0);
  assert.strictEqual(t.legend.cur, others);         // la famille Legende compte les paliers des autres
  assert.strictEqual(t.finisher.xp, api.tierXpTotal(4));
  assert.strictEqual(api.tierXpTotal(12), 40 * (1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12));
  assert.ok(api.tierIds(Object.values(t)).includes('tier:finisher:4'));
});

test('10 familles de 12 paliers croissants, avec leurs emblemes', () => {
  const api = load();
  assert.strictEqual(api.TIER_FAMILIES.length, 18);
  for (const f of api.TIER_FAMILIES) {
    assert.strictEqual(f.steps.length, 12, f.id);
    for (let i = 1; i < 12; i++) assert.ok(f.steps[i] > f.steps[i - 1], `${f.id} palier ${i}`);
    for (let k = 1; k <= 12; k++) assert.ok(fs.existsSync(path.join(STATIC, 'art', 'ranks', `${f.art}-${k}.png`)), `${f.art}-${k}.png`);
  }
});

test('decors : niveaux croissants, toutes les couches presentes, annonces de deblocage', () => {
  const api = load();
  assert.strictEqual(api.SCENES.filter(s => s.lv === 1).length >= 2, true);
  for (const s of api.SCENES) for (let k = 1; k <= s.l; k++) assert.ok(fs.existsSync(path.join(STATIC, 'art', 'scenes', s.id, `${k}.png`)), `${s.id}/${k}.png`);
  assert.deepStrictEqual([...api.unlocksAt(2)], ['le décor « Forêt sombre »']);
  assert.ok(api.unlocksAt(5).some(x => /Rétro/.test(x)));
  for (const t of ['cup', 'medal']) for (const m of ['gold', 'silver', 'bronze']) assert.ok(fs.existsSync(path.join(STATIC, 'art', 'trophies', `${t}-${m}.png`)));
  assert.ok(fs.existsSync(path.join(STATIC, 'art', 'CREDITS.txt')));
});

test("le profil inclut l'XP des paliers", () => {
  const api = load({ finished: [{ appid: '1' }] }, { 1: { storyDone: true, unlocked: 12 } }, [{ appid: '1', name: 'Jeu', playtime: 600, tags: [] }]);
  const pd = api.profileData();
  const row = pd.breakdown.find(r => r.l === 'Paliers de succès');
  assert.ok(row && row.xp > 0, 'ligne XP des paliers');
  assert.ok(pd.tiers.length === 18);
});
