/* =====================================================================
   Questline — récompenses : succès à paliers (12 paliers par famille), décors et palettes à débloquer.
   Images : packs CC0 d'itch.io (voir static/art/CREDITS.txt et les notes de version).
   Utilise les globales de app.js / engine.js / progress.js.
   ===================================================================== */

/* ---------------------------------------------------------------- succès à paliers
   Chaque famille a 12 paliers ; l'emblème grandit et s'orne à chaque palier. */
const TIER_NAMES = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const TIER_FAMILIES = [
  { id: "finisher", n: "Finisseur", art: "hexagon-gold", i: "flag", u: "jeux terminés",
    d: "Termine des jeux jusqu'au générique.", steps: [1, 2, 3, 5, 8, 10, 15, 20, 25, 30, 40, 50], cur: x => x.fin },
  { id: "quests", n: "Maître des quêtes", art: "hexagon-ruby", i: "target", u: "quêtes validées",
    d: "Valide des quêtes avec Questline, bouclier actif.", steps: [1, 2, 3, 5, 7, 10, 15, 20, 25, 30, 40, 50], cur: () => st.finished.length },
  { id: "hours", n: "Endurant", art: "shield-sapphire", i: "clock", u: "h de jeu",
    d: "Cumule des heures de jeu.", steps: [10, 25, 50, 100, 200, 300, 500, 750, 1000, 1500, 2000, 3000], cur: x => Math.floor(x.total / 60) },
  { id: "streak", n: "Régularité", art: "diamond-ruby", i: "flame", u: "jours d'affilée",
    d: "Joue plusieurs jours d'affilée (meilleure série).", steps: [2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90, 120], cur: x => x.best },
  { id: "days", n: "Fidèle", art: "diamond-sapphire", i: "calendar", u: "jours de jeu",
    d: "Joue un maximum de jours différents.", steps: [5, 10, 20, 30, 50, 75, 100, 150, 200, 250, 300, 365], cur: x => x.days.size },
  { id: "perfect", n: "Complétionniste", art: "hexagon-platinum", i: "star", u: "jeux à 100 %",
    d: "Débloque tous les succès d'un jeu.", steps: [1, 2, 3, 4, 5, 7, 10, 12, 15, 20, 25, 30], cur: x => x.perfect },
  { id: "hunter", n: "Chasseur de succès", art: "shield-amethyst", i: "trophy", u: "succès débloqués",
    d: "Débloque des succès dans tes jeux (Steam, Epic, Switch…).", steps: [10, 25, 50, 100, 200, 300, 500, 750, 1000, 1500, 2000, 3000], cur: () => Object.values(progress).reduce((a, p) => a + (p.unlocked || 0), 0) },
  { id: "willpower", n: "Volonté de fer", art: "diamond-onyx", i: "shield", u: "tentations résistées",
    d: "Le bouclier bloque un téléchargement pendant ta quête.", steps: [1, 3, 5, 10, 15, 20, 30, 40, 50, 75, 100, 150], cur: () => st.blocked.length },
  { id: "collector", n: "Collectionneur", art: "shield-bronze", i: "layers", u: "jeux",
    d: "Agrandis ta bibliothèque (tous launchers et émulateurs).", steps: [25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000], cur: () => lib.length },
  { id: "platforms", n: "Globe-trotteur", art: "shield-gold", i: "grid", u: "plateformes",
    d: "Joue sur des plateformes différentes : Steam, Epic, GOG, Ubisoft, chaque console émulée…", steps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], cur: x => x.platforms },
  { id: "marathon", n: "Marathonien", art: "shield-ruby", i: "mountain", u: "h sur un même jeu",
    d: "Passe de longues heures sur ton jeu le plus joué.", steps: [10, 20, 30, 50, 75, 100, 150, 200, 300, 400, 500, 750], cur: x => Math.floor(x.topGame / 60) },
  { id: "curious", n: "Curieux", art: "diamond-gold", i: "search", u: "jeux lancés",
    d: "Lance des jeux différents, au moins une fois chacun.", steps: [5, 10, 20, 30, 50, 75, 100, 125, 150, 175, 200, 250], cur: x => x.launched },
  { id: "months", n: "Saisons de jeu", art: "hexagon-sapphire", i: "calendar", u: "mois actifs",
    d: "Joue au fil des mois, sans lâcher.", steps: [1, 2, 3, 4, 6, 8, 10, 12, 15, 18, 21, 24], cur: x => x.months },
  { id: "badges", n: "Collection de badges", art: "shield-platinum", i: "award", u: "badges obtenus",
    d: "Obtiens les badges de la page Badges & défis.", steps: [1, 2, 3, 5, 7, 10, 13, 16, 20, 25, 30, 35], cur: x => x.badgesEarned },
  { id: "retro", n: "Âme rétro", art: "diamond-amethyst", i: "gamepad", u: "jeux émulés lancés",
    d: "Joue à des jeux de console en émulation.", steps: [1, 2, 3, 5, 8, 10, 15, 20, 30, 40, 50, 75], cur: x => x.emuPlayed },
  { id: "weekend", n: "Guerrier du week-end", art: "hexagon-amethyst", i: "sunrise", u: "jours de week-end joués",
    d: "Joue le samedi ou le dimanche.", steps: [2, 4, 8, 12, 16, 24, 32, 40, 52, 64, 80, 104], cur: x => x.weekendDays },
  { id: "bigday", n: "Grosse journée", art: "diamond-platinum", i: "timer", u: "h en une journée",
    d: "Ta plus longue journée de jeu.", steps: [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16], cur: x => Math.floor(x.bigDay / 60) },
  { id: "legend", n: "Légende des paliers", art: "hexagon-master", i: "crown", u: "paliers obtenus",
    d: "Grimpe les paliers de toutes les autres familles.", steps: [3, 6, 10, 15, 25, 35, 50, 70, 90, 120, 160, 200], cur: (x, others) => others },
];
const tierArt = (f, k) => `/static/art/ranks/${f.art}-${Math.max(1, Math.min(12, k))}.png`;
const tierXp = k => 40 * k;                       // palier k : 40, 80, … 480 XP
const tierXpTotal = level => 20 * level * (level + 1);

function tierData(extra) {
  const make = (f, cur) => {
    const level = f.steps.filter(s => cur >= s).length, next = f.steps[level];
    const prev = level ? f.steps[level - 1] : 0;
    return { ...f, cur, level, next, p: next ? clamp((cur - prev) / (next - prev)) : 1, xp: tierXpTotal(level) };
  };
  const base = TIER_FAMILIES.filter(f => f.id !== "legend").map(f => make(f, f.cur(extra)));
  const total = base.reduce((a, f) => a + f.level, 0);
  const legend = TIER_FAMILIES.find(f => f.id === "legend");
  return [...base, make(legend, legend.cur(extra, total))];
}
// identifiants des paliers obtenus (pour annoncer les nouveaux)
const tierIds = tiers => tiers.flatMap(f => [...Array(f.level)].map((_, k) => `tier:${f.id}:${k + 1}`));

function tierCard(f) {
  return `<button class="tcard panel ${f.level ? "got" : ""}" data-tier="${f.id}">
    <img class="temb ${f.level ? "" : "locked"}" src="${tierArt(f, f.level || 1)}" alt="" loading="lazy">
    <div class="tinfo"><span class="eyebrow">${f.level ? `Palier ${TIER_NAMES[f.level - 1]}` : "À débloquer"} · ${f.level}/12</span>
      <b>${esc(f.n)}</b>
      <small>${f.next ? `${f.cur.toLocaleString("fr-FR")} / ${f.next.toLocaleString("fr-FR")} ${esc(f.u)}` : `Palier maximum : ${f.cur.toLocaleString("fr-FR")} ${esc(f.u)}`}</small>
      <span class="bar"><i style="width:${Math.round(f.p * 100)}%"></i></span>
      <span class="tpips">${f.steps.map((_, k) => `<i class="${k < f.level ? "on" : ""}"></i>`).join("")}</span>
    </div></button>`;
}
function tierSection(pd) {
  const got = pd.tiers.reduce((a, f) => a + f.level, 0);
  return `<div class="sec-head"><h3 class="sec">${icon("medal")} Succès à paliers <span class="count">${got}/${pd.tiers.length * 12}</span></h3><span class="pill">${icon("zap", "sm")} ${tierXp(1)} à ${tierXp(12)} XP par palier</span></div>
    <div class="tiers">${pd.tiers.map(tierCard).join("")}</div>`;
}
function openTier(id) {
  const f = profileData().tiers.find(x => x.id === id); if (!f) return;
  sfx("click");
  modal(`<div class="tier-sheet"><button class="x" data-close>${icon("x")}</button>
    <img class="temb big ${f.level ? "" : "locked"}" src="${tierArt(f, f.level || 1)}" alt="">
    <span class="eyebrow">${f.level ? `Palier ${TIER_NAMES[f.level - 1]} sur XII` : "Pas encore de palier"}</span>
    <h3>${esc(f.n)}</h3><p>${esc(f.d)}</p>
    <div class="tladder">${f.steps.map((s, k) => `<div class="tstep ${k < f.level ? "on" : k === f.level ? "next" : ""}">
      <img src="${tierArt(f, k + 1)}" alt="" loading="lazy"><b>${TIER_NAMES[k]}</b><small>${s.toLocaleString("fr-FR")}</small><small class="xp">+${tierXp(k + 1)} XP</small></div>`).join("")}</div>
    <p class="small" style="margin-top:14px">${f.next ? `Prochain palier : ${f.next.toLocaleString("fr-FR")} ${esc(f.u)} (encore ${(f.next - f.cur).toLocaleString("fr-FR")}).` : "Tous les paliers sont débloqués. Respect."}</p>
  </div>`, null, "tier-modal");
}

/* ---------------------------------------------------------------- décors (fonds animés en couches) */
// l : nombre de couches (1 = fond fixe), tile : tuile spatiale sans raccord, lv : niveau requis
const SCENES = [
  { id: "aucun", n: "Aurore (classique)", lv: 1, l: 0 },
  { id: "nuit", n: "Nuit étoilée", lv: 1, l: 6, by: "ChrisPpop" },
  { id: "foret", n: "Forêt sombre", lv: 2, l: 5, by: "Val_DeMar" },
  { id: "crepuscule", n: "Crépuscule", lv: 4, l: 6, by: "ansimuz" },
  { id: "nuit-2", n: "Nuit d'été", lv: 6, l: 6, by: "ChrisPpop" },
  { id: "brume", n: "Montagnes brumeuses", lv: 8, l: 6, by: "ansimuz" },
  { id: "nebuleuse-bleue", n: "Nébuleuse bleue", lv: 10, l: 1, tile: true, by: "Screaming Brain Studios" },
  { id: "canyon", n: "Canyon", lv: 12, l: 5, by: "ansimuz" },
  { id: "nuit-3", n: "Nuit glacée", lv: 14, l: 6, by: "ChrisPpop" },
  { id: "nebuleuse-violette", n: "Nébuleuse violette", lv: 16, l: 1, tile: true, by: "Screaming Brain Studios" },
  { id: "nuit-4", n: "Nuit pourpre", lv: 18, l: 6, by: "ChrisPpop" },
  { id: "nebuleuse-verte", n: "Nébuleuse verte", lv: 20, l: 1, tile: true, by: "Screaming Brain Studios" },
  { id: "etoiles", n: "Champ d'étoiles", lv: 25, l: 1, tile: true, by: "Screaming Brain Studios" },
];
// palettes de couleurs de l'interface, elles aussi à débloquer
const PALETTE_LV = { neon: 1, light: 1, steam: 3, retro: 5 };

const sceneUrl = (s, k) => `/static/art/scenes/${s.id}/${k}.png`;
function currentLevel() { try { return profileData().level; } catch { return 1; } }
function applyScene() {
  const sky = document.querySelector(".sky"); if (!sky) return;
  const want = st.settings?.scene || "nuit", lv = currentLevel();
  const s = SCENES.find(x => x.id === want && lv >= x.lv) || SCENES.find(x => x.id === "nuit");
  let box = sky.querySelector(".scene");
  if (!box) { box = document.createElement("div"); box.className = "scene"; sky.appendChild(box); }
  if (box.dataset.id === s.id) return;
  box.dataset.id = s.id;
  sky.classList.toggle("has-scene", s.l > 0);
  box.className = `scene ${s.tile ? "tile" : ""}`;
  box.innerHTML = [...Array(s.l)].map((_, k) => `<div class="layer ${k === 0 && !s.tile ? "still" : ""}" data-k="${k}" style="background-image:url('${sceneUrl(s, k + 1)}')"></div>`).join("");
  sizeScene();
}
// défilement sans saut : chaque couche glisse exactement d'une largeur de motif, à une vitesse
// croissante vers l'avant (effet de profondeur) ; le ciel reste fixe
const SCENE_SPEED = [0, 3, 6, 10, 15, 22];   // pixels par seconde, du fond vers l'avant
function sizeScene() {
  document.querySelectorAll(".scene .layer:not(.still)").forEach(el => {
    const img = new Image();
    img.onload = () => {
      const tile = el.parentElement.classList.contains("tile");
      const w = tile ? 512 : img.naturalWidth * (innerHeight / img.naturalHeight);
      const speed = tile ? 6 : SCENE_SPEED[+el.dataset.k] || 22;
      el.style.setProperty("--tw", `${w.toFixed(1)}px`);
      el.style.setProperty("--sp", `${(w / speed).toFixed(1)}s`);
    };
    img.src = el.style.backgroundImage.slice(5, -2);
  });
}
addEventListener("resize", () => { clearTimeout(sizeScene.t); sizeScene.t = setTimeout(sizeScene, 200); });

function scenePicker() {
  const lv = currentLevel(), cur = st.settings?.scene || "nuit";
  return `<div class="scenes">${SCENES.map(s => {
    const open = lv >= s.lv;
    const pv = s.l ? (s.tile ? `background:url('${sceneUrl(s, 1)}') center/160px` : [...Array(s.l)].map((_, k) => `url('${sceneUrl(s, s.l - k)}')`).join(",")) : "";
    return `<button class="scene-card ${cur === s.id ? "on" : ""} ${open ? "" : "locked"}" ${open ? `data-seg="scene" data-v="${s.id}"` : `data-locked="${s.lv}"`} title="${open ? esc(s.n) : `Débloqué au niveau ${s.lv}`}">
      <div class="pv" style="${s.l ? (s.tile ? pv : `background-image:${pv};background-size:cover;background-position:center bottom`) : "background:linear-gradient(135deg,var(--c3),var(--c2),var(--c4))"}">${open ? "" : `<span class="lockbadge">${icon("lock", "sm")} Niv. ${s.lv}</span>`}</div>
      <span>${esc(s.n)}</span></button>`;
  }).join("")}</div>`;
}
// décors et palettes qui se débloquent à un niveau donné (annonce lors d'un passage de niveau)
const unlocksAt = level => [...SCENES.filter(s => s.lv === level).map(s => `le décor « ${s.n} »`),
  ...Object.entries(PALETTE_LV).filter(([, l]) => l === level).map(([k]) => `la palette « ${({ neon: "Néon", light: "Clair", steam: "Steam", retro: "Rétro" })[k]} »`)];

// coupe ou médaille selon la valeur d'une récompense
const trophyImg = (kind, xp) => `/static/art/trophies/${kind}-${xp >= 350 ? "gold" : xp >= 250 ? "silver" : "bronze"}.png`;

document.addEventListener("click", e => {
  const t = e.target.closest("[data-tier],[data-locked]");
  if (!t) return;
  if (t.dataset.tier) { document.querySelector(".scrim")?.remove(); return openTier(t.dataset.tier); }
  toast(`Débloqué au niveau ${t.dataset.locked}. Termine des quêtes et grimpe les paliers pour y arriver !`, "lock");
});
