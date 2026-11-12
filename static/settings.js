/* =====================================================================
   Questline — page Paramètres : onglets à gauche, une section à la fois
   ===================================================================== */
let settingsTab = "general";
const SETTINGS_TABS = [
  ["general", "shield", "Quête et bouclier", "Mode strict, démarrage, installations"],
  ["look", "palette", "Apparence", "Palettes, décors, thème dynamique"],
  ["notify", "bell", "Rappels et sons", "Notifications, sons d'interface"],
  ["shop", "cart", "Achats", "Crédits pour acheter un jeu"],
  ["library", "layers", "Bibliothèque", "Comptes, émulation, succès"],
  ["about", "info", "À propos", "Version, confidentialité, crédits"],
];

const setLine = (ic, t, d, ctrl) => `<div class="sline"><span class="ico-box">${icon(ic)}</span><div class="t"><b>${t}</b><small>${d}</small></div><div class="c">${ctrl}</div></div>`;
const setGroup = (title, body) => `<div class="sgroup panel">${title ? `<h4 class="mini-title">${title}</h4>` : ""}${body}</div>`;

function settingsPane(tab) {
  const s = st.settings || {};
  switch (tab) {
    case "general": return setGroup("Bouclier", `
        ${setLine("lock", "Mode strict", "L'abandon d'une quête ne prend effet qu'après 24 h de réflexion. Désactivable seulement entre deux quêtes.", tgl("strict", st.strict, "lock"))}
        ${setLine("download", "Jeux installés en même temps", "Pendant une quête, ta quête comprise. Au-delà, tout nouveau téléchargement est annulé.", seg("maxInstalled", s.maxInstalled ?? 2, [[1, "1"], [2, "2"], [3, "3"]]))}`)
      + setGroup("Sessions", `
        ${setLine("moon", "Heure limite des sessions", "Questline te prévient si un objectif de session dépasse cette heure.", seg("bedtime", s.bedtime ?? 23, BEDTIMES))}`)
      + setGroup("Démarrage", `
        ${setLine("zap", "Lancer avec l'ordinateur", "Questline démarre en arrière-plan : le bouclier est toujours actif.", tgl("autostart", st.autostart, "zap"))}
        ${setLine("monitor", "Widget", "Une mini-fenêtre avec ta quête, à garder dans un coin de l'écran.", `<button class="btn sm" data-act="widget">${icon("monitor", "sm")} Ouvrir</button>`)}`);
    case "look": {
      const lv = currentLevel(), cur = SCENES.find(x => x.id === (s.scene || "nuit")) || SCENES[1];
      const open = SCENES.filter(x => lv >= x.lv).length, next = SCENES.find(x => x.lv > lv);
      const bg = !cur.l ? "background:linear-gradient(135deg,var(--c3),var(--c2),var(--c4))" : cur.tile ? `background:url('${sceneUrl(cur, 1)}') center/360px` : `background-image:${[...Array(cur.l)].map((_, k) => `url('${sceneUrl(cur, cur.l - k)}')`).join(",")};background-size:cover;background-position:center bottom`;
      return `<div class="look-hero panel" style="${bg}"><div class="look-hero-in"><span class="eyebrow">Décor actuel</span><h3>${esc(cur.n)}</h3><p class="small">${open}/${SCENES.length} décors débloqués${next ? ` · prochain au niveau ${next.lv} : « ${esc(next.n)} »` : " · collection complète !"}</p></div></div>`
        + setGroup("Palette de couleurs", `<div class="themes">${THEMES.map(([k, n, b, gr]) => { const ok = lv >= (PALETTE_LV[k] || 1); return `<button class="theme-card ${s.theme === k ? "on" : ""} ${ok ? "" : "locked"}" ${ok ? `data-seg="theme" data-v="${k}"` : `data-locked="${PALETTE_LV[k]}"`}><div class="pv" style="background:${b}"><i style="background:${gr}"></i>${ok ? "" : `<span class="lockbadge">${icon("lock", "sm")} Niv. ${PALETTE_LV[k]}</span>`}</div><span>${n}</span></button>`; }).join("")}</div>`)
        + setGroup("Décor de fond", scenePicker())
        + setGroup("", setLine("sparkles", "Thème dynamique", "Les couleurs de l'app s'accordent à la jaquette de ta quête en cours.", tgl("dynamic", s.dynamic, "sparkles")));
    }
    case "notify": return setGroup("Rappels", `
        ${setLine("bell", "Me rappeler ma quête", "Une notification le soir si ta quête n'avance plus.", tgl("reminders", s.reminders, "bell"))}
        ${setLine("calendar", "Après combien de jours ?", "Sans session sur ta quête.", seg("reminderDays", s.reminderDays, [[1, "1 j"], [2, "2 j"], [3, "3 j"], [5, "5 j"]]))}`)
      + setGroup("Sons", setLine("volume", "Sons d'interface", "Petits sons discrets pour les clics, la roue et les victoires.", tgl("sounds", s.sounds, "volume")));
    case "shop": {
      const c = credits();
      return `<div class="shop-hero panel gborder"><span class="ico-box acc">${icon("coin", "lg")}</span><div><b>${c.available} crédit${c.available > 1 ? "s" : ""} disponible${c.available > 1 ? "s" : ""}</b><p class="small">Chaque crédit autorise l'achat d'un jeu de ta liste de souhaits. Tu en gagnes en terminant des jeux.</p></div><button class="btn sm" data-go="wishlist">${icon("heart", "sm")} Souhaits</button></div>`
        + setGroup("Règle d'achat", setLine("cart", "Jeux à terminer pour un crédit", "Combien de jeux finir pour avoir le droit d'en acheter un nouveau.", seg("buyRule", s.buyRule, [[1, "1"], [2, "2"], [3, "3"], [5, "5"]])));
    }
    case "library": {
      const others = lib.filter(g => g.platform), ep = others.filter(g => g.platform !== "emu").length, sw = others.filter(g => g.platform === "emu").length;
      const epic = { ok: ["Synchronisés depuis ton profil Epic.", "OK"], private: ["Ton profil Epic est privé : rends tes succès visibles par tout le monde sur epicgames.com.", "Privé"], noaccount: ["Aucun compte Epic relié : relie-le dans Sources.", "—"], error: ["Epic ne répond pas pour l'instant, nouvel essai automatique.", "—"] }[st.epicAch] || ["Vérification au premier affichage d'un jeu Epic qui a des succès.", "—"];
      return `<div class="lib-stats">${[["layers", lib.length, "jeux"], ["gamepad", lib.length - others.length, "Steam"], ["zap", ep, "Epic, GOG, Ubisoft, PC"], ["monitor", sw, "émulation"]].map(([i, n, l]) => `<div class="panel"><span class="ico-box">${icon(i)}</span><b>${n}</b><small>${l}</small></div>`).join("")}</div>`
        + setGroup("Sources", `
          ${setLine("layers", "Comptes et émulateurs", "Steam, Epic, GOG, Ubisoft, Amazon, jeux PC et consoles émulées.", `<button class="btn sm accent" data-go="sources">${icon("layers", "sm")} Gérer</button>`)}
          ${setLine("sparkles", "Revoir le guide de démarrage", "Rechoisis les comptes à relier. Les menus se reverrouillent jusqu'à la fin du guide.", `<button class="btn sm" data-act="welcomeAgain">${icon("rotate", "sm")} Relancer</button>`)}
          ${setLine("grid", "Affichage de la bibliothèque", "Remet le tri, la vue et la taille des jaquettes par défaut.", `<button class="btn sm" data-act="libReset">${icon("rotate", "sm")} Réinitialiser</button>`)}`)
        + setGroup("Succès", `
          ${setLine("refresh", "Succès Steam", "Retrouve les jeux déjà finis en relisant tes succès.", `<button class="btn sm" data-act="scan" data-goto="trophies">${icon("refresh", "sm")} Scanner</button>`)}
          ${setLine("zap", "Succès Epic", epic[0], `<span class="pill">${epic[1]}</span>`)}`);
    }
    case "about": return `<div class="about-hero panel gborder"><span class="brand-mark">${$(".brand .mark")?.innerHTML || ""}</span><div><h3>Questline <span class="pill">v${esc(st.version || "")}</span></h3><p class="small">Un jeu à la fois, jusqu'au générique.</p></div></div>`
      + setGroup("", `
        ${setLine("sparkles", "Notes de version", "Ce qui a changé à chaque mise à jour.", `<button class="btn sm" data-go="notes">${icon("right", "sm")} Ouvrir</button>`)}
        ${setLine("heart", "Crédits", "Les artistes et projets libres derrière Questline.", `<button class="btn sm" data-go="credits">${icon("right", "sm")} Ouvrir</button>`)}`)
      + setGroup("Confidentialité", `<p class="small" style="line-height:1.6">Questline lit les fichiers de tes launchers et émulateurs présents sur ton ordinateur. Aucun mot de passe n'est demandé et rien n'est envoyé à un serveur de Questline. L'appli contacte seulement des services publics : magasin et profils Steam, API Epic (succès), titledb et Nintendo, GameTDB, libretro et SteamGridDB (jaquettes). Les durées de jeu sont des estimations.</p>`);
  }
  return "";
}

function viewSettings() {
  setBackdrop(null);
  const tab = SETTINGS_TABS.find(t => t[0] === settingsTab) || SETTINGS_TABS[0];
  // toutes les sections sont rendues : la recherche filtre les réglages sans recharger la page
  return `
  <div class="page-head"><div><span class="eyebrow">Réglages</span><h2 class="title">Paramètres</h2></div></div>
  <div class="settings2">
    <aside class="stabs">
      <label class="lsearch sfind">${icon("search", "sm")}<input id="setq" placeholder="Rechercher un réglage…" autocomplete="off"></label>
      <nav class="stab-list">${SETTINGS_TABS.map(([k, i, n, d]) => `<button class="stab ${k === tab[0] ? "on" : ""}" data-stab="${k}"><span class="ico-box">${icon(i)}</span><span><b>${n}</b><small>${d}</small></span></button>`).join("")}</nav>
    </aside>
    <section class="spane">
      ${SETTINGS_TABS.map(([k, i, n, d]) => `<div class="spage" data-page="${k}" ${k === tab[0] ? "" : "hidden"}>
        <div class="spane-head"><span class="ico-box acc">${icon(i, "lg")}</span><div><h3>${n}</h3><p class="small">${d}</p></div></div>
        ${settingsPane(k)}</div>`).join("")}
      <div class="sempty panel" hidden>${icon("search")} <span>Aucun réglage ne correspond à cette recherche.</span></div>
    </section>
  </div>`;
}

// recherche : montre toutes les sections et ne garde que les réglages qui contiennent les mots tapés
function filterSettings(q) {
  const words = q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\s+/).filter(Boolean);
  const norm = el => el.textContent.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  let found = 0;
  document.querySelectorAll(".spage").forEach(p => {
    if (!words.length) { p.hidden = p.dataset.page !== settingsTab; p.querySelectorAll(".sline,.sgroup,.spane-head,.look-hero,.shop-hero,.lib-stats,.about-hero").forEach(x => x.hidden = false); return; }
    let inPage = 0;
    p.querySelectorAll(".sline").forEach(l => { const ok = words.every(w => norm(l).includes(w)); l.hidden = !ok; inPage += ok; });
    p.querySelectorAll(".sgroup").forEach(g => { const lines = g.querySelectorAll(".sline"); g.hidden = lines.length ? ![...lines].some(l => !l.hidden) : !words.every(w => norm(g).includes(w)); if (!lines.length && !g.hidden) inPage++; });
    p.querySelectorAll(".look-hero,.shop-hero,.lib-stats,.about-hero").forEach(x => x.hidden = true);
    p.hidden = !inPage; found += inPage;
  });
  document.querySelectorAll(".stab").forEach(b => b.classList.toggle("on", !words.length && b.dataset.stab === settingsTab));
  const empty = document.querySelector(".sempty"); if (empty) empty.hidden = !words.length || found > 0;
}

document.addEventListener("input", e => { if (e.target.id === "setq") filterSettings(e.target.value); });
document.addEventListener("click", async e => {
  const t = e.target.closest("[data-stab],[data-act=welcomeAgain],[data-act=libReset]");
  if (!t) return;
  if (t.dataset.stab) { settingsTab = t.dataset.stab; sfx("click"); return render(); }
  if (t.dataset.act === "libReset") {
    try { localStorage.removeItem("ql_lib"); } catch { /* stockage indisponible */ }
    libSort = "recent"; libView = "grid"; libSize = "m"; libFilter = "all"; libPlat = "all"; libLen = "all"; libQuery = "";
    return toast("Affichage de la bibliothèque remis par défaut.", "check");
  }
  await api("/api/sources/onboard", { done: false }); st = await api("/api/state"); view = "sources"; render();
  toast("Guide de démarrage relancé : relie tes comptes puis clique sur « Terminer ».", "sparkles");
});
