const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');

function setAutoStart(enabled) {
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath,
    });
  } catch (e) {}
}

function getAutoStart() {
  try {
    const s = app.getLoginItemSettings();
    return s.openAtLogin || false;
  } catch (e) {
    return false;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    backgroundColor: '#050B2E',
    title: 'Orpheus Player',
  });

  const indexPath = app.isPackaged
    ? path.join(process.resourcesPath, 'shared', 'index.html')
    : path.join(__dirname, '..', 'shared', 'index.html');
  win.loadFile(indexPath);

  ipcMain.on('quit', () => {
    app.quit();
  });
  ipcMain.handle('setAutoStart', (e, enabled) => {
    setAutoStart(enabled);
    return getAutoStart();
  });
  ipcMain.handle('getAutoStart', () => getAutoStart());
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
