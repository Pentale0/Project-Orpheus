const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  quit: () => ipcRenderer.send('quit'),
  setAutoStart: (enabled) => ipcRenderer.invoke('setAutoStart', enabled),
  getAutoStart: () => ipcRenderer.invoke('getAutoStart'),
});
