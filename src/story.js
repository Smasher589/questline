'use strict';
// Detection du succes qui marque la fin de l'histoire principale (toutes plateformes).

// Succes de fin connus quand le texte du succes ne le dit pas clairement
const KNOWN_STORY = {
  '1588550': 'ReachSummit',
  '1903340': 'THE_END',
  '1091500': 'TheWorld',
  'switch:01007EF00011E000': 'BOTW_GANON',
};

const TIER1 = /histoire principale|main story|main campaign|campagne principale|(fini[rs]?|termin\w*|achev\w*) le jeu|finish(ed)? the game|beat the game|complete(d)? the game|générique|end credits|roll the credits|fin du jeu|terminer l[’'`]aventure|atteindre la fin|reach the end|fin de l[’'`]histoire|story complete|game complete/i;
const TIER2 = /termin\S* (la campagne|l[’'`]histoire\.?$)|finish(ed)? the (story|campaign)|complete(d)? the (story|campaign)|the end\b|final boss|boss final|dernier chapitre|final chapter|épilogue|epilogue|ending/i;
const EXCLUDE = /difficile|hard|nightmare|cauchemar|sans mourir|without|speed|100 ?%|toutes|all the|every|chaque|new game ?\+|ng\+|secondaire|annexe|side ?quest|compagnon|chapitre \d|chapter \d|acte \d|act \d|prologue|tutori/i;

function findStory(list, appid) {
  if (!Array.isArray(list) || !list.length) return null;
  const known = KNOWN_STORY[String(appid)];
  if (known) { const k = list.find(a => a.id === known); if (k) return k; }
  for (const tier of [TIER1, TIER2]) {
    for (const a of list) {
      const txt = `${a.name} ${a.desc}`;
      if (tier.test(txt) && !EXCLUDE.test(txt)) return a;
    }
  }
  return null;
}

// Progression au format commun (palmares, tuiles)
function progressOf(list, appid) {
  if (!Array.isArray(list) || !list.length) return null;
  const unlocked = list.filter(a => a.unlocked).length;
  const s = findStory(list, appid);
  const perfect = unlocked >= list.length;
  return { total: list.length, unlocked, perfect, story: s ? s.name : null, storyDone: perfect || !!(s && s.unlocked), complete: true };
}

module.exports = { KNOWN_STORY, findStory, progressOf };
