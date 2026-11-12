/* =====================================================================
   Questline — page « Sources » : comptes, émulateurs, jeux ajoutés à la main, jaquettes
   ===================================================================== */
let srcData = null, srcLoading = false;
const srcForm = { system: "", emulator: "", exe: "", romDirs: [], msg: "", game: { name: "", exe: "", args: "" }, sgdb: "" };
const desktop = () => window.questline && window.questline.desktop;

async function loadSources() {
  if (srcLoading) return;
  srcLoading = true;
  try { srcData = await api("/api/sources"); } catch (e) { srcData = { error: e.message }; }
  srcLoading = false;
  if (view === "sources") render();
}
async function srcAction(name, body, okMsg) {
  try {
    const r = await api(`/api/sources/${name}`, body);
    if (okMsg) toast(okMsg, "check");
    await loadLibrary(true);
    await loadSources();
    return r;
  } catch (e) { toast(e.message, "info"); return null; }
}

// guide du premier lancement : 3 étapes, les menus s'ouvrent une fois la configuration terminée
function srcSetup(linked) {
  const games = lib.length, onboard = st.onboarded === false;
  const step = (ok, n, t, d) => `<div class="sstep ${ok ? "ok" : ""}"><span>${ok ? icon("check", "sm") : n}</span><div><b>${t}</b><small>${d}</small></div></div>`;
  return `<div class="src-setup panel">
    <div class="src-setup-top">
      <span class="ico-box acc">${icon("sparkles")}</span>
      <div><span class="eyebrow">Bienvenue dans Questline</span>
        <h3>${games ? "Tes jeux sont prêts" : "Commence par relier un lanceur"}</h3>
        <p>Les autres menus ${icon("lock", "sm")} s'ouvrent dès que Questline connaît tes jeux. <b>Aucun mot de passe</b> n'est demandé et <b>aucun compte n'est relié sans ton accord</b>.</p></div>
    </div>
    <div class="ssteps">
      ${step(linked > 0, 1, "Relier un lanceur", linked ? `${linked} source${linked > 1 ? "s" : ""} active${linked > 1 ? "s" : ""}` : "Steam, Epic, GOG, Ubisoft ou Amazon")}
      ${step(games > 0, 2, "Retrouver tes jeux", games ? `${games} jeu${games > 1 ? "x" : ""} trouvé${games > 1 ? "s" : ""}` : "Ou ajoute un émulateur ou un jeu à la main")}
      ${step(!onboard && games > 0, 3, "Ouvrir tous les menus", "Ta première quête t'attend")}
    </div>
    ${onboard ? `<div class="src-setup-go">${games ? spaceBtn(`${icon("check", "sm")} Terminer et ouvrir Questline`, "wlDone") : `<button class="btn" disabled>${icon("lock", "sm")} Relie un lanceur pour continuer</button>`}</div>` : ""}
  </div>`;
}

function emuCard(e, cat) {
  const s = cat.find(x => x.id === e.system), em = s && s.emulators.find(x => x.id === e.emulator);
  return `<div class="src-card panel on">
    <div class="src-head"><span class="ico-box">${icon("monitor")}</span><div><b>${esc(s ? s.name : e.system)}</b><small>${esc(em ? em.name : e.emulator)}</small></div>
      <span class="pill ${e.games ? "ok" : ""}">${e.games} jeu${e.games > 1 ? "x" : ""}</span>
      <button class="btn sm icon" title="Retirer cet émulateur" data-src="emu-remove" data-id="${esc(e.id)}">${icon("trash", "sm")}</button></div>
    <div class="src-paths">
      <span class="${e.exeFound ? "" : "warn"}">${icon(e.exeFound ? "play" : "info", "sm")} ${e.exeFound ? "" : "Introuvable : "}${esc(e.exe)}</span>
      ${e.romDirs.map(d => `<span>${icon("folder", "sm")} ${esc(d)}</span>`).join("")}
    </div></div>`;
}

function emuForm(cat) {
  const sys = cat.find(s => s.id === srcForm.system);
  const ready = srcForm.system && srcForm.emulator && srcForm.exe && srcForm.romDirs.length;
  const n = (k, ok) => `<span class="fnum ${ok ? "ok" : ""}">${ok ? icon("check", "sm") : k}</span>`;
  return `<div class="src-form panel">
    <h4>${icon("plus", "sm")} Ajouter un émulateur</h4>
    <div class="frow">${n(1, srcForm.system && srcForm.emulator)}<div class="fbody"><b>Console et émulateur</b>
      <div class="fctl"><select data-src-field="system"><option value="">Choisis une console</option>${cat.map(s => `<option value="${s.id}" ${srcForm.system === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select>
      <select data-src-field="emulator" ${sys ? "" : "disabled"}><option value="">Choisis un émulateur</option>${(sys ? sys.emulators : []).map(e => `<option value="${e.id}" ${srcForm.emulator === e.id ? "selected" : ""}>${esc(e.name)}</option>`).join("")}</select></div>
      ${sys ? `<small>Fichiers reconnus : ${sys.exts.map(x => "." + x).join(", ")}</small>` : ""}</div></div>
    <div class="frow">${n(2, srcForm.exe)}<div class="fbody"><b>Programme de l'émulateur</b>
      <div class="fctl"><input class="input" data-src-field="exe" placeholder="Chemin de l'émulateur (.exe)" value="${esc(srcForm.exe)}">
      <button class="btn sm" data-src="detect" ${srcForm.emulator ? "" : "disabled"}>${icon("search", "sm")} Détecter</button>
      ${desktop() ? `<button class="btn sm" data-src="pick-exe">${icon("folder", "sm")} Parcourir…</button>` : ""}</div>
      ${srcForm.msg ? `<small>${esc(srcForm.msg)}</small>` : ""}</div></div>
    <div class="frow">${n(3, srcForm.romDirs.length)}<div class="fbody"><b>Dossiers de jeux</b>
      ${srcForm.romDirs.map((d, i) => `<span class="fdir">${icon("folder", "sm")} ${esc(d)} <button class="link" data-src="dir-remove" data-i="${i}">retirer</button></span>`).join("")}
      <div class="fctl">${desktop() ? `<button class="btn sm" data-src="pick-dir">${icon("folder", "sm")} Ajouter un dossier…</button>` : `<input class="input" data-src-field="dirInput" placeholder="Dossier de jeux puis Entrée">`}</div></div></div>
    <div class="src-form-go"><button class="btn-play" data-src="emu-save" ${ready ? "" : "disabled"}>${icon("check", "sm")} Enregistrer l'émulateur</button></div>
  </div>`;
}

function viewSources() {
  setBackdrop(null);
  if (!srcData) { loadSources(); return `<div class="center"><div class="loader"></div><p class="small">Recherche de tes launchers et émulateurs…</p></div>`; }
  if (srcData.error) return emptyState("info", "Sources indisponibles", esc(srcData.error));
  const cat = srcData.catalog;
  const linked = Object.values(srcData.accounts).filter(x => x.enabled).length + srcData.emulators.length + (srcData.manualGames.length ? 1 : 0);
  return `
  <div class="page-head"><div><span class="eyebrow">Réglages</span><h2 class="title">Sources</h2>
    <p class="small" style="margin-top:4px">${linked} source${linked > 1 ? "s" : ""} active${linked > 1 ? "s" : ""} · ${lib.length} jeu${lib.length > 1 ? "x" : ""} dans ta bibliothèque</p></div>
    <div class="row" style="gap:8px">${setupMode() ? "" : `<button class="btn sm" data-src="welcome">${icon("sparkles", "sm")} Revoir le guide</button>`}<button class="btn sm" data-src="refresh">${icon("refresh", "sm")} Tout rescanner</button></div></div>
  ${setupMode() ? srcSetup(linked) : ""}
  <div class="sec-head"><h3 class="sec">${icon("layers")} Lanceurs</h3><span class="small">Reliés par identifiant public, jamais par mot de passe</span></div>
  <div class="src-grid">${accountsSection()}</div>
  <div class="sec-head"><h3 class="sec">${icon("monitor")} Émulateurs <span class="count">${srcData.emulators.length}</span></h3><span class="small">Switch, Wii U, PlayStation, rétro… avec jaquettes et lancement direct</span></div>
  ${srcData.emulators.length ? `<div class="src-grid">${srcData.emulators.map(e => emuCard(e, cat)).join("")}</div>` : ""}
  ${emuForm(cat)}
  <div class="sec-head"><h3 class="sec">${icon("plus")} Autres sources</h3></div>
  <div class="src-grid">
    <div class="src-card panel">
      <div class="src-head"><span class="ico-box">${icon("gamepad")}</span><div><b>Jeux PC ajoutés à la main</b><small>Hors launcher : itch.io, version DRM-free…</small></div><span class="pill">${srcData.manualGames.length}</span></div>
      <div class="src-body">
        ${srcData.manualGames.map(g => `<div class="src-item"><span><b>${esc(g.name)}</b><small class="${g.exeFound ? "" : "warn"}">${g.exeFound ? "" : "Introuvable : "}${esc(g.exe)}</small></span><button class="btn sm icon" title="Retirer" data-src="game-remove" data-id="${esc(g.id)}">${icon("trash", "sm")}</button></div>`).join("")}
        <div class="src-fields">
          <input class="input" data-src-game="name" placeholder="Nom du jeu" value="${esc(srcForm.game.name)}">
          <div class="fctl"><input class="input" data-src-game="exe" placeholder="Exécutable du jeu" value="${esc(srcForm.game.exe)}">${desktop() ? `<button class="btn sm" data-src="pick-game">${icon("folder", "sm")}</button>` : ""}</div>
          <input class="input" data-src-game="args" placeholder="Arguments (facultatif)" value="${esc(srcForm.game.args)}">
          <button class="btn sm" data-src="game-save">${icon("plus", "sm")} Ajouter le jeu</button>
        </div>
      </div>
    </div>
    <div class="src-card panel">
      <div class="src-head"><span class="ico-box">${icon("image")}</span><div><b>Jaquettes</b><small>Trouvées automatiquement pour la plupart des jeux</small></div><span class="pill ${srcData.steamGridDb ? "ok" : ""}">${srcData.steamGridDb ? "Clé ajoutée" : "Facultatif"}</span></div>
      <div class="src-body">
        <p class="small">Sources utilisées : titledb et Nintendo (Switch), GameTDB (Wii, GameCube), libretro-thumbnails (rétro, PlayStation, Xbox 360…). Pour les jeux introuvables, ajoute une clé gratuite <b>SteamGridDB</b> (steamgriddb.com > Préférences > API).</p>
        <div class="fctl"><input class="input" type="password" data-src-sgdb placeholder="${srcData.steamGridDb ? "Clé enregistrée" : "Clé API SteamGridDB"}" value="${esc(srcForm.sgdb)}">
          <button class="btn sm" data-src="sgdb-save">${icon("check", "sm")} Enregistrer</button></div>
      </div>
    </div>
  </div>`;
}

// ------------------------------------------------------------ actions
document.addEventListener("input", e => {
  const t = e.target;
  if (t.dataset.srcField === "exe") srcForm.exe = t.value;
  if (t.dataset.srcGame) srcForm.game[t.dataset.srcGame] = t.value;
  if (t.matches("[data-src-sgdb]")) srcForm.sgdb = t.value.trim();
});
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.dataset.srcField === "dirInput" && e.target.value.trim()) { srcForm.romDirs.push(e.target.value.trim()); render(); }
});
document.addEventListener("change", async e => {
  const t = e.target;
  if (t.dataset.srcField === "system") { srcForm.system = t.value; srcForm.emulator = ""; srcForm.msg = ""; return render(); }
  if (t.dataset.srcField === "emulator") { srcForm.emulator = t.value; return render(); }
});
document.addEventListener("click", async e => {
  const t = e.target.closest("[data-src]");
  if (!t || t.disabled) return;
  e.preventDefault();
  const pick = async kind => (await window.questline.pick(kind)) || [];
  switch (t.dataset.src) {
    case "welcome": await api("/api/sources/onboard", { done: false }); st = await api("/api/state"); render(); break;
    case "refresh": srcData = null; render(); await srcAction("refresh", {}, "Bibliothèque rescannée."); break;
    case "detect": {
      const r = await api("/api/sources/detect", { system: srcForm.system, emulator: srcForm.emulator }).catch(err => ({ error: err.message }));
      if (r.exe) { srcForm.exe = r.exe; srcForm.msg = "Émulateur trouvé."; } else srcForm.msg = r.error;
      render(); break;
    }
    case "pick-exe": { const [p] = await pick(window.questline.platform === "darwin" ? "app" : "file"); if (p) { srcForm.exe = p; render(); } break; }
    case "pick-dir": { const ps = await pick("folder"); srcForm.romDirs.push(...ps.filter(p => !srcForm.romDirs.includes(p))); render(); break; }
    case "dir-remove": srcForm.romDirs.splice(+t.dataset.i, 1); render(); break;
    case "emu-save": {
      const r = await srcAction("emulator", { op: "add", entry: { system: srcForm.system, emulator: srcForm.emulator, exe: srcForm.exe, romDirs: srcForm.romDirs } }, "Émulateur ajouté : recherche des jeux et jaquettes…");
      if (r) Object.assign(srcForm, { system: "", emulator: "", exe: "", romDirs: [], msg: "" });
      render(); break;
    }
    case "emu-remove": await srcAction("emulator", { op: "remove", id: t.dataset.id }, "Émulateur retiré."); break;
    case "pick-game": { const [p] = await pick("file"); if (p) { srcForm.game.exe = p; render(); } break; }
    case "game-save": {
      const r = await srcAction("manual", { op: "add", ...srcForm.game }, "Jeu ajouté.");
      if (r) srcForm.game = { name: "", exe: "", args: "" };
      render(); break;
    }
    case "game-remove": await srcAction("manual", { op: "remove", id: t.dataset.id }, "Jeu retiré."); break;
    case "sgdb-save": { await srcAction("sgdb", { key: srcForm.sgdb }, "Clé SteamGridDB enregistrée."); srcForm.sgdb = ""; render(); break; }
  }
});
