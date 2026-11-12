'use strict';
// Etat de l'app (quete, palmares, file, reglages) et configuration des sources (comptes, emulateurs).
const path = require('path');
const { readJson, writeJson } = require('./util');

const DEFAULT_SETTINGS = { reminders: true, reminderDays: 2, theme: 'neon', scene: 'nuit', bedtime: 23, dynamic: true, sounds: true, buyRule: 2, maxInstalled: 2 };

// Aucun compte n'est relie par defaut : l'utilisateur choisit ses comptes a l'accueil (premier lancement).
const DEFAULT_CONFIG = {
  onboarded: false,
  accounts: {
    steam: { enabled: false, accountId: '', apiKey: '' },
    epic: { enabled: false, accountId: '' },
    gog: { enabled: false },
    ubisoft: { enabled: false },
    heroic: { enabled: false },
  },
  steamGridDbKey: '',
  emulators: [],     // { id, system, emulator, exe, romDirs: [] }
  manualGames: [],   // { id, name, exe, args }
};

let dataDir = null;
let state = null;
let config = null;

const file = n => path.join(dataDir, n);

function init(dir) {
  dataDir = dir;
  state = loadState();
  config = loadConfig();
}

function loadState() {
  const s = { current: null, finished: [], abandoned: [], blocked: [], cleaned: false, strict: false, lastReminder: '',
    queue: [], wishlist: [], flags: {}, session: null, settings: { ...DEFAULT_SETTINGS } };
  const j = readJson(file('state.json'));
  if (j && typeof j === 'object') {
    for (const k of ['current', 'cleaned', 'strict', 'lastReminder', 'session']) if (j[k] !== undefined) s[k] = j[k];
    for (const k of ['finished', 'abandoned', 'blocked', 'queue', 'wishlist']) if (Array.isArray(j[k])) s[k] = j[k];
    // seulement des noms simples : un « __proto__ » dans le fichier ne peut pas modifier les objets
    const safeKeys = o => Object.entries(o && typeof o === 'object' ? o : {}).filter(([k]) => /^[\w-]{1,40}$/.test(k) && k !== '__proto__');
    for (const [k, v] of safeKeys(j.settings)) s.settings[k] = v;
    for (const [k, v] of safeKeys(j.flags)) s.flags[k] = v;
  }
  return s;
}
function loadConfig() {
  const c = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  const j = readJson(file('config.json'));
  if (j && typeof j === 'object') {
    for (const k of Object.keys(c.accounts)) Object.assign(c.accounts[k], (j.accounts || {})[k] || {});
    if (typeof j.onboarded === 'boolean') c.onboarded = j.onboarded;
    if (typeof j.steamGridDbKey === 'string') c.steamGridDbKey = j.steamGridDbKey;
    if (Array.isArray(j.emulators)) c.emulators = j.emulators;
    if (Array.isArray(j.manualGames)) c.manualGames = j.manualGames;
  }
  return c;
}

const saveState = () => writeJson(file('state.json'), state);
const saveConfig = () => writeJson(file('config.json'), config);

// cles d'API chiffrees avec le coffre du systeme (DPAPI sous Windows) quand Electron le permet
let protector = null;
const seal = v => (v && protector && !String(v).startsWith('enc:') ? 'enc:' + protector.enc(String(v)) : v);
const secret = v => { if (typeof v !== 'string' || !v.startsWith('enc:')) return v || ''; try { return protector ? protector.dec(v.slice(4)) : ''; } catch { return ''; } };
function setProtector(p) {
  protector = p;
  // migration : les cles deja enregistrees en clair sont chiffrees
  let changed = false;
  if (config.steamGridDbKey && !config.steamGridDbKey.startsWith('enc:')) { config.steamGridDbKey = seal(config.steamGridDbKey); changed = true; }
  const st = config.accounts && config.accounts.steam;
  if (st && st.apiKey && !st.apiKey.startsWith('enc:')) { st.apiKey = seal(st.apiKey); changed = true; }
  if (changed) saveConfig();
}

module.exports = {
  seal, secret, setProtector,
  DEFAULT_SETTINGS, init, file, saveState, saveConfig,
  get dataDir() { return dataDir; },
  get state() { return state; },
  get config() { return config; },
};
