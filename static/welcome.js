/* =====================================================================
   Questline — accueil (premier lancement) et comptes reliés
   Aucun mot de passe : chaque compte est relié par son identifiant public, avec l'accord du joueur.
   Les succès en ligne ne sont lisibles que si le profil est public.
   ===================================================================== */
const wl = { steamPick: null, steamInput: "", epicInput: "", checks: {}, busy: "" };
const PRIVACY_LINK = { steam: "https://steamcommunity.com/my/edit/settings", epic: "https://www.epicgames.com/account/personal" };
const privacyPill = p => p === "public" ? `<span class="pill ok">Profil public</span>` : p === "private" || p === "friendsonly" ? `<span class="pill warn">Profil privé</span>` : `<span class="pill">Visibilité non vérifiée</span>`;

async function wlAction(name, body, okMsg) {
  try { const r = await api(`/api/sources/${name}`, body); if (okMsg) toast(okMsg, "check"); return r; }
  catch (e) { toast(e.message, "info"); return null; }
}
async function wlRefresh() { srcData = null; await loadSources(); await loadLibrary(true); render(); }
async function wlVerify(platform) {
  wl.busy = platform; render();
  const r = await wlAction("verify", { platform });
  if (r) wl.checks[platform] = r;
  wl.busy = ""; await wlRefresh();
}

function steamCard(a) {
  if (!a.found) return accCard("steam", "Steam", "gamepad", a, `<p class="small">Steam n'est pas installé sur ce PC. Installe-le et connecte-toi une fois, puis reviens ici.</p>`);
  const linked = a.enabled && a.accountId;
  const check = wl.checks.steam;
  const body = linked
    ? `<div class="linked">${icon("check", "sm")} Relié à <b>${esc(check?.name || a.name || "SteamID " + a.id64)}</b> ${privacyPill(check?.privacy || a.privacy)}</div>
       <div class="row" style="gap:8px;margin-top:10px"><button class="btn sm" data-wl="verify" data-p="steam" ${wl.busy === "steam" ? "disabled" : ""}>${icon("refresh", "sm")} Vérifier</button><button class="btn sm" data-wl="unlink" data-p="steam">Délier</button></div>`
    : `<p class="small">Choisis ton compte parmi ceux connectés à Steam sur ce PC, ou colle l'adresse de ton profil.</p>
       <div class="accs">${a.users.map(u => `<label class="acc-opt"><input type="radio" name="wlSteam" value="${esc(u.id64)}" ${wl.steamPick === u.id64 ? "checked" : ""} data-wl-steam>${esc(u.name)}${u.recent ? ` <small class="small">(dernier connecté)</small>` : ""}</label>`).join("")}</div>
       <input class="input" style="margin-top:8px" data-wl-input="steamInput" placeholder="steamcommunity.com/profiles/7656… ou SteamID64" value="${esc(wl.steamInput)}">
       <div class="row" style="gap:8px;margin-top:10px"><button class="btn sm accent" data-wl="link" data-p="steam">${icon("check", "sm")} Relier ce compte</button><button class="btn sm" data-wl="skip" data-p="steam">Ne pas utiliser Steam</button></div>`;
  return accCard("steam", "Steam", "gamepad", a, body + privacyHelp("steam", "Steam : Profil > Modifier le profil > Paramètres de confidentialité > « Mon profil » et « Détails de jeu » sur <b>Public</b>."));
}

function epicCard(a) {
  const linked = a.enabled && a.accountId;
  const check = wl.checks.epic;
  const body = linked
    ? `<div class="linked">${icon("check", "sm")} Relié à <b>${esc(check?.name || "ton compte Epic")}</b> ${privacyPill(check?.privacy || (a.status === "ok" ? "public" : a.status === "private" ? "private" : ""))}</div>
       <div class="row" style="gap:8px;margin-top:10px"><button class="btn sm" data-wl="verify" data-p="epic" ${wl.busy === "epic" ? "disabled" : ""}>${icon("refresh", "sm")} Vérifier</button><button class="btn sm" data-wl="unlink" data-p="epic">Délier</button></div>`
    : `<p class="small">Colle l'<b>ID de ton compte</b> (epicgames.com > Compte > Paramètres généraux).${a.detected ? " Un compte est connecté au launcher Epic sur ce PC : tu peux l'utiliser." : ""}</p>
       ${a.detected ? `<button class="btn sm" style="margin-top:8px" data-wl="epicDetected">${icon("search", "sm")} Utiliser le compte du launcher Epic</button>` : ""}
       <input class="input" style="margin-top:8px" data-wl-input="epicInput" placeholder="ID du compte Epic (32 caractères)" value="${esc(wl.epicInput)}">
       <div class="row" style="gap:8px;margin-top:10px"><button class="btn sm accent" data-wl="link" data-p="epic">${icon("check", "sm")} Relier ce compte</button><button class="btn sm" data-wl="skip" data-p="epic">Ne pas utiliser Epic</button></div>`;
  return accCard("epic", "Epic Games", "zap", a, body + privacyHelp("epic", "Epic : Compte > Paramètres > Confidentialité du profil > succès visibles par <b>tout le monde</b>."));
}

function privacyHelp(p, txt) {
  return `<p class="small help">${icon("info", "sm")} Pour récupérer tes succès, ton profil doit être <b>public</b>. ${txt} <button class="link" data-wl="open" data-url="${PRIVACY_LINK[p]}">Ouvrir la page</button></p>`;
}
function accCard(key, title, ic, a, body) {
  const n = a.games ?? 0;
  const status = a.enabled ? `<span class="pill ok">${icon("check", "sm")} ${n} jeu${n > 1 ? "x" : ""}</span>`
    : a.found === false ? `<span class="pill">Introuvable sur ce PC</span>` : `<span class="pill">Non relié</span>`;
  return `<div class="src-card panel ${a.enabled ? "on" : ""}">
    <div class="src-head"><span class="ico-box">${icon(ic)}</span><div><b>${title}</b><small>${a.enabled ? "Relié à Questline" : "Pas encore utilisé"}</small></div>${status}</div>
    <div class="src-body">${body}</div></div>`;
}
function toggleCard(key, title, ic, a, desc, note) {
  return accCard(key, title, ic, a, `<div class="line"><div class="t"><b>Utiliser mes jeux ${title}</b><small>${desc}</small></div>
    <label class="tgl"><input type="checkbox" data-wl-toggle="${key}" ${a.enabled ? "checked" : ""}><span class="track"><span class="knob">${icon("check")}</span></span></label></div>
    ${note ? `<p class="small help">${icon("info", "sm")} ${note}</p>` : ""}`);
}

// bloc des comptes, partagé entre l'accueil et la page Sources
function accountsSection() {
  const a = srcData.accounts;
  return `${steamCard(a.steam)}${epicCard(a.epic)}
    ${toggleCard("gog", "GOG", "target", a.gog, "Jeux installés avec GOG Galaxy (ou Heroic).", "Les succès GOG ne sont pas encore lus par Questline.")}
    ${toggleCard("ubisoft", "Ubisoft Connect", "crown", a.ubisoft, a.ubisoft.found ? "Launcher Ubisoft Connect trouvé sur ce PC." : "Launcher Ubisoft Connect introuvable sur ce PC pour l'instant.", "Ubisoft ne permet pas de lire les succès hors de son launcher : seuls tes jeux et leur lancement sont pris en charge.")}
    ${toggleCard("heroic", "Amazon Games", "layers", a.heroic, "Jeux Amazon installés avec Heroic Games Launcher.")}`;
}

// ------------------------------------------------------------ actions
document.addEventListener("input", e => { const k = e.target.dataset.wlInput; if (k) wl[k] = e.target.value.trim(); });
document.addEventListener("change", async e => {
  const t = e.target;
  if (t.matches("[data-wl-steam]")) { wl.steamPick = t.value; wl.steamInput = ""; return; }
  if (t.dataset.wlToggle) { await wlAction("account", { platform: t.dataset.wlToggle, enabled: t.checked }, t.checked ? "Source activée." : "Source désactivée."); await wlRefresh(); }
});
document.addEventListener("click", async e => {
  const t = e.target.closest("[data-wl],[data-act=wlDone]");
  if (!t || t.disabled) return;
  e.preventDefault(); e.stopPropagation();
  const p = t.dataset.p;
  switch (t.dataset.wl || t.dataset.act) {
    case "link": {
      const accountId = p === "steam" ? (wl.steamInput || wl.steamPick) : wl.epicInput;
      if (!accountId) return toast(p === "steam" ? "Choisis un compte ou colle l'adresse de ton profil." : "Colle l'ID de ton compte Epic.", "info");
      if (await wlAction("account", { platform: p, enabled: true, accountId }, "Compte relié.")) { wl.steamInput = wl.epicInput = ""; await wlVerify(p); }
      return;
    }
    case "epicDetected": wl.epicInput = srcData.accounts.epic.detected || ""; return render();
    case "verify": return wlVerify(p);
    case "unlink": delete wl.checks[p]; await wlAction("account", { platform: p, enabled: false, accountId: "" }, "Compte délié."); return wlRefresh();
    case "skip": await wlAction("account", { platform: p, enabled: false }, null); return wlRefresh();
    case "open": return window.open(t.dataset.url, "_blank");
    case "wlDone": {
      if (!lib.length) return toast("Aucun jeu trouvé pour l'instant : relie un lanceur, ajoute un émulateur ou un jeu.", "info");
      await wlAction("onboard", { done: true }); st = await api("/api/state"); view = "quest"; await wlRefresh();
      return toast("Configuration terminée. Tous les menus sont ouverts, bonne quête !", "check");
    }
  }
});
