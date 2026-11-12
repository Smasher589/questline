'use strict';
// Gestion des sources depuis l'interface : comptes (Steam, Epic, GOG, Ubisoft, Heroic), emulateurs et
// dossiers de jeux, jeux ajoutes a la main, cle SteamGridDB.
// Les comptes ne sont jamais relies sans l'accord de l'utilisateur : la detection ne fait que proposer.
const crypto = require('crypto');
const store = require('./state');
const steam = require('./platforms/steam');
const epic = require('./platforms/epic');
const ubisoft = require('./platforms/ubisoft');
const systems = require('./emulation/systems');
const launcher = require('./launcher');
const library = require('./library');
const { exists } = require('./util');

const PATH_OK = p => typeof p === 'string' && p.length > 0 && p.length <= 500 && !/[\0\r\n]/.test(p);
const EPIC_ID = /^[0-9a-f]{32}$/i;

async function overview() {
  const c = store.config;
  const games = await library.otherGames();
  const count = p => games.filter(g => g.platform === p).length;
  const sp = steam.profile();
  const epicId = epic.accountId();
  return {
    onboarded: !!c.onboarded,
    catalog: systems.publicCatalog(),
    accounts: {
      steam: { enabled: c.accounts.steam.enabled, accountId: steam.accountId(), id64: sp.id64, name: sp.name, privacy: steam.privacyState,
        found: !!steam.steamRoot(), users: steam.users().map(u => ({ accountId: u.accountId, id64: u.id64, name: u.name, recent: u.mostRecent })),
        games: steam.library().length },
      epic: { enabled: c.accounts.epic.enabled, accountId: epicId, detected: epic.detectedAccountId(), status: epic.status, games: count('epic') },
      gog: { enabled: c.accounts.gog.enabled, games: count('gog') },
      ubisoft: { enabled: c.accounts.ubisoft.enabled, found: ubisoft.launcherFound(), games: count('ubisoft') },
      heroic: { enabled: c.accounts.heroic.enabled, games: count('amazon') },
    },
    steamGridDb: !!c.steamGridDbKey,
    emulators: c.emulators.map(e => ({ ...e, exeFound: exists(e.exe), games: games.filter(g => g.emuEntry === e.id).length })),
    manualGames: c.manualGames.map(g => ({ ...g, exeFound: exists(g.exe) })),
  };
}

function saveAndRefresh() { store.saveConfig(); steam.library(true); library.otherGames(true).catch(() => {}); return { ok: true }; }

// relie (ou delie) un compte ; renvoie une erreur lisible si l'identifiant est invalide
function setAccount(b) {
  const a = Object.hasOwn(store.config.accounts, String(b.platform)) ? store.config.accounts[b.platform] : null;
  if (!a) return { error: 'Plateforme inconnue.' };
  if (typeof b.enabled === 'boolean') a.enabled = b.enabled;
  if (b.platform === 'steam' && b.accountId !== undefined) {
    if (b.accountId === '') a.accountId = '';
    else { const id = steam.parseAccount(b.accountId); if (!id) return { error: "Identifiant Steam invalide : colle l'adresse de ton profil (steamcommunity.com/profiles/…) ou ton SteamID64." }; a.accountId = id; }
  }
  if (b.platform === 'steam' && typeof b.apiKey === 'string' && /^[0-9A-Fa-f]{0,64}$/.test(b.apiKey)) a.apiKey = store.seal(b.apiKey);
  if (b.platform === 'epic' && b.accountId !== undefined) {
    const v = String(b.accountId || '').trim().toLowerCase();
    if (v && !EPIC_ID.test(v)) return { error: "Identifiant Epic invalide : 32 caractères (epicgames.com > Compte > Paramètres généraux > ID du compte)." };
    a.accountId = v;
  }
  return saveAndRefresh();
}

// verifie le compte relie : pseudo et visibilite du profil (succes lisibles seulement si public)
async function verify(platform) {
  if (platform === 'steam') {
    const p = steam.profile();
    if (!p.id64) return { error: 'Aucun compte Steam relié.' };
    return { ok: true, name: p.name, privacy: await steam.privacy(true) };
  }
  if (platform === 'epic') {
    const id = epic.accountId();
    if (!id) return { error: 'Aucun compte Epic relié.' };
    const [name, status] = await Promise.all([epic.displayName(id), epic.checkPrivacy((await library.otherGames()).filter(g => g.platform === 'epic' && g.achievements))]);
    return { ok: true, name, privacy: status === 'ok' ? 'public' : status === 'private' ? 'private' : 'unknown' };
  }
  return { error: 'Vérification non disponible pour cette plateforme.' };
}

async function action(name, b) {
  const c = store.config;
  switch (name) {
    case 'account': return setAccount(b);
    case 'verify': return verify(b.platform);
    case 'onboard': c.onboarded = b.done !== false; return saveAndRefresh();
    case 'emulator': {
      if (b.op === 'remove') { c.emulators = c.emulators.filter(e => e.id !== b.id); return saveAndRefresh(); }
      const e = b.entry || {};
      if (!systems.emulator(e.system, e.emulator)) return { error: 'Système ou émulateur inconnu.' };
      if (!PATH_OK(e.exe)) return { error: "Chemin de l'émulateur invalide." };
      const dirs = (Array.isArray(e.romDirs) ? e.romDirs : []).filter(PATH_OK).slice(0, 20);
      if (!dirs.length) return { error: 'Ajoute au moins un dossier de jeux.' };
      const entry = { id: b.op === 'update' && /^[0-9a-f]{12}$/.test(e.id || '') ? e.id : crypto.randomBytes(6).toString('hex'),
        system: e.system, emulator: e.emulator, exe: e.exe, romDirs: dirs, coresDir: PATH_OK(e.coresDir) ? e.coresDir : undefined };
      c.emulators = [...c.emulators.filter(x => x.id !== entry.id), entry];
      return saveAndRefresh();
    }
    case 'detect': {
      const exe = launcher.detectEmulator(b.system, b.emulator);
      return exe ? { ok: true, exe } : { error: "Émulateur non trouvé automatiquement : indique son emplacement." };
    }
    case 'manual': {
      if (b.op === 'remove') { c.manualGames = c.manualGames.filter(g => g.id !== b.id); return saveAndRefresh(); }
      if (typeof b.name !== 'string' || !b.name.trim() || b.name.length > 120) return { error: 'Nom invalide.' };
      if (!PATH_OK(b.exe)) return { error: 'Exécutable invalide.' };
      c.manualGames.push({ id: crypto.randomBytes(6).toString('hex'), name: b.name.trim(), exe: b.exe, args: typeof b.args === 'string' ? b.args.slice(0, 300) : '' });
      return saveAndRefresh();
    }
    case 'sgdb': {
      if (typeof b.key !== 'string' || !/^[0-9a-fA-F]{0,64}$/.test(b.key)) return { error: 'Clé invalide.' };
      c.steamGridDbKey = store.seal(b.key); return saveAndRefresh();
    }
    case 'refresh': steam.library(true); await library.otherGames(true); return { ok: true };
    default: return { error: 'Action inconnue.' };
  }
}

module.exports = { overview, action };
