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
    width: 460,
    height: 760,
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

async function doTyping(event, payload, startIndex) {
  isTyping = true;
  stopRequested = false;

  const {
    text,
    wpm,
    targetSeconds,
    useTypos,
    typoPercent,
    useHesitation,
    hesitationMin,
    hesitationMax,
    hesitationChance
  } = normalizePayload(payload);

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
  const typoRate = useTypos ? typoPercent / 100 : 0;
  const baseDelay = getBaseDelay(chars, wpm, targetSeconds);
  const remainingRatio = chars.length ? (chars.length - startIndex) / chars.length : 1;
  const remainingBudgetMs = targetSeconds > 0 ? targetSeconds * 1000 * remainingRatio : 0;
  const deadline = remainingBudgetMs > 0 ? Date.now() + remainingBudgetMs : 0;

  for (let i = startIndex; i < chars.length; i++) {
    if (stopRequested) {
      resumePosition = i;
      break;
    }

    const char = chars[i];
    const lowerChar = char.toLowerCase();

    if (Math.random() < typoRate && adjacentKeys[lowerChar]) {
      const wrongKey = adjacentKeys[lowerChar][Math.floor(Math.random() * adjacentKeys[lowerChar].length)];
      await typeChar(wrongKey);
      await waitWithinLimit(baseDelay * 2.5, deadline, chars.length - i);
      await keyboard.type(Key.Backspace);
      await waitWithinLimit(baseDelay * 1.5, deadline, chars.length - i);
    }

    if (useHesitation && shouldHesitate(char, chars[i - 1], hesitationChance)) {
      const hesitationDelay = getLimitedWaitMs(
        randomBetween(hesitationMin, hesitationMax),
        deadline,
        chars.length - i
      );
      if (hesitationDelay >= 50) {
        event.reply('hesitation', { durationMs: Math.round(hesitationDelay) });
      }
      await wait(hesitationDelay);
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
    await waitWithinLimit(jitter + extra, deadline, chars.length - i - 1);
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

function normalizePayload(payload) {
  return {
    text: String(payload.text || ''),
    wpm: clampNumber(payload.wpm, 10, 300, 60),
    targetSeconds: clampNumber(payload.targetSeconds, 0, 86400, 0),
    useTypos: Boolean(payload.useTypos),
    typoPercent: clampNumber(payload.typoPercent, 0, 100, 3),
    useHesitation: Boolean(payload.useHesitation),
    hesitationMin: clampNumber(payload.hesitationMin, 1, 10000, 250),
    hesitationMax: clampNumber(payload.hesitationMax, 1, 10000, 1200),
    hesitationChance: clampNumber(payload.hesitationChance, 0, 100, 8)
  };
}

function getBaseDelay(chars, wpm, targetSeconds) {
  const wpmDelay = 60000 / (wpm * 5);
  if (!targetSeconds || !chars.length) return wpmDelay;

  const estimatedWeight = chars.reduce((total, char) => {
    if (char === '\n') return total + 5;
    if (/[.!?]/.test(char)) return total + 4;
    if (char === ',') return total + 2.2;
    if (char === ' ') return total + 1.8;
    return total + 1;
  }, 0);

  return Math.max(1, Math.min(wpmDelay, (targetSeconds * 1000) / estimatedWeight));
}

function shouldHesitate(char, previousChar, hesitationChance) {
  const baseChance = hesitationChance / 100;
  if (baseChance <= 0) return false;
  if (/[.!?]/.test(previousChar || '')) return Math.random() < Math.max(baseChance, 0.35);
  if (char === ' ') return Math.random() < Math.max(baseChance, 0.08);
  return Math.random() < baseChance;
}

async function waitWithinLimit(desiredMs, deadline, remainingChars) {
  await wait(getLimitedWaitMs(desiredMs, deadline, remainingChars));
}

function getLimitedWaitMs(desiredMs, deadline, remainingChars) {
  if (!deadline) return Math.max(0, desiredMs);

  const remainingMs = deadline - Date.now();
  const reserveMs = Math.max(0, remainingChars) * 2;
  const allowedMs = Math.max(0, remainingMs - reserveMs);
  return Math.min(Math.max(0, desiredMs), allowedMs);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
