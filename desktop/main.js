// ===== Standoff 3 — Electron shell (desktop main process) =====
// Loads the game straight from disk (no web server needed); the only network traffic is the
// WebSocket to the relay (your VPS or a LAN host). config.json next to the app sets the default relay address.
'use strict';
const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

function loadConfig() {
  // config.json is looked up next to the executable first (so users can edit it without unpacking
  // the app), then inside the packaged app folder (the shipped default).
  const candidates = [path.join(path.dirname(process.execPath), 'config.json'), path.join(__dirname, 'config.json')];
  if (process.platform === 'darwin') candidates.unshift(path.join(path.dirname(process.execPath), '..', '..', '..', 'config.json'));
  for (const p of candidates) { try { return Object.assign({ defaultServer: '' }, JSON.parse(fs.readFileSync(p, 'utf8'))); } catch (e) { } }
  return { defaultServer: '' };
}

app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function createWindow() {
  const cfg = loadConfig();
  // No application menu: its default accelerators (Ctrl+W close, Ctrl+R reload, Ctrl+Shift+I devtools) collide with
  // gameplay keys -- Ctrl is crouch and W is forward, so Ctrl+W used to close the game mid-match.
  // macOS keeps a minimal menu so Cmd+Q still quits.
  if (process.platform === 'darwin') Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: 'Standoff 3', submenu: [{ role: 'quit' }] }]));
  else Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1280, height: 720, minWidth: 960, minHeight: 540, show: false, backgroundColor: '#0b0f14', autoHideMenuBar: true, title: 'Standoff 3',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });
  win.setMenuBarVisibility(false);
  ipcMain.handle('s3:config', () => cfg);
  ipcMain.on('s3:fullscreen', (e, on) => win.setFullScreen(on === undefined || on === null ? !win.isFullScreen() : !!on));
  ipcMain.on('s3:quit', () => app.quit());
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.once('ready-to-show', () => { win.show(); win.maximize(); });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
