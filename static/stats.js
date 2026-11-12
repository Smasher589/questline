/* =====================================================================
   Questline — statistiques : chiffres clés, backlog, progression, calendrier d'activité,
   temps par mois, genres, plateformes et jeux les plus joués
   ===================================================================== */
const STAT_HIDDEN_TAGS = [492, 4182, 3859, 7368];      // étiquettes trop générales (indé, solo, multi…)
const pctTxt = r => (r > 0 && r < .01 ? "< 1" : Math.round(r * 100)) + " %";

function statKpis(s) {
  const k = (ic, v, l, sub, cls = "") => `<div class="skpi ${cls}"><span class="ico-box">${icon(ic)}</span><div><b>${v}</b><span>${l}</span>${sub ? `<small>${sub}</small>` : ""}</div></div>`;
  return `<div class="skpis panel">
    ${k("trophy", s.fin, `jeu${s.fin > 1 ? "x" : ""} terminé${s.fin > 1 ? "s" : ""}`, s.perfect ? `dont ${s.perfect} à 100 %` : "", "gold")}
    ${k("clock", fmtH(s.total), "de jeu au total", `${fmtH(s.year)} en ${new Date().getFullYear()}`)}
    ${k("calendar", fmtH(s.month), "joués ce mois-ci", `${[...s.days].filter(d => d.startsWith(new Date().toISOString().slice(0, 7))).length} jour(s) de jeu`)}
    ${k("flame", `${s.streak} j`, "série en cours", `record : ${s.best} j`, "fire")}
  </div>`;
}

function statBacklog(s) {
  const fin = finishedIds();
  const done = lib.filter(g => fin.has(String(g.appid))).length;
  const started = lib.filter(g => played(g) && !fin.has(String(g.appid))).length;
  const never = lib.filter(g => !g.playtime).length;
  const total = Math.max(1, done + started + never);
  const seg = [["done", done, "terminés"], ["started", started, "commencés"], ["never", never, "jamais lancés"]];
  return `<div class="scard panel">
    <h4>${icon("grid", "sm")} Ton backlog</h4>
    <div class="sbig"><b>${pctTxt(s.rate)}</b><span>de ta bibliothèque terminée</span></div>
    <div class="sstack">${seg.map(([k, n]) => n ? `<i class="${k}" style="flex:${n}" title="${n}"></i>` : "").join("")}</div>
    <div class="slegend">${seg.map(([k, n, l]) => `<span><i class="${k}"></i><b>${n}</b> ${l} <small>${Math.round(n / total * 100)} %</small></span>`).join("")}</div>
    <div class="sback-note">${started
      ? `Tu as <b>${started} jeu${started > 1 ? "x" : ""} commencé${started > 1 ? "s" : ""}</b> sans les finir. Terminer les plus courts est le moyen le plus rapide de faire grimper ce pourcentage.`
      : `Aucun jeu commencé en attente : chaque nouvelle quête part d'une page blanche.`}</div>
  </div>`;
}

function statProgress(pd) {
  const p = Math.round(clamp((pd.xp - pd.from) / Math.max(1, pd.to - pd.from)) * 100);
  const month = new Date().toISOString().slice(0, 7);
  return `<div class="scard panel">
    <h4>${icon("award", "sm")} Progression</h4>
    <div class="sbig"><b>Niv. ${pd.level}</b><span>${esc(titleOf(pd.level))}</span></div>
    <div class="slvl"><div class="pal-bar"><i style="width:${p}%"></i></div><small>${pd.xp - pd.from} / ${pd.to - pd.from} XP vers le niveau ${pd.level + 1}</small></div>
    <div class="sminis">
      <div><b>${pd.xp}</b><span>XP au total</span></div>
      <div><b>${pd.badges.filter(b => b.earned).length}/${pd.badges.length}</b><span>badges</span></div>
      <div><b>${st.blocked.filter(b => (b.at || "").startsWith(month)).length}</b><span>tentations résistées ce mois</span></div>
    </div>
  </div>`;
}

function statHeat(s, x) {
  const WEEKS = 26, lastPlayedDays = new Set(lib.filter(g => g.lastPlayed).map(g => dayKey(new Date(g.lastPlayed * 1000))));
  const start = new Date(); start.setDate(start.getDate() - 7 * WEEKS + 1); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const cells = [], months = [];
  let col = 0, lastMonth = -1, playedDays = 0, mins = 0;
  for (let d = new Date(start); d <= new Date(); d.setDate(d.getDate() + 1)) {
    const k = dayKey(d), m = Object.values(playlog[k] || {}).reduce((a, b) => a + b, 0);
    const lvl = m > 180 ? 4 : m > 90 ? 3 : m > 0 || s.days.has(k) ? 2 : lastPlayedDays.has(k) ? 1 : 0;
    if (lvl >= 2) { playedDays++; mins += m; }
    if (d.getDay() === 1) { if (d.getMonth() !== lastMonth) { months.push({ col, l: d.toLocaleDateString("fr-FR", { month: "short" }) }); lastMonth = d.getMonth(); } col++; }
    cells.push(`<i class="h${lvl}" title="${d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}${m ? " : " + fmtH(m) : lvl ? " : joué" : " : pas de jeu"}"></i>`);
  }
  return `<div class="scard panel">
    <div class="shead"><h4>${icon("calendar", "sm")} Activité sur 6 mois</h4>
      <div class="sminis inline"><div><b>${playedDays}</b><span>jours joués</span></div><div><b>${x.bigDay ? fmtH(x.bigDay) : "—"}</b><span>plus grosse journée</span></div><div><b>${mins && playedDays ? fmtH(mins / playedDays) : "—"}</b><span>par jour joué</span></div></div></div>
    <div class="sheat-wrap">
      <div class="sheat-days"><span>lun.</span><span></span><span>mer.</span><span></span><span>ven.</span><span></span><span>dim.</span></div>
      <div class="sheat-main">
        <div class="sheat-months" style="grid-template-columns:repeat(${col},1fr)">${months.map(m => `<span style="grid-column:${m.col + 1}">${m.l}</span>`).join("")}</div>
        <div class="sheat" style="grid-template-columns:repeat(${col},1fr)">${cells.join("")}</div>
      </div>
    </div>
    <div class="sheat-legend"><span>Moins</span>${[0, 1, 2, 3, 4].map(l => `<i class="h${l}"></i>`).join("")}<span>Plus</span><small>Le temps exact par jour est enregistré depuis l'installation de Questline.</small></div>
  </div>`;
}

function statMonths() {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
    const k = d.toISOString().slice(0, 7);
    months.push({ l: d.toLocaleDateString("fr-FR", { month: "short" }), m: minutesIn(k), f: st.finished.filter(f => (f.at || "").startsWith(k)).length, cur: i === 0 });
  }
  const max = Math.max(60, ...months.map(m => m.m));
  return `<div class="scard panel">
    <h4>${icon("chart", "sm")} Temps de jeu par mois</h4>
    <div class="smonths">${months.map(m => `<div class="smo ${m.cur ? "cur" : ""}" title="${m.l} : ${fmtH(m.m)}${m.f ? `, ${m.f} jeu(x) fini(s)` : ""}">
      <span class="smo-v">${m.m ? fmtH(m.m) : "—"}</span>
      <div class="smo-col"><i style="height:${m.m ? Math.max(4, m.m / max * 100) : 0}%"></i></div>
      <span class="smo-l">${m.l}${m.f ? ` <b>★${m.f}</b>` : ""}</span></div>`).join("")}</div>
  </div>`;
}

function statGenres() {
  const score = {};
  for (const g of lib) if (g.playtime) (g.tags || []).slice(0, 8).forEach((t, i) => { score[t] = (score[t] || 0) + g.playtime * (1 - i / 10); });
  const top = Object.entries(score).filter(([t]) => tagNames[t] && !STAT_HIDDEN_TAGS.includes(+t)).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const sum = top.reduce((a, [, v]) => a + v, 0) || 1, max = top[0]?.[1] || 1;
  return `<div class="scard panel">
    <h4>${icon("palette", "sm")} Tes genres préférés</h4>
    <p class="ssub">Part de ton temps de jeu, d'après les étiquettes Steam de tes jeux</p>
    <div class="srows">${top.map(([t, v], i) => `<div class="srow"><span class="srk">${i + 1}</span><span class="srn">${esc(tagNames[t])}</span><div class="pal-bar"><i style="width:${Math.round(v / max * 100)}%"></i></div><b>${Math.round(v / sum * 100)} %</b></div>`).join("") || `<p class="small">Pas encore assez de temps de jeu.</p>`}</div>
  </div>`;
}

function statPlatforms() {
  const by = {};
  for (const g of lib) { const k = platKey(g); by[k] = by[k] || { n: 0, m: 0 }; by[k].n++; by[k].m += g.playtime || 0; }
  const rows = Object.entries(by).sort((a, b) => b[1].m - a[1].m || b[1].n - a[1].n).slice(0, 6), max = rows[0]?.[1].m || 1;
  return `<div class="scard panel">
    <h4>${icon("layers", "sm")} Tes plateformes</h4>
    <div class="srows">${rows.map(([k, v]) => `<div class="srow wide"><span class="srn">${esc(platLabel(k))}<small>${v.n} jeu${v.n > 1 ? "x" : ""}</small></span><div class="pal-bar"><i style="width:${Math.round(v.m / max * 100)}%"></i></div><b>${v.m ? fmtH(v.m) : "—"}</b></div>`).join("")}</div>
  </div>`;
}

function statTopGames() {
  const fin = finishedIds();
  const top = [...lib].filter(g => g.playtime).sort((a, b) => b.playtime - a.playtime).slice(0, 8), max = top[0]?.playtime || 1;
  return `<div class="scard panel">
    <h4>${icon("gamepad", "sm")} Tes jeux les plus joués</h4>
    <div class="stop">${top.map((g, i) => `<button class="stop-r" data-game="${esc(g.appid)}">
      <span class="srk">${i + 1}</span>${imgTag(g.appid, "cover", "stop-c", g.name)}
      <span class="stop-n"><b>${esc(g.name)}</b><small>${fin.has(String(g.appid)) ? `${icon("check", "sm")} Terminé` : prog(g.appid)?.total ? `${prog(g.appid).unlocked}/${prog(g.appid).total} succès` : esc(platLabel(platKey(g)))}</small></span>
      <div class="pal-bar"><i style="width:${Math.round(g.playtime / max * 100)}%"></i></div><b>${fmtH(g.playtime)}</b></button>`).join("")}</div>
  </div>`;
}

function viewStats() {
  setBackdrop(null);
  const pd = profileData(), s = pd.stats;
  return `
  <div class="page-head"><div><span class="eyebrow">Ta vie de joueur</span><h2 class="title">Statistiques</h2>
    <p class="small" style="margin-top:4px">${lib.length} jeux dans ta bibliothèque · ${pd.extra.launched} lancés au moins une fois · ${pd.extra.platforms} plateforme${pd.extra.platforms > 1 ? "s" : ""}</p></div>
    <button class="btn sm" data-act="recap">${icon("download", "sm")} Récap ${new Date().getFullYear()} (image)</button></div>
  ${statKpis(s)}
  <div class="sgrid two">${statBacklog(s)}${statProgress(pd)}</div>
  ${statHeat(s, pd.extra)}
  <div class="sgrid two">${statMonths()}${statGenres()}</div>
  <div class="sgrid sside">${statTopGames()}${statPlatforms()}</div>`;
}
