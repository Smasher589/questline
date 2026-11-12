'use strict';
// Notes et avis d'un jeu : Metacritic, avis des joueurs Steam (page communautaire publique),
// notes de la presse et extraits critiques (Wikipédia, CC BY-SA), et commandes conseillées.
// Résultats gardés en cache 7 jours dans le dossier de données.
const path = require('path');
const store = require('./state');
const steam = require('./platforms/steam');
const { readJson, writeJson, httpGet, mtime, plainName } = require('./util');

const WEEK = 7 * 864e5;
const UA = { 'User-Agent': 'Questline (application de bureau ; https://github.com)' };
const cacheFile = id => store.file(path.join('reviews', `${String(id).replace(/[^\w.-]/g, '_')}.json`));

// ------------------------------------------------------------ texte : HTML et wikitexte -> texte simple
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", hellip: '…', rsquo: '’', laquo: '«', raquo: '»' };
const decode = s => String(s).replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(parseInt(e[1] === 'x' ? e.slice(2) : e.slice(1), e[1] === 'x' ? 16 : 10)) : ENT[e] ?? m);
const htmlText = s => decode(String(s).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

function wikiText(s) {
  let t = String(s).replace(/<!--[\s\S]*?-->/g, '').replace(/<ref[^>]*\/>/g, '').replace(/<ref[\s\S]*?<\/ref>/g, '');
  // modèles imbriqués : on résout de l'intérieur vers l'extérieur
  for (let i = 0; i < 8 && /\{\{/.test(t); i++) {
    t = t.replace(/\{\{([^{}]*)\}\}/g, (m, body) => {
      const parts = body.split('|').map(x => x.trim()), name = parts[0].toLowerCase();
      if (/^(citation|cita|quote)$/.test(name)) return `« ${parts.slice(1).filter(p => !p.includes('=')).join(' ')} »`;
      if (/^citation boîte/.test(name)) { const q = (parts.find(p => p.startsWith('citation=')) || '').slice(9); return q ? `« ${q} »` : ''; }
      if (/^(langue|lang)$/.test(name)) return parts[parts.length - 1];
      if (/^(date|nobr|japonais|nihongo)$/.test(name)) return parts.slice(1).filter(p => !p.includes('=')).join(' ').replace(/-$/, '');
      if (name === ',') return ',';
      return '';
    });
  }
  t = t.replace(/\[\[(?:Fichier|File|Image|Catégorie|Category):[^\]]*\]\]/gi, '')
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2').replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/\[https?:\/\/\S+ ([^\]]*)\]/g, '$1').replace(/'''?/g, '').replace(/<[^>]+>/g, '');
  return decode(t).replace(/\[\[|\]\]|\{\{|\}\}/g, '').replace(/\s*,(\s*,)+/g, ',').replace(/[,\s]+$/, '').replace(/[ \t]+/g, ' ').trim();
}

// ------------------------------------------------------------ tonalité d'un avis (mots-clés)
const NEG = /\b(regrett|reproch|défaut|dommage|déçu|décevant|faiblesse|néanmoins|critiqu(?:e|ent) (?:cependant|toutefois|néanmoins|la|le|les|l['’])|manque|lourd|répétitif|frustr|ennui|point noir|ralentissement|chute|problème|bug|limité|hélas|mais il|toutefois|cependant|pénible|trop court|vide|daté)/i;
const POS = /\b(salu|lou|apprécie|excellent|chef-d['’]œuvre|réussi|magnifique|sublime|brillant|génial|remarquable|incontournable|indispensable|exceptionnel|parfait|maîtris|superbe|séduit|enthousias|culte|meilleur)/i;
const tone = t => { const n = (t.match(new RegExp(NEG.source, 'gi')) || []).length, p = (t.match(new RegExp(POS.source, 'gi')) || []).length; return n > p ? false : p > n ? true : null; };
const clip = (t, max = 380) => { if (t.length <= max) return t; const cut = t.slice(0, max); const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('» ')); return (end > 120 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '')) + ' …'; };

// mélange équilibré : jusqu'à moitié d'avis négatifs, alternés avec les positifs
function balance(list, n = 10) {
  const neg = list.filter(c => c.positive === false), pos = list.filter(c => c.positive !== false);
  const takeNeg = Math.min(neg.length, Math.ceil(n / 2)), takePos = Math.min(pos.length, n - takeNeg);
  const a = pos.slice(0, takePos), b = neg.slice(0, Math.min(neg.length, n - takePos)), out = [];
  while (a.length || b.length) { if (a.length) out.push(a.shift()); if (b.length) out.push(b.shift()); }
  return out.slice(0, n);
}

// ------------------------------------------------------------ Steam : fiche magasin et avis de la communauté
async function steamStore(appid) {
  const f = store.file(path.join('store', `${appid}.json`));
  if (Date.now() - mtime(f) > WEEK) { try { writeJson(f, await httpGet(`https://store.steampowered.com/api/appdetails?appids=${appid}&l=french&cc=FR`, { timeout: 12000 })); } catch { /* cache précédent */ } }
  return ((readJson(f, {}) || {})[appid] || {}).data || null;
}
function parseSteamReviews(html) {
  const out = [];
  for (const card of String(html).split('class="apphub_Card ').slice(1)) {
    const title = (card.match(/class="title">([^<]*)/) || [])[1] || '';
    const body = (card.match(/class="apphub_CardTextContent">([\s\S]*?)<\/div>\s*<\/div>/) || [])[1] || '';
    const date = htmlText((body.match(/class="date_posted">([^<]*)/) || [])[1] || '').replace(/^Publication\s*:\s*|^Posted:\s*/i, '');
    const text = htmlText(body.replace(/<div class="date_posted">[^<]*<\/div>/, '').replace(/<div class="early_access_review">[\s\S]*?<\/div>/, ''));
    const author = htmlText((card.match(/apphub_CardContentAuthorName[^>]*>\s*<a[^>]*>([^<]*)/) || [])[1] || 'Joueur Steam');
    const hours = htmlText((card.match(/class="hours">([^<]*)/) || [])[1] || '');
    const helpful = parseInt((htmlText((card.match(/class="found_helpful">([\s\S]*?)<\/div>/) || [])[1] || '').replace(/\s/g, '').match(/^\d+/) || [0])[0], 10) || 0;
    if (text.length < 20) continue;
    out.push({ author, positive: /^Recommand|^Recommended/i.test(title), text: clip(text, 520), meta: hours, date, helpful, source: 'steam' });
  }
  return out;
}
async function steamReviews(appid) {
  const page = (filter, lang, p = 1) => httpGet(`https://steamcommunity.com/app/${appid}/homecontent/?userreviewsoffset=${(p - 1) * 10}&p=${p}&numperpage=10&browsefilter=${filter}&appid=${appid}&appHubSubSection=10&l=${lang}&filterLanguage=${lang}&searchText=&maxInappropriateScore=50`, { type: 'text', timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } }).then(parseSteamReviews).catch(() => []);
  // les plus utiles, puis plusieurs pages d'avis récents pour trouver aussi des avis négatifs
  let list = (await Promise.all([page('toprated', 'french'), page('mostrecent', 'french'), page('mostrecent', 'french', 2), page('mostrecent', 'french', 3)])).flat();
  list.forEach(c => { c.fr = true; });
  if (list.length < 8) list = [...list, ...(await Promise.all([page('toprated', 'english'), page('mostrecent', 'english')])).flat()];
  const seen = new Set();
  // avis en français d'abord, puis les plus utiles
  list = list.filter(c => { const k = c.author + c.text.slice(0, 40); return !seen.has(k) && seen.add(k); })
    .sort((a, b) => (b.fr ? 1 : 0) - (a.fr ? 1 : 0) || b.helpful - a.helpful).map(({ fr, ...c }) => c);
  return list;
}
// jeu hors Steam : la même édition existe-t-elle sur Steam ? (nom identique)
async function steamMatch(name) {
  try {
    const r = await httpGet(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(name)}&l=french&cc=FR`, { timeout: 10000 });
    const want = plainName(name);
    const hit = (r.items || []).find(i => plainName(i.name) === want);
    return hit ? String(hit.id) : null;
  } catch { return null; }
}

// ------------------------------------------------------------ Wikipédia : notes de la presse et extraits critiques
const OUTLETS = ['Jeuxvideo.com', 'Gamekult', 'Canard PC', 'Gameblog', 'Millenium', 'JV', 'Numerama', 'Le Monde', 'Libération', 'Le Figaro', 'IGN', 'GameSpot', 'Eurogamer', 'Polygon', 'Edge', 'Famitsu', 'Destructoid', 'Game Informer', 'GamesRadar', 'Nintendo Life', 'PC Gamer', 'Kotaku', 'The Guardian', 'EGM', 'Electronic Gaming Monthly', 'Metacritic', 'OpenCritic', 'VideoGamer', 'Push Square', 'Rock Paper Shotgun', 'The Verge', 'Digital Foundry'];
function normScore(v) {
  const s = String(v).replace(',', '.');
  let m = s.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+)/); if (m) return Math.round(+m[1] / +m[2] * 100);
  m = s.match(/(\d+(?:\.\d+)?)\s*%/); if (m) return Math.round(+m[1]);
  return null;
}
// nom sans mention d'édition (« — Remastered », « Definitive Edition », ™…) pour les recherches
function baseName(name) {
  return String(name).replace(/[™®©]/g, '')
    .replace(/\s+[—–-]\s+(Remastered|Definitive|Complete|Enhanced|Game of the Year|GOTY|Director'?s Cut|Deluxe|Ultimate|Anniversary)\b.*$/i, '')
    .replace(/\s+(Remastered|Definitive Edition|Complete Edition|Enhanced Edition|Game of the Year Edition|GOTY Edition|Director'?s Cut|Deluxe Edition|Ultimate Edition)\s*$/i, '')
    .replace(/\s+/g, ' ').trim();
}
async function wikiPage(name) {
  const s = await httpGet(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(baseName(name))}&language=fr&uselang=fr&type=item&format=json&limit=5`, { timeout: 12000, headers: UA });
  const want = plainName(baseName(name));
  const hits = (s.search || []).filter(x => /jeu vidéo|video game/i.test(x.description || ''));
  const hit = hits.find(x => plainName(x.label) === want) || hits[0];
  if (!hit || !/^Q\d{1,12}$/.test(hit.id || '')) return null;
  const e = await httpGet(`https://www.wikidata.org/wiki/Special:EntityData/${hit.id}.json`, { timeout: 12000, headers: UA });
  const ent = e.entities[hit.id] || {}, links = ent.sitelinks || {};
  // année de première sortie (P577, date de publication)
  const years = (((ent.claims || {}).P577) || []).map(c => +(((c.mainsnak.datavalue || {}).value || {}).time || '').slice(1, 5)).filter(y => y > 1970);
  const year = years.length ? Math.min(...years) : null;
  if (links.frwiki) return { lang: 'fr', title: links.frwiki.title, year };
  if (links.enwiki) return { lang: 'en', title: links.enwiki.title, year };
  return null;
}
async function wikiReviews(name) {
  const page = await wikiPage(name);
  if (!page) return null;
  const host = `https://${page.lang}.wikipedia.org`;
  const r = await httpGet(`${host}/w/api.php?action=parse&page=${encodeURIComponent(page.title)}&prop=wikitext&format=json&redirects=1`, { timeout: 15000, headers: UA });
  const wt = (((r.parse || {}).wikitext) || {})['*'] || '';
  const press = [];
  // tableau des notes : {{Infobox Notes de jeu vidéo | IGN 1 = 10/10 ...}} (fr) ou {{Video game reviews | IGN = 10/10 ...}} (en)
  const box = wt.match(/\{\{\s*(?:Infobox Notes de jeu vidéo|Video game reviews)[\s\S]*?\n\}\}/i);
  if (box) {
    const seen = new Set();
    const EN = { MC: 'Metacritic', OC: 'OpenCritic', IGN: 'IGN', GSpot: 'GameSpot', GS: 'GameSpot', EG: 'Eurogamer', Poly: 'Polygon', Edge: 'Edge', Fam: 'Famitsu', Destruct: 'Destructoid', GI: 'Game Informer', GRadar: 'GamesRadar+', EGM: 'EGM', NLife: 'Nintendo Life', PCGUS: 'PC Gamer', PCGUK: 'PC Gamer' };
    for (const line of box[0].split('\n')) {
      const m = line.match(/^\s*\|\s*([^=|]+?)\s*(\d*)\s*=\s*(.+)$/);
      if (!m) continue;
      let outlet = m[1].trim(); if (/^(console|largeur|title|state|platforms|align|width|na|qualif|award|rev|revn|subtitle|note|notes|compil|lien|ref)/i.test(outlet) || outlet.length > 28) continue;
      outlet = EN[outlet] || outlet;
      const value = wikiText(m[3]).replace(/[{}]/g, '').replace(/[,.;\s]+$/, '').trim();
      if (!value || seen.has(outlet)) continue;
      seen.add(outlet);
      press.push({ outlet, value, norm: normScore(value) });
    }
  }
  // extraits critiques : sections « Critique… », « Réception… » (fr) ou « Reception » (en)
  const comments = [];
  const sections = wt.split(/\n(?==+[^=\n]+=+\s*\n)/);
  for (const sec of sections) {
    const head = (sec.match(/^=+\s*([^=\n]+?)\s*=+/) || [])[1] || '';
    if (!/critique|réception|reception|accueil/i.test(head) || /vente|sales|récompense|award|démo|présentation/i.test(head)) continue;
    const body = sec.replace(/^=+[^\n]*\n/, '').replace(/\{\{\s*(?:Infobox Notes de jeu vidéo|Video game reviews)[\s\S]*?\n\}\}/i, '');
    for (const para of body.split(/\n\s*\n/)) {
      const text = wikiText(para).replace(/\n+/g, ' ').trim();
      if (text.length < 90 || /^\|/.test(text) || /^\{\|/.test(para.trim())) continue;
      // auteur : le premier média cité dans le paragraphe (hors agrégateurs de notes)
      const found = OUTLETS.filter(o => !/metacritic|opencritic/i.test(o))
        .map(o => ({ o, i: text.search(new RegExp(`\\b${o.replace(/[.+]/g, '\\$&')}\\b`, 'i')) }))
        .filter(x => x.i >= 0).sort((a, b) => a.i - b.i)[0];
      const shown = clip(text);   // la tonalité est jugée sur l'extrait réellement affiché
      comments.push({ author: found ? found.o : (page.lang === 'fr' ? 'La presse' : 'Press'), positive: tone(shown), text: shown, meta: wikiText(head), date: '', source: 'press' });
    }
  }
  return { press, comments: balance(comments), page: { ...page, url: `${host}/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}` } };
}

// ------------------------------------------------------------ commandes conseillées
function controls(game, sd) {
  if (game.platform === 'emu') return { rec: 'pad', label: 'Manette recommandée', detail: `Jeu conçu pour ${game.system || 'console'} : une manette offre la meilleure expérience. Le clavier reste possible via la configuration de l'émulateur.` };
  const cats = new Set([...(game.cats || []), ...((sd && sd.categories) || []).map(c => c.id)]);
  if ((sd && sd.controller_support === 'full') || cats.has(28)) return { rec: 'pad', label: 'Manette recommandée', detail: 'Prise en charge complète de la manette : tout le jeu se joue confortablement au pad (clavier-souris possible).' };
  if ((sd && sd.controller_support === 'partial') || cats.has(18)) return { rec: 'kbm', label: 'Clavier-souris recommandé', detail: 'Manette prise en charge partiellement : certains menus ou actions demandent le clavier et la souris.' };
  if (sd || (game.cats || []).length) return { rec: 'kbm', label: 'Clavier-souris', detail: "Pas de prise en charge de la manette annoncée : prévois le clavier et la souris." };
  return { rec: 'unknown', label: 'Commandes non précisées', detail: "La plateforme n'indique pas les commandes conseillées pour ce jeu." };
}

function mixComments(players, press) {
  const neg = players.filter(c => !c.positive).length;
  const extraNeg = neg >= 3 ? [] : press.filter(c => c.positive === false).slice(0, 3 - neg);
  const pool = players.length >= 6 ? [...players, ...extraNeg] : [...players, ...press];
  return balance(pool);
}

// ------------------------------------------------------------ assemblage, avec cache
async function reviews(game, refresh = false) {
  const f = cacheFile(game.appid);
  // résultat complet : gardé 7 jours ; incomplet (site lent ou limité) : nouvel essai au bout d'une heure
  if (!refresh) { const c = readJson(f); if (c && Date.now() - mtime(f) < (c.partial ? 3600e3 : WEEK)) return c; }
  const isSteam = /^\d{1,10}$/.test(game.appid);
  const appid = isSteam ? game.appid : await steamMatch(game.name);
  const [sd, sr, wk] = await Promise.all([
    appid ? steamStore(appid).catch(() => null) : null,
    appid ? steamReviews(appid).catch(() => []) : [],
    wikiReviews(game.name).catch(() => null),
  ]);
  const lib = isSteam ? steam.library().find(g => g.appid === game.appid) : null;
  const press = (wk && wk.press) || [];
  const mcPress = press.find(p => /metacritic/i.test(p.outlet));
  const metacritic = sd && sd.metacritic ? { score: sd.metacritic.score, url: sd.metacritic.url || null, source: 'Steam' }
    : mcPress && mcPress.norm ? { score: mcPress.norm, url: null, source: 'Wikipédia' } : null;
  const outlets = press.filter(p => p.norm && !/metacritic|opencritic/i.test(p.outlet));
  const out = {
    at: Date.now(), steamAppid: appid || null, metacritic,
    users: lib && lib.review ? { pct: lib.review, source: 'Steam' } : null,
    press, pressAvg: outlets.length ? Math.round(outlets.reduce((a, p) => a + p.norm, 0) / outlets.length) : null,
    // avis : joueurs Steam d'abord ; s'il manque des avis négatifs (ou des avis tout court), la presse complète
    comments: mixComments(sr, (wk && wk.comments) || []),
    commentsFrom: [sr.length && 'steam', wk && wk.comments.length && 'wikipedia'].filter(Boolean),
    wiki: wk ? wk.page : null,
    controls: controls(game, sd),
  };
  out.partial = out.comments.length < 8 || (!wk && !metacritic) || (appid && !sd);
  writeJson(f, out);
  // index léger des notes, pour les tuiles de la bibliothèque
  const idx = readJson(store.file('ratings.json'), {});
  idx[game.appid] = { mc: metacritic ? metacritic.score : null, press: out.pressAvg, ctl: out.controls.rec };
  writeJson(store.file('ratings.json'), idx);
  return out;
}
const ratings = () => readJson(store.file('ratings.json'), {});

module.exports = { reviews, ratings, mixComments, baseName, parseSteamReviews, wikiText, normScore, balance, tone, controls };
