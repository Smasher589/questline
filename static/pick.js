/* =====================================================================
   Questline — « Choisir ma quête » : accueil, questions (aperçu en direct) et top 5 expliqué
   ===================================================================== */
const mcTag = g => g?.metacritic ? `<span class="mcb inline ${g.metacritic >= 75 ? "good" : g.metacritic >= 50 ? "mid" : "bad"}" title="Metacritic">${g.metacritic}</span>` : "";
const pctClass = p => p >= 80 ? "hi" : p >= 60 ? "md" : "lo";

/* ---------------------------------------------------------------- accueil */
function viewTonight() {
  if (sub === "clean") return viewClean();
  if (sub === "results") return viewResults();
  if (sub === "quiz" && quizSet) return viewQuiz();
  setBackdrop(null);
  const pool = candidates(), h = g => estimateHours(g);
  const short = pool.filter(g => h(g) <= 12).length, mid = pool.filter(g => h(g) > 12 && h(g) <= 30).length, long = pool.length - short - mid;
  const started = pool.filter(played).length, waiting = lib.filter(finishable).filter(g => earlierUnfinished(g)).length;
  const mode = (act, ic, title, desc, meta, main) => `<button class="pmode panel ${main ? "main" : ""}" data-act="${act}">
      <span class="ico-box ${main ? "acc" : ""}">${icon(ic, "lg")}</span><b>${title}</b><small>${desc}</small><span class="pmode-meta">${meta}</span></button>`;
  return `
  <section class="qhero hhero">
    <div class="qhero-art"></div>
    <div class="qhero-body solo">
      <div class="qhero-info">
        <span class="qbadge">${icon("sparkles", "sm")} Prochaine quête</span>
        <h1 class="qtitle">Quel jeu vas-tu <span class="gtext">finir</span> ?</h1>
        <p class="hlead">Quelques questions sur ton rythme et tes envies, et je classe les jeux de ta bibliothèque selon tes chances d'aller jusqu'au générique.</p>
        ${st.current ? `<div class="pnote">${icon("info", "sm")} Ta quête <b>${esc(st.current.name)}</b> est en cours : les jeux choisis ici iront dans ta file d'attente.</div>` : ""}
      </div>
    </div>
  </section>
  ${picks.length ? `<button class="plast panel" data-act="lastResults"><span class="ico-box">${icon("rotate")}</span><div><b>Revoir mes derniers résultats</b><small>${picks.slice(0, 3).map(p => esc(p.g.name)).join(" · ")}</small></div>${icon("right")}</button>` : ""}
  <div class="pmodes">
    ${mode("start", "sparkles", "Le grand test", "Le classement le plus précis, avec le détail du score pour chaque jeu.", `${icon("list", "sm")} ${QUESTIONS.length} questions · ≈ 3 min`, true)}
    ${mode("quick", "zap", "Version express", "L'essentiel : ton rythme, ton délai, tes envies.", `${icon("list", "sm")} ${QUICK.length} questions · ≈ 1 min`)}
    ${mode("lucky", "dice", "J'ai de la chance", "Pas de questions : la roue choisit parmi tes jeux les mieux notés.", `${icon("timer", "sm")} immédiat`)}
  </div>
  <div class="sec-head"><h3 class="sec">${icon("layers")} Ta pile de jeux à finir</h3><span class="small">${pool.length} jeux candidats</span></div>
  <div class="ppool">
    ${[["zap", short, "courts", "12 h ou moins"], ["hourglass", mid, "moyens", "12 à 30 h"], ["mountain", long, "longs", "plus de 30 h"], ["rotate", started, "déjà commencés", "à reprendre"]].map(([i, n, l, d]) => `<div class="panel"><span class="ico-box">${icon(i)}</span><div><b>${n}</b><span>${l}</span><small>${d}</small></div></div>`).join("")}
  </div>
  ${waiting ? `<p class="small" style="margin-top:12px">${icon("info", "sm")} ${waiting} suite${waiting > 1 ? "s" : ""} de saga attend${waiting > 1 ? "ent" : ""} que tu finisses l'épisode précédent : elle${waiting > 1 ? "s" : ""} n'apparaîtr${waiting > 1 ? "ont" : "a"} qu'ensuite.</p>` : ""}`;
}

/* ---------------------------------------------------------------- questions */
function viewQuiz() {
  const qi = quizSet[qIndex], q = QUESTIONS[qi];
  // aperçu en direct : les jeux en tête avec les réponses déjà données
  const lead = answers.some(a => a >= 0) ? candidates().map(g => affinity(g, answers)).sort((a, b) => b.pct - a.pct || (b.g.review || 0) - (a.g.review || 0)).slice(0, 3) : [];
  const left = quizSet.length - qIndex;
  return `
  <section class="pquiz">
    <div class="pquiz-main">
      <div class="pq-top">
        <button class="back" data-act="qback">${icon("left", "sm")} ${qIndex ? "Question précédente" : "Retour"}</button>
        <span class="small">Question ${qIndex + 1} sur ${quizSet.length} · encore ≈ ${Math.max(1, Math.round(left * 8 / 60))} min</span>
      </div>
      <div class="pq-bar"><i style="width:${(qIndex / quizSet.length * 100).toFixed(1)}%"></i></div>
      <span class="eyebrow">${esc(q.eyebrow)}</span>
      <h2 class="pq-title">${q.title}</h2>
      <div class="pq-choices">${q.choices.map((c, i) => `
        <button class="pq-choice ${answers[qi] === i ? "picked" : ""} ${!c.fn && !c.tags && !c.v ? "neutral" : ""}" data-choice="${i}">
          <span class="ico-box">${icon(c.i)}</span><span class="pq-txt"><strong>${c.t}</strong>${c.s ? `<small>${c.s}</small>` : ""}</span><kbd>${(i + 1) % 10}</kbd></button>`).join("")}
      </div>
      <div class="pq-foot"><span class="small">${icon("keyboard", "sm")} Touches 1 à ${Math.min(9, q.choices.length)}${q.choices.length > 9 ? " (et 0)" : ""} pour répondre · Retour arrière pour revenir</span><button class="link" data-act="qskip">Passer ${icon("right", "sm")}</button></div>
    </div>
    <aside class="pquiz-side panel">
      <h4 class="mini-title">En tête pour l'instant</h4>
      ${lead.length ? lead.map((p, k) => `<div class="pq-lead"><span class="pq-rank">${k + 1}</span>${imgTag(p.g.appid, "cover", "", p.g.name)}<div><b>${esc(p.g.name)}</b><span class="ppct ${pctClass(p.pct)}">${p.pct} %</span></div></div>`).join("")
        : `<p class="small">Réponds à la première question : les jeux qui te correspondent le mieux apparaîtront ici, au fil de tes réponses.</p>`}
      <p class="small pq-pool">${candidates().length} jeux en lice${lead.length ? " · classement provisoire, il s'affine à chaque réponse" : ""}</p>
    </aside>
  </section>`;
}

/* ---------------------------------------------------------------- top 5 */
function scoreBreakdown(r) {
  const rows = (r.detail || []).filter(d => d.imp).sort((a, b) => b.imp - a.imp).slice(0, 8);
  if (!rows.length) return r.label ? `<p class="small">Classement par avis des joueurs (${r.pct} % d'avis positifs), sans questions.</p>` : "";
  return `<div class="pbreak">${rows.map(d => {
    const v = d.f === null ? null : Math.round(d.f * 100);
    return `<div class="pbrow"><span>${esc(d.k)}</span><div class="bar"><i class="${v === null ? "na" : pctClass(v)}" style="width:${v === null ? 50 : v}%"></i></div><b>${v === null ? "?" : v + " %"}</b></div>`;
  }).join("")}</div><p class="small">Chaque critère compte selon son importance ; « ? » = information absente pour ce jeu, comptée pour moitié.</p>`;
}
function pickDetail() {
  const r = picks[selected], g = r.g, wk = hoursLeft(g);
  return `<div class="pdetail panel">
    <div class="pdetail-main">
      <div class="pdetail-head">${imgTag(g.appid, "cover", "pd-cover", g.name, `data-game="${esc(g.appid)}"`)}
        <div><span class="eyebrow">N°${selected + 1} · ${r.pct} % ${r.label ? "d'avis positifs" : "d'affinité"}</span><h3>${esc(g.name)}</h3>
          <div class="pdetail-stats">
            <span>${icon("hourglass", "sm")} ≈ ${estimateHours(g)} h d'histoire</span>
            <span>${icon("clock", "sm")} ${fmtH(g.playtime)} joué</span>
            ${g.review ? `<span>${icon("smile", "sm")} ${g.review} % d'avis positifs</span>` : ""}
            ${g.metacritic ? `<span>Metacritic ${mcTag(g)}</span>` : ""}
            ${g.platform ? `<span>${esc(platLong(g))}</span>` : ""}
          </div>
          <div class="chips">${r.why.map((w, i) => `<span class="chip ${i === 0 ? "hot" : ""}">${esc(w)}</span>`).join("")}</div>
        </div>
      </div>
      <h4 class="mini-title" style="margin-top:18px">Pourquoi ce score</h4>
      ${scoreBreakdown(r)}
    </div>
    <div class="pdetail-actions">
      ${st.current ? "" : `<button class="btn-play" data-act="choose">${icon("flag")} Commencer cette quête</button>`}
      ${inQueue(g.appid) ? `<button class="btn sm" disabled>${icon("check", "sm")} Dans ta file</button>` : `<button class="${st.current ? "btn-play" : "btn sm"}" data-act="queueAdd" data-id="${esc(g.appid)}">${icon("list", st.current ? "" : "sm")} Ajouter à ma file</button>`}
      <button class="btn sm" data-game="${esc(g.appid)}">${icon("info", "sm")} Voir la fiche et les avis</button>
      <p class="small">À ≈ ${Math.round(wk)} h restantes, compte environ ${Math.max(1, Math.round(wk / 7))} semaine${Math.round(wk / 7) > 1 ? "s" : ""} à 7 h par semaine.</p>
    </div>
  </div>`;
}
// changer de jeu sélectionné : seules la carte et le panneau de détail changent (pas d'animation de toute la grille)
function selectPick(i) {
  if (i === selected || !picks[i]) return;
  selected = i;
  document.querySelectorAll(".pcard").forEach((c, n) => c.classList.toggle("sel", n === i));
  const d = document.querySelector(".pdetail");
  if (d) d.outerHTML = pickDetail(); else render();
}
function viewResults() {
  if (!picks.length) return emptyState("search", "Aucun jeu ne correspond", "Tout est fini ? Respect. Sinon, refais le test avec d'autres réponses.", `<button class="btn-play" data-act="start">${icon("sparkles")} Refaire le test</button>`);
  setBackdrop(null);
  const intro = !revealed;      // animation d'apparition seulement à l'arrivée des résultats
  revealed = true;
  return `
  <div class="page-head"><div><span class="eyebrow">${picks[0].label ? "J'ai de la chance" : "Ton top 5"}</span><h2 class="title">Les jeux que tu as le plus de chances de finir</h2></div>
    <div class="row" style="gap:8px"><button class="btn sm" data-act="spin">${icon("dice", "sm")} Laisse le destin choisir</button><button class="btn sm" data-act="start">${icon("rotate", "sm")} Refaire le test</button></div></div>
  <div class="picks ${intro ? "intro" : ""}">${picks.map((t, i) => `
    <button class="pcard ${i === selected ? "sel" : ""}" data-pick="${i}" style="--k:${i}">
      <div class="pcover">${imgTag(t.g.appid, "cover", "", t.g.name)}<span class="prank">N°${i + 1}</span>${mcTag(t.g)}
        <div class="pscore ${pctClass(t.pct)}"><b>${t.pct}<small>%</small></b><span>${t.label ? "avis positifs" : "affinité"}</span></div></div>
      <div class="pcard-body"><b>${esc(t.g.name)}</b><small>${esc(t.why[0] || "")}</small></div>
    </button>`).join("")}
  </div>
  ${pickDetail()}`;
}

// raccourcis clavier pendant les questions
document.addEventListener("keydown", e => {
  if (view !== "tonight" || sub !== "quiz" || !quizSet || e.target.closest("input, textarea, select") || document.querySelector(".scrim")) return;
  const q = QUESTIONS[quizSet[qIndex]];
  const k = e.key === "0" ? 10 : +e.key;   // la touche 0 sélectionne la 10e réponse
  if (/^[0-9]$/.test(e.key) && k <= q.choices.length) { e.preventDefault(); answer(k - 1); }
  else if (e.key === "Backspace" || e.key === "ArrowLeft") { e.preventDefault(); if (qIndex) qIndex--; else sub = null; render(); }
  else if (e.key === "ArrowRight") { e.preventDefault(); answer(-1); }
});
document.addEventListener("click", e => {
  if (e.target.closest("[data-act=lastResults]")) { sub = "results"; revealed = true; render(); }
});
