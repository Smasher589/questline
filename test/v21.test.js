'use strict';
// Tests 2.1 : sagas, pourcentage d'affinite, date de fin, Ubisoft Connect, profils Steam publics, comptes.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

// le moteur de l'interface (static/engine.js) s'execute dans un bac a sable avec les globales qu'il attend
function engine(library = [], state = {}) {
  const ctx = { lib: library, st: { finished: [], abandoned: [], ...state }, progress: {}, playlog: {}, byId: id => library.find(g => g.appid === id) };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'static', 'engine.js'), 'utf8') + '\n;this.api = { seriesInfo, earlierUnfinished, continuesSaga, affinity, journal, estimateHours, QUESTIONS };', ctx);
  return ctx.api;
}
const answer = (api, picks) => { const a = []; for (const [k, i] of Object.entries(picks)) a[api.QUESTIONS.findIndex(q => q.key === k)] = i; return a; };

test('sagas : numero arabe, romain, sous-titre, editions, suites sans numero', () => {
  const e = engine();
  assert.deepStrictEqual({ ...e.seriesInfo('The Witcher 3: Wild Hunt — Remastered') }, { key: 'the witcher', n: 3 });
  assert.deepStrictEqual({ ...e.seriesInfo('The Witcher: Enhanced Edition') }, { key: 'the witcher', n: 1 });
  assert.deepStrictEqual({ ...e.seriesInfo('DARK SOULS™ III') }, { key: 'dark souls', n: 3 });
  assert.deepStrictEqual({ ...e.seriesInfo('The Legend of Zelda: Tears of the Kingdom') }, { key: 'zelda hyrule', n: 2 });
  assert.strictEqual(e.seriesInfo('Cyberpunk 2077').n, 1);          // une annee n'est pas un numero d'episode
  assert.strictEqual(e.seriesInfo('FINAL FANTASY VII REMAKE'), null); // serie aux episodes independants
});

test("une suite n'est pas proposee avant l'episode precedent possede et pas fini", () => {
  const lib = [{ appid: '20900', name: 'The Witcher: Enhanced Edition' }, { appid: '20920', name: 'The Witcher 2: Assassins of Kings' }, { appid: '292030', name: 'The Witcher 3: Wild Hunt' }];
  let e = engine(lib);
  assert.strictEqual(e.earlierUnfinished(lib[2]).appid, '20900');   // le plus ancien episode en premier
  assert.strictEqual(e.earlierUnfinished(lib[0]), null);
  e = engine(lib, { finished: [{ appid: '20900' }, { appid: '20920' }] });
  assert.strictEqual(e.earlierUnfinished(lib[2]), null);
  assert.strictEqual(e.continuesSaga(lib[2]), true);
});

test('affinite : 0 a 100, information inconnue neutre, duree comparee au rythme', () => {
  const short = { appid: '1', name: 'Court', tags: [4234, 1742], playtime: 0, review: 92, cats: [2] };   // court + histoire
  const long = { appid: '2', name: 'Long', tags: [1695, 122], playtime: 0, review: 92, cats: [2] };     // monde ouvert + RPG
  const bare = { appid: 'switch:0', name: 'Sans donnees', tags: [], platform: 'emu', playtime: 0 };
  const e = engine([short, long, bare]);
  const a = answer(e, { rhythm: 0, length: 0, crave: 0 }); // 3 h/semaine, fini en moins de 2 semaines, envie d'histoire
  const ps = e.affinity(short, a).pct, pl = e.affinity(long, a).pct, pb = e.affinity(bare, a).pct;
  assert.ok(ps > pl, `le jeu court doit passer devant (${ps} vs ${pl})`);
  assert.ok(ps <= 100 && pl >= 0);
  assert.ok(pb >= 30 && pb <= 70, `un jeu sans tags reste neutre sur les questions de style (${pb})`);
});

test('date de fin : rythme reel, heures restantes, duree personnalisee', () => {
  const g = { appid: 'switch:01007EF00011E000', name: 'The Legend of Zelda: Breath of the Wild', playtime: 600 };
  const e = engine([g]);
  assert.strictEqual(e.estimateHours(g), 50);
  const since = new Date(Date.now() - 10 * 864e5).toISOString();
  const day = n => new Date(Date.now() - n * 864e5).toLocaleDateString('sv-SE');
  const c = { since, startPlaytime: 0, history: [{ d: day(10), pt: 0 }, { d: day(5), pt: 300 }, { d: day(0), pt: 600 }] };
  const j = e.journal(c, g);
  assert.strictEqual(j.remaining, 50 * 60 - 600);
  assert.ok(Math.abs(j.pace - 60) < 1, `600 min en 10 jours = 60 min/jour (${j.pace})`);
  const days = (j.eta - Date.now()) / 864e5;
  assert.ok(Math.abs(days - 40) < 1, `2400 min restantes a 60 min/jour = 40 jours (${days})`);
  assert.strictEqual(e.journal({ ...c, estHours: 20 }, g).estH, 20);
});

test('Ubisoft Connect : installations et noms lus dans le registre', () => {
  const ubi = require('../src/platforms/ubisoft');
  const inst = 'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs\\635\r\n    InstallDir    REG_SZ    C:/Program Files (x86)/Ubisoft/Ubisoft Game Launcher/games/Far Cry 5/\r\n\r\n'
    + 'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs\\4\r\n    InstallDir    REG_SZ    D:/Jeux/Prince of Persia/\r\n';
  assert.deepStrictEqual(ubi.parseInstalls(inst), [{ id: '635', dir: 'C:/Program Files (x86)/Ubisoft/Ubisoft Game Launcher/games/Far Cry 5' }, { id: '4', dir: 'D:/Jeux/Prince of Persia' }]);
  const names = 'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Uplay Install 635\r\n    DisplayName    REG_SZ    Far Cry 5\r\n';
  assert.deepStrictEqual(ubi.parseNames(names), { 635: 'Far Cry 5' });
});

test('Steam : identifiant de profil et page XML des succes publics', () => {
  const steam = require('../src/platforms/steam');
  assert.strictEqual(steam.parseAccount('https://steamcommunity.com/profiles/76561197960287930/'), '22202');
  assert.strictEqual(steam.parseAccount('76561197960287930'), '22202');
  assert.strictEqual(steam.parseAccount('pas un id'), null);
  const xml = '<playerstats><privacyState>public</privacyState><achievements><achievement closed="1"><iconClosed><![CDATA[https://x.steamstatic.com/a/1/6078587189483353f06f48d0eefdaaa0791e9e13.jpg]]></iconClosed>'
    + '<iconOpen><![CDATA[https://x/8246dc3a496e13c058572dab37099e76a6cd0b77.jpg]]></iconOpen><name><![CDATA[Lilas]]></name><apiname><![CDATA[lilac]]></apiname>'
    + '<description><![CDATA[Trouver Yennefer.]]></description><unlockTimestamp>1794161642</unlockTimestamp></achievement>'
    + '<achievement closed="0"><name><![CDATA[Autre]]></name><apiname><![CDATA[other]]></apiname><description><![CDATA[]]></description></achievement></achievements></playerstats>';
  const r = steam.parseAchievementXml(xml);
  assert.strictEqual(r.privacy, 'public');
  assert.strictEqual(r.list.length, 2);
  assert.deepStrictEqual({ ...r.list[0] }, { id: 'lilac', name: 'Lilas', desc: 'Trouver Yennefer.', hidden: false, unlocked: true, unlockedAt: 1794161642,
    icon: '6078587189483353f06f48d0eefdaaa0791e9e13', iconGray: '8246dc3a496e13c058572dab37099e76a6cd0b77' });
  assert.strictEqual(r.list[1].unlocked, false);
});

test("comptes : rien n'est relie par defaut, les anciennes configurations sont conservees", () => {
  const store = require('../src/state');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ql-'));
  store.init(dir);
  assert.strictEqual(store.config.onboarded, false);
  for (const a of Object.values(store.config.accounts)) assert.strictEqual(a.enabled, false);
  assert.strictEqual(store.config.accounts.steam.accountId, '');
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ accounts: { steam: { enabled: true, accountId: 'auto' } } }));
  store.init(dir);
  assert.strictEqual(store.config.accounts.steam.enabled, true);
  assert.strictEqual(store.config.onboarded, false); // l'accueil s'affiche une fois pour confirmer les comptes
});
