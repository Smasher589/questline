/* =====================================================================
   Questline — palmarès : podium or / argent / bronze, dernier exploit, jeux à portée du 100 %,
   vitrine filtrable, scan des succès Steam et abandons
   ===================================================================== */
let palFilter = "all";
const PAL_TIERS = {
  gold: { cup: "cup-gold", label: "Or", long: "Fini à 100 %", hint: "tous les succès débloqués" },
  silver: { cup: "cup-silver", label: "Argent", long: "Histoire terminée", hint: "fin de l'histoire atteinte" },
  bronze: { cup: "cup-bronze", label: "Bronze", long: "Validé avec Questline", hint: "terminé et validé dans l'app" },
};
const cupImg = (tier, cls = "") => `<img class="${cls}" src="/static/art/trophies/${PAL_TIERS[tier].cup}.png" alt="Coupe ${PAL_TIERS[tier].label}" loading="lazy">`;
const frDate = (d, opt = { day: "numeric", month: "long", year: "numeric" }) => (d ? new Date(d).toLocaleDateString("fr-FR", opt) : "");

// un seul exploit par jeu, au meilleur rang obtenu
function palEntries() {
  const fin = new Map(st.finished.map(f => [String(f.appid), f]));
  const ids = new Set([...Object.keys(progress).filter(id => byId(id) && (progress[id].perfect || progress[id].storyDone)), ...fin.keys()]);
  return [...ids].map(id => {
    const p = prog(id), f = fin.get(id), g = byId(id) || { appid: id, name: f?.name || "Jeu", playtime: 0 };
    const tier = p?.perfect ? "gold" : p?.storyDone ? "silver" : "bronze";
    const at = f?.at ? new Date(f.at).getTime() : (g.lastPlayed || 0) * 1000;
    return { id, g, p, f, tier, at };
  }).sort((a, b) => b.at - a.at || a.g.name.localeCompare(b.g.name, "fr"));
}

function achBar(p) {
  if (!p?.total) return `<span class="pal-noach">Pas de succès suivis</span>`;
  const pct = Math.round(p.unlocked / p.total * 100);
  return `<div class="pal-ach"><div class="pal-bar"><i style="width:${pct}%"></i></div><span>${p.unlocked}/${p.total} succès · ${pct} %</span></div>`;
}

function palPodium(list) {
  const n = t => list.filter(e => e.tier === t).length;
  const ach = list.reduce((a, e) => a + (e.p?.unlocked || 0), 0);
  const hours = list.reduce((a, e) => a + (e.g.playtime || 0), 0);
  return `<div class="pal-hero panel">
    <div class="pal-podium">${["silver", "gold", "bronze"].map(t => `
      <button class="pal-step ${t} ${palFilter === t ? "on" : ""}" data-pal="${palFilter === t ? "all" : t}" title="${PAL_TIERS[t].long} : ${PAL_TIERS[t].hint}">
        ${cupImg(t, "pal-cup")}<b>${n(t)}</b><span>${PAL_TIERS[t].long}</span><i class="pal-plinth">${PAL_TIERS[t].label}</i>
      </button>`).join("")}</div>
    <div class="pal-sum">
      <div><b>${list.length}</b><span>jeu${list.length > 1 ? "x" : ""} terminé${list.length > 1 ? "s" : ""}</span></div>
      <div><b>${ach}</b><span>succès débloqués</span></div>
      <div><b>${fmtH(hours)}</b><span>passées sur ces jeux</span></div>
    </div>
  </div>`;
}

function palSpotlight(e) {
  if (!e) return "";
  const t = PAL_TIERS[e.tier];
  return `<button class="pal-spot panel" data-game="${esc(e.id)}">
    ${imgTag(e.id, "hero", "pal-spot-bg", "")}
    <div class="pal-spot-in">
      ${cupImg(e.tier, "pal-spot-cup")}
      <div class="pal-spot-txt">
        <span class="eyebrow">Dernier exploit · ${t.long}</span>
        <h3>${esc(e.g.name)}</h3>
        <p>${[e.f?.story?.name ? `« ${esc(e.f.story.name)} »` : e.p?.story ? `« ${esc(e.p.story)} »` : "", e.g.playtime ? fmtH(e.g.playtime) + " de jeu" : "", e.at ? "le " + frDate(e.at) : ""].filter(Boolean).join(" · ")}</p>
        ${achBar(e.p)}
      </div>
      <span class="pal-spot-go">${icon("arrow", "sm")} Voir la fiche</span>
    </div>
  </button>`;
}

function palNearPerfect() {
  const near = Object.entries(progress)
    .filter(([id, p]) => byId(id) && !p.perfect && p.total >= 5 && p.unlocked / p.total >= .5)
    .sort((a, b) => b[1].unlocked / b[1].total - a[1].unlocked / a[1].total).slice(0, 6);
  if (!near.length) return "";
  return `<div class="sec-head"><h3 class="sec">${icon("target")} À portée du 100 % <span class="count">${near.length}</span></h3><span class="small">Les jeux où il te reste le moins de succès pour décrocher l'or</span></div>
  <div class="pal-near">${near.map(([id, p]) => `<button class="pal-nr panel" data-game="${esc(id)}">
    ${imgTag(id, "cover", "pal-nr-cover", byId(id).name)}
    <div><b>${esc(byId(id).name)}</b>${achBar(p)}<small>Encore <b>${p.total - p.unlocked}</b> succès pour l'or</small></div>
  </button>`).join("")}</div>`;
}

function palCard(e) {
  const t = PAL_TIERS[e.tier];
  return `<button class="pal-card panel ${e.tier}" data-game="${esc(e.id)}">
    <div class="pal-cover">${imgTag(e.id, "cover", "", e.g.name)}${cupImg(e.tier, "pal-medal")}</div>
    <div class="pal-body">
      <span class="pal-tier ${e.tier}">${t.long}</span>
      <b>${esc(e.g.name)}</b>
      ${achBar(e.p)}
      <small>${[e.g.playtime ? fmtH(e.g.playtime) : "", e.at ? frDate(e.at, { day: "numeric", month: "short", year: "numeric" }) : ""].filter(Boolean).join(" · ")}${e.g.metacritic ? " " + mcTag(e.g) : ""}</small>
    </div>
  </button>`;
}

function palScan() {
  const run = scanRun, playedCount = lib.filter(g => g.playtime > 0 && isSteam(g.appid)).length;
  return `<div class="pal-scan panel">
    <span class="ico-box">${icon(run && !run.done ? "refresh" : "search")}</span>
    <div>${run && !run.done
      ? `<b>Scan en cours : ${run.i}/${run.total}</b><small>${esc(run.name || "")} · Steam ouvre la page de chaque jeu pour envoyer ses succès.</small><div class="pal-bar" style="margin-top:8px"><i style="width:${Math.round(run.i / run.total * 100)}%"></i></div>`
      : `<b>Un exploit manque ?</b><small>Questline lit les succès que Steam garde sur ton PC. Pour les jeux finis ailleurs ou il y a longtemps, lance un scan de tes ${playedCount} jeux joués (≈ ${Math.ceil(playedCount * 3 / 60)} min).</small>`}</div>
    ${run && !run.done ? `<button class="btn sm" data-act="scanStop">${icon("x", "sm")} Arrêter</button>` : `<button class="btn sm" data-act="scan">${icon("refresh", "sm")} Scanner mes succès</button>`}
  </div>`;
}

function viewTrophies() {
  const all = palEntries();
  setBackdrop(all[0]?.id);
  const shown = palFilter === "all" ? all : all.filter(e => e.tier === palFilter);
  const gold = all.filter(e => e.tier === "gold").length;
  const chip = (k, l, n) => `<button class="lchip ${palFilter === k ? "on" : ""}" data-pal="${k}">${l}<span>${n}</span></button>`;
  return `
  <div class="page-head"><div><span class="eyebrow">Salle des trophées</span><h2 class="title">${all.length} jeu${all.length > 1 ? "x" : ""} terminé${all.length > 1 ? "s" : ""}${gold ? `, dont <span class="gtext">${gold} à 100 %</span>` : ""}</h2></div>
    <button class="btn sm" data-act="recap">${icon("calendar", "sm")} Mon récap ${new Date().getFullYear()}</button></div>
  ${!all.length ? emptyState("trophy", "Ta vitrine est vide pour l'instant", "Termine ta quête en cours, ou lance un scan pour retrouver les jeux que tu as déjà finis.", `<button class="btn sm" data-act="scan">${icon("refresh", "sm")} Scanner mes succès</button>`)
    : `${palPodium(all)}${palSpotlight(all[0])}
  ${palNearPerfect()}
  <div class="sec-head"><h3 class="sec">${icon("trophy")} Ta vitrine</h3>
    <div class="pal-chips">${chip("all", "Tous", all.length)}${["gold", "silver", "bronze"].map(t => chip(t, PAL_TIERS[t].label, all.filter(e => e.tier === t).length)).join("")}</div></div>
  ${shown.length ? `<div class="pal-grid">${shown.map(palCard).join("")}</div>` : `<p class="small">Aucun jeu dans cette catégorie pour l'instant.</p>`}`}
  ${palScan()}
  ${st.abandoned.length ? `<div class="sec-head"><h3 class="sec">${icon("ban")} Abandonnés <span class="count">${st.abandoned.length}</span></h3><span class="small">Pas de honte : ils ont libéré de la place pour les autres</span></div>
    <div class="pal-ab">${st.abandoned.map(f => `<button class="pal-abi" data-game="${esc(f.appid)}">${imgTag(f.appid, "cover", "", f.name)}<span>${esc(byId(f.appid)?.name || f.name)}</span></button>`).join("")}</div>` : ""}`;
}

document.addEventListener("click", e => {
  const t = e.target.closest("[data-pal]");
  if (!t) return;
  palFilter = t.dataset.pal; sfx("click"); render();
});
