/* =====================================================================
   Questline — objectif de session (sélecteur de durée, heure limite, alertes) et journal de quête
   ===================================================================== */
let sessDraft = 60;                                  // durée choisie, en minutes
const SESS_PRESETS = [30, 45, 60, 90, 120, 180];
const BEDTIMES = [[22, "22 h"], [23, "23 h"], [24, "Minuit"], [0, "Aucune"]];
const fmtDur = m => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}`;
const fmtClock = d => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

// alertes : session qui finit après l'heure limite, en pleine nuit, ou très longue
function sessionWarnings(minutes, from = new Date()) {
  const end = new Date(from.getTime() + minutes * 60e3), out = [];
  const bed = st.settings?.bedtime ?? 23;
  if (bed) {
    const limit = new Date(from); limit.setHours(bed === 24 ? 24 : bed, 0, 0, 0);
    if (from.getHours() < 6) limit.setDate(limit.getDate() - 1);        // après minuit : la limite d'hier est déjà passée
    if (from >= limit) out.push({ lvl: "warn", i: "moon", t: `Il est déjà plus de ${bed === 24 ? "minuit" : bed + " h"}, ton heure limite. Une courte session, alors ?` });
    else if (end > limit) out.push({ lvl: "warn", i: "moon", t: `Ta session finirait à ${fmtClock(end)}, après ton heure limite (${bed === 24 ? "minuit" : bed + " h"}). Réduis-la de ${fmtDur(Math.ceil((end - limit) / 60e3 / 5) * 5)} pour rester dans les clous.` });
  }
  if (end.getHours() >= 1 && end.getHours() < 6 && end.getDate() !== from.getDate() || (from.getHours() >= 1 && from.getHours() < 6)) out.push({ lvl: "danger", i: "alert", t: "Session en pleine nuit : ton sommeil compte aussi pour finir ta quête." });
  if (minutes > 180) out.push({ lvl: "info", i: "coffee", t: "Plus de 3 h d'affilée : prévois des pauses toutes les heures." });
  return out;
}

function sessionCard(c) {
  const s = st.session;
  if (s && new Date(s.until) > Date.now()) {
    const total = s.minutes * 60e3, startT = s.start ? Date.parse(s.start) : Date.parse(s.until) - total;
    const p = Math.min(1, Math.max(0, (Date.now() - startT) / total));
    return `<div class="sess panel running">
      <div class="sess-head"><h4>${icon("timer", "sm")} Session en cours</h4><span class="pill go">${fmtDur(s.minutes)}</span></div>
      <div class="sess-run">
        <div class="sess-ring" id="sessRing" data-start="${startT}" data-total="${total}" style="--p:${(p * 100).toFixed(2)}"><div><b id="countdown" data-until="${s.until}">--:--</b><small>restantes</small></div></div>
        <div class="sess-run-info">
          <div class="sess-fact"><span>Fin prévue</span><b>${fmtClock(new Date(s.until))}</b></div>
          <div class="sess-fact"><span>Rappel</span><b>${s.minutes > 20 ? "10 min avant la fin" : "à la fin"}</b></div>
          <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="sessExtend">${icon("plus", "sm")} 15 min</button><button class="btn sm" data-act="sessionStop">${icon("x", "sm")} Arrêter</button><button class="btn sm" data-act="widget">${icon("monitor", "sm")} Widget</button></div>
        </div>
      </div>
      ${sessionWarnings(0, new Date(s.until)).filter(w => w.lvl === "danger").map(sessWarnHtml).join("")}
    </div>`;
  }
  const bed = st.settings?.bedtime ?? 23, warns = sessionWarnings(sessDraft);
  const end = new Date(Date.now() + sessDraft * 60e3);
  return `<div class="sess panel">
    <div class="sess-head"><h4>${icon("timer", "sm")} Objectif de session</h4><span class="small">Je lance le jeu et je te préviens à la fin</span></div>
    <div class="sess-body">
      <div class="sess-dial">
        <button class="sess-step" data-act="sessStep" data-d="-15" aria-label="Moins 15 minutes" ${sessDraft <= 15 ? "disabled" : ""}>${icon("minus")}</button>
        <div class="sess-value"><b>${fmtDur(sessDraft)}</b><small>fin vers <strong>${fmtClock(end)}</strong></small></div>
        <button class="sess-step" data-act="sessStep" data-d="15" aria-label="Plus 15 minutes" ${sessDraft >= 360 ? "disabled" : ""}>${icon("plus")}</button>
      </div>
      <input class="sess-range" type="range" min="15" max="360" step="15" value="${sessDraft}" id="sessRange" aria-label="Durée de la session" style="--v:${((sessDraft - 15) / 345 * 100).toFixed(1)}%">
      <div class="sess-presets">${SESS_PRESETS.map(m => `<button class="${m === sessDraft ? "on" : ""}" data-act="sessPick" data-min="${m}">${fmtDur(m)}</button>`).join("")}</div>
      <div class="sess-bed"><span>${icon("moon", "sm")} Heure limite</span><div class="sess-seg">${BEDTIMES.map(([v, l]) => `<button class="${bed === v ? "on" : ""}" data-act="sessBed" data-v="${v}">${l}</button>`).join("")}</div></div>
      <div class="sess-warns">${warns.map(sessWarnHtml).join("")}</div>
      <button class="btn-go" data-act="sessStart">${icon("play", "sm")} Lancer ${fmtDur(sessDraft)} de jeu</button>
    </div>
  </div>`;
}
const sessWarnHtml = w => `<div class="sess-warn ${w.lvl}">${icon(w.i === "alert" ? "info" : w.i, "sm")}<span>${esc(w.t)}</span></div>`;

// met à jour l'anneau de la session en cours sans tout redessiner
setInterval(() => {
  const r = document.getElementById("sessRing"); if (!r) return;
  const p = Math.min(1, Math.max(0, (Date.now() - +r.dataset.start) / +r.dataset.total));
  r.style.setProperty("--p", (p * 100).toFixed(2));
}, 1000);

document.addEventListener("input", e => {
  if (e.target.id !== "sessRange") return;
  sessDraft = +e.target.value;
  // mise à jour légère pendant le glissement, rendu complet au relâchement
  e.target.style.setProperty("--v", `${((sessDraft - 15) / 345 * 100).toFixed(1)}%`);
  const v = document.querySelector(".sess-value"); if (v) v.innerHTML = `<b>${fmtDur(sessDraft)}</b><small>fin vers <strong>${fmtClock(new Date(Date.now() + sessDraft * 60e3))}</strong></small>`;
});
document.addEventListener("change", e => { if (e.target.id === "sessRange") render(); });
document.addEventListener("click", async e => {
  const t = e.target.closest("[data-act^=sess]");
  if (!t || t.disabled) return;
  switch (t.dataset.act) {
    case "sessStep": sessDraft = Math.max(15, Math.min(360, sessDraft + +t.dataset.d)); sfx("click"); return render();
    case "sessPick": sessDraft = +t.dataset.min; sfx("click"); return render();
    case "sessBed": return setSetting("bedtime", +t.dataset.v);
    case "sessStart": {
      if (sessionWarnings(sessDraft).some(w => w.lvl !== "info") && !confirm(`${sessionWarnings(sessDraft).filter(w => w.lvl !== "info").map(w => w.t).join("\n")}\n\nLancer quand même ?`)) return;
      st = await api("/api/session", { minutes: sessDraft }); flag("session"); sfx("pick"); render();
      return toast(`C'est parti pour ${fmtDur(sessDraft)}. Bonne session !`, "timer");
    }
    case "sessExtend": st = await api("/api/session/extend", { minutes: 15 }); render(); return toast("Session prolongée de 15 minutes.", "timer");
  }
});

/* ---------------------------------------------------------------- journal de quête */
function journalCard(c, g, j) {
  const max = Math.max(30, ...j.days.map(d => d.min));
  const playedDays = j.days.filter(d => d.min > 0), avg = playedDays.length ? playedDays.reduce((a, d) => a + d.min, 0) / 14 : 0;
  const today = dayKey(new Date()), best = Math.max(0, ...j.days.map(d => d.min));
  const cols = j.days.map(d => {
    const h = d.min ? Math.max(6, d.min / max * 100) : 0;
    const tip = `${d.d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} : ${d.min ? fmtH(d.min) : "pas joué"}`;
    return `<div class="jcol ${d.key === today ? "today" : ""} ${d.min && d.min === best ? "best" : ""}" title="${tip}">
      <div class="jtrack">${d.min ? `<div class="jbar" style="height:${h.toFixed(1)}%"><span>${fmtH(d.min)}</span></div>` : `<div class="jdot"></div>`}</div>
      <small>${d.d.toLocaleDateString("fr-FR", { weekday: "narrow" })}<i>${d.d.getDate()}</i></small></div>`;
  }).join("");
  const stat = (ic, v, l) => `<div class="jstat"><span class="ico-box">${icon(ic, "sm")}</span><div><b>${v}</b><small>${l}</small></div></div>`;
  return `<div class="jcard panel">
    <div class="sess-head"><h4>${icon("calendar", "sm")} Journal de quête</h4><span class="small">14 derniers jours</span></div>
    <div class="jstats">${stat("clock", fmtH(j.total), "depuis l'engagement")}${stat("flame", `${j.streak} j`, "série en cours")}${stat("trend", j.avg ? fmtH(j.avg) : "—", "par jour joué")}${stat("calendar", `${playedDays.length}/14`, "jours joués")}</div>
    <div class="jchart">${avg ? `<div class="javg" style="bottom:${(30 + Math.max(6, avg / max * 122)).toFixed(1)}px"><span>moy. ${fmtH(avg)}/jour</span></div>` : ""}${cols}</div>
  </div>`;
}
