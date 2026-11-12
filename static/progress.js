/* =====================================================================
   Questline — progression : XP, niveaux, rangs, badges (5 raretés), défis du mois
   Utilise les globales de app.js (lib, st) et les fonctions d'engine.js
   ===================================================================== */

/* ---------------------------------------------------------------- niveaux et rangs */
const LEVEL_K = 120;
const levelOf = xp => Math.floor(Math.sqrt(xp / LEVEL_K)) + 1;
const xpFor = lv => LEVEL_K * (lv - 1) ** 2;

// un emblème et une couleur par palier de niveaux
const RANKS = [
  { lv: 1, n: "Novice", i: "leaf", c: "#a7b0bf" },
  { lv: 3, n: "Aventurier", i: "map", c: "#5ee6a8" },
  { lv: 6, n: "Explorateur", i: "compass", c: "#5cc8ff" },
  { lv: 9, n: "Vétéran", i: "shield", c: "#9b7bff" },
  { lv: 12, n: "Héros", i: "swords", c: "#fe53bb" },
  { lv: 16, n: "Champion", i: "trophy", c: "#ff8a3d" },
  { lv: 20, n: "Maître", i: "crown", c: "#ffd36b" },
  { lv: 25, n: "Légende", i: "star", c: "#ff5c7a" },
  { lv: 30, n: "Mythe", i: "flame", c: "#ffdb3b" },
];
const rankOf = lv => [...RANKS].reverse().find(r => lv >= r.lv);
const nextRankOf = lv => RANKS.find(r => r.lv > lv);
const titleOf = lv => rankOf(lv).n;

/* ---------------------------------------------------------------- badges : 5 raretés */
const TIERS = {
  bronze:    { n: "Bronze", r: "Commun", xp: 50, stars: 1, g: ["#ffd9b0", "#cd7f3a", "#6e3a12"], glow: "#e08a46" },
  silver:    { n: "Argent", r: "Peu commun", xp: 100, stars: 2, g: ["#ffffff", "#b4bfcd", "#56606e"], glow: "#cfd8e4" },
  gold:      { n: "Or", r: "Rare", xp: 200, stars: 3, g: ["#fff6c2", "#f2b624", "#805200"], glow: "#ffc93c" },
  platinum:  { n: "Platine", r: "Épique", xp: 400, stars: 4, g: ["#f2fdff", "#73d2ff", "#5b3ee6"], glow: "#7fd8ff" },
  legendary: { n: "Légendaire", r: "Légendaire", xp: 800, stars: 5, g: ["#ffe866", "#ff4fb8", "#7b3cf0"], glow: "#ff4fb8" },
};
const TIER_ORDER = ["legendary", "platinum", "gold", "silver", "bronze"];

// cur(s) = valeur actuelle, goal = objectif, u = unité affichée
const BADGES = [
  { id: "first", tier: "bronze", i: "flag", n: "Premier générique", d: "Termine ton premier jeu.", cur: s => s.fin, goal: 1, u: "jeu terminé" },
  { id: "five", tier: "silver", i: "medal", n: "Finisseur", d: "Termine 5 jeux.", cur: s => s.fin, goal: 5, u: "jeux terminés" },
  { id: "fifteen", tier: "gold", i: "crown", n: "Légende vivante", d: "Termine 15 jeux.", cur: s => s.fin, goal: 15, u: "jeux terminés" },
  { id: "thirty", tier: "legendary", i: "flame", n: "Immortel", d: "Termine 30 jeux. Peu de joueurs y arrivent.", cur: s => s.fin, goal: 30, u: "jeux terminés" },
  { id: "perfect", tier: "gold", i: "trophy", n: "Complétionniste", d: "Débloque 100 % des succès d'un jeu.", cur: s => s.perfect, goal: 1, u: "jeu à 100 %" },
  { id: "perfect3", tier: "platinum", i: "star", n: "Chasseur de trophées", d: "3 jeux à 100 % des succès.", cur: s => s.perfect, goal: 3, u: "jeux à 100 %" },
  { id: "perfect10", tier: "legendary", i: "sparkles", n: "Perfectionniste", d: "10 jeux à 100 %. Le graal.", cur: s => s.perfect, goal: 10, u: "jeux à 100 %" },
  { id: "marathon", tier: "gold", i: "mountain", n: "Marathonien", d: "Termine un jeu avec 50 h de jeu ou plus.", cur: s => Math.floor(s.longest / 60), goal: 50, u: "h sur un jeu fini" },
  { id: "sprint", tier: "silver", i: "zap", n: "Sprinteur", d: "Termine une quête en moins de 7 jours.", cur: s => s.sprint ? 1 : 0, goal: 1, u: "quête éclair" },
  { id: "streak3", tier: "bronze", i: "flame", n: "Bonne habitude", d: "Joue 3 jours d'affilée.", cur: s => s.best, goal: 3, u: "jours d'affilée" },
  { id: "streak7", tier: "silver", i: "calendar", n: "Régulier", d: "Joue 7 jours d'affilée.", cur: s => s.best, goal: 7, u: "jours d'affilée" },
  { id: "streak30", tier: "platinum", i: "infinity", n: "Inarrêtable", d: "Joue 30 jours d'affilée.", cur: s => s.best, goal: 30, u: "jours d'affilée" },
  { id: "hours100", tier: "silver", i: "clock", n: "Centurion", d: "Cumule 100 h de jeu sur Steam.", cur: s => Math.floor(s.total / 60), goal: 100, u: "h de jeu" },
  { id: "hours500", tier: "gold", i: "gamepad", n: "Vétéran du pad", d: "Cumule 500 h de jeu sur Steam.", cur: s => Math.floor(s.total / 60), goal: 500, u: "h de jeu" },
  { id: "resist", tier: "bronze", i: "shield", n: "Volonté de fer", d: "Résiste à une tentation : un téléchargement bloqué.", cur: s => s.blocked, goal: 1, u: "tentation résistée" },
  { id: "resist10", tier: "gold", i: "lock", n: "Inébranlable", d: "10 téléchargements bloqués par le bouclier.", cur: s => s.blocked, goal: 10, u: "tentations résistées" },
  { id: "monk", tier: "platinum", i: "scale", n: "Moine-guerrier", d: "Termine une quête avec le mode strict activé.", cur: s => s.strictFin ? 1 : 0, goal: 1, u: "quête en mode strict" },
  { id: "collector", tier: "gold", i: "layers", n: "Collectionneur", d: "200 jeux dans ta bibliothèque (compte + famille).", cur: () => lib.length, goal: 200, u: "jeux" },
  { id: "buy", tier: "silver", i: "cart", n: "Achat mérité", d: "Achète un jeu avec un crédit gagné.", cur: () => (st.wishlist || []).filter(w => w.boughtAt).length, goal: 1, u: "achat" },
  { id: "recap", tier: "silver", i: "calendar", n: "Rétrospective", d: "Génère ton récap de l'année.", cur: () => st.flags?.recap ? 1 : 0, goal: 1, u: "récap" },
  { id: "clean", tier: "bronze", i: "trash", n: "Grand ménage", d: "Fais le ménage de ton disque.", cur: () => st.cleaned ? 1 : 0, goal: 1, u: "ménage" },
  { id: "scan", tier: "bronze", i: "search", n: "Archiviste", d: "Scanne tes succès Steam.", cur: () => st.flags?.scan ? 1 : 0, goal: 1, u: "scan" },
  { id: "wheel", tier: "bronze", i: "dice", n: "Main du destin", d: "Laisse la roue choisir ton jeu.", cur: () => st.flags?.wheel ? 1 : 0, goal: 1, u: "tirage" },
  { id: "card", tier: "bronze", i: "image", n: "Fier de toi", d: "Crée une carte de victoire.", cur: () => st.flags?.card ? 1 : 0, goal: 1, u: "carte" },
  { id: "queue", tier: "bronze", i: "list", n: "Stratège", d: "Planifie 3 jeux dans ta file d'attente.", cur: () => st.queue?.length || 0, goal: 3, u: "jeux en file" },
  { id: "session", tier: "bronze", i: "timer", n: "Maître du temps", d: "Lance un objectif de session.", cur: () => st.flags?.session ? 1 : 0, goal: 1, u: "session" },
  { id: "saga2", tier: "gold", i: "layers", n: "Fidèle à la saga", d: "Termine deux épisodes d'une même saga.", cur: s => s.sagaFin, goal: 2, u: "épisodes d'une saga" },
  { id: "emufin", tier: "silver", i: "gamepad", n: "Rétro-gamer", d: "Termine un jeu en émulation.", cur: s => s.emuFin, goal: 1, u: "jeu émulé fini" },
  { id: "multi", tier: "bronze", i: "grid", n: "Multi-plateforme", d: "Aie des jeux sur 3 plateformes différentes.", cur: s => s.platforms, goal: 3, u: "plateformes" },
  { id: "noquit", tier: "platinum", i: "shield", n: "Sans retraite", d: "Termine 5 quêtes sans en avoir jamais abandonné une.", cur: () => st.abandoned.length ? 0 : st.finished.length, goal: 5, u: "quêtes sans abandon" },
  { id: "comeback", tier: "gold", i: "rotate", n: "Retour gagnant", d: "Termine un jeu que tu avais abandonné.", cur: s => s.comeback, goal: 1, u: "revanche" },
  { id: "patience", tier: "silver", i: "hourglass", n: "Patience", d: "Termine une quête commencée il y a plus de 30 jours.", cur: s => s.patience ? 1 : 0, goal: 1, u: "longue quête" },
  { id: "queue5", tier: "silver", i: "list", n: "Planificateur", d: "Remplis ta file d'attente (5 jeux).", cur: () => st.queue?.length || 0, goal: 5, u: "jeux en file" },
  { id: "decor", tier: "bronze", i: "image", n: "Décorateur", d: "Choisis un autre décor de fond dans Paramètres > Apparence.", cur: () => st.settings?.scene && st.settings.scene !== "nuit" ? 1 : 0, goal: 1, u: "décor" },
  { id: "bigday", tier: "silver", i: "timer", n: "Journée marathon", d: "Joue 6 h dans la même journée.", cur: s => Math.floor(s.bigDay / 60), goal: 6, u: "h en un jour" },
  { id: "weekend", tier: "bronze", i: "sunrise", n: "Week-end gamer", d: "Joue le samedi et le dimanche d'un même week-end.", cur: s => s.fullWeekend ? 1 : 0, goal: 1, u: "week-end complet" },
  { id: "hours1000", tier: "platinum", i: "clock", n: "Millénaire", d: "Cumule 1 000 h de jeu.", cur: s => Math.floor(s.total / 60), goal: 1000, u: "h de jeu" },
  { id: "lib500", tier: "platinum", i: "layers", n: "Archiviste en chef", d: "500 jeux dans ta bibliothèque.", cur: () => lib.length, goal: 500, u: "jeux" },
  { id: "ach1000", tier: "gold", i: "trophy", n: "Mille succès", d: "Débloque 1 000 succès au total dans tes jeux.", cur: s => s.achTotal, goal: 1000, u: "succès" },
  { id: "credits", tier: "bronze", i: "heart", n: "Reconnaissant", d: "Découvre les créateurs dans la page Crédits.", cur: () => st.flags?.credits ? 1 : 0, goal: 1, u: "visite" },
  { id: "notes", tier: "bronze", i: "info", n: "Toujours à jour", d: "Lis les notes de version.", cur: () => st.flags?.notes ? 1 : 0, goal: 1, u: "lecture" },
  // ---- 2.16 : 43 badges de plus, du plus simple au plus exigeant
  { id: "fin3", tier: "bronze", i: "flag", n: "Trilogie personnelle", d: "Termine 3 jeux.", cur: s => s.fin, goal: 3, u: "jeux terminés" },
  { id: "fin10", tier: "gold", i: "medal", n: "Dizaine dorée", d: "Termine 10 jeux.", cur: s => s.fin, goal: 10, u: "jeux terminés" },
  { id: "fin50", tier: "legendary", i: "landmark", n: "Panthéon", d: "Termine 50 jeux. Une vie de joueur accomplie.", cur: s => s.fin, goal: 50, u: "jeux terminés" },
  { id: "perfect5", tier: "platinum", i: "trophy", n: "Vitrine de platine", d: "5 jeux à 100 % des succès.", cur: s => s.perfect, goal: 5, u: "jeux à 100 %" },
  { id: "perfect20", tier: "legendary", i: "crown", n: "Roi des succès", d: "20 jeux à 100 %. Presque personne n'y arrive.", cur: s => s.perfect, goal: 20, u: "jeux à 100 %" },
  { id: "story5", tier: "silver", i: "book", n: "Conteur", d: "Atteins la fin de l'histoire de 5 jeux.", cur: s => s.storyDone, goal: 5, u: "histoires finies" },
  { id: "story15", tier: "gold", i: "book", n: "Grand lecteur", d: "Atteins la fin de l'histoire de 15 jeux.", cur: s => s.storyDone, goal: 15, u: "histoires finies" },
  { id: "near100", tier: "silver", i: "target", n: "Si près du but", d: "Aie 3 jeux à 90 % de leurs succès ou plus (sans être à 100 %).", cur: s => s.nearPerfect, goal: 3, u: "jeux à 90 %+" },
  { id: "hours10", tier: "bronze", i: "clock", n: "Échauffement", d: "Cumule 10 h de jeu.", cur: s => Math.floor(s.total / 60), goal: 10, u: "h de jeu" },
  { id: "hours250", tier: "silver", i: "clock", n: "Quart de millier", d: "Cumule 250 h de jeu.", cur: s => Math.floor(s.total / 60), goal: 250, u: "h de jeu" },
  { id: "hours2000", tier: "legendary", i: "infinity", n: "Vie parallèle", d: "Cumule 2 000 h de jeu.", cur: s => Math.floor(s.total / 60), goal: 2000, u: "h de jeu" },
  { id: "top100", tier: "gold", i: "heart", n: "Obsession", d: "Passe 100 h sur un seul jeu.", cur: s => Math.floor(s.topGame / 60), goal: 100, u: "h sur un jeu" },
  { id: "top300", tier: "platinum", i: "flame", n: "Âme liée", d: "Passe 300 h sur un seul jeu.", cur: s => Math.floor(s.topGame / 60), goal: 300, u: "h sur un jeu" },
  { id: "streak14", tier: "gold", i: "calendar", n: "Quinzaine de fer", d: "Joue 14 jours d'affilée.", cur: s => s.best, goal: 14, u: "jours d'affilée" },
  { id: "streak60", tier: "legendary", i: "sunrise", n: "Rituel sacré", d: "Joue 60 jours d'affilée.", cur: s => s.best, goal: 60, u: "jours d'affilée" },
  { id: "days30", tier: "silver", i: "calendar", n: "Habitué", d: "Joue 30 jours différents.", cur: s => s.daysPlayed, goal: 30, u: "jours de jeu" },
  { id: "days100", tier: "gold", i: "calendar", n: "Centenaire", d: "Joue 100 jours différents.", cur: s => s.daysPlayed, goal: 100, u: "jours de jeu" },
  { id: "days365", tier: "legendary", i: "star", n: "Une année de jeu", d: "Joue 365 jours différents.", cur: s => s.daysPlayed, goal: 365, u: "jours de jeu" },
  { id: "months6", tier: "silver", i: "hourglass", n: "Semestre", d: "Joue pendant 6 mois différents.", cur: s => s.months, goal: 6, u: "mois actifs" },
  { id: "months12", tier: "gold", i: "hourglass", n: "Tour du calendrier", d: "Joue pendant 12 mois différents.", cur: s => s.months, goal: 12, u: "mois actifs" },
  { id: "weekend20", tier: "silver", i: "coffee", n: "Pilier du week-end", d: "Joue 20 jours de week-end.", cur: s => s.weekendDays, goal: 20, u: "jours de week-end" },
  { id: "bigday10", tier: "gold", i: "moon", n: "Nuit blanche", d: "Joue 10 h dans la même journée.", cur: s => Math.floor(s.bigDay / 60), goal: 10, u: "h en un jour" },
  { id: "ach100", tier: "bronze", i: "check", n: "Cent succès", d: "Débloque 100 succès au total.", cur: s => s.achTotal, goal: 100, u: "succès" },
  { id: "ach500", tier: "silver", i: "award", n: "Chasseur aguerri", d: "Débloque 500 succès au total.", cur: s => s.achTotal, goal: 500, u: "succès" },
  { id: "ach2500", tier: "platinum", i: "sparkles", n: "Encyclopédie vivante", d: "Débloque 2 500 succès au total.", cur: s => s.achTotal, goal: 2500, u: "succès" },
  { id: "launch50", tier: "silver", i: "play", n: "Curieux de nature", d: "Lance 50 jeux différents.", cur: s => s.launched, goal: 50, u: "jeux lancés" },
  { id: "launch150", tier: "gold", i: "compass", n: "Touche-à-tout", d: "Lance 150 jeux différents.", cur: s => s.launched, goal: 150, u: "jeux lancés" },
  { id: "lib1000", tier: "legendary", i: "landmark", n: "Bibliothèque d'Alexandrie", d: "1 000 jeux dans ta bibliothèque.", cur: () => lib.length, goal: 1000, u: "jeux" },
  { id: "emu5", tier: "silver", i: "pixel", n: "Musée vivant", d: "Lance 5 jeux en émulation.", cur: s => s.emuPlayed, goal: 5, u: "jeux émulés lancés" },
  { id: "emufin3", tier: "gold", i: "pixel", n: "Cartouche dorée", d: "Termine 3 jeux en émulation.", cur: s => s.emuFin, goal: 3, u: "jeux émulés finis" },
  { id: "plat5", tier: "gold", i: "map", n: "Nomade", d: "Aie des jeux sur 5 plateformes différentes.", cur: s => s.platforms, goal: 5, u: "plateformes" },
  { id: "saga3", tier: "platinum", i: "layers", n: "Saga complète", d: "Termine trois épisodes d'une même saga.", cur: s => s.sagaFin, goal: 3, u: "épisodes d'une saga" },
  { id: "resist25", tier: "platinum", i: "shield", n: "Forteresse", d: "25 téléchargements bloqués par le bouclier.", cur: s => s.blocked, goal: 25, u: "tentations résistées" },
  { id: "phoenix", tier: "platinum", i: "rotate", n: "Phénix", d: "Termine 3 jeux que tu avais abandonnés.", cur: s => s.comeback, goal: 3, u: "revanches" },
  { id: "sprint3", tier: "gold", i: "zap", n: "Foudre", d: "Termine 3 quêtes en moins de 7 jours chacune.", cur: s => s.sprints, goal: 3, u: "quêtes éclair" },
  { id: "monthfin3", tier: "platinum", i: "rocket", n: "Mois de feu", d: "Termine 3 quêtes dans le même mois.", cur: s => s.monthFinMax, goal: 3, u: "quêtes en un mois" },
  { id: "short3", tier: "silver", i: "timer", n: "Petites bouchées", d: "Termine 3 jeux courts (8 h ou moins).", cur: s => s.shortFin, goal: 3, u: "jeux courts finis" },
  { id: "long3", tier: "gold", i: "mountain", n: "Épopées", d: "Termine 3 longs jeux (40 h ou plus).", cur: s => s.longFin, goal: 3, u: "longs jeux finis" },
  { id: "mc90", tier: "gold", i: "star", n: "Chef-d'œuvre", d: "Termine un jeu noté 90 ou plus sur Metacritic.", cur: s => s.mc90, goal: 1, u: "chef-d'œuvre fini" },
  { id: "mclow", tier: "silver", i: "smile", n: "Avis indépendant", d: "Termine un jeu noté moins de 70 sur Metacritic.", cur: s => s.mcLow, goal: 1, u: "jeu boudé fini" },
  { id: "buy5", tier: "gold", i: "cart", n: "Acheteur raisonné", d: "Achète 5 jeux avec des crédits gagnés.", cur: s => s.buys, goal: 5, u: "achats mérités" },
  { id: "wish10", tier: "bronze", i: "heart", n: "Rêveur", d: "Ajoute 10 jeux à ta liste de souhaits.", cur: s => s.wishCount, goal: 10, u: "envies" },
  { id: "queue10", tier: "gold", i: "list", n: "Grand stratège", d: "Planifie 10 jeux dans ta file d'attente.", cur: s => s.queueLen, goal: 10, u: "jeux en file" },
];

/* ---------------------------------------------------------------- défis du mois : 3 tirés du pool, fixes pour un mois donné */
const CHALLENGES = [
  { id: "c_finish", i: "flag", n: "Termine une quête", xp: 400, cur: m => m.finished, goal: 1, u: "quête" },
  { id: "c_hours", i: "clock", n: "Joue 10 h ce mois-ci", xp: 250, cur: m => Math.floor(m.minutes / 60), goal: 10, u: "h" },
  { id: "c_streak", i: "flame", n: "Joue 5 jours d'affilée", xp: 300, cur: m => m.streak, goal: 5, u: "jours" },
  { id: "c_days", i: "calendar", n: "Joue 12 jours dans le mois", xp: 300, cur: m => m.days, goal: 12, u: "jours" },
  { id: "c_short", i: "zap", n: "Termine un jeu de 15 h ou moins", xp: 350, cur: m => m.short ? 1 : 0, goal: 1, u: "jeu court" },
  { id: "c_resist", i: "shield", n: "Résiste à une tentation", xp: 150, cur: m => m.blocked, goal: 1, u: "tentation" },
  { id: "c_queue", i: "list", n: "Prépare ta file (2 jeux)", xp: 100, cur: () => st.queue?.length || 0, goal: 2, u: "jeux" },
];
function monthChallenges() {
  const now = new Date(), seed = now.getFullYear() * 12 + now.getMonth();
  const pool = [...CHALLENGES]; const out = [];
  let x = seed;
  while (out.length < 3) { x = (x * 9301 + 49297) % 233280; out.push(pool.splice(x % pool.length, 1)[0]); }
  const ym = now.toISOString().slice(0, 7);
  const finMonth = st.finished.filter(f => (f.at || "").startsWith(ym));
  const daysMonth = new Set([...playDays()].filter(k => k.startsWith(ym)));
  const m = {
    finished: finMonth.length, minutes: minutesIn(ym), days: daysMonth.size, streak: maxStreak(daysMonth),
    short: finMonth.some(f => estimateHours(byId(f.appid)) <= 15), blocked: st.blocked.filter(b => (b.at || "").startsWith(ym)).length,
  };
  return out.map(c => { const cur = Math.min(c.goal, c.cur(m)); return { ...c, cur, p: clamp(cur / c.goal) }; });
}
const daysLeftInMonth = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate() - n.getDate() + 1; };

/* ---------------------------------------------------------------- profil complet */
function profileData() {
  const s = stats();
  const extra = {
    ...s, blocked: st.blocked.length,
    longest: Math.max(0, ...[...finishedIds()].map(id => byId(id)?.playtime || 0)),
    sprint: st.finished.some(f => f.since && f.at && (new Date(f.at) - new Date(f.since)) < 7 * 86400000),
    strictFin: st.finished.some(f => f.strict),
    ...activityData(),
  };
  const badges = BADGES.map(b => { const cur = Math.min(b.goal, b.cur(extra)); return { ...b, cur, p: clamp(cur / b.goal), earned: cur >= b.goal, t: TIERS[b.tier] }; });
  const challenges = monthChallenges();
  const tiers = tierData({ ...extra, badgesEarned: badges.filter(b => b.earned).length });
  const earned = badges.filter(b => b.earned), doneCh = challenges.filter(c => c.p >= 1);
  const breakdown = [
    { i: "trophy", l: "Jeux terminés", n: s.fin, each: 400 },
    { i: "star", l: "Jeux à 100 %", n: s.perfect, each: 600 },
    { i: "flag", l: "Quêtes validées avec Questline", n: st.finished.length, each: 250 },
    { i: "shield", l: "Tentations résistées", n: st.blocked.length, each: 25 },
    { i: "clock", l: `Heures de jeu en ${new Date().getFullYear()}`, n: Math.floor(s.year / 60), each: 10 },
    { i: "award", l: "Badges obtenus", n: earned.length, xp: earned.reduce((a, b) => a + b.t.xp, 0) },
    { i: "calendar", l: "Défis du mois réussis", n: doneCh.length, xp: doneCh.reduce((a, c) => a + c.xp, 0) },
    { i: "medal", l: "Paliers de succès", n: tiers.reduce((a, f) => a + f.level, 0), xp: tiers.reduce((a, f) => a + f.xp, 0) },
  ].map(r => ({ ...r, xp: r.xp ?? r.n * r.each }));
  const xp = breakdown.reduce((a, r) => a + r.xp, 0);
  const level = levelOf(xp);
  return { xp, level, from: xpFor(level), to: xpFor(level + 1), rank: rankOf(level), next: nextRankOf(level), badges, tiers, challenges, breakdown, stats: s, extra };
}

// activité détaillée : plateformes, jeux lancés, journées, week-ends, sagas, revanches
function activityData() {
  const fin = finishedIds(), byDay = {};
  for (const [k, v] of Object.entries(playlog)) if (/^\d{4}-\d{2}-\d{2}$/.test(k)) byDay[k] = Object.values(v).reduce((a, b) => a + b, 0);
  const days = playDays();
  const weekend = [...days].filter(k => [0, 6].includes(new Date(k + "T12:00:00").getDay()));
  const sats = new Set(weekend.filter(k => new Date(k + "T12:00:00").getDay() === 6));
  const fullWeekend = weekend.some(k => { const d = new Date(k + "T12:00:00"); if (d.getDay() !== 0) return false; d.setDate(d.getDate() - 1); return sats.has(dayKey(d)); });
  const plat = g => g.platform === "emu" ? "emu:" + (g.system || "?") : g.platform || "steam";
  const sagas = {};
  for (const id of fin) { const s = seriesInfo(byId(id)?.name); if (s) sagas[s.key] = (sagas[s.key] || 0) + 1; }
  const abandoned = new Set(st.abandoned.map(a => String(a.appid)));
  return {
    platforms: new Set(lib.map(plat)).size,
    launched: lib.filter(g => (g.playtime || 0) > 0).length,
    topGame: Math.max(0, ...lib.map(g => g.playtime || 0)),
    emuPlayed: lib.filter(g => g.platform === "emu" && (g.playtime || 0) > 0).length,
    emuFin: [...fin].filter(id => byId(id)?.platform === "emu").length,
    months: new Set([...days].map(k => k.slice(0, 7))).size,
    weekendDays: weekend.length, fullWeekend,
    bigDay: Math.max(0, ...Object.values(byDay)),
    sagaFin: Math.max(0, ...Object.values(sagas)),
    comeback: [...fin].filter(id => abandoned.has(id)).length,
    patience: st.finished.some(f => f.since && f.at && (new Date(f.at) - new Date(f.since)) > 30 * 86400000),
    achTotal: Object.values(progress).reduce((a, p) => a + (p.unlocked || 0), 0),
    ...badgeExtras(fin, days),
  };
}

// mesures supplémentaires pour les badges 2.16 (jeux finis, jours joués, achats…)
function badgeExtras(fin, days) {
  const finGames = [...fin].map(byId).filter(Boolean);
  const perMonth = {};
  for (const f of st.finished) if (f.at) { const k = f.at.slice(0, 7); perMonth[k] = (perMonth[k] || 0) + 1; }
  const quick = f => f.since && f.at && (new Date(f.at) - new Date(f.since)) < 7 * 86400000;
  return {
    daysPlayed: days.size,
    sprints: st.finished.filter(quick).length,
    shortFin: finGames.filter(g => estimateHours(g) <= 8).length,
    longFin: finGames.filter(g => estimateHours(g) >= 40).length,
    storyDone: Object.entries(progress).filter(([id, p]) => p.storyDone && byId(id)).length,
    mc90: finGames.filter(g => (g.metacritic || 0) >= 90).length,
    mcLow: finGames.filter(g => g.metacritic && g.metacritic < 70).length,
    monthFinMax: Math.max(0, ...Object.values(perMonth)),
    wishCount: (st.wishlist || []).length,
    buys: (st.wishlist || []).filter(w => w.boughtAt).length,
    queueLen: st.queue?.length || 0,
    nearPerfect: Object.entries(progress).filter(([id, p]) => byId(id) && p.total >= 10 && !p.perfect && p.unlocked / p.total >= .9).length,
  };
}

// badges les plus proches d'être obtenus (pour donner envie)
function nearBadges(pd, n = 3) {
  return pd.badges.filter(b => !b.earned).sort((a, b) => b.p - a.p || TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier)).slice(0, n);
}

// ce que rapportera la fin de la quête en cours
function questRewards(pd) {
  const fin = pd.stats.fin + 1, c = st.current;
  const items = [{ i: "trophy", l: "Jeu terminé", xp: 400 }, { i: "flag", l: "Quête validée", xp: 250 }];
  const unlock = pd.badges.filter(b => !b.earned && ["first", "five", "fifteen", "thirty"].includes(b.id) && fin >= b.goal);
  if (c && Date.now() - new Date(c.since) < 7 * 86400000) unlock.push(...pd.badges.filter(b => b.id === "sprint" && !b.earned));
  if (st.strict) unlock.push(...pd.badges.filter(b => b.id === "monk" && !b.earned));
  return { items, unlock, total: items.reduce((a, r) => a + r.xp, 0) + unlock.reduce((a, b) => a + b.t.xp, 0) };
}
