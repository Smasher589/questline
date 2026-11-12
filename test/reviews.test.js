'use strict';
// Tests des avis et notes : lecture des avis Steam, wikitexte, notes, melange, commandes conseillees.
const test = require('node:test');
const assert = require('node:assert');
const rv = require('../src/reviews');

test('avis Steam : recommandation, heures, date, texte, votes utiles', () => {
  const card = (title, hours, text, helpful) => `<div class="apphub_Card modalContentLink"><div class="found_helpful">\n${helpful} personnes ont trouvé cette évaluation utile</div>
    <div class="title">${title}</div><div class="hours">${hours}</div>
    <div class="apphub_CardTextContent">
				<div class="date_posted">Publication : 2 juin 2017</div>
				${text}
			</div>
		</div><div class="apphub_CardContentAuthorName offline ellipsis"><a href="#">Ficelle</a></div>`;
  const list = rv.parseSteamReviews(card('Recommandé', '205.4 h en tout', 'Un chef-d&#39;œuvre,<br>vraiment.', 120) + card('Non recommandé', '3 h en tout', 'Trop de bugs à la sortie, dommage.', 4));
  assert.strictEqual(list.length, 2);
  assert.deepStrictEqual({ ...list[0] }, { author: 'Ficelle', positive: true, text: "Un chef-d'œuvre,\nvraiment.", meta: '205.4 h en tout', date: '2 juin 2017', helpful: 120, source: 'steam' });
  assert.strictEqual(list[1].positive, false);
});

test('wikitexte : liens, modeles, references et citations', () => {
  assert.strictEqual(rv.wikiText("''[[Jeuxvideo.com]]'' salue les [[Combat|combats]]<ref>source</ref> {{Citation|très réussis}}."), 'Jeuxvideo.com salue les combats « très réussis ».');
  assert.strictEqual(rv.wikiText("Critiques du ''{{Langue|en|gameplay}}''"), 'Critiques du gameplay');
  assert.ok(rv.wikiText('10/10<ref name="a" />{{,}}{{,}}.').startsWith('10/10'));
});

test('notes : conversion sur 100', () => {
  assert.strictEqual(rv.normScore('9,5/10'), 95);
  assert.strictEqual(rv.normScore('37/40'), 93);
  assert.strictEqual(rv.normScore('97 %'), 97);
  assert.strictEqual(rv.normScore('Essential'), null);
});

test('melange : moitie de reserves au plus, alternees, 10 avis maximum', () => {
  const pos = Array.from({ length: 12 }, (_, i) => ({ text: 'p' + i, positive: true }));
  const neg = Array.from({ length: 2 }, (_, i) => ({ text: 'n' + i, positive: false }));
  const out = rv.balance([...pos, ...neg]);
  assert.strictEqual(out.length, 10);
  assert.strictEqual(out.filter(c => c.positive === false).length, 2);
  assert.deepStrictEqual(out.slice(0, 4).map(c => c.text), ['p0', 'n0', 'p1', 'n1']);
  // peu d'avis negatifs chez les joueurs : la presse complete avec ses reserves
  const mixed = rv.mixComments(pos.slice(0, 8), [{ text: 'presse-', positive: false }, { text: 'presse+', positive: true }]);
  assert.ok(mixed.some(c => c.text === 'presse-'));
  assert.ok(!mixed.some(c => c.text === 'presse+'));
});

test('commandes conseillees : emulation, manette complete ou partielle, clavier', () => {
  assert.strictEqual(rv.controls({ platform: 'emu', system: 'Nintendo Switch' }).rec, 'pad');
  assert.strictEqual(rv.controls({ appid: '1', cats: [2, 28] }, null).rec, 'pad');
  assert.strictEqual(rv.controls({ appid: '1', cats: [2] }, { controller_support: 'partial', categories: [] }).rec, 'kbm');
  assert.strictEqual(rv.controls({ appid: '1', cats: [2] }, { categories: [{ id: 2 }] }).label, 'Clavier-souris');
  assert.strictEqual(rv.controls({ platform: 'gog', cats: [] }, null).rec, 'unknown');
});
