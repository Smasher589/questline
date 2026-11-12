/* =====================================================================
   Questline — page « Ma quête » sans quête en cours (premier lancement, ou entre deux quêtes)
   ===================================================================== */

// jeux déjà entamés à reprendre : beaucoup joués, récemment, pas finis, pas une suite en attente
function resumePicks(n = 3) {
  return lib.filter(g => finishable(g) && played(g) && !earlierUnfinished(g) && !inQueue(g.appid))
    .sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0) || (b.playtime || 0) - (a.playtime || 0)).slice(0, n);
}

// guide de démarrage, affiché tant qu'aucune quête n'a été terminée
function startGuide() {
  const steps = [
    { done: lib.length > 0, i: "layers", t: "Relie tes comptes", d: lib.length ? `${lib.length} jeux trouvés dans ta bibliothèque.` : "Steam, Epic, GOG, Ubisoft… pour retrouver tes jeux.", go: "sources", b: "Sources" },
    { done: lib.some(g => g.platform === "emu"), i: "gamepad", t: "Ajoute tes émulateurs", d: "Facultatif : Switch, PlayStation, rétro… avec leurs jaquettes.", go: "sources", b: "Ajouter" },
    { done: (st.queue || []).length > 0, i: "list", t: "Prépare ta file d'attente", d: "Choisis quelques jeux à enchaîner ensuite.", go: "tonight", b: "Choisir" },
    { done: !!st.current || st.finished.length > 0, i: "flag", t: "Lance ta première quête", d: "Un seul jeu, jusqu'au générique. Le bouclier fait le reste.", act: "start", b: "C'est parti" },
  ];
  const done = steps.filter(s => s.done).length;
  return `<div class="hguide panel">
    <div class="sess-head"><h4>${icon("compass", "sm")} Bien démarrer</h4><span class="small">${done}/${steps.length} étapes</span></div>
    <div class="hguide-bar"><i style="width:${done / steps.length * 100}%"></i></div>
    <ol class="hguide-steps">${steps.map((s, k) => `<li class="${s.done ? "done" : ""}">
      <span class="hnum">${s.done ? icon("check", "sm") : k + 1}</span>
      <div><b>${s.t}</b><small>${s.d}</small></div>
      ${s.done ? "" : `<button class="btn sm" ${s.act ? `data-act="${s.act}"` : `data-go="${s.go}"`}>${s.b}</button>`}</li>`).join("")}</ol>
  </div>`;
}

function viewHome() {
  setBackdrop(null);
  const s = stats(), playable = lib.filter(finishable).length, next = st.queue?.[0], resume = resumePicks();
  const fresh = !st.finished.length, empty = !lib.length;
  const hero = empty
    ? `<span class="qbadge">${icon("sparkles", "sm")} Bienvenue sur Questline</span>
       <h1 class="qtitle">Ta bibliothèque est vide pour l'instant.</h1>
       <p class="hlead">Relie tes comptes de jeux pour que Questline retrouve tes jeux, tes temps de jeu et tes succès.</p>
       <div class="qactions"><button class="btn-play" data-go="sources">${icon("layers")} Relier mes comptes</button></div>`
    : next
      ? `<span class="qbadge">${icon("list", "sm")} Prochain dans ta file</span>
         <h1 class="qtitle">${esc(next.name)}</h1>
         <p class="hlead">Tu l'as mis de côté pour la suite : lance-le et engage-toi jusqu'au générique.</p>
         <div class="qactions"><button class="btn-play" data-act="startQueued">${icon("play")} Commencer cette quête</button><button class="btn sm" data-go="tonight">${icon("sparkles", "sm")} Choisir un autre jeu</button></div>`
      : `<span class="qbadge">${icon("target", "sm")} Aucune quête en cours</span>
         <h1 class="qtitle">Un jeu. <span class="gtext">Jusqu'au générique.</span></h1>
         <p class="hlead">${playable} jeux de ta bibliothèque n'attendent que d'être finis. Choisis-en un : le bouclier bloque les autres téléchargements jusqu'à la fin de l'histoire.</p>
         <div class="qactions"><button class="btn-play" data-act="start">${icon("sparkles")} Trouver mon jeu</button><button class="btn sm" data-go="library">${icon("grid", "sm")} Parcourir</button></div>`;
  const heroArt = next ? (isSteam(next.appid) ? `/img/${next.appid}/hero` : safeImg(byId(next.appid)?.hero) || safeImg(byId(next.appid)?.cover)) : null;
  return `
  <section class="qhero hhero">
    <div class="qhero-art" style="${heroArt ? `background-image:url('${esc(heroArt)}')` : ""}"></div>
    <div class="qhero-body ${next ? "" : "solo"}">
      ${next ? `<div class="qcover">${imgTag(next.appid, "cover", "cover", next.name, `data-game="${esc(next.appid)}"`)}</div>` : ""}
      <div class="qhero-info">${hero}</div>
    </div>
  </section>

  ${fresh ? startGuide() : ""}

  ${empty ? "" : `
  <div class="hways">
    <button class="hway panel" data-act="start"><span class="ico-box acc">${icon("sparkles", "lg")}</span><b>Le grand test</b><small>${QUESTIONS.length} questions sur ton rythme et tes envies, puis ton top 5.</small></button>
    <button class="hway panel" data-act="quick"><span class="ico-box">${icon("zap", "lg")}</span><b>Version express</b><small>${QUICK.length} questions, pour décider en une minute.</small></button>
    <button class="hway panel" data-act="lucky"><span class="ico-box">${icon("dice", "lg")}</span><b>J'ai de la chance</b><small>La roue choisit parmi tes jeux les mieux notés.</small></button>
  </div>`}

  ${resume.length ? `<div class="sec-head"><h3 class="sec">${icon("rotate")} À reprendre</h3><span class="small">Des jeux déjà commencés, pas encore finis</span></div>
  <div class="hresume">${resume.map(g => `<button class="hres panel" data-game="${esc(g.appid)}">${imgTag(g.appid, "cover", "", g.name)}<div><b>${esc(g.name)}</b><small>${fmtH(g.playtime)} joué · ≈ ${estimateHours(g)} h d'histoire</small><span class="bar"><i style="width:${Math.min(99, Math.round((g.playtime || 0) / 60 / estimateHours(g) * 100))}%"></i></span></div></button>`).join("")}</div>` : ""}

  ${empty ? "" : `<div class="hkpis">${[["layers", lib.length, "jeux"], ["hourglass", playable, "à finir"], ["trophy", s.fin, "terminés"], ["star", s.perfect, "à 100 %"]].map(([i, n, l]) => `<div class="panel"><span class="ico-box">${icon(i)}</span><div><b>${n}</b><small>${l}</small></div></div>`).join("")}</div>`}
  ${progressBand()}
  <div class="sec-head"><h3 class="sec">${icon("calendar")} Défis de ${new Date().toLocaleDateString("fr-FR", { month: "long" })}</h3><span class="pill">${icon("hourglass", "sm")} Plus que ${daysLeftInMonth()} jours</span></div>
  <div class="cards c3">${monthChallenges().map(challengeCard).join("")}</div>`;
}
