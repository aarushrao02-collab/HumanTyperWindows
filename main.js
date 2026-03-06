const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const { keyboard, Key } = require('@nut-tree-fork/nut-js');

keyboard.config.autoDelayMs = 0;

let mainWindow;
let isTyping = false;
let stopRequested = false;
let resumePosition = 0;
let savedState = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 600,
    resizable: false,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    if (isTyping) {
      stopRequested = true;
      mainWindow.webContents.send('force-stopped');
    }
  });
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());

ipcMain.on('minimize', () => mainWindow.minimize());
ipcMain.on('close', () => app.quit());

ipcMain.on('start-typing', async (event, payload) => {
  if (isTyping) return;
  savedState = payload;
  resumePosition = 0;
  await doTyping(event, payload, 0);
});

ipcMain.on('resume-typing', async (event) => {
  if (isTyping || !savedState) return;
  await doTyping(event, savedState, resumePosition);
});

ipcMain.on('stop-typing', () => {
  stopRequested = true;
});

async function doTyping(event, { text, wpm, useTypos }, startIndex) {
  isTyping = true;
  stopRequested = false;

  const baseDelay = 60000 / (wpm * 5);

  const adjacentKeys = {
    'a': ['s', 'q', 'z'], 'b': ['v', 'n', 'g'], 'c': ['x', 'v', 'd'],
    'd': ['s', 'f', 'e'], 'e': ['w', 'r', 'd'], 'f': ['d', 'g', 'r'],
    'g': ['f', 'h', 't'], 'h': ['g', 'j', 'y'], 'i': ['u', 'o', 'k'],
    'j': ['h', 'k', 'u'], 'k': ['j', 'l', 'i'], 'l': ['k', 'o'],
    'm': ['n', 'k'], 'n': ['b', 'm', 'h'], 'o': ['i', 'p', 'l'],
    'p': ['o', 'l'], 'q': ['w', 'a'], 'r': ['e', 't', 'f'],
    's': ['a', 'd', 'w'], 't': ['r', 'y', 'g'], 'u': ['y', 'i', 'j'],
    'v': ['c', 'b', 'f'], 'w': ['q', 'e', 's'], 'x': ['z', 'c', 's'],
    'y': ['t', 'u', 'h'], 'z': ['a', 'x']
  };

  const chars = text.split('');

  for (let i = startIndex; i < chars.length; i++) {
    if (stopRequested) {
      resumePosition = i;
      break;
    }

    const char = chars[i];
    const lowerChar = char.toLowerCase();

    if (useTypos && Math.random() < 0.03 && adjacentKeys[lowerChar]) {
      const wrongKey = adjacentKeys[lowerChar][Math.floor(Math.random() * adjacentKeys[lowerChar].length)];
      await typeChar(wrongKey);
      await wait(baseDelay * 2.5);
      await keyboard.type(Key.Backspace);
      await wait(baseDelay * 1.5);
    }

    await typeChar(char);

    let extra = 0;
    if (char === ' ')  extra = baseDelay * 0.8;
    if (char === ',')  extra = baseDelay * 1.2;
    if (/[.!?]/.test(char)) extra = baseDelay * 3;
    if (char === '\n') extra = baseDelay * 4;

    event.reply('progress', {
      percent: Math.round(((i + 1) / chars.length) * 100),
      current: i + 1,
      total: chars.length
    });

    const jitter = baseDelay * (0.8 + Math.random() * 0.4);
    await wait(jitter + extra);
  }

  isTyping = false;
  event.reply('typing-done', { stopped: stopRequested });
}

async function typeChar(char) {
  try {
    if (char === '\n') {
      await keyboard.type(Key.Return);
    } else if (char === '\t') {
      await keyboard.type(Key.Tab);
    } else if (char === ' ') {
      await keyboard.type(Key.Space);
    } else {
      await keyboard.type(char);
    }
  } catch (e) {
    // skip unrecognized chars
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
