const { ipcRenderer } = require('electron');

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resumeBtn = document.getElementById('resumeBtn');
const statusText = document.getElementById('statusText');
const statusDot = document.getElementById('statusDot');
const progressFill = document.getElementById('progressFill');
const countText = document.getElementById('countText');

document.getElementById('minimizeBtn').onclick = () => ipcRenderer.send('minimize');
document.getElementById('closeBtn').onclick = () => ipcRenderer.send('close');

let countdown = null;
let hasStopped = false;

startBtn.onclick = () => {
  const text = document.getElementById('textInput').value;
  const wpm = clampNumber(document.getElementById('wpm').value, 10, 300, 60);
  const delaySec = clampNumber(document.getElementById('delay').value, 1, 10, 3);
  const targetSeconds = clampNumber(document.getElementById('targetSeconds').value, 0, 86400, 0);
  const useTypos = document.getElementById('typos').checked;
  const typoPercent = clampNumber(document.getElementById('typoPercent').value, 0, 100, 3);
  const useHesitation = document.getElementById('hesitation').checked;
  const hesitationMin = clampNumber(document.getElementById('hesitationMin').value, 1, 10000, 250);
  const hesitationMax = clampNumber(document.getElementById('hesitationMax').value, 1, 10000, 1200);
  const hesitationChance = clampNumber(document.getElementById('hesitationChance').value, 0, 100, 8);

  if (!text.trim()) {
    setStatus('Paste some text first!', false);
    return;
  }

  hasStopped = false;
  resumeBtn.style.display = 'none';
  beginCountdown(delaySec, () => {
    ipcRenderer.send('start-typing', {
      text,
      wpm,
      targetSeconds,
      useTypos,
      typoPercent,
      useHesitation,
      hesitationMin: Math.min(hesitationMin, hesitationMax),
      hesitationMax: Math.max(hesitationMin, hesitationMax),
      hesitationChance
    });
  });
};

stopBtn.onclick = () => {
  ipcRenderer.send('stop-typing');
  if (countdown) clearInterval(countdown);
  hasStopped = true;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  resumeBtn.style.display = 'flex';
  setStatus('Paused.', false);
};

resumeBtn.onclick = () => {
  const delaySec = parseInt(document.getElementById('delay').value) || 3;
  resumeBtn.style.display = 'none';
  beginCountdown(delaySec, () => {
    ipcRenderer.send('resume-typing');
  });
};

function beginCountdown(delaySec, callback) {
  let timeLeft = delaySec;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  resumeBtn.style.display = 'none';
  setStatus(`Starting in ${timeLeft}s — click your target app!`, false);

  countdown = setInterval(() => {
    timeLeft--;
    if (timeLeft > 0) {
      setStatus(`Starting in ${timeLeft}s — click your target app!`, false);
    } else {
      clearInterval(countdown);
      setStatus('Typing...', true);
      progressFill.style.width = hasStopped ? progressFill.style.width : '0%';
      countText.innerText = '';
      callback();
    }
  }, 1000);
}

ipcRenderer.on('progress', (event, { percent, current, total }) => {
  progressFill.style.width = percent + '%';
  countText.innerText = `${current} / ${total} chars`;
  setStatus('Typing...', true);
});

ipcRenderer.on('hesitation', (event, { durationMs }) => {
  setStatus(`Hesitating ${formatSeconds(durationMs)}s...`, true);
});

ipcRenderer.on('typing-done', (event, { stopped }) => {
  if (stopped) {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    resumeBtn.style.display = 'flex';
    setStatus('Paused.', false);
  } else {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    resumeBtn.style.display = 'none';
    progressFill.style.width = '100%';
    setStatus('Done!', false);
  }
});

ipcRenderer.on('force-stopped', () => {
  hasStopped = true;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  resumeBtn.style.display = 'flex';
  setStatus('Paused (hotkey).', false);
  if (countdown) clearInterval(countdown);
});

function setStatus(msg, active) {
  statusText.innerText = msg;
  statusDot.className = 'status-dot' + (active ? ' active' : '');
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function formatSeconds(ms) {
  return (ms / 1000).toFixed(ms >= 1000 ? 1 : 2);
}
