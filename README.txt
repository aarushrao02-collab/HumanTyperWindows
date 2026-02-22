# Human Typer — Electron App

Simulates human-like typing into ANY application on your computer.

---

## Setup (First Time Only)

### Prerequisites
- Install **Node.js** from https://nodejs.org (choose the LTS version)

### Steps

1. Put all these files into a folder called `humantyper`
2. Open a terminal / command prompt in that folder
3. Run:

```
npm install
```

This will download Electron and nut.js (~300MB, takes a few minutes).

4. Once done, launch the app:

```
npm start
```

---

## How to Use

1. Launch the app with `npm start`
2. Paste your text into the box
3. Set your WPM (words per minute)
4. Set a delay (e.g. 3 seconds) — this gives you time to click into your target app
5. Click **Start Typing**
6. Quickly click into whatever app/field you want text typed into (Google Docs, Word, a chat box, anything)
7. The countdown will finish and typing begins!

**Emergency stop:** Press `Ctrl+Shift+S` from anywhere to instantly stop.

---

## Mac Users — Important

nut.js needs Accessibility permissions to control the keyboard.

Go to: **System Preferences → Security & Privacy → Privacy → Accessibility**
Add your Terminal (or the app itself) to the allowed list.

---

## Notes

- Works with Google Docs, Word, Notepad, chat apps, browsers — anything
- The "Typos" toggle adds ~3% realistic typos that auto-correct
- Higher WPM = faster typing (try 80–120 for realistic speed)
