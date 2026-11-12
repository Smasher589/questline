/* =====================================================================
   Questline — bibliothèque : recherche, tri, filtres combinables (statut, plateforme, durée),
   vue grille (3 tailles) ou liste détaillée ; réglages d'affichage mémorisés
   ===================================================================== */
const libPrefs = (() => { try { return JSON.parse(localStorage.getItem("ql_lib") || "{}"); } catch { return {}; } })();
let libPlat = "all", libLen = "all", libSort = libPrefs.sort || "recent", libView = libPrefs.view || "grid", libSize = libPrefs.size || "m";
const saveLibPrefs = () => { try { localStorage.setItem("ql_lib", JSON.stringify({ sort: libSort, view: libView, size: libSize })); } catch { /* stockage indisponible */ } };

const LIB_SORTS = [
  ["recent", "Joués récemment", (a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0)],
  ["name", "Nom (A → Z)", (a, b) => a.name.localeCompare(b.name, "fr")],
  ["playtime", "Temps de jeu", (a, b) => (b.playtime || 0) - (a.playtime || 0)],
  ["metacritic", "Note Metacritic", (a, b) => (b.metacritic || 0) - (a.metacritic || 0)],
  ["review", "Avis des joueurs", (a, b) => (b.review || 0) - (a.review || 0)],
  ["short", "Les plus courts", (a, b) => estimateHours(a) - estimateHours(b)],
  ["long", "Les plus longs", (a, b) => estimateHours(b) - estimateHours(a)],
];
const platKey = g => g.platform === "emu" ? "emu:" + (g.system || "Console") : g.platform || "steam";
const platLabel = k => k === "steam" ? "Steam" : k.startsWith("emu:") ? k.slice(4) : (PLAT[k]?.[0] || k);
const lenKey = g => { const h = estimateHours(g); return h <= 12 ? "short" : h <= 30 ? "mid" : "long"; };

function libStatus(g, done) {
  switch (libFilter) {
    case "solo": return finishable(g);
    case "played": return played(g);
    case "done": return done.has(String(g.appid));
    case "installed": return !!g.installed;
    case "never": return !(g.playtime > 0);
    default: return true;
  }
}
function libList() {
  const q = libQuery.trim().toLowerCase(), done = finishedIds();
  const base = lib.filter(g => !q || g.name.toLowerCase().includes(q));
  const byStatus = base.filter(g => libStatus(g, done));
  const byPlat = byStatus.filter(g => libPlat === "all" || platKey(g) === libPlat);
  const list = byPlat.filter(g => libLen === "all" || lenKey(g) === libLen);
  const sort = (LIB_SORTS.find(s => s[0] === libSort) || LIB_SORTS[0])[2];
  list.sort((a, b) => sort(a, b) || a.name.localeCompare(b.name, "fr"));
  return { list, base, byStatus, byPlat, done };
}

function libListRow(g, done) {
  const p = prog(g.appid), id = String(g.appid);
  const status = String(st.current?.appid) === id ? `<span class="lst cur">En cours</span>` : done.has(id) ? `<span class="lst fin">Fini</span>` : inQueue(id) ? `<span class="lst queue">File</span>` : g.installed && g.platform !== "emu" ? `<span class="lst inst">Installé</span>` : "";
  return `<button class="lrow2" data-game="${esc(id)}">
    ${imgTag(id, "cover", "lr-cover", g.name)}
    <span class="lr-name"><b>${esc(g.name)}</b><small>${esc(platLabel(platKey(g)))}${g.dev ? ` · ${esc(g.dev)}` : ""}</small></span>
    <span class="lr-c">${status}</span>
    <span class="lr-c">${g.playtime ? fmtH(g.playtime) : "—"}</span>
    <span class="lr-c">≈ ${estimateHours(g)} h</span>
    <span class="lr-c">${p ? `${p.unlocked}/${p.total}` : "—"}</span>
    <span class="lr-c">${g.metacritic ? mcTag(g) : "—"}</span>
    <span class="lr-c">${g.lastPlayed ? new Date(g.lastPlayed * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" }) : "—"}</span>
  </button>`;
}

function viewLibrary() {
  setBackdrop(null);
  const { list, base, byStatus, byPlat, done } = libList();
  const count = (arr, fn) => arr.filter(fn).length;
  const chip = (attr, key, cur, label, n) => `<button class="lchip ${cur === key ? "on" : ""}" data-${attr}="${key}">${label}${n !== undefined ? `<span>${n}</span>` : ""}</button>`;
  const statuses = [["all", "Tous", () => true], ["solo", "À finir", finishable], ["played", "Déjà joués", played], ["never", "Jamais lancés", g => !(g.playtime > 0)], ["done", "Terminés", g => done.has(String(g.appid))], ["installed", "Installés", g => !!g.installed]];
  const plats = [...new Set(byStatus.map(platKey))].sort((a, b) => (a === "steam" ? -1 : b === "steam" ? 1 : a.localeCompare(b)));
  const active = libFilter !== "all" || libPlat !== "all" || libLen !== "all" || libQuery;
  const sortLabel = (LIB_SORTS.find(s => s[0] === libSort) || LIB_SORTS[0])[1];
  return `
  <div class="page-head"><div><span class="eyebrow">Compte + famille${st.family ? ` ${esc(st.family.name)}` : ""}</span><h2 class="title">Bibliothèque</h2>
    <p class="small" style="margin-top:4px">${lib.length} jeux · ${count(lib, finishable)} à finir · ${done.size} terminé${done.size > 1 ? "s" : ""} · ${fmtH(lib.reduce((a, g) => a + (g.playtime || 0), 0))} de jeu</p></div></div>
  <div class="ltool panel">
    <div class="ltool-top">
      <label class="lsearch">${icon("search", "sm")}<input id="q" placeholder="Rechercher un jeu…" value="${esc(libQuery)}" autocomplete="off">${libQuery ? `<button class="lclear" data-lib="clearq" title="Effacer">${icon("x", "sm")}</button>` : ""}</label>
      <details class="ldd"><summary>${icon("trend", "sm")} ${esc(sortLabel)} ${icon("down", "sm")}</summary>
        <div class="ldd-menu">${LIB_SORTS.map(([k, l]) => `<button class="${k === libSort ? "on" : ""}" data-lsort="${k}">${l}${k === libSort ? icon("check", "sm") : ""}</button>`).join("")}</div></details>
      <div class="lseg" title="Affichage">
        <button class="${libView === "grid" ? "on" : ""}" data-lview="grid" title="Grille">${icon("grid", "sm")}</button>
        <button class="${libView === "list" ? "on" : ""}" data-lview="list" title="Liste">${icon("list", "sm")}</button>
      </div>
      ${libView === "grid" ? `<div class="lseg" title="Taille des jaquettes">${[["s", "S"], ["m", "M"], ["l", "L"]].map(([k, l]) => `<button class="${libSize === k ? "on" : ""}" data-lsize="${k}">${l}</button>`).join("")}</div>` : ""}
    </div>
    <div class="lrow-f"><span class="lf-label">Statut</span>${statuses.map(([k, l, fn]) => chip("lf", k, libFilter, l, count(base, fn))).join("")}</div>
    <div class="lrow-f"><span class="lf-label">Plateforme</span>${chip("lplat", "all", libPlat, "Toutes", byStatus.length)}${plats.map(k => chip("lplat", k, libPlat, esc(platLabel(k)), count(byStatus, g => platKey(g) === k))).join("")}</div>
    <div class="lrow-f"><span class="lf-label">Durée</span>${chip("llen", "all", libLen, "Toutes", byPlat.length)}${[["short", "Courts · 12 h max"], ["mid", "Moyens · 12-30 h"], ["long", "Longs · 30 h et plus"]].map(([k, l]) => chip("llen", k, libLen, l, count(byPlat, g => lenKey(g) === k))).join("")}</div>
  </div>
  <div class="lres"><b>${list.length} jeu${list.length > 1 ? "x" : ""}</b>${active ? `<button class="link" data-lib="reset">${icon("x", "sm")} Réinitialiser les filtres</button>` : ""}</div>
  ${!list.length ? emptyState("search", "Aucun jeu ne correspond", "Change la recherche ou les filtres.", `<button class="btn sm" data-lib="reset">${icon("rotate", "sm")} Réinitialiser</button>`)
    : libView === "list"
      ? `<div class="llist panel"><div class="lr-head"><span></span><span>Jeu</span><span>Statut</span><span>Temps joué</span><span>Durée</span><span>Succès</span><span>Metacritic</span><span>Dernière session</span></div>${list.map(g => libListRow(g, done)).join("")}</div>`
      : `<div class="grid lgrid size-${libSize}">${list.map(g => tile(g)).join("")}</div>`}`;
}

document.addEventListener("click", e => {
  const t = e.target.closest("[data-lf],[data-lplat],[data-llen],[data-lsort],[data-lview],[data-lsize],[data-lib]");
  if (!t) return;
  e.preventDefault();
  if (t.dataset.lf) { libFilter = t.dataset.lf; libPlat = "all"; libLen = "all"; }
  else if (t.dataset.lplat) { libPlat = t.dataset.lplat; libLen = "all"; }
  else if (t.dataset.llen) libLen = t.dataset.llen;
  else if (t.dataset.lsort) libSort = t.dataset.lsort;
  else if (t.dataset.lview) libView = t.dataset.lview;
  else if (t.dataset.lsize) libSize = t.dataset.lsize;
  else if (t.dataset.lib === "reset") { libFilter = "all"; libPlat = "all"; libLen = "all"; libQuery = ""; }
  else if (t.dataset.lib === "clearq") libQuery = "";
  saveLibPrefs(); sfx("click"); render();
});
// fermer le menu de tri en cliquant ailleurs
document.addEventListener("click", e => { document.querySelectorAll("details.ldd[open]").forEach(d => { if (!d.contains(e.target)) d.removeAttribute("open"); }); });
