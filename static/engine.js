/* =====================================================================
   Questline — moteur : affinité, sagas, durées estimées, journal, XP, badges, défis
   Utilise les globales de app.js : lib, st, progress, playlog, questAch
   ===================================================================== */

/* ---------------------------------------------------------------- tags Steam (identifiants officiels) */
const T = {
  action: 19, adventure: 21, casual: 597, rpg: 122, atmospheric: 4166, colorful: 4305, story: 1742, exploration: 3834,
  puzzle: 1664, relaxing: 1654, funny: 4136, comedy: 1719, horror: 1667, shooter: 1774, dark: 4342, linear: 7250, openworld: 1695,
  psycho: 1721, psychological: 5186, thriller: 4064, roguelike: 1716, roguelite: 3959, platformer: 1625, fps: 1663, emotional: 5608,
  difficult: 4026, survivalhorror: 3978, hackslash: 1646, stealth: 1687, soundtrack: 1756, cozy: 97376, soulslike: 29482, short: 4234,
  metroidvania: 1628, beautiful: 5411, firstperson: 3839, thirdperson: 1697, tps: 3814, topdown: 4791, twod: 3871, isometric: 5851,
  fantasy: 1684, darkfantasy: 4604, magic: 4057, dragons: 4046, scifi: 3942, space: 1755, cyberpunk: 4115, postapo: 3835, zombies: 1659,
  survival: 1662, historical: 3987, realistic: 4175, medieval: 4172, western: 1647, military: 4168, superhero: 1671, stylized: 4252,
  cartoony: 4195, handdrawn: 6815, pixel: 3964, anime: 4085, jrpg: 4434, combat: 3993, walking: 5900, visualnovel: 3799, ifiction: 11014,
  turnbased: 1677, turncombat: 4325, choices: 6426, endings: 6971, cyoa: 4486, arpg: 4231, loot: 4236, custom: 4747, actionadv: 4106,
  cinematic: 4145, lore: 3854, arcade: 1773, mystery: 5716, detective: 5613, collectathon: 5652, gore: 4345, family: 5350, cute: 4726, immersive: 9204,
};
const INTENSE = { [T.action]: .6, [T.difficult]: 1, [T.soulslike]: 1, [T.fps]: .7, [T.hackslash]: .7, [T.horror]: .6, [T.survivalhorror]: .7, [T.roguelike]: .5 };
const CALM = { [T.relaxing]: 1, [T.cozy]: 1, [T.casual]: .8, [T.puzzle]: .6, [T.story]: .3, [T.exploration]: .3, [T.walking]: .8 };
const GENRES = { 1: "Action", 25: "Aventure", 3: "RPG", 23: "Indépendant", 2: "Stratégie", 28: "Simulation", 4: "Casual", 9: "Course", 18: "Sport", 37: "Free-to-play", 70: "Accès anticipé", 29: "MMO" };

const tagWeight = g => { const w = {}; (g.tags || []).forEach((t, i) => w[t] = Math.max(.25, 1 - i / 22)); return w; };
const hasTags = g => (g.tags || []).length > 0;
const dot = (w, set) => Object.entries(set).reduce((s, [t, k]) => s + (w[t] || 0) * k, 0);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
// intensité 0 (calme) à 1 (intense) ; null si le jeu n'a aucune donnée de style
const intensity = g => hasTags(g) ? clamp(.45 + .5 * (dot(tagWeight(g), INTENSE) - dot(tagWeight(g), CALM)) / 1.5) : null;
const played = g => (g.playtime || 0) >= 30;
const year = g => g.release ? new Date(g.release * 1000).getFullYear() : 0;
const fmtH = m => { const h = (m || 0) / 60; return h < 1 ? Math.round(h * 60) + " min" : (h < 10 ? h.toFixed(1).replace(".", ",") : Math.round(h)) + " h"; };
const dayKey = d => d.toLocaleDateString("sv-SE");
const simpleName = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[™®©]/g, "").replace(/\s+/g, " ").trim();

/* ---------------------------------------------------------------- durée estimée de l'histoire principale
   Pas de source officielle libre : jeux connus, sinon une estimation par les tags. Le joueur peut corriger la durée de sa quête. */
const KNOWN_HOURS = {
  1903340: 32, 1091500: 26, 1245620: 55, 2215430: 26, 3321460: 45, 1643320: 40, 2531310: 25, 990080: 28, 209000: 12, 35140: 11,
  2149010: 4, 1588550: 10, 2215200: 14, 3768760: 14, 1145360: 22, 2651280: 18, 292030: 50, 1222140: 12, 391220: 15, 750920: 12,
  1817070: 40, 1817230: 9, 2358720: 30, 200260: 15, 1174180: 50, 1593500: 21, 2050650: 30, 1086940: 75, 814380: 30, 601150: 24,
};
// jeux hors Steam (consoles, Epic…), reconnus par leur nom
const KNOWN_HOURS_NAME = [
  [/zelda.*breath of the wild/, 50], [/zelda.*tears of the kingdom/, 60], [/zelda.*link'?s awakening/, 14], [/zelda.*echoes of wisdom/, 18],
  [/zelda.*skyward sword/, 34], [/zelda.*ocarina of time/, 25], [/super mario odyssey/, 14], [/super mario bros\.? wonder/, 11],
  [/metroid dread/, 9], [/metroid prime/, 16], [/xenoblade chronicles 3/, 65], [/xenoblade chronicles 2/, 55], [/fire emblem.*three houses/, 50],
  [/pokemon.*(ecarlate|scarlet|violet)/, 30], [/pokemon.*legends?.*arceus/, 25], [/kirby.*forgotten land/, 12], [/astral chain/, 18],
  [/hollow knight/, 27], [/^hades/, 22], [/celeste/, 8], [/^elden ring$/, 58],
];
function estimateHours(g) {
  if (!g) return 20;
  if (KNOWN_HOURS[g.appid]) return KNOWN_HOURS[g.appid];
  const kn = KNOWN_HOURS_NAME.find(([re]) => re.test(simpleName(g.name)));
  if (kn) return kn[1];
  const w = tagWeight(g), has = t => (w[t] || 0) >= .55;   // seuls les tags les plus votés comptent
  let h = 16;
  if (has(T.short)) h = 6;
  else if (has(T.jrpg)) h = 45;
  else if (has(T.openworld) && has(T.rpg)) h = 45;
  else if (has(T.openworld)) h = 28;
  else if (has(T.rpg)) h = 30;
  else if (has(T.roguelike) || has(T.roguelite)) h = 22;
  else if (has(T.linear)) h = 11;
  else if (has(T.walking) || has(T.visualnovel)) h = 6;
  else if (has(T.puzzle) && !has(T.action)) h = 10;
  if (has(T.family) || has(T.casual) || has(T.cute)) h = Math.min(h, 14);   // LEGO, jeux familiaux…
  return h;
}
// la durée vient-elle d'une vraie donnée (jeu connu ou tags), ou d'une supposition par défaut ?
const durationKnown = g => !!(KNOWN_HOURS[g.appid] || KNOWN_HOURS_NAME.some(([re]) => re.test(simpleName(g.name))) || hasTags(g));
// heures d'histoire restantes, d'après le temps déjà passé dessus
const hoursLeft = g => Math.max(1, estimateHours(g) - (g.playtime || 0) / 60);

/* ---------------------------------------------------------------- sagas : ordre des épisodes
   Le nom donne la série et le numéro (« The Witcher 3 », « Dark Souls III ») ; quelques suites sans numéro sont connues. */
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16 };
const SAGAS = [
  [/zelda.*breath of the wild/, "zelda hyrule", 1], [/zelda.*tears of the kingdom/, "zelda hyrule", 2],
  [/^hollow knight$/, "hollow knight", 1], [/silksong/, "hollow knight", 2],
  [/arkham asylum/, "batman arkham", 1], [/arkham city/, "batman arkham", 2], [/arkham knight/, "batman arkham", 3],
  [/horizon zero dawn/, "horizon", 1], [/horizon forbidden west/, "horizon", 2],
  [/ori and the blind forest/, "ori", 1], [/ori and the will of the wisps/, "ori", 2],
  [/miles morales/, "spider-man insomniac", 2], [/spider-?man 2/, "spider-man insomniac", 3], [/^marvel'?s spider-?man/, "spider-man insomniac", 1],
  [/^god of war$/, "god of war nordique", 1], [/god of war ragnar/, "god of war nordique", 2],
  [/plague tale: innocence/, "a plague tale", 1], [/plague tale: requiem/, "a plague tale", 2],
  [/metro 2033/, "metro", 1], [/metro last light/, "metro", 2], [/metro exodus/, "metro", 3],
  [/jedi: fallen order/, "star wars jedi", 1], [/jedi: survivor/, "star wars jedi", 2],
  [/dishonored: death of the outsider/, "dishonored", 3],
];
// séries aux épisodes indépendants : jamais bloquées
const STANDALONE = new Set(["final fantasy", "dragon quest", "far cry", "need for speed", "the elder scrolls", "fallout", "persona", "forza horizon",
  "fifa", "ea sports fc", "nba 2k", "f1", "sid meier's civilization", "total war", "tom clancy's ghost recon", "pokemon", "mario kart"]);
const EDITION = /\b(remastered|remaster|definitive|enhanced|complete|game of the year|goty|director'?s cut|deluxe|ultimate|anniversary|hd|edition|remake|reloaded)\b.*$/;
const seriesCache = new Map();
function seriesInfo(name) {
  const raw = String(name || "");
  if (seriesCache.has(raw)) return seriesCache.get(raw);
  const nm = simpleName(raw);
  let info = null;
  const known = SAGAS.find(([re]) => re.test(nm));
  if (known) info = { key: known[1], n: known[2] };
  else {
    const base = nm.split(/\s*[:–—]\s*|\s+-\s+/)[0].replace(EDITION, "").trim();
    const m = base.match(/^(.+?)\s+(\d{1,2}|[ivx]{1,5})$/);
    const num = m ? (/^\d+$/.test(m[2]) ? +m[2] : ROMAN[m[2]]) : 0;
    const numbered = num >= 1 && num <= 20;
    const key = (numbered ? m[1] : base).replace(/\s+part$/, "").trim();
    if (key.length >= 3 && !STANDALONE.has(key)) info = { key, n: numbered ? num : 1 };
  }
  seriesCache.set(raw, info);
  return info;
}
// épisode précédent possédé et pas encore fini (le plus ancien de la saga), sinon null
function earlierUnfinished(g) {
  const s = seriesInfo(g?.name);
  if (!s || s.n < 2) return null;
  const done = finishedIds(), dropped = new Set(st.abandoned.map(x => String(x.appid)));
  const prev = lib.filter(x => x !== g && !done.has(String(x.appid)) && !dropped.has(String(x.appid)))
    .map(x => ({ x, s: seriesInfo(x.name) })).filter(o => o.s && o.s.key === s.key && o.s.n < s.n)
    .sort((a, b) => a.s.n - b.s.n);
  return prev[0]?.x || null;
}
// suite directe d'un épisode déjà terminé
function continuesSaga(g) {
  const s = seriesInfo(g?.name);
  if (!s || s.n < 2) return false;
  const done = finishedIds();
  return lib.some(x => done.has(String(x.appid)) && seriesInfo(x.name)?.key === s.key && seriesInfo(x.name).n === s.n - 1);
}

/* ---------------------------------------------------------------- questionnaire
   Objectif : trouver le jeu que tu vas FINIR. Les réponses « Peu importe » ne comptent pas.
   fn(g, ctx) renvoie une note de 0 à 1, ou null si le jeu n'a pas l'information (note neutre). */
const QUESTIONS = [
  { key: "rhythm", eyebrow: "Ton rythme", title: "Combien d'heures par semaine peux-tu y consacrer ?", imp: 0, choices: [
    { i: "clock", t: "Environ 3 h", s: "Quelques sessions courtes", v: 3 },
    { i: "hourglass", t: "Environ 7 h", s: "Une heure par jour", v: 7 },
    { i: "calendar", t: "Environ 14 h", s: "Deux heures par jour", v: 14 },
    { i: "flame", t: "Plus de 20 h", s: "Je joue beaucoup", v: 25 } ] },
  { key: "length", eyebrow: "Objectif", title: "En combien de temps veux-tu voir le générique ?", imp: 1.8, choices: [
    { i: "flag", t: "Moins de 2 semaines", s: "Une aventure vite bouclée", v: 2 },
    { i: "calendar", t: "Environ un mois", s: "Sans me presser", v: 4 },
    { i: "mountain", t: "Deux ou trois mois", s: "Une grande épopée", v: 10 },
    { i: "dice", t: "Peu importe", s: "" } ] },
  { key: "crave", eyebrow: "Envie", title: "Qu'est-ce qui te donnera envie d'y revenir chaque jour ?", imp: 2.2, choices: [
    { i: "book", t: "L'histoire", s: "Savoir ce qui va se passer", tags: { [T.story]: 1, [T.emotional]: .7, [T.atmospheric]: .4, [T.adventure]: .35 }, r: "Une histoire forte" },
    { i: "swords", t: "L'action", s: "Les combats, l'adrénaline", tags: { [T.action]: 1, [T.hackslash]: .8, [T.shooter]: .8, [T.fps]: .8 }, r: "De l'action" },
    { i: "map", t: "L'exploration", s: "Un monde à découvrir", tags: { [T.openworld]: 1, [T.exploration]: .9, [T.adventure]: .5 }, r: "Un monde à explorer" },
    { i: "skull", t: "Le défi", s: "Progresser, vaincre l'impossible", tags: { [T.difficult]: 1, [T.soulslike]: 1, [T.roguelike]: .8 }, r: "Du vrai défi" },
    { i: "coffee", t: "La détente", s: "Un moment sans stress", tags: { [T.relaxing]: 1, [T.cozy]: 1, [T.casual]: .8, [T.puzzle]: .5 }, r: "Pour décompresser" } ] },
  { key: "drop", eyebrow: "Tenir jusqu'au bout", title: "Qu'est-ce qui t'a déjà fait lâcher un jeu en cours de route ?", imp: 1.4, choices: [
    { i: "hourglass", t: "Il était trop long", s: "Je me suis lassé avant la fin", fn: g => durationKnown(g) ? clamp(1 - (estimateHours(g) - 15) / 40) : null, r: g => `≈ ${estimateHours(g)} h d'histoire` },
    { i: "skull", t: "Il était trop dur", s: "Bloqué sur un boss", tags: { [T.difficult]: -1, [T.soulslike]: -1, [T.roguelike]: -.4 }, r: "Pas de mur de difficulté" },
    { i: "rotate", t: "Trop répétitif", s: "Quêtes et objets à collectionner", tags: { [T.collectathon]: -1, [T.openworld]: -.5, [T.loot]: -.5 }, r: "Peu de remplissage" },
    { i: "book", t: "L'histoire ne m'accrochait pas", s: "Je n'avais plus de raison de continuer", tags: { [T.story]: 1, [T.cinematic]: .6, [T.emotional]: .5 }, r: "Une histoire qui accroche" },
    { i: "check", t: "Rien, je finis tout", s: "" } ] },
  { key: "progress", eyebrow: "Ta pile de jeux", title: "Reprendre un jeu commencé, ou en découvrir un ?", imp: 1.4, choices: [
    { i: "rotate", t: "Reprendre", s: "Un jeu déjà entamé", fn: g => played(g) ? 1 : 0, r: g => `Déjà ${fmtH(g.playtime)} dessus` },
    { i: "sparkles", t: "Découvrir", s: "Jamais vraiment lancé", fn: g => played(g) ? 0 : 1, r: "Jamais vraiment lancé" },
    { i: "dice", t: "Peu importe", s: "" } ] },
  { key: "saga", eyebrow: "Sagas", title: "Envie de continuer une saga dont tu as fini un épisode ?", imp: .9, choices: [
    { i: "layers", t: "Oui, la suite !", s: "Retrouver un univers que je connais", fn: g => continuesSaga(g) ? 1 : .2, r: "La suite d'un jeu que tu as fini" },
    { i: "sparkles", t: "Non, du nouveau", s: "Une nouvelle histoire", fn: g => (seriesInfo(g.name)?.n || 1) > 1 ? .2 : 1 },
    { i: "dice", t: "Peu importe", s: "" } ] },
  { key: "platform", eyebrow: "Où jouer", title: "Sur quoi veux-tu jouer ?", imp: 1.2, choices: [
    { i: "monitor", t: "Sur PC", s: "Steam, Epic, GOG, Ubisoft…", fn: g => g.platform === "emu" ? 0 : 1, r: "Sur PC" },
    { i: "gamepad", t: "En émulation", s: "Switch, PlayStation, rétro…", fn: g => g.platform === "emu" ? 1 : 0, r: g => `${g.system || "Console"} en émulation` },
    { i: "dice", t: "Peu importe", s: "" } ] },
  { key: "energy", eyebrow: "Intensité", title: "Quel rythme de jeu te garde motivé sur la durée ?", imp: 1, choices: [
    { i: "leaf", t: "Calme", s: "Contemplatif, posé", fn: g => intensity(g) === null ? null : 1 - Math.abs(intensity(g) - .2), r: "Rythme posé" },
    { i: "scale", t: "Équilibré", s: "Des temps forts et des pauses", fn: g => intensity(g) === null ? null : 1 - Math.abs(intensity(g) - .5), r: "Rythme équilibré" },
    { i: "zap", t: "Intense", s: "Ça doit bouger", fn: g => intensity(g) === null ? null : 1 - Math.abs(intensity(g) - .9), r: "Rythme intense" },
    { i: "dice", t: "Peu importe", s: "" } ] },
  { key: "tone", eyebrow: "Ambiance", title: "Quelle atmosphère ?", imp: 1, choices: [
    { i: "moon", t: "Sombre et tendue", s: "Nuit, pluie, menace", tags: { [T.dark]: 1, [T.horror]: .8, [T.psycho]: .7, [T.darkfantasy]: .7, [T.atmospheric]: .3 }, r: "Ambiance sombre" },
    { i: "sunrise", t: "Lumineuse et belle", s: "Des paysages à couper le souffle", tags: { [T.colorful]: 1, [T.beautiful]: .8, [T.funny]: .5, [T.relaxing]: .5, [T.cozy]: .5 }, r: "Des paysages lumineux" },
    { i: "dice", t: "Peu importe", s: "Surprends-moi" } ] },
  { key: "feel", eyebrow: "Émotion", title: "Tu as envie de ressentir quoi ?", imp: 1, choices: [
    { i: "smile", t: "Rire", s: "Du fun, de l'humour", tags: { [T.funny]: 1, [T.comedy]: 1, [T.cute]: .4 }, r: "De l'humour" },
    { i: "heart", t: "Être ému", s: "Une histoire qui touche", tags: { [T.emotional]: 1, [T.story]: .5 }, r: "Une histoire qui touche" },
    { i: "ghost", t: "Frissonner", s: "Tension et suspense", tags: { [T.horror]: 1, [T.thriller]: .8, [T.psychological]: .7 }, r: "De quoi frissonner" },
    { i: "leaf", t: "M'apaiser", s: "Calme et beauté", tags: { [T.relaxing]: 1, [T.cozy]: 1, [T.beautiful]: .5 }, r: "Apaisant" },
    { i: "dice", t: "Peu importe", s: "" } ] },
  { key: "view", eyebrow: "Caméra", title: "Quelle vue tu préfères ?", imp: .6, choices: [
    { i: "eye", t: "Première personne", s: "À travers ses yeux", tags: { [T.firstperson]: 1, [T.fps]: .6 }, r: "En première personne" },
    { i: "user", t: "Troisième personne", s: "Je vois mon héros", tags: { [T.thirdperson]: 1, [T.tps]: .6, [T.actionadv]: .3 }, r: "En troisième personne" },
    { i: "grid", t: "Vue du dessus ou 2D", s: "Isométrique, plateforme…", tags: { [T.topdown]: 1, [T.twod]: 1, [T.isometric]: 1, [T.platformer]: .5 }, r: "Vue du dessus / 2D" },
    { i: "dice", t: "Peu importe", s: "" } ] },
  { key: "world", eyebrow: "Univers", title: "Dans quel univers tu veux plonger ?", imp: 1, choices: [
    { i: "wand", t: "Fantasy", s: "Magie, dragons, royaumes", tags: { [T.fantasy]: 1, [T.darkfantasy]: .9, [T.magic]: .6, [T.dragons]: .6, [T.medieval]: .4 }, r: "Univers fantasy" },
    { i: "rocket", t: "Science-fiction", s: "Espace, futur, cyberpunk", tags: { [T.scifi]: 1, [T.space]: .8, [T.cyberpunk]: .9 }, r: "Science-fiction" },
    { i: "ruins", t: "Post-apocalyptique", s: "Ruines et survie", tags: { [T.postapo]: 1, [T.zombies]: .7, [T.survival]: .5 }, r: "Post-apocalyptique" },
    { i: "landmark", t: "Réaliste ou historique", s: "Notre monde, hier ou aujourd'hui", tags: { [T.historical]: 1, [T.realistic]: .8, [T.western]: .7, [T.military]: .6 }, r: "Univers réaliste" },
    { i: "bolt", t: "Super-héros", s: "Capes et pouvoirs", tags: { [T.superhero]: 1 }, r: "Super-héros" },
    { i: "dice", t: "Peu importe", s: "" } ] },
  { key: "art", eyebrow: "Style", title: "Quel style graphique ?", imp: .5, choices: [
    { i: "image", t: "Réaliste", s: "Le plus beau possible", tags: { [T.realistic]: 1, [T.beautiful]: .5 }, r: "Graphismes réalistes" },
    { i: "palette", t: "Stylisé", s: "Cartoon, dessiné à la main", tags: { [T.stylized]: 1, [T.cartoony]: .9, [T.handdrawn]: .8, [T.colorful]: .4 }, r: "Style graphique marqué" },
    { i: "pixel", t: "Pixel art", s: "Rétro", tags: { [T.pixel]: 1, [T.twod]: .3 }, r: "Pixel art" },
    { i: "star", t: "Anime", s: "Style japonais", tags: { [T.anime]: 1, [T.jrpg]: .6 }, r: "Style anime" },
    { i: "dice", t: "Peu importe", s: "" } ] },
  { key: "fight", eyebrow: "Combat", title: "Comment tu aimes te battre ?", imp: 1, choices: [
    { i: "swords", t: "Au corps à corps", s: "Épées, poings, combos", tags: { [T.hackslash]: 1, [T.combat]: .5, [T.soulslike]: .5 }, r: "Combat au corps à corps" },
    { i: "crosshair", t: "Au tir", s: "Armes à feu", tags: { [T.shooter]: 1, [T.tps]: .8, [T.fps]: .8 }, r: "Des fusillades" },
    { i: "eyeoff", t: "En infiltration", s: "Furtif, sans être vu", tags: { [T.stealth]: 1, [T.immersive]: .5 }, r: "Infiltration" },
    { i: "brain", t: "Au tour par tour", s: "Tactique, réfléchi", tags: { [T.turnbased]: 1, [T.turncombat]: 1, [T.jrpg]: .5 }, r: "Combat tactique" },
    { i: "ban", t: "Pas de combat", s: "Juste l'aventure", tags: { [T.walking]: 1, [T.puzzle]: .6, [T.visualnovel]: .6, [T.ifiction]: .6, [T.combat]: -.6, [T.shooter]: -.6 }, r: "Sans combat" },
    { i: "dice", t: "Peu importe", s: "" } ] },
  { key: "difficulty", eyebrow: "Difficulté", title: "Quel niveau de challenge ?", imp: 1, choices: [
    { i: "coffee", t: "Facile", s: "Je veux profiter", tags: { [T.difficult]: -1, [T.soulslike]: -1, [T.roguelike]: -.5 }, r: "Accessible" },
    { i: "scale", t: "Équilibré", s: "Un peu de résistance", tags: { [T.soulslike]: -.6, [T.difficult]: -.4 }, r: "Difficulté équilibrée" },
    { i: "skull", t: "Difficile", s: "Je veux souffrir", tags: { [T.difficult]: 1, [T.soulslike]: 1, [T.roguelike]: .5 }, r: "Vraiment exigeant" } ] },
  { key: "freedom", eyebrow: "Liberté", title: "Monde ouvert ou aventure guidée ?", imp: .9, choices: [
    { i: "map", t: "Monde ouvert", s: "Je vais où je veux", tags: { [T.openworld]: 1, [T.exploration]: .5 }, r: "Monde ouvert" },
    { i: "arrow", t: "Aventure guidée", s: "Linéaire, bien rythmée", tags: { [T.linear]: 1, [T.cinematic]: .5, [T.openworld]: -.6 }, r: "Aventure bien rythmée" },
    { i: "dice", t: "Peu importe", s: "" } ] },
  { key: "choices", eyebrow: "Narration", title: "Tes choix doivent-ils changer l'histoire ?", imp: .7, choices: [
    { i: "branch", t: "Oui, absolument", s: "Plusieurs fins", tags: { [T.choices]: 1, [T.endings]: 1, [T.cyoa]: .6 }, r: "Tes choix comptent" },
    { i: "book", t: "Non", s: "Une histoire écrite", tags: { [T.choices]: -.3 } },
    { i: "dice", t: "Peu importe", s: "" } ] },
  { key: "rpg", eyebrow: "Progression", title: "Monter de niveau, looter, optimiser ?", imp: .7, choices: [
    { i: "trend", t: "J'adore", s: "XP, arbres de compétences", tags: { [T.rpg]: 1, [T.arpg]: 1, [T.loot]: .7, [T.custom]: .4 }, r: "Progression RPG" },
    { i: "scale", t: "Un peu", s: "Sans que ça prenne le dessus", tags: { [T.actionadv]: .8, [T.rpg]: .3 } },
    { i: "ban", t: "Pas du tout", s: "Je veux juste jouer", tags: { [T.rpg]: -.8, [T.loot]: -.6, [T.arpg]: -.6 }, r: "Sans gestion RPG" } ] },
  { key: "cine", eyebrow: "Mise en scène", title: "Cinématiques et dialogues ?", imp: .7, choices: [
    { i: "film", t: "J'adore", s: "Comme un film", tags: { [T.cinematic]: 1, [T.story]: .6, [T.lore]: .4 }, r: "Très cinématographique" },
    { i: "gamepad", t: "Le moins possible", s: "Du gameplay avant tout", tags: { [T.arcade]: 1, [T.roguelike]: .6, [T.cinematic]: -.6, [T.story]: -.3 }, r: "Gameplay avant tout" },
    { i: "dice", t: "Peu importe", s: "" } ] },
  { key: "fear", eyebrow: "Peur", title: "Ta tolérance à l'horreur ?", imp: 1.1, choices: [
    { i: "ban", t: "Aucune", s: "Pas d'horreur, merci", tags: { [T.horror]: -1, [T.survivalhorror]: -1, [T.psycho]: -.6, [T.gore]: -.5 } },
    { i: "eye", t: "Un peu", s: "Un peu de tension, ça va", tags: { [T.survivalhorror]: -.4, [T.psycho]: -.3 } },
    { i: "ghost", t: "À fond", s: "Plus c'est flippant…", tags: { [T.horror]: 1, [T.survivalhorror]: 1, [T.psycho]: .8 }, r: "Vraiment flippant" } ] },
  { key: "puzzle", eyebrow: "Réflexion", title: "Des énigmes à résoudre ?", imp: .6, choices: [
    { i: "blocks", t: "Oui, j'aime réfléchir", s: "Énigmes, enquêtes", tags: { [T.puzzle]: 1, [T.mystery]: .7, [T.detective]: .7 }, r: "Des énigmes" },
    { i: "ban", t: "Non", s: "Ça me casse le rythme", tags: { [T.puzzle]: -.7 } },
    { i: "dice", t: "Peu importe", s: "" } ] },
  { key: "hero", eyebrow: "Héros", title: "Ton personnage, tu le préfères…", imp: .5, choices: [
    { i: "user", t: "Créé par moi", s: "Je le personnalise", tags: { [T.custom]: 1, [T.rpg]: .4 }, r: "Personnage personnalisable" },
    { i: "book", t: "Écrit par le jeu", s: "Un vrai héros, une vraie histoire", tags: { [T.story]: .6, [T.cinematic]: .5, [T.custom]: -.4 }, r: "Un héros marquant" },
    { i: "dice", t: "Peu importe", s: "" } ] },
  { key: "quality", eyebrow: "Qualité", title: "Côté avis des joueurs ?", imp: 1, choices: [
    { i: "award", t: "Que des chefs-d'œuvre", s: "90 % d'avis positifs et plus", fn: g => !g.review ? null : g.review >= 90 ? 1 : g.review >= 80 ? .45 : .1, r: g => `${g.review} % d'avis positifs` },
    { i: "star", t: "Bien notés", s: "75 % et plus", fn: g => !g.review ? null : g.review >= 75 ? 1 : .3, r: g => `${g.review} % d'avis positifs` },
    { i: "dice", t: "Peu importe", s: "Même les pépites oubliées" } ] },
  { key: "era", eyebrow: "Époque", title: "Plutôt récent ou classique ?", imp: .5, choices: [
    { i: "sparkles", t: "Récent", s: "Sorti depuis 2020", fn: g => !year(g) ? null : year(g) >= 2020 ? 1 : year(g) >= 2016 ? .5 : .1, r: g => `Sorti en ${year(g)}` },
    { i: "rotate", t: "Un classique", s: "Avant 2016", fn: g => !year(g) ? null : year(g) < 2016 ? 1 : year(g) < 2020 ? .5 : .1, r: g => `Un classique de ${year(g)}` },
    { i: "dice", t: "Peu importe", s: "" } ] },
];

/* ---------------------------------------------------------------- affinité */
function finishedIds() {
  const s = new Set(st.finished.map(f => String(f.appid)));
  for (const [id, p] of Object.entries(progress)) if (p.storyDone) s.add(id);
  return s;
}
function finishable(g) {
  const out = new Set([...finishedIds(), ...st.abandoned.map(x => String(x.appid))]);
  if (out.has(String(g.appid)) || !g.windows) return false;
  if (g.platform) return true;                                         // hors Steam : pas de métadonnées, toujours proposables
  if (!(g.cats || []).includes(2)) return false;                       // pas de solo
  if ((g.genres || []).some(x => x === 29 || x === 37)) return false;  // MMO / free-to-play
  return true;
}
// note d'un choix : 0 à 1, ou null quand le jeu n'a pas l'information (pas de tags, pas d'avis…)
function choiceFit(g, c, w, ctx) {
  if (c.fn) { const v = c.fn(g, ctx); return v === null || v === undefined ? null : clamp(v); }
  if (!hasTags(g)) return null;
  // positif : 60 % pour le tag le plus présent, 40 % pour la couverture de tous les tags du choix (évite que tout sature à 100 %)
  let best = 0, pos = 0, sum = 0, neg = 0;
  for (const [t, v] of Object.entries(c.tags)) {
    if (v > 0) { const x = (w[t] || 0) * v; best = Math.max(best, x); pos += x; sum += v; } else neg += (w[t] || 0) * -v;
  }
  return sum ? clamp(.6 * best + .4 * pos / sum) * (1 - clamp(neg)) : 1 - clamp(neg);
}
// objectif de durée : semaines nécessaires à ton rythme, comparées au délai souhaité
function lengthChoice(c) {
  return { ...c, fn: (g, ctx) => {
    if (!durationKnown(g)) return null;
    const weekly = ctx.rhythm?.v || 7, weeks = hoursLeft(g) / weekly;
    return weeks <= c.v ? 1 : clamp(1 - (weeks - c.v) / (c.v * 1.5));
  }, r: (g, ctx) => { const wk = hoursLeft(g) / (ctx.rhythm?.v || 7); return wk < 1 ? "Fini en moins d'une semaine à ton rythme" : `Fini en ≈ ${Math.round(wk)} semaine${Math.round(wk) > 1 ? "s" : ""} à ton rythme`; } };
}

/* ---------------------------------------------------------------- réponses supplémentaires (retours des joueurs : choix trop limités)
   Insérées avant la réponse neutre (« Peu importe »). Tags Steam supplémentaires ci-dessous. */
Object.assign(T, {
  strategy: 9, simulation: 599, building: 1643, crafting: 1702, management: 12472, basebuilding: 7332, citybuilder: 4328, colonysim: 220585,
  racing: 699, driving: 1644, sports: 701, fighting: 1743, beatemup: 4158, rhythmgame: 1752, sandbox: 3810, sidescroller: 3798,
  femaleprotag: 7208, partyrpg: 10695, tacticalrpg: 21725, crpg: 4474, pointclick: 1698, puzzleplatformer: 5537, philosophical: 15277,
  surreal: 1710, lovecraftian: 7432, mythology: 16094, steampunk: 1777, crime: 6378, noir: 6052, minimalist: 4094, retro: 4004,
  cartoon: 4562, narration: 5094, romance: 4947, comedy2: 1719, tactical: 1708, gore2: 4345, supernatural: 6730, nature: 30358,
});
const MORE = {
  crave: [
    { i: "user", t: "Les personnages", s: "M'attacher à eux", tags: { [T.story]: .7, [T.emotional]: .7, [T.choices]: .5, [T.romance]: .4 }, r: "Des personnages marquants" },
    { i: "blocks", t: "Construire et gérer", s: "Bâtir, optimiser, voir grandir", tags: { [T.building]: 1, [T.management]: 1, [T.basebuilding]: .8, [T.citybuilder]: 1, [T.colonysim]: 1, [T.crafting]: .5 }, r: "Construire et gérer" },
    { i: "brain", t: "Réfléchir", s: "Énigmes et déductions", tags: { [T.puzzle]: 1, [T.detective]: .8, [T.mystery]: .6, [T.pointclick]: .6 }, r: "De quoi réfléchir" },
    { i: "scale", t: "La tactique", s: "Prendre le temps de planifier", tags: { [T.turnbased]: 1, [T.turncombat]: 1, [T.strategy]: .8, [T.tactical]: .8, [T.tacticalrpg]: .8 }, r: "De la tactique" },
    { i: "zap", t: "La vitesse", s: "Sensations et réflexes", tags: { [T.racing]: 1, [T.driving]: .8, [T.arcade]: .6, [T.rhythmgame]: .6, [T.sports]: .5 }, r: "Des sensations fortes" },
  ],
  drop: [
    { i: "swords", t: "Les combats me fatiguaient", s: "Trop d'affrontements", tags: { [T.combat]: -1, [T.hackslash]: -.8, [T.shooter]: -.6, [T.soulslike]: -.8 }, r: "Peu de combats" },
    { i: "pause", t: "J'ai décroché après une pause", s: "Difficile de s'y remettre", tags: { [T.linear]: 1, [T.short]: .7, [T.story]: .3 }, r: "Facile à reprendre" },
    { i: "eye", t: "C'était trop dur à regarder", s: "Trop sombre, trop violent", tags: { [T.horror]: -1, [T.gore]: -1, [T.dark]: -.5, [T.psycho]: -.6 }, r: "Rien de trop dur" },
    { i: "gear", t: "Trop compliqué à prendre en main", s: "Trop de systèmes, de menus", tags: { [T.strategy]: -.7, [T.management]: -.7, [T.simulation]: -.5, [T.crpg]: -.5, [T.difficult]: -.5 }, r: "Facile à prendre en main" },
  ],
  progress: [
    { i: "flag", t: "Un jeu presque fini", s: "Plus de la moitié faite", fn: g => played(g) ? clamp((g.playtime || 0) / 60 / estimateHours(g) * 1.6 - .2) : 0, r: g => `Déjà ${fmtH(g.playtime)} sur ≈ ${estimateHours(g)} h` },
    { i: "hourglass", t: "Un jeu oublié depuis longtemps", s: "Commencé il y a des mois", fn: g => !played(g) ? 0 : !g.lastPlayed ? .5 : (Date.now() / 1000 - g.lastPlayed) > 180 * 86400 ? 1 : .3, r: "Un jeu à redécouvrir" },
  ],
  saga: [
    { i: "flag", t: "Commencer une saga par son épisode 1", s: "Pour enchaîner ensuite", fn: g => { const s = seriesInfo(g.name); return s && s.n === 1 && lib.some(x => x !== g && seriesInfo(x.name)?.key === s.key) ? 1 : .2; }, r: "Premier épisode d'une saga" },
  ],
  platform: [
    { i: "steam", t: "Sur Steam", s: "Ma bibliothèque Steam", fn: g => !g.platform ? 1 : 0, r: "Sur Steam" },
    { i: "layers", t: "Sur Epic, GOG ou Ubisoft", s: "Mes autres launchers", fn: g => ["epic", "gog", "ubisoft", "amazon", "manual"].includes(g.platform) ? 1 : 0, r: g => `Sur ${platShort(g)}` },
    { i: "gamepad", t: "Sur Switch", s: "En émulation", fn: g => g.platform === "emu" && /switch/i.test(g.system || "") ? 1 : 0, r: "Sur Switch" },
  ],
  energy: [
    { i: "moon", t: "Tout doux", s: "Contemplatif, sans pression", fn: g => intensity(g) === null ? null : 1 - Math.abs(intensity(g) - .05), r: "Tout en douceur" },
    { i: "flame", t: "Explosif", s: "À fond, tout le temps", fn: g => intensity(g) === null ? null : clamp(intensity(g) * 1.2 - .1), r: "Explosif" },
  ],
  tone: [
    { i: "smile", t: "Drôle et légère", s: "Bonne humeur", tags: { [T.funny]: 1, [T.comedy]: 1, [T.colorful]: .5, [T.cute]: .4 }, r: "Ambiance légère" },
    { i: "heart", t: "Mélancolique et poétique", s: "Douce-amère", tags: { [T.emotional]: .8, [T.atmospheric]: .8, [T.beautiful]: .5, [T.philosophical]: .6 }, r: "Ambiance poétique" },
    { i: "search", t: "Mystérieuse", s: "Secrets et étrangeté", tags: { [T.mystery]: 1, [T.surreal]: .7, [T.lovecraftian]: .6, [T.atmospheric]: .5 }, r: "Ambiance mystérieuse" },
    { i: "mountain", t: "Épique", s: "Grand spectacle", tags: { [T.fantasy]: .5, [T.openworld]: .5, [T.soundtrack]: .6, [T.cinematic]: .6, [T.actionadv]: .5 }, r: "Ambiance épique" },
  ],
  feel: [
    { i: "skull", t: "Me dépasser", s: "La fierté de réussir", tags: { [T.difficult]: 1, [T.soulslike]: .8, [T.roguelike]: .5 }, r: "Un vrai défi" },
    { i: "sparkles", t: "Être surpris", s: "Des idées inattendues", tags: { [T.surreal]: 1, [T.psychological]: .7, [T.choices]: .4 }, r: "Des surprises" },
    { i: "brain", t: "Réfléchir sur la vie", s: "Un jeu qui fait penser", tags: { [T.philosophical]: 1, [T.psychological]: .6, [T.story]: .4 }, r: "Un jeu qui fait réfléchir" },
  ],
  view: [
    { i: "grid", t: "Isométrique", s: "Vue en diagonale, façon RPG", tags: { [T.isometric]: 1, [T.crpg]: .5 }, r: "Vue isométrique" },
    { i: "arrow", t: "Défilement horizontal", s: "Plateforme, 2D de profil", tags: { [T.sidescroller]: 1, [T.platformer]: .7, [T.twod]: .5, [T.metroidvania]: .5 }, r: "En 2D de profil" },
  ],
  world: [
    { i: "landmark", t: "Mythologie", s: "Dieux et légendes", tags: { [T.mythology]: 1, [T.fantasy]: .4 }, r: "Univers mythologique" },
    { i: "gear", t: "Steampunk", s: "Vapeur et engrenages", tags: { [T.steampunk]: 1 }, r: "Univers steampunk" },
    { i: "eyeoff", t: "Polar et crime", s: "Enquêtes, mafia, rue", tags: { [T.crime]: 1, [T.noir]: .8, [T.detective]: .6 }, r: "Polar et crime" },
  ],
  art: [
    { i: "smile", t: "Dessin animé", s: "Cartoon, couleurs vives", tags: { [T.cartoon]: 1, [T.cartoony]: 1, [T.cute]: .5, [T.colorful]: .5 }, r: "Style dessin animé" },
    { i: "blocks", t: "Minimaliste", s: "Épuré, peu de détails", tags: { [T.minimalist]: 1 }, r: "Style épuré" },
    { i: "rotate", t: "Rétro", s: "Comme dans les années 90", tags: { [T.retro]: 1, [T.pixel]: .5 }, r: "Style rétro" },
  ],
  fight: [
    { i: "wand", t: "Avec de la magie", s: "Sorts et pouvoirs", tags: { [T.magic]: 1, [T.superhero]: .4, [T.fantasy]: .3 }, r: "Combat magique" },
    { i: "zap", t: "À mains nues", s: "Combos, baston", tags: { [T.fighting]: 1, [T.beatemup]: 1 }, r: "Combat à mains nues" },
  ],
  difficulty: [
    { i: "leaf", t: "Très facile", s: "Juste profiter de l'histoire", tags: { [T.casual]: 1, [T.relaxing]: .6, [T.difficult]: -1, [T.soulslike]: -1 }, r: "Très accessible" },
    { i: "gear", t: "Je veux pouvoir la régler", s: "Choisir ma difficulté", fn: g => (g.cats || []).includes(78) ? 1 : (g.cats || []).length ? .35 : null, r: "Difficulté réglable" },
  ],
  freedom: [
    { i: "map", t: "Semi-ouvert", s: "Des zones à explorer, un fil conducteur", tags: { [T.exploration]: .8, [T.metroidvania]: .7, [T.actionadv]: .5 }, r: "Zones à explorer" },
    { i: "blocks", t: "Bac à sable", s: "Je crée mes propres objectifs", tags: { [T.sandbox]: 1, [T.crafting]: .6, [T.openworld]: .4 }, r: "Bac à sable" },
  ],
  choices: [
    { i: "branch", t: "Un peu", s: "Quelques choix qui comptent", tags: { [T.choices]: .6, [T.story]: .5 }, r: "Quelques choix" },
  ],
  rpg: [
    { i: "user", t: "Gérer une équipe", s: "Un groupe de héros", tags: { [T.partyrpg]: 1, [T.tacticalrpg]: .8, [T.crpg]: .7 }, r: "Une équipe à gérer" },
    { i: "gear", t: "Fabriquer mon équipement", s: "Artisanat, améliorations", tags: { [T.crafting]: 1, [T.loot]: .5 }, r: "De l'artisanat" },
  ],
  cine: [
    { i: "scale", t: "Bien dosé", s: "Un équilibre entre les deux", tags: { [T.story]: .6, [T.actionadv]: .6 }, r: "Bien rythmé" },
    { i: "map", t: "Raconté par le décor", s: "Peu de mots, beaucoup d'ambiance", tags: { [T.atmospheric]: 1, [T.lore]: .6, [T.walking]: .4 }, r: "Une histoire racontée par le décor" },
  ],
  fear: [
    { i: "moon", t: "De l'angoisse, pas de gore", s: "Tension psychologique", tags: { [T.psychological]: .8, [T.thriller]: .8, [T.gore]: -1 }, r: "Tension sans gore" },
    { i: "skull", t: "Le gore ne me dérange pas", s: "Même violent", tags: { [T.gore]: 1, [T.horror]: .5 }, r: "Âmes sensibles s'abstenir" },
  ],
  puzzle: [
    { i: "search", t: "Des enquêtes", s: "Indices et déductions", tags: { [T.detective]: 1, [T.mystery]: .8, [T.pointclick]: .5 }, r: "Des enquêtes" },
    { i: "blocks", t: "Un peu, pour varier", s: "Sans que ça bloque", tags: { [T.puzzle]: .4, [T.adventure]: .5, [T.puzzleplatformer]: .5 } },
  ],
  hero: [
    { i: "heart", t: "Une héroïne", s: "Une femme comme personnage principal", tags: { [T.femaleprotag]: 1 }, r: "Une héroïne" },
    { i: "layers", t: "Toute une équipe", s: "Plusieurs personnages", tags: { [T.partyrpg]: 1, [T.story]: .3 }, r: "Une équipe de héros" },
  ],
  quality: [
    { i: "trophy", t: "Acclamés par la presse", s: "Metacritic 85 et plus", fn: g => !g.metacritic ? null : g.metacritic >= 85 ? 1 : g.metacritic >= 75 ? .5 : .15, r: g => `Metacritic ${g.metacritic}` },
  ],
  era: [
    { i: "zap", t: "Tout récent", s: "Sorti depuis 2023", fn: g => !year(g) ? null : year(g) >= 2023 ? 1 : year(g) >= 2020 ? .4 : .05, r: g => `Sorti en ${year(g)}` },
    { i: "calendar", t: "Années 2000", s: "Les classiques d'une époque", fn: g => !year(g) ? null : year(g) >= 2000 && year(g) < 2010 ? 1 : .15, r: g => `Sorti en ${year(g)}` },
    { i: "pixel", t: "Rétro", s: "Avant 2000", fn: g => !year(g) ? null : year(g) < 2000 ? 1 : .05, r: g => `Un rétro de ${year(g)}` },
  ],
};
for (const q of QUESTIONS) {
  const extra = MORE[q.key]; if (!extra) continue;
  // place avant la réponse neutre (« Peu importe », « Rien, je finis tout »), sinon à la fin
  const n = q.choices.findIndex(c => !c.fn && !c.tags && !c.v);
  if (n < 0) q.choices.push(...extra); else q.choices.splice(n, 0, ...extra);
}
// rythme et objectif : nouvelles valeurs rangées dans l'ordre
QUESTIONS.find(q => q.key === "rhythm").choices = [
  { i: "moon", t: "Environ 1 h", s: "Très peu de temps", v: 1 },
  { i: "clock", t: "Environ 3 h", s: "Quelques sessions courtes", v: 3 },
  { i: "hourglass", t: "Environ 7 h", s: "Une heure par jour", v: 7 },
  { i: "coffee", t: "Environ 10 h", s: "Un peu chaque soir, plus le week-end", v: 10 },
  { i: "calendar", t: "Environ 14 h", s: "Deux heures par jour", v: 14 },
  { i: "flame", t: "Plus de 20 h", s: "Je joue beaucoup", v: 25 },
];
QUESTIONS.find(q => q.key === "length").choices = [
  { i: "zap", t: "Un week-end", s: "Une aventure express", v: .4 },
  { i: "flag", t: "Une semaine", s: "Bouclé en quelques soirées", v: 1 },
  { i: "flag", t: "Moins de 2 semaines", s: "Une aventure vite bouclée", v: 2 },
  { i: "calendar", t: "Environ un mois", s: "Sans me presser", v: 4 },
  { i: "mountain", t: "Deux ou trois mois", s: "Une grande épopée", v: 10 },
  { i: "infinity", t: "Plus de trois mois", s: "J'ai tout mon temps", v: 20 },
  { i: "dice", t: "Peu importe", s: "" },
];
QUESTIONS.find(q => q.key === "length").choices = QUESTIONS.find(q => q.key === "length").choices.map(c => c.v ? lengthChoice(c) : c);

// pourcentage = moyenne pondérée des notes des questions répondues ; information inconnue = note neutre (50 %)
function affinity(g, answers) {
  const w = tagWeight(g), ctx = {};
  QUESTIONS.forEach((q, qi) => { const c = q.choices[answers[qi]]; if (c) ctx[q.key] = c; });
  let num = 0, den = 0; const why = [], detail = [];
  QUESTIONS.forEach((q, qi) => {
    const c = q.choices[answers[qi]];
    if (!c || !q.imp || (!c.fn && !c.tags)) return;
    const f = choiceFit(g, c, w, ctx);
    num += q.imp * (f === null ? .5 : f); den += q.imp;
    detail.push({ k: q.eyebrow, t: c.t, f, imp: q.imp });
    if (f !== null && c.r && f >= .6) why.push({ s: q.imp * f, r: typeof c.r === "function" ? c.r(g, ctx) : c.r });
  });
  const pct = den ? Math.round(clamp(num / den) * 100) : 50;
  const s = seriesInfo(g.name);
  if (s && s.n === 1 && lib.some(x => x !== g && seriesInfo(x.name)?.key === s.key && seriesInfo(x.name).n > 1)) why.unshift({ s: 99, r: "Premier épisode de la saga" });
  return { g, pct, detail, why: [...new Set(why.sort((a, b) => b.s - a.s).map(x => x.r))].slice(0, 4) };
}

/* ---------------------------------------------------------------- journal de la quête + prédiction de fin */
function journal(c, g) {
  const h = [...(c.history || [])];
  const nowPt = Math.max(g?.playtime || 0, h.at(-1)?.pt || 0);
  if (h.length && nowPt > h.at(-1).pt) h.push({ d: dayKey(new Date()), pt: nowPt });
  const daily = {};
  for (let i = 1; i < h.length; i++) daily[h[i].d] = (daily[h[i].d] || 0) + Math.max(0, h[i].pt - h[i - 1].pt);
  const days = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push({ d, key: dayKey(d), min: daily[dayKey(d)] || 0 }); }
  const total = Math.max(0, nowPt - (c.startPlaytime || 0));
  const playedDays = Object.keys(daily).filter(k => daily[k] > 0).length;
  // rythme : minutes par jour. Quête récente : depuis le début (3 jours minimum pour ne pas s'emballer
  // après une première grosse session). Quête plus ancienne : les 14 derniers jours, pour suivre ton rythme actuel.
  const span = Math.max(1, (Date.now() - new Date(c.since)) / 86400000);
  const last14 = days.reduce((s, d) => s + d.min, 0);
  const pace = span > 14 ? last14 / 14 : total / Math.max(3, span);
  const estH = c.estHours || estimateHours(g);
  const est = estH * 60, remaining = Math.max(0, est - nowPt);
  const eta = pace >= 5 && remaining > 0 ? new Date(Date.now() + remaining / pace * 86400000) : null;
  return { days, streak: streakOf(new Set(Object.keys(daily).filter(k => daily[k] > 0))), total, avg: playedDays ? total / playedDays : 0,
    est, estH, custom: !!c.estHours, remaining, eta, nowPt, pace, weekly: pace * 7 };
}
function streakOf(daySet) {
  let n = 0; const d = new Date();
  if (!daySet.has(dayKey(d))) d.setDate(d.getDate() - 1);
  while (daySet.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function maxStreak(daySet) {
  const days = [...daySet].sort(); let best = 0, cur = 0, prev = null;
  for (const k of days) { const d = new Date(k); cur = prev && (d - prev) / 86400000 <= 1.01 ? cur + 1 : 1; best = Math.max(best, cur); prev = d; }
  return best;
}

/* ---------------------------------------------------------------- statistiques globales (journal + Steam) */
function playDays() {
  const s = new Set(Object.entries(playlog).filter(([, v]) => Object.values(v).some(m => m > 0)).map(([k]) => k));
  for (const f of [st.current, ...st.finished]) if (f?.history) for (let i = 1; i < f.history.length; i++) if (f.history[i].pt > f.history[i - 1].pt) s.add(f.history[i].d);
  return s;
}
function minutesIn(prefix) { let m = 0; for (const [k, v] of Object.entries(playlog)) if (k.startsWith(prefix)) m += Object.values(v).reduce((a, b) => a + b, 0); return m; }
function stats() {
  const fin = finishedIds();
  const perfect = Object.entries(progress).filter(([id, p]) => p.perfect && byId(id)).length;
  const total = lib.reduce((s, g) => s + (g.playtime || 0), 0);
  const playable = lib.filter(g => !g.platform && (g.cats || []).includes(2)).length;
  const days = playDays();
  return { fin: [...fin].filter(id => byId(id)).length, perfect, total, playable, rate: playable ? [...fin].length / playable : 0,
    month: minutesIn(new Date().toISOString().slice(0, 7)), year: minutesIn(String(new Date().getFullYear())),
    streak: streakOf(days), best: maxStreak(days), days };
}
