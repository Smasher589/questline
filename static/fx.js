/* =====================================================================
   Questline — effets : sons, thème dynamique, confettis, générique de fin,
   carte de victoire et récap annuel (images PNG générées dans le navigateur)
   ===================================================================== */

/* ---------------------------------------------------------------- sons (synthétisés, aucun fichier) */
let audioCtx = null;
function sfx(kind) {
  if (!st?.settings?.sounds) return;
  try {
    audioCtx ||= new AudioContext();
    const t0 = audioCtx.currentTime;
    const note = (f, start, dur, type = "sine", vol = .08) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t0 + start);
      g.gain.setValueAtTime(0, t0 + start); g.gain.linearRampToValueAtTime(vol, t0 + start + .01);
      g.gain.exponentialRampToValueAtTime(.0001, t0 + start + dur);
      o.connect(g).connect(audioCtx.destination); o.start(t0 + start); o.stop(t0 + start + dur + .05);
    };
    ({
      click: () => note(660, 0, .08, "triangle", .05),
      pick: () => { note(520, 0, .07, "triangle", .06); note(780, .05, .1, "triangle", .06); },
      tick: () => note(1200, 0, .03, "square", .02),
      toggle: () => note(880, 0, .06, "sine", .06),
      win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => note(f, i * .11, .5, "triangle", .07)),
      badge: () => [784, 988, 1175].forEach((f, i) => note(f, i * .09, .35, "sine", .07)),
      error: () => { note(180, 0, .15, "sawtooth", .04); note(140, .12, .2, "sawtooth", .04); },
    })[kind]?.();
  } catch {}
}

/* ---------------------------------------------------------------- thème dynamique : couleurs tirées de la jaquette */
const paletteCache = {};
async function coverPalette(id) {
  if (paletteCache[id]) return paletteCache[id];
  const img = await loadImg(`/img/${id}/cover`);
  if (!img) return null;
  const cv = document.createElement("canvas"); cv.width = 48; cv.height = 72;
  const x = cv.getContext("2d"); x.drawImage(img, 0, 0, 48, 72);
  const data = x.getImageData(0, 0, 48, 72).data, bins = {};
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const [h, s, l] = rgb2hsl(r, g, b);
    if (s < .25 || l < .18 || l > .85) continue;
    const k = Math.round(h * 18);
    (bins[k] ||= { n: 0, h: 0, s: 0, l: 0 });
    bins[k].n += s; bins[k].h += h * s; bins[k].s += s * s; bins[k].l += l * s;
  }
  const top = Object.values(bins).sort((a, b) => b.n - a.n).slice(0, 4).map(b => ({ h: b.h / b.n, s: b.s / b.n, l: b.l / b.n }));
  if (!top.length) return null;
  while (top.length < 4) top.push({ ...top[top.length - 1], h: (top[top.length - 1].h + .08) % 1 });
  top.sort((a, b) => b.l - a.l);
  const pal = top.map(c => hsl2hex(c.h, Math.max(.65, c.s), clamp(c.l, .5, .64)));
  return paletteCache[id] = pal;
}
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hsl2hex(h, s, l) {
  const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0"); };
  return `#${f(0)}${f(8)}${f(4)}`;
}
async function applyTheme() {
  const root = document.documentElement, s = st.settings || {};
  root.dataset.theme = (PALETTE_LV[s.theme] || 1) <= currentLevel() ? (s.theme || "neon") : "neon";
  applyScene();
  ["--c1", "--c2", "--c3", "--c4"].forEach(v => root.style.removeProperty(v));
  if (s.dynamic && st.current && !st.current.platform && s.theme !== "retro") {
    const pal = await coverPalette(st.current.appid);
    if (pal) pal.forEach((c, i) => root.style.setProperty(`--c${i + 1}`, c));
  }
}

/* ---------------------------------------------------------------- confettis */
function confetti(n = 110) {
  const css = getComputedStyle(document.documentElement);
  const colors = ["--c1", "--c2", "--c3", "--c4"].map(v => css.getPropertyValue(v).trim()).concat("#ffffff");
  for (let i = 0; i < n; i++) {
    const d = document.createElement("i"); d.className = "spark";
    d.style.left = Math.random() * 100 + "vw"; d.style.background = colors[i % colors.length];
    d.style.animationDuration = 2.5 + Math.random() * 2.5 + "s"; d.style.animationDelay = Math.random() * .8 + "s";
    document.body.appendChild(d); setTimeout(() => d.remove(), 6000);
  }
}

/* ---------------------------------------------------------------- générique de fin */
function creditsRoll(done, onEnd) {
  const g = byId(done.appid) || { playtime: 0 };
  const p = prog(done.appid);
  const days = done.since && done.at ? Math.max(1, Math.round((new Date(done.at) - new Date(done.since)) / 86400000)) : null;
  const blocked = st.blocked.filter(b => !done.since || new Date(b.at) >= new Date(done.since)).length;
  const who = profile?.name || "Toi";
  const line = (role, val) => `<div><div class="role">${role}</div><div class="who">${esc(val)}</div></div>`;
  const el = document.createElement("div"); el.className = "credits";
  el.innerHTML = `<div class="roll">
      <img class="logo" src="/img/${encodeURIComponent(done.appid)}/logo" alt="">
      ${line("Une quête menée par", who)}
      ${line("Temps de jeu total", fmtH(g.playtime))}
      ${days ? line("Durée de la quête", `${days} jour${days > 1 ? "s" : ""}`) : ""}
      ${p ? line("Succès débloqués", `${p.unlocked} sur ${p.total}`) : ""}
      ${done.story ? line("Succès de fin", `« ${done.story.name} »`) : ""}
      ${line("Tentations résistées", blocked ? `${blocked} téléchargement${blocked > 1 ? "s" : ""} bloqué${blocked > 1 ? "s" : ""}` : "Aucune, respect")}
      ${line("Bouclier", "Questline")}
      ${line("Remerciements", "Ta volonté de fer")}
      <div class="fin">FIN</div>
    </div><button class="skip">Passer ›</button>`;
  // logo absent : on affiche le nom du jeu en texte (textContent, jamais dans du HTML)
  const logo = el.querySelector(".logo");
  logo.onerror = () => { const t = document.createElement("div"); t.className = "who"; t.style.fontSize = "54px"; t.textContent = done.name || ""; logo.replaceWith(t); };
  document.body.appendChild(el);
  sfx("win");
  const end = () => { if (!el.isConnected) return; el.remove(); onEnd?.(); };
  el.querySelector(".skip").onclick = end;
  el.querySelector(".roll").addEventListener("animationend", end);
}

/* ---------------------------------------------------------------- outils canvas */
const loadImg = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function wrapText(ctx, text, x, y, maxW, lh, maxLines) {
  const words = String(text).split(" "); let line = "", lines = [];
  for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  lines.push(line); lines = lines.slice(0, maxLines);
  lines.forEach((l, n) => ctx.fillText(l, x, y + n * lh)); return lines.length;
}
function brandGrad(x, W, H) {
  const css = getComputedStyle(document.documentElement), c = v => css.getPropertyValue(v).trim();
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(.1, c("--c1")); g.addColorStop(.45, c("--c2")); g.addColorStop(.67, c("--c3")); g.addColorStop(.87, c("--c4")); return g;
}
function cardBackground(x, W, H) {
  x.fillStyle = "#07060b"; x.fillRect(0, 0, W, H);
  const css = getComputedStyle(document.documentElement);
  for (const [cx, cy, r, v, a] of [[W * .85, H * .9, W * .5, "--c3", .3], [W * .1, H * .65, W * .4, "--c2", .2]]) {
    const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, css.getPropertyValue(v).trim() + Math.round(a * 255).toString(16).padStart(2, "0")); rg.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = rg; x.fillRect(0, 0, W, H);
  }
}
function downloadCanvas(cv, name) {
  const a = document.createElement("a"); a.href = cv.toDataURL("image/png"); a.download = name.replace(/[\\/:*?"<>|™®]/g, "") + ".png"; a.click();
}

/* ---------------------------------------------------------------- carte de victoire (1080×1350) */
async function victoryCard(id) {
  const g = byId(id) || { name: st.finished.find(f => String(f.appid) === String(id))?.name || "Jeu", playtime: 0 };
  const fin = st.finished.find(f => String(f.appid) === String(id)), p = prog(id);
  await document.fonts.ready;
  const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d");
  cardBackground(x, W, H);
  const [hero, cover, logo] = await Promise.all([loadImg(`/img/${id}/hero`), loadImg(`/img/${id}/cover`), loadImg("/logo.png")]);
  if (hero) { const s = Math.max(W / hero.width, 620 / hero.height); x.globalAlpha = .55; x.drawImage(hero, (W - hero.width * s) / 2, 0, hero.width * s, hero.height * s); x.globalAlpha = 1; }
  const gr = x.createLinearGradient(0, 150, 0, 600); gr.addColorStop(0, "rgba(7,6,11,0)"); gr.addColorStop(1, "#07060b"); x.fillStyle = gr; x.fillRect(0, 0, W, 720);
  const brand = brandGrad(x, W, H);
  const cw = 360, ch = 540, cx = 80, cy = 330;
  x.save(); x.shadowColor = "rgba(254,83,187,.45)"; x.shadowBlur = 60; roundRect(x, cx, cy, cw, ch, 22); x.fillStyle = "#1a1724"; x.fill(); x.restore();
  if (cover) { x.save(); roundRect(x, cx, cy, cw, ch, 22); x.clip(); const s = Math.max(cw / cover.width, ch / cover.height); x.drawImage(cover, cx + (cw - cover.width * s) / 2, cy + (ch - cover.height * s) / 2, cover.width * s, cover.height * s); x.restore(); }
  roundRect(x, cx, cy, cw, ch, 22); x.lineWidth = 4; x.strokeStyle = brand; x.stroke();
  const tx = 490;
  x.fillStyle = "#fe53bb"; x.font = "600 26px 'Space Grotesk', sans-serif"; x.fillText("QUÊTE ACCOMPLIE", tx, 380);
  x.fillStyle = "#f3f0fb"; x.font = "700 64px 'Space Grotesk', sans-serif";
  const n = wrapText(x, g.name, tx, 460, W - tx - 70, 70, 4);
  x.fillStyle = brand; x.font = "700 52px 'Space Grotesk', sans-serif"; x.fillText("terminé.", tx, 460 + n * 70 + 10);
  const days = fin ? Math.max(1, Math.round((new Date(fin.at) - new Date(fin.since)) / 86400000)) : null;
  const statsRow = [[fmtH(g.playtime), "temps de jeu"], p ? [`${p.unlocked}/${p.total}`, "succès"] : null, days ? [`${days} j`, "de quête"] : p?.perfect ? ["100 %", "des succès"] : null].filter(Boolean);
  const bw = (W - 160 - (statsRow.length - 1) * 24) / statsRow.length;
  statsRow.forEach(([v, l], i) => {
    const bx = 80 + i * (bw + 24), by = 940;
    roundRect(x, bx, by, bw, 150, 22); x.fillStyle = "rgba(255,255,255,.05)"; x.fill(); x.strokeStyle = "rgba(255,255,255,.1)"; x.lineWidth = 2; x.stroke();
    x.fillStyle = "#f3f0fb"; x.font = "700 56px 'Space Grotesk', sans-serif"; x.fillText(v, bx + 30, by + 80);
    x.fillStyle = "#a19cb6"; x.font = "500 24px Inter, sans-serif"; x.fillText(l, bx + 30, by + 120);
  });
  const story = fin?.story?.name || (p?.storyDone && p.story);
  if (story) { x.fillStyle = "#a19cb6"; x.font = "500 26px Inter, sans-serif"; x.fillText(`Succès de fin : « ${story} »`, 80, 1150); }
  if (logo) x.drawImage(logo, 80, 1210, 72, 72);
  x.fillStyle = "#f3f0fb"; x.font = "700 38px 'Space Grotesk', sans-serif"; x.fillText("Questline", 172, 1258);
  x.fillStyle = "#6c6782"; x.font = "500 24px Inter, sans-serif"; x.textAlign = "right";
  x.fillText(new Date(fin?.at || Date.now()).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }), W - 80, 1256);
  downloadCanvas(cv, `Questline - ${g.name}`);
  flag("card");
  toast("Carte de victoire enregistrée dans tes Téléchargements.", "image");
}

/* ---------------------------------------------------------------- récap annuel (1080×1920, format story) */
async function yearRecap() {
  const yr = new Date().getFullYear(), pd = profileData(), s = pd.stats;
  const finYear = [...st.finished.filter(f => (f.at || "").startsWith(yr)).map(f => f.appid),
    ...Object.entries(progress).filter(([id, p]) => p.storyDone && !st.finished.some(f => String(f.appid) === id)).map(([id]) => id)]
    .filter((v, i, a) => byId(v) && a.indexOf(v) === i).slice(0, 8);
  const top = [...lib].filter(g => g.lastPlayed && new Date(g.lastPlayed * 1000).getFullYear() === yr).sort((a, b) => b.playtime - a.playtime)[0];
  await document.fonts.ready;
  const W = 1080, H = 1920, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d");
  cardBackground(x, W, H);
  const brand = brandGrad(x, W, H);
  const logo = await loadImg("/logo.png");
  if (logo) x.drawImage(logo, 80, 90, 80, 80);
  x.fillStyle = "#f3f0fb"; x.font = "700 40px 'Space Grotesk', sans-serif"; x.fillText("Questline", 180, 145);
  x.fillStyle = "#a19cb6"; x.font = "600 30px 'Space Grotesk', sans-serif"; x.fillText(`L'ANNÉE ${yr} DE ${(profile?.name || "").toUpperCase()}`, 80, 290);
  x.fillStyle = brand; x.font = "700 120px 'Space Grotesk', sans-serif"; x.fillText(`${finYear.length} jeu${finYear.length > 1 ? "x" : ""}`, 80, 420);
  x.fillStyle = "#f3f0fb"; x.font = "700 64px 'Space Grotesk', sans-serif"; x.fillText("terminés.", 80, 500);
  // jaquettes des jeux finis
  const covers = await Promise.all(finYear.map(id => loadImg(`/img/${id}/cover`)));
  const cw = 210, ch = 315;
  covers.forEach((im, i) => {
    const cx = 80 + (i % 4) * (cw + 20), cy = 570 + Math.floor(i / 4) * (ch + 20);
    x.save(); roundRect(x, cx, cy, cw, ch, 16); x.clip();
    if (im) { const sc = Math.max(cw / im.width, ch / im.height); x.drawImage(im, cx + (cw - im.width * sc) / 2, cy + (ch - im.height * sc) / 2, im.width * sc, im.height * sc); }
    else { x.fillStyle = "#1a1724"; x.fillRect(cx, cy, cw, ch); }
    x.restore();
  });
  let y = 570 + Math.max(1, Math.ceil(covers.length / 4)) * (ch + 20) + 40;
  const tiles = [[`${s.perfect}`, "jeux à 100 %"], [`Niv. ${pd.level}`, titleOf(pd.level)], [`${pd.badges.filter(b => b.earned).length}`, "badges"], [`${s.best} j`, "meilleure série"], [`${st.blocked.length}`, "tentations résistées"], [fmtH(lib.reduce((a, g) => a + g.playtime, 0)), "de jeu au total"]];
  tiles.forEach(([v, l], i) => {
    const bx = 80 + (i % 2) * 470, by = y + Math.floor(i / 2) * 170;
    roundRect(x, bx, by, 450, 150, 22); x.fillStyle = "rgba(255,255,255,.05)"; x.fill(); x.strokeStyle = "rgba(255,255,255,.1)"; x.lineWidth = 2; x.stroke();
    x.fillStyle = "#f3f0fb"; x.font = "700 56px 'Space Grotesk', sans-serif"; x.fillText(v, bx + 30, by + 80);
    x.fillStyle = "#a19cb6"; x.font = "500 26px Inter, sans-serif"; x.fillText(l, bx + 30, by + 122);
  });
  y += 3 * 170 + 30;
  if (top && y < H - 160) { x.fillStyle = "#a19cb6"; x.font = "500 28px Inter, sans-serif"; x.fillText("Le jeu qui t'a le plus occupé :", 80, y); x.fillStyle = "#f3f0fb"; x.font = "700 40px 'Space Grotesk', sans-serif"; wrapText(x, top.name, 80, y + 56, W - 160, 48, 2); }
  x.fillStyle = "#6c6782"; x.font = "500 24px Inter, sans-serif"; x.fillText("Un jeu. Jusqu'au générique.", 80, H - 80);
  downloadCanvas(cv, `Questline - recap ${yr}`);
  flag("recap");
  toast(`Ton récap ${yr} est dans tes Téléchargements.`, "calendar");
}
