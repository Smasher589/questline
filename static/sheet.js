/* =====================================================================
   Questline — fiche d'un jeu : bannière, notes (Metacritic, joueurs, presse), commandes conseillées,
   avis (joueurs Steam et presse via Wikipédia), informations et succès
   ===================================================================== */
const ratingCache = {};                               // appid -> notes et avis (réponse de /api/reviews)
async function loadRatings(id) {
  if (ratingCache[id]) return ratingCache[id];
  try { ratingCache[id] = await api(`/api/reviews/${encodeURIComponent(id)}`); } catch (e) { ratingCache[id] = { error: e.message }; }
  return ratingCache[id];
}
const mcClass = s => s >= 75 ? "good" : s >= 50 ? "mid" : "bad";
const userLabel = p => p >= 95 ? "Extrêmement positives" : p >= 80 ? "Très positives" : p >= 70 ? "Plutôt positives" : p >= 40 ? "Moyennes" : "Plutôt négatives";
const CTL_ICON = { pad: "gamepad", kbm: "keyboard", unknown: "info" };

// tuiles de notes réutilisées dans la fiche et dans « Ma quête »
function scoreTiles(g, r) {
  const mc = r?.metacritic?.score || g.metacritic || null, users = r?.users?.pct || g.review || null, press = r?.pressAvg || g.press || null;   // 0 = pas de note
  const tiles = [];
  tiles.push(`<div class="gs-score mc ${mc ? mcClass(mc) : "none"}"><b>${mc ?? "—"}</b><span>Metacritic</span><small>${mc ? (r?.metacritic?.source === "Wikipédia" ? "d'après Wikipédia" : "note de la presse") : "pas de note"}</small></div>`);
  tiles.push(`<div class="gs-score users ${users ? mcClass(users) : "none"}"><b>${users ? users + " %" : "—"}</b><span>Avis des joueurs</span><small>${users ? userLabel(users) : "non disponibles"}</small></div>`);
  tiles.push(`<div class="gs-score press ${press ? mcClass(press) : "none"}"><b>${press ?? "—"}</b><span>Moyenne presse</span><small>${r?.press?.length ? `${r.press.filter(p => p.norm).length} médias` : "—"}</small></div>`);
  const c = r?.controls;
  tiles.push(`<div class="gs-score ctl ${c ? c.rec : "unknown"}" title="${esc(c?.detail || "")}"><b>${icon(CTL_ICON[c?.rec] || "info")}</b><span>${esc(c?.label || "Commandes")}</span><small>${c ? (c.rec === "pad" ? "Manette" : c.rec === "kbm" ? "Clavier-souris" : "Non précisé") : "…"}</small></div>`);
  return tiles.join("");
}

function reviewCard(c, k) {
  const t = c.positive === true ? ["pos", "thumbup", "Positif"] : c.positive === false ? ["neg", "thumbdown", "Réserves"] : ["mix", "scale", "Nuancé"];
  return `<article class="rv ${t[0]}" data-tone="${t[0]}">
    <header><span class="rv-av" style="--h:${(k * 47) % 360}">${esc((c.author || "?")[0])}</span>
      <div><b>${esc(c.author)}</b><small>${c.source === "press" ? "Presse" : "Joueur Steam"}${c.meta ? ` · ${esc(c.meta)}` : ""}${c.date ? ` · ${esc(c.date)}` : ""}</small></div>
      <span class="rv-tone">${icon(t[1] === "scale" ? "scale" : t[1] === "thumbup" ? "check" : "x", "sm")} ${t[2]}</span></header>
    <p>${esc(c.text)}</p>
    ${c.text.length > 260 ? `<button class="link rv-more" data-act="rvMore">Lire la suite</button>` : ""}
  </article>`;
}
function reviewsBlock(g, r) {
  if (!r) return `<div class="gs-loading"><div class="loader sm"></div><span>Récupération des notes et des avis…</span></div>`;
  if (r.error) return `<p class="small">${esc(r.error)}</p>`;
  const list = r.comments || [];
  if (!list.length) return `<p class="small">Aucun avis public trouvé pour ce jeu.</p>`;
  const n = { all: list.length, pos: list.filter(c => c.positive === true).length, neg: list.filter(c => c.positive === false).length };
  const src = [];
  if ((r.commentsFrom || []).includes("steam")) src.push(`<button class="link" data-wl="open" data-url="https://steamcommunity.com/app/${esc(r.steamAppid)}/reviews/">évaluations Steam</button>`);
  if (r.wiki) src.push(`<button class="link" data-wl="open" data-url="${esc(r.wiki.url)}">Wikipédia</button> (CC BY-SA 4.0)`);
  return `<div class="rv-tabs" data-f="all">
      <button class="on" data-act="rvFilter" data-f="all">Tous (${n.all})</button><button data-act="rvFilter" data-f="pos">Positifs (${n.pos})</button><button data-act="rvFilter" data-f="neg">Réserves (${n.neg})</button></div>
    <div class="rv-list">${list.map(reviewCard).join("")}</div>
    <p class="small rv-src">Sources : ${src.join(" · ")}. Les extraits de presse résument les critiques publiées.</p>`;
}
function pressBlock(r) {
  const list = (r?.press || []).filter(p => p.norm && !/metacritic|opencritic/i.test(p.outlet)).sort((a, b) => b.norm - a.norm).slice(0, 10);
  if (!list.length) return "";
  return `<div class="gs-box panel"><h4 class="mini-title">Notes de la presse</h4>
    ${list.map(p => `<div class="gs-press"><span>${esc(p.outlet)}</span><div class="bar"><i class="${mcClass(p.norm)}" style="width:${p.norm}%"></i></div><b>${esc(p.value)}</b></div>`).join("")}</div>`;
}

async function openSheet(id) {
  const g = byId(id) || { appid: id, name: st.current?.name || "Jeu", tags: [], playtime: 0 };
  const s = modal(`<div class="center" style="padding:40px"><div class="loader"></div></div>`, null, "sheet gsheet");
  let d = {};
  if (isSteam(id)) try { d = await api(`/api/details/${id}`); } catch {}
  const store = d.store || {}, p = d.progress || prog(id);
  const tags = (g.tags || []).slice(0, 8).map(t => tagNames[t]).filter(Boolean);
  const canPick = !st.current && finishable(g), done = p?.storyDone || st.finished.some(f => String(f.appid) === String(id));
  const isCur = String(st.current?.appid) === String(id);
  const art = isSteam(id) ? `/img/${id}/hero` : safeImg(g.hero) || safeImg(g.cover);
  const prev = earlierUnfinished(g);
  const info = [
    ["Plateforme", g.platform ? platLong(g) : "Steam"],
    ["Temps de jeu", fmtH(g.playtime)],
    ["Durée de l'histoire", `≈ ${estimateHours(g)} h`],
    ["Dernière session", g.lastPlayed ? new Date(g.lastPlayed * 1000).toLocaleDateString("fr-FR") : "—"],
    ["Sortie", store.date || year(g) || ratingCache[id]?.wiki?.year || ""],
    ["Développeur", g.dev || ""],
    ["Éditeur", store.publishers?.[0] || ""],
  ].filter(([, v]) => v);   // lignes sans information masquées
  s.querySelector(".modal").innerHTML = `
    <div class="gs-banner" style="--h:${phHue(g.name)};${art ? `background-image:url('${esc(art)}'), var(--banner-fb)` : "background-image:var(--banner-fb)"}"><button class="x" data-close aria-label="Fermer">${icon("x")}</button></div>
    <div class="gs-head">
      <div class="gs-cover">${imgTag(id, "cover", "cover", g.name)}</div>
      <div class="gs-title">
        <div class="gs-badges">${badges(id, g).replace('class="tbs"', 'class="row" style="gap:6px"')}</div>
        <h2>${esc(g.name)}</h2>
        <div class="gs-sub">${[g.platform ? platLong(g) : "Steam", g.dev, store.date || year(g) || null].filter(Boolean).map(esc).join(" · ")}</div>
        ${tags.length ? `<div class="gs-tags">${tags.map(t => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
      </div>
    </div>
    <div class="gs-scores" id="gsScores">${scoreTiles(g, ratingCache[id])}</div>
    <div class="gs-actions">
      ${canPick ? `<button class="btn-play" data-act="pickFromSheet" data-id="${esc(id)}">${icon("flag")} Commencer cette quête</button>` : ""}
      ${isCur ? `<button class="btn-play" data-act="play">${icon("play")} Jouer</button>` : ""}
      ${st.current && isSteam(id) && !g.installed && !isCur && slots().free ? `<button class="btn sm" data-act="installGame" data-id="${esc(id)}">${icon("download", "sm")} Installer (place ${slots().used + 1}/${slots().max})</button>` : ""}
      ${finishable(g) && !inQueue(id) && !isCur ? `<button class="btn sm" data-act="queueAdd" data-id="${esc(id)}">${icon("list", "sm")} Ajouter à ma file</button>` : ""}
      ${done ? `<button class="btn sm" data-act="card" data-id="${esc(id)}">${icon("image", "sm")} Carte de victoire</button>` : ""}
      ${isSteam(id) ? `<button class="btn sm" data-act="saves" data-id="${esc(id)}">${icon("save", "sm")} Sauvegardes</button>
      <button class="btn sm" data-steam="details" data-id="${esc(id)}">${icon("steam", "sm")} Steam</button>
      <button class="btn sm" data-steam="store" data-id="${esc(id)}">${icon("external", "sm")} Magasin</button>` : ""}
    </div>
    ${prev ? `<div class="notice panel gs-notice"><span class="ico-box acc">${icon("layers")}</span><div>Épisode précédent pas encore fini : <b>${esc(prev.name)}</b>. Commence par lui pour suivre l'histoire dans l'ordre. <button class="link" data-game="${esc(prev.appid)}">Voir sa fiche</button></div></div>` : ""}
    <div class="gs-grid">
      <div class="gs-main">
        ${store.desc || g.desc ? `<section><h4 class="mini-title">À propos du jeu</h4><p class="gs-desc">${esc(store.desc || g.desc)}</p></section>` : ""}
        ${store.screenshots?.length ? `<div class="shots">${store.screenshots.map(u => `<img src="${esc(u)}" alt="" loading="lazy">`).join("")}</div>` : ""}
        <section><h4 class="mini-title">Avis</h4><div id="gsReviews">${reviewsBlock(g, ratingCache[id])}</div></section>
      </div>
      <aside class="gs-side">
        <div class="gs-box panel" id="gsControls">${controlsBox(ratingCache[id])}</div>
        <div class="gs-box panel"><h4 class="mini-title">Informations</h4><table class="gs-info">${info.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join("")}</table></div>
        ${hasAch(id) ? `<div class="gs-box panel">${p
          ? `<h4 class="mini-title">Succès</h4><div class="row" style="justify-content:space-between"><b style="font-family:var(--display)">${icon(p.perfect ? "trophy" : "award", "sm")} ${p.unlocked}/${p.total}</b><span class="small">${Math.round(p.unlocked / p.total * 100)} %</span></div>
             <div class="bar" style="margin:8px 0"><i style="width:${Math.round(p.unlocked / p.total * 100)}%"></i></div>
             <p class="small">${p.perfect ? "Jeu fini à 100 %." : p.storyDone ? "Histoire terminée." : p.story ? `Succès de fin : « ${esc(p.story)} ».` : "Succès de fin pas encore identifié."}</p>
             <button class="btn sm" style="margin-top:10px" data-act="achList" data-id="${esc(id)}">${icon("trophy", "sm")} Tous les succès</button>`
          : `<h4 class="mini-title">Succès</h4><p class="small">Pas encore de données sur ce PC : un lancement du jeu les récupère.</p>`}</div>` : ""}
        <div id="gsPress">${pressBlock(ratingCache[id])}</div>
        <div id="savesBox"></div>
      </aside>
    </div>`;
  if (!ratingCache[id]) {
    const r = await loadRatings(id);
    if (!s.isConnected) return;
    s.querySelector("#gsScores").innerHTML = scoreTiles(g, r);
    s.querySelector("#gsReviews").innerHTML = reviewsBlock(g, r);
    s.querySelector("#gsPress").innerHTML = pressBlock(r);
    s.querySelector("#gsControls").innerHTML = controlsBox(r);
    if (isCur && view === "quest") render();
  }
}
function controlsBox(r) {
  const c = r?.controls;
  return `<h4 class="mini-title">Commandes conseillées</h4>${c
    ? `<div class="gs-ctl ${c.rec}"><span class="ico-box">${icon(CTL_ICON[c.rec] || "info")}</span><div><b>${esc(c.label)}</b><small>${esc(c.detail)}</small></div></div>`
    : `<div class="gs-loading"><div class="loader sm"></div><span>Vérification…</span></div>`}`;
}

document.addEventListener("click", e => {
  const t = e.target.closest("[data-act=rvFilter],[data-act=rvMore]");
  if (!t) return;
  if (t.dataset.act === "rvMore") { const a = t.closest(".rv"); a.classList.toggle("open"); t.textContent = a.classList.contains("open") ? "Réduire" : "Lire la suite"; return; }
  const box = t.closest(".rv-tabs"); box.dataset.f = t.dataset.f;
  box.querySelectorAll("button").forEach(b => b.classList.toggle("on", b === t));
  box.parentElement.querySelectorAll(".rv").forEach(a => { a.style.display = t.dataset.f === "all" || a.dataset.tone === t.dataset.f ? "" : "none"; });
});
