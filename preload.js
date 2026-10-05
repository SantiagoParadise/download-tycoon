const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  save:    (data) => ipcRenderer.invoke('save-game', data),
  load:    () => ipcRenderer.invoke('load-game'),
  hasSave: () => ipcRenderer.invoke('has-save'),
  notify:  (title, body) => ipcRenderer.invoke('notify', { title, body })
});
