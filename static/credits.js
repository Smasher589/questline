/* =====================================================================
   Questline — page Crédits : artistes, typographies, composants, données et technologies
   ===================================================================== */
const CREDITS_ART = [
  { n: "Vector Ranks", by: "RhosGFX", url: "https://rhosgfx.itch.io/vector-ranks", lic: "CC0",
    use: "Les 216 emblèmes des succès à paliers, du palier I au palier XII.", pv: "ranks" },
  { n: "Trophy Cups + Medal icons", by: "3DPyramid", url: "https://3dpyramid.itch.io/trophy-cups-icons-medal-icons", lic: "CC0",
    use: "Les médailles des défis du mois et la coupe de l'écran de victoire.", pv: "trophies" },
  { n: "Night Sky — Pixel Art Background", by: "ChrisPpop", url: "https://chrisppop.itch.io/night-sky-pixel-art-background", lic: "CC0",
    use: "Les décors Nuit étoilée, Nuit d'été, Nuit glacée et Nuit pourpre.", pv: "nuit" },
  { n: "Dark Forest", by: "Val_DeMar", url: "https://val-demar.itch.io/dark-forest", lic: "CC0",
    use: "Le décor Forêt sombre.", pv: "foret" },
  { n: "Mountain Dusk Parallax background", by: "ansimuz", url: "https://ansimuz.itch.io/mountain-dusk-parallax-background", lic: "CC0",
    use: "Les décors Crépuscule, Montagnes brumeuses et Canyon.", pv: "crepuscule" },
  { n: "Seamless Space Backgrounds", by: "Screaming Brain Studios", url: "https://screamingbrainstudios.itch.io/seamless-space-backgrounds", lic: "CC0",
    use: "Les décors Nébuleuses (bleue, violette, verte) et Champ d'étoiles.", pv: "nebuleuse-violette" },
];
const CREDITS_MORE = [
  { t: "Typographies", i: "book", items: [
    ["Inter", "Rasmus Andersson", "SIL Open Font License 1.1", "https://github.com/rsms/inter"],
    ["Space Grotesk", "Florian Karsten", "SIL Open Font License 1.1", "https://github.com/floriankarsten/space-grotesk"],
    ["VT323", "Peter Hull", "SIL Open Font License 1.1", "https://github.com/phoikoi/VT323"],
    ["Press Start 2P", "CodeMan38", "SIL Open Font License 1.1", "https://github.com/google/fonts/tree/main/ofl/pressstart2p"] ] },
  { t: "Composants d'interface", i: "sparkles", items: [
    ["Bouton « espace »", "StealthWorm (uiverse.io)", "MIT", "https://uiverse.io/StealthWorm/spotty-horse-48"],
    ["Cartes retournables du top 5", "ElSombrero2 (uiverse.io)", "MIT", "https://uiverse.io/ElSombrero2/tricky-robin-67"] ] },
  { t: "Données et jaquettes", i: "image", items: [
    ["titledb", "blawar et contributeurs", "Données Switch publiques", "https://github.com/blawar/titledb"],
    ["libretro-thumbnails", "libretro", "Jaquettes rétro", "https://github.com/libretro-thumbnails/libretro-thumbnails"],
    ["GameTDB", "GameTDB", "Jaquettes Wii et GameCube", "https://www.gametdb.com"],
    ["SteamGridDB", "Communauté SteamGridDB", "Jaquettes (clé facultative)", "https://www.steamgriddb.com"],
    ["Wikipédia et Wikidata", "Contributeurs Wikimedia", "Notes et extraits critiques · CC BY-SA 4.0", "https://fr.wikipedia.org"],
    ["Steam, Epic Games, Nintendo", "Valve, Epic Games, Nintendo", "Données publiques des magasins, profils et évaluations", null] ] },
  { t: "Technologies", i: "monitor", items: [
    ["Electron", "OpenJS Foundation", "MIT", "https://github.com/electron/electron"],
    ["electron-builder", "electron-userland", "MIT", "https://github.com/electron-userland/electron-builder"],
    ["Node.js", "OpenJS Foundation", "MIT", "https://github.com/nodejs/node"] ] },
];

// aperçu de chaque pack, composé à partir des images intégrées
function creditPreview(pv) {
  if (pv === "ranks") return `<div class="cr-pv ranks">${["hexagon-gold-3", "shield-sapphire-7", "diamond-ruby-10", "hexagon-master-12", "shield-amethyst-5"].map(r => `<img src="/static/art/ranks/${r}.png" alt="">`).join("")}</div>`;
  if (pv === "trophies") return `<div class="cr-pv trophies"><img src="/static/art/trophies/medal-silver.png" alt=""><img src="/static/art/trophies/cup-gold.png" alt=""><img src="/static/art/trophies/medal-bronze.png" alt=""></div>`;
  const s = SCENES.find(x => x.id === pv);
  const bg = s.tile ? `background:url('${sceneUrl(s, 1)}') center/220px` : `background-image:${[...Array(s.l)].map((_, k) => `url('${sceneUrl(s, s.l - k)}')`).join(",")};background-size:cover;background-position:center bottom`;
  return `<div class="cr-pv scene" style="${bg}"></div>`;
}

function viewCredits() {
  setBackdrop(null);
  if (!st.flags?.credits) api("/api/flag", { name: "credits" }).then(s => { st = s; }).catch(() => {});
  const link = (url, label = "Voir") => url ? `<button class="btn xs" data-wl="open" data-url="${esc(url)}">${icon("external", "sm")} ${label}</button>` : "";
  return `
  <section class="cr-hero panel gborder">
    <div class="cr-hero-txt">
      <span class="eyebrow">Crédits</span>
      <h1 class="display" style="font-size:42px">Merci aux <span class="cr-accent">créateurs</span>.</h1>
      <p class="lead">Questline existe grâce à des artistes et des développeurs qui partagent leur travail librement. Toutes les illustrations sont sous licence <b>CC0</b> : domaine public, utilisables sans condition. Les citer ici est notre façon de les remercier.</p>
      <div class="row" style="gap:8px;flex-wrap:wrap"><span class="pill ok">${icon("check", "sm")} ${CREDITS_ART.length} packs d'illustrations CC0</span><span class="pill">${icon("image", "sm")} 272 images</span><span class="pill">${icon("heart", "sm")} Version ${esc(st.version || "")}</span></div>
    </div>
    <div class="cr-hero-art">${["hexagon-master-12", "shield-ruby-11", "diamond-platinum-12", "hexagon-gold-10", "shield-sapphire-12", "diamond-amethyst-9"].map((r, k) => `<img style="--k:${k}" src="/static/art/ranks/${r}.png" alt="">`).join("")}</div>
  </section>

  <div class="sec-head"><h3 class="sec">${icon("palette")} Illustrations</h3><span class="pill">itch.io · CC0</span></div>
  <div class="cr-grid">${CREDITS_ART.map(a => `
    <article class="cr-card panel">
      ${creditPreview(a.pv)}
      <div class="cr-body">
        <div class="cr-author"><span class="cr-avatar">${esc(a.by[0])}</span><div><b>${esc(a.by)}</b><small>${esc(a.n)}</small></div></div>
        <p>${esc(a.use)}</p>
        <div class="row" style="justify-content:space-between;gap:8px"><span class="pill ok">${a.lic} · domaine public</span>${link(a.url, "itch.io")}</div>
      </div>
    </article>`).join("")}</div>

  <div class="sec-head"><h3 class="sec">${icon("pixel")} Dessiné pour Questline</h3><span class="pill">Pixel art maison</span></div>
  <div class="cr-home">
    <article class="cr-hc panel"><div class="cr-hc-art">${pixelCoin(true)}</div>
      <div><b>Pièce de crédits</b><small>Grille 16 × 16, dessinée pixel par pixel. Elle flotte dans ta liste de souhaits et tourne au survol.</small><span class="pill">Depuis la 2.12.1</span></div></article>
    <article class="cr-hc panel"><div class="cr-hc-art">${rankEmblem(currentLevel(), 78)}</div>
      <div><b>Écusson de rang</b><small>Grille 32 × 36 aux couleurs de ton rang, avec ton niveau en chiffres pixelisés.</small><span class="pill">Depuis la 2.16.0</span></div></article>
  </div>

  <div class="cr-more">${CREDITS_MORE.map(g => `
    <div class="set panel"><h3 class="sec">${icon(g.i)} ${g.t}</h3>
      ${g.items.map(([n, by, lic, url]) => `<div class="line"><div class="t"><b>${esc(n)}</b><small>${esc(by)} · ${esc(lic)}</small></div>${link(url)}</div>`).join("")}
    </div>`).join("")}</div>
  <p class="small" style="margin-top:18px;text-align:center">Le détail des fichiers et de leurs sources est aussi dans <code>static/art/CREDITS.txt</code>, livré avec l'application.</p>`;
}
