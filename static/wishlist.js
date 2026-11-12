/* =====================================================================
   Questline — liste de souhaits : portefeuille de crédits, recherche sur le magasin Steam,
   envies en cartes, achats passés
   ===================================================================== */
// grande bannière officielle (460×215) ; la vignette de la recherche Steam est trop petite et floue
const capsule = appid => `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;

// pièce en pixel art 16×16 dessinée à la main : contour, tranche éclairée en haut à gauche, rainure, étoile
const COIN_MAP = [
  "....oooooooo....",
  "..oohhllllmmoo..",
  ".ohhlllllllmmro.",
  ".ohlssssssssmro.",
  "ohlshfffffffsmro",
  "ohlsfffeefffsmro",
  "ohlsfffeefffsmro",
  "ollseeeeeeeesmro",
  "ollsffeeeeffsmro",
  "ollsffeeeeffsrro",
  "olmsfeeffeefsrro",
  "olmsffffffffsrro",
  ".olmssssssssrro.",
  ".olmmmmmmmmrrro.",
  "..oorrrrrrrroo..",
  "....oooooooo....",
];
const COIN_PAL = {
  gold: { o: "#3a2206", h: "#fff6cf", l: "#ffd25e", m: "#e8a93a", r: "#a8641a", s: "#c47f24", f: "#f0b84a", e: "#8a4f10" },
  grey: { o: "#0d0b13", h: "#c4bed6", l: "#8d86a3", m: "#6a6480", r: "#3f3a50", s: "#4f4962", f: "#5f5973", e: "#2c2838" },
};
function pixelCoin(on) {
  const P = COIN_PAL[on ? "gold" : "grey"];
  const px = COIN_MAP.flatMap((row, y) => [...row].map((c, x) => (c === "." ? "" : `<rect x="${x}" y="${y}" width="1" height="1" fill="${P[c]}"/>`)));
  return `<svg class="pcoin" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${px.join("")}</svg>`;
}

function creditWallet(c) {
  const done = c.rule - c.toNext;                               // jeux déjà finis vers le prochain crédit
  const pct = Math.round(done / c.rule * 100);
  return `<div class="wallet panel">
    <div class="wallet-coin ${c.available ? "has" : ""}" title="${c.available} crédit${c.available > 1 ? "s" : ""} d'achat">
      ${pixelCoin(c.available > 0)}
      <b class="wallet-n">×${c.available}</b>
    </div>
    <div class="wallet-main">
      <span class="eyebrow">Tes crédits d'achat</span>
      <h3>${c.available ? `${c.available} achat${c.available > 1 ? "s" : ""} autorisé${c.available > 1 ? "s" : ""}` : "Pas encore de crédit"}</h3>
      <p>Chaque fois que tu termines ${c.rule > 1 ? `${c.rule} jeux` : "un jeu"}, tu gagnes le droit d'en acheter un nouveau.</p>
      <div class="wallet-steps" title="${done}/${c.rule} vers le prochain crédit">${[...Array(c.rule)].map((_, k) => `<i class="${k < done ? "on" : ""}">${k < done ? icon("check", "sm") : k + 1}</i>`).join("")}
        <span>${c.toNext === c.rule && c.available ? "Prochain crédit : " : ""}encore <b>${c.toNext} jeu${c.toNext > 1 ? "x" : ""}</b> à finir pour le prochain crédit</span></div>
    </div>
    <div class="wallet-stats">
      <div><b>${c.fin}</b><span>jeux finis</span></div>
      <div><b>${c.earned}</b><span>crédits gagnés</span></div>
      <div><b>${c.spent}</b><span>dépensés</span></div>
      <button class="link" data-act="walletRule">${icon("gear", "sm")} Changer la règle</button>
    </div>
    <div class="wallet-ring" style="--p:${pct}" aria-hidden="true"></div>
  </div>`;
}

function viewWishlist() {
  setBackdrop(null);
  const c = credits(), w = st.wishlist || [];
  const todo = w.filter(x => !x.boughtAt), bought = w.filter(x => x.boughtAt);
  const res = wishResults;
  const inWish = id => w.some(x => String(x.appid) === String(id));
  return `
  <div class="page-head"><div><span class="eyebrow">Achète en le méritant</span><h2 class="title">Liste de souhaits</h2></div></div>
  ${creditWallet(c)}
  <div class="wsearch">
    <label class="lsearch">${icon("search", "sm")}<input id="wq" placeholder="Ajouter une envie : recherche un jeu sur le magasin Steam…" autocomplete="off"></label>
    <button class="btn-play" data-act="wsearch">${icon("search")} Rechercher</button>
  </div>
  ${res === "loading" ? `<div class="center" style="padding:24px"><div class="loader"></div></div>`
    : res ? `<div class="sec-head"><h3 class="sec">${icon("search")} Résultats</h3><button class="link" data-act="wclear">${icon("x", "sm")} Fermer</button></div>
      ${res.length ? `<div class="wgrid">${res.map(r => `<div class="wcard panel">
        <div class="wimg"><img src="${esc(capsule(r.appid))}" alt="" loading="lazy">${byId(r.appid) ? `<span class="wtag">Déjà possédé</span>` : ""}</div>
        <div class="wbody"><b>${esc(r.name)}</b><span class="wprice">${esc(r.price || "Prix non communiqué")}</span></div>
        <div class="wact">${inWish(r.appid) ? `<span class="pill ok">${icon("check", "sm")} Dans tes envies</span>` : `<button class="btn sm" data-act="wadd" data-r='${esc(JSON.stringify(r))}'>${icon("heart", "sm")} Ajouter aux envies</button>`}</div></div>`).join("")}</div>`
        : `<p class="small">Aucun résultat pour cette recherche.</p>`}` : ""}
  <div class="sec-head"><h3 class="sec">${icon("heart")} Tes envies <span class="count">${todo.length}</span></h3>${todo.length ? `<span class="small">${c.available ? "Tu peux en acheter " + c.available : "Termine des jeux pour débloquer un achat"}</span>` : ""}</div>
  ${todo.length ? `<div class="wgrid">${todo.map(x => `<div class="wcard panel ${c.available ? "can" : ""}">
      <div class="wimg"><img src="${esc(capsule(x.appid))}" alt="" loading="lazy" data-game="${byId(x.appid) ? esc(x.appid) : ""}"></div>
      <div class="wbody"><b>${esc(x.name)}</b><span class="wprice">${esc(x.price || "Prix non communiqué")}</span><small>Ajouté le ${new Date(x.addedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</small></div>
      <div class="wact">
        <button class="${c.available ? "btn-play" : "btn sm"}" data-act="wbuy" data-id="${esc(x.appid)}" ${c.available ? "" : `disabled title="Encore ${c.toNext} jeu${c.toNext > 1 ? "x" : ""} à finir"`}>${icon(c.available ? "cart" : "lock", "sm")} ${c.available ? "Acheter (−1 crédit)" : `Encore ${c.toNext} jeu${c.toNext > 1 ? "x" : ""} à finir`}</button>
        <button class="btn sm icon danger-soft" title="Retirer de mes envies" data-act="wremove" data-id="${esc(x.appid)}">${icon("trash", "sm")}</button>
      </div></div>`).join("")}</div>`
    : `<div class="wempty panel"><span class="ico-box">${icon("heart", "lg")}</span><div><b>Aucune envie pour l'instant</b><p>Recherche un jeu ci-dessus : il attendra ici que tu aies gagné le droit de l'acheter.</p></div></div>`}
  ${bought.length ? `<div class="sec-head"><h3 class="sec">${icon("check")} Achetés <span class="count">${bought.length}</span></h3></div>
    <div class="wbought">${bought.map(x => `<div class="wb panel"><img src="${esc(capsule(x.appid))}" alt="" loading="lazy"><div><b>${esc(x.name)}</b><small>Acheté le ${new Date(x.boughtAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</small></div></div>`).join("")}</div>` : ""}`;
}

document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "wq") { e.preventDefault(); doWishSearch(); } });
document.addEventListener("click", e => {
  const t = e.target.closest("[data-act=wclear],[data-act=walletRule]");
  if (!t) return;
  if (t.dataset.act === "wclear") { wishResults = null; return render(); }
  settingsTab = "shop"; view = "settings"; render();
});
