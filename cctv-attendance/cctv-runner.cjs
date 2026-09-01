const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function getPythonExe() {
  const venvPython = path.join(__dirname, 'venv', 'Scripts', 'python.exe');
  if (fs.existsSync(venvPython)) return venvPython;
  const sysPython = 'C:\\Program Files\\Python313\\python.exe';
  if (fs.existsSync(sysPython)) return sysPython;
  return 'python';
}

const MAIN_PY = path.join(__dirname, 'main.py');

function startCctv() {
  const PYTHON_EXE = getPythonExe();

  if (!fs.existsSync(MAIN_PY)) {
    console.error(`[CCTV Runner] main.py not found at: ${MAIN_PY}`);
    setTimeout(startCctv, 5000);
    return;
  }

  console.log(`[CCTV Runner] Starting Paradigm CCTV Attendance Edge Server using ${PYTHON_EXE} (Port 4100)...`);

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
