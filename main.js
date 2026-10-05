// main.js — главный процесс Electron
const { app, BrowserWindow, Menu, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

const SAVE_PATH = path.join(app.getPath('userData'), 'download-tycoon-save.json');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 980,
    minHeight: 620,
    backgroundColor: '#070a0e',
    title: 'Download Tycoon',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ---------- IPC ---------- */
ipcMain.handle('save-game', async (_e, data) => {
  try {
    fs.writeFileSync(SAVE_PATH, JSON.stringify(data), 'utf8');
    return true;
  } catch (err) {
    console.error('save-game error:', err);
    return false;
  }
});

ipcMain.handle('load-game', async () => {
  try {
    if (!fs.existsSync(SAVE_PATH)) return null;
    return JSON.parse(fs.readFileSync(SAVE_PATH, 'utf8'));
  } catch (err) {
    console.error('load-game error:', err);
    return null;
  }
});

ipcMain.handle('has-save', async () => fs.existsSync(SAVE_PATH));

ipcMain.handle('notify', async (_e, { title, body }) => {
  try {
    if (Notification.isSupported()) {
      new Notification({ title: String(title || ''), body: String(body || '') }).show();
      return true;
    }
  } catch (err) { console.error('notify error:', err); }
  return false;
});
