'use strict';
// Processus principal Electron : fenetre, icone de la zone de notification, notifications,
// lancement avec le systeme, et serveur local de l'interface.
const { app, BrowserWindow, Tray, Menu, Notification, shell, ipcMain, dialog, nativeImage, session, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const store = require('../src/state');

// dossier de donnees : %APPDATA%\Questline (Windows), ~/.config/Questline (Linux), ~/Library/Application Support/Questline (macOS).
// QUESTLINE_DATA_DIR permet une installation portable ou des tests isoles.
if (process.env.QUESTLINE_DATA_DIR) app.setPath('userData', path.resolve(process.env.QUESTLINE_DATA_DIR));
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
// identifiant Windows stable : notifications et raccourcis rattaches a Questline, pas a electron.exe
if (process.platform === 'win32') app.setAppUserModelId('io.github.questline');

const ICON = path.join(__dirname, '..', 'assets', 'questline.png');
const HIDDEN = process.argv.includes('--hidden');
const TOKEN = crypto.randomBytes(32).toString('hex');
// sites que les liens de l'interface peuvent ouvrir dans le navigateur du systeme
const EXTERNAL_OK = /^https:\/\/([\w-]+\.)*(steampowered\.com|steamcommunity\.com|epicgames\.com|gog\.com|steamgriddb\.com|github\.com|nintendo\.com|gametdb\.com|itch\.io|uiverse\.io|wikipedia\.org|metacritic\.com)(\/|$)/;
let port = 0, win = null, mini = null, tray = null, quitting = false;
const appUrl = q => `http://127.0.0.1:${port}/${q}`;

function createWindow(query = '', mode = 'main') {
  const isMini = mode === 'mini';
  const existing = isMini ? mini : win;
  if (existing && !existing.isDestroyed()) { existing.loadURL(appUrl(isMini ? '?mini=1' : query)); existing.show(); existing.focus(); return existing; }
  const w = new BrowserWindow({
    width: isMini ? 400 : 1360, height: isMini ? 700 : 900, minWidth: 380, minHeight: 500, icon: ICON, title: 'Questline',
    backgroundColor: '#0b0912', autoHideMenuBar: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: !app.isPackaged },
  });
  w.loadURL(appUrl(isMini ? '?mini=1' : query));
  w.once('ready-to-show', () => w.show());
  // liens externes : navigateur du systeme, sites connus seulement ; aucune autre page dans la fenetre de l'app
  w.webContents.setWindowOpenHandler(({ url }) => { if (EXTERNAL_OK.test(url)) shell.openExternal(url).catch(() => {}); return { action: 'deny' }; });
  w.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(appUrl(''))) e.preventDefault(); });
  // fermer la fenetre garde le bouclier actif dans la zone de notification
  w.on('close', e => { if (!quitting && !isMini) { e.preventDefault(); w.hide(); } });
  if (isMini) mini = w; else win = w;
  return w;
}

function notify(title, body) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, icon: ICON });
  n.on('click', () => createWindow());
  n.show();
}

// ------------------------------------------------------------ lancement avec le systeme
// Windows / macOS : reglage natif. Linux : fichier ~/.config/autostart/questline.desktop.
const linuxAutostart = () => path.join(app.getPath('home'), '.config', 'autostart', 'questline.desktop');
// la version portable Windows s'execute depuis un dossier temporaire different a chaque lancement :
// le demarrage automatique doit viser le .exe portable lui-meme
const loginPath = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
function autostartEnabled() {
  if (process.platform === 'linux') return fs.existsSync(linuxAutostart());
  return app.getLoginItemSettings({ path: loginPath, args: ['--hidden'] }).openAtLogin;
}
function setAutostart(on) {
  if (process.platform !== 'linux') { app.setLoginItemSettings({ openAtLogin: on, path: loginPath, args: ['--hidden'] }); return; }
  const f = linuxAutostart();
  if (!on) { try { fs.unlinkSync(f); } catch { /* deja absent */ } return; }
  const exe = process.env.APPIMAGE || process.execPath;
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, `[Desktop Entry]\nType=Application\nName=Questline\nExec="${exe.replace(/"/g, '')}" --hidden\nX-GNOME-Autostart-enabled=true\n`);
}

async function buildTray() {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 18, height: 18 }));
  tray.setToolTip('Questline');
  const library = require('../src/library');
  const launcher = require('../src/launcher');
  const play = async () => {
    try { const c = store.state.current; const r = c && launcher.launch(await library.findGame(c.appid)); if (r && !r.ok) notify('Questline', r.error); } catch { /* jeu introuvable */ }
  };
  const refresh = () => {
    const c = store.state.current;
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Ouvrir Questline', click: () => createWindow() },
      { label: c ? `Jouer à ${c.name}` : 'Aucune quête en cours', enabled: !!c, click: play },
      { label: 'Widget (mini-fenêtre)', click: () => createWindow('', 'mini') },
      { type: 'separator' },
      { label: 'Quitter (coupe le bouclier)', click: () => { quitting = true; app.quit(); } },
    ]));
  };
  refresh();
  tray.on('click', () => createWindow());
  setInterval(refresh, 5000);
}

// selecteurs de fichiers, uniquement pour les pages de l'app
ipcMain.handle('pick', async (e, kind) => {
  if (!e.senderFrame || !e.senderFrame.url.startsWith(appUrl(''))) return [];
  const props = kind === 'folder' ? ['openDirectory', 'multiSelections'] : ['openFile'];
  if (process.platform === 'darwin' && kind === 'app') props.push('treatPackageAsDirectory');
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { properties: props });
  return r.canceled ? [] : r.filePaths;
});

app.whenReady().then(async () => {
  store.init(app.getPath('userData'));
  // aucune permission web (camera, notifications web, geolocalisation...) pour les pages
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  // cles d'API chiffrees par le systeme (DPAPI sous Windows)
  if (safeStorage.isEncryptionAvailable()) store.setProtector({ enc: s => safeStorage.encryptString(s).toString('base64'), dec: b => safeStorage.decryptString(Buffer.from(b, 'base64')) });
  const launcher = require('../src/launcher');
  launcher.setOpener(url => shell.openExternal(url), p => shell.openPath(p));
  const guard = require('../src/guard');
  const server = require('../src/server');
  guard.setHooks({ notify, openUI: q => createWindow(q) });
  port = await server.start({
    token: TOKEN,
    openUI: () => createWindow(), openWidget: () => createWindow('', 'mini'), quit: () => { quitting = true; app.quit(); },
    autostart: autostartEnabled, setAutostart, openPath: p => shell.openPath(p), tray: true,
  });
  await session.defaultSession.cookies.set({ url: appUrl(''), name: 'ql_token', value: TOKEN, httpOnly: true, sameSite: 'strict' });
  await buildTray();
  guard.start();
  if (!HIDDEN) createWindow();
});

app.on('second-instance', () => createWindow());
app.on('activate', () => createWindow()); // macOS : clic sur l'icone du Dock
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', e => e.preventDefault()); // reste actif dans la zone de notification
