import WebSocket from 'ws';
import { execSync } from 'child_process';

const ADB = process.env.LOCALAPPDATA + '\\Android\\Sdk\\platform-tools\\adb.exe';
const ARTIFACT_DIR = 'C:\\Users\\sudhan\\.gemini\\antigravity-ide\\brain\\c5f0a64a-dd10-40a6-9949-8be62c20ab87';

async function main() {
  const sockets = execSync(`"${ADB}" -s R9ZL20MN6SD shell cat /proc/net/unix`).toString();
  const match = sockets.match(/@(webview_devtools_remote_\d+)/);
  if (!match) throw new Error('No webview socket');
  execSync(`"${ADB}" -s R9ZL20MN6SD forward tcp:9222 localabstract:${match[1]}`);
  await new Promise(r => setTimeout(r, 400));

  const targetsRes = await fetch('http://127.0.0.1:9222/json');
  const targets = await targetsRes.json();
  const pageTarget = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  let reqId = 1;
  function sendCommand(method, params = {}) {
    return new Promise((resolve) => {
      const id = reqId++;
      ws.on('message', function h(msg) {
        const data = JSON.parse(msg.toString());
        if (data.id === id) { ws.off('message', h); resolve(data.result); }
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const b = btns.find(x => x.textContent && x.textContent.toLowerCase().includes('view my submissions'));
        if (b) b.click();
      })()
    `,
    returnByValue: true
  });

  await new Promise(r => setTimeout(r, 2500));
  execSync(`cmd /c ""${ADB}" -s R9ZL20MN6SD exec-out screencap -p > "${ARTIFACT_DIR}\\step4_phone_submissions_list.png""`);
  console.log('Saved step4_phone_submissions_list.png');
  ws.close();
}

main().catch(console.error);
