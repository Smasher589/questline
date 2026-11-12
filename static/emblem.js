/* =====================================================================
   Questline — emblème de rang en pixel art (écusson 32×36) : contour sombre, bord métallique
   à la couleur du rang, biseau, gemme et niveau en chiffres pixelisés
   ===================================================================== */
const EMB_W = 32, EMB_H = 36;
const EMB_DIGITS = {
  0: [" ### ", "#   #", "#  ##", "# # #", "##  #", "#   #", " ### "],
  1: ["  #  ", " ##  ", "  #  ", "  #  ", "  #  ", "  #  ", " ### "],
  2: [" ### ", "#   #", "    #", "   # ", "  #  ", " #   ", "#####"],
  3: ["#####", "   # ", "  #  ", "   # ", "    #", "#   #", " ### "],
  4: ["   # ", "  ## ", " # # ", "#  # ", "#####", "   # ", "   # "],
  5: ["#####", "#    ", "#### ", "    #", "    #", "#   #", " ### "],
  6: ["  ## ", " #   ", "#    ", "#### ", "#   #", "#   #", " ### "],
  7: ["#####", "    #", "   # ", "  #  ", " #   ", " #   ", " #   "],
  8: [" ### ", "#   #", "#   #", " ### ", "#   #", "#   #", " ### "],
  9: [" ### ", "#   #", "#   #", " ####", "    #", "   # ", " ##  "],
};

// demi-largeur de l'écusson à la ligne y : bords haut arrondis, bas en pointe
function embHalf(y) {
  if (y === 0) return 12;
  if (y === 1) return 14;
  if (y < 24) return 15;
  return 15 - (y - 23) * 1.3;
}
const embInside = (x, y) => y >= 0 && y < EMB_H && Math.abs(x + .5 - EMB_W / 2) <= embHalf(y);

// distance (Chebyshev) au bord : 1 = contour, 2-3 = métal, 4 = biseau, 5+ = face
function embDepth(x, y) {
  for (let k = 1; k <= 5; k++)
    for (let dy = -k; dy <= k; dy++)
      for (let dx = -k; dx <= k; dx++)
        if ((Math.abs(dx) === k || Math.abs(dy) === k) && !embInside(x + dx, y + dy)) return k;
  return 6;
}
const EMB_MAP = (() => {
  const m = [];
  for (let y = 0; y < EMB_H; y++) for (let x = 0; x < EMB_W; x++) if (embInside(x, y)) m.push([x, y, embDepth(x, y)]);
  return m;
})();

const hexRgb = h => { const n = parseInt(h.replace("#", ""), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mixHex = (a, b, t) => "#" + hexRgb(a).map((v, i) => Math.round(v + (hexRgb(b)[i] - v) * t).toString(16).padStart(2, "0")).join("");

function embPalette(c) {
  return {
    o: "#0b0910", hl: mixHex(c, "#ffffff", .7), l: mixHex(c, "#ffffff", .3), m: c, d: mixHex(c, "#000000", .45), dd: mixHex(c, "#000000", .7),
    face: mixHex(c, "#14111d", .88), faceL: mixHex(c, "#14111d", .8), faceD: mixHex(c, "#0d0b13", .92),
  };
}

function embPixels(level, c) {
  const P = embPalette(c), px = new Map();
  const put = (x, y, col) => px.set(`${x},${y}`, col);
  for (const [x, y, d] of EMB_MAP) {
    const left = x < EMB_W / 2, low = y > 25;
    let col;
    if (d === 1) col = P.o;
    else if (d <= 3) col = y <= 2 ? P.l : left ? (low ? P.m : P.l) : (low ? P.dd : P.d);
    else if (d === 4) col = y <= 5 || (left && !low) ? P.o : P.d;          // biseau : creux en haut à gauche
    else col = d === 5 && y <= 6 ? P.faceD : y >= 27 ? P.faceL : P.face;
    put(x, y, col);
  }
  // reflets sur le métal en haut à gauche
  [[4, 2], [5, 2], [3, 3], [2, 4], [2, 5]].forEach(([x, y]) => put(x, y, P.hl));
  // gemme en losange au sommet de la face
  const GEM = ["..oo..", ".ohmo.", "ohlmdo", "olmddo", ".omdo.", "..oo.."], GK = { o: "o", h: "hl", l: "l", m: "m", d: "d" };
  GEM.forEach((row, r) => [...row].forEach((ch, c2) => { if (ch !== ".") put(13 + c2, 6 + r, P[GK[ch]]); }));
  // niveau en chiffres 5×7 avec ombre portée
  const digits = String(Math.max(0, Math.min(999, level | 0))).split("");
  const w = digits.length * 6 - 1, x0 = Math.round(EMB_W / 2 - w / 2), y0 = 15;
  digits.forEach((dg, i) => EMB_DIGITS[dg].forEach((row, r) => [...row].forEach((ch, cIdx) => {
    if (ch !== "#") return;
    const x = x0 + i * 6 + cIdx, y = y0 + r;
    if (!px.has(`${x + 1},${y + 1}`) || px.get(`${x + 1},${y + 1}`) !== "#ffffff") put(x + 1, y + 1, P.o);
  })));
  digits.forEach((dg, i) => EMB_DIGITS[dg].forEach((row, r) => [...row].forEach((ch, cIdx) => {
    if (ch === "#") put(x0 + i * 6 + cIdx, y0 + r, r < 2 ? P.hl : "#ffffff");
  })));
  // trois petites barres décoratives sous le niveau
  [11, 15, 19].forEach(x => { put(x, 25, P.l); put(x + 1, 25, P.m); put(x, 26, P.d); put(x + 1, 26, P.dd); });
  return px;
}

// regroupe les pixels voisins de même couleur sur une ligne pour alléger le SVG
function embRects(px) {
  const out = [];
  for (let y = 0; y < EMB_H; y++) {
    let x = 0;
    while (x < EMB_W) {
      const col = px.get(`${x},${y}`);
      if (!col) { x++; continue; }
      let w = 1;
      while (px.get(`${x + w},${y}`) === col) w++;
      out.push(`<rect x="${x}" y="${y}" width="${w}" height="1" fill="${col}"/>`);
      x += w;
    }
  }
  return out.join("");
}

function rankEmblem(level, size = 110) {
  const r = rankOf(level);
  return `<svg class="emblem pemb" viewBox="0 0 ${EMB_W} ${EMB_H}" width="${size}" height="${Math.round(size * EMB_H / EMB_W)}" shape-rendering="crispEdges" style="--rc:${r.c}" role="img" aria-label="Niveau ${level}, rang ${esc(r.n)}">${embRects(embPixels(level, r.c))}</svg>`;
}
