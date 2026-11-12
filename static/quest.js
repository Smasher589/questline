/* =====================================================================
   Questline — page « Ma quête » : bannière du jeu, colonne principale (objectif, progression,
   journal, session) et colonne d'informations (style fiche de jeu itch.io)
   ===================================================================== */

// illustration large du jeu : héros Steam, sinon bannière ou jaquette du jeu
function questArt(g, c) {
  if (isSteam(c.appid)) return `/img/${c.appid}/hero`;
  return safeImg(g.hero) || safeImg(g.cover) || null;
}

function questGoal(c, ach, story, storyAch) {
  if (story) {
    const done = !!storyAch?.unlocked;
    return `<div class="qgoal panel ${done ? "done" : ""}"><span class="ico-box ${done ? "ok" : "acc"}">${icon(done ? "trophy" : "flag", "lg")}</span>
      <div><span class="eyebrow">Condition de victoire</span><b>${esc(story.name)}</b><p>${esc(story.desc || "")}</p>
      <small>${isSteam(c.appid) ? "Succès Steam" : c.platform === "epic" ? "Succès Epic" : "Succès lu dans ta sauvegarde"} · débloqué, il lève le bouclier automatiquement.</small></div></div>`;
  }
  if (ach.length) return `<div class="qgoal panel"><span class="ico-box acc">${icon("target", "lg")}</span><div style="flex:1"><span class="eyebrow">Condition de victoire</span><b>Quel succès marque la fin de l'histoire ?</b><p>Je n'ai pas su le deviner, choisis-le une fois pour toutes :</p>
    <select id="storyPick"><option value="">— choisir —</option>${ach.map(a => `<option value="${esc(a.id)}">${esc(a.name)} — ${esc(a.desc)}</option>`).join("")}</select></div></div>`;
  return `<div class="qgoal panel"><span class="ico-box acc">${icon("hourglass", "lg")}</span><div><span class="eyebrow">Condition de victoire</span><b>${c.platform ? "Validation sur l'honneur" : "Succès de fin : détecté au premier lancement"}</b><p>${c.platform ? "Les succès de cette plateforme ne sont pas lisibles : tu valideras toi-même la fin de l'histoire." : "Steam n'a pas encore les succès de ce jeu sur ton PC. Lance-le une fois et reviens ici. S'il n'a aucun succès, tu valideras toi-même la fin."}</p></div></div>`;
}

function questProgress(j) {
  const pct = Math.min(99, Math.round(j.nowPt / Math.max(1, j.est) * 100));
  return `<div class="qprog panel">
    <div class="qprog-top">
      <div><span class="eyebrow">Progression estimée</span><div class="qprog-pct">${pct}<small>%</small></div></div>
      <div class="qprog-eta">${etaText(j)}</div>
    </div>
    <div class="qbar"><i style="width:${pct}%"></i>${[25, 50, 75].map(m => `<span class="mk ${pct >= m ? "on" : ""}" style="left:${m}%"></span>`).join("")}</div>
    <div class="qprog-foot"><span>${fmtH(j.nowPt)} joué sur ≈ ${j.estH} h d'histoire ${j.custom ? "(ta durée)" : "(estimation)"}</span><button class="link" data-act="estEdit">${icon("hourglass", "sm")} Modifier la durée</button></div>
  </div>`;
}

// tableau d'informations, comme le bloc « More information » d'une page itch.io
function questInfo(c, g, j, ach, unlocked, inst, days) {
  const rows = [
    ["Plateforme", g.platform ? platLong(g) : "Steam"],
    ["Engagé", days ? `depuis ${days} jour${days > 1 ? "s" : ""}` : "aujourd'hui"],
    ["Temps de jeu", fmtH(g.playtime)],
    ["Depuis l'engagement", fmtH(j.total)],
    ["Série en cours", `${j.streak} jour${j.streak > 1 ? "s" : ""}`],
    ["Durée de l'histoire", `≈ ${j.estH} h`],
    ["Succès", ach.length ? `<button class="achlink" data-act="achList" data-id="${esc(c.appid)}">${unlocked}/${ach.length} ${icon("right", "sm")}</button>` : "—"],
    ["Metacritic", (() => { const mc = ratingCache[c.appid]?.metacritic?.score ?? g.metacritic; return mc ? `<span class="mcb inline ${mcClass(mc)}">${mc}</span>` : "—"; })()],
    ["Commandes", ratingCache[c.appid]?.controls ? `${icon(CTL_ICON[ratingCache[c.appid].controls.rec] || "info", "sm")} ${esc(ratingCache[c.appid].controls.label.replace(/ recommandée?$/, ""))}` : "…"],
    ["Installation", inst ? (inst.ready ? `<span class="ok-txt">${icon("check", "sm")} Installé</span>` : "Téléchargement…") : "Pas installé"],
  ];
  return `<div class="qinfo panel"><h4 class="mini-title">Informations</h4>
    <table>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</table></div>`;
}

function questShield() {
  const blocked = [...new Set(st.blocked.map(b => b.name).reverse())].slice(0, 3), sl = slots();
  return `<div class="qside-card panel"><div class="qside-head"><span class="ico-box ok">${icon("shield")}</span><div><b>Bouclier actif${st.strict ? " · strict" : ""}</b><small>${sl.used}/${sl.max} jeux installés</small></div></div>
    <p>Au-delà de ${sl.max} jeux installés, tout nouveau téléchargement Steam est annulé et ses raccourcis supprimés.</p>
    ${blocked.length ? `<p class="qside-meta">${icon("lock", "sm")} ${st.blocked.length} tentative${st.blocked.length > 1 ? "s" : ""} bloquée${st.blocked.length > 1 ? "s" : ""} : ${blocked.map(esc).join(", ")}</p>` : ""}</div>`;
}
function questNext() {
  const next = st.queue?.[0];
  if (next) return `<button class="qside-card panel qnext" data-go="queue">${imgTag(next.appid, "cover", "", next.name)}<div><span class="eyebrow">Ensuite</span><b>${esc(next.name)}</b><small>${st.queue.length} jeu${st.queue.length > 1 ? "x" : ""} dans ta file</small></div>${icon("right")}</button>`;
  return `<button class="qside-card panel qnext empty" data-go="tonight"><span class="ico-box">${icon("list")}</span><div><b>Prépare la suite</b><small>Ajoute des jeux à ta file d'attente.</small></div>${icon("right")}</button>`;
}

function viewQuest() {
  const c = st.current, g = byId(c.appid) || { appid: c.appid, name: c.name, playtime: 0, platform: c.platform };
  const inst = c.platform ? { ready: true } : installedEntry(c.appid);
  const days = Math.max(0, Math.floor((Date.now() - new Date(c.since)) / 86400000));
  setBackdrop(null);
  const ach = questAch?.list || [], unlocked = ach.filter(a => a.unlocked).length;
  const story = c.story, storyAch = story && ach.find(a => a.id === story.id);
  const j = journal(c, g), art = questArt(g, c);
  // notes et avis : chargés une fois, puis la page se redessine
  if (!ratingCache[c.appid]) loadRatings(c.appid).then(() => { if (view === "quest" && st.current?.appid === c.appid && !document.querySelector(".scrim")) render(); });
  const chips = [g.platform ? platShort(g) : "Steam", g.dev, year(g) || null, g.review ? `${g.review} % d'avis positifs` : null].filter(Boolean);
  return `
  <section class="qhero">
    <div class="qhero-art" style="--h:${phHue(c.name)};${art ? `background-image:url('${esc(art)}'), var(--banner-fb)` : "background-image:var(--banner-fb)"}"></div>
    <div class="qhero-body">
      <div class="qcover">${imgTag(c.appid, "cover", "cover", c.name, `data-game="${esc(c.appid)}"`)}</div>
      <div class="qhero-info">
        <span class="qbadge">${icon("target", "sm")} Ta quête en cours</span>
        <h1 class="qtitle">${esc(c.name)}</h1>
        <div class="qchips">${chips.map(x => `<span>${esc(x)}</span>`).join("")}</div>
        <div class="qactions">
          ${inst?.ready ? `<button class="btn-play" data-act="play">${icon("play")} Jouer</button>` : `<button class="btn-play" data-act="reinstall">${icon("download")} Installer</button>`}
          ${c.platform && !hasAch(c.appid) ? "" : `<button class="btn sm" data-act="sync">${icon("refresh", "sm")} Synchroniser</button>`}
          ${!story && !ach.length ? `<button class="btn sm" data-act="finish">${icon("check", "sm")} J'ai fini l'histoire</button>` : ""}
          <button class="btn sm" data-game="${esc(c.appid)}">${icon("info", "sm")} Fiche du jeu</button>
          ${c.abandonAt ? "" : `<button class="link" data-act="abandon">Abandonner</button>`}
        </div>
      </div>
    </div>
  </section>
  ${abandonBanner(c)}
  <div class="qlayout">
    <div class="qmain">
      <div class="gs-scores q" id="qScores">${scoreTiles(g, ratingCache[c.appid])}</div>
      ${questGoal(c, ach, story, storyAch)}
      ${questProgress(j)}
      ${journalCard(c, g, j)}
      ${sessionCard(c)}
    </div>
    <aside class="qside">
      ${questInfo(c, g, j, ach, unlocked, inst, days)}
      ${rewardsCard()}
      ${questShield()}
      ${questNext()}
    </aside>
  </div>`;
}
