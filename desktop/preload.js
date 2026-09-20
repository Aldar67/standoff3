// ===== Standoff 3 — Electron preload: tiny bridge the game page can use to know it runs as a desktop app =====
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('S3_DESKTOP', {
  platform: process.platform,
  getConfig: () => ipcRenderer.invoke('s3:config'),
  setFullscreen: (on) => ipcRenderer.send('s3:fullscreen', on),
  quit: () => ipcRenderer.send('s3:quit'),
});
