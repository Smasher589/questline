/* =====================================================================
   Questline — file d'attente : planning des prochaines quêtes (dates estimées à ton rythme),
   réorganisation par glisser-déposer, places libres et suggestions
   ===================================================================== */
const QUEUE_MAX = 5;
// date courte pour les lignes de la file (« 13 févr. »), avec l'année si elle change
const fmtShort = d => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });
const fmtDay = d => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });

// planning : la quête en cours d'abord, puis chaque jeu de la file, à ton rythme hebdomadaire
function queuePlan() {
  const c = st.current, cg = c ? (byId(c.appid) || { appid: c.appid, name: c.name, playtime: 0 }) : null;
  const j = c ? journal(c, cg) : null;
  const weekly = j && j.weekly >= 60 ? j.weekly : 7 * 60;            // minutes par semaine (7 h par défaut)
  const day = 864e5, perDay = weekly / 7;
  let t = Date.now();
  const cur = c ? { g: cg, left: j.remaining, end: new Date(t += j.remaining / perDay * day) } : null;
  const items = (st.queue || []).map(it => {
    const g = byId(it.appid) || { appid: it.appid, name: it.name, playtime: 0, platform: it.platform };
    const left = hoursLeft(g) * 60, start = new Date(t);
    t += left / perDay * day;
    return { it, g, left, start, end: new Date(t) };
  });
  return { cur, items, weekly, measured: !!(j && j.weekly >= 60), end: new Date(t) };
}

function queueRow(x, i, n) {
  const g = x.g, first = i === 0;
  const chips = [`${icon("hourglass", "sm")} ≈ ${estimateHours(g)} h`, g.metacritic ? `Metacritic ${mcTag(g)}` : "", g.review ? `${icon("smile", "sm")} ${g.review} %` : "", g.platform ? esc(platShort(g)) : "Steam"].filter(Boolean);
  return `<div class="qrow panel ${first ? "first" : ""}" draggable="true" data-qi="${i}">
    <span class="qdrag" title="Glisser pour réordonner">${icon("grid", "sm")}</span>
    <span class="qnum">${i + 1}</span>
    ${imgTag(g.appid, "cover", "qrow-cover", g.name, `data-game="${esc(g.appid)}"`)}
    <div class="qrow-main">
      <b>${esc(g.name)}</b>
      <div class="qrow-chips">${chips.map(c => `<span>${c}</span>`).join("")}</div>
      <small>${icon("calendar", "sm")} ${first && !st.current ? "Prêt à commencer" : `Début ${fmtShort(x.start)}`} · fin <b>${fmtShort(x.end)}</b></small>
    </div>
    <div class="qrow-actions">
      ${first && !st.current ? `<button class="btn-play" data-act="startQueued">${icon("play")} Commencer</button>` : ""}
      <button class="btn sm icon" title="Fiche du jeu" data-game="${esc(g.appid)}">${icon("info", "sm")}</button>
      <button class="btn sm icon" title="Monter" data-act="qmove" data-dir="up" data-id="${esc(g.appid)}" ${i === 0 ? "disabled" : ""}>${icon("up", "sm")}</button>
      <button class="btn sm icon" title="Descendre" data-act="qmove" data-dir="down" data-id="${esc(g.appid)}" ${i === n - 1 ? "disabled" : ""}>${icon("down", "sm")}</button>
      <button class="btn sm icon danger-soft" title="Retirer de la file" data-act="qmove" data-dir="remove" data-id="${esc(g.appid)}">${icon("trash", "sm")}</button>
    </div>
  </div>`;
}

function queueSuggestions(n = 5) {
  // des jeux que tu peux vraiment finir : bien notés, pas trop longs, ou déjà commencés
  return candidates().filter(g => !inQueue(g.appid) && String(g.appid) !== String(st.current?.appid))
    .map(g => ({ g, s: (g.review || 60) / 100 + (played(g) ? .25 : 0) + (estimateHours(g) <= 20 ? .2 : 0) + (g.metacritic >= 85 ? .15 : 0) }))
    .sort((a, b) => b.s - a.s).slice(0, n).map(x => x.g);
}

function viewQueue() {
  const p = queuePlan(), q = p.items, free = QUEUE_MAX - q.length;
  setBackdrop(null);
  const totalH = Math.round(q.reduce((a, x) => a + x.left, 0) / 60);
  const sugg = free > 0 ? queueSuggestions() : [];
  return `
  <div class="page-head"><div><span class="eyebrow">Planifie la suite</span><h2 class="title">File d'attente</h2></div>
    <div class="row" style="gap:8px"><button class="btn sm" data-go="tonight">${icon("sparkles", "sm")} Trouver des jeux</button><button class="btn sm" data-go="library">${icon("grid", "sm")} Bibliothèque</button></div></div>
  <div class="qsum">
    ${[["list", `${q.length}/${QUEUE_MAX}`, "jeux dans la file", free ? `${free} place${free > 1 ? "s" : ""} libre${free > 1 ? "s" : ""}` : "file complète"],
       ["hourglass", `≈ ${totalH} h`, "d'histoire à jouer", "temps restant estimé"],
       ["timer", `${(p.weekly / 60).toFixed(p.weekly < 600 ? 1 : 0).replace(".", ",")} h`, "par semaine", p.measured ? "ton rythme actuel" : "rythme par défaut"],
       ["flag", q.length ? fmtDay(p.end) : "—", "fin de la file", q.length ? "si tu gardes ce rythme" : "ajoute des jeux"]]
      .map(([i, v, l, s]) => `<div class="panel"><span class="ico-box">${icon(i)}</span><div><b>${v}</b><span>${l}</span><small>${s}</small></div></div>`).join("")}
  </div>
  <div class="qlayout2">
    <div class="qtimeline">
      ${p.cur ? `<div class="qnow panel" data-go="quest"><span class="qdot now"></span>${imgTag(p.cur.g.appid, "cover", "qrow-cover", p.cur.g.name)}
        <div class="qrow-main"><span class="eyebrow">Quête en cours</span><b>${esc(p.cur.g.name)}</b><small>${icon("calendar", "sm")} Encore ≈ ${Math.round(p.cur.left / 60)} h · fin vers le <b>${fmtDay(p.cur.end)}</b></small></div>${icon("right")}</div>` : ""}
      <div class="qlist" id="qlist">${q.map((x, i) => queueRow(x, i, q.length)).join("")}
        ${[...Array(free)].map((_, k) => `<button class="qslot" data-go="tonight"><span class="qnum">${q.length + k + 1}</span>${icon("plus", "sm")} Place libre · ajouter un jeu</button>`).join("")}
      </div>
      <p class="small qtip">${icon("info", "sm")} Glisse un jeu pour changer l'ordre. À la fin de ta quête, le n°1 de la file t'est proposé directement. Les dates sont estimées d'après ${p.measured ? "ton rythme de jeu actuel" : "un rythme de 7 h par semaine"}.</p>
    </div>
    <aside class="qside2 panel">
      <h4 class="mini-title">Suggestions pour ta file</h4>
      ${free <= 0 ? `<p class="small">Ta file est complète (${QUEUE_MAX} jeux). Termine ta quête ou retire un jeu pour en ajouter.</p>`
        : sugg.length ? sugg.map(g => `<div class="qsug">${imgTag(g.appid, "cover", "", g.name, `data-game="${esc(g.appid)}"`)}<div><b>${esc(g.name)}</b><small>≈ ${estimateHours(g)} h${g.review ? ` · ${g.review} % d'avis positifs` : ""}${played(g) ? " · déjà commencé" : ""}</small></div><button class="btn sm icon" title="Ajouter à ma file" data-act="queueAdd" data-id="${esc(g.appid)}">${icon("plus", "sm")}</button></div>`).join("")
        : `<p class="small">Aucune suggestion pour l'instant.</p>`}
      <button class="btn sm" data-go="tonight" style="margin-top:6px">${icon("sparkles", "sm")} Faire le test pour mieux choisir</button>
    </aside>
  </div>`;
}

// glisser-déposer pour réordonner (l'API déplace d'une place à la fois)
let qDragFrom = null;
document.addEventListener("dragstart", e => {
  const r = e.target.closest?.(".qrow"); if (!r) return;
  qDragFrom = +r.dataset.qi; r.classList.add("dragging"); e.dataTransfer.effectAllowed = "move";
});
document.addEventListener("dragend", e => { e.target.closest?.(".qrow")?.classList.remove("dragging"); document.querySelectorAll(".qrow.over").forEach(x => x.classList.remove("over")); });
document.addEventListener("dragover", e => {
  const r = e.target.closest?.(".qrow"); if (!r || qDragFrom === null) return;
  e.preventDefault(); document.querySelectorAll(".qrow.over").forEach(x => x !== r && x.classList.remove("over")); r.classList.add("over");
});
document.addEventListener("drop", async e => {
  const r = e.target.closest?.(".qrow"); if (!r || qDragFrom === null) return;
  e.preventDefault();
  const from = qDragFrom, to = +r.dataset.qi; qDragFrom = null;
  if (from === to) return;
  const id = st.queue[from].appid, dir = to < from ? "up" : "down";
  for (let k = 0; k < Math.abs(to - from); k++) st = await api("/api/queue", { action: dir, appid: id });
  sfx("click"); render();
});
