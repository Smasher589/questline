'use strict';
// Tests des alertes de session : heure limite, nuit, sessions tres longues.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load(bedtime) {
  const ctx = { st: { settings: { bedtime } }, document: { addEventListener() {} }, setInterval() {}, esc: s => s, icon: () => '' };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'static', 'session.js'), 'utf8') + '\n;this.api = { sessionWarnings, fmtDur };', ctx);
  return ctx.api;
}
const at = (h, m = 0) => { const d = new Date(2026, 10, 12, h, m, 0); return d; };

test("aucune alerte pour une session qui finit avant l'heure limite", () => {
  const { sessionWarnings } = load(23);
  assert.deepStrictEqual([...sessionWarnings(60, at(20))], []);
});

test("alerte quand la session depasse l'heure limite, avec la reduction conseillee", () => {
  const { sessionWarnings } = load(23);
  const w = sessionWarnings(90, at(22, 0));
  assert.strictEqual(w.length, 1);
  assert.strictEqual(w[0].lvl, 'warn');
  assert.match(w[0].t, /23:30/);
  assert.match(w[0].t, /30 min/);
});

test("alerte si l'heure limite est deja passee, et en pleine nuit", () => {
  const { sessionWarnings } = load(23);
  assert.ok(sessionWarnings(30, at(23, 30)).some(w => /déjà plus de 23 h/.test(w.t)));
  assert.ok(sessionWarnings(60, at(1, 30)).some(w => w.lvl === 'danger'));
});

test('minuit, aucune limite, et sessions de plus de 3 h', () => {
  assert.strictEqual(load(24).sessionWarnings(60, at(22, 30)).length, 0);
  assert.ok(load(24).sessionWarnings(120, at(23, 0)).some(w => /minuit/.test(w.t)));
  assert.strictEqual(load(0).sessionWarnings(120, at(22, 30)).filter(w => w.lvl === 'warn').length, 0);
  assert.ok(load(0).sessionWarnings(240, at(14)).some(w => w.lvl === 'info'));
  assert.strictEqual(load(23).fmtDur(90), '1 h 30');
});
