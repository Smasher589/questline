/* =====================================================================
   Questline — médailles (badges), emblèmes de rang, animations de déblocage
   ===================================================================== */

let medalSeq = 0;
const hexPts = (r, cx = 50, cy = 52) => [...Array(6)].map((_, k) => { const a = Math.PI / 180 * (60 * k - 90); return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`; }).join(" ");
const starPath = (cx, cy, r) => [...Array(10)].map((_, k) => { const a = Math.PI / 5 * k - Math.PI / 2, rr = k % 2 ? r * .45 : r; return `${k ? "L" : "M"}${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`; }).join("") + "Z";

/* médaille hexagonale : métal selon la rareté, icône gravée, étoiles, reflet animé.
   Verrouillée : grisée, avec un anneau de progression autour. */
function medal(b, size = 92) {
  const t = TIERS[b.tier], id = `md${++medalSeq}`, on = b.earned;
  const stars = [...Array(t.stars)].map((_, k) => { const w = t.stars * 9; return `<path d="${starPath(50 - w / 2 + 4.5 + k * 9, 101.5, 3.4)}" fill="${on ? t.g[0] : "#77708a"}"/>`; }).join("");
  return `<svg class="medal ${on ? "on" : "off"} t-${b.tier}" viewBox="-4 -4 108 116" width="${size}" height="${size * 116 / 108}" style="--mg:${t.glow}">
    <defs>
      <linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.g[0]}"/><stop offset=".48" stop-color="${t.g[1]}"/><stop offset="1" stop-color="${t.g[2]}"/></linearGradient>
      <linearGradient id="${id}i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.g[0]}"/><stop offset="1" stop-color="${t.g[1]}"/></linearGradient>
      <radialGradient id="${id}c" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#2c2443"/><stop offset="1" stop-color="#0a0811"/></radialGradient>
      <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <clipPath id="${id}k"><polygon points="${hexPts(47)}"/></clipPath>
    </defs>
    ${on ? "" : `<polygon class="ring-bg" points="${hexPts(51)}" fill="none" stroke-width="3"/><polygon class="ring" points="${hexPts(51)}" fill="none" stroke-width="3" pathLength="100" stroke-dasharray="${(b.p * 100).toFixed(1)} 100"/>`}
    <g class="body">
      <polygon points="${hexPts(47)}" fill="url(#${id}m)"/>
      <polygon points="${hexPts(47)}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".8"/>
      <polygon points="${hexPts(39)}" fill="url(#${id}c)" stroke="${t.g[2]}" stroke-width="1.6"/>
      <polygon points="${hexPts(36)}" fill="none" stroke="url(#${id}m)" stroke-opacity=".5" stroke-width=".7"/>
      <g transform="translate(31 33) scale(1.58)" fill="none" stroke="url(#${id}i)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[b.i] || ""}</g>
      <rect x="${50 - t.stars * 4.5 - 4}" y="95.5" width="${t.stars * 9 + 8}" height="12" rx="6" fill="#0a0811" stroke="url(#${id}m)" stroke-width="1.2"/>
      ${stars}
      ${on ? `<g clip-path="url(#${id}k)"><rect class="sheen" x="-30" y="-10" width="26" height="130" fill="url(#${id}s)"/></g>` : ""}
    </g>
    ${on ? "" : `<g class="lock" transform="translate(70 70)"><circle r="11" fill="#0a0811" stroke="#5c5670" stroke-width="1.5"/><g transform="translate(-6 -6.5) scale(.5)" fill="none" stroke="#a39eb8" stroke-width="2.4" stroke-linecap="round">${ICONS.lock}</g></g>`}
  </svg>`;
}

/* emblème de rang : bouclier aux couleurs du rang, icône et niveau */
function rankEmblem(level, size = 110) {
  const r = rankOf(level), id = `rk${++medalSeq}`;
  return `<svg class="emblem" viewBox="0 0 100 112" width="${size}" height="${size * 1.12}" style="--rc:${r.c}">
    <defs>
      <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".35" stop-color="${r.c}"/><stop offset="1" stop-color="${r.c}" stop-opacity=".45"/></linearGradient>
      <radialGradient id="${id}c" cx=".5" cy=".3" r=".85"><stop offset="0" stop-color="#2c2443"/><stop offset="1" stop-color="#0a0811"/></radialGradient>
    </defs>
    <path d="M50 3 92 18v34c0 26-18 46-42 56C26 98 8 78 8 52V18z" fill="url(#${id}g)"/>
    <path d="M50 12 84 24v28c0 21-14 37-34 46C30 89 16 73 16 52V24z" fill="url(#${id}c)" stroke="${r.c}" stroke-width="1.5"/>
    <g transform="translate(34 24) scale(1.33)" fill="none" stroke="${r.c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[r.i] || ""}</g>
    <text x="50" y="80" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="20" fill="#fff">${level}</text>
  </svg>`;
}

/* ---------------------------------------------------------------- fiche d'un badge */
function badgeDates() { try { return JSON.parse(localStorage.getItem("ql_badge_dates") || "{}"); } catch { return {}; } }
function openBadge(id) {
  const b = profileData().badges.find(x => x.id === id); if (!b) return;
  const d = badgeDates()[id];
  sfx("click");
  modal(`<div class="badge-sheet t-${b.tier}" style="--tc:${b.t.glow}">
      <button class="x" data-close>${icon("x")}</button>
      <div class="burst"></div>
      <div class="spin3d">${medal(b, 170)}</div>
      <span class="rarity" style="--tc:${b.t.glow}">${b.t.r} · ${b.t.n}</span>
      <h3>${esc(b.n)}</h3>
      <p>${esc(b.d)}</p>
      ${b.earned
        ? `<div class="row" style="justify-content:center"><span class="pill ok">${icon("check", "sm")} Obtenu${d ? ` le ${new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}` : ""}</span><span class="xp-chip">+${b.t.xp} XP</span></div>`
        : `<div class="bprog"><div class="row" style="justify-content:space-between"><span>${b.cur} / ${b.goal} ${esc(b.u)}</span><span>${Math.round(b.p * 100)} %</span></div><div class="bar lg"><i style="width:${Math.round(b.p * 100)}%"></i></div></div>
           <div class="row" style="justify-content:center"><span class="xp-chip">Récompense : +${b.t.xp} XP</span></div>`}
    </div>`, null, "badge-modal");
}

/* ---------------------------------------------------------------- célébrations : badge débloqué, niveau supérieur */
const celebQueue = [];
let celebBusy = false;
function celebrateUnlock(item) { celebQueue.push(item); if (!celebBusy) nextCeleb(); }
function nextCeleb() {
  const it = celebQueue.shift();
  if (!it) { celebBusy = false; return; }
  celebBusy = true;
  const el = document.createElement("div");
  el.className = "unlock";
  if (it.type === "badge") {
    const b = it.badge;
    el.style.setProperty("--tc", b.t.glow);
    el.innerHTML = `<div class="rays"></div><div class="unlock-box">
      <span class="eyebrow">Badge débloqué</span>
      <div class="pop">${medal({ ...b, earned: true }, 200)}</div>
      <span class="rarity" style="--tc:${b.t.glow}">${b.t.r} · ${b.t.n}</span>
      <h2>${esc(b.n)}</h2><p>${esc(b.d)}</p>
      <span class="xp-chip big">+${b.t.xp} XP</span>
      <button class="btn accent" data-done>Génial !</button></div>`;
    sfx("badge");
  } else if (it.type === "tier") {
    const f = it.fam;
    el.style.setProperty("--tc", "#ffc93c");
    el.innerHTML = `<div class="rays"></div><div class="unlock-box">
      <span class="eyebrow">Nouveau palier</span>
      <div class="pop"><img class="temb big" src="${tierArt(f, it.level)}" alt=""></div>
      <span class="rarity" style="--tc:#ffc93c">Palier ${TIER_NAMES[it.level - 1]} sur XII</span>
      <h2>${esc(f.n)}</h2><p>${f.steps[it.level - 1].toLocaleString("fr-FR")} ${esc(f.u)}. ${f.steps[it.level] ? `Prochain palier : ${f.steps[it.level].toLocaleString("fr-FR")}.` : "Palier maximum atteint !"}</p>
      <span class="xp-chip big">+${tierXp(it.level)} XP</span>
      <button class="btn accent" data-done>Génial !</button></div>`;
    sfx("badge");
  } else {
    const r = rankOf(it.level), newRank = it.rankUp;
    el.style.setProperty("--tc", r.c);
    el.innerHTML = `<div class="rays"></div><div class="unlock-box">
      <span class="eyebrow">${newRank ? "Nouveau rang" : "Niveau supérieur"}</span>
      <div class="pop">${rankEmblem(it.level, 190)}</div>
      <h2>Niveau ${it.level}</h2>
      <p>${newRank ? `Tu deviens <b style="color:${r.c}">${r.n}</b>. Respect.` : `Continue comme ça, ${esc(r.n.toLowerCase())} !`}</p>
      <button class="btn accent" data-done>Continuer</button></div>`;
    sfx("win");
  }
  document.body.appendChild(el);
  confetti(70);
  const close = () => { el.classList.add("out"); setTimeout(() => { el.remove(); nextCeleb(); }, 300); };
  el.querySelector("[data-done]").onclick = close;
  el.onclick = e => { if (e.target === el) close(); };
}
