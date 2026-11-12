'use strict';
// Pont minimal entre l'interface et Electron : uniquement les selecteurs de fichiers.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('questline', {
  desktop: true,
  platform: process.platform,
  pick: kind => ipcRenderer.invoke('pick', ['file', 'folder', 'app'].includes(kind) ? kind : 'file'),
});
