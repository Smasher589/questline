'use strict';
// Catalogue des systemes emules : extensions de jeux, emulateurs connus, arguments de lancement
// et depot de jaquettes libretro-thumbnails. "{rom}" est remplace par le chemin du jeu.

const E = (id, name, exe, args, extra = {}) => ({ id, name, exe, args, ...extra });
// exe : noms d'executables (Windows / Linux / macOS confondus) pour la detection automatique
const SWITCH_EMUS = [
  E('eden', 'Eden / Eglantine', ['eglantine.exe', 'eden.exe', 'eden', 'eden.AppImage', 'Eden.app'], ['-f', '-g', '{rom}']),
  E('citron', 'Citron', ['citron.exe', 'citron', 'citron.AppImage'], ['-f', '-g', '{rom}']),
  E('sudachi', 'Sudachi', ['sudachi.exe', 'sudachi'], ['-f', '-g', '{rom}']),
  E('yuzu', 'yuzu', ['yuzu.exe', 'yuzu'], ['-f', '-g', '{rom}']),
  E('ryujinx', 'Ryujinx', ['Ryujinx.exe', 'Ryujinx', 'Ryujinx.app'], ['--fullscreen', '{rom}']),
];
const RA = core => E(`retroarch-${core}`, `RetroArch (${core})`, ['retroarch.exe', 'retroarch', 'RetroArch.app'], ['-f', '-L', `{coresDir}/${core}_libretro{coreExt}`, '{rom}'], { core });

const SYSTEMS = [
  { id: 'switch', name: 'Nintendo Switch', exts: ['nsp', 'xci', 'nsz', 'xcz'], titleIds: true, emulators: SWITCH_EMUS },
  { id: 'switch2', name: 'Nintendo Switch 2', exts: ['nup', 'nsp', 'xci'], titleIds: true, emulators: SWITCH_EMUS.slice(0, 1) },
  { id: 'wiiu', name: 'Nintendo Wii U', exts: ['wud', 'wux', 'wua', 'rpx'], folderGame: 'code/*.rpx',
    emulators: [E('cemu', 'Cemu', ['Cemu.exe', 'cemu', 'Cemu.AppImage', 'Cemu.app'], ['-f', '-g', '{rom}'])] },
  { id: 'wii', name: 'Nintendo Wii', exts: ['wbfs', 'rvz', 'iso', 'gcz', 'ciso', 'wad', 'wia'], libretro: 'Nintendo - Wii',
    emulators: [E('dolphin', 'Dolphin', ['Dolphin.exe', 'dolphin-emu', 'Dolphin.app'], ['-b', '-e', '{rom}'])] },
  { id: 'gamecube', name: 'Nintendo GameCube', exts: ['rvz', 'iso', 'gcm', 'gcz', 'ciso'], libretro: 'Nintendo - GameCube',
    emulators: [E('dolphin', 'Dolphin', ['Dolphin.exe', 'dolphin-emu', 'Dolphin.app'], ['-b', '-e', '{rom}'])] },
  { id: '3ds', name: 'Nintendo 3DS', exts: ['3ds', 'cci', 'cxi', 'cia', '3dsx'], libretro: 'Nintendo - Nintendo 3DS',
    emulators: [E('azahar', 'Azahar / Lime3DS / Citra', ['azahar.exe', 'azahar', 'lime3ds.exe', 'lime3ds', 'citra-qt.exe', 'citra-qt'], ['-f', '{rom}'])] },
  { id: 'ds', name: 'Nintendo DS', exts: ['nds', 'dsi'], libretro: 'Nintendo - Nintendo DS',
    emulators: [E('melonds', 'melonDS', ['melonDS.exe', 'melonDS', 'melonDS.app'], ['-f', '{rom}']), RA('melonds')] },
  { id: 'n64', name: 'Nintendo 64', exts: ['z64', 'n64', 'v64'], libretro: 'Nintendo - Nintendo 64', emulators: [RA('mupen64plus_next')] },
  { id: 'snes', name: 'Super Nintendo', exts: ['sfc', 'smc'], libretro: 'Nintendo - Super Nintendo Entertainment System', emulators: [RA('snes9x')] },
  { id: 'nes', name: 'NES', exts: ['nes', 'fds', 'unf'], libretro: 'Nintendo - Nintendo Entertainment System', emulators: [RA('mesen'), RA('nestopia')] },
  { id: 'gba', name: 'Game Boy Advance', exts: ['gba'], libretro: 'Nintendo - Game Boy Advance', emulators: [RA('mgba')] },
  { id: 'gbc', name: 'Game Boy / Color', exts: ['gb', 'gbc'], libretro: 'Nintendo - Game Boy Color', emulators: [RA('gambatte'), RA('mgba')] },
  { id: 'ps1', name: 'PlayStation', exts: ['cue', 'chd', 'pbp', 'm3u', 'ecm'], libretro: 'Sony - PlayStation', multiDisc: true,
    emulators: [E('duckstation', 'DuckStation', ['duckstation-qt-x64-ReleaseLTCG.exe', 'duckstation-qt.exe', 'duckstation-qt', 'DuckStation.AppImage', 'DuckStation.app'], ['-fullscreen', '{rom}']), RA('swanstation')] },
  { id: 'ps2', name: 'PlayStation 2', exts: ['iso', 'chd', 'cso', 'gz'], libretro: 'Sony - PlayStation 2',
    emulators: [E('pcsx2', 'PCSX2', ['pcsx2-qt.exe', 'pcsx2-qtx64-avx2.exe', 'pcsx2-qt', 'pcsx2.AppImage', 'PCSX2.app'], ['-fullscreen', '-batch', '{rom}'])] },
  { id: 'ps3', name: 'PlayStation 3', exts: ['iso', 'pkg'], folderGame: 'PS3_GAME/USRDIR/EBOOT.BIN', libretro: 'Sony - PlayStation 3',
    emulators: [E('rpcs3', 'RPCS3', ['rpcs3.exe', 'rpcs3', 'rpcs3.AppImage', 'RPCS3.app'], ['--no-gui', '{rom}'])] },
  { id: 'psp', name: 'PSP', exts: ['iso', 'cso', 'pbp', 'chd'], libretro: 'Sony - PlayStation Portable',
    emulators: [E('ppsspp', 'PPSSPP', ['PPSSPPWindows64.exe', 'PPSSPPQt', 'ppsspp', 'PPSSPPSDL.app', 'PPSSPP.app'], ['--fullscreen', '{rom}'])] },
  { id: 'ps4', name: 'PlayStation 4', exts: ['bin'], folderGame: 'eboot.bin',
    emulators: [E('shadps4', 'shadPS4', ['shadPS4.exe', 'shadps4', 'Shadps4-qt.AppImage', 'shadps4.app'], ['-g', '{rom}'])] },
  { id: 'xbox360', name: 'Xbox 360', exts: ['iso', 'xex', 'zar'], libretro: 'Microsoft - Xbox 360',
    emulators: [E('xenia', 'Xenia Canary', ['xenia_canary.exe', 'xenia.exe'], ['--fullscreen', '{rom}'])] },
  { id: 'megadrive', name: 'Mega Drive / Genesis', exts: ['md', 'gen', 'smd', 'bin'], libretro: 'Sega - Mega Drive - Genesis', emulators: [RA('genesis_plus_gx')] },
  { id: 'dreamcast', name: 'Dreamcast', exts: ['chd', 'gdi', 'cdi'], libretro: 'Sega - Dreamcast', emulators: [RA('flycast')] },
];

const byId = id => SYSTEMS.find(s => s.id === id) || null;
function emulator(systemId, emuId) {
  const s = byId(systemId);
  return s ? s.emulators.find(e => e.id === emuId) || null : null;
}
// vue envoyee a l'interface
const publicCatalog = () => SYSTEMS.map(s => ({ id: s.id, name: s.name, exts: s.exts, emulators: s.emulators.map(e => ({ id: e.id, name: e.name })) }));

module.exports = { SYSTEMS, byId, emulator, publicCatalog };
