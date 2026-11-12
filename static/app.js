/* =====================================================================
   Questline — application (état, navigation, pages, actions)
   ===================================================================== */

/* ---------------------------------------------------------------- état */
let lib = [], st = { current: null, finished: [], abandoned: [], blocked: [], queue: [], wishlist: [], settings: {}, flags: {} };
let tagNames = {}, installed = [], progress = {}, playlog = {}, profile = null, questAch = null;
let view = "quest", sub = null, answers = [], qIndex = 0, picks = [], selected = 0, blockedSeen = 0;
let libFilter = "all", libQuery = "", cleanRun = null, scanRun = null, wishResults = null, installTimer = null, tickTimer = null;
let revealed = false, installPhase = 0, lastKey = "";
const MINI = new URLSearchParams(location.search).has("mini");

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const byId = id => lib.find(g => String(g.appid) === String(id));
const prog = id => progress[String(id)];
const isSteam = id => /^\d+$/.test(String(id));
// succès lisibles : Steam, Epic (profil public) ou jeu émulé dont Questline sait lire la sauvegarde
const hasAch = id => isSteam(id) || (/^(switch:[0-9A-F]{16}|epic:[\w.-]{1,100})$/.test(String(id)) && !!byId(id)?.achievements);
const CDN = { hero: ["library_hero.jpg"], cover: ["library_600x900.jpg", "header.jpg"], logo: ["logo.png"], header: ["header.jpg"] };
const PLAT = { epic: ["Epic", "Epic Games"], gog: ["GOG", "GOG"], ubisoft: ["Ubisoft", "Ubisoft Connect"], amazon: ["Amazon", "Amazon Games"], manual: ["PC", "Jeu ajouté à la main"] };
const platShort = g => g?.platform === "emu" ? (g.system || "Émulation") : (PLAT[g?.platform]?.[0] || "");
const platLong = g => g?.platform === "emu" ? `${g.system || "Console"} (émulation)` : (PLAT[g?.platform]?.[1] || "");
// jaquette par défaut (jeu sans image) : teinte propre au jeu, motif discret, manette en filigrane et nom complet
const phHue = name => [...String(name || "?")].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const phTag = (cls, alt) => `<div class="${cls} ph" style="--h:${phHue(alt)}" title="${esc(alt || "")}" role="img" aria-label="${esc(alt || "Jeu")}">
  <svg class="ph-mark" viewBox="0 0 24 24" aria-hidden="true">${ICONS.gamepad}</svg><b>${esc(alt || "Jeu")}</b><span>Questline</span></div>`;
// image d'un jeu hors Steam : jaquette Epic (CDN Epic) ou icône / bannière Switch (servies par l'app)
const otherImg = (id, kind) => { const g = byId(id); return kind === "logo" ? null : kind === "cover" ? g?.cover : (g?.hero || g?.cover); };
const safeImg = u => typeof u === "string" && !/['"()\\\s]/.test(u) && (/^\/img\/[\w%.-]+\/\w+$/.test(u) || /^https:\/\/[\w.-]+\.(epicgames|gog-statics|gog)\.com\//.test(u)) ? u : null;
function imgTag(id, kind, cls = "", alt = "", extra = "") {
  if (!isSteam(id)) {
    const src = safeImg(otherImg(id, kind));
    // data-ph : en cas d'échec, l'image est remplacée par les initiales du jeu
    return src ? `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" style="object-fit:cover" data-fb="[]" data-ph="1" ${extra}>` : phTag(cls, alt);
  }
  const fb = CDN[kind].map(f => `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/${f}`);
  return `<img class="${cls}" src="/img/${id}/${kind}" alt="${esc(alt)}" loading="lazy" data-kind="${kind}" data-fb="${esc(JSON.stringify(fb))}" ${extra}>`;
}
const imgFail = el => {
  if (el.dataset.ph) { el.outerHTML = phTag(el.className.replace(/\bld\b/, "").trim(), el.alt); return; }
  const fb = JSON.parse(el.dataset.fb || "[]"); if (fb.length) { el.dataset.fb = JSON.stringify(fb.slice(1)); el.src = fb[0]; return; }
  // plus aucune source : une jaquette manquante devient la jaquette par défaut, les autres images (logo, bannière) disparaissent
  if (el.dataset.kind === "cover") { el.outerHTML = phTag(el.className.replace(/ld/, "").trim(), el.alt); return; }
  delete el.dataset.fb; el.style.opacity = 0; el.dispatchEvent(new Event("gone"));
};
// chargement des images de imgTag : écouteurs globaux (phase de capture) au lieu d'attributs onload/onerror,
// interdits par la Content-Security-Policy
document.addEventListener("load", e => { if (e.target.tagName === "IMG" && "fb" in e.target.dataset) e.target.classList.add("ld"); }, true);
document.addEventListener("error", e => { if (e.target.tagName === "IMG" && "fb" in e.target.dataset) imgFail(e.target); }, true);

async function api(path, body) {
  const opt = body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json", "X-Questline": "1" }, body: JSON.stringify(body) };
  const r = await fetch(path, opt);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Erreur");
  return j;
}
const flag = name => { if (!st.flags?.[name]) api("/api/flag", { name }).then(s => { st = s; checkBadges(); }).catch(() => {}); };

let bgFlip = false;
function setBackdrop(id) {
  const next = bgFlip ? $("#bgA") : $("#bgB"), prev = bgFlip ? $("#bgB") : $("#bgA");
  bgFlip = !bgFlip;
  const other = id && !isSteam(id) ? safeImg(byId(id)?.hero) : null;
  if (!id || (!isSteam(id) && !other)) { prev.classList.remove("on"); next.classList.remove("on"); return; }
  const im = new Image(); let tried = !!other;
  im.onload = () => { next.style.backgroundImage = `url("${im.src}")`; next.classList.add("on"); prev.classList.remove("on"); };
  im.onerror = () => { if (!tried) { tried = true; im.src = `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_hero.jpg`; } };
  im.src = other || `/img/${id}/hero`;
}

/* ---------------------------------------------------------------- composants */
function spaceBtn(label, act, extra = "") {
  return `<button class="btn-space" data-act="${act}" ${extra}><strong>${label}</strong><div class="stars-box"><i></i></div><div class="glow"><span></span><span></span></div></button>`;
}
function tgl(key, on, ic, label, subl) {
  return `<label class="tgl"><input type="checkbox" data-set="${key}" ${on ? "checked" : ""}><span class="track"><span class="knob">${icon(ic)}</span></span>${label ? `<span class="tl"><b>${label}</b>${subl ? `<small>${subl}</small>` : ""}</span>` : ""}</label>`;
}
function seg(key, value, options) {
  return `<div class="seg">${options.map(([v, l]) => `<button data-seg="${key}" data-v="${v}" class="${String(v) === String(value) ? "on" : ""}">${l}</button>`).join("")}</div>`;
}
// valeur numérique : animée de 0 à la valeur (compteur)
function kpi(ic, value, label, cls = "", suffix = "") {
  const num = typeof value === "number";
  return `<div class="kpi panel ${cls}"><span class="ico-box acc">${icon(ic)}</span><b ${num ? `data-count="${value}" data-suffix="${suffix}"` : ""}>${num ? "0" + suffix : value}</b><span>${label}</span></div>`;
}
function countUp(instant) {
  document.querySelectorAll("[data-count]").forEach(el => {
    const to = +el.dataset.count, suf = el.dataset.suffix || "", t0 = performance.now(), dur = 900;
    if (!to || instant) { el.textContent = to.toLocaleString("fr-FR") + suf; return; }
    const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e).toLocaleString("fr-FR") + suf; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
function ringSvg(p, size = 64, label = "") {
  const r = 26, c = 2 * Math.PI * r;
  return `<svg class="pring" viewBox="0 0 64 64" width="${size}" height="${size}"><circle cx="32" cy="32" r="${r}" class="bg"/><circle cx="32" cy="32" r="${r}" class="fg" stroke-dasharray="${(p * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle">${label || Math.round(p * 100) + "%"}</text></svg>`;
}
function xpBar(pd, big) {
  const pct = Math.round((pd.xp - pd.from) / Math.max(1, pd.to - pd.from) * 100);
  return `<div class="xpbar ${big ? "big" : ""}"><i style="width:${pct}%"></i><span>${(pd.xp - pd.from).toLocaleString("fr-FR")} / ${(pd.to - pd.from).toLocaleString("fr-FR")} XP</span></div>`;
}
function badgeMini(b) {
  return `<button class="near" data-badge="${b.id}">${medal(b, 54)}<div class="nm"><b>${esc(b.n)}</b><small>${b.cur} / ${b.goal} ${esc(b.u)}</small><div class="bar"><i style="width:${Math.round(b.p * 100)}%"></i></div></div><span class="xp-chip">+${b.t.xp}</span></button>`;
}
function emptyState(ic, title, text, action = "") { return `<div class="empty panel"><span class="ico-box acc">${icon(ic, "lg")}</span><h3 class="sec" style="justify-content:center">${title}</h3><p>${text}</p>${action}</div>`; }
const installedEntry = id => installed.find(i => String(i.appid) === String(id));
const inQueue = id => (st.queue || []).some(q => String(q.appid) === String(id));
// places d'installation pendant une quête (quête comprise, outils Steam exclus) — même règle que le serveur
function slots() {
  const max = Math.max(1, st.settings?.maxInstalled || 2), ids = new Set(installed.map(i => String(i.appid)));
  const reserve = st.current && !st.current.platform && !ids.has(String(st.current.appid)) ? 1 : 0;
  return { max, used: ids.size, free: ids.size + reserve < max };
}
function credits() {
  const rule = Math.max(1, st.settings?.buyRule || 2), fin = finishedIds().size;
  const earned = Math.floor(fin / rule), spent = (st.wishlist || []).filter(w => w.boughtAt).length;
  return { rule, earned, spent, available: Math.max(0, earned - spent), toNext: rule - (fin % rule), fin };
}

function badges(id, g) {
  const p = prog(id), out = [];
  if (st.current && String(st.current.appid) === String(id)) out.push(`<span class="tb cur">En cours</span>`);
  if (p?.perfect) out.push(`<span class="tb perfect">${icon("trophy")} 100 %</span>`);
  else if (p?.storyDone || st.finished.some(x => String(x.appid) === String(id))) out.push(`<span class="tb fin">${icon("check")} Histoire finie</span>`);
  if (inQueue(id)) out.push(`<span class="tb queue">${icon("list")} File</span>`);
  if (g?.platform) out.push(`<span class="tb ${esc(g.platform)}">${esc(platShort(g))}</span>`);
  if (g?.installed && g?.platform !== "emu") out.push(`<span class="tb inst">Installé</span>`);
  return out.length ? `<div class="tbs">${out.join("")}</div>` : "";
}
function tile(g, line) {
  const id = String(g.appid), p = prog(id);
  const sub = line ?? [g.playtime ? fmtH(g.playtime) + " joué" : "jamais lancé", p ? `${p.unlocked}/${p.total} succès` : ""].filter(Boolean).join(" · ");
  const mc = g.metacritic || null;
  // jaquette façon itch.io : image nette, badges discrets, note en coin, infos au survol
  const info = [`${icon("hourglass", "sm")} ≈ ${estimateHours(g)} h`, g.review ? `${icon("smile", "sm")} ${g.review} %` : "", p ? `${icon("trophy", "sm")} ${p.unlocked}/${p.total}` : ""].filter(Boolean);
  return `<button class="tile" data-game="${esc(id)}"><div class="t-cover">${imgTag(id, "cover", "", g.name)}${badges(id, g)}${mc ? `<span class="mcb ${mc >= 75 ? "good" : mc >= 50 ? "mid" : "bad"}" title="Metacritic">${mc}</span>` : ""}<div class="t-hover">${info.map(x => `<span>${x}</span>`).join("")}<span class="t-cta">Voir la fiche ${icon("right", "sm")}</span></div></div><div class="t-name">${esc(g.name)}</div><div class="t-sub">${sub}</div></button>`;
}

/* ---------------------------------------------------------------- navigation */
const NAV = [
  ["Jouer", [["quest", "target", "Ma quête"], ["tonight", "sparkles", "Choisir ma quête"], ["queue", "list", "File d'attente"]]],
  ["Collection", [["library", "grid", "Bibliothèque"], ["wishlist", "heart", "Souhaits"], ["trophies", "trophy", "Palmarès"]]],
  ["Progression", [["stats", "chart", "Statistiques"], ["badges", "award", "Badges & défis"]]],
];
// emblème hexagonal du niveau (couleur du rang via --rc) et barre d'XP en 5 segments
function hexLevel(level) {
  const pts = "19,2 35,11 35,31 19,40 3,31 3,11";
  return `<svg class="lv-hex" viewBox="0 0 38 42" aria-hidden="true"><polygon class="hx-bg" points="${pts}"/><polygon class="hx-in" points="19,7 31,14 31,28 19,35 7,28 7,14"/><text x="19" y="25.5" text-anchor="middle">${level}</text></svg>`;
}
function xpSegments(pct) {
  return `<div class="segs" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">${[0, 1, 2, 3, 4].map(k =>
    `<span style="--f:${Math.round(Math.min(1, Math.max(0, pct / 20 - k)) * 100)}%"></span>`).join("")}</div>`;
}
// configuration initiale : tant qu'aucun lanceur n'est relié (ou l'accueil pas terminé), seules ces pages sont ouvertes
const SETUP_FREE = ["sources", "settings", "notes", "credits"];
const setupMode = () => st.onboarded === false || !lib.length;
const LOCK_MSG = "Relie d'abord un lanceur ou ajoute tes jeux dans Sources pour ouvrir ce menu.";

function renderShell() {
  const c = credits(), pd = profileData(), setup = setupMode();
  const counts = { queue: st.queue?.length || "", library: lib.length, wishlist: (st.wishlist || []).filter(w => !w.boughtAt).length || "", trophies: pd.stats.fin || "" };
  $("#nav").innerHTML = NAV.map(([grp, items]) => `<div class="nav-group">${grp}</div>` + items.map(([k, ic, l]) => setup
    ? `<button class="nav locked" data-go="${k}" title="${LOCK_MSG}" aria-disabled="true">${icon(ic)}<span class="lbl">${l}</span>${icon("lock", "sm")}</button>`
    : `<button class="nav ${view === k ? "on" : ""} ${["wishlist", "stats", "badges"].includes(k) ? "extra" : ""}" data-go="${k}">${icon(ic)}<span class="lbl">${l}</span>${k === "quest" && st.current ? `<span class="dot"></span>` : counts[k] ? `<span class="count">${counts[k]}</span>` : ""}</button>`).join("")).join("")
    + `<div class="nav-group">Réglages</div><button class="nav ${view === "sources" ? "on" : ""}" data-go="sources">${icon("layers")}<span class="lbl">Sources</span></button><button class="nav ${view === "settings" ? "on" : ""}" data-go="settings">${icon("gear")}<span class="lbl">Paramètres</span></button><button class="nav ${view === "notes" ? "on" : ""}" data-go="notes">${icon("info")}<span class="lbl">Notes de version</span><span class="count">${esc(st.version || "")}</span></button><button class="nav ${view === "credits" ? "on" : ""}" data-go="credits">${icon("heart")}<span class="lbl">Crédits</span></button>`;
  $("#shield").className = "shield-card " + (st.current ? "on" : "");
  $("#shield").innerHTML = st.current
    ? `<span class="ico-box ok">${icon("shield")}</span><div><b><span class="pulse"></span> Bouclier actif</b>${st.blocked.length} tentative${st.blocked.length > 1 ? "s" : ""} bloquée${st.blocked.length > 1 ? "s" : ""}</div>`
    : `<span class="ico-box">${icon("shield")}</span><div><b>Bouclier en veille</b>Aucune quête en cours</div>`;
  const h = new Date().getHours(), hello = h < 6 ? "Bonne nuit" : h < 18 ? "Bonjour" : "Bonsoir";
  const titles = { quest: st.current ? "Ta quête en cours" : "Prêt pour une nouvelle quête ?", tonight: "Trouve le jeu que tu vas finir", queue: "Ta file d'attente", library: "Ta bibliothèque", wishlist: "Ta liste de souhaits", trophies: "Ton palmarès", stats: "Tes statistiques", badges: "Ta progression", settings: "Paramètres", sources: "Comptes et émulateurs", notes: "Quoi de neuf ?", credits: "Merci aux créateurs" };
  const pct = Math.round((pd.xp - pd.from) / Math.max(1, pd.to - pd.from) * 100);
  const avatar = profile?.avatar ? `<img src="/avatar.png" alt="">` : `<span>${esc((profile?.name || "?")[0])}</span>`;
  // le profil (avatar, rang, niveau, XP) n'est affiché qu'en haut à droite : pas de doublon dans la barre latérale
  $("#me").innerHTML = "";
  $("#topbar").innerHTML = `<div class="topbar-inner">
    <div class="hello"><small>${titles[view] || ""}</small><b>${hello}${profile?.name ? `, ${esc(profile.name)}` : ""}</b></div>
    <span class="chip-stat flame" title="Jours de jeu d'affilée">${icon("flame")} ${pd.stats.streak} j</span>
    <span class="chip-stat coin" title="Crédits d'achat disponibles" data-go="wishlist" style="cursor:pointer">${icon("coin")} ${c.available}</span>
    <div class="level" data-go="badges" title="Niveau ${pd.level} · ${pd.xp.toLocaleString("fr-FR")} / ${pd.to.toLocaleString("fr-FR")} XP — encore ${(pd.to - pd.xp).toLocaleString("fr-FR")} XP avant le niveau ${pd.level + 1}" style="--rc:${pd.rank.c}">
      ${hexLevel(pd.level)}
      <div class="who"><b>${pd.rank.n}</b>${xpSegments(pct)}</div>
      <div class="pfp">${avatar}</div>
    </div></div>`;
}

function render() {
  clearInterval(installTimer); installTimer = null;
  if (MINI) { $("#app").innerHTML = viewMini(); afterRender(); return; }
  renderShell();
  const views = { quest: viewQuestPage, tonight: viewTonight, queue: viewQueue, library: viewLibrary, wishlist: viewWishlist, trophies: viewTrophies, stats: viewStats, badges: viewBadges, settings: viewSettings, sources: viewSources, notes: viewNotes, credits: viewCredits };
  // configuration initiale : les menus verrouillés mènent à Sources
  if (setupMode() && !SETUP_FREE.includes(view)) { view = "sources"; sub = null; }
  const html = (views[view] || viewQuestPage)();
  const key = view + "/" + (sub || "") + "/" + qIndex + "/" + (st.current?.appid || "");
  $("#app").innerHTML = `<div class="${key === lastKey ? "" : "view"}">${html}</div>`;
  lastKey = key;
  afterRender();
  checkBadges();
}

/* ---------------------------------------------------------------- page « Ma quête » */
function viewQuestPage() {
  if (!st.current) return viewHome();
  return sub === "install" ? viewInstall() : viewQuest();
}

// bandeau « ta progression » : rang, XP, badges presque débloqués
function progressBand() {
  const pd = profileData(), near = nearBadges(pd, 3);
  return `<div class="band">
    <div class="rank-card panel gborder" data-go="badges" style="--rc:${pd.rank.c}">
      <div class="emb">${rankEmblem(pd.level, 96)}</div>
      <div style="flex:1;min-width:0"><span class="eyebrow" style="color:${pd.rank.c}">Rang ${pd.rank.n}</span>
        <h3 class="sec" style="margin:4px 0 10px">Niveau ${pd.level}</h3>${xpBar(pd, true)}
        <p class="small" style="margin-top:8px">${pd.next ? `Rang <b style="color:${pd.next.c}">${pd.next.n}</b> au niveau ${pd.next.lv}` : "Rang maximum atteint"}</p></div>
    </div>
    <div class="panel near-card"><div class="row" style="justify-content:space-between;margin-bottom:10px"><h4 class="mini-title">${icon("sparkles", "sm")} Presque débloqués</h4><button class="btn xs" data-go="badges">Tout voir ${icon("right", "sm")}</button></div>
      ${near.map(badgeMini).join("")}</div>
  </div>`;
}

function viewInstall() {
  const c = st.current, inst = installedEntry(c.appid);
  setBackdrop(c.appid);
  const phase = !inst ? 1 : inst.ready ? 3 : 2;
  installPhase = phase;
  const pct = inst?.progress ?? (inst?.ready ? 100 : 0);
  const step = (n, label, extra = "") => `<div class="step panel ${phase === n ? "active" : phase > n ? "done" : ""}"><span class="dot">${phase > n ? icon("check", "sm") : n}</span><div style="flex:1">${label}${extra}</div></div>`;
  return `
  <div class="quest">
    <div class="cover-wrap">${imgTag(c.appid, "cover", "cover", c.name)}</div>
    <div class="info">
      <span class="eyebrow">Installation</span>
      <h2 class="title">${esc(c.name)}</h2>
      <p class="lead">L'installation est lancée sur Steam. Le bouclier est déjà actif : seul ce jeu peut se télécharger.</p>
      <div class="steps">
        ${step(1, "Confirme l'installation dans la fenêtre Steam qui vient de s'ouvrir")}
        ${step(2, "Téléchargement", phase === 2 ? `<div class="bar" style="margin-top:10px"><i style="width:${pct}%"></i></div><span class="small">${pct ? pct.toLocaleString("fr-FR") + " %" : "démarrage…"}</span>` : "")}
        ${step(3, "Prêt à jouer")}
      </div>
      <div class="row">${phase === 3 ? spaceBtn(`${icon("play", "sm")} Jouer`, "play") : `<button class="btn sm" data-act="reinstall">${icon("external", "sm")} Rouvrir la fenêtre Steam</button>`}<button class="btn sm" data-act="toQuest">Voir ma quête</button></div>
    </div>
  </div>`;
}

// prévision de fin : heures restantes ÷ rythme réel (heures par semaine)
function etaText(j) {
  const left = Math.round(j.remaining / 60), wk = j.weekly / 60;
  if (j.remaining <= 0) return "Tu as dépassé la durée estimée : la fin approche !";
  if (!j.eta) return `Encore ≈ ${left} h · joue un peu pour estimer ta date de fin`;
  const sameYear = j.eta.getFullYear() === new Date().getFullYear();
  return `Encore ≈ ${left} h à ≈ ${wk < 10 ? wk.toFixed(1).replace(".", ",") : Math.round(wk)} h/semaine : fini vers le <b style="color:var(--ink)">${j.eta.toLocaleDateString("fr-FR", { day: "numeric", month: "long", ...(sameYear ? {} : { year: "numeric" }) })}</b>`;
}
function editEstimate() {
  const c = st.current, g = byId(c.appid) || { appid: c.appid, name: c.name };
  const s = modal(`<h3>Durée de l'histoire</h3><p>Questline estime <b>${estimateHours(g)} h</b> pour finir l'histoire principale de ${esc(c.name)}. Si tu connais une meilleure durée (HowLongToBeat, par exemple), indique-la : la progression et la date de fin s'ajusteront.</p>
    <input type="number" min="1" max="500" step="1" id="estH" value="${c.estHours || estimateHours(g)}">
    <div class="row"><button class="btn sm" data-act="estReset">Revenir à l'estimation</button><button class="btn sm accent" data-act="estSave">${icon("check", "sm")} Enregistrer</button></div>`);
  s.querySelector("#estH").focus();
}

// ce que la fin de la quête rapportera : XP et badges débloqués
function rewardsCard() {
  const pd = profileData(), r = questRewards(pd), after = levelOf(pd.xp + r.total);
  return `<div class="loot panel">
    <div class="loot-head"><span class="ico-box gold">${icon("trophy", "lg")}</span><div><span class="eyebrow" style="color:var(--gold)">À la clé</span><h3 class="sec">+${r.total.toLocaleString("fr-FR")} XP quand tu verras le générique</h3>
      <p class="small">${after > pd.level ? `De quoi passer au <b style="color:var(--ink)">niveau ${after}</b>${rankOf(after).n !== pd.rank.n ? ` et devenir <b style="color:${rankOf(after).c}">${rankOf(after).n}</b>` : ""}.` : `Niveau ${pd.level} : encore ${(pd.to - pd.xp - r.total).toLocaleString("fr-FR")} XP ensuite pour le suivant.`}</p></div></div>
    <div class="loot-items">
      ${r.items.map(it => `<div class="loot-it">${icon(it.i, "sm")}<span>${it.l}</span><b>+${it.xp}</b></div>`).join("")}
      ${r.unlock.map(b => `<button class="loot-it badge" data-badge="${b.id}">${medal({ ...b, earned: true }, 34)}<span>Badge <b style="color:${b.t.glow}">${esc(b.n)}</b></span><b>+${b.t.xp}</b></button>`).join("")}
    </div></div>`;
}

function abandonBanner(c) {
  if (!c.abandonAt) return "";
  const left = new Date(c.abandonAt) - Date.now();
  const txt = left > 0 ? `Abandon possible dans <strong style="color:var(--ink)">${Math.floor(left / 3600000)} h ${String(Math.floor(left / 60000) % 60).padStart(2, "0")}</strong>. Une bonne session peut te faire changer d'avis.` : "Le délai de réflexion est écoulé.";
  return `<div class="goal panel" style="border-color:color-mix(in srgb,var(--danger) 35%,transparent)"><span class="ico-box red">${icon("hourglass")}</span>
    <div style="flex:1"><b>Demande d'abandon en cours</b><p>${txt}</p></div>
    <div class="row">${left > 0 ? "" : `<button class="btn sm danger" data-act="abandonConfirm">Confirmer l'abandon</button>`}<button class="btn sm" data-act="abandonCancel">Je continue</button></div></div>`;
}

/* ---------------------------------------------------------------- « Choisir ma quête » : ménage, questionnaire, top 5 */
function viewClean() {
  const items = installed, total = items.reduce((t, g) => t + (g.sizeGB || 0), 0), run = cleanRun;
  const status = id => {
    if (!run) return `<span class="pill">${items.find(i => i.appid === id)?.sizeGB?.toLocaleString("fr-FR") ?? "–"} Go</span>`;
    const s = run.status[id];
    return s === "done" ? `<span class="pill ok">Désinstallé</span>` : s === "active" ? `<span class="pill go">Confirme dans Steam…</span>` : s === "skip" ? `<span class="pill">Gardé</span>` : `<span class="pill">En attente</span>`;
  };
  return `
  <span class="eyebrow">Étape 1 · Le grand ménage</span>
  <h2 class="title" style="margin-top:10px">${items.length ? `${items.length} jeux installés, <span class="gtext">${total.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} Go</span> à libérer` : run?.done ? `Ménage <span class="gtext">terminé</span>.` : "Ton disque est déjà propre."}</h2>
  <p class="lead" style="margin-top:10px">On repart de zéro : un seul jeu installé à la fois, celui que tu vas finir. Tes sauvegardes Steam Cloud restent en ligne.</p>
  ${items.length ? `
  <div class="notice panel gborder"><span class="ico-box acc">${icon("info")}</span><div>Steam va ouvrir une fenêtre de confirmation <b>pour chaque jeu</b> : clique sur <b>Désinstaller</b> à chaque fois. Les jeux sans Steam Cloud perdent leurs sauvegardes locales : utilise « Sauvegardes » dans leur fiche avant, en cas de doute.</div></div>
  <div class="row" style="margin-top:22px">
    ${run ? (run.done ? spaceBtn("Continuer", "toQuiz") : `<div class="loader"></div><button class="btn sm" data-act="skipOne">Garder ce jeu et passer</button>`)
          : spaceBtn("Tout désinstaller", "cleanAll") + `<button class="btn" data-act="toQuiz">Passer cette étape</button>`}
  </div>
  <div class="clean-list">${items.map(g => `<div class="clean-item panel">${imgTag(g.appid, "cover", "", g.name)}<div class="nm"><b>${esc(g.name)}</b><small class="small">${g.sizeGB?.toLocaleString("fr-FR") ?? "–"} Go</small></div>${status(g.appid)}</div>`).join("")}</div>`
  : `<div class="row" style="margin-top:26px">${spaceBtn("Continuer", "toQuiz")}</div>`}`;
}

let quizSet = null;   // indices des questions posées (version complète ou express)
const QUICK = ["rhythm", "length", "crave", "drop", "progress", "platform"];
/* ---------------------------------------------------------------- file d'attente */

/* ---------------------------------------------------------------- bibliothèque */

/* ---------------------------------------------------------------- souhaits + crédits */

/* ---------------------------------------------------------------- palmarès */

/* ---------------------------------------------------------------- statistiques */

/* ---------------------------------------------------------------- badges & défis */

let badgeFilter = "all";

/* ---------------------------------------------------------------- paramètres */
const THEMES = [["neon", "Néon", "#07060b", "linear-gradient(90deg,#ffdb3b,#fe53bb,#8f51ea,#0044ff)"], ["light", "Clair", "#f4f2f9", "linear-gradient(90deg,#ff9f1c,#e83f9c,#7b3fe4)"], ["steam", "Steam", "#1b2838", "linear-gradient(90deg,#66c0f4,#1a9fff,#2a475e)"], ["retro", "Rétro", "#050805", "linear-gradient(90deg,#39ff14,#ffb000)"]];

/* ---------------------------------------------------------------- widget (mini-fenêtre) */
function viewMini() {
  document.body.classList.add("mini");
  const c = st.current;
  if (!c) return `<div class="center">${icon("target", "xl")}<h3 class="sec">Aucune quête en cours</h3><button class="btn accent" data-act="openApp">Ouvrir Questline</button></div>`;
  const g = byId(c.appid) || { playtime: 0 }, j = journal(c, g), estPct = Math.min(99, Math.round(j.nowPt / Math.max(1, j.est) * 100));
  setBackdrop(c.appid);
  return `<div class="mini-card">
    <div class="cv panel" style="background-image:url('/img/${encodeURIComponent(c.appid)}/hero')">${imgTag(c.appid, "logo", "", c.name)}</div>
    <div><span class="eyebrow">Ta quête</span><h3 class="sec" style="margin-top:4px">${esc(c.name)}</h3></div>
    <div class="kv"><div><b>${fmtH(g.playtime)}</b><span>joué</span></div><div><b>${j.streak} j</b><span>série</span></div></div>
    <div><div class="bar"><i style="width:${estPct}%"></i></div><p class="small" style="margin-top:6px">≈ ${estPct} % de l'histoire${j.eta ? ` · fini vers le ${j.eta.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}` : ""}</p></div>
    ${sessionCard(c).replace(/<button class="btn sm" data-act="widget"[^]*?<\/button>/g, "")}
    <div class="row">${spaceBtn(`${icon("play", "sm")} Jouer`, "play", 'style="min-width:0;flex:1"')}<button class="btn sm" data-act="openApp">${icon("external", "sm")}</button></div>
  </div>`;
}

/* ---------------------------------------------------------------- fiche d'un jeu */

async function showSaves(id) {
  const box = $("#savesBox"); if (!box) return;
  box.innerHTML = `<div class="achbox"><div class="loader sm"></div></div>`;
  const dirs = await api(`/api/saves/${id}`);
  box.innerHTML = `<div class="achbox"><div class="row"><b style="font-family:var(--display)">${icon("save", "sm")} Sauvegardes</b>${dirs.length ? `<button class="btn xs" data-act="backup" data-id="${esc(id)}">${icon("download", "sm")} Copier dans Documents</button>` : ""}</div>
    ${dirs.length ? `<div class="saves">${dirs.map(d => `<button data-act="openSave" data-id="${esc(id)}" data-path="${esc(d.path)}">${icon("folder", "sm")}<span><b>${esc(d.kind)}</b> · ${esc(d.path)}</span></button>`).join("")}</div>`
      : `<p class="small">Aucun emplacement connu : ce jeu n'utilise pas Steam Cloud, ou n'a pas encore été lancé sur ce PC.</p>`}</div>`;
}

/* ---------------------------------------------------------------- liste complète des succès d'un jeu */
const STEAM_ACH_IMG = "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps";
function achIcon(id, a) {
  const h = a.unlocked ? a.icon : (a.iconGray || a.icon);
  if (isSteam(id) && h) return `<img src="${STEAM_ACH_IMG}/${encodeURIComponent(id)}/${h}.jpg" alt="" loading="lazy">`;
  return `<span class="ico-box ${a.unlocked ? "ok" : ""}">${icon(a.unlocked ? "trophy" : "lock")}</span>`;
}
function achRow(id, a, storyId) {
  const when = a.unlocked && a.unlockedAt ? new Date(a.unlockedAt * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";
  const secret = a.hidden && !a.unlocked;
  return `<div class="ach ${a.unlocked ? "got" : "todo"} ${secret ? "secret" : ""} ${a.id === storyId ? "story" : ""}">
    ${achIcon(id, a)}
    <div class="txt"><b>${esc(a.name)}</b>${a.id === storyId ? ` <span class="chip">Fin de l'histoire</span>` : ""}<p>${esc(a.desc || "")}</p>
      ${secret ? `<p class="mask">Succès secret · <button class="link" data-act="achReveal">révéler</button></p>` : ""}</div>
    <span class="when small">${a.unlocked ? (when || "Débloqué") : ""}</span>
  </div>`;
}
async function showAchievements(id) {
  const g = byId(id) || { name: String(id) === String(st.current?.appid) ? st.current.name : "Jeu" };
  const s = modal(`<div class="center" style="padding:40px"><div class="loader"></div></div>`, null, "achmodal");
  let data;
  try { data = await api(`/api/achievements/${encodeURIComponent(id)}`); } catch { data = { list: [] }; }
  const list = [...(data.list || [])].sort((a, b) => (b.unlocked - a.unlocked) || (b.unlockedAt - a.unlockedAt) || (!!a.hidden - !!b.hidden));
  const got = list.filter(a => a.unlocked).length;
  const pct = list.length ? Math.round(got / list.length * 100) : 0;
  const box = s.querySelector(".modal");
  box.dataset.f = "all";
  box.innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:flex-start"><div><h3>${esc(g.name)}</h3><p class="small" style="margin:0">${got}/${list.length} succès débloqués · ${pct} %</p></div><button class="btn xs" data-close>${icon("x", "sm")}</button></div>
    <div class="bar" style="margin:12px 0 14px"><i style="width:${pct}%"></i></div>
    ${list.length ? `<div class="seg achfilters">
        <button class="on" data-act="achFilter" data-f="all">Tous (${list.length})</button>
        <button data-act="achFilter" data-f="got">Débloqués (${got})</button>
        <button data-act="achFilter" data-f="todo">À faire (${list.length - got})</button></div>
      <div class="achlist">${list.map(a => achRow(id, a, data.story)).join("")}</div>`
      : `<p>Aucun succès lisible pour ce jeu sur ce PC pour l'instant. Lance-le une fois ou utilise « Synchroniser ».</p>`}`;
}

/* ---------------------------------------------------------------- après rendu */
function afterRender() {
  document.querySelectorAll("#app img.logo").forEach(l => l.addEventListener("gone", () => { l.remove(); const t = $("#fallbackTitle"); if (t) t.style.display = ""; }));
  countUp(!document.querySelector("#app > .view"));
  // arrivée des résultats : un son, une seule fois (les cartes ne se retournent plus)
  if (view === "tonight" && sub === "results" && document.querySelector(".picks.intro")) setTimeout(() => sfx("pick"), 300);
  const q = $("#q");
  if (q) q.oninput = () => { libQuery = q.value; const pos = q.selectionStart; render(); const n = $("#q"); n.focus(); n.setSelectionRange(pos, pos); };
  const wq = $("#wq");
  const sp = $("#storyPick");
  if (sp) sp.onchange = async () => { const a = questAch.list.find(x => x.id === sp.value); if (!a) return; st = await api("/api/story", { id: a.id, name: a.name, desc: a.desc }); render(); };
  clearInterval(tickTimer);
  const cd = $("#countdown");
  if (cd) { const tick = () => { const ms = new Date(cd.dataset.until) - Date.now(); if (ms <= 0) { clearInterval(tickTimer); cd.textContent = "Terminé !"; return; } const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60; cd.textContent = `${Math.floor(m / 60) ? Math.floor(m / 60) + ":" : ""}${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}`; }; tick(); tickTimer = setInterval(tick, 1000); }
  if (st.current && view === "quest") {
    installTimer = setInterval(async () => {
      try {
        installed = await api("/api/installed");
        if (sub === "install") {
          const e = installedEntry(st.current.appid), phase = !e ? 1 : e.ready ? 3 : 2;
          if (phase !== installPhase) { installPhase = phase; return render(); }
          const bar = document.querySelector(".step.active .bar i"), lbl = document.querySelector(".step.active .small");
          if (bar && e?.progress != null) { bar.style.width = e.progress + "%"; if (lbl) lbl.textContent = e.progress.toLocaleString("fr-FR") + " %"; }
        }
      } catch {}
    }, sub === "install" ? 1500 : 8000);
  }
}

/* ---------------------------------------------------------------- badges : annonce des nouveaux */
// annonce les nouveaux badges et les passages de niveau (grande animation), mémorise les dates d'obtention
let badgeSeen = null, levelSeen = null, dataReady = false;
function checkBadges() {
  if (MINI || !lib.length || !dataReady || st.onboarded === false) return;   // pas d'animation pendant l'accueil
  const pd = profileData(), earned = [...pd.badges.filter(b => b.earned).map(b => b.id), ...tierIds(pd.tiers)];
  const ls = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null"); localStorage.setItem(k, JSON.stringify(v)); } catch { return null; } };
  if (badgeSeen === null) badgeSeen = ls("ql_badges");
  if (levelSeen === null) levelSeen = ls("ql_level");
  const first = badgeSeen === null;                     // premier lancement : pas d'avalanche d'animations
  if (first) { badgeSeen = earned; levelSeen = pd.level; }
  const dates = badgeDates(); let changed = false;
  for (const id of earned) if (!dates[id]) { dates[id] = new Date().toISOString(); changed = true; }
  if (changed) ls("ql_badge_dates", dates);
  const fresh = pd.badges.filter(b => b.earned && !badgeSeen.includes(b.id)).sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
  fresh.slice(0, 2).forEach(b => celebrateUnlock({ type: "badge", badge: b }));
  // paliers : on annonce le plus haut palier nouvellement atteint de chaque famille
  const freshTiers = pd.tiers.map(f => ({ f, k: f.level })).filter(({ f, k }) => k && !badgeSeen.includes(`tier:${f.id}:${k}`));
  freshTiers.slice(0, 2).forEach(({ f, k }) => celebrateUnlock({ type: "tier", fam: f, level: k }));
  if (freshTiers.length > 2) setTimeout(() => toast(`Et ${freshTiers.length - 2} autre(s) palier(s) atteint(s) : ${freshTiers.slice(2).map(x => x.f.n).join(", ")} !`, "medal", "badge"), 900);
  if (fresh.length > 2) setTimeout(() => toast(`Et ${fresh.length - 2} autre${fresh.length > 3 ? "s" : ""} badge${fresh.length > 3 ? "s" : ""} débloqué${fresh.length > 3 ? "s" : ""} : ${fresh.slice(2).map(b => b.n).join(", ")} !`, "award", "badge"), 600);
  if (levelSeen !== null && pd.level > levelSeen) {
    celebrateUnlock({ type: "level", level: pd.level, rankUp: rankOf(pd.level).n !== rankOf(levelSeen).n });
    const news = []; for (let l = levelSeen + 1; l <= pd.level; l++) news.push(...unlocksAt(l));
    if (news.length) setTimeout(() => toast(`Débloqué : ${news.join(", ")}. Choisis-le dans Paramètres > Apparence.`, "palette", "badge"), 1500);
  }
  badgeSeen = earned; levelSeen = pd.level;
  ls("ql_badges", earned); ls("ql_level", pd.level);
}

/* ---------------------------------------------------------------- actions */
// jeux proposables : pas finis, pas dans la file, et pas une suite dont l'épisode précédent attend encore
const candidates = () => lib.filter(finishable).filter(g => !inQueue(g.appid) && !earlierUnfinished(g));
function startQuiz(set) { answers = []; qIndex = 0; quizSet = set; revealed = false; view = "tonight"; }
function answer(i) {
  answers[quizSet[qIndex]] = i; sfx("click");
  if (++qIndex < quizSet.length) return render();
  // à égalité : le mieux noté, puis celui déjà commencé
  picks = candidates().map(g => affinity(g, answers)).sort((a, b) => b.pct - a.pct || (b.g.review || 0) - (a.g.review || 0) || (b.g.playtime || 0) - (a.g.playtime || 0)).slice(0, 5);
  selected = 0; revealed = false; sub = "results"; render();
}

document.addEventListener("click", async e => {
  const t = e.target.closest("[data-go],[data-act],[data-choice],[data-pick],[data-filter],[data-game],[data-steam],[data-seg],[data-badge],[data-bfilter]");
  if (!t) return;
  try {
    if (t.dataset.steam) return api(`/api/${t.dataset.steam === "store" ? "store" : "opendetails"}/${t.dataset.id}`, {});
    if (t.dataset.game) { document.querySelector(".scrim")?.remove(); sfx("click"); return openSheet(t.dataset.game); }
    if (t.dataset.seg) return setSetting(t.dataset.seg, isNaN(t.dataset.v) ? t.dataset.v : +t.dataset.v);
    if (t.dataset.go && setupMode() && !SETUP_FREE.includes(t.dataset.go)) {
      toast(LOCK_MSG, "lock");
      if (view !== "sources") { view = "sources"; render(); }
      document.querySelector(".src-setup")?.classList.remove("nudge"); void document.querySelector(".src-setup")?.offsetWidth; document.querySelector(".src-setup")?.classList.add("nudge");
      return;
    }
    if (t.dataset.go) { view = t.dataset.go; if (view !== "tonight") sub = view === "quest" ? (sub === "install" ? "install" : null) : null; else if (!["quiz", "results", "clean"].includes(sub)) sub = null; document.querySelector(".scrim")?.remove(); if (view === "quest" && st.current) await loadQuestAch(); sfx("click"); window.scrollTo(0, 0); return render(); }
    if (t.dataset.filter) { libFilter = t.dataset.filter; return render(); }
    if (t.dataset.bfilter) { badgeFilter = t.dataset.bfilter; sfx("click"); return render(); }
    if (t.dataset.badge) { document.querySelector(".scrim")?.remove(); return openBadge(t.dataset.badge); }
    if (t.dataset.choice !== undefined) return answer(+t.dataset.choice);
    if (t.dataset.pick !== undefined) { sfx("click"); return selectPick(+t.dataset.pick); }   // mise à jour ciblée, sans tout redessiner

    switch (t.dataset.act) {
      case "start": installed = await api("/api/installed"); startQuiz(QUESTIONS.map((_, i) => i)); sub = (!st.cleaned && installed.length && !st.current) ? "clean" : "quiz"; return render();
      case "quick": startQuiz(QUICK.map(k => QUESTIONS.findIndex(q => q.key === k))); sub = "quiz"; return render();
      case "lucky": { picks = candidates().sort((a, b) => (b.review || 0) - (a.review || 0)).slice(0, 40).sort(() => Math.random() - .5).slice(0, 5).map(g => ({ g, pct: g.review || 0, label: "avis positifs", why: [g.review ? `${g.review} % d'avis positifs` : "Pas encore d'avis"] })); view = "tonight"; selected = 0; revealed = false; sub = "results"; render(); return setTimeout(spinWheel, 2600); }
      case "toQuiz": await api("/api/cleaned", {}); st.cleaned = true; sub = "quiz"; cleanRun = null; return render();
      case "qback": if (qIndex) qIndex--; else sub = null; return render();
      case "qskip": return answer(-1);
      case "cleanAll": return runClean();
      case "skipOne": if (cleanRun) cleanRun.skip = true; return;
      case "choose": return confirmChoose(picks[selected].g);
      case "pickFromSheet": document.querySelector(".scrim")?.remove(); return confirmChoose(byId(t.dataset.id));
      case "startQueued": { const g = byId(st.queue[0].appid) || { appid: st.queue[0].appid, name: st.queue[0].name, playtime: 0, platform: st.queue[0].platform }; return confirmChoose(g); }
      case "installGame": { await api(`/api/install/${t.dataset.id}`, {}); document.querySelector(".scrim")?.remove(); sfx("pick"); return toast("Installation lancée dans Steam : confirme dans sa fenêtre.", "download"); }
      case "queueAdd": { const g = byId(t.dataset.id); st = await api("/api/queue", { action: "add", appid: g.appid, name: g.name, platform: g.platform }); sfx("pick"); toast(`${g.name} ajouté à ta file d'attente.`, "list"); document.querySelector(".scrim")?.remove(); return render(); }
      case "qmove": st = await api("/api/queue", { action: t.dataset.dir, appid: t.dataset.id }); sfx("click"); return render();
      case "play": sfx("pick"); await api(`/api/play/${st.current.appid}`, {}); return toast("Le jeu se lance. Bonne session !", "play");
      case "reinstall": await api(`/api/install/${st.current.appid}`, {}); sub = "install"; return render();
      case "toQuest": sub = null; await loadQuestAch(); return render();
      case "sync": { st = await api("/api/sync", {}); if (!st.current) return finishFlow(st.finished.at(-1)); await loadQuestAch(); render(); return toast("Succès synchronisés.", "refresh"); }
      case "finish": return confirmFinish();
      case "abandon": return st.strict ? confirmAbandonRequest() : confirmAbandon();
      case "abandonConfirm": return confirmAbandon();
      case "abandonCancel": st = await api("/api/abandon/cancel", {}); render(); return toast("Demande annulée. On continue la quête !", "flame");
      case "session": st = await api("/api/session", { minutes: +t.dataset.min }); flag("session"); sfx("pick"); render(); return toast(`C'est parti pour ${t.dataset.min} minutes. Bonne session !`, "timer");
      case "sessionStop": st = await api("/api/session/stop", {}); return render();
      case "widget": flag("widget"); return api("/api/widget", {});
      case "openApp": return api("/api/openui", {});
      case "spin": return spinWheel();
      case "card": return victoryCard(t.dataset.id);
      case "recap": return yearRecap();
      case "scan": if (t.dataset.goto) { view = t.dataset.goto; render(); } return runScan();
      case "scanStop": if (scanRun) scanRun.stop = true; return;
      case "saves": return showSaves(t.dataset.id);
      case "estEdit": return editEstimate();
      case "estSave": case "estReset": {
        const h = t.dataset.act === "estReset" ? 0 : Math.round(+$("#estH").value);
        if (t.dataset.act === "estSave" && !(h >= 1 && h <= 500)) return toast("Indique une durée entre 1 et 500 heures.", "info");
        st = await api("/api/estimate", { hours: h }); document.querySelector(".scrim")?.remove(); render(); return toast("Durée mise à jour.", "check");
      }
      case "achList": sfx("click"); return showAchievements(t.dataset.id);
      case "achFilter": { const box = t.closest(".achmodal"); box.dataset.f = t.dataset.f; box.querySelectorAll("[data-act=achFilter]").forEach(b => b.classList.toggle("on", b === t)); return; }
      case "achReveal": t.closest(".ach").classList.remove("secret"); return;
      case "openSave": return api(`/api/saves/${t.dataset.id}/open`, { path: t.dataset.path });
      case "backup": { const g = byId(t.dataset.id); const r = await api(`/api/saves/${t.dataset.id}/backup`, { name: g?.name }); return toast(r.files ? `${r.files} fichier(s) copiés dans Documents\\Sauvegardes Questline.` : "Rien à copier.", "save"); }
      case "wsearch": return doWishSearch();
      case "wadd": { const r = JSON.parse(t.dataset.r); st = await api("/api/wishlist", { action: "add", ...r }); sfx("pick"); return render(); }
      case "wremove": st = await api("/api/wishlist", { action: "remove", appid: t.dataset.id }); return render();
      case "wbuy": return confirmBuy(t.dataset.id);
    }
  } catch (err) { sfx("error"); toast(err.message, "info"); }
});

document.addEventListener("change", async e => {
  const k = e.target.dataset?.set;
  if (!k) return;
  sfx("toggle");
  try {
    if (k === "autostart") st = await api("/api/autostart", { enabled: e.target.checked });
    else await setSetting(k, e.target.checked, true);
    if (k === "strict") toast(st.strict ? "Mode strict activé : abandonner demandera 24 h de réflexion." : "Mode strict désactivé.", "lock");
  } catch (err) { e.target.checked = !e.target.checked; toast(err.message, "info"); }
});

async function setSetting(key, value, silent) {
  st = await api("/api/settings", { [key]: value });
  if (key === "theme" || key === "dynamic" || key === "scene") await applyTheme();
  if (!silent) sfx("toggle");
  render();
}

async function doWishSearch() {
  const q = $("#wq")?.value.trim(); if (!q) return;
  wishResults = "loading"; render();
  wishResults = await api(`/api/storesearch?q=${encodeURIComponent(q)}`);
  render(); const n = $("#wq"); if (n) n.value = q;
}

async function runClean() {
  const items = [...installed];
  cleanRun = { status: {}, done: false, skip: false };
  render();
  for (const g of items) {
    cleanRun.status[g.appid] = "active"; cleanRun.skip = false; render();
    await api(`/api/uninstall/${g.appid}`, {});
    while (true) {
      await new Promise(r => setTimeout(r, 1500));
      if (cleanRun.skip) { cleanRun.status[g.appid] = "skip"; break; }
      const now = await api("/api/installed");
      if (!now.some(i => i.appid === g.appid)) { cleanRun.status[g.appid] = "done"; break; }
    }
    render();
  }
  cleanRun.done = true;
  installed = await api("/api/installed");
  await loadLibrary(true);
  render();
}

// Ouvre la page de chaque jeu joué dans Steam : Steam y écrit les succès sur le PC
async function runScan() {
  const list = lib.filter(g => g.playtime > 0 && isSteam(g.appid)).sort((a, b) => b.playtime - a.playtime);
  scanRun = { i: 0, total: list.length, done: false, stop: false, name: "" };
  render();
  for (const g of list) {
    if (scanRun.stop) break;
    scanRun.i++; scanRun.name = g.name;
    if (view === "trophies") render();
    const before = (await api(`/api/jsonstamp/${g.appid}`)).at;
    await api(`/api/opendetails/${g.appid}`, {});
    for (let k = 0; k < 10; k++) { await new Promise(r => setTimeout(r, 600)); if ((await api(`/api/jsonstamp/${g.appid}`)).at !== before) break; }
  }
  scanRun.done = true;
  progress = await api("/api/progress?refresh=1");
  flag("scan");
  const perfect = Object.values(progress).filter(p => p.perfect).length, story = Object.values(progress).filter(p => p.storyDone && !p.perfect).length;
  render();
  toast(`Scan terminé : ${perfect} jeu${perfect > 1 ? "x" : ""} à 100 %, ${story} histoire${story > 1 ? "s" : ""} terminée${story > 1 ? "s" : ""}.`, "trophy");
}

async function loadQuestAch() {
  if (!st.current || !hasAch(st.current.appid)) { questAch = null; return; }
  try { questAch = await api(`/api/achievements/${st.current.appid}`); } catch { questAch = null; }
}

function modal(html, onReady, cls = "") {
  const s = document.createElement("div");
  s.className = "scrim"; s.innerHTML = `<div class="modal ${cls}">${html}</div>`;
  s.addEventListener("click", e => { if (e.target === s || e.target.closest("[data-close]")) s.remove(); });
  document.body.appendChild(s); onReady?.(s); return s;
}
// Echap ferme la fenetre du dessus (la liste des succes peut s'ouvrir par-dessus la fiche d'un jeu)
document.addEventListener("keydown", e => { if (e.key === "Escape") [...document.querySelectorAll(".scrim")].at(-1)?.remove(); });


async function confirmChoose(g) {
  const data = hasAch(g.appid) ? await api(`/api/achievements/${g.appid}`) : { list: [] };
  const list = data.list || [];
  const opts = list.map(a => `<option value="${esc(a.id)}" ${a.id === data.story ? "selected" : ""}>${esc(a.name)} — ${esc(a.desc)}</option>`).join("");
  modal(`<h3>On part sur ${esc(g.name)} ?</h3>
    <p>${g.platform === "emu" ? "Je le lance dans l'émulateur." : g.platform === "epic" && !g.installed ? "Je lance son installation dans le launcher Epic." : g.platform ? "Je lance le jeu sur sa plateforme." : "Je lance l'installation sur Steam."} À partir de maintenant, <b style="color:var(--ink)">tout autre téléchargement Steam sera annulé</b> jusqu'à la fin de l'histoire.</p>
    ${list.length ? `<label class="small">Succès qui valide la fin de l'histoire${data.story ? " (détecté automatiquement)" : ""} :</label>
      <select id="ach"><option value="">— je le choisirai plus tard —</option>${opts}</select>`
      : `<div class="ach-preview"><span class="ico-box">${icon("hourglass")}</span><span class="small">${g.platform ? "Pas de succès lisibles sur cette plateforme : tu valideras toi-même la fin." : "Les succès de ce jeu ne sont pas encore sur ton PC : ils seront détectés à son premier lancement."}</span></div>`}
    <div class="row"><button class="btn sm" data-close>Pas encore</button>${spaceBtn("C'est parti", "noop", 'id="ok"')}</div>`,
    s => s.querySelector("#ok").onclick = async ev => {
      ev.stopPropagation();
      const sel = s.querySelector("#ach")?.value, a = list.find(x => x.id === sel);
      st = await api("/api/commit", { appid: g.appid, name: g.name, playtime: g.playtime, platform: g.platform, story: a ? { id: a.id, name: a.name, desc: a.desc } : null });
      blockedSeen = st.blocked.length; sfx("win");
      installed = await api("/api/installed");
      const inst = g.platform ? { ready: true } : installedEntry(g.appid);
      if (!inst && !g.platform) await api(`/api/install/${g.appid}`, {});
      s.remove(); view = "quest"; sub = inst?.ready ? null : "install";
      await loadQuestAch(); await applyTheme(); render();
    });
}

function confirmFinish() {
  modal(`<h3>Générique de fin vu ?</h3><p>Ce jeu n'a pas de succès lisible : c'est sur l'honneur. L'histoire principale est bien terminée ?</p>
    <div class="row"><button class="btn sm" data-close>Pas encore</button><button class="btn sm accent" id="ok">Oui, je l'ai fini</button></div>`,
    s => s.querySelector("#ok").onclick = async () => { st = await api("/api/finish", {}); s.remove(); finishFlow(st.finished.at(-1)); });
}
function confirmAbandon() {
  const phrase = "j'abandonne";
  modal(`<h3>Vraiment ?</h3><p>Abandonner lève le bouclier et range ce jeu dans les abandonnés. Pour confirmer, tape <b style="color:var(--ink)">${phrase}</b>.</p>
    <input id="ph" autocomplete="off" placeholder="${phrase}">
    <div class="row"><button class="btn sm" data-close>Je continue</button><button class="btn sm danger" id="ok" disabled>Abandonner</button></div>`,
    s => {
      const inp = s.querySelector("#ph"), ok = s.querySelector("#ok");
      inp.focus();
      inp.oninput = () => ok.disabled = inp.value.trim().toLowerCase().replace("’", "'") !== phrase;
      ok.onclick = async () => { st = await api("/api/abandon", {}); s.remove(); sub = null; await applyTheme(); render(); };
    });
}
function confirmAbandonRequest() {
  modal(`<h3>Mode strict</h3><p>Ta demande d'abandon sera validable dans <b style="color:var(--ink)">24 heures</b>. D'ici là, le bouclier reste actif et tu peux changer d'avis à tout moment.</p>
    <div class="row"><button class="btn sm" data-close>Je continue</button><button class="btn sm danger" id="ok">Demander l'abandon</button></div>`,
    s => s.querySelector("#ok").onclick = async () => { st = await api("/api/abandon", {}); s.remove(); render(); });
}
function confirmBuy(id) {
  const w = st.wishlist.find(x => String(x.appid) === String(id)), c = credits();
  modal(`<h3>Utiliser un crédit ?</h3><p>Tu as mérité cet achat : <b style="color:var(--ink)">${esc(w.name)}</b>. Il te restera ${c.available - 1} crédit(s). J'ouvre sa page sur le magasin Steam.</p>
    <div class="row"><button class="btn sm" data-close>Plus tard</button><button class="btn sm accent" id="ok">${icon("cart", "sm")} Acheter</button></div>`,
    s => s.querySelector("#ok").onclick = async () => { st = await api("/api/wishlist", { action: "buy", appid: id }); await api(`/api/store/${id}`, {}); s.remove(); sfx("win"); confetti(60); render(); });
}

/* ---------------------------------------------------------------- roue du destin */
let spinning = false;
async function spinWheel() {
  if (spinning || !picks.length) return;
  spinning = true; flag("wheel");
  const total = picks.reduce((s, p) => s + p.pct, 0);
  let r = Math.random() * total, target = 0;
  for (; target < picks.length - 1; target++) { r -= picks[target].pct; if (r <= 0) break; }
  const cards = [...document.querySelectorAll(".pcard")], grid = $(".picks");
  if (!grid) { spinning = false; return; }
  grid.classList.add("wheel-on");
  const steps = picks.length * 3 + ((target - selected + picks.length) % picks.length);
  let i = selected;
  for (let k = 1; k <= steps; k++) {
    i = (i + 1) % picks.length;
    cards.forEach((c, n) => c.classList.toggle("sel", n === i)); sfx("tick");
    await new Promise(res => setTimeout(res, 60 + Math.pow(k / steps, 3) * 420));
  }
  grid.classList.remove("wheel-on");
  selected = target; spinning = false; render(); sfx("win");
  toast(`Le destin a choisi : ${picks[target].g.name}`, "dice");
}

/* ---------------------------------------------------------------- fin de quête : générique puis célébration */
function finishFlow(done) {
  if (!done) return render();
  applyTheme();
  creditsRoll(done, () => celebrate(done));
}
function celebrate(done) {
  view = "quest"; sub = null; renderShell();
  setBackdrop(done.appid);
  const next = st.queue?.[0];
  $("#app").innerHTML = `<div class="view center">
    <img class="win-cup" src="/static/art/trophies/cup-gold.png" alt="Coupe">
    <span class="eyebrow">Quête accomplie</span>
    ${imgTag(done.appid, "cover", "", done.name, 'style="width:220px;border-radius:18px;box-shadow:0 0 60px var(--glow)"')}
    <h1 class="display">${esc(done.name)}<br><span class="gtext">terminé.</span></h1>
    <p class="lead">Le bouclier est levé. ${credits().available ? `Tu as gagné un <b style="color:var(--gold)">crédit d'achat</b> !` : "Désinstalle-le quand tu veux, et choisis le prochain."}</p>
    ${next ? `<div class="next-up panel gborder" style="text-align:left">${imgTag(next.appid, "cover", "", next.name)}<div style="flex:1"><span class="eyebrow">Prochain dans ta file</span><div style="font-family:var(--display);font-weight:600;font-size:17px">${esc(next.name)}</div></div><button class="btn sm accent" data-act="startQueued">${icon("play", "sm")} Lancer</button></div>` : ""}
    <div class="row" style="justify-content:center">${next ? "" : spaceBtn("Jeu suivant", "start")}<button class="btn" data-act="card" data-id="${esc(done.appid)}">${icon("image", "sm")} Ma carte de victoire</button><button class="btn" data-go="trophies">${icon("trophy", "sm")} Palmarès</button></div></div>`;
  confetti(); checkBadges();
}

/* ---------------------------------------------------------------- notifications */
function toast(msg, ic = "info", cls = "") {
  let box = $(".toasts"); if (!box) { box = document.createElement("div"); box.className = "toasts"; document.body.appendChild(box); }
  const t = document.createElement("div"); t.className = "toast " + cls; t.innerHTML = `${icon(ic, "sm")}<span>${esc(msg)}</span>`;
  box.appendChild(t); setTimeout(() => t.remove(), 4800);
}

/* ---------------------------------------------------------------- démarrage */
async function loadLibrary(refresh) {
  const [steam, other] = await Promise.all([api("/api/library" + (refresh ? "?refresh=1" : "")), api("/api/othergames").catch(() => [])]);
  lib = [].concat(steam || [], other || []);
}
(async () => {
  try {
    const [s, tags, inst, prof] = await Promise.all([api("/api/state"), api("/api/tags").catch(() => []), api("/api/installed"), api("/api/profile").catch(() => null), loadLibrary()]);
    st = s; installed = [].concat(inst || []); profile = prof;
    [].concat(tags || []).forEach(t => tagNames[t.tagid] = t.name);
  } catch (err) { $("#app").innerHTML = `<p class="lead">Impossible de lire Steam : ${esc(err.message)}</p>`; return; }
  blockedSeen = st.blocked.length;
  await applyTheme();
  await loadQuestAch();
  render();
  // succès et journal global en arrière-plan
  Promise.all([api("/api/progress").catch(() => ({})), api("/api/playlog").catch(() => ({}))]).then(([p, l]) => { progress = p || {}; playlog = l || {}; dataReady = true; applyTheme(); if (!(view === "tonight" && sub)) render(); });
  const qs = new URLSearchParams(location.search);
  if (qs.has("blocked") && st.blocked.length) toast(`Bien tenté. ${st.blocked.at(-1).name} a été annulé : finis d'abord ${st.current?.name ?? "ton jeu"}.`, "shield");
  if (qs.has("done") && st.finished.length) finishFlow(st.finished.at(-1));
  if (!MINI) history.replaceState(null, "", "/");
  setInterval(async () => {
    try {
      const s = await api("/api/state");
      if (s.blocked.length > blockedSeen) { toast(`Bien tenté. ${s.blocked.at(-1).name} a été annulé.`, "shield"); sfx("error"); }
      blockedSeen = s.blocked.length;
      const wasCurrent = st.current, changed = JSON.stringify(s) !== JSON.stringify(st);
      st = s;
      if (wasCurrent && !s.current && s.finished.length && String(s.finished.at(-1).appid) === String(wasCurrent.appid)) return finishFlow(s.finished.at(-1));
      if (changed && !(view === "tonight" && sub) && !document.querySelector(".scrim") && !scanRun?.i) { await loadQuestAch(); render(); }
    } catch {}
  }, 4000);
})();
