const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PYTHON_EXE = path.join(__dirname, 'venv', 'Scripts', 'python.exe');
const MAIN_PY = path.join(__dirname, 'main.py');

function startCctv() {
  if (!fs.existsSync(PYTHON_EXE)) {
    console.error(`[CCTV Runner] Python virtual environment not found at: ${PYTHON_EXE}`);
    setTimeout(startCctv, 5000);
    return;
  }

  if (!fs.existsSync(MAIN_PY)) {
    console.error(`[CCTV Runner] main.py not found at: ${MAIN_PY}`);
    setTimeout(startCctv, 5000);
    return;
  }

  console.log('[CCTV Runner] Starting Paradigm CCTV Attendance Edge Server (Port 4100)...');

  const child = spawn(PYTHON_EXE, [MAIN_PY], {
    cwd: __dirname,
    stdio: 'inherit',
    windowsHide: true,
  });

  child.on('exit', (code, signal) => {
    console.warn(`[CCTV Runner] Python process exited with code ${code}, signal ${signal}. Restarting in 5s...`);
    setTimeout(startCctv, 5000);
  });

  child.on('error', (err) => {
    console.error('[CCTV Runner] Failed to start Python process:', err);
    setTimeout(startCctv, 5000);
  });
}

startCctv();
