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
  const wpm = parseInt(document.getElementById('wpm').value) || 60;
  const delaySec = parseInt(document.getElementById('delay').value) || 3;
  const useTypos = document.getElementById('typos').checked;

  if (!text.trim()) {
    setStatus('Paste some text first!', false);
    return;
  }

  hasStopped = false;
  resumeBtn.style.display = 'none';
  beginCountdown(delaySec, () => {
    ipcRenderer.send('start-typing', { text, wpm, useTypos });
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
