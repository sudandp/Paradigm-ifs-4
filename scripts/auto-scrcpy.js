import { exec, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const SCRCPY_DIR = 'C:\\Users\\sudhan\\tools\\scrcpy-win64-v5.0.1';
const ADB_PATH = fs.existsSync(path.join(SCRCPY_DIR, 'adb.exe')) 
  ? path.join(SCRCPY_DIR, 'adb.exe') 
  : 'adb';
const SCRCPY_PATH = fs.existsSync(path.join(SCRCPY_DIR, 'scrcpy.exe'))
  ? path.join(SCRCPY_DIR, 'scrcpy.exe')
  : 'scrcpy';

let isScrcpyRunning = false;
let isChecking = false;

function checkScrcpyProcess() {
  return new Promise((resolve) => {
    exec('tasklist /FI "IMAGENAME eq scrcpy.exe" /NH', (err, stdout) => {
      if (err || !stdout) {
        resolve(false);
      } else {
        resolve(stdout.toLowerCase().includes('scrcpy.exe'));
      }
    });
  });
}

function checkAdbDevices() {
  return new Promise((resolve) => {
    exec(`"${ADB_PATH}" devices`, (err, stdout) => {
      if (err || !stdout) {
        resolve([]);
        return;
      }
      const lines = stdout.split('\n');
      const devices = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('List of') || trimmed.startsWith('*')) continue;
        const [serial, state] = trimmed.split(/\s+/);
        if (state === 'device' && serial) {
          devices.push(serial);
        }
      }
      resolve(devices);
    });
  });
}

async function loop() {
  if (isChecking) return;
  isChecking = true;

  try {
    const running = await checkScrcpyProcess();
    isScrcpyRunning = running;

    if (!isScrcpyRunning) {
      const devices = await checkAdbDevices();
      if (devices.length > 0) {
        const targetSerial = devices[0];
        console.log(`\n📱 [Mobile Companion] Android device connected (${targetSerial}). Auto-launching Scrcpy...`);
        
        // Spawn detached GUI window on desktop
        const scrcpyProcess = spawn('cmd.exe', [
          '/c',
          'start',
          '""',
          SCRCPY_PATH,
          '-s',
          targetSerial
        ], {
          detached: true,
          stdio: 'ignore'
        });
        scrcpyProcess.unref();

        isScrcpyRunning = true;
      }
    }
  } catch (e) {
    // Silent catch
  } finally {
    isChecking = false;
  }
}

// Initial check immediately, then check every 4 seconds
loop();
const interval = setInterval(loop, 4000);

process.on('SIGINT', () => {
  clearInterval(interval);
  process.exit(0);
});

process.on('SIGTERM', () => {
  clearInterval(interval);
  process.exit(0);
});

