// main.js — Electron Main Process for Claude-kun RPG
// Ensure ELECTRON_RUN_AS_NODE is not set (may be inherited from parent process)
delete process.env.ELECTRON_RUN_AS_NODE;
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Paths
const EVENTS_FILE = path.join(os.homedir(), '.claude-kun', 'events.jsonl');
const DATA_DIR = path.join(os.homedir(), '.claude-kun');
const SAVE_FILE = path.join(DATA_DIR, 'rpg_data.json');

let mainWindow = null;
let fileWatcher = null;
let lastFileSize = 0;

// ── Game Data ──────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadGameData() {
  try {
    if (fs.existsSync(SAVE_FILE)) {
      return JSON.parse(fs.readFileSync(SAVE_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Failed to load game data:', err);
  }
  return null;
}

function saveGameData(data) {
  try {
    ensureDataDir();
    fs.writeFileSync(SAVE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to save game data:', err);
    return false;
  }
}

// ── Events JSONL Watcher ───────────────────────────────────

function readNewLines() {
  try {
    if (!fs.existsSync(EVENTS_FILE)) return;
    const stat = fs.statSync(EVENTS_FILE);
    if (stat.size <= lastFileSize) {
      if (stat.size < lastFileSize) lastFileSize = 0;
      else return;
    }

    const newData = Buffer.alloc(stat.size - lastFileSize);
    const fd = fs.openSync(EVENTS_FILE, 'r');
    fs.readSync(fd, newData, 0, newData.length, lastFileSize);
    fs.closeSync(fd);
    lastFileSize = stat.size;

    const lines = newData.toString('utf-8').split('\n').filter(line => line.trim());
    for (const line of lines) {
      try {
        const eventData = JSON.parse(line);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('game-event', eventData);
        }
      } catch (_) {}
    }
  } catch (err) {
    console.error('Failed to read new event lines:', err);
  }
}

function startWatchingEvents() {
  try {
    if (fs.existsSync(EVENTS_FILE)) {
      lastFileSize = fs.statSync(EVENTS_FILE).size;
    } else {
      lastFileSize = 0;
    }
  } catch { lastFileSize = 0; }

  try {
    ensureDataDir();
    if (!fs.existsSync(EVENTS_FILE)) {
      fs.writeFileSync(EVENTS_FILE, '', 'utf-8');
    }
    fileWatcher = fs.watch(EVENTS_FILE, { persistent: false }, (eventType) => {
      if (eventType === 'change') readNewLines();
    });
    fileWatcher.on('error', () => {});
  } catch (err) {
    setTimeout(startWatchingEvents, 5000);
  }
}

function stopWatchingEvents() {
  if (fileWatcher) { fileWatcher.close(); fileWatcher = null; }
}

// ── Window ─────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 750,
    minWidth: 360,
    minHeight: 500,
    resizable: true,
    title: 'Claude-kun RPG',
    alwaysOnTop: true,
    transparent: false,
    backgroundColor: '#1a1a2e',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    const gameData = loadGameData();
    if (gameData) mainWindow.webContents.send('game-data', gameData);
    startWatchingEvents();
  });

  mainWindow.on('close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('before-close');
    }
  });

  mainWindow.on('closed', () => {
    stopWatchingEvents();
    mainWindow = null;
  });
}

// ── App Lifecycle ──────────────────────────────────────────

// Register IPC handlers BEFORE window creation so they're ready when renderer loads
ipcMain.on('save-game', (_event, data) => saveGameData(data));
ipcMain.on('load-game', (event) => { event.returnValue = loadGameData(); });
ipcMain.handle('toggle-always-on-top', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const current = mainWindow.isAlwaysOnTop();
    mainWindow.setAlwaysOnTop(!current);
    return !current;
  }
  return false;
});

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  stopWatchingEvents();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
