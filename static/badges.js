/* =====================================================================
   Questline — badges & défis : rang et XP, défis du mois, objectifs presque atteints,
   onglets badges / succès à paliers / origine de l'XP
   ===================================================================== */
let badgeTab = "badges";

function challengeCard(c) {
  const done = c.p >= 1, pct = Math.round(c.p * 100);
  return `<div class="bch panel ${done ? "done" : ""}">
    <span class="bch-ico">${done ? `<img src="${trophyImg("medal", c.xp)}" alt="Médaille">` : icon(c.i || "target")}</span>
    <div class="bch-txt"><b>${esc(c.n)}</b>
      <div class="pal-bar"><i style="width:${pct}%"></i></div>
      <div class="bch-foot"><small>${done ? `${icon("check", "sm")} Réussi` : `${c.cur} / ${c.goal} ${esc(c.u)}`}</small><span class="bch-xp ${done ? "got" : ""}">+${c.xp} XP</span></div></div>
  </div>`;
}

function rankTrack(pd) {
  return `<div class="brk">${RANKS.map(r => {
    const got = pd.level >= r.lv, cur = r === pd.rank;
    return `<span class="brk-s ${got ? "got" : ""} ${cur ? "cur" : ""}" style="--rc:${r.c}" title="${r.n} · niveau ${r.lv}">${icon(r.i, "sm")}${cur ? `<small>${r.n}</small>` : ""}</span>`;
  }).join("")}</div>`;
}

function badgeHero(pd) {
  const span = Math.max(1, pd.to - pd.from), into = pd.xp - pd.from, pct = Math.round(clamp(into / span) * 100);
  const earned = pd.badges.filter(b => b.earned).length, chDone = pd.challenges.filter(c => c.p >= 1).length;
  return `<div class="bhero panel" style="--rc:${pd.rank.c}">
    <div class="bhero-emb">${rankEmblem(pd.level, 132)}</div>
    <div class="bhero-main">
      <span class="eyebrow">Rang ${esc(pd.rank.n)}</span>
      <h2>Niveau ${pd.level}</h2>
      <div class="bxp"><div class="bxp-bar"><i style="width:${pct}%"></i></div>
        <div class="bxp-l"><span><b>${into.toLocaleString("fr-FR")}</b> / ${span.toLocaleString("fr-FR")} XP</span><span>encore ${(span - into).toLocaleString("fr-FR")} XP pour le niveau ${pd.level + 1}</span></div></div>
      ${rankTrack(pd)}
      <p class="small">${pd.next ? `Prochain rang : <b style="color:${pd.next.c}">${pd.next.n}</b> au niveau ${pd.next.lv}, encore ${(xpFor(pd.next.lv) - pd.xp).toLocaleString("fr-FR")} XP.` : "Tu as atteint le rang ultime."}</p>
    </div>
    <div class="bhero-stats">
      <div><b>${pd.xp.toLocaleString("fr-FR")}</b><span>XP au total</span></div>
      <div><b>${earned}<small>/${pd.badges.length}</small></b><span>badges</span></div>
      <div><b>${chDone}<small>/${pd.challenges.length}</small></b><span>défis du mois</span></div>
    </div>
  </div>`;
}

// les objectifs les plus proches, badges et paliers confondus
function badgeNext(pd) {
  const items = [
    ...pd.badges.filter(b => !b.earned && b.p > 0).map(b => ({ kind: "badge", id: b.id, n: b.n, p: b.p, left: b.goal - b.cur, u: b.u, xp: b.t.xp, art: medal(b, 56) })),
    ...pd.tiers.filter(f => f.next && f.p > 0).map(f => ({ kind: "tier", id: f.id, n: `${f.n} · palier ${TIER_NAMES[f.level]}`, p: f.p, left: f.next - f.cur, u: f.u, xp: tierXp(f.level + 1), art: `<img src="${tierArt(f, f.level + 1)}" alt="">` })),
  ].sort((a, b) => b.p - a.p).slice(0, 4);
  if (!items.length) return "";
  return `<div class="sec-head"><h3 class="sec">${icon("target")} Presque débloqués</h3><span class="small">Les objectifs les plus proches, badges et paliers confondus</span></div>
  <div class="bnext">${items.map(x => `<button class="bnx panel" data-${x.kind}="${esc(x.id)}">
    <span class="bnx-art">${x.art}</span>
    <div><b>${esc(x.n)}</b><div class="pal-bar"><i style="width:${Math.round(x.p * 100)}%"></i></div>
      <small>Encore <b>${x.left.toLocaleString("fr-FR")}</b> ${esc(x.u)} · +${x.xp} XP</small></div>
  </button>`).join("")}</div>`;
}

function badgeGrid(pd) {
  const shown = pd.badges.filter(b => badgeFilter === "all" || (badgeFilter === "earned") === b.earned);
  const f = (k, l, n) => `<button class="lchip ${badgeFilter === k ? "on" : ""}" data-bfilter="${k}">${l}<span>${n}</span></button>`;
  const earned = pd.badges.filter(b => b.earned).length;
  return `<div class="bfilters">${f("all", "Tous", pd.badges.length)}${f("earned", "Obtenus", earned)}${f("locked", "À débloquer", pd.badges.length - earned)}</div>
  ${TIER_ORDER.map(tier => {
    const list = shown.filter(b => b.tier === tier); if (!list.length) return "";
    const t = TIERS[tier], got = list.filter(b => b.earned).length;
    return `<div class="btier" style="--tc:${t.glow}"><span>${t.r}</span><small>${t.n} · +${t.xp} XP par badge · ${got}/${list.length}</small></div>
      <div class="bgrid">${list.map(b => `<button class="bcard2 panel ${b.earned ? "earned" : ""}" data-badge="${b.id}" style="--tc:${t.glow}">
        ${medal(b, 72)}<b>${esc(b.n)}</b><small>${esc(b.d)}</small>
        ${b.earned ? `<span class="bgot">${icon("check", "sm")} Obtenu</span>` : `<span class="bprog"><span class="pal-bar"><i style="width:${Math.round(b.p * 100)}%"></i></span><span>${b.cur.toLocaleString("fr-FR")} / ${b.goal.toLocaleString("fr-FR")}</span></span>`}
      </button>`).join("")}</div>`;
  }).join("")}`;
}

function tierCard(f) {
  return `<button class="tcard2 panel ${f.level ? "got" : ""}" data-tier="${f.id}">
    <img class="temb ${f.level ? "" : "locked"}" src="${tierArt(f, f.level || 1)}" alt="" loading="lazy">
    <div class="tinfo2"><span class="tlv">${f.level ? `Palier ${TIER_NAMES[f.level - 1]}` : "À débloquer"} <small>${f.level}/12</small></span>
      <b>${esc(f.n)}</b>
      <span class="tpips2">${f.steps.map((_, k) => `<i class="${k < f.level ? "on" : k === f.level ? "next" : ""}"></i>`).join("")}</span>
      <small>${f.next ? `${f.cur.toLocaleString("fr-FR")} / ${f.next.toLocaleString("fr-FR")} ${esc(f.u)}` : `Palier maximum : ${f.cur.toLocaleString("fr-FR")} ${esc(f.u)}`}</small>
    </div></button>`;
}

function xpTable(pd) {
  const max = Math.max(1, ...pd.breakdown.map(r => r.xp));
  return `<div class="bxpt panel">${pd.breakdown.map(r => `<div class="bxr"><span class="ico-box">${icon(r.i, "sm")}</span><span class="bxr-l">${r.l}<small>${r.each ? `${r.n} × ${r.each} XP` : `${r.n}`}</small></span>
      <div class="pal-bar"><i style="width:${Math.round(r.xp / max * 100)}%"></i></div><b>${r.xp.toLocaleString("fr-FR")} XP</b></div>`).join("")}
    <div class="bxr total"><span></span><span class="bxr-l">Total</span><span></span><b>${pd.xp.toLocaleString("fr-FR")} XP</b></div></div>`;
}

function viewBadges() {
  setBackdrop(null);
  const pd = profileData();
  const earned = pd.badges.filter(b => b.earned).length, tiersGot = pd.tiers.reduce((a, f) => a + f.level, 0);
  const tab = (k, ic, l, n) => `<button class="btab ${badgeTab === k ? "on" : ""}" data-btab="${k}">${icon(ic, "sm")} ${l}${n ? `<span>${n}</span>` : ""}</button>`;
  return `
  <div class="page-head"><div><span class="eyebrow">Progression</span><h2 class="title">Badges & défis</h2></div></div>
  ${badgeHero(pd)}
  <div class="sec-head"><h3 class="sec">${icon("calendar")} Défis de ${new Date().toLocaleDateString("fr-FR", { month: "long" })}</h3><span class="pill">${icon("hourglass", "sm")} Plus que ${daysLeftInMonth()} jours</span></div>
  <div class="bch-grid">${pd.challenges.map(challengeCard).join("")}</div>
  ${badgeNext(pd)}
  <div class="btabs">${tab("badges", "award", "Badges", `${earned}/${pd.badges.length}`)}${tab("tiers", "medal", "Succès à paliers", `${tiersGot}/${pd.tiers.length * 12}`)}${tab("xp", "zap", "D'où vient ton XP", "")}</div>
  ${badgeTab === "tiers" ? `<p class="small bnote">${icon("zap", "sm")} De ${tierXp(1)} à ${tierXp(12)} XP par palier. Clique sur une carte pour voir les 12 paliers.</p><div class="tgrid2">${pd.tiers.map(tierCard).join("")}</div>`
    : badgeTab === "xp" ? xpTable(pd) : badgeGrid(pd)}`;
}

document.addEventListener("click", e => {
  const t = e.target.closest("[data-btab]");
  if (!t) return;
  badgeTab = t.dataset.btab; sfx("click"); render();
});
