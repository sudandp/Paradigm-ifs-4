const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const NGROK_BIN = path.join(__dirname, 'node_modules', 'ngrok', 'bin', 'ngrok.exe');
const AUTH_TOKEN = '3HSqV1IUqDT64j36cV1MESjzb6P_WCVwkdXez4UoaUMKdtP';
const DOMAIN = 'tassel-estranged-prism.ngrok-free.dev';
const PORT = 4000;

function startTunnel() {
  if (!fs.existsSync(NGROK_BIN)) {
    console.error(`[Tunnel Runner] ngrok binary missing at ${NGROK_BIN}`);
    setTimeout(startTunnel, 5000);
    return;
  }

  console.log(`[Tunnel Runner] Launching Ngrok 24/7 static tunnel (${DOMAIN}) -> http://localhost:${PORT}...`);

  const tunnel = spawn(NGROK_BIN, ['http', PORT.toString(), '--authtoken', AUTH_TOKEN, '--url', DOMAIN], {
    stdio: 'inherit',
    windowsHide: true
  });

  tunnel.on('exit', (code, signal) => {
    console.warn(`[Tunnel Runner] Tunnel process exited with code ${code}, signal ${signal}. Restarting in 5s...`);
    setTimeout(startTunnel, 5000);
  });

  tunnel.on('error', (err) => {
    console.error(`[Tunnel Runner] Error launching tunnel:`, err);
    setTimeout(startTunnel, 5000);
  });
}

startTunnel();
